'use client';

import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

// Full-screen camera scanner. Decodes QR codes locally with jsQR (works on
// iOS Safari too, where the native BarcodeDetector API is missing) and calls
// onScan once with the decoded text.
export default function QrScanner({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && !doneRef.current) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
          if (code?.data) {
            doneRef.current = true;
            onScan(code.data);
            return; // stop the loop; parent closes us
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(s => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.setAttribute('playsinline', 'true'); // iOS: stay inline
          videoRef.current.play().catch(() => {});
          raf = requestAnimationFrame(tick);
        }
      })
      .catch(() => setError('Camera access denied — allow camera permission and try again, or type the 4-digit code instead.'));

    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#000', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
        <div style={{ color: '#fff', font: '500 15px "DM Sans", sans-serif' }}>Scan pickup QR</div>
        <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,.2)', color: '#fff', border: 'none', fontSize: 16, cursor: 'pointer' }}>✕</button>
      </div>

      {error ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30, color: '#fff', font: '400 14px/1.5 "DM Sans", sans-serif', textAlign: 'center' }}>
          {error}
        </div>
      ) : (
        <>
          <video ref={videoRef} muted style={{ flex: 1, width: '100%', objectFit: 'cover' }} />
          {/* Aiming frame */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: 230, height: 230, border: '3px solid rgba(255,255,255,.85)', borderRadius: 22 }} />
          </div>
          <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,.85)', font: '400 13px "DM Sans", sans-serif', pointerEvents: 'none' }}>
            Point at the buyer&apos;s QR receipt
          </div>
        </>
      )}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
