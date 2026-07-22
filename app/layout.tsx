import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Plates - Home-Cooked Food Marketplace',
  description: 'Buy and sell delicious home-cooked meals from local cooks',
  manifest: '/brand/site.webmanifest',
  icons: {
    icon: [
      { url: '/brand/favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/favicon-48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: '/brand/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#c8552b',
          colorText: '#2a2320',
          colorBackground: '#f7f3ec',
          fontFamily: '"DM Sans", system-ui, sans-serif',
          borderRadius: '12px',
        },
      }}
    >
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link
            href="https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@400;500;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap"
            rel="stylesheet"
          />
        </head>
        <body>
  {children}
  <script
    dangerouslySetInnerHTML={{
      __html: `
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch((err) => {
              console.error('Service worker registration failed:', err);
            });
          });
        }
      `,
    }}
  />
</body>
      </html>
    </ClerkProvider>
  );
}
