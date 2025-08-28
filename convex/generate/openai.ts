"use node";
import { Id } from "../_generated/dataModel";
import OpenAI from "openai";
import { File } from "formdata-node";
import { resizeAndConvertToWebp, base64ToUint8Array } from "./lib";

if (!process.env.OPENAI_API_KEY)
  throw new Error(
    `OPENAI_API_KEY is not set, please 'bun convex env set OPEN_API_KEY <your-key>'`
  );

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate decorated image using OpenAI's GPT Image 1 model
 */
export async function generateWithOpenAI(
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
    quality: "medium",
  });

  // Log usage and compute detailed token-based cost per OpenAI pricing
  // Ref: https://platform.openai.com/docs/pricing#image-tokens
  if (editResponse.usage) {
    const { input_tokens, output_tokens, input_tokens_details } =
      editResponse.usage as any;
    const textTokens: number = input_tokens_details?.text_tokens ?? 0;
    const imageInputTokens: number = input_tokens_details?.image_tokens ?? 0;
    const imageOutputTokens: number = output_tokens ?? 0;

    // Prices per token
    const COST_PER_TEXT_TOKEN = 5 / 1_000_000; // $5 per 1M tokens
    const COST_PER_IMAGE_INPUT_TOKEN = 10 / 1_000_000; // $10 per 1M tokens
    const COST_PER_IMAGE_OUTPUT_TOKEN = 40 / 1_000_000; // $40 per 1M tokens

    const textInputCost = textTokens * COST_PER_TEXT_TOKEN;
    const imageInputCost = imageInputTokens * COST_PER_IMAGE_INPUT_TOKEN;
    const imageOutputCost = imageOutputTokens * COST_PER_IMAGE_OUTPUT_TOKEN;
    const totalCost = textInputCost + imageInputCost + imageOutputCost;

    console.log(
      `[generateWithOpenAI] Usage (reported): text_input_tokens=${textTokens}, image_input_tokens=${imageInputTokens}, image_output_tokens=${imageOutputTokens}, total_input_tokens=${input_tokens}`
    );
    console.log(
      `[generateWithOpenAI] Estimated cost breakdown: text_input=$${textInputCost.toFixed(6)}, image_input=$${imageInputCost.toFixed(6)}, image_output=$${imageOutputCost.toFixed(6)}, total=$${totalCost.toFixed(6)}`
    );
  } else {
    console.warn(
      "[generateWithOpenAI] No usage info returned; cannot compute token-based cost."
    );
  }

  if (!editResponse.data || !editResponse.data[0].b64_json) {
    throw new Error("No image data returned from OpenAI image edit endpoint");
  }

  // Store the generated image in Convex storage
  console.log(`[generateWithOpenAI] Storing generated image in Convex storage`);
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
