'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ReferralsPage() {
  const [data, setData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/account/referrals', { credentials: 'include' }).then(r => r.json()).then(d => setData(d.data)).catch(() => {});
  }, []);

  if (!data) return <div className="site-container py-12"><p className="text-sm text-gray-400">Loading…</p></div>;

  function copy() {
    navigator.clipboard.writeText(data.referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="site-container py-12">
      <Link href="/account" className="text-sm text-gray-400 hover:text-black">← My Account</Link>
      <h1 className="text-2xl font-medium mt-4 mb-2">Refer a Friend</h1>
      <p className="text-sm text-gray-500 mb-8">Share Lunettiq with someone whose taste you respect.</p>

      <div className="border border-gray-200 rounded-lg p-6 mb-6">
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Your referral link</div>
        <div className="flex gap-2">
          <input readOnly value={data.referralUrl} className="flex-1 px-3 py-2 border border-gray-200 rounded text-sm bg-gray-50" />
          <button onClick={copy} className="px-4 py-2 bg-black text-white text-sm rounded hover:bg-gray-800">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <a href={`https://wa.me/?text=${encodeURIComponent(`Check out Lunettiq — premium eyewear. Use my link for $25 off: ${data.referralUrl}`)}`} target="_blank" rel="noopener noreferrer"
            className="flex-1 py-2 text-center text-sm border border-gray-200 rounded-lg hover:border-green-500 hover:text-green-600 transition-colors">WhatsApp</a>
          <a href={`mailto:?subject=${encodeURIComponent('Lunettiq — eyewear you\'ll love')}&body=${encodeURIComponent(`I thought you'd love Lunettiq. Use my link for $25 off your first order:\n\n${data.referralUrl}`)}`}
            className="flex-1 py-2 text-center text-sm border border-gray-200 rounded-lg hover:border-black transition-colors">Email</a>
          <button onClick={() => { navigator.clipboard.writeText(`Check out @lunettiq — premium eyewear. $25 off with my link: ${data.referralUrl}`); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex-1 py-2 text-center text-sm border border-gray-200 rounded-lg hover:border-pink-500 hover:text-pink-600 transition-colors">Instagram</button>
          <a href={`sms:?body=${encodeURIComponent(`Check out Lunettiq! $25 off with my link: ${data.referralUrl}`)}`}
            className="flex-1 py-2 text-center text-sm border border-gray-200 rounded-lg hover:border-blue-500 hover:text-blue-600 transition-colors">SMS</a>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-semibold">{data.pending}</div>
          <div className="text-xs text-gray-500 mt-1">Pending</div>
        </div>
        <div className="border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-semibold">{data.qualified}</div>
          <div className="text-xs text-gray-500 mt-1">Qualified</div>
        </div>
        <div className="border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-semibold">${data.totalEarned}</div>
          <div className="text-xs text-gray-500 mt-1">Earned</div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-medium mb-3">How it works</h2>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex gap-3"><span className="font-semibold text-black">1.</span> Share your link with friends</div>
          <div className="flex gap-3"><span className="font-semibold text-black">2.</span> They get $25 off their first order</div>
          <div className="flex gap-3"><span className="font-semibold text-black">3.</span> When they spend $100+, you earn 2,500 points ($125)</div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-6">
        <h2 className="text-sm font-medium mb-3">Milestones</h2>
        <div className="space-y-2 text-sm">
          {[
            [3, 'Tier upgrade for 3 months', data.qualified >= 3],
            [5, 'Free custom engraving', data.qualified >= 5],
            [10, 'VAULT event invite', data.qualified >= 10],
          ].map(([n, reward, done]) => (
            <div key={String(n)} className="flex justify-between items-center">
              <span className={done ? 'text-green-600' : 'text-gray-500'}>{done ? '✓' : '○'} {n} referrals — {reward}</span>
              <span className="text-xs text-gray-400">{data.qualified}/{n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
