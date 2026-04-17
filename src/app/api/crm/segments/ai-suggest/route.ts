import Anthropic from '@anthropic-ai/sdk';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { aggregateCustomerData } from '@/lib/crm/segment-aggregator';
import { logAiRequest, checkDailyBudget } from '@/lib/crm/ai-usage';
import { evaluateSegmentRules } from '@/lib/crm/segment-rules';

const AVAILABLE_FIELDS = ['order_count', 'total_spent', 'average_order_value', 'tags', 'membership_tier', 'accepts_marketing', 'sms_consent', 'days_since_last_order', 'last_order_date', 'days_since_created', 'created_at', 'face_shape', 'rx_on_file', 'home_location', 'interaction_count', 'postal_prefix', 'first_name', 'last_name', 'email'];

const SYSTEM_PROMPT = `You are a CRM analyst for Lunettiq, a luxury eyewear brand in Montreal. You analyze aggregated customer data (never individual PII) and suggest actionable customer segments.

Return JSON: { "segments": [ { "name": string, "description": string, "reasoning": string, "rules": { "logic": "and"|"or", "conditions": [{ "field": string, "operator": string, "value": string }] }, "estimatedPercent": number, "suggestedAction": string } ] }

Available fields: ${AVAILABLE_FIELDS.join(', ')}
Available operators: equals, not_equals, gt, lt, contains, in_last_n_days, tag_includes
Membership tiers (use value without member- prefix): essential, cult, vault
Return ONLY valid JSON, no markdown fences.`;

export const POST = handler(async (request) => {
  const session = await requireCrmAuth('org:segments:create');
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return jsonError('ANTHROPIC_API_KEY not configured', 500);

  if (!(await checkDailyBudget())) return jsonError('Daily AI budget reached', 429);

  const { goal, dateRange } = await request.json();
  const stats = await aggregateCustomerData(dateRange);

  const client = new Anthropic({ apiKey });
  let message;
  try {
    message = await client.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Sales aggregates:\n${JSON.stringify(stats, null, 2)}\n\n${goal ? `Goal: ${goal}` : 'Suggest the most valuable segments.'}` }],
    });
  } catch (err) {
    console.error('Anthropic API error:', err);
    return jsonError('AI service unavailable', 502);
  }

  await logAiRequest({ userId: session.userId, endpoint: 'ai-suggest', model: 'claude-sonnet-4-20250514', usage: message.usage });

  const text = message.content.filter(c => c.type === 'text').map(c => c.text).join('');
  let parsed;
  try {
    parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, ''));
  } catch {
    return jsonOk({ segments: [{ name: 'Parse error', description: text, rules: { logic: 'and', conditions: [] }, reasoning: 'Could not parse AI response' }] });
  }

  const segs = parsed.segments ?? parsed;
  // Validate fields + get actual counts
  const validated = [];
  for (const s of Array.isArray(segs) ? segs : []) {
    if (!s.rules?.conditions) continue;
    const valid = s.rules.conditions.every((c: any) => AVAILABLE_FIELDS.includes(c.field) || c.field === 'tags');
    if (!valid) continue;
    const count = await evaluateSegmentRules(s.rules);
    validated.push({ ...s, actualSize: count ?? 0 });
  }

  return jsonOk({ segments: validated, tokensUsed: message.usage });
});
