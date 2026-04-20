'use client';

import { useState } from 'react';
import Link from 'next/link';

const TIER_ORDER = ['essential', 'cult', 'vault'] as const;
const TIER_LABELS: Record<string, string> = { essential: 'Essential', cult: 'CULT', vault: 'VAULT' };
const TIER_PRICES: Record<string, string> = { essential: '$12/mo', cult: '$25/mo', vault: '$45/mo' };

export function MembershipControls({ status: initialStatus, tier: initialTier }: { status: string; tier: string }) {
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const [currentTier, setCurrentTier] = useState(initialTier);
  const [loading, setLoading] = useState(false);
  const [showTierPicker, setShowTierPicker] = useState(false);

  async function act(action: string, newTier?: string) {
    if (action === 'cancel' && !confirm('Cancel your membership? You\'ll keep benefits for 60 days.')) return;
    if (action === 'change' && newTier && !confirm(`Switch to ${TIER_LABELS[newTier]}? Your benefits will change immediately.`)) return;
    setLoading(true);
    const res = await fetch('/api/account/membership/manage', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, newTier }),
    });
    if (res.ok) {
      const d = await res.json();
      if (d.data.status) setCurrentStatus(d.data.status);
      if (d.data.tier) { setCurrentTier(d.data.tier); setShowTierPicker(false); }
    }
    setLoading(false);
  }

  const currentIdx = TIER_ORDER.indexOf(currentTier as typeof TIER_ORDER[number]);

  return (
    <div className="border border-gray-200 rounded-lg p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium">Manage Membership</span>
        <span className="text-xs text-gray-400">
          {currentStatus === 'paused' ? '⏸ Paused' : currentStatus === 'cancelled' ? '✕ Cancelled' : '● Active'}
        </span>
      </div>

      {/* Tier change */}
      {currentStatus === 'active' && !showTierPicker && (
        <button onClick={() => setShowTierPicker(true)} className="w-full mb-3 py-2.5 text-sm border border-gray-200 rounded-lg hover:border-black transition-colors">
          Change plan ({TIER_LABELS[currentTier]} {TIER_PRICES[currentTier]})
        </button>
      )}

      {showTierPicker && (
        <div className="mb-4 space-y-2">
          <p className="text-xs text-gray-400 mb-2">Select a new plan:</p>
          {TIER_ORDER.map((t, idx) => {
            if (t === currentTier) return (
              <div key={t} className="w-full flex items-center justify-between py-3 px-4 text-sm rounded-lg border border-black bg-black text-white">
                <span><span className="font-medium">{TIER_LABELS[t]}</span><span className="opacity-75 ml-2">{TIER_PRICES[t]}</span></span>
                <span className="text-xs">Current</span>
              </div>
            );
            return (
              <a key={t} href="/pages/membership" className="w-full flex items-center justify-between py-3 px-4 text-sm rounded-lg border border-gray-200 hover:border-black transition-colors">
                <span><span className="font-medium">{TIER_LABELS[t]}</span><span className="text-gray-400 ml-2">{TIER_PRICES[t]}</span></span>
                <span className={`text-xs ${idx > currentIdx ? 'text-green-600' : 'text-gray-400'}`}>{idx > currentIdx ? 'Upgrade →' : 'Switch →'}</span>
              </a>
            );
          })}
          <button onClick={() => setShowTierPicker(false)} className="text-xs text-gray-400 hover:text-black">Cancel</button>
        </div>
      )}

      {/* Status actions */}
      <div className="flex gap-3">
        {currentStatus === 'active' && (
          <>
            <button onClick={() => act('pause')} disabled={loading} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:border-black transition-colors disabled:opacity-50">
              Pause
            </button>
            <button onClick={() => act('cancel')} disabled={loading} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-red-600 hover:border-red-600 transition-colors disabled:opacity-50">
              Cancel
            </button>
          </>
        )}
        {currentStatus === 'paused' && (
          <button onClick={() => act('reactivate')} disabled={loading} className="flex-1 py-2.5 text-sm bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
            Reactivate
          </button>
        )}
        {currentStatus === 'cancelled' && (
          <>
            <div className="flex-1 text-sm text-gray-500">Benefits remain during the 60-day grace period.</div>
            <button onClick={() => act('reactivate')} disabled={loading} className="py-2 px-4 text-sm border border-black rounded-lg hover:bg-black hover:text-white transition-colors disabled:opacity-50">
              Rejoin
            </button>
          </>
        )}
      </div>
    </div>
  );
}
