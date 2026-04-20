import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { GlobalSearch } from './GlobalSearch';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof GlobalSearch> = { component: GlobalSearch };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { onClose: noop } };
