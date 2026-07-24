'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// Renders a QR code for a value (e.g. plates:pickup:<orderId>:<code>).
// Generated entirely client-side — nothing leaves the device.
export default function QrReceipt({ value, size = 180 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { width: size * 2, margin: 1, color: { dark: '#1f3a28', light: '#ffffff' } })
      .then(url => { if (alive) setDataUrl(url); })
      .catch(err => console.error('QR generate error:', err));
    return () => { alive = false; };
  }, [value, size]);

  if (!dataUrl) return <div style={{ width: size, height: size, margin: '0 auto', borderRadius: 12, background: '#f0ece3' }} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={dataUrl} alt="Pickup QR code" width={size} height={size} style={{ display: 'block', margin: '0 auto', borderRadius: 12, background: '#fff' }} />
  );
}
