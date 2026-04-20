'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ClientPicker } from '@/components/crm/ClientPicker';

interface Invite { id: string; shopifyCustomerId: string; status: string; name: string; email: string | null; respondedAt: string | null }
interface Event { id: string; title: string; description: string | null; location: string | null; startsAt: string; endsAt: string | null; capacity: number | null; tierMinimum: string; status: string }

export default function EventDetailPage({ params }: { params: { id: string } }) {
  const [event, setEvent] = useState<Event | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const load = () => fetch(`/api/crm/events/${params.id}`, { credentials: 'include' }).then(r => r.json()).then(d => { setEvent(d.data?.event); setInvites(d.data?.invites ?? []); });
  useEffect(() => { load(); }, []);

  async function invite(customerIds: string[]) {
    await fetch(`/api/crm/events/${params.id}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerIds }) });
    load();
  }

  async function updateStatus(status: string) {
    setPublishing(true);
    await fetch(`/api/crm/events/${params.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    load(); setPublishing(false);
  }

  if (!event) return <div style={{ padding: 'var(--crm-space-6)' }}>Loading…</div>;

  const statusColor: Record<string, string> = { draft: 'var(--crm-text-tertiary)', published: 'var(--crm-success)', cancelled: 'var(--crm-error)', completed: 'var(--crm-text-secondary)' };
  const inviteStatusColor: Record<string, string> = { invited: 'var(--crm-text-tertiary)', accepted: 'var(--crm-success)', declined: 'var(--crm-error)', attended: 'var(--crm-success)', no_show: 'var(--crm-text-tertiary)' };
  const accepted = invites.filter(i => i.status === 'accepted' || i.status === 'attended').length;

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 800 }}>
      <Link href="/crm/loyalty/events" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>← Events</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: 'var(--crm-space-4) 0 var(--crm-space-5)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>{event.title}</h1>
          <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', marginTop: 4 }}>
            {event.location} · {new Date(event.startsAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            {event.endsAt && ` · ${new Date(event.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${new Date(event.endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--crm-space-2)', alignItems: 'center' }}>
          <span style={{ color: statusColor[event.status], fontWeight: 500, fontSize: 'var(--crm-text-xs)', textTransform: 'uppercase' }}>{event.status}</span>
          {event.status === 'draft' && <button onClick={() => updateStatus('published')} disabled={publishing} className="crm-btn crm-btn-primary">{publishing ? '…' : 'Publish'}</button>}
          {event.status === 'published' && <button onClick={() => updateStatus('completed')} className="crm-btn crm-btn-secondary">Complete</button>}
        </div>
      </div>

      {event.description && <div className="crm-card" style={{ padding: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-4)', fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)' }}>{event.description}</div>}

      <div style={{ display: 'flex', gap: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-4)' }}>
        {[
          { label: 'Invited', value: invites.length },
          { label: 'Accepted', value: accepted },
          { label: 'Capacity', value: event.capacity ?? '∞' },
          { label: 'Min Tier', value: event.tierMinimum.toUpperCase() },
        ].map(s => (
          <div key={s.label} className="crm-card" style={{ padding: 'var(--crm-space-3)', flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600 }}>{s.value}</div>
            <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
          <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>Guest List</h2>
          <button onClick={() => setPickerOpen(true)} className="crm-btn crm-btn-secondary" style={{ fontSize: 'var(--crm-text-xs)' }}>+ Invite</button>
        </div>
        {invites.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2)' }}>
            {invites.map(i => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--crm-border-light)' }}>
                <div>
                  <Link href={`/crm/clients/${i.shopifyCustomerId}`} style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>{i.name || i.shopifyCustomerId.slice(-8)}</Link>
                  {i.email && <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginLeft: 8 }}>{i.email}</span>}
                </div>
                <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, textTransform: 'uppercase', color: inviteStatusColor[i.status] }}>{i.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 'var(--crm-space-4)', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>No guests invited yet</div>
        )}
      </div>

      <ClientPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={c => { invite([c.id]); setPickerOpen(false); }} />
    </div>
  );
}
