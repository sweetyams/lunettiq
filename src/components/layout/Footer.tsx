import Link from 'next/link';
import NewsletterSignup from './NewsletterSignup';
import CurrencySelector from './CurrencySelector';
import LanguageSelector from './LanguageSelector';

const shopLinks = [
  { label: 'Optical', href: '/collections/optics' },
  { label: 'Sun', href: '/collections/sunglasses' },
  { label: 'Apparel', href: '/collections/apparel' },
  { label: 'Collabs', href: '/collections/collabs' },
  { label: 'Signature', href: '/collections/signature' },
  { label: 'Permanent', href: '/collections/permanent' },
  { label: 'Archives', href: '/collections/archives' },
];

const helpLinks = [
  { label: 'Help', href: '/pages/help' },
  { label: 'FAQ', href: '/pages/faq' },
  { label: 'Shipping', href: '/pages/shipping' },
  { label: 'Returns & Exchanges', href: '/pages/returns' },
  { label: 'Contact', href: '/pages/contact' },
  { label: 'Gift Cards', href: '/collections/gift-cards' },
];

const companyLinks = [
  { label: 'About', href: '/pages/about' },
  { label: 'Journal', href: '/journal' },
  { label: 'Stores', href: '/pages/stores' },
  { label: 'Careers', href: '/pages/careers' },
  { label: 'Eye exams', href: '/pages/eye-test' },
  { label: 'Press', href: '/pages/press' },
  { label: 'Wholesale', href: '/pages/wholesale' },
];

const legalLinks = [
  { label: 'Privacy Policy', href: '/pages/privacy-policy' },
  { label: 'Terms of Service', href: '/pages/terms-of-service' },
  { label: 'Acceptable Use', href: '/pages/acceptable-use' },
  { label: 'Code of Conduct', href: '/pages/code-of-conduct' },
];

function FooterLinkColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-gray-500 transition-colors hover:text-gray-900">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Instagram icon */
function InstagramIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

/** TikTok icon */
function TikTokIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78 2.92 2.92 0 0 1 .88.13v-3.5a6.37 6.37 0 0 0-.88-.07 6.37 6.37 0 0 0 0 12.74 6.37 6.37 0 0 0 6.38-6.38V9.42a8.2 8.2 0 0 0 3.72.89V6.69z" />
    </svg>
  );
}

/** Payment method icons (Visa, Mastercard, Amex, Apple Pay) */
function PaymentIcons() {
  return (
    <div className="flex items-center gap-2" aria-label="Accepted payment methods">
      {/* Visa */}
      <span className="inline-flex h-6 w-9 items-center justify-center rounded border border-gray-200 bg-white text-[8px] font-bold text-blue-700">
        VISA
      </span>
      {/* Mastercard */}
      <span className="inline-flex h-6 w-9 items-center justify-center rounded border border-gray-200 bg-white text-[8px] font-bold text-red-600">
        MC
      </span>
      {/* Amex */}
      <span className="inline-flex h-6 w-9 items-center justify-center rounded border border-gray-200 bg-white text-[8px] font-bold text-blue-500">
        AMEX
      </span>
      {/* Apple Pay */}
      <span className="inline-flex h-6 w-9 items-center justify-center rounded border border-gray-200 bg-white text-[8px] font-bold text-gray-900">
        Pay
      </span>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      {/* Main footer content */}
      <div className="site-container pb-8 pt-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Column 1: Newsletter + Social */}
          <div>
            <NewsletterSignup />
            <div className="mt-6 flex items-center gap-4 text-gray-500">
              <a
                href="https://instagram.com/lunettiq"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Lunettiq on Instagram"
                className="transition-colors hover:text-gray-900"
              >
                <InstagramIcon />
              </a>
              <a
                href="https://tiktok.com/@lunettiq"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Lunettiq on TikTok"
                className="transition-colors hover:text-gray-900"
              >
                <TikTokIcon />
              </a>
            </div>
          </div>

          {/* Column 2: Shop */}
          <FooterLinkColumn title="Shop" links={shopLinks} />

          {/* Column 3: Help */}
          <FooterLinkColumn title="Help" links={helpLinks} />

          {/* Column 4: Company */}
          <FooterLinkColumn title="Company" links={companyLinks} />
        </div>
      </div>

      {/* Footer bar */}
      <div className="border-t border-gray-100">
        <div className="site-container flex flex-col items-center gap-4 py-5 text-xs text-gray-400 sm:flex-row sm:justify-between">
          {/* Left: Copyright + Payment */}
          <div className="flex items-center gap-4">
            <span>© {new Date().getFullYear()} Lunettiq</span>
            <PaymentIcons />
          </div>

          {/* Center: Legal links */}
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {legalLinks.map((link, i) => (
              <span key={link.href} className="flex items-center gap-3">
                {i > 0 && <span aria-hidden="true" className="text-gray-300">/</span>}
                <Link href={link.href} className="transition-colors hover:text-gray-700">
                  {link.label}
                </Link>
              </span>
            ))}
          </nav>

          {/* Right: Currency + Language */}
          <div className="flex items-center gap-4">
            <CurrencySelector />
            <LanguageSelector />
          </div>
        </div>
      </div>
    </footer>
  );
}
