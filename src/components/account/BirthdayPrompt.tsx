'use client';

import { useState } from 'react';

export default function BirthdayPrompt({ currentBirthday, tier }: { currentBirthday?: string | null; tier?: string | null }) {
  const [birthday, setBirthday] = useState(currentBirthday ?? '');
  const [saved, setSaved] = useState(!!currentBirthday);
  const [saving, setSaving] = useState(false);

  if (!tier) return null; // only show for members

  async function save() {
    if (!birthday) return;
    setSaving(true);
    const res = await fetch('/api/account/birthday', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ birthday }),
    });
    if (res.ok) setSaved(true);
    setSaving(false);
  }

  const creditAmount = tier === 'vault' ? 50 : 25;

  if (saved) {
    const date = new Date(birthday + 'T00:00:00');
    return (
      <div className="border border-gray-200 rounded-lg p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm">🎂 Birthday: {date.toLocaleDateString('en-CA', { month: 'long', day: 'numeric' })}</p>
          <p className="text-xs text-gray-400">${creditAmount} credit applied automatically on your birthday</p>
        </div>
        <button onClick={() => setSaved(false)} className="text-xs text-gray-400 hover:text-black">Edit</button>
      </div>
    );
  }

  return (
    <div className="border border-amber-200 bg-amber-50 rounded-lg p-5 mb-6">
      <p className="text-sm font-medium mb-1">🎂 Add your birthday</p>
      <p className="text-xs text-amber-700 mb-3">Get ${creditAmount} in store credit on your birthday — applied at midnight automatically.</p>
      <div className="flex gap-2">
        <input
          type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
          className="border border-amber-200 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:border-black"
        />
        <button onClick={save} disabled={saving || !birthday}
          className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
          {saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
