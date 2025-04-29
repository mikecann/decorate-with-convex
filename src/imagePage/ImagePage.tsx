import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PromptPanel } from "./PromptPanel";
import { ImageDisplay } from "./ImageDisplay";

interface ImageProgressPageProps {
  imageId: Id<"images">;
}

export default function ImagePage({ imageId }: ImageProgressPageProps) {
  const image = useQuery(api.images.getImage, {
    imageId,
  });

  return (
    <div className="relative flex flex-col-reverse md:flex-row flex-1 w-full bg-[var(--color-bg)]">
      {image && <PromptPanel image={image} />}
      {image && <ImageDisplay imageId={imageId} status={image.status} />}
    </div>
  );
}
