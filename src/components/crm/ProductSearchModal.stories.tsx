import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ProductSearchModal } from './ProductSearchModal';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof ProductSearchModal> = { component: ProductSearchModal };
export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = { args: { open: true, onClose: noop, onSelect: noop } };
export const Closed: Story = { args: { open: false, onClose: noop, onSelect: noop } };
