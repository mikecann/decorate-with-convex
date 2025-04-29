import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useApiErrorHandler } from "../../lib/error";
import { routes } from "../../routes";
import { useState } from "react";

interface PromptPanelProps {
  imageId: Id<"images">;
  canGenerate: boolean;
  currentPrompt?: string;
}

const defaultPrompt =
  "Please decordate this so it looks like a professional interior decorator has designed it";

export function PromptPanel({
  imageId,
  canGenerate,
  currentPrompt,
}: PromptPanelProps) {
  const startGeneration = useMutation(api.images.startGeneration);
  const deleteImage = useMutation(api.images.deleteImage);
  const onApiError = useApiErrorHandler();
  const [prompt, setPrompt] = useState(defaultPrompt);

  const handleDelete = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete this image? This action cannot be undone."
      )
    ) {
      await deleteImage({ imageId }).catch(onApiError);
      routes.dashboard().push();
    }
  };

  return (
    <div className="flex flex-col justify-between w-full md:w-1/2 max-w-xl bg-white r p-8 md:p-12 overflow-y-auto min-h-[320px] border-r border-[var(--color-border)]">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-slate-800">Image Prompt</h2>
        <p className="text-sm text-gray-500 mb-4">
          Enter a description of how you want your image to be decorated.
        </p>
        <textarea
          id="prompt"
          className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[200px] resize-y text-base mb-4 shadow-sm"
          value={currentPrompt ?? prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={defaultPrompt}
          disabled={!canGenerate}
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
              imageId,
              prompt,
            }).catch(onApiError);
          }}
        >
          {currentPrompt ? "Re-generate" : "Generate"}
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
  );
}
