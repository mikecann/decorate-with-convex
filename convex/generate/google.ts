"use node";
import { Id } from "../_generated/dataModel";
import { GoogleGenAI } from "@google/genai";
import { resizeAndConvertToWebp } from "./lib";

/**
 * Generate decorated image using Google's Gemini 2.5 Flash model
 *
 * NOTE: Google Gemini Flash does not support image generation/editing.
 * This function provides alternative approaches:
 * 1. Use Gemini to enhance the prompt, then fall back to OpenAI
 * 2. Throw informative error about the limitation
 */
export async function generateWithGoogle(
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

  // Log usage metadata if available and an estimated cost based on public pricing
  const usage = genResponse.usageMetadata;
  if (usage) {
    const { promptTokenCount, candidatesTokenCount, totalTokenCount } = usage;
    console.log(
      `[generateWithGoogle] Usage (reported): prompt_tokens=${promptTokenCount}, candidates_tokens=${candidatesTokenCount}, total_tokens=${totalTokenCount}`
    );

    // Pricing: $0.30 per 1M input tokens, $30.00 per 1M output tokens
    // Source: https://developers.googleblog.com/en/introducing-gemini-2-5-flash-image/
    const INPUT_COST_PER_TOKEN = 0.3 / 1_000_000;
    const OUTPUT_COST_PER_TOKEN = 30.0 / 1_000_000;

    const inputCost = (promptTokenCount ?? 0) * INPUT_COST_PER_TOKEN;
    const outputCost = (candidatesTokenCount ?? 0) * OUTPUT_COST_PER_TOKEN;
    const totalCost = inputCost + outputCost;

    console.log(
      `[generateWithGoogle] Estimated cost breakdown: input=$${inputCost.toFixed(6)}, output=$${outputCost.toFixed(6)}, total=$${totalCost.toFixed(6)}`
    );
  }

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
