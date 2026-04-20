import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import AccordionSection from './AccordionSection';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof AccordionSection> = { component: AccordionSection };
export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: { id: 'details', title: 'Frame Details', isOpen: true, onToggle: noop, children: <p className="text-sm text-gray-600">Italian acetate, spring hinges, UV400 lenses.</p> },
};

export const Closed: Story = {
  args: { ...Open.args, isOpen: false },
};
