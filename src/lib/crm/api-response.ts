import { NextRequest, NextResponse } from 'next/server';

export interface ApiListResponse<T> {
  data: T[];
  meta: { total: number; limit: number; offset: number };
}

export interface ApiSingleResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  error: string;
  status: number;
}

export function jsonList<T>(data: T[], meta: { total: number; limit: number; offset: number }) {
  return NextResponse.json({ data, meta });
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error, status }, { status });
}

/** Wrap an API handler with error handling for auth throws */
export function withErrorHandler(handler: (req: NextRequest, ctx?: unknown) => Promise<NextResponse>) {
  return async (req: NextRequest, ctx?: unknown) => {
    try {
      return await handler(req, ctx);
    } catch (err: unknown) {
      if (err instanceof Error && 'status' in err) {
        const status = (err as Error & { status: number }).status;
        return NextResponse.json({ error: err.message, status }, { status });
      }
      console.error('CRM API error:', err);
      return NextResponse.json({ error: 'Internal server error', status: 500 }, { status: 500 });
    }
  };
}
