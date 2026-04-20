'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface SalesData {
  period: { days: number };
  summary: { total_orders: string; total_revenue: string; aov: string; unique_customers: string };
  revBySource: Array<{ source: string; orders: string; revenue: string; aov: string }>;
  revByDay: Array<{ day: string; orders: string; revenue: string }>;
  revByLocation: Array<{ location: string; orders: string; revenue: string; aov: string }>;
  topProducts: Array<{ name: string; product_id: string | null; sold: string; revenue: string }>;
  hourlyDistribution: Array<{ hour: string; orders: string }>;
  repeatCustomers: { one_time: string; two_orders: string; three_plus: string };
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="crm-card" style={{ padding: 'var(--crm-space-4)', textAlign: 'center' }}>
      <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)' }}>{label}</div>
      {sub && <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Bar({ label, value, max, display }: { label: string; value: number; max: number; display: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', width: 100, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 20, background: 'var(--crm-surface-hover)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, height: '100%', background: 'var(--crm-text-primary)', borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-secondary)', width: 60, textAlign: 'right' }}>{display}</span>
    </div>
  );
}

export default function SalesDashboard() {
  const [data, setData] = useState<SalesData | null>(null);
  const [days, setDays] = useState(30);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (startDate && endDate) {
      params.set('start', startDate);
      params.set('end', endDate);
    } else {
      params.set('days', String(days));
    }
    fetch(`/api/crm/reports/sales?${params}`, { credentials: 'include' })
      .then(r => r.json()).then(d => setData(d.data)).catch(console.error).finally(() => setLoading(false));
  }, [days, startDate, endDate]);

  function runAi() {
    if (!data) return;
    setAiLoading(true);
    fetch('/api/crm/reports/sales/ai', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salesData: data }),
    }).then(r => r.json()).then(d => setAiResult(d.data)).catch(console.error).finally(() => setAiLoading(false));
  }

  if (loading || !data) return <div style={{ padding: 'var(--crm-space-6)', color: 'var(--crm-text-tertiary)' }}>Loading…</div>;

  const fmt = (n: string | number) => `$${Number(n).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const maxDaily = Math.max(...data.revByDay.map(d => Number(d.revenue)), 1);
  const maxHourly = Math.max(...data.hourlyDistribution.map(d => Number(d.orders)), 1);
  const maxProduct = Math.max(...data.topProducts.map(p => Number(p.sold)), 1);

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-5)' }}>
        <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Sales</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (!endDate) setEndDate(new Date().toISOString().slice(0, 10)); }} className="crm-input" style={{ fontSize: 'var(--crm-text-xs)', width: 130 }} />
          <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>→</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="crm-input" style={{ fontSize: 'var(--crm-text-xs)', width: 130 }} />
          {(startDate || endDate) && <button onClick={() => { setStartDate(''); setEndDate(''); }} style={{ fontSize: 'var(--crm-text-xs)', background: 'none', border: 'none', color: 'var(--crm-text-tertiary)', cursor: 'pointer' }}>✕ Clear</button>}
          <div style={{ width: 1, height: 20, background: 'var(--crm-border)' }} />
          {[7, 30, 90, 365].map(d => (
            <button key={d} onClick={() => { setDays(d); setStartDate(''); setEndDate(''); }} style={{
              padding: '4px 12px', fontSize: 'var(--crm-text-xs)', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: days === d && !startDate ? 'var(--crm-text-primary)' : 'var(--crm-surface-hover)',
              color: days === d && !startDate ? 'var(--crm-text-inverse)' : 'var(--crm-text-secondary)',
            }}>{d === 365 ? '1yr' : `${d}d`}</button>
          ))}
        </div>
      </div>

      {/* AI Analysis */}
      <div className="crm-card" style={{ padding: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>✦ AI Sales Analysis</h2>
          <button onClick={runAi} disabled={aiLoading || !data} className="crm-btn crm-btn-primary" style={{ fontSize: 'var(--crm-text-xs)' }}>
            {aiLoading ? 'Analyzing…' : aiResult ? 'Re-analyze' : 'Analyze'}
          </button>
        </div>
        {aiResult && (
          <div style={{ marginTop: 'var(--crm-space-4)', fontSize: 'var(--crm-text-sm)' }}>
            {/* Summary */}
            <p style={{ fontSize: 'var(--crm-text-base)', lineHeight: 1.6, marginBottom: 'var(--crm-space-4)', color: 'var(--crm-text-primary)' }}>{aiResult.summary}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-4)' }}>
              {/* Insights */}
              {aiResult.insights?.length > 0 && (
                <div style={{ padding: 'var(--crm-space-4)', background: 'var(--crm-surface-hover)', borderRadius: 'var(--crm-radius-md)' }}>
                  <h3 style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--crm-text-tertiary)', marginBottom: 'var(--crm-space-2)', letterSpacing: '0.05em' }}>Key Insights</h3>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {aiResult.insights.map((s: string, i: number) => (
                      <li key={i} style={{ padding: '6px 0', borderBottom: i < aiResult.insights.length - 1 ? '1px solid var(--crm-border-light)' : 'none', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--crm-success)', fontSize: 12, marginTop: 2 }}>●</span>
                        <span style={{ color: 'var(--crm-text-secondary)' }}>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {aiResult.recommendations?.length > 0 && (
                <div style={{ padding: 'var(--crm-space-4)', background: '#fefce8', borderRadius: 'var(--crm-radius-md)', border: '1px solid #fef08a' }}>
                  <h3 style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, textTransform: 'uppercase', color: '#92400e', marginBottom: 'var(--crm-space-2)', letterSpacing: '0.05em' }}>Recommendations</h3>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {aiResult.recommendations.map((r: string, i: number) => (
                      <li key={i} style={{ padding: '6px 0', borderBottom: i < aiResult.recommendations.length - 1 ? '1px solid #fef08a' : 'none', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 12, marginTop: 1 }}>→</span>
                        <span style={{ color: '#78350f' }}>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-6)' }}>
        <StatCard label="Revenue" value={fmt(data.summary.total_revenue)} />
        <StatCard label="Orders" value={Number(data.summary.total_orders).toLocaleString()} />
        <StatCard label="AOV" value={fmt(data.summary.aov)} />
        <StatCard label="Customers" value={Number(data.summary.unique_customers).toLocaleString()} />
      </div>

      {/* Source + Location */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-6)' }}>
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>By Channel</h2>
          {data.revBySource.map(s => (
            <div key={s.source} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--crm-border-light)' }}>
              <span style={{ fontSize: 'var(--crm-text-sm)' }}>{s.source ?? 'shopify'}</span>
              <span style={{ fontSize: 'var(--crm-text-sm)' }}>{fmt(s.revenue)} ({s.orders} orders, AOV {fmt(s.aov)})</span>
            </div>
          ))}
        </div>
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>By Location</h2>
          {data.revByLocation.map(l => (
            <div key={l.location} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--crm-border-light)' }}>
              <span style={{ fontSize: 'var(--crm-text-sm)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.location}</span>
              <span style={{ fontSize: 'var(--crm-text-sm)' }}>{fmt(l.revenue)} ({l.orders} orders)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Daily revenue + Hourly */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-6)' }}>
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>Daily Revenue</h2>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {data.revByDay.slice(-30).map(d => (
              <Bar key={d.day} label={new Date(d.day).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} value={Number(d.revenue)} max={maxDaily} display={fmt(d.revenue)} />
            ))}
          </div>
        </div>
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>Peak Hours</h2>
          {data.hourlyDistribution.map(h => (
            <Bar key={h.hour} label={`${String(h.hour).padStart(2, '0')}:00`} value={Number(h.orders)} max={maxHourly} display={`${h.orders}`} />
          ))}
        </div>
      </div>

      {/* Top products + Repeat customers */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--crm-space-4)' }}>
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>Top Products</h2>
          {data.topProducts.slice(0, 15).map(p => (
            <Bar key={p.name} label={p.name?.slice(0, 25) ?? '?'} value={Number(p.sold)} max={maxProduct} display={`${p.sold} sold`} />
          ))}
        </div>
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>Customer Retention</h2>
          <div style={{ fontSize: 'var(--crm-text-sm)', space: 'var(--crm-space-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--crm-border-light)' }}>
              <span>One-time buyers</span><span style={{ fontWeight: 600 }}>{Number(data.repeatCustomers.one_time).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--crm-border-light)' }}>
              <span>2 orders</span><span style={{ fontWeight: 600 }}>{Number(data.repeatCustomers.two_orders).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span>3+ orders</span><span style={{ fontWeight: 600, color: 'var(--crm-success)' }}>{Number(data.repeatCustomers.three_plus).toLocaleString()}</span>
            </div>
          </div>
          <div style={{ marginTop: 'var(--crm-space-3)', fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
            Repeat rate: {(((Number(data.repeatCustomers.two_orders) + Number(data.repeatCustomers.three_plus)) / (Number(data.repeatCustomers.one_time) + Number(data.repeatCustomers.two_orders) + Number(data.repeatCustomers.three_plus))) * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}
