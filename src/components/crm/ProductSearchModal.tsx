'use client';

import { useState, useEffect } from 'react';

interface Product { shopifyProductId: string; title: string; vendor: string | null; priceMin: string | null; imageUrl: string | null; variants?: Array<{ title: string | null; inventoryQuantity: number | null }> }

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (product: { id: string; title: string; variantTitle?: string }) => void;
}

export function ProductSearchModal({ open, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);

  useEffect(() => { if (!open) { setQuery(''); setResults([]); setSelected(null); } }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/crm/products?q=${encodeURIComponent(query)}&limit=12`, { credentials: 'include' });
        if (res.ok) { const d = await res.json(); setResults(d.data ?? []); }
      } finally { setLoading(false); }
    }, 150);
    return () => clearTimeout(t);
  }, [query, open]);

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '12%', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 520, background: 'var(--crm-surface)', borderRadius: 'var(--crm-radius-xl)', boxShadow: 'var(--crm-shadow-overlay)', overflow: 'hidden', zIndex: 50 }}>
        {!selected ? (
          <>
            <div style={{ padding: 'var(--crm-space-4)', borderBottom: '1px solid var(--crm-border)' }}>
              <input value={query} onChange={e => setQuery(e.target.value)} autoFocus placeholder="Search products…" className="crm-input" style={{ width: '100%' }} />
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto', padding: 'var(--crm-space-3)' }}>
              {loading && !results.length && <div style={{ padding: 'var(--crm-space-4)', fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', textAlign: 'center' }}>Searching…</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-3)' }}>
                {results.map(p => (
                  <button key={p.shopifyProductId} onClick={() => p.variants && p.variants.length > 1 ? setSelected(p) : onSelect({ id: p.shopifyProductId, title: p.title ?? '' })}
                    style={{ display: 'flex', flexDirection: 'column', background: 'var(--crm-surface)', border: '1px solid var(--crm-border-light)', borderRadius: 'var(--crm-radius-lg)', overflow: 'hidden', cursor: 'pointer', fontFamily: 'var(--crm-font)', textAlign: 'left', padding: 0 }}>
                    <div style={{ width: '100%', aspectRatio: '1', background: 'var(--crm-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-xs)' }}>No image</span>}
                    </div>
                    <div style={{ padding: 'var(--crm-space-2)' }}>
                      <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                      <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>{p.vendor}{p.priceMin ? ` · $${p.priceMin}` : ''}</div>
                      {p.variants && p.variants.length > 1 && <div style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', marginTop: 2 }}>{p.variants.length} variants</div>}
                    </div>
                  </button>
                ))}
              </div>
              {!loading && !results.length && <div style={{ padding: 'var(--crm-space-6)', textAlign: 'center', fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>No products found</div>}
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: 'var(--crm-space-4)', borderBottom: '1px solid var(--crm-border)', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3)' }}>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>←</button>
              <div><div style={{ fontWeight: 500, fontSize: 'var(--crm-text-sm)' }}>{selected.title}</div><div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>Select a variant</div></div>
            </div>
            <div style={{ maxHeight: 350, overflowY: 'auto' }}>
              {(selected.variants ?? []).map((v, i) => (
                <button key={i} onClick={() => { onSelect({ id: selected.shopifyProductId, title: `${selected.title} — ${v.title}`, variantTitle: v.title ?? undefined }); onClose(); }}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px var(--crm-space-4)', background: 'none', border: 'none', borderBottom: '1px solid var(--crm-border-light)', cursor: 'pointer', fontFamily: 'var(--crm-font)', fontSize: 'var(--crm-text-sm)' }}>
                  <span style={{ fontWeight: 500 }}>{v.title ?? 'Default'}</span>
                  <span style={{ fontSize: 'var(--crm-text-xs)', color: (v.inventoryQuantity ?? 0) > 0 ? 'var(--crm-success)' : 'var(--crm-text-tertiary)' }}>
                    {(v.inventoryQuantity ?? 0) > 0 ? `${v.inventoryQuantity} in stock` : 'Out of stock'}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        <div style={{ padding: 'var(--crm-space-3)', borderTop: '1px solid var(--crm-border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="crm-btn crm-btn-secondary">Cancel</button>
        </div>
      </div>
    </>
  );
}
