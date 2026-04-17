'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function NewAppointmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams.get('client') ?? '';
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);

    const res = await fetch('/api/crm/appointments', { credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: form.get('customerId') || null,
        title: form.get('title'),
        startsAt: form.get('startsAt'),
        endsAt: form.get('endsAt'),
        notes: form.get('notes'),
      }),
    });

    if (res.ok) router.push('/crm/appointments');
    setSaving(false);
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">New Appointment</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Title</label>
          <input name="title" required className="w-full px-3 py-2 border border-neutral-200 rounded text-sm" placeholder="e.g. Fitting, Consultation" />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Client ID (optional)</label>
          <input name="customerId" defaultValue={clientId} className="w-full px-3 py-2 border border-neutral-200 rounded text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Start</label>
            <input name="startsAt" type="datetime-local" required className="w-full px-3 py-2 border border-neutral-200 rounded text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">End</label>
            <input name="endsAt" type="datetime-local" required className="w-full px-3 py-2 border border-neutral-200 rounded text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
          <textarea name="notes" rows={3} className="w-full px-3 py-2 border border-neutral-200 rounded text-sm" />
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm border rounded hover:bg-neutral-50">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:opacity-50">
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
