import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ProductSuggestions } from './ProductSuggestions';

const meta: Meta<typeof ProductSuggestions> = {
  component: ProductSuggestions,
  beforeEach: () => {
    const orig = window.fetch;
    window.fetch = (input, init) => {
      if (typeof input === 'string' && input.includes('/api/crm/customers/') && input.includes('/suggestions')) {
        return Promise.resolve(new Response(JSON.stringify({
          suggestions: [
            { product: { shopifyProductId: 'p1', title: 'Plateau Round', vendor: 'Lunettiq', priceMin: '295', imageUrl: null }, matchReasons: ['Face shape match', 'Preferred material'], score: 0.92 },
          ],
        }), { headers: { 'Content-Type': 'application/json' } }));
      }
      return orig(input, init);
    };
    return () => { window.fetch = orig; };
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { customerId: 'cust_123' } };
