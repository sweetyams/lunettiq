'use client';

import { useState } from 'react';
import { E, str, num, cfgCreate, cfgUpdate, cfgDelete, placementLabel, formatPlacementPrice, placementPrice } from './flow-helpers';

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

  async function addStep() {
    if (!newLabel.trim()) return;
    const code = newLabel.trim().toLowerCase().replace(/\s+/g, '_');
    await cfgCreate('step', { flowId: p.activeFlowId, code, label: newLabel.trim(), orderIndex: (p.steps.length + 1) * 10 });
    setNewLabel(''); setAddingStep(false); p.onReload();
  }

  return (
    <div style={{ width: 230, flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 2, marginBottom: 12 }}>
        {p.flows.map(f => (
          <button key={f.id} onClick={() => p.setFlowId(f.id)} className={'crm-btn ' + (p.activeFlowId === f.id ? 'crm-btn-primary' : 'crm-btn-ghost')} style={{ fontSize: 11, padding: '4px 8px', flex: 1 }}>{str(f.label)}</button>
        ))}
      </div>
      <div className="crm-card" style={{ padding: 0 }}>
        {p.steps.map((step, si) => {
          const isActive = p.activeStepId === step.id;
          const stepGroups = p.groups.filter(g => g.stepId === step.id);
          return (
            <div key={step.id}>
              <button onClick={() => p.setStepId(step.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: isActive ? 'var(--crm-surface-active)' : 'transparent', border: 'none', borderBottom: '1px solid var(--crm-border-light)', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', fontSize: 10, background: 'var(--crm-text-primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{si + 1}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--crm-text-primary)' : 'var(--crm-text-secondary)' }}>{str(step.label)}</div>
                  <div style={{ fontSize: 10, color: 'var(--crm-text-tertiary)' }}>
                    {stepGroups.map(g => { const n = p.placements.filter(pl => pl.groupId === g.id).length; const mode = str(g.selectionMode) === 'single' ? 'Choose one' : 'Choose any'; return mode + ' · ' + n + ' choices'; }).join(' | ') || 'No groups'}
                  </div>
                </div>
              </button>
              {isActive && stepGroups.map(g => (
                <button key={g.id} onClick={() => p.setGroupId(g.id)} style={{ display: 'block', width: '100%', padding: '6px 12px 6px 46px', background: p.activeGroupId === g.id ? 'var(--crm-surface-hover)' : 'transparent', border: 'none', borderBottom: '1px solid var(--crm-border-light)', cursor: 'pointer', textAlign: 'left', fontSize: 11, color: p.activeGroupId === g.id ? 'var(--crm-text-primary)' : 'var(--crm-text-tertiary)' }}>
                  {str(g.label)}
                </button>
              ))}
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
          <button className="crm-btn crm-btn-ghost" style={{ width: '100%', fontSize: 11, padding: 8 }} onClick={() => setAddingStep(true)}>+ Add step</button>
        )}
      </div>
    </div>
  );
}

/* ── Center: Group Editor ── */
export function GroupEditor(p: {
  group: E | null; placements: E[]; choiceMap: Map<string, E>;
  priceRules: E[]; choices: E[];
  selPlacementId: string; setSelPlacementId: (id: string) => void;
  onReload: () => void;
}) {
  const [dragIdx, setDragIdx] = useState(-1);
  const [addingChoice, setAddingChoice] = useState(false);
  const [search, setSearch] = useState('');

  if (!p.group) return <div style={{ flex: 1 }} />;

  const mode = str(p.group.selectionMode) === 'single' ? 'Choose one' : 'Choose any';
  const placedChoiceIds = new Set(p.placements.map(pl => str(pl.choiceId)));
  const available = p.choices.filter(c => !placedChoiceIds.has(c.id) && str(c.status) !== 'archived' && (!search || str(c.label).toLowerCase().includes(search.toLowerCase())));

  async function addPlacement(choiceId: string) {
    await cfgCreate('placement', { groupId: p.group!.id, choiceId, sortOrder: (p.placements.length + 1) * 10 });
    setAddingChoice(false); setSearch(''); p.onReload();
  }

  async function removePlacement(id: string) {
    await cfgDelete('placement', id); p.onReload();
  }

  async function reorder(from: number, to: number) {
    if (from === to) return;
    const arr = [...p.placements]; const [m] = arr.splice(from, 1); arr.splice(to, 0, m);
    await Promise.all(arr.map((pl, i) => cfgUpdate('placement', pl.id, { sortOrder: i * 10 })));
    p.onReload();
  }

  async function toggleMode() {
    await cfgUpdate('group', p.group!.id, { selectionMode: str(p.group!.selectionMode) === 'single' ? 'multi' : 'single' }); p.onReload();
  }
  async function toggleRequired() {
    await cfgUpdate('group', p.group!.id, { isRequired: !p.group!.isRequired }); p.onReload();
  }

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="crm-card" style={{ padding: '12px 16px', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px' }}>{str(p.group.label)}</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <button className="crm-btn crm-btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={toggleMode}>{mode === 'Choose one' ? '◉ Choose one' : '☑ Choose any'}</button>
          <button className="crm-btn crm-btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={toggleRequired}>{p.group.isRequired ? '✓ Customer must choose' : '○ Optional'}</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--crm-text-tertiary)' }}>
          {mode === 'Choose one' ? 'Selecting one choice automatically deselects the others.' : 'Customers can select multiple choices.'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {p.placements.map((pl, idx) => {
          const label = placementLabel(pl, p.choiceMap);
          const price = formatPlacementPrice(pl.id, p.priceRules);
          const isSel = p.selPlacementId === pl.id;
          return (
            <div key={pl.id} draggable onDragStart={() => setDragIdx(idx)}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.boxShadow = '0 -2px 0 var(--crm-text-primary)'; }}
              onDragLeave={e => { e.currentTarget.style.boxShadow = ''; }}
              onDrop={e => { e.currentTarget.style.boxShadow = ''; if (dragIdx >= 0) reorder(dragIdx, idx); setDragIdx(-1); }}
              onDragEnd={() => setDragIdx(-1)}
              onClick={() => p.setSelPlacementId(isSel ? '' : pl.id)}
              className="crm-card" style={{ padding: '10px 14px', cursor: 'pointer', opacity: dragIdx === idx ? 0.4 : 1, borderColor: isSel ? 'var(--crm-text-primary)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ cursor: 'grab', color: 'var(--crm-text-tertiary)', fontSize: 11, userSelect: 'none' }}>⠿</span>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="crm-badge" style={{ background: price === 'included' ? 'var(--crm-surface-hover)' : 'var(--crm-success-light)', color: price === 'included' ? 'var(--crm-text-tertiary)' : 'var(--crm-success)' }}>{price}</span>
                  <button className="crm-btn crm-btn-ghost" style={{ fontSize: 10, padding: '2px 6px', color: 'var(--crm-error)' }} onClick={e => { e.stopPropagation(); removePlacement(pl.id); }}>✕</button>
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', marginTop: 4, marginLeft: 26 }}>
                {pl.isVisible !== false ? 'Visible to customers' : 'Hidden'}
              </div>
            </div>
          );
        })}
      </div>

      {addingChoice ? (
        <div className="crm-card" style={{ padding: 10, marginTop: 6 }}>
          <input className="crm-input" style={{ width: '100%', marginBottom: 4, fontSize: 11 }} placeholder="Search choices…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          <div style={{ maxHeight: 160, overflow: 'auto', marginBottom: 6 }}>
            {available.map(c => (
              <button key={c.id} onClick={() => addPlacement(c.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px', border: 'none', cursor: 'pointer', background: 'transparent', fontSize: 11, borderRadius: 3 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--crm-surface-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; }}>
                {str(c.label)}
              </button>
            ))}
            {available.length === 0 && <div style={{ fontSize: 11, color: 'var(--crm-text-tertiary)', padding: 8 }}>No available choices{search ? ' matching "' + search + '"' : ''}</div>}
          </div>
          <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11 }} onClick={() => { setAddingChoice(false); setSearch(''); }}>Cancel</button>
        </div>
      ) : (
        <button className="crm-btn crm-btn-secondary" style={{ width: '100%', fontSize: 11, marginTop: 6, padding: '6px 10px' }} onClick={() => setAddingChoice(true)}>+ Add choice</button>
      )}
    </div>
  );
}

/* ── Right: Inspector ── */
export function Inspector(p: {
  placement: E | null; choiceMap: Map<string, E>;
  priceRules: E[]; ruleSets: E[]; rules: E[]; clauses: E[];
  choices: E[]; onReload: () => void;
}) {
  const [editPrice, setEditPrice] = useState(false);
  const [priceAmt, setPriceAmt] = useState('');
  const [priceType, setPriceType] = useState('delta');

  if (!p.placement) return (
    <div style={{ width: 260, flexShrink: 0 }}>
      <div className="crm-card" style={{ padding: 32, textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 11 }}>Select a choice to inspect</div>
    </div>
  );

  const pl = p.placement;
  const choice = p.choiceMap.get(str(pl.choiceId));
  const label = pl.labelOverride ? str(pl.labelOverride) : choice ? str(choice.label) : '';
  const price = placementPrice(pl.id, p.priceRules);

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

  return (
    <div style={{ width: 260, flexShrink: 0 }}>
      <div className="crm-card" style={{ padding: '14px 16px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>{label}</h3>
        <div style={{ fontSize: 11, color: 'var(--crm-text-tertiary)', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
          <div>Internal name: <strong style={{ color: 'var(--crm-text-secondary)' }}>{choice ? str(choice.code) : ''}</strong></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Price: <strong style={{ color: 'var(--crm-text-secondary)' }}>{price ? (price.type === 'override' ? '$' + price.amount : '+$' + price.amount) : 'included'}</strong>
            <button className="crm-btn crm-btn-ghost" style={{ fontSize: 10, padding: '1px 6px' }} onClick={() => { setEditPrice(!editPrice); setPriceAmt(price ? String(price.amount) : ''); setPriceType(price?.type || 'delta'); }}>✎</button>
          </div>
          {editPrice && (
            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
              <input className="crm-input" style={{ width: 70, fontSize: 11 }} type="number" step="0.01" value={priceAmt} onChange={e => setPriceAmt(e.target.value)} />
              <select className="crm-input" style={{ width: 70, fontSize: 11 }} value={priceType} onChange={e => setPriceType(e.target.value)}><option value="delta">+delta</option><option value="override">fixed</option></select>
              <button className="crm-btn crm-btn-primary" style={{ fontSize: 10, padding: '2px 6px' }} onClick={savePrice}>Save</button>
            </div>
          )}
          <div>Visible: <strong style={{ color: pl.isVisible !== false ? 'var(--crm-success)' : 'var(--crm-error)' }}>{pl.isVisible !== false ? 'Yes' : 'No'}</strong></div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--crm-text-secondary)', marginBottom: 6 }}>Conditions</div>
        <div style={{ fontSize: 11, color: 'var(--crm-text-tertiary)', fontStyle: 'italic' }}>No conditions yet. This choice is always shown.</div>
        <div style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', marginTop: 8 }}>Condition builder coming in next phase.</div>
      </div>
    </div>
  );
}
