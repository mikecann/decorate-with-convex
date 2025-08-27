import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Default user settings
const DEFAULT_SETTINGS = {
  imageModel: "google/gemini-2.5-flash-image-preview" as const,
};

export const getUserSettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Try to find existing user settings
    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    // If no settings exist, return defaults
    if (!existingSettings) {
      return DEFAULT_SETTINGS;
    }

    // Return existing settings
    return {
      imageModel: existingSettings.imageModel,
    };
  },
});

export const updateUserSettings = mutation({
  args: {
    imageModel: v.optional(
      v.union(
        v.literal("openai/gpt-image-1"),
        v.literal("google/gemini-2.5-flash-image-preview")
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Try to find existing user settings
    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existingSettings) {
      // Update existing settings
      const updates: Partial<typeof existingSettings> = {};
      if (args.imageModel !== undefined) {
        updates.imageModel = args.imageModel;
      }

      await ctx.db.patch(existingSettings._id, updates);
    } else {
      // Create new settings with provided values or defaults
      await ctx.db.insert("userSettings", {
        userId,
        imageModel: args.imageModel ?? DEFAULT_SETTINGS.imageModel,
      });
    }
  },
});
