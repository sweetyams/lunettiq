import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ContextualNudgeBand from './ContextualNudgeBand';

const meta: Meta<typeof ContextualNudgeBand> = {
  component: ContextualNudgeBand,
  beforeEach: () => {
    const orig = window.fetch;
    window.fetch = (input, init) => {
      if (typeof input === 'string' && input.includes('/api/account/personalization')) {
        return Promise.resolve(new Response(JSON.stringify({
          data: { tier: 'cult', creditBalance: 50, creditExpiry: null, referralCount: 2, rx: null, fit: null, recommendations: [], stated: {}, derived: null, namedOptician: null, lastOrderDate: null, lensRefresh: false },
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
