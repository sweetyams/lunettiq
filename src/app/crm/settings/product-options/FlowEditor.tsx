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
    setEditForm({ label: str(opt.label), code: str(opt.code), sortOrder: num(opt.sortOrder), active: opt.active !== false });
  }

  async function saveEdit(opt: Entity) {
    setSaving(true);
    await fetch('/api/crm/product-options', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'option', id: opt.id, ...editForm }),
    });
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
                        <td style={{ fontSize: 'var(--crm-text-xs)', color: exc ? 'var(--crm-warning)' : 'var(--crm-text-tertiary)' }}>{exc || '—'}</td>
                      </tr>
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

function str(v: unknown) { return String(v ?? ''); }
function num(v: unknown) { return Number(v ?? 0); }
function hasChannel(channels: unknown, ch: string) { return !Array.isArray(channels) || channels.includes(ch); }
