/**
 * Seed script for CRM Product Options Engine.
 * Run: npx tsx scripts/seed-product-options.ts
 */
import { db } from '../src/lib/db';
import {
  optionGroups,
  options,
  priceRules,
  constraintRules,
  stepDefinitions,
} from '../src/lib/db/schema';

async function seed() {
  console.log('Seeding product options...');

  // ─── Option Groups ─────────────────────────────────────
  const groups = [
    { code: 'lens_path', label: 'Lens Path', layer: 'lens_path' as const, selectionMode: 'single' as const, required: true },
    { code: 'material_index', label: 'Material / Index', layer: 'material' as const, selectionMode: 'single' as const, required: false },
    { code: 'finish_state', label: 'Finish State', layer: 'finish_state' as const, selectionMode: 'single' as const, required: true },
    { code: 'optional_treatments', label: 'Optional Treatments', layer: 'treatment' as const, selectionMode: 'multi' as const, required: false },
    { code: 'shipping_band', label: 'Shipping', layer: 'shipping' as const, selectionMode: 'single' as const, required: false },
  ];

  for (const g of groups) {
    await db.insert(optionGroups).values(g).onConflictDoNothing();
  }
  console.log(`  ${groups.length} option groups`);

  // ─── Fetch group IDs ───────────────────────────────────
  const allGroups = await db.select().from(optionGroups);
  const gid = (code: string) => allGroups.find(g => g.code === code)!.id;

  // ─── Options ───────────────────────────────────────────
  const opts = [
    // Lens paths — optical
    { groupId: gid('lens_path'), code: 'single_vision', label: 'Single Vision', channels: ['optical'], sortOrder: 10 },
    { groupId: gid('lens_path'), code: 'progressive_premium', label: 'Progressive Premium', channels: ['optical'], sortOrder: 20 },
    { groupId: gid('lens_path'), code: 'computer_degressive', label: 'Computer / Degressive', channels: ['optical'], sortOrder: 30 },
    { groupId: gid('lens_path'), code: 'super_progressive', label: 'Super Progressive', channels: ['optical'], sortOrder: 40 },
    { groupId: gid('lens_path'), code: 'anti_fatigue', label: 'Anti-Fatigue', channels: ['optical'], sortOrder: 50 },
    { groupId: gid('lens_path'), code: 'non_prescription_clear', label: 'Non-Prescription Clear', channels: ['optical'], sortOrder: 60 },
    // Lens paths — sun
    { groupId: gid('lens_path'), code: 'non_prescription_sun', label: 'Non-Prescription Sun', channels: ['sun'], sortOrder: 10 },
    { groupId: gid('lens_path'), code: 'prescription_sun', label: 'Prescription Sun', channels: ['sun'], sortOrder: 20 },
    // Lens paths — reglaze
    { groupId: gid('lens_path'), code: 'reglaze_single_vision', label: 'Single Vision Lenses', channels: ['reglaze'], sortOrder: 10 },
    { groupId: gid('lens_path'), code: 'reglaze_progressive_computer', label: 'Progressive / Computer', channels: ['reglaze'], sortOrder: 20 },
    { groupId: gid('lens_path'), code: 'reglaze_anti_fatigue', label: 'Anti-Fatigue', channels: ['reglaze'], sortOrder: 30 },
    { groupId: gid('lens_path'), code: 'reglaze_progressive_sun', label: 'Progressive Sun', channels: ['reglaze'], sortOrder: 40 },
    { groupId: gid('lens_path'), code: 'reglaze_super_progressive', label: 'Super Progressive', channels: ['reglaze'], sortOrder: 50 },

    // Material / index — optical + sun
    { groupId: gid('material_index'), code: 'index_150', label: 'Standard 1.5', channels: ['optical', 'sun'], sortOrder: 10 },
    { groupId: gid('material_index'), code: 'index_160', label: 'Thinning 1.6', channels: ['optical', 'sun'], sortOrder: 20 },
    { groupId: gid('material_index'), code: 'index_167', label: 'Ultra Thin 1.67', channels: ['optical', 'sun'], sortOrder: 30 },
    { groupId: gid('material_index'), code: 'index_174', label: 'Super Thin 1.74', channels: ['optical', 'sun'], sortOrder: 40 },
    // Material / index — reglaze
    { groupId: gid('material_index'), code: 'reglaze_index_160', label: '1.6 Thinning', channels: ['reglaze'], sortOrder: 20 },
    { groupId: gid('material_index'), code: 'reglaze_index_167', label: '1.67 Thinning', channels: ['reglaze'], sortOrder: 30 },
    { groupId: gid('material_index'), code: 'reglaze_index_174', label: '1.74 Thinning', channels: ['reglaze'], sortOrder: 40 },

    // Finish states — optical
    { groupId: gid('finish_state'), code: 'clear', label: 'Clear', channels: ['optical'], sortOrder: 10 },
    { groupId: gid('finish_state'), code: 'tint_prescription', label: 'Prescription Tint', channels: ['optical', 'sun'], sortOrder: 20 },
    { groupId: gid('finish_state'), code: 'polarized_prescription', label: 'Prescription Polarized', channels: ['optical', 'sun'], sortOrder: 30 },
    { groupId: gid('finish_state'), code: 'transitions_optical', label: 'Transitions', channels: ['optical'], sortOrder: 40 },
    { groupId: gid('finish_state'), code: 'interior_tint', label: 'Interior Tint (Movie Star)', channels: ['optical', 'sun'], sortOrder: 50 },
    // Finish states — sun
    { groupId: gid('finish_state'), code: 'sun_standard', label: 'Standard Sun Finish', channels: ['sun'], sortOrder: 10 },
    { groupId: gid('finish_state'), code: 'sun_polarized', label: 'Polarized', channels: ['sun'], sortOrder: 20 },
    { groupId: gid('finish_state'), code: 'sun_custom_dipped_tint', label: 'Custom Dipped Tint', channels: ['sun'], sortOrder: 30 },
    { groupId: gid('finish_state'), code: 'transitions_sun', label: 'Transitions', channels: ['sun'], sortOrder: 40 },
    // Finish states — reglaze
    { groupId: gid('finish_state'), code: 'reglaze_transitions', label: 'Transitions', channels: ['reglaze'], sortOrder: 10 },
    { groupId: gid('finish_state'), code: 'reglaze_prescription_tint', label: 'Prescription + Tint', channels: ['reglaze'], sortOrder: 20 },
    { groupId: gid('finish_state'), code: 'reglaze_prescription_polarized', label: 'Prescription Polarized', channels: ['reglaze'], sortOrder: 30 },
    { groupId: gid('finish_state'), code: 'reglaze_tint_no_rx', label: 'Tint (no Rx)', channels: ['reglaze'], sortOrder: 40 },
    { groupId: gid('finish_state'), code: 'reglaze_polarized_no_rx', label: 'Polarized (no Rx)', channels: ['reglaze'], sortOrder: 50 },
    { groupId: gid('finish_state'), code: 'reglaze_progressive_sun_polarized', label: 'Progressive Sun Polarized', channels: ['reglaze'], sortOrder: 60 },
    { groupId: gid('finish_state'), code: 'reglaze_super_progressive_polarized', label: 'Super Progressive Polarized', channels: ['reglaze'], sortOrder: 70 },
    { groupId: gid('finish_state'), code: 'reglaze_super_progressive_tint', label: 'Super Progressive + Tint', channels: ['reglaze'], sortOrder: 80 },

    // Treatments
    { groupId: gid('optional_treatments'), code: 'blue_light_rx', label: 'Blue Light', channels: ['optical'], sortOrder: 10 },
    { groupId: gid('optional_treatments'), code: 'blue_light_no_rx', label: 'Blue Light (no Rx)', channels: ['optical'], sortOrder: 20 },
  ];

  for (const o of opts) {
    await db.insert(options).values(o).onConflictDoNothing();
  }
  console.log(`  ${opts.length} options`);

  // ─── Price Rules ───────────────────────────────────────
  const prices = [
    // Optical lens paths (delta from base 290)
    { code: 'price_single_vision', label: 'Single Vision (included)', amountCad: '0', channels: ['optical'], optionCodes: ['single_vision'] },
    { code: 'price_progressive_premium', label: 'Progressive Premium', amountCad: '275', channels: ['optical'], optionCodes: ['progressive_premium'] },
    { code: 'price_computer_degressive', label: 'Computer / Degressive', amountCad: '275', channels: ['optical'], optionCodes: ['computer_degressive'] },
    { code: 'price_super_progressive', label: 'Super Progressive', amountCad: '500', channels: ['optical'], optionCodes: ['super_progressive'] },
    { code: 'price_anti_fatigue', label: 'Anti-Fatigue', amountCad: '90', channels: ['optical'], optionCodes: ['anti_fatigue'] },
    { code: 'price_non_prescription_clear', label: 'Non-Prescription Clear', amountCad: '0', channels: ['optical'], optionCodes: ['non_prescription_clear'] },

    // Material / index
    { code: 'price_index_150', label: 'Standard 1.5 (included)', amountCad: '0', channels: ['optical', 'sun'], optionCodes: ['index_150'] },
    { code: 'price_index_160', label: 'Thinning 1.6', amountCad: '60', channels: ['optical', 'sun'], optionCodes: ['index_160'] },
    { code: 'price_index_167', label: 'Ultra Thin 1.67', amountCad: '100', channels: ['optical', 'sun'], optionCodes: ['index_167'] },
    { code: 'price_index_174', label: 'Super Thin 1.74', amountCad: '200', channels: ['optical', 'sun'], optionCodes: ['index_174'] },

    // Optical finish states
    { code: 'price_clear', label: 'Clear (included)', amountCad: '0', channels: ['optical'], optionCodes: ['clear'] },
    { code: 'price_tint_prescription', label: 'Prescription Tint', amountCad: '120', channels: ['optical', 'sun'], optionCodes: ['tint_prescription'] },
    { code: 'price_polarized_prescription', label: 'Prescription Polarized', amountCad: '180', channels: ['optical', 'sun'], optionCodes: ['polarized_prescription'] },
    { code: 'price_transitions_optical', label: 'Transitions', amountCad: '180', channels: ['optical'], optionCodes: ['transitions_optical'] },
    { code: 'price_interior_tint', label: 'Interior Tint', amountCad: '160', channels: ['optical', 'sun'], optionCodes: ['interior_tint'] },

    // Treatments
    { code: 'price_blue_light_rx', label: 'Blue Light (Rx)', amountCad: '75', channels: ['optical'], optionCodes: ['blue_light_rx'] },
    { code: 'price_blue_light_no_rx', label: 'Blue Light (no Rx)', amountCad: '10', channels: ['optical'], optionCodes: ['blue_light_no_rx'] },

    // Sun finish states
    { code: 'price_sun_standard', label: 'Standard Sun (included)', amountCad: '0', channels: ['sun'], optionCodes: ['sun_standard'] },
    { code: 'price_sun_polarized', label: 'Polarized', amountCad: '100', channels: ['sun'], optionCodes: ['sun_polarized'] },
    { code: 'price_sun_custom_dipped_tint', label: 'Custom Dipped Tint', amountCad: '50', channels: ['sun'], optionCodes: ['sun_custom_dipped_tint'] },
    { code: 'price_transitions_sun', label: 'Transitions (Sun)', amountCad: '100', channels: ['sun'], optionCodes: ['transitions_sun'] },

    // Sun lens paths
    { code: 'price_non_prescription_sun', label: 'Non-Prescription Sun (included)', amountCad: '0', channels: ['sun'], optionCodes: ['non_prescription_sun'] },
    { code: 'price_prescription_sun', label: 'Prescription Sun', amountCad: '0', channels: ['sun'], optionCodes: ['prescription_sun'] },

    // Reglaze lens paths
    { code: 'price_reglaze_single_vision', label: 'Reglaze Single Vision', amountCad: '180', pricingType: 'absolute' as const, channels: ['reglaze'], optionCodes: ['reglaze_single_vision'] },
    { code: 'price_reglaze_progressive_computer', label: 'Reglaze Progressive/Computer', amountCad: '325', pricingType: 'absolute' as const, channels: ['reglaze'], optionCodes: ['reglaze_progressive_computer'] },
    { code: 'price_reglaze_anti_fatigue', label: 'Reglaze Anti-Fatigue', amountCad: '290', pricingType: 'absolute' as const, channels: ['reglaze'], optionCodes: ['reglaze_anti_fatigue'] },
    { code: 'price_reglaze_progressive_sun', label: 'Reglaze Progressive Sun', amountCad: '430', pricingType: 'absolute' as const, channels: ['reglaze'], optionCodes: ['reglaze_progressive_sun'] },
    { code: 'price_reglaze_super_progressive', label: 'Reglaze Super Progressive', amountCad: '500', pricingType: 'absolute' as const, channels: ['reglaze'], optionCodes: ['reglaze_super_progressive'] },

    // Reglaze material
    { code: 'price_reglaze_index_160', label: 'Reglaze 1.6', amountCad: '50', channels: ['reglaze'], optionCodes: ['reglaze_index_160'] },
    { code: 'price_reglaze_index_167', label: 'Reglaze 1.67', amountCad: '85', channels: ['reglaze'], optionCodes: ['reglaze_index_167'] },
    { code: 'price_reglaze_index_174', label: 'Reglaze 1.74', amountCad: '200', channels: ['reglaze'], optionCodes: ['reglaze_index_174'] },

    // Reglaze finish states
    { code: 'price_reglaze_transitions', label: 'Reglaze Transitions', amountCad: '130', channels: ['reglaze'], optionCodes: ['reglaze_transitions'] },
    { code: 'price_reglaze_prescription_tint', label: 'Reglaze Rx + Tint', amountCad: '250', channels: ['reglaze'], optionCodes: ['reglaze_prescription_tint'] },
    { code: 'price_reglaze_prescription_polarized', label: 'Reglaze Rx Polarized', amountCad: '290', channels: ['reglaze'], optionCodes: ['reglaze_prescription_polarized'] },
    { code: 'price_reglaze_tint_no_rx', label: 'Reglaze Tint (no Rx)', amountCad: '125', channels: ['reglaze'], optionCodes: ['reglaze_tint_no_rx'] },
    { code: 'price_reglaze_polarized_no_rx', label: 'Reglaze Polarized (no Rx)', amountCad: '150', channels: ['reglaze'], optionCodes: ['reglaze_polarized_no_rx'] },
    { code: 'price_reglaze_prog_sun_polarized', label: 'Reglaze Prog Sun Polarized', amountCad: '490', channels: ['reglaze'], optionCodes: ['reglaze_progressive_sun_polarized'] },
    { code: 'price_reglaze_super_prog_polarized', label: 'Reglaze Super Prog Polarized', amountCad: '650', channels: ['reglaze'], optionCodes: ['reglaze_super_progressive_polarized'] },
    { code: 'price_reglaze_super_prog_tint', label: 'Reglaze Super Prog + Tint', amountCad: '600', channels: ['reglaze'], optionCodes: ['reglaze_super_progressive_tint'] },
  ];

  for (const p of prices) {
    await db.insert(priceRules).values({
      ...p,
      pricingType: p.pricingType ?? 'delta',
    }).onConflictDoNothing();
  }
  console.log(`  ${prices.length} price rules`);

  // ─── Constraint Rules ──────────────────────────────────
  const constraints = [
    // Optical finish states — mutual exclusion (each excludes all others)
    ...['clear', 'tint_prescription', 'polarized_prescription', 'transitions_optical', 'interior_tint'].map(src => ({
      code: `excl_optical_finish_${src}`,
      ruleType: 'excludes' as const,
      sourceOptionCode: src,
      targetOptionCodes: ['clear', 'tint_prescription', 'polarized_prescription', 'transitions_optical', 'interior_tint'].filter(c => c !== src),
    })),

    // Sun finish states — mutual exclusion
    ...['sun_standard', 'sun_polarized', 'sun_custom_dipped_tint', 'transitions_sun', 'interior_tint', 'tint_prescription', 'polarized_prescription'].map(src => ({
      code: `excl_sun_finish_${src}`,
      ruleType: 'excludes' as const,
      sourceOptionCode: src,
      targetOptionCodes: ['sun_standard', 'sun_polarized', 'sun_custom_dipped_tint', 'transitions_sun', 'interior_tint', 'tint_prescription', 'polarized_prescription'].filter(c => c !== src),
    })),

    // Lens paths — mutual exclusion (optical)
    ...['single_vision', 'progressive_premium', 'computer_degressive', 'super_progressive', 'anti_fatigue', 'non_prescription_clear'].map(src => ({
      code: `excl_optical_lens_${src}`,
      ruleType: 'excludes' as const,
      sourceOptionCode: src,
      targetOptionCodes: ['single_vision', 'progressive_premium', 'computer_degressive', 'super_progressive', 'anti_fatigue', 'non_prescription_clear'].filter(c => c !== src),
    })),

    // Blue light rules
    { code: 'excl_blue_light_mutual', ruleType: 'excludes' as const, sourceOptionCode: 'blue_light_rx', targetOptionCodes: ['blue_light_no_rx'] },
    { code: 'excl_blue_light_mutual_rev', ruleType: 'excludes' as const, sourceOptionCode: 'blue_light_no_rx', targetOptionCodes: ['blue_light_rx'] },
    { code: 'blue_light_rx_requires_rx_path', ruleType: 'allowed_only_with' as const, sourceOptionCode: 'blue_light_rx', targetOptionCodes: ['single_vision', 'progressive_premium', 'computer_degressive', 'super_progressive', 'anti_fatigue'] },
    { code: 'blue_light_no_rx_requires_clear', ruleType: 'allowed_only_with' as const, sourceOptionCode: 'blue_light_no_rx', targetOptionCodes: ['non_prescription_clear'] },

    // Material deferred until Rx
    { code: 'defer_material_no_rx', ruleType: 'defer_if_no_rx' as const, sourceOptionCode: 'index_160', targetOptionCodes: ['index_160', 'index_167', 'index_174'] },
  ];

  for (const c of constraints) {
    await db.insert(constraintRules).values(c).onConflictDoNothing();
  }
  console.log(`  ${constraints.length} constraint rules`);

  // ─── Step Definitions ──────────────────────────────────
  const steps = [
    // Optical
    { channel: 'optical' as const, code: 'optical_step_lens_path', label: 'Lens Type', sortOrder: 10, optionGroupCodes: ['lens_path'] },
    { channel: 'optical' as const, code: 'optical_step_finish_state', label: 'Lens Finish', sortOrder: 20, optionGroupCodes: ['finish_state'] },
    { channel: 'optical' as const, code: 'optical_step_treatments', label: 'Enhancements', sortOrder: 30, optionGroupCodes: ['optional_treatments'] },
    { channel: 'optical' as const, code: 'optical_step_summary', label: 'Summary', sortOrder: 40, optionGroupCodes: [] },
    // Sun
    { channel: 'sun' as const, code: 'sun_step_lens_path', label: 'Lens Type', sortOrder: 10, optionGroupCodes: ['lens_path'] },
    { channel: 'sun' as const, code: 'sun_step_finish_state', label: 'Lens Finish', sortOrder: 20, optionGroupCodes: ['finish_state'] },
    { channel: 'sun' as const, code: 'sun_step_summary', label: 'Summary', sortOrder: 30, optionGroupCodes: [] },
    // Reglaze
    { channel: 'reglaze' as const, code: 'reglaze_step_lens_path', label: 'Package', sortOrder: 10, optionGroupCodes: ['lens_path'] },
    { channel: 'reglaze' as const, code: 'reglaze_step_material', label: 'Material', sortOrder: 20, optionGroupCodes: ['material_index'] },
    { channel: 'reglaze' as const, code: 'reglaze_step_finish_state', label: 'Finish', sortOrder: 30, optionGroupCodes: ['finish_state'] },
    { channel: 'reglaze' as const, code: 'reglaze_step_summary', label: 'Summary', sortOrder: 40, optionGroupCodes: [] },
  ];

  for (const s of steps) {
    await db.insert(stepDefinitions).values(s).onConflictDoNothing();
  }
  console.log(`  ${steps.length} step definitions`);

  console.log('Done.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
