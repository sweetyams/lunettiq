'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface IntegrationKey { key: string; label: string; secret: boolean; hasValue: boolean; }
interface Integration {
  id: string; name: string; description: string; icon: string;
  tags: string[]; category: string; enabled: boolean; configured: boolean;
  configuredAt: string | null; keysSet: IntegrationKey[];
  requiredKeys: { key: string; label: string; placeholder: string; secret: boolean }[];
  docsUrl: string; setupSteps: string[];
}

// Real brand logos (CDN SVGs)
const BRAND_LOGOS: Record<string, string> = {
  shopify: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/shopify.svg',
  clerk: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/clerk.svg',
  stripe: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/stripe.svg',
  inngest: 'https://asset.brandfetch.io/idH0OkCJFf/idJaGn3K3b.svg',
  vercel: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/vercel.svg',
  neon: 'https://asset.brandfetch.io/idT2E5gMpa/idX2x-GMMZ.svg',
  redis: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/redis.svg',
  upstash: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/upstash.svg',
  google: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/google.svg',
  mailchimp: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/mailchimp.svg',
  twilio: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/twilio.svg',
  slack: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/slack.svg',
  sentry: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/sentry.svg',
  posthog: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/posthog.svg',
  segment: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/segment.svg',
};

function getLogoUrl(id: string, name: string): string | null {
  const key = id.toLowerCase().replace(/[^a-z]/g, '');
  if (BRAND_LOGOS[key]) return BRAND_LOGOS[key];
  const nameKey = name.toLowerCase().replace(/[^a-z]/g, '');
  return BRAND_LOGOS[nameKey] ?? null;
}

