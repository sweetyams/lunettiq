'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import FlowEditor from './FlowEditor';
import type { FlowData, FlowSelection } from './FlowEditor';
import LiveConfiguratorPreview from './LiveConfiguratorPreview';
import { cfgFetch } from './flow-helpers';

export default function ProductOptionsClient() {
  const [flowData, setFlowData] = useState<FlowData | null>(null);
  const [flowLoading, setFlowLoading] = useState(true);
  const [flowError, setFlowError] = useState('');
  const [flowSelection, setFlowSelection] = useState<FlowSelection>({ flowId: '', stepId: '', groupId: '' });
  const [showPreview, setShowPreview] = useState(true);

  const loadFlowData = useCallback(async () => {
    setFlowLoading(true); setFlowError('');
    try { setFlowData(await cfgFetch()); } catch (e: any) { setFlowError(e.message); }
    setFlowLoading(false);
  }, []);

  useEffect(() => { loadFlowData(); }, [loadFlowData]);

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 1400 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3)', marginBottom: 'var(--crm-space-4)' }}>
        <Link href="/crm/settings" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>Settings</Link>
        <span style={{ color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>/</span>
        <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>Configurator</span>
      </div>

      {flowError && (
        <div style={{ padding: '8px 12px', marginBottom: 'var(--crm-space-4)', background: 'var(--crm-error-light, rgba(239,68,68,0.1))', color: 'var(--crm-error)', borderRadius: 6, fontSize: 'var(--crm-text-sm)' }}>
          {flowError}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--crm-space-5)' }}>
        <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, margin: 0 }}>Configurator</h1>
        <Link href="/crm/settings/product-options/channels" className="crm-btn crm-btn-ghost" style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 12px' }}>Flows</Link>
      </div>

      <FlowEditor
        data={flowData}
        loading={flowLoading}
        error={flowError}
        onReload={loadFlowData}
        onSelectionChange={setFlowSelection}
      />

      {flowData && !flowLoading && (
        <div style={{ marginTop: 'var(--crm-space-5)' }}>
          <button
            className="crm-btn crm-btn-ghost"
            style={{ fontSize: 'var(--crm-text-xs)', marginBottom: 'var(--crm-space-3)' }}
            onClick={() => setShowPreview(p => !p)}
          >
            {showPreview ? '▾ Hide' : '▸ Show'} Customer Preview
          </button>
          {showPreview && (
            <LiveConfiguratorPreview data={flowData} selection={flowSelection} />
          )}
        </div>
      )}
    </div>
  );
}
