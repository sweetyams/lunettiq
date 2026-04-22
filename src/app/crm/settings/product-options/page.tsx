'use client';

import { useState, useEffect } from 'react';

type Tab = 'groups' | 'options' | 'prices' | 'constraints' | 'steps';

const TABS: { key: Tab; label: string }[] = [
  { key: 'groups', label: 'Groups' },
  { key: 'options', label: 'Options' },
  { key: 'prices', label: 'Pricing' },
  { key: 'constraints', label: 'Constraints' },
  { key: 'steps', label: 'Steps' },
];

interface Entity { id: string; [k: string]: unknown }

export default function ProductOptionsPage() {
  const [tab, setTab] = useState<Tab>('groups');
  const [data, setData] = useState<Record<string, Entity[]>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Entity | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/crm/product-options', { credentials: 'include' });
    const d = await res.json();
    setData(d.data ?? {});
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save(entity: string, item: Entity) {
    setSaving(true);
    const isNew = !item.id || item.id === 'new';
    const method = isNew ? 'POST' : 'PATCH';
    const { id: _id, ...rest } = item;
    const payload = isNew ? { entity, ...rest } : { entity, ...item };
    await fetch('/api/crm/product-options', {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    setEditing(null);
    load();
  }

  async function remove(entity: string, id: string) {
    if (!confirm('Delete this item?')) return;
    await fetch('/api/crm/product-options', {
      method: 'DELETE', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity, id }),
    });
    load();
  }

  const items = tab === 'groups' ? data.groups
    : tab === 'options' ? data.options
    : tab === 'prices' ? data.priceRules
    : tab === 'constraints' ? data.constraintRules
    : data.stepDefinitions;

  const entityName = tab === 'groups' ? 'group' : tab === 'options' ? 'option' : tab === 'prices' ? 'price' : tab === 'constraints' ? 'constraint' : 'step';

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      <a href="/crm/settings" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>← Settings</a>
      <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, marginBottom: 'var(--crm-space-4)' }}>Product Options</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--crm-space-4)', borderBottom: '1px solid var(--crm-border)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setEditing(null); }}
            style={{
              padding: '8px 16px', fontSize: 'var(--crm-text-sm)', cursor: 'pointer',
              borderBottom: tab === t.key ? '2px solid var(--crm-text-primary)' : '2px solid transparent',
              fontWeight: tab === t.key ? 600 : 400, background: 'none', border: 'none',
              borderBottomWidth: 2, borderBottomStyle: 'solid',
              borderBottomColor: tab === t.key ? 'var(--crm-text-primary, #000)' : 'transparent',
            }}>{t.label}</button>
        ))}
      </div>

      {loading ? <p style={{ fontSize: 'var(--crm-text-sm)' }}>Loading…</p> : (
        <>
          <div style={{ marginBottom: 'var(--crm-space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{items?.length ?? 0} items</span>
            <button className="crm-btn crm-btn-primary" style={{ fontSize: 'var(--crm-text-xs)' }}
              onClick={() => setEditing({ id: 'new' })}>+ Add</button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 'var(--crm-text-xs)', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--crm-border)', textAlign: 'left' }}>
                  {tab === 'groups' && <><th style={th}>Code</th><th style={th}>Label</th><th style={th}>Layer</th><th style={th}>Mode</th><th style={th}>Active</th></>}
                  {tab === 'options' && <><th style={th}>Code</th><th style={th}>Label</th><th style={th}>Channels</th><th style={th}>Sort</th><th style={th}>Active</th></>}
                  {tab === 'prices' && <><th style={th}>Code</th><th style={th}>Label</th><th style={th}>Amount</th><th style={th}>Type</th><th style={th}>Channels</th></>}
                  {tab === 'constraints' && <><th style={th}>Code</th><th style={th}>Rule</th><th style={th}>Source</th><th style={th}>Targets</th></>}
                  {tab === 'steps' && <><th style={th}>Channel</th><th style={th}>Code</th><th style={th}>Label</th><th style={th}>Order</th><th style={th}>Groups</th></>}
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(items ?? []).map((item: Entity) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--crm-border)' }}>
                    {tab === 'groups' && <><td style={td}>{s(item.code)}</td><td style={td}>{s(item.label)}</td><td style={td}>{s(item.layer)}</td><td style={td}>{s(item.selectionMode)}</td><td style={td}>{item.active ? '✓' : '✗'}</td></>}
                    {tab === 'options' && <><td style={td}>{s(item.code)}</td><td style={td}>{s(item.label)}</td><td style={td}>{arr(item.channels)}</td><td style={td}>{s(item.sortOrder)}</td><td style={td}>{item.active ? '✓' : '✗'}</td></>}
                    {tab === 'prices' && <><td style={td}>{s(item.code)}</td><td style={td}>{s(item.label)}</td><td style={td}>${s(item.amountCad)}</td><td style={td}>{s(item.pricingType)}</td><td style={td}>{arr(item.channels)}</td></>}
                    {tab === 'constraints' && <><td style={td}>{s(item.code)}</td><td style={td}>{s(item.ruleType)}</td><td style={td}>{s(item.sourceOptionCode)}</td><td style={td}>{arr(item.targetOptionCodes)}</td></>}
                    {tab === 'steps' && <><td style={td}>{s(item.channel)}</td><td style={td}>{s(item.code)}</td><td style={td}>{s(item.label)}</td><td style={td}>{s(item.sortOrder)}</td><td style={td}>{arr(item.optionGroupCodes)}</td></>}
                    <td style={td}>
                      <button onClick={() => setEditing(item)} style={{ fontSize: 'var(--crm-text-xs)', cursor: 'pointer', marginRight: 8, background: 'none', border: 'none', textDecoration: 'underline' }}>Edit</button>
                      <button onClick={() => remove(entityName, item.id)} style={{ fontSize: 'var(--crm-text-xs)', cursor: 'pointer', color: 'red', background: 'none', border: 'none', textDecoration: 'underline' }}>Del</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Edit modal */}
          {editing && (
            <EditModal
              entity={entityName}
              item={editing}
              groups={data.groups ?? []}
              onSave={(item) => save(entityName, item)}
              onClose={() => setEditing(null)}
              saving={saving}
            />
          )}
        </>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 600 };
const td: React.CSSProperties = { padding: '6px 8px' };
function s(v: unknown) { return String(v ?? ''); }
function arr(v: unknown) { return Array.isArray(v) ? v.join(', ') : s(v); }

/* ------------------------------------------------------------------ */
/*  Edit Modal                                                         */
/* ------------------------------------------------------------------ */

function EditModal({ entity, item, groups, onSave, onClose, saving }: {
  entity: string;
  item: Entity;
  groups: Entity[];
  onSave: (item: Entity) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Entity>({ ...item });
  const isNew = item.id === 'new';

  function set(key: string, value: unknown) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function setJsonArray(key: string, value: string) {
    try { set(key, value.split(',').map(s => s.trim()).filter(Boolean)); } catch { /* ignore */ }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="crm-card" style={{ padding: 'var(--crm-space-5)', width: 480, maxHeight: '80vh', overflow: 'auto' }}>
        <h2 style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>
          {isNew ? 'New' : 'Edit'} {entity}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2)' }}>
          {entity === 'group' && <>
            <Field label="Code" value={s(form.code)} onChange={v => set('code', v)} />
            <Field label="Label" value={s(form.label)} onChange={v => set('label', v)} />
            <SelectField label="Layer" value={s(form.layer)} options={['channel','lens_path','material','finish_state','treatment','shipping']} onChange={v => set('layer', v)} />
            <SelectField label="Selection Mode" value={s(form.selectionMode ?? 'single')} options={['single','multi','none']} onChange={v => set('selectionMode', v)} />
            <CheckField label="Required" checked={!!form.required} onChange={v => set('required', v)} />
            <CheckField label="Active" checked={form.active !== false} onChange={v => set('active', v)} />
          </>}

          {entity === 'option' && <>
            <Field label="Code" value={s(form.code)} onChange={v => set('code', v)} />
            <Field label="Label" value={s(form.label)} onChange={v => set('label', v)} />
            <SelectField label="Group" value={s(form.groupId)} options={groups.map(g => ({ value: g.id, label: s(g.label) }))} onChange={v => set('groupId', v)} />
            <Field label="Channels (comma-sep)" value={arr(form.channels)} onChange={v => setJsonArray('channels', v)} />
            <Field label="Sort Order" value={s(form.sortOrder ?? 0)} onChange={v => set('sortOrder', Number(v))} />
            <CheckField label="Active" checked={form.active !== false} onChange={v => set('active', v)} />
          </>}

          {entity === 'price' && <>
            <Field label="Code" value={s(form.code)} onChange={v => set('code', v)} />
            <Field label="Label" value={s(form.label)} onChange={v => set('label', v)} />
            <Field label="Amount (CAD)" value={s(form.amountCad ?? 0)} onChange={v => set('amountCad', v)} />
            <SelectField label="Pricing Type" value={s(form.pricingType ?? 'delta')} options={['delta','absolute']} onChange={v => set('pricingType', v)} />
            <Field label="Channels (comma-sep)" value={arr(form.channels)} onChange={v => setJsonArray('channels', v)} />
            <Field label="Option Codes (comma-sep)" value={arr(form.optionCodes)} onChange={v => setJsonArray('optionCodes', v)} />
            <CheckField label="Active" checked={form.active !== false} onChange={v => set('active', v)} />
          </>}

          {entity === 'constraint' && <>
            <Field label="Code" value={s(form.code)} onChange={v => set('code', v)} />
            <SelectField label="Rule Type" value={s(form.ruleType)} options={['requires','excludes','allowed_only_with','hidden_until','default_if','defer_if_no_rx']} onChange={v => set('ruleType', v)} />
            <Field label="Source Option Code" value={s(form.sourceOptionCode)} onChange={v => set('sourceOptionCode', v)} />
            <Field label="Target Option Codes (comma-sep)" value={arr(form.targetOptionCodes)} onChange={v => setJsonArray('targetOptionCodes', v)} />
            <CheckField label="Active" checked={form.active !== false} onChange={v => set('active', v)} />
          </>}

          {entity === 'step' && <>
            <SelectField label="Channel" value={s(form.channel)} options={['optical','sun','reglaze']} onChange={v => set('channel', v)} />
            <Field label="Code" value={s(form.code)} onChange={v => set('code', v)} />
            <Field label="Label" value={s(form.label)} onChange={v => set('label', v)} />
            <Field label="Sort Order" value={s(form.sortOrder ?? 0)} onChange={v => set('sortOrder', Number(v))} />
            <Field label="Option Group Codes (comma-sep)" value={arr(form.optionGroupCodes)} onChange={v => setJsonArray('optionGroupCodes', v)} />
            <CheckField label="Active" checked={form.active !== false} onChange={v => set('active', v)} />
          </>}
        </div>

        <div style={{ marginTop: 'var(--crm-space-4)', display: 'flex', gap: 8 }}>
          <button className="crm-btn crm-btn-primary" style={{ fontSize: 'var(--crm-text-sm)' }}
            disabled={saving} onClick={() => onSave(form)}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="crm-btn" style={{ fontSize: 'var(--crm-text-sm)' }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', display: 'block', marginBottom: 2 }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} className="crm-input" style={{ width: '100%', fontSize: 'var(--crm-text-sm)' }} />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: (string | { value: string; label: string })[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', display: 'block', marginBottom: 2 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="crm-input" style={{ width: '100%', fontSize: 'var(--crm-text-sm)' }}>
        <option value="">—</option>
        {options.map(o => typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
        )}
      </select>
    </div>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ fontSize: 'var(--crm-text-sm)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
