'use client';

import { useState } from 'react';

interface FitProfile {
  face_shape: string;
  frame_width_mm: string;
  bridge_width_mm: string;
  temple_length_mm: string;
  rx_on_file: string;
}

interface Props {
  customerId: string;
  profile: FitProfile;
}

const FACE_SHAPES = ['Oval', 'Round', 'Square', 'Heart', 'Oblong', 'Diamond', 'Triangle'];

export function FitProfileEditor({ customerId, profile: initial }: Props) {
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(initial);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof FitProfile, v: string) => setProfile(p => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    const metafields: Record<string, { value: string; type?: string }> = {};
    for (const [key, value] of Object.entries(profile)) {
      if (value !== initial[key as keyof FitProfile]) {
        metafields[key] = {
          value,
          type: key === 'rx_on_file' ? 'boolean' : key === 'face_shape' ? 'single_line_text_field' : 'number_integer',
        };
      }
    }
    if (Object.keys(metafields).length) {
      const res = await fetch(`/api/crm/clients/${customerId}`, { credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metafields }),
      });
      if (res.ok) setEditing(false);
    } else {
      setEditing(false);
    }
    setSaving(false);
  }

  const inputCls = 'w-full px-2 py-1 border border-neutral-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">Fit Profile</h3>
        <button onClick={() => editing ? save() : setEditing(true)} disabled={saving}
          className="text-xs text-neutral-400 hover:text-neutral-600">
          {saving ? 'Saving…' : editing ? 'Save' : 'Edit'}
        </button>
      </div>

      {editing ? (
        <div className="space-y-2">
          <div>
            <label className="text-xs text-neutral-400">Face Shape</label>
            <select value={profile.face_shape} onChange={e => set('face_shape', e.target.value)} className={inputCls}>
              <option value="">—</option>
              {FACE_SHAPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-neutral-400">Frame (mm)</label>
              <input type="number" value={profile.frame_width_mm} onChange={e => set('frame_width_mm', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-neutral-400">Bridge (mm)</label>
              <input type="number" value={profile.bridge_width_mm} onChange={e => set('bridge_width_mm', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-neutral-400">Temple (mm)</label>
              <input type="number" value={profile.temple_length_mm} onChange={e => set('temple_length_mm', e.target.value)} className={inputCls} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={profile.rx_on_file === 'true'} onChange={e => set('rx_on_file', String(e.target.checked))}
              className="rounded border-neutral-300" />
            Rx on file
          </label>
          <button onClick={() => { setProfile(initial); setEditing(false); }} className="text-xs text-neutral-400 hover:text-neutral-600">Cancel</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-neutral-400 text-xs">Face shape</span><br />{profile.face_shape || '—'}</div>
          <div><span className="text-neutral-400 text-xs">Frame width</span><br />{profile.frame_width_mm ? `${profile.frame_width_mm}mm` : '—'}</div>
          <div><span className="text-neutral-400 text-xs">Bridge</span><br />{profile.bridge_width_mm ? `${profile.bridge_width_mm}mm` : '—'}</div>
          <div><span className="text-neutral-400 text-xs">Temple</span><br />{profile.temple_length_mm ? `${profile.temple_length_mm}mm` : '—'}</div>
          <div className="col-span-2"><span className="text-neutral-400 text-xs">Rx on file</span><br />{profile.rx_on_file === 'true' ? '✓ Yes' : '—'}</div>
        </div>
      )}
    </div>
  );
}
