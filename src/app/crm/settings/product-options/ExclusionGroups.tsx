'use client';

import { useState, useMemo } from 'react';

interface Entity { id: string; [k: string]: unknown }

interface Props {
  constraintRules: Entity[];
  options: Entity[];
  onSave: () => void;
}

/** Detect exclusion groups from xg_ prefixed constraint codes */
function detectGroups(rules: Entity[]): Map<string, string[]> {
  const groups = new Map<string, Set<string>>();
  for (const r of rules) {
    const code = String(r.code ?? '');
    if (!code.startsWith('xg_') || r.ruleType !== 'excludes') continue;
    // code format: xg_{groupName}_{optionCode}
    const rest = code.slice(3);
    const lastUnderscore = rest.lastIndexOf('_');
    if (lastUnderscore < 1) continue;
    const groupName = rest.slice(0, lastUnderscore);
    const optCode = rest.slice(lastUnderscore + 1);
    if (!groups.has(groupName)) groups.set(groupName, new Set());
    groups.get(groupName)!.add(optCode);
  }
  const result = new Map<string, string[]>();
  groups.forEach((members, name) => result.set(name, [...members]));
  return result;
}

export default function ExclusionGroups({ constraintRules, options, onSave }: Props) {
  const groups = useMemo(() => detectGroups(constraintRules), [constraintRules]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMembers, setNewMembers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const optionsByCode = useMemo(() => {
    const map = new Map<string, Entity>();
    for (const o of options) map.set(String(o.code), o);
    return map;
  }, [options]);

  async function createGroup() {
    if (!newName.trim() || newMembers.length < 2) return;
    setSaving(true);
    await fetch('/api/crm/product-options', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'exclusion-group', name: newName.trim().toLowerCase().replace(/\s+/g, '_'), members: newMembers }),
    });
    setSaving(false);
    setAdding(false);
    setNewName('');
    setNewMembers([]);
    onSave();
  }

  async function deleteGroup(name: string, members: string[]) {
    if (!confirm(`Remove exclusion group "${name}"? This deletes ${members.length} constraint rules.`)) return;
    await fetch('/api/crm/product-options', {
      method: 'DELETE', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'exclusion-group', name, members }),
    });
    onSave();
  }

  function toggleMember(code: string) {
    setNewMembers(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  }

  const activeOptions = options.filter(o => o.active !== false);

  return (
    <div style={{ marginTop: 'var(--crm-space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--crm-space-3)' }}>
        <h3 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, margin: 0, color: 'var(--crm-text-secondary)' }}>
          Exclusion Groups
        </h3>
        {!adding && (
          <button className="crm-btn crm-btn-secondary" style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 10px' }} onClick={() => setAdding(true)}>
            + Add group
          </button>
        )}
      </div>

      {groups.size === 0 && !adding && (
        <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', padding: '8px 0' }}>
          No exclusion groups. Options within a group are mutually exclusive — selecting one disables the rest.
        </div>
      )}

      {/* Existing groups */}
      {[...groups.entries()].map(([name, members]) => (
        <div key={name} className="crm-card" style={{ padding: '10px 14px', marginBottom: 'var(--crm-space-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>{name}</span>
            <button
              className="crm-btn crm-btn-ghost"
              style={{ fontSize: 'var(--crm-text-xs)', padding: '2px 8px', color: 'var(--crm-error)' }}
              onClick={() => deleteGroup(name, members)}
            >Remove</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {members.map(code => {
              const opt = optionsByCode.get(code);
              return (
                <span key={code} className="crm-badge" style={{ background: 'var(--crm-warning-light)', color: 'var(--crm-warning)' }}>
                  {opt ? String(opt.label) : code}
                </span>
              );
            })}
          </div>
        </div>
      ))}

      {/* Add new group */}
      {adding && (
        <div className="crm-card" style={{ padding: '14px', marginTop: 'var(--crm-space-2)' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 'var(--crm-space-3)' }}>
            <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>Group name</span>
            <input className="crm-input" style={{ width: '100%' }} value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. tint_type" />
          </label>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 6 }}>
            Select options that are mutually exclusive ({newMembers.length} selected, need ≥2):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 'var(--crm-space-3)', maxHeight: 200, overflow: 'auto' }}>
            {activeOptions.map(o => {
              const code = String(o.code);
              const selected = newMembers.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggleMember(code)}
                  className="crm-badge"
                  style={{
                    cursor: 'pointer', border: 'none',
                    background: selected ? 'var(--crm-warning-light)' : 'var(--crm-surface-hover)',
                    color: selected ? 'var(--crm-warning)' : 'var(--crm-text-secondary)',
                    fontWeight: selected ? 600 : 400,
                  }}
                >
                  {selected ? '✓ ' : ''}{String(o.label)}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="crm-btn crm-btn-primary" style={{ fontSize: 'var(--crm-text-xs)' }} disabled={saving || newMembers.length < 2 || !newName.trim()} onClick={createGroup}>
              {saving ? 'Creating…' : 'Create group'}
            </button>
            <button className="crm-btn crm-btn-secondary" style={{ fontSize: 'var(--crm-text-xs)' }} onClick={() => { setAdding(false); setNewMembers([]); setNewName(''); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
