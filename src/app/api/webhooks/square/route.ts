import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { inngest } from '@/lib/inngest/client';

const SUPPORTED_EVENTS = [
  'order.created',
  'order.updated',
  'customer.created',
  'customer.updated',
  'payment.completed',
];

function verifySignature(body: string, signature: string, requestUrl: string): boolean {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key) { console.warn('[square-webhook] No signature key configured'); return false; }
  // Square HMAC uses the registered notification URL, not the proxied request URL
  const notificationUrl = process.env.SQUARE_WEBHOOK_URL || requestUrl;
  const hmac = createHmac('sha256', key).update(notificationUrl + body).digest('base64');
  return hmac === signature;
}

// GET — Square webhook URL validation (returns 200 so registration succeeds)
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-square-hmacsha256-signature') ?? '';
  const url = request.url;

  if (!verifySignature(body, signature, url)) {
    console.warn('[square-webhook] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(body); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = payload.type;
  if (!SUPPORTED_EVENTS.includes(eventType)) {
    return NextResponse.json({ ok: true, skipped: eventType });
  }

  const data = payload.data?.object ?? payload.data ?? {};

  console.log(`[square-webhook] ${eventType}`, JSON.stringify(data).slice(0, 200));

  // Route to Inngest
  if (eventType === 'order.created' || eventType === 'order.updated') {
    const orderId = data.order_created?.order_id ?? data.order_updated?.order_id ?? data.order?.id ?? data.id;
    const state = data.order_created?.state ?? data.order_updated?.state ?? data.order?.state;
    if (orderId && state !== 'OPEN') {
      await inngest.send({ name: 'square/order.synced', data: { orderId } });
    }
  } else if (eventType === 'customer.created' || eventType === 'customer.updated') {
    const customer = data.customer ?? data;
    await inngest.send({ name: 'square/customer.synced', data: { customer } });
  } else if (eventType === 'payment.completed') {
    const orderId = data.payment?.order_id ?? data.order_id;
    if (orderId) await inngest.send({ name: 'square/order.synced', data: { orderId } });
  }

  return NextResponse.json({ ok: true, event: eventType });
}
