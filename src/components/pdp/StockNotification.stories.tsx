import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import StockNotification from './StockNotification';

const meta: Meta<typeof StockNotification> = { component: StockNotification };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { productId: 'gid://shopify/Product/1', variantTitle: 'Noir / Medium' } };
