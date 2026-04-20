'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import SearchOverlay from '@/components/search/SearchOverlay';

const SearchContext = createContext<{ openSearch: () => void }>({ openSearch: () => {} });

export function useSearch() { return useContext(SearchContext); }

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const openSearch = useCallback(() => setOpen(true), []);
  const closeSearch = useCallback(() => setOpen(false), []);

  // Keyboard shortcut: / or ⌘K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <SearchContext.Provider value={{ openSearch }}>
      {children}
      <SearchOverlay open={open} onClose={closeSearch} />
    </SearchContext.Provider>
  );
}
