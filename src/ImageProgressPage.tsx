import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { routes } from "./routes";
import { useCallback } from "react";
import type { Id } from "../convex/_generated/dataModel";

interface ImageProgressPageProps {
  imageId: string;
}

export default function ImageProgressPage({ imageId }: ImageProgressPageProps) {
  const image = useQuery(api.images.getImage, {
    imageId: imageId as Id<"images">,
  });

  const handleBack = useCallback(() => {
    routes.dashboard().push();
  }, []);

  return (
    <div className="relative max-w-lg mx-auto w-full space-y-8">
      <button
        className="absolute top-4 left-4 bg-white rounded-full shadow p-2 text-gray-700 hover:bg-gray-100"
        onClick={handleBack}
        aria-label="Back"
      >
        ← Back
      </button>
      <div className="mt-12">
        {(!image || image.status.kind === "uploading") && (
          <div className="animate-pulse bg-gray-200 h-64 rounded-lg flex items-center justify-center">
            <span className="text-lg text-gray-500">Uploading...</span>
          </div>
        )}
        {image && image.status.kind === "uploaded" && (
          <img
            src={image.status.url}
            alt="Uploaded"
            className="w-full h-64 object-cover rounded-lg"
          />
        )}
        {image && image.status.kind === "generating" && (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
            <span className="text-lg text-gray-500">Generating...</span>
          </div>
        )}
        {image && image.status.kind === "generated" && (
          <img
            src={image.status.decoratedUrl}
            alt="Decorated"
            className="w-full h-64 object-cover rounded-lg"
          />
        )}
        <div className="text-sm text-gray-500 text-center font-medium mt-4">
          {(!image || image.status.kind === "uploading") && "Uploading..."}
          {image && image.status.kind === "uploaded" && "Uploaded"}
          {image && image.status.kind === "generating" && "Generating..."}
          {image && image.status.kind === "generated" && "Generation complete!"}
        </div>
      </div>
    </div>
  );
}
