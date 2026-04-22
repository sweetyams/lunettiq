'use client';

import { useState } from 'react';
import {
  Entity, str, num, hasChannel, friendlyGroupLabel, countCustomRules,
  getCustomRules, getPrice, formatPrice, conditionSummary, shownWhen, RULE_LABELS,
} from './flow-helpers';

/* ── Left: Step List ── */

export function StepList({ channel, setChannel, cSteps, gMap, activeCode, setSelGroup, options, constraintRules, onReload }: {
  channel: string; setChannel: (c: string) => void; cSteps: Entity[];
  gMap: Map<string, Entity>; activeCode: string; setSelGroup: (c: string) => void;
  options: Entity[]; constraintRules: Entity[]; onReload: () => void;
}) {
  const [editingStep, setEditingStep] = useState('');
  const [stepLabel, setStepLabel] = useState('');

  async function saveStepLabel(stepId: string) {
    if (!stepLabel.trim()) { setEditingStep(''); return; }
    await fetch('/api/crm/product-options', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity: 'step', id: stepId, label: stepLabel.trim() }) });
    setEditingStep(''); onReload();
  }
  return (
    <div style={{ width: 230, flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 2, marginBottom: 12 }}>
        {['optical', 'sun', 'reglaze'].map(ch => (
          <button key={ch} onClick={() => setChannel(ch)} className={'crm-btn ' + (channel === ch ? 'crm-btn-primary' : 'crm-btn-ghost')} style={{ fontSize: 11, padding: '4px 8px', textTransform: 'capitalize', flex: 1 }}>{ch}</button>
        ))}
      </div>
      <div className="crm-card" style={{ padding: 0 }}>
        {cSteps.map((step, si) => {
          const codes = (step.optionGroupCodes as string[]) || [];
          return (
            <div key={step.id}>
              <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, background: 'var(--crm-surface-hover)', color: 'var(--crm-text-secondary)', borderBottom: '1px solid var(--crm-border-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', fontSize: 10, background: 'var(--crm-text-primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{si + 1}</span>
                {editingStep === step.id ? (
                  <input className="crm-input" autoFocus style={{ fontSize: 11, padding: '2px 6px', flex: 1 }} value={stepLabel}
                    onChange={e => setStepLabel(e.target.value)}
                    onBlur={() => saveStepLabel(step.id)}
                    onKeyDown={e => { if (e.key === 'Enter') saveStepLabel(step.id); if (e.key === 'Escape') setEditingStep(''); }}
                  />
                ) : (
                  <span onDoubleClick={() => { setEditingStep(step.id); setStepLabel(str(step.label)); }} style={{ cursor: 'text' }} title="Double-click to rename">{str(step.label)}</span>
                )}
              </div>
              {codes.map(gc => {
                const g = gMap.get(gc);
                if (!g) return null;
                const active = activeCode === gc;
                const n = options.filter(o => o.groupId === g.id && o.active !== false && hasChannel(o.channels, channel)).length;
                const rc = countCustomRules(g.id, options, constraintRules);
                const mode = str(g.selectionMode) === 'single' ? 'Choose one' : 'Choose any';
                const req = g.required ? ' · required' : '';
                return (
                  <button key={gc} onClick={() => setSelGroup(gc)} style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '8px 12px 8px 38px', background: active ? 'var(--crm-surface-active)' : 'transparent', border: 'none', borderBottom: '1px solid var(--crm-border-light)', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--crm-text-primary)' : 'var(--crm-text-secondary)' }}>{friendlyGroupLabel(g)}</span>
                    <span style={{ fontSize: 10, color: 'var(--crm-text-tertiary)' }}>{mode}{req} · {n} choices{rc > 0 ? ' · ' + rc + ' conditions' : ''}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Center: Group Editor (choice cards) ── */

export function GroupEditor({ group, channel, gOpts, gCodes, priceRules, constraintRules, lblMap, selChoice, setSelChoice, onReload }: {
  group: Entity | null; channel: string; gOpts: Entity[]; gCodes: Set<string>;
  priceRules: Entity[]; constraintRules: Entity[]; lblMap: Map<string, string>;
  selChoice: string; setSelChoice: (c: string) => void; onReload: () => void;
}) {
  const [dragIdx, setDragIdx] = useState(-1);
  const [editId, setEditId] = useState('');
  const [ef, setEf] = useState({} as Record<string, unknown>);
  const [saving, setSaving] = useState(false);

  function startEdit(o: Entity, e: React.MouseEvent) {
    e.stopPropagation();
    const p = priceRules.find(r => r.active !== false && hasChannel(r.channels, channel) && Array.isArray(r.optionCodes) && (r.optionCodes as string[]).includes(str(o.code)));
    setEditId(o.id);
    setEf({ label: str(o.label), code: str(o.code), active: o.active !== false, priceAmt: p ? str(p.amountCad) : '', priceType: p ? str(p.pricingType) : 'delta', priceId: p?.id || '' });
  }

  async function saveEdit(o: Entity) {
    setSaving(true);
    const h = { 'Content-Type': 'application/json' };
    await fetch('/api/crm/product-options', { method: 'PATCH', credentials: 'include', headers: h, body: JSON.stringify({ entity: 'option', id: o.id, label: ef.label, code: ef.code, active: ef.active }) });
    const amt = String(ef.priceAmt || '').trim();
    if (amt && Number(amt) !== 0) {
      const body = ef.priceId
        ? { entity: 'price', id: ef.priceId, amountCad: amt, pricingType: ef.priceType }
        : { entity: 'price', code: 'price_' + str(ef.code), label: str(ef.label), amountCad: amt, pricingType: ef.priceType, optionCodes: [str(ef.code)], channels: ['optical', 'sun', 'reglaze'], active: true };
      await fetch('/api/crm/product-options', { method: ef.priceId ? 'PATCH' : 'POST', credentials: 'include', headers: h, body: JSON.stringify(body) });
    }
    setSaving(false); setEditId(''); onReload();
  }

  async function reorder(from: number, to: number) {
    if (from === to) return;
    const arr = [...gOpts];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    await Promise.all(arr.map((o, i) => fetch('/api/crm/product-options', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity: 'option', id: o.id, sortOrder: i * 10 }) })));
    onReload();
  }

  if (!group) return <div style={{ flex: 1 }} />;

  async function toggleMode() {
    const v = str(group.selectionMode) === 'single' ? 'multi' : 'single';
    await fetch('/api/crm/product-options', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity: 'group', id: group.id, selectionMode: v }) });
    onReload();
  }
  async function toggleRequired() {
    await fetch('/api/crm/product-options', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity: 'group', id: group.id, required: !group.required }) });
    onReload();
  }

  const mode = str(group.selectionMode) === 'single' ? 'Choose one' : 'Choose any';

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="crm-card" style={{ padding: '12px 16px', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px' }}>{friendlyGroupLabel(group)}</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <button className="crm-btn crm-btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={toggleMode}>
            {mode === 'Choose one' ? '◉ Choose one' : '☑ Choose any'}
          </button>
          <button className="crm-btn crm-btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={toggleRequired}>
            {group.required ? '✓ Customer must choose' : '○ Optional'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--crm-text-tertiary)' }}>
          {mode === 'Choose one' ? 'Selecting one choice automatically deselects the others.' : 'Customers can select multiple options in this step.'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {gOpts.map((opt, idx) => {
          const code = str(opt.code);
          const price = formatPrice(code, priceRules, channel);
          const shown = shownWhen(code, constraintRules, lblMap);
          const conds = conditionSummary(code, gCodes, constraintRules, lblMap);
          const isSelected = selChoice === code;

          return (
            <div
              key={opt.id}
              draggable={editId !== opt.id}
              onDragStart={() => setDragIdx(idx)}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.boxShadow = '0 -2px 0 var(--crm-text-primary)'; }}
              onDragLeave={e => { e.currentTarget.style.boxShadow = ''; }}
              onDrop={e => { e.currentTarget.style.boxShadow = ''; if (dragIdx >= 0) reorder(dragIdx, idx); setDragIdx(-1); }}
              onDragEnd={() => setDragIdx(-1)}
              onClick={() => setSelChoice(isSelected ? '' : code)}
              className="crm-card"
              style={{
                padding: '10px 14px', cursor: 'pointer', opacity: dragIdx === idx ? 0.4 : 1,
                borderColor: isSelected ? 'var(--crm-text-primary)' : undefined,
                transition: 'border-color 120ms',
              }}
            >
              {editId === opt.id ? (
                <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <label style={{ flex: 1, minWidth: 100 }}><span style={{ fontSize: 10, color: 'var(--crm-text-tertiary)' }}>Label</span><input className="crm-input" style={{ width: '100%' }} value={str(ef.label)} onChange={e => setEf(p => ({ ...p, label: e.target.value }))} /></label>
                    <label style={{ width: 110 }}><span style={{ fontSize: 10, color: 'var(--crm-text-tertiary)' }}>Internal name</span><input className="crm-input" style={{ width: '100%' }} value={str(ef.code)} onChange={e => setEf(p => ({ ...p, code: e.target.value }))} /></label>
                    <label style={{ width: 70 }}><span style={{ fontSize: 10, color: 'var(--crm-text-tertiary)' }}>Price $</span><input className="crm-input" style={{ width: '100%' }} type="number" step="0.01" value={str(ef.priceAmt)} onChange={e => setEf(p => ({ ...p, priceAmt: e.target.value }))} /></label>
                    <label style={{ width: 75 }}><span style={{ fontSize: 10, color: 'var(--crm-text-tertiary)' }}>Type</span><select className="crm-input" style={{ width: '100%' }} value={str(ef.priceType)} onChange={e => setEf(p => ({ ...p, priceType: e.target.value }))}><option value="delta">+delta</option><option value="absolute">fixed</option></select></label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}><input type="checkbox" checked={!!ef.active} onChange={e => setEf(p => ({ ...p, active: e.target.checked }))} /> Visible to customers</label>
                    <div style={{ flex: 1 }} />
                    <button className="crm-btn crm-btn-primary" style={{ fontSize: 11, padding: '3px 10px' }} disabled={saving} onClick={() => saveEdit(opt)}>{saving ? 'Saving…' : 'Save'}</button>
                    <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={e => { e.stopPropagation(); setEditId(''); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ cursor: 'grab', color: 'var(--crm-text-tertiary)', fontSize: 11, userSelect: 'none' }}>⠿</span>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{str(opt.label)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="crm-badge" style={{
                        background: price === 'included' ? 'var(--crm-surface-hover)' : 'var(--crm-success-light)',
                        color: price === 'included' ? 'var(--crm-text-tertiary)' : 'var(--crm-success)',
                      }}>{price}</span>
                      <button className="crm-btn crm-btn-ghost" style={{ fontSize: 10, padding: '2px 6px' }} onClick={e => startEdit(opt, e)}>Edit</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', marginTop: 4, marginLeft: 26 }}>
                    {shown} · {conds} · {opt.active !== false ? 'Visible to customers' : 'Hidden'}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Right: Inspector ── */

export function Inspector({ choice, channel, gCodes, constraintRules, priceRules, options, lblMap, onReload }: {
  choice: Entity | null; channel: string; gCodes: Set<string>;
  constraintRules: Entity[]; priceRules: Entity[]; options: Entity[];
  lblMap: Map<string, string>; onReload: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [ruleType, setRuleType] = useState('requires');
  const [targets, setTargets] = useState([] as string[]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandingRule, setExpandingRule] = useState('');

  if (!choice) return (
    <div style={{ width: 260, flexShrink: 0 }}>
      <div className="crm-card" style={{ padding: 32, textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 11 }}>
        Select a choice to inspect
      </div>
    </div>
  );

  const code = str(choice.code);
  const rules = getCustomRules(code, gCodes, constraintRules);
  const price = getPrice(code, priceRules, channel);
  const TYPES = [{ v: 'requires', l: 'Shown when…' }, { v: 'excludes', l: 'Not available with…' }, { v: 'allowed_only_with', l: 'Only shown with…' }, { v: 'hidden_until', l: 'Hidden until…' }];
  const filtered = options.filter(o => o.active !== false && str(o.code) !== code && (!search || str(o.label).toLowerCase().includes(search.toLowerCase())));

  async function addRule() {
    if (!targets.length) return;
    setSaving(true);
    await fetch('/api/crm/product-options', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity: 'constraint', code: 'rule_' + code + '_' + ruleType + '_' + Date.now(), ruleType, sourceOptionCode: code, targetOptionCodes: targets, active: true }) });
    setSaving(false); setAdding(false); setTargets([]); setSearch(''); onReload();
  }

  async function delRule(id: string) {
    await fetch('/api/crm/product-options', { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity: 'constraint', id }) });
    onReload();
  }

  async function removeTarget(rule: Entity, targetCode: string) {
    const remaining = ((rule.targetOptionCodes as string[]) || []).filter(t => t !== targetCode);
    if (remaining.length === 0) { delRule(rule.id); return; }
    await fetch('/api/crm/product-options', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity: 'constraint', id: rule.id, targetOptionCodes: remaining }) });
    onReload();
  }

  async function addTargetsToRule(rule: Entity, newTargets: string[]) {
    const existing = (rule.targetOptionCodes as string[]) || [];
    const merged = [...new Set([...existing, ...newTargets])];
    await fetch('/api/crm/product-options', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity: 'constraint', id: rule.id, targetOptionCodes: merged }) });
    setExpandingRule(''); setTargets([]); setSearch(''); onReload();
  }

  return (
    <div style={{ width: 260, flexShrink: 0 }}>
      <div className="crm-card" style={{ padding: '14px 16px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>{str(choice.label)}</h3>
        <div style={{ fontSize: 11, color: 'var(--crm-text-tertiary)', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
          <div>Internal name: <strong style={{ color: 'var(--crm-text-secondary)' }}>{code}</strong></div>
          <div>Price change: <strong style={{ color: 'var(--crm-text-secondary)' }}>{price ? (price.type === 'delta' ? '+$' + price.amount : '$' + price.amount) : 'included'}</strong></div>
          <div>Visible to customers: <strong style={{ color: 'var(--crm-success)' }}>Yes</strong></div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--crm-text-secondary)', marginBottom: 6 }}>Conditions</div>
        {rules.length === 0 && !adding && (
          <div style={{ fontSize: 11, color: 'var(--crm-text-tertiary)', marginBottom: 8, fontStyle: 'italic' }}>No conditions. This choice is always shown when the step appears.</div>
        )}
        {rules.map(r => (
          <div key={r.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--crm-border-light)', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: str(r.ruleType) === 'excludes' ? 'var(--crm-error)' : 'var(--crm-warning)', fontWeight: 600 }}>{RULE_LABELS[str(r.ruleType)] || str(r.ruleType)}</span>
              <button onClick={() => delRule(r.id)} style={{ background: 'none', border: 'none', color: 'var(--crm-text-tertiary)', cursor: 'pointer', fontSize: 10, padding: '0 4px' }} title="Delete entire condition">✕</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {((r.targetOptionCodes as string[]) || []).map(t => (
                <span key={t} className="crm-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: str(r.ruleType) === 'excludes' ? 'var(--crm-error-light)' : 'var(--crm-warning-light)', color: str(r.ruleType) === 'excludes' ? 'var(--crm-error)' : 'var(--crm-warning)' }}>
                  {lblMap.get(t) || t}
                  <button onClick={() => removeTarget(r, t)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 9, padding: 0, lineHeight: 1 }} title="Remove">✕</button>
                </span>
              ))}
              <button onClick={() => { setExpandingRule(expandingRule === r.id ? '' : r.id); setTargets([]); setSearch(''); }} className="crm-badge" style={{ cursor: 'pointer', border: 'none', background: 'var(--crm-surface-hover)', color: 'var(--crm-text-secondary)', fontSize: 10 }}>+ Add</button>
            </div>
            {expandingRule === r.id && (
              <div style={{ marginTop: 6 }}>
                <input className="crm-input" style={{ width: '100%', marginBottom: 4, fontSize: 11 }} placeholder="Search choices…" value={search} onChange={e => setSearch(e.target.value)} />
                <div style={{ maxHeight: 120, overflow: 'auto', marginBottom: 6 }}>
                  {filtered.filter(o => !((r.targetOptionCodes as string[]) || []).includes(str(o.code))).map(o => {
                    const c = str(o.code); const s = targets.includes(c);
                    return <button key={c} type="button" onClick={() => setTargets(p => s ? p.filter(x => x !== c) : [...p, c])} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '3px 8px', border: 'none', cursor: 'pointer', background: s ? 'var(--crm-warning-light)' : 'transparent', color: s ? 'var(--crm-warning)' : 'var(--crm-text-primary)', fontSize: 11, fontWeight: s ? 600 : 400, borderRadius: 3 }}>{s ? '✓ ' : ''}{str(o.label)}</button>;
                  })}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="crm-btn crm-btn-primary" style={{ fontSize: 11, padding: '3px 10px' }} disabled={!targets.length} onClick={() => addTargetsToRule(r, targets)}>Add</button>
                  <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => { setExpandingRule(''); setTargets([]); setSearch(''); }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {adding ? (
          <div style={{ marginTop: 8 }}>
            <select className="crm-input" style={{ width: '100%', marginBottom: 6, fontSize: 11 }} value={ruleType} onChange={e => setRuleType(e.target.value)}>
              {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
            <input className="crm-input" style={{ width: '100%', marginBottom: 4, fontSize: 11 }} placeholder="Search choices…" value={search} onChange={e => setSearch(e.target.value)} />
            <div style={{ maxHeight: 120, overflow: 'auto', marginBottom: 8 }}>
              {filtered.map(o => {
                const c = str(o.code);
                const s = targets.includes(c);
                return <button key={c} type="button" onClick={() => setTargets(p => s ? p.filter(x => x !== c) : [...p, c])} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '3px 8px', border: 'none', cursor: 'pointer', background: s ? 'var(--crm-warning-light)' : 'transparent', color: s ? 'var(--crm-warning)' : 'var(--crm-text-primary)', fontSize: 11, fontWeight: s ? 600 : 400, borderRadius: 3 }}>{s ? '✓ ' : ''}{str(o.label)}</button>;
              })}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="crm-btn crm-btn-primary" style={{ fontSize: 11, padding: '3px 10px' }} disabled={saving || !targets.length} onClick={addRule}>{saving ? 'Saving…' : 'Add'}</button>
              <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => { setAdding(false); setTargets([]); setSearch(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="crm-btn crm-btn-secondary" style={{ fontSize: 11, marginTop: 8, padding: '4px 10px', width: '100%' }} onClick={() => setAdding(true)}>+ Add condition</button>
        )}
      </div>
    </div>
  );
}
