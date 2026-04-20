import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ProfileEditor from './ProfileEditor';

const meta: Meta<typeof ProfileEditor> = { component: ProfileEditor };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    initial: { firstName: 'Sophie', lastName: 'Tremblay', email: 'sophie@example.com', phone: '+15145550123' },
  },
};

export const WithBadge: Story = {
  args: {
    ...Default.args,
    loyaltyBadge: <span className="px-2 py-0.5 bg-amber-400 text-xs font-bold rounded">CULT</span>,
  },
};
