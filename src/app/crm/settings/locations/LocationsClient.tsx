'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/crm/CrmShell';

interface Location {
  id: string; name: string; locationType: string | null;
  shopifyLocationId: string | null; squareLocationId: string | null;
  address: any; timezone: string | null; fulfillsOnline: boolean | null;
  active: boolean;
}
interface ChannelLoc { id: string; name: string }

const TYPES = [
  { value: 'retail', label: 'Retail Store', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { value: 'warehouse', label: 'Warehouse', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35z"/><line x1="6" y1="18" x2="6" y2="14"/><line x1="10" y1="18" x2="10" y2="12"/><line x1="14" y1="18" x2="14" y2="14"/><line x1="18" y1="18" x2="18" y2="16"/></svg> },
  { value: 'online', label: 'Online Fulfillment', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
  { value: 'popup', label: 'Pop-up', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
];

export default function LocationsClient() {
  const { toast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [shopifyLocs, setShopifyLocs] = useState<ChannelLoc[]>([]);
  const [squareLocs, setSquareLocs] = useState<ChannelLoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Location>>({});
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', locationType: 'retail' });

  function load() {
    setLoading(true);
    fetch('/api/crm/settings/locations?squareList=1', { credentials: 'include' })
      .then(r => r.json()).then(d => {
        setLocations(d.data?.locations ?? d.data ?? []);
        setSquareLocs(d.data?.squareLocations ?? []);
        setShopifyLocs(d.data?.shopifyLocations ?? []);
      }).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function sync() {
    setSyncing(true); toast('Syncing locations…');
    await fetch('/api/crm/settings/locations/sync', { method: 'POST', credentials: 'include' });
    toast('Locations synced'); setSyncing(false); load();
  }

  function startEdit(loc: Location) {
    setEditing(loc.id);
    setForm({ name: loc.name, locationType: loc.locationType ?? 'retail', timezone: loc.timezone, fulfillsOnline: loc.fulfillsOnline ?? false, active: loc.active, shopifyLocationId: loc.shopifyLocationId, squareLocationId: loc.squareLocationId });
  }

  async function save(id: string) {
    await fetch('/api/crm/settings/locations', {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...form }),
    });
    toast('Location updated'); setEditing(null); load();
  }

  async function addLocation() {
    if (!newForm.name.trim()) return;
    const res = await fetch('/api/crm/settings/locations', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newForm),
    });
    if (!res.ok) { const d = await res.json(); toast(d.error ?? 'Failed to add'); return; }
    toast('Location added'); setAdding(false); setNewForm({ name: '', locationType: 'retail' }); load();
  }

  async function deleteLocation(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await fetch('/api/crm/settings/locations', {
      method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    toast('Location deleted'); load();
  }

  const shopifyName = (id: string | null) => id ? shopifyLocs.find(s => s.id === id)?.name ?? null : null;
  const squareName = (id: string | null) => id ? squareLocs.find(s => s.id === id)?.name ?? null : null;

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 700 }}>
      <a href="/crm/settings" style={{ fontSize: 13, color: '#9ca3af', textDecoration: 'none' }}>← Settings</a>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Locations</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => { setAdding(true); setEditing(null); }} className="crm-btn crm-btn-primary" style={{ fontSize: 11 }}>+ Add Location</button>
          <button onClick={sync} disabled={syncing} className="crm-btn crm-btn-secondary" style={{ fontSize: 11 }}>
            {syncing ? 'Syncing…' : 'Sync from Shopify + Square'}
          </button>
        </div>
      </div>

      {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Loading…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {adding && (
            <div style={{ border: '1px solid #3b82f6', borderRadius: 10, background: '#fff', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>New Location</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: 10, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 2 }}>Name</label>
                  <input className="crm-input" style={{ width: '100%', fontSize: 12 }} value={newForm.name} onChange={e => setNewForm({ ...newForm, name: e.target.value })} placeholder="e.g. Plateau" autoFocus />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 2 }}>Type</label>
                  <select className="crm-input" style={{ width: '100%', fontSize: 12 }} value={newForm.locationType} onChange={e => setNewForm({ ...newForm, locationType: e.target.value })}>
                    {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={addLocation} className="crm-btn crm-btn-primary" style={{ fontSize: 11, padding: '6px 16px' }}>Add</button>
                <button onClick={() => setAdding(false)} className="crm-btn crm-btn-ghost" style={{ fontSize: 11 }}>Cancel</button>
              </div>
            </div>
          )}
          {locations.map(loc => {
            const type = TYPES.find(t => t.value === (loc.locationType ?? 'retail')) ?? TYPES[0];
            const isEditing = editing === loc.id;
            const sName = shopifyName(loc.shopifyLocationId);
            const sqName = squareName(loc.squareLocationId);

            return (
              <div key={loc.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', overflow: 'hidden', opacity: loc.active ? 1 : 0.5 }}>
                {isEditing ? (
                  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 2 }}>Name</label>
                      <input className="crm-input" style={{ width: '100%', fontSize: 12 }} value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 10, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 2 }}>Type</label>
                        <select className="crm-input" style={{ width: '100%', fontSize: 12 }} value={form.locationType ?? 'retail'} onChange={e => setForm({ ...form, locationType: e.target.value })}>
                          {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 10, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 2 }}>Timezone</label>
                        <input className="crm-input" style={{ width: '100%', fontSize: 12 }} value={form.timezone ?? ''} onChange={e => setForm({ ...form, timezone: e.target.value })} />
                      </div>
                    </div>

                    {/* Channel connections */}
                    <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
                      <label style={{ fontSize: 10, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 6 }}>Channel Connections</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <ChannelPicker
                          label="Shopify" colour="#065f46" bg="#f0fdf4" border="#bbf7d0"
                          current={form.shopifyLocationId ?? null}
                          options={shopifyLocs}
                          onSelect={id => setForm({ ...form, shopifyLocationId: id })}
                        />
                        <ChannelPicker
                          label="Square" colour="#92400e" bg="#fffbeb" border="#fde68a"
                          current={form.squareLocationId ?? null}
                          options={squareLocs}
                          onSelect={id => setForm({ ...form, squareLocationId: id })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.fulfillsOnline ?? false} onChange={e => setForm({ ...form, fulfillsOnline: e.target.checked })} /> Fulfills online orders
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.active ?? true} onChange={e => setForm({ ...form, active: e.target.checked })} /> Active
                      </label>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => save(loc.id)} className="crm-btn crm-btn-primary" style={{ fontSize: 11, padding: '6px 16px' }}>Save</button>
                      <button onClick={() => setEditing(null)} className="crm-btn crm-btn-ghost" style={{ fontSize: 11 }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#6b7280' }}>{type.icon}</span>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{loc.name}</span>
                          {!loc.active && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: '#f3f4f6', color: '#6b7280', fontWeight: 600 }}>inactive</span>}
                          {loc.fulfillsOnline && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>ships online</span>}
                        </div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, marginLeft: 24, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <span>{type.label}</span>
                          {loc.shopifyLocationId ? (
                            <span style={{ padding: '1px 6px', borderRadius: 4, background: '#f0fdf4', color: '#065f46', fontSize: 10 }}>Shopify: {sName ?? loc.shopifyLocationId}</span>
                          ) : (
                            <span style={{ padding: '1px 6px', borderRadius: 4, background: '#f9fafb', color: '#d1d5db', fontSize: 10 }}>Shopify —</span>
                          )}
                          {loc.squareLocationId ? (
                            <span style={{ padding: '1px 6px', borderRadius: 4, background: '#fffbeb', color: '#92400e', fontSize: 10 }}>Square: {sqName ?? loc.squareLocationId}</span>
                          ) : (
                            <span style={{ padding: '1px 6px', borderRadius: 4, background: '#f9fafb', color: '#d1d5db', fontSize: 10 }}>Square —</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => startEdit(loc)} className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}>Edit</button>
                        <button onClick={() => deleteLocation(loc.id, loc.name)} className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: '#ef4444' }}>Delete</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {locations.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No locations. Click "Sync from Shopify + Square" to import.</div>
          )}
        </div>
      )}
    </div>
  );
}

