import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CustomerEditForm } from './CustomerEditForm';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof CustomerEditForm> = { component: CustomerEditForm };
export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {
  args: { customerId: 'cust_123', field: 'firstName', label: 'First Name', value: 'Sophie', onSaved: noop },
};

export const Select: Story = {
  args: {
    customerId: 'cust_123', field: 'preferred_store', label: 'Preferred Store', value: 'plateau',
    type: 'select', options: [{ value: 'plateau', label: 'Plateau' }, { value: 'dix30', label: 'Dix30' }],
    onSaved: noop,
  },
};
