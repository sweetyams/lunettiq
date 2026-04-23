/**
 * Seed script for Cubitts channel configurator data.
 * Run: npx tsx scripts/seed-cubitts-channel.ts
 *
 * Seeds both legacy tables (option_groups, options, price_rules,
 * constraint_rules, step_definitions) and builder tables
 * (configuratorFlows, flowSteps, stepChoiceGroups, cfgChoices,
 * groupChoices, cfgPriceRules).
 *
 * Base price: £175 GBP. Currency: GBP.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import {
  optionGroups, options, priceRules, constraintRules, stepDefinitions,
  configuratorFlows, flowSteps, stepChoiceGroups, cfgChoices,
  groupChoices, cfgPriceRules,
} from '../src/lib/db/schema';
import { sql } from 'drizzle-orm';

const pg = neon(process.env.DATABASE_URL!);
const db = drizzle(pg);

async function seed() {
  console.log('Seeding Cubitts channel...');

  // ── Add 'cubitts' to channel enum if missing ───────────
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE channel ADD VALUE IF NOT EXISTS 'cubitts';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // ══════════════════════════════════════════════════════════
  // LEGACY TABLES
  // ══════════════════════════════════════════════════════════

  // ── Option Groups (reuse existing where possible) ──────
  const newGroups = [
    { code: 'cubitts_frame_colour', label: 'Frame Colour', layer: 'finish_state' as const, selectionMode: 'single' as const, required: true },
    { code: 'cubitts_frame_size', label: 'Frame Size', layer: 'material' as const, selectionMode: 'single' as const, required: true },
    { code: 'cubitts_lens_type', label: 'Lens Type', layer: 'lens_path' as const, selectionMode: 'single' as const, required: true },
    { code: 'cubitts_lens_colour', label: 'Lens Colour', layer: 'finish_state' as const, selectionMode: 'single' as const, required: true },
    { code: 'cubitts_lens_coatings', label: 'Lens Coatings', layer: 'treatment' as const, selectionMode: 'multi' as const, required: false },
  ];
  for (const g of newGroups) await db.insert(optionGroups).values(g).onConflictDoNothing();
  const allGroups = await db.select().from(optionGroups);
  const gid = (code: string) => allGroups.find(g => g.code === code)!.id;

  // ── Options ────────────────────────────────────────────
  const CH = ['cubitts'];
  const opts = [
    // Frame colours
    { groupId: gid('cubitts_frame_colour'), code: 'cb_colour_black', label: 'Black', channels: CH, sortOrder: 10 },
    { groupId: gid('cubitts_frame_colour'), code: 'cb_colour_caramel', label: 'Caramel', channels: CH, sortOrder: 20 },
    { groupId: gid('cubitts_frame_colour'), code: 'cb_colour_beechwood_fade', label: 'Beechwood Fade', channels: CH, sortOrder: 30 },
    { groupId: gid('cubitts_frame_colour'), code: 'cb_colour_celadon', label: 'Celadon', channels: CH, sortOrder: 40 },
    { groupId: gid('cubitts_frame_colour'), code: 'cb_colour_crystal', label: 'Crystal', channels: CH, sortOrder: 50 },
    { groupId: gid('cubitts_frame_colour'), code: 'cb_colour_bone', label: 'Bone', channels: CH, sortOrder: 60 },
    { groupId: gid('cubitts_frame_colour'), code: 'cb_colour_dark_turtle', label: 'Dark Turtle', channels: CH, sortOrder: 70 },
    // Frame sizes
    { groupId: gid('cubitts_frame_size'), code: 'cb_size_medium', label: 'Medium: 140mm', description: 'For medium heads, typically 135mm to 140mm wide. Width 140mm, Bridge 23mm, Lens width 45.6mm, Rim 5.1mm, Temple 145mm, Height 31.6mm', channels: CH, sortOrder: 10 },
    { groupId: gid('cubitts_frame_size'), code: 'cb_size_large', label: 'Large: 144.5mm', description: 'For wider heads, typically 140mm to 145mm wide', channels: CH, sortOrder: 20 },
    { groupId: gid('cubitts_frame_size'), code: 'cb_size_xl', label: 'Extra Large: 150.5mm', description: 'For large heads, typically wider than 145mm', channels: CH, sortOrder: 30 },
    // Lens types
    { groupId: gid('cubitts_lens_type'), code: 'cb_lens_non_rx', label: 'Non-prescription', description: 'Clear lenses without vision correction.', channels: CH, sortOrder: 10 },
    { groupId: gid('cubitts_lens_type'), code: 'cb_lens_single_vision', label: 'Single Vision Prescription', description: 'ZEISS ClearView lenses for distance or near vision.', channels: CH, sortOrder: 20 },
    // Lens colours
    { groupId: gid('cubitts_lens_colour'), code: 'cb_lens_colour_as_shown', label: 'As shown', description: 'The recommended lens colour to match your frame colour choice.', channels: CH, sortOrder: 10 },
    { groupId: gid('cubitts_lens_colour'), code: 'cb_lens_colour_grey', label: 'Grey', description: 'Cool and calming. A modern tint, at home in clear and colourful frames. Offers 85% light absorption, and full UV protection.', channels: CH, sortOrder: 20 },
    { groupId: gid('cubitts_lens_colour'), code: 'cb_lens_colour_custom', label: 'Custom colour', description: 'Customise your lens colour from our full collection of lens colours.', channels: CH, sortOrder: 30 },
    // Lens coatings
    { groupId: gid('cubitts_lens_coatings'), code: 'cb_coating_duravision', label: 'ZEISS DuraVision® coating', description: 'The highest quality ZEISS DuraVision® Platinum coating with 2-year scratch-free warranty.', channels: CH, sortOrder: 10 },
    { groupId: gid('cubitts_lens_coatings'), code: 'cb_coating_polarisation', label: 'Polarisation', description: 'Polarised lenses have a built-in filter to reduce glare caused by horizontal light. They are ideal for activities where light reflection causes glare, such as water sports.', channels: CH, sortOrder: 20 },
  ];
  for (const o of opts) await db.insert(options).values(o).onConflictDoNothing();
  console.log(`  ${opts.length} options`);

  // ── Price Rules (GBP, delta from £175 base) ────────────
  const prices = [
    // Frame colours — included
    { code: 'cb_price_colour_black', label: 'Black (included)', amountCad: '0', channels: CH, optionCodes: ['cb_colour_black'] },
    { code: 'cb_price_colour_caramel', label: 'Caramel (included)', amountCad: '0', channels: CH, optionCodes: ['cb_colour_caramel'] },
    { code: 'cb_price_colour_beechwood_fade', label: 'Beechwood Fade (included)', amountCad: '0', channels: CH, optionCodes: ['cb_colour_beechwood_fade'] },
    { code: 'cb_price_colour_celadon', label: 'Celadon (included)', amountCad: '0', channels: CH, optionCodes: ['cb_colour_celadon'] },
    { code: 'cb_price_colour_crystal', label: 'Crystal (included)', amountCad: '0', channels: CH, optionCodes: ['cb_colour_crystal'] },
    { code: 'cb_price_colour_bone', label: 'Bone (included)', amountCad: '0', channels: CH, optionCodes: ['cb_colour_bone'] },
    { code: 'cb_price_colour_dark_turtle', label: 'Dark Turtle (included)', amountCad: '0', channels: CH, optionCodes: ['cb_colour_dark_turtle'] },
    // Frame sizes — included
    { code: 'cb_price_size_medium', label: 'Medium (included)', amountCad: '0', channels: CH, optionCodes: ['cb_size_medium'] },
    { code: 'cb_price_size_large', label: 'Large (included)', amountCad: '0', channels: CH, optionCodes: ['cb_size_large'] },
    { code: 'cb_price_size_xl', label: 'Extra Large (included)', amountCad: '0', channels: CH, optionCodes: ['cb_size_xl'] },
    // Lens types — included
    { code: 'cb_price_lens_non_rx', label: 'Non-prescription (included)', amountCad: '0', channels: CH, optionCodes: ['cb_lens_non_rx'] },
    { code: 'cb_price_lens_single_vision', label: 'Single Vision (included)', amountCad: '0', channels: CH, optionCodes: ['cb_lens_single_vision'] },
    // Lens colours — included
    { code: 'cb_price_lens_colour_as_shown', label: 'As shown (included)', amountCad: '0', channels: CH, optionCodes: ['cb_lens_colour_as_shown'] },
    { code: 'cb_price_lens_colour_grey', label: 'Grey (included)', amountCad: '0', channels: CH, optionCodes: ['cb_lens_colour_grey'] },
    { code: 'cb_price_lens_colour_custom', label: 'Custom colour (included)', amountCad: '0', channels: CH, optionCodes: ['cb_lens_colour_custom'] },
    // Coatings
    { code: 'cb_price_coating_duravision', label: 'ZEISS DuraVision® (included)', amountCad: '0', channels: CH, optionCodes: ['cb_coating_duravision'] },
    { code: 'cb_price_coating_polarisation', label: 'Polarisation', amountCad: '50', channels: CH, optionCodes: ['cb_coating_polarisation'] },
  ];
  for (const p of prices) await db.insert(priceRules).values(p).onConflictDoNothing();
  console.log(`  ${prices.length} price rules`);

  // ── Constraint Rules ───────────────────────────────────
  const constraints = [
    // DuraVision is always included (default)
    { code: 'cb_default_duravision', ruleType: 'default_if' as const, sourceOptionCode: 'cb_coating_duravision', targetOptionCodes: ['cb_lens_non_rx', 'cb_lens_single_vision'] },
    // Single vision requires Rx (deferred)
    { code: 'cb_defer_single_vision_rx', ruleType: 'defer_if_no_rx' as const, sourceOptionCode: 'cb_lens_single_vision', targetOptionCodes: ['cb_lens_single_vision'] },
  ];
  for (const c of constraints) await db.insert(constraintRules).values(c).onConflictDoNothing();
  console.log(`  ${constraints.length} constraint rules`);

  // ── Step Definitions ───────────────────────────────────
  const steps = [
    { channel: 'cubitts' as const, code: 'cubitts_step_frame_colour', label: 'Choose frame colour', sortOrder: 10, optionGroupCodes: ['cubitts_frame_colour'] },
    { channel: 'cubitts' as const, code: 'cubitts_step_frame_size', label: 'Choose frame size', sortOrder: 20, optionGroupCodes: ['cubitts_frame_size'] },
    { channel: 'cubitts' as const, code: 'cubitts_step_lens_type', label: 'Choose lens type', sortOrder: 30, optionGroupCodes: ['cubitts_lens_type'] },
    { channel: 'cubitts' as const, code: 'cubitts_step_lens_colour', label: 'Select lens colour', sortOrder: 40, optionGroupCodes: ['cubitts_lens_colour'] },
    { channel: 'cubitts' as const, code: 'cubitts_step_lens_coatings', label: 'Choose lens coatings', sortOrder: 50, optionGroupCodes: ['cubitts_lens_coatings'] },
    { channel: 'cubitts' as const, code: 'cubitts_step_summary', label: 'Summary', sortOrder: 60, optionGroupCodes: [] },
  ];
  for (const s of steps) await db.insert(stepDefinitions).values(s).onConflictDoNothing();
  console.log(`  ${steps.length} step definitions`);

  // ══════════════════════════════════════════════════════════
  // BUILDER TABLES
  // ══════════════════════════════════════════════════════════

  const [flow] = await db.insert(configuratorFlows).values({
    code: 'cubitts', label: 'Cubitts', channelType: 'cubitts', status: 'draft',
  }).onConflictDoNothing().returning();

  if (!flow) { console.log('Builder flow already exists, skipping builder tables.'); return finish(); }

  // Choices catalogue
  const choiceDefs = [
    ['cb_colour_black', 'Black'],
    ['cb_colour_caramel', 'Caramel'],
    ['cb_colour_beechwood_fade', 'Beechwood Fade'],
    ['cb_colour_celadon', 'Celadon'],
    ['cb_colour_crystal', 'Crystal'],
    ['cb_colour_bone', 'Bone'],
    ['cb_colour_dark_turtle', 'Dark Turtle'],
    ['cb_size_medium', 'Medium: 140mm'],
    ['cb_size_large', 'Large: 144.5mm'],
    ['cb_size_xl', 'Extra Large: 150.5mm'],
    ['cb_lens_non_rx', 'Non-prescription'],
    ['cb_lens_single_vision', 'Single Vision Prescription'],
    ['cb_lens_colour_as_shown', 'As shown'],
    ['cb_lens_colour_grey', 'Grey'],
    ['cb_lens_colour_custom', 'Custom colour'],
    ['cb_coating_duravision', 'ZEISS DuraVision® coating'],
    ['cb_coating_polarisation', 'Polarisation'],
  ] as const;

  for (const [code, label] of choiceDefs) {
    await db.insert(cfgChoices).values({ code, label }).onConflictDoNothing();
  }
  const allChoices = await db.select().from(cfgChoices);
  const C: Record<string, string> = {};
  for (const c of allChoices) C[c.code] = c.id;

  async function buildStep(
    code: string, label: string, order: number,
    groupLabel: string, mode: 'single' | 'multi', required: boolean,
    items: [string, number][], isSummary = false,
  ) {
    const [step] = await db.insert(flowSteps).values({
      flowId: flow.id, code, label, orderIndex: order,
      requiredMode: required ? 'always' : 'never', isSummaryStep: isSummary,
    }).returning();
    if (!items.length) return;
    const [group] = await db.insert(stepChoiceGroups).values({
      stepId: step.id, code: code + '_group', label: groupLabel,
      selectionMode: mode, isRequired: required,
    }).returning();
    for (let i = 0; i < items.length; i++) {
      const [choiceCode, price] = items[i];
      if (!C[choiceCode]) { console.warn('Missing choice:', choiceCode); continue; }
      const [pl] = await db.insert(groupChoices).values({
        groupId: group.id, choiceId: C[choiceCode], sortOrder: i * 10,
      }).returning();
      if (price > 0) {
        await db.insert(cfgPriceRules).values({
          ownerType: 'group_choice', ownerId: pl.id,
          ruleType: 'delta', amount: String(price), currency: 'GBP',
          label: choiceCode + ' price',
        });
      }
    }
  }

  await buildStep('cb_frame_colour', 'Choose frame colour', 10, 'Frame Colour', 'single', true, [
    ['cb_colour_black', 0], ['cb_colour_caramel', 0], ['cb_colour_beechwood_fade', 0],
    ['cb_colour_celadon', 0], ['cb_colour_crystal', 0], ['cb_colour_bone', 0],
    ['cb_colour_dark_turtle', 0],
  ]);
  await buildStep('cb_frame_size', 'Choose frame size', 20, 'Frame Size', 'single', true, [
    ['cb_size_medium', 0], ['cb_size_large', 0], ['cb_size_xl', 0],
  ]);
  await buildStep('cb_lens_type', 'Choose lens type', 30, 'Lens Type', 'single', true, [
    ['cb_lens_non_rx', 0], ['cb_lens_single_vision', 0],
  ]);
  await buildStep('cb_lens_colour', 'Select lens colour', 40, 'Lens Colour', 'single', true, [
    ['cb_lens_colour_as_shown', 0], ['cb_lens_colour_grey', 0], ['cb_lens_colour_custom', 0],
  ]);
  await buildStep('cb_lens_coatings', 'Choose lens coatings', 50, 'Lens Coatings', 'multi', false, [
    ['cb_coating_duravision', 0], ['cb_coating_polarisation', 50],
  ]);
  await buildStep('cb_summary', 'Summary', 60, 'Summary', 'single', false, [], true);

  return finish();
}

function finish() {
  console.log('Done! Cubitts channel seeded.');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
