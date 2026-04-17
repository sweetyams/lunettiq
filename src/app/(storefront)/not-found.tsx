import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <h1 className="text-6xl font-light mb-4">404</h1>
      <p className="text-lg text-gray-600 mb-2">Page not found</p>
      <p className="text-sm text-gray-400 mb-8">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="inline-block px-8 py-3 bg-black text-white text-sm rounded-full hover:bg-gray-800 transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}
