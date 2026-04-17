'use client';

import { useState } from 'react';

interface Preferences {
  shapes?: string[];
  materials?: string[];
  colours?: string[];
  avoid?: string[];
  brands_admired?: string[];
  notes?: string;
}

interface DerivedPrefs {
  derivedShapes?: unknown;
  derivedMaterials?: unknown;
  derivedColours?: unknown;
}

interface Props {
  customerId: string;
  stated: Preferences;
  derived?: DerivedPrefs | null;
}

const SHAPE_OPTIONS = ['Round', 'Square', 'Aviator', 'Cat-eye', 'Rectangular', 'Oval', 'Browline', 'Geometric'];
const MATERIAL_OPTIONS = ['Acetate', 'Metal', 'Titanium', 'Wood', 'Horn', 'Mixed'];
const COLOUR_OPTIONS = ['Black', 'Tortoise', 'Gold', 'Silver', 'Clear', 'Blue', 'Red', 'Green', 'Pink', 'White'];

function ChipSelect({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  };
  return (
    <div>
      <label className="text-xs text-neutral-400 block mb-1">{label}</label>
      <div className="flex flex-wrap gap-1">
        {options.map(o => (
          <button key={o} type="button" onClick={() => toggle(o)}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              selected.includes(o) ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}>{o}</button>
        ))}
      </div>
    </div>
  );
}

export function PreferencesEditor({ customerId, stated, derived }: Props) {
  const [editing, setEditing] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>(stated);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/crm/clients/${customerId}`, { credentials: 'include',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metafields: { preferences_json: { value: JSON.stringify(prefs), type: 'json' } },
      }),
    });
    if (res.ok) setEditing(false);
    setSaving(false);
  }

  const set = (k: keyof Preferences, v: string[] | string) => setPrefs(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Preferences</h3>
        <button onClick={() => editing ? save() : setEditing(true)} disabled={saving}
          className="text-xs text-neutral-400 hover:text-neutral-600">
          {saving ? 'Saving…' : editing ? 'Save' : 'Edit'}
        </button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <ChipSelect label="Shapes" options={SHAPE_OPTIONS} selected={prefs.shapes ?? []} onChange={v => set('shapes', v)} />
          <ChipSelect label="Materials" options={MATERIAL_OPTIONS} selected={prefs.materials ?? []} onChange={v => set('materials', v)} />
          <ChipSelect label="Colours" options={COLOUR_OPTIONS} selected={prefs.colours ?? []} onChange={v => set('colours', v)} />
          <ChipSelect label="Avoid" options={[...MATERIAL_OPTIONS, ...SHAPE_OPTIONS]} selected={prefs.avoid ?? []} onChange={v => set('avoid', v)} />
          <div>
            <label className="text-xs text-neutral-400 block mb-1">Notes</label>
            <textarea value={prefs.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={2}
              className="w-full px-2 py-1 border border-neutral-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-neutral-400" />
          </div>
          <button onClick={() => setEditing(false)} className="text-xs text-neutral-400 hover:text-neutral-600">Cancel</button>
        </div>
      ) : (
        <div className="space-y-2 text-xs">
          {(['shapes', 'materials', 'colours'] as const).map(k => (
            <div key={k}>
              <span className="text-neutral-400 capitalize">{k}</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {(prefs[k] ?? []).length ? (prefs[k] ?? []).map(v => (
                  <span key={v} className="px-1.5 py-0.5 bg-neutral-100 rounded">{v}</span>
                )) : <span className="text-neutral-300">—</span>}
              </div>
            </div>
          ))}
          {(prefs.avoid ?? []).length > 0 && (
            <div>
              <span className="text-neutral-400">Avoid</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {(prefs.avoid ?? []).map(v => <span key={v} className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded">{v}</span>)}
              </div>
            </div>
          )}
          {prefs.notes && <div><span className="text-neutral-400">Notes:</span> {prefs.notes}</div>}
        </div>
      )}

      {/* Derived preferences (read-only) */}
      {derived && (
        <div className="pt-2 border-t border-neutral-100">
          <h4 className="text-xs text-neutral-400 mb-1">Derived from purchases</h4>
          <div className="text-xs space-y-1">
            {derived.derivedShapes ? <div>Shapes: {JSON.stringify(derived.derivedShapes) as string}</div> : null}
            {derived.derivedMaterials ? <div>Materials: {JSON.stringify(derived.derivedMaterials) as string}</div> : null}
            {derived.derivedColours ? <div>Colours: {JSON.stringify(derived.derivedColours) as string}</div> : null}
          </div>
        </div>
      )}
    </div>
  );
}
