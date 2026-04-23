import { describe, it, expect } from 'vitest';
import {
  CRM_ROLES,
  PERMISSIONS,
  ROLE_DISPLAY,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getPermissions,
  isValidRole,
  type CrmRole,
} from './permissions';

// ─── isValidRole ─────────────────────────────────────────

describe('isValidRole', () => {
  it.each(CRM_ROLES.map(r => [r]))('accepts "%s"', (role) => {
    expect(isValidRole(role)).toBe(true);
  });

  it.each([null, undefined, '', 'admin', 'superuser', 42, true, {}, 'Owner'])
    ('rejects %j', (val) => {
      expect(isValidRole(val)).toBe(false);
    });
});

// ─── hasPermission ───────────────────────────────────────

describe('hasPermission', () => {
  describe('owner — wildcard', () => {
    it('grants every declared permission', () => {
      for (const p of PERMISSIONS) {
        expect(hasPermission('owner', p)).toBe(true);
      }
    });

    it('grants arbitrary undeclared permissions', () => {
      expect(hasPermission('owner', 'org:anything:whatever')).toBe(true);
    });
  });

  describe('read_only — read access only', () => {
    it('grants org:clients:read', () => {
      expect(hasPermission('read_only', 'org:clients:read')).toBe(true);
    });

    it('grants org:orders:read_all', () => {
      expect(hasPermission('read_only', 'org:orders:read_all')).toBe(true);
    });

    it('grants org:reports:read', () => {
      expect(hasPermission('read_only', 'org:reports:read')).toBe(true);
    });

    it('denies org:clients:create', () => {
      expect(hasPermission('read_only', 'org:clients:create')).toBe(false);
    });

    it('denies org:clients:update', () => {
      expect(hasPermission('read_only', 'org:clients:update')).toBe(false);
    });

    it('denies org:clients:delete', () => {
      expect(hasPermission('read_only', 'org:clients:delete')).toBe(false);
    });

    it('denies org:settings:staff', () => {
      expect(hasPermission('read_only', 'org:settings:staff')).toBe(false);
    });

    it('denies org:segments:create', () => {
      expect(hasPermission('read_only', 'org:segments:create')).toBe(false);
    });

    it('denies org:interactions:create', () => {
      expect(hasPermission('read_only', 'org:interactions:create')).toBe(false);
    });

    it('denies org:credits:adjust', () => {
      expect(hasPermission('read_only', 'org:credits:adjust')).toBe(false);
    });
  });

  describe('manager — broad but no settings (except staff)', () => {
    it('grants org:clients:merge', () => {
      expect(hasPermission('manager', 'org:clients:merge')).toBe(true);
    });

    it('grants org:settings:staff', () => {
      expect(hasPermission('manager', 'org:settings:staff')).toBe(true);
    });

    it('denies org:settings:locations', () => {
      expect(hasPermission('manager', 'org:settings:locations')).toBe(false);
    });

    it('denies org:settings:integrations', () => {
      expect(hasPermission('manager', 'org:settings:integrations')).toBe(false);
    });

    it('denies org:settings:business_config', () => {
      expect(hasPermission('manager', 'org:settings:business_config')).toBe(false);
    });
  });

  describe('optician — clinical focus', () => {
    it('grants org:rx:update', () => {
      expect(hasPermission('optician', 'org:rx:update')).toBe(true);
    });

    it('grants org:rx:delete', () => {
      expect(hasPermission('optician', 'org:rx:delete')).toBe(true);
    });

    it('denies org:clients:create', () => {
      expect(hasPermission('optician', 'org:clients:create')).toBe(false);
    });

    it('denies org:segments:read', () => {
      expect(hasPermission('optician', 'org:segments:read')).toBe(false);
    });

    it('denies org:reports:read', () => {
      expect(hasPermission('optician', 'org:reports:read')).toBe(false);
    });
  });

  describe('sa — sales focus', () => {
    it('grants org:clients:create', () => {
      expect(hasPermission('sa', 'org:clients:create')).toBe(true);
    });

    it('grants org:products:recommend', () => {
      expect(hasPermission('sa', 'org:products:recommend')).toBe(true);
    });

    it('grants org:segments:create', () => {
      expect(hasPermission('sa', 'org:segments:create')).toBe(true);
    });

    it('denies org:segments:delete', () => {
      expect(hasPermission('sa', 'org:segments:delete')).toBe(false);
    });

    it('denies org:clients:merge', () => {
      expect(hasPermission('sa', 'org:clients:merge')).toBe(false);
    });

    it('denies org:reports:read', () => {
      expect(hasPermission('sa', 'org:reports:read')).toBe(false);
    });
  });
});

