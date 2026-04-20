import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import LensRefreshCard from './LensRefreshCard';

const meta: Meta<typeof LensRefreshCard> = { component: LensRefreshCard };
export default meta;
type Story = StoryObj<typeof meta>;

export const DueForRefresh: Story = { args: { lastOrderDate: '2024-01-01' } };
export const Recent: Story = { args: { lastOrderDate: '2026-01-01' } };
export const NoOrder: Story = { args: { lastOrderDate: null } };
