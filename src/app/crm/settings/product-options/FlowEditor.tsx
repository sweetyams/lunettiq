'use client';

import { useState, useMemo } from 'react';
import {
  Entity, str, num, hasChannel, getCustomRules, countCustomRules,
  getPrice, formatPrice, availability, exceptions,
} from './flow-helpers';
import { LeftPane, GroupHeader, OptionTable } from './FlowPanels';

interface Props {
  steps: Entity[];
  groups: Entity[];
  options: Entity[];
  priceRules: Entity[];
  constraintRules: Entity[];
  onReload: () => void;
}

export default function FlowEditor(props: Props) {
  const { steps, groups, options, priceRules, constraintRules, onReload } = props;
  const [channel, setChannel] = useState('optical');
  const [selGroup, setSelGroup] = useState('');
  const [editId, setEditId] = useState('');
  const [editForm, setEditForm] = useState({} as Record<string, unknown>);
  const [saving, setSaving] = useState(false);
  const [ruleEdit, setRuleEdit] = useState('');
  const [dragIdx, setDragIdx] = useState(-1);

  const cSteps = useMemo(
    () => steps.filter(s => s.channel === channel && s.active !== false).sort((a, b) => num(a.sortOrder) - num(b.sortOrder)),
    [steps, channel],
  );

  const gMap = useMemo(() => {
    const m = new Map();
    groups.forEach(g => m.set(str(g.code), g));
    return m as Map<string, Entity>;
  }, [groups]);

  const lblMap = useMemo(() => {
    const m = new Map();
    options.forEach(o => m.set(str(o.code), str(o.label)));
    return m as Map<string, string>;
  }, [options]);

  const firstCode = cSteps.flatMap(s => (s.optionGroupCodes as string[]) || []).at(0) || '';
  const activeCode = (selGroup && gMap.has(selGroup)) ? selGroup : firstCode;
  const activeGroup = gMap.get(activeCode) || null;

  const gOpts = activeGroup
    ? options.filter(o => o.groupId === activeGroup.id && o.active !== false && hasChannel(o.channels, channel)).sort((a, b) => num(a.sortOrder) - num(b.sortOrder))
    : [];
  const gCodes = useMemo(() => new Set(gOpts.map(o => str(o.code))), [gOpts]);

  function startEdit(o: Entity) {
    const p = getPrice(str(o.code), priceRules, channel);
    setEditId(o.id);
    setEditForm({ label: str(o.label), code: str(o.code), active: o.active !== false, priceAmt: p ? String(p.amount) : '', priceType: p?.type || 'delta' });
  }

  async function saveEdit(o: Entity) {
    setSaving(true);
    const h = { 'Content-Type': 'application/json' };
    const c = { credentials: 'include' as const };
    await fetch('/api/crm/product-options', { method: 'PATCH', headers: h, ...c, body: JSON.stringify({ entity: 'option', id: o.id, label: editForm.label, code: editForm.code, active: editForm.active }) });
    const amt = String(editForm.priceAmt || '').trim();
    if (amt && Number(amt) !== 0) {
      const ep = getPrice(str(o.code), priceRules, channel);
      const body = ep
        ? { entity: 'price', id: ep.id, amountCad: amt, pricingType: editForm.priceType }
        : { entity: 'price', code: 'price_' + str(editForm.code), label: str(editForm.label), amountCad: amt, pricingType: editForm.priceType, optionCodes: [str(editForm.code)], channels: ['optical', 'sun', 'reglaze'], active: true };
      await fetch('/api/crm/product-options', { method: ep ? 'PATCH' : 'POST', headers: h, ...c, body: JSON.stringify(body) });
    }
    setSaving(false); setEditId(''); onReload();
  }

  async function reorder(from: number, to: number) {
    if (from === to) return;
    const arr = [...gOpts];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    const h = { 'Content-Type': 'application/json' };
    await Promise.all(arr.map((o, i) => fetch('/api/crm/product-options', { method: 'PATCH', credentials: 'include', headers: h, body: JSON.stringify({ entity: 'option', id: o.id, sortOrder: i * 10 }) })));
    onReload();
  }

  return (
    <div style={{ display: 'flex', gap: 16, minHeight: 500 }}>
      <LeftPane channel={channel} setChannel={ch => { setChannel(ch); setSelGroup(''); }} cSteps={cSteps} gMap={gMap} activeCode={activeCode} setSelGroup={setSelGroup} options={options} constraintRules={constraintRules} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {activeGroup ? (<>
          <GroupHeader group={activeGroup} />
          <OptionTable gOpts={gOpts} gCodes={gCodes} editId={editId} editForm={editForm} setEditForm={setEditForm} saving={saving} startEdit={startEdit} saveEdit={saveEdit} cancelEdit={() => setEditId('')} ruleEdit={ruleEdit} setRuleEdit={setRuleEdit} dragIdx={dragIdx} setDragIdx={setDragIdx} reorder={reorder} priceRules={priceRules} constraintRules={constraintRules} options={options} lblMap={lblMap} channel={channel} onReload={onReload} />
        </>) : <div className="crm-card" style={{ padding: 48, textAlign: 'center', color: 'var(--crm-text-tertiary)' }}>No steps for {channel}</div>}
      </div>
    </div>
  );
}
