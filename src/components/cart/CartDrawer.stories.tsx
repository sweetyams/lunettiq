import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import CartDrawer from './CartDrawer';
import { CartProvider } from '@/context/CartContext';
import { CartDrawerProvider } from '@/context/CartDrawerContext';

const meta: Meta<typeof CartDrawer> = {
  component: CartDrawer,
  decorators: [(Story) => (
    <CartProvider><CartDrawerProvider><Story /></CartDrawerProvider></CartProvider>
  )],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
