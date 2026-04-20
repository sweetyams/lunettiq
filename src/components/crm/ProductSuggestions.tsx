'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Suggestion {
  product: { shopifyProductId: string; title: string; vendor: string | null; priceMin: string | null; imageUrl: string | null };
  matchReasons: string[];
  score: number;
}

export function ProductSuggestions({ customerId, refreshKey }: { customerId: string; refreshKey?: number }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    fetch(`/api/crm/clients/${customerId}/suggestions?limit=8`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setSuggestions(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [customerId, refreshKey]);

  const dismiss = useCallback((productId: string) => {
    setSuggestions(prev => prev.filter(s => s.product.shopifyProductId !== productId));
    fetch(`/api/crm/clients/${customerId}/suggestions/dismiss`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    });
  }, [customerId]);

  const like = useCallback((productId: string) => {
    setSuggestions(prev => prev.filter(s => s.product.shopifyProductId !== productId));
    fetch(`/api/crm/clients/${customerId}/suggestions/dismiss`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, sentiment: 'like' }),
    });
  }, [customerId]);

  if (!loaded) return <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', minHeight: 80 }}>Loading…</div>;

  if (!suggestions.length) return (
    <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', textAlign: 'center', padding: 'var(--crm-space-4)' }}>
      No suggestions yet. Set client preferences or add interactions to generate recommendations.
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--crm-space-3)' }}>
      {suggestions.map(s => (
        <div key={s.product.shopifyProductId} style={{ position: 'relative', background: 'var(--crm-bg)', borderRadius: 'var(--crm-radius-md)', overflow: 'hidden' }}>
          {/* Action buttons */}
          <div style={{ position: 'absolute', top: 4, right: 4, zIndex: 10, display: 'flex', gap: 3 }}>
            <div role="button" tabIndex={0} onClick={() => like(s.product.shopifyProductId)}
              style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Like for this client">♥</div>
            <div role="button" tabIndex={0} onClick={() => dismiss(s.product.shopifyProductId)}
              style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Pass / remove">×</div>
          </div>
          <Link href={`/crm/products/${s.product.shopifyProductId}?client=${customerId}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            {s.product.imageUrl ? (
              <div style={{ aspectRatio: '1', overflow: 'hidden' }}>
                <img src={s.product.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ) : (
              <div style={{ aspectRatio: '1', background: 'var(--crm-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>👓</div>
            )}
            <div style={{ padding: 'var(--crm-space-2)' }}>
              <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.product.title}</div>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{s.product.vendor} · ${s.product.priceMin}</div>
              {s.matchReasons.length > 0 && (
                <div style={{ marginTop: 'var(--crm-space-1)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {s.matchReasons.slice(0, 2).map(r => (
                    <span key={r} className="crm-badge" style={{ background: 'var(--crm-accent-light)', color: 'var(--crm-accent)', fontSize: 10 }}>{r}</span>
                  ))}
                </div>
              )}
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
}
