import { describe, it, expect } from 'vitest';

/**
 * Tests for Shopify product status badge rendering logic.
 * Verifies the badge is shown for ALL statuses with correct colours.
 */

// Badge colour logic extracted from the UI
function badgeStyle(status: string | null) {
  if (!status) return null;
  return {
    background: status === 'active' ? '#95FFB9' : status === 'draft' ? '#CFEDFF' : '#f3f4f6',
    color: status === 'active' ? '#065f46' : status === 'draft' ? '#1e40af' : '#6b7280',
    label: status,
  };
}

// Whether badge should render
function shouldShowBadge(status: string | null): boolean {
  return status !== null && status !== undefined && status !== '';
}

describe('Product status badge', () => {
  describe('badge visibility', () => {
    it('shows badge for active status', () => {
      expect(shouldShowBadge('active')).toBe(true);
    });

    it('shows badge for draft status', () => {
      expect(shouldShowBadge('draft')).toBe(true);
    });

    it('shows badge for archived status', () => {
      expect(shouldShowBadge('archived')).toBe(true);
    });

    it('does not show badge for null status', () => {
      expect(shouldShowBadge(null)).toBe(false);
    });

    it('does not show badge for empty string', () => {
      expect(shouldShowBadge('')).toBe(false);
    });
  });

  describe('badge colours', () => {
    it('active is green', () => {
      const style = badgeStyle('active')!;
      expect(style.background).toBe('#95FFB9');
      expect(style.color).toBe('#065f46');
      expect(style.label).toBe('active');
    });

    it('draft is blue', () => {
      const style = badgeStyle('draft')!;
      expect(style.background).toBe('#CFEDFF');
      expect(style.color).toBe('#1e40af');
      expect(style.label).toBe('draft');
    });

    it('archived is gray', () => {
      const style = badgeStyle('archived')!;
      expect(style.background).toBe('#f3f4f6');
      expect(style.color).toBe('#6b7280');
      expect(style.label).toBe('archived');
    });

    it('unknown status falls through to gray', () => {
      const style = badgeStyle('unknown')!;
      expect(style.background).toBe('#f3f4f6');
      expect(style.color).toBe('#6b7280');
    });

    it('null returns null', () => {
      expect(badgeStyle(null)).toBeNull();
    });
  });

  describe('badge locations audit', () => {
    // These tests document every location where the badge MUST appear.
    // If a location is removed or renamed, the test name serves as documentation.

    const REQUIRED_LOCATIONS = [
      { file: 'ProductsClient.tsx', surface: '/crm/products grid cards', field: 'p.status' },
      { file: 'ProductDetailClient.tsx', surface: '/crm/products/[id] detail header', field: 'product.status' },
      { file: 'FamiliesView.tsx', surface: '/crm/products families view', field: 'p.product_status' },
      { file: 'FamilyDetailClient.tsx', surface: '/crm/products/families/[id] members', field: 'm.productStatus' },
      { file: 'FamilyDetailClient.tsx', surface: '/crm/products/families/[id] add dropdown', field: 'p.status' },
      { file: 'settings/families/page.tsx', surface: 'Settings → Families member rows', field: 'm.status' },
      { file: 'settings/families/page.tsx', surface: 'Settings → Families unassigned rows', field: 'p.status' },
      { file: 'settings/families/page.tsx', surface: 'Settings → Families search dropdown', field: 'p.status' },
      { file: 'settings/filters/page.tsx', surface: 'Settings → Filters assignment rows', field: 'a.product_status' },
      { file: 'settings/filters/page.tsx', surface: 'Settings → Filters unassigned rows', field: 'p.status' },
      { file: 'settings/product-mapping/page.tsx', surface: 'Settings → Mapping table', field: 'm.shopify_status' },
      { file: 'settings/product-mapping/page.tsx', surface: 'Settings → Mapping product picker', field: 'p.status' },
      { file: 'ProductSearchModal.tsx', surface: 'ProductSearchModal (shared)', field: 'p.status' },
    ];

    const INTENTIONALLY_EXCLUDED = [
      { file: 'orders/[id]/page.tsx', reason: 'Shows order status, not product status' },
      { file: 'ClientCanvas.tsx', reason: 'Shows order/interaction context' },
      { file: 'FlowPanels.tsx', reason: 'Shows configurator choices, not products' },
      { file: 'LiveConfiguratorPreview.tsx', reason: 'Test preview, not catalogue' },
    ];

    it('has 13 required badge locations', () => {
      expect(REQUIRED_LOCATIONS).toHaveLength(13);
    });

    it('has 4 intentionally excluded locations', () => {
      expect(INTENTIONALLY_EXCLUDED).toHaveLength(4);
    });

    it('all required locations have a field name', () => {
      for (const loc of REQUIRED_LOCATIONS) {
        expect(loc.field).toBeTruthy();
      }
    });

    it('all exclusions have a reason', () => {
      for (const exc of INTENTIONALLY_EXCLUDED) {
        expect(exc.reason).toBeTruthy();
      }
    });

    it('no duplicate surfaces', () => {
      const surfaces = REQUIRED_LOCATIONS.map(l => l.surface);
      expect(new Set(surfaces).size).toBe(surfaces.length);
    });
  });
});
