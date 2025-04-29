import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { routes } from "./routes";
import { useState, useRef } from "react";
import type { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";
import { useApiErrorHandler } from "./lib/error";
import { getUploadingImageObjectUrl } from "./lib/utils";
import { Download } from "lucide-react";
import Tabs from "./common/Tabs";

interface ImageProgressPageProps {
  imageId: Id<"images">;
}

const defaultPrompt =
  "Please decordate this so it looks like a professional interior decorator has designed it";

export default function ImagePage({ imageId }: ImageProgressPageProps) {
  const image = useQuery(api.images.getImage, {
    imageId,
  });
  const onApiError = useApiErrorHandler();

  const [prompt, setPrompt] = useState(defaultPrompt);

  const promptFromStatus =
    image &&
    (image.status.kind === "generating" || image.status.kind === "generated")
      ? image.status.prompt
      : undefined;

  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeout = useRef<NodeJS.Timeout | null>(null);
  const [tabIndex, setTabIndex] = useState(1);

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
    <div className="relative flex flex-col-reverse md:flex-row flex-1 w-full bg-[var(--color-bg)] ">
      {/* Left: Prompt & Controls */}
      <div className="flex flex-col justify-between w-full md:w-1/2 max-w-xl bg-white r p-8 md:p-12 overflow-y-auto min-h-[320px] border-r border-[var(--color-border)]">
        <div>
          <h2 className="text-2xl font-bold mb-4 text-slate-800">
            Image Prompt
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Enter a description of how you want your image to be decorated.
          </p>
          <textarea
            id="prompt"
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[200px] resize-y text-base mb-4 shadow-sm"
            value={promptFromStatus ?? prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={defaultPrompt}
            disabled={image && image.status.kind === "generating"}
          />
        </div>
        <div className="flex flex-col gap-2 mt-4">
          <button
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold text-lg shadow hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="w-full py-2 rounded-lg border border-red-200 text-red-600 bg-transparent hover:bg-red-50 transition-colors font-semibold"
            onClick={handleDelete}
            aria-label="Delete"
          >
            Delete image
          </button>
        </div>
      </div>
      {/* Right: Image Area */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br  min-h-[320px] relative overflow-hidden">
        <div className="flex flex-col items-center justify-center w-full h-full p-4 md:p-8">
          {(!image || image.status.kind === "uploading") &&
            (() => {
              const objectUrl = getUploadingImageObjectUrl(imageId as string);
              return objectUrl ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <div className="bg-white/80 border border-[var(--color-border)] rounded-2xl shadow-xl flex items-center justify-center w-full h-full p-4">
                    <img
                      src={objectUrl}
                      alt="Uploading preview"
                      className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-md opacity-60 transition-all duration-300"
                    />
                    <div className="absolute top-4 right-4">
                      <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-blue-500 border-gray-200 bg-white/70"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="animate-pulse bg-gray-200 h-80 w-full rounded-2xl flex items-center justify-center">
                  <span className="text-lg text-gray-500">Uploading...</span>
                </div>
              );
            })()}
          {image && image.status.kind === "uploaded" && (
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="bg-white/80 border border-[var(--color-border)] rounded-2xl shadow-xl flex items-center justify-center w-full h-full p-4">
                <img
                  src={image.status.image.url}
                  alt="Uploaded"
                  className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-md transition-all duration-300"
                />
                {/* Subtle info icon for hover/click */}
                <div className="absolute top-4 left-4">
                  <button
                    className="group relative"
                    onMouseEnter={() => {
                      if (tooltipTimeout.current)
                        clearTimeout(tooltipTimeout.current);
                      setShowTooltip(true);
                    }}
                    onMouseLeave={() => {
                      tooltipTimeout.current = setTimeout(
                        () => setShowTooltip(false),
                        200
                      );
                    }}
                    onFocus={() => setShowTooltip(true)}
                    onBlur={() => setShowTooltip(false)}
                    aria-label="Info about preview"
                  >
                    <span className="text-blue-400 text-xl bg-white/80 rounded-full p-1 shadow-sm border border-[var(--color-border)]">
                      ⓘ
                    </span>
                    {showTooltip && (
                      <span className="absolute left-8 top-1/2 -translate-y-1/2 bg-white/90 text-xs text-gray-600 rounded-lg shadow px-3 py-2 z-20 fade-in border border-[var(--color-border)] min-w-[180px]">
                        Hold or hover the image after generation to compare the
                        original and decorated versions.
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
          {image && image.status.kind === "generating" && (
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="bg-white/80 border border-[var(--color-border)] rounded-2xl shadow-xl flex items-center justify-center w-full h-full p-4">
                <img
                  src={image.status.image.url}
                  alt="Original"
                  className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-md transition-all duration-300"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm rounded-2xl z-10">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-blue-500 border-gray-200 mb-4 bg-white/80"></div>
                  <span className="text-xl text-gray-700 font-semibold mb-2">
                    Generating...
                  </span>
                  {promptFromStatus && (
                    <span className="text-base text-gray-600 text-center px-2">
                      Prompt: <span className="italic">{promptFromStatus}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          {image && image.status.kind === "generated" && (
            <div className="relative w-full h-full flex flex-col items-center justify-center">
              <Tabs
                tabs={["Original", "Decorated"]}
                selectedIndex={tabIndex}
                onTabChange={setTabIndex}
              />
              <div className="rounded-2xl flex items-center justify-center w-full  p-4 transition-all duration-300">
                <div className="relative w-full h-full flex items-center justify-center">
                  <div className="relative">
                    {/* Download button in top-right */}
                    <a
                      href={
                        tabIndex === 0
                          ? image.status.image.url
                          : image.status.decoratedImage.url
                      }
                      download={
                        tabIndex === 0
                          ? image.status.image.url.split("/").pop() ||
                            "original-image.webp"
                          : image.status.decoratedImage.url.split("/").pop() ||
                            "decorated-image.webp"
                      }
                      className="absolute top-2 right-2 z-20 bg-white/80 rounded-full p-2 shadow border border-gray-200 hover:bg-blue-50 transition-colors"
                      title={
                        tabIndex === 0
                          ? "Download original image"
                          : "Download decorated image"
                      }
                      aria-label={
                        tabIndex === 0
                          ? "Download original image"
                          : "Download decorated image"
                      }
                    >
                      <Download className="w-5 h-5 text-blue-600" />
                    </a>
                    <img
                      src={
                        tabIndex === 0
                          ? image.status.image.url
                          : image.status.decoratedImage.url
                      }
                      alt={tabIndex === 0 ? "Original" : "Decorated"}
                      className="max-h-[60vh] max-w-full object-contain rounded-md shadow-md transition-opacity duration-200"
                    />
                    {/* Pill badge for prompt */}
                    {promptFromStatus && (
                      <div className="text-xs text-center font-medium px-4 py-2">
                        <span className="italic">{promptFromStatus}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
