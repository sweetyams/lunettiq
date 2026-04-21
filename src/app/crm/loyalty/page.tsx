import { requirePermission } from '@/lib/crm/auth';
import { db } from '@/lib/db';
import { customersProjection, creditsLedger, referrals, membershipTrials, loyaltyTiers } from '@/lib/db/schema';
import { sql, eq, asc } from 'drizzle-orm';

export default async function LoyaltyDashboardPage() {
  await requirePermission('org:membership:read');

  const [tierCounts, totalPoints, totalCredits, refStats, trialStats, tiers] = await Promise.all([
    db.select({ tag: sql<string>`unnest(tags)`, count: sql<number>`count(*)` })
      .from(customersProjection)
      .where(sql`tags && ARRAY['member-essential','member-cult','member-vault']`)
      .groupBy(sql`unnest(tags)`),
    db.select({ total: sql<string>`coalesce(sum(amount::numeric), 0)` }).from(creditsLedger).where(eq(creditsLedger.currency, 'points')),
    db.select({ total: sql<string>`coalesce(sum(amount::numeric), 0)` }).from(creditsLedger).where(eq(creditsLedger.currency, 'credit')),
    db.select({ status: referrals.status, count: sql<number>`count(*)` }).from(referrals).groupBy(referrals.status),
    db.select({ outcome: membershipTrials.outcome, count: sql<number>`count(*)` }).from(membershipTrials).groupBy(membershipTrials.outcome),
    db.select().from(loyaltyTiers).where(eq(loyaltyTiers.active, true)).orderBy(asc(loyaltyTiers.sortOrder)),
  ]);

  const tierMap: Record<string, number> = {};
  for (const r of tierCounts) { if (r.tag?.startsWith('member-')) tierMap[r.tag.replace('member-', '')] = Number(r.count); }
  const totalMembers = Object.values(tierMap).reduce((a, b) => a + b, 0);

  // MRR calculation
  let mrr = 0;
  for (const t of tiers) {
    const count = tierMap[t.id] ?? 0;
    mrr += count * Number(t.monthlyFee ?? t.monthlyCredit ?? 0);
  }

  // Tier mix %
  const tierMix = tiers.map(t => ({ id: t.id, label: t.label, count: tierMap[t.id] ?? 0, pct: totalMembers > 0 ? Math.round(((tierMap[t.id] ?? 0) / totalMembers) * 100) : 0 }));

  // Trial conversion rate
  const trialByOutcome: Record<string, number> = {};
  for (const r of trialStats) trialByOutcome[r.outcome ?? ''] = Number(r.count);
  const totalTrials = Object.values(trialByOutcome).reduce((a, b) => a + b, 0);
  const trialConversion = totalTrials > 0 ? Math.round(((trialByOutcome.converted ?? 0) / totalTrials) * 100) : 0;

  // Referral funnel
  const refByStatus: Record<string, number> = {};
  for (const r of refStats) refByStatus[r.status ?? ''] = Number(r.count);
  const totalRefs = Object.values(refByStatus).reduce((a, b) => a + b, 0);
  const refQualifyRate = totalRefs > 0 ? Math.round(((refByStatus.qualified ?? 0) / totalRefs) * 100) : 0;

  return (
    <div>
      {/* Headline metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-6)' }}>
        {[
          { label: 'MRR', value: `$${mrr.toLocaleString()}` },
          { label: 'Members', value: totalMembers },
          { label: 'Trial Conv.', value: `${trialConversion}%` },
          { label: 'Ref. Qualify', value: `${refQualifyRate}%` },
          { label: 'Flagged', value: refByStatus.fraudulent ?? 0 },
        ].map(s => (
          <div key={s.label} className="crm-card" style={{ padding: 'var(--crm-space-4)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600 }}>{s.value}</div>
            <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tier distribution */}
      <div className="crm-card" style={{ padding: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-4)' }}>
        <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', marginBottom: 'var(--crm-space-3)' }}>Tier Distribution</div>
        <div style={{ display: 'flex', gap: 'var(--crm-space-4)' }}>
          {tierMix.map(t => (
            <div key={t.id} style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--crm-text-sm)', marginBottom: 4 }}>
                <span style={{ fontWeight: 500 }}>{t.label}</span>
                <span>{t.count} ({t.pct}%)</span>
              </div>
              <div style={{ height: 8, background: 'var(--crm-bg)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${t.pct}%`, background: 'var(--crm-text-primary)', borderRadius: 4, minWidth: t.count > 0 ? 4 : 0 }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 'var(--crm-space-2)' }}>Target: 30% Essential / 60% CULT / 10% VAULT</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-4)' }}>
        {/* Points */}
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', marginBottom: 'var(--crm-space-2)' }}>Points Outstanding</div>
          <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>{Math.round(Number(totalPoints[0]?.total ?? 0)).toLocaleString()}</div>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>≈ ${Math.floor(Number(totalPoints[0]?.total ?? 0) / 100) * 5} liability</div>
        </div>
        {/* Credits */}
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', marginBottom: 'var(--crm-space-2)' }}>Credits Outstanding</div>
          <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>${Math.round(Number(totalCredits[0]?.total ?? 0)).toLocaleString()}</div>
        </div>
        {/* Referral funnel */}
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', marginBottom: 'var(--crm-space-2)' }}>Referral Funnel</div>
          <div style={{ fontSize: 'var(--crm-text-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Pending</span><span style={{ fontWeight: 500 }}>{refByStatus.pending ?? 0}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Qualified</span><span style={{ fontWeight: 500 }}>{refByStatus.qualified ?? 0}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Expired</span><span style={{ color: 'var(--crm-text-tertiary)' }}>{refByStatus.expired ?? 0}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--crm-error)' }}>Flagged</span><span style={{ color: 'var(--crm-error)', fontWeight: 500 }}>{refByStatus.fraudulent ?? 0}</span></div>
          </div>
        </div>
      </div>

      {/* Trials */}
      <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
        <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', marginBottom: 'var(--crm-space-3)' }}>Trial Funnel</div>
        <div style={{ display: 'flex', gap: 'var(--crm-space-6)' }}>
          {[
            { label: 'Active', value: trialByOutcome.pending ?? 0, color: 'var(--crm-warning)' },
            { label: 'Converted', value: trialByOutcome.converted ?? 0, color: 'var(--crm-success)' },
            { label: 'Cancelled', value: trialByOutcome.cancelled ?? 0, color: 'var(--crm-text-tertiary)' },
            { label: 'Clawback', value: trialByOutcome.clawback_applied ?? 0, color: 'var(--crm-error)' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{s.label}</div>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600 }}>{trialConversion}%</div>
            <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>Conversion rate</div>
            <div style={{ fontSize: 'var(--crm-text-xs)', color: trialConversion >= 50 ? 'var(--crm-success)' : 'var(--crm-error)' }}>{trialConversion >= 50 ? '✓' : '⚠'} Target: &gt;50%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
