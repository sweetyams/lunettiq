'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/crm/CrmShell';

interface Location { id: string; name: string }
interface Family { id: string; name: string }
interface FamilyMember { family_id: string; product_id: string; colour: string | null }

interface ReceiveLine { familyId: string; colour: string; familyName: string; quantity: number }

export default function ReceiveStockPage() {
  const { toast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [locationId, setLocationId] = useState('');
  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    fetch('/api/crm/settings/locations', { credentials: 'include' }).then(r => r.json()).then(d => {
      const locs = (d.data ?? []).filter((l: any) => l.active);
      setLocations(locs);
      if (locs.length === 1) setLocationId(locs[0].id);
    });
    fetch('/api/crm/settings/families', { credentials: 'include' }).then(r => r.json()).then(d => {
      setFamilies(d.data?.families ?? []);
      setMembers(d.data?.members ?? []);
    });
  }, []);

  // Available colours grouped by family
  const colourOptions = families.flatMap(f => {
    const fMembers = members.filter(m => m.family_id === f.id && m.colour);
    const colours = Array.from(new Set(fMembers.map(m => m.colour!)));
    return colours.map(c => ({ familyId: f.id, familyName: f.name, colour: c }));
  });

  const filtered = search.length >= 1
    ? colourOptions.filter(o => `${o.familyName} ${o.colour}`.toLowerCase().includes(search.toLowerCase()))
    : [];

  function addLine(opt: typeof colourOptions[0]) {
    if (lines.some(l => l.familyId === opt.familyId && l.colour === opt.colour)) return;
    setLines([...lines, { familyId: opt.familyId, colour: opt.colour, familyName: opt.familyName, quantity: 1 }]);
    setSearch('');
  }

  function updateQty(idx: number, qty: number) {
    setLines(lines.map((l, i) => i === idx ? { ...l, quantity: Math.max(1, qty) } : l));
  }

  function removeLine(idx: number) {
    setLines(lines.filter((_, i) => i !== idx));
  }

  async function submit() {
    if (!locationId || !lines.length) return;
    setSubmitting(true);
    let ok = 0;
    for (const line of lines) {
      const res = await fetch('/api/crm/inventory', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'receive', familyId: line.familyId, colour: line.colour, locationId, quantity: line.quantity, note: note || undefined }),
      });
      if (res.ok) ok++;
    }
    toast(`Received ${ok} of ${lines.length} items`);
    setLines([]);
    setNote('');
    setSubmitting(false);
  }

  const totalUnits = lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 13 }}>
        <Link href="/crm/inventory" style={{ color: '#9ca3af', textDecoration: 'none' }}>Inventory</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ fontWeight: 600 }}>Receive Stock</span>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Receive Stock</h1>

      {/* Location selector */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Receiving Location</label>
        <select className="crm-input" style={{ width: '100%', fontSize: 12 }} value={locationId} onChange={e => setLocationId(e.target.value)}>
          <option value="">— Select location —</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
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

      {/* Lines */}
      {lines.length > 0 && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Frame</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500, fontSize: 10, color: '#6b7280', width: 80 }}>Quantity</th>
                <th style={{ padding: '6px 10px', width: 30 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={`${line.familyId}-${line.colour}`} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 10px', fontWeight: 500 }}>
                    {line.familyName} — <span style={{ textTransform: 'capitalize', fontWeight: 400 }}>{line.colour.replace(/-/g, ' ')}</span>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                    <input type="number" min="1" value={line.quantity} onChange={e => updateQty(i, parseInt(e.target.value) || 1)} className="crm-input" style={{ width: 60, fontSize: 12, textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                    <button onClick={() => removeLine(i)} style={{ fontSize: 10, color: '#d1d5db', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
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
          <input className="crm-input" style={{ width: '100%', fontSize: 12, marginBottom: 12 }} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. PO #1234, shipment from supplier" />
          <button onClick={submit} disabled={submitting || !locationId} className="crm-btn crm-btn-primary" style={{ fontSize: 12, padding: '8px 20px' }}>
            {submitting ? 'Receiving…' : `Receive ${totalUnits} unit${totalUnits !== 1 ? 's' : ''} at ${locations.find(l => l.id === locationId)?.name ?? '…'}`}
          </button>
        </div>
      )}
    </div>
  );
}
