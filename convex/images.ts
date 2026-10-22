import { v } from "convex/values";
import {
  httpAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { vv } from "./schema";
import {
  reserveGeneration,
  reserveLimits,
  HOUR,
  DAY,
  dailyLimit,
  MAX_IMAGE_BYTES,
} from "./abuse";
import { match } from "ts-pattern";

// Uploads go through our own HTTP action (convex/http.ts) rather than a raw
// storage upload URL. The server stores the bytes itself and links the new
// blob in the same request, so a client never gets to name a storage ID. The
// token is single use, tied to this image and only ever shown to its owner.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const siteUrl = process.env.CONVEX_SITE_URL;
    if (!siteUrl) throw new Error("CONVEX_SITE_URL is not available");

    await reserveLimits(ctx, [
      { key: `upload:user:${userId}:hour`, windowMs: HOUR, maximum: 10 },
      {
        key: "upload:global:day",
        windowMs: DAY,
        maximum: dailyLimit("IMAGE_UPLOAD_DAILY_LIMIT", 200),
      },
    ]);

    const uploadToken = crypto.randomUUID() + crypto.randomUUID();
    const imageId = await ctx.db.insert("images", {
      userId,
      status: { kind: "uploading", uploadToken },
    });

    const uploadUrl = new URL("/images/upload", siteUrl);
    uploadUrl.searchParams.set("imageId", imageId);
    uploadUrl.searchParams.set("token", uploadToken);
    return { uploadUrl: uploadUrl.toString(), imageId };
  },
});

export const UPLOAD_TOKEN_TTL = HOUR;

const isRasterImage = (contentType: string | undefined) =>
  ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
    (contentType ?? "").split(";", 1)[0].trim().toLowerCase(),
  );

async function findUploadTarget(
  ctx: Pick<QueryCtx, "db">,
  imageId: Id<"images">,
  token: string,
) {
  const image = await ctx.db.get(imageId);
  if (
    !image ||
    image.status.kind !== "uploading" ||
    !image.status.uploadToken ||
    image.status.uploadToken !== token ||
    Date.now() - image._creationTime > UPLOAD_TOKEN_TTL
  )
    return null;
  return image;
}

export const checkUploadTarget = internalQuery({
  args: { imageId: v.id("images"), token: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { imageId, token }) =>
    !!(await findUploadTarget(ctx, imageId, token)),
});

// Only called by the upload HTTP action with a blob it has just stored.
// False means the caller must delete that blob.
export const completeUpload = internalMutation({
  args: {
    imageId: v.id("images"),
    token: v.string(),
    storageId: v.id("_storage"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (!(await findUploadTarget(ctx, args.imageId, args.token))) return false;
    const metadata = await ctx.db.system.get(args.storageId);
    if (
      !metadata ||
      metadata.size > MAX_IMAGE_BYTES ||
      !isRasterImage(metadata.contentType)
    )
      return false;
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) return false;
    await ctx.db.patch(args.imageId, {
      status: { kind: "uploaded", image: { url, storageId: args.storageId } },
    });
    return true;
  },
});

const uploadCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const uploadResponse = (status: number, body: object) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...uploadCorsHeaders, "Content-Type": "application/json" },
  });

export const uploadImageOptions = httpAction(
  async () => new Response(null, { status: 204, headers: uploadCorsHeaders }),
);

export const uploadImage = httpAction(async (ctx, request) => {
  const params = new URL(request.url).searchParams;
  const imageId = params.get("imageId");
  const token = params.get("token");
  if (!imageId || !token) return uploadResponse(400, { error: "Bad upload" });
  const target = { imageId: imageId as Id<"images">, token };

  const valid = await ctx
    .runQuery(internal.images.checkUploadTarget, target)
    .catch(() => false);
  if (!valid)
    return uploadResponse(403, { error: "Upload link is invalid or used" });

  const declaredSize = Number(request.headers.get("Content-Length") ?? 0);
  if (declaredSize > MAX_IMAGE_BYTES)
    return uploadResponse(413, { error: "Upload a raster image up to 10 MiB" });
  const blob = await request.blob();
  if (blob.size > MAX_IMAGE_BYTES || !isRasterImage(blob.type))
    return uploadResponse(413, { error: "Upload a raster image up to 10 MiB" });

  const storageId = await ctx.storage.store(blob);
  const linked = await ctx
    .runMutation(internal.images.completeUpload, { ...target, storageId })
    .catch(() => false);
  if (!linked) {
    await ctx.storage.delete(storageId);
    return uploadResponse(403, { error: "Upload link is invalid or used" });
  }
  // storageId is only for frontends cached from before this change, which
  // read it and pass it back to markUploaded.
  return uploadResponse(200, { imageId, storageId });
});

