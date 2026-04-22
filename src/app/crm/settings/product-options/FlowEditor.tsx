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

type Selection = { type: 'group'; groupCode: string; channel: string } | null;

export default function FlowEditor({ steps, groups, options, priceRules, constraintRules, onReload }: Props) {
  const [channel, setChannel] = useState<string>('optical');
  const [selected, setSelected] = useState<Selection>(null);

  const channelSteps = useMemo(() =>
    steps.filter(s => s.channel === channel && s.active !== false)
      .sort((a, b) => num(a.sortOrder) - num(b.sortOrder)),
    [steps, channel]
  );

  const groupMap = useMemo(() => {
    const m = new Map<string, Entity>();
    for (const g of groups) m.set(String(g.code), g);
    return m;
  }, [groups]);

  const selectedGroup = selected ? groupMap.get(selected.groupCode) ?? null : null;
  const groupOptions = selectedGroup
    ? options.filter(o => o.groupId === selectedGroup.id && o.active !== false && hasChannel(o.channels, channel))
        .sort((a, b) => num(a.sortOrder) - num(b.sortOrder))
    : [];

  return (
    <div style={{ display: 'flex', gap: 'var(--crm-space-4)', minHeight: 500 }}>
      {/* Left: Tree nav */}
      <div style={{ width: 260, flexShrink: 0 }}>
        {/* Channel tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 'var(--crm-space-3)' }}>
          {['optical', 'sun', 'reglaze'].map(ch => (
            <button
              key={ch}
              onClick={() => { setChannel(ch); setSelected(null); }}
              className={`crm-btn ${channel === ch ? 'crm-btn-primary' : 'crm-btn-ghost'}`}
              style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 10px', textTransform: 'capitalize', flex: 1 }}
            >{ch}</button>
          ))}
        </div>

        {/* Steps tree */}
        <div className="crm-card" style={{ padding: 0, overflow: 'hidden' }}>
          {channelSteps.map((step, si) => {
            const groupCodes = (step.optionGroupCodes as string[]) ?? [];
            return (
              <div key={step.id}>
                <div style={{
                  padding: '8px 12px', fontSize: 'var(--crm-text-xs)', fontWeight: 600,
                  background: 'var(--crm-surface-hover)', color: 'var(--crm-text-secondary)',
                  borderBottom: '1px solid var(--crm-border-light)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%', fontSize: 10,
                    background: 'var(--crm-text-primary)', color: 'var(--crm-text-inverse)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{si + 1}</span>
                  {String(step.label)}
                </div>
                {groupCodes.map(gc => {
                  const g = groupMap.get(gc);
                  if (!g) return null;
                  const isSelected = selected?.groupCode === gc && selected?.channel === channel;
                  const optCount = options.filter(o => o.groupId === g.id && o.active !== false && hasChannel(o.channels, channel)).length;
                  return (
                    <button
                      key={gc}
                      onClick={() => setSelected({ type: 'group', groupCode: gc, channel })}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '8px 12px 8px 38px',
                        background: isSelected ? 'var(--crm-surface-active)' : 'transparent',
                        border: 'none', borderBottom: '1px solid var(--crm-border-light)',
                        cursor: 'pointer', fontSize: 'var(--crm-text-sm)', textAlign: 'left',
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected ? 'var(--crm-text-primary)' : 'var(--crm-text-secondary)',
                      }}
                    >
                      <span>{String(g.label)}</span>
                      <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
                        {String(g.selectionMode)} · {optCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
          {channelSteps.length === 0 && (
            <div style={{ padding: 'var(--crm-space-6)', textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-xs)' }}>
              No steps for {channel}
            </div>
          )}
        </div>
      </div>

      {/* Right: Group detail */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {selectedGroup ? (
          <GroupDetail
            group={selectedGroup}
            channel={channel}
            options={groupOptions}
            priceRules={priceRules}
            constraintRules={constraintRules}
            allOptions={options}
            onReload={onReload}
          />
        ) : (
          <div className="crm-card" style={{ padding: 'var(--crm-space-12)', textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>
            Select a group from the tree to edit
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Group Detail Panel ─────────────────────────────── */

function GroupDetail({ group, channel, options: groupOptions, priceRules, constraintRules, allOptions, onReload }: {
  group: Entity; channel: string; options: Entity[];
  priceRules: Entity[]; constraintRules: Entity[]; allOptions: Entity[];
  onReload: () => void;
}) {
  const [ruleDrawer, setRuleDrawer] = useState<Entity | null>(null);

  function getRules(optCode: string) {
    return constraintRules.filter(r =>
      r.active !== false && (r.sourceOptionCode === optCode ||
        (Array.isArray(r.targetOptionCodes) && (r.targetOptionCodes as string[]).includes(optCode)))
    );
  }

  function getPrice(optCode: string) {
    const rule = priceRules.find(p =>
      p.active !== false && hasChannel(p.channels, channel) &&
      Array.isArray(p.optionCodes) && (p.optionCodes as string[]).includes(optCode)
    );
    if (!rule) return 'included';
    return str(rule.pricingType) === 'absolute' ? `$${str(rule.amountCad)}` : `+$${str(rule.amountCad)}`;
  }

  return (
    <>
      {/* Group header */}
      <div className="crm-card" style={{ padding: '14px 16px', marginBottom: 'var(--crm-space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, margin: 0 }}>{str(group.label)}</h2>
          <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
            <span className="crm-badge" style={{
              background: str(group.selectionMode) === 'single' ? 'var(--crm-surface-hover)' : 'var(--crm-success-light)',
              color: str(group.selectionMode) === 'single' ? 'var(--crm-text-secondary)' : 'var(--crm-success)',
            }}>
              {str(group.selectionMode) === 'single' ? '◉ Single select' : '☑ Multi select'}
            </span>
            {group.required && (
              <span className="crm-badge" style={{ background: 'var(--crm-warning-light)', color: 'var(--crm-warning)' }}>Required</span>
            )}
          </div>
        </div>
        <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
          {str(group.selectionMode) === 'single'
            ? 'Selecting one option deselects all others. No exclusion rules needed within this group.'
            : 'Multiple options can be selected. Use rules below to define exceptions.'}
        </div>
      </div>

      {/* Options table */}
      <div className="crm-card" style={{ overflow: 'hidden' }}>
        <table className="crm-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th>Option</th>
              <th style={{ width: 90 }}>Price</th>
              <th>Rules</th>
              <th style={{ width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {groupOptions.map((opt, i) => {
              const rules = getRules(String(opt.code));
              const price = getPrice(String(opt.code));
              return (
                <tr key={opt.id}>
                  <td style={{ color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-xs)' }}>{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 'var(--crm-text-sm)' }}>{str(opt.label)}</div>
                  </td>
                  <td>
                    <span className="crm-badge" style={{
                      background: price === 'included' ? 'var(--crm-surface-hover)' : 'var(--crm-success-light)',
                      color: price === 'included' ? 'var(--crm-text-tertiary)' : 'var(--crm-success)',
                    }}>{price}</span>
                  </td>
                  <td>
                    {rules.length === 0 ? (
                      <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {groupRulesByType(rules, String(opt.code), allOptions)}
                      </div>
                    )}
                  </td>
                  <td>
                    <button
                      className="crm-btn crm-btn-ghost"
                      style={{ fontSize: 'var(--crm-text-xs)', padding: '2px 8px' }}
                      onClick={() => setRuleDrawer(opt)}
                    >Rules</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {groupOptions.length === 0 && (
          <div style={{ padding: 'var(--crm-space-8)', textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>
            No options in this group for {channel}
          </div>
        )}
      </div>

      {/* Rule drawer */}
      {ruleDrawer && (
        <RuleDrawer
          option={ruleDrawer}
          rules={constraintRules.filter(r => r.active !== false && r.sourceOptionCode === str(ruleDrawer.code))}
          allOptions={allOptions}
          onClose={() => setRuleDrawer(null)}
          onReload={onReload}
        />
      )}
    </>
  );
}

/* ── Rule Drawer ────────────────────────────────────── */

function RuleDrawer({ option, rules, allOptions, onClose, onReload }: {
  option: Entity; rules: Entity[]; allOptions: Entity[];
  onClose: () => void; onReload: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newRule, setNewRule] = useState({ ruleType: 'requires', targets: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = allOptions.filter(o =>
    o.active !== false && str(o.code) !== str(option.code) &&
    (!search || str(o.label).toLowerCase().includes(search.toLowerCase()))
  );

  async function addRule() {
    if (newRule.targets.length === 0) return;
    setSaving(true);
    await fetch('/api/crm/product-options', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity: 'constraint',
        code: `rule_${str(option.code)}_${newRule.ruleType}_${Date.now()}`,
        ruleType: newRule.ruleType,
        sourceOptionCode: str(option.code),
        targetOptionCodes: newRule.targets,
        active: true,
      }),
    });
    setSaving(false);
    setAdding(false);
    setNewRule({ ruleType: 'requires', targets: [] });
    setSearch('');
    onReload();
  }

  function toggleTarget(code: string) {
    setNewRule(p => ({
      ...p,
      targets: p.targets.includes(code) ? p.targets.filter(c => c !== code) : [...p.targets, code],
    }));
  }

  async function deleteRule(id: string) {
    await fetch('/api/crm/product-options', {
      method: 'DELETE', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'constraint', id }),
    });
    onReload();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'flex-end', zIndex: 100 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: 420, background: 'var(--crm-surface)', height: '100%', overflow: 'auto', padding: 'var(--crm-space-5)', borderLeft: '1px solid var(--crm-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--crm-space-4)' }}>
          <h3 style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, margin: 0 }}>
            Rules: {str(option.label)}
          </h3>
          <button className="crm-btn crm-btn-ghost" onClick={onClose} style={{ fontSize: 'var(--crm-text-sm)' }}>✕</button>
        </div>

        <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 'var(--crm-space-4)' }}>
          Rules for cross-group logic only. Intra-group exclusions are handled by selection mode.
        </div>

        {/* Existing rules */}
        {rules.length === 0 && !adding && (
          <div style={{ padding: 'var(--crm-space-6)', textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>
            No rules. This option has no cross-group conditions.
          </div>
        )}
        {rules.map(r => (
          <div key={r.id} className="crm-card" style={{ padding: '10px 12px', marginBottom: 'var(--crm-space-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span className="crm-badge" style={{
                background: str(r.ruleType) === 'excludes' ? 'var(--crm-error-light)' : 'var(--crm-warning-light)',
                color: str(r.ruleType) === 'excludes' ? 'var(--crm-error)' : 'var(--crm-warning)',
                marginRight: 6,
              }}>{str(r.ruleType)}</span>
              <span style={{ fontSize: 'var(--crm-text-sm)' }}>{labelsFor(r.targetOptionCodes, allOptions)}</span>
            </div>
            <button className="crm-btn crm-btn-ghost" style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-error)', padding: '2px 6px' }} onClick={() => deleteRule(r.id)}>✕</button>
          </div>
        ))}

        {/* Add rule */}
        {adding ? (
          <div className="crm-card" style={{ padding: '12px', marginTop: 'var(--crm-space-2)' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 'var(--crm-space-3)' }}>
              <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>Rule type</span>
              <select className="crm-input" value={newRule.ruleType} onChange={e => setNewRule(p => ({ ...p, ruleType: e.target.value }))}>
                <option value="requires">requires</option>
                <option value="excludes">excludes</option>
                <option value="allowed_only_with">allowed_only_with</option>
                <option value="hidden_until">hidden_until</option>
              </select>
            </label>
            <div style={{ marginBottom: 'var(--crm-space-2)' }}>
              <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>Target options ({newRule.targets.length} selected)</span>
              <input className="crm-input" style={{ width: '100%', marginTop: 2 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search options…" />
            </div>
            <div style={{ maxHeight: 180, overflow: 'auto', marginBottom: 'var(--crm-space-3)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filteredOptions.map(o => {
                const code = str(o.code);
                const selected = newRule.targets.includes(code);
                return (
                  <button key={code} type="button" onClick={() => toggleTarget(code)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px',
                    background: selected ? 'var(--crm-warning-light)' : 'transparent',
                    border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 'var(--crm-text-sm)',
                    textAlign: 'left', color: selected ? 'var(--crm-warning)' : 'var(--crm-text-primary)',
                    fontWeight: selected ? 600 : 400,
                  }}>
                    <span style={{ width: 16 }}>{selected ? '✓' : ''}</span>
                    {str(o.label)}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="crm-btn crm-btn-primary" style={{ fontSize: 'var(--crm-text-xs)' }} disabled={saving || newRule.targets.length === 0} onClick={addRule}>
                {saving ? 'Saving…' : 'Add rule'}
              </button>
              <button className="crm-btn crm-btn-secondary" style={{ fontSize: 'var(--crm-text-xs)' }} onClick={() => { setAdding(false); setNewRule({ ruleType: 'requires', targets: [] }); setSearch(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="crm-btn crm-btn-secondary" style={{ fontSize: 'var(--crm-text-xs)', marginTop: 'var(--crm-space-3)', width: '100%' }} onClick={() => setAdding(true)}>
            + Add rule
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────── */

function groupRulesByType(rules: Entity[], optCode: string, allOptions: Entity[]) {
  const byType = new Map<string, string[]>();
  for (const r of rules) {
    const type = str(r.ruleType);
    if (!byType.has(type)) byType.set(type, []);
    if (r.sourceOptionCode === optCode) {
      for (const t of (r.targetOptionCodes as string[]) ?? []) byType.get(type)!.push(labelFor(t, allOptions));
    } else {
      byType.get(type)!.push(labelFor(str(r.sourceOptionCode), allOptions));
    }
  }
  return [...byType.entries()].map(([type, labels]) => {
    const unique = [...new Set(labels)];
    const isExclude = type === 'excludes';
    return (
      <div key={type} style={{ fontSize: 'var(--crm-text-xs)', display: 'flex', gap: 4, alignItems: 'baseline' }}>
        <span style={{ fontWeight: 600, color: isExclude ? 'var(--crm-error)' : 'var(--crm-warning)', whiteSpace: 'nowrap' }}>{type}</span>
        <span style={{ color: 'var(--crm-text-secondary)' }}>{unique.join(', ')}</span>
      </div>
    );
  });
}

function str(v: unknown) { return String(v ?? ''); }
function num(v: unknown) { return Number(v ?? 0); }
function arr(v: unknown) { return Array.isArray(v) ? v.join(', ') : str(v); }
function hasChannel(channels: unknown, ch: string) {
  return !Array.isArray(channels) || channels.includes(ch);
}
function labelFor(code: string, allOptions: Entity[]): string {
  const o = allOptions.find(x => x.code === code);
  return o ? String(o.label) : code;
}
function labelsFor(codes: unknown, allOptions: Entity[]): string {
  if (!Array.isArray(codes)) return str(codes);
  return codes.map(c => labelFor(c, allOptions)).join(', ');
}
