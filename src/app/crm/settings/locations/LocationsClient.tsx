'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/crm/CrmShell';

interface Location {
  id: string; name: string; locationType: string | null;
  shopifyLocationId: string | null; squareLocationId: string | null;
  address: any; timezone: string | null; fulfillsOnline: boolean | null;
  active: boolean; syncedAt: string | null;
}

const TYPES = [
  { value: 'retail', label: 'Retail Store', icon: '🏪' },
  { value: 'warehouse', label: 'Warehouse', icon: '📦' },
  { value: 'online', label: 'Online Fulfillment', icon: '🌐' },
  { value: 'popup', label: 'Pop-up', icon: '⚡' },
];

export default function LocationsClient() {
  const { toast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Location>>({});

  function load() {
    setLoading(true);
    fetch('/api/crm/settings/locations', { credentials: 'include' })
      .then(r => r.json()).then(d => setLocations(d.data ?? []))
      .catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function sync() {
    setSyncing(true);
    toast('Syncing locations…');
    const res = await fetch('/api/crm/settings/locations/sync', { method: 'POST', credentials: 'include' });
    const d = await res.json();
    toast(d.data?.message ?? 'Synced');
    setSyncing(false); load();
  }

  async function save(id: string) {
    await fetch('/api/crm/settings/locations', {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...editData }),
    });
    setEditing(null); load();
  }

  async function unlinkChannel(id: string, channel: 'shopify' | 'square') {
    await fetch('/api/crm/settings/locations', {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [channel === 'shopify' ? 'shopifyLocationId' : 'squareLocationId']: null }),
    });
    load();
  }

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 700 }}>
      <a href="/crm/settings" style={{ fontSize: 13, color: '#9ca3af', textDecoration: 'none' }}>← Settings</a>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Locations</h1>
        <button onClick={sync} disabled={syncing} className="crm-btn crm-btn-secondary" style={{ fontSize: 11 }}>
          {syncing ? 'Syncing…' : 'Sync from Shopify + Square'}
        </button>
      </div>

      {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Loading…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {locations.map(loc => {
            const type = TYPES.find(t => t.value === (loc.locationType ?? 'retail')) ?? TYPES[0];
            const isEditing = editing === loc.id;

            return (
              <div key={loc.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', overflow: 'hidden', opacity: loc.active ? 1 : 0.5 }}>
                {/* Header */}
                <div style={{ padding: '14px 16px' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 10, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 2 }}>Name</label>
                        <input className="crm-input" style={{ width: '100%', fontSize: 12 }} value={editData.name ?? loc.name} onChange={e => setEditData({ ...editData, name: e.target.value })} />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 10, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 2 }}>Type</label>
                          <select className="crm-input" style={{ width: '100%', fontSize: 12 }} value={editData.locationType ?? loc.locationType ?? 'retail'} onChange={e => setEditData({ ...editData, locationType: e.target.value })}>
                            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 10, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 2 }}>Timezone</label>
                          <input className="crm-input" style={{ width: '100%', fontSize: 12 }} value={editData.timezone ?? loc.timezone ?? ''} onChange={e => setEditData({ ...editData, timezone: e.target.value })} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
                          <input type="checkbox" checked={editData.fulfillsOnline ?? loc.fulfillsOnline ?? false} onChange={e => setEditData({ ...editData, fulfillsOnline: e.target.checked })} /> Fulfills online orders
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
                          <input type="checkbox" checked={editData.active ?? loc.active} onChange={e => setEditData({ ...editData, active: e.target.checked })} /> Active
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => save(loc.id)} className="crm-btn crm-btn-primary" style={{ fontSize: 11, padding: '4px 12px' }}>Save</button>
                        <button onClick={() => setEditing(null)} className="crm-btn crm-btn-ghost" style={{ fontSize: 11 }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{type.icon}</span>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{loc.name}</span>
                          {!loc.active && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: '#f3f4f6', color: '#6b7280', fontWeight: 600 }}>inactive</span>}
                          {loc.fulfillsOnline && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>ships online</span>}
                        </div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, marginLeft: 24 }}>
                          {type.label} · {loc.timezone ?? 'America/Montreal'}
                        </div>
                      </div>
                      <button onClick={() => { setEditing(loc.id); setEditData({}); }} className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}>✎</button>
                    </div>
                  )}
                </div>

                {/* Channel connections */}
                {!isEditing && (
                  <div style={{ borderTop: '1px solid #f3f4f6', padding: '10px 16px', display: 'flex', gap: 8 }}>
                    {/* Shopify */}
                    <div style={{ flex: 1, padding: '8px 10px', borderRadius: 6, background: loc.shopifyLocationId ? '#f0fdf4' : '#f9fafb', border: `1px solid ${loc.shopifyLocationId ? '#bbf7d0' : '#e5e7eb'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: loc.shopifyLocationId ? '#065f46' : '#9ca3af' }}>
                          Shopify {loc.shopifyLocationId ? '✓' : '—'}
                        </div>
                        {loc.shopifyLocationId && <button onClick={() => unlinkChannel(loc.id, 'shopify')} style={{ fontSize: 9, color: '#d1d5db', background: 'none', border: 'none', cursor: 'pointer' }}>unlink</button>}
                      </div>
                      {loc.shopifyLocationId && <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2, fontFamily: 'monospace' }}>ID: {loc.shopifyLocationId}</div>}
                    </div>

                    {/* Square */}
                    <div style={{ flex: 1, padding: '8px 10px', borderRadius: 6, background: loc.squareLocationId ? '#fffbeb' : '#f9fafb', border: `1px solid ${loc.squareLocationId ? '#fde68a' : '#e5e7eb'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: loc.squareLocationId ? '#92400e' : '#9ca3af' }}>
                          Square {loc.squareLocationId ? '✓' : '—'}
                        </div>
                        {loc.squareLocationId && <button onClick={() => unlinkChannel(loc.id, 'square')} style={{ fontSize: 9, color: '#d1d5db', background: 'none', border: 'none', cursor: 'pointer' }}>unlink</button>}
                      </div>
                      {loc.squareLocationId && <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2, fontFamily: 'monospace' }}>ID: {loc.squareLocationId}</div>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {locations.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              No locations. Click "Sync from Shopify + Square" to import.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
