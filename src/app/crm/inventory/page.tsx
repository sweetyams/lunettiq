'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/crm/CrmShell';

interface Level {
  id: string; familyId: string | null; colour: string | null; variantId: string | null;
  locationId: string; locationName: string; onHand: number; committed: number;
  securityStock: number; available: number; discontinued: boolean;
  lifecycle: string | null; runQuantity: number | null; replenishable: boolean | null; discontinueAtZero: boolean | null;
}

export default function InventoryPage() {
  const { toast } = useToast();
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);
  const [tab, setTab] = useState<'levels' | 'history'>('levels');
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [holds, setHolds] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [pendingReturns, setPendingReturns] = useState(0);

  function load() {
    setLoading(true);
    Promise.all([
      fetch('/api/crm/inventory', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/crm/inventory/protections?activeOnly=true', { credentials: 'include' }).then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/crm/inventory/transfers', { credentials: 'include' }).then(r => r.json()).catch(() => ({ data: { transfers: [] } })),
      fetch('/api/crm/inventory/returns?status=awaiting', { credentials: 'include' }).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([inv, h, t, ret]) => {
      setLevels(inv.data ?? []);
      setHolds(h.data ?? []);
      setTransfers((t.data?.transfers ?? []).filter((tr: any) => tr.status !== 'received' && tr.status !== 'cancelled'));
      setPendingReturns((ret.data ?? []).length);
    }).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (tab === 'history' && !adjustments.length) {
      fetch('/api/crm/inventory/adjustments', { credentials: 'include' })
        .then(r => r.json()).then(d => setAdjustments(d.data ?? [])).catch(() => {});
    }
  }, [tab]);

  const locations = useMemo(() => Array.from(new Set(levels.map(l => l.locationName))).sort(), [levels]);

  // Group by family
  const families = useMemo(() => {
    const map = new Map<string, { familyId: string; colours: Map<string, Level[]> }>();
    const orphans: Level[] = [];

    for (const l of levels) {
      if (l.familyId && l.colour) {
        if (!map.has(l.familyId)) map.set(l.familyId, { familyId: l.familyId, colours: new Map() });
        const fam = map.get(l.familyId)!;
        if (!fam.colours.has(l.colour)) fam.colours.set(l.colour, []);
        fam.colours.get(l.colour)!.push(l);
      } else {
        orphans.push(l);
      }
    }
    return { families: Array.from(map.entries()), orphans };
  }, [levels]);

  const formatFamily = (id: string) => id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const getTotalAvailable = (colourLevels: Level[]) => {
    const filtered = locationFilter ? colourLevels.filter(l => l.locationName === locationFilter) : colourLevels;
    return filtered.reduce((s, l) => s + l.available, 0);
  };

  const getFamilyTotal = (colours: Map<string, Level[]>) => {
    let total = 0;
    for (const locs of colours.values()) total += getTotalAvailable(locs);
    return total;
  };

  const filtered = families.families.filter(([id, fam]) => {
    if (search && !id.toLowerCase().includes(search.toLowerCase())) return false;
    if (stockFilter === 'out' && getFamilyTotal(fam.colours) > 0) return false;
    if (stockFilter === 'low' && getFamilyTotal(fam.colours) > 5) return false;
    return true;
  });

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-2)' }}>
        <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Inventory</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <Link href="/crm/inventory/receive" className="crm-btn crm-btn-primary" style={{ fontSize: 'var(--crm-text-xs)' }}>Receive Stock</Link>
          <Link href="/crm/inventory/recount" className="crm-btn crm-btn-secondary" style={{ fontSize: 'var(--crm-text-xs)' }}>Recount</Link>
          <Link href="/crm/inventory/transfers" className="crm-btn crm-btn-secondary" style={{ fontSize: 'var(--crm-text-xs)' }}>Transfers</Link>
          <Link href="/crm/inventory/holds" className="crm-btn crm-btn-secondary" style={{ fontSize: 'var(--crm-text-xs)' }}>Holds</Link>
          <Link href="/crm/inventory/returns" className="crm-btn crm-btn-secondary" style={{ fontSize: 'var(--crm-text-xs)' }}>Returns</Link>
        </div>
      </div>
      <p style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 'var(--crm-space-4)' }}>
        Stock levels by frame family and colour. Grouped by physical frame — optical and sun share the same pool.
      </p>

      {/* Stock at a glance — 4 cards */}
      {!loading && levels.length > 0 && (() => {
        const totalAvail = levels.reduce((s, l) => s + l.available, 0);
        const outOfStock = families.families.filter(([, f]) => getFamilyTotal(f.colours) === 0).length;
        const lowStock = families.families.filter(([, f]) => { const t = getFamilyTotal(f.colours); return t > 0 && t <= 5; }).length;

        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 'var(--crm-space-4)' }}>
            <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#065f46' }}>{totalAvail}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>Available</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: `1px solid ${lowStock ? '#fde68a' : '#e5e7eb'}` }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: lowStock ? '#92400e' : '#9ca3af' }}>{lowStock}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>Low Stock</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: `1px solid ${outOfStock ? '#fecaca' : '#e5e7eb'}` }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: outOfStock ? '#dc2626' : '#9ca3af' }}>{outOfStock}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>Out of Stock</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: `1px solid ${holds.length ? '#dbeafe' : '#e5e7eb'}` }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: holds.length ? '#1e40af' : '#9ca3af' }}>{holds.length}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>Active Holds</div>
            </div>
          </div>
        );
      })()}

      {/* Action queue */}
      {!loading && (() => {
        const expiringHolds = holds.filter(h => h.expiresAt && new Date(h.expiresAt).getTime() - Date.now() < 86400000);
        const awaitingReceipt = transfers.filter(t => t.status === 'shipped');
        const lowStockCount = families.families.filter(([, f]) => { const t = getFamilyTotal(f.colours); return t > 0 && t <= 5; }).length;
        const hasItems = expiringHolds.length || awaitingReceipt.length || lowStockCount || pendingReturns || transfers.length;
        if (!hasItems && !loading) return null;
        return (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', padding: 12, marginBottom: 'var(--crm-space-4)', fontSize: 11 }}>
            <div style={{ fontWeight: 600, fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Action Queue</div>
            {awaitingReceipt.length > 0 && (
              <div style={{ padding: '3px 0' }}><a href="/crm/inventory/transfers" style={{ color: '#1e40af', textDecoration: 'none' }}>{awaitingReceipt.length} transfer{awaitingReceipt.length !== 1 ? 's' : ''} awaiting receipt</a></div>
            )}
            {expiringHolds.length > 0 && (
              <div style={{ padding: '3px 0' }}><a href="/crm/inventory/holds" style={{ color: '#d97706', textDecoration: 'none' }}>{expiringHolds.length} hold{expiringHolds.length !== 1 ? 's' : ''} expiring in 24h</a></div>
            )}
            {lowStockCount > 0 && (
              <div style={{ padding: '3px 0' }}><button onClick={() => setStockFilter('low')} style={{ color: '#92400e', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11, fontFamily: 'inherit' }}>{lowStockCount} frame{lowStockCount !== 1 ? 's' : ''} at low stock</button></div>
            )}
            {pendingReturns > 0 && (
              <div style={{ padding: '3px 0' }}><a href="/crm/inventory/returns" style={{ color: '#92400e', textDecoration: 'none' }}>{pendingReturns} return{pendingReturns !== 1 ? 's' : ''} awaiting inspection</a></div>
            )}
            {!hasItems && <div style={{ color: '#9ca3af' }}>All clear.</div>}
          </div>
        );
      })()}

      {/* Tab: Levels / History */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--crm-border-light)', marginBottom: 'var(--crm-space-4)' }}>
        {(['levels', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', fontSize: 12, cursor: 'pointer', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? '#111' : 'transparent'}`, color: tab === t ? '#111' : '#9ca3af', fontWeight: tab === t ? 600 : 400 }}>
            {t === 'levels' ? 'Stock Levels' : 'Adjustment History'}
          </button>
        ))}
      </div>

      {tab === 'levels' && <>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--crm-space-4)', flexWrap: 'wrap' }}>
        <input className="crm-input" style={{ flex: '1 1 160px', fontSize: 12 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search families…" />
        {locations.length > 1 && (
          <select className="crm-input" style={{ fontSize: 11 }} value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
            <option value="">All locations</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        <div style={{ display: 'flex', gap: 2 }}>
          {(['all', 'low', 'out'] as const).map(f => (
            <button key={f} onClick={() => setStockFilter(f)} style={{
              fontSize: 10, padding: '3px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
              background: stockFilter === f ? (f === 'out' ? '#fef2f2' : f === 'low' ? '#fef3c7' : '#111') : 'var(--crm-surface-hover)',
              color: stockFilter === f ? (f === 'out' ? '#dc2626' : f === 'low' ? '#92400e' : '#fff') : 'var(--crm-text-tertiary)',
              fontWeight: stockFilter === f ? 600 : 400,
            }}>{f === 'all' ? 'All' : f === 'low' ? 'Low Stock' : 'Out of Stock'}</button>
          ))}
        </div>
        <span style={{ fontSize: 10, color: '#9ca3af', alignSelf: 'center' }}>{filtered.length} families</span>
      </div>

      {loading ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--crm-text-tertiary)' }}>Loading…</div> : levels.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 13 }}>
          No inventory data yet. Click "Sync from Shopify" or run from <Link href="/crm/settings/system" style={{ color: 'var(--crm-text-primary)', textDecoration: 'underline' }}>Settings → System</Link>.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(([familyId, fam]) => {
            const total = getFamilyTotal(fam.colours);
            const isOpen = expandedFamily === familyId;
            const colours = Array.from(fam.colours.entries());

            return (
              <div key={familyId} style={{ border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
                {/* Family header */}
                <div onClick={() => setExpandedFamily(isOpen ? null : familyId)} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10, color: '#9ca3af', transition: 'transform 0.15s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        <Link href={`/crm/products/families/${familyId}`} onClick={e => e.stopPropagation()} style={{ textDecoration: 'none', color: 'inherit' }}>{formatFamily(familyId)}</Link>
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{colours.length} colour{colours.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 10, background: total > 5 ? '#95FFB9' : total > 0 ? '#fef3c7' : '#fef2f2', color: total > 5 ? '#065f46' : total > 0 ? '#92400e' : '#dc2626' }}>{total} available</span>
                </div>

                {/* Expanded: colour × location grid */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #f3f4f6' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f9fafb' }}>
                          <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Colour</th>
                          {locations.filter(l => !locationFilter || l === locationFilter).map(loc => (
                            <th key={loc} style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>{loc}</th>
                          ))}
                          <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {colours.map(([colour, locs]) => {
                          const colourTotal = getTotalAvailable(locs);
                          return (
                            <tr key={colour} style={{ borderTop: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '6px 10px', fontWeight: 500, textTransform: 'capitalize' }}>{colour.replace(/-/g, ' ')}</td>
                              {locations.filter(l => !locationFilter || l === locationFilter).map(loc => {
                                const level = locs.find(l => l.locationName === loc);
                                const avail = level?.available ?? 0;
                                return (
                                  <td key={loc} style={{ padding: '6px 10px', textAlign: 'right' }}>
                                    <span style={{ color: avail > 5 ? '#065f46' : avail > 0 ? '#92400e' : '#dc2626', fontWeight: avail === 0 ? 600 : 400 }}>{avail}</span>
                                    {level && level.committed > 0 && <span style={{ fontSize: 9, color: '#d97706', marginLeft: 3 }}>({level.committed})</span>}
                                  </td>
                                );
                              })}
                              <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{colourTotal}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>}

      {tab === 'history' && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Date</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Frame</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Reason</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Change</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Note</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((a: any) => (
                <tr key={a.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 10px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{new Date(a.createdAt).toLocaleString()}</td>
                  <td style={{ padding: '6px 10px', fontWeight: 500, textTransform: 'capitalize' }}>
                    {a.familyId ? `${a.familyId.replace(/-/g, ' ')} — ${(a.colour ?? '').replace(/-/g, ' ')}` : a.variantId ?? '—'}
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: a.reason === 'sale' ? '#dbeafe' : a.reason === 'return' ? '#95FFB9' : a.reason === 'damage' || a.reason === 'loss' ? '#fef2f2' : '#f3f4f6', color: a.reason === 'sale' ? '#1e40af' : a.reason === 'return' ? '#065f46' : a.reason === 'damage' || a.reason === 'loss' ? '#dc2626' : '#6b7280', fontWeight: 500 }}>{a.reason}</span>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: a.quantityChange > 0 ? '#16a34a' : a.quantityChange < 0 ? '#dc2626' : '#9ca3af' }}>
                    {a.quantityChange > 0 ? `+${a.quantityChange}` : a.quantityChange}
                  </td>
                  <td style={{ padding: '6px 10px', color: '#9ca3af', fontSize: 11 }}>{a.note ?? '—'}</td>
                </tr>
              ))}
              {adjustments.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No adjustments yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
