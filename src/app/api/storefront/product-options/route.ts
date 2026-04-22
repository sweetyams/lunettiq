export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { optionGroups, options, priceRules, constraintRules, stepDefinitions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Public endpoint: GET /api/storefront/product-options?channel=optical
 * Returns steps, options, prices, and constraints for a given channel.
 * Used by the frontend configurator.
 */
export async function GET(request: NextRequest) {
  const channel = request.nextUrl.searchParams.get('channel');
  if (!channel || !['optical', 'sun', 'reglaze'].includes(channel)) {
    return NextResponse.json({ error: 'channel required (optical|sun|reglaze)' }, { status: 400 });
  }

  const [steps, groups, allOptions, prices, constraints] = await Promise.all([
    db.select().from(stepDefinitions)
      .where(and(eq(stepDefinitions.channel, channel as 'optical' | 'sun' | 'reglaze'), eq(stepDefinitions.active, true)))
      .orderBy(stepDefinitions.sortOrder),
    db.select().from(optionGroups).where(eq(optionGroups.active, true)),
    db.select().from(options).where(eq(options.active, true)).orderBy(options.sortOrder),
    db.select().from(priceRules).where(eq(priceRules.active, true)),
    db.select().from(constraintRules).where(eq(constraintRules.active, true)),
  ]);

  // Filter options and prices to this channel
  const channelOptions = allOptions.filter(o => (o.channels as string[])?.includes(channel));
  const channelPrices = prices.filter(p => (p.channels as string[])?.includes(channel));

  // Filter constraints to only those referencing options in this channel
  const optionCodes = new Set(channelOptions.map(o => o.code));
  const channelConstraints = constraints.filter(c => optionCodes.has(c.sourceOptionCode));

  return NextResponse.json({
    channel,
    steps,
    groups,
    options: channelOptions,
    priceRules: channelPrices,
    constraintRules: channelConstraints,
  });
}
