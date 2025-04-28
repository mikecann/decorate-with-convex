import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
