export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';

// Redirect to the CRM-authenticated status endpoint
export async function GET() {
  return NextResponse.redirect(new URL('/api/crm/system/status'), 308);
}
