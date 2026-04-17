'use client';

import { useState, useEffect, useCallback } from 'react';
import { WeekCalendar, CalendarEvent } from '@/components/crm/WeekCalendar';
import { StaffPicker, StaffMember } from '@/components/crm/StaffPicker';
import { TimeSlotPicker } from '@/components/crm/TimeSlotPicker';
import { ClientPicker } from '@/components/crm/ClientPicker';
import { useToast } from '@/components/crm/CrmShell';
import Link from 'next/link';

type Panel =
  | null
  | { mode: 'view'; event: CalendarEvent }
  | { mode: 'create'; date: string; hour?: number };

export type Location = { id: string; name: string };

interface Props {
  initialEvents: CalendarEvent[];
  initialWeekStart: string;
  staff: StaffMember[];
  locations: Location[];
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

export function AppointmentsClient({ initialEvents, initialWeekStart, staff, locations }: Props) {
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(() => new Date(initialWeekStart));
  const [staffFilter, setStaffFilter] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [panel, setPanel] = useState<Panel>(null);

  const fetchEvents = useCallback(async (week: Date, sid: string | null) => {
    const p = new URLSearchParams({ week: week.toISOString() });
    if (sid) p.set('staffId', sid);
    const res = await fetch(`/api/crm/appointments?${p}`, { credentials: 'include' });
    if (res.ok) { const d = await res.json(); setEvents(d.data ?? []); }
  }, []);

  // Refetch on week/staff change (skip initial render)
  const [mounted, setMounted] = useState(false);
  useEffect(() => { if (mounted) fetchEvents(weekStart, staffFilter); else setMounted(true); }, [weekStart, staffFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleWeekChange(dir: 'prev' | 'next' | 'today') {
    setWeekStart(prev => {
      if (dir === 'today') return getMonday(new Date());
      const n = new Date(prev);
      n.setDate(n.getDate() + (dir === 'next' ? 7 : -7));
      return n;
    });
  }

  async function handleStatusChange(id: string, status: string) {
    const res = await fetch(`/api/crm/appointments/${id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { toast(`Marked as ${status}`); setPanel(null); fetchEvents(weekStart, staffFilter); }
    else { const e = await res.json().catch(() => ({})); toast(e.error || 'Failed', 'error'); }
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 44px - var(--crm-space-6) * 2)', gap: 'var(--crm-space-4)' }}>
      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--crm-space-4)' }}>
          <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, margin: 0 }}>Appointments</h1>
          <button onClick={() => setPanel({ mode: 'create', date: new Date().toISOString().slice(0, 10) })} className="crm-btn crm-btn-primary">+ New</button>
        </div>
        <div style={{ marginBottom: 'var(--crm-space-4)' }}>
          <StaffPicker staff={staff} value={staffFilter} onChange={setStaffFilter} />
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <WeekCalendar
            weekStart={weekStart}
            events={events}
            onEventClick={ev => setPanel({ mode: 'view', event: ev })}
            onSlotClick={(date, hour) => setPanel({ mode: 'create', date: date.toISOString().slice(0, 10), hour })}
            onWeekChange={handleWeekChange}
          />
        </div>
      </div>

      {/* Side panel */}
      {panel && (
        <div className="crm-card" style={{ width: 360, flexShrink: 0, overflowY: 'auto', padding: 'var(--crm-space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-4)' }}>
            <h2 style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, margin: 0 }}>
              {panel.mode === 'create' ? 'New Appointment' : panel.event.title}
            </h2>
            <button onClick={() => setPanel(null)} className="crm-btn crm-btn-ghost" style={{ padding: 4 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          {panel.mode === 'view' && (
            <ViewPanel event={panel.event} onStatusChange={handleStatusChange} />
          )}
          {panel.mode === 'create' && (
            <CreatePanel
              date={panel.date}
              hour={panel.hour}
              staff={staff}
              locations={locations}
              onCreated={() => { setPanel(null); fetchEvents(weekStart, staffFilter); }}
              toast={toast}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ── View Panel ─────────────────────────────────────── */

function ViewPanel({ event, onStatusChange }: { event: CalendarEvent; onStatusChange: (id: string, status: string) => void }) {
  const s = new Date(event.startsAt), e = new Date(event.endsAt);
  const dateFmt = s.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const timeFmt = `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const actions: { label: string; status: string; accent?: boolean }[] = [];
  if (event.status === 'scheduled') {
    actions.push({ label: 'Confirm', status: 'confirmed', accent: true }, { label: 'Cancel', status: 'cancelled' });
  } else if (event.status === 'confirmed') {
    actions.push({ label: 'Complete', status: 'completed', accent: true }, { label: 'No Show', status: 'no_show' }, { label: 'Cancel', status: 'cancelled' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3)' }}>
      <Field label="When">{dateFmt}<br /><span style={{ color: 'var(--crm-text-secondary)' }}>{timeFmt}</span></Field>
      <Field label="Client">
        {event.customerName
          ? <Link href={`/crm/clients/${event.customerId}`} style={{ color: 'var(--crm-accent)' }}>{event.customerName}</Link>
          : <span style={{ color: 'var(--crm-text-tertiary)' }}>Walk-in</span>}
      </Field>
      <Field label="Status">
        <span className="crm-badge" style={{ background: 'var(--crm-surface-hover)', color: 'var(--crm-text-secondary)' }}>{event.status}</span>
      </Field>
      {actions.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--crm-space-2)', flexWrap: 'wrap', marginTop: 'var(--crm-space-2)' }}>
          {actions.map(a => (
            <button key={a.status} onClick={() => onStatusChange(event.id, a.status)}
              className={a.accent ? 'crm-btn crm-btn-primary' : 'crm-btn crm-btn-secondary'}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Create Panel ───────────────────────────────────── */

function CreatePanel({ date, hour, staff, locations, onCreated, toast }: {
  date: string; hour?: number; staff: StaffMember[]; locations: Location[];
  onCreated: () => void; toast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [title, setTitle] = useState('');
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string>(locations[0]?.id ?? '');
  const [selectedDate, setSelectedDate] = useState(date);
  const [slot, setSlot] = useState<{ start: string; end: string } | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function handleSubmit() {
    if (!title || !slot) return;
    setSaving(true);
    const res = await fetch('/api/crm/appointments', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, customerId: client?.id || null, staffId: staffId || undefined,
        startsAt: slot.start, endsAt: slot.end, notes: notes || undefined,
        locationId: locationId || undefined,
      }),
    });
    if (res.ok) { toast('Appointment created'); onCreated(); }
    else { const e = await res.json().catch(() => ({})); toast(e.error || 'Failed to create', 'error'); }
    setSaving(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <div>
        <Label>Title</Label>
        <input value={title} onChange={e => setTitle(e.target.value)} className="crm-input" style={{ width: '100%' }} placeholder="Fitting, Consultation…" />
      </div>
      <div>
        <Label>Client</Label>
        {client
          ? <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2)', fontSize: 'var(--crm-text-sm)' }}>
              {client.name}
              <button onClick={() => setClient(null)} className="crm-btn crm-btn-ghost" style={{ padding: '2px 6px', fontSize: 'var(--crm-text-xs)' }}>×</button>
            </div>
          : <button onClick={() => setPickerOpen(true)} className="crm-btn crm-btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>Search client…</button>
        }
      </div>
      <div>
        <Label>Staff</Label>
        <StaffPicker staff={staff} value={staffId} onChange={setStaffId} />
      </div>
      <div>
        <Label>Location</Label>
        <select value={locationId} onChange={e => setLocationId(e.target.value)} className="crm-input" style={{ width: '100%' }}>
          <option value="">Select location…</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div>
        <Label>Date</Label>
        <input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setSlot(null); }} className="crm-input" style={{ width: '100%' }} />
      </div>
      {staffId && selectedDate && (
        <div>
          <Label>Time</Label>
          <TimeSlotPicker date={selectedDate} staffId={staffId} value={slot?.start ?? null} onSelect={setSlot} />
        </div>
      )}
      <div>
        <Label>Notes</Label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} className="crm-input" style={{ width: '100%', minHeight: 60, resize: 'vertical' }} />
      </div>
      <button onClick={handleSubmit} disabled={saving || !title || !slot} className="crm-btn crm-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
        {saving ? 'Creating…' : 'Create Appointment'}
      </button>
      <ClientPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={c => { setClient(c); setPickerOpen(false); }} />
    </div>
  );
}

/* ── Shared helpers ─────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 'var(--crm-text-sm)', marginTop: 2 }}>{children}</div>
    </div>
  );
}
