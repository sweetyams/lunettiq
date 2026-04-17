import { db } from '@/lib/db';
import { aiRequests } from '@/lib/db/schema';
import { sql, gte } from 'drizzle-orm';

const COST_PER_1K: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 0.3, output: 1.5 },
  'claude-haiku-4-5-20251001': { input: 0.08, output: 0.4 },
};

export async function logAiRequest(params: {
  userId: string;
  endpoint: string;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}) {
  const rates = COST_PER_1K[params.model] ?? { input: 0.3, output: 1.5 };
  const cost = Math.ceil(
    (params.usage.input_tokens / 1000) * rates.input +
    (params.usage.output_tokens / 1000) * rates.output
  );

  await db.insert(aiRequests).values({
    userId: params.userId,
    endpoint: params.endpoint,
    model: params.model,
    inputTokens: params.usage.input_tokens,
    outputTokens: params.usage.output_tokens,
    costEstimateCents: cost,
  });
}

const DAILY_CAP = 200;

export async function checkDailyBudget(): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [result] = await db.select({ count: sql<number>`count(*)` })
    .from(aiRequests).where(gte(aiRequests.requestedAt, today));
  return Number(result?.count ?? 0) < DAILY_CAP;
}
