'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function NewIntakePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams.get('client') ?? '';
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);

    const res = await fetch('/api/crm/second-sight', { credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: form.get('customerId'),
        notes: form.get('notes'),
        currentFrames: form.get('currentFrames'),
      }),
    });

    if (res.ok) {
      router.push('/crm/second-sight');
    }
    setSaving(false);
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">New Second Sight Intake</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Client ID</label>
          <input name="customerId" defaultValue={clientId} required className="w-full px-3 py-2 border border-neutral-200 rounded text-sm" placeholder="Shopify customer ID" />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Current Frames Description</label>
          <textarea name="currentFrames" rows={3} className="w-full px-3 py-2 border border-neutral-200 rounded text-sm" placeholder="Describe the frames being traded in…" />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
          <textarea name="notes" rows={3} className="w-full px-3 py-2 border border-neutral-200 rounded text-sm" placeholder="Condition, brand, any relevant details…" />
        </div>

        <div className="text-sm text-neutral-500 bg-neutral-50 border border-neutral-200 rounded p-3">
          📷 Photo upload will be available when file storage (R2) is configured.
        </div>

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm border rounded hover:bg-neutral-50">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:opacity-50">
            {saving ? 'Saving…' : 'Create Intake'}
          </button>
        </div>
      </form>
    </div>
  );
}
