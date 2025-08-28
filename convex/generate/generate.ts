"use node";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { generateWithOpenAI } from "./openai";
import { generateWithGoogle } from "./google";

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

    if (model === "openai/gpt-image-1")
      decoratedImageData = await generateWithOpenAI(ctx, image, prompt);
    else if (model === "google/gemini-2.5-flash-image-preview")
      decoratedImageData = await generateWithGoogle(ctx, image, prompt);
    else throw new Error(`Unsupported model: ${model}`);

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
