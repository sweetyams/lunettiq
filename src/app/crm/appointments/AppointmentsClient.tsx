'use client';

import { useState, useEffect, useCallback } from 'react';
import { WeekCalendar, CalendarEvent } from '@/components/crm/WeekCalendar';
import { StaffPicker, StaffMember } from '@/components/crm/StaffPicker';
import { TimeSlotPicker } from '@/components/crm/TimeSlotPicker';
import { ClientPicker } from '@/components/crm/ClientPicker';
import { useToast } from '@/components/crm/CrmShell';
import { buildRRule, describeRule } from '@/lib/crm/recurrence';
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
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [panel, setPanel] = useState<Panel>(null);

  const fetchEvents = useCallback(async (week: Date, sid: string | null, lid: string | null) => {
    const p = new URLSearchParams({ week: week.toISOString() });
    if (sid) p.set('staffId', sid);
    if (lid) p.set('locationId', lid);
    const res = await fetch(`/api/crm/appointments?${p}`, { credentials: 'include' });
    if (res.ok) {
      const d = await res.json();
      const staffMap = new Map(staff.map(s => [s.id, `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()]));
      setEvents((d.data ?? []).map((e: any) => ({ ...e, staffName: staffMap.get(e.staffId) || null })));
    }
  }, []);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { if (mounted) fetchEvents(weekStart, staffFilter, locationFilter); else setMounted(true); }, [weekStart, staffFilter, locationFilter]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (res.ok) { toast(`Marked as ${status}`); setPanel(null); fetchEvents(weekStart, staffFilter, locationFilter); }
    else { const e = await res.json().catch(() => ({})); toast(e.error || 'Failed', 'error'); }
  }

  async function handleDelete(id: string, mode: 'this' | 'all') {
    const res = await fetch(`/api/crm/appointments/${id}?mode=${mode}`, {
      method: 'DELETE', credentials: 'include',
    });
    if (res.ok) { toast(mode === 'all' ? 'Series cancelled' : 'Appointment cancelled'); setPanel(null); fetchEvents(weekStart, staffFilter, locationFilter); }
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
        <div style={{ marginBottom: 'var(--crm-space-4)', display: 'flex', gap: 'var(--crm-space-3)', alignItems: 'center' }}>
          <StaffPicker staff={staff} value={staffFilter} onChange={setStaffFilter} />
          <select value={locationFilter ?? ''} onChange={e => setLocationFilter(e.target.value || null)} className="crm-input">
            <option value="">All locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <WeekCalendar
            weekStart={weekStart}
            events={events}
            onEventClick={ev => setPanel({ mode: 'view', event: ev })}
            onSlotClick={(date, hour) => setPanel({ mode: 'create', date: date.toISOString().slice(0, 10), hour })}
            onWeekChange={handleWeekChange}
            onEventMove={async (id, newStart, newEnd) => {
              const res = await fetch(`/api/crm/appointments/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startsAt: newStart.toISOString(), endsAt: newEnd.toISOString() }) });
              if (res.ok) { toast('Appointment moved'); fetchEvents(weekStart, staffFilter, locationFilter); }
              else { const e = await res.json().catch(() => ({})); toast(e.error || 'Conflict — could not move', 'error'); }
            }}
            onEventResize={async (id, newEnd) => {
              const res = await fetch(`/api/crm/appointments/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endsAt: newEnd.toISOString() }) });
              if (res.ok) { toast('Duration updated'); fetchEvents(weekStart, staffFilter, locationFilter); }
              else toast('Could not resize', 'error');
            }}
            onQuickCreate={(start, end) => setPanel({ mode: 'create', date: start.toISOString().slice(0, 10), hour: start.getHours() })}
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
            <ViewPanel event={panel.event} locations={locations} onStatusChange={handleStatusChange} onDelete={handleDelete} />
          )}
          {panel.mode === 'create' && (
            <CreatePanel
              date={panel.date}
              hour={panel.hour}
              staff={staff}
              locations={locations}
              onCreated={() => { setPanel(null); fetchEvents(weekStart, staffFilter, locationFilter); }}
              toast={toast}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ── View Panel ─────────────────────────────────────── */

function ViewPanel({ event, locations, onStatusChange, onDelete }: {
  event: CalendarEvent; locations: Location[];
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string, mode: 'this' | 'all') => void;
}) {
  const [deleteConfirm, setDeleteConfirm] = useState<null | 'this' | 'all'>(null);
  const s = new Date(event.startsAt), e = new Date(event.endsAt);
  const dateFmt = s.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const timeFmt = `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const locName = locations.find(l => l.id === (event as any).locationId)?.name;
  const isSeries = !!event.seriesId;

  const actions: { label: string; status: string; accent?: boolean }[] = [];
  if (event.status === 'scheduled') {
    actions.push({ label: 'Confirm', status: 'confirmed', accent: true });
  } else if (event.status === 'confirmed') {
    actions.push({ label: 'Complete', status: 'completed', accent: true }, { label: 'No Show', status: 'no_show' });
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
      {locName && <Field label="Location">{locName}</Field>}
      {event.staffName && <Field label="Staff">{event.staffName}</Field>}
      {event.recurrenceRule && <Field label="Recurrence">{describeRule(event.recurrenceRule)}</Field>}
      {isSeries && !event.recurrenceRule && <Field label="Series">Instance #{(event.seriesIndex ?? 0) + 1}</Field>}
      {(event as any).notes && <Field label="Notes">{(event as any).notes}</Field>}
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
      {(event.status === 'scheduled' || event.status === 'confirmed') && (
        <div style={{ marginTop: 'var(--crm-space-2)' }}>
          {deleteConfirm === null ? (
            <button onClick={() => setDeleteConfirm('this')} className="crm-btn crm-btn-secondary" style={{ color: 'var(--crm-danger, #dc2626)' }}>
              Cancel{isSeries ? '…' : ''}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2)', padding: 'var(--crm-space-3)', border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius-md)' }}>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>Cancel appointment?</div>
              <button onClick={() => { onDelete(event.id, 'this'); setDeleteConfirm(null); }} className="crm-btn crm-btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                This appointment only
              </button>
              {isSeries && (
                <button onClick={() => { onDelete(event.id, 'all'); setDeleteConfirm(null); }} className="crm-btn crm-btn-secondary" style={{ width: '100%', justifyContent: 'center', color: 'var(--crm-danger, #dc2626)' }}>
                  Entire series
                </button>
              )}
              <button onClick={() => setDeleteConfirm(null)} className="crm-btn crm-btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 'var(--crm-text-xs)' }}>
                Never mind
              </button>
            </div>
          )}
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
  const [recFreq, setRecFreq] = useState('');
  const [recCount, setRecCount] = useState(4);
  const [apptTypes, setApptTypes] = useState<{ id: string; name: string; durationMinutes: number; bufferMinutes: number }[]>([]);

  useEffect(() => {
    fetch('/api/crm/appointment-types', { credentials: 'include' })
      .then(r => r.json()).then(d => setApptTypes(d.data ?? [])).catch(() => {});
  }, []);

  const selectedType = apptTypes.find(t => t.name === title);
  const recurrenceRule = recFreq ? buildRRule({ freq: recFreq, count: recCount }) : undefined;

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
        buffer: selectedType?.bufferMinutes ?? 0,
        recurrenceRule,
      }),
    });
    if (res.ok) { toast('Appointment created'); onCreated(); }
    else { const e = await res.json().catch(() => ({})); toast(e.error || 'Failed to create', 'error'); }
    setSaving(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <div>
        <Label>Reason</Label>
        <select value={title} onChange={e => setTitle(e.target.value)} className="crm-input" style={{ width: '100%' }}>
          <option value="">Select type…</option>
          {apptTypes.map(t => <option key={t.id} value={t.name}>{t.name} ({t.durationMinutes}min)</option>)}
        </select>
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
      {selectedDate && (staffId || locationId) && (
        <div>
          <Label>Time</Label>
          <TimeSlotPicker date={selectedDate} staffId={staffId} locationId={locationId} value={slot?.start ?? null} onSelect={setSlot} />
          {slot && (
            <div suppressHydrationWarning style={{ marginTop: 6, fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-primary)', background: 'var(--crm-surface-hover)', padding: '8px 12px', borderRadius: 'var(--crm-radius-sm)' }}>
              {new Date(slot.start).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {' · '}
              {new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' – '}
              {new Date(slot.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      )}
      <div>
        <Label>Notes</Label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} className="crm-input" style={{ width: '100%', minHeight: 60, resize: 'vertical' }} />
      </div>
      <div>
        <Label>Repeat</Label>
        <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
          <select value={recFreq} onChange={e => setRecFreq(e.target.value)} className="crm-input" style={{ flex: 1 }}>
            <option value="">No repeat</option>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
          {recFreq && (
            <input type="number" min={2} max={52} value={recCount} onChange={e => setRecCount(Number(e.target.value))}
              className="crm-input" style={{ width: 64, textAlign: 'center' }} />
          )}
        </div>
        {recurrenceRule && (
          <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 4 }}>
            {describeRule(recurrenceRule)}
          </div>
        )}
      </div>
      <button onClick={handleSubmit} disabled={saving || !title || !slot} className="crm-btn crm-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
        {saving ? 'Creating…' : recurrenceRule ? 'Create Series' : 'Create Appointment'}
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
