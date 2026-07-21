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

export interface AddressResult {
  address: string;
  latitude: number;
  longitude: number;
}

export interface AddressAutocompleteProps {
  onSelect: (result: AddressResult) => void;
  placeholder?: string;
  defaultValue?: string;
  style?: React.CSSProperties;
}

export default function AddressAutocomplete({
  onSelect,
  placeholder = 'Enter your address',
  defaultValue = '',
  style,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    loadGoogleMaps()
      .then((maps) => {
        if (!mounted || !inputRef.current) return;
        const ac = new maps.places.Autocomplete(inputRef.current, {
          types: ['address'],
          fields: ['formatted_address', 'geometry'],
        });
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          if (place?.geometry?.location) {
            onSelect({
              address: place.formatted_address || inputRef.current!.value,
              latitude: place.geometry.location.lat(),
              longitude: place.geometry.location.lng(),
            });
          }
        });
        autocompleteRef.current = ac;
      })
      .catch((e) => {
        console.error('Autocomplete load error:', e);
        if (mounted) setError(typeof e === 'string' ? e : 'Autocomplete unavailable');
      });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        defaultValue={defaultValue}
        placeholder={error ? 'Address (autocomplete unavailable)' : placeholder}
        style={style}
      />
    </div>
  );
}
