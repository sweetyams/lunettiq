'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/crm/CrmShell';

interface Transfer { id: string; fromLocationId: string; toLocationId: string; status: string; requestedBy: string | null; approvedBy: string | null; note: string | null; createdAt: string }
interface TransferLine { id: string; transferId: string; familyId: string | null; colour: string | null; quantity: number; receivedQuantity: number | null }
interface Location { id: string; name: string }
interface Family { id: string; name: string }
interface FamilyMember { family_id: string; colour: string | null }

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  requested: { bg: '#dbeafe', color: '#1e40af' },
  approved: { bg: '#fef3c7', color: '#92400e' },
  picked: { bg: '#e0e7ff', color: '#3730a3' },
  shipped: { bg: '#e0e7ff', color: '#3730a3' },
  received: { bg: '#95FFB9', color: '#065f46' },
  cancelled: { bg: '#f3f4f6', color: '#6b7280' },
};

export default function TransfersPage() {
  const { toast } = useToast();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [lines, setLines] = useState<TransferLine[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [fromLoc, setFromLoc] = useState('');
  const [toLoc, setToLoc] = useState('');
  const [newLines, setNewLines] = useState<Array<{ familyId: string; colour: string; familyName: string; quantity: number; maxQty: number }>>([]);
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [originStock, setOriginStock] = useState<Array<{ familyId: string | null; colour: string | null; available: number }>>([]);

  function load() {
    setLoading(true);
    Promise.all([
      fetch('/api/crm/inventory/transfers', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/crm/settings/locations', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/crm/settings/families', { credentials: 'include' }).then(r => r.json()),
    ]).then(([t, l, f]) => {
      setTransfers(t.data?.transfers ?? []);
      setLines(t.data?.lines ?? []);
      setLocations((l.data ?? []).filter((x: any) => x.active));
      setFamilies(f.data?.families ?? []);
      setMembers(f.data?.members ?? []);
    }).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!fromLoc) { setOriginStock([]); return; }
    fetch(`/api/crm/inventory?locationId=${fromLoc}`, { credentials: 'include' })
      .then(r => r.json()).then(d => setOriginStock(d.data ?? [])).catch(() => setOriginStock([]));
  }, [fromLoc]);

  const api = (body: object) => fetch('/api/crm/inventory/transfers', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  async function createTransfer() {
    if (!fromLoc || !toLoc || !newLines.length) return;
    await api({ action: 'create', fromLocationId: fromLoc, toLocationId: toLoc, items: newLines.map(l => ({ familyId: l.familyId, colour: l.colour, quantity: l.quantity })), note: note || undefined });
    toast('Transfer requested');
    setCreating(false); setNewLines([]); setNote(''); load();
  }

  async function updateStatus(id: string, action: string) {
    await api({ action, id });
    toast(`Transfer ${action}d`);
    load();
  }

  const colourOptions = families.flatMap(f => {
    const cols = Array.from(new Set(members.filter(m => m.family_id === f.id && m.colour).map(m => m.colour!)));
    return cols.map(c => {
      const stock = originStock.find(s => s.familyId === f.id && s.colour === c);
      return { familyId: f.id, familyName: f.name, colour: c, available: stock?.available ?? 0 };
    });
  });
  const filtered = search.length >= 1 ? colourOptions.filter(o => o.available > 0 && `${o.familyName} ${o.colour}`.toLowerCase().includes(search.toLowerCase())) : [];

  const locName = (id: string) => locations.find(l => l.id === id)?.name ?? id;
  const frameName = (l: TransferLine) => l.familyId ? `${l.familyId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} — ${(l.colour ?? '').replace(/-/g, ' ')}` : '?';

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 13 }}>
        <Link href="/crm/inventory" style={{ color: '#9ca3af', textDecoration: 'none' }}>Inventory</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ fontWeight: 600 }}>Transfers</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Transfers</h1>
        <button onClick={() => setCreating(!creating)} className="crm-btn crm-btn-primary" style={{ fontSize: 'var(--crm-text-xs)' }}>New Transfer</button>
      </div>

      {/* Create form */}
      {creating && (
        <div style={{ border: '1px dashed #d1d5db', borderRadius: 10, padding: 16, marginBottom: 20, background: '#fafafa' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>From</label>
              <select className="crm-input" style={{ width: '100%', fontSize: 12 }} value={fromLoc} onChange={e => { setFromLoc(e.target.value); if (e.target.value === toLoc) setToLoc(''); }}>
                <option value="">—</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>To</label>
              <select className="crm-input" style={{ width: '100%', fontSize: 12 }} value={toLoc} onChange={e => setToLoc(e.target.value)}>
                <option value="">—</option>
                {locations.filter(l => l.id !== fromLoc).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          <input className="crm-input" style={{ width: '100%', fontSize: 12, marginBottom: 8 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products to transfer…" />
          {filtered.length > 0 && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, maxHeight: 150, overflowY: 'auto', marginBottom: 8, background: '#fff' }}>
              {filtered.slice(0, 15).map(o => (
                <button key={`${o.familyId}-${o.colour}`} onClick={() => { if (!newLines.some(l => l.familyId === o.familyId && l.colour === o.colour)) setNewLines([...newLines, { ...o, quantity: 1, maxQty: o.available }]); setSearch(''); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ fontWeight: 500 }}>{o.familyName}</span> — {o.colour.replace(/-/g, ' ')} <span style={{ color: '#9ca3af', fontSize: 10 }}>({o.available} avail)</span>
                </button>
              ))}
            </div>
          )}
          {newLines.length > 0 && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff', marginBottom: 12 }}>
              {newLines.map((l, i) => (
                <div key={`${l.familyId}-${l.colour}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderTop: i ? '1px solid #f3f4f6' : 'none', fontSize: 12 }}>
                  <span style={{ flex: 1, fontWeight: 500 }}>{l.familyName} — <span style={{ fontWeight: 400, textTransform: 'capitalize' }}>{l.colour.replace(/-/g, ' ')}</span></span>
                  <input type="number" min="1" max={l.maxQty} value={l.quantity} onChange={e => setNewLines(newLines.map((x, j) => j === i ? { ...x, quantity: Math.min(parseInt(e.target.value) || 1, l.maxQty) } : x))} className="crm-input" style={{ width: 50, fontSize: 12, textAlign: 'right' }} />
                  <span style={{ fontSize: 9, color: '#9ca3af', width: 30 }}>/ {l.maxQty}</span>
                  <button onClick={() => setNewLines(newLines.filter((_, j) => j !== i))} style={{ color: '#d1d5db', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                </div>
              ))}
            </div>
          )}
          <input className="crm-input" style={{ width: '100%', fontSize: 12, marginBottom: 8 }} value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={createTransfer} disabled={!fromLoc || !toLoc || !newLines.length} className="crm-btn crm-btn-primary" style={{ fontSize: 12, padding: '6px 16px' }}>Request Transfer</button>
            <button onClick={() => { setCreating(false); setNewLines([]); }} className="crm-btn crm-btn-ghost" style={{ fontSize: 12 }}>Cancel</button>
          </div>
          <p style={{ fontSize: 9, color: '#9ca3af', marginTop: 6 }}>Creates a request. Stock moves when origin marks it picked, not at request time.</p>
        </div>
      )}

      {/* Transfer list — grouped by status */}
      {loading ? <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Loading…</div> : transfers.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No transfers yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'Awaiting Pickup', statuses: ['requested', 'approved'] },
            { label: 'Picked / In Transit', statuses: ['picked', 'shipped'] },
            { label: 'Received', statuses: ['received'] },
            { label: 'Cancelled', statuses: ['cancelled'] },
          ].map(group => {
            const items = transfers.filter(t => group.statuses.includes(t.status));
            if (!items.length) return null;
            return (
              <div key={group.label}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{group.label} ({items.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map(t => {
                    const tLines = lines.filter(l => l.transferId === t.id);
                    const st = STATUS_STYLES[t.status] ?? STATUS_STYLES.requested;
                    const hasDiscrepancy = tLines.some(l => l.receivedQuantity != null && l.receivedQuantity !== l.quantity);
                    return (
                      <div key={t.id} style={{ border: `1px solid ${hasDiscrepancy ? '#fecaca' : '#e5e7eb'}`, borderRadius: 10, background: hasDiscrepancy ? '#fef2f2' : '#fff', padding: '14px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{locName(t.fromLocationId)} → {locName(t.toLocationId)}</span>
                            <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', borderRadius: 10, background: st.bg, color: st.color, fontWeight: 600 }}>{t.status}</span>
                            {hasDiscrepancy && <span style={{ marginLeft: 4, fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#fef2f2', color: '#dc2626', fontWeight: 600 }}>discrepancy</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {t.status === 'requested' && <button onClick={() => updateStatus(t.id, 'approve')} className="crm-btn crm-btn-primary" style={{ fontSize: 10, padding: '3px 10px' }}>Approve</button>}
                            {t.status === 'approved' && <button onClick={() => updateStatus(t.id, 'pick')} className="crm-btn crm-btn-primary" style={{ fontSize: 10, padding: '3px 10px' }}>Mark Picked</button>}
                            {t.status === 'picked' && <button onClick={() => updateStatus(t.id, 'ship')} className="crm-btn crm-btn-primary" style={{ fontSize: 10, padding: '3px 10px' }}>Mark Shipped</button>}
                            {t.status === 'shipped' && <button onClick={() => updateStatus(t.id, 'receive')} className="crm-btn crm-btn-primary" style={{ fontSize: 10, padding: '3px 10px' }}>Receive</button>}
                            {(t.status === 'requested' || t.status === 'approved') && <button onClick={() => updateStatus(t.id, 'cancel')} className="crm-btn crm-btn-ghost" style={{ fontSize: 10, padding: '3px 10px', color: '#dc2626' }}>Cancel</button>}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>
                          {new Date(t.createdAt).toLocaleDateString()} · {tLines.reduce((s, l) => s + l.quantity, 0)} units
                          {t.note && <span> · {t.note}</span>}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {tLines.map(l => (
                            <span key={l.id} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#f3f4f6', color: '#374151' }}>
                              {frameName(l)} ×{l.quantity}{l.receivedQuantity != null && l.receivedQuantity !== l.quantity && <span style={{ color: '#dc2626' }}> (got {l.receivedQuantity})</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
