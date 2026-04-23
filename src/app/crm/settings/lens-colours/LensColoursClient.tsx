'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface LensSet { id: string; code: string; label: string; description: string | null; sortOrder: number; status: string }
interface LensColour { id: string; setId: string; code: string; label: string; shortDescription: string | null; description: string | null; swatchUrl: string | null; imageUrl: string | null; hex: string | null; hexEnd: string | null; price: string; category: string | null; sortOrder: number; status: string }

const API = '/api/crm/settings/lens-colours';
const post = (body: object) => fetch(API, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const patch = (body: object) => fetch(API, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const del = (body: object) => fetch(API, { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function swatchBg(hex: string | null, hexEnd: string | null): string {
  if (!hex) return '#ddd';
  if (hexEnd) return `linear-gradient(180deg, ${hex} 0%, ${hexEnd} 100%)`;
  return hex;
}

export default function LensColoursClient() {
  const [sets, setSets] = useState<LensSet[]>([]);
  const [colours, setColours] = useState<LensColour[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSet, setExpandedSet] = useState<string | null>(null);
  const [editingSet, setEditingSet] = useState<Partial<LensSet> | null>(null);
  const [editingColour, setEditingColour] = useState<Partial<LensColour> | null>(null);
  const [isNewSet, setIsNewSet] = useState(false);
  const [isNewColour, setIsNewColour] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(API, { credentials: 'include' });
    if (res.ok) { const d = await res.json(); setSets(d.data?.sets ?? []); setColours(d.data?.colours ?? []); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function saveSet() {
    if (!editingSet?.label) return;
    if (isNewSet) {
      const code = editingSet.code || editingSet.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      await post({ entity: 'set', data: { ...editingSet, code, sortOrder: sets.length * 10 } });
    } else {
      await patch({ entity: 'set', id: editingSet.id, label: editingSet.label, description: editingSet.description, code: editingSet.code });
    }
    setEditingSet(null); load();
  }

  async function deleteSet(id: string) {
    if (!confirm('Delete this set and all its colours?')) return;
    await del({ entity: 'set', id }); load();
  }

  async function saveColour(setId: string) {
    if (!editingColour?.label) return;
    if (isNewColour) {
      const code = editingColour.code || `${sets.find(s => s.id === setId)?.code ?? 'lc'}_${editingColour.label!.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
      const setColours2 = colours.filter(c => c.setId === setId);
      await post({ entity: 'colour', data: { ...editingColour, setId, code, sortOrder: setColours2.length * 10 } });
    } else {
      const { id, ...data } = editingColour;
      await patch({ entity: 'colour', id, ...data });
    }
    setEditingColour(null); load();
  }

  async function deleteColour(id: string) {
    await del({ entity: 'colour', id }); load();
  }

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 13 }}>
        <Link href="/crm/settings" style={{ color: '#9ca3af', textDecoration: 'none' }}>Settings</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ fontWeight: 600 }}>Lens Colours</span>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Lens Colours</h1>

      {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Loading…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sets.map(s => {
            const setColours2 = colours.filter(c => c.setId === s.id).sort((a, b) => a.sortOrder - b.sortOrder);
            const open = expandedSet === s.id;
            return (
              <div key={s.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff' }}>
                {/* Set header */}
                <div style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onClick={() => setExpandedSet(open ? null : s.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10, color: '#9ca3af', transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{s.label} <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>({setColours2.length})</span></div>
                      {s.description && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{s.description}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                    <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => { setEditingSet({ ...s }); setIsNewSet(false); }}>✎</button>
                    <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: '#ef4444' }} onClick={() => deleteSet(s.id)}>✕</button>
                  </div>
                </div>

                {/* Expanded: colours */}
                {open && (
                  <div style={{ borderTop: '1px solid #f3f4f6', padding: 16 }}>
                    {/* Swatch preview */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {setColours2.map(c => (
                        <div key={c.id} title={`${c.label}${c.price !== '0.00' && c.price !== '0' ? ` (+$${c.price})` : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 18, background: swatchBg(c.hex, c.hexEnd), border: '2px solid #e5e7eb', cursor: 'pointer' }} onClick={() => { setEditingColour({ ...c }); setIsNewColour(false); }} />
                          <span style={{ fontSize: 9, color: '#6b7280', maxWidth: 44, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Colour table */}
                    <div style={{ fontSize: 12 }}>
                      {setColours2.map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                          <div style={{ width: 20, height: 20, borderRadius: 10, background: swatchBg(c.hex, c.hexEnd), border: '1px solid #e5e7eb', flexShrink: 0 }} />
                          <span style={{ flex: 1, fontWeight: 500 }}>{c.label}</span>
                          {c.category && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#f3f4f6', color: '#6b7280' }}>{c.category}</span>}
                          {c.price !== '0.00' && c.price !== '0' && <span style={{ fontSize: 11, color: '#059669' }}>+${c.price}</span>}
                          <button onClick={() => { setEditingColour({ ...c }); setIsNewColour(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 12 }}>✎</button>
                          <button onClick={() => deleteColour(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 14 }}>✕</button>
                        </div>
                      ))}
                    </div>

                    <button onClick={() => { setEditingColour({ setId: s.id, label: '', price: '0' }); setIsNewColour(true); }} style={{ marginTop: 8, fontSize: 12, color: '#111', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>+ Add colour</button>
                  </div>
                )}
              </div>
            );
          })}

          <button onClick={() => { setEditingSet({ label: '', description: '' }); setIsNewSet(true); }} style={{ width: '100%', fontSize: 12, padding: 12, background: 'none', border: '1px dashed #d1d5db', borderRadius: 10, cursor: 'pointer', color: '#111', fontWeight: 500 }}>+ Add set</button>
        </div>
      )}

      {/* Set edit modal */}
      {editingSet && (
        <Modal onClose={() => setEditingSet(null)}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{isNewSet ? 'New Set' : 'Edit Set'}</h2>
          <Field label="Label" value={editingSet.label ?? ''} onChange={v => setEditingSet({ ...editingSet, label: v })} />
          <Field label="Code" value={editingSet.code ?? ''} onChange={v => setEditingSet({ ...editingSet, code: v })} mono />
          <Field label="Description" value={editingSet.description ?? ''} onChange={v => setEditingSet({ ...editingSet, description: v })} />
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <button className="crm-btn crm-btn-primary" style={{ fontSize: 12, padding: '6px 16px' }} onClick={saveSet}>Save</button>
            <button className="crm-btn crm-btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditingSet(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* Colour edit modal */}
      {editingColour && (
        <Modal onClose={() => setEditingColour(null)}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{isNewColour ? 'New Colour' : 'Edit Colour'}</h2>
          <Field label="Label" value={editingColour.label ?? ''} onChange={v => setEditingColour({ ...editingColour, label: v })} />
          <Field label="Code" value={editingColour.code ?? ''} onChange={v => setEditingColour({ ...editingColour, code: v })} mono />
          <Field label="Short Description" value={editingColour.shortDescription ?? ''} onChange={v => setEditingColour({ ...editingColour, shortDescription: v })} />
          <Field label="Description" value={editingColour.description ?? ''} onChange={v => setEditingColour({ ...editingColour, description: v })} multiline />
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="Hex Start" value={editingColour.hex ?? ''} onChange={v => setEditingColour({ ...editingColour, hex: v })} />
            <Field label="Hex End (gradient)" value={editingColour.hexEnd ?? ''} onChange={v => setEditingColour({ ...editingColour, hexEnd: v || null })} />
            <Field label="Price" value={editingColour.price ?? '0'} onChange={v => setEditingColour({ ...editingColour, price: v })} />
            <Field label="Category" value={editingColour.category ?? ''} onChange={v => setEditingColour({ ...editingColour, category: v })} />
          </div>
          <Field label="Swatch URL" value={editingColour.swatchUrl ?? ''} onChange={v => setEditingColour({ ...editingColour, swatchUrl: v })} />
          <Field label="Image URL" value={editingColour.imageUrl ?? ''} onChange={v => setEditingColour({ ...editingColour, imageUrl: v })} />
          {editingColour.hex && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 16, background: swatchBg(editingColour.hex, editingColour.hexEnd ?? null), border: '1px solid #e5e7eb' }} />
              <span style={{ fontSize: 11, color: '#6b7280' }}>{editingColour.hexEnd ? 'Gradient' : 'Solid'}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <button className="crm-btn crm-btn-primary" style={{ fontSize: 12, padding: '6px 16px' }} onClick={() => saveColour(editingColour.setId!)}>Save</button>
            <button className="crm-btn crm-btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditingColour(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '10%', left: '50%', transform: 'translateX(-50%)', width: 480, maxHeight: '80vh', overflowY: 'auto', background: '#fff', borderRadius: 12, padding: 24, zIndex: 51 }}>
        {children}
      </div>
    </>
  );
}

function Field({ label, value, onChange, mono, multiline }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean; multiline?: boolean }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 3 }}>{label}</label>
      {multiline ? (
        <textarea className="crm-input" style={{ width: '100%', minHeight: 60, fontSize: 12 }} value={value} onChange={e => onChange(e.target.value)} />
      ) : (
        <input className="crm-input" style={{ width: '100%', fontSize: 12, fontFamily: mono ? 'monospace' : 'inherit' }} value={value} onChange={e => onChange(e.target.value)} />
      )}
    </div>
  );
}
