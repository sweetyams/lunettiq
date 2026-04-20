import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CustomFields } from './CustomFields';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof CustomFields> = { component: CustomFields };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    customerId: 'cust_123',
    fields: [
      { key: 'preferred_store', value: 'Plateau' },
      { key: 'insurance_provider', value: 'Sun Life' },
    ],
    onSave: noop,
  },
};

export const Empty: Story = {
  args: { customerId: 'cust_123', fields: [], onSave: noop },
};
