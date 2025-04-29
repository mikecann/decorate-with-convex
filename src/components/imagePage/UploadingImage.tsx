import { Id } from "../../../convex/_generated/dataModel";
import { getUploadingImageObjectUrl } from "../../lib/utils";

interface UploadingImageProps {
  imageId: Id<"images">;
}

export function UploadingImage({ imageId }: UploadingImageProps) {
  const objectUrl = getUploadingImageObjectUrl(imageId as string);

  if (!objectUrl) {
    return (
      <div className="animate-pulse bg-gray-200 h-80 w-full rounded-2xl flex items-center justify-center">
        <span className="text-lg text-gray-500">Uploading...</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="flex items-center justify-center w-full h-full p-4">
        <img
          src={objectUrl}
          alt="Uploading preview"
          className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-lg opacity-60 transition-all duration-300"
        />
        <div className="absolute top-4 right-4">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-blue-500 border-gray-200 bg-white/70"></div>
        </div>
      </div>
    </div>
  );
}
