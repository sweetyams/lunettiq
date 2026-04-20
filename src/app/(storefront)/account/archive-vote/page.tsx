'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const ARCHIVE_CANDIDATES = [
  { handle: 'st-laurent-noir', name: 'ST-LAURENT © NOIR', year: '2023', image: null },
  { handle: 'plateau-amber', name: 'PLATEAU © AMBER', year: '2022', image: null },
  { handle: 'mile-end-crystal', name: 'MILE END © CRYSTAL', year: '2023', image: null },
];

export default function ArchiveVotePage() {
  const [data, setData] = useState<{ year: number; myVote: string | null; results: { productHandle: string; count: number }[] } | null>(null);
  const [error, setError] = useState('');
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    fetch('/api/account/archive-vote', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(r.status === 403 ? 'VAULT members only' : 'Sign in required'); return r.json(); })
      .then(d => setData(d.data))
      .catch(e => setError(e.message));
  }, []);

  async function vote(handle: string) {
    setVoting(true);
    await fetch('/api/account/archive-vote', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productHandle: handle }) });
    setData(prev => prev ? { ...prev, myVote: handle } : prev);
    setVoting(false);
  }

  if (error) return (
    <div className="site-container py-16 text-center">
      <h1 className="text-2xl font-medium mb-4">Archive Vote</h1>
      <p className="text-gray-500">{error}</p>
      {error.includes('VAULT') && <p className="text-sm text-gray-400 mt-2">This is an exclusive VAULT member perk. <Link href="/pages/loyalty" className="underline">Learn about VAULT</Link></p>}
    </div>
  );

  if (!data) return <div className="site-container py-16 text-center text-gray-400">Loading…</div>;

  const totalVotes = data.results.reduce((a, b) => a + Number(b.count), 0);

  return (
    <div className="site-container py-12">
      <Link href="/account/loyalty" className="text-sm text-gray-400 hover:text-black">← Loyalty</Link>
      <h1 className="text-2xl font-medium mt-4 mb-2">Archive Vote {data.year}</h1>
      <p className="text-sm text-gray-500 mb-8">Choose one discontinued frame to bring back. The winner gets reissued.</p>

      <div className="space-y-4">
        {ARCHIVE_CANDIDATES.map(c => {
          const votes = data.results.find(r => r.productHandle === c.handle)?.count ?? 0;
          const pct = totalVotes > 0 ? Math.round((Number(votes) / totalVotes) * 100) : 0;
          const isMyVote = data.myVote === c.handle;
          return (
            <div key={c.handle} className={`border rounded-lg p-5 ${isMyVote ? 'border-black' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-gray-400">Originally {c.year}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{pct}%</div>
                  <div className="text-xs text-gray-400">{votes} vote{Number(votes) !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-black rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              {!isMyVote && (
                <button onClick={() => vote(c.handle)} disabled={voting} className="mt-3 text-sm border border-black px-4 py-1.5 rounded hover:bg-black hover:text-white transition-colors disabled:opacity-50">
                  Vote for this
                </button>
              )}
              {isMyVote && <div className="mt-3 text-xs text-green-600 font-medium">✓ Your vote</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
