import { ImageCard } from "./ImageCard";

interface ImageGridProps {
  images: any[]; // Replace with proper Image[] type if available
}

export function ImageGrid({ images }: ImageGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
      {images.map((image) => (
        <ImageCard key={image._id} image={image} />
      ))}
    </div>
  );
}
