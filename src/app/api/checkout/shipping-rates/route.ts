import { NextRequest, NextResponse } from 'next/server';
import { getSetting } from '@/lib/crm/store-settings';

export interface ShippingRate {
  zone: 'CA' | 'US' | 'INTL';
  label: string;
  price: number;
  currency: string;
}

// ISO 3166-1 alpha-2 → zone
function countryToZone(countryCode: string): ShippingRate['zone'] {
  if (countryCode === 'CA') return 'CA';
  if (countryCode === 'US') return 'US';
  return 'INTL';
}

export async function POST(request: NextRequest) {
  try {
    const { countryCode, subtotal } = await request.json();
    if (!countryCode) {
      return NextResponse.json({ error: 'Missing countryCode' }, { status: 400 });
    }

    const [ratesJson, thresholdStr] = await Promise.all([
      getSetting('shipping_rates'),
      getSetting('shipping_free_threshold'),
    ]);

    const allRates: ShippingRate[] = JSON.parse(ratesJson);
    const freeThreshold = Number(thresholdStr);
    const zone = countryToZone(countryCode.toUpperCase());
    const zoneRates = allRates.filter((r) => r.zone === zone);

    // Free shipping if subtotal meets threshold (0 = disabled)
    if (freeThreshold > 0 && subtotal >= freeThreshold) {
      return NextResponse.json({
        rates: [{ label: 'Free Shipping', price: 0, currency: 'CAD' }],
      });
    }

    return NextResponse.json({ rates: zoneRates });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
