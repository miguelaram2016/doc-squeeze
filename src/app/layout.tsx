import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://docsqueeze.local'),
  title: {
    default: 'DocSqueeze | PDF tools for compression, merge, and split',
    template: '%s | DocSqueeze',
  },
  description:
    'DocSqueeze is a clean PDF testing frontend for compressing, merging, and splitting files through a configured backend API.',
  keywords: ['DocSqueeze', 'PDF compressor', 'merge PDF', 'split PDF', 'PDF tools'],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
