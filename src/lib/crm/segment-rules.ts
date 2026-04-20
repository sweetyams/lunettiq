import { db } from '@/lib/db';
import { customersProjection } from '@/lib/db/schema';
import { sql, type SQL } from 'drizzle-orm';

const FIELD_MAP: Record<string, SQL> = {
  order_count: sql`"order_count"`,
  total_spent: sql`"total_spent"::numeric`,
  first_name: sql`"first_name"`,
  last_name: sql`"last_name"`,
  email: sql`"email"`,
  phone: sql`"phone"`,
  days_since_last_order: sql`EXTRACT(DAY FROM now() - (SELECT max(created_at) FROM orders_projection WHERE shopify_customer_id = customers_projection.shopify_customer_id))`,
  last_order_date: sql`(SELECT max(created_at) FROM orders_projection WHERE shopify_customer_id = customers_projection.shopify_customer_id)`,
  days_since_created: sql`EXTRACT(DAY FROM now() - customers_projection.created_at)`,
  average_order_value: sql`(SELECT coalesce(avg(total_price::numeric), 0) FROM orders_projection WHERE shopify_customer_id = customers_projection.shopify_customer_id)`,
  interaction_count: sql`(SELECT count(*) FROM interactions WHERE shopify_customer_id = customers_projection.shopify_customer_id)`,
  face_shape: sql`metafields->'custom'->>'face_shape'`,
  rx_on_file: sql`metafields->'custom'->>'rx_on_file'`,
  home_location: sql`metafields->'custom'->>'home_location'`,
  postal_prefix: sql`LEFT(default_address->>'zip', 3)`,
  accepts_marketing: sql`"accepts_marketing"`,
  sms_consent: sql`"sms_consent"`,
  // Loyalty
  credit_balance: sql`(SELECT coalesce(sum(amount::numeric), 0) FROM credits_ledger WHERE shopify_customer_id = customers_projection.shopify_customer_id)`,
  membership_status: sql`metafields->'custom'->>'membership_status'`,
  member_since: sql`metafields->'custom'->>'member_since'`,
  is_member: sql`(tags && ARRAY['member-essential','member-cult','member-vault'])`,
};

export async function evaluateSegmentRules(rules: { logic: string; conditions: Array<{ field: string; operator: string; value: string }> }): Promise<number | null> {
  if (!rules?.conditions?.length) return 0;

  const clauses: SQL[] = [];
  for (const c of rules.conditions) {
    if (c.field === 'tags') { clauses.push(sql`${c.value} = ANY(tags)`); continue; }
    if (c.field === 'membership_tier') { clauses.push(sql`${'member-' + c.value} = ANY(tags)`); continue; }
    if (c.field === 'is_member') {
      const isMember = c.value === 'true';
      clauses.push(isMember ? sql`tags && ARRAY['member-essential','member-cult','member-vault']` : sql`NOT (tags && ARRAY['member-essential','member-cult','member-vault'])`);
      continue;
    }
    if (c.field === 'membership_status') {
      clauses.push(buildOp(sql`metafields->'custom'->>'membership_status'`, c.operator, c.value));
      continue;
    }
    if (c.field === 'created_at') { clauses.push(buildDateOp(sql`customers_projection.created_at`, c.operator, c.value)); continue; }
    if (c.field === 'last_order_date') { clauses.push(buildDateOp(FIELD_MAP.last_order_date, c.operator, c.value)); continue; }

    const col = FIELD_MAP[c.field];
    if (!col) return null;
    clauses.push(buildOp(col, c.operator, c.value));
  }

  const joined = rules.logic === 'or' ? sql.join(clauses, sql` OR `) : sql.join(clauses, sql` AND `);
  const result = await db.select({ count: sql<number>`count(*)` }).from(customersProjection).where(joined);
  return Number(result[0]?.count ?? 0);
}

export async function getSegmentMembers(rules: { logic: string; conditions: Array<{ field: string; operator: string; value: string }> }, limit = 50) {
  if (!rules?.conditions?.length) return [];

  const clauses: SQL[] = [];
  for (const c of rules.conditions) {
    if (c.field === 'tags') { clauses.push(sql`${c.value} = ANY(tags)`); continue; }
    if (c.field === 'membership_tier') { clauses.push(sql`${'member-' + c.value} = ANY(tags)`); continue; }
    if (c.field === 'is_member') {
      const isMember = c.value === 'true';
      clauses.push(isMember ? sql`tags && ARRAY['member-essential','member-cult','member-vault']` : sql`NOT (tags && ARRAY['member-essential','member-cult','member-vault'])`);
      continue;
    }
    if (c.field === 'membership_status') {
      clauses.push(buildOp(sql`metafields->'custom'->>'membership_status'`, c.operator, c.value));
      continue;
    }
    if (c.field === 'created_at') { clauses.push(buildDateOp(sql`customers_projection.created_at`, c.operator, c.value)); continue; }
    if (c.field === 'last_order_date') { clauses.push(buildDateOp(FIELD_MAP.last_order_date, c.operator, c.value)); continue; }
    const col = FIELD_MAP[c.field];
    if (!col) return [];
    clauses.push(buildOp(col, c.operator, c.value));
  }

  const joined = rules.logic === 'or' ? sql.join(clauses, sql` OR `) : sql.join(clauses, sql` AND `);
  return db.select().from(customersProjection).where(joined).limit(limit);
}

function buildOp(col: SQL, operator: string, value: string): SQL {
  switch (operator) {
    case 'equals': return sql`${col} = ${value}`;
    case 'not_equals': return sql`${col} != ${value}`;
    case 'contains': return sql`CAST(${col} AS text) ILIKE ${'%' + value + '%'}`;
    case 'gt': return sql`CAST(${col} AS numeric) > ${Number(value)}`;
    case 'lt': return sql`CAST(${col} AS numeric) < ${Number(value)}`;
    case 'in_last_n_days': return sql`${col} >= now() - make_interval(days => ${Number(value)})`;
    case 'tag_includes': return sql`${value} = ANY(tags)`;
    default: return sql`true`;
  }
}

function buildDateOp(col: SQL, operator: string, value: string): SQL {
  switch (operator) {
    case 'equals': return sql`${col}::date = ${value}::date`;
    case 'gt': return sql`${col} > ${value}::timestamp`;
    case 'lt': return sql`${col} < ${value}::timestamp`;
    case 'in_last_n_days': return sql`${col} >= now() - make_interval(days => ${Number(value)})`;
    default: return sql`true`;
  }
}
