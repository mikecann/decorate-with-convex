import { useState } from "react";
import { FullscreenModal } from "./FullscreenModal";

interface ImageViewerProps {
  src: string;
  alt?: string;
  className?: string;
  children?: React.ReactNode; // overlays
  modalAlt?: string;
}

export function ImageViewer({
  src,
  alt,
  className = "",
  children,
  modalAlt,
}: ImageViewerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className={`relative cursor-zoom-in ${className} rounded-2xl overflow-hidden`}
        tabIndex={0}
        role="button"
        aria-label="View image fullscreen"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen(true);
        }}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-[calc(var(--vh,1vh)*60)] max-w-full object-contain w-full h-full"
        />
        {children}
      </div>
      <FullscreenModal open={open} onClose={() => setOpen(false)}>
        <img
          src={src}
          alt={modalAlt || alt}
          className="max-h-[calc(var(--vh,1vh)*95)] max-w-[95vw] object-contain rounded-2xl shadow-xl bg-white"
        />
      </FullscreenModal>
    </>
  );
}
