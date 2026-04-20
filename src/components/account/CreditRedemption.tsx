'use client';

import { useState, useEffect } from 'react';

interface CreditCode {
  id: string; method: string; code: string; fullCode?: string | null; amount: string; status: string; createdAt: string;
}

export default function CreditRedemption() {
  const [balance, setBalance] = useState(0);
  const [codes, setCodes] = useState<CreditCode[]>([]);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  function load() {
    fetch('/api/account/credits/redeem', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setBalance(d.data?.balance ?? 0); setCodes(d.data?.activeCodes ?? []); })
      .catch(() => {});
  }

  useEffect(() => { load(); }, []);

  async function redeem(method: 'gift_card' | 'square_discount') {
    const amt = Number(amount);
    if (!amt || amt <= 0 || amt > balance) return;
    setLoading(true);
    const res = await fetch('/api/account/credits/redeem', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amt, method }),
    });
    if (res.ok) {
      const d = await res.json();
      // Store gift card code in localStorage for cart display
      if (d.data?.method === 'gift_card' && d.data?.fullCode) {
        const existing = JSON.parse(localStorage.getItem('lunettiq_gift_cards') ?? '[]');
        existing.push({ code: d.data.fullCode, amount: d.data.amount, last4: d.data.code });
        localStorage.setItem('lunettiq_gift_cards', JSON.stringify(existing));
      }
      load();
      setAmount('');
    }
    setLoading(false);
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6 mb-6">
      <h2 className="text-sm font-medium mb-1">Credits</h2>
      <p className="text-2xl font-semibold mb-1">${balance.toFixed(2)}</p>
      <p className="text-xs text-gray-400 mb-4">Available to use online or in-store</p>

      {/* Active codes */}
      {codes.length > 0 && (
        <div className="space-y-2 mb-4">
          {codes.map(c => (
            <div key={c.id} className={`rounded-lg p-4 ${c.method === 'gift_card' ? 'bg-gradient-to-r from-gray-900 to-gray-700 text-white' : 'bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className={`text-xs ${c.method === 'gift_card' ? 'text-gray-300' : 'text-amber-600'}`}>
                    {c.method === 'gift_card' ? '🛍️ Online Gift Card' : '🏪 In-Store Code'}
                  </p>
                  <p className={`text-lg font-mono font-bold mt-1 select-all cursor-pointer ${c.method === 'gift_card' ? 'text-white' : 'text-amber-900'}`}
                    onClick={() => navigator.clipboard?.writeText(c.fullCode ?? c.code)}>
                    {c.fullCode ?? c.code}
                  </p>
                </div>
                <p className={`text-lg font-semibold ${c.method === 'gift_card' ? 'text-white' : 'text-amber-900'}`}>
                  ${Number(c.amount).toFixed(2)}
                </p>
              </div>
              <p className={`text-xs mt-2 ${c.method === 'gift_card' ? 'text-gray-400' : 'text-amber-600'}`}>
                {c.method === 'gift_card' ? 'Paste in "Gift card" field at checkout · Click to copy' : 'Show to staff at register'}
                {' · '}{new Date(c.createdAt).toLocaleDateString('en-CA')}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Redeem form */}
      {balance > 0 && (
        <>
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
              <input
                type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder={balance.toFixed(0)} max={balance} min={1} step="1"
                className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:border-black"
              />
            </div>
            <button onClick={() => setAmount(String(Math.floor(balance)))} className="text-xs text-gray-400 hover:text-black px-2">All</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => redeem('gift_card')} disabled={loading || !amount || Number(amount) <= 0}
              className="py-2.5 text-sm border border-gray-200 rounded-lg hover:border-black transition-colors disabled:opacity-50">
              🛍️ Use Online
            </button>
            <button onClick={() => redeem('square_discount')} disabled={loading || !amount || Number(amount) <= 0}
              className="py-2.5 text-sm border border-gray-200 rounded-lg hover:border-black transition-colors disabled:opacity-50">
              🏪 Use In-Store
            </button>
          </div>
        </>
      )}
    </div>
  );
}
