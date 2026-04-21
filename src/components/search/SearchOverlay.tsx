'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProductCard from '@/components/shared/ProductCard';
import { track } from '@/lib/tracking';

interface SearchProduct {
  id: string; slug: string; title: string; vendor: string | null;
  price: string | null; imageUrl: string | null; tags: string[] | null;
}
interface SearchCollection { handle: string; title: string; }
interface SearchSuggestion { text: string; type: string; }
interface SearchResult {
  products: SearchProduct[]; collections: SearchCollection[];
  suggestions: SearchSuggestion[]; meta: { total: number; query: string };
}

const POPULAR = ['Round frames', 'Tortoise', 'Signature collection', 'Small size', 'New arrivals'];
const CATEGORIES = [
  { label: 'Optical', href: '/collections/optics' },
  { label: 'Sun', href: '/collections/sun' },
  { label: 'Collaborations', href: '/collections/collaborations' },
  { label: 'Archives', href: '/collections/archives' },
];

export default function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Recent searches from localStorage
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem('lunettiq_recent_searches') ?? '[]')); } catch {}
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open) { inputRef.current?.focus(); document.body.style.overflow = 'hidden'; }
    else { document.body.style.overflow = ''; }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Close on esc
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch
  useEffect(() => {
    if (debouncedQuery.length < 2) { setResults(null); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    fetch(`/api/storefront/search?q=${encodeURIComponent(debouncedQuery)}&limit=6`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => { setResults(d); setLoading(false); track({ event: 'search', data: { query: debouncedQuery, resultCount: d?.meta?.total ?? 0 } }); })
      .catch(e => { if (e.name !== 'AbortError') setLoading(false); });
  }, [debouncedQuery]);

  const saveRecent = useCallback((q: string) => {
    const updated = [q, ...recent.filter(r => r !== q)].slice(0, 5);
    setRecent(updated);
    try { localStorage.setItem('lunettiq_recent_searches', JSON.stringify(updated)); } catch {}
  }, [recent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    saveRecent(query.trim());
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    onClose();
  };

  const handleProductClick = () => { if (query.trim()) saveRecent(query.trim()); onClose(); };

  const handlePopularClick = (term: string) => {
    setQuery(term);
    setDebouncedQuery(term);
    saveRecent(term);
  };

  if (!open) return null;

  const hasResults = results && (results.products.length > 0 || results.collections.length > 0);
  const showEmpty = debouncedQuery.length < 2;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <form onSubmit={handleSubmit} className="border-b border-gray-200">
        <div className="site-container flex items-center gap-4 py-6">
        <span className="text-sm font-medium tracking-wider hidden md:block">LUNETTIQ</span>
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search frames, colours, shapes"
            className="w-full bg-transparent text-2xl md:text-3xl font-light outline-none placeholder:text-gray-300"
            autoComplete="off"
          />
          {loading && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
          )}
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-black p-2" aria-label="Close search">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
        </div>
      </form>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="site-container py-8">
        {showEmpty ? (
          <div className="space-y-10">
            {/* Popular searches */}
            <div>
              <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Popular searches</h3>
              <div className="flex flex-wrap gap-2">
                {POPULAR.map(p => (
                  <button key={p} onClick={() => handlePopularClick(p)}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-full hover:bg-black hover:text-white hover:border-black transition-colors">{p}</button>
                ))}
              </div>
            </div>

            {/* Recent searches */}
            {recent.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs text-gray-400 uppercase tracking-wider">Recent searches</h3>
                  <button onClick={() => { setRecent([]); localStorage.removeItem('lunettiq_recent_searches'); }}
                    className="text-xs text-gray-400 hover:text-black">Clear</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map(r => (
                    <button key={r} onClick={() => handlePopularClick(r)}
                      className="px-4 py-2 text-sm border border-gray-200 rounded-full hover:border-black transition-colors">{r}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick categories */}
            <div>
              <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Browse</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {CATEGORIES.map(c => (
                  <Link key={c.href} href={c.href} onClick={onClose}
                    className="px-4 py-6 bg-gray-50 rounded-lg text-center text-sm font-medium hover:bg-black hover:text-white transition-colors">{c.label}</Link>
                ))}
              </div>
            </div>
          </div>
        ) : hasResults ? (
          <div className="space-y-8">
            {/* Products */}
            {results!.products.length > 0 && (
              <div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {results!.products.map(p => (
                    <ProductCard
                      key={p.id}
                      light={{ id: p.id, slug: p.slug, title: p.title, imageUrl: p.imageUrl, price: p.price, vendor: p.vendor }}
                      className="w-full"
                      onClick={handleProductClick}
                    />
                  ))}
                </div>
                {results!.meta.total > 6 && (
                  <Link href={`/search?q=${encodeURIComponent(query)}`} onClick={() => { saveRecent(query); onClose(); }}
                    className="inline-block mt-4 text-sm text-gray-500 hover:text-black underline underline-offset-4">
                    See all {results!.meta.total} products →
                  </Link>
                )}
              </div>
            )}

            {/* Collections */}
            {results!.collections.length > 0 && (
              <div>
                <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Collections</h3>
                <div className="flex gap-2">
                  {results!.collections.map(c => (
                    <Link key={c.handle} href={`/collections/${c.handle}`} onClick={onClose}
                      className="px-4 py-2 text-sm border border-gray-200 rounded-full hover:bg-black hover:text-white hover:border-black transition-colors">{c.title}</Link>
                  ))}
                </div>
              </div>
            )}

            {/* Facet suggestions */}
            {results!.suggestions.length > 0 && (
              <div>
                <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Refine</h3>
                <div className="flex gap-2">
                  {results!.suggestions.map(s => (
                    <Link key={s.text} href={`/collections/optics?${s.type}=${s.text}`} onClick={onClose}
                      className="px-3 py-1.5 text-xs border border-gray-200 rounded-full text-gray-600 hover:border-black">{s.text} · {s.type}</Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : results && results.products.length === 0 ? (
          /* Zero results */
          <div className="text-center py-12">
            <p className="text-lg text-gray-600 mb-6">No frames matching '{query}'</p>
            <p className="text-sm text-gray-400 mb-4">You might try:</p>
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {POPULAR.slice(0, 4).map(p => (
                <button key={p} onClick={() => handlePopularClick(p)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-full hover:border-black">{p}</button>
              ))}
            </div>
            <p className="text-sm text-gray-400 mb-4">Or browse by:</p>
            <div className="flex justify-center gap-3">
              {CATEGORIES.map(c => (
                <Link key={c.href} href={c.href} onClick={onClose}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-full hover:bg-black hover:text-white hover:border-black transition-colors">{c.label}</Link>
              ))}
            </div>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
