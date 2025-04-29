import { Card } from "../common/Card";
import { routes } from "../routes";
import React from "react";

interface ImageCardProps {
  image: any; // Replace with proper Image type if available
}

export function ImageCard({ image }: ImageCardProps) {
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
    image.status.kind === "generating" || image.status.kind === "generated"
      ? image.status.prompt
      : undefined;

  return (
    <Card
      className="cursor-pointer hover:shadow-xl transition-shadow flex flex-col gap-2 group border border-[var(--color-border)] relative"
      onClick={() => routes.image({ imageId: image._id.toString() }).push()}
      tabIndex={0}
      role="button"
      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ")
          routes.image({ imageId: image._id.toString() }).push();
      }}
    >
      {/* Status pill */}
      <div
        className={`absolute top-3 right-3 px-3 py-1 z-10 rounded-full text-xs font-semibold border shadow-sm ${statusColor}`}
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
    </Card>
  );
}
