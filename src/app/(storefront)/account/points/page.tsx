'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function PointsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/account/points', { credentials: 'include' }).then(r => r.json()).then(d => setData(d.data)).catch(() => {});
  }, []);

  if (!data) return <div className="site-container py-12"><p className="text-sm text-gray-400">Loading…</p></div>;

  const { balance, history, nextExpiry } = data;
  const dollars = Math.floor(balance / 100) * 5;

  return (
    <div className="site-container py-12">
      <Link href="/account" className="text-sm text-gray-400 hover:text-black">← My Account</Link>
      <h1 className="text-2xl font-medium mt-4 mb-8">My Points</h1>

      <div className="border border-gray-200 rounded-lg p-6 mb-6">
        <div className="text-4xl font-semibold">{balance.toLocaleString()}</div>
        <div className="text-sm text-gray-500 mt-1">points · worth ${dollars}</div>
        {nextExpiry && (
          <div className="text-xs text-amber-600 mt-3">
            ⚠ {nextExpiry.points} points expire {new Date(nextExpiry.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        )}
      </div>

      <div className="border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-medium mb-3">How to earn</h2>
        <div className="space-y-2 text-sm">
          {[
            ['Every $1 spent', '1 pt'], ['First purchase', '500 pts'], ['Account creation', '200 pts'],
            ['Birthday', '200 pts'], ['Photo review', '100 pts'], ['Refer a friend', '2,500 pts'],
          ].map(([action, pts]) => (
            <div key={action} className="flex justify-between"><span className="text-gray-600">{action}</span><span className="font-medium">{pts}</span></div>
          ))}
        </div>
      </div>

      {history.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-sm font-medium mb-3">History</h2>
          <div className="space-y-2">
            {history.map((h: any) => (
              <div key={h.id} className="flex justify-between items-center text-sm py-1 border-b border-gray-50 last:border-0">
                <div>
                  <div>{h.reason || h.transactionType.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-gray-400">{h.occurredAt ? new Date(h.occurredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</div>
                </div>
                <span className={Number(h.amount) >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                  {Number(h.amount) >= 0 ? '+' : ''}{h.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {balance >= 4000 && (
        <div className="border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-sm font-medium mb-3">Convert to membership</h2>
          <div className="space-y-2">
            {[
              { id: 'cult_1mo', pts: 4000, label: '1 month CULT', value: '$39' },
              { id: 'essential_3mo', pts: 8000, label: '3 months Essential', value: '$57' },
              { id: 'essential_1yr', pts: 20000, label: '1 year Essential', value: '$199' },
              { id: 'cult_1yr', pts: 40000, label: '1 year CULT', value: '$399' },
            ].filter(c => balance >= c.pts).map(c => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div><span className="text-sm font-medium">{c.label}</span><span className="text-xs text-gray-400 ml-2">{c.pts.toLocaleString()} pts → {c.value} value</span></div>
                <button onClick={async () => {
                  if (!confirm(`Convert ${c.pts.toLocaleString()} points to ${c.label}?`)) return;
                  const res = await fetch('/api/account/points/convert', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversionId: c.id }) });
                  if (res.ok) { setData((d: any) => d ? { ...d, balance: d.balance - c.pts } : d); alert(`Converted to ${c.label}!`); }
                  else { const e = await res.json().catch(() => ({})); alert(e.error || 'Failed'); }
                }} className="text-sm border border-black px-3 py-1 rounded hover:bg-black hover:text-white transition-colors">Convert</button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
