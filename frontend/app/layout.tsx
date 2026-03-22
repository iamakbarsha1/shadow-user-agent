import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shadow User Agent',
  description: 'AI-powered QA system that simulates real user behavior',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
