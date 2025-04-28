import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

// Extracted validator for an image object with url and storageId
const imageObject = v.object({
  url: v.string(),
  storageId: v.id("_storage"),
});

export default defineSchema({
  ...authTables,
  images: defineTable({
    userId: v.id("users"),
    status: v.union(
      v.object({
        kind: v.literal("uploading"),
      }),
      v.object({
        kind: v.literal("uploaded"),
        image: imageObject,
      }),
      v.object({
        kind: v.literal("generating"),
        image: imageObject,
        prompt: v.string(),
      }),
      v.object({
        kind: v.literal("generated"),
        image: imageObject,
        decoratedImage: imageObject,
        prompt: v.string(),
      })
    ),
  }).index("by_user", ["userId"]),
});
