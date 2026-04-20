'use client';

import { useState } from 'react';

interface ProfileData {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}

export default function ProfileEditor({ initial, loyaltyBadge }: { initial: ProfileData; loyaltyBadge?: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(initial);

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/account/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      setEditing(false);
    } catch {}
    setSaving(false);
  }

  const set = (k: keyof ProfileData, v: string) => setData(prev => ({ ...prev, [k]: v }));

  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-400 uppercase tracking-wider">Profile</span>
        <button
          onClick={() => editing ? save() : setEditing(true)}
          disabled={saving}
          className="text-xs text-gray-400 hover:text-black transition-colors"
        >
          {saving ? 'Saving…' : editing ? 'Save' : 'Edit'}
        </button>
      </div>

      {editing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">First name</label>
            <input value={data.firstName ?? ''} onChange={e => set('firstName', e.target.value)}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-black" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Last name</label>
            <input value={data.lastName ?? ''} onChange={e => set('lastName', e.target.value)}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-black" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Email</label>
            <input type="email" value={data.email ?? ''} onChange={e => set('email', e.target.value)}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-black" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Phone</label>
            <input type="tel" value={data.phone ?? ''} onChange={e => set('phone', e.target.value)}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-black" />
          </div>
          <button onClick={() => { setData(initial); setEditing(false); }} className="text-xs text-gray-400 hover:text-black">Cancel</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Name</p>
              <p className="text-sm">{data.firstName} {data.lastName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Email</p>
              <p className="text-sm">{data.email || <span className="text-gray-300">Not set</span>}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Phone</p>
              <p className="text-sm">{data.phone || <span className="text-gray-300">Not set</span>}</p>
            </div>
          </div>
          {loyaltyBadge}
        </>
      )}
    </div>
  );
}
