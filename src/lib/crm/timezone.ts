/**
 * App-wide timezone config. Reads from store_settings.
 * Sync fallback for places that can't await.
 */
import { getTimezone } from './store-settings';

/** Default for sync contexts. Use getAppTimezone() when async is available. */
export const APP_TIMEZONE = 'America/Montreal';

/** Async timezone getter — reads from DB settings. */
export const getAppTimezone = getTimezone;
