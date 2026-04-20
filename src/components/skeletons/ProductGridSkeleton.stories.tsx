import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ProductGridSkeleton from './ProductGridSkeleton';

const meta: Meta<typeof ProductGridSkeleton> = { component: ProductGridSkeleton };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
