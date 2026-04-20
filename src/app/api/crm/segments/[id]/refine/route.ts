export const dynamic = "force-dynamic";
// Anthropic SDK loaded dynamically when key is available
import { db } from '@/lib/db';
import { segments } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq } from 'drizzle-orm';
import { logAiRequest, checkDailyBudget } from '@/lib/crm/ai-usage';
import { evaluateSegmentRules } from '@/lib/crm/segment-rules';

const AVAILABLE_FIELDS = ['order_count', 'total_spent', 'average_order_value', 'tags', 'membership_tier', 'accepts_marketing', 'sms_consent', 'days_since_last_order', 'last_order_date', 'days_since_created', 'created_at', 'face_shape', 'rx_on_file', 'home_location', 'interaction_count', 'postal_prefix'];

export const POST = handler(async (request, ctx) => {
  const session = await requireCrmAuth('org:segments:update');
  const { getKey } = await import('@/lib/crm/integration-keys');
    const apiKey = await getKey('ANTHROPIC_API_KEY');
  if (!apiKey) return jsonError('ANTHROPIC_API_KEY not configured', 500);
  if (!(await checkDailyBudget())) return jsonError('Daily AI budget reached', 429);

  const segment = await db.select().from(segments).where(eq(segments.id, ctx.params.id)).then(r => r[0]);
  if (!segment) return jsonError('Segment not found', 404);

  const { instruction } = await request.json();
  if (!instruction) return jsonError('instruction required', 400);

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
  let message;
  try {
    message = await client.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 1500,
      system: `You modify CRM segment rules based on user instructions. Available fields: ${AVAILABLE_FIELDS.join(', ')}. Operators: equals, not_equals, gt, lt, contains, in_last_n_days, tag_includes. Membership tiers: essential, cult, vault. Return JSON: { "rules": { "logic": "and"|"or", "conditions": [{ "field": string, "operator": string, "value": string }] }, "changeDescription": string }. Return ONLY valid JSON.`,
      messages: [{ role: 'user', content: `Current rules: ${JSON.stringify(segment.rules)}\n\nInstruction: ${instruction}` }],
    });
  } catch (err) {
    console.error('Anthropic API error:', err);
    return jsonError('AI service unavailable', 502);
  }

  await logAiRequest({ userId: session.userId, endpoint: 'refine', model: 'claude-sonnet-4-20250514', usage: message.usage });

  const text = message.content.filter(c => c.type === 'text').map(c => c.text).join('');
  try {
    const parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, ''));
    const newSize = await evaluateSegmentRules(parsed.rules);
    return jsonOk({ proposedRules: parsed.rules, changeDescription: parsed.changeDescription, newSize: newSize ?? 0, currentSize: segment.memberCount });
  } catch {
    return jsonError('Could not parse AI response', 502);
  }
});
