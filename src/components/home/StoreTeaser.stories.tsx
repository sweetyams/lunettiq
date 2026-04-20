import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import StoreTeaser from './StoreTeaser';

const meta: Meta<typeof StoreTeaser> = { component: StoreTeaser };
export default meta;
type Story = StoryObj<typeof meta>;

export const WithImage: Story = { args: { image: 'https://placehold.co/1200x700/F5F5F9/333?text=Store', title: 'Visit Our Stores' } };
export const NoImage: Story = { args: {} };
