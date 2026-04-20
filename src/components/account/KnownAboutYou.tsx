'use client';

import { useState } from 'react';
import type { MemberContext } from '@/app/api/account/personalization/route';

interface Props {
  ctx: MemberContext;
}

const SHAPE_OPTIONS = ['Round', 'Square', 'Aviator', 'Cat-eye', 'Rectangular', 'Oval', 'Browline', 'Geometric'];
const MATERIAL_OPTIONS = ['Acetate', 'Metal', 'Titanium', 'Wood', 'Horn', 'Mixed'];
const COLOUR_OPTIONS = ['Black', 'Tortoise', 'Gold', 'Silver', 'Clear', 'Blue', 'Red', 'Green', 'Pink', 'White'];

export default function KnownAboutYou({ ctx }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [stated, setStated] = useState(ctx.stated);
  const [saving, setSaving] = useState(false);

  const hasData = ctx.fit || ctx.rx || (ctx.stated.shapes?.length ?? 0) > 0 || ctx.derived;

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/account/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stated),
      });
      setEditing(false);
    } catch {}
    setSaving(false);
  }

  function toggleChip(key: 'shapes' | 'materials' | 'colours' | 'avoid', val: string) {
    setStated(prev => {
      const arr = prev[key] ?? [];
      return { ...prev, [key]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] };
    });
  }

  if (!hasData && !ctx.tier) return null;

  return (
    <section className="border border-gray-200 rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-6 text-left"
      >
        <div>
          <h2 className="text-sm font-medium">Known about you</h2>
          <p className="text-xs text-gray-400 mt-0.5">What we remember to make things fit better</p>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-6 border-t border-gray-100 pt-4">
          {/* Stated preferences */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Your preferences</h3>
              <button
                onClick={() => editing ? save() : setEditing(true)}
                disabled={saving}
                className="text-xs text-gray-400 hover:text-black transition-colors"
              >
                {saving ? 'Saving…' : editing ? 'Save' : 'Edit'}
              </button>
            </div>
            {editing ? (
              <div className="space-y-3">
                <ChipGroup label="Shapes" options={SHAPE_OPTIONS} selected={stated.shapes ?? []} onToggle={v => toggleChip('shapes', v)} />
                <ChipGroup label="Materials" options={MATERIAL_OPTIONS} selected={stated.materials ?? []} onToggle={v => toggleChip('materials', v)} />
                <ChipGroup label="Colours" options={COLOUR_OPTIONS} selected={stated.colours ?? []} onToggle={v => toggleChip('colours', v)} />
                <ChipGroup label="Avoid" options={[...MATERIAL_OPTIONS, ...SHAPE_OPTIONS]} selected={stated.avoid ?? []} onToggle={v => toggleChip('avoid', v)} variant="avoid" />
                <button onClick={() => { setStated(ctx.stated); setEditing(false); }} className="text-xs text-gray-400 hover:text-black">Cancel</button>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                {(['shapes', 'materials', 'colours'] as const).map(k => (
                  (stated[k]?.length ?? 0) > 0 && (
                    <div key={k}>
                      <span className="text-gray-400 capitalize">{k}</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {stated[k]!.map(v => <span key={v} className="px-1.5 py-0.5 bg-gray-100 rounded">{v}</span>)}
                      </div>
                    </div>
                  )
                ))}
                {(stated.avoid?.length ?? 0) > 0 && (
                  <div>
                    <span className="text-gray-400">Avoid</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {stated.avoid!.map(v => <span key={v} className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded">{v}</span>)}
                    </div>
                  </div>
                )}
                {!stated.shapes?.length && !stated.materials?.length && !stated.colours?.length && (
                  <p className="text-gray-300">No preferences set yet</p>
                )}
              </div>
            )}
          </div>

          {/* Derived preferences */}
          {ctx.derived && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Based on {ctx.orderCount} purchase{ctx.orderCount !== 1 ? 's' : ''}
              </h3>
              <div className="space-y-1 text-xs">
                {ctx.derived.shapes && <DerivedRow label="Shapes" data={ctx.derived.shapes} />}
                {ctx.derived.materials && <DerivedRow label="Materials" data={ctx.derived.materials} />}
                {ctx.derived.colours && <DerivedRow label="Colours" data={ctx.derived.colours} />}
              </div>
            </div>
          )}

          {/* Fit profile */}
          {ctx.fit && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Fit profile</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {ctx.fit.faceShape && <div><span className="text-gray-400">Face shape</span><br />{ctx.fit.faceShape}</div>}
                {ctx.fit.frameWidthMm && <div><span className="text-gray-400">Frame width</span><br />{ctx.fit.frameWidthMm}mm</div>}
                {ctx.fit.bridgeWidthMm && <div><span className="text-gray-400">Bridge</span><br />{ctx.fit.bridgeWidthMm}mm</div>}
                {ctx.fit.templeLengthMm && <div><span className="text-gray-400">Temple</span><br />{ctx.fit.templeLengthMm}mm</div>}
              </div>
            </div>
          )}

          {/* Rx status */}
          {ctx.rx && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Prescription</h3>
              <div className="text-xs space-y-1">
                <p>Last updated: {new Date(ctx.rx.latestDate!).toLocaleDateString('en-CA')}</p>
                {ctx.rx.daysUntilExpiry != null && ctx.rx.daysUntilExpiry <= 90 ? (
                  <p className="text-amber-600">Expires approx. {ctx.rx.expiresApprox} ({ctx.rx.daysUntilExpiry} days)</p>
                ) : ctx.rx.daysUntilExpiry != null && ctx.rx.daysUntilExpiry > 0 ? (
                  <p className="text-gray-400">Valid until approx. {ctx.rx.expiresApprox}</p>
                ) : (
                  <p className="text-red-600">Prescription may be expired</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ChipGroup({ label, options, selected, onToggle, variant }: {
  label: string; options: string[]; selected: string[]; onToggle: (v: string) => void; variant?: 'avoid';
}) {
  return (
    <div>
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      <div className="flex flex-wrap gap-1">
        {options.map(o => (
          <button key={o} type="button" onClick={() => onToggle(o)}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              selected.includes(o)
                ? variant === 'avoid' ? 'bg-red-600 text-white' : 'bg-black text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function DerivedRow({ label, data }: { label: string; data: Record<string, number> }) {
  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (sorted.length === 0) return null;
  return (
    <div>
      <span className="text-gray-400">{label}:</span>{' '}
      {sorted.map(([name], i) => (
        <span key={name}>{name}{i < sorted.length - 1 ? ', ' : ''}</span>
      ))}
    </div>
  );
}
