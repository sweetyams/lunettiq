'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/crm/CrmShell';

interface Location { id: string; name: string; shopifyLocationId: string | null; squareLocationId: string | null; address: any; active: boolean; syncedAt: string | null }

export function LocationsClient({ locations }: { locations: Location[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    const res = await fetch('/api/crm/settings/locations/sync', { method: 'POST', credentials: 'include' });
    if (res.ok) { const d = await res.json(); toast(`Synced ${d.data?.synced ?? 0} locations`); router.refresh(); }
    else toast('Sync failed', 'error');
    setSyncing(false);
  }

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 700 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-5)' }}>
        <div>
          <Link href="/crm/settings" className="crm-btn crm-btn-ghost" style={{ padding: 0, marginBottom: 4, display: 'inline-block' }}>← Settings</Link>
          <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Locations</h1>
        </div>
        <button onClick={handleSync} disabled={syncing} className="crm-btn crm-btn-primary">
          {syncing ? 'Syncing…' : 'Sync from Shopify'}
        </button>
      </div>

      {locations.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3)' }}>
          {locations.map(loc => (
            <div key={loc.id} className="crm-card" style={{ padding: 'var(--crm-space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 'var(--crm-text-sm)' }}>{loc.name}</div>
                {loc.address && <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>
                  {[loc.address.address1, loc.address.city, loc.address.province].filter(Boolean).join(', ')}
                </div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2)' }}>
                {loc.squareLocationId && <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'var(--crm-surface-hover)', padding: '1px 6px', borderRadius: 4 }}>⬛ Square</span>}
                {loc.shopifyLocationId && <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'var(--crm-surface-hover)', padding: '1px 6px', borderRadius: 4 }}>🛍️ Shopify</span>}
                <span className="crm-badge" style={{ background: loc.active ? 'var(--crm-success-light)' : 'var(--crm-surface-hover)', color: loc.active ? 'var(--crm-success)' : 'var(--crm-text-tertiary)' }}>
                  {loc.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="crm-card" style={{ padding: 'var(--crm-space-12)', textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>
          No locations synced. Click "Sync from Shopify" to import your store locations.
        </div>
      )}
    </div>
  );
}
