import type { CartLineAttribute } from '@/types/shopify';

/**
 * Serialize flow builder selections into cart data.
 * Choice types drive behaviour: standard → attribute, product → separate line, colour → colour attribute, content → ignored.
 */

interface FlowGroup { id: string; code: string; label: string; selectionMode: string }
interface FlowPlacement { id: string; groupId: string; choiceId: string }
interface FlowChoice { id: string; code: string; label: string; choiceType: string | null; shopifyProductId: string | null; lensColourSetId: string | null }
interface LensColour { id: string; code: string; label: string; price: string }
interface PriceLine { code: string; label: string; amount: number }

export interface CartResult {
  attributes: CartLineAttribute[];
  addonLines: { variantId: string; quantity: number; attributes: CartLineAttribute[] }[];
  pricingLines: PriceLine[];
}

export function serializeFlowSelections(
  selections: Record<string, Set<string>>,
  groups: FlowGroup[],
  placements: FlowPlacement[],
  choices: Map<string, FlowChoice>,
  priceRules: { ownerId: string; amount: string | null; label: string | null }[],
  lensColours: Record<string, LensColour[]>,
  colourSelections?: Record<string, Set<string>>,
): CartResult {
  const attributes: CartLineAttribute[] = [];
  const addonLines: CartResult['addonLines'] = [];
  const pricingLines: PriceLine[] = [];
  const priceMap = new Map(priceRules.map(r => [r.ownerId, r]));

  for (const group of groups) {
    const selected = selections[group.id];
    if (!selected?.size) continue;
    const standardCodes: string[] = [];

    for (const plId of Array.from(selected)) {
      const pl = placements.find(p => p.id === plId);
      if (!pl) continue;
      const choice = choices.get(pl.choiceId);
      if (!choice) continue;
      const cType = choice.choiceType || 'standard';

      if (cType === 'content') continue;

      if (cType === 'product') {
        if (!choice.shopifyProductId) continue;
        const gid = choice.shopifyProductId.startsWith('gid://') ? choice.shopifyProductId : `gid://shopify/ProductVariant/${choice.shopifyProductId}`;
        addonLines.push({ variantId: gid, quantity: 1, attributes: [{ key: '_addon', value: 'true' }, { key: '_addonLabel', value: choice.label }] });
        continue;
      }

      if (cType === 'colour') {
        const colourSelKey = `${group.id}:${plId}:colour`;
        const colourId = colourSelections?.[colourSelKey]?.values().next().value as string | undefined;
        const setColours = lensColours[choice.lensColourSetId ?? ''] ?? [];
        const colour = colourId ? setColours.find(c => c.id === colourId) : null;
        attributes.push({ key: `_${group.code}`, value: choice.code });
        if (colour) {
          attributes.push({ key: `_${group.code}_colour`, value: colour.code });
          attributes.push({ key: `_${group.code}_colour_label`, value: colour.label });
          if (Number(colour.price) > 0) pricingLines.push({ code: colour.code, label: `${choice.label}: ${colour.label}`, amount: Number(colour.price) });
        }
        continue;
      }

      // Standard
      standardCodes.push(choice.code);
      const rule = priceMap.get(plId);
      if (rule && Number(rule.amount) > 0) pricingLines.push({ code: choice.code, label: rule.label || choice.label, amount: Number(rule.amount) });
    }

    if (standardCodes.length) attributes.push({ key: `_${group.code}`, value: standardCodes.join(',') });
  }

  return { attributes, addonLines, pricingLines };
}
