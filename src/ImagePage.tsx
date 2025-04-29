import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { PromptPanel } from "./components/imagePage/PromptPanel";
import { ImageDisplay } from "./components/imagePage/ImageDisplay";

interface ImageProgressPageProps {
  imageId: Id<"images">;
}

export default function ImagePage({ imageId }: ImageProgressPageProps) {
  const image = useQuery(api.images.getImage, {
    imageId,
  });

  const canGenerate =
    !!image &&
    (image.status.kind === "uploaded" || image.status.kind === "generated");

  const currentPrompt =
    image &&
    (image.status.kind === "generating" || image.status.kind === "generated")
      ? image.status.prompt
      : undefined;

  return (
    <div className="relative flex flex-col-reverse md:flex-row flex-1 w-full bg-[var(--color-bg)]">
      <PromptPanel
        imageId={imageId}
        canGenerate={canGenerate}
        currentPrompt={currentPrompt}
      />
      {image && <ImageDisplay imageId={imageId} status={image.status} />}
    </div>
  );
}
