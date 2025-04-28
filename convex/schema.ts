import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const applicationTables = {
  images: defineTable({
    userId: v.id("users"),
    originalUrl: v.optional(v.string()),
    decoratedUrl: v.optional(v.string()),
    status: v.union(
      v.object({
        kind: v.literal("uploading"),
      }),
      v.object({
        kind: v.literal("uploaded"),
        url: v.string(),
      }),
      v.object({
        kind: v.literal("generating"),
      }),
      v.object({
        kind: v.literal("generated"),
        originalUrl: v.string(),
        decoratedUrl: v.string(),
      })
    ),
  })
    .index("by_user", ["userId"])
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
