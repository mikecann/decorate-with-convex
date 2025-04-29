import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useApiErrorHandler } from "../../lib/error";
import { routes } from "../../routes";
import { useState } from "react";
import { Button } from "../../common/Button";
import { ConfirmDialog } from "../../common/ConfirmDialog";

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
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setShowConfirm(false);
    await deleteImage({ imageId }).catch(onApiError);
    routes.dashboard().push();
  };

  return (
    <div className="flex flex-col justify-between w-full md:w-1/2 md:max-w-[500px] max-w-full bg-white r p-8 pb-[100px] md:p-12 overflow-y-auto min-h-[320px] border-r border-[var(--color-border)]">
      <ConfirmDialog
        open={showConfirm}
        title="Delete image"
        message="Are you sure you want to delete this image? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowConfirm(false)}
      />
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
        <Button
          variant="primary"
          size="lg"
          fullWidth
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
        </Button>
        <Button
          variant="danger"
          fullWidth
          onClick={handleDelete}
          aria-label="Delete"
        >
          Delete image
        </Button>
      </div>
    </div>
  );
}
