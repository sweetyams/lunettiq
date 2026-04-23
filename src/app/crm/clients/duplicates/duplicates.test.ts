import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ────────────────────────────────────────────────

const mockDb = {
  update: vi.fn(),
};
const mockWhere = vi.fn();
const mockSet = vi.fn();
const mockReturning = vi.fn();

function chainUpdate(rows: unknown[]) {
  mockDb.update.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ returning: mockReturning });
  mockReturning.mockResolvedValue(rows);
}

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/schema', () => ({
  duplicateCandidates: {
    id: 'id', clientA: 'client_a', clientB: 'client_b',
    matchReason: 'match_reason', confidence: 'confidence',
    status: 'status', createdAt: 'created_at',
  },
  customersProjection: {
    shopifyCustomerId: 'shopify_customer_id', email: 'email', phone: 'phone',
    firstName: 'first_name', lastName: 'last_name',
    orderCount: 'order_count', totalSpent: 'total_spent', tags: 'tags',
  },
}));
vi.mock('@/lib/crm/auth', () => ({
  requireCrmAuth: vi.fn().mockResolvedValue({ userId: 'staff-1', role: 'owner', locationIds: ['loc-1'] }),
  requirePermission: vi.fn().mockResolvedValue({ userId: 'staff-1', role: 'owner', locationIds: ['loc-1'] }),
}));

// ── Scan logic (unit-testable without DB) ────────────────

