export const dynamic = "force-dynamic";
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/lib/db';
import { customersProjection, ordersProjection, interactions, productFeedback } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { logAiRequest, checkDailyBudget } from '@/lib/crm/ai-usage';
import { eq, desc } from 'drizzle-orm';

export const POST = handler(async (request, ctx) => {
  const session = await requireCrmAuth('org:recs:read');
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return jsonError('ANTHROPIC_API_KEY not configured', 500);
  if (!(await checkDailyBudget())) return jsonError('Daily AI budget reached', 429);

  const customerId = ctx.params.id;
  const { context } = await request.json();

  const [client, recentOrders, recentNotes, fb] = await Promise.all([
    db.select().from(customersProjection).where(eq(customersProjection.shopifyCustomerId, customerId)).then(r => r[0]),
    db.select().from(ordersProjection).where(eq(ordersProjection.shopifyCustomerId, customerId)).orderBy(desc(ordersProjection.createdAt)).limit(5),
    db.select().from(interactions).where(eq(interactions.shopifyCustomerId, customerId)).orderBy(desc(interactions.occurredAt)).limit(5),
    db.select().from(productFeedback).where(eq(productFeedback.shopifyCustomerId, customerId)),
  ]);

  if (!client) return jsonError('Client not found', 404);

  const meta = (client.metafields ?? {}) as any;
  const custom = meta?.custom ?? {};
  const summary = {
    name: `${client.firstName} ${client.lastName}`, tier: client.tags?.find((t: string) => t.startsWith('member-'))?.replace('member-', '') ?? 'none',
    ltv: client.totalSpent, orderCount: client.orderCount, pronouns: custom.pronouns,
    preferences: custom.preferences_json ? JSON.parse(custom.preferences_json) : {},
    faceShape: custom.face_shape, recentOrders: recentOrders.map(o => ({ number: o.orderNumber, total: o.totalPrice, date: o.createdAt })),
    recentNotes: recentNotes.map(n => ({ body: n.body?.slice(0, 200), date: n.occurredAt })),
    loved: fb.filter(f => f.sentiment === 'love' || f.sentiment === 'like').length,
    disliked: fb.filter(f => f.sentiment === 'dislike').length,
  };

  const claude = new Anthropic({ apiKey });
  let message;
  try {
    message = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 600,
      system: `You are a luxury eyewear stylist AI for Lunettiq, a Montreal brand. You give concise, warm, insight-driven observations about clients. Reference specific products/orders/patterns. Suggest 3-4 short actionable chips. Return JSON: { "thought": string, "chips": string[] }. Be specific and personal, not generic. Max 3 sentences for thought.`,
      messages: [{ role: 'user', content: context ? `Client: ${JSON.stringify(summary)}\n\nQuestion: ${context}` : `Client: ${JSON.stringify(summary)}\n\nGive me a quick read on this client.` }],
    });
  } catch (err) {
    console.error('AI Styler error:', err);
    return jsonError('AI unavailable', 502);
  }

  await logAiRequest({ userId: session.userId, endpoint: 'ai-styler', model: 'claude-haiku-4-5-20251001', usage: message.usage });

  const text = message.content.filter(c => c.type === 'text').map(c => c.text).join('');
  try {
    return jsonOk(JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '')));
  } catch {
    return jsonOk({ thought: text, chips: [] });
  }
});
