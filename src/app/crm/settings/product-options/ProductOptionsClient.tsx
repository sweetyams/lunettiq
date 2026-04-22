'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import FlowEditor from './FlowEditor';

type View = 'preview' | 'advanced';
type Tab = 'groups' | 'options' | 'prices' | 'constraints' | 'steps';

const TABS: { key: Tab; label: string; entity: string }[] = [
  { key: 'groups', label: 'Groups', entity: 'group' },
  { key: 'options', label: 'Options', entity: 'option' },
  { key: 'prices', label: 'Pricing', entity: 'price' },
  { key: 'constraints', label: 'Constraints', entity: 'constraint' },
  { key: 'steps', label: 'Steps', entity: 'step' },
];

const DATA_KEYS: Record<Tab, string> = {
  groups: 'groups', options: 'options', prices: 'priceRules',
  constraints: 'constraintRules', steps: 'stepDefinitions',
};

const READONLY_KEYS = ['createdAt', 'updatedAt'];

interface Entity { id: string; [k: string]: unknown }

function stripReadonly(obj: Record<string, unknown>) {
  const clean = { ...obj };
  for (const k of READONLY_KEYS) delete clean[k];
  return clean;
}

export default function ProductOptionsClient() {
  const [view, setView] = useState<View>('preview');
  const [tab, setTab] = useState<Tab>('groups');
  const [data, setData] = useState<Record<string, Entity[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Entity | null>(null);
  const [editEntity, setEditEntity] = useState<string>('group');
  const [saving, setSaving] = useState(false);

  const currentTab = TABS.find(t => t.key === tab)!;
  const items = data[DATA_KEYS[tab]] ?? [];

  function detectEntity(item: Entity): string {
    if ('layer' in item) return 'group';
    if ('groupId' in item) return 'option';
    if ('amountCad' in item) return 'price';
    if ('ruleType' in item) return 'constraint';
    if ('optionGroupCodes' in item) return 'step';
    return currentTab.entity;
  }

  function openEdit(item: Entity, entity?: string) {
    setEditEntity(entity ?? detectEntity(item));
    setEditing(item);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/product-options', { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const d = await res.json();
      setData(d.data ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save(item: Entity) {
    setSaving(true);
    setError(null);
    try {
      const isNew = !item.id || item.id === 'new';
      const cleaned = stripReadonly(item);
      if (isNew) delete cleaned.id;
      const payload = { entity: editEntity, ...cleaned };
      const res = await fetch('/api/crm/product-options', {
        method: isNew ? 'POST' : 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Save failed (${res.status})`);
      }
      setEditing(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this item?')) return;
    setError(null);
    try {
      const res = await fetch('/api/crm/product-options', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: currentTab.entity, id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Delete failed (${res.status})`);
      }
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3)', marginBottom: 'var(--crm-space-3)' }}>
        <Link href="/crm/settings" className="crm-btn crm-btn-ghost" style={{ padding: 0 }}>← Settings</Link>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', marginBottom: 'var(--crm-space-4)', background: 'var(--crm-error-light, rgba(239,68,68,0.1))', color: 'var(--crm-error)', borderRadius: 6, fontSize: 'var(--crm-text-sm)' }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--crm-space-5)' }}>
        <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, margin: 0 }}>Configurator Builder</h1>
        <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
          <button
            className={`crm-btn ${view === 'preview' ? 'crm-btn-primary' : 'crm-btn-secondary'}`}
            style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 12px' }}
            onClick={() => setView('preview')}
          >Builder</button>
          <button
            className={`crm-btn ${view === 'advanced' ? 'crm-btn-primary' : 'crm-btn-secondary'}`}
            style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 12px' }}
            onClick={() => setView('advanced')}
          >Logic &amp; Diagnostics</button>
        </div>
      </div>

      {view === 'preview' ? (
          <FlowEditor />
      ) : (
        <>
      {/* Advanced tabs + table below */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--crm-space-3)' }}>
        <div />
        <button className="crm-btn crm-btn-primary" style={{ fontSize: 'var(--crm-text-xs)' }} onClick={() => openEdit({ id: 'new' }, currentTab.entity)}>
          + Add {currentTab.entity}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 'var(--crm-space-4)', borderBottom: '1px solid var(--crm-border)' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setEditing(null); }}
            style={{
              padding: '8px 16px',
              fontSize: 'var(--crm-text-sm)',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${tab === t.key ? 'var(--crm-text-primary)' : 'transparent'}`,
              color: tab === t.key ? 'var(--crm-text-primary)' : 'var(--crm-text-tertiary)',
              fontWeight: tab === t.key ? 600 : 400,
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="crm-card" style={{ padding: 'var(--crm-space-12)', textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="crm-card" style={{ padding: 'var(--crm-space-12)', textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>
          No {currentTab.label.toLowerCase()} yet. Click &quot;+ Add {currentTab.entity}&quot; to create one.
        </div>
      ) : (
        <div className="crm-card" style={{ overflow: 'hidden' }}>
          <table className="crm-table crm-table-animated" style={{ width: '100%' }}>
            <thead>
              <tr>
                <Columns tab={tab} mode="th" />
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <Columns tab={tab} mode="td" item={item} />
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="crm-btn crm-btn-ghost" style={{ fontSize: 'var(--crm-text-xs)', padding: '2px 8px' }} onClick={() => openEdit(item)}>Edit</button>
                      <button className="crm-btn crm-btn-ghost" style={{ fontSize: 'var(--crm-text-xs)', padding: '2px 8px', color: 'var(--crm-error)' }} onClick={() => remove(item.id)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '8px 12px', fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', borderTop: '1px solid var(--crm-border-light)' }}>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </div>
        </div>
      )}
        </>
      )}

      {/* Edit modal */}
      {editing && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}
        >
          <div className="crm-card" style={{ padding: 'var(--crm-space-5)', width: 460, maxHeight: '80vh', overflow: 'auto' }}>
            <h2 style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, marginBottom: 'var(--crm-space-4)' }}>
              {editing.id === 'new' ? 'New' : 'Edit'} {editEntity}
            </h2>
            <EditForm
              entity={editEntity}
              item={editing}
              groups={data.groups ?? []}
              onSave={save}
              onClose={() => setEditing(null)}
              saving={saving}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Column definitions per tab ─────────────────────── */

function Columns({ tab, mode, item }: { tab: Tab; mode: 'th' | 'td'; item?: Entity }) {
  if (mode === 'th') {
    const headers: Record<Tab, string[]> = {
      groups: ['Code', 'Label', 'Layer', 'Mode', 'Active'],
      options: ['Code', 'Label', 'Channels', 'Sort', 'Active'],
      prices: ['Code', 'Label', 'Amount', 'Type', 'Channels'],
      constraints: ['Code', 'Rule', 'Source', 'Targets'],
      steps: ['Channel', 'Code', 'Label', 'Order', 'Groups'],
    };
    return <>{headers[tab].map(h => <th key={h}>{h}</th>)}</>;
  }

  const i = item!;
  const cells: Record<Tab, React.ReactNode[]> = {
    groups: [s(i.code), s(i.label), s(i.layer), s(i.selectionMode), <ActiveBadge key="a" active={!!i.active} />],
    options: [s(i.code), s(i.label), arr(i.channels), s(i.sortOrder), <ActiveBadge key="a" active={!!i.active} />],
    prices: [s(i.code), s(i.label), `$${s(i.amountCad)}`, s(i.pricingType), arr(i.channels)],
    constraints: [s(i.code), s(i.ruleType), s(i.sourceOptionCode), arr(i.targetOptionCodes)],
    steps: [s(i.channel), s(i.code), s(i.label), s(i.sortOrder), arr(i.optionGroupCodes)],
  };
  return <>{cells[tab].map((c, idx) => <td key={idx}>{c}</td>)}</>;
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className="crm-badge" style={{
      background: active ? 'var(--crm-success-light, rgba(34,197,94,0.1))' : 'var(--crm-surface-hover)',
      color: active ? 'var(--crm-success)' : 'var(--crm-text-tertiary)',
    }}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function s(v: unknown) { return String(v ?? ''); }
function arr(v: unknown) { return Array.isArray(v) ? v.join(', ') : s(v); }

/* ── Edit form ──────────────────────────────────────── */

function EditForm({ entity, item, groups, onSave, onClose, saving }: {
  entity: string; item: Entity; groups: Entity[];
  onSave: (item: Entity) => void; onClose: () => void; saving: boolean;
}) {
  const [form, setForm] = useState<Entity>({ ...item });
  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const setCsv = (k: string, v: string) => set(k, v.split(',').map(s => s.trim()).filter(Boolean));

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3)' }}>
      {entity === 'group' && <>
        <F label="Code" value={s(form.code)} onChange={v => set('code', v)} />
        <F label="Label" value={s(form.label)} onChange={v => set('label', v)} />
        <Sel label="Layer" value={s(form.layer)} options={['channel','lens_path','material','finish_state','treatment','shipping']} onChange={v => set('layer', v)} />
        <Sel label="Selection Mode" value={s(form.selectionMode ?? 'single')} options={['single','multi','none']} onChange={v => set('selectionMode', v)} />
        <Chk label="Required" checked={!!form.required} onChange={v => set('required', v)} />
        <Chk label="Active" checked={form.active !== false} onChange={v => set('active', v)} />
      </>}
      {entity === 'option' && <>
        <F label="Code" value={s(form.code)} onChange={v => set('code', v)} />
        <F label="Label" value={s(form.label)} onChange={v => set('label', v)} />
        <Sel label="Group" value={s(form.groupId)} options={groups.map(g => ({ value: g.id, label: s(g.label) }))} onChange={v => set('groupId', v)} />
        <F label="Channels (comma-sep)" value={arr(form.channels)} onChange={v => setCsv('channels', v)} />
        <F label="Sort Order" value={s(form.sortOrder ?? 0)} onChange={v => set('sortOrder', Number(v))} />
        <Chk label="Active" checked={form.active !== false} onChange={v => set('active', v)} />
      </>}
      {entity === 'price' && <>
        <F label="Code" value={s(form.code)} onChange={v => set('code', v)} />
        <F label="Label" value={s(form.label)} onChange={v => set('label', v)} />
        <F label="Amount (CAD)" value={s(form.amountCad ?? 0)} onChange={v => set('amountCad', v)} />
        <Sel label="Pricing Type" value={s(form.pricingType ?? 'delta')} options={['delta','absolute']} onChange={v => set('pricingType', v)} />
        <F label="Channels (comma-sep)" value={arr(form.channels)} onChange={v => setCsv('channels', v)} />
        <F label="Option Codes (comma-sep)" value={arr(form.optionCodes)} onChange={v => setCsv('optionCodes', v)} />
        <Chk label="Active" checked={form.active !== false} onChange={v => set('active', v)} />
      </>}
      {entity === 'constraint' && <>
        <F label="Code" value={s(form.code)} onChange={v => set('code', v)} />
        <Sel label="Rule Type" value={s(form.ruleType)} options={['requires','excludes','allowed_only_with','hidden_until','default_if','defer_if_no_rx']} onChange={v => set('ruleType', v)} />
        <F label="Source Option Code" value={s(form.sourceOptionCode)} onChange={v => set('sourceOptionCode', v)} />
        <F label="Target Option Codes (comma-sep)" value={arr(form.targetOptionCodes)} onChange={v => setCsv('targetOptionCodes', v)} />
        <Chk label="Active" checked={form.active !== false} onChange={v => set('active', v)} />
      </>}
      {entity === 'step' && <>
        <Sel label="Channel" value={s(form.channel)} options={['optical','sun','reglaze']} onChange={v => set('channel', v)} />
        <F label="Code" value={s(form.code)} onChange={v => set('code', v)} />
        <F label="Label" value={s(form.label)} onChange={v => set('label', v)} />
        <F label="Sort Order" value={s(form.sortOrder ?? 0)} onChange={v => set('sortOrder', Number(v))} />
        <F label="Option Group Codes (comma-sep)" value={arr(form.optionGroupCodes)} onChange={v => setCsv('optionGroupCodes', v)} />
        <Chk label="Active" checked={form.active !== false} onChange={v => set('active', v)} />
      </>}

      <div style={{ display: 'flex', gap: 8, marginTop: 'var(--crm-space-2)' }}>
        <button type="submit" className="crm-btn crm-btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="crm-btn crm-btn-secondary" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

/* ── Form primitives ────────────────────────────────── */

function F({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{label}</span>
      <input className="crm-input" style={{ width: '100%' }} value={value} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

function Sel({ label, value, options, onChange }: { label: string; value: string; options: (string | { value: string; label: string })[]; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{label}</span>
      <select className="crm-input" style={{ width: '100%' }} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">—</option>
        {options.map(o => typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
        )}
      </select>
    </label>
  );
}

function Chk({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ fontSize: 'var(--crm-text-sm)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
