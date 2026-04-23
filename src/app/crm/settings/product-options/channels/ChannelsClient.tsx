'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Flow { id: string; code: string; label: string; channelType: string; status: string }
interface Rule { id: string; flowId: string; ruleType: string; value: string; priority: number; status: string }
interface Facets { tags: string[]; productTypes: string[] }

const RULE_LABELS: Record<string, string> = {
  include_tag: 'Include tag', exclude_tag: 'Exclude tag',
  include_product_type: 'Include type', exclude_product_type: 'Exclude type',
  include_ids: 'Include IDs', exclude_ids: 'Exclude IDs',
};

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  published: { bg: '#d1fae5', color: '#065f46', label: 'Published' },
  draft: { bg: '#fef3c7', color: '#92400e', label: 'Draft' },
  archived: { bg: '#f3f4f6', color: '#6b7280', label: 'Archived' },
};

export default function ChannelsClient() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [facets, setFacets] = useState<Facets>({ tags: [], productTypes: [] });
  const [loading, setLoading] = useState(true);
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null);
  const [editId, setEditId] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editChannel, setEditChannel] = useState('');
  const [adding, setAdding] = useState(false);
  const [addingRule, setAddingRule] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [ruleType, setRuleType] = useState('include_tag');
  const [ruleValue, setRuleValue] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [fR, rR, facR] = await Promise.all([
      fetch('/api/crm/configurator?entity=flow', { credentials: 'include' }),
      fetch('/api/crm/configurator?entity=channelRule', { credentials: 'include' }),
      fetch('/api/crm/products/facets', { credentials: 'include' }),
    ]);
    if (fR.ok) setFlows((await fR.json()).data ?? []);
    if (rR.ok) setRules((await rR.json()).data ?? []);
    if (facR.ok) setFacets((await facR.json()).data ?? { tags: [], productTypes: [] });
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const api = (method: string, body: object) =>
    fetch('/api/crm/configurator', { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  async function saveFlow(id: string) {
    if (!editLabel.trim()) { setEditId(''); return; }
    await api('PATCH', { entity: 'flow', id, label: editLabel.trim(), code: editCode.trim() || undefined, channelType: editChannel || undefined });
    setEditId(''); load();
  }
  async function createFlow() {
    if (!editLabel.trim()) { setAdding(false); return; }
    const code = editCode.trim() || editLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    await api('POST', { entity: 'flow', label: editLabel.trim(), code, channelType: editChannel || code, status: 'draft' });
    setAdding(false); setEditLabel(''); setEditCode(''); setEditChannel(''); load();
  }
  async function removeFlow(id: string) {
    if (!confirm('Delete this flow and ALL its steps, groups, and choices?')) return;
    await api('DELETE', { entity: 'flow', id }); load();
  }
  async function toggleStatus(f: Flow) {
    await api('PATCH', { entity: 'flow', id: f.id, status: f.status === 'published' ? 'draft' : 'published' }); load();
  }
  async function addRule(flowId: string) {
    if (!ruleValue.trim()) return;
    const flowRules = rules.filter(r => r.flowId === flowId);
    const priority = (flowRules.length + 1) * 10;
    await api('POST', { entity: 'channelRule', flowId, ruleType, value: ruleValue.trim(), priority });
    setAddingRule(null); setRuleType('include_tag'); setRuleValue(''); setTagFilter(''); load();
  }
  async function deleteRule(id: string) { await api('DELETE', { entity: 'channelRule', id }); load(); }
  async function updateRule(id: string) {
    if (!ruleValue.trim()) return;
    await api('PATCH', { entity: 'channelRule', id, ruleType, value: ruleValue.trim() });
    setEditingRule(null); setRuleType('include_tag'); setRuleValue(''); setTagFilter(''); load();
  }
  function startEditRule(r: Rule) {
    setEditingRule(r.id); setRuleType(r.ruleType); setRuleValue(r.value); setTagFilter(''); setAddingRule(null);
  }

  async function handleDrop(flowId: string, fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    const flowRules = rules.filter(r => r.flowId === flowId).sort((a, b) => a.priority - b.priority);
    const reordered = [...flowRules];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].priority !== (i + 1) * 10) {
        await api('PATCH', { entity: 'channelRule', id: reordered[i].id, priority: (i + 1) * 10 });
      }
    }
    load();
  }

  const s = (key: string, val: Record<string, unknown>) => val as React.CSSProperties;

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 13 }}>
        <Link href="/crm/settings" style={{ color: '#9ca3af', textDecoration: 'none' }}>Settings</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <Link href="/crm/settings/product-options" style={{ color: '#9ca3af', textDecoration: 'none' }}>Configurator</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ fontWeight: 600 }}>Flows</span>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Flows</h1>

      {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {flows.map(f => {
            const flowRules = rules.filter(r => r.flowId === f.id).sort((a, b) => a.priority - b.priority);
            const open = expandedFlow === f.id;
            const st = STATUS_STYLES[f.status] ?? STATUS_STYLES.draft;

            return (
              <div key={f.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
                {/* Header */}
                {editId === f.id ? (
                  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>Display Name</label>
                    <input className="crm-input" value={editLabel} onChange={e => setEditLabel(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') saveFlow(f.id); if (e.key === 'Escape') setEditId(''); }} />
                    <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>Internal Code</label>
                    <input className="crm-input" style={{ fontFamily: 'monospace', fontSize: 12 }} value={editCode} onChange={e => setEditCode(e.target.value)} />
                    <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>Channel</label>
                    <input className="crm-input" value={editChannel} onChange={e => setEditChannel(e.target.value)} />
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <button className="crm-btn crm-btn-primary" style={{ fontSize: 12, padding: '6px 16px' }} onClick={() => saveFlow(f.id)}>Save</button>
                      <button className="crm-btn crm-btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditId('')}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onClick={() => setExpandedFlow(open ? null : f.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 10, color: '#9ca3af', transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{f.label}</span>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                          <span style={{ fontFamily: 'monospace' }}>{f.code}</span> · {f.channelType} · {flowRules.length} rule{flowRules.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => toggleStatus(f)}>{f.status === 'published' ? 'Unpublish' : 'Publish'}</button>
                      <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => { setEditId(f.id); setEditLabel(f.label); setEditCode(f.code); setEditChannel(f.channelType); }}>✎</button>
                      <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: '#ef4444' }} onClick={() => removeFlow(f.id)}>✕</button>
                    </div>
                  </div>
                )}

                {/* Expanded: Rules */}
                {open && editId !== f.id && (
                  <div style={{ borderTop: '1px solid #f3f4f6', padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', marginBottom: 10 }}>Product Rules</div>

                    {flowRules.length === 0 && !addingRule && (
                      <div style={{ fontSize: 12, color: '#9ca3af', padding: '8px 0' }}>No rules yet — add one to match products to this flow.</div>
                    )}

                    {/* Draggable rule list */}
                    {flowRules.map((r, i) => editingRule === r.id ? (
                      <div key={r.id} style={{ marginBottom: 4, padding: 12, border: '1px solid #d1d5db', borderRadius: 8, background: '#fafafa' }}>
                        <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Rule Type</label>
                        <select className="crm-input" style={{ fontSize: 12, width: '100%', marginBottom: 10 }} value={ruleType} onChange={e => { setRuleType(e.target.value); setRuleValue(''); setTagFilter(''); }}>
                          {Object.entries(RULE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                          {ruleType.includes('tag') ? 'Select a tag' : ruleType.includes('product_type') ? 'Select a product type' : 'Enter product IDs'}
                        </label>
                        {ruleType.includes('tag') && (
                          <>
                            <input className="crm-input" style={{ fontSize: 12, width: '100%', marginBottom: 6 }} value={tagFilter} onChange={e => setTagFilter(e.target.value)} placeholder="Search tags…" />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 140, overflowY: 'auto', marginBottom: 8 }}>
                              {facets.tags.filter(t => !tagFilter || t.toLowerCase().includes(tagFilter.toLowerCase())).map(t => (
                                <button key={t} type="button" onClick={() => setRuleValue(t)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 14, border: '1px solid', borderColor: ruleValue === t ? '#111' : '#e5e7eb', background: ruleValue === t ? '#111' : '#fff', color: ruleValue === t ? '#fff' : '#374151', cursor: 'pointer' }}>{t}</button>
                              ))}
                            </div>
                          </>
                        )}
                        {ruleType.includes('product_type') && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                            {facets.productTypes.map(pt => (
                              <button key={pt} type="button" onClick={() => setRuleValue(pt)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 14, border: '1px solid', borderColor: ruleValue === pt ? '#111' : '#e5e7eb', background: ruleValue === pt ? '#111' : '#fff', color: ruleValue === pt ? '#fff' : '#374151', cursor: 'pointer' }}>{pt}</button>
                            ))}
                          </div>
                        )}
                        {ruleType.includes('ids') && (
                          <input className="crm-input" style={{ fontSize: 12, width: '100%', marginBottom: 8 }} value={ruleValue} onChange={e => setRuleValue(e.target.value)} placeholder="e.g. 8012345678901, 8012345678902" />
                        )}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button className="crm-btn crm-btn-primary" style={{ fontSize: 12, padding: '6px 16px' }} disabled={!ruleValue.trim()} onClick={() => updateRule(r.id)}>Save</button>
                          <button className="crm-btn crm-btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditingRule(null)}>Cancel</button>
                          {ruleValue && <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>→ <span style={{ fontFamily: 'monospace' }}>{ruleValue}</span></span>}
                        </div>
                      </div>
                    ) : (
                      <div
                        key={r.id}
                        draggable
                        onDragStart={() => setDragIdx(i)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => { if (dragIdx !== null) handleDrop(f.id, dragIdx, i); setDragIdx(null); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 4,
                          borderRadius: 6, background: dragIdx === i ? '#f9fafb' : '#fff',
                          border: '1px solid #f3f4f6', cursor: 'grab', fontSize: 12,
                        }}
                      >
                        <span style={{ color: '#d1d5db', fontSize: 14, cursor: 'grab' }} title="Drag to reorder">⠿</span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                          background: r.ruleType.startsWith('exclude') ? '#fef2f2' : '#f0fdf4',
                          color: r.ruleType.startsWith('exclude') ? '#dc2626' : '#16a34a',
                        }}>
                          {RULE_LABELS[r.ruleType] ?? r.ruleType}
                        </span>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, flex: 1 }}>{r.value}</span>
                        <button onClick={() => startEditRule(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 12, padding: '0 4px' }} title="Edit rule">✎</button>
                        <button onClick={() => deleteRule(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 14, padding: '0 4px' }} title="Remove rule">✕</button>
                      </div>
                    ))}

                    {/* Add rule form */}
                    {addingRule === f.id ? (
                      <div style={{ marginTop: 8, padding: 12, border: '1px dashed #d1d5db', borderRadius: 8, background: '#fafafa' }}>
                        <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Rule Type</label>
                        <select className="crm-input" style={{ fontSize: 12, width: '100%', marginBottom: 10 }} value={ruleType} onChange={e => { setRuleType(e.target.value); setRuleValue(''); setTagFilter(''); }}>
                          {Object.entries(RULE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>

                        <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                          {ruleType.includes('tag') ? 'Select a tag' : ruleType.includes('product_type') ? 'Select a product type' : 'Enter product IDs'}
                        </label>

                        {ruleType.includes('tag') && (
                          <>
                            <input className="crm-input" style={{ fontSize: 12, width: '100%', marginBottom: 6 }} value={tagFilter} onChange={e => setTagFilter(e.target.value)} placeholder="Search tags…" />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 140, overflowY: 'auto', marginBottom: 8 }}>
                              {facets.tags.filter(t => !tagFilter || t.toLowerCase().includes(tagFilter.toLowerCase())).map(t => (
                                <button key={t} type="button" onClick={() => setRuleValue(t)} style={{
                                  fontSize: 11, padding: '4px 10px', borderRadius: 14, border: '1px solid',
                                  borderColor: ruleValue === t ? '#111' : '#e5e7eb',
                                  background: ruleValue === t ? '#111' : '#fff',
                                  color: ruleValue === t ? '#fff' : '#374151',
                                  cursor: 'pointer', transition: 'all 0.1s',
                                }}>{t}</button>
                              ))}
                              {facets.tags.filter(t => !tagFilter || t.toLowerCase().includes(tagFilter.toLowerCase())).length === 0 && (
                                <span style={{ fontSize: 11, color: '#9ca3af', padding: 4 }}>No tags match</span>
                              )}
                            </div>
                          </>
                        )}

                        {ruleType.includes('product_type') && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                            {facets.productTypes.map(pt => (
                              <button key={pt} type="button" onClick={() => setRuleValue(pt)} style={{
                                fontSize: 11, padding: '4px 10px', borderRadius: 14, border: '1px solid',
                                borderColor: ruleValue === pt ? '#111' : '#e5e7eb',
                                background: ruleValue === pt ? '#111' : '#fff',
                                color: ruleValue === pt ? '#fff' : '#374151',
                                cursor: 'pointer', transition: 'all 0.1s',
                              }}>{pt}</button>
                            ))}
                            {facets.productTypes.length === 0 && <span style={{ fontSize: 11, color: '#9ca3af' }}>No product types found</span>}
                          </div>
                        )}

                        {ruleType.includes('ids') && (
                          <input className="crm-input" style={{ fontSize: 12, width: '100%', marginBottom: 8 }} value={ruleValue} onChange={e => setRuleValue(e.target.value)} placeholder="e.g. 8012345678901, 8012345678902" />
                        )}

                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button className="crm-btn crm-btn-primary" style={{ fontSize: 12, padding: '6px 16px' }} disabled={!ruleValue.trim()} onClick={() => addRule(f.id)}>Add Rule</button>
                          <button className="crm-btn crm-btn-ghost" style={{ fontSize: 12 }} onClick={() => setAddingRule(null)}>Cancel</button>
                          {ruleValue && <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>→ <span style={{ fontFamily: 'monospace' }}>{ruleValue}</span></span>}
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setAddingRule(f.id); setEditingRule(null); setRuleType('include_tag'); setRuleValue(''); setTagFilter(''); }} style={{ marginTop: 6, fontSize: 12, color: '#111', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: '4px 0' }}>+ Add rule</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add channel */}
          {adding ? (
            <div style={{ border: '1px dashed #d1d5db', borderRadius: 10, padding: 16, background: '#fafafa' }}>
              <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Display Name</label>
              <input className="crm-input" style={{ marginBottom: 8, width: '100%' }} value={editLabel} onChange={e => setEditLabel(e.target.value)} autoFocus placeholder="e.g. Optical" onKeyDown={e => { if (e.key === 'Enter') createFlow(); if (e.key === 'Escape') setAdding(false); }} />
              <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Internal Code</label>
              <input className="crm-input" style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 8, width: '100%' }} value={editCode} onChange={e => setEditCode(e.target.value)} placeholder="auto-generated if empty" />
              <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 }}>Channel</label>
              <input className="crm-input" style={{ marginBottom: 10, width: '100%' }} value={editChannel} onChange={e => setEditChannel(e.target.value)} placeholder="e.g. optical, sun, reglaze" />
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="crm-btn crm-btn-primary" style={{ fontSize: 12, padding: '6px 16px' }} onClick={createFlow}>Create</button>
                <button className="crm-btn crm-btn-ghost" style={{ fontSize: 12 }} onClick={() => { setAdding(false); setEditLabel(''); setEditCode(''); setEditChannel(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setAdding(true); setEditLabel(''); setEditCode(''); setEditChannel(''); }} style={{ width: '100%', fontSize: 12, padding: 12, background: 'none', border: '1px dashed #d1d5db', borderRadius: 10, cursor: 'pointer', color: '#111', fontWeight: 500 }}>+ Add flow</button>
          )}
        </div>
      )}
    </div>
  );
}
