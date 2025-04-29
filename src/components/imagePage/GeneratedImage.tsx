import { useState } from "react";
import { Download } from "lucide-react";
import Tabs from "../../common/Tabs";
import { ImageViewer } from "./ImageViewer";

interface GeneratedImageProps {
  originalImageUrl: string;
  decoratedImageUrl: string;
  prompt: string;
}

export function GeneratedImage({
  originalImageUrl,
  decoratedImageUrl,
  prompt,
}: GeneratedImageProps) {
  const [tabIndex, setTabIndex] = useState(1);

  const currentImageUrl = tabIndex === 0 ? originalImageUrl : decoratedImageUrl;
  const currentImageType = tabIndex === 0 ? "original" : "decorated";

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <Tabs
        tabs={["Original", "Decorated"]}
        selectedIndex={tabIndex}
        onTabChange={setTabIndex}
      />
      <div className="rounded-2xl flex items-center justify-center w-full p-4 transition-all duration-300">
        <div className="relative w-full h-full flex items-center justify-center">
          <ImageViewer src={currentImageUrl} alt={currentImageType}>
            <a
              href={currentImageUrl}
              download={
                currentImageUrl.split("/").pop() ||
                `${currentImageType}-image.webp`
              }
              className="absolute top-2 right-2 z-2 bg-white/80 rounded-full p-2 shadow border border-gray-200 hover:bg-blue-50 transition-colors"
              title={`Download ${currentImageType} image`}
              aria-label={`Download ${currentImageType} image`}
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="w-5 h-5 text-blue-600" />
            </a>
            {prompt && currentImageType == "decorated" && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-center font-medium px-4 py-2 bg-white/80 rounded shadow">
                <span className="italic">{prompt}</span>
              </div>
            )}
          </ImageViewer>
        </div>
      </div>
    </div>
  );
}
