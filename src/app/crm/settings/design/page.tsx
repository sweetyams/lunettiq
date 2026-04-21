'use client';

import { useState, useEffect } from 'react';

const DEFAULTS: Record<string, string> = {
  skeleton_color: '#F5F5F9',
  skeleton_shimmer_from: '#f0f0f0',
  skeleton_shimmer_to: '#e0e0e0',
  product_card_bg: '#F5F5F9',
};

const FIELDS = [
  { key: 'skeleton_color', label: 'Skeleton / Placeholder Background', description: 'Background colour shown while images load' },
  { key: 'skeleton_shimmer_from', label: 'Shimmer Gradient Start', description: 'Loading animation gradient start colour' },
  { key: 'skeleton_shimmer_to', label: 'Shimmer Gradient End', description: 'Loading animation gradient end colour' },
  { key: 'product_card_bg', label: 'Product Card Background', description: 'Background behind product images on cards and PDP' },
];

export default function DesignSettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/crm/settings/store', { credentials: 'include' })
      .then(r => r.json()).then(d => setValues(d.data ?? {})).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    await fetch('/api/crm/settings/store', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const get = (key: string) => values[key] || DEFAULTS[key];

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 640 }}>
      <a href="/crm/settings" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>← Settings</a>
      <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, marginBottom: 'var(--crm-space-2)' }}>Design</h1>
      <p style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 'var(--crm-space-5)' }}>
        Controls loading skeleton colours across the storefront. Changes apply on next page load.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
        {FIELDS.map(f => (
          <div key={f.key} className="crm-card" style={{ padding: 'var(--crm-space-4)', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-4)' }}>
            <input
              type="color"
              value={get(f.key)}
              onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              style={{ width: 40, height: 40, border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius-md)', cursor: 'pointer', padding: 2, flexShrink: 0 }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>{f.label}</div>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 1 }}>{f.description}</div>
            </div>
            <input
              value={get(f.key)}
              onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              className="crm-input"
              style={{ width: 90, fontSize: 'var(--crm-text-xs)', textAlign: 'center', fontFamily: 'monospace' }}
            />
          </div>
        ))}
      </div>

      {/* Preview */}
      <div style={{ marginTop: 'var(--crm-space-5)' }}>
        <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--crm-text-tertiary)', marginBottom: 'var(--crm-space-2)', letterSpacing: '0.04em' }}>Preview</div>
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)', display: 'flex', gap: 'var(--crm-space-3)' }}>
          <div style={{ width: 120, aspectRatio: '463/579', borderRadius: 4, background: get('product_card_bg') }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 14, width: '60%', borderRadius: 4, background: `linear-gradient(90deg, ${get('skeleton_shimmer_from')} 25%, ${get('skeleton_shimmer_to')} 50%, ${get('skeleton_shimmer_from')} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.8s ease-in-out infinite' }} />
            <div style={{ height: 14, width: '40%', borderRadius: 4, background: `linear-gradient(90deg, ${get('skeleton_shimmer_from')} 25%, ${get('skeleton_shimmer_to')} 50%, ${get('skeleton_shimmer_from')} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.8s ease-in-out infinite' }} />
            <div style={{ height: 10, width: '30%', borderRadius: 4, background: `linear-gradient(90deg, ${get('skeleton_shimmer_from')} 25%, ${get('skeleton_shimmer_to')} 50%, ${get('skeleton_shimmer_from')} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.8s ease-in-out infinite' }} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'var(--crm-space-5)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={save} disabled={saving} className="crm-btn crm-btn-primary" style={{ fontSize: 'var(--crm-text-sm)' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-success)' }}>✓ Saved</span>}
      </div>
    </div>
  );
}
