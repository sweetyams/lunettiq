import { NextRequest, NextResponse } from 'next/server';
import { storefrontFetch } from '@/lib/shopify/storefront';
import { graphqlAdmin } from '@/lib/shopify/admin-graphql';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile } from '@/lib/shopify/customer';
import { db } from '@/lib/db';
import { configurationSnapshots } from '@/lib/db/schema';

/* ------------------------------------------------------------------ */
/*  Fetch cart from Storefront API                                     */
/* ------------------------------------------------------------------ */

const CART_QUERY = `
  query CartQuery($cartId: ID!) {
    cart(id: $cartId) {
      id
      lines(first: 100) {
        nodes {
          id
          quantity
          merchandise {
            ... on ProductVariant {
              id
              title
              price { amount currencyCode }
              product { title }
            }
          }
          attributes { key value }
          cost { totalAmount { amount currencyCode } }
        }
      }
    }
  }
`;

interface CartLine {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    price: { amount: string; currencyCode: string };
    product: { title: string };
  };
  attributes: { key: string; value: string }[];
  cost: { totalAmount: { amount: string; currencyCode: string } };
}

interface CartData {
  cart: { id: string; lines: { nodes: CartLine[] } } | null;
}

/* ------------------------------------------------------------------ */
/*  Draft Order creation mutation                                      */
/* ------------------------------------------------------------------ */

const DRAFT_ORDER_CREATE = `
  mutation DraftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        invoiceUrl
      }
      userErrors {
        field
        message
      }
    }
  }
`;

interface DraftOrderResult {
  draftOrderCreate: {
    draftOrder: { id: string; invoiceUrl: string } | null;
    userErrors: { field: string[]; message: string }[];
  };
}

/* ------------------------------------------------------------------ */
/*  Build draft order line items from cart                              */
/* ------------------------------------------------------------------ */

function buildLineItems(lines: CartLine[]) {
  return lines.map((line) => {
    const attrs = new Map(line.attributes.map((a) => [a.key, a.value]));
    const computedPrice = attrs.get('_totalConfigPrice');
    const variantPrice = parseFloat(line.merchandise.price.amount);

    // Visible config attributes for the invoice
    const customAttributes = line.attributes
      .filter((a) => a.key.startsWith('_') && !a.key.endsWith('Price') && !a.key.startsWith('_rx'))
      .filter((a) => a.value && a.value !== 'false' && a.value !== 'none' && a.value !== '')
      .map((a) => ({ key: a.key.replace(/^_/, ''), value: a.value }));

    const base = {
      variantId: line.merchandise.id,
      quantity: line.quantity,
      customAttributes,
    };

    // If computed price differs from variant price, apply per-line discount/markup
    if (computedPrice) {
      const computed = parseFloat(computedPrice);
      const diff = computed - variantPrice;

      if (Math.abs(diff) > 0.01) {
        // Use appliedDiscount for price reduction, or originalUnitPriceWithCurrency for increase
        if (diff < 0) {
          return {
            ...base,
            appliedDiscount: {
              title: 'Lens configuration',
              value: Math.abs(diff),
              valueType: 'FIXED_AMOUNT' as const,
            },
          };
        }
        // Price is higher (lens upgrades cost more than base frame)
        return {
          ...base,
          originalUnitPriceWithCurrency: {
            amount: computedPrice,
            currencyCode: line.merchandise.price.currencyCode,
          },
        };
      }
    }

    return base;
  });
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  try {
    const { cartId, discount } = await request.json();
    if (!cartId) {
      return NextResponse.json({ error: 'Missing cartId' }, { status: 400 });
    }

    // 1. Fetch cart from Storefront API
    const cartData = await storefrontFetch<CartData>(CART_QUERY, { cartId });
    if (!cartData.cart || cartData.cart.lines.nodes.length === 0) {
      return NextResponse.json({ error: 'Cart is empty or not found' }, { status: 400 });
    }

    // 2. Build draft order input
    const lineItems = buildLineItems(cartData.cart.lines.nodes);

    const input: Record<string, unknown> = {
      lineItems,
      visibleToCustomer: true,
    };

    // 3. Attach customer email if logged in (optional — guest checkout works without)
    try {
      const token = getAccessToken();
      if (token) {
        const profile = await getCustomerProfile(token);
        if (profile.email) input.email = profile.email;
      }
    } catch {
      // Guest checkout — no email, invoice page will collect it
    }

    // 4. Apply validated discount to draft order (order-level)
    if (discount?.type === 'percentage') {
      input.appliedDiscount = {
        title: discount.title || discount.code,
        value: discount.value,
        valueType: 'PERCENTAGE',
      };
    } else if (discount?.type === 'fixed_amount') {
      input.appliedDiscount = {
        title: discount.title || discount.code,
        value: discount.value,
        valueType: 'FIXED_AMOUNT',
      };
    }

    // 5. Create draft order via Admin API
    const result = await graphqlAdmin<DraftOrderResult>(DRAFT_ORDER_CREATE, { input });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    const { draftOrder, userErrors } = result.data.draftOrderCreate;
    if (userErrors.length > 0) {
      return NextResponse.json(
        { error: userErrors.map((e) => e.message).join(', ') },
        { status: 422 }
      );
    }

    if (!draftOrder) {
      return NextResponse.json({ error: 'Draft order creation failed' }, { status: 500 });
    }

    // 6. Save configuration snapshots for configured line items
    for (const line of cartData.cart.lines.nodes) {
      const attrs = new Map(line.attributes.map((a) => [a.key, a.value]));
      const lensType = attrs.get('_lensType');
      if (!lensType) continue; // skip non-configured items

      const channel = lensType.includes('sun') ? 'sun' as const : 'optical' as const;
      const pricingLines: Array<{ code: string; label: string; amountCad: number }> = [];
      const computedPrice = attrs.get('_totalConfigPrice');
      const lensUpgrade = attrs.get('_lensUpgradePrice');
      const coatingsPrice = attrs.get('_coatingsPrice');

      if (computedPrice) pricingLines.push({ code: 'total', label: 'Configured total', amountCad: Number(computedPrice) });
      if (lensUpgrade && Number(lensUpgrade) > 0) pricingLines.push({ code: 'lens_upgrade', label: 'Lens upgrade', amountCad: Number(lensUpgrade) });
      if (coatingsPrice && Number(coatingsPrice) > 0) pricingLines.push({ code: 'coatings', label: 'Coatings', amountCad: Number(coatingsPrice) });

      await db.insert(configurationSnapshots).values({
        channel,
        shopifyVariantId: line.merchandise.id,
        shopifyDraftOrderId: draftOrder.id,
        selectedLensPath: lensType,
        selectedMaterial: attrs.get('_lensIndex') || null,
        selectedFinishState: attrs.get('_sunTint') || null,
        selectedTreatments: (attrs.get('_coatings') || '').split(',').filter(Boolean),
        rxState: (attrs.get('_rxStatus') === 'none' ? 'none' : 'pending') as 'none' | 'pending',
        pricingLines,
        totalCad: computedPrice || '0',
      }).catch(() => {}); // non-blocking — don't fail checkout if snapshot fails
    }

    return NextResponse.json({
      invoiceUrl: draftOrder.invoiceUrl,
      draftOrderId: draftOrder.id,
    });
  } catch (err) {
    console.error('[checkout/create]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
