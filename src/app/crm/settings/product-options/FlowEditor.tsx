'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { E, str, num, cfgFetch } from './flow-helpers';
import { StepList, StepEditor, Inspector } from './FlowPanels';

export type FlowData = Awaited<ReturnType<typeof cfgFetch>>;

export interface FlowSelection {
  flowId: string;
  stepId: string;
  groupId: string;
}

interface FlowEditorProps {
  /** When provided, parent owns data; editor skips internal fetch */
  data?: FlowData | null;
  loading?: boolean;
  error?: string;
  onReload?: () => void;
  /** Fires whenever the active flow/step/group changes */
  onSelectionChange?: (sel: FlowSelection) => void;
  /** Pre-select a flow on mount */
  initialFlowId?: string;
}

export default function FlowEditor({ data: externalData, loading: externalLoading, error: externalError, onReload: externalReload, onSelectionChange, initialFlowId }: FlowEditorProps) {
  // Internal state used only when no external data is provided (standalone mode)
  const [internalData, setInternalData] = useState<FlowData | null>(null);
  const [internalLoading, setInternalLoading] = useState(true);
  const [internalError, setInternalError] = useState('');

  const standalone = externalData === undefined;
  const data = standalone ? internalData : externalData;
  const loading = standalone ? internalLoading : !!externalLoading;
  const error = standalone ? internalError : externalError ?? '';

  const load = useCallback(async () => {
    if (!standalone) { externalReload?.(); return; }
    setInternalLoading(true); setInternalError('');
    try { setInternalData(await cfgFetch()); } catch (e: any) { setInternalError(e.message); }
    setInternalLoading(false);
  }, [standalone, externalReload]);

  useEffect(() => { if (standalone) load(); }, [standalone, load]);

  const onReload = standalone ? load : (externalReload ?? load);

  // Selection state
  const [flowId, setFlowId] = useState(initialFlowId ?? '');
  const [stepId, setStepId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [placementId, setPlacementId] = useState('');
  const [lensColourSets, setLensColourSets] = useState<{ id: string; code: string; label: string }[]>([]);

  useEffect(() => {
    fetch('/api/crm/settings/lens-colours', { credentials: 'include' })
      .then(r => r.json()).then(d => setLensColourSets((d.data?.sets ?? []).map((s: any) => ({ id: s.id, code: s.code, label: s.label }))))
      .catch(() => {});
  }, []);

  const flows = data?.flows ?? [];
  const activeFlow = flows.find(f => f.id === flowId) ?? flows[0] ?? null;
  const fid = activeFlow?.id ?? '';

  const fSteps = useMemo(() =>
    (data?.steps ?? []).filter(s => s.flowId === fid && str(s.status) !== 'archived').sort((a, b) => num(a.orderIndex) - num(b.orderIndex)),
    [data?.steps, fid]);

  const choiceMap = useMemo(() => {
    const m = new Map<string, E>();
    (data?.choices ?? []).forEach(c => m.set(c.id, c));
    return m;
  }, [data?.choices]);

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

  const activePlacement = (data?.placements ?? []).find(p => p.id === placementId) ?? null;

  // Notify parent of selection changes
  useEffect(() => {
    onSelectionChange?.({ flowId: fid, stepId: sid, groupId: gid });
  }, [fid, sid, gid, onSelectionChange]);

  if (loading) return <div className="crm-card" style={{ padding: 48, textAlign: 'center', color: 'var(--crm-text-tertiary)' }}>Loading configurator…</div>;
  if (error) return <div style={{ padding: '8px 12px', background: 'var(--crm-error-light)', color: 'var(--crm-error)', borderRadius: 6, fontSize: 13 }}>{error}</div>;
  if (!activeFlow) return <EmptyState onReload={onReload} />;

  return (
    <div style={{ display: 'flex', gap: 16, minHeight: 500 }}>
      <StepList
        flows={flows} activeFlowId={fid} setFlowId={id => { setFlowId(id); setStepId(''); setGroupId(''); setPlacementId(''); }}
        steps={fSteps} groups={data?.groups ?? []} placements={data?.placements ?? []}
        activeStepId={sid} setStepId={id => { setStepId(id); setGroupId(''); setPlacementId(''); }}
        activeGroupId={gid} setGroupId={id => { setGroupId(id); setPlacementId(''); }}
        onReload={onReload}
      />
      <StepEditor
        step={activeStep} steps={fSteps} groups={data?.groups ?? []} allPlacements={data?.placements ?? []}
        choiceMap={choiceMap} priceRules={data?.priceRules ?? []} choices={data?.choices ?? []}
        ruleSets={data?.ruleSets ?? []} rules={data?.rules ?? []} clauses={data?.clauses ?? []}
        selPlacementId={placementId} setSelPlacementId={setPlacementId}
        onReload={onReload}
        lensColourSets={lensColourSets}
        onDeleteStep={async (id) => {
          if (!confirm('Delete this step and all its groups/choices?')) return;
          const { cfgDelete } = await import('./flow-helpers');
          const groups = (data?.groups ?? []).filter(g => g.stepId === id);
          for (const g of groups) {
            for (const pl of (data?.placements ?? []).filter(p => p.groupId === g.id)) await cfgDelete('placement', pl.id);
            await cfgDelete('group', g.id);
          }
          await cfgDelete('step', id);
          setStepId(''); onReload();
        }}
      />
      <Inspector
        placement={activePlacement} choiceMap={choiceMap}
        priceRules={data?.priceRules ?? []} ruleSets={data?.ruleSets ?? []}
        rules={data?.rules ?? []} clauses={data?.clauses ?? []}
        choices={data?.choices ?? []} groups={data?.groups ?? []}
        steps={fSteps} placements={data?.placements ?? []}
        onReload={onReload}
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
