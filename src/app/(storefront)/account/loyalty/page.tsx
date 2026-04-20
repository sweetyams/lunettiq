import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile } from '@/lib/shopify/customer';
import { db } from '@/lib/db';
import { customersProjection, creditsLedger, loyaltyTiers } from '@/lib/db/schema';
import { eq, desc, sql, and, asc } from 'drizzle-orm';
import { getTierFromTags } from '@/lib/crm/loyalty-config';
import { getPointsBalance } from '@/lib/crm/points';
import { MembershipControls } from '@/components/account/MembershipControls';
import CreditRedemption from '@/components/account/CreditRedemption';
import BirthdayPrompt from '@/components/account/BirthdayPrompt';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function buildBenefits(t: any): string[] {
  const b: string[] = [];
  b.push(`$${t.monthlyCredit}/month store credit`);
  b.push(`$${t.birthdayCredit} birthday credit`);
  b.push(`${(Number(t.secondSightRate ?? t.tradeInRate) * 100).toFixed(0)}% trade-in value`);
  if (t.freeRepairs) b.push(`Repairs: ${t.freeRepairs}`);
  if (t.earlyAccessHours > 0) b.push(`${t.earlyAccessHours}h early access to drops`);
  if (t.namedOptician) b.push('Named optician at home location');
  if (t.lensRefresh) b.push('Annual lens refresh');
  if (t.frameRotation) b.push(`Frame rotation: ${t.frameRotation}`);
  if (t.styleConsultation) b.push(`Style consultation: ${t.styleConsultation}`);
  if (t.eventsPerYear > 0) b.push(`${t.eventsPerYear} brand events/year`);
  if (t.annualGift) b.push('Annual curated gift');
  if (t.archiveVote) b.push('Archive reissue vote');
  if (t.privateWhatsapp) b.push('Private WhatsApp line');
  return b;
}

