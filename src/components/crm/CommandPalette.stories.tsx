import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CommandPalette } from './CommandPalette';

const meta: Meta<typeof CommandPalette> = { component: CommandPalette };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
