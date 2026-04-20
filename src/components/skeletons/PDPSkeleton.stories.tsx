import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import PDPSkeleton from './PDPSkeleton';

const meta: Meta<typeof PDPSkeleton> = { component: PDPSkeleton };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
