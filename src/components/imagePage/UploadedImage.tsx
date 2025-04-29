import { ImageViewer } from "./ImageViewer";

interface UploadedImageProps {
  imageUrl: string;
}

export function UploadedImage({ imageUrl }: UploadedImageProps) {
  return <ImageViewer src={imageUrl} alt="Uploaded" />;
}
