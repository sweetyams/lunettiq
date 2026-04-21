'use client';

import { useState, useEffect } from 'react';

const FIELDS = [
  { key: 'timezone', label: 'Timezone', placeholder: 'America/Montreal' },
  { key: 'shopify_admin_api_version', label: 'Shopify Admin API Version', placeholder: '2024-01' },
  { key: 'shopify_api_version', label: 'Shopify Storefront API Version', placeholder: '2024-10' },
  { key: 'frame_size_small_max', label: 'Frame Size: Small Max (mm)', placeholder: '128' },
  { key: 'frame_size_medium_max', label: 'Frame Size: Medium Max (mm)', placeholder: '138' },
  { key: 'membership_sku_essential_monthly', label: 'Membership SKU: Essential Monthly', placeholder: 'MEMBERSHIP-ESSENTIAL-MONTHLY' },
  { key: 'membership_sku_essential_annual', label: 'Membership SKU: Essential Annual', placeholder: 'MEMBERSHIP-ESSENTIAL-ANNUAL' },
  { key: 'membership_sku_cult_monthly', label: 'Membership SKU: Cult Monthly', placeholder: 'MEMBERSHIP-CULT-MONTHLY' },
  { key: 'membership_sku_cult_annual', label: 'Membership SKU: Cult Annual', placeholder: 'MEMBERSHIP-CULT-ANNUAL' },
  { key: 'membership_sku_vault_monthly', label: 'Membership SKU: Vault Monthly', placeholder: 'MEMBERSHIP-VAULT-MONTHLY' },
  { key: 'membership_sku_vault_annual', label: 'Membership SKU: Vault Annual', placeholder: 'MEMBERSHIP-VAULT-ANNUAL' },
  { key: 'loyalty_tag_prefix', label: 'Loyalty Tag Prefix', placeholder: 'member-' },
  { key: 'loyalty_tiers', label: 'Loyalty Tiers (comma-separated)', placeholder: 'essential,cult,vault' },
];

export default function StoreConfigPage() {
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

      <div style={{ marginTop: 'var(--crm-space-5)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={save} disabled={saving} className="crm-btn crm-btn-primary" style={{ fontSize: 'var(--crm-text-sm)' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-success)' }}>✓ Saved</span>}
      </div>
    </div>
  );
}
