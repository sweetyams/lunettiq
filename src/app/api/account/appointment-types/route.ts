export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appointmentTypes } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

export async function GET() {
  const rows = await db.select().from(appointmentTypes)
    .where(eq(appointmentTypes.active, true))
    .orderBy(asc(appointmentTypes.sortOrder));
  return NextResponse.json({ data: rows });
}
