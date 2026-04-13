'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import MegaNav from './MegaNav';

const navLinks = [
  { label: 'Optical', href: '/collections/optics' },
  { label: 'Sun', href: '/collections/sunglasses' },
] as const;

export default function PrimaryNav() {
  const [megaNavOpen, setMegaNavOpen] = useState(false);

  const closeMegaNav = useCallback(() => setMegaNavOpen(false), []);

  return (
    <nav className="relative flex items-center gap-6" aria-label="Primary navigation">
      {navLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-sm font-medium text-gray-800 transition-colors hover:text-black"
        >
          {link.label}
        </Link>
      ))}

      <button
        type="button"
        onClick={() => setMegaNavOpen((prev) => !prev)}
        aria-expanded={megaNavOpen}
        aria-haspopup="true"
        className="text-sm font-medium text-gray-800 transition-colors hover:text-black"
      >
        Explore
      </button>

      <Link
        href="/pages/about"
        className="text-sm font-medium text-gray-800 transition-colors hover:text-black"
      >
        About
      </Link>

      <MegaNav isOpen={megaNavOpen} onClose={closeMegaNav} />
    </nav>
  );
}