describe('Duplicate scan logic', () => {
  interface Customer {
    id: string; email: string | null; phone: string | null;
    firstName: string | null; lastName: string | null; tags: string[] | null;
  }

  function runScan(customers: Customer[], existingPairs: Set<string> = new Set()) {
    const isMerged = (tags: string[] | null) => (tags ?? []).some(t => t.startsWith('merged-into-'));
    const active = customers.filter(c => !isMerged(c.tags));
    const pairSet = new Set(existingPairs);
    const toInsert: { clientA: string; clientB: string; matchReason: string; confidence: string }[] = [];

    function addPairs(ids: string[], matchReason: string, confidence: string) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const pair = [ids[i], ids[j]].sort().join('|');
          if (!pairSet.has(pair)) { pairSet.add(pair); toInsert.push({ clientA: ids[i], clientB: ids[j], matchReason, confidence }); }
        }
      }
    }

    const byEmail = new Map<string, string[]>();
    for (const c of active) {
      if (!c.email) continue;
      const key = c.email.toLowerCase().trim();
      if (!byEmail.has(key)) byEmail.set(key, []);
      byEmail.get(key)!.push(c.id);
    }
    for (const ids of Array.from(byEmail.values())) { if (ids.length >= 2) addPairs(ids, 'exact_email', '0.95'); }

    const byPhone = new Map<string, string[]>();
    for (const c of active) {
      if (!c.phone) continue;
      const key = c.phone.replace(/\D/g, '');
      if (!key) continue;
      if (!byPhone.has(key)) byPhone.set(key, []);
      byPhone.get(key)!.push(c.id);
    }
    for (const ids of Array.from(byPhone.values())) { if (ids.length >= 2) addPairs(ids, 'exact_phone', '0.90'); }

    const norm = (s: string | null) => (s ?? '').toLowerCase().replace(/[^a-z]/g, '');
    const byName = new Map<string, string[]>();
    for (const c of active) {
      const key = norm(c.firstName) + '|' + norm(c.lastName);
      if (!key || key === '|') continue;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key)!.push(c.id);
    }
    for (const ids of Array.from(byName.values())) { if (ids.length >= 2) addPairs(ids, 'exact_name', '0.80'); }

    return { active, toInsert };
  }

  it('detects exact email duplicates', () => {
    const { toInsert } = runScan([
      { id: 'c1', email: 'alice@test.com', phone: null, firstName: 'Alice', lastName: 'A', tags: null },
      { id: 'c2', email: 'alice@test.com', phone: null, firstName: 'Bob', lastName: 'B', tags: null },
    ]);
    expect(toInsert).toHaveLength(1);
    expect(toInsert[0]).toMatchObject({ matchReason: 'exact_email', confidence: '0.95' });
  });

  it('detects exact phone duplicates (ignoring formatting)', () => {
    const { toInsert } = runScan([
      { id: 'c1', email: null, phone: '+1 (514) 555-1234', firstName: 'A', lastName: 'X', tags: null },
      { id: 'c2', email: null, phone: '15145551234', firstName: 'B', lastName: 'Y', tags: null },
    ]);
    expect(toInsert).toHaveLength(1);
    expect(toInsert[0]).toMatchObject({ matchReason: 'exact_phone', confidence: '0.90' });
  });

  it('detects exact name duplicates (normalized)', () => {
    const { toInsert } = runScan([
      { id: 'c1', email: 'a@a.com', phone: null, firstName: 'Jean-Pierre', lastName: "O'Brien", tags: null },
      { id: 'c2', email: 'b@b.com', phone: null, firstName: 'jeanpierre', lastName: 'obrien', tags: null },
    ]);
    const nameMatch = toInsert.find(p => p.matchReason === 'exact_name');
    expect(nameMatch).toBeDefined();
    expect(nameMatch!.confidence).toBe('0.80');
  });

  it('skips merged clients', () => {
    const { active } = runScan([
      { id: 'c1', email: 'same@test.com', phone: null, firstName: 'A', lastName: 'B', tags: ['merged-into-c3'] },
      { id: 'c2', email: 'same@test.com', phone: null, firstName: 'A', lastName: 'B', tags: null },
    ]);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('c2');
  });

  it('skips existing pending/merged pairs', () => {
    const existing = new Set(['c1|c2']);
    const { toInsert } = runScan([
      { id: 'c1', email: 'same@test.com', phone: null, firstName: 'A', lastName: 'X', tags: null },
      { id: 'c2', email: 'same@test.com', phone: null, firstName: 'B', lastName: 'Y', tags: null },
    ], existing);
    expect(toInsert).toHaveLength(0);
  });

  it('handles multiple match reasons for same pair', () => {
    const { toInsert } = runScan([
      { id: 'c1', email: 'same@test.com', phone: '5551234', firstName: 'Alice', lastName: 'Smith', tags: null },
      { id: 'c2', email: 'same@test.com', phone: '5551234', firstName: 'Alice', lastName: 'Smith', tags: null },
    ]);
    // First match (email) creates the pair, subsequent matches skip it
    expect(toInsert).toHaveLength(1);
    expect(toInsert[0].matchReason).toBe('exact_email');
  });

  it('returns empty when no duplicates', () => {
    const { toInsert } = runScan([
      { id: 'c1', email: 'a@test.com', phone: '111', firstName: 'Alice', lastName: 'A', tags: null },
      { id: 'c2', email: 'b@test.com', phone: '222', firstName: 'Bob', lastName: 'B', tags: null },
    ]);
    expect(toInsert).toHaveLength(0);
  });

  it('handles null email/phone/name gracefully', () => {
    const { toInsert } = runScan([
      { id: 'c1', email: null, phone: null, firstName: null, lastName: null, tags: null },
      { id: 'c2', email: null, phone: null, firstName: null, lastName: null, tags: null },
    ]);
    expect(toInsert).toHaveLength(0);
  });

  it('normalizes email case and whitespace', () => {
    const { toInsert } = runScan([
      { id: 'c1', email: '  Alice@Test.COM  ', phone: null, firstName: 'A', lastName: 'X', tags: null },
      { id: 'c2', email: 'alice@test.com', phone: null, firstName: 'B', lastName: 'Y', tags: null },
    ]);
    expect(toInsert).toHaveLength(1);
    expect(toInsert[0].matchReason).toBe('exact_email');
  });

  it('generates consistent pair keys regardless of order', () => {
    // Run with same pair in different input order — both should produce exactly 1 pair
    const { toInsert: r1 } = runScan([
      { id: 'z-client', email: 'same@test.com', phone: null, firstName: 'A', lastName: 'X', tags: null },
      { id: 'a-client', email: 'same@test.com', phone: null, firstName: 'B', lastName: 'Y', tags: null },
    ]);
    const { toInsert: r2 } = runScan([
      { id: 'a-client', email: 'same@test.com', phone: null, firstName: 'B', lastName: 'Y', tags: null },
      { id: 'z-client', email: 'same@test.com', phone: null, firstName: 'A', lastName: 'X', tags: null },
    ]);
    expect(r1).toHaveLength(1);
    expect(r2).toHaveLength(1);
    // Both should reference the same two clients
    const ids1 = [r1[0].clientA, r1[0].clientB].sort();
    const ids2 = [r2[0].clientA, r2[0].clientB].sort();
    expect(ids1).toEqual(ids2);
  });
});