// Kept for frontends cached from before uploads were linked server-side. They
// get the new upload URL from generateUploadUrl, then still call this with
// the storageId the upload returned. It never links anything: it only
// confirms the upload action already linked that exact blob to this image.
export const markUploaded = mutation({
  args: {
    imageId: v.id("images"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const image = await validateImageAccess(ctx, args.imageId, userId);
    if (
      image.status.kind === "uploading" ||
      image.status.image?.storageId !== args.storageId
    )
      throw new Error(
        "This upload can't be completed. Refresh the page and upload the image again.",
      );
    return null;
  },
});

// Helper function to validate user access to image
async function validateImageAccess(
  ctx: Pick<QueryCtx, "db">,
  imageId: Id<"images">,
  userId: Id<"users">,
) {
  const image = await ctx.db.get(imageId);
  if (!image) throw new Error(`Image with id '${imageId}' not found`);
  if (image.userId !== userId)
    throw new Error(
      `Image with id '${imageId}' does not belong to the authenticated user`,
    );
  return image;
}

export const startGeneration = mutation({
  args: {
    imageId: v.id("images"),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const image = await validateImageAccess(ctx, args.imageId, userId);

    if (image.status.kind !== "uploaded")
      throw new Error(
        `Image with id '${args.imageId}' not ready for generation (status: ${image.status.kind})`,
      );

    const imageObj = image.status.image;
    if (!imageObj)
      throw new Error(
        `Image object missing for imageId '${args.imageId}' in startGeneration`,
      );

    await reserveGeneration(ctx, userId, args.prompt);
    await ctx.db.patch(args.imageId, {
      status: { kind: "generating", image: imageObj, prompt: args.prompt },
    });

    // Get user settings to determine which model to use
    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const imageModel =
      userSettings?.imageModel ?? "google/gemini-2.5-flash-image-preview";

    // Schedule the AI generation
    await ctx.scheduler.runAfter(
      0,
      internal.generate.generate.generateDecoratedImage,
      {
        imageId: args.imageId,
        image: imageObj,
        prompt: args.prompt,
        model: imageModel,
      },
    );
  },
});

export const startRegeneration = mutation({
  args: {
    imageId: v.id("images"),
    prompt: v.string(),
    baseImage: v.union(v.literal("original"), v.literal("decorated")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const image = await validateImageAccess(ctx, args.imageId, userId);

    if (image.status.kind !== "generated")
      throw new Error(
        `Image with id '${args.imageId}' must be in generated status for regeneration (current status: ${image.status.kind})`,
      );

    if (!image.status.image || !image.status.decoratedImage)
      throw new Error(
        `Missing image data for regeneration on imageId '${args.imageId}'`,
      );

    // Determine which image to use as the base
    const baseImageObj =
      args.baseImage === "decorated"
        ? image.status.decoratedImage
        : image.status.image;

    // Reserve in the same transaction as the status change and scheduled work.
    await reserveGeneration(ctx, userId, args.prompt);

    await ctx.db.patch(args.imageId, {
      status: {
        kind: "generating",
        image: image.status.image,
        prompt: args.prompt,
        decoratedImage: image.status.decoratedImage,
      },
    });

    // Get user settings to determine which model to use
    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const imageModel =
      userSettings?.imageModel ?? "google/gemini-2.5-flash-image-preview";

    // Schedule the AI generation
    await ctx.scheduler.runAfter(
      0,
      internal.generate.generate.generateDecoratedImage,
      {
        imageId: args.imageId,
        image: baseImageObj,
        prompt: args.prompt,
        model: imageModel,
        previousGeneration: {
          decoratedImage: image.status.decoratedImage,
          prompt: image.status.prompt,
        },
      },
    );
  },
});

export const findImage = query({
  args: { imageId: v.id("images") },
  returns: v.union(vv.doc("images"), v.null()),
  handler: async (ctx, { imageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const image = await ctx.db.get(imageId);
    return image?.userId === userId ? image : null;
  },
});

export const getImage = query({
  args: { imageId: v.id("images") },
  returns: vv.doc("images"),
  handler: async (ctx, { imageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const image = await ctx.db.get(imageId);
    if (!image || image.userId !== userId) throw new Error("Image not found");
    return image;
  },
});

// Scheduled actions have no browser identity. This is deliberately private.
export const getImageInternal = internalQuery({
  args: { imageId: v.id("images") },
  returns: v.union(vv.doc("images"), v.null()),
  handler: async (ctx, { imageId }) => ctx.db.get(imageId),
});

export const failGeneration = internalMutation({
  args: {
    imageId: v.id("images"),
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
  // False when the image was deleted, so the caller can clean up its storage.
  returns: v.boolean(),
  handler: async (ctx, { imageId, previousGeneration }) => {
    const image = await ctx.db.get(imageId);
    if (!image) return false;
    if (image.status.kind === "generating") {
      await ctx.db.patch(imageId, {
        status: previousGeneration
          ? {
              kind: "generated",
              image: image.status.image,
              ...previousGeneration,
            }
          : { kind: "uploaded", image: image.status.image },
      });
    }
    return true;
  },
});

export const finishGeneration = internalMutation({
  args: {
    imageId: v.id("images"),
    image: v.object({ url: v.string(), storageId: v.id("_storage") }),
    decoratedImage: v.object({ url: v.string(), storageId: v.id("_storage") }),
    prompt: v.string(),
  },
  // False when the image was deleted mid-generation; nothing is written.
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (!(await ctx.db.get(args.imageId))) return false;
    await ctx.db.patch(args.imageId, {
      status: {
        kind: "generated",
        image: args.image,
        decoratedImage: args.decoratedImage,
        prompt: args.prompt,
      },
    });
    return true;
  },
});

export const listImages = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

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
    // Already deleted. A running generation cleans up its own leftovers.
    if (!image) return;

    if (image.userId != userId)
      throw new Error(
        `Image with id '${args.imageId}' does not belong to the authenticated user`,
      );

    // Older clients could link any storage ID they knew, so a blob may also
    // be referenced by someone else's image. Only delete unshared blobs.
    const release = (storageId: Id<"_storage">) =>
      deleteUnsharedStorage(ctx, storageId, args.imageId);
    await match(image.status)
      .with({ kind: "uploading" }, async () => {
        // No storage to delete
      })
      .with({ kind: "uploaded" }, async ({ image }) => {
        if (!image) return;
        await release(image.storageId);
      })
      .with({ kind: "generating" }, async ({ image, decoratedImage }) => {
        if (image) await release(image.storageId);
        if (decoratedImage) await release(decoratedImage.storageId);
      })
      .with({ kind: "generated" }, async ({ image, decoratedImage }) => {
        if (image) await release(image.storageId);
        if (decoratedImage) await release(decoratedImage.storageId);
      })
      .exhaustive();

    await ctx.db.delete(args.imageId);
  },
});

// Generation jobs release old decorations and leftovers through this, so the
// shared-reference check and the delete happen in one transaction.
export const releaseStorage = internalMutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { storageId }) => {
    await deleteUnsharedStorage(ctx, storageId);
    return null;
  },
});

async function deleteUnsharedStorage(
  ctx: Pick<MutationCtx, "db" | "storage">,
  storageId: Id<"_storage">,
  deletingImageId?: Id<"images">,
) {
  const others = [
    ...(await ctx.db
      .query("images")
      .withIndex("by_image_storage", (q) =>
        q.eq("status.image.storageId", storageId),
      )
      .take(2)),
    ...(await ctx.db
      .query("images")
      .withIndex("by_decorated_storage", (q) =>
        q.eq("status.decoratedImage.storageId", storageId),
      )
      .take(2)),
  ].filter((other) => other._id !== deletingImageId);
  if (others.length > 0) return;
  // A job and deleteImage can both release the same blob.
  if (!(await ctx.db.system.get(storageId))) return;
  await ctx.storage.delete(storageId);
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    return user;
  },
});
