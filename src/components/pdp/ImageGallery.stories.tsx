import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ImageGallery from './ImageGallery';
import { mockProduct } from '@/components/__mocks__/storyData';

const meta: Meta<typeof ImageGallery> = { component: ImageGallery };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    images: mockProduct.images,
    variants: mockProduct.variants,
    selectedColour: 'Noir',
    productTitle: mockProduct.title,
    productHandle: mockProduct.handle,
  },
};

export const WithTryOn: Story = {
  args: { ...Default.args, tryOnImageUrl: 'https://placehold.co/400x200/F5F5F9/333?text=Frame+PNG' },
};
