'use client';

import { useState } from 'react';

interface Props {
  productId: string;
  variantTitle: string | null;
}

export default function StockNotification({ productId, variantTitle }: Props) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setError('');
    try {
      const { fireKlaviyoEvent } = await import('@/lib/klaviyo/events');
      await fetch('/api/stock-notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, productId, variantTitle }),
      });
      setSubmitted(true);
    } catch { setError('Something went wrong'); }
  }

  if (submitted) return (
    <div className="mt-3 p-3 bg-green-50 rounded text-sm text-green-700">
      We'll email you at {email} when this is back in stock.
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="mt-3">
      <p className="text-sm text-gray-500 mb-2">Get notified when this is back in stock</p>
      <div className="flex gap-2">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
          placeholder="your@email.com" className="flex-1 px-3 py-2 border border-gray-200 rounded text-sm" />
        <button type="submit" className="px-4 py-2 bg-black text-white text-sm rounded hover:bg-gray-800">Notify Me</button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </form>
  );
}