// ─── hasAllPermissions ───────────────────────────────────

describe('hasAllPermissions', () => {
  it('returns true when role has all listed permissions', () => {
    expect(hasAllPermissions('read_only', ['org:clients:read', 'org:orders:read'])).toBe(true);
  });

  it('returns false when role lacks one permission', () => {
    expect(hasAllPermissions('read_only', ['org:clients:read', 'org:clients:create'])).toBe(false);
  });

  it('returns true for empty array', () => {
    expect(hasAllPermissions('read_only', [])).toBe(true);
  });

  it('owner passes any combination', () => {
    expect(hasAllPermissions('owner', ['org:settings:staff', 'org:credits:adjust', 'org:audit:read_all'])).toBe(true);
  });
});

// ─── hasAnyPermission ────────────────────────────────────

describe('hasAnyPermission', () => {
  it('returns true when role has at least one', () => {
    expect(hasAnyPermission('read_only', ['org:clients:create', 'org:clients:read'])).toBe(true);
  });

  it('returns false when role has none', () => {
    expect(hasAnyPermission('read_only', ['org:clients:create', 'org:settings:staff'])).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(hasAnyPermission('read_only', [])).toBe(false);
  });
});

// ─── getPermissions ──────────────────────────────────────

describe('getPermissions', () => {
  it('owner returns all declared permissions', () => {
    const perms = getPermissions('owner');
    expect(perms).toHaveLength(PERMISSIONS.length);
    for (const p of PERMISSIONS) {
      expect(perms).toContain(p);
    }
  });

  it('read_only returns a subset', () => {
    const perms = getPermissions('read_only');
    expect(perms.length).toBeGreaterThan(0);
    expect(perms.length).toBeLessThan(PERMISSIONS.length);
    expect(perms).toContain('org:clients:read');
    expect(perms).not.toContain('org:clients:create');
  });

  it('every returned permission is in PERMISSIONS', () => {
    for (const role of CRM_ROLES) {
      for (const p of getPermissions(role)) {
        expect(PERMISSIONS).toContain(p);
      }
    }
  });
});

// ─── Role matrix invariants ──────────────────────────────

describe('role matrix invariants', () => {
  it('every role has org:clients:read', () => {
    for (const role of CRM_ROLES) {
      expect(hasPermission(role, 'org:clients:read')).toBe(true);
    }
  });

  it('only owner has org:settings:locations', () => {
    for (const role of CRM_ROLES) {
      expect(hasPermission(role, 'org:settings:locations')).toBe(role === 'owner');
    }
  });

  it('only owner has org:audit:read_all', () => {
    for (const role of CRM_ROLES) {
      expect(hasPermission(role, 'org:audit:read_all')).toBe(role === 'owner');
    }
  });

  it('read_only has no create/update/delete permissions', () => {
    const perms = getPermissions('read_only');
    const writePerms = perms.filter(p => p.includes(':create') || p.includes(':update') || p.includes(':delete') || p.includes(':adjust') || p.includes(':merge'));
    expect(writePerms).toEqual([]);
  });

  it('ROLE_DISPLAY has an entry for every role', () => {
    for (const role of CRM_ROLES) {
      expect(ROLE_DISPLAY[role]).toBeDefined();
      expect(typeof ROLE_DISPLAY[role]).toBe('string');
    }
  });
});
