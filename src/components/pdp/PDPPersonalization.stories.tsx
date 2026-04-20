import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import PDPPersonalization from './PDPPersonalization';

const meta: Meta<typeof PDPPersonalization> = {
  component: PDPPersonalization,
  beforeEach: () => {
    const orig = window.fetch;
    window.fetch = (input, init) => {
      if (typeof input === 'string' && input.includes('/api/account/personalization')) {
        return Promise.resolve(new Response(JSON.stringify({
          data: {
            tier: 'cult', creditBalance: 75, creditExpiry: null, referralCount: 2,
            rx: { daysUntilExpiry: 45, expiresApprox: '2026-06-01' },
            fit: { frameWidthMm: 136 },
            recommendations: [{ productId: 'gid://shopify/Product/1', staffName: 'Marie', date: '2026-03-15' }],
            stated: {}, derived: null, namedOptician: null, lastOrderDate: null, lensRefresh: false,
          },
        }), { headers: { 'Content-Type': 'application/json' } }));
      }
      return orig(input, init);
    };
    return () => { window.fetch = orig; };
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { productId: 'gid://shopify/Product/1', frameWidthMm: 138 } };
