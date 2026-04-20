export const dynamic = "force-dynamic";
// Anthropic SDK loaded dynamically when key is available
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { logAiRequest, checkDailyBudget } from '@/lib/crm/ai-usage';

export const POST = handler(async (request) => {
  const session = await requireCrmAuth('org:reports:read');
  const { getKey } = await import('@/lib/crm/integration-keys');
    const apiKey = await getKey('ANTHROPIC_API_KEY');
  if (!apiKey) return jsonError('ANTHROPIC_API_KEY not configured', 500);
  if (!(await checkDailyBudget())) return jsonError('Daily AI budget reached', 429);

  const { salesData } = await request.json();

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const claude = new Anthropic({ apiKey });
  const message = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    system: `You are a retail analytics expert for Lunettiq, a premium eyewear brand in Montreal with 2 physical stores (Notre-Dame O. and St-Viateur O.) and an online Shopify store. Store hours are 10am-5pm Tue-Sat, 11am-5pm Sun, closed Mon.

Analyze the sales data provided. Be specific — use exact numbers, percentages, comparisons. No generic advice.

Focus on:
- Revenue trends and anomalies
- Channel performance (Square POS vs Shopify online)
- Location comparison (which store performs better and why)
- Product mix insights (what sells, what doesn't)
- Customer behavior (repeat rate, AOV differences)
- Staffing implications from peak hours
- Actionable next steps the owner can take this week

Return JSON:
{
  "summary": "3-4 sentence executive summary with key numbers",
  "insights": ["specific insight with numbers", "comparison insight", "trend insight", "customer insight", "operational insight"],
  "recommendations": ["specific action this week", "pricing/product action", "staffing/ops action", "marketing action"]
}`,
    messages: [{ role: 'user', content: JSON.stringify(salesData) }],
  });

  await logAiRequest({ userId: session.userId, endpoint: 'sales-ai', model: 'claude-haiku-4-5-20251001', usage: message.usage });

  const text = message.content.filter(c => c.type === 'text').map(c => c.text).join('');
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return jsonOk(JSON.parse(jsonMatch[0]));
    return jsonOk({ summary: text, insights: [], recommendations: [] });
  } catch {
    return jsonOk({ summary: text, insights: [], recommendations: [] });
  }
});
