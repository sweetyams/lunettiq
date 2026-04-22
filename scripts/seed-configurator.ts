// Seed script for configurator builder
// Run: npx tsx scripts/seed-configurator.ts

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import {
  configuratorFlows, flowSteps, stepChoiceGroups, cfgChoices,
  groupChoices, cfgPriceRules,
} from '../src/lib/db/schema';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function seed() {
  console.log('Seeding configurator...');

  // 1. Flows
  const [optical] = await db.insert(configuratorFlows).values({ code: 'optical', label: 'Optical', channelType: 'optical', status: 'draft' }).returning();
  const [sun] = await db.insert(configuratorFlows).values({ code: 'sun', label: 'Sun', channelType: 'sun', status: 'draft' }).returning();
  const [reglaze] = await db.insert(configuratorFlows).values({ code: 'reglaze', label: 'Reglaze', channelType: 'reglaze', status: 'draft' }).returning();

  // 2. Choices (reusable catalogue)
  const C: Record<string, string> = {};
  const choices = [
    // Lens types
    'single_vision', 'Single Vision',
    'progressive_premium', 'Progressive Premium',
    'computer_degressive', 'Computer / Degressive',
    'super_progressive', 'Super Progressive',
    'anti_fatigue', 'Anti-Fatigue',
    'non_rx_clear', 'Non-Prescription Clear',
    // Finishes
    'clear', 'Clear',
    'prescription_tint', 'Prescription Tint',
    'prescription_polarized', 'Prescription Polarized',
    'transitions', 'Transitions',
    'interior_tint', 'Interior Tint (Movie Star)',
    // Enhancements
    'blue_light', 'Blue Light',
    'blue_light_no_rx', 'Blue Light (no Rx)',
    // Thinning
    'standard_1_50', 'Standard 1.50',
    'thin_1_61', 'Thin 1.61',
    'ultra_thin_1_67', 'Ultra-Thin 1.67',
    'super_thin_1_74', 'Super Thin 1.74',
    // Sun specific
    'polarized_sun', 'Polarized (Brown, Black, Green)',
    'custom_dipped_tint', 'Custom Dipped Tint',
    'transitions_sun', 'Transitions (Sun)',
    // Reglaze specific
    'rg_single_vision', 'Single Vision Lenses',
    'rg_blue_light', 'Blue Light',
    'rg_thin_1_6', 'Thinning 1.6',
    'rg_thin_1_67', 'Thinning 1.67',
    'rg_thin_1_74', 'Thinning 1.74',
    'rg_progressive_computer', 'Progressive / Computer',
    'rg_transitions', 'Transitions',
    'rg_prescription_tint', 'Prescription + Tint',
    'rg_anti_fatigue', 'Anti-Fatigue',
    'rg_prescription_polarized', 'Prescription Polarized',
    'rg_tint_no_rx', 'Tint (no prescription)',
    'rg_polarized_no_rx', 'Polarized (no prescription)',
    'rg_progressive_sun', 'Progressive Sun',
    'rg_progressive_sun_polarized', 'Progressive Sun Polarized',
    'rg_super_progressive', 'Super Progressive',
    'rg_super_progressive_polarized', 'Super Progressive Polarized',
    'rg_super_progressive_tint', 'Super Progressive + Tint',
    // Shipping
    'ship_canada', 'Shipping Canada',
    'ship_us', 'Shipping US',
    'ship_international', 'International Shipping',
  ];
  for (let i = 0; i < choices.length; i += 2) {
    const [row] = await db.insert(cfgChoices).values({ code: choices[i], label: choices[i + 1] }).onConflictDoNothing().returning();
    if (row) C[choices[i]] = row.id;
    else {
      // Already exists, fetch id
      const existing = await db.select().from(cfgChoices).where(({ code }) => ({ where: code }));
      // Simplified: just skip
    }
  }
  // Refetch all choice IDs
  const allChoices = await db.select().from(cfgChoices);
  for (const c of allChoices) C[c.code as string] = c.id;

  // Helper to create step → group → placements → prices
  async function buildStep(flowId: string, stepCode: string, stepLabel: string, orderIdx: number, groupLabel: string, mode: 'single' | 'multi', required: boolean, items: [string, number, 'delta' | 'override'][]) {
    const [step] = await db.insert(flowSteps).values({ flowId, code: stepCode, label: stepLabel, orderIndex: orderIdx, requiredMode: required ? 'always' : 'never' }).returning();
    const [group] = await db.insert(stepChoiceGroups).values({ stepId: step.id, code: stepCode + '_group', label: groupLabel, selectionMode: mode, isRequired: required }).returning();
    for (let i = 0; i < items.length; i++) {
      const [choiceCode, price, priceType] = items[i];
      if (!C[choiceCode]) { console.warn('Missing choice:', choiceCode); continue; }
      const [pl] = await db.insert(groupChoices).values({ groupId: group.id, choiceId: C[choiceCode], sortOrder: i * 10 }).returning();
      if (price > 0) {
        await db.insert(cfgPriceRules).values({ ownerType: 'group_choice', ownerId: pl.id, ruleType: priceType, amount: String(price), currency: 'CAD', label: items[i][0] + ' price' });
      }
    }
  }

  // ── OPTICAL ──
  await buildStep(optical.id, 'opt_lens_type', 'Lens Type', 10, 'Lens Type', 'single', true, [
    ['single_vision', 0, 'delta'],
    ['progressive_premium', 275, 'delta'],
    ['computer_degressive', 275, 'delta'],
    ['super_progressive', 500, 'delta'],
    ['anti_fatigue', 90, 'delta'],
    ['non_rx_clear', 0, 'delta'],
  ]);
  await buildStep(optical.id, 'opt_lens_finish', 'Lens Finish', 20, 'Lens Finish', 'single', true, [
    ['clear', 0, 'delta'],
    ['prescription_tint', 120, 'delta'],
    ['prescription_polarized', 180, 'delta'],
    ['transitions', 180, 'delta'],
    ['interior_tint', 160, 'delta'],
  ]);
  await buildStep(optical.id, 'opt_enhancements', 'Enhancements', 30, 'Enhancements', 'multi', false, [
    ['blue_light', 75, 'delta'],
    ['blue_light_no_rx', 10, 'delta'],
  ]);
  await buildStep(optical.id, 'opt_thinning', 'Thinning', 40, 'Material', 'single', false, [
    ['standard_1_50', 0, 'delta'],
    ['thin_1_61', 60, 'delta'],
    ['ultra_thin_1_67', 100, 'delta'],
    ['super_thin_1_74', 200, 'delta'],
  ]);
  await buildStep(optical.id, 'opt_shipping', 'Shipping', 50, 'Shipping', 'single', true, [
    ['ship_canada', 35, 'delta'],
    ['ship_us', 45, 'delta'],
    ['ship_international', 59, 'delta'],
  ]);
  await buildStep(optical.id, 'opt_summary', 'Summary', 60, 'Summary', 'single', false, []);

  // ── SUN ──
  await buildStep(sun.id, 'sun_lens_type', 'Lens Type', 10, 'Lens Type', 'single', true, [
    ['polarized_sun', 100, 'delta'],
    ['custom_dipped_tint', 50, 'delta'],
    ['interior_tint', 160, 'delta'],
    ['transitions_sun', 100, 'delta'],
  ]);
  await buildStep(sun.id, 'sun_shipping', 'Shipping', 20, 'Shipping', 'single', true, [
    ['ship_canada', 35, 'delta'],
    ['ship_us', 45, 'delta'],
    ['ship_international', 59, 'delta'],
  ]);
  await buildStep(sun.id, 'sun_summary', 'Summary', 30, 'Summary', 'single', false, []);

  // ── REGLAZE ──
  await buildStep(reglaze.id, 'rg_package', 'Package', 10, 'Lens Package', 'single', true, [
    ['rg_single_vision', 180, 'override'],
    ['rg_progressive_computer', 325, 'override'],
    ['rg_anti_fatigue', 290, 'override'],
    ['rg_super_progressive', 500, 'override'],
    ['rg_prescription_tint', 250, 'override'],
    ['rg_prescription_polarized', 290, 'override'],
    ['rg_tint_no_rx', 125, 'override'],
    ['rg_polarized_no_rx', 150, 'override'],
    ['rg_progressive_sun', 430, 'override'],
    ['rg_progressive_sun_polarized', 490, 'override'],
    ['rg_super_progressive_polarized', 650, 'override'],
    ['rg_super_progressive_tint', 600, 'override'],
  ]);
  await buildStep(reglaze.id, 'rg_addons', 'Add-ons', 20, 'Add-ons', 'multi', false, [
    ['rg_blue_light', 60, 'delta'],
    ['rg_thin_1_6', 50, 'delta'],
    ['rg_thin_1_67', 85, 'delta'],
    ['rg_thin_1_74', 200, 'delta'],
    ['rg_transitions', 130, 'delta'],
  ]);
  await buildStep(reglaze.id, 'rg_shipping', 'Shipping', 30, 'Shipping', 'single', true, [
    ['ship_canada', 35, 'delta'],
    ['ship_us', 45, 'delta'],
    ['ship_international', 59, 'delta'],
  ]);
  await buildStep(reglaze.id, 'rg_summary', 'Summary', 40, 'Summary', 'single', false, []);

  console.log('Done! Seeded 3 flows with all choices and pricing.');
}

seed().catch(e => { console.error(e); process.exit(1); });
