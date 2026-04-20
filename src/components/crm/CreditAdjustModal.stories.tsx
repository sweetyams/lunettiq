import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CreditAdjustModal } from './CreditAdjustModal';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof CreditAdjustModal> = { component: CreditAdjustModal };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { customerId: 'cust_123', currentBalance: 125, onClose: noop, onAdjusted: noop, toast: noop },
};