type FilterTab = 'active' | 'inactive' | 'all';

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Integration | null>(null);
  const [keyValues, setKeyValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<FilterTab>('active');

  useEffect(() => {
    fetch('/api/crm/settings/integrations', { credentials: 'include' })
      .then(r => r.json()).then(d => setIntegrations(d.data ?? []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function toggle(id: string, enabled: boolean) {
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, enabled } : i));
    await fetch('/api/crm/settings/integrations', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled }),
    });
  }

  async function saveKeys() {
    if (!selected) return;
    setSaving(true);
    await fetch('/api/crm/settings/integrations', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, keys: keyValues, enabled: true }),
    });
    setIntegrations(prev => prev.map(i => i.id === selected.id ? { ...i, enabled: true, configured: true } : i));
    setSelected(null);
    setKeyValues({});
    setSaving(false);
  }

  const filtered = tab === 'all' ? integrations : tab === 'active' ? integrations.filter(i => i.enabled) : integrations.filter(i => !i.enabled);
  const activeCount = integrations.filter(i => i.enabled).length;

  if (loading) return <div style={{ padding: 'var(--crm-space-6)', color: 'var(--crm-text-tertiary)' }}>Loading…</div>;

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--crm-space-5)' }}>
        <div>
          <a href="/crm/settings" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>← Settings</a>
          <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Integrations</h1>
        </div>
        <a href="/crm/system/status" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>System Status ↗</a>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 'var(--crm-space-5)', borderBottom: '1px solid var(--crm-border-light)' }}>
        {([['active', `Active (${activeCount})`], ['inactive', `Inactive (${integrations.length - activeCount})`], ['all', `All (${integrations.length})`]] as [FilterTab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 16px', fontSize: 'var(--crm-text-sm)', border: 'none', cursor: 'pointer', background: 'none',
            borderBottom: tab === key ? '2px solid var(--crm-text-primary)' : '2px solid transparent',
            color: tab === key ? 'var(--crm-text-primary)' : 'var(--crm-text-tertiary)', fontWeight: tab === key ? 500 : 400,
          }}>{label}</button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--crm-space-4)' }}>
        {filtered.map(i => {
          const logoUrl = getLogoUrl(i.id, i.name);
          return (
            <div
              key={i.id}
              onClick={() => { setSelected(i); setKeyValues({}); }}
              className="crm-card"
              style={{
                padding: 'var(--crm-space-4)',
                cursor: 'pointer',
                transition: 'box-shadow 0.15s, transform 0.15s, border-color 0.15s',
                border: i.enabled ? '1px solid var(--crm-success, #16a34a)' : '1px solid var(--crm-border)',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--crm-shadow-lg)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = ''; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--crm-space-3)' }}>
                {/* Icon */}
                <div style={{ width: 40, height: 40, borderRadius: 'var(--crm-radius-md)', background: 'var(--crm-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {logoUrl ? (
                    <img src={logoUrl} alt={i.name} width={22} height={22} style={{ objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: 22 }}>{i.icon}</span>
                  )}
                </div>

                {/* Toggle */}
                <button
                  onClick={e => { e.stopPropagation(); toggle(i.id, !i.enabled); }}
                  style={{
                    width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                    background: i.enabled ? 'var(--crm-success, #16a34a)' : 'var(--crm-border)',
                  }}
                  aria-label={i.enabled ? 'Disable' : 'Enable'}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, transition: 'left 0.2s',
                    left: i.enabled ? 21 : 3, boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>

              {/* Name + status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>{i.name}</span>
                <span style={{
                  fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 4,
                  background: i.enabled ? 'rgba(22,163,106,0.1)' : 'var(--crm-surface-hover)',
                  color: i.enabled ? 'var(--crm-success, #16a34a)' : 'var(--crm-text-tertiary)',
                }}>{i.enabled ? 'Connected' : 'Off'}</span>
              </div>

              <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', lineHeight: 1.4 }}>{i.description}</div>
            </div>
          );
        })}
      </div>

      {/* Setup modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="crm-card" style={{ width: 520, maxHeight: '80vh', overflow: 'auto', padding: 'var(--crm-space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--crm-radius-md)', background: 'var(--crm-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {(() => { const url = getLogoUrl(selected.id, selected.name); return url ? <img src={url} alt="" width={20} height={20} /> : <span style={{ fontSize: 20 }}>{selected.icon}</span>; })()}
                </div>
                <div>
                  <h2 style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, margin: 0 }}>{selected.name}</h2>
                  <span style={{ fontSize: 'var(--crm-text-xs)', color: selected.enabled ? 'var(--crm-success, #16a34a)' : 'var(--crm-text-tertiary)' }}>
                    {selected.enabled ? 'Connected' : 'Not connected'}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--crm-text-tertiary)' }}>✕</button>
            </div>

            <p style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)', marginBottom: 'var(--crm-space-4)' }}>{selected.description}</p>

            {/* Setup steps */}
            <div style={{ marginBottom: 'var(--crm-space-4)' }}>
              <h3 style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', marginBottom: 'var(--crm-space-2)' }}>Setup</h3>
              <ol style={{ margin: 0, paddingLeft: 'var(--crm-space-4)', fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)' }}>
                {selected.setupSteps.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
              </ol>
            </div>

            {/* Keys */}
            <div style={{ marginBottom: 'var(--crm-space-4)' }}>
              <h3 style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', marginBottom: 'var(--crm-space-2)' }}>API Keys</h3>
              {selected.requiredKeys.map(k => {
                const existing = selected.keysSet.find(ks => ks.key === k.key);
                return (
                  <div key={k.key} style={{ marginBottom: 'var(--crm-space-2)' }}>
                    <label style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      {k.label}
                      {existing?.hasValue && <span style={{ color: 'var(--crm-success, #16a34a)' }}>✓</span>}
                      {k.secret && <span style={{ fontSize: 9, color: 'var(--crm-warning, #ca8a04)' }}>🔒</span>}
                    </label>
                    <input
                      type={k.secret ? 'password' : 'text'}
                      placeholder={existing?.hasValue ? '••••••• (set)' : k.placeholder}
                      value={keyValues[k.key] ?? ''}
                      onChange={e => setKeyValues(prev => ({ ...prev, [k.key]: e.target.value }))}
                      className="crm-input" style={{ width: '100%', fontSize: 'var(--crm-text-sm)' }}
                    />
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 'var(--crm-space-2)', justifyContent: 'space-between' }}>
              <a href={selected.docsUrl} target="_blank" rel="noopener" style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>Documentation ↗</a>
              <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
                <button onClick={() => setSelected(null)} className="crm-btn crm-btn-secondary" style={{ fontSize: 'var(--crm-text-sm)' }}>Cancel</button>
                <button onClick={saveKeys} disabled={saving} className="crm-btn crm-btn-primary" style={{ fontSize: 'var(--crm-text-sm)' }}>
                  {saving ? 'Saving…' : 'Save & Enable'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
