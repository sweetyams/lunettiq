'use client';

import { useState, useMemo } from 'react';

interface Entity { id: string; [k: string]: unknown }

interface Props {
  steps: Entity[];
  groups: Entity[];
  options: Entity[];
  priceRules: Entity[];
  constraintRules: Entity[];
  onReload: () => void;
}

export default function FlowEditor({ steps, groups, options, priceRules, constraintRules, onReload }: Props) {
  const [channel, setChannel] = useState('optical');
  const [selectedGroupCode, setSelectedGroupCode] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<Entity | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [ruleEditCode, setRuleEditCode] = useState<string | null>(null);

  const channelSteps = useMemo(() =>
    steps.filter(s => s.channel === channel && s.active !== false)
      .sort((a, b) => num(a.sortOrder) - num(b.sortOrder)),
    [steps, channel]);

  const groupMap = useMemo(() => {
    const m = new Map<string, Entity>();
    for (const g of groups) m.set(str(g.code), g);
    return m;
  }, [groups]);

  const optionLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(str(o.code), str(o.label));
    return m;
  }, [options]);

  // Auto-select first group
  const firstGroupCode = useMemo(() => {
    for (const step of channelSteps) {
      const codes = (step.optionGroupCodes as string[]) ?? [];
      if (codes.length) return codes[0];
    }
    return null;
  }, [channelSteps]);

  const activeGroupCode = (selectedGroupCode && groupMap.has(selectedGroupCode)) ? selectedGroupCode : firstGroupCode;
  const activeGroup = activeGroupCode ? groupMap.get(activeGroupCode) ?? null : null;

  const groupOptions = activeGroup
    ? options.filter(o => o.groupId === activeGroup.id && o.active !== false && hasChannel(o.channels, channel))
        .sort((a, b) => num(a.sortOrder) - num(b.sortOrder))
    : [];

  const groupOptionCodes = useMemo(() => new Set(groupOptions.map(o => str(o.code))), [groupOptions]);

  // Cross-group rules only (filter sibling excludes)
  function getCustomRules(optCode: string) {
    return constraintRules.filter(r => {
      if (r.active === false) return false;
      if (r.sourceOptionCode !== optCode) return false;
      if (str(r.ruleType) === 'excludes') {
        const targets = (r.targetOptionCodes as string[]) ?? [];
        if (groupOptionCodes.has(str(r.sourceOptionCode)) && targets.every(t => groupOptionCodes.has(t))) return false;
      }
      return true;
    });
  }

  function countCustomRules(groupId: string) {
    const codes = new Set(options.filter(o => o.groupId === groupId).map(o => str(o.code)));
    return constraintRules.filter(r => {
      if (r.active === false || !codes.has(str(r.sourceOptionCode))) return false;
      if (str(r.ruleType) === 'excludes') {
        const targets = (r.targetOptionCodes as string[]) ?? [];
        if (targets.every(t => codes.has(t))) return false;
      }
      return true;
    }).length;
  }

  function getPrice(optCode: string) {
    const rule = priceRules.find(p =>
      p.active !== false && hasChannel(p.channels, channel) &&
      Array.isArray(p.optionCodes) && (p.optionCodes as string[]).includes(optCode));
    if (!rule) return null;
    return { amount: num(rule.amountCad), type: str(rule.pricingType) };
  }

  function formatPrice(optCode: string) {
    const p = getPrice(optCode);
    if (!p) return 'included';
    return p.type === 'absolute' ? `$${p.amount}` : `+$${p.amount}`;
  }

  // Human-readable availability for an option
  function availability(optCode: string): string {
    const rules = constraintRules.filter(r =>
      r.active !== false && r.sourceOptionCode === optCode &&
      ['requires', 'allowed_only_with'].includes(str(r.ruleType)));
    if (rules.length === 0) return 'Always available';
    const targets: string[] = [];
    for (const r of rules) {
      for (const t of (r.targetOptionCodes as string[]) ?? []) {
        targets.push(optionLabelMap.get(t) ?? t);
      }
    }
    if (targets.length === 1) return `Only with ${targets[0]}`;
    return `Available for ${targets.length} options`;
  }

  // Human-readable exceptions (non-sibling, non-availability rules)
  function exceptions(optCode: string): string {
    const rules = getCustomRules(optCode).filter(r => !['requires', 'allowed_only_with'].includes(str(r.ruleType)));
    if (rules.length === 0) return '';
    return rules.map(r => {
      const targets = ((r.targetOptionCodes as string[]) ?? []).map(t => optionLabelMap.get(t) ?? t);
      const type = str(r.ruleType);
      if (type === 'excludes') return `Not with ${targets.join(', ')}`;
      if (type === 'hidden_until') return `Hidden until ${targets.join(', ')}`;
      return `${type}: ${targets.join(', ')}`;
    }).join(' · ');
  }

  function startEdit(opt: Entity) {
    setEditingId(opt.id);
    const price = getPrice(str(opt.code));
    setEditForm({ label: str(opt.label), code: str(opt.code), active: opt.active !== false, priceAmount: price ? String(price.amount) : '', priceType: price?.type ?? 'delta' });
  }

  async function saveEdit(opt: Entity) {
    setSaving(true);
    const optCode = str(opt.code);
    // Save option fields
    await fetch('/api/crm/product-options', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'option', id: opt.id, label: editForm.label, code: editForm.code, active: editForm.active }),
    });
    // Upsert price rule
    const amt = str(editForm.priceAmount).trim();
    const existingPrice = priceRules.find(p =>
      p.active !== false && Array.isArray(p.optionCodes) && (p.optionCodes as string[]).includes(optCode));
    if (amt && Number(amt) !== 0) {
      if (existingPrice) {
        await fetch('/api/crm/product-options', {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity: 'price', id: existingPrice.id, amountCad: amt, pricingType: editForm.priceType }),
        });
      } else {
        await fetch('/api/crm/product-options', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity: 'price', code: `price_${str(editForm.code)}`, label: str(editForm.label), amountCad: amt, pricingType: editForm.priceType, optionCodes: [str(editForm.code)], channels: ['optical', 'sun', 'reglaze'], active: true }),
        });
      }
    }
    setSaving(false);
    setEditingId(null);
    onReload();
  }

  async function reorder(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    const reordered = [...groupOptions];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    // Batch update sort orders
    await Promise.all(reordered.map((opt, i) =>
      fetch('/api/crm/product-options', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: 'option', id: opt.id, sortOrder: i * 10 }),
      })
    ));
    onReload();
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--crm-space-4)', minHeight: 500 }}>
      {/* ── LEFT: Flow Health Map ── */}
      <div style={{ width: 240, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 2, marginBottom: 'var(--crm-space-3)' }}>
          {['optical', 'sun', 'reglaze'].map(ch => (
            <button key={ch} onClick={() => { setChannel(ch); setSelectedGroupCode(null); setInspecting(null); }}
              className={`crm-btn ${channel === ch ? 'crm-btn-primary' : 'crm-btn-ghost'}`}
              style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 10px', textTransform: 'capitalize', flex: 1 }}
            >{ch}</button>
          ))}
        </div>
        <div className="crm-card" style={{ padding: 0, overflow: 'hidden' }}>
          {channelSteps.map((step, si) => {
            const codes = (step.optionGroupCodes as string[]) ?? [];
            return (
              <div key={step.id}>
                <div style={{ padding: '8px 12px', fontSize: 'var(--crm-text-xs)', fontWeight: 600, background: 'var(--crm-surface-hover)', color: 'var(--crm-text-secondary)', borderBottom: '1px solid var(--crm-border-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', fontSize: 10, background: 'var(--crm-text-primary)', color: 'var(--crm-text-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{si + 1}</span>
                  {str(step.label)}
                </div>
                {codes.map(gc => {
                  const g = groupMap.get(gc);
                  if (!g) return null;
                  const isActive = activeGroupCode === gc;
                  const optCount = options.filter(o => o.groupId === g.id && o.active !== false && hasChannel(o.channels, channel)).length;
                  const ruleCount = countCustomRules(g.id);
                  return (
                    <button key={gc} onClick={() => { setSelectedGroupCode(gc); setInspecting(null); setEditingId(null); }}
                      style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '8px 12px 8px 38px', background: isActive ? 'var(--crm-surface-active)' : 'transparent', border: 'none', borderBottom: '1px solid var(--crm-border-light)', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--crm-text-primary)' : 'var(--crm-text-secondary)' }}>{str(g.label)}</span>
                      <span style={{ fontSize: 10, color: 'var(--crm-text-tertiary)' }}>
                        {str(g.selectionMode)} · {optCount} options{ruleCount > 0 ? ` · ${ruleCount} rules` : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── CENTER: Group Editor ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {activeGroup ? (
          <>
            <div className="crm-card" style={{ padding: '12px 16px', marginBottom: 'var(--crm-space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <h2 style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, margin: 0 }}>{str(activeGroup.label)}</h2>
                <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
                  <span className="crm-badge" style={{ background: 'var(--crm-surface-hover)', color: 'var(--crm-text-secondary)' }}>
                    {str(activeGroup.selectionMode) === 'single' ? '◉ Single select' : '☑ Multi select'}
                  </span>
                  {activeGroup.required && <span className="crm-badge" style={{ background: 'var(--crm-warning-light)', color: 'var(--crm-warning)' }}>Required</span>}
                </div>
              </div>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
                {str(activeGroup.selectionMode) === 'single'
                  ? 'Single select — sibling options are mutually exclusive automatically. Only cross-group exceptions shown.'
                  : 'Multi select — multiple options can be active. Exceptions listed per option.'}
              </div>
            </div>

            <div className="crm-card" style={{ overflow: 'hidden' }}>
              <table className="crm-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: 28 }} />
                    <th>Option</th>
                    <th style={{ width: 80 }}>Price</th>
                    <th>Availability</th>
                    <th>Exceptions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupOptions.map(opt => {
                    const optCode = str(opt.code);
                    const isEditing = editingId === opt.id;
                    const avail = availability(optCode);
                    const exc = exceptions(optCode);

                    if (isEditing) return (
                      <tr key={opt.id} style={{ background: 'var(--crm-surface-hover)' }}>
                        <td />
                        <td colSpan={4}>
                          <div style={{ display: 'flex', gap: 8, padding: '4px 0', flexWrap: 'wrap', alignItems: 'end' }}>
                            <label style={{ flex: 1, minWidth: 120 }}>
                              <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>Label</span>
                              <input className="crm-input" style={{ width: '100%' }} value={str(editForm.label)} onChange={e => setEditForm(p => ({ ...p, label: e.target.value }))} />
                            </label>
                            <label style={{ width: 120 }}>
                              <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>Code</span>
                              <input className="crm-input" style={{ width: '100%' }} value={str(editForm.code)} onChange={e => setEditForm(p => ({ ...p, code: e.target.value }))} />
                            </label>
                            <label style={{ width: 80 }}>
                              <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>Price $</span>
                              <input className="crm-input" style={{ width: '100%' }} type="number" step="0.01" value={str(editForm.priceAmount)} onChange={e => setEditForm(p => ({ ...p, priceAmount: e.target.value }))} placeholder="0" />
                            </label>
                            <label style={{ width: 80 }}>
                              <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>Type</span>
                              <select className="crm-input" style={{ width: '100%' }} value={str(editForm.priceType)} onChange={e => setEditForm(p => ({ ...p, priceType: e.target.value }))}>
                                <option value="delta">+delta</option>
                                <option value="absolute">absolute</option>
                              </select>
                            </label>
                            <label style={{ fontSize: 'var(--crm-text-xs)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', paddingBottom: 4 }}>
                              <input type="checkbox" checked={!!editForm.active} onChange={e => setEditForm(p => ({ ...p, active: e.target.checked }))} /> Active
                            </label>
                            <button className="crm-btn crm-btn-primary" style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 10px' }} disabled={saving} onClick={() => saveEdit(opt)}>{saving ? 'Saving…' : 'Save'}</button>
                            <button className="crm-btn crm-btn-ghost" style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 10px' }} onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        </td>
                      </tr>
                    );

                    const idx = groupOptions.indexOf(opt);
                    return (
                      <tr key={opt.id}
                        draggable
                        onDragStart={() => setDragIdx(idx)}
                        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderTop = '2px solid var(--crm-text-primary)'; }}
                        onDragLeave={e => { e.currentTarget.style.borderTop = ''; }}
                        onDrop={e => { e.currentTarget.style.borderTop = ''; if (dragIdx !== null) reorder(dragIdx, idx); setDragIdx(null); }}
                        onDragEnd={() => setDragIdx(null)}
                        style={{ cursor: 'grab', opacity: dragIdx === idx ? 0.4 : 1 }}
                      >
                        <td style={{ cursor: 'grab', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-xs)', textAlign: 'center', userSelect: 'none' }}>⠿</td>
                        <td style={{ fontWeight: 500, fontSize: 'var(--crm-text-sm)' }} onClick={() => startEdit(opt)}>{str(opt.label)}</td>
                        <td>
                          <span className="crm-badge" style={{
                            background: !getPrice(optCode) ? 'var(--crm-surface-hover)' : 'var(--crm-success-light)',
                            color: !getPrice(optCode) ? 'var(--crm-text-tertiary)' : 'var(--crm-success)',
                          }}>{formatPrice(optCode)}</span>
                        </td>
                        <td style={{ fontSize: 'var(--crm-text-xs)', color: avail === 'Always available' ? 'var(--crm-text-tertiary)' : 'var(--crm-text-secondary)' }}>{avail}</td>
                        <td style={{ fontSize: 'var(--crm-text-xs)', color: exc ? 'var(--crm-warning)' : 'var(--crm-text-tertiary)', cursor: 'pointer' }}
                          onClick={e => { e.stopPropagation(); setRuleEditCode(ruleEditCode === optCode ? null : optCode); setEditingId(null); }}>
                          {exc || '—'} {getCustomRules(optCode).length > 0 ? '✎' : ''}
                        </td>
                      </tr>
                      {ruleEditCode === optCode && (
                        <tr key={`rules-${opt.id}`}>
                          <td />
                          <td colSpan={4} style={{ background: 'var(--crm-surface-hover)', padding: '10px 12px' }}>
                            <RuleEditor optCode={optCode} optLabel={str(opt.label)} rules={getCustomRules(optCode)} allOptions={options} optionLabelMap={Object.fromEntries(optionLabelMap)} onReload={() => { onReload(); setRuleEditCode(null); }} />
                          </td>
                        </tr>
                      )}
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="crm-card" style={{ padding: 'var(--crm-space-12)', textAlign: 'center', color: 'var(--crm-text-tertiary)' }}>No steps for {channel}</div>
        )}
      </div>
    </div>
  );
}

/* ── Inline Rule Editor ──────────────────────────────── */

function RuleEditor({ optCode, optLabel, rules, allOptions, optionLabelMap, onReload }: {
  optCode: string; optLabel: string; rules: Entity[]; allOptions: Entity[];
  optionLabelMap: Record<string, string>; onReload: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [ruleType, setRuleType] = useState('requires');
  const [targets, setTargets] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const TYPES = [
    { value: 'requires', label: 'Available when…' },
    { value: 'excludes', label: 'Not available with…' },
    { value: 'allowed_only_with', label: 'Only available with…' },
    { value: 'hidden_until', label: 'Hidden until…' },
  ];

  const filtered = allOptions.filter(o =>
    o.active !== false && str(o.code) !== optCode &&
    (!search || str(o.label).toLowerCase().includes(search.toLowerCase()))
  );

  async function addRule() {
    if (!targets.length) return;
    setSaving(true);
    await fetch('/api/crm/product-options', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'constraint', code: `rule_${optCode}_${ruleType}_${Date.now()}`, ruleType, sourceOptionCode: optCode, targetOptionCodes: targets, active: true }),
    });
    setSaving(false);
    setAdding(false);
    setTargets([]);
    setSearch('');
    onReload();
  }

  async function deleteRule(id: string) {
    await fetch('/api/crm/product-options', {
      method: 'DELETE', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'constraint', id }),
    });
    onReload();
  }

  function toggleTarget(code: string) {
    setTargets(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  }

  const RULE_LABELS: Record<string, string> = { requires: 'Available when', excludes: 'Not available with', allowed_only_with: 'Only with', hidden_until: 'Hidden until', default_if: 'Default if', defer_if_no_rx: 'Deferred' };

  return (
    <div>
      <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, marginBottom: 8, color: 'var(--crm-text-secondary)' }}>
        Rules for {optLabel}
      </div>

      {rules.length === 0 && !adding && (
        <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 8 }}>No custom rules</div>
      )}

      {rules.map(r => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--crm-border-light)' }}>
          <span style={{ fontSize: 'var(--crm-text-xs)' }}>
            <strong style={{ color: str(r.ruleType) === 'excludes' ? 'var(--crm-error)' : 'var(--crm-warning)' }}>{RULE_LABELS[str(r.ruleType)] ?? str(r.ruleType)}</strong>{' '}
            {((r.targetOptionCodes as string[]) ?? []).map(t => optionLabelMap[t] ?? t).join(', ')}
          </span>
          <button className="crm-btn crm-btn-ghost" style={{ fontSize: 10, padding: '1px 6px', color: 'var(--crm-error)' }} onClick={() => deleteRule(r.id)}>✕</button>
        </div>
      ))}

      {adding ? (
        <div style={{ marginTop: 8 }}>
          <select className="crm-input" style={{ width: '100%', marginBottom: 6 }} value={ruleType} onChange={e => setRuleType(e.target.value)}>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input className="crm-input" style={{ width: '100%', marginBottom: 4 }} placeholder="Search options…" value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ maxHeight: 140, overflow: 'auto', marginBottom: 8 }}>
            {filtered.map(o => {
              const code = str(o.code);
              const sel = targets.includes(code);
              return (
                <button key={code} type="button" onClick={() => toggleTarget(code)} style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '3px 8px', border: 'none', cursor: 'pointer',
                  background: sel ? 'var(--crm-warning-light)' : 'transparent', color: sel ? 'var(--crm-warning)' : 'var(--crm-text-primary)',
                  fontSize: 'var(--crm-text-xs)', fontWeight: sel ? 600 : 400, borderRadius: 3,
                }}>{sel ? '✓ ' : ''}{str(o.label)}</button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="crm-btn crm-btn-primary" style={{ fontSize: 'var(--crm-text-xs)', padding: '3px 10px' }} disabled={saving || !targets.length} onClick={addRule}>{saving ? 'Saving…' : 'Add'}</button>
            <button className="crm-btn crm-btn-ghost" style={{ fontSize: 'var(--crm-text-xs)', padding: '3px 10px' }} onClick={() => { setAdding(false); setTargets([]); setSearch(''); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="crm-btn crm-btn-secondary" style={{ fontSize: 'var(--crm-text-xs)', marginTop: 8, padding: '3px 10px' }} onClick={() => setAdding(true)}>+ Add rule</button>
      )}
    </div>
  );
}

function str(v: unknown) { return String(v ?? ''); }
function num(v: unknown) { return Number(v ?? 0); }
function hasChannel(channels: unknown, ch: string) { return !Array.isArray(channels) || channels.includes(ch); }
