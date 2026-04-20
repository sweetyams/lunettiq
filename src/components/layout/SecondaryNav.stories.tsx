import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import SecondaryNav from './SecondaryNav';
import { CartProvider } from '@/context/CartContext';
import { CartDrawerProvider } from '@/context/CartDrawerContext';
import { SearchProvider } from '@/context/SearchContext';

const meta: Meta<typeof SecondaryNav> = {
  component: SecondaryNav,
  decorators: [(Story) => (
    <CartProvider><CartDrawerProvider><SearchProvider><Story /></SearchProvider></CartDrawerProvider></CartProvider>
  )],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
