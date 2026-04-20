'use client';

import { useState } from 'react';
import { TIERS, TierKey } from '@/lib/crm/loyalty-config';

const TIER_STYLE: Record<string, { bg: string; color: string }> = {
  essential: { bg: 'var(--crm-surface-hover)', color: 'var(--crm-text-secondary)' },
  cult: { bg: 'var(--crm-accent-light)', color: 'var(--crm-accent)' },
  vault: { bg: '#fef3c7', color: '#92400e' },
};

const STATUS_STYLE: Record<string, { color: string }> = {
  active: { color: 'var(--crm-success)' },
  paused: { color: 'var(--crm-warning)' },
  cancelled: { color: 'var(--crm-error)' },
};

interface Props {
  tier: TierKey | null;
  status: string | null;
  creditBalance: number;
  memberSince: string | null;
  nextRenewal: string | null;
  lastLensRefresh: string | null;
  lastRotation: string | null;
  customerId?: string;
  onTierChange?: () => void;
}

export function MembershipCard({ tier, status, creditBalance, memberSince, nextRenewal, lastLensRefresh, lastRotation, customerId, onTierChange }: Props) {
  const [changing, setChanging] = useState(false);

  async function changeTier(newTier: string) {
    if (!customerId || !confirm(`Change membership to ${newTier.toUpperCase()}?`)) return;
    setChanging(true);
    await fetch(`/api/crm/clients/${customerId}/membership`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: newTier }),
    });
    setChanging(false);
    onTierChange?.();
  }

  async function changeStatus(action: string) {
    if (!customerId) return;
    setChanging(true);
    await fetch(`/api/crm/clients/${customerId}/membership`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: action === 'cancel' ? 'cancelled' : 'active' }),
    });
    setChanging(false);
    onTierChange?.();
  }
  if (!tier) {
    return (
      <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>Not a member</div>
    );
  }

  const config = TIERS[tier];
  const style = TIER_STYLE[tier] ?? TIER_STYLE.essential;
  const statusStyle = STATUS_STYLE[status ?? 'active'] ?? STATUS_STYLE.active;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="crm-badge" style={{ background: style.bg, color: style.color, fontSize: 'var(--crm-text-sm)', padding: '4px 12px' }}>
          {config.label}
        </span>
        <span style={{ fontSize: 'var(--crm-text-xs)', color: statusStyle.color, fontWeight: 500 }}>{status ?? 'active'}</span>
      </div>

      <div>
        <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600 }}>${creditBalance.toFixed(2)}</div>
        <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>Credit balance</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-2)', fontSize: 'var(--crm-text-xs)' }}>
        <div>
          <div style={{ color: 'var(--crm-text-tertiary)' }}>Member since</div>
          <div>{memberSince ?? '—'}</div>
        </div>
        <div>
          <div style={{ color: 'var(--crm-text-tertiary)' }}>Next renewal</div>
          <div>{nextRenewal ?? '—'}</div>
        </div>
      </div>

      {config.lensRefresh && (
        <div style={{ fontSize: 'var(--crm-text-xs)' }}>
          <span style={{ color: 'var(--crm-text-tertiary)' }}>Lens refresh: </span>
          {lastLensRefresh ? `Used ${lastLensRefresh}` : <span style={{ color: 'var(--crm-success)' }}>Available</span>}
        </div>
      )}
      {config.frameRotation && (
        <div style={{ fontSize: 'var(--crm-text-xs)' }}>
          <span style={{ color: 'var(--crm-text-tertiary)' }}>Frame rotation: </span>
          {lastRotation ? `Used ${lastRotation}` : <span style={{ color: 'var(--crm-success)' }}>{config.frameRotation}</span>}
        </div>
      )}

      {/* Staff controls */}
      {customerId && (
        <div style={{ borderTop: '1px solid var(--crm-border)', paddingTop: 'var(--crm-space-3)', marginTop: 'var(--crm-space-2)' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(['essential', 'cult', 'vault'] as const).filter(t => t !== tier).map(t => (
              <button key={t} onClick={() => changeTier(t)} disabled={changing}
                className="crm-btn" style={{ fontSize: 10, padding: '2px 8px', opacity: changing ? 0.5 : 1 }}>
                → {TIERS[t].label}
              </button>
            ))}
            {status === 'active' && (
              <button onClick={() => changeStatus('cancel')} disabled={changing}
                className="crm-btn" style={{ fontSize: 10, padding: '2px 8px', color: 'var(--crm-error)', opacity: changing ? 0.5 : 1 }}>
                Cancel
              </button>
            )}
            {(status === 'cancelled' || status === 'paused') && (
              <button onClick={() => changeStatus('reactivate')} disabled={changing}
                className="crm-btn" style={{ fontSize: 10, padding: '2px 8px', opacity: changing ? 0.5 : 1 }}>
                Reactivate
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
