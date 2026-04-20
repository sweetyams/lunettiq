'use client';

import { useState, useEffect } from 'react';

interface ApptType { id: string; name: string; durationMinutes: number; bufferMinutes: number; active: boolean; sortOrder: number }

export default function AppointmentTypesPage() {
  const [types, setTypes] = useState<ApptType[]>([]);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(30);
  const [buffer, setBuffer] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);

  const load = () => fetch('/api/crm/appointment-types', { credentials: 'include' })
    .then(r => r.json()).then(d => setTypes(d.data ?? []));

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!name) return;
    await fetch('/api/crm/appointment-types', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, durationMinutes: duration, bufferMinutes: buffer, sortOrder: types.length }),
    });
    setName(''); setDuration(30); setBuffer(0); load();
  }

  async function handleToggle(t: ApptType) {
    await fetch(`/api/crm/appointment-types/${t.id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !t.active }),
    });
    load();
  }

  async function handleSave(t: ApptType) {
    await fetch(`/api/crm/appointment-types/${t.id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: t.name, durationMinutes: t.durationMinutes, bufferMinutes: t.bufferMinutes }),
    });
    setEditing(null); load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this appointment type?')) return;
    await fetch(`/api/crm/appointment-types/${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Appointment Types</h1>

      <div className="space-y-2 mb-6">
        {types.map(t => (
          <div key={t.id} className={`flex items-center gap-3 border rounded p-3 bg-white ${t.active ? 'border-neutral-200' : 'border-neutral-100 opacity-50'}`}>
            {editing === t.id ? (
              <>
                <input value={t.name} onChange={e => setTypes(types.map(x => x.id === t.id ? { ...x, name: e.target.value } : x))}
                  className="flex-1 px-2 py-1 border rounded text-sm" />
                <input type="number" value={t.durationMinutes} onChange={e => setTypes(types.map(x => x.id === t.id ? { ...x, durationMinutes: +e.target.value } : x))}
                  className="w-16 px-2 py-1 border rounded text-sm text-center" />
                <span className="text-xs text-neutral-400">min</span>
                <input type="number" value={t.bufferMinutes} onChange={e => setTypes(types.map(x => x.id === t.id ? { ...x, bufferMinutes: +e.target.value } : x))}
                  className="w-16 px-2 py-1 border rounded text-sm text-center" />
                <span className="text-xs text-neutral-400">buffer</span>
                <button onClick={() => handleSave(t)} className="text-sm text-blue-600 hover:underline">Save</button>
                <button onClick={() => { setEditing(null); load(); }} className="text-sm text-neutral-400 hover:underline">Cancel</button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <span className="text-sm font-medium">{t.name}</span>
                  <span className="text-xs text-neutral-400 ml-2">{t.durationMinutes}min{t.bufferMinutes > 0 ? ` + ${t.bufferMinutes}min buffer` : ''}</span>
                </div>
                <button onClick={() => setEditing(t.id)} className="text-xs text-neutral-400 hover:text-neutral-700">Edit</button>
                <button onClick={() => handleToggle(t)} className="text-xs text-neutral-400 hover:text-neutral-700">{t.active ? 'Disable' : 'Enable'}</button>
                <button onClick={() => handleDelete(t.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="border border-dashed border-neutral-300 rounded p-4 bg-white">
        <div className="text-sm font-medium mb-3">Add new type</div>
        <div className="flex items-center gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Eye Exam"
            className="flex-1 px-3 py-2 border rounded text-sm" />
          <input type="number" value={duration} onChange={e => setDuration(+e.target.value)}
            className="w-16 px-2 py-2 border rounded text-sm text-center" />
          <span className="text-xs text-neutral-400">min</span>
          <input type="number" value={buffer} onChange={e => setBuffer(+e.target.value)}
            className="w-16 px-2 py-2 border rounded text-sm text-center" />
          <span className="text-xs text-neutral-400">buffer</span>
          <button onClick={handleAdd} disabled={!name}
            className="px-4 py-2 text-sm bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:opacity-50">Add</button>
        </div>
      </div>
    </div>
  );
}
