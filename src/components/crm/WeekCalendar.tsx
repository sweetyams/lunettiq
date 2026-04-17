'use client';

import { useMemo } from 'react';

export interface CalendarEvent {
  id: string;
  title: string;
  customerName: string | null;
  customerId: string | null;
  status: string;
  startsAt: string;
  endsAt: string;
  staffId: string | null;
}

interface Props {
  weekStart: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date, hour: number) => void;
  onWeekChange: (direction: 'prev' | 'next' | 'today') => void;
}

const HOUR_START = 9;
const HOUR_END = 19;
const HOUR_PX = 60;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_BORDER: Record<string, string> = {
  scheduled: '#d4d4d4',
  confirmed: '#2563eb',
  completed: '#16a34a',
  cancelled: '#dc2626',
  no_show: '#d97706',
};

const STATUS_BG: Record<string, string> = {
  scheduled: '#f5f5f5',
  confirmed: 'var(--crm-accent-light)',
  completed: 'var(--crm-success-light)',
  cancelled: 'var(--crm-error-light)',
  no_show: 'var(--crm-warning-light)',
};

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtWeek(start: Date) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', o)} – ${end.toLocaleDateString('en-US', o)}, ${end.getFullYear()}`;
}

function fmtHour(h: number) {
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

export function WeekCalendar({ weekStart, events, onEventClick, onSlotClick, onWeekChange }: Props) {
  const today = new Date();
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  }), [weekStart]);

  const byDay = useMemo(() => {
    const m = new Map<number, CalendarEvent[]>();
    for (const ev of events) {
      const s = new Date(ev.startsAt);
      const idx = days.findIndex(d => sameDay(d, s));
      if (idx >= 0) {
        if (!m.has(idx)) m.set(idx, []);
        m.get(idx)!.push(ev);
      }
    }
    return m;
  }, [events, days]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3)', marginBottom: 'var(--crm-space-4)' }}>
        <button onClick={() => onWeekChange('today')} className="crm-btn crm-btn-secondary">Today</button>
        <button onClick={() => onWeekChange('prev')} className="crm-btn crm-btn-ghost" style={{ padding: '4px 8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <button onClick={() => onWeekChange('next')} className="crm-btn crm-btn-ghost" style={{ padding: '4px 8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
        </button>
        <span style={{ fontSize: 'var(--crm-text-base)', fontWeight: 500 }}>{fmtWeek(weekStart)}</span>
      </div>

      {/* Grid */}
      <div className="crm-card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '1px solid var(--crm-border)' }}>
          <div />
          {days.map((d, i) => {
            const isToday = sameDay(d, today);
            return (
              <div key={i} style={{ padding: 'var(--crm-space-2)', textAlign: 'center', borderLeft: '1px solid var(--crm-border-light)' }}>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{DAYS[i]}</div>
                <div style={{
                  fontSize: 'var(--crm-text-lg)', fontWeight: 500,
                  ...(isToday ? { color: 'var(--crm-text-inverse)', background: 'var(--crm-accent)', borderRadius: 'var(--crm-radius-full)', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } : {}),
                }}>{d.getDate()}</div>
              </div>
            );
          })}
        </div>

        {/* Scrollable time grid */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', minHeight: hours.length * HOUR_PX, position: 'relative' }}>
            {/* Hour labels */}
            <div style={{ position: 'relative' }}>
              {hours.map(h => (
                <div key={h} style={{
                  position: 'absolute', top: (h - HOUR_START) * HOUR_PX, height: HOUR_PX, width: '100%',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
                  paddingRight: 'var(--crm-space-2)', paddingTop: 2,
                  fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)',
                }}>{fmtHour(h)}</div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((d, di) => (
              <div key={di} style={{ position: 'relative', borderLeft: '1px solid var(--crm-border-light)' }}>
                {hours.map(h => (
                  <div key={h} onClick={() => onSlotClick(d, h)} style={{
                    position: 'absolute', top: (h - HOUR_START) * HOUR_PX, height: HOUR_PX, width: '100%',
                    borderTop: '1px solid var(--crm-border-light)', cursor: 'pointer',
                  }} />
                ))}
                {(byDay.get(di) ?? []).map(ev => {
                  const s = new Date(ev.startsAt), e = new Date(ev.endsAt);
                  const topMin = (s.getHours() - HOUR_START) * 60 + s.getMinutes();
                  const durMin = (e.getTime() - s.getTime()) / 60000;
                  const top = (topMin / 60) * HOUR_PX;
                  const height = Math.max((durMin / 60) * HOUR_PX, 20);
                  return (
                    <div key={ev.id} onClick={e2 => { e2.stopPropagation(); onEventClick(ev); }} style={{
                      position: 'absolute', top, height, left: 2, right: 2,
                      background: STATUS_BG[ev.status] ?? STATUS_BG.scheduled,
                      borderLeft: `3px solid ${STATUS_BORDER[ev.status] ?? STATUS_BORDER.scheduled}`,
                      borderRadius: 'var(--crm-radius-sm)', padding: '2px 6px',
                      fontSize: 'var(--crm-text-xs)', overflow: 'hidden', cursor: 'pointer',
                    }}>
                      <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</div>
                      {height > 30 && ev.customerName && (
                        <div style={{ color: 'var(--crm-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.customerName}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
