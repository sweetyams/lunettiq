'use client';

import { useState } from 'react';

interface Interaction {
  id: string;
  type: string;
  direction: string;
  subject: string | null;
  body: string | null;
  staffId: string | null;
  occurredAt: string | Date | null;
}

const TYPE_LABELS: Record<string, string> = {
  note: '📝 Note',
  phone_call: '📞 Call',
  email: '📧 Email',
  sms: '💬 SMS',
  in_store_visit: '🏪 Visit',
  fitting: '👓 Fitting',
  purchase_assist: '🛍 Purchase',
  follow_up: '🔄 Follow-up',
  complaint: '⚠️ Complaint',
  product_recommendation: '✨ Recommendation',
  preferences_updated: '⚙️ Preferences',
};

export function InteractionTimeline({
  interactions,
  customerId,
}: {
  interactions: Interaction[];
  customerId: string;
}) {
  const [filter, setFilter] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const filtered = filter ? interactions.filter((i) => i.type === filter) : interactions;
  const types = Array.from(new Set(interactions.map((i) => i.type)));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Timeline</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-sm bg-neutral-900 text-white rounded hover:bg-neutral-800"
        >
          + Add Interaction
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        <button
          onClick={() => setFilter(null)}
          className={`px-2.5 py-1 rounded text-xs ${!filter ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
        >
          All
        </button>
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-2.5 py-1 rounded text-xs ${filter === t ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
          >
            {TYPE_LABELS[t] ?? t}
          </button>
        ))}
      </div>

      {/* Add interaction form */}
      {showForm && <AddInteractionForm customerId={customerId} onDone={() => setShowForm(false)} />}

      {/* Timeline entries */}
      <div className="space-y-3">
        {filtered.map((i) => (
          <div key={i.id} className="bg-white border border-neutral-200 rounded p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">{TYPE_LABELS[i.type] ?? i.type}</span>
              <span className="text-xs text-neutral-400">
                {i.occurredAt ? new Date(i.occurredAt).toLocaleString() : ''}
              </span>
            </div>
            {i.subject && <div className="text-sm font-medium">{i.subject}</div>}
            {i.body && <div className="text-sm text-neutral-600 mt-1">{i.body}</div>}
          </div>
        ))}
        {!filtered.length && (
          <p className="text-sm text-neutral-400 text-center py-8">No interactions yet</p>
        )}
      </div>
    </div>
  );
}

function AddInteractionForm({ customerId, onDone }: { customerId: string; onDone: () => void }) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);

    await fetch('/api/crm/interactions', { credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        type: form.get('type'),
        direction: form.get('direction'),
        subject: form.get('subject'),
        body: form.get('body'),
      }),
    });

    setSaving(false);
    onDone();
    window.location.reload();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded p-4 mb-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <select name="type" required className="px-3 py-2 border border-neutral-200 rounded text-sm">
          <option value="note">Note</option>
          <option value="phone_call">Phone Call</option>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
          <option value="in_store_visit">In-Store Visit</option>
          <option value="fitting">Fitting</option>
          <option value="follow_up">Follow-up</option>
          <option value="complaint">Complaint</option>
        </select>
        <select name="direction" className="px-3 py-2 border border-neutral-200 rounded text-sm">
          <option value="internal">Internal</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
      </div>
      <input name="subject" placeholder="Subject (optional)" className="w-full px-3 py-2 border border-neutral-200 rounded text-sm" />
      <textarea name="body" placeholder="Details…" rows={3} className="w-full px-3 py-2 border border-neutral-200 rounded text-sm" />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onDone} className="px-3 py-1.5 text-sm border rounded hover:bg-neutral-50">Cancel</button>
        <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
