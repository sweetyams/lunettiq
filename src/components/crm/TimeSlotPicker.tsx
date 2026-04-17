'use client';

import { useState, useEffect } from 'react';

interface Slot { start: string; end: string }

interface Props {
  date: string;
  staffId: string;
  duration?: number;
  value: string | null;
  onSelect: (slot: Slot) => void;
}

export function TimeSlotPicker({ date, staffId, duration = 30, value, onSelect }: Props) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date || !staffId) { setSlots([]); return; }
    setLoading(true);
    const p = new URLSearchParams({ date, staffId, duration: String(duration) });
    fetch(`/api/crm/appointments/slots?${p}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setSlots(d.data ?? d ?? []))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [date, staffId, duration]);

  if (!date || !staffId) return <Msg>Select a date and staff member first.</Msg>;
  if (loading) return <Msg>Loading slots…</Msg>;
  if (!slots.length) return <Msg>No available slots.</Msg>;

  const morning = slots.filter(s => new Date(s.start).getHours() < 12);
  const afternoon = slots.filter(s => new Date(s.start).getHours() >= 12);

  return (
    <div>
      <Group label="Morning" items={morning} value={value} onSelect={onSelect} />
      <Group label="Afternoon" items={afternoon} value={value} onSelect={onSelect} />
    </div>
  );
}

function Msg({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', padding: 'var(--crm-space-3) 0' }}>{children}</div>;
}

function Group({ label, items, value, onSelect }: { label: string; items: { start: string; end: string }[]; value: string | null; onSelect: (s: { start: string; end: string }) => void }) {
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 'var(--crm-space-3)' }}>
      <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--crm-space-2)' }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-2)' }}>
        {items.map(s => {
          const sel = value === s.start;
          return (
            <button key={s.start} onClick={() => onSelect(s)} className="crm-btn" style={{
              padding: '6px 14px', fontSize: 'var(--crm-text-sm)', borderRadius: 'var(--crm-radius-md)',
              border: `1px solid ${sel ? 'var(--crm-accent)' : 'var(--crm-border)'}`,
              background: sel ? 'var(--crm-accent-light)' : 'var(--crm-surface)',
              color: sel ? 'var(--crm-accent)' : 'var(--crm-text-primary)',
              fontWeight: sel ? 500 : 400,
            }}>
              {new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </button>
          );
        })}
      </div>
    </div>
  );
}
