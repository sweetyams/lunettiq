'use client';

import { useState } from 'react';
import { E, str, num, cfgCreate, cfgUpdate, cfgDelete, placementLabel, formatPlacementPrice, placementPrice } from './flow-helpers';
import { ProductSearchModal } from '@/components/crm/ProductSearchModal';

/* ── Left: Step List ── */
export function StepList(p: {
  flows: E[]; activeFlowId: string; setFlowId: (id: string) => void;
  steps: E[]; groups: E[]; placements: E[];
  activeStepId: string; setStepId: (id: string) => void;
  activeGroupId: string; setGroupId: (id: string) => void;
  onReload: () => void;
}) {
  const [addingStep, setAddingStep] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [dragStepIdx, setDragStepIdx] = useState(-1);

  async function reorderSteps(from: number, to: number) {
    if (from === to) return;
    const arr = [...p.steps]; const [m] = arr.splice(from, 1); arr.splice(to, 0, m);
    await Promise.all(arr.map((s, i) => cfgUpdate('step', s.id, { orderIndex: i * 10 })));
    p.onReload();
  }

  async function addStep() {
    if (!newLabel.trim()) return;
    const code = newLabel.trim().toLowerCase().replace(/\s+/g, '_');
    await cfgCreate('step', { flowId: p.activeFlowId, code, label: newLabel.trim(), orderIndex: (p.steps.length + 1) * 10 });
    setNewLabel(''); setAddingStep(false); p.onReload();
  }

  return (
    <div style={{ width: 230, flexShrink: 0 }}>
      <div style={{ marginBottom: 12 }}>
        <select className="crm-input" style={{ width: '100%', fontSize: 12 }} value={p.activeFlowId} onChange={e => p.setFlowId(e.target.value)}>
          {p.flows.map(f => <option key={f.id} value={f.id}>{str(f.label)}</option>)}
        </select>
      </div>
      <div className="crm-card" style={{ padding: 0 }}>
        {p.steps.map((step, si) => {
          const isActive = p.activeStepId === step.id;
          const stepGroups = p.groups.filter(g => g.stepId === step.id);
          return (
            <div key={step.id}>
              <div draggable onDragStart={() => setDragStepIdx(si)}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.boxShadow = '0 -2px 0 var(--crm-text-primary)'; }}
                onDragLeave={e => { e.currentTarget.style.boxShadow = ''; }}
                onDrop={e => { e.currentTarget.style.boxShadow = ''; if (dragStepIdx >= 0) reorderSteps(dragStepIdx, si); setDragStepIdx(-1); }}
                onDragEnd={() => setDragStepIdx(-1)}
                style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--crm-border-light)', background: isActive ? 'var(--crm-surface-active)' : 'transparent', opacity: dragStepIdx === si ? 0.4 : 1 }}>
                <button onClick={() => p.setStepId(step.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', fontSize: 10, background: 'var(--crm-text-primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{si + 1}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--crm-text-primary)' : 'var(--crm-text-secondary)' }}>{str(step.label)}</div>
                  <div style={{ fontSize: 10, color: 'var(--crm-text-tertiary)' }}>
                    {stepGroups.map(g => { const n = p.placements.filter(pl => pl.groupId === g.id).length; return str(g.label) + ' · ' + n; }).join(' | ') || 'No groups'}
                  </div>
                </div>
                </button>
              </div>
            </div>
          );
        })}
        {addingStep ? (
          <div style={{ padding: 8 }}>
            <input className="crm-input" style={{ width: '100%', marginBottom: 4, fontSize: 11 }} placeholder="Step name…" value={newLabel} onChange={e => setNewLabel(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') addStep(); if (e.key === 'Escape') setAddingStep(false); }} />
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="crm-btn crm-btn-primary" style={{ fontSize: 10, padding: '2px 8px' }} onClick={addStep}>Add</button>
              <button className="crm-btn crm-btn-ghost" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => setAddingStep(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button style={{ width: '100%', fontSize: 11, padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crm-text-primary)', fontWeight: 500 }} onClick={() => setAddingStep(true)}>+ Add step</button>
        )}
      </div>
    </div>
  );
}

/* ── Center: Group Editor ── */
export function GroupEditor(p: {
  group: E | null; placements: E[]; choiceMap: Map<string, E>;
  priceRules: E[]; choices: E[]; stepCode?: string;
  ruleSets?: E[]; rules?: E[];
  selPlacementId: string; setSelPlacementId: (id: string) => void;
  onReload: () => void;
  lensColourSets?: { id: string; code: string; label: string }[];
}) {
  const [dragIdx, setDragIdx] = useState(-1);
  const [addingChoice, setAddingChoice] = useState(false);
  const [addMode, setAddMode] = useState<'pick' | 'choice' | 'colour' | null>(null);
  const [search, setSearch] = useState('');
  const [editingPlId, setEditingPlId] = useState('');
  const [editPlLabel, setEditPlLabel] = useState('');
  const [editPlCode, setEditPlCode] = useState('');
  const [editPlBadge, setEditPlBadge] = useState('');
  const [editPlDesc, setEditPlDesc] = useState('');
  const [editChoiceType, setEditChoiceType] = useState('standard');
  const [editColourSetId, setEditColourSetId] = useState('');
  const [productPickerOpen, setProductPickerOpen] = useState(false);

  if (!p.group) return <div style={{ flex: 1 }} />;

  const placedChoiceIds = new Set(p.placements.map(pl => str(pl.choiceId)));
  const available = p.choices.filter(c => !placedChoiceIds.has(c.id) && str(c.status) !== 'archived' && (!search || str(c.label).toLowerCase().includes(search.toLowerCase())));

  async function addPlacement(choiceId: string) {
    await cfgCreate('placement', { groupId: p.group!.id, choiceId, sortOrder: (p.placements.length + 1) * 10 });
    setAddingChoice(false); setSearch(''); p.onReload();
  }

  async function removePlacement(id: string) {
    await cfgDelete('placement', id); p.onReload();
  }

  async function duplicatePlacement(pl: E) {
    const origChoice = p.choiceMap.get(str(pl.choiceId));
    const origCode = origChoice ? str(origChoice.code) : 'choice';
    const origLabel = origChoice ? str(origChoice.label) : 'Choice';
    // Create a new choice with suffixed code
    const newChoice = await cfgCreate('choice', { code: origCode + '_copy', label: origLabel + ' (copy)' });
    const newPl = await cfgCreate('placement', {
      groupId: p.group!.id, choiceId: newChoice.id,
      sortOrder: (p.placements.length + 1) * 10,
      badge: pl.badge ?? null, helpTextOverride: pl.helpTextOverride ?? null,
    });
    // Copy price if exists
    const price = placementPrice(pl.id, p.priceRules);
    if (price) {
      await cfgCreate('priceRule', { ownerType: 'group_choice', ownerId: newPl.id, ruleType: price.type, amount: String(price.amount), currency: 'CAD', label: 'Copied price' });
    }
    p.onReload();
  }

  async function reorder(from: number, to: number) {
    if (from === to) return;
    const arr = [...p.placements]; const [m] = arr.splice(from, 1); arr.splice(to, 0, m);
    await Promise.all(arr.map((pl, i) => cfgUpdate('placement', pl.id, { sortOrder: i * 10 })));
    p.onReload();
  }

  async function setMode(m: string) {
    if (str(p.group!.selectionMode) !== m) { await cfgUpdate('group', p.group!.id, { selectionMode: m }); p.onReload(); }
  }
  async function setRequired(v: boolean) {
    if (!!p.group!.isRequired !== v) { await cfgUpdate('group', p.group!.id, { isRequired: v }); p.onReload(); }
  }

  async function createAndPlace(label: string) {
    const code = label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const choice = await cfgCreate('choice', { code, label: label.trim() });
    await cfgCreate('placement', { groupId: p.group!.id, choiceId: choice.id, sortOrder: (p.placements.length + 1) * 10 });
    setAddingChoice(false); setSearch(''); p.onReload();
  }

  async function handleProductSelect(product: { shopifyProductId: string; title: string; imageUrl?: string | null }) {
    // Reuse existing choice for this product, or create new
    const existing = p.choices.find(c => str(c.shopifyProductId) === product.shopifyProductId);
    let choiceId: string;
    if (existing) {
      choiceId = existing.id;
    } else {
      const code = 'prod_' + product.shopifyProductId + '_' + Date.now();
      const choice = await cfgCreate('choice', { code, label: product.title, shopifyProductId: product.shopifyProductId, imageUrl: product.imageUrl ?? null, choiceType: 'product' });
      choiceId = choice.id;
    }
    await cfgCreate('placement', { groupId: p.group!.id, choiceId, sortOrder: (p.placements.length + 1) * 10 });
    setProductPickerOpen(false); p.onReload();
  }

  async function handleColourSetSelect(setId: string, setLabel: string) {
    const code = 'colour_' + setLabel.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const choice = await cfgCreate('choice', { code, label: setLabel, choiceType: 'colour', lensColourSetId: setId });
    await cfgCreate('placement', { groupId: p.group!.id, choiceId: choice.id, sortOrder: (p.placements.length + 1) * 10 });
    setAddMode(null); p.onReload();
  }

  async function handleAddContent() {
    const label = 'Content Block';
    const code = 'content_' + Date.now();
    const choice = await cfgCreate('choice', { code, label, choiceType: 'content' });
    await cfgCreate('placement', { groupId: p.group!.id, choiceId: choice.id, sortOrder: (p.placements.length + 1) * 10 });
    p.onReload();
  }

  async function savePlacementEdit(pl: E) {
    const choiceId = str(pl.choiceId);
    const origChoice = p.choiceMap.get(choiceId);
    const origLabel = origChoice ? str(origChoice.label) : '';
    const newLabel = editPlLabel.trim();
    const newCode = editPlCode.trim();
    // Update choice label + code if changed
    if (origChoice && (newLabel !== origLabel || newCode !== str(origChoice.code))) {
      await cfgUpdate('choice', choiceId, {
        ...(newLabel && newLabel !== origLabel ? { label: newLabel } : {}),
        ...(newCode && newCode !== str(origChoice.code) ? { code: newCode } : {}),
      });
    }
    // Set labelOverride if different from choice label
    const finalChoiceLabel = newLabel || origLabel;
    const currentOverride = str(pl.labelOverride);
    if (newLabel && newLabel !== finalChoiceLabel && newLabel !== currentOverride) {
      await cfgUpdate('placement', pl.id, { labelOverride: newLabel });
    }
    // Update badge
    const newBadge = editPlBadge.trim() || null;
    if (newBadge !== (pl.badge ?? null)) {
      await cfgUpdate('placement', pl.id, { badge: newBadge });
    }
    // Update description
    const newDesc = editPlDesc.trim() || null;
    if (newDesc !== (pl.helpTextOverride ?? null)) {
      await cfgUpdate('placement', pl.id, { helpTextOverride: newDesc });
    }
    // Update choice type + colour set
    if (origChoice) {
      const updates: Record<string, unknown> = {};
      if (editChoiceType !== (str(origChoice.choiceType) || 'standard')) updates.choiceType = editChoiceType;
      if (editColourSetId !== (str(origChoice.lensColourSetId) || '')) updates.lensColourSetId = editColourSetId || null;
      if (Object.keys(updates).length) await cfgUpdate('choice', choiceId, updates);
    }
    setEditingPlId(''); p.onReload();
  }

  const curMode = str(p.group.selectionMode);
  const curReq = !!p.group.isRequired;

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <BtnGroup items={[{ key: 'single', label: '◉ Choose one' }, { key: 'multi', label: '☑ Choose any' }]} value={curMode} onChange={setMode} />
        <BtnGroup items={[{ key: 'true', label: '✓ Required' }, { key: 'false', label: '○ Optional' }]} value={String(curReq)} onChange={v => setRequired(v === 'true')} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {p.placements.map((pl, idx) => {
          const label = placementLabel(pl, p.choiceMap);
          const price = formatPlacementPrice(pl.id, p.priceRules);
          const isSel = p.selPlacementId === pl.id;
          const isEditing = editingPlId === pl.id;
          const choice = p.choiceMap.get(str(pl.choiceId));

          if (isEditing) {
            return (
              <div key={pl.id} className="crm-card" style={{ padding: '10px 14px' }}>
                <label style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', display: 'block', marginBottom: 2 }}>Display name</label>
                <input className="crm-input" style={{ width: '100%', fontSize: 12, marginBottom: 6 }} value={editPlLabel} onChange={e => setEditPlLabel(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') savePlacementEdit(pl); if (e.key === 'Escape') setEditingPlId(''); }} />
                <label style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', display: 'block', marginBottom: 2 }}>Internal code</label>
                <input className="crm-input" style={{ width: '100%', fontSize: 12, marginBottom: 6 }} value={editPlCode} onChange={e => setEditPlCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') savePlacementEdit(pl); if (e.key === 'Escape') setEditingPlId(''); }} />
                <label style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', display: 'block', marginBottom: 2 }}>Badge <span style={{ fontWeight: 400 }}>(e.g. Most Popular)</span></label>
                <input className="crm-input" style={{ width: '100%', fontSize: 12, marginBottom: 6 }} value={editPlBadge} onChange={e => setEditPlBadge(e.target.value)} placeholder="Leave empty for none" onKeyDown={e => { if (e.key === 'Enter') savePlacementEdit(pl); if (e.key === 'Escape') setEditingPlId(''); }} />
                <label style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', display: 'block', marginBottom: 2 }}>Description</label>
                <input className="crm-input" style={{ width: '100%', fontSize: 12, marginBottom: 6 }} value={editPlDesc} onChange={e => setEditPlDesc(e.target.value)} placeholder="Short description for customers" onKeyDown={e => { if (e.key === 'Enter') savePlacementEdit(pl); if (e.key === 'Escape') setEditingPlId(''); }} />
                {editChoiceType === 'colour' && (
                  <>
                    <label style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', display: 'block', marginBottom: 2 }}>Colour Set</label>
                    <select className="crm-input" style={{ width: '100%', fontSize: 12, marginBottom: 6 }} value={editColourSetId} onChange={e => setEditColourSetId(e.target.value)}>
                      <option value="">— Select colour set —</option>
                      {(p.lensColourSets ?? []).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </>
                )}
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="crm-btn crm-btn-primary" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => savePlacementEdit(pl)}>Save</button>
                  <button className="crm-btn crm-btn-ghost" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => setEditingPlId('')}>Cancel</button>
                </div>
              </div>
            );
          }

          const cType = choice ? str(choice.choiceType) || 'standard' : 'standard';
          const actions = (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <span className="crm-badge" style={{ background: price === 'included' ? 'var(--crm-surface-hover)' : 'var(--crm-success-light)', color: price === 'included' ? 'var(--crm-text-tertiary)' : 'var(--crm-success)' }}>{price}</span>
              <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={e => { e.stopPropagation(); setEditingPlId(pl.id); setEditPlLabel(label); setEditPlCode(choice ? str(choice.code) : ''); setEditPlBadge(str(pl.badge)); setEditPlDesc(str(pl.helpTextOverride) || (choice ? str(choice.description) : '')); setEditChoiceType(cType); setEditColourSetId(choice ? str(choice.lensColourSetId) || '' : ''); }}>✎</button>
              <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: 'var(--crm-error)' }} onClick={e => { e.stopPropagation(); removePlacement(pl.id); }}>✕</button>
            </div>
          );

          return (
            <div key={pl.id} draggable onDragStart={() => setDragIdx(idx)}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.boxShadow = '0 -2px 0 var(--crm-text-primary)'; }}
              onDragLeave={e => { e.currentTarget.style.boxShadow = ''; }}
              onDrop={e => { e.currentTarget.style.boxShadow = ''; if (dragIdx >= 0) reorder(dragIdx, idx); setDragIdx(-1); }}
              onDragEnd={() => setDragIdx(-1)}
              onClick={() => p.setSelPlacementId(isSel ? '' : pl.id)}
              className="crm-card" style={{ padding: 0, cursor: 'pointer', opacity: dragIdx === idx ? 0.4 : 1, borderColor: isSel ? 'var(--crm-text-primary)' : undefined, overflow: 'hidden' }}>

              {/* Product row */}
              {cType === 'product' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px' }}>
                  <span style={{ cursor: 'grab', color: '#d1d5db', fontSize: 11, userSelect: 'none' }}>⠿</span>
                  {choice?.imageUrl ? <img src={str(choice.imageUrl)} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} /> : <div style={{ width: 36, height: 36, borderRadius: 6, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="1.5"><rect x="3" y="6" width="14" height="11" rx="1.5"/><path d="M7 6V4a3 3 0 0 1 6 0v2"/></svg></div>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>Product add-on · Price from Shopify</div>
                  </div>
                  {actions}
                </div>
              )}

              {/* Colour row */}
              {cType === 'colour' && (() => {
                const setId = choice ? str(choice.lensColourSetId) : '';
                const setLabel = (p.lensColourSets ?? []).find(s => s.id === setId)?.label;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px' }}>
                    <span style={{ cursor: 'grab', color: '#d1d5db', fontSize: 11, userSelect: 'none' }}>⠿</span>
                    <div style={{ width: 36, height: 36, borderRadius: 18, background: 'linear-gradient(135deg, #e879f9, #a78bfa, #60a5fa)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>{setLabel ? `Set: ${setLabel} · Price per colour` : 'No colour set linked'}</div>
                    </div>
                    {actions}
                  </div>
                );
              })()}

              {/* Content row */}
              {cType === 'content' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: '#fafafa' }}>
                  <span style={{ cursor: 'grab', color: '#d1d5db', fontSize: 11, userSelect: 'none' }}>⠿</span>
                  <div style={{ width: 36, height: 36, borderRadius: 6, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="1.5"><rect x="3" y="2" width="14" height="16" rx="1.5"/><line x1="6" y1="6" x2="14" y2="6"/><line x1="6" y1="9.5" x2="14" y2="9.5"/><line x1="6" y1="13" x2="11" y2="13"/></svg></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>Content block · Display only</div>
                  </div>
                  {actions}
                </div>
              )}

              {/* Standard row */}
              {cType === 'standard' && (
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ cursor: 'grab', color: '#d1d5db', fontSize: 11, userSelect: 'none' }}>⠿</span>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{label}</span>
                      {str(pl.badge) && <span className="crm-badge" style={{ fontSize: 9, background: 'var(--crm-surface-hover)', color: 'var(--crm-text-secondary)' }}>{str(pl.badge)}</span>}
                    </div>
                    {actions}
                  </div>
                  {(str(pl.helpTextOverride) || (choice ? str(choice.description) : '')) && (
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3, marginLeft: 26 }}>{str(pl.helpTextOverride) || str(choice?.description)}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {addMode === 'colour' && (
        <div style={{ marginTop: 6, padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(p.lensColourSets ?? []).map(s => (
              <button key={s.id} onClick={() => handleColourSetSelect(s.id, s.label)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 11 }}>
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="#6b7280" strokeWidth="1.5"><circle cx="10" cy="10" r="7"/><circle cx="7" cy="9" r="1.5" fill="#6b7280"/><circle cx="10" cy="6.5" r="1.5" fill="#6b7280"/><circle cx="13" cy="9" r="1.5" fill="#6b7280"/></svg> {s.label}
              </button>
            ))}
            {!(p.lensColourSets ?? []).length && <div style={{ fontSize: 11, color: '#9ca3af', padding: 4 }}>No colour sets yet.</div>}
          </div>
          <button style={{ fontSize: 10, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }} onClick={() => setAddMode(null)}>Cancel</button>
        </div>
      )}

      {addingChoice ? (
        <div style={{ marginTop: 6, padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa' }}>
          <input className="crm-input" style={{ width: '100%', marginBottom: 4, fontSize: 11 }} placeholder="Type a name and press Enter…" value={search} onChange={e => setSearch(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter' && search.trim()) createAndPlace(search); if (e.key === 'Escape') { setAddingChoice(false); setAddMode(null); setSearch(''); } }} />
          <button className="crm-btn crm-btn-ghost" style={{ fontSize: 10 }} onClick={() => { setAddingChoice(false); setAddMode(null); setSearch(''); }}>Cancel</button>
        </div>
      ) : !addMode && (
        <div style={{ marginTop: 6, display: 'flex', gap: 3 }}>
          <button onClick={() => { setAddMode('choice'); setAddingChoice(true); }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 0', borderRadius: 6, border: '1px dashed #d1d5db', background: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 500, color: '#6b7280' }}>
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="7"/><circle cx="10" cy="10" r="3" fill="currentColor"/></svg>
            Choice
          </button>
          <button onClick={() => setProductPickerOpen(true)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 0', borderRadius: 6, border: '1px dashed #d1d5db', background: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 500, color: '#6b7280' }}>
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="6" width="14" height="11" rx="1.5"/><path d="M7 6V4a3 3 0 0 1 6 0v2"/></svg>
            Product
          </button>
          <button onClick={() => setAddMode('colour')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 0', borderRadius: 6, border: '1px dashed #d1d5db', background: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 500, color: '#6b7280' }}>
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="7"/><circle cx="7" cy="9" r="1.5" fill="currentColor"/><circle cx="10" cy="6.5" r="1.5" fill="currentColor"/><circle cx="13" cy="9" r="1.5" fill="currentColor"/></svg>
            Colour
          </button>
          <button onClick={handleAddContent} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 0', borderRadius: 6, border: '1px dashed #d1d5db', background: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 500, color: '#6b7280' }}>
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="2" width="14" height="16" rx="1.5"/><line x1="6" y1="6" x2="14" y2="6"/><line x1="6" y1="9.5" x2="14" y2="9.5"/><line x1="6" y1="13" x2="11" y2="13"/></svg>
            Content
          </button>
        </div>
      )}

      <ProductSearchModal open={productPickerOpen} onClose={() => setProductPickerOpen(false)} onSelect={handleProductSelect} />
    </div>
  );
}

/* ── Center: Step Editor (shows all groups in a step) ── */
export function StepEditor(p: {
  step: E | null; steps: E[]; groups: E[]; allPlacements: E[]; choiceMap: Map<string, E>;
  priceRules: E[]; choices: E[];
  ruleSets: E[]; rules: E[]; clauses: E[];
  selPlacementId: string; setSelPlacementId: (id: string) => void;
  onReload: () => void; onDeleteStep: (id: string) => void;
  lensColourSets?: { id: string; code: string; label: string }[];
}) {
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [editingGroupId, setEditingGroupId] = useState('');
  const [editGroupLabel, setEditGroupLabel] = useState('');
  const [editGroupCode, setEditGroupCode] = useState('');
  const [addingStepCondition, setAddingStepCondition] = useState(false);
  const [editingStepName, setEditingStepName] = useState(false);
  const [stepNameVal, setStepNameVal] = useState('');
  const [stepCodeVal, setStepCodeVal] = useState('');
  const [dragGroupIdx, setDragGroupIdx] = useState(-1);

  if (!p.step) return <div style={{ flex: 1 }} />;

  const stepGroups = p.groups
    .filter(g => g.stepId === p.step!.id && str(g.status) !== 'archived')
    .sort((a, b) => num(a.sortOrder) - num(b.sortOrder));

  async function addGroup() {
    if (!newGroupLabel.trim()) return;
    const code = newGroupLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    await cfgCreate('group', { stepId: p.step!.id, code, label: newGroupLabel.trim(), selectionMode: 'single', isRequired: true, sortOrder: (stepGroups.length + 1) * 10 });
    setNewGroupLabel(''); setAddingGroup(false); p.onReload();
  }

  async function renameGroup(id: string) {
    if (!editGroupLabel.trim()) { setEditingGroupId(''); return; }
    await cfgUpdate('group', id, { label: editGroupLabel.trim(), ...(editGroupCode.trim() ? { code: editGroupCode.trim() } : {}) });
    setEditingGroupId(''); p.onReload();
  }

  async function deleteGroup(id: string) {
    if (!confirm('Delete this group and all its choices?')) return;
    const gPlacements = p.allPlacements.filter(pl => pl.groupId === id);
    for (const pl of gPlacements) await cfgDelete('placement', pl.id);
    await cfgDelete('group', id);
    p.onReload();
  }

  async function reorderGroups(from: number, to: number) {
    if (from === to) return;
    const arr = [...stepGroups]; const [m] = arr.splice(from, 1); arr.splice(to, 0, m);
    await Promise.all(arr.map((g, i) => cfgUpdate('group', g.id, { sortOrder: i * 10 })));
    p.onReload();
  }

  async function renameStep() {
    if (!stepNameVal.trim()) { setEditingStepName(false); return; }
    await cfgUpdate('step', p.step!.id, { label: stepNameVal.trim(), ...(stepCodeVal.trim() ? { code: stepCodeVal.trim() } : {}) });
    setEditingStepName(false); p.onReload();
  }

  // Step visibility conditions
  const stepRsId = str(p.step.visibilityRuleSetId);
  const stepRuleSet = stepRsId ? p.ruleSets.find(r => r.id === stepRsId) ?? null : null;
  const stepRules = stepRuleSet ? p.rules.filter(r => r.ruleSetId === stepRuleSet.id && str(r.status) !== 'archived') : [];
  // Prior groups (from earlier steps in same flow)
  const flowId = str(p.step.flowId);
  const allFlowSteps = p.steps.filter(s => str(s.flowId) === flowId && str(s.status) !== 'archived').sort((a, b) => num(a.orderIndex) - num(b.orderIndex));
  const curStepIdx = allFlowSteps.findIndex(s => s.id === p.step!.id);
  const priorSteps = curStepIdx > 0 ? allFlowSteps.slice(0, curStepIdx) : [];
  const priorStepIds = new Set(priorSteps.map(s => s.id));
  const priorGroups = p.groups.filter(g => priorStepIds.has(str(g.stepId)) && str(g.status) !== 'archived');

  async function deleteStepRule(ruleId: string) {
    const rc = p.clauses.filter(c => c.ruleId === ruleId);
    for (const c of rc) await cfgDelete('clause', c.id);
    await cfgDelete('rule', ruleId);
    if (stepRules.filter(r => r.id !== ruleId).length === 0 && stepRuleSet) {
      await cfgUpdate('step', p.step!.id, { visibilityRuleSetId: null });
      await cfgDelete('ruleSet', stepRuleSet.id);
    }
    p.onReload();
  }

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* ── Step Settings ── */}
      <div className="crm-card" style={{ padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          {editingStepName ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <input className="crm-input" style={{ fontSize: 14, fontWeight: 600 }} value={stepNameVal} onChange={e => setStepNameVal(e.target.value)} autoFocus placeholder="Label" onKeyDown={e => { if (e.key === 'Enter') renameStep(); if (e.key === 'Escape') setEditingStepName(false); }} />
              <input className="crm-input" style={{ fontSize: 11, fontFamily: 'monospace' }} value={stepCodeVal} onChange={e => setStepCodeVal(e.target.value)} placeholder="internal_code" onKeyDown={e => { if (e.key === 'Enter') renameStep(); if (e.key === 'Escape') setEditingStepName(false); }} />
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="crm-btn crm-btn-primary" style={{ fontSize: 10, padding: '2px 8px' }} onClick={renameStep}>Save</button>
                <button className="crm-btn crm-btn-ghost" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => setEditingStepName(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{str(p.step.label)} <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--crm-text-tertiary)', fontWeight: 400 }}>{str(p.step.code)}</span></div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => { setEditingStepName(true); setStepNameVal(str(p.step!.label)); setStepCodeVal(str(p.step!.code)); }}>✎ Edit</button>
                <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: 'var(--crm-error)' }} onClick={() => p.onDeleteStep(p.step!.id)}>✕ Delete</button>
              </div>
            </>
          )}
        </div>

        {/* Visibility */}
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--crm-text-tertiary)', marginBottom: 4 }}>Visibility</div>
        {stepRuleSet && stepRules.length >= 1 && (
          <div style={{ marginBottom: 4 }}>
            <BtnGroup items={[{ key: 'AND', label: 'All must match' }, { key: 'OR', label: 'Any can match' }]} value={str(stepRuleSet.logicOperator) || 'AND'} onChange={async v => { await cfgUpdate('ruleSet', stepRuleSet.id, { logicOperator: v }); p.onReload(); }} />
          </div>
        )}
        {stepRules.length === 0 && !addingStepCondition && (
          <div style={{ fontSize: 11, color: 'var(--crm-text-tertiary)', marginBottom: 4 }}>Always shown</div>
        )}
        {stepRules.map(rule => (
          <EditableCondition key={rule.id} rule={rule} clauses={p.clauses} groups={priorGroups} steps={priorSteps} choices={p.choices} choiceMap={p.choiceMap} placements={p.allPlacements} onDelete={() => deleteStepRule(rule.id)} onReload={p.onReload} />
        ))}
        {addingStepCondition ? (
          <AddStepConditionForm step={p.step} ruleSet={stepRuleSet} priorGroups={priorGroups} priorSteps={priorSteps} choices={p.choices} choiceMap={p.choiceMap} placements={p.allPlacements} onDone={() => { setAddingStepCondition(false); p.onReload(); }} onCancel={() => setAddingStepCondition(false)} />
        ) : (
          <button style={{ fontSize: 10, padding: '2px 0', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crm-text-primary)', fontWeight: 500 }} onClick={() => setAddingStepCondition(true)}>+ Add condition</button>
        )}

        {/* Auto-advance */}
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--crm-text-tertiary)', marginBottom: 4 }}>Advance</div>
          <BtnGroup items={[{ key: 'false', label: 'Select & confirm' }, { key: 'true', label: 'Select to advance' }]} value={String(!!p.step.autoAdvance)} onChange={async v => { await cfgUpdate('step', p.step!.id, { autoAdvance: v === 'true' }); p.onReload(); }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--crm-text-tertiary)' }}>Groups ({stepGroups.length})</span>
      </div>

      {stepGroups.map((group, gi) => {
        const groupPlacements = p.allPlacements
          .filter(pl => pl.groupId === group.id && str(pl.status) !== 'archived')
          .sort((a, b) => num(a.sortOrder) - num(b.sortOrder));

        return (
          <div key={group.id} className="crm-card" draggable
            onDragStart={() => setDragGroupIdx(gi)}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.boxShadow = '0 -2px 0 var(--crm-text-primary)'; }}
            onDragLeave={e => { e.currentTarget.style.boxShadow = ''; }}
            onDrop={e => { e.currentTarget.style.boxShadow = ''; if (dragGroupIdx >= 0) reorderGroups(dragGroupIdx, gi); setDragGroupIdx(-1); }}
            onDragEnd={() => setDragGroupIdx(-1)}
            style={{ padding: 0, marginBottom: 12, overflow: 'hidden', opacity: dragGroupIdx === gi ? 0.4 : 1 }}>
            {/* Group header bar */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--crm-border-light)', background: 'var(--crm-surface-hover)' }}>
              {editingGroupId === group.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <input className="crm-input" style={{ fontSize: 12 }} value={editGroupLabel} onChange={e => setEditGroupLabel(e.target.value)} autoFocus placeholder="Label" onKeyDown={e => { if (e.key === 'Enter') renameGroup(group.id); if (e.key === 'Escape') setEditingGroupId(''); }} />
                  <input className="crm-input" style={{ fontSize: 11, fontFamily: 'monospace' }} value={editGroupCode} onChange={e => setEditGroupCode(e.target.value)} placeholder="internal_code" onKeyDown={e => { if (e.key === 'Enter') renameGroup(group.id); if (e.key === 'Escape') setEditingGroupId(''); }} />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="crm-btn crm-btn-primary" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => renameGroup(group.id)}>Save</button>
                    <button className="crm-btn crm-btn-ghost" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => setEditingGroupId('')}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{str(group.label)} <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--crm-text-tertiary)', fontWeight: 400 }}>{str(group.code)}</span></span>
                    <span style={{ fontSize: 10, color: 'var(--crm-text-tertiary)' }}>{groupPlacements.length} choice{groupPlacements.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => { setEditingGroupId(group.id); setEditGroupLabel(str(group.label)); setEditGroupCode(str(group.code)); }}>✎</button>
                    {stepGroups.length > 1 && <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: 'var(--crm-error)' }} onClick={() => deleteGroup(group.id)}>✕</button>}
                  </div>
                </div>
              )}
            </div>
            {/* Group body */}
            <div style={{ padding: '12px 14px' }}>
              <GroupEditor
                group={group} placements={groupPlacements} choiceMap={p.choiceMap}
                priceRules={p.priceRules} choices={p.choices} stepCode={str(p.step!.code)}
                ruleSets={p.ruleSets} rules={p.rules}
                selPlacementId={p.selPlacementId} setSelPlacementId={p.setSelPlacementId}
                onReload={p.onReload}
                lensColourSets={p.lensColourSets}
              />
            </div>
          </div>
        );
      })}

      {addingGroup ? (
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          <input className="crm-input" style={{ flex: 1, fontSize: 12 }} placeholder="Group name…" value={newGroupLabel} onChange={e => setNewGroupLabel(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') addGroup(); if (e.key === 'Escape') setAddingGroup(false); }} />
          <button className="crm-btn crm-btn-primary" style={{ fontSize: 10, padding: '2px 8px' }} onClick={addGroup}>Add</button>
          <button className="crm-btn crm-btn-ghost" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => setAddingGroup(false)}>Cancel</button>
        </div>
      ) : (
        <button style={{ width: '100%', fontSize: 11, marginTop: 8, padding: '6px 0', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crm-text-primary)', fontWeight: 500 }} onClick={() => setAddingGroup(true)}>+ Add group</button>
      )}
    </div>
  );
}

/* ── Right: Inspector ── */
export function Inspector(p: {
  placement: E | null; choiceMap: Map<string, E>;
  priceRules: E[]; ruleSets: E[]; rules: E[]; clauses: E[];
  choices: E[]; groups: E[]; steps: E[]; placements: E[];
  onReload: () => void;
}) {
  const [editPrice, setEditPrice] = useState(false);
  const [priceAmt, setPriceAmt] = useState('');
  const [priceType, setPriceType] = useState('delta');
  const [addingCondition, setAddingCondition] = useState(false);

  if (!p.placement) return (
    <div style={{ width: 280, flexShrink: 0 }}>
      <div className="crm-card" style={{ padding: 32, textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 11 }}>Select a choice to inspect</div>
    </div>
  );

  const pl = p.placement;
  const choice = p.choiceMap.get(str(pl.choiceId));
  const label = pl.labelOverride ? str(pl.labelOverride) : choice ? str(choice.label) : '';
  const price = placementPrice(pl.id, p.priceRules);

  // Resolve existing conditions
  const rsId = str(pl.availabilityRuleSetId);
  const ruleSet = rsId ? p.ruleSets.find(r => r.id === rsId) ?? null : null;
  const setRules = ruleSet ? p.rules.filter(r => r.ruleSetId === ruleSet.id && str(r.status) !== 'archived') : [];

  // Prior groups (from earlier steps in same flow)
  const plGroup = p.groups.find(g => g.id === pl.groupId);
  const plStep = plGroup ? p.steps.find(s => s.id === plGroup.stepId) : null;
  const plFlowId = plStep ? str(plStep.flowId) : '';
  const flowSteps = p.steps.filter(s => str(s.flowId) === plFlowId && str(s.status) !== 'archived').sort((a, b) => num(a.orderIndex) - num(b.orderIndex));
  const plStepIdx = plStep ? flowSteps.findIndex(s => s.id === plStep.id) : -1;
  const priorSteps = plStepIdx > 0 ? flowSteps.slice(0, plStepIdx) : [];
  const priorStepIds = new Set(priorSteps.map(s => s.id));
  const priorGroups = p.groups.filter(g => priorStepIds.has(str(g.stepId)) && str(g.status) !== 'archived');

  async function savePrice() {
    const amt = priceAmt.trim();
    if (!amt) { setEditPrice(false); return; }
    if (price) {
      await cfgUpdate('priceRule', price.id, { amount: amt, ruleType: priceType });
    } else {
      await cfgCreate('priceRule', { ownerType: 'group_choice', ownerId: pl.id, ruleType: priceType, amount: amt, currency: 'CAD', label: label + ' price' });
    }
    setEditPrice(false); p.onReload();
  }

  async function deleteRule(ruleId: string) {
    // Delete clauses first, then rule
    const rc = p.clauses.filter(c => c.ruleId === ruleId);
    for (const c of rc) await cfgDelete('clause', c.id);
    await cfgDelete('rule', ruleId);
    // If no rules left, remove ruleSet and unlink
    const remaining = setRules.filter(r => r.id !== ruleId);
    if (remaining.length === 0 && ruleSet) {
      await cfgUpdate('placement', pl.id, { availabilityRuleSetId: null });
      await cfgDelete('ruleSet', ruleSet.id);
    }
    p.onReload();
  }

  return (
    <div style={{ width: 280, flexShrink: 0 }}>
      <div className="crm-card" style={{ padding: '14px 16px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>{label}</h3>
        <div style={{ fontSize: 11, color: 'var(--crm-text-tertiary)', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
          {choice && str(choice.choiceType) && str(choice.choiceType) !== 'standard' && (
            <div style={{ marginBottom: 2 }}>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: str(choice.choiceType) === 'product' ? '#dbeafe' : str(choice.choiceType) === 'colour' ? '#fae8ff' : '#f3f4f6', color: str(choice.choiceType) === 'product' ? '#1e40af' : str(choice.choiceType) === 'colour' ? '#86198f' : '#6b7280' }}>{str(choice.choiceType)}</span>
            </div>
          )}
          <div>Internal name: <strong style={{ color: 'var(--crm-text-secondary)' }}>{choice ? str(choice.code) : ''}</strong></div>
          {choice && str(choice.shopifyProductId) && <div>Shopify ID: <code style={{ fontSize: 10, background: 'var(--crm-surface-hover)', padding: '1px 4px', borderRadius: 3 }}>{str(choice.shopifyProductId)}</code></div>}
          {choice && str(choice.lensColourSetId) && <div>Colour set: <code style={{ fontSize: 10, background: 'var(--crm-surface-hover)', padding: '1px 4px', borderRadius: 3 }}>{str(choice.lensColourSetId).slice(0, 8)}…</code></div>}
          {(() => { const g = p.groups.find(g => g.id === pl.groupId); const s = g ? p.steps.find(s => s.id === g.stepId) : null; return s && choice ? <div>Path: <code style={{ fontSize: 10, background: 'var(--crm-surface-hover)', padding: '1px 4px', borderRadius: 3 }}>{str(s.code)}.{str(choice.code)}</code></div> : null; })()}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Price: <strong style={{ color: 'var(--crm-text-secondary)' }}>{price ? (price.type === 'override' ? '$' + price.amount : '+$' + price.amount) : 'included'}</strong>
            <button className="crm-btn crm-btn-ghost" style={{ fontSize: 10, padding: '1px 6px' }} onClick={() => { setEditPrice(!editPrice); setPriceAmt(price ? String(price.amount) : ''); setPriceType(price?.type || 'delta'); }}>✎</button>
          </div>
          {editPrice && (
            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
              <input className="crm-input" style={{ width: 70, fontSize: 11 }} type="number" step="0.01" value={priceAmt} onChange={e => setPriceAmt(e.target.value)} />
              <select className="crm-input" style={{ width: 70, fontSize: 11 }} value={priceType} onChange={e => setPriceType(e.target.value)}><option value="delta">+delta</option><option value="override">fixed</option></select>
              <button className="crm-btn crm-btn-primary" style={{ fontSize: 11, padding: '4px 8px' }} onClick={savePrice}>Save</button>
            </div>
          )}
          <div>Visible: <strong style={{ color: pl.isVisible !== false ? 'var(--crm-success)' : 'var(--crm-error)' }}>{pl.isVisible !== false ? 'Yes' : 'No'}</strong></div>
        </div>

        {/* ── Conditions ── */}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--crm-text-secondary)', marginBottom: 6 }}>Conditions</div>

        {ruleSet && setRules.length >= 1 && (
          <div style={{ marginBottom: 6 }}>
            <BtnGroup items={[{ key: 'AND', label: 'All must match' }, { key: 'OR', label: 'Any can match' }]} value={str(ruleSet.logicOperator) || 'AND'} onChange={async v => { await cfgUpdate('ruleSet', ruleSet.id, { logicOperator: v }); p.onReload(); }} />
          </div>
        )}

        {setRules.length === 0 && !addingCondition && (
          <div style={{ fontSize: 11, color: 'var(--crm-text-tertiary)', fontStyle: 'italic', marginBottom: 8 }}>Always shown — no conditions.</div>
        )}

        {setRules.map(rule => (
          <EditableCondition key={rule.id} rule={rule} clauses={p.clauses} groups={priorGroups} steps={priorSteps} choices={p.choices} choiceMap={p.choiceMap} placements={p.placements} onDelete={() => deleteRule(rule.id)} onReload={p.onReload} />
        ))}

        {addingCondition ? (
          <AddConditionForm
            placement={pl}
            ruleSet={ruleSet}
            groups={priorGroups}
            steps={priorSteps}
            choices={p.choices}
            choiceMap={p.choiceMap}
            placements={p.placements}
            onDone={() => { setAddingCondition(false); p.onReload(); }}
            onCancel={() => setAddingCondition(false)}
          />
        ) : (
          <button style={{ width: '100%', fontSize: 11, marginTop: 4, padding: '5px 0', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crm-text-primary)', fontWeight: 500 }} onClick={() => setAddingCondition(true)}>+ Add condition</button>
        )}
      </div>
    </div>
  );
}

/* ── Editable condition row ── */
function EditableCondition({ rule, clauses, groups, steps, choices, choiceMap, placements, allPlacements, onDelete, onReload }: {
  rule: E; clauses: E[]; groups: E[]; steps: E[]; choices: E[];
  choiceMap: Map<string, E>; placements: E[]; allPlacements?: E[];
  onDelete: () => void; onReload: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const rc = clauses.filter(c => c.ruleId === rule.id);
  const clause = rc[0];

  // Derive current values from props (not stale state)
  const savedEffect = str(rule.effectType);
  const savedGroupId = clause ? str(clause.leftOperandRef) : '';
  const savedOperator = clause ? str(clause.operator) : 'is_any_of';
  const savedSelIds = clause ? new Set(str(clause.rightOperandRef).split(',').filter(Boolean)) : new Set<string>();

  // Edit state — reset when entering edit mode
  const [effect, setEffect] = useState(savedEffect);
  const [groupId, setGroupId] = useState(savedGroupId);
  const [operator, setOperator] = useState(savedOperator);
  const [selIds, setSelIds] = useState<Set<string>>(savedSelIds);

  function startEdit() {
    setEffect(savedEffect);
    setGroupId(savedGroupId);
    setOperator(savedOperator);
    setSelIds(new Set(savedSelIds));
    setEditing(true);
  }

  // Use allPlacements for choice lookup (need all placements to find choices in referenced groups)
  const lookupPlacements = allPlacements ?? placements;
  const groupPlacements = groupId ? lookupPlacements.filter(p => p.groupId === groupId && str(p.status) !== 'archived') : [];
  const groupChoices = groupPlacements.map(p => choiceMap.get(str(p.choiceId))).filter((c): c is E => !!c);

  async function save() {
    await cfgUpdate('rule', rule.id, { effectType: 'show' });
    if (clause) {
      const needsRight = ['is', 'is_not', 'is_any_of', 'is_none_of'].includes(operator);
      await cfgUpdate('clause', clause.id, {
        leftOperandRef: groupId, operator,
        rightOperandType: needsRight ? 'set' : 'literal',
        rightOperandRef: needsRight ? Array.from(selIds).join(',') : '',
      });
    }
    setEditing(false); onReload();
  }

  if (editing) {
    return (
      <div style={{ padding: '8px 10px', marginBottom: 6, borderRadius: 6, border: '1px solid var(--crm-border)', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontWeight: 500, marginBottom: 2 }}>Show when:</div>
        <select className="crm-input" style={{ fontSize: 11 }} value={groupId} onChange={e => { setGroupId(e.target.value); setSelIds(new Set()); }}>
          <option value="">Select a group…</option>
          {groups.filter(g => str(g.status) !== 'archived').map(g => {
            const s = steps.find(s => s.id === g.stepId);
            return <option key={g.id} value={g.id}>{s ? str(s.label) + ' → ' : ''}{str(g.label)}</option>;
          })}
        </select>
        <select className="crm-input" style={{ fontSize: 11 }} value={operator} onChange={e => setOperator(e.target.value)}>
          <option value="is_any_of">is any of</option><option value="is_none_of">is none of</option>
          <option value="selected">has any selection</option><option value="not_selected">has no selection</option>
        </select>
        {['is', 'is_not', 'is_any_of', 'is_none_of'].includes(operator) && (
          <div style={{ maxHeight: 100, overflow: 'auto', border: '1px solid var(--crm-border-light)', borderRadius: 4, padding: 4 }}>
            {groupChoices.map(c => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px', cursor: 'pointer', fontSize: 11 }}>
                <input type="checkbox" checked={selIds.has(c.id)} onChange={() => { const n = new Set(selIds); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); setSelIds(n); }} />
                {str(c.label)}
              </label>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="crm-btn crm-btn-primary" style={{ fontSize: 10, padding: '3px 8px' }} onClick={save}>Save</button>
          <button className="crm-btn crm-btn-ghost" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '6px 8px', marginBottom: 4, borderRadius: 4, background: 'var(--crm-surface-hover)', fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <span style={{ fontWeight: 500 }}>Show when: </span>
        {rc.map(cl => <ClauseDisplay key={cl.id} clause={cl} groups={groups} choices={choices} choiceMap={choiceMap} placements={placements} />)}
        {rc.length === 0 && <span style={{ color: 'var(--crm-text-tertiary)', fontStyle: 'italic' }}>No clauses</span>}
      </div>
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => startEdit()}>✎</button>
        <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: 'var(--crm-error)' }} onClick={onDelete}>✕</button>
      </div>
    </div>
  );
}

/* ── Clause display (read-only) ── */
function ClauseDisplay({ clause, groups, choices, choiceMap, placements }: { clause: E; groups: E[]; choices: E[]; choiceMap: Map<string, E>; placements: E[] }) {
  const op = str(clause.operator);
  const leftType = str(clause.leftOperandType);
  const leftRef = str(clause.leftOperandRef);
  const rightRef = str(clause.rightOperandRef);

  let leftLabel = leftRef;
  if (leftType === 'selection') {
    const g = groups.find(g => g.id === leftRef);
    leftLabel = g ? str(g.label) : leftRef.slice(0, 8);
  } else if (leftType === 'choice') {
    const c = choiceMap.get(leftRef);
    leftLabel = c ? str(c.label) : leftRef.slice(0, 8);
  }

  const rightIds = rightRef.split(',').map(s => s.trim()).filter(Boolean);
  const rightLabels = rightIds.map(id => {
    const c = choiceMap.get(id);
    return c ? str(c.label) : id.slice(0, 8);
  });

  const opLabel: Record<string, string> = { is: 'is', is_not: 'is not', is_any_of: 'is any of', is_none_of: 'is none of', selected: 'is selected', not_selected: 'is not selected' };

  return (
    <div style={{ fontSize: 10, color: 'var(--crm-text-secondary)', padding: '2px 0' }}>
      <strong>{leftLabel}</strong> {opLabel[op] ?? op} {rightLabels.length > 0 ? rightLabels.join(', ') : ''}
    </div>
  );
}

/* ── Add condition form ── */
function AddConditionForm({ placement, ruleSet, groups, steps, choices, choiceMap, placements, onDone, onCancel }: {
  placement: E; ruleSet: E | null; groups: E[]; steps: E[]; choices: E[];
  choiceMap: Map<string, E>; placements: E[];
  onDone: () => void; onCancel: () => void;
}) {
  const [effect, setEffect] = useState('show');
  const [groupId, setGroupId] = useState('');
  const [operator, setOperator] = useState('is_any_of');
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Choices available in the selected group
  const groupPlacements = groupId ? placements.filter(p => p.groupId === groupId && str(p.status) !== 'archived') : [];
  const groupChoiceIds = groupPlacements.map(p => str(p.choiceId));
  const groupChoices = groupChoiceIds.map(id => choiceMap.get(id)).filter((c): c is E => !!c);

  function toggleChoice(id: string) {
    setSelectedChoiceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!groupId) return;
    setSaving(true);
    try {
      // Ensure ruleSet exists
      let rsId = ruleSet?.id;
      if (!rsId) {
        const rs = await cfgCreate('ruleSet', { ownerType: 'group_choice', ownerId: placement.id, logicOperator: 'AND' });
        rsId = rs.id;
        await cfgUpdate('placement', placement.id, { availabilityRuleSetId: rsId });
      }
      // Create rule
      const rule = await cfgCreate('rule', { ruleSetId: rsId, effectType: 'show', priority: 100 });
      // Create clause
      const needsRight = ['is', 'is_not', 'is_any_of', 'is_none_of'].includes(operator);
      await cfgCreate('clause', {
        ruleId: rule.id,
        leftOperandType: 'selection',
        leftOperandRef: groupId,
        operator,
        rightOperandType: needsRight ? 'set' : 'literal',
        rightOperandRef: needsRight ? Array.from(selectedChoiceIds).join(',') : '',
      });
      onDone();
    } catch { /* ignore */ }
    setSaving(false);
  }

  return (
    <div style={{ padding: '8px 0', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontWeight: 500, marginBottom: 2 }}>Show when:</div>
      <select className="crm-input" style={{ fontSize: 11 }} value={groupId} onChange={e => { setGroupId(e.target.value); setSelectedChoiceIds(new Set()); }}>
        <option value="">Select a group…</option>
        {groups.filter(g => str(g.status) !== 'archived').map(g => {
          const step = steps.find(s => s.id === g.stepId);
          return <option key={g.id} value={g.id}>{step ? str(step.label) + ' → ' : ''}{str(g.label)}</option>;
        })}
      </select>
      {groupId && (
        <>
          <select className="crm-input" style={{ fontSize: 11 }} value={operator} onChange={e => setOperator(e.target.value)}>
            <option value="is_any_of">is any of</option>
            <option value="is_none_of">is none of</option>
            <option value="is">is exactly</option>
            <option value="is_not">is not</option>
            <option value="selected">has any selection</option>
            <option value="not_selected">has no selection</option>
          </select>
          {['is', 'is_not', 'is_any_of', 'is_none_of'].includes(operator) && (
            <div style={{ maxHeight: 120, overflow: 'auto', border: '1px solid var(--crm-border-light)', borderRadius: 4, padding: 4 }}>
              {groupChoices.map(c => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', cursor: 'pointer', fontSize: 11 }}>
                  <input type="checkbox" checked={selectedChoiceIds.has(c.id)} onChange={() => toggleChoice(c.id)} />
                  {str(c.label)}
                </label>
              ))}
              {groupChoices.length === 0 && <div style={{ padding: 6, color: 'var(--crm-text-tertiary)' }}>No choices in this group</div>}
            </div>
          )}
        </>
      )}
      <div style={{ display: 'flex', gap: 4 }}>
        <button className="crm-btn crm-btn-primary" style={{ fontSize: 10, padding: '3px 8px' }} disabled={saving || !groupId} onClick={save}>{saving ? 'Saving…' : 'Add'}</button>
        <button className="crm-btn crm-btn-ghost" style={{ fontSize: 10, padding: '3px 8px' }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/* ── Add step condition form ── */
function AddStepConditionForm({ step, ruleSet, priorGroups, priorSteps, choices, choiceMap, placements, onDone, onCancel }: {
  step: E; ruleSet: E | null; priorGroups: E[]; priorSteps: E[];
  choices: E[]; choiceMap: Map<string, E>; placements: E[];
  onDone: () => void; onCancel: () => void;
}) {
  const [effect, setEffect] = useState('show');
  const [groupId, setGroupId] = useState('');
  const [operator, setOperator] = useState('is_any_of');
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const groupPlacements = groupId ? placements.filter(p => p.groupId === groupId && str(p.status) !== 'archived') : [];
  const groupChoices = groupPlacements.map(p => choiceMap.get(str(p.choiceId))).filter((c): c is E => !!c);

  async function save() {
    if (!groupId) return;
    setSaving(true);
    try {
      let rsId = ruleSet?.id;
      if (!rsId) {
        const rs = await cfgCreate('ruleSet', { ownerType: 'step', ownerId: step.id, logicOperator: 'AND' });
        rsId = rs.id;
        await cfgUpdate('step', step.id, { visibilityRuleSetId: rsId });
      }
      const rule = await cfgCreate('rule', { ruleSetId: rsId, effectType: 'show', priority: 100 });
      const needsRight = ['is', 'is_not', 'is_any_of', 'is_none_of'].includes(operator);
      await cfgCreate('clause', {
        ruleId: rule.id, leftOperandType: 'selection', leftOperandRef: groupId, operator,
        rightOperandType: needsRight ? 'set' : 'literal',
        rightOperandRef: needsRight ? Array.from(selectedChoiceIds).join(',') : '',
      });
      onDone();
    } catch { /* ignore */ }
    setSaving(false);
  }

  return (
    <div style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
      <div style={{ fontWeight: 500, marginBottom: 2 }}>Show when:</div>
      <select className="crm-input" style={{ fontSize: 11 }} value={groupId} onChange={e => { setGroupId(e.target.value); setSelectedChoiceIds(new Set()); }}>
        <option value="">Select a group…</option>
        {priorGroups.map(g => {
          const s = priorSteps.find(s => s.id === g.stepId);
          return <option key={g.id} value={g.id}>{s ? str(s.label) + ' → ' : ''}{str(g.label)}</option>;
        })}
      </select>
      {groupId && (
        <>
          <select className="crm-input" style={{ fontSize: 11 }} value={operator} onChange={e => setOperator(e.target.value)}>
            <option value="is_any_of">is any of</option>
            <option value="is_none_of">is none of</option>
            <option value="selected">has any selection</option>
            <option value="not_selected">has no selection</option>
          </select>
          {['is', 'is_not', 'is_any_of', 'is_none_of'].includes(operator) && (
            <div style={{ maxHeight: 100, overflow: 'auto', border: '1px solid var(--crm-border-light)', borderRadius: 4, padding: 4 }}>
              {groupChoices.map(c => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px', cursor: 'pointer', fontSize: 11 }}>
                  <input type="checkbox" checked={selectedChoiceIds.has(c.id)} onChange={() => { const n = new Set(selectedChoiceIds); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); setSelectedChoiceIds(n); }} />
                  {str(c.label)}
                </label>
              ))}
            </div>
          )}
        </>
      )}
      <div style={{ display: 'flex', gap: 4 }}>
        <button className="crm-btn crm-btn-primary" style={{ fontSize: 10, padding: '3px 8px' }} disabled={saving || !groupId} onClick={save}>{saving ? 'Saving…' : 'Add'}</button>
        <button className="crm-btn crm-btn-ghost" style={{ fontSize: 10, padding: '3px 8px' }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/* ── Shared: Button Group ── */
function BtnGroup({ items, value, onChange }: { items: { key: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--crm-border)' }}>
      {items.map(it => {
        const active = it.key === value;
        return (
          <button key={it.key} onClick={() => onChange(it.key)} style={{
            fontSize: 11, padding: '3px 10px', border: 'none', cursor: 'pointer',
            background: active ? 'var(--crm-text-primary)' : 'transparent',
            color: active ? '#fff' : 'var(--crm-text-secondary)',
            fontWeight: active ? 600 : 400, transition: 'all 120ms',
          }}>{it.label}</button>
        );
      })}
    </div>
  );
}