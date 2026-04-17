'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const LOCATIONS = [
  { id: 'loc_plateau', label: 'Plateau' },
  { id: 'loc_dix30', label: 'Dix30' },
];

export default function NewClientPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    birthday: '', pronouns: '', homeLocation: '', tags: '', note: '',
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName || !form.lastName) { setError('First and last name required'); return; }
    setSaving(true);
    setError('');

    const res = await fetch('/api/crm/clients', { credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        note: form.note || undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to create client');
      setSaving(false);
      return;
    }

    const { shopifyCustomerId } = await res.json();

    if (form.birthday || form.pronouns || form.homeLocation) {
      const metafields: Record<string, { value: string; type?: string }> = {};
      if (form.birthday) metafields.birthday = { value: form.birthday, type: 'date' };
      if (form.pronouns) metafields.pronouns = { value: form.pronouns };
      if (form.homeLocation) metafields.home_location = { value: form.homeLocation };

      await fetch(`/api/crm/clients/${shopifyCustomerId}`, { credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metafields }),
      });
    }

    router.push(`/crm/clients/${shopifyCustomerId}`);
  }

  const labelStyle = { fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)', marginBottom: 'var(--crm-space-1)', display: 'block' } as const;

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 720 }}>
      <Link href="/crm/clients" className="crm-btn crm-btn-ghost" style={{ marginBottom: 'var(--crm-space-2)', padding: 0 }}>
        ← Clients
      </Link>
      <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, marginBottom: 'var(--crm-space-6)' }}>
        New Client
      </h1>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-6">
          {/* Left column */}
          <div className="flex flex-col" style={{ gap: 'var(--crm-space-4)' }}>
            <div>
              <label style={labelStyle}>First Name *</label>
              <input value={form.firstName} onChange={e => set('firstName', e.target.value)} className="crm-input w-full" />
            </div>
            <div>
              <label style={labelStyle}>Last Name *</label>
              <input value={form.lastName} onChange={e => set('lastName', e.target.value)} className="crm-input w-full" />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="crm-input w-full" />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} className="crm-input w-full" placeholder="+1..." />
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col" style={{ gap: 'var(--crm-space-4)' }}>
            <div>
              <label style={labelStyle}>Birthday</label>
              <input type="date" value={form.birthday} onChange={e => set('birthday', e.target.value)} className="crm-input w-full" />
            </div>
            <div>
              <label style={labelStyle}>Pronouns</label>
              <select value={form.pronouns} onChange={e => set('pronouns', e.target.value)} className="crm-input w-full">
                <option value="">—</option>
                <option value="he/him">he/him</option>
                <option value="she/her">she/her</option>
                <option value="they/them">they/them</option>
                <option value="other">other</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Home Location</label>
              <select value={form.homeLocation} onChange={e => set('homeLocation', e.target.value)} className="crm-input w-full">
                <option value="">—</option>
                {LOCATIONS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Tags (comma-separated)</label>
              <input value={form.tags} onChange={e => set('tags', e.target.value)} className="crm-input w-full" placeholder="vip, wholesale" />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea value={form.note} onChange={e => set('note', e.target.value)} rows={3} className="crm-input w-full" style={{ resize: 'vertical' }} />
            </div>
          </div>
        </div>

        {error && <p style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-error)', marginTop: 'var(--crm-space-4)' }}>{error}</p>}

        <div className="flex gap-3" style={{ marginTop: 'var(--crm-space-6)' }}>
          <button type="submit" disabled={saving} className="crm-btn crm-btn-primary" style={{ opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Creating…' : 'Create Client'}
          </button>
          <Link href="/crm/clients" className="crm-btn crm-btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
