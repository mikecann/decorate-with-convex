"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import OpenAI from "openai";
import { File } from "formdata-node";
import sharp from "sharp";

if (!process.env.OPENAI_API_KEY)
  throw new Error(
    `OPENAI_API_KEY is not set, please 'bun convex env set OPEN_API_KEY <your-key>'`
  );

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const generateDecoratedImage = internalAction({
  args: {
    imageId: v.id("images"),
    image: v.object({ url: v.string(), storageId: v.id("_storage") }),
    prompt: v.string(),
  },
  handler: async (ctx, { imageId, image, prompt }) => {
    console.log(`[generateDecoratedImage] Starting for image`, {
      imageId,
      image,
      prompt,
    });

    const response = await fetch(image.url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch uploaded image from storage: ${response.statusText}`
      );
    }

    // Convert response to a File object for OpenAI
    const buffer = await response.arrayBuffer();
    const file = new File([buffer], "image.png", {
      type: response.headers.get("content-type") || "image/png",
    });

    // Call OpenAI image edit endpoint
    console.log(
      `[generateDecoratedImage] Calling OpenAI image edit endpoint with prompt: ${prompt}`
    );
    const editResponse = await openai.images.edit({
      image: file,
      model: "gpt-image-1",
      prompt,
      n: 1,
    });

    // Log token usage and cost if available
    if (editResponse.usage) {
      const { input_tokens, output_tokens, input_tokens_details } =
        editResponse.usage;
      const textTokens = input_tokens_details?.text_tokens ?? 0;
      const imageTokens = input_tokens_details?.image_tokens ?? 0;
      const textCost = textTokens * 0.000005;
      const imageCost = imageTokens * 0.00001;
      const outputCost = output_tokens * 0.00004;
      const totalCost = textCost + imageCost + outputCost;
      console.log(
        `[generateDecoratedImage] Token usage: input_tokens=${input_tokens} (text=${textTokens}, image=${imageTokens}), output_tokens=${output_tokens}`
      );
      console.log(
        `[generateDecoratedImage] Cost: text_input=$${textCost.toFixed(6)}, image_input=$${imageCost.toFixed(6)}, output=$${outputCost.toFixed(6)}, total=$${totalCost.toFixed(6)}`
      );
    } else {
      console.warn(
        "[generateDecoratedImage] No usage info returned from OpenAI response; cannot log token usage or cost."
      );
    }

    if (!editResponse.data || !editResponse.data[0].b64_json)
      throw new Error("No image data returned from OpenAI image edit endpoint");

    // Store the generated image in Convex storage
    console.log(
      `[generateDecoratedImage] Storing generated image in Convex storage`
    );
    const base64ToUint8Array = (base64: string): Uint8Array => {
      const binaryString = globalThis.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
      return bytes;
    };
    const bytes = base64ToUint8Array(editResponse.data[0].b64_json);

    // Resize and convert to webp using helper
    let webpBuffer: Buffer;
    try {
      webpBuffer = await resizeAndConvertToWebp(Buffer.from(bytes));
    } catch (err) {
      throw new Error(`Failed to resize/convert image to webp: ${err}`);
    }
    const webpBlob = new Blob([webpBuffer], { type: "image/webp" });
    const storageId = await ctx.storage.store(webpBlob);
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Failed to get storage URL after upload");

    try {
      await ctx.runMutation(api.images.finishGeneration, {
        imageId,
        image,
        decoratedImage: { url, storageId },
        prompt,
      });
    } catch (e) {
      console.error(e);
      await ctx.storage.delete(storageId);
    }

    console.log(`[generateDecoratedImage] Done for imageId: ${imageId}`);
  },
});

/**
 * Resize and convert an image buffer to webp format, max 2048x2048.
 * @param inputBuffer - The input image buffer (PNG, JPEG, etc)
 * @returns Promise<Buffer> - The processed webp image buffer
 */
async function resizeAndConvertToWebp(inputBuffer: Buffer): Promise<Buffer> {
  return sharp(inputBuffer)
    .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 92 })
    .toBuffer();
}
