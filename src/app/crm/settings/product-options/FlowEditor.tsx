'use client';

import { useState, useEffect, useMemo } from 'react';
import { E, str, num, cfgFetch } from './flow-helpers';
import { StepList, GroupEditor, Inspector } from './FlowPanels';

export default function FlowEditor() {
  const [data, setData] = useState<Awaited<ReturnType<typeof cfgFetch>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flowId, setFlowId] = useState('');
  const [stepId, setStepId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [placementId, setPlacementId] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { setData(await cfgFetch()); } catch (e: any) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const flows = data?.flows ?? [];
  const activeFlow = flows.find(f => f.id === flowId) ?? flows[0] ?? null;
  const fid = activeFlow?.id ?? '';

  const fSteps = useMemo(() =>
    (data?.steps ?? []).filter(s => s.flowId === fid && str(s.status) !== 'archived').sort((a, b) => num(a.orderIndex) - num(b.orderIndex)),
    [data?.steps, fid]);

  const choiceMap = useMemo(() => {
    const m = new Map();
    (data?.choices ?? []).forEach(c => m.set(c.id, c));
    return m as Map<string, E>;
  }, [data?.choices]);

  // Auto-select first step/group
  const activeStep = fSteps.find(s => s.id === stepId) ?? fSteps[0] ?? null;
  const sid = activeStep?.id ?? '';
  const fGroups = useMemo(() =>
    (data?.groups ?? []).filter(g => g.stepId === sid && str(g.status) !== 'archived').sort((a, b) => num(a.sortOrder) - num(b.sortOrder)),
    [data?.groups, sid]);
  const activeGroup = fGroups.find(g => g.id === groupId) ?? fGroups[0] ?? null;
  const gid = activeGroup?.id ?? '';
  const placements = useMemo(() =>
    (data?.placements ?? []).filter(p => p.groupId === gid && str(p.status) !== 'archived').sort((a, b) => num(a.sortOrder) - num(b.sortOrder)),
    [data?.placements, gid]);

  const activePlacement = placements.find(p => p.id === placementId) ?? null;

  if (loading) return <div className="crm-card" style={{ padding: 48, textAlign: 'center', color: 'var(--crm-text-tertiary)' }}>Loading configurator…</div>;
  if (error) return <div style={{ padding: '8px 12px', background: 'var(--crm-error-light)', color: 'var(--crm-error)', borderRadius: 6, fontSize: 13 }}>{error}</div>;
  if (!activeFlow) return <EmptyState onReload={load} />;

  return (
    <div style={{ display: 'flex', gap: 16, minHeight: 500 }}>
      <StepList
        flows={flows} activeFlowId={fid} setFlowId={id => { setFlowId(id); setStepId(''); setGroupId(''); setPlacementId(''); }}
        steps={fSteps} groups={data?.groups ?? []} placements={data?.placements ?? []}
        activeStepId={sid} setStepId={id => { setStepId(id); setGroupId(''); setPlacementId(''); }}
        activeGroupId={gid} setGroupId={id => { setGroupId(id); setPlacementId(''); }}
        onReload={load}
      />
      <GroupEditor
        group={activeGroup} placements={placements} choiceMap={choiceMap}
        priceRules={data?.priceRules ?? []} choices={data?.choices ?? []}
        selPlacementId={placementId} setSelPlacementId={setPlacementId}
        onReload={load}
      />
      <Inspector
        placement={activePlacement} choiceMap={choiceMap}
        priceRules={data?.priceRules ?? []} ruleSets={data?.ruleSets ?? []}
        rules={data?.rules ?? []} clauses={data?.clauses ?? []}
        choices={data?.choices ?? []} onReload={load}
      />
    </div>
  );
}

function EmptyState({ onReload }: { onReload: () => void }) {
  const [creating, setCreating] = useState(false);
  async function seed() {
    setCreating(true);
    const { cfgCreate } = await import('./flow-helpers');
    for (const ch of ['optical', 'sun', 'reglaze']) {
      await cfgCreate('flow', { code: ch, label: ch.charAt(0).toUpperCase() + ch.slice(1), channelType: ch, status: 'draft' });
    }
    setCreating(false); onReload();
  }
  return (
    <div className="crm-card" style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ color: 'var(--crm-text-tertiary)', marginBottom: 12 }}>No configurator flows yet.</div>
      <button className="crm-btn crm-btn-primary" disabled={creating} onClick={seed}>{creating ? 'Creating…' : 'Create Optical, Sun & Reglaze flows'}</button>
    </div>
  );
}
