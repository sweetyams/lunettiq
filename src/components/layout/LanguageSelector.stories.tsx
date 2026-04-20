import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import LanguageSelector from './LanguageSelector';

const meta: Meta<typeof LanguageSelector> = { component: LanguageSelector };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
