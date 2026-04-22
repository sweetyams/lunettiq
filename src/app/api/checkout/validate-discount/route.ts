import { NextRequest, NextResponse } from 'next/server';
import { graphqlAdmin } from '@/lib/shopify/admin-graphql';

/* ------------------------------------------------------------------ */
/*  Shopify discount lookup                                            */
/* ------------------------------------------------------------------ */

const DISCOUNT_QUERY = `
  query DiscountByCode($code: String!) {
    codeDiscountNodeByCode(code: $code) {
      id
      codeDiscount {
        ... on DiscountCodeBasic {
          title
          status
          startsAt
          endsAt
          usageLimit
          asyncUsageCount
          customerSelection { ... on DiscountCustomerAll { allCustomers } }
          customerGets {
            value {
              ... on DiscountPercentage { percentage }
              ... on DiscountAmount { amount { amount currencyCode } }
            }
          }
          minimumRequirement {
            ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount } }
            ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
          }
        }
        ... on DiscountCodeFreeShipping {
          title
          status
          startsAt
          endsAt
          usageLimit
          asyncUsageCount
          minimumRequirement {
            ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount } }
          }
        }
      }
    }
  }
`;

interface DiscountResult {
  codeDiscountNodeByCode: {
    id: string;
    codeDiscount: {
      title: string;
      status: string;
      startsAt: string;
      endsAt: string | null;
      usageLimit: number | null;
      asyncUsageCount: number;
      customerGets?: {
        value: { percentage?: number; amount?: { amount: string; currencyCode: string } };
      };
      minimumRequirement?: {
        greaterThanOrEqualToSubtotal?: { amount: string };
        greaterThanOrEqualToQuantity?: string;
      };
    };
  } | null;
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  try {
    const { code, subtotal } = await request.json();
    if (!code) {
      return NextResponse.json({ error: 'Missing discount code' }, { status: 400 });
    }

    const result = await graphqlAdmin<DiscountResult>(DISCOUNT_QUERY, { code: code.trim().toUpperCase() });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    const node = result.data.codeDiscountNodeByCode;
    if (!node) {
      return NextResponse.json({ valid: false, reason: 'Code not found' });
    }

    const d = node.codeDiscount;

    // Status check
    if (d.status !== 'ACTIVE') {
      return NextResponse.json({ valid: false, reason: 'Code is not active' });
    }

    // Date check
    const now = new Date();
    if (d.endsAt && new Date(d.endsAt) < now) {
      return NextResponse.json({ valid: false, reason: 'Code has expired' });
    }

    // Usage limit check
    if (d.usageLimit && d.asyncUsageCount >= d.usageLimit) {
      return NextResponse.json({ valid: false, reason: 'Code usage limit reached' });
    }

    // Minimum subtotal check
    const minSubtotal = d.minimumRequirement?.greaterThanOrEqualToSubtotal?.amount;
    if (minSubtotal && subtotal < Number(minSubtotal)) {
      return NextResponse.json({
        valid: false,
        reason: `Minimum subtotal of $${Number(minSubtotal).toFixed(2)} required`,
      });
    }

    // Determine discount value
    const customerGets = d.customerGets?.value;
    let type: 'percentage' | 'fixed_amount' | 'free_shipping';
    let value: number;

    if (customerGets?.percentage) {
      type = 'percentage';
      value = customerGets.percentage * 100; // Shopify returns 0.15 for 15%
    } else if (customerGets?.amount) {
      type = 'fixed_amount';
      value = Number(customerGets.amount.amount);
    } else {
      // Free shipping discount
      type = 'free_shipping';
      value = 0;
    }

    return NextResponse.json({
      valid: true,
      discount: {
        code: code.trim().toUpperCase(),
        title: d.title,
        type,
        value,
      },
    });
  } catch (err) {
    console.error('[checkout/validate-discount]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