export default async function LoyaltyPage() {
  let customerId: string | null = null;
  if (process.env.DEV_CUSTOMER_ID && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1')) {
    customerId = process.env.DEV_CUSTOMER_ID;
  } else {
    const token = getAccessToken();
    if (token) { try { customerId = (await getCustomerProfile(token)).id.replace(/^gid:\/\/shopify\/Customer\//, ''); } catch {} }
  }

  if (!customerId) return <div className="site-container py-12"><p className="text-sm text-gray-500">Please <Link href="/api/auth/login" className="underline">sign in</Link>.</p></div>;

  const [client, allTiers] = await Promise.all([
    db.select().from(customersProjection).where(eq(customersProjection.shopifyCustomerId, customerId)).then(r => r[0]),
    db.select().from(loyaltyTiers).where(eq(loyaltyTiers.active, true)).orderBy(asc(loyaltyTiers.sortOrder)),
  ]);

  const tier = client ? getTierFromTags(client.tags) : null;
  const tierConfig = allTiers.find(t => t.id === tier);
  const meta = ((client?.metafields as any)?.custom ?? {}) as Record<string, string>;

  const [creditResult, pointsBalance, history] = await Promise.all([
    db.select({ total: sql<string>`coalesce(sum(amount::numeric), 0)` }).from(creditsLedger).where(and(eq(creditsLedger.shopifyCustomerId, customerId), eq(creditsLedger.currency, 'credit'))),
    getPointsBalance(customerId),
    db.select().from(creditsLedger).where(eq(creditsLedger.shopifyCustomerId, customerId)).orderBy(desc(creditsLedger.occurredAt)).limit(20),
  ]);

  const creditBalance = Number(creditResult[0]?.total ?? 0);
  const pointsDollars = Math.floor(pointsBalance / 100) * 5;

  return (
    <div className="site-container py-12">
      <Link href="/account" className="text-sm text-gray-400 hover:text-black">← My Account</Link>
      <h1 className="text-2xl font-medium mt-4 mb-8">Loyalty</h1>

      {/* Balances */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border border-gray-200 rounded-lg p-5">
          <div className="text-2xl font-semibold">${creditBalance.toFixed(2)}</div>
          <div className="text-sm text-gray-500">Credits</div>
          {tierConfig && <div className="text-xs text-gray-400 mt-1">${tierConfig.monthlyCredit}/mo</div>}
        </div>
        <Link href="/account/points" className="border border-gray-200 rounded-lg p-5 hover:border-black transition-colors">
          <div className="text-2xl font-semibold">{pointsBalance.toLocaleString()}</div>
          <div className="text-sm text-gray-500">Points (${pointsDollars})</div>
          <div className="text-xs text-gray-400 mt-1">View details →</div>
        </Link>
      </div>

      {/* Credit Redemption */}
      <CreditRedemption />

      {/* Birthday */}
      <BirthdayPrompt currentBirthday={meta.birthday ?? null} tier={tier} />

      {tier && tierConfig ? (
        <>
          {/* Tier */}
          <div className="border border-gray-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${tier === 'vault' ? 'bg-black text-white' : tier === 'cult' ? 'bg-amber-400 text-black' : 'bg-gray-200 text-black'}`}>◆ {tierConfig.label}</span>
              <span className="text-xs text-gray-400">{meta.membership_status === 'paused' ? 'Paused' : meta.membership_status === 'cancelled' ? 'Cancelled' : 'Active'}{meta.member_since ? ` · Since ${meta.member_since}` : ''}</span>
            </div>
            <h2 className="text-sm font-medium mb-2">Your Benefits</h2>
            <ul className="space-y-1.5">
              {buildBenefits(tierConfig).map(b => <li key={b} className="text-sm flex items-center gap-2"><span className="text-green-600 text-xs">✓</span> {b}</li>)}
            </ul>
            {tierConfig.lensRefresh && (
              <div className="mt-3 pt-2 border-t border-gray-100 text-sm">
                <span className="text-gray-500">Lens refresh: </span>{meta.last_lens_refresh ? `Used ${meta.last_lens_refresh}` : <span className="text-green-600">Available</span>}
              </div>
            )}
          </div>

          {/* Referral */}
          <Link href="/account/referrals" className="block border border-gray-200 rounded-lg p-5 mb-6 hover:border-black transition-colors">
            <div className="text-sm font-medium">Share Lunettiq</div>
            <div className="text-xs text-gray-500 mt-1">Earn {tier === 'vault' ? '$75' : tier === 'cult' ? '$50' : '$30'} credit per referral →</div>
          </Link>

          {/* Manage membership */}
          <MembershipControls status={meta.membership_status ?? 'active'} tier={tier} />
        </>
      ) : (
        <div className="border border-gray-200 rounded-lg p-8 text-center mb-6">
          <h2 className="text-lg font-medium mb-2">Join Lunettiq Loyalty</h2>
          <p className="text-sm text-gray-500 mb-6">Monthly credits, exclusive perks, and more.</p>
          <div className="grid grid-cols-3 gap-3">
            {allTiers.map(t => (
              <div key={t.id} className="border border-gray-200 rounded-lg p-4">
                <div className="text-sm font-semibold">{t.label}</div>
                <div className="text-xl font-semibold mt-1">${t.monthlyFee}<span className="text-xs font-normal text-gray-400">/mo</span></div>
                <div className="text-xs text-gray-400 mt-1">${t.monthlyCredit}/mo credit</div>
              </div>
            ))}
          </div>
          <Link href="/pages/membership" className="text-sm text-gray-500 underline mt-4 inline-block">Compare plans and join →</Link>
        </div>
      )}

      {/* Tier comparison */}
      <div className="mb-6">
        <h2 className="text-sm font-medium mb-3">All Tiers</h2>
        <div className="grid grid-cols-3 gap-3">
          {allTiers.map(t => (
            <div key={t.id} className={`border rounded-lg p-4 ${t.id === tier ? 'border-black' : 'border-gray-200'}`}>
              <div className="text-sm font-semibold">{t.label}</div>
              <div className="text-lg font-semibold mt-1">${t.monthlyFee ?? t.monthlyCredit}<span className="text-xs font-normal text-gray-400">/mo</span></div>
              <div className="text-xs text-gray-400 mt-1">{(Number(t.secondSightRate ?? t.tradeInRate) * 100).toFixed(0)}% trade-in</div>
              {t.id === tier && <div className="text-xs text-green-600 mt-2 font-medium">Current</div>}
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-sm font-medium mb-3">Recent Activity</h2>
          {history.map(h => (
            <div key={h.id} className="flex justify-between items-center text-sm py-1.5 border-b border-gray-50 last:border-0">
              <div>
                <div>{h.reason || h.transactionType.replace(/_/g, ' ')}</div>
                <div className="text-xs text-gray-400">{h.currency === 'points' ? 'Points' : 'Credits'} · {h.occurredAt ? new Date(h.occurredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</div>
              </div>
              <span className={Number(h.amount) >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {Number(h.amount) >= 0 ? '+' : ''}{h.amount}{h.currency === 'points' ? ' pts' : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
