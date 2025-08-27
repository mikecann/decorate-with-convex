"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import OpenAI from "openai";
import { File } from "formdata-node";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

if (!process.env.OPENAI_API_KEY)
  throw new Error(
    `OPENAI_API_KEY is not set, please 'bun convex env set OPEN_API_KEY <your-key>'`
  );

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate decorated image using OpenAI's GPT Image 1 model
 */
async function generateWithOpenAI(
  ctx: any,
  image: { url: string; storageId: string },
  prompt: string
): Promise<{ url: string; storageId: Id<"_storage"> }> {
  console.log(
    `[generateWithOpenAI] Calling OpenAI image edit endpoint with prompt: ${prompt}`
  );

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
      `[generateWithOpenAI] Token usage: input_tokens=${input_tokens} (text=${textTokens}, image=${imageTokens}), output_tokens=${output_tokens}`
    );
    console.log(
      `[generateWithOpenAI] Cost: text_input=$${textCost.toFixed(6)}, image_input=$${imageCost.toFixed(6)}, output=$${outputCost.toFixed(6)}, total=$${totalCost.toFixed(6)}`
    );
  } else {
    console.warn(
      "[generateWithOpenAI] No usage info returned from OpenAI response; cannot log token usage or cost."
    );
  }

  if (!editResponse.data || !editResponse.data[0].b64_json) {
    throw new Error("No image data returned from OpenAI image edit endpoint");
  }

  // Store the generated image in Convex storage
  console.log(`[generateWithOpenAI] Storing generated image in Convex storage`);
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

  return { url, storageId };
}

/**
 * Generate decorated image using Google's Gemini 2.5 Flash model
 *
 * NOTE: Google Gemini Flash does not support image generation/editing.
 * This function provides alternative approaches:
 * 1. Use Gemini to enhance the prompt, then fall back to OpenAI
 * 2. Throw informative error about the limitation
 */
async function generateWithGoogle(
  ctx: any,
  image: { url: string; storageId: string },
  prompt: string
): Promise<{ url: string; storageId: Id<"_storage"> }> {
  console.log(
    `[generateWithGoogle] Using Gemini 2.5 Flash Image Preview with prompt: ${prompt}`
  );

  const apiKey =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENAI_API_KEY ?? null;
  if (!apiKey)
    throw new Error(
      "GEMINI_API_KEY or GOOGLE_GENAI_API_KEY is not set. Please configure your Convex env."
    );

  const ai = new GoogleGenAI({ apiKey });

  // Load the source image and encode as base64 for inlineData
  const response = await fetch(image.url);
  if (!response.ok)
    throw new Error(
      `Failed to fetch uploaded image from storage: ${response.statusText}`
    );
  const mimeType = response.headers.get("content-type") || "image/png";
  const arrayBuffer = await response.arrayBuffer();
  const base64Image = Buffer.from(arrayBuffer).toString("base64");

  // Follow the official SDK example: text + inlineData parts
  const contents = [
    { text: prompt },
    {
      inlineData: {
        mimeType,
        data: base64Image,
      },
    },
  ];

  const genResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash-image-preview",
    contents,
  });

  const candidates = genResponse.candidates ?? [];
  if (candidates.length === 0) throw new Error("Gemini returned no candidates");

  // Find first inlineData part with image data
  let b64Out: string | null = null;
  const parts: Array<any> = candidates[0].content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData as { data?: string } | undefined;
    if (inline?.data) {
      b64Out = inline.data;
      break;
    }
  }
  if (!b64Out) throw new Error("Gemini response did not include image data");

  // Convert to webp and store in Convex storage
  const outBytes = Buffer.from(b64Out, "base64");
  let webpBuffer: Buffer;
  try {
    webpBuffer = await resizeAndConvertToWebp(outBytes);
  } catch (err) {
    throw new Error(`Failed to resize/convert Gemini output to webp: ${err}`);
  }
  const webpBlob = new Blob([webpBuffer], { type: "image/webp" });
  const storageId = await ctx.storage.store(webpBlob);
  const url = await ctx.storage.getUrl(storageId);
  if (!url) throw new Error("Failed to get storage URL after Gemini upload");

  return { url, storageId };
}

export const generateDecoratedImage = internalAction({
  args: {
    imageId: v.id("images"),
    image: v.object({ url: v.string(), storageId: v.id("_storage") }),
    prompt: v.string(),
    model: v.union(
      v.literal("openai/gpt-image-1"),
      v.literal("google/gemini-2.5-flash-image-preview")
    ),
    shouldDeletePreviousDecorated: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { imageId, image, prompt, model, shouldDeletePreviousDecorated = false }
  ) => {
    console.log(`[generateDecoratedImage] Starting for image`, {
      imageId,
      image,
      prompt,
      model,
    });

    // Generate the decorated image using the specified model
    let decoratedImageData: { url: string; storageId: Id<"_storage"> };

    switch (model) {
      case "openai/gpt-image-1":
        decoratedImageData = await generateWithOpenAI(ctx, image, prompt);
        break;
      case "google/gemini-2.5-flash-image-preview":
        decoratedImageData = await generateWithGoogle(ctx, image, prompt);
        break;
      default:
        throw new Error(`Unsupported model: ${model}`);
    }

    try {
      // Get the current image record to ensure we have the original image reference
      const currentImage = await ctx.runQuery(api.images.getImage, { imageId });
      if (!currentImage) {
        throw new Error(`Could not find image for imageId '${imageId}'`);
      }

      // Ensure we have the original image reference
      let originalImage;
      if (
        currentImage.status.kind === "uploaded" ||
        currentImage.status.kind === "generating" ||
        currentImage.status.kind === "generated"
      ) {
        originalImage = currentImage.status.image;
      }

      if (!originalImage) {
        throw new Error(
          `Could not find original image for imageId '${imageId}' - status: ${currentImage.status.kind}`
        );
      }

      await ctx.runMutation(internal.images.finishGeneration, {
        imageId,
        image: originalImage, // Always use the original image reference
        decoratedImage: decoratedImageData,
        prompt,
      });

      // If we used the decorated image as base, delete it now that we have a new one
      if (shouldDeletePreviousDecorated && image.storageId) {
        await ctx.storage.delete(image.storageId);
      }
    } catch (e) {
      console.error(e);
      await ctx.storage.delete(decoratedImageData.storageId);
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
