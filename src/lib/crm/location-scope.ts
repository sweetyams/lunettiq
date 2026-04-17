import { inArray, type SQL, type Column } from 'drizzle-orm';
import type { CrmSession } from './auth';

export interface LocationScope {
  bypass: boolean;
  locationIds: string[];
  primaryLocationId: string | null;
}

export function getLocationScope(session: CrmSession): LocationScope {
  return {
    bypass: session.canViewAllLocations || session.bypassLocationScope,
    locationIds: session.locationIds,
    primaryLocationId: session.primaryLocationId,
  };
}

/**
 * Returns a SQL condition to filter by location, or undefined if the user bypasses scope.
 * Usage: db.select().from(table).where(and(otherConditions, applyLocationFilter(table.locationId, scope)))
 */
export function applyLocationFilter(
  locationColumn: Column,
  scope: LocationScope,
): SQL | undefined {
  if (scope.bypass) return undefined;
  if (scope.locationIds.length === 0) return undefined;
  return inArray(locationColumn, scope.locationIds);
}
