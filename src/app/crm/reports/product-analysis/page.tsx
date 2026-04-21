'use client';

import { useEffect, useState } from 'react';

interface Analysis {
  summary: { totalProducts: number; withDimensions: number; missingDimensions: number; inStock: number; outOfStock: number; avgColoursPerProduct: number };
  dimensions: Record<string, { stats: { min: number; max: number; avg: number; median: number; count: number } | null; distribution: { range: string; count: number }[] }>;
  sizeBreakdown: { small: number; medium: number; large: number; unknown: number };
  categories: { shapes: { name: string; count: number }[]; colours: { name: string; count: number }[]; materials: { name: string; count: number }[]; types: { name: string; count: number }[]; vendors: { name: string; count: number }[] };
  priceDistribution: { range: string; count: number }[];
  gaps: string[];
}

function Bar({ value, max, label, count }: { value: number; max: number; label: string; count: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', width: 80, textAlign: 'right' }}>{label}</span>
      <div style={{ flex: 1, height: 20, background: 'var(--crm-surface-hover)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--crm-text-primary)', borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-secondary)', width: 30 }}>{count}</span>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="crm-card" style={{ padding: 'var(--crm-space-4)', textAlign: 'center' }}>
      <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)' }}>{label}</div>
      {sub && <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function ProductAnalysisPage() {
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFocus, setAiFocus] = useState('');

  useEffect(() => {
    fetch('/api/crm/reports/product-analysis', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setData(d.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function runAiAnalysis() {
    setAiLoading(true);
    fetch('/api/crm/reports/product-analysis/ai', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ focus: aiFocus || undefined }),
    })
      .then(r => r.json())
      .then(d => setAiResult(d.data))
      .catch(console.error)
      .finally(() => setAiLoading(false));
  }

  if (loading) return <div style={{ padding: 'var(--crm-space-6)', color: 'var(--crm-text-tertiary)' }}>Loading analysis...</div>;
  if (!data) return <div style={{ padding: 'var(--crm-space-6)', color: 'var(--crm-text-tertiary)' }}>Failed to load.</div>;

  const maxDist = (arr: { count: number }[]) => Math.max(...arr.map(d => d.count), 1);

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 1200 }}>
      <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, marginBottom: 'var(--crm-space-6)' }}>Product Analysis</h1>

      {/* AI Analysis */}
      <div className="crm-card" style={{ padding: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3)', marginBottom: aiResult ? 'var(--crm-space-4)' : 0 }}>
          <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, flex: 1 }}>✦ AI Catalogue Analysis</h2>
          <select value={aiFocus} onChange={e => setAiFocus(e.target.value)} className="crm-input" style={{ width: 160, fontSize: 'var(--crm-text-xs)' }}>
            <option value="">Full analysis</option>
            <option value="sizing">Sizing coverage</option>
            <option value="pricing">Pricing strategy</option>
            <option value="gaps">Product gaps</option>
            <option value="trends">Demand trends</option>
          </select>
          <button onClick={runAiAnalysis} disabled={aiLoading} className="crm-btn crm-btn-primary" style={{ fontSize: 'var(--crm-text-xs)' }}>
            {aiLoading ? 'Analyzing...' : aiResult ? 'Re-run' : 'Run Analysis'}
          </button>
        </div>
        {aiResult && (
          <div style={{ fontSize: 'var(--crm-text-sm)' }}>
            {typeof aiResult.summary === 'string' && aiResult.summary.length > 200 && !aiResult.strengths?.length ? (
              /* Fallback: raw text display */
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--crm-text-secondary)', lineHeight: 1.6 }}>{aiResult.summary}</div>
            ) : (
              <>
                <p style={{ marginBottom: 'var(--crm-space-3)', color: 'var(--crm-text-secondary)' }}>{aiResult.summary}</p>
                {aiResult.strengths?.length > 0 && (
                  <div style={{ marginBottom: 'var(--crm-space-3)' }}>
                    <strong style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase' }}>Strengths</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 'var(--crm-space-4)' }}>
                      {aiResult.strengths.map((s: string, i: number) => <li key={i} style={{ color: 'var(--crm-success)', marginBottom: 2 }}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {aiResult.gaps?.length > 0 && (
                  <div style={{ marginBottom: 'var(--crm-space-3)' }}>
                    <strong style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase' }}>Gaps</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 'var(--crm-space-4)' }}>
                      {aiResult.gaps.map((g: string, i: number) => <li key={i} style={{ color: 'var(--crm-warning)', marginBottom: 2 }}>{g}</li>)}
                    </ul>
                  </div>
                )}
                {aiResult.recommendations?.length > 0 && (
                  <div style={{ marginBottom: 'var(--crm-space-3)' }}>
                    <strong style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase' }}>Recommendations</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 'var(--crm-space-4)' }}>
                      {aiResult.recommendations.map((r: string, i: number) => <li key={i} style={{ marginBottom: 2 }}>{r}</li>)}
                    </ul>
                  </div>
                )}
                {(aiResult.sizing_insight || aiResult.pricing_insight || aiResult.demand_vs_supply) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--crm-space-3)', marginTop: 'var(--crm-space-3)', padding: 'var(--crm-space-3)', background: 'var(--crm-surface-hover)', borderRadius: 'var(--crm-radius-md)', fontSize: 'var(--crm-text-xs)' }}>
                    {aiResult.sizing_insight && <div><strong>Sizing:</strong> {aiResult.sizing_insight}</div>}
                    {aiResult.pricing_insight && <div><strong>Pricing:</strong> {aiResult.pricing_insight}</div>}
                    {aiResult.demand_vs_supply && <div><strong>Demand vs Supply:</strong> {aiResult.demand_vs_supply}</div>}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-6)' }}>
        <StatCard label="Total Products" value={data.summary.totalProducts} />
        <StatCard label="With Dimensions" value={data.summary.withDimensions} sub={`${data.summary.missingDimensions} missing`} />
        <StatCard label="In Stock" value={data.summary.inStock} sub={`${data.summary.outOfStock} out`} />
        <StatCard label="Avg Colours" value={data.summary.avgColoursPerProduct} sub="per product" />
        <StatCard label="Size Coverage" value={`${data.sizeBreakdown.small}S / ${data.sizeBreakdown.medium}M / ${data.sizeBreakdown.large}L`} sub={`${data.sizeBreakdown.unknown} unknown`} />
      </div>

      {/* Gaps */}
      {data.gaps.length > 0 && (
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-6)', borderLeft: '3px solid var(--crm-warning)' }}>
          <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginBottom: 'var(--crm-space-2)' }}>⚠ Gaps Identified</h2>
          <ul style={{ margin: 0, paddingLeft: 'var(--crm-space-4)' }}>
            {data.gaps.map((g, i) => <li key={i} style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)', marginBottom: 4 }}>{g}</li>)}
          </ul>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-6)' }}>
        {/* Frame Width Distribution */}
        {data.dimensions.frameWidth?.distribution.length > 0 && (
          <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
            <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>
              Frame Width (mm)
              {data.dimensions.frameWidth.stats && <span style={{ fontWeight: 400, color: 'var(--crm-text-tertiary)' }}> — {data.dimensions.frameWidth.stats.min}–{data.dimensions.frameWidth.stats.max}, avg {data.dimensions.frameWidth.stats.avg}</span>}
            </h2>
            {data.dimensions.frameWidth.distribution.map(d => (
              <Bar key={d.range} label={d.range} value={d.count} max={maxDist(data.dimensions.frameWidth.distribution)} count={d.count} />
            ))}
          </div>
        )}

        {/* Bridge Width Distribution */}
        {data.dimensions.bridgeWidth?.distribution.length > 0 && (
          <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
            <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>
              Bridge Width (mm)
              {data.dimensions.bridgeWidth.stats && <span style={{ fontWeight: 400, color: 'var(--crm-text-tertiary)' }}> — {data.dimensions.bridgeWidth.stats.min}–{data.dimensions.bridgeWidth.stats.max}, avg {data.dimensions.bridgeWidth.stats.avg}</span>}
            </h2>
            {data.dimensions.bridgeWidth.distribution.map(d => (
              <Bar key={d.range} label={d.range} value={d.count} max={maxDist(data.dimensions.bridgeWidth.distribution)} count={d.count} />
            ))}
          </div>
        )}

        {/* Lens Width Distribution */}
        {data.dimensions.lensWidth?.distribution.length > 0 && (
          <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
            <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>
              Lens Width (mm)
              {data.dimensions.lensWidth.stats && <span style={{ fontWeight: 400, color: 'var(--crm-text-tertiary)' }}> — {data.dimensions.lensWidth.stats.min}–{data.dimensions.lensWidth.stats.max}, avg {data.dimensions.lensWidth.stats.avg}</span>}
            </h2>
            {data.dimensions.lensWidth.distribution.map(d => (
              <Bar key={d.range} label={d.range} value={d.count} max={maxDist(data.dimensions.lensWidth.distribution)} count={d.count} />
            ))}
          </div>
        )}

        {/* Temple Length Distribution */}
        {data.dimensions.templeLength?.distribution.length > 0 && (
          <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
            <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>
              Temple Length (mm)
              {data.dimensions.templeLength.stats && <span style={{ fontWeight: 400, color: 'var(--crm-text-tertiary)' }}> — {data.dimensions.templeLength.stats.min}–{data.dimensions.templeLength.stats.max}, avg {data.dimensions.templeLength.stats.avg}</span>}
            </h2>
            {data.dimensions.templeLength.distribution.map(d => (
              <Bar key={d.range} label={d.range} value={d.count} max={maxDist(data.dimensions.templeLength.distribution)} count={d.count} />
            ))}
          </div>
        )}

        {/* Price Distribution */}
        {data.priceDistribution.length > 0 && (
          <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
            <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>Price Distribution ($)</h2>
            {data.priceDistribution.map(d => (
              <Bar key={d.range} label={`$${d.range}`} value={d.count} max={maxDist(data.priceDistribution)} count={d.count} />
            ))}
          </div>
        )}

        {/* Size Breakdown */}
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>Size Breakdown</h2>
          <Bar label="Small (<130)" value={data.sizeBreakdown.small} max={Math.max(data.sizeBreakdown.small, data.sizeBreakdown.medium, data.sizeBreakdown.large)} count={data.sizeBreakdown.small} />
          <Bar label="Medium" value={data.sizeBreakdown.medium} max={Math.max(data.sizeBreakdown.small, data.sizeBreakdown.medium, data.sizeBreakdown.large)} count={data.sizeBreakdown.medium} />
          <Bar label="Large (>140)" value={data.sizeBreakdown.large} max={Math.max(data.sizeBreakdown.small, data.sizeBreakdown.medium, data.sizeBreakdown.large)} count={data.sizeBreakdown.large} />
          {data.sizeBreakdown.unknown > 0 && <Bar label="Unknown" value={data.sizeBreakdown.unknown} max={data.summary.totalProducts} count={data.sizeBreakdown.unknown} />}
        </div>
      </div>

      {/* Categories */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--crm-space-4)' }}>
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>Types</h2>
          {data.categories.types.length ? data.categories.types.map(d => (
            <Bar key={d.name} label={d.name} value={d.count} max={data.categories.types[0].count} count={d.count} />
          )) : <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>No data</div>}
        </div>
      </div>
    </div>
  );
}
