'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/crm/CrmShell';

interface Segment { id: string; name: string; description: string | null; memberCount: number; updatedAt: string }
interface Condition { field: string; operator: string; value: string }
interface AISuggestion { name: string; description: string; rules: { logic: string; conditions: Condition[] }; reasoning: string; suggestedAction?: string; actualSize?: number }

const FIELDS = [
  { value: 'order_count', label: 'Orders', group: 'Commercial' },
  { value: 'total_spent', label: 'Total Spent (LTV)', group: 'Commercial' },
  { value: 'average_order_value', label: 'Avg Order Value', group: 'Commercial' },
  { value: 'first_name', label: 'First Name', group: 'Identity' },
  { value: 'last_name', label: 'Last Name', group: 'Identity' },
  { value: 'email', label: 'Email', group: 'Identity' },
  { value: 'created_at', label: 'Customer Since', group: 'Recency' },
  { value: 'days_since_created', label: 'Days Since Created', group: 'Recency' },
  { value: 'days_since_last_order', label: 'Days Since Last Order', group: 'Recency' },
  { value: 'last_order_date', label: 'Last Order Date', group: 'Recency' },
  { value: 'tags', label: 'Has Tag', group: 'Classification' },
  { value: 'membership_tier', label: 'Membership Tier', group: 'Loyalty' },
  { value: 'membership_status', label: 'Membership Status', group: 'Loyalty' },
  { value: 'credit_balance', label: 'Credit Balance', group: 'Loyalty' },
  { value: 'is_member', label: 'Is a Member', group: 'Loyalty' },
  { value: 'member_since', label: 'Member Since', group: 'Loyalty' },
  { value: 'accepts_marketing', label: 'Email Consent', group: 'Consent' },
  { value: 'sms_consent', label: 'SMS Consent', group: 'Consent' },
  { value: 'face_shape', label: 'Face Shape', group: 'Fit' },
  { value: 'rx_on_file', label: 'Rx On File', group: 'Fit' },
  { value: 'home_location', label: 'Home Location', group: 'Location' },
  { value: 'postal_prefix', label: 'Postal Prefix', group: 'Location' },
  { value: 'interaction_count', label: 'Interaction Count', group: 'Engagement' },
];

const OPERATORS: Record<string, { value: string; label: string }[]> = {
  default: [{ value: 'equals', label: 'is' }, { value: 'not_equals', label: 'is not' }, { value: 'contains', label: 'contains' }],
  number: [{ value: 'equals', label: 'is' }, { value: 'gt', label: 'greater than' }, { value: 'lt', label: 'less than' }],
  date: [{ value: 'gt', label: 'after' }, { value: 'lt', label: 'before' }, { value: 'in_last_n_days', label: 'in last N days' }],
  tag: [{ value: 'tag_includes', label: 'includes' }],
  boolean: [{ value: 'equals', label: 'is' }],
  tier: [{ value: 'equals', label: 'is' }, { value: 'not_equals', label: 'is not' }],
  status: [{ value: 'equals', label: 'is' }, { value: 'not_equals', label: 'is not' }],
};

const VALUE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  membership_tier: [{ value: 'essential', label: 'Essential' }, { value: 'cult', label: 'CULT' }, { value: 'vault', label: 'VAULT' }],
  membership_status: [{ value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }, { value: 'cancelled', label: 'Cancelled' }],
  is_member: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }],
  accepts_marketing: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }],
  sms_consent: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }],
  rx_on_file: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }],
};

function getOperators(field: string) {
  if (['order_count', 'total_spent', 'days_since_last_order', 'days_since_created', 'interaction_count', 'average_order_value', 'credit_balance'].includes(field)) return OPERATORS.number;
  if (['created_at', 'last_order_date', 'member_since'].includes(field)) return OPERATORS.date;
  if (field === 'tags') return OPERATORS.tag;
  if (field === 'membership_tier') return OPERATORS.tier;
  if (field === 'membership_status') return OPERATORS.status;
  if (['accepts_marketing', 'sms_consent', 'rx_on_file', 'is_member'].includes(field)) return OPERATORS.boolean;
  return OPERATORS.default;
}

