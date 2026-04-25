'use client';

import { useEffect, useState } from 'react';

interface Status { id: string; name: string; status: 'ok' | 'error' | 'off'; detail?: string }

const GROUPS = [
  { label: 'Core', ids: ['neon', 'clerk', 'inngest', 'upstash'] },
  { label: 'Shopify', ids: ['shopify_storefront', 'shopify_admin', 'shopify_webhooks'] },
  { label: 'Square', ids: ['square', 'square_webhooks'] },
  { label: 'Services', ids: ['anthropic', 'klaviyo'] },
  { label: 'Tracking', ids: ['posthog', 'polar', 'ga4', 'meta_pixel', 'tiktok', 'pinterest', 'snapchat'] },
];

export default function SystemStatusPage() {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/system/status', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setStatuses(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const ok = statuses.filter(s => s.status === 'ok').length;
  const errors = statuses.filter(s => s.status === 'error').length;

  return (
    <div style={{ maxWidth: 600, margin: '80px auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>System Status</h1>
      <p style={{ fontSize: 12, color: '#888', marginBottom: 24 }}>
        {loading ? '...' : `${ok} connected · ${errors} issues · ${statuses.length - ok - errors} off`}
      </p>

      {loading ? (
        <p style={{ color: '#aaa' }}>Checking...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {GROUPS.map(group => {
            const items = group.ids.map(id => statuses.find(s => s.id === id)).filter(Boolean) as Status[];
            if (!items.length) return null;
            return (
              <div key={group.label}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{group.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid #eee', borderRadius: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.status === 'ok' ? '#22c55e' : s.status === 'error' ? '#ef4444' : '#d1d5db', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                        {s.detail && <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{s.detail}</div>}
                      </div>
                      <span style={{ fontSize: 10, color: s.status === 'ok' ? '#16a34a' : s.status === 'error' ? '#dc2626' : '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 10, color: '#ccc', marginTop: 24 }}>Internal only. Not indexed.</p>
    </div>
  );
}
