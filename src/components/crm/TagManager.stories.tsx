import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TagManager } from './TagManager';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof TagManager> = { component: TagManager };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { customerId: 'cust_123', tags: ['VIP', 'round-face', 'acetate-lover'], onChanged: noop },
};

export const Empty: Story = {
  args: { customerId: 'cust_123', tags: [], onChanged: noop },
};
