import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import DualPriceDisplay from './DualPriceDisplay';

const meta: Meta<typeof DualPriceDisplay> = { component: DualPriceDisplay };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { price: 295, currencyCode: 'CAD' } };
