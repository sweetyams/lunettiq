'use client';

interface Props {
  frameWidth?: number | null;
  lensWidth?: number | null;
  lensHeight?: number | null;
  bridgeWidth?: number | null;
  templeLength?: number | null;
}

export default function SizeGuide({ frameWidth, lensWidth, lensHeight, bridgeWidth, templeLength }: Props) {
  const hasDimensions = frameWidth || lensWidth || bridgeWidth || templeLength;
  if (!hasDimensions) return <p className="text-sm text-gray-400">No dimension data available.</p>;

  // Classify size
  const size = frameWidth ? (frameWidth < 130 ? 'Small' : frameWidth < 140 ? 'Medium' : 'Large') : null;

  return (
    <div>
      {/* Visual diagram */}
      <div className="relative mx-auto mb-6" style={{ width: 240, height: 100 }}>
        <svg viewBox="0 0 240 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
          {/* Left lens */}
          <rect x="20" y="20" width="80" height="50" rx="12" stroke="#333" strokeWidth="1.5" fill="none" />
          {/* Right lens */}
          <rect x="140" y="20" width="80" height="50" rx="12" stroke="#333" strokeWidth="1.5" fill="none" />
          {/* Bridge */}
          <path d="M100 40 Q120 30 140 40" stroke="#333" strokeWidth="1.5" fill="none" />
          {/* Temples */}
          <line x1="20" y1="30" x2="2" y2="25" stroke="#333" strokeWidth="1.5" />
          <line x1="220" y1="30" x2="238" y2="25" stroke="#333" strokeWidth="1.5" />

          {/* Lens width dimension */}
          {lensWidth && <>
            <line x1="22" y1="78" x2="98" y2="78" stroke="#999" strokeWidth="0.5" />
            <text x="60" y="90" textAnchor="middle" fontSize="9" fill="#999">{lensWidth}mm</text>
          </>}
          {/* Bridge dimension */}
          {bridgeWidth && <>
            <line x1="102" y1="50" x2="138" y2="50" stroke="#999" strokeWidth="0.5" />
            <text x="120" y="62" textAnchor="middle" fontSize="9" fill="#999">{bridgeWidth}mm</text>
          </>}
        </svg>
      </div>

      {/* Measurements table */}
      <div className="space-y-2 text-sm">
        {frameWidth && (
          <div className="flex justify-between">
            <span className="text-gray-500">Frame width</span>
            <span className="font-medium">{frameWidth}mm {size && <span className="text-xs text-gray-400 ml-1">({size})</span>}</span>
          </div>
        )}
        {lensWidth && (
          <div className="flex justify-between">
            <span className="text-gray-500">Lens width</span>
            <span>{lensWidth}mm</span>
          </div>
        )}
        {lensHeight && (
          <div className="flex justify-between">
            <span className="text-gray-500">Lens height</span>
            <span>{lensHeight}mm</span>
          </div>
        )}
        {bridgeWidth && (
          <div className="flex justify-between">
            <span className="text-gray-500">Bridge</span>
            <span>{bridgeWidth}mm</span>
          </div>
        )}
        {templeLength && (
          <div className="flex justify-between">
            <span className="text-gray-500">Temple length</span>
            <span>{templeLength}mm</span>
          </div>
        )}
      </div>

      {/* Size recommendation */}
      {size && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {['Small', 'Medium', 'Large'].map(s => (
                <div key={s} className={`w-8 h-2 rounded-full ${s === size ? 'bg-black' : 'bg-gray-200'}`} />
              ))}
            </div>
            <span className="text-xs text-gray-500">{size} fit — {size === 'Small' ? 'narrow faces' : size === 'Medium' ? 'most faces' : 'wider faces'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
