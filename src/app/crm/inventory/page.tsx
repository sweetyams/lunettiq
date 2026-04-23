'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Level {
  id: string; familyId: string | null; colour: string | null; variantId: string | null;
  locationId: string; locationName: string; onHand: number; committed: number;
  securityStock: number; available: number; discontinued: boolean;
}

export default function InventoryPage() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [search, setSearch] = useState('');

  function load() {
    setLoading(true);
    fetch('/api/crm/inventory', { credentials: 'include' })
      .then(r => r.json()).then(d => setLevels(d.data ?? []))
      .catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function sync() {
    setSyncing(true);
    await fetch('/api/crm/inventory/sync', { method: 'POST', credentials: 'include' });
    setSyncing(false);
    load();
  }

  const locations = Array.from(new Set(levels.map(l => l.locationName))).sort();

  // Group by family+colour
  const grouped = new Map<string, Level[]>();
  for (const l of levels) {
    const key = l.familyId && l.colour ? `${l.familyId}|${l.colour}` : `variant|${l.variantId}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(l);
  }

  const filtered = Array.from(grouped.entries()).filter(([key]) => {
    if (!search) return true;
    return key.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-2)' }}>
        <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Inventory</h1>
        <button onClick={sync} disabled={syncing} className="crm-btn crm-btn-secondary" style={{ fontSize: 'var(--crm-text-xs)' }}>
          {syncing ? 'Syncing…' : 'Sync from Shopify'}
        </button>
      </div>
      <p style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 'var(--crm-space-5)' }}>
        Stock levels by frame and location. Adjust stock from individual product pages.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--crm-space-4)' }}>
        <input className="crm-input" style={{ flex: 1, fontSize: 12 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by family or colour…" />
        {locations.length > 1 && (
          <select className="crm-input" style={{ fontSize: 11 }} value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
            <option value="">All locations</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
      </div>

      {loading ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--crm-text-tertiary)' }}>Loading…</div> : levels.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 13 }}>
          No inventory data yet. Run a sync from <Link href="/crm/settings/system" style={{ color: 'var(--crm-text-primary)', textDecoration: 'underline' }}>Settings → System</Link>.
        </div>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Frame</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Location</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>On Hand</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Committed</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Available</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(([key, locs]) => {
                const [familyId, colour] = key.includes('|') ? key.split('|') : [null, null];
                const label = familyId && familyId !== 'variant'
                  ? `${familyId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} — ${colour}`
                  : locs[0]?.variantId ?? key;
                const filteredLocs = locationFilter ? locs.filter(l => l.locationName === locationFilter) : locs;
                if (!filteredLocs.length) return null;
                return filteredLocs.map((l, i) => (
                  <tr key={l.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    {i === 0 && <td rowSpan={filteredLocs.length} style={{ padding: '6px 10px', fontWeight: 500, verticalAlign: 'top' }}>
                      {familyId && familyId !== 'variant' ? (
                        <Link href={`/crm/products/families/${familyId}`} style={{ textDecoration: 'none', color: 'inherit' }}>{label}</Link>
                      ) : label}
                    </td>}
                    <td style={{ padding: '6px 10px', color: '#6b7280' }}>{l.locationName}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{l.onHand}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: l.committed > 0 ? '#d97706' : '#9ca3af' }}>{l.committed}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: l.available > 0 ? '#065f46' : '#dc2626' }}>{l.available}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
