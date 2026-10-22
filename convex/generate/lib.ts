"use node";
import sharp from "sharp";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { MAX_IMAGE_BYTES } from "../abuse";

/**
 * Resize and convert an image buffer to webp format, max 2048x2048.
 * @param inputBuffer - The input image buffer (PNG, JPEG, etc)
 * @returns Promise<Buffer> - The processed webp image buffer
 */
export async function resizeAndConvertToWebp(
  inputBuffer: Buffer,
): Promise<Buffer> {
  if (inputBuffer.byteLength > 18 * 1024 * 1024)
    throw new Error("Generated image is too large");
  return sharp(inputBuffer, { limitInputPixels: 20_000_000, pages: 1 })
    .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 92 })
    .toBuffer();
}

/**
 * Convert base64 string to Uint8Array
 * @param base64 - Base64 encoded string
 * @returns Uint8Array - The decoded bytes
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = globalThis.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

// Read the trusted storage ID, not a URL passed through an image document.
// Normalize before sending to a paid provider to bound pixels and upload size.
export async function loadSourceImage(
  ctx: Pick<ActionCtx, "storage">,
  storageId: Id<"_storage">,
): Promise<Buffer> {
  const blob = await ctx.storage.get(storageId);
  if (!blob || blob.size > MAX_IMAGE_BYTES)
    throw new Error("Source image is missing or too large");
  return sharp(Buffer.from(await blob.arrayBuffer()), {
    limitInputPixels: 20_000_000,
    pages: 1,
  })
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}
