/**
 * CRM Permission system — single source of truth.
 * Clerk free tier doesn't support custom permissions, so we enforce in app code.
 * Roles come from user.publicMetadata.role.
 * Permission keys: org:<feature>:<action>
 */

export const CRM_ROLES = ['owner', 'manager', 'optician', 'sa', 'read_only'] as const;
export type CrmRole = (typeof CRM_ROLES)[number];

export const FUTURE_ROLES = ['stylist', 'production', 'marketing', 'partner'] as const;

export const ROLE_DISPLAY: Record<CrmRole, string> = {
  owner: 'Owner',
  manager: 'Store Manager',
  optician: 'Optician',
  sa: 'Sales Associate',
  read_only: 'Read-Only',
};

// ─── Full permission list ────────────────────────────────

export const PERMISSIONS = [
  // Clients
  'org:clients:read', 'org:clients:create', 'org:clients:update', 'org:clients:delete',
  'org:clients:merge', 'org:clients:export_single', 'org:clients:export_bulk',
  // Rx / Medical
  'org:rx:read', 'org:rx:update', 'org:rx:delete',
  'org:fit_profile:read', 'org:fit_profile:update',
  // Preferences
  'org:preferences:read', 'org:preferences:update',
  // Tags
  'org:tags:apply', 'org:tags:bulk_apply', 'org:tags:manage_taxonomy',
  // Interactions
  'org:interactions:read', 'org:interactions:create', 'org:interactions:update', 'org:interactions:delete',
  // Orders
  'org:orders:read', 'org:orders:read_all',
  // Products
  'org:products:read', 'org:products:read_sales_history', 'org:products:recommend',
  // Segments
  'org:segments:read', 'org:segments:create', 'org:segments:update', 'org:segments:delete', 'org:segments:sync_klaviyo',
  // Second Sight
  'org:second_sight:read', 'org:second_sight:create', 'org:second_sight:update',
  'org:second_sight:approve_grade', 'org:second_sight:list_shopify',
  // Custom Designs
  'org:custom_designs:read', 'org:custom_designs:create', 'org:custom_designs:update',
  'org:custom_designs:submit_review', 'org:custom_designs:approve', 'org:custom_designs:update_production_status',
  // Appointments
  'org:appointments:read', 'org:appointments:create', 'org:appointments:update', 'org:appointments:delete',
  // Membership & Credits
  'org:membership:read', 'org:membership:update_tier', 'org:membership:update_status',
  'org:credits:read', 'org:credits:adjust',
  // Consent & Messaging
  'org:consent:read', 'org:consent:update',
  'org:campaigns:read', 'org:campaigns:create', 'org:messaging:send_direct',
  // Try-On & Recommendations
  'org:tryon:read', 'org:tryon:initiate', 'org:tryon:view_history',
  'org:recs:read', 'org:recs:create', 'org:recs:manage_feedback',
  // Reports
  'org:reports:read', 'org:reports:export', 'org:reports:cross_location',
  // Audit
  'org:audit:read_own_location', 'org:audit:read_all',
  // Settings
  'org:settings:locations', 'org:settings:staff', 'org:settings:tags',
  'org:settings:integrations', 'org:settings:consent_policy', 'org:settings:business_config',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// ─── Role → permission matrix ────────────────────────────

const ROLE_PERMISSIONS: Record<CrmRole, Set<string>> = {
  owner: new Set(['*']),

  manager: new Set([
    'org:clients:read', 'org:clients:create', 'org:clients:update', 'org:clients:merge',
    'org:clients:export_single', 'org:clients:export_bulk',
    'org:rx:read', 'org:fit_profile:read', 'org:fit_profile:update',
    'org:preferences:read', 'org:preferences:update',
    'org:tags:apply', 'org:tags:bulk_apply',
    'org:interactions:read', 'org:interactions:create', 'org:interactions:update', 'org:interactions:delete',
    'org:orders:read', 'org:orders:read_all',
    'org:products:read', 'org:products:read_sales_history', 'org:products:recommend',
    'org:segments:read', 'org:segments:create', 'org:segments:update', 'org:segments:delete', 'org:segments:sync_klaviyo',
    'org:second_sight:read', 'org:second_sight:create', 'org:second_sight:update',
    'org:second_sight:approve_grade', 'org:second_sight:list_shopify',
    'org:custom_designs:read', 'org:custom_designs:create', 'org:custom_designs:update', 'org:custom_designs:submit_review',
    'org:appointments:read', 'org:appointments:create', 'org:appointments:update', 'org:appointments:delete',
    'org:membership:read', 'org:membership:update_tier', 'org:membership:update_status',
    'org:credits:read', 'org:credits:adjust',
    'org:consent:read', 'org:consent:update',
    'org:campaigns:read', 'org:campaigns:create', 'org:messaging:send_direct',
    'org:tryon:read', 'org:tryon:initiate', 'org:tryon:view_history',
    'org:recs:read', 'org:recs:create', 'org:recs:manage_feedback',
    'org:reports:read', 'org:reports:export',
    'org:audit:read_own_location',
    'org:settings:staff',
  ]),

  optician: new Set([
    'org:clients:read', 'org:clients:update',
    'org:rx:read', 'org:rx:update', 'org:rx:delete',
    'org:fit_profile:read', 'org:fit_profile:update',
    'org:preferences:read',
    'org:interactions:read', 'org:interactions:create', 'org:interactions:update', 'org:interactions:delete',
    'org:orders:read', 'org:products:read',
    'org:tryon:read', 'org:tryon:initiate',
    'org:recs:read', 'org:recs:create',
    'org:appointments:read', 'org:appointments:create', 'org:appointments:update',
    'org:custom_designs:read', 'org:custom_designs:update',
    'org:membership:read', 'org:credits:read', 'org:consent:read',
  ]),

  sa: new Set([
    'org:clients:read', 'org:clients:create', 'org:clients:update', 'org:clients:export_single',
    'org:rx:read', 'org:fit_profile:read', 'org:fit_profile:update',
    'org:preferences:read', 'org:preferences:update',
    'org:tags:apply',
    'org:interactions:read', 'org:interactions:create', 'org:interactions:update', 'org:interactions:delete',
    'org:orders:read', 'org:products:read', 'org:products:recommend',
    'org:segments:read', 'org:segments:create', 'org:segments:update',
    'org:second_sight:read', 'org:second_sight:create', 'org:second_sight:update',
    'org:custom_designs:read', 'org:custom_designs:create', 'org:custom_designs:update', 'org:custom_designs:submit_review',
    'org:appointments:read', 'org:appointments:create', 'org:appointments:update',
    'org:membership:read', 'org:credits:read',
    'org:consent:read', 'org:consent:update',
    'org:tryon:read', 'org:tryon:initiate', 'org:tryon:view_history',
    'org:recs:read', 'org:recs:create', 'org:recs:manage_feedback',
  ]),

  read_only: new Set([
    'org:clients:read', 'org:clients:export_single', 'org:clients:export_bulk',
    'org:rx:read', 'org:fit_profile:read', 'org:preferences:read',
    'org:interactions:read',
    'org:orders:read', 'org:orders:read_all',
    'org:products:read', 'org:products:read_sales_history',
    'org:segments:read', 'org:second_sight:read', 'org:custom_designs:read',
    'org:appointments:read', 'org:membership:read', 'org:credits:read',
    'org:consent:read', 'org:campaigns:read',
    'org:reports:read', 'org:reports:export', 'org:reports:cross_location',
    'org:tryon:read', 'org:tryon:view_history', 'org:recs:read',
  ]),
};

// ─── Lookup helpers ──────────────────────────────────────

export function hasPermission(role: CrmRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  if (perms.has('*')) return true;
  return perms.has(permission);
}

export function hasAllPermissions(role: CrmRole, permissions: string[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}

export function hasAnyPermission(role: CrmRole, permissions: string[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

export function getPermissions(role: CrmRole): string[] {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return [];
  if (perms.has('*')) return [...PERMISSIONS];
  return Array.from(perms);
}

export function isValidRole(value: unknown): value is CrmRole {
  return typeof value === 'string' && CRM_ROLES.includes(value as CrmRole);
}
