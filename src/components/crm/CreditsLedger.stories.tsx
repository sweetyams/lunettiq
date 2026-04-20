import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CreditsLedger } from './CreditsLedger';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof CreditsLedger> = {
  component: CreditsLedger,
  beforeEach: () => {
    const orig = window.fetch;
    window.fetch = (input, init) => {
      if (typeof input === 'string' && input.includes('/api/crm/customers/') && input.includes('/credits')) {
        return Promise.resolve(new Response(JSON.stringify({
          entries: [
            { id: '1', transactionType: 'issued_membership', amount: '25.00', runningBalance: '125.00', reason: 'Monthly credit', occurredAt: '2026-04-01T00:00:00Z' },
            { id: '2', transactionType: 'redeemed_order', amount: '-50.00', runningBalance: '100.00', reason: 'Order #1042', occurredAt: '2026-03-15T00:00:00Z' },
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

export const Default: Story = { args: { customerId: 'cust_123', onAdjust: noop } };
