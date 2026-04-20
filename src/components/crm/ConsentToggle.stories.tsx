import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ConsentToggle } from './ConsentToggle';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof ConsentToggle> = { component: ConsentToggle };
export default meta;
type Story = StoryObj<typeof meta>;

export const Enabled: Story = {
  args: { customerId: 'cust_123', label: 'Email Marketing', field: 'accepts_marketing', metafieldKey: 'accepts_marketing', enabled: true, onToggled: noop },
};

export const Disabled: Story = {
  args: { ...Enabled.args, enabled: false },
};
