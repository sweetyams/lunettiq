'use client';

import { useEffect, useState } from 'react';

export default function MetafieldVisibilityPage() {
  const [visible, setVisible] = useState<string[]>([]);
  const [available, setAvailable] = useState<string[]>([]);
  const [coverage, setCoverage] = useState<Record<string, number>>({});
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/crm/settings/metafield-visibility', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setVisible(d.data?.visible ?? []); setAvailable(d.data?.available ?? []); setCoverage(d.data?.coverage ?? {}); setTotalProducts(d.data?.totalProducts ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    await fetch('/api/crm/settings/metafield-visibility', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggle(key: string) {
    setVisible(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  function formatKey(key: string): string {
    const [ns, ...rest] = key.split('.');
    const field = rest.join('.').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return field;
  }

  // Group by namespace
  const grouped = new Map<string, string[]>();
  for (const key of available) {
    const ns = key.split('.')[0];
    if (!grouped.has(ns)) grouped.set(ns, []);
    grouped.get(ns)!.push(key);
  }

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      <div style={{ marginBottom: 'var(--crm-space-4)' }}>
        <a href="/crm/settings" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>← Settings</a>
        <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Product Metafield Visibility</h1>
        <p style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>
          Choose which metafields to show on product detail pages in the CRM.
        </p>
      </div>

      {loading ? <div style={{ color: 'var(--crm-text-tertiary)' }}>Loading…</div> : (
        <>
          <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
            {Array.from(grouped.entries()).map(([ns, keys]) => (
              <div key={ns} style={{ marginBottom: 'var(--crm-space-4)' }}>
                <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--crm-text-tertiary)', marginBottom: 8 }}>{ns}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
                  {keys.sort().map(key => {
                    const count = coverage[key] ?? 0;
                    const pct = totalProducts > 0 ? Math.round((count / totalProducts) * 100) : 0;
                    return (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--crm-text-sm)', cursor: 'pointer', padding: '4px 0' }}>
                      <input type="checkbox" checked={visible.includes(key)} onChange={() => toggle(key)} />
                      <span>{formatKey(key)}</span>
                      <span style={{ fontSize: 9, color: pct >= 80 ? 'var(--crm-success, #16a34a)' : pct >= 40 ? 'var(--crm-warning, #d97706)' : 'var(--crm-text-tertiary)', marginLeft: 'auto' }}>{count}/{totalProducts} ({pct}%)</span>
                    </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'var(--crm-space-4)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={save} className="crm-btn crm-btn-primary" style={{ padding: '8px 20px' }}>
              Save
            </button>
            {saved && <span style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-success, #16a34a)' }}>✓ Saved</span>}
            <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
              {visible.length} fields visible
            </span>
          </div>
        </>
      )}
    </div>
  );
}
