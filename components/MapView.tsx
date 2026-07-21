'use client';

import React, { useEffect, useRef, useState } from 'react';

let loaderPromise: Promise<any> | null = null;

function loadGoogleMaps(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject('No window');
  if ((window as any).google?.maps) return Promise.resolve((window as any).google.maps);
  if (loaderPromise) return loaderPromise;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return Promise.reject('No Google Maps API key configured');

  loaderPromise = new Promise((resolve, reject) => {
    const cbName = `__gm_init_${Date.now()}`;
    (window as any)[cbName] = () => {
      resolve((window as any).google.maps);
      delete (window as any)[cbName];
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${cbName}&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject('Google Maps failed to load');
    document.head.appendChild(script);
  });
  return loaderPromise;
}

export interface MapPin {
  id: number | string;
  lat: number;
  lng: number;
  label?: string;
  onClick?: () => void;
}

export interface MapViewProps {
  pins?: MapPin[];
  userLat?: number | null;
  userLng?: number | null;
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  height?: number | string;
  radius?: number;
  interactive?: boolean;
}

export default function MapView({
  pins = [],
  userLat,
  userLng,
  centerLat,
  centerLng,
  zoom = 13,
  height = 300,
  radius = 0,
  interactive = true,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Load and initialize the map (once)
  useEffect(() => {
    let mounted = true;
    loadGoogleMaps()
      .then((maps) => {
        if (!mounted || !containerRef.current) return;

        const initCenter = (centerLat != null && centerLng != null)
          ? { lat: centerLat, lng: centerLng }
          : (userLat != null && userLng != null)
            ? { lat: userLat, lng: userLng }
            : (pins[0] ? { lat: pins[0].lat, lng: pins[0].lng } : { lat: 37.7749, lng: -122.4194 });

        mapRef.current = new maps.Map(containerRef.current, {
          center: initCenter,
          zoom,
          disableDefaultUI: true,
          zoomControl: interactive,
          gestureHandling: interactive ? 'auto' : 'none',
          clickableIcons: false,
          styles: [
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          ],
          backgroundColor: '#eae4d9',
        });
        setReady(true);
      })
      .catch((e) => {
        console.error('Map load error:', e);
        if (mounted) setError(typeof e === 'string' ? e : 'Failed to load map');
      });

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update pins when they change
  useEffect(() => {
    if (!ready || !mapRef.current || !(window as any).google?.maps) return;
    const maps = (window as any).google.maps;

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    pins.forEach((pin) => {
      const marker = new maps.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        map: mapRef.current,
        label: pin.label ? { text: pin.label, color: '#fff', fontSize: '11px', fontWeight: '700' } : undefined,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#c8552b',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      });
      if (pin.onClick) marker.addListener('click', pin.onClick);
      markersRef.current.push(marker);
    });
  }, [pins, ready]);

  // User location marker (blue dot)
  useEffect(() => {
    if (!ready || !mapRef.current || !(window as any).google?.maps) return;
    if (userMarkerRef.current) { userMarkerRef.current.setMap(null); userMarkerRef.current = null; }
    if (userLat == null || userLng == null) return;
    const maps = (window as any).google.maps;
    userMarkerRef.current = new maps.Marker({
      position: { lat: userLat, lng: userLng },
      map: mapRef.current,
      icon: {
        path: maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#4285F4',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 3,
      },
      zIndex: 999,
    });
  }, [userLat, userLng, ready]);

  // Recenter when center prop changes
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (centerLat != null && centerLng != null) {
      mapRef.current.setCenter({ lat: centerLat, lng: centerLng });
    }
  }, [centerLat, centerLng, ready]);

  if (error) {
    return (
      <div style={{ width: '100%', height, borderRadius: radius, background: '#efe7da', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a7f74', fontSize: 12, textAlign: 'center', padding: 20 }}>
        Map unavailable
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height, borderRadius: radius, overflow: 'hidden', background: '#efe7da', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {!ready && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a7f74', fontSize: 12 }}>
          Loading map…
        </div>
      )}
    </div>
  );
}