export default function SegmentsPage() {
  const { toast } = useToast();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [building, setBuilding] = useState(false);
  const [conditions, setConditions] = useState<Condition[]>([{ field: 'order_count', operator: 'gt', value: '' }]);
  const [logic, setLogic] = useState<'and' | 'or'>('and');
  const [name, setName] = useState('');
  const [preview, setPreview] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // AI state
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<'suggest' | 'analyze' | null>(null);
  const [aiInsights, setAiInsights] = useState<Array<{ title: string; description: string; action: string; segmentRules?: { logic: string; conditions: Condition[] } | null }>>([]);
  const [explainId, setExplainId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<{ explanation: string; refinementSuggestions: Array<{ description: string; proposedChange: string }> } | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  // Detail panel state
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [segmentMembers, setSegmentMembers] = useState<Array<{ shopifyCustomerId: string; firstName: string | null; lastName: string | null; email: string | null; totalSpent: string | null }>>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => {
    fetch('/api/crm/segments', { credentials: 'include' }).then(r => r.json()).then(d => setSegments(d.data ?? []));
  }, []);

  function updateCondition(i: number, key: keyof Condition, val: string) {
    const next = [...conditions];
    next[i] = { ...next[i], [key]: val };
    if (key === 'field') next[i].operator = getOperators(val)[0].value;
    setConditions(next);
  }

  async function handlePreview() {
    setPreviewing(true);
    try {
      const res = await fetch('/api/crm/segments', { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '__preview__', rules: { logic, conditions } }) });
      const d = await res.json();
      setPreview((d.data ?? d)?.memberCount ?? 0);
    } catch { setPreview(0); }
    setPreviewing(false);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch('/api/crm/segments', { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, rules: { logic, conditions } }) });
    if (res.ok) {
      const d = await res.json();
      setSegments([d.data ?? d.segment, ...segments]);
      setBuilding(false); setName(''); setConditions([{ field: 'order_count', operator: 'gt', value: '' }]); setPreview(null);
      toast('Segment created');
    }
    setSaving(false);
  }

  async function handleAiSuggest() {
    setAiLoading(true); setAiMode('suggest');
    try {
      const res = await fetch('/api/crm/segments/ai-suggest', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await res.json();
      if (res.ok) { const body = d.data ?? d; setAiSuggestions(body.segments ?? body ?? []); }
      else toast(d.error || `AI failed (${res.status})`, 'error');
    } catch (e) { toast('AI request failed — check console', 'error'); console.error(e); }
    setAiLoading(false);
  }

  async function handleAiAnalyze() {
    setAiLoading(true); setAiMode('analyze');
    try {
      const res = await fetch('/api/crm/segments/ai-analyze', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (res.ok) { const d = await res.json(); setAiInsights(d.data ?? []); }
      else toast('AI analysis failed', 'error');
    } catch { toast('AI analysis failed', 'error'); }
    setAiLoading(false);
  }

  async function handleExplain(id: string) {
    setExplainId(id); setExplainLoading(true); setExplanation(null);
    try {
      const res = await fetch(`/api/crm/segments/${id}/explain`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
      if (res.ok) { const d = await res.json(); setExplanation(d.data ?? d); }
      else toast('Explain failed', 'error');
    } catch { toast('Explain failed', 'error'); }
    setExplainLoading(false);
  }

  function editSuggestion(s: AISuggestion) {
    setConditions(s.rules.conditions);
    setLogic(s.rules.logic as 'and' | 'or');
    setName(s.name);
    setBuilding(true);
    setAiSuggestions(aiSuggestions.filter(x => x.name !== s.name));
  }

  async function selectSegment(id: string) {
    if (selectedSegmentId === id) { setSelectedSegmentId(null); return; }
    setSelectedSegmentId(id);
    setSegmentMembers([]);
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/crm/segments/${id}/members`, { credentials: 'include' });
      if (res.ok) { const d = await res.json(); setSegmentMembers(d.data ?? []); }
    } catch { /* ignore */ }
    setMembersLoading(false);
  }

  async function acceptSuggestion(s: AISuggestion) {
    const res = await fetch('/api/crm/segments', { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: s.name, description: s.description, rules: s.rules }) });
    if (res.ok) {
      const d = await res.json();
      setSegments([d.data ?? d, ...segments]);
      setAiSuggestions(aiSuggestions.filter(x => x.name !== s.name));
      toast(`Created: ${s.name}`);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--crm-space-6)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Segments</h1>
          <p style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>Group clients by rules or let AI suggest segments</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
          <button onClick={handleAiAnalyze} disabled={aiLoading} className="crm-btn crm-btn-secondary">
            {aiLoading && aiMode === 'analyze' ? 'Analyzing…' : '◆ AI Analyze'}
          </button>
          <button onClick={handleAiSuggest} disabled={aiLoading} className="crm-btn crm-btn-secondary">
            {aiLoading && aiMode === 'suggest' ? 'Thinking…' : '✦ AI Suggest'}
          </button>
          <button onClick={() => { setBuilding(!building); setPreview(null); }} className={building ? 'crm-btn crm-btn-secondary' : 'crm-btn crm-btn-primary'}>
            {building ? 'Cancel' : '+ New Segment'}
          </button>
        </div>
      </div>

      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && (
        <div style={{ marginBottom: 'var(--crm-space-6)', border: '1px solid var(--crm-text-primary)', padding: 'var(--crm-space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)', paddingBottom: 'var(--crm-space-2)', borderBottom: '1px solid var(--crm-border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--crm-text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span style={{ width: 6, height: 6, background: 'var(--crm-text-primary)', display: 'inline-block' }} />Analyst · looking at your base
            </div>
          </div>
          <div style={{ fontSize: 'var(--crm-text-sm)', lineHeight: 1.6, marginBottom: 'var(--crm-space-4)' }}>
            {aiSuggestions.length} patterns found. Review and save the ones that matter.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, border: '1px solid var(--crm-border-light)' }}>
            {aiSuggestions.map((s, i) => (
              <div key={i} style={{ padding: 'var(--crm-space-4)', borderRight: i % 2 === 0 ? '1px solid var(--crm-border-light)' : 'none', borderBottom: i < aiSuggestions.length - 2 ? '1px solid var(--crm-border-light)' : 'none', cursor: 'pointer' }}
                onClick={() => editSuggestion(s)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 'var(--crm-text-xs)', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--crm-text-tertiary)', fontWeight: 500 }}>
                    {s.suggestedAction ? '◆ opportunity' : '! diagnostic'}
                  </span>
                  <span style={{ fontSize: 'var(--crm-text-xs)', fontFamily: 'monospace', color: 'var(--crm-text-tertiary)' }}>
                    {(s as any).actualSize ?? '?'} clients
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, letterSpacing: '-0.2px' }}>{s.name}</div>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', lineHeight: 1.5, marginBottom: 'var(--crm-space-3)' }}>{s.description}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 'var(--crm-space-2)', borderTop: '1px solid var(--crm-border-light)' }}>
                  <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', fontFamily: 'monospace' }}>{s.reasoning?.slice(0, 40)}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={(e) => { e.stopPropagation(); acceptSuggestion(s); }} style={{ fontSize: 'var(--crm-text-xs)', padding: '3px 8px', border: '1px solid var(--crm-border)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--crm-text-primary)' }}>Save</button>
                    <button onClick={(e) => { e.stopPropagation(); setAiSuggestions(aiSuggestions.filter((_, j) => j !== i)); }} style={{ fontSize: 'var(--crm-text-xs)', padding: '3px 8px', border: '1px solid var(--crm-border)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--crm-text-tertiary)' }}>Dismiss</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Natural language input */}
          <div style={{ display: 'flex', marginTop: 'var(--crm-space-4)', border: '1px solid var(--crm-border)' }}>
            <input id="nlSegInput" placeholder="Describe a group in your own words… (e.g. clients who only buy sun, not rx)" style={{ flex: 1, border: 'none', outline: 'none', padding: '8px 12px', fontSize: 'var(--crm-text-sm)', fontFamily: 'inherit', background: 'none', color: 'var(--crm-text-primary)' }}
              onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) { const v = (e.target as HTMLInputElement).value; (e.target as HTMLInputElement).value = ''; handleAiSuggest(); } }} />
            <button onClick={() => handleAiSuggest()} style={{ padding: '8px 14px', background: 'var(--crm-text-primary)', color: 'var(--crm-surface)', border: 'none', cursor: 'pointer', fontSize: 'var(--crm-text-sm)' }}>→</button>
          </div>
        </div>
      )}

      {/* AI Insights */}
      {aiInsights.length > 0 && (
        <div style={{ marginBottom: 'var(--crm-space-6)' }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--crm-space-3)' }}>AI Insights</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3)' }}>
            {aiInsights.map((ins, i) => (
              <div key={i} className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
                <div style={{ fontWeight: 500, fontSize: 'var(--crm-text-sm)' }}>{ins.title}</div>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-secondary)', marginTop: 2 }}>{ins.description}</div>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-accent)', marginTop: 4 }}>{ins.action}</div>
                {ins.segmentRules?.conditions?.length ? (
                  <button onClick={() => acceptSuggestion({ name: ins.title, description: ins.description, rules: ins.segmentRules!, reasoning: ins.action })}
                    className="crm-btn crm-btn-secondary" style={{ marginTop: 'var(--crm-space-2)', fontSize: 'var(--crm-text-xs)' }}>
                    Create segment from this
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Builder */}
      {building && (
        <div className="crm-card" style={{ padding: 'var(--crm-space-5)', marginBottom: 'var(--crm-space-6)' }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Segment name" className="crm-input" style={{ width: '100%', fontSize: 'var(--crm-text-base)', fontWeight: 500, marginBottom: 'var(--crm-space-5)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2)', marginBottom: 'var(--crm-space-4)', fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)' }}>
            Clients who match
            <button onClick={() => setLogic(logic === 'and' ? 'or' : 'and')} style={{ padding: '2px 10px', borderRadius: 'var(--crm-radius-full)', background: 'var(--crm-accent-light)', color: 'var(--crm-accent)', fontWeight: 600, fontSize: 'var(--crm-text-xs)', border: 'none', cursor: 'pointer', textTransform: 'uppercase' }}>{logic}</button>
            of these conditions:
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2)' }}>
            {conditions.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2)', padding: 'var(--crm-space-2) var(--crm-space-3)', background: 'var(--crm-bg)', borderRadius: 'var(--crm-radius-md)' }}>
                <select value={c.field} onChange={e => updateCondition(i, 'field', e.target.value)} className="crm-input" style={{ minWidth: 180 }}>
                  {FIELDS.map(f => <option key={f.value} value={f.value}>{f.group}: {f.label}</option>)}
                </select>
                <select value={c.operator} onChange={e => updateCondition(i, 'operator', e.target.value)} className="crm-input" style={{ minWidth: 130 }}>
                  {getOperators(c.field).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {VALUE_OPTIONS[c.field] ? (
                  <select value={c.value} onChange={e => updateCondition(i, 'value', e.target.value)} className="crm-input" style={{ flex: 1 }}>
                    <option value="">Select…</option>
                    {VALUE_OPTIONS[c.field].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input value={c.value} onChange={e => updateCondition(i, 'value', e.target.value)} placeholder="Value" className="crm-input" style={{ flex: 1 }} />
                )}
                {conditions.length > 1 && (
                  <button onClick={() => setConditions(conditions.filter((_, idx) => idx !== i))} className="crm-btn crm-btn-ghost" style={{ padding: '4px 8px', color: 'var(--crm-text-tertiary)' }}>✕</button>
                )}
              </div>
            ))}
          </div>

          <button onClick={() => setConditions([...conditions, { field: 'order_count', operator: 'gt', value: '' }])} className="crm-btn crm-btn-ghost" style={{ marginTop: 'var(--crm-space-3)', fontSize: 'var(--crm-text-sm)', color: 'var(--crm-accent)' }}>+ Add condition</button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--crm-space-5)', paddingTop: 'var(--crm-space-4)', borderTop: '1px solid var(--crm-border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3)' }}>
              <button onClick={handlePreview} disabled={previewing} className="crm-btn crm-btn-secondary">{previewing ? 'Counting…' : 'Preview'}</button>
              {preview !== null && <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: preview > 0 ? 'var(--crm-accent)' : 'var(--crm-text-tertiary)' }}>{preview} {preview === 1 ? 'client' : 'clients'} match</span>}
            </div>
            <button onClick={handleSave} disabled={saving || !name.trim()} className="crm-btn crm-btn-primary">{saving ? 'Saving…' : 'Save Segment'}</button>
          </div>
        </div>
      )}

      {/* Explain panel */}
      {explainId && (
        <div className="crm-card" style={{ padding: 'var(--crm-space-5)', marginBottom: 'var(--crm-space-4)', borderLeft: '3px solid var(--crm-accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
            <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>AI Explanation</div>
            <button onClick={() => { setExplainId(null); setExplanation(null); }} className="crm-btn crm-btn-ghost" style={{ fontSize: 'var(--crm-text-xs)' }}>Close</button>
          </div>
          {explainLoading ? <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>Analyzing…</div> : explanation && (
            <>
              <p style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-primary)', marginBottom: 'var(--crm-space-3)' }}>{explanation.explanation}</p>
              {explanation.refinementSuggestions?.length > 0 && (
                <div>
                  <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 'var(--crm-space-2)' }}>Refinement suggestions:</div>
                  {explanation.refinementSuggestions.map((r, i) => (
                    <div key={i} style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)', padding: 'var(--crm-space-2) 0', borderTop: '1px solid var(--crm-border-light)' }}>
                      {r.description} — <em>{r.proposedChange}</em>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Natural language input (when no AI suggestions showing) */}
      {aiSuggestions.length === 0 && (
        <div style={{ display: 'flex', marginBottom: 'var(--crm-space-5)', border: '1px solid var(--crm-border)' }}>
          <input placeholder="Describe a group in your own words… (e.g. CULT members who haven't bought in 60 days)" style={{ flex: 1, border: 'none', outline: 'none', padding: '10px 14px', fontSize: 'var(--crm-text-sm)', fontFamily: 'inherit', background: 'none', color: 'var(--crm-text-primary)' }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) { (e.target as HTMLInputElement).value = ''; handleAiSuggest(); } }} />
          <button onClick={() => handleAiSuggest()} style={{ padding: '10px 16px', background: 'var(--crm-text-primary)', color: 'var(--crm-surface)', border: 'none', cursor: 'pointer', fontSize: 'var(--crm-text-sm)', fontFamily: 'inherit' }}>→</button>
        </div>
      )}

      {/* Segment list */}
      {segments.length > 0 ? (
        <div style={{ border: '1px solid var(--crm-border-light)', background: 'var(--crm-surface)' }}>
          {segments.map((s, i) => (
            <div key={s.id}>
              <div onClick={() => selectSegment(s.id)} style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 14, alignItems: 'center',
                padding: '12px 14px', borderTop: i > 0 ? '1px solid var(--crm-border-light)' : 'none',
                cursor: 'pointer', background: selectedSegmentId === s.id ? 'var(--crm-bg)' : 'none',
                transition: 'background 0.1s',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 'var(--crm-text-sm)' }}>{s.name}</div>
                  {s.description && <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description}</div>}
                </div>
                <span style={{ fontSize: 'var(--crm-text-xs)', fontFamily: 'monospace', color: 'var(--crm-text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>{s.memberCount} clients</span>
                <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', whiteSpace: 'nowrap' }}>{s.updatedAt ? new Date(s.updatedAt).toISOString().slice(0, 10) : ''}</span>
                <button onClick={(e) => { e.stopPropagation(); handleExplain(s.id); }} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Why?</button>
              </div>
              {selectedSegmentId === s.id && (
                <SegmentDetail segment={s} members={segmentMembers} loading={membersLoading} />
              )}
            </div>
          ))}
        </div>
      ) : !building ? (
        <div className="crm-card" style={{ padding: 'var(--crm-space-12)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)', marginBottom: 'var(--crm-space-4)' }}>No segments yet. Create one manually or let AI suggest.</div>
          <div style={{ display: 'flex', gap: 'var(--crm-space-2)', justifyContent: 'center' }}>
            <button onClick={handleAiSuggest} disabled={aiLoading} className="crm-btn crm-btn-secondary">✦ AI Suggest</button>
            <button onClick={() => setBuilding(true)} className="crm-btn crm-btn-primary">+ New Segment</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const SHL = { fontSize: 'var(--crm-text-xs)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', color: 'var(--crm-text-tertiary)', fontWeight: 500, marginBottom: 'var(--crm-space-3)' };

interface SegAnalytics {
  vitals: { totalLtv: number; avgLtv: number; spend90d: number; orders90d: number; medianIdle: number; memberCount: number };
  composition: {
    tier: { label: string; count: number }[];
    location: { label: string; count: number }[];
    ltvBand: { label: string; count: number }[];
    engagement: { smsConsent: number; emailConsent: number; total: number };
  };
}

function SegmentDetail({ segment, members, loading }: { segment: Segment; members: { shopifyCustomerId: string; firstName: string | null; lastName: string | null; email: string | null; totalSpent: string | null }[]; loading: boolean }) {
  const [analytics, setAnalytics] = useState<SegAnalytics | null>(null);

  useEffect(() => {
    fetch(`/api/crm/segments/${segment.id}/analytics`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null).then(d => { if (d) setAnalytics(d.data ?? d); });
  }, [segment.id]);

  const v = analytics?.vitals;
  const c = analytics?.composition;
  const maxOf = (arr: { count: number }[]) => Math.max(...arr.map(a => a.count), 1);

  return (
    <div style={{ marginTop: 'var(--crm-space-1)', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--crm-space-5)', padding: 'var(--crm-space-5)', border: '1px solid var(--crm-border-light)', borderRadius: 'var(--crm-radius-md)' }}>
      {/* LEFT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)', minWidth: 0 }}>

        {/* AI Diagnosis (demo) */}
        <div style={{ padding: 'var(--crm-space-4)', border: '1px solid var(--crm-text-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)', paddingBottom: 'var(--crm-space-2)', borderBottom: '1px solid var(--crm-border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--crm-text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span style={{ width: 6, height: 6, background: 'var(--crm-text-primary)', display: 'inline-block' }} />Why this segment matters
            </div>
            <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', fontFamily: 'monospace' }}>{segment.memberCount} members</span>
          </div>
          <div style={{ fontSize: 'var(--crm-text-sm)', lineHeight: 1.7, marginBottom: 'var(--crm-space-3)' }}>
            This segment contains <strong>{segment.memberCount} clients</strong>{v ? <> with a combined LTV of <strong>${v.totalLtv.toLocaleString()}</strong> (avg ${v.avgLtv.toLocaleString()}). They spent <strong>${v.spend90d.toLocaleString()}</strong> in the last 90 days across {v.orders90d} orders. Median idle time is <strong>{v.medianIdle} days</strong>.</> : '.'}
            {' '}Consider a targeted campaign to re-engage members who are approaching the idle threshold.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Who is most at risk?', 'Draft campaign', 'Compare to base'].map(ch => (
              <span key={ch} style={{ fontSize: 'var(--crm-text-xs)', padding: '5px 10px', border: '1px solid var(--crm-border)', cursor: 'pointer', color: 'var(--crm-text-primary)' }}>{ch}</span>
            ))}
          </div>
        </div>

        {/* Composition */}
        {c && (
          <div style={{ border: '1px solid var(--crm-border-light)', padding: 'var(--crm-space-4)' }}>
            <div style={SHL}>Composition</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-3)' }}>
              {[
                { title: 'By tier', data: c.tier },
                { title: 'By location', data: c.location },
                { title: 'By LTV band', data: c.ltvBand },
                { title: 'Engagement', data: [
                  { label: 'Email consent', count: c.engagement.emailConsent },
                  { label: 'SMS consent', count: c.engagement.smsConsent },
                ] },
              ].map(section => (
                <div key={section.title} style={{ border: '1px solid var(--crm-border-light)', padding: 'var(--crm-space-3)' }}>
                  <div style={{ fontSize: 'var(--crm-text-xs)', textTransform: 'uppercase', color: 'var(--crm-text-tertiary)', marginBottom: 8, fontWeight: 500 }}>{section.title}</div>
                  {section.data.map(row => (
                    <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 32px', gap: 8, alignItems: 'center', padding: '4px 0', fontSize: 'var(--crm-text-xs)' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
                      <div style={{ height: 3, background: 'var(--crm-bg)', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', background: 'var(--crm-text-primary)', width: `${(row.count / maxOf(section.data)) * 100}%` }} />
                      </div>
                      <span style={{ fontFamily: 'monospace', color: 'var(--crm-text-tertiary)', textAlign: 'right' }}>{row.count}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members */}
        <div style={{ border: '1px solid var(--crm-border-light)', padding: 'var(--crm-space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...SHL }}>
            <span>Members · {segment.memberCount}</span>
          </div>
          {loading ? (
            <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>Loading…</div>
          ) : members.length === 0 ? (
            <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>No members</div>
          ) : (
            members.slice(0, 10).map(m => {
              const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || '—';
              const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2);
              return (
                <div key={m.shopifyCustomerId} style={{ display: 'grid', gridTemplateColumns: '26px 1fr auto auto', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--crm-border-light)', fontSize: 'var(--crm-text-sm)' }}>
                  <div style={{ width: 22, height: 22, background: 'var(--crm-text-primary)', color: 'var(--crm-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 500 }}>{initials}</div>
                  <div style={{ minWidth: 0 }}>
                    <a href={`/crm/clients/${m.shopifyCustomerId}`} style={{ fontWeight: 500, color: 'var(--crm-text-primary)', fontSize: 'var(--crm-text-sm)' }}>{name}</a>
                    <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email ?? ''}</div>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 500, fontSize: 'var(--crm-text-sm)' }}>${Number(m.totalSpent ?? 0).toFixed(0)}</span>
                  <a href={`/crm/clients/${m.shopifyCustomerId}`} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>→</a>
                </div>
              );
            })
          )}
          {members.length > 10 && <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textAlign: 'center', paddingTop: 'var(--crm-space-3)', borderTop: '1px solid var(--crm-border-light)', marginTop: 'var(--crm-space-2)' }}>+{members.length - 10} more</div>}
        </div>
      </div>

      {/* RIGHT RAIL */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
        {/* Vitals */}
        {v && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid var(--crm-border-light)' }}>
            {[
              { l: 'Total LTV', v: `$${v.totalLtv.toLocaleString()}`, s: `${v.memberCount} members` },
              { l: 'Avg LTV', v: `$${v.avgLtv.toLocaleString()}`, s: 'per member' },
              { l: '90d spend', v: `$${v.spend90d.toLocaleString()}`, s: `${v.orders90d} orders` },
              { l: 'Idle', v: `${v.medianIdle}d`, s: 'median' },
            ].map((s, i) => (
              <div key={s.l} style={{ padding: 'var(--crm-space-3)', borderRight: i % 2 === 0 ? '1px solid var(--crm-border-light)' : 'none', borderBottom: i < 2 ? '1px solid var(--crm-border-light)' : 'none' }}>
                <div style={{ fontSize: 'var(--crm-text-xs)', textTransform: 'uppercase', color: 'var(--crm-text-tertiary)', fontWeight: 500 }}>{s.l}</div>
                <div style={{ fontSize: 15, fontWeight: 500, fontFamily: 'monospace', marginTop: 2 }}>{s.v}</div>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 1 }}>{s.s}</div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ border: '1px solid var(--crm-border-light)' }}>
          <div style={{ padding: 'var(--crm-space-3)', borderBottom: '1px solid var(--crm-border-light)' }}>
            <div style={SHL}>Act on this segment</div>
          </div>
          {[
            { t: 'Draft campaign with AI', s: 'email · personalized per member' },
            { t: 'Sync to Klaviyo', s: 'push segment list' },
            { t: 'Bulk apply tag', s: `${segment.memberCount} clients · audited` },
            { t: 'Invite to fitting', s: 'staff-led · personal' },
            { t: 'Export CSV', s: 'full profile dump' },
            { t: 'Alert when changes', s: 'new member · lost member' },
          ].map((a, i) => (
            <button key={a.t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '10px 12px', background: 'none', border: 'none', borderTop: i > 0 ? '1px solid var(--crm-border-light)' : 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <div>
                <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>{a.t}</div>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', fontFamily: 'monospace', marginTop: 1 }}>{a.s}</div>
              </div>
              <span style={{ fontSize: 14, opacity: 0.4 }}>→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
