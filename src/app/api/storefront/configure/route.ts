import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { options, priceRules, constraintRules } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/storefront/configure
 *
 * Accepts a channel + selected option codes, validates constraints,
 * computes pricing lines, returns quote + any constraint violations.
 *
 * Body: { channel: "optical", selections: ["progressive_premium", "index_167", "transitions_optical", "blue_light_rx"], basePrice?: 290 }
 */

interface ConfigRequest {
  channel: string;
  selections: string[];
  basePrice?: number;
}

interface PricingLine {
  code: string;
  label: string;
  amountCad: number;
  type: 'absolute' | 'delta';
}

interface Violation {
  rule: string;
  type: string;
  message: string;
}

const BASE_PRICES: Record<string, number> = {
  optical: 290,
  sun: 250,
  reglaze: 0,
};

export async function POST(request: NextRequest) {
  try {
    const body: ConfigRequest = await request.json();
    const { channel, selections, basePrice } = body;

    if (!channel) {
      return NextResponse.json({ error: 'channel required' }, { status: 400 });
    }
    if (!selections?.length) {
      return NextResponse.json({ error: 'selections required' }, { status: 400 });
    }

    const [allOptions, allPrices, allConstraints] = await Promise.all([
      db.select().from(options).where(eq(options.active, true)),
      db.select().from(priceRules).where(eq(priceRules.active, true)),
      db.select().from(constraintRules).where(eq(constraintRules.active, true)),
    ]);

    // Filter to channel
    const channelOptions = allOptions.filter(o => (o.channels as string[])?.includes(channel));
    const validCodes = new Set(channelOptions.map(o => o.code));
    const selected = new Set(selections.filter(s => validCodes.has(s)));

    // ── Constraint validation ────────────────────────────
    const violations: Violation[] = [];
    const channelConstraints = allConstraints.filter(c => validCodes.has(c.sourceOptionCode));

    for (const rule of channelConstraints) {
      if (!selected.has(rule.sourceOptionCode)) continue;

      const targets = rule.targetOptionCodes as string[];

      if (rule.ruleType === 'excludes') {
        for (const t of targets) {
          if (selected.has(t)) {
            violations.push({
              rule: rule.code,
              type: 'excludes',
              message: `${rule.sourceOptionCode} excludes ${t}`,
            });
          }
        }
      }

      if (rule.ruleType === 'allowed_only_with') {
        const hasAny = targets.some(t => selected.has(t));
        if (!hasAny) {
          violations.push({
            rule: rule.code,
            type: 'allowed_only_with',
            message: `${rule.sourceOptionCode} requires one of: ${targets.join(', ')}`,
          });
        }
      }

      if (rule.ruleType === 'requires') {
        for (const t of targets) {
          if (!selected.has(t)) {
            violations.push({
              rule: rule.code,
              type: 'requires',
              message: `${rule.sourceOptionCode} requires ${t}`,
            });
          }
        }
      }
    }

    // ── Pricing computation ──────────────────────────────
    const channelPrices = allPrices.filter(p => (p.channels as string[])?.includes(channel));
    const lines: PricingLine[] = [];
    const base = basePrice ?? BASE_PRICES[channel] ?? 0;

    if (base > 0) {
      lines.push({ code: `base_${channel}`, label: `Base ${channel} pair`, amountCad: base, type: 'absolute' });
    }

    for (const sel of Array.from(selected)) {
      const rule = channelPrices.find(p =>
        (p.optionCodes as string[]).length === 1 && (p.optionCodes as string[])[0] === sel
      );
      if (rule && Number(rule.amountCad) !== 0) {
        lines.push({
          code: rule.code,
          label: rule.label,
          amountCad: Number(rule.amountCad),
          type: (rule.pricingType as 'absolute' | 'delta') ?? 'delta',
        });
      }
    }

    // Compute total: absolute prices replace base, deltas stack
    let total = 0;
    const hasAbsolute = lines.some(l => l.type === 'absolute' && l.code !== `base_${channel}`);

    if (hasAbsolute) {
      // Reglaze-style: use absolute prices + deltas
      for (const l of lines) {
        if (l.type === 'absolute') total += l.amountCad;
        else total += l.amountCad;
      }
    } else {
      // Optical/sun-style: base + all deltas
      for (const l of lines) total += l.amountCad;
    }

    return NextResponse.json({
      channel,
      selections: Array.from(selected),
      violations,
      valid: violations.length === 0,
      pricingLines: lines,
      totalCad: Math.round(total * 100) / 100,
    });
  } catch (err) {
    console.error('[storefront/configure]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
