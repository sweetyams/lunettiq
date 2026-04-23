'use client';

import { useState, useRef } from 'react';
import { useToast } from '@/components/crm/CrmShell';

const ACTIONS = [
  { id: 'sync-locations', label: 'Sync Locations', description: 'Pull locations from Shopify + Square', endpoint: '/api/crm/settings/locations/sync' },
  { id: 'full-product-sync', label: 'Full Product Sync', description: 'Pull all products + variants + metafields from Shopify', endpoint: '/api/crm/system/full-product-sync' },
  { id: 'reconcile-products', label: 'Reconcile Products', description: 'Check DB products against Shopify, archive missing', endpoint: '/api/crm/system/reconcile-products' },
  { id: 'auto-match-square', label: 'Auto-Match Square', description: 'Match Square catalog items to Shopify products', endpoint: '/api/crm/system/auto-match-square' },
  { id: 'backfill-locations', label: 'Backfill Locations', description: 'Assign location_id to Square orders missing it', endpoint: '/api/crm/system/backfill-locations' },
  { id: 'inventory-sync', label: 'Inventory Sync', description: 'Pull stock levels from Shopify for all locations', endpoint: '/api/crm/inventory/sync' },
  { id: 'seed-colour-groups', label: 'Seed Colour Groups', description: 'Create default colour groups if none exist', endpoint: '/api/crm/system/seed-colour-groups' },
];

export default function SystemSetupPage() {
  const { toast } = useToast();
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const startTimes = useRef<Record<string, number>>({});

  function runAction(id: string, label: string, endpoint: string) {
    setRunning(r => new Set(r).add(id));
    setResults(r => { const n = { ...r }; delete n[id]; return n; });
    startTimes.current[id] = Date.now();
    toast(`${label} started…`);

    fetch(endpoint, { method: 'POST', credentials: 'include' })
      .then(async res => {
        const d = await res.json().catch(() => ({}));
        const msg = d.data?.message ?? d.error ?? JSON.stringify(d.data ?? d);
        const elapsed = Math.round((Date.now() - (startTimes.current[id] ?? Date.now())) / 1000);
        setResults(r => ({ ...r, [id]: { ok: res.ok, msg } }));
        toast(`${label} ${res.ok ? 'complete' : 'failed'} (${elapsed}s)`, res.ok ? 'success' : 'error');
      })
      .catch(e => {
        setResults(r => ({ ...r, [id]: { ok: false, msg: e.message } }));
        toast(`${label} failed`, 'error');
      })
      .finally(() => setRunning(r => { const n = new Set(r); n.delete(id); return n; }));
  }

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 700 }}>
      <a href="/crm/settings" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>← Settings</a>
      <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, marginBottom: 'var(--crm-space-2)' }}>System Setup</h1>
      <p style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 'var(--crm-space-5)' }}>
        Run after connecting a new store or when data seems stale. Safe to re-run. You can navigate away — you'll get a toast when done.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3)' }}>
        {ACTIONS.map(a => {
          const isRunning = running.has(a.id);
          const result = results[a.id];
          return (
            <div key={a.id} className="crm-card" style={{ padding: 'var(--crm-space-4)', overflow: 'hidden', position: 'relative' }}>
              {isRunning && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--crm-text-primary)', animation: 'indeterminate 1.5s infinite', transformOrigin: 'left' }} />}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 'var(--crm-text-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {a.label}
                    {isRunning && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>running</span>}
                  </div>
                  <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>{a.description}</div>
                  {result && (
                    <div style={{ fontSize: 'var(--crm-text-xs)', marginTop: 4, color: result.ok ? 'var(--crm-success)' : 'var(--crm-error)' }}>
                      {result.msg}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => runAction(a.id, a.label, a.endpoint)}
                  disabled={isRunning}
                  className="crm-btn crm-btn-secondary"
                  style={{ fontSize: 'var(--crm-text-xs)', flexShrink: 0 }}
                >
                  {isRunning ? 'Running…' : 'Run'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes indeterminate {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(0.6); }
          100% { transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
}
