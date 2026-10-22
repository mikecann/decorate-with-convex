import type { MutationCtx } from "./_generated/server";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export type Limit = { key: string; windowMs: number; maximum: number };

// Invalid configuration keeps the conservative default. Zero is an explicit stop.
export function dailyLimit(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= 100_000 ? value : fallback;
}

/**
 * Call only inside a mutation, before scheduling or starting paid work.
 * Convex retries conflicting transactions, including concurrent inserts for a key.
 * Read every bucket before writing so a refusal never partially consumes quotas.
 * Keep one reusable row per scope, rather than adding a row for every request/day.
 */
export async function reserveLimits(
  ctx: Pick<MutationCtx, "db">,
  limits: Limit[],
  now = Date.now(),
): Promise<void> {
  const buckets = await Promise.all(
    limits.map(async (limit) => {
      const row = await ctx.db
        .query("abuseLimits")
        .withIndex("by_key", (q) => q.eq("key", limit.key))
        .unique();
      const windowStart = Math.floor(now / limit.windowMs) * limit.windowMs;
      const used = row?.windowStart === windowStart ? row.used : 0;
      if (used >= limit.maximum) {
        throw new Error("Demo request limit reached. Please try again later.");
      }
      return { row, key: limit.key, windowStart, used: used + 1 };
    }),
  );
  for (const { row, ...bucket } of buckets) {
    if (row) await ctx.db.patch(row._id, bucket);
    else await ctx.db.insert("abuseLimits", bucket);
  }
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PROMPT_LENGTH = 2000;

export function validatePrompt(prompt: string): void {
  if (!prompt.trim() || prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error(
      `Enter a prompt between 1 and ${MAX_PROMPT_LENGTH} characters`,
    );
  }
}

export async function reserveGeneration(
  ctx: Pick<MutationCtx, "db">,
  userId: string,
  prompt: string,
) {
  validatePrompt(prompt);
  await reserveLimits(ctx, [
    { key: "image:global:minute", windowMs: MINUTE, maximum: 3 },
    {
      key: "image:global:day",
      windowMs: DAY,
      maximum: dailyLimit("IMAGE_GLOBAL_DAILY_LIMIT", 30),
    },
    { key: `image:user:${userId}:hour`, windowMs: HOUR, maximum: 4 },
    { key: `image:user:${userId}:day`, windowMs: DAY, maximum: 10 },
  ]);
}
