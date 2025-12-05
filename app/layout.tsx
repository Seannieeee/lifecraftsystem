import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LifeCraft',
  description: 'Interactive disaster preparedness training platform with AI-powered recommendations',
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
