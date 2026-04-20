'use client';

import { useState } from 'react';
import Link from 'next/link';

const GIFT_TIERS = [
  { id: 'essential', label: 'Essential', price: 199, duration: 12 },
  { id: 'cult', label: 'CULT', price: 399, duration: 12 },
  { id: 'vault', label: 'VAULT', price: 799, duration: 12 },
];

export default function GiftMembershipPage() {
  const [mode, setMode] = useState<'buy' | 'redeem'>('buy');
  const [tier, setTier] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const [result, setResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handlePurchase() {
    if (!tier || !email) return;
    setSaving(true); setError('');
    const res = await fetch('/api/account/gift-membership', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier, recipientEmail: email, message: message || undefined }) });
    if (res.ok) { const d = await res.json(); setResult({ type: 'purchased', code: d.data.code, tier }); }
    else { const e = await res.json().catch(() => ({})); setError(e.error || 'Failed'); }
    setSaving(false);
  }

  async function handleRedeem() {
    if (!code) return;
    setSaving(true); setError('');
    const res = await fetch('/api/account/gift-membership/redeem', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    if (res.ok) { const d = await res.json(); setResult({ type: 'redeemed', tier: d.data.tier, months: d.data.durationMonths }); }
    else { const e = await res.json().catch(() => ({})); setError(e.error || 'Invalid code'); }
    setSaving(false);
  }

  if (result) return (
    <div className="site-container py-16 text-center">
      {result.type === 'purchased' ? (
        <>
          <div className="text-4xl mb-4">🎁</div>
          <h1 className="text-2xl font-medium mb-2">Gift Sent!</h1>
          <p className="text-gray-500 mb-4">A {result.tier.toUpperCase()} membership gift has been emailed to {email}.</p>
          <div className="border border-gray-200 rounded-lg p-4 inline-block"><span className="font-mono text-lg tracking-wider">{result.code}</span></div>
          <p className="text-xs text-gray-400 mt-2">Gift code (also sent by email)</p>
        </>
      ) : (
        <>
          <div className="text-4xl mb-4">✨</div>
          <h1 className="text-2xl font-medium mb-2">Welcome to {result.tier.toUpperCase()}!</h1>
          <p className="text-gray-500 mb-4">Your {result.months}-month membership is now active.</p>
          <Link href="/account/loyalty" className="text-sm underline">View your membership →</Link>
        </>
      )}
    </div>
  );

  return (
    <div className="site-container py-12">
      <h1 className="text-2xl font-medium mb-2">Gift a Membership</h1>
      <p className="text-sm text-gray-500 mb-8">Give someone a year of Lunettiq membership.</p>

      <div className="flex gap-2 mb-8">
        <button onClick={() => setMode('buy')} className={`flex-1 py-2 text-sm rounded-lg border ${mode === 'buy' ? 'border-black bg-black text-white' : 'border-gray-200'}`}>Send a Gift</button>
        <button onClick={() => setMode('redeem')} className={`flex-1 py-2 text-sm rounded-lg border ${mode === 'redeem' ? 'border-black bg-black text-white' : 'border-gray-200'}`}>Redeem a Code</button>
      </div>

      {mode === 'buy' ? (
        <div className="space-y-4">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Choose a tier</div>
            <div className="grid grid-cols-3 gap-3">
              {GIFT_TIERS.map(t => (
                <button key={t.id} onClick={() => setTier(t.id)} className={`border rounded-lg p-4 text-center ${tier === t.id ? 'border-black' : 'border-gray-200'}`}>
                  <div className="text-sm font-semibold">{t.label}</div>
                  <div className="text-lg font-semibold mt-1">${t.price}</div>
                  <div className="text-xs text-gray-400">{t.duration} months</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Recipient email</div>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="friend@example.com" className="w-full px-3 py-2 border border-gray-200 rounded text-sm" />
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Personal message (optional)</div>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} placeholder="Happy birthday!" className="w-full px-3 py-2 border border-gray-200 rounded text-sm" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={handlePurchase} disabled={saving || !tier || !email} className="w-full py-3 bg-black text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50">
            {saving ? 'Sending…' : `Gift ${tier ? GIFT_TIERS.find(t => t.id === tier)?.label : ''} — $${GIFT_TIERS.find(t => t.id === tier)?.price ?? ''}`}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Gift code</div>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="XXXXXXXXXXXX" className="w-full px-3 py-2 border border-gray-200 rounded text-sm font-mono tracking-wider text-center text-lg" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={handleRedeem} disabled={saving || !code} className="w-full py-3 bg-black text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50">
            {saving ? 'Redeeming…' : 'Redeem Gift'}
          </button>
        </div>
      )}
    </div>
  );
}
