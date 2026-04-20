import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import NewsletterSignup from './NewsletterSignup';

const meta: Meta<typeof NewsletterSignup> = { component: NewsletterSignup };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
