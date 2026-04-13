import Link from 'next/link';
import PrimaryNav from './PrimaryNav';
import SecondaryNav from './SecondaryNav';

export default function Header() {
  return (
    <header className="sticky top-0 z-40 hidden border-b border-gray-200 bg-white lg:block">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Logo */}
        <Link href="/" className="text-lg font-semibold tracking-wide text-black">
          Lunettiq
        </Link>

        {/* Primary Nav (center-left) */}
        <PrimaryNav />

        {/* Secondary Nav (right) */}
        <SecondaryNav />
      </div>
    </header>
  );
}
