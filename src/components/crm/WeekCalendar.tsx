'use client';

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';

export interface CalendarEvent {
  id: string;
  title: string;
  customerName: string | null;
  customerId: string | null;
  status: string;
  startsAt: string;
  endsAt: string;
  staffId: string | null;
  locationId?: string | null;
  notes?: string | null;
}

interface Props {
  weekStart: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date, hour: number) => void;
  onWeekChange: (direction: 'prev' | 'next' | 'today') => void;
  onEventMove?: (eventId: string, newStart: Date, newEnd: Date) => void;
  onEventResize?: (eventId: string, newEnd: Date) => void;
  onQuickCreate?: (start: Date, end: Date) => void;
}

const HOUR_START = 9;
const HOUR_END = 20;
const HOUR_PX = 64;
const SNAP_MIN = 15;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_BORDER: Record<string, string> = {
  scheduled: 'var(--crm-text-tertiary)',
  confirmed: 'var(--crm-text-primary)',
  completed: 'var(--crm-text-primary)',
  cancelled: 'var(--crm-text-tertiary)',
  no_show: 'var(--crm-text-tertiary)',
};

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtWeek(start: Date) {
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', o)} – ${end.toLocaleDateString('en-US', o)}, ${end.getFullYear()}`;
}

function fmtHour(h: number) { return h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`; }
function fmtTime(d: Date) { return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }

function snapMinutes(totalMin: number) { return Math.round(totalMin / SNAP_MIN) * SNAP_MIN; }

function yToTime(y: number, dayDate: Date): Date {
  const totalMin = snapMinutes(HOUR_START * 60 + (y / HOUR_PX) * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const d = new Date(dayDate);
  d.setHours(h, m, 0, 0);
  return d;
}

type DragState =
  | null
  | { type: 'create'; dayIdx: number; startY: number; currentY: number }
  | { type: 'move'; eventId: string; dayIdx: number; offsetY: number; currentDayIdx: number; currentY: number; origStart: Date; origEnd: Date }
  | { type: 'resize'; eventId: string; currentY: number; origEnd: Date };

export function WeekCalendar({ weekStart, events, onEventClick, onSlotClick, onWeekChange, onEventMove, onEventResize, onQuickCreate }: Props) {
  const today = new Date();
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const [now, setNow] = useState(new Date());

  // Update current time every minute
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(i); }, []);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  }), [weekStart]);

  const byDay = useMemo(() => {
    const m = new Map<number, CalendarEvent[]>();
    for (const ev of events) {
      const s = new Date(ev.startsAt);
      const idx = days.findIndex(d => sameDay(d, s));
      if (idx >= 0) { if (!m.has(idx)) m.set(idx, []); m.get(idx)!.push(ev); }
    }
    return m;
  }, [events, days]);

  const getRelativeY = useCallback((e: React.PointerEvent | PointerEvent, dayEl: Element) => {
    const rect = dayEl.getBoundingClientRect();
    return Math.max(0, Math.min(e.clientY - rect.top, (HOUR_END - HOUR_START) * HOUR_PX));
  }, []);

  // Drag-to-create on empty space
  const handleSlotPointerDown = useCallback((e: React.PointerEvent, dayIdx: number) => {
    if ((e.target as HTMLElement).closest('[data-event]')) return;
    const col = (e.target as HTMLElement).closest('[data-day-col]');
    if (!col) return;
    const y = getRelativeY(e, col);
    setDrag({ type: 'create', dayIdx, startY: y, currentY: y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [getRelativeY]);

  // Event drag start
  const handleEventPointerDown = useCallback((e: React.PointerEvent, ev: CalendarEvent, dayIdx: number) => {
    if (!onEventMove) return;
    e.stopPropagation();
    const col = (e.target as HTMLElement).closest('[data-day-col]');
    if (!col) return;
    const y = getRelativeY(e, col);
    const s = new Date(ev.startsAt);
    const topMin = (s.getHours() - HOUR_START) * 60 + s.getMinutes();
    const topY = (topMin / 60) * HOUR_PX;
    setDrag({ type: 'move', eventId: ev.id, dayIdx, offsetY: y - topY, currentDayIdx: dayIdx, currentY: y, origStart: new Date(ev.startsAt), origEnd: new Date(ev.endsAt) });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [onEventMove, getRelativeY]);

  // Resize start
  const handleResizePointerDown = useCallback((e: React.PointerEvent, ev: CalendarEvent) => {
    if (!onEventResize) return;
    e.stopPropagation();
    const col = (e.target as HTMLElement).closest('[data-day-col]');
    if (!col) return;
    const y = getRelativeY(e, col);
    setDrag({ type: 'resize', eventId: ev.id, currentY: y, origEnd: new Date(ev.endsAt) });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [onEventResize, getRelativeY]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!drag) return;
    const col = (e.target as HTMLElement).closest?.('[data-day-col]');
    if (!col) return;
    const y = getRelativeY(e as any, col);
    const dayIdx = Number(col.getAttribute('data-day-col'));

    if (drag.type === 'create') setDrag({ ...drag, currentY: y });
    else if (drag.type === 'move') setDrag({ ...drag, currentDayIdx: isNaN(dayIdx) ? drag.currentDayIdx : dayIdx, currentY: y });
    else if (drag.type === 'resize') setDrag({ ...drag, currentY: y });
  }, [drag, getRelativeY]);

  const handlePointerUp = useCallback(() => {
    if (!drag) return;

    if (drag.type === 'create') {
      const minY = Math.min(drag.startY, drag.currentY);
      const maxY = Math.max(drag.startY, drag.currentY);
      if (maxY - minY < 10) {
        // Simple click — use onSlotClick
        const time = yToTime(drag.startY, days[drag.dayIdx]);
        onSlotClick(days[drag.dayIdx], time.getHours());
      } else if (onQuickCreate) {
        const start = yToTime(minY, days[drag.dayIdx]);
        const end = yToTime(maxY, days[drag.dayIdx]);
        onQuickCreate(start, end);
      }
    } else if (drag.type === 'move' && onEventMove) {
      const newStart = yToTime(drag.currentY - drag.offsetY, days[drag.currentDayIdx]);
      const dur = drag.origEnd.getTime() - drag.origStart.getTime();
      const newEnd = new Date(newStart.getTime() + dur);
      if (newStart.getTime() !== drag.origStart.getTime()) {
        onEventMove(drag.eventId, newStart, newEnd);
      }
    } else if (drag.type === 'resize' && onEventResize) {
      const ev = events.find(e => e.id === drag.eventId);
      if (ev) {
        const s = new Date(ev.startsAt);
        const dayIdx = days.findIndex(d => sameDay(d, s));
        if (dayIdx >= 0) {
          const newEnd = yToTime(drag.currentY, days[dayIdx]);
          if (newEnd.getTime() > s.getTime() && newEnd.getTime() !== drag.origEnd.getTime()) {
            onEventResize(drag.eventId, newEnd);
          }
        }
      }
    }

    setDrag(null);
  }, [drag, days, events, onSlotClick, onQuickCreate, onEventMove, onEventResize]);

  useEffect(() => {
    if (!drag) return;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => { window.removeEventListener('pointermove', handlePointerMove); window.removeEventListener('pointerup', handlePointerUp); };
  }, [drag, handlePointerMove, handlePointerUp]);

  // Current time indicator position
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowY = ((nowMin - HOUR_START * 60) / 60) * HOUR_PX;
  const showNowLine = nowMin >= HOUR_START * 60 && nowMin < HOUR_END * 60;
  const todayIdx = days.findIndex(d => sameDay(d, today));

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

      <div className="crm-card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', borderBottom: '1px solid var(--crm-border)' }}>
          <div />
          {days.map((d, i) => {
            const isToday = sameDay(d, today);
            return (
              <div key={i} style={{ padding: '8px 0', textAlign: 'center', borderLeft: '1px solid var(--crm-border-light)' }}>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{DAYS[i]}</div>
                <div style={{
                  fontSize: 'var(--crm-text-lg)', fontWeight: 500, marginTop: 2,
                  ...(isToday ? { color: 'var(--crm-surface)', background: 'var(--crm-text-primary)', borderRadius: '50%', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } : {}),
                }}>{d.getDate()}</div>
              </div>
            );
          })}
        </div>

        {/* Scrollable grid */}
        <div ref={gridRef} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', minHeight: hours.length * HOUR_PX, position: 'relative' }}>
            {/* Hour labels */}
            <div style={{ position: 'relative' }}>
              {hours.map(h => (
                <div key={h} style={{ position: 'absolute', top: (h - HOUR_START) * HOUR_PX, height: HOUR_PX, width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 8, paddingTop: 2, fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
                  {fmtHour(h)}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((d, di) => (
              <div key={di} data-day-col={di} style={{ position: 'relative', borderLeft: '1px solid var(--crm-border-light)', cursor: 'crosshair' }}
                onPointerDown={e => handleSlotPointerDown(e, di)}>
                {/* Hour lines */}
                {hours.map(h => (
                  <div key={h} style={{ position: 'absolute', top: (h - HOUR_START) * HOUR_PX, width: '100%', borderTop: '1px solid var(--crm-border-light)' }}>
                    {/* Half-hour line */}
                    <div style={{ position: 'absolute', top: HOUR_PX / 2, width: '100%', borderTop: '1px dashed var(--crm-border-light)', opacity: 0.5 }} />
                  </div>
                ))}

                {/* Current time line */}
                {showNowLine && di === todayIdx && (
                  <div style={{ position: 'absolute', top: nowY, left: -1, right: 0, height: 2, background: '#ef4444', zIndex: 10, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                  </div>
                )}

                {/* Events */}
                {(byDay.get(di) ?? []).map(ev => {
                  const s = new Date(ev.startsAt), e = new Date(ev.endsAt);
                  const topMin = (s.getHours() - HOUR_START) * 60 + s.getMinutes();
                  const durMin = (e.getTime() - s.getTime()) / 60000;
                  let top = (topMin / 60) * HOUR_PX;
                  let height = Math.max((durMin / 60) * HOUR_PX, 24);

                  // If being moved, adjust position
                  const isMoving = drag?.type === 'move' && drag.eventId === ev.id;
                  const isResizing = drag?.type === 'resize' && drag.eventId === ev.id;
                  if (isMoving && drag.type === 'move') {
                    if (drag.currentDayIdx !== di) return null; // render in target column
                    top = drag.currentY - drag.offsetY;
                  }
                  if (isResizing) {
                    height = Math.max(drag.currentY - top, 24);
                  }

                  const cancelled = ev.status === 'cancelled';

                  return (
                    <div key={ev.id} data-event onClick={e2 => { e2.stopPropagation(); if (!drag) onEventClick(ev); }}
                      onPointerDown={e2 => handleEventPointerDown(e2, ev, di)}
                      style={{
                        position: 'absolute', top, height, left: 3, right: 3,
                        background: 'var(--crm-surface)', border: '1px solid var(--crm-border-light)',
                        borderLeft: `3px solid ${STATUS_BORDER[ev.status] ?? STATUS_BORDER.scheduled}`,
                        borderRadius: 'var(--crm-radius-sm)', padding: '3px 6px',
                        fontSize: 'var(--crm-text-xs)', overflow: 'hidden', cursor: isMoving ? 'grabbing' : 'grab',
                        opacity: (isMoving || isResizing) ? 0.7 : cancelled ? 0.4 : 1,
                        textDecoration: cancelled ? 'line-through' : 'none',
                        zIndex: isMoving ? 20 : 5,
                        transition: drag ? 'none' : 'top 0.15s, height 0.15s',
                        userSelect: 'none',
                      }}>
                      <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</div>
                      {height > 28 && <div style={{ color: 'var(--crm-text-tertiary)', whiteSpace: 'nowrap' }}>{fmtTime(s)} – {fmtTime(e)}</div>}
                      {height > 44 && ev.customerName && <div style={{ color: 'var(--crm-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.customerName}</div>}
                      {/* Resize handle */}
                      {onEventResize && !cancelled && (
                        <div onPointerDown={e2 => handleResizePointerDown(e2, ev)}
                          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, cursor: 's-resize' }} />
                      )}
                    </div>
                  );
                })}

                {/* Ghost for moved event in target column */}
                {drag?.type === 'move' && drag.currentDayIdx === di && (() => {
                  const ev = events.find(e => e.id === drag.eventId);
                  if (!ev) return null;
                  const dur = drag.origEnd.getTime() - drag.origStart.getTime();
                  const height = Math.max((dur / 60000 / 60) * HOUR_PX, 24);
                  const top = drag.currentY - drag.offsetY;
                  const newStart = yToTime(top, days[di]);
                  return (
                    <div style={{ position: 'absolute', top, height, left: 3, right: 3, background: 'var(--crm-text-primary)', opacity: 0.15, borderRadius: 'var(--crm-radius-sm)', pointerEvents: 'none', zIndex: 15, padding: '3px 6px', fontSize: 'var(--crm-text-xs)' }}>
                      {fmtTime(newStart)}
                    </div>
                  );
                })()}

                {/* Drag-to-create ghost */}
                {drag?.type === 'create' && drag.dayIdx === di && Math.abs(drag.currentY - drag.startY) > 10 && (
                  <div style={{
                    position: 'absolute', top: Math.min(drag.startY, drag.currentY), height: Math.abs(drag.currentY - drag.startY),
                    left: 3, right: 3, background: 'var(--crm-text-primary)', opacity: 0.1, borderRadius: 'var(--crm-radius-sm)',
                    border: '1px dashed var(--crm-text-primary)', pointerEvents: 'none', zIndex: 15,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-primary)',
                  }}>
                    {fmtTime(yToTime(Math.min(drag.startY, drag.currentY), d))} – {fmtTime(yToTime(Math.max(drag.startY, drag.currentY), d))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
