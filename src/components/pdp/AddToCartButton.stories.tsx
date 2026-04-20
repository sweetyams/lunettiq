import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import AddToCartButton from './AddToCartButton';
import { CartProvider } from '@/context/CartContext';
import { CartDrawerProvider } from '@/context/CartDrawerContext';
import { mockLensOptions } from '@/components/__mocks__/storyData';

const meta: Meta<typeof AddToCartButton> = {
  component: AddToCartButton,
  decorators: [(Story) => <CartProvider><CartDrawerProvider><Story /></CartDrawerProvider></CartProvider>],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  args: {
    variantId: 'gid://shopify/ProductVariant/1001',
    isConfigComplete: true,
    isOutOfStock: false,
    lensConfiguration: { lensType: 'nonPrescription', lensIndex: '1.50', coatings: [], sunOptions: null, prescription: null, prescriptionMethod: null },
    lensOptions: mockLensOptions,
    frameBasePrice: 295,
  },
};

export const Incomplete: Story = { args: { ...Ready.args, isConfigComplete: false } };
export const OutOfStock: Story = { args: { ...Ready.args, isOutOfStock: true } };
