import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { routes } from "../routes";
import { useApiErrorHandler } from "./error";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Module-level map for storing object URLs for uploading images
const uploadingImageObjectUrls: Record<string, string> = {};

export function setUploadingImageObjectUrl(imageId: string, objectUrl: string) {
  uploadingImageObjectUrls[imageId] = objectUrl;
}

export function getUploadingImageObjectUrl(
  imageId: string
): string | undefined {
  return uploadingImageObjectUrls[imageId];
}

export function clearUploadingImageObjectUrl(imageId: string) {
  const url = uploadingImageObjectUrls[imageId];
  if (url) URL.revokeObjectURL(url);
  delete uploadingImageObjectUrls[imageId];
}

export function useImageUpload() {
  const generateUploadUrl = useMutation(api.images.generateUploadUrl);
  const markUploaded = useMutation(api.images.markUploaded);
  const onApiError = useApiErrorHandler();

  const handleUpload = async (file: File) => {
    try {
      const { uploadUrl, imageId } = await generateUploadUrl();
      // Store object URL for use in ImagePage
      const objectUrl = URL.createObjectURL(file);
      setUploadingImageObjectUrl(imageId, objectUrl);
      // Navigate to progress page immediately
      routes.image({ imageId: imageId.toString() }).push();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await result.json();
      await markUploaded({ imageId, storageId });
      // Clear object URL after upload is complete
      clearUploadingImageObjectUrl(imageId);
      toast.success("Image uploaded successfully!");
    } catch (error) {
      onApiError(error);
    }
  };

  return handleUpload;
}
