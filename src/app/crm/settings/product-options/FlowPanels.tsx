'use client';

import { useState } from 'react';
import { Entity, str, num, hasChannel, countCustomRules, getCustomRules, formatPrice, availability, exceptions } from './flow-helpers';

/* ── Left Pane ── */
export function LeftPane({ channel, setChannel, cSteps, gMap, activeCode, setSelGroup, options, constraintRules }: {
  channel: string; setChannel: (c: string) => void; cSteps: Entity[]; gMap: Map<string, Entity>;
  activeCode: string; setSelGroup: (c: string) => void; options: Entity[]; constraintRules: Entity[];
}) {
  return (
    <div style={{ width: 240, flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 2, marginBottom: 12 }}>
        {['optical', 'sun', 'reglaze'].map(ch => (
          <button key={ch} onClick={() => setChannel(ch)} className={'crm-btn ' + (channel === ch ? 'crm-btn-primary' : 'crm-btn-ghost')} style={{ fontSize: 11, padding: '4px 10px', textTransform: 'capitalize', flex: 1 }}>{ch}</button>
        ))}
      </div>
      <div className="crm-card" style={{ padding: 0, overflow: 'hidden' }}>
        {cSteps.map((step, si) => {
          const codes = (step.optionGroupCodes as string[]) || [];
          return (
            <div key={step.id}>
              <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, background: 'var(--crm-surface-hover)', color: 'var(--crm-text-secondary)', borderBottom: '1px solid var(--crm-border-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', fontSize: 10, background: 'var(--crm-text-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{si + 1}</span>
                {str(step.label)}
              </div>
              {codes.map(gc => {
                const g = gMap.get(gc);
                if (!g) return null;
                const isActive = activeCode === gc;
                const optCount = options.filter(o => o.groupId === g.id && o.active !== false && hasChannel(o.channels, channel)).length;
                const rc = countCustomRules(g.id, options, constraintRules);
                return (
                  <button key={gc} onClick={() => setSelGroup(gc)} style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '8px 12px 8px 38px', background: isActive ? 'var(--crm-surface-active)' : 'transparent', border: 'none', borderBottom: '1px solid var(--crm-border-light)', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--crm-text-primary)' : 'var(--crm-text-secondary)' }}>{str(g.label)}</span>
                    <span style={{ fontSize: 10, color: 'var(--crm-text-tertiary)' }}>{str(g.selectionMode)} · {optCount} options{rc > 0 ? ' · ' + rc + ' rules' : ''}</span>
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

/* ── Group Header ── */
export function GroupHeader({ group }: { group: Entity }) {
  const mode = str(group.selectionMode);
  return (
    <div className="crm-card" style={{ padding: '12px 16px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{str(group.label)}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="crm-badge" style={{ background: 'var(--crm-surface-hover)', color: 'var(--crm-text-secondary)' }}>{mode === 'single' ? '◉ Single select' : '☑ Multi select'}</span>
          {group.required && <span className="crm-badge" style={{ background: 'var(--crm-warning-light)', color: 'var(--crm-warning)' }}>Required</span>}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--crm-text-tertiary)' }}>
        {mode === 'single' ? 'Single select — siblings mutually exclusive automatically. Only cross-group exceptions shown.' : 'Multi select — multiple options can be active. Exceptions listed per option.'}
      </div>
    </div>
  );
}

/* ── Option Table ── */
export function OptionTable(p: {
  gOpts: Entity[]; gCodes: Set<string>; editId: string; editForm: Record<string, unknown>;
  setEditForm: (fn: (prev: Record<string, unknown>) => Record<string, unknown>) => void;
  saving: boolean; startEdit: (o: Entity) => void; saveEdit: (o: Entity) => void; cancelEdit: () => void;
  ruleEdit: string; setRuleEdit: (c: string) => void;
  dragIdx: number; setDragIdx: (i: number) => void; reorder: (from: number, to: number) => void;
  priceRules: Entity[]; constraintRules: Entity[]; options: Entity[]; lblMap: Map<string, string>; channel: string; onReload: () => void;
}) {
  return (
    <div className="crm-card" style={{ overflow: 'hidden' }}>
      <table className="crm-table" style={{ width: '100%' }}>
        <thead><tr><th style={{ width: 28 }} /><th>Option</th><th style={{ width: 80 }}>Price</th><th>Availability</th><th>Exceptions</th></tr></thead>
        <tbody>
          {p.gOpts.map((opt, idx) => {
            const code = str(opt.code);
            if (p.editId === opt.id) return (
              <tr key={opt.id} style={{ background: 'var(--crm-surface-hover)' }}>
                <td />
                <td colSpan={4}>
                  <div style={{ display: 'flex', gap: 8, padding: '4px 0', flexWrap: 'wrap', alignItems: 'end' }}>
                    <label style={{ flex: 1, minWidth: 100 }}><span style={{ fontSize: 11, color: 'var(--crm-text-tertiary)' }}>Label</span><input className="crm-input" style={{ width: '100%' }} value={str(p.editForm.label)} onChange={e => p.setEditForm(f => ({ ...f, label: e.target.value }))} /></label>
                    <label style={{ width: 100 }}><span style={{ fontSize: 11, color: 'var(--crm-text-tertiary)' }}>Code</span><input className="crm-input" style={{ width: '100%' }} value={str(p.editForm.code)} onChange={e => p.setEditForm(f => ({ ...f, code: e.target.value }))} /></label>
                    <label style={{ width: 70 }}><span style={{ fontSize: 11, color: 'var(--crm-text-tertiary)' }}>Price $</span><input className="crm-input" style={{ width: '100%' }} type="number" step="0.01" value={str(p.editForm.priceAmt)} onChange={e => p.setEditForm(f => ({ ...f, priceAmt: e.target.value }))} /></label>
                    <label style={{ width: 75 }}><span style={{ fontSize: 11, color: 'var(--crm-text-tertiary)' }}>Type</span><select className="crm-input" style={{ width: '100%' }} value={str(p.editForm.priceType)} onChange={e => p.setEditForm(f => ({ ...f, priceType: e.target.value }))}><option value="delta">+delta</option><option value="absolute">absolute</option></select></label>
                    <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, paddingBottom: 4 }}><input type="checkbox" checked={!!p.editForm.active} onChange={e => p.setEditForm(f => ({ ...f, active: e.target.checked }))} /> Active</label>
                    <button className="crm-btn crm-btn-primary" style={{ fontSize: 11, padding: '4px 10px' }} disabled={p.saving} onClick={() => p.saveEdit(opt)}>{p.saving ? 'Saving…' : 'Save'}</button>
                    <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={p.cancelEdit}>Cancel</button>
                  </div>
                </td>
              </tr>
            );
            const avail = availability(code, p.constraintRules, p.lblMap);
            const exc = exceptions(code, p.gCodes, p.constraintRules, p.lblMap);
            return [
              <tr key={opt.id} draggable onDragStart={() => p.setDragIdx(idx)} onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderTop = '2px solid var(--crm-text-primary)'; }} onDragLeave={e => { e.currentTarget.style.borderTop = ''; }} onDrop={e => { e.currentTarget.style.borderTop = ''; if (p.dragIdx >= 0) p.reorder(p.dragIdx, idx); p.setDragIdx(-1); }} onDragEnd={() => p.setDragIdx(-1)} style={{ opacity: p.dragIdx === idx ? 0.4 : 1 }}>
                <td style={{ cursor: 'grab', color: 'var(--crm-text-tertiary)', fontSize: 11, textAlign: 'center', userSelect: 'none' }}>⠿</td>
                <td style={{ fontWeight: 500, fontSize: 13, cursor: 'pointer' }} onClick={() => p.startEdit(opt)}>{str(opt.label)}</td>
                <td><span className="crm-badge" style={{ background: formatPrice(code, p.priceRules, p.channel) === 'included' ? 'var(--crm-surface-hover)' : 'var(--crm-success-light)', color: formatPrice(code, p.priceRules, p.channel) === 'included' ? 'var(--crm-text-tertiary)' : 'var(--crm-success)' }}>{formatPrice(code, p.priceRules, p.channel)}</span></td>
                <td style={{ fontSize: 11, color: avail === 'Always available' ? 'var(--crm-text-tertiary)' : 'var(--crm-text-secondary)' }}>{avail}</td>
                <td style={{ fontSize: 11, color: exc ? 'var(--crm-warning)' : 'var(--crm-text-tertiary)', cursor: 'pointer' }} onClick={() => p.setRuleEdit(p.ruleEdit === code ? '' : code)}>{exc || '—'} {getCustomRules(code, p.gCodes, p.constraintRules).length > 0 ? '✎' : ''}</td>
              </tr>,
              p.ruleEdit === code && <tr key={'r_' + opt.id}><td /><td colSpan={4} style={{ background: 'var(--crm-surface-hover)', padding: '10px 12px' }}><RuleEditor optCode={code} optLabel={str(opt.label)} rules={getCustomRules(code, p.gCodes, p.constraintRules)} allOptions={p.options} lblMap={p.lblMap} onReload={() => { p.onReload(); p.setRuleEdit(''); }} /></td></tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Rule Editor ── */
function RuleEditor({ optCode, optLabel, rules, allOptions, lblMap, onReload }: {
  optCode: string; optLabel: string; rules: Entity[]; allOptions: Entity[];
  lblMap: Map<string, string>; onReload: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [ruleType, setRuleType] = useState('requires');
  const [targets, setTargets] = useState([] as string[]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const TYPES = [{ v: 'requires', l: 'Available when…' }, { v: 'excludes', l: 'Not available with…' }, { v: 'allowed_only_with', l: 'Only available with…' }, { v: 'hidden_until', l: 'Hidden until…' }];
  const LABELS: Record<string, string> = { requires: 'Available when', excludes: 'Not available with', allowed_only_with: 'Only with', hidden_until: 'Hidden until' };

  const filtered = allOptions.filter(o => o.active !== false && str(o.code) !== optCode && (!search || str(o.label).toLowerCase().includes(search.toLowerCase())));

  async function add() {
    if (!targets.length) return;
    setSaving(true);
    await fetch('/api/crm/product-options', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity: 'constraint', code: 'rule_' + optCode + '_' + ruleType + '_' + Date.now(), ruleType, sourceOptionCode: optCode, targetOptionCodes: targets, active: true }) });
    setSaving(false); setAdding(false); setTargets([]); setSearch(''); onReload();
  }

  async function del(id: string) {
    await fetch('/api/crm/product-options', { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity: 'constraint', id }) });
    onReload();
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: 'var(--crm-text-secondary)' }}>Rules for {optLabel}</div>
      {rules.length === 0 && !adding && <div style={{ fontSize: 11, color: 'var(--crm-text-tertiary)', marginBottom: 8 }}>No custom rules</div>}
      {rules.map(r => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--crm-border-light)' }}>
          <span style={{ fontSize: 11 }}><strong style={{ color: str(r.ruleType) === 'excludes' ? 'var(--crm-error)' : 'var(--crm-warning)' }}>{LABELS[str(r.ruleType)] || str(r.ruleType)}</strong>{' '}{((r.targetOptionCodes as string[]) || []).map(t => lblMap.get(t) || t).join(', ')}</span>
          <button className="crm-btn crm-btn-ghost" style={{ fontSize: 10, padding: '1px 6px', color: 'var(--crm-error)' }} onClick={() => del(r.id)}>✕</button>
        </div>
      ))}
      {adding ? (
        <div style={{ marginTop: 8 }}>
          <select className="crm-input" style={{ width: '100%', marginBottom: 6 }} value={ruleType} onChange={e => setRuleType(e.target.value)}>{TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
          <input className="crm-input" style={{ width: '100%', marginBottom: 4 }} placeholder="Search options…" value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ maxHeight: 140, overflow: 'auto', marginBottom: 8 }}>
            {filtered.map(o => { const c = str(o.code); const s = targets.includes(c); return <button key={c} type="button" onClick={() => setTargets(p => s ? p.filter(x => x !== c) : [...p, c])} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '3px 8px', border: 'none', cursor: 'pointer', background: s ? 'var(--crm-warning-light)' : 'transparent', color: s ? 'var(--crm-warning)' : 'var(--crm-text-primary)', fontSize: 11, fontWeight: s ? 600 : 400, borderRadius: 3 }}>{s ? '✓ ' : ''}{str(o.label)}</button>; })}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="crm-btn crm-btn-primary" style={{ fontSize: 11, padding: '3px 10px' }} disabled={saving || !targets.length} onClick={add}>{saving ? 'Saving…' : 'Add'}</button>
            <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => { setAdding(false); setTargets([]); setSearch(''); }}>Cancel</button>
          </div>
        </div>
      ) : <button className="crm-btn crm-btn-secondary" style={{ fontSize: 11, marginTop: 8, padding: '3px 10px' }} onClick={() => setAdding(true)}>+ Add rule</button>}
    </div>
  );
}
