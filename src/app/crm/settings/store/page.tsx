'use client';

import { useState, useEffect } from 'react';

interface ShippingRate {
  zone: 'CA' | 'US' | 'INTL';
  label: string;
  price: number;
  currency: string;
}

const ZONE_LABELS: Record<string, string> = { CA: 'Canada', US: 'USA', INTL: 'International' };

const FIELDS = [
  { key: 'timezone', label: 'Timezone', placeholder: 'America/Montreal' },
  { key: 'shopify_admin_api_version', label: 'Shopify Admin API Version', placeholder: '2024-01' },
  { key: 'shopify_api_version', label: 'Shopify Storefront API Version', placeholder: '2024-10' },
  { key: 'frame_size_small_max', label: 'Frame Size: Small Max (mm)', placeholder: '128' },
  { key: 'frame_size_medium_max', label: 'Frame Size: Medium Max (mm)', placeholder: '138' },
  { key: 'auto_family_min_items', label: 'Auto-Create Family Min Items', placeholder: '4' },
  { key: 'membership_sku_essential_monthly', label: 'Membership SKU: Essential Monthly', placeholder: 'MEMBERSHIP-ESSENTIAL-MONTHLY' },
  { key: 'membership_sku_essential_annual', label: 'Membership SKU: Essential Annual', placeholder: 'MEMBERSHIP-ESSENTIAL-ANNUAL' },
  { key: 'membership_sku_cult_monthly', label: 'Membership SKU: Cult Monthly', placeholder: 'MEMBERSHIP-CULT-MONTHLY' },
  { key: 'membership_sku_cult_annual', label: 'Membership SKU: Cult Annual', placeholder: 'MEMBERSHIP-CULT-ANNUAL' },
  { key: 'membership_sku_vault_monthly', label: 'Membership SKU: Vault Monthly', placeholder: 'MEMBERSHIP-VAULT-MONTHLY' },
  { key: 'membership_sku_vault_annual', label: 'Membership SKU: Vault Annual', placeholder: 'MEMBERSHIP-VAULT-ANNUAL' },
  { key: 'loyalty_tag_prefix', label: 'Loyalty Tag Prefix', placeholder: 'member-' },
  { key: 'loyalty_tiers', label: 'Loyalty Tiers (comma-separated)', placeholder: 'essential,cult,vault' },
  { key: 'shipping_free_threshold', label: 'Free Shipping Threshold ($, 0 = disabled)', placeholder: '0' },
];

export default function StoreConfigPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/crm/settings/store', { credentials: 'include' })
      .then(r => r.json()).then(d => {
        const data = d.data ?? {};
        setValues(data);
        try { setShippingRates(JSON.parse(data.shipping_rates || '[]')); } catch { /* use empty */ }
      }).catch(() => {});
  }, []);

  function updateRate(i: number, field: keyof ShippingRate, val: string) {
    setShippingRates(prev => {
      const next = [...prev];
      if (field === 'price') next[i] = { ...next[i], price: Number(val) || 0 };
      else if (field === 'zone') next[i] = { ...next[i], zone: val as ShippingRate['zone'] };
      else next[i] = { ...next[i], [field]: val };
      return next;
    });
  }

  function addRate() {
    setShippingRates(prev => [...prev, { zone: 'CA', label: '', price: 0, currency: 'CAD' }]);
  }

  function removeRate(i: number) {
    setShippingRates(prev => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true);
    const payload = { ...values, shipping_rates: JSON.stringify(shippingRates) };
    await fetch('/api/crm/settings/store', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 600 }}>
      <a href="/crm/settings" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>← Settings</a>
      <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, marginBottom: 'var(--crm-space-5)' }}>Store Config</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3)' }}>
        {FIELDS.map(f => (
          <div key={f.key}>
            <label style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 2, display: 'block' }}>{f.label}</label>
            <input
              value={values[f.key] ?? ''}
              onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="crm-input"
              style={{ width: '100%', fontSize: 'var(--crm-text-sm)' }}
            />
          </div>
        ))}
      </div>

      {/* Shipping Rates */}
      <h2 style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, marginTop: 'var(--crm-space-6)', marginBottom: 'var(--crm-space-3)' }}>Shipping Rates</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2)' }}>
        {shippingRates.map((rate, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={rate.zone}
              onChange={e => updateRate(i, 'zone', e.target.value)}
              className="crm-input"
              style={{ width: 120, fontSize: 'var(--crm-text-sm)' }}
            >
              {Object.entries(ZONE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input
              value={rate.label}
              onChange={e => updateRate(i, 'label', e.target.value)}
              placeholder="Label"
              className="crm-input"
              style={{ flex: 1, fontSize: 'var(--crm-text-sm)' }}
            />
            <input
              type="number"
              value={rate.price}
              onChange={e => updateRate(i, 'price', e.target.value)}
              placeholder="Price"
              className="crm-input"
              style={{ width: 80, fontSize: 'var(--crm-text-sm)' }}
            />
            <button onClick={() => removeRate(i)} className="crm-btn" style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 8px' }}>×</button>
          </div>
        ))}
        <button onClick={addRate} className="crm-btn" style={{ fontSize: 'var(--crm-text-xs)', alignSelf: 'flex-start' }}>+ Add rate</button>
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
