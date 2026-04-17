'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/crm/CrmShell';
import { useRouter } from 'next/navigation';

interface Client {
  id: string; firstName: string | null; lastName: string | null;
  email: string | null; phone: string | null;
  orderCount: number | null; totalSpent: string | null; tags: string[] | null;
}

interface Pair {
  id: string; matchReason: string; confidence: string;
  clientA: Client | null; clientB: Client | null;
}

export function DuplicatesClient({ pairs }: { pairs: Pair[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const [scanning, setScanning] = useState(false);
  const [mergingAll, setMergingAll] = useState(false);

  async function handleScan() {
    setScanning(true);
    const res = await fetch('/api/crm/clients/duplicates/scan', { method: 'POST', credentials: 'include' });
    if (res.ok) { const d = await res.json(); toast(`Scanned. Found ${d.data?.found ?? 0} new duplicates.`); router.refresh(); }
    else toast('Scan failed', 'error');
    setScanning(false);
  }

  async function handleMergeAll() {
    const mergeable = visible.filter(p => p.clientA && p.clientB);
    if (!mergeable.length) return;
    if (!confirm(`Merge all ${mergeable.length} duplicate pairs? Primary will be the higher-LTV client.`)) return;
    setMergingAll(true);
    let ok = 0, fail = 0;
    for (const pair of mergeable) {
      try {
        const ltvA = Number(pair.clientA!.totalSpent ?? 0);
        const ltvB = Number(pair.clientB!.totalSpent ?? 0);
        const primaryId = ltvA >= ltvB ? pair.clientA!.id : pair.clientB!.id;
        const secondaryId = primaryId === pair.clientA!.id ? pair.clientB!.id : pair.clientA!.id;
        const res = await fetch('/api/crm/clients/merge', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ primaryId, secondaryId }),
        });
        if (res.ok) { ok++; } else { console.error('Merge failed:', pair.id, await res.text()); fail++; }
      } catch (err) { console.error('Merge error:', pair.id, err); fail++; }
    }
    toast(`Merged ${ok} pairs${fail ? `, ${fail} failed` : ''}`);
    setMergingAll(false);
    router.refresh();
  }

  async function handleMerge(pair: Pair) {
    if (!pair.clientA || !pair.clientB) return;
    // Pick primary by higher LTV
    const ltvA = Number(pair.clientA.totalSpent ?? 0);
    const ltvB = Number(pair.clientB.totalSpent ?? 0);
    const primaryId = ltvA >= ltvB ? pair.clientA.id : pair.clientB.id;
    const secondaryId = primaryId === pair.clientA.id ? pair.clientB.id : pair.clientA.id;

    const res = await fetch('/api/crm/clients/merge', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ primaryId, secondaryId }),
    });
    if (res.ok) { toast('Clients merged'); router.refresh(); }
    else { const e = await res.json().catch(() => ({})); toast(e.error || 'Merge failed', 'error'); }
  }

  async function handleDismiss(id: string) {
    const res = await fetch(`/api/crm/clients/duplicates/${id}/dismiss`, { method: 'POST', credentials: 'include' });
    if (res.ok) { toast('Dismissed'); setDismissed(s => new Set(s).add(id)); }
    else toast('Failed to dismiss', 'error');
  }

  const visible = pairs.filter(p => !dismissed.has(p.id));

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3)', marginBottom: 'var(--crm-space-3)' }}>
        <Link href="/crm/clients" className="crm-btn crm-btn-ghost" style={{ padding: 0 }}>← Clients</Link>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--crm-space-5)' }}>
        <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>
          Potential Duplicates {visible.length > 0 && <span className="crm-badge" style={{ background: 'var(--crm-warning-light)', color: 'var(--crm-warning)', marginLeft: 'var(--crm-space-2)' }}>{visible.length}</span>}
        </h1>
        <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
          {visible.length > 0 && (
            <button onClick={handleMergeAll} disabled={mergingAll} className="crm-btn crm-btn-secondary">
              {mergingAll ? 'Merging…' : `Merge All (${visible.length})`}
            </button>
          )}
          <button onClick={handleScan} disabled={scanning} className="crm-btn crm-btn-primary">
            {scanning ? 'Scanning…' : 'Scan Now'}
          </button>
        </div>
      </div>

      {!visible.length && (
        <div className="crm-card" style={{ padding: 'var(--crm-space-12)', textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>
          No duplicate candidates found. Run a scan or check back after the nightly job.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
        {visible.map(pair => (
          <div key={pair.id} className="crm-card" style={{ padding: 'var(--crm-space-5)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-4)' }}>
              {pair.clientA && <ClientCard client={pair.clientA} />}
              {pair.clientB && <ClientCard client={pair.clientB} />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'var(--crm-space-3)', borderTop: '1px solid var(--crm-border-light)' }}>
              <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
                Match: {pair.matchReason.replace('_', ' ')} ({Math.round(Number(pair.confidence) * 100)}%)
              </span>
              <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
                <button onClick={() => handleDismiss(pair.id)} className="crm-btn crm-btn-secondary">Dismiss</button>
                <button onClick={() => handleMerge(pair)} className="crm-btn crm-btn-primary">Merge →</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientCard({ client }: { client: { id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null; orderCount: number | null; totalSpent: string | null; tags: string[] | null } }) {
  return (
    <div style={{ padding: 'var(--crm-space-3)', background: 'var(--crm-bg)', borderRadius: 'var(--crm-radius-md)' }}>
      <Link href={`/crm/clients/${client.id}`} style={{ fontWeight: 500, fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-primary)' }}>
        {client.firstName} {client.lastName}
      </Link>
      <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-secondary)', marginTop: 4 }}>
        {client.email && <div>{client.email}</div>}
        {client.phone && <div>{client.phone}</div>}
        <div style={{ marginTop: 4 }}>Orders: {client.orderCount ?? 0} · LTV: ${client.totalSpent ?? '0'}</div>
      </div>
      {(client.tags ?? []).length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--crm-space-1)', flexWrap: 'wrap', marginTop: 'var(--crm-space-2)' }}>
          {(client.tags ?? []).slice(0, 5).map(t => (
            <span key={t} className="crm-badge" style={{ background: 'var(--crm-surface)', color: 'var(--crm-text-secondary)' }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}
