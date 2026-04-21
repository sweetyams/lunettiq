import Image from 'next/image';

interface OnFacesSectionProps {
  onFaceImages?: string[];
  faceNotes?: string;
}

export default function OnFacesSection({
  onFaceImages,
  faceNotes,
}: OnFacesSectionProps) {
  // Conditionally render only when data exists
  if (!onFaceImages || onFaceImages.length === 0) {
    return null;
  }

  return (
    <section className="py-12 border-t border-gray-100" aria-label="On faces">
      <h2 className="text-xl font-light tracking-wide mb-6">On Faces</h2>

      {faceNotes && (
        <p className="text-sm text-gray-600 mb-6 max-w-2xl">{faceNotes}</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {onFaceImages.map((url, index) => (
          <div
            key={index}
            className="relative bg-[var(--product-card-bg,#F5F5F9)] overflow-hidden"
            style={{ aspectRatio: '1/1' }}
          >
            <Image
              src={url}
              alt={`On face view ${index + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
