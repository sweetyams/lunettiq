import Image from 'next/image';
import Link from 'next/link';

interface StoreTeaserProps {
  image?: string;
  title?: string;
}

export default function StoreTeaser({ image, title = 'Visit Our Stores' }: StoreTeaserProps) {
  return (
    <Link href="/pages/stores" className="block relative w-full h-[500px] md:h-[700px] overflow-hidden group">
      {image ? (
        <Image
          src={image}
          alt={title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="100vw"
        />
      ) : (
        <div className="absolute inset-0 bg-gray-200" />
      )}
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white text-2xl md:text-4xl font-light tracking-wide">
          {title}
        </span>
      </div>
    </Link>
  );
}
