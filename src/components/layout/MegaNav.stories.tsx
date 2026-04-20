import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import MegaNav from './MegaNav';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof MegaNav> = { component: MegaNav };
export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = { args: { isOpen: true, onClose: noop } };
export const Closed: Story = { args: { isOpen: false, onClose: noop } };
