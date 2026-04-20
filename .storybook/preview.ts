import type { Preview } from '@storybook/nextjs-vite';
import '../src/app/globals.css';

// Global fetch mock — returns safe empty responses for all API calls
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
  if (url.startsWith('/api/') || url.startsWith('http://localhost')) {
    return new Response(JSON.stringify({ data: [], meta: { total: 0 }, notifications: [], unreadCount: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return originalFetch(input, init);
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/crm' },
    },
    a11y: { test: 'todo' },
  },
};

export default preview;
