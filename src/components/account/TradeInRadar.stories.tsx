import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import TradeInRadar from './TradeInRadar';

const meta: Meta<typeof TradeInRadar> = { component: TradeInRadar };
export default meta;
type Story = StoryObj<typeof meta>;

export const Eligible: Story = {
  args: { lastOrderDate: '2024-06-01', tradeInRate: 0.3, tier: 'cult' },
};

export const TooRecent: Story = {
  args: { lastOrderDate: '2026-01-01', tradeInRate: 0.2, tier: null },
};
