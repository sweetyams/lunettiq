import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import HeroSkeleton from './HeroSkeleton';

const meta: Meta<typeof HeroSkeleton> = { component: HeroSkeleton };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
