import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DocSqueeze | PDF compression, merge, and split',
  description: 'Simple Next.js frontend for DocSqueeze PDF compression, merge, and split tools.',
  keywords: ['DocSqueeze', 'PDF compressor', 'merge PDF', 'split PDF'],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
