import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ActivityTimeline } from './ActivityTimeline';

const meta: Meta<typeof ActivityTimeline> = {
  component: ActivityTimeline,
  beforeEach: () => {
    const orig = window.fetch;
    window.fetch = (input, init) => {
      if (typeof input === 'string' && input.includes('/api/crm/customers/') && input.includes('/timeline')) {
        return Promise.resolve(new Response(JSON.stringify({
          entries: [
            { id: '1', type: 'order', summary: 'Ordered Plateau Round — Noir', date: '2026-04-10T14:00:00Z' },
            { id: '2', type: 'note', summary: 'Prefers lightweight acetate frames', date: '2026-03-20T10:00:00Z' },
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
