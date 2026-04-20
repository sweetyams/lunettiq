import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LogInteractionModal } from './LogInteractionModal';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof LogInteractionModal> = { component: LogInteractionModal };
export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = { args: { customerId: 'cust_123', open: true, onClose: noop, onSaved: noop } };
export const Closed: Story = { args: { ...Open.args, open: false } };
