import { useState, useRef } from "react";

interface UploadedImageProps {
  imageUrl: string;
}

export function UploadedImage({ imageUrl }: UploadedImageProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeout = useRef<NodeJS.Timeout | null>(null);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="bg-white/80 border border-[var(--color-border)] rounded-2xl shadow-xl flex items-center justify-center w-full h-full p-4">
        <img
          src={imageUrl}
          alt="Uploaded"
          className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-md transition-all duration-300"
        />
        <div className="absolute top-4 left-4">
          <button
            className="group relative"
            onMouseEnter={() => {
              if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
              setShowTooltip(true);
            }}
            onMouseLeave={() => {
              tooltipTimeout.current = setTimeout(
                () => setShowTooltip(false),
                200
              );
            }}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            aria-label="Info about preview"
          >
            <span className="text-blue-400 text-xl bg-white/80 rounded-full p-1 shadow-sm border border-[var(--color-border)]">
              ⓘ
            </span>
            {showTooltip && (
              <span className="absolute left-8 top-1/2 -translate-y-1/2 bg-white/90 text-xs text-gray-600 rounded-lg shadow px-3 py-2 z-20 fade-in border border-[var(--color-border)] min-w-[180px]">
                Hold or hover the image after generation to compare the original
                and decorated versions.
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
