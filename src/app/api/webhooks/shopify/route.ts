import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { inngest } from '@/lib/inngest/client';

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET!;

function verifyHmac(body: string, hmacHeader: string): boolean {
  const digest = crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(body, 'utf8')
    .digest('base64');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
}

const TOPIC_EVENT_MAP: Record<string, string> = {
  'customers/create': 'shopify/customer.updated',
  'customers/update': 'shopify/customer.updated',
  'customers/delete': 'shopify/customer.deleted',
  'orders/create': 'shopify/order.updated',
  'orders/updated': 'shopify/order.updated',
  'orders/cancelled': 'shopify/order.updated',
  'orders/fulfilled': 'shopify/order.updated',
  'products/create': 'shopify/product.updated',
  'products/update': 'shopify/product.updated',
  'products/delete': 'shopify/product.deleted',
  'collections/create': 'shopify/collection.updated',
  'collections/update': 'shopify/collection.updated',
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const hmac = request.headers.get('x-shopify-hmac-sha256');
  const topic = request.headers.get('x-shopify-topic');

  if (!hmac || !verifyHmac(rawBody, hmac)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const eventName = topic ? TOPIC_EVENT_MAP[topic] : null;
  if (!eventName) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const data = JSON.parse(rawBody);
  await inngest.send({ name: eventName, data });

  return NextResponse.json({ ok: true });
}