// ── GET /api/crm/clients/duplicates — enrichment logic ───

describe('Pair enrichment', () => {
  it('maps client data onto pairs', () => {
    const rows = [
      { id: 'dup-1', clientA: 'c1', clientB: 'c2', matchReason: 'exact_email', confidence: '0.95' },
    ];
    const clients = [
      { id: 'c1', firstName: 'Alice', lastName: 'A', email: 'a@test.com', phone: null, orderCount: 5, totalSpent: '500.00', tags: [] },
      { id: 'c2', firstName: 'Bob', lastName: 'B', email: 'a@test.com', phone: null, orderCount: 1, totalSpent: '50.00', tags: [] },
    ];
    const clientMap = new Map(clients.map(c => [c.id, c]));
    const pairs = rows.map(r => ({
      id: r.id,
      matchReason: r.matchReason,
      confidence: r.confidence,
      clientA: clientMap.get(r.clientA) ?? { id: r.clientA },
      clientB: clientMap.get(r.clientB) ?? { id: r.clientB },
    }));

    expect(pairs).toHaveLength(1);
    expect(pairs[0].clientA).toMatchObject({ firstName: 'Alice' });
    expect(pairs[0].clientB).toMatchObject({ firstName: 'Bob' });
  });

  it('falls back to id-only when client not in map', () => {
    const rows = [{ id: 'dup-1', clientA: 'c1', clientB: 'c-gone', matchReason: 'exact_name', confidence: '0.80' }];
    const clients = [{ id: 'c1', firstName: 'Alice', lastName: 'A', email: 'a@test.com', phone: null, orderCount: 1, totalSpent: '10.00', tags: [] }];
    const clientMap = new Map(clients.map(c => [c.id, c]));
    const pairs = rows.map(r => ({
      id: r.id,
      clientA: clientMap.get(r.clientA) ?? { id: r.clientA },
      clientB: clientMap.get(r.clientB) ?? { id: r.clientB },
    }));

    expect(pairs[0].clientA).toHaveProperty('firstName', 'Alice');
    expect(pairs[0].clientB).toEqual({ id: 'c-gone' });
  });
});

// ── POST /api/crm/clients/duplicates/[id]/dismiss ───────

describe('POST /api/crm/clients/duplicates/[id]/dismiss', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/crm/clients/duplicates/[id]/dismiss/route');
    POST = mod.POST;
  });

  it('dismisses a candidate and returns it', async () => {
    const updated = { id: 'dup-1', status: 'dismissed' };
    chainUpdate([updated]);

    const res = await POST(
      new NextRequest('http://localhost/api/crm/clients/duplicates/dup-1/dismiss', { method: 'POST' }),
      { params: Promise.resolve({ id: 'dup-1' }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.status).toBe('dismissed');
  });

  it('returns 404 when candidate not found', async () => {
    chainUpdate([]);

    const res = await POST(
      new NextRequest('http://localhost/api/crm/clients/duplicates/bad-id/dismiss', { method: 'POST' }),
      { params: Promise.resolve({ id: 'bad-id' }) },
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Candidate not found');
  });
});

// ── Primary selection (UI logic) ─────────────────────────

describe('Merge primary selection', () => {
  function selectPrimary(a: { totalSpent: string | null }, b: { totalSpent: string | null }) {
    const ltvA = Number(a.totalSpent ?? 0);
    const ltvB = Number(b.totalSpent ?? 0);
    return ltvA >= ltvB ? 'a' : 'b';
  }

  it('picks higher LTV as primary', () => {
    expect(selectPrimary({ totalSpent: '500.00' }, { totalSpent: '50.00' })).toBe('a');
    expect(selectPrimary({ totalSpent: '10.00' }, { totalSpent: '999.00' })).toBe('b');
  });

  it('picks A when LTV is equal', () => {
    expect(selectPrimary({ totalSpent: '100.00' }, { totalSpent: '100.00' })).toBe('a');
  });

  it('handles null totalSpent', () => {
    expect(selectPrimary({ totalSpent: null }, { totalSpent: '50.00' })).toBe('b');
    expect(selectPrimary({ totalSpent: '50.00' }, { totalSpent: null })).toBe('a');
    expect(selectPrimary({ totalSpent: null }, { totalSpent: null })).toBe('a');
  });
});
