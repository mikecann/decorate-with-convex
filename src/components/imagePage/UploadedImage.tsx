import { useState, useRef } from "react";
import { Button } from "../../common/Button";

interface UploadedImageProps {
  imageUrl: string;
}

export function UploadedImage({ imageUrl }: UploadedImageProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeout = useRef<NodeJS.Timeout | null>(null);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="flex items-center justify-center w-full h-full p-4">
        <img
          src={imageUrl}
          alt="Uploaded"
          className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-lg transition-all duration-300"
        />
      </div>
    </div>
  );
}
