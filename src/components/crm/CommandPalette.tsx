'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Result { id: string; label: string; sub: string; href: string; category: string; imageUrl?: string }

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Debounced search across 3 endpoints
  useEffect(() => {
    if (!open || !query.trim()) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const q = encodeURIComponent(query.trim());
        const [clientsRes, productsRes, segmentsRes] = await Promise.all([
          fetch(`/api/crm/clients?q=${q}&limit=5`, { credentials: 'include' }),
          fetch(`/api/crm/products?q=${q}&limit=5`, { credentials: 'include' }),
          fetch(`/api/crm/segments`, { credentials: 'include' }),
        ]);
        const [clientsJson, productsJson, segmentsJson] = await Promise.all([
          clientsRes.json(), productsRes.json(), segmentsRes.json(),
        ]);

        const clients = (clientsJson.data ?? []).map((c: { shopifyCustomerId: string; firstName: string; lastName: string; email: string }) => ({
          id: c.shopifyCustomerId, label: `${c.firstName} ${c.lastName}`.trim(), sub: c.email ?? '', href: `/crm/clients/${c.shopifyCustomerId}`, category: 'Clients',
        }));

        const products = (productsJson.data ?? []).map((p: { shopifyProductId: string; title: string; vendor: string; images: unknown; variants: unknown[] }) => {
          const imgs = (p.images ?? []) as Array<string | { src?: string }>;
          const img = typeof imgs[0] === 'string' ? imgs[0] : imgs[0]?.src;
          const vc = (p.variants ?? []).length;
          return {
            id: p.shopifyProductId, label: p.title, sub: [p.vendor, vc ? `${vc} variant${vc !== 1 ? 's' : ''}` : ''].filter(Boolean).join(' · '),
            href: `/crm/products/${p.shopifyProductId}`, category: 'Products', imageUrl: img,
          };
        });

        const lq = query.toLowerCase();
        const segs = (segmentsJson.data ?? [])
          .filter((s: { name: string }) => s.name.toLowerCase().includes(lq))
          .slice(0, 5)
          .map((s: { id: number; name: string; memberCount: number }) => ({
            id: String(s.id), label: s.name, sub: `${s.memberCount ?? 0} members`, href: `/crm/segments`, category: 'Segments',
          }));

        setResults([...clients, ...products, ...segs]);
        setActive(0);
      } catch { /* ignore */ }
      setLoading(false);
    }, 200);
    return () => clearTimeout(timeout);
  }, [query, open]);

  const navigate = useCallback((href: string) => { router.push(href); setOpen(false); }, [router]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    if (e.key === 'Enter' && results[active]) navigate(results[active].href);
  }

  if (!open) return null;

  const grouped = results.reduce<Record<string, Result[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});
  let flatIdx = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }} />
      <div
        className="relative w-full"
        style={{ maxWidth: 500, background: 'var(--crm-surface)', borderRadius: 'var(--crm-radius-xl)', boxShadow: 'var(--crm-shadow-overlay)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4" style={{ borderBottom: '1px solid var(--crm-border)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--crm-text-tertiary)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search clients, products, segments…"
            className="flex-1 py-3 bg-transparent outline-none"
            style={{ fontSize: 'var(--crm-text-base)', color: 'var(--crm-text-primary)', border: 'none' }}
          />
          {loading && <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>…</span>}
        </div>

        {results.length > 0 && (
          <div style={{ maxHeight: 400, overflowY: 'auto', padding: '4px 0' }}>
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-1" style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {category}
                </div>
                {items.map(item => {
                  flatIdx++;
                  const idx = flatIdx;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.href)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors"
                      style={{ background: idx === active ? 'var(--crm-surface-hover)' : 'transparent', cursor: 'pointer', border: 'none' }}
                    >
                      {item.imageUrl && (
                        <div style={{ width: 32, height: 32, borderRadius: 'var(--crm-radius-sm)', overflow: 'hidden', background: 'var(--crm-bg)', flexShrink: 0 }}>
                          <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: 'var(--crm-text-primary)' }}>{item.label}</div>
                        <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{item.sub}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {query && !loading && results.length === 0 && (
          <div className="py-8 text-center" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>
            No results for &ldquo;{query}&rdquo;
          </div>
        )}

        <div className="flex items-center gap-4 px-4 py-2" style={{ borderTop: '1px solid var(--crm-border-light)', fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
