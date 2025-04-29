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

// Helper to resize and re-encode image as WebP (or JPEG fallback)
export async function resizeAndConvertImage(
  file: File,
  maxWidth = 2048,
  maxHeight = 2048
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      // Calculate new dimensions
      if (width > maxWidth || height > maxHeight) {
        const aspect = width / height;
        if (width > height) {
          width = maxWidth;
          height = Math.round(maxWidth / aspect);
        } else {
          height = maxHeight;
          width = Math.round(maxHeight * aspect);
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Could not get canvas context"));
      ctx.drawImage(img, 0, 0, width, height);
      // Check WebP support
      const mimeType =
        canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0
          ? "image/webp"
          : "image/jpeg";
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Failed to convert image"));
          resolve(blob);
        },
        mimeType,
        0.92 // quality
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function useImageUpload() {
  const generateUploadUrl = useMutation(api.images.generateUploadUrl);
  const markUploaded = useMutation(api.images.markUploaded);
  const onApiError = useApiErrorHandler();

  const handleUpload = async (file: File) => {
    try {
      // Resize and re-encode before upload
      const processedBlob = await resizeAndConvertImage(file);
      const processedFile = new File(
        [processedBlob],
        file.name.replace(/\.[^.]+$/, ".webp"),
        {
          type: processedBlob.type,
        }
      );
      const { uploadUrl, imageId } = await generateUploadUrl();
      // Store object URL for use in ImagePage (from processed blob)
      const objectUrl = URL.createObjectURL(processedBlob);
      setUploadingImageObjectUrl(imageId, objectUrl);
      // Navigate to progress page immediately
      routes.image({ imageId: imageId.toString() }).push();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": processedFile.type },
        body: processedFile,
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
