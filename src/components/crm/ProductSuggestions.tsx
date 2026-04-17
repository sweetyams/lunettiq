'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Suggestion {
  product: { shopifyProductId: string; title: string; vendor: string | null; priceMin: string | null; imageUrl: string | null };
  matchReasons: string[];
  score: number;
}

export function ProductSuggestions({ customerId }: { customerId: string }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/crm/clients/${customerId}/suggestions?limit=6`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setSuggestions(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [customerId]);

  if (!loaded) return <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>Loading…</div>;

  if (!suggestions.length) return (
    <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', textAlign: 'center', padding: 'var(--crm-space-4)' }}>
      No suggestions yet. Set client preferences or add interactions to generate recommendations.
    </div>
  );

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--crm-space-3)' }}>
        {suggestions.map(s => (
          <Link key={s.product.shopifyProductId} href={`/crm/products/${s.product.shopifyProductId}`}
            style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ background: 'var(--crm-bg)', borderRadius: 'var(--crm-radius-md)', overflow: 'hidden' }}>
              {s.product.imageUrl && (
                <div style={{ aspectRatio: '1', overflow: 'hidden' }}>
                  <img src={s.product.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ padding: 'var(--crm-space-2)' }}>
                <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.product.title}</div>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>${s.product.priceMin}</div>
                {s.matchReasons.length > 0 && (
                  <div style={{ marginTop: 'var(--crm-space-1)' }}>
                    <span className="crm-badge" style={{ background: 'var(--crm-accent-light)', color: 'var(--crm-accent)', fontSize: 10 }}>
                      {s.matchReasons[0]}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
