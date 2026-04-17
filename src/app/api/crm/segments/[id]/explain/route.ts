export const dynamic = "force-dynamic";
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/lib/db';
import { segments } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq } from 'drizzle-orm';
import { logAiRequest, checkDailyBudget } from '@/lib/crm/ai-usage';

export const POST = handler(async (_request, ctx) => {
  const session = await requireCrmAuth('org:segments:read');
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return jsonError('ANTHROPIC_API_KEY not configured', 500);
  if (!(await checkDailyBudget())) return jsonError('Daily AI budget reached', 429);

  const segment = await db.select().from(segments).where(eq(segments.id, ctx.params.id)).then(r => r[0]);
  if (!segment) return jsonError('Segment not found', 404);

  const client = new Anthropic({ apiKey });
  let message;
  try {
    message = await client.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 1500,
      system: `You are a CRM analyst for Lunettiq, a luxury eyewear brand. Explain the given segment in plain language and suggest 2-3 refinements. Return JSON: { "explanation": string, "refinementSuggestions": [{ "description": string, "proposedChange": string }] }. Return ONLY valid JSON.`,
      messages: [{ role: 'user', content: `Segment: "${segment.name}"\nRules: ${JSON.stringify(segment.rules)}\nCurrent members: ${segment.memberCount}` }],
    });
  } catch (err) {
    console.error('Anthropic API error:', err);
    return jsonError('AI service unavailable', 502);
  }

  await logAiRequest({ userId: session.userId, endpoint: 'explain', model: 'claude-sonnet-4-20250514', usage: message.usage });

  const text = message.content.filter(c => c.type === 'text').map(c => c.text).join('');
  try {
    return jsonOk(JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '')));
  } catch {
    return jsonOk({ explanation: text, refinementSuggestions: [] });
  }
});
