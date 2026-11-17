import type { Metadata } from 'next';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import './globals.css';

export const metadata: Metadata = {
  title: 'Open Materials Database',
  description: 'Open database of marine and yacht materials: PBR / OpenPBR appearance, engineering properties and indicative costs, every value sourced.',
};

const themeScript = `(function(){try{var t=localStorage.getItem('omdb-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,300..800&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            <span className="brand__dot" aria-hidden />
            Open Materials Database
          </Link>
          <nav className="nav">
            <Link href="/">Materials</Link>
            <Link href="/compare">Compare</Link>
            <Link href="/about">About &amp; sources</Link>
            <Link href="/api/materials" prefetch={false}>API</Link>
            <ThemeToggle />
          </nav>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <span>Data CC0-1.0 · Code MIT · Every value links to its source; missing values are left empty, never guessed.</span>
        </footer>
      </body>
    </html>
  );
}
