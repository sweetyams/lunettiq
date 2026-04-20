import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ClientPicker } from './ClientPicker';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof ClientPicker> = { component: ClientPicker };
export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = { args: { open: true, onClose: noop, onSelect: noop } };
export const Closed: Story = { args: { open: false, onClose: noop, onSelect: noop } };
