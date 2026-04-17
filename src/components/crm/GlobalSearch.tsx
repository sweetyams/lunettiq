'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Result { id: string; label: string; sub: string; href: string; category: string }

export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Focus on mount + keyboard shortcut
  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Global ⌘K listener (mounted in shell)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') e.preventDefault();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/crm/search?q=${encodeURIComponent(query)}`, { credentials: 'include' });
        const raw = await res.json();
        const d = raw.data ?? raw;
        const items: Result[] = [
          ...(d.clients ?? []).map((c: { shopifyCustomerId: string; firstName: string; lastName: string; email: string }) => ({
            id: c.shopifyCustomerId, label: `${c.firstName} ${c.lastName}`, sub: c.email, href: `/crm/clients/${c.shopifyCustomerId}`, category: 'Clients',
          })),
          ...(d.products ?? []).map((p: { shopifyProductId: string; title: string; vendor: string }) => ({
            id: p.shopifyProductId, label: p.title, sub: p.vendor, href: `/crm/products/${p.shopifyProductId}`, category: 'Products',
          })),
          ...(d.orders ?? []).map((o: { shopifyOrderId: string; orderNumber: string; totalPrice: string }) => ({
            id: o.shopifyOrderId, label: `#${o.orderNumber}`, sub: `$${o.totalPrice}`, href: `/crm/orders/${o.shopifyOrderId}`, category: 'Orders',
          })),
        ];
        setResults(items);
        setActive(0);
      } catch { /* ignore */ }
      setLoading(false);
    }, 200);
    return () => clearTimeout(timeout);
  }, [query]);

  const navigate = useCallback((href: string) => { router.push(href); onClose(); }, [router, onClose]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    if (e.key === 'Enter' && results[active]) { navigate(results[active].href); }
  }

  // Group by category
  const grouped = results.reduce<Record<string, Result[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  let flatIdx = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }} />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg"
        style={{ background: 'var(--crm-surface)', borderRadius: 'var(--crm-radius-xl)', boxShadow: 'var(--crm-shadow-overlay)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4" style={{ borderBottom: '1px solid var(--crm-border)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--crm-text-tertiary)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search clients, products, orders…"
            className="flex-1 py-3 bg-transparent outline-none"
            style={{ fontSize: 'var(--crm-text-base)', color: 'var(--crm-text-primary)', border: 'none' }}
          />
          {loading && <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>…</span>}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto py-2">
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
                      style={{
                        background: idx === active ? 'var(--crm-surface-hover)' : 'transparent',
                        cursor: 'pointer',
                        border: 'none',
                        fontFamily: 'var(--crm-font)',
                      }}
                    >
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

        {/* Empty state */}
        {query && !loading && results.length === 0 && (
          <div className="py-8 text-center" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>
            No results for &ldquo;{query}&rdquo;
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2" style={{ borderTop: '1px solid var(--crm-border-light)', fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
