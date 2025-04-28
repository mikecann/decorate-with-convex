import { useCallback, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { routes } from "./routes";

export default function Dashboard() {
  const images = useQuery(api.images.listImages) || [];
  const generateUploadUrl = useMutation(api.images.generateUploadUrl);
  const markUploaded = useMutation(api.images.markUploaded);
  const startGeneration = useMutation(api.images.startGeneration);
  const [isDragging, setIsDragging] = useState(false);

  const handleUpload = useCallback(
    async (file: File) => {
      try {
        const { uploadUrl, imageId } = await generateUploadUrl();
        // Navigate to progress page immediately
        routes.imageProgress({ imageId: imageId.toString() }).push();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await result.json();
        await markUploaded({ imageId, storageId });
        toast.success("Image uploaded successfully!");
      } catch (error) {
        toast.error("Failed to upload image");
        console.error(error);
      }
    },
    [generateUploadUrl, markUploaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        handleUpload(file);
      } else {
        toast.error("Please drop an image file");
      }
    },
    [handleUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleUpload(file);
      }
    },
    [handleUpload]
  );

  return (
    <div className="max-w-4xl mx-auto w-full space-y-8">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="text-4xl">📸</div>
          <div>
            <p className="text-lg font-medium">Drop your image here</p>
            <p className="text-sm text-gray-500">or</p>
            <label className="mt-2 inline-block">
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect}
                capture="environment"
              />
              <span className="cursor-pointer text-blue-500 hover:text-blue-600">
                Select a file
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {images.map((image) => (
          <div key={image._id} className="border rounded-lg p-4 space-y-4">
            {image.status.kind === "uploading" && (
              <div className="animate-pulse bg-gray-200 h-48 rounded-lg flex items-center justify-center">
                Uploading...
              </div>
            )}
            {image.status.kind === "uploaded" && (
              <div className="space-y-4">
                <img
                  src={image.status.url}
                  alt="Original"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  onClick={() => startGeneration({ imageId: image._id })}
                  className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
                >
                  Start Generation
                </button>
              </div>
            )}
            {image.status.kind === "generating" && (
              <div className="space-y-4">
                <div className="animate-pulse bg-gray-200 h-48 rounded-lg flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              </div>
            )}
            {image.status.kind === "generated" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <img
                    src={image.status.originalUrl}
                    alt="Original"
                    className="w-full h-24 object-cover rounded-lg"
                  />
                  <img
                    src={image.status.decoratedUrl}
                    alt="Decorated"
                    className="w-full h-24 object-cover rounded-lg"
                  />
                </div>
                <p className="text-sm text-gray-500 text-center">
                  Generation complete!
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
