import { ImageCard } from "./ImageCard";
import { Card } from "../common/Card";

interface ImageGridProps {
  images: any[]; // Replace with proper Image[] type if available
  loading?: boolean;
}

export function ImageGrid({ images, loading }: ImageGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {[...Array(3)].map((_, i) => (
          <Card
            key={i}
            className="animate-pulse flex flex-col gap-2 border border-[var(--color-border)]"
          >
            <div className="bg-gray-200 h-48 rounded-lg mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-1" />
            <div className="h-3 bg-gray-100 rounded w-1/3" />
          </Card>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
      {images.map((image) => (
        <ImageCard key={image._id} image={image} />
      ))}
    </div>
  );
}
