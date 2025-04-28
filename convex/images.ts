import { v } from "convex/values";
import { mutation, query, action, internalAction } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import { experimental_generateImage as generateImage } from "ai";
import { openai } from "@ai-sdk/openai";
import { ensureFP } from "../shared/ensure";
import { vv } from "./lib";

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
      status: { kind: "uploaded", url },
      originalUrl: url,
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

    const originalUrl =
      image.status.kind === "uploaded" ? image.status.url : image.originalUrl;

    console.log(
      `[startGeneration] Scheduling generation for image ${args.imageId} with prompt: ${args.prompt}`
    );
    await ctx.db.patch(args.imageId, {
      originalUrl,
      status: { kind: "generating" },
    });

    // Schedule the real AI generation
    await ctx.scheduler.runAfter(0, internal.images.generateDecoratedImage, {
      image,
      prompt: args.prompt,
    });
  },
});

export const mockGenerate = action({
  args: {
    imageId: v.id("images"),
  },
  handler: async (ctx, args) => {
    // Mock generation delay
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const image = await ctx.runQuery(api.images.getImage, {
      imageId: args.imageId,
    });
    if (!image || image.status.kind !== "generating") return;

    await ctx.runMutation(api.images.finishGeneration, {
      imageId: args.imageId,
      originalUrl: image.originalUrl ?? "",
      decoratedUrl: "https://picsum.photos/400/300",
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
    originalUrl: v.string(),
    decoratedUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.imageId, {
      status: {
        kind: "generated",
        originalUrl: args.originalUrl,
        decoratedUrl: args.decoratedUrl,
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
      .collect();
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

    // Remove storage file if present
    if (image.status.kind === "uploaded" && image.status.url) {
      // Extract storageId from the url if you store it, or store storageId on the doc for easier deletion
      // For now, skip actual storage deletion since storageId is not tracked
    }
    // Optionally, handle other states if you store storageId

    await ctx.db.delete(args.imageId);
  },
});

// Helper to convert base64 to Uint8Array (Convex-compatible)
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = globalThis.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export const generateDecoratedImage = internalAction({
  args: {
    image: vv.doc("images"),
    prompt: v.string(),
  },
  handler: async (ctx, { image, prompt }) => {
    console.log(`[generateDecoratedImage] Starting for image`, image);

    if (image.status.kind !== "uploaded" && image.status.kind !== "generated")
      throw new Error(
        `Image not ready for generation (status: ${image.status.kind})`
      );

    if (!image.originalUrl) throw new Error(`Image has no originalUrl`);

    // Fetch the uploaded image from storage
    console.log(
      `[generateDecoratedImage] Fetching uploaded image from storage: ${image.originalUrl}`
    );
    const response = await fetch(image.originalUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch uploaded image from storage: ${response.statusText}`
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    // Convert ArrayBuffer to base64 string (browser-compatible, no Buffer)
    function arrayBufferToBase64(buffer: ArrayBuffer): string {
      let binary = "";
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++)
        binary += String.fromCharCode(bytes[i]);
      return globalThis.btoa(binary);
    }
    const base64Image = arrayBufferToBase64(arrayBuffer);

    // Generate decorated image using Vercel AI SDK and OpenAI provider
    console.log(
      `[generateDecoratedImage] Calling Vercel AI SDK for image generation with prompt: ${prompt}`
    );
    const { image: generatedImage } = await generateImage({
      model: openai.image("gpt-image-1"),
      prompt,
      n: 1,
      size: "1024x1024",
      providerOptions: {
        openai: {
          quality: "high",
          image: { base64: base64Image, mimeType: "image/png" },
        },
      },
    });

    if (!generatedImage || !generatedImage.base64) {
      throw new Error("No image data returned from Vercel AI SDK");
    }

    // Store the generated image in Convex storage
    console.log(
      `[generateDecoratedImage] Storing generated image in Convex storage`
    );
    const bytes = base64ToUint8Array(generatedImage.base64);
    const blob = new Blob([bytes], { type: "image/png" });
    const storageId = await ctx.storage.store(blob);
    const url = await ctx.storage.getUrl(storageId);
    if (!url) {
      throw new Error("Failed to get storage URL after upload");
    }

    console.log(
      `[generateDecoratedImage] Updating image doc with originalUrl and decoratedUrl`
    );

    await ctx.runMutation(api.images.finishGeneration, {
      imageId: image._id,
      originalUrl: image.originalUrl,
      decoratedUrl: url,
    });

    console.log(`[generateDecoratedImage] Done for imageId: ${image._id}`);
  },
});
