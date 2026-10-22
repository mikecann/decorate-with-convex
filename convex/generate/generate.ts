"use node";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
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
      v.literal("google/gemini-2.5-flash-image-preview"),
    ),
    // Keep the old optional argument valid for jobs queued before this change.
    shouldDeletePreviousDecorated: v.optional(v.boolean()),
    previousGeneration: v.optional(
      v.object({
        decoratedImage: v.object({
          url: v.string(),
          storageId: v.id("_storage"),
        }),
        prompt: v.string(),
      }),
    ),
  },
  handler: async (
    ctx,
    {
      imageId,
      image,
      prompt,
      model,
      previousGeneration,
      shouldDeletePreviousDecorated,
    },
  ): Promise<void> => {
    let decoratedImageData:
      | { url: string; storageId: Id<"_storage"> }
      | undefined;
    const previousDecoratedStorageId =
      previousGeneration?.decoratedImage.storageId ??
      (shouldDeletePreviousDecorated ? image.storageId : undefined);
    let finished = false;
    // Storage may already be gone, so cleanup is best effort and idempotent.
    // A new output belongs to nothing else, so it is deleted directly.
    const deleteStorage = (storageId: Id<"_storage"> | undefined) =>
      storageId
        ? ctx.storage.delete(storageId).catch(() => {
            console.warn("Could not remove generated image");
          })
        : undefined;
    // An old decoration may also be linked by other images (legacy adoption),
    // so it is only removed if nothing references it any more.
    const releaseStorage = async (
      storageId: Id<"_storage"> | undefined,
    ): Promise<void> => {
      if (storageId)
        await ctx
          .runMutation(internal.images.releaseStorage, { storageId })
          .catch(() => {
            console.warn("Could not release previous decoration");
          });
    };
    try {
      const currentImage = await ctx.runQuery(
        internal.images.getImageInternal,
        { imageId },
      );
      // Deleted before work started. Jobs queued before generating records kept
      // the old decoration are the only place deleteImage couldn't see it.
      if (!currentImage)
        return await releaseStorage(previousDecoratedStorageId);
      if (currentImage.status.kind !== "generating") return;
      if (model === "openai/gpt-image-1")
        decoratedImageData = await generateWithOpenAI(ctx, image, prompt);
      else decoratedImageData = await generateWithGoogle(ctx, image, prompt);

      const originalImage = currentImage.status.image;

      finished = await ctx.runMutation(internal.images.finishGeneration, {
        imageId,
        image: originalImage, // Always use the original image reference
        decoratedImage: decoratedImageData,
        prompt,
      });
      // Keep the old decoration until its replacement has committed. If the
      // image was deleted mid-generation, neither image belongs to anything now.
      // Cleanup failure must not remove the new image after its document committed.
      if (!finished) await deleteStorage(decoratedImageData.storageId);
      await releaseStorage(previousDecoratedStorageId);
    } catch (e) {
      console.error("Image generation failed");
      if (!finished) await deleteStorage(decoratedImageData?.storageId);
      const restored = await ctx.runMutation(internal.images.failGeneration, {
        imageId,
        previousGeneration,
      });
      // Only drop the old decoration when there is no document to restore it to.
      if (!restored) await releaseStorage(previousDecoratedStorageId);
    }

    console.log(`[generateDecoratedImage] Done for imageId: ${imageId}`);
  },
});
