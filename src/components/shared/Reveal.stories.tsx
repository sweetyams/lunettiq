import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Reveal from './Reveal';

const meta: Meta<typeof Reveal> = { component: Reveal };
export default meta;
type Story = StoryObj<typeof meta>;

export const Up: Story = { args: { children: <div className="p-8 bg-gray-100 rounded">Reveal Up</div>, direction: 'up' } };
export const Left: Story = { args: { children: <div className="p-8 bg-gray-100 rounded">Reveal Left</div>, direction: 'left' } };
