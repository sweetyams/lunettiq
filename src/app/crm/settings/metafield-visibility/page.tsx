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

  const LOGICAL_GROUPS: Array<{ label: string; keys: string[] }> = [
    { label: 'Sizing & Fit', keys: ['custom.lens_width', 'custom.bridge_width', 'custom.temple_length', 'custom.lens_height', 'custom.frame_width', 'custom.weight_grams', 'custom.size_category'] },
    { label: 'Material & Construction', keys: ['custom.material_type', 'custom.material_description', 'custom.origin', 'custom.hinge_type'] },
    { label: 'Classification', keys: ['custom.shape', 'custom.frame_colour', 'custom.gender_fit', 'custom.frame_type'] },
    { label: 'Editorial', keys: ['custom.short_name', 'custom.designer_notes', 'custom.collection_season', 'custom.face_notes', 'custom.swatch'] },
    { label: 'Rx & Lens', keys: ['custom.rx_compatible', 'custom.progressive_compatible', 'custom.max_lens_index', 'custom.supports_polarized'] },
  ];
  const groupedKeySet = new Set(LOGICAL_GROUPS.flatMap(g => g.keys));
  const otherKeys = available.filter(k => !groupedKeySet.has(k));
  const allGroups = [...LOGICAL_GROUPS, ...(otherKeys.length ? [{ label: 'Other', keys: otherKeys }] : [])];

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
            {allGroups.map(({ label, keys }) => {
              const availableKeys = keys.filter(k => available.includes(k));
              if (!availableKeys.length) return null;
              return (
              <div key={label} style={{ marginBottom: 'var(--crm-space-5)' }}>
                <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--crm-text-tertiary)', marginBottom: 8, letterSpacing: '0.04em' }}>{label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {availableKeys.sort().map(key => {
                    const count = coverage[key] ?? 0;
                    const pct = totalProducts > 0 ? Math.round((count / totalProducts) * 100) : 0;
                    const isOn = visible.includes(key);
                    return (
                    <button key={key} onClick={() => toggle(key)} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                      border: isOn ? '1.5px solid var(--crm-text-primary)' : '1px solid var(--crm-border)',
                      background: isOn ? 'var(--crm-text-primary)' : 'var(--crm-surface)',
                      color: isOn ? 'white' : 'var(--crm-text-primary)',
                      fontSize: 'var(--crm-text-xs)', fontWeight: 500, transition: 'all 150ms var(--ease-out)',
                    }}>
                      <span>{formatKey(key)}</span>
                      <span style={{ fontSize: 9, opacity: 0.7 }}>{pct}%</span>
                    </button>
                    );
                  })}
                </div>
              </div>
              );
            })}
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
