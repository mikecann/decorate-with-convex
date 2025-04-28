import { v } from "convex/values";
import {
  mutation,
  query,
  action,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";

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
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const image = await ctx.db.get(args.imageId);
    if (!image) throw new Error("Image not found");
    if (image.status.kind !== "uploaded" && image.status.kind !== "generated")
      throw new Error("Image not ready");

    // Store the original URL on the document for later use
    const originalUrl =
      image.status.kind === "uploaded" ? image.status.url : image.originalUrl;
    await ctx.db.patch(args.imageId, {
      originalUrl,
      status: { kind: "generating" },
    });

    // Schedule the mock generation
    await ctx.scheduler.runAfter(0, api.images.mockGenerate, {
      imageId: args.imageId,
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
