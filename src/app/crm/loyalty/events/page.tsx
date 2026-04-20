'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Event { id: string; title: string; location: string | null; startsAt: string; status: string; capacity: number | null; tierMinimum: string; inviteCounts: Record<string, number> }

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', location: '', startsAt: '', capacity: '', tierMinimum: 'vault' });
  const [saving, setSaving] = useState(false);

  const load = () => fetch('/api/crm/events', { credentials: 'include' }).then(r => r.json()).then(d => setEvents(d.data ?? []));
  useEffect(() => { load(); }, []);

  async function handleCreate() {
    setSaving(true);
    await fetch('/api/crm/events', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, capacity: form.capacity ? Number(form.capacity) : null }) });
    setSaving(false); setCreating(false); setForm({ title: '', location: '', startsAt: '', capacity: '', tierMinimum: 'vault' }); load();
  }

  const statusColor: Record<string, string> = { draft: 'var(--crm-text-tertiary)', published: 'var(--crm-success)', cancelled: 'var(--crm-error)', completed: 'var(--crm-text-secondary)' };

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-5)' }}>
        <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Events</h1>
        <button onClick={() => setCreating(true)} className="crm-btn crm-btn-primary">+ New Event</button>
      </div>

      {creating && (
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-4)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-3)' }}>
            <div><div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 4 }}>Title</div><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="crm-input" style={{ width: '100%' }} /></div>
            <div><div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 4 }}>Location</div><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="crm-input" style={{ width: '100%' }} /></div>
            <div><div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 4 }}>Date</div><input type="datetime-local" value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} className="crm-input" style={{ width: '100%' }} /></div>
            <div><div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 4 }}>Capacity</div><input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className="crm-input" style={{ width: '100%' }} placeholder="Optional" /></div>
            <div><div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 4 }}>Min Tier</div>
              <select value={form.tierMinimum} onChange={e => setForm({ ...form, tierMinimum: e.target.value })} className="crm-input" style={{ width: '100%' }}>
                <option value="vault">VAULT only</option><option value="cult">CULT+</option><option value="essential">All members</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--crm-space-2)', justifyContent: 'flex-end', marginTop: 'var(--crm-space-3)' }}>
            <button onClick={() => setCreating(false)} className="crm-btn crm-btn-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !form.title || !form.startsAt} className="crm-btn crm-btn-primary">{saving ? 'Creating…' : 'Create'}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3)' }}>
        {events.map(e => {
          const total = Object.values(e.inviteCounts).reduce((a, b) => a + b, 0);
          const accepted = e.inviteCounts.accepted ?? 0;
          return (
            <Link key={e.id} href={`/crm/loyalty/events/${e.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="crm-card" style={{ padding: 'var(--crm-space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{e.title}</div>
                  <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
                    {e.location} · {new Date(e.startsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    {e.tierMinimum !== 'vault' && ` · ${e.tierMinimum}+`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--crm-space-3)', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right', fontSize: 'var(--crm-text-xs)' }}>
                    <div>{accepted}/{total} accepted</div>
                    {e.capacity && <div style={{ color: 'var(--crm-text-tertiary)' }}>cap: {e.capacity}</div>}
                  </div>
                  <span style={{ color: statusColor[e.status] ?? 'inherit', fontWeight: 500, fontSize: 'var(--crm-text-xs)', textTransform: 'uppercase' }}>{e.status}</span>
                </div>
              </div>
            </Link>
          );
        })}
        {!events.length && <div style={{ textAlign: 'center', padding: 'var(--crm-space-6)', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>No events yet</div>}
      </div>
    </div>
  );
}
