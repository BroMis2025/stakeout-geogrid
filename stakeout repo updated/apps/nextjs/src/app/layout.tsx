// apps/nextjs/src/app/layout.tsx
import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Stakeout • Real-Device Mobile Search & AI GeoGrid Intelligence',
  description:
    'Device-observed local rank tracking across Google Maps, Mobile Chrome, Google App, and AI Overviews.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
