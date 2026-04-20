export const dynamic = "force-dynamic";
import Anthropic from '@anthropic-ai/sdk';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { aggregateCustomerData } from '@/lib/crm/segment-aggregator';
import { logAiRequest, checkDailyBudget } from '@/lib/crm/ai-usage';

const SYSTEM_PROMPT = `You are a CRM analyst for Lunettiq, a luxury eyewear brand in Montreal. Analyze the customer data and provide actionable insights.

Return JSON: { "insights": [ { "title": string, "description": string, "action": string, "segmentRules": { "logic": "and"|"or", "conditions": [{ "field": string, "operator": string, "value": string }] } | null } ] }

Available fields: order_count, total_spent, tags, accepts_marketing, sms_consent, days_since_last_order, membership_tier, face_shape, interaction_count
Available operators: equals, gt, lt, contains, tag_includes
Return ONLY valid JSON, no markdown.`;

export const POST = handler(async (request) => {
  const session = await requireCrmAuth('org:segments:read');
  const { getKey } = await import('@/lib/crm/integration-keys');
    const apiKey = await getKey('ANTHROPIC_API_KEY');
  if (!apiKey) return jsonError('ANTHROPIC_API_KEY not configured', 500);

  if (!(await checkDailyBudget())) return jsonError('Daily AI budget reached', 429);

  const body = await request.json();
  const stats = await aggregateCustomerData(body.dateRange);

  const client = new Anthropic({ apiKey });
  let message;
  try {
    message = await client.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Analyze this customer data for a luxury eyewear brand:\n\n${JSON.stringify(stats, null, 2)}` }],
    });
  } catch (err) {
    console.error('Anthropic API error:', err);
    return jsonError('AI service unavailable', 502);
  }

  await logAiRequest({ userId: session.userId, endpoint: 'ai-analyze', model: 'claude-sonnet-4-20250514', usage: message.usage });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  try {
    const parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, ''));
    return jsonOk(parsed.insights ?? parsed);
  } catch {
    return jsonOk([{ title: 'Analysis', description: text, action: '', segmentRules: null }]);
  }
});
