import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import EditorialPanel from './EditorialPanel';
import { mockEditorialPanel } from '@/components/__mocks__/storyData';

const meta: Meta<typeof EditorialPanel> = { component: EditorialPanel };
export default meta;
type Story = StoryObj<typeof meta>;

export const WithLink: Story = { args: { panel: mockEditorialPanel } };
export const NoLink: Story = { args: { panel: { ...mockEditorialPanel, linkUrl: undefined } } };
