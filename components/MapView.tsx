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

// Convert a photo URL to a data URI so it can be embedded in an SVG marker
function loadImageAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // If already a data URL, use it directly
    if (url.startsWith('data:')) { resolve(url); return; }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 128;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject('No canvas'); return; }
      // Cover crop
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      try { resolve(canvas.toDataURL('image/jpeg', 0.85)); }
      catch { reject('Canvas taint'); }
    };
    img.onerror = () => reject('Image failed to load');
    img.src = url;
  });
}

// Build an SVG marker for a dish: circular photo (or emoji fallback) with a terracotta ring and pointer tail
function buildDishMarkerSvg(photoDataUrl: string | null, emoji: string, label?: string): string {
  const size = 64;
  const ring = 4;
  const inner = size - ring * 2;
  const stripe = `<pattern id="stripe" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)"><rect width="4" height="8" fill="#ece3d5"/><rect x="4" width="4" height="8" fill="#f2ebde"/></pattern>`;
  const image = photoDataUrl
    ? `<image href="${photoDataUrl}" x="${ring}" y="${ring}" width="${inner}" height="${inner}" clip-path="url(#clip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="${size/2}" cy="${size/2}" r="${inner/2}" fill="url(#stripe)"/>
       <text x="${size/2}" y="${size/2 + 10}" font-size="26" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif">${emoji}</text>`;
  const priceTail = label
    ? `<g transform="translate(${size/2 - 22}, ${size + 2})">
         <rect width="44" height="22" rx="11" fill="#c8552b" stroke="#fff" stroke-width="2"/>
         <text x="22" y="16" text-anchor="middle" fill="#fff" font-size="12" font-weight="700" font-family="DM Sans, system-ui, sans-serif">${label}</text>
       </g>`
    : '';
  const totalH = size + (label ? 26 : 4);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${totalH}" viewBox="0 0 ${size} ${totalH}">
    <defs>
      <clipPath id="clip"><circle cx="${size/2}" cy="${size/2}" r="${inner/2}"/></clipPath>
      ${stripe}
    </defs>
    <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 1}" fill="#c8552b"/>
    ${image}
    ${priceTail}
  </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

export interface MapPin {
  id: number | string;
  lat: number;
  lng: number;
  label?: string;
  photoUrl?: string | null;
  emoji?: string;
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
  showDirections?: boolean;
  onDirectionsReady?: (info: { distanceText: string; durationText: string } | null) => void;
  // Live turn-by-turn toward pins[0]: watches the device GPS, follows the
  // camera, advances steps as the user moves, and reroutes when off course.
  navigationMode?: boolean;
  onNavUpdate?: (nav: NavUpdate | null) => void;
}

export interface NavUpdate {
  instruction: string;          // current maneuver, plain text
  stepDistanceText: string;     // length of the current step
  remainingDistanceText: string;
  remainingDurationText: string;
  arrived: boolean;
}

