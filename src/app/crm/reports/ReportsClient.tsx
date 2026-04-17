'use client';

import { useState } from 'react';

interface ReportDef {
  type: string;
  title: string;
  description: string;
}

const REPORTS: ReportDef[] = [
  { type: 'ltv-cohorts', title: 'LTV Cohorts', description: 'Customer lifetime value distribution by spend bucket' },
  { type: 'return-rate', title: 'Return Rate by Product', description: 'Top 20 products by return/cancellation rate' },
  { type: 'staff-activity', title: 'Staff Activity', description: 'Interactions logged and recommendations made (last 30 days)' },
  { type: 'segment-sizes', title: 'Segment Sizes', description: 'All segments with current member counts' },
  { type: 'consent-rates', title: 'Consent Rates', description: 'Email and SMS marketing opt-in rates' },
  { type: 'ai-usage', title: 'AI Usage', description: 'AI request volume and estimated costs (last 30 days)' },
];

type Row = Record<string, string | number | null>;

function exportCsv(rows: Row[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const lines = [keys.join(','), ...rows.map(r => keys.map(k => `"${r[k] ?? ''}"`).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ReportsClient() {
  const [active, setActive] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(type: string) {
    setLoading(type);
    setError(null);
    try {
      const res = await fetch(`/api/crm/reports/${type}`, { credentials: 'include' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setRows(d.data ?? []);
      setActive(type);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setRows([]);
      setActive(type);
    }
    setLoading(null);
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ marginBottom: 'var(--crm-space-6)' }}>
        <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Reports</h1>
        <p style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>Pre-built reports across clients, products, and operations</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-6)' }}>
        {REPORTS.map(r => (
          <div key={r.type} className="crm-card" style={{ padding: 'var(--crm-space-4)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 'var(--crm-space-3)' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 'var(--crm-text-sm)' }}>{r.title}</div>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-secondary)', marginTop: 2 }}>{r.description}</div>
            </div>
            <button onClick={() => run(r.type)} disabled={loading === r.type} className={active === r.type ? 'crm-btn crm-btn-primary' : 'crm-btn crm-btn-secondary'} style={{ alignSelf: 'flex-start', fontSize: 'var(--crm-text-xs)' }}>
              {loading === r.type ? 'Running…' : 'Run'}
            </button>
          </div>
        ))}
      </div>

      {active && (
        <div className="crm-card" style={{ padding: 'var(--crm-space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-4)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--crm-text-sm)' }}>
              {REPORTS.find(r => r.type === active)?.title}
            </div>
            {rows.length > 0 && (
              <button onClick={() => exportCsv(rows, active)} className="crm-btn crm-btn-secondary" style={{ fontSize: 'var(--crm-text-xs)' }}>Export CSV</button>
            )}
          </div>
          {error ? (
            <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-error)' }}>{error}</div>
          ) : rows.length === 0 ? (
            <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>No data</div>
          ) : (
            <table className="crm-table">
              <thead>
                <tr>
                  {Object.keys(rows[0]).map(k => <th key={k}>{k.replace(/_/g, ' ')}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    {Object.values(r).map((v, j) => <td key={j}>{v ?? '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
