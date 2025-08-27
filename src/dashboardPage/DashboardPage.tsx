import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { useImageUpload } from "../common/utils";
import { UploadCard } from "./UploadCard";
import { ImageGrid } from "./ImageGrid";
import { useQuery } from "convex-helpers/react/cache";
import GitHubCorner from "../common/GitHubCorner";
import ConvexCorner from "../common/ConvexCorner";

export default function DashboardPage() {
  const images = useQuery(api.images.listImages);
  const isLoading = images === undefined;
  const [isDragging, setIsDragging] = useState(false);
  const handleUpload = useImageUpload();

  return (
    <div className="max-w-6xl p-4 md:p-8 mx-auto w-full space-y-10">
      <UploadCard
        onUpload={handleUpload}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
      />
      <ImageGrid images={images || []} loading={isLoading} />
      <GitHubCorner />
      <ConvexCorner />
    </div>
  );
}
