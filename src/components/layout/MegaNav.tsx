'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

interface MegaNavProps {
  isOpen: boolean;
  onClose: () => void;
}

const subCollections = [
  { label: 'Signature', href: '/collections/signature' },
  { label: 'Permanent', href: '/collections/permanent' },
  { label: 'Archives', href: '/collections/archives' },
  { label: 'Collaborations', href: '/collections/collaborations' },
];

export default function MegaNav({ isOpen, onClose }: MegaNavProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute left-0 top-full z-50 w-full border-b border-gray-200 bg-white shadow-md"
      role="menu"
    >
      <div className="site-container grid grid-cols-2 gap-6 py-8 sm:grid-cols-4">
        {subCollections.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            role="menuitem"
            className="text-sm font-medium text-gray-800 transition-colors hover:text-black"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
