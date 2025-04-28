import { v } from "convex/values";
import { mutation, query, action, internalAction } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import { ensureFP } from "../shared/ensure";
import OpenAI from "openai";
import { match } from "ts-pattern";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const uploadUrl = await ctx.storage.generateUploadUrl();

    const imageId = await ctx.db.insert("images", {
      userId,
      status: { kind: "uploading" },
    });

    return { uploadUrl, imageId };
  },
});

export const markUploaded = mutation({
  args: {
    imageId: v.id("images"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Failed to get URL");

    console.log(
      `[markUploaded] Marking image ${args.imageId} as uploaded with storageId ${args.storageId}`
    );

    await ctx.db.patch(args.imageId, {
      status: { kind: "uploaded", image: { url, storageId: args.storageId } },
    });
  },
});

export const startGeneration = mutation({
  args: {
    imageId: v.id("images"),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const image = await ctx.db.get(args.imageId);
    if (!image) throw new Error(`Image with id '${args.imageId}' not found`);

    if (image.status.kind !== "uploaded" && image.status.kind !== "generated")
      throw new Error(
        `Image with id '${args.imageId}' not ready for generation (status: ${image.status.kind})`
      );

    // If regenerating, delete the previous decorated image from storage
    if (image.status.kind === "generated" && image.status.decoratedImage) {
      await ctx.storage.delete(image.status.decoratedImage.storageId);
    }

    // Get the image object from the current status
    const imageObj = image.status.image;
    if (!imageObj)
      throw new Error(
        `Image object missing for imageId '${args.imageId}' in startGeneration`
      );

    await ctx.db.patch(args.imageId, {
      status: { kind: "generating", image: imageObj, prompt: args.prompt },
    });

    // Schedule the real AI generation, passing the image object
    await ctx.scheduler.runAfter(0, internal.images.generateDecoratedImage, {
      imageId: args.imageId,
      image: imageObj,
      prompt: args.prompt,
    });
  },
});

export const findImage = query({
  args: {
    imageId: v.id("images"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.imageId);
  },
});

export const getImage = query({
  args: {
    imageId: v.id("images"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.imageId).then(ensureFP());
  },
});

export const finishGeneration = mutation({
  args: {
    imageId: v.id("images"),
    image: v.object({ url: v.string(), storageId: v.id("_storage") }),
    decoratedImage: v.object({ url: v.string(), storageId: v.id("_storage") }),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.imageId, {
      status: {
        kind: "generated",
        image: args.image,
        decoratedImage: args.decoratedImage,
        prompt: args.prompt,
      },
    });
  },
});

export const listImages = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("images")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
  },
});

export const deleteImage = mutation({
  args: {
    imageId: v.id("images"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const image = await ctx.db.get(args.imageId);
    if (!image) throw new Error("Image not found");

    await match(image.status)
      .with({ kind: "uploading" }, async () => {
        // No storage to delete
      })
      .with({ kind: "uploaded" }, async ({ image }) => {
        if (!image) return;
        await ctx.storage.delete(image.storageId);
      })
      .with({ kind: "generating" }, async ({ image }) => {
        if (!image) return;
        await ctx.storage.delete(image.storageId);
      })
      .with({ kind: "generated" }, async ({ image, decoratedImage }) => {
        if (image) await ctx.storage.delete(image.storageId);
        if (decoratedImage) await ctx.storage.delete(decoratedImage.storageId);
      })
      .exhaustive();

    await ctx.db.delete(args.imageId);
  },
});

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

    // Fetch the uploaded image from storage
    console.log(
      `[generateDecoratedImage] Fetching uploaded image from storage: ${image.url}`
    );
    const response = await fetch(image.url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch uploaded image from storage: ${response.statusText}`
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    // Convert ArrayBuffer to Uint8Array for OpenAI SDK
    const imageBytes = new Uint8Array(arrayBuffer);
    // Create a File object for OpenAI SDK (Node.js polyfill)
    const imageFile = new File([imageBytes], "input.png", {
      type: "image/png",
    });

    // Call OpenAI image edit endpoint
    console.log(
      `[generateDecoratedImage] Calling OpenAI image edit endpoint with prompt: ${prompt}`
    );
    const editResponse = await openai.images.edit({
      image: imageFile,
      model: "gpt-image-1",
      prompt,
      n: 1,
    });

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
    const blob = new Blob([bytes], { type: "image/png" });
    const storageId = await ctx.storage.store(blob);
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
