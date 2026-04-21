import { db } from '@/lib/db';
import { locations } from '@/lib/db/schema';

let _cache: Map<string, string> | null = null;
let _cacheTime = 0;

/** Returns a map of location_id → display name. Cached 5 min. */
export async function getLocationNames(): Promise<Map<string, string>> {
  if (_cache && Date.now() - _cacheTime < 300_000) return _cache;
  const rows = await db.select({ id: locations.id, name: locations.name }).from(locations);
  _cache = new Map(rows.map(r => [r.id, r.name]));
  _cache.set('online', 'Online');
  _cacheTime = Date.now();
  return _cache;
}
