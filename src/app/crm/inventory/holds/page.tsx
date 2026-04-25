'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/crm/CrmShell';

interface Protection {
  id: string; familyId: string; colour: string; locationId: string;
  quantity: number; scope: string; reason: string;
  referenceId: string | null; referenceType: string | null;
  expiresAt: string | null; staffId: string | null; note: string | null;
  createdAt: string; releasedAt: string | null;
}

interface Location { id: string; name: string }

const REASON_STYLES: Record<string, { bg: string; color: string }> = {
  try_on_hold: { bg: '#dbeafe', color: '#1e40af' },
  last_unit_lock: { bg: '#fef2f2', color: '#dc2626' },
  manager_hold: { bg: '#fef3c7', color: '#92400e' },
  display: { bg: '#f3e8ff', color: '#7c3aed' },
  rx_in_progress: { bg: '#e0e7ff', color: '#3730a3' },
  transfer_pending: { bg: '#f3f4f6', color: '#6b7280' },
  damage_review: { bg: '#fef2f2', color: '#dc2626' },
};

export default function HoldsPage() {
  const { toast } = useToast();
  const [holds, setHolds] = useState<Protection[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReleased, setShowReleased] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch(`/api/crm/inventory/protections?activeOnly=${!showReleased}`, { credentials: 'include' }).then(r => r.json()),
      fetch('/api/crm/settings/locations', { credentials: 'include' }).then(r => r.json()),
    ]).then(([h, l]) => {
      setHolds(h.data ?? []);
      setLocations(l.data ?? []);
    }).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [showReleased]);

  async function release(id: string) {
    await fetch('/api/crm/inventory/protections', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'release', id }),
    });
    toast('Hold released');
    load();
  }

  const locName = (id: string) => locations.find(l => l.id === id)?.name ?? id;
  const frameName = (h: Protection) => `${h.familyId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} — ${h.colour.replace(/-/g, ' ')}`;

  const active = holds.filter(h => !h.releasedAt);
  const released = holds.filter(h => h.releasedAt);

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 13 }}>
        <Link href="/crm/inventory" style={{ color: '#9ca3af', textDecoration: 'none' }}>Inventory</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ fontWeight: 600 }}>Holds</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Inventory Holds</h1>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280', cursor: 'pointer' }}>
          <input type="checkbox" checked={showReleased} onChange={e => setShowReleased(e.target.checked)} /> Show released
        </label>
      </div>

      {loading ? <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Loading…</div> : active.length === 0 && !showReleased ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No active holds.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {active.map(h => {
            const st = REASON_STYLES[h.reason] ?? REASON_STYLES.manager_hold;
            const expiring = h.expiresAt && new Date(h.expiresAt).getTime() - Date.now() < 86400000;
            return (
              <div key={h.id} style={{ border: `1px solid ${expiring ? '#fde68a' : '#e5e7eb'}`, borderRadius: 10, background: expiring ? '#fffbeb' : '#fff', padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{frameName(h)}</span>
                    <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', borderRadius: 10, background: st.bg, color: st.color, fontWeight: 600 }}>{h.reason.replace(/_/g, ' ')}</span>
                    <span style={{ marginLeft: 6, fontSize: 10, color: '#9ca3af' }}>×{h.quantity} at {locName(h.locationId)}</span>
                  </div>
                  <button onClick={() => release(h.id)} className="crm-btn crm-btn-ghost" style={{ fontSize: 10, padding: '3px 10px', color: '#dc2626' }}>Release</button>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                  {h.note && <span>{h.note} · </span>}
                  Created {new Date(h.createdAt).toLocaleString()}
                  {h.expiresAt && <span> · Expires {new Date(h.expiresAt).toLocaleString()}</span>}
                  {h.scope !== 'all_channels' && <span> · {h.scope.replace(/_/g, ' ')}</span>}
                </div>
              </div>
            );
          })}

          {showReleased && released.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 8 }}>Released</div>
              {released.map(h => (
                <div key={h.id} style={{ border: '1px solid #f3f4f6', borderRadius: 10, background: '#fafafa', padding: '10px 16px', opacity: 0.6 }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{frameName(h)}</span>
                  <span style={{ marginLeft: 8, fontSize: 10, color: '#9ca3af' }}>{h.reason.replace(/_/g, ' ')} · released {h.releasedAt ? new Date(h.releasedAt).toLocaleString() : ''}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
