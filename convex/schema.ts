import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { typedV } from "convex-helpers/validators";

// Extracted validator for an image object with url and storageId
const imageObject = v.object({
  url: v.string(),
  storageId: v.id("_storage"),
});

const schema = defineSchema({
  abuseLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    used: v.number(),
  }).index("by_key", ["key"]),

  ...authTables,
  images: defineTable({
    userId: v.id("users"),
    status: v.union(
      v.object({
        kind: v.literal("uploading"),
        // Absent on uploads started before server-side upload linking.
        uploadToken: v.optional(v.string()),
      }),
      v.object({
        kind: v.literal("uploaded"),
        image: imageObject,
      }),
      v.object({
        kind: v.literal("generating"),
        image: imageObject,
        prompt: v.string(),
        // The decoration a regeneration may roll back to. Kept on the record
        // (and in by_decorated_storage) so shared-blob checks still see it.
        decoratedImage: v.optional(imageObject),
      }),
      v.object({
        kind: v.literal("generated"),
        image: imageObject,
        decoratedImage: imageObject,
        prompt: v.string(),
      }),
    ),
  })
    .index("by_user", ["userId"])
    .index("by_image_storage", ["status.image.storageId"])
    .index("by_decorated_storage", ["status.decoratedImage.storageId"]),
  userSettings: defineTable({
    userId: v.id("users"),
    imageModel: v.union(
      v.literal("openai/gpt-image-1"),
      v.literal("google/gemini-2.5-flash-image-preview"),
    ),
  }).index("by_user", ["userId"]),
});

export const vv = typedV(schema);

export default schema;
