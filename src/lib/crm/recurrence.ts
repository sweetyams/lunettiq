/**
 * Lightweight RRULE expansion — supports the subset we need for appointments:
 *   FREQ=DAILY|WEEKLY|MONTHLY
 *   INTERVAL=n
 *   BYDAY=MO,TU,...
 *   COUNT=n | UNTIL=ISO-date
 *
 * No external dependencies.
 */

export interface ParsedRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  interval: number;
  byDay: number[] | null;   // 0=Sun … 6=Sat
  count: number | null;
  until: Date | null;
}

const DAY_MAP: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

export function parseRRule(rule: string): ParsedRule {
  const parts = rule.replace(/^RRULE:/, '').split(';');
  const map = Object.fromEntries(parts.map(p => p.split('='))) as Record<string, string>;

  return {
    freq: (map.FREQ ?? 'WEEKLY') as ParsedRule['freq'],
    interval: Number(map.INTERVAL ?? 1),
    byDay: map.BYDAY ? map.BYDAY.split(',').map(d => DAY_MAP[d.trim()]).filter(n => n !== undefined) : null,
    count: map.COUNT ? Number(map.COUNT) : null,
    until: map.UNTIL ? new Date(map.UNTIL.length === 8
      ? `${map.UNTIL.slice(0, 4)}-${map.UNTIL.slice(4, 6)}-${map.UNTIL.slice(6, 8)}`
      : map.UNTIL) : null,
  };
}

export function buildRRule(opts: { freq: string; interval?: number; byDay?: string[]; count?: number; until?: string }): string {
  const parts = [`FREQ=${opts.freq}`];
  if (opts.interval && opts.interval > 1) parts.push(`INTERVAL=${opts.interval}`);
  if (opts.byDay?.length) parts.push(`BYDAY=${opts.byDay.join(',')}`);
  if (opts.count) parts.push(`COUNT=${opts.count}`);
  else if (opts.until) parts.push(`UNTIL=${opts.until.replace(/[-:]/g, '').slice(0, 8)}`);
  return parts.join(';');
}

/**
 * Expand an RRULE starting from `dtStart` and return an array of occurrence dates.
 * Max 52 occurrences as a safety cap.
 */
export function expandRule(rule: string, dtStart: Date, maxOccurrences = 52): Date[] {
  const parsed = parseRRule(rule);
  const dates: Date[] = [new Date(dtStart)];
  const cursor = new Date(dtStart);
  const limit = parsed.count ?? maxOccurrences;

  for (let i = 1; i < limit; i++) {
    advance(cursor, parsed);

    if (parsed.until && cursor > parsed.until) break;
    if (dates.length >= maxOccurrences) break;

    // BYDAY filter for WEEKLY
    if (parsed.freq === 'WEEKLY' && parsed.byDay) {
      // When BYDAY is set, we need to emit all matching days in the week
      // For simplicity, advance day-by-day within the week
      if (!parsed.byDay.includes(cursor.getDay())) {
        i--; // don't count this as an occurrence
        continue;
      }
    }

    dates.push(new Date(cursor));
  }

  return dates;
}

function advance(cursor: Date, rule: ParsedRule) {
  switch (rule.freq) {
    case 'DAILY':
      cursor.setDate(cursor.getDate() + rule.interval);
      break;
    case 'WEEKLY':
      if (rule.byDay) {
        // Advance one day at a time; the caller filters by byDay
        cursor.setDate(cursor.getDate() + 1);
      } else {
        cursor.setDate(cursor.getDate() + 7 * rule.interval);
      }
      break;
    case 'MONTHLY':
      cursor.setMonth(cursor.getMonth() + rule.interval);
      break;
  }
}

/** Human-readable summary of an RRULE */
export function describeRule(rule: string): string {
  const p = parseRRule(rule);
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let desc = '';

  if (p.freq === 'DAILY') desc = p.interval === 1 ? 'Daily' : `Every ${p.interval} days`;
  else if (p.freq === 'WEEKLY') {
    desc = p.interval === 1 ? 'Weekly' : `Every ${p.interval} weeks`;
    if (p.byDay) desc += ` on ${p.byDay.map(d => DAY_NAMES[d]).join(', ')}`;
  } else if (p.freq === 'MONTHLY') {
    desc = p.interval === 1 ? 'Monthly' : `Every ${p.interval} months`;
  }

  if (p.count) desc += ` · ${p.count} times`;
  else if (p.until) desc += ` · until ${p.until.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return desc;
}