// Great-circle distance in meters
function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Google returns step instructions as HTML ("Turn <b>left</b> onto…") — plain-text them.
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
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
  showDirections = false,
  onDirectionsReady,
  navigationMode = false,
  onNavUpdate,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const dirRendererRef = useRef<any>(null);
  const navMarkerRef = useRef<any>(null);
  const navWatchRef = useRef<number | null>(null);
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

  // Render pins whenever they change
  useEffect(() => {
    if (!ready || !mapRef.current || !(window as any).google?.maps) return;
    const maps = (window as any).google.maps;

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    let cancelled = false;

    // Compute pin size based on current zoom level.
    // Zoom 15+ (street) → 64px, zoom 8- (regional) → 20px, linear between.
    const sizeForZoom = (z: number): number => {
      if (z >= 15) return 64;
      if (z <= 8) return 20;
      // Interpolate between 20 (at z=8) and 64 (at z=15)
      return Math.round(20 + ((z - 8) / (15 - 8)) * (64 - 20));
    };

    // Cache the icon URL per pin so we don't rebuild the SVG on every zoom event.
    // We do keep width/height dynamic (via scaledSize).
    const iconCache: { url: string; hasLabel: boolean }[] = [];

    const buildMarker = (pin: MapPin, iconIndex: number, currentZoom: number) => {
      const size = sizeForZoom(currentZoom);
      // Hide the price tail at small zoom levels — it becomes unreadable
      const showLabel = size >= 40 && !!pin.label;
      const totalH = size + (showLabel ? Math.round(size * 0.4) : Math.round(size * 0.06));
      return new maps.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        map: mapRef.current,
        icon: {
          url: iconCache[iconIndex].url,
          scaledSize: new maps.Size(size, totalH),
          anchor: new maps.Point(size / 2, size / 2),
        },
      });
    };

    const render = async () => {
      // First pass: load all photos and build SVGs
      for (const pin of pins) {
        let photoData: string | null = null;
        if (pin.photoUrl) {
          try { photoData = await loadImageAsDataUrl(pin.photoUrl); }
          catch { photoData = null; }
        }
        if (cancelled) return;
        const iconUrl = buildDishMarkerSvg(photoData, pin.emoji || '🍽️', pin.label);
        iconCache.push({ url: iconUrl, hasLabel: !!pin.label });
      }
      if (cancelled) return;

      // Second pass: create markers at current zoom
      const currentZoom = mapRef.current.getZoom() || 13;
      pins.forEach((pin, i) => {
        const marker = buildMarker(pin, i, currentZoom);
        if (pin.onClick) marker.addListener('click', pin.onClick);
        markersRef.current.push(marker);
      });

      // Listen for zoom changes and rescale
      const zoomListener = mapRef.current.addListener('zoom_changed', () => {
        const z = mapRef.current.getZoom() || 13;
        const size = sizeForZoom(z);
        markersRef.current.forEach((marker, i) => {
          const showLabel = size >= 40 && iconCache[i]?.hasLabel;
          const totalH = size + (showLabel ? Math.round(size * 0.4) : Math.round(size * 0.06));
          marker.setIcon({
            url: iconCache[i].url,
            scaledSize: new maps.Size(size, totalH),
            anchor: new maps.Point(size / 2, size / 2),
          });
        });
      });

      // Save listener so we can clean it up
      (markersRef.current as any).__zoomListener = zoomListener;
    };
    render();

    return () => {
      cancelled = true;
      const listener = (markersRef.current as any).__zoomListener;
      if (listener && (window as any).google?.maps) {
        (window as any).google.maps.event.removeListener(listener);
      }
    };
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

  // Directions: draw route from user to first pin
  useEffect(() => {
    if (!ready || !mapRef.current || !(window as any).google?.maps) return;
    const maps = (window as any).google.maps;

    // Clear any existing route
    if (dirRendererRef.current) {
      dirRendererRef.current.setMap(null);
      dirRendererRef.current = null;
      onDirectionsReady?.(null);
    }

    if (!showDirections || userLat == null || userLng == null || pins.length === 0) return;

    const destination = { lat: pins[0].lat, lng: pins[0].lng };
    const origin = { lat: userLat, lng: userLng };

    const svc = new maps.DirectionsService();
    const renderer = new maps.DirectionsRenderer({
      map: mapRef.current,
      suppressMarkers: true, // we render our own pins
      polylineOptions: {
        strokeColor: '#c8552b',
        strokeWeight: 5,
        strokeOpacity: 0.85,
      },
    });
    dirRendererRef.current = renderer;

    svc.route(
      { origin, destination, travelMode: maps.TravelMode.DRIVING },
      (result: any, status: any) => {
        if (status === 'OK' && result) {
          renderer.setDirections(result);
          const leg = result.routes[0]?.legs[0];
          if (leg) {
            onDirectionsReady?.({
              distanceText: leg.distance?.text || '',
              durationText: leg.duration?.text || '',
            });
          }
        } else {
          console.warn('Directions failed:', status);
          onDirectionsReady?.(null);
        }
      }
    );

    return () => {
      if (dirRendererRef.current) {
        dirRendererRef.current.setMap(null);
        dirRendererRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDirections, userLat, userLng, pins, ready]);

  // Live navigation toward pins[0]: GPS watch + camera follow + step
  // advancement + off-route rerouting. Voice guidance isn't possible on the
  // web (Google's Navigation SDK is native-only) — this is the full visual
  // turn-by-turn experience, and the parent offers a Google Maps handoff for
  // spoken directions.
  useEffect(() => {
    if (!ready || !navigationMode || !mapRef.current || !(window as any).google?.maps) return;
    if (pins.length === 0 || !navigator.geolocation) { onNavUpdate?.(null); return; }
    const maps = (window as any).google.maps;
    const destination = { lat: pins[0].lat, lng: pins[0].lng };
    let cancelled = false;

    const renderer = new maps.DirectionsRenderer({
      map: mapRef.current,
      suppressMarkers: true,
      polylineOptions: { strokeColor: '#c8552b', strokeWeight: 6, strokeOpacity: 0.9 },
    });

    // Route bookkeeping lives in a local: steps, current step index, the
    // route's overview path (for off-route detection), last reroute time.
    let route: { steps: any[]; stepIndex: number; overview: any[]; lastRouteAt: number } | null = null;
    let routing = false;

    const requestRoute = (from: { lat: number; lng: number }) => {
      if (routing) return;
      routing = true;
      new maps.DirectionsService().route(
        { origin: from, destination, travelMode: maps.TravelMode.DRIVING },
        (result: any, status: any) => {
          routing = false;
          if (cancelled) return;
          if (status === 'OK' && result) {
            renderer.setDirections(result);
            route = {
              steps: result.routes[0]?.legs[0]?.steps || [],
              stepIndex: 0,
              overview: result.routes[0]?.overview_path || [],
              lastRouteAt: Date.now(),
            };
            pushUpdate(from);
          } else {
            onNavUpdate?.(null);
          }
        },
      );
    };

    const pushUpdate = (pos: { lat: number; lng: number }) => {
      if (!route) return;
      // Advance past steps whose endpoint we've reached (~45 m)
      while (route.stepIndex < route.steps.length - 1) {
        const end = route.steps[route.stepIndex].end_location;
        if (metersBetween(pos, { lat: end.lat(), lng: end.lng() }) < 45) route.stepIndex++;
        else break;
      }
      const arrived = metersBetween(pos, destination) < 35;
      let remM = 0, remS = 0;
      for (let i = route.stepIndex; i < route.steps.length; i++) {
        remM += route.steps[i].distance?.value || 0;
        remS += route.steps[i].duration?.value || 0;
      }
      const cur = route.steps[route.stepIndex];
      onNavUpdate?.({
        instruction: arrived
          ? 'You have arrived'
          : stripHtml(cur?.instructions || 'Head toward the pickup spot'),
        stepDistanceText: cur?.distance?.text || '',
        remainingDistanceText: remM >= 322 ? `${(remM / 1609.34).toFixed(1)} mi` : `${Math.round(remM * 3.281)} ft`,
        remainingDurationText: `${Math.max(1, Math.round(remS / 60))} min`,
        arrived,
      });
      // Off-route (> 80 m from the drawn route) → reroute, at most every 20 s
      if (!arrived && route.overview.length > 1 && Date.now() - route.lastRouteAt > 20000) {
        let nearest = Infinity;
        for (const p of route.overview) {
          const d = metersBetween(pos, { lat: p.lat(), lng: p.lng() });
          if (d < nearest) nearest = d;
        }
        if (nearest > 80) requestRoute(pos);
      }
    };

    navWatchRef.current = navigator.geolocation.watchPosition(
      (fix) => {
        if (cancelled || !mapRef.current) return;
        const pos = { lat: fix.coords.latitude, lng: fix.coords.longitude };
        if (!navMarkerRef.current) {
          navMarkerRef.current = new maps.Marker({
            position: pos,
            map: mapRef.current,
            icon: {
              path: maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: '#4285F4',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 3,
            },
            zIndex: 1000,
          });
        } else {
          navMarkerRef.current.setPosition(pos);
        }
        mapRef.current.panTo(pos);
        if ((mapRef.current.getZoom() || 0) < 15) mapRef.current.setZoom(16);
        if (!route) requestRoute(pos);
        else pushUpdate(pos);
      },
      () => { if (!cancelled) onNavUpdate?.(null); },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
    );

    return () => {
      cancelled = true;
      if (navWatchRef.current != null) {
        navigator.geolocation.clearWatch(navWatchRef.current);
        navWatchRef.current = null;
      }
      if (navMarkerRef.current) { navMarkerRef.current.setMap(null); navMarkerRef.current = null; }
      renderer.setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationMode, ready, pins[0]?.lat, pins[0]?.lng]);

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
