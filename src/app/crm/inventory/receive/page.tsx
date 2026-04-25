'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/crm/CrmShell';

interface Location { id: string; name: string }
interface Family { id: string; name: string }
interface FamilyMember { family_id: string; product_id: string; colour: string | null }
interface ReceiveLine { familyId: string; colour: string; familyName: string; quantity: number; locationId: string }

export default function ReceiveStockPage() {
  const { toast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [defaultLocationId, setDefaultLocationId] = useState('');
  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');
  const [supplierRef, setSupplierRef] = useState('');

  useEffect(() => {
    fetch('/api/crm/settings/locations', { credentials: 'include' }).then(r => r.json()).then(d => {
      const locs = (d.data ?? []).filter((l: any) => l.active);
      setLocations(locs);
      if (locs.length === 1) setDefaultLocationId(locs[0].id);
    });
    fetch('/api/crm/settings/families', { credentials: 'include' }).then(r => r.json()).then(d => {
      setFamilies(d.data?.families ?? []);
      setMembers(d.data?.members ?? []);
    });
  }, []);

  const colourOptions = families.flatMap(f => {
    const cols = Array.from(new Set(members.filter(m => m.family_id === f.id && m.colour).map(m => m.colour!)));
    return cols.map(c => ({ familyId: f.id, familyName: f.name, colour: c }));
  });

  const filtered = search.length >= 1
    ? colourOptions.filter(o => `${o.familyName} ${o.colour}`.toLowerCase().includes(search.toLowerCase()))
    : [];

  function addLine(opt: typeof colourOptions[0]) {
    if (lines.some(l => l.familyId === opt.familyId && l.colour === opt.colour && l.locationId === defaultLocationId)) return;
    setLines([...lines, { ...opt, quantity: 1, locationId: defaultLocationId }]);
    setSearch('');
  }

  function updateLine(idx: number, updates: Partial<ReceiveLine>) {
    setLines(lines.map((l, i) => i === idx ? { ...l, ...updates } : l));
  }

  async function submit() {
    const valid = lines.filter(l => l.locationId && l.quantity > 0);
    if (!valid.length) return;
    setSubmitting(true);
    const refId = supplierRef.trim() || `recv_${Date.now()}`;
    let ok = 0;
    for (const line of valid) {
      const res = await fetch('/api/crm/inventory', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'receive', familyId: line.familyId, colour: line.colour, locationId: line.locationId, quantity: line.quantity, referenceId: refId, referenceType: 'supplier_delivery', note: note || undefined }),
      });
      if (res.ok) ok++;
    }
    toast(`Received ${ok} of ${valid.length} items`);
    setLines([]); setNote(''); setSupplierRef('');
    setSubmitting(false);
  }

  const totalUnits = lines.reduce((s, l) => s + l.quantity, 0);
  const locName = (id: string) => locations.find(l => l.id === id)?.name ?? '—';

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 750 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 13 }}>
        <Link href="/crm/inventory" style={{ color: '#9ca3af', textDecoration: 'none' }}>Inventory</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ fontWeight: 600 }}>Receive Stock</span>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Receive Stock</h1>

      {/* Default location + supplier ref */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Default Location</label>
          <select className="crm-input" style={{ width: '100%', fontSize: 12 }} value={defaultLocationId} onChange={e => setDefaultLocationId(e.target.value)}>
            <option value="">— Select —</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Supplier Reference</label>
          <input className="crm-input" style={{ width: '100%', fontSize: 12 }} value={supplierRef} onChange={e => setSupplierRef(e.target.value)} placeholder="e.g. PO-2026-0412" />
        </div>
      </div>

      {/* Product search */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Add Products</label>
        <input className="crm-input" style={{ width: '100%', fontSize: 12 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by family or colour…" />
        {filtered.length > 0 && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, marginTop: 4, maxHeight: 200, overflowY: 'auto', background: '#fff' }}>
            {filtered.slice(0, 20).map(o => (
              <button key={`${o.familyId}-${o.colour}`} onClick={() => addLine(o)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; }}>
                <span style={{ fontWeight: 500 }}>{o.familyName}</span> — <span style={{ textTransform: 'capitalize' }}>{o.colour.replace(/-/g, ' ')}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lines with per-line location */}
      {lines.length > 0 && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Frame</th>
                <th style={{ padding: '6px 10px', fontWeight: 500, fontSize: 10, color: '#6b7280', width: 130 }}>Location</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500, fontSize: 10, color: '#6b7280', width: 70 }}>Qty</th>
                <th style={{ padding: '6px 10px', width: 30 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={`${line.familyId}-${line.colour}-${line.locationId}-${i}`} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 10px', fontWeight: 500 }}>
                    {line.familyName} — <span style={{ textTransform: 'capitalize', fontWeight: 400 }}>{line.colour.replace(/-/g, ' ')}</span>
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <select className="crm-input" style={{ width: '100%', fontSize: 11 }} value={line.locationId} onChange={e => updateLine(i, { locationId: e.target.value })}>
                      <option value="">—</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                    <input type="number" min="1" value={line.quantity} onChange={e => updateLine(i, { quantity: parseInt(e.target.value) || 1 })} className="crm-input" style={{ width: 55, fontSize: 12, textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                    <button onClick={() => setLines(lines.filter((_, j) => j !== i))} style={{ fontSize: 10, color: '#d1d5db', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Note + submit */}
      {lines.length > 0 && (
        <div>
          <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Note (optional)</label>
          <input className="crm-input" style={{ width: '100%', fontSize: 12, marginBottom: 12 }} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Shipment from Mazzucchelli" />
          <button onClick={submit} disabled={submitting || !lines.some(l => l.locationId)} className="crm-btn crm-btn-primary" style={{ fontSize: 12, padding: '8px 20px' }}>
            {submitting ? 'Receiving…' : `Receive ${totalUnits} unit${totalUnits !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}
