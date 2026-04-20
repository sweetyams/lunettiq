import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import AccountPersonalization from './AccountPersonalization';

const meta: Meta<typeof AccountPersonalization> = {
  component: AccountPersonalization,
  beforeEach: () => {
    const orig = window.fetch;
    window.fetch = (input, init) => {
      if (typeof input === 'string' && input.includes('/api/account/personalization')) {
        return Promise.resolve(new Response(JSON.stringify({
          data: {
            tier: 'cult', creditBalance: 50, creditExpiry: null, referralCount: 2,
            rx: null, fit: { frameWidthMm: 136 },
            recommendations: [{ productId: 'p1', staffName: 'Marie', date: '2026-03-15' }],
            stated: { shapes: ['Round'], materials: ['Acetate'], colours: ['Black'], avoid: [], notes: '' },
            derived: null, namedOptician: 'Marie', lastOrderDate: '2024-06-01', lensRefresh: true,
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

export const Default: Story = {};