function ChannelPicker({ label, colour, bg, border, current, options, onSelect }: {
  label: string; colour: string; bg: string; border: string;
  current: string | null; options: ChannelLoc[];
  onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = current ? options.find(o => o.id === current) : null;
  const filtered = search ? options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search)) : options;

  return (
    <div style={{ flex: 1 }}>
      <label style={{ fontSize: 10, color: colour, fontWeight: 500, display: 'block', marginBottom: 2 }}>{label} Location</label>
      <button onClick={() => setOpen(true)} style={{
        width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 11, borderRadius: 6,
        border: `1px solid ${selected ? border : '#e5e7eb'}`, background: selected ? bg : '#fff', cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: selected ? colour : '#9ca3af' }}>{selected ? selected.name : 'Not connected'}</span>
        <span style={{ fontSize: 9, color: '#9ca3af' }}>▼</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }} />
          <div style={{ position: 'fixed', top: '15%', left: '50%', transform: 'translateX(-50%)', width: 420, maxHeight: '70vh', background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', zIndex: 51, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Select {label} Location</div>
              <input className="crm-input" style={{ width: '100%', fontSize: 12 }} value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${label} locations…`} autoFocus />
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {/* Disconnect option */}
              <button onClick={() => { onSelect(null); setOpen(false); }} style={{
                width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', cursor: 'pointer',
                background: !current ? '#f9fafb' : '#fff', borderBottom: '1px solid #f3f4f6', fontSize: 12,
              }} onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; }} onMouseLeave={e => { e.currentTarget.style.background = !current ? '#f9fafb' : '#fff'; }}>
                <div style={{ fontWeight: 500, color: '#9ca3af' }}>Not connected</div>
                <div style={{ fontSize: 10, color: '#d1d5db' }}>Remove {label} connection</div>
              </button>

              {filtered.map(o => (
                <button key={o.id} onClick={() => { onSelect(o.id); setOpen(false); }} style={{
                  width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', cursor: 'pointer',
                  background: current === o.id ? bg : '#fff', borderBottom: '1px solid #f3f4f6', fontSize: 12,
                }} onMouseEnter={e => { e.currentTarget.style.background = bg; }} onMouseLeave={e => { e.currentTarget.style.background = current === o.id ? bg : '#fff'; }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500 }}>{o.name}</span>
                    {current === o.id && <span style={{ fontSize: 10, color: colour, fontWeight: 600 }}>✓ Connected</span>}
                  </div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, fontFamily: 'monospace' }}>ID: {o.id}</div>
                </button>
              ))}

              {filtered.length === 0 && search && (
                <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>No locations match "{search}"</div>
              )}
            </div>

            <div style={{ padding: '10px 16px', borderTop: '1px solid #f3f4f6', textAlign: 'right' }}>
              <button onClick={() => setOpen(false)} className="crm-btn crm-btn-ghost" style={{ fontSize: 11 }}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
