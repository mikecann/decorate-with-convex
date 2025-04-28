import { v } from "convex/values";
import {
  mutation,
  query,
  action,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import { OpenAI } from "openai";

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

    await ctx.db.patch(args.imageId, {
      status: { kind: "uploaded", url },
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
    if (!image) throw new Error("Image not found");
    if (image.status.kind !== "uploaded" && image.status.kind !== "generated")
      throw new Error("Image not ready");

    const originalUrl =
      image.status.kind === "uploaded" ? image.status.url : image.originalUrl;
    await ctx.db.patch(args.imageId, {
      originalUrl,
      status: { kind: "generating" },
    });

    // Schedule the real AI generation
    await ctx.scheduler.runAfter(0, internal.images.generateDecoratedImage, {
      imageId: args.imageId,
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

export const getImage = query({
  args: {
    imageId: v.id("images"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.imageId);
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const generateDecoratedImage = internalAction({
  args: {
    imageId: v.id("images"),
    prompt: v.string(),
  },
  handler: async (ctx, { imageId, prompt }) => {
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "auto",
      n: 1,
    });

    if (
      !response.data ||
      response.data.length === 0 ||
      !response.data[0].b64_json
    ) {
      throw new Error("No image data returned from OpenAI");
    }

    const bytes = base64ToUint8Array(response.data[0].b64_json);
    const blob = new Blob([bytes], { type: "image/png" });
    const storageId = await ctx.storage.store(blob);
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Failed to get storage URL after upload");

    // Get the original image (for originalUrl)
    const image = await ctx.runQuery(api.images.getImage, { imageId });
    const originalUrl =
      image?.status.kind === "uploaded"
        ? image.status.url
        : (image?.originalUrl ?? "");

    await ctx.runMutation(api.images.finishGeneration, {
      imageId,
      originalUrl,
      decoratedUrl: url,
    });
  },
});
