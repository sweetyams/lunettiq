import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import CrmTour from './CrmTour';

const targets = [
  'sidebar-clients', 'sidebar-products', 'sidebar-segments',
  'sidebar-appointments', 'sidebar-loyalty', 'topbar-search',
  'topbar-notifications', 'sidebar-settings',
];

const meta: Meta<typeof CrmTour> = {
  component: CrmTour,
  decorators: [(Story) => (
    <div className="crm-root" style={{ height: '100vh', display: 'flex' }}>
      <div style={{ width: 200, background: '#fafafa', borderRight: '1px solid #eee', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {targets.filter(t => t.startsWith('sidebar')).map(t => (
          <div key={t} data-tour={t} style={{ padding: '6px 10px', fontSize: 13, borderRadius: 4 }}>
            {t.replace('sidebar-', '').replace(/^\w/, c => c.toUpperCase())}
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ height: 44, borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12 }}>
          <div data-tour="topbar-search" style={{ padding: '4px 10px', border: '1px solid #ddd', borderRadius: 4, fontSize: 12, color: '#999' }}>Search… ⌘K</div>
          <div style={{ flex: 1 }} />
          <div data-tour="topbar-notifications" style={{ fontSize: 16 }}>🔔</div>
        </div>
        <div style={{ padding: 24, color: '#999', fontSize: 13 }}>Page content area</div>
      </div>
      <Story />
    </div>
  )],
  beforeEach: () => {
    localStorage.removeItem('lunettiq_crm_tour_done');
    return () => { localStorage.removeItem('lunettiq_crm_tour_done'); };
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
