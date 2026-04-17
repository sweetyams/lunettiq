'use client';

import { useState, useEffect } from 'react';

interface LedgerEntry {
  id: string; transactionType: string; amount: string; runningBalance: string;
  reason: string | null; occurredAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  issued_membership: 'Monthly credit',
  issued_birthday: 'Birthday credit',
  issued_manual: 'Manual credit',
  issued_second_sight: 'Second Sight',
  redeemed_order: 'Order redemption',
  expired: 'Expired',
  adjustment: 'Adjustment',
};

export function CreditsLedger({ customerId, onAdjust }: { customerId: string; onAdjust: () => void }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/crm/clients/${customerId}/credits?limit=20`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setEntries(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [customerId]);

  if (!loaded) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
        <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Recent transactions
        </span>
        <button onClick={onAdjust} className="crm-btn crm-btn-ghost" style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-accent)' }}>
          + Adjust
        </button>
      </div>
      {entries.length > 0 ? (
        <div style={{ fontSize: 'var(--crm-text-xs)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {entries.map(e => {
            const amt = Number(e.amount);
            return (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--crm-border-light)' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{TYPE_LABELS[e.transactionType] || e.transactionType}</div>
                  {e.reason && <div style={{ color: 'var(--crm-text-tertiary)' }}>{e.reason}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 500, color: amt >= 0 ? 'var(--crm-success)' : 'var(--crm-error)' }}>
                    {amt >= 0 ? '+' : ''}{amt.toFixed(2)}
                  </div>
                  <div style={{ color: 'var(--crm-text-tertiary)' }}>{new Date(e.occurredAt).toLocaleDateString()}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>No transactions</div>
      )}
    </div>
  );
}
