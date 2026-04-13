import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Mock next/link to render a plain anchor
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock CartContext
const mockOpenCart = vi.fn();
const mockCloseCart = vi.fn();
const mockAddToCart = vi.fn();
const mockUpdateLineItem = vi.fn();
const mockRemoveLineItem = vi.fn();

let mockCartValue: {
  cart: import('@/types/shopify').ShopifyCart | null;
  isOpen: boolean;
  isLoading: boolean;
  openCart: () => void;
  closeCart: () => void;
  addToCart: () => Promise<void>;
  updateLineItem: () => Promise<void>;
  removeLineItem: () => Promise<void>;
} = {
  cart: null,
  isOpen: false,
  isLoading: false,
  openCart: mockOpenCart,
  closeCart: mockCloseCart,
  addToCart: mockAddToCart,
  updateLineItem: mockUpdateLineItem,
  removeLineItem: mockRemoveLineItem,
};

vi.mock('@/context/CartContext', () => ({
  useCart: () => mockCartValue,
}));

import Header from './Header';
import PrimaryNav from './PrimaryNav';
import MegaNav from './MegaNav';
import SecondaryNav from './SecondaryNav';

describe('Header', () => {
  it('renders the logo linking to /', () => {
    render(<Header />);
    const logo = screen.getByText('Lunettiq');
    expect(logo.closest('a')).toHaveAttribute('href', '/');
  });

  it('is hidden below lg breakpoint (has hidden lg:block classes)', () => {
    const { container } = render(<Header />);
    const header = container.querySelector('header');
    expect(header?.className).toContain('hidden');
    expect(header?.className).toContain('lg:block');
  });

  it('is sticky', () => {
    const { container } = render(<Header />);
    const header = container.querySelector('header');
    expect(header?.className).toContain('sticky');
    expect(header?.className).toContain('top-0');
  });
});

describe('PrimaryNav', () => {
  it('renders Optical, Sun, Explore, and About links', () => {
    render(<PrimaryNav />);
    expect(screen.getByText('Optical')).toBeInTheDocument();
    expect(screen.getByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Explore')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  it('links Optical to /collections/optics', () => {
    render(<PrimaryNav />);
    expect(screen.getByText('Optical').closest('a')).toHaveAttribute('href', '/collections/optics');
  });

  it('links Sun to /collections/sunglasses', () => {
    render(<PrimaryNav />);
    expect(screen.getByText('Sun').closest('a')).toHaveAttribute('href', '/collections/sunglasses');
  });

  it('links About to /pages/about', () => {
    render(<PrimaryNav />);
    expect(screen.getByText('About').closest('a')).toHaveAttribute('href', '/pages/about');
  });

  it('toggles MegaNav on Explore click', () => {
    render(<PrimaryNav />);
    expect(screen.queryByText('Signature')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Explore'));
    expect(screen.getByText('Signature')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Explore'));
    expect(screen.queryByText('Signature')).not.toBeInTheDocument();
  });
});

describe('MegaNav', () => {
  it('renders sub-collection links when open', () => {
    render(<MegaNav isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Signature')).toBeInTheDocument();
    expect(screen.getByText('Permanent')).toBeInTheDocument();
    expect(screen.getByText('Archives')).toBeInTheDocument();
    expect(screen.getByText('Collaborations')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<MegaNav isOpen={false} onClose={() => {}} />);
    expect(screen.queryByText('Signature')).not.toBeInTheDocument();
  });

  it('links to correct collection paths', () => {
    render(<MegaNav isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Signature').closest('a')).toHaveAttribute('href', '/collections/signature');
    expect(screen.getByText('Permanent').closest('a')).toHaveAttribute('href', '/collections/permanent');
    expect(screen.getByText('Archives').closest('a')).toHaveAttribute('href', '/collections/archives');
    expect(screen.getByText('Collaborations').closest('a')).toHaveAttribute('href', '/collections/collaborations');
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<MegaNav isOpen={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when a link is clicked', () => {
    const onClose = vi.fn();
    render(<MegaNav isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Signature'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking outside', () => {
    const onClose = vi.fn();
    render(<MegaNav isOpen={true} onClose={onClose} />);
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SecondaryNav', () => {
  it('renders search button, stores link, account link, cart button, and stylist CTA', () => {
    render(<SecondaryNav />);
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(screen.getByText('Our Stores')).toBeInTheDocument();
    expect(screen.getByLabelText('Account')).toBeInTheDocument();
    expect(screen.getByLabelText('Cart')).toBeInTheDocument();
    expect(screen.getByText('Stylist Appointment')).toBeInTheDocument();
  });

  it('links Our Stores to /pages/stores', () => {
    render(<SecondaryNav />);
    expect(screen.getByText('Our Stores').closest('a')).toHaveAttribute('href', '/pages/stores');
  });

  it('links Account to /account', () => {
    render(<SecondaryNav />);
    expect(screen.getByLabelText('Account').closest('a')).toHaveAttribute('href', '/account');
  });

  it('links Stylist Appointment to /pages/stylist-appointment', () => {
    render(<SecondaryNav />);
    expect(screen.getByText('Stylist Appointment').closest('a')).toHaveAttribute('href', '/pages/stylist-appointment');
  });

  it('does not show cart badge when cartCount is 0', () => {
    mockCartValue = { ...mockCartValue, cart: null };
    render(<SecondaryNav />);
    expect(screen.getByLabelText('Cart')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows cart badge with count when cartCount > 0', () => {
    mockCartValue = {
      ...mockCartValue,
      cart: {
        id: 'test-cart',
        checkoutUrl: 'https://example.com/checkout',
        lines: [
          {
            id: 'line-1',
            quantity: 3,
            merchandise: { id: 'v1', title: 'Test', price: { amount: '10.00', currencyCode: 'CAD' }, availableForSale: true, selectedOptions: [] },
            attributes: [],
            cost: { totalAmount: { amount: '30.00', currencyCode: 'CAD' } },
          },
        ],
        cost: { subtotalAmount: { amount: '30.00', currencyCode: 'CAD' }, totalAmount: { amount: '30.00', currencyCode: 'CAD' } },
      },
    };
    render(<SecondaryNav />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByLabelText('Cart, 3 items')).toBeInTheDocument();
  });

  it('renders Stylist Appointment as a pill-shaped button', () => {
    render(<SecondaryNav />);
    const cta = screen.getByText('Stylist Appointment');
    expect(cta.className).toContain('rounded-full');
    expect(cta.className).toContain('bg-blue-600');
  });
});
