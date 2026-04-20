export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are an optical prescription reader. Extract prescription values from the image of a prescription paper or label.

Return ONLY valid JSON with this exact structure:
{
  "success": true,
  "od": { "sphere": number|null, "cylinder": number|null, "axis": number|null, "add": number|null, "prismH": number|null, "baseH": "in"|"out"|null, "prismV": number|null, "baseV": "up"|"down"|null },
  "os": { "sphere": number|null, "cylinder": number|null, "axis": number|null, "add": number|null, "prismH": number|null, "baseH": "in"|"out"|null, "prismV": number|null, "baseV": "up"|"down"|null },
  "pd": number|null,
  "pdRight": number|null,
  "pdLeft": number|null,
  "prescriptionDate": "YYYY-MM-DD"|null,
  "prescriberName": "string"|null,
  "prescriberClinic": "string"|null,
  "expiryDate": "YYYY-MM-DD"|null,
  "notes": "string with any additional info or warnings",
  "confidence": "high"|"medium"|"low"
}

Rules:
- OD = right eye, OS = left eye
- Sphere (SPH): typically -20.00 to +20.00 in 0.25 steps
- Cylinder (CYL): typically -6.00 to +6.00 in 0.25 steps
- Axis: 1 to 180 degrees (integer)
- ADD: typically +0.75 to +3.50 in 0.25 steps
- PD: typically 54-74mm
- If a value is unclear or missing, use null
- Set confidence based on image quality and readability
- If the image is not a prescription, return { "success": false, "error": "description" }
- Extract the prescription date (date written, issued, or exam date) as YYYY-MM-DD
- Extract the prescriber/doctor name and clinic name if visible
- Extract the expiry date if printed on the prescription
- Look for prism values — they may be written as "prism" with a base direction (BI, BO, BU, BD)
- Return ONLY JSON, no markdown fences`;

export async function POST(request: NextRequest) {
  const { getKey } = await import('@/lib/crm/integration-keys');
    const apiKey = await getKey('ANTHROPIC_API_KEY');
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });

  const formData = await request.formData();
  const file = formData.get('image') as File | null;
  if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

  // Convert to base64
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString('base64');
  const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [{
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        }, {
          type: 'text',
          text: 'Read this prescription and extract all values.',
        }],
      }],
    });

    const text = message.content.filter(c => c.type === 'text').map(c => c.text).join('');
    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, ''));
    } catch {
      return NextResponse.json({ error: 'Could not parse AI response', raw: text }, { status: 422 });
    }

    return NextResponse.json({ data: parsed });
  } catch (err) {
    console.error('[prescription-scan] AI error:', err);
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 });
  }
}
