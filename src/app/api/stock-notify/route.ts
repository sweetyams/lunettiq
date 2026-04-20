import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { email, productId, variantTitle } = await request.json();
  if (!email || !productId) return NextResponse.json({ error: 'email and productId required' }, { status: 400 });

  // Fire Klaviyo event for back-in-stock flow
  const { fireKlaviyoEvent } = await import('@/lib/klaviyo/events');
  await fireKlaviyoEvent(email, 'Back In Stock Subscribe', { product_id: productId, variant_title: variantTitle });

  return NextResponse.json({ ok: true });
}
