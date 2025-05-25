import { ReactNode, useEffect, useRef } from "react";
import { Button } from "../common/Button";

interface RegenerateModalProps {
  open: boolean;
  originalImageUrl: string;
  decoratedImageUrl: string;
  onSelectOriginal: () => void;
  onSelectDecorated: () => void;
  onCancel: () => void;
}

export function RegenerateModal({
  open,
  originalImageUrl,
  decoratedImageUrl,
  onSelectOriginal,
  onSelectDecorated,
  onCancel,
}: RegenerateModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const originalButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    originalButtonRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === overlayRef.current) onCancel();
      }}
      aria-modal="true"
      role="dialog"
      tabIndex={-1}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[calc(100vh-20px)] animate-modalIn flex flex-col">
        <button
          className="absolute top-2 right-2 z-10 bg-white rounded-full p-2 shadow border border-gray-200 hover:bg-blue-50 transition-colors"
          onClick={onCancel}
          aria-label="Close dialog"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5 text-blue-600"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h3 className="text-lg font-semibold text-slate-800 mb-4 text-center">
          Choose Base Image
        </h3>

        <p className="text-gray-600 text-center mb-6 text-sm">
          Which image would you like to use as the starting point for
          regeneration?
        </p>

        <div className="flex flex-col gap-4 mb-6 overflow-y-auto flex-1">
          {/* Original Image Option */}
          <button
            ref={originalButtonRef}
            onClick={onSelectOriginal}
            className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
          >
            <img
              src={originalImageUrl}
              alt="Original"
              className="w-full h-32 object-cover rounded-lg mb-2"
            />
            <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
              Original Image
            </span>
          </button>

          {/* Decorated Image Option */}
          <button
            onClick={onSelectDecorated}
            className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
          >
            <img
              src={decoratedImageUrl}
              alt="Decorated"
              className="w-full h-32 object-cover rounded-lg mb-2"
            />
            <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
              Decorated Image
            </span>
          </button>
        </div>

        <Button variant="secondary" fullWidth onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease;
        }
        @keyframes modalIn {
          from { transform: scale(0.95) translateY(40px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
        .animate-modalIn {
          animation: modalIn 0.25s cubic-bezier(0.4,0,0.2,1);
        }
      `}</style>
    </div>
  );
}
