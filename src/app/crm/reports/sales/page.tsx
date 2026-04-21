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
  topFamilies: Array<{ id: string; name: string; sold: string; revenue: string }>;
  categorySplit: Array<{ category: string; sold: string; revenue: string }>;
  hourlyDistribution: Array<{ hour: string; orders: string }>;
  dayOfWeek: Array<{ dow: string; orders: string; revenue: string }>;
  channelBreakdown: Array<{ source: string; orders: string; revenue: string; aov: string }>;
  dowByChannel: Array<{ source: string; dow: string; orders: string; revenue: string }>;
  hourlyByChannel: Array<{ source: string; hour: string; orders: string }>;
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

const CHANNEL_COLORS: Record<string, string> = { online: '#5E8E3E', shopify: '#5E8E3E', square: '#F59E0B' };
const LOCATION_COLORS_MAP: Record<string, string> = {
  'loc_lunettiq___2459_notre_dame_o_': '#006AFF',
  'loc_lunettiq___225_st_viateur_o_': '#E11D48',
};
const LOCATION_COLORS = ['#006AFF', '#E11D48', '#8B5CF6', '#06B6D4', '#F59E0B', '#5E8E3E'];

function CompareBar({ label, values, max }: { label: string; values: Array<{ source: string; value: number; display: string; color?: string }>; max: number }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{label}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
        {values.map(v => (
          <div key={v.source} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 14, background: 'var(--crm-surface-hover)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${max > 0 ? (v.value / max) * 100 : 0}%`, height: '100%', background: v.color ?? LOCATION_COLORS_MAP[v.source] ?? CHANNEL_COLORS[v.source] ?? 'var(--crm-text-primary)', borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', width: 50, textAlign: 'right' }}>{v.display}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SalesDashboard() {
  const [data, setData] = useState<SalesData | null>(null);
  const [days, setDays] = useState(30);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState('');
  const [channel, setChannel] = useState('');
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch('/api/crm/settings/locations', { credentials: 'include' })
      .then(r => r.json()).then(d => setLocations(d.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (startDate && endDate) {
      params.set('start', startDate);
      params.set('end', endDate);
    } else {
      params.set('days', String(days));
    }
    if (location) params.set('location', location);
    if (channel) params.set('channel', channel);
    fetch(`/api/crm/reports/sales?${params}`, { credentials: 'include' })
      .then(r => r.json()).then(d => setData(d.data)).catch(console.error).finally(() => setLoading(false));
  }, [days, startDate, endDate, location, channel]);

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
          <select value={location} onChange={e => setLocation(e.target.value)} className="crm-input" style={{ fontSize: 'var(--crm-text-xs)', width: 140 }}>
            <option value="">All locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select value={channel} onChange={e => setChannel(e.target.value)} className="crm-input" style={{ fontSize: 'var(--crm-text-xs)', width: 120 }}>
            <option value="">All channels</option>
            <option value="shopify">Online</option>
            <option value="square">In-store</option>
          </select>
          <div style={{ width: 1, height: 20, background: 'var(--crm-border)' }} />
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
          {(data.channelBreakdown ?? data.revBySource).map(s => (
            <div key={s.source} onClick={() => setChannel(channel === s.source ? '' : s.source)} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--crm-border-light)', cursor: 'pointer', background: channel === s.source ? 'var(--crm-surface-hover)' : 'none', borderRadius: 4, paddingLeft: 6, paddingRight: 6 }}>
              <span style={{ fontSize: 'var(--crm-text-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: CHANNEL_COLORS[s.source] ?? 'var(--crm-text-tertiary)' }} />
                {s.source === 'shopify' ? 'Online' : s.source === 'square' ? 'In-store' : s.source ?? 'Unknown'}
              </span>
              <span style={{ fontSize: 'var(--crm-text-sm)' }}>{fmt(s.revenue)} ({s.orders} orders, AOV {fmt(s.aov)})</span>
            </div>
          ))}
        </div>
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>By Location</h2>
          {data.revByLocation.map(l => (
            <div key={l.location} onClick={() => setLocation(location === l.location ? '' : l.location)} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px', borderBottom: '1px solid var(--crm-border-light)', cursor: 'pointer', background: location === l.location ? 'var(--crm-surface-hover)' : 'none', borderRadius: 4 }}>
              <span style={{ fontSize: 'var(--crm-text-sm)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{locations.find(loc => loc.id === l.location)?.name ?? l.location}</span>
              <span style={{ fontSize: 'var(--crm-text-sm)' }}>{fmt(l.revenue)} ({l.orders} orders)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue over time */}
      <div className="crm-card" style={{ padding: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-4)' }}>
        <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>
          {days >= 365 ? 'Monthly' : days >= 90 ? 'Weekly' : 'Daily'} Revenue
        </h2>
        <div>
          {(() => {
            if (days >= 365) {
              // Group by month
              const byMonth = new Map<string, number>();
              for (const d of data.revByDay) {
                const key = d.day.slice(0, 7);
                byMonth.set(key, (byMonth.get(key) ?? 0) + Number(d.revenue));
              }
              const entries = Array.from(byMonth.entries()).sort((a, b) => a[0].localeCompare(b[0]));
              const max = Math.max(...entries.map(e => e[1]), 1);
              return entries.map(([month, rev]) => (
                <Bar key={month} label={new Date(month + '-01').toLocaleDateString('en-CA', { month: 'short', year: '2-digit' })} value={rev} max={max} display={fmt(rev)} />
              ));
            }
            if (days >= 90) {
              // Group by week
              const byWeek = new Map<string, number>();
              for (const d of data.revByDay) {
                const date = new Date(d.day);
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                const key = weekStart.toISOString().slice(0, 10);
                byWeek.set(key, (byWeek.get(key) ?? 0) + Number(d.revenue));
              }
              const entries = Array.from(byWeek.entries()).sort((a, b) => a[0].localeCompare(b[0]));
              const max = Math.max(...entries.map(e => e[1]), 1);
              return entries.map(([week, rev]) => (
                <Bar key={week} label={`Wk ${new Date(week).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`} value={rev} max={max} display={fmt(rev)} />
              ));
            }
            // Daily
            return data.revByDay.map(d => (
              <Bar key={d.day} label={new Date(d.day).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} value={Number(d.revenue)} max={maxDaily} display={fmt(d.revenue)} />
            ));
          })()}
        </div>
      </div>

      {/* Hourly + Day of Week — comparison view */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-6)' }}>
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
            <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>Peak Hours (In-Store)</h2>
            {!channel && <div style={{ display: 'flex', gap: 8, fontSize: 10, flexWrap: 'wrap' }}>
              {Array.from(new Set(data.hourlyByChannel?.map(h => h.source) ?? [])).map((s, i) => (
                <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: LOCATION_COLORS_MAP[s] ?? CHANNEL_COLORS[s] ?? LOCATION_COLORS[i % LOCATION_COLORS.length] }} />{locations.find(l => l.id === s)?.name ?? s}</span>
              ))}
            </div>}
          </div>
          {!channel && data.hourlyByChannel?.length > 0 ? (() => {
            const hours = Array.from(new Set(data.hourlyByChannel.map(h => h.hour))).sort((a, b) => Number(a) - Number(b));
            const sources = Array.from(new Set(data.hourlyByChannel.map(h => h.source)));
            const maxH = Math.max(...data.hourlyByChannel.map(h => Number(h.orders)), 1);
            return hours.map(hour => (
              <CompareBar key={hour} label={`${String(hour).padStart(2, '0')}:00`}
                values={sources.map((s, i) => ({ source: s, value: Number(data.hourlyByChannel.find(h => h.hour === hour && h.source === s)?.orders ?? 0), display: data.hourlyByChannel.find(h => h.hour === hour && h.source === s)?.orders ?? '0', color: LOCATION_COLORS_MAP[s] ?? CHANNEL_COLORS[s] ?? LOCATION_COLORS[i % LOCATION_COLORS.length] }))}
                max={maxH} />
            ));
          })() : data.hourlyDistribution.map(h => (
            <Bar key={h.hour} label={`${String(h.hour).padStart(2, '0')}:00`} value={Number(h.orders)} max={maxHourly} display={`${h.orders}`} />
          ))}
        </div>
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
            <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>Day of Week (In-Store)</h2>
            {!channel && <div style={{ display: 'flex', gap: 8, fontSize: 10, flexWrap: 'wrap' }}>
              {Array.from(new Set(data.dowByChannel?.map(d => d.source) ?? [])).map((s, i) => (
                <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: LOCATION_COLORS_MAP[s] ?? CHANNEL_COLORS[s] ?? LOCATION_COLORS[i % LOCATION_COLORS.length] }} />{locations.find(l => l.id === s)?.name ?? s}</span>
              ))}
            </div>}
          </div>
          {!channel && data.dowByChannel?.length > 0 ? (() => {
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dows = Array.from(new Set(data.dowByChannel.map(d => d.dow))).sort((a, b) => Number(a) - Number(b));
            const sources = Array.from(new Set(data.dowByChannel.map(d => d.source)));
            const maxD = Math.max(...data.dowByChannel.map(d => Number(d.revenue)), 1);
            return dows.map(dow => (
              <CompareBar key={dow} label={dayNames[Number(dow)] ?? dow}
                values={sources.map((s, i) => ({ source: s, value: Number(data.dowByChannel.find(d => d.dow === dow && d.source === s)?.revenue ?? 0), display: fmt(data.dowByChannel.find(d => d.dow === dow && d.source === s)?.revenue ?? '0'), color: LOCATION_COLORS_MAP[s] ?? CHANNEL_COLORS[s] ?? LOCATION_COLORS[i % LOCATION_COLORS.length] }))}
                max={maxD} />
            ));
          })() : (() => {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const maxDow = Math.max(...(data.dayOfWeek ?? []).map(d => Number(d.revenue)), 1);
            return (data.dayOfWeek ?? []).map(d => (
              <Bar key={d.dow} label={days[Number(d.dow)] ?? d.dow} value={Number(d.revenue)} max={maxDow} display={fmt(d.revenue)} />
            ));
          })()}
        </div>
      </div>

      {/* Optical vs Sun + Top Families */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-4)' }}>
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>Optical vs Sun</h2>
          {data.categorySplit.length > 0 ? data.categorySplit.map(c => (
            <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--crm-border-light)', fontSize: 'var(--crm-text-sm)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: c.category === 'sun' ? '#fef3c7' : '#dbeafe', color: c.category === 'sun' ? '#92400e' : '#1e40af' }}>{c.category === 'sun' ? 'SUN' : 'OPTICAL'}</span>
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: 'var(--crm-text-xs)' }}>{c.sold} sold · {fmt(c.revenue)}</span>
            </div>
          )) : <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>No category data — requires product_category metafield</div>}
        </div>
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>Top Families</h2>
          {data.topFamilies.length > 0 ? (() => {
            const maxFam = Math.max(...data.topFamilies.map(f => Number(f.sold)), 1);
            return data.topFamilies.slice(0, 10).map(f => (
              <Bar key={f.id} label={f.name?.slice(0, 20) ?? '?'} value={Number(f.sold)} max={maxFam} display={`${f.sold} · ${fmt(f.revenue)}`} />
            ));
          })() : <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>No family data — requires product families setup</div>}
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
