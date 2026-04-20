# Anthropic (Claude) — AI Features

**Purpose:** Powers AI segmentation suggestions, client style insights, and segment analysis.

## How It Works

The CRM sends aggregated (never individual PII) customer data to Claude for analysis. Claude returns structured JSON with segment suggestions, style insights, or explanations.

## AI-Powered Features

| Feature | Endpoint | Model | Purpose |
|---|---|---|---|
| Segment suggestions | `/api/crm/segments/ai-suggest` | claude-sonnet-4-20250514 | Suggest segments based on customer data |
| Segment analysis | `/api/crm/segments/[id]/ai-analyze` | claude-sonnet-4-20250514 | Analyze a segment's characteristics |
| Segment explanation | `/api/crm/segments/[id]/explain` | claude-sonnet-4-20250514 | Explain segment rules in plain English |
| AI Styler | `/api/crm/clients/[id]/ai-styler` | claude-sonnet-4-20250514 | Style insights for a client |

## Budget Control

AI usage is tracked and capped:

| File | Purpose |
|---|---|
| `src/lib/crm/ai-usage.ts` | `checkDailyBudget()`, `logAiRequest()` |
| `ai_requests` table | Logs every request with token counts and cost |

Daily budget prevents runaway costs. All requests are logged with user, endpoint, model, and token usage.

## Environment Variables

```env
ANTHROPIC_API_KEY=sk-ant-xxx
```

### Where to Find

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. API Keys → Create Key

## Production

Set `ANTHROPIC_API_KEY` in Vercel env vars. Monitor usage via the `ai_requests` table or Anthropic dashboard. Adjust daily budget in `ai-usage.ts` as needed.

## Privacy

- Only aggregated statistics are sent to Claude (counts, averages, distributions)
- No individual customer names, emails, or phone numbers
- System prompts explicitly instruct Claude to never reference individual PII
- All AI requests are auditable via the `ai_requests` table
 