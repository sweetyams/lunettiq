'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Family {
  id: string; name: string;
  product_count: string; colour_count: string;
  optical_count: string; sun_count: string; square_count: string;
  products: Array<{ id: string; image: string | null; title: string; category: string | null }> | null;
}

export function FamiliesView({ activeView, onSwitchView }: { activeView: string; onSwitchView: (v: 'products' | 'families') => void }) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/crm/products/families', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setFamilies(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? families.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : families;

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--crm-space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-3)' }}>
          <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Catalogue</h1>
          <div style={{ display: 'flex', gap: 0, marginLeft: 8 }}>
            {(['products', 'families'] as const).map(v => (
              <button key={v} onClick={() => onSwitchView(v)} style={{
                padding: '4px 12px', fontSize: 'var(--crm-text-xs)', border: 'none', cursor: 'pointer', background: 'none',
                borderBottom: activeView === v ? '2px solid var(--crm-text-primary)' : '2px solid transparent',
                color: activeView === v ? 'var(--crm-text-primary)' : 'var(--crm-text-tertiary)',
                fontWeight: activeView === v ? 500 : 400, textTransform: 'capitalize',
              }}>{v}</button>
            ))}
          </div>
          <span style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>
            {loading ? '…' : filtered.length}
          </span>
        </div>
        <Link href="/crm/settings/families" style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>Manage Families ↗</Link>
      </div>

      <div style={{ marginBottom: 'var(--crm-space-4)' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search families…" className="crm-input" style={{ width: 260 }} />
      </div>

      {loading ? <div style={{ color: 'var(--crm-text-tertiary)' }}>Loading…</div> : (
        <div className="crm-card" style={{ overflow: 'hidden' }}>
          <table className="crm-table">
            <thead>
              <tr>
                <th>Family</th>
                <th>Products</th>
                <th style={{ width: 80, textAlign: 'center' }}>Colours</th>
                <th style={{ width: 80, textAlign: 'center' }}>Optical</th>
                <th style={{ width: 80, textAlign: 'center' }}>Sun</th>
                <th style={{ width: 80, textAlign: 'center' }}>Square</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => {
                const prods = (f.products ?? []).filter(p => p.id);
                // Deduplicate by id
                const seen = new Set<string>();
                const uniqueProds = prods.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
                return (
                  <tr key={f.id}>
                    <td>
                      <Link href={`/crm/settings/families`} style={{ fontWeight: 600, color: 'var(--crm-text-primary)', textDecoration: 'none', fontSize: 'var(--crm-text-sm)' }}>
                        {f.name}
                      </Link>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {uniqueProds.slice(0, 8).map(p => (
                          <Link key={p.id} href={`/crm/products/${p.id}`} title={p.title}>
                            {p.image ? (
                              <img src={p.image} alt={p.title} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, background: '#f5f5f5' }} />
                            ) : (
                              <div style={{ width: 40, height: 40, borderRadius: 4, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: 'var(--crm-text-tertiary)' }}>
                                {p.category === 'sun' ? '☀' : '◎'}
                              </div>
                            )}
                          </Link>
                        ))}
                        {uniqueProds.length > 8 && (
                          <div style={{ width: 40, height: 40, borderRadius: 4, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
                            +{uniqueProds.length - 8}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 500 }}>{f.colour_count}</td>
                    <td style={{ textAlign: 'center' }}>
                      {Number(f.optical_count) > 0 && <span style={{ fontSize: 'var(--crm-text-xs)', padding: '2px 8px', borderRadius: 10, background: '#dbeafe', color: '#1e40af' }}>{f.optical_count}</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {Number(f.sun_count) > 0 && <span style={{ fontSize: 'var(--crm-text-xs)', padding: '2px 8px', borderRadius: 10, background: '#fef3c7', color: '#92400e' }}>{f.sun_count}</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {Number(f.square_count) > 0 ? (
                        <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500 }}>{f.square_count}</span>
                      ) : (
                        <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-warning, #d97706)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ padding: 'var(--crm-space-6)', textAlign: 'center', color: 'var(--crm-text-tertiary)' }}>No families found</div>}
        </div>
      )}
    </div>
  );
}
