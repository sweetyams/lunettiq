'use client';

import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/components/crm/CrmShell';

interface Action { id: string; label: string; description: string; endpoint: string; estimate: string }
interface ActionGroup { label: string; description: string; actions: Action[] }

const GROUPS: ActionGroup[] = [
  {
    label: 'Initial Setup',
    description: 'Run once when connecting a new store. Creates metafield definitions, colour groups, and migrates existing data.',
    actions: [
      { id: 'metafield-setup', label: 'Setup Metafield Definitions', description: 'Create 31 canonical product metafield definitions on Shopify (6 groups: details, design, materials, sizing, compatibility, colour). Also updates CRM visibility settings.', endpoint: '/api/crm/system/metafield-setup', estimate: '~30s' },
      { id: 'metafield-import', label: 'Migrate Existing Metafields', description: 'One-time migration: reads all namespaces (custom, udesly, etc.), remaps to new canonical keys on Shopify, strips unit suffixes (e.g. "52 mm" → "52").', endpoint: '/api/crm/system/metafield-import', estimate: '~60–90s' },
      { id: 'seed-colour-groups', label: 'Seed Colour Groups', description: 'Create default colour filter groups (Black, Brown, Gold, etc.) if none exist. Used for PLP colour filtering.', endpoint: '/api/crm/system/seed-colour-groups', estimate: '~2s' },
    ],
  },
  {
    label: 'Product Sync',
    description: 'Pull product data from Shopify into the local database. Run after initial setup, or whenever products are added/changed in Shopify.',
    actions: [
      { id: 'full-product-sync', label: 'Full Product Sync', description: 'Pull all products, variants, images, and metafields from Shopify via GraphQL. Remaps metafield keys to canonical structure. Re-links archived→active products.', endpoint: '/api/crm/system/full-product-sync', estimate: '~30–60s' },
      { id: 'reconcile-products', label: 'Reconcile Products', description: 'Compare local DB against Shopify. Archives products that no longer exist in Shopify. Cleans up orphaned family members and filters.', endpoint: '/api/crm/system/reconcile-products', estimate: '~10s' },
    ],
  },
  {
    label: 'Inventory',
    description: 'Sync stock levels from Shopify and Square. Reconciles orphan variant-level rows into family+colour inventory.',
    actions: [
      { id: 'inventory-sync', label: 'Inventory Sync', description: 'Pull stock levels (on-hand, committed, available) from all Shopify locations. Merges orphan variant rows into family+colour rows when mappings exist.', endpoint: '/api/crm/inventory/sync', estimate: '~30–60s' },
    ],
  },
  {
    label: 'Square Integration',
    description: 'Match Square POS catalog items to Shopify products and backfill missing location data on orders.',
    actions: [
      { id: 'auto-match-square', label: 'Auto-Match Square', description: 'Parse Square item names, fuzzy-match to Shopify products by frame name and colour. Creates family placeholders for unmatched items.', endpoint: '/api/crm/system/auto-match-square', estimate: '~15–30s' },
      { id: 'backfill-locations', label: 'Backfill Order Locations', description: 'Assign location_id to Square orders that are missing it, based on the Square location mapping.', endpoint: '/api/crm/system/backfill-locations', estimate: '~5s' },
    ],
  },
];

export default function SystemSetupPage() {
  const { toast } = useToast();
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [statuses, setStatuses] = useState<Array<{ id: string; name: string; status: string; detail?: string }>>([]);
  const startTimes = useRef<Record<string, number>>({});

  useEffect(() => {
    fetch('/api/system/status', { credentials: 'include' }).then(r => r.json()).then(d => setStatuses(d.data ?? [])).catch(() => {});
  }, []);

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-5)' }}>
        {/* Connection & Webhook Status */}
        {statuses.length > 0 && (
          <div>
            <div style={{ marginBottom: 'var(--crm-space-2)' }}>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>System Status</div>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>Live connection checks. Webhooks must be registered for real-time sync.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Core', ids: ['neon', 'clerk', 'inngest'] },
                { label: 'Shopify', ids: ['shopify_storefront', 'shopify_admin', 'shopify_webhooks'] },
                { label: 'Square', ids: ['square', 'square_webhooks'] },
              ].map(group => {
                const items = group.ids.map(id => statuses.find(s => s.id === id)).filter(Boolean);
                if (!items.length) return null;
                return (
                  <div key={group.label}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{group.label}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {items.map(s => (
                        <div key={s!.id} className="crm-card" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 180 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: s!.status === 'ok' ? '#16a34a' : s!.status === 'error' ? '#dc2626' : '#d1d5db' }} />
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 500 }}>{s!.name}</div>
                            <div style={{ fontSize: 9, color: s!.status === 'error' ? '#dc2626' : '#9ca3af' }}>{s!.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {GROUPS.map(g => (
          <div key={g.label}>
            <div style={{ marginBottom: 'var(--crm-space-2)' }}>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>{g.label}</div>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>{g.description}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2)' }}>
              {g.actions.map(a => {
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
                          {!isRunning && <span style={{ fontSize: 9, color: 'var(--crm-text-tertiary)', fontWeight: 400 }}>{a.estimate}</span>}
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
          </div>
        ))}
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
