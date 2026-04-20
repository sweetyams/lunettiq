import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ProductCardSkeleton from './ProductCardSkeleton';

const meta: Meta<typeof ProductCardSkeleton> = { component: ProductCardSkeleton };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
