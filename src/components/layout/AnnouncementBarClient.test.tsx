import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AnnouncementBarClient from './AnnouncementBarClient';

const STORAGE_KEY = 'lunettiq_announcement_dismissed';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('AnnouncementBarClient', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('renders the announcement message', () => {
    render(<AnnouncementBarClient message="Free shipping on orders over $100" />);
    expect(screen.getByText(/Free shipping on orders over \$100/)).toBeInTheDocument();
  });

  it('renders link when linkText and linkUrl are provided', () => {
    render(
      <AnnouncementBarClient
        message="Sale now on"
        linkText="Shop now"
        linkUrl="/collections/sale"
      />
    );
    const link = screen.getByText('Shop now');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/collections/sale');
  });

  it('hides the bar when dismiss button is clicked', () => {
    render(<AnnouncementBarClient message="Hello world" />);
    expect(screen.getByText(/Hello world/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Dismiss announcement'));
    expect(screen.queryByText(/Hello world/)).not.toBeInTheDocument();
  });

  it('persists dismissal in localStorage', () => {
    render(<AnnouncementBarClient message="Hello world" />);
    fireEvent.click(screen.getByLabelText('Dismiss announcement'));

    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it('does not render if the same message was previously dismissed', () => {
    // First render and dismiss
    const { unmount } = render(<AnnouncementBarClient message="Hello world" />);
    fireEvent.click(screen.getByLabelText('Dismiss announcement'));
    unmount();

    // Second render — should not show
    render(<AnnouncementBarClient message="Hello world" />);
    expect(screen.queryByText(/Hello world/)).not.toBeInTheDocument();
  });

  it('renders again if the message changes after dismissal', () => {
    // Dismiss first message
    const { unmount } = render(<AnnouncementBarClient message="Old message" />);
    fireEvent.click(screen.getByLabelText('Dismiss announcement'));
    unmount();

    // New message should show
    render(<AnnouncementBarClient message="New message" />);
    expect(screen.getByText(/New message/)).toBeInTheDocument();
  });
});
