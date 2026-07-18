import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Plates - Home-Cooked Food Marketplace',
  description: 'Buy and sell delicious home-cooked meals from local cooks',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
