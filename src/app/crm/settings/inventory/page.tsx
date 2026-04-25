'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Location { id: string; name: string; shopifyLocationId: string | null; squareLocationId: string | null; fulfillsOnline: boolean }

export default function InventorySettingsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [shippingLocationId, setShippingLocationId] = useState('');
  const [defaultFulfillmentLocation, setDefaultFulfillmentLocation] = useState('');
  const [defaultSecurity, setDefaultSecurity] = useState('2');
  const [defaultOnlineReserveBuffer, setDefaultOnlineReserveBuffer] = useState('2');
  const [lowStockThreshold, setLowStockThreshold] = useState('3');
  const [fulfillmentRoutingRule, setFulfillmentRoutingRule] = useState('highest_stock');
  const [lastUnitProtectionDefault, setLastUnitProtectionDefault] = useState('limited_run');
  const [recountAutoPostThreshold, setRecountAutoPostThreshold] = useState('5');
  const [recountAutoPostPercent, setRecountAutoPostPercent] = useState('20');
  const [holdExpiryTryOn, setHoldExpiryTryOn] = useState('48');
  const [holdExpiryReservation, setHoldExpiryReservation] = useState('168');
  const [holdMaxWithoutApproval, setHoldMaxWithoutApproval] = useState('336');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/crm/settings/locations', { credentials: 'include' })
      .then(r => r.json()).then(d => setLocations(d.data ?? [])).catch(() => {});
    fetch('/api/crm/settings/store', { credentials: 'include' })
      .then(r => r.json()).then(d => {
        const s = d.data ?? {};
        if (s.shipping_location_id) setShippingLocationId(s.shipping_location_id);
        if (s.default_fulfillment_location) setDefaultFulfillmentLocation(s.default_fulfillment_location);
        if (s.default_security_stock) setDefaultSecurity(s.default_security_stock);
        if (s.default_online_reserve_buffer) setDefaultOnlineReserveBuffer(s.default_online_reserve_buffer);
        if (s.low_stock_threshold) setLowStockThreshold(s.low_stock_threshold);
        if (s.fulfillment_routing_rule) setFulfillmentRoutingRule(s.fulfillment_routing_rule);
        if (s.last_unit_protection_default) setLastUnitProtectionDefault(s.last_unit_protection_default);
        if (s.recount_auto_post_threshold) setRecountAutoPostThreshold(s.recount_auto_post_threshold);
        if (s.recount_auto_post_percent) setRecountAutoPostPercent(s.recount_auto_post_percent);
        if (s.hold_expiry_try_on) setHoldExpiryTryOn(s.hold_expiry_try_on);
        if (s.hold_expiry_reservation) setHoldExpiryReservation(s.hold_expiry_reservation);
        if (s.hold_max_without_approval) setHoldMaxWithoutApproval(s.hold_max_without_approval);
      }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    await fetch('/api/crm/settings/store', {
      method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: {
        shipping_location_id: shippingLocationId,
        default_fulfillment_location: defaultFulfillmentLocation,
        default_security_stock: defaultSecurity,
        default_online_reserve_buffer: defaultOnlineReserveBuffer,
        low_stock_threshold: lowStockThreshold,
        fulfillment_routing_rule: fulfillmentRoutingRule,
        last_unit_protection_default: lastUnitProtectionDefault,
        recount_auto_post_threshold: recountAutoPostThreshold,
        recount_auto_post_percent: recountAutoPostPercent,
        hold_expiry_try_on: holdExpiryTryOn,
        hold_expiry_reservation: holdExpiryReservation,
        hold_max_without_approval: holdMaxWithoutApproval,
      } }),
    });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  const fulfillLocs = locations.filter(l => l.fulfillsOnline);
  const label = { fontSize: 11, color: '#6b7280', fontWeight: 500 as const, display: 'block' as const, marginBottom: 4 };
  const hint = { fontSize: 10, color: '#9ca3af', marginBottom: 6 };
  const numInput = { width: 80, fontSize: 12 };

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 13 }}>
        <Link href="/crm/settings" style={{ color: '#9ca3af', textDecoration: 'none' }}>Settings</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ fontWeight: 600 }}>Inventory</span>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Inventory Settings</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* ── Fulfillment ── */}
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>Fulfillment</div>

        <div>
          <label style={label}>Shipping Location (legacy)</label>
          <p style={hint}>Primary Shopify projection target. Used as fallback if no default fulfillment location set.</p>
          <select className="crm-input" style={{ width: '100%', fontSize: 12 }} value={shippingLocationId} onChange={e => setShippingLocationId(e.target.value)}>
            <option value="">— Select —</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}{l.shopifyLocationId ? ' (Shopify)' : ''}</option>)}
          </select>
        </div>

        <div>
          <label style={label}>Default Fulfillment Location</label>
          <p style={hint}>Tie-break location for order routing and primary Shopify projection target.</p>
          <select className="crm-input" style={{ width: '100%', fontSize: 12 }} value={defaultFulfillmentLocation} onChange={e => setDefaultFulfillmentLocation(e.target.value)}>
            <option value="">— Select —</option>
            {fulfillLocs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        <div>
          <label style={label}>Fulfillment Routing Rule</label>
          <p style={hint}>How to pick which location ships an online order.</p>
          <select className="crm-input" style={{ width: '100%', fontSize: 12 }} value={fulfillmentRoutingRule} onChange={e => setFulfillmentRoutingRule(e.target.value)}>
            <option value="highest_stock">Highest stock</option>
            <option value="default_location">Default location first</option>
          </select>
        </div>

        {/* ── Stock Buffers ── */}
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 12 }}>Stock Buffers</div>

        <div>
          <label style={label}>Default Security Stock</label>
          <p style={hint}>Units held back per frame per location. Locations can override.</p>
          <input className="crm-input" style={numInput} type="number" min="0" value={defaultSecurity} onChange={e => setDefaultSecurity(e.target.value)} />
        </div>

        <div>
          <label style={label}>Default Online Reserve Buffer</label>
          <p style={hint}>Per fulfilling location, subtracted before contributing to Shopify. Locations can override.</p>
          <input className="crm-input" style={numInput} type="number" min="0" value={defaultOnlineReserveBuffer} onChange={e => setDefaultOnlineReserveBuffer(e.target.value)} />
        </div>

        <div>
          <label style={label}>Low Stock Threshold</label>
          <p style={hint}>Products at or below this show a yellow warning.</p>
          <input className="crm-input" style={numInput} type="number" min="0" value={lowStockThreshold} onChange={e => setLowStockThreshold(e.target.value)} />
        </div>

        {/* ── Protections ── */}
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 12 }}>Protections</div>

        <div>
          <label style={label}>Last-Unit Protection Default</label>
          <p style={hint}>When a frame&apos;s last unit is about to sell, auto-lock it for manager override.</p>
          <select className="crm-input" style={{ width: '100%', fontSize: 12 }} value={lastUnitProtectionDefault} onChange={e => setLastUnitProtectionDefault(e.target.value)}>
            <option value="limited_run">On for limited-run families</option>
            <option value="all">On for all families</option>
            <option value="off">Off</option>
          </select>
        </div>

        <div>
          <label style={label}>Hold Expiry — Try-On (hours)</label>
          <p style={hint}>Default expiry for try-on holds created from appointments.</p>
          <input className="crm-input" style={numInput} type="number" min="1" value={holdExpiryTryOn} onChange={e => setHoldExpiryTryOn(e.target.value)} />
        </div>

        <div>
          <label style={label}>Hold Expiry — Reservation (hours)</label>
          <p style={hint}>Default expiry for client reservations.</p>
          <input className="crm-input" style={numInput} type="number" min="1" value={holdExpiryReservation} onChange={e => setHoldExpiryReservation(e.target.value)} />
        </div>

        <div>
          <label style={label}>Max Hold Without Approval (hours)</label>
          <p style={hint}>Holds beyond this duration require manager approval.</p>
          <input className="crm-input" style={numInput} type="number" min="1" value={holdMaxWithoutApproval} onChange={e => setHoldMaxWithoutApproval(e.target.value)} />
        </div>

        {/* ── Recounts ── */}
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 12 }}>Recounts</div>

        <div>
          <label style={label}>Auto-Post Threshold (units)</label>
          <p style={hint}>Recounts with delta above this require manager approval.</p>
          <input className="crm-input" style={numInput} type="number" min="1" value={recountAutoPostThreshold} onChange={e => setRecountAutoPostThreshold(e.target.value)} />
        </div>

        <div>
          <label style={label}>Auto-Post Threshold (%)</label>
          <p style={hint}>Recounts with delta above this percentage require manager approval.</p>
          <input className="crm-input" style={numInput} type="number" min="1" max="100" value={recountAutoPostPercent} onChange={e => setRecountAutoPostPercent(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <button onClick={save} disabled={saving} className="crm-btn crm-btn-primary" style={{ fontSize: 12, padding: '6px 16px' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && <span style={{ fontSize: 11, color: '#16a34a' }}>✓ Saved</span>}
        </div>
      </div>

      {/* Locations summary */}
      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Locations</div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Location</th>
                <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Shopify</th>
                <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Square</th>
                <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Online</th>
              </tr>
            </thead>
            <tbody>
              {locations.map(l => (
                <tr key={l.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 10px', fontWeight: 500 }}>
                    {l.name}
                    {l.id === defaultFulfillmentLocation && <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 5px', borderRadius: 8, background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>default</span>}
                    {l.id === shippingLocationId && !defaultFulfillmentLocation && <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 5px', borderRadius: 8, background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>shipping</span>}
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', color: l.shopifyLocationId ? '#16a34a' : '#d1d5db' }}>{l.shopifyLocationId ? '✓' : '—'}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', color: l.squareLocationId ? '#16a34a' : '#d1d5db' }}>{l.squareLocationId ? '✓' : '—'}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', color: l.fulfillsOnline ? '#16a34a' : '#d1d5db' }}>{l.fulfillsOnline ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
