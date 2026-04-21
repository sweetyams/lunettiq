'use client';

import { useState } from 'react';

interface ActionResult { success: boolean; message: string }

const ACTIONS = [
  { id: 'sync-locations', label: 'Sync Locations', description: 'Pull locations from Shopify + Square, link IDs, update names', endpoint: '/api/crm/settings/locations/sync' },
  { id: 'full-product-sync', label: 'Full Product Sync', description: 'Pull all products + variants + metafields + images from Shopify (slow, ~2min)', endpoint: '/api/crm/system/full-product-sync' },
  { id: 'reconcile-products', label: 'Reconcile Products', description: 'Check all DB products against Shopify Storefront API, archive missing ones', endpoint: '/api/crm/system/reconcile-products' },
  { id: 'auto-match-square', label: 'Auto-Match Square Products', description: 'Run auto-matching of Square catalog items to Shopify products', endpoint: '/api/crm/system/auto-match-square' },
  { id: 'backfill-locations', label: 'Backfill Order Locations', description: 'Assign location_id to Square orders missing it (fetches from Square API)', endpoint: '/api/crm/system/backfill-locations' },
  { id: 'seed-colour-groups', label: 'Seed Colour Groups', description: 'Create default colour groups if none exist', endpoint: '/api/crm/system/seed-colour-groups' },
];

export default function SystemSetupPage() {
  const [results, setResults] = useState<Record<string, ActionResult | 'loading'>>({});

  async function runAction(id: string, endpoint: string) {
    setResults(r => ({ ...r, [id]: 'loading' }));
    try {
      const res = await fetch(endpoint, { method: 'POST', credentials: 'include' });
      const d = await res.json();
      setResults(r => ({ ...r, [id]: { success: res.ok, message: d.data?.message ?? d.error ?? JSON.stringify(d.data ?? d) } }));
    } catch (e: any) {
      setResults(r => ({ ...r, [id]: { success: false, message: e.message } }));
    }
  }

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 700 }}>
      <a href="/crm/settings" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>← Settings</a>
      <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, marginBottom: 'var(--crm-space-2)' }}>System Setup</h1>
      <p style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 'var(--crm-space-5)' }}>
        Run these after connecting a new store, migrating, or when data seems stale. Safe to re-run.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3)' }}>
        {ACTIONS.map(action => {
          const result = results[action.id];
          return (
            <div key={action.id} className="crm-card" style={{ padding: 'var(--crm-space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 'var(--crm-text-sm)' }}>{action.label}</div>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>{action.description}</div>
                {result && result !== 'loading' && (
                  <div style={{ fontSize: 'var(--crm-text-xs)', marginTop: 4, color: result.success ? 'var(--crm-success)' : 'var(--crm-error)' }}>
                    {result.message}
                  </div>
                )}
              </div>
              <button
                onClick={() => runAction(action.id, action.endpoint)}
                disabled={result === 'loading'}
                className="crm-btn crm-btn-secondary"
                style={{ fontSize: 'var(--crm-text-xs)', flexShrink: 0 }}
              >
                {result === 'loading' ? 'Running…' : 'Run'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
