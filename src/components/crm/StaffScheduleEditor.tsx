'use client';

import { useState, useEffect } from 'react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Schedule { dayOfWeek: number; startTime: string; endTime: string; locationId?: string | null }
interface Props { staffId: string; staffName: string; onClose: () => void }

export function StaffScheduleEditor({ staffId, staffName, onClose }: Props) {
  const [rows, setRows] = useState<Schedule[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/crm/staff/${staffId}/schedule`, { credentials: 'include' })
      .then(r => r.json()).then(d => {
        const data = d.data ?? [];
        // If empty, prefill Mon-Sat 9-18
        if (!data.length) {
          setRows([1, 2, 3, 4, 5, 6].map(day => ({ dayOfWeek: day, startTime: '09:00', endTime: '18:00' })));
        } else {
          setRows(data.map((s: any) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })));
        }
      });
  }, [staffId]);

  function toggle(day: number) {
    const exists = rows.find(r => r.dayOfWeek === day);
    if (exists) setRows(rows.filter(r => r.dayOfWeek !== day));
    else setRows([...rows, { dayOfWeek: day, startTime: '09:00', endTime: '18:00' }].sort((a, b) => a.dayOfWeek - b.dayOfWeek));
  }

  function update(day: number, field: 'startTime' | 'endTime', val: string) {
    setRows(rows.map(r => r.dayOfWeek === day ? { ...r, [field]: val } : r));
  }

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/crm/staff/${staffId}/schedule`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rows),
    });
    setSaving(false);
    onClose();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div className="crm-card" style={{ width: 480, padding: 'var(--crm-space-6)' }}>
        <h2 style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, marginBottom: 'var(--crm-space-4)' }}>
          Schedule — {staffName}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2)' }}>
          {DAYS.map((name, i) => {
            const row = rows.find(r => r.dayOfWeek === i);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3)' }}>
                <label style={{ width: 90, fontSize: 'var(--crm-text-sm)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!row} onChange={() => toggle(i)} />
                  {name.slice(0, 3)}
                </label>
                {row ? (
                  <>
                    <input type="time" value={row.startTime} onChange={e => update(i, 'startTime', e.target.value)}
                      className="crm-input" style={{ width: 110, fontSize: 'var(--crm-text-sm)' }} />
                    <span style={{ color: 'var(--crm-text-tertiary)' }}>–</span>
                    <input type="time" value={row.endTime} onChange={e => update(i, 'endTime', e.target.value)}
                      className="crm-input" style={{ width: 110, fontSize: 'var(--crm-text-sm)' }} />
                  </>
                ) : (
                  <span style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>Off</span>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 'var(--crm-space-2)', justifyContent: 'flex-end', marginTop: 'var(--crm-space-5)' }}>
          <button onClick={onClose} className="crm-btn crm-btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="crm-btn crm-btn-primary">
            {saving ? 'Saving…' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
