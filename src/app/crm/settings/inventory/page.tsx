'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Location { id: string; name: string; shopifyLocationId: string | null; squareLocationId: string | null }

export default function InventorySettingsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [shippingLocationId, setShippingLocationId] = useState('');
  const [defaultSecurity, setDefaultSecurity] = useState('2');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/crm/settings/locations', { credentials: 'include' })
      .then(r => r.json()).then(d => setLocations(d.data ?? [])).catch(() => {});
    fetch('/api/crm/settings/store', { credentials: 'include' })
      .then(r => r.json()).then(d => {
        const s = d.data ?? {};
        if (s.shipping_location_id) setShippingLocationId(s.shipping_location_id);
        if (s.default_security_stock) setDefaultSecurity(s.default_security_stock);
        if (s.low_stock_threshold) setLowStockThreshold(s.low_stock_threshold);
      }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    await fetch('/api/crm/settings/store', {
      method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { shipping_location_id: shippingLocationId, default_security_stock: defaultSecurity, low_stock_threshold: lowStockThreshold } }),
    });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 13 }}>
        <Link href="/crm/settings" style={{ color: '#9ca3af', textDecoration: 'none' }}>Settings</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ fontWeight: 600 }}>Inventory</span>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Inventory Settings</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Shipping Location</label>
          <p style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>Which location fulfills online orders and feeds Shopify availability.</p>
          <select className="crm-input" style={{ width: '100%', fontSize: 12 }} value={shippingLocationId} onChange={e => setShippingLocationId(e.target.value)}>
            <option value="">— Select —</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}{l.shopifyLocationId ? ' (Shopify)' : ''}{l.squareLocationId ? ' (Square)' : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Default Security Stock</label>
          <p style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>Units held back per frame per location. Protects against sync delays and count errors.</p>
          <input className="crm-input" style={{ width: 80, fontSize: 12 }} type="number" min="0" value={defaultSecurity} onChange={e => setDefaultSecurity(e.target.value)} />
        </div>

        <div>
          <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Low Stock Threshold</label>
          <p style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>Products with available stock at or below this show a yellow warning.</p>
          <input className="crm-input" style={{ width: 80, fontSize: 12 }} type="number" min="0" value={lowStockThreshold} onChange={e => setLowStockThreshold(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <button onClick={save} disabled={saving} className="crm-btn crm-btn-primary" style={{ fontSize: 12, padding: '6px 16px' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && <span style={{ fontSize: 11, color: '#16a34a' }}>✓ Saved</span>}
        </div>
      </div>

      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Locations</div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Location</th>
                <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Shopify</th>
                <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Square</th>
              </tr>
            </thead>
            <tbody>
              {locations.map(l => (
                <tr key={l.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 10px', fontWeight: 500 }}>{l.name}{l.id === shippingLocationId && <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 5px', borderRadius: 8, background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>shipping</span>}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', color: l.shopifyLocationId ? '#16a34a' : '#d1d5db' }}>{l.shopifyLocationId ? '✓' : '—'}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', color: l.squareLocationId ? '#16a34a' : '#d1d5db' }}>{l.squareLocationId ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
