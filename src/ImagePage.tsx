import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { routes } from "./routes";
import { useCallback, useState } from "react";
import type { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";
import { useApiErrorHandler } from "./lib/error";
interface ImageProgressPageProps {
  imageId: Id<"images">;
}

export default function ImagePage({ imageId }: ImageProgressPageProps) {
  const image = useQuery(api.images.getImage, {
    imageId,
  });
  const onApiError = useApiErrorHandler();

  const [prompt, setPrompt] = useState(
    "A beautiful painting in the style of Van Gogh"
  );

  const [previewOriginal, setPreviewOriginal] = useState(false);

  const handleBack = useCallback(() => {
    routes.dashboard().push();
  }, []);

  const startGeneration = useMutation(api.images.startGeneration);
  const deleteImage = useMutation(api.images.deleteImage);

  const handleDelete = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete this image? This action cannot be undone."
      )
    ) {
      await deleteImage({ imageId: imageId as Id<"images"> }).catch(onApiError);
      routes.dashboard().push();
    }
  };

  const canGenerate =
    !!image &&
    (image.status.kind === "uploaded" || image.status.kind === "generated");

  return (
    <div className="relative max-w-lg mx-auto w-full space-y-8">
      <button
        className="absolute top-4 left-4 z-20 bg-white rounded-full shadow p-2 text-gray-700 hover:bg-gray-100"
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
            src={image.status.image.url}
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
          <div
            className="relative w-full h-64"
            onMouseEnter={() => setPreviewOriginal(true)}
            onMouseLeave={() => setPreviewOriginal(false)}
            onPointerDown={() => setPreviewOriginal(true)}
            onPointerUp={() => setPreviewOriginal(false)}
            onPointerCancel={() => setPreviewOriginal(false)}
            tabIndex={0}
            aria-label="Hold or hover to preview original image"
          >
            <img
              src={
                previewOriginal
                  ? image.status.image.url
                  : image.status.decoratedImage.url
              }
              alt={previewOriginal ? "Original" : "Decorated"}
              className="w-full h-64 object-cover rounded-lg transition-opacity duration-200"
            />
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-2 py-1 rounded">
              {previewOriginal ? "Original" : "Decorated"} (hold or hover to
              preview original)
            </div>
          </div>
        )}
        <div className="text-sm text-gray-500 text-center font-medium mt-4">
          {(!image || image.status.kind === "uploading") && "Uploading..."}
          {image && image.status.kind === "uploaded" && "Uploaded"}
          {image && image.status.kind === "generating" && "Generating..."}
          {image && image.status.kind === "generated" && "Generation complete!"}
        </div>
        <div className="mt-6">
          <label
            htmlFor="prompt"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Image Prompt
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Enter a description of how you want your image to be decorated. For
            example:{" "}
            <span className="italic">
              A beautiful painting in the style of Van Gogh
            </span>
          </p>
          <textarea
            id="prompt"
            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-y"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A beautiful painting in the style of Van Gogh"
          />
          <button
            className="mt-4 w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canGenerate}
            onClick={() => {
              if (!canGenerate) {
                toast.error(
                  "Please wait for the image to finish uploading before generating."
                );
                return;
              }
              startGeneration({
                imageId: imageId as Id<"images">,
                prompt,
              }).catch(onApiError);
            }}
          >
            {image && image.status.kind === "generated"
              ? "Re-generate"
              : "Generate"}
          </button>
          <button
            className="mt-2 w-full py-2 rounded-lg border border-red-200 text-red-600 bg-transparent hover:bg-red-50 transition-colors"
            onClick={handleDelete}
            aria-label="Delete"
          >
            Delete image
          </button>
        </div>
      </div>
    </div>
  );
}
