import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TryOnHistory } from './TryOnHistory';

const meta: Meta<typeof TryOnHistory> = {
  component: TryOnHistory,
  beforeEach: () => {
    const orig = window.fetch;
    window.fetch = (input, init) => {
      if (typeof input === 'string' && input.includes('/api/crm/customers/') && input.includes('/tryon')) {
        return Promise.resolve(new Response(JSON.stringify({
          sessions: [
            { date: '2026-04-15', framesTried: 5, outcome: 'Purchased Plateau Round' },
            { date: '2026-03-20', framesTried: 3, outcome: 'No purchase' },
          ],
        }), { headers: { 'Content-Type': 'application/json' } }));
      }
      return orig(input, init);
    };
    return () => { window.fetch = orig; };
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { customerId: 'cust_123' } };
