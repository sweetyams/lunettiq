'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/crm/CrmShell';

interface Level { id: string; familyId: string | null; colour: string | null; locationId: string; locationName: string; onHand: number; available: number }
interface Location { id: string; name: string }

export default function RecountPage() {
  const { toast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState('');
  const [levels, setLevels] = useState<Level[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    fetch('/api/crm/settings/locations', { credentials: 'include' }).then(r => r.json()).then(d => {
      const locs = (d.data ?? []).filter((l: any) => l.active);
      setLocations(locs);
      if (locs.length === 1) setLocationId(locs[0].id);
    });
  }, []);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/crm/inventory?locationId=${locationId}`, { credentials: 'include' })
      .then(r => r.json()).then(d => {
        const lvls = (d.data ?? []) as Level[];
        setLevels(lvls);
        const c: Record<string, string> = {};
        lvls.forEach(l => { c[l.id] = String(l.onHand); });
        setCounts(c);
      }).finally(() => setLoading(false));
  }, [locationId]);

  const changed = levels.filter(l => {
    const newVal = parseInt(counts[l.id] ?? '');
    return !isNaN(newVal) && newVal !== l.onHand;
  });

  async function submit() {
    if (!changed.length) return;
    setSubmitting(true);
    let ok = 0;
    for (const l of changed) {
      const newOnHand = parseInt(counts[l.id]);
      const res = await fetch('/api/crm/inventory', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recount', familyId: l.familyId, colour: l.colour, locationId, newOnHand, note: note || undefined }),
      });
      if (res.ok) ok++;
    }
    toast(`Recount: ${ok} items updated`);
    setSubmitting(false);
    // Reload
    fetch(`/api/crm/inventory?locationId=${locationId}`, { credentials: 'include' })
      .then(r => r.json()).then(d => { setLevels(d.data ?? []); const c: Record<string, string> = {}; (d.data ?? []).forEach((l: Level) => { c[l.id] = String(l.onHand); }); setCounts(c); });
  }

  const formatFrame = (l: Level) => l.familyId
    ? `${l.familyId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} — ${(l.colour ?? '').replace(/-/g, ' ')}`
    : l.id;

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 13 }}>
        <Link href="/crm/inventory" style={{ color: '#9ca3af', textDecoration: 'none' }}>Inventory</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ fontWeight: 600 }}>Recount</span>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Stock Recount</h1>
      <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 20 }}>Enter actual physical counts. The system will log the difference as an adjustment.</p>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Location</label>
        <select className="crm-input" style={{ width: '100%', fontSize: 12 }} value={locationId} onChange={e => setLocationId(e.target.value)}>
          <option value="">— Select location —</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {loading ? <div style={{ padding: 20, color: '#9ca3af', textAlign: 'center' }}>Loading…</div> : levels.length === 0 && locationId ? (
        <div style={{ padding: 20, color: '#9ca3af', textAlign: 'center', fontSize: 12 }}>No inventory at this location.</div>
      ) : levels.length > 0 && (
        <>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Frame</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500, fontSize: 10, color: '#6b7280', width: 70 }}>System</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500, fontSize: 10, color: '#6b7280', width: 80 }}>Actual</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500, fontSize: 10, color: '#6b7280', width: 50 }}>Diff</th>
                </tr>
              </thead>
              <tbody>
                {levels.map(l => {
                  const actual = parseInt(counts[l.id] ?? '');
                  const diff = !isNaN(actual) ? actual - l.onHand : 0;
                  return (
                    <tr key={l.id} style={{ borderTop: '1px solid #f3f4f6', background: diff !== 0 ? '#fffbeb' : undefined }}>
                      <td style={{ padding: '6px 10px', fontWeight: 500, textTransform: 'capitalize' }}>{formatFrame(l)}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: '#6b7280' }}>{l.onHand}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                        <input type="number" min="0" value={counts[l.id] ?? ''} onChange={e => setCounts({ ...counts, [l.id]: e.target.value })} className="crm-input" style={{ width: 60, fontSize: 12, textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#9ca3af' }}>
                        {diff > 0 ? `+${diff}` : diff === 0 ? '—' : diff}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {changed.length > 0 && (
            <div>
              {/* Large delta warning */}
              {(() => {
                const large = changed.filter(l => {
                  const actual = parseInt(counts[l.id]);
                  const diff = Math.abs(actual - l.onHand);
                  const pct = l.onHand > 0 ? (diff / l.onHand) * 100 : 100;
                  return diff > 5 || pct > 20;
                });
                return large.length > 0 ? (
                  <div style={{ border: '1px solid #fde68a', borderRadius: 8, background: '#fffbeb', padding: '10px 12px', marginBottom: 12, fontSize: 11, color: '#92400e' }}>
                    <span style={{ fontWeight: 600 }}>⚠ Manager sign-off recommended</span> — {large.length} item{large.length !== 1 ? 's have' : ' has'} a delta {'>'} 5 units or {'>'} 20%. Consider having a manager review before submitting.
                  </div>
                ) : null;
              })()}
              <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Recount Note</label>
              <input className="crm-input" style={{ width: '100%', fontSize: 12, marginBottom: 12 }} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Weekly cycle count, found damaged unit" />
              <button onClick={submit} disabled={submitting} className="crm-btn crm-btn-primary" style={{ fontSize: 12, padding: '8px 20px' }}>
                {submitting ? 'Saving…' : `Submit recount (${changed.length} changed)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
