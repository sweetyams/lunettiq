import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { InteractionTimeline } from './InteractionTimeline';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof InteractionTimeline> = { component: InteractionTimeline };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    customerId: 'cust_123',
    customerName: 'Sophie Tremblay',
    interactions: [
      { id: '1', type: 'note', direction: 'outbound', subject: 'Follow-up on fitting', body: 'Client loved the Plateau Round.', staffId: 'staff_1', occurredAt: '2026-04-10T14:00:00Z' },
      { id: '2', type: 'call', direction: 'inbound', subject: 'Lens question', body: null, staffId: 'staff_1', occurredAt: '2026-03-28T11:00:00Z' },
    ],
    onRefresh: noop,
  },
};

export const Empty: Story = {
  args: { ...Default.args, interactions: [] },
};
