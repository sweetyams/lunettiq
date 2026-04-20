import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import OnFacesSection from './OnFacesSection';

const IMG = 'https://placehold.co/400x400/F5F5F9/333?text=On+Face';
const meta: Meta<typeof OnFacesSection> = { component: OnFacesSection };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { onFaceImages: [IMG, IMG, IMG, IMG], faceNotes: 'Suits oval and round face shapes.' } };
export const Empty: Story = { args: {} };
