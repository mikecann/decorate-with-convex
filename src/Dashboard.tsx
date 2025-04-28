import { useCallback, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { routes } from "./routes";
import { useApiErrorHandler } from "./lib/error";
import {
  setUploadingImageObjectUrl,
  clearUploadingImageObjectUrl,
  useImageUpload,
} from "./lib/utils";

export default function Dashboard() {
  const images = useQuery(api.images.listImages) || [];
  const generateUploadUrl = useMutation(api.images.generateUploadUrl);
  const markUploaded = useMutation(api.images.markUploaded);
  const [isDragging, setIsDragging] = useState(false);
  const onApiError = useApiErrorHandler();
  const handleUpload = useImageUpload();

  return (
    <div className="max-w-6xl p-4 md:p-8 mx-auto w-full space-y-10">
      <div
        className={`card border-2 border-dashed p-10 text-center transition-colors flex flex-col items-center justify-center mb-8 ${
          isDragging
            ? "border-blue-400 bg-blue-50"
            : "border-[var(--color-border)] bg-white"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && file.type.startsWith("image/")) handleUpload(file);
          else toast.error("Please drop an image file");
        }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl text-blue-400 mb-2">📸</div>
          <div>
            <p className="text-2xl font-bold text-slate-800 mb-1">
              Upload your image
            </p>
            <p className="text-base text-gray-500 mb-2">
              Drag & drop or select a file to get started
            </p>
            <label className="mt-2 inline-block cursor-pointer">
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  handleUpload(file);
                }}
                capture="environment"
              />
              <span className="button px-6 py-2">Select a file</span>
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {images.map((image) => {
          let statusLabel = "";
          let statusColor = "";
          if (image.status.kind === "uploading") {
            statusLabel = "Uploading";
            statusColor = "bg-gray-200 text-gray-700 border-gray-300";
          } else if (image.status.kind === "uploaded") {
            statusLabel = "Uploaded";
            statusColor = "bg-blue-100 text-blue-700 border-blue-200";
          } else if (image.status.kind === "generating") {
            statusLabel = "Generating";
            statusColor = "bg-yellow-100 text-yellow-800 border-yellow-300";
          } else if (image.status.kind === "generated") {
            statusLabel = "Complete";
            statusColor = "bg-green-100 text-green-700 border-green-200";
          }

          // Prompt is only present for generating/generated
          const prompt =
            image.status.kind === "generating" ||
            image.status.kind === "generated"
              ? image.status.prompt
              : undefined;

          return (
            <div
              key={image._id}
              className="card cursor-pointer hover:shadow-xl transition-shadow flex flex-col gap-2 group border border-[var(--color-border)] relative"
              onClick={() =>
                routes.image({ imageId: image._id.toString() }).push()
              }
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  routes.image({ imageId: image._id.toString() }).push();
              }}
            >
              {/* Status pill */}
              <div
                className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold border shadow-sm ${statusColor}`}
              >
                {statusLabel}
              </div>
              {/* Image(s) */}
              {image.status.kind === "uploading" && (
                <div className="animate-pulse bg-gray-200 h-48 rounded-lg flex items-center justify-center w-full">
                  <span className="text-lg text-gray-500">Uploading...</span>
                </div>
              )}
              {image.status.kind === "uploaded" && (
                <img
                  src={image.status.image.url}
                  alt="Original"
                  className="w-full h-48 object-cover rounded-lg"
                />
              )}
              {image.status.kind === "generating" && (
                <div className="relative w-full h-48 flex items-center justify-center">
                  <img
                    src={image.status.image.url}
                    alt="Original"
                    className="w-full h-48 object-cover rounded-lg opacity-60"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded-lg z-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-t-blue-400 border-gray-200 mb-2 bg-white/70"></div>
                    <span className="text-sm text-white font-semibold">
                      Generating...
                    </span>
                  </div>
                </div>
              )}
              {image.status.kind === "generated" && (
                <div className="grid grid-cols-2 gap-2">
                  <img
                    src={image.status.image.url}
                    alt="Original"
                    className="w-full h-24 object-cover rounded-lg"
                  />
                  <img
                    src={image.status.decoratedImage.url}
                    alt="Decorated"
                    className="w-full h-24 object-cover rounded-lg"
                  />
                </div>
              )}
              {/* Prompt text */}
              {prompt && (
                <div
                  className="text-xs text-gray-600 italic mt-2 truncate"
                  title={prompt}
                >
                  {prompt}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
