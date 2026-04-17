'use client';

import { useState } from 'react';

interface Props {
  customerId: string;
  field: string;
  label: string;
  value: string;
  type?: 'text' | 'email' | 'tel' | 'date' | 'select';
  options?: { value: string; label: string }[];
  isMetafield?: boolean;
  metafieldType?: string;
  onSaved?: (newValue: string) => void;
}

export function CustomerEditForm({ customerId, field, label, value, type = 'text', options, isMetafield, metafieldType, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(value);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (draft === current) { setEditing(false); return; }
    setSaving(true);

    const body = isMetafield
      ? { metafields: { [field]: { value: draft, type: metafieldType || 'single_line_text_field' } } }
      : { [field]: draft };

    const res = await fetch(`/api/crm/clients/${customerId}`, { credentials: 'include',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setCurrent(draft);
      setEditing(false);
      onSaved?.(draft);
    }
    setSaving(false);
  }

  if (!editing) {
    return (
      <div className="group flex items-center justify-between py-1">
        <div>
          <span className="text-xs text-neutral-400">{label}</span>
          <div className="text-sm">{current || '—'}</div>
        </div>
        <button onClick={() => { setDraft(current); setEditing(true); }}
          className="text-xs text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-neutral-600 transition-opacity">
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="py-1">
      <span className="text-xs text-neutral-400">{label}</span>
      <div className="flex gap-1.5 mt-0.5">
        {type === 'select' && options ? (
          <select value={draft} onChange={e => setDraft(e.target.value)}
            className="flex-1 px-2 py-1 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400">
            <option value="">—</option>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input type={type} value={draft} onChange={e => setDraft(e.target.value)}
            className="flex-1 px-2 py-1 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400"
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            autoFocus
          />
        )}
        <button onClick={save} disabled={saving}
          className="px-2 py-1 bg-neutral-900 text-white text-xs rounded hover:bg-neutral-800 disabled:opacity-50">
          {saving ? '…' : '✓'}
        </button>
        <button onClick={() => setEditing(false)} className="px-2 py-1 text-xs text-neutral-400 hover:text-neutral-600">✕</button>
      </div>
    </div>
  );
}
