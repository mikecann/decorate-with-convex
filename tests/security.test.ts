import { afterEach, expect, mock, test } from "bun:test";
import { TestDb, invoke } from "./support";
import {
  findImage,
  getImage,
  generateUploadUrl,
  checkUploadTarget,
  completeUpload,
  uploadImage,
  markUploaded,
  startGeneration,
  startRegeneration,
  finishGeneration,
  failGeneration,
  releaseStorage,
  deleteImage,
} from "../convex/images";
import { dailyLimit, reserveLimits, DAY, HOUR } from "../convex/abuse";
import { getFunctionName } from "convex/server";

afterEach(() => {
  delete process.env.IMAGE_GLOBAL_DAILY_LIMIT;
  delete process.env.CONVEX_SITE_URL;
});
const auth = (id: string | null) => ({
  getUserIdentity: async () => (id ? { subject: `${id}|session` } : null),
});
const source = {
  url: "https://storage.invalid/source",
  storageId: "_storage:source",
};

test("both image lookups require ownership and never expose another user's storage URL", async () => {
  const db = new TestDb();
  const id = db.seed("images", {
    userId: "users:owner",
    status: { kind: "uploaded", image: source },
  });
  for (const caller of [null, "users:other"]) {
    const ctx = { db, auth: auth(caller) };
    expect(await invoke(findImage, ctx, { imageId: id })).toBeNull();
    await expect(invoke(getImage, ctx, { imageId: id })).rejects.toThrow();
  }
  expect(
    (await invoke(getImage, { db, auth: auth("users:owner") }, { imageId: id }))
      .status.image,
  ).toEqual(source);
});

test("generation and regeneration share the budget before scheduling or changing images", async () => {
  process.env.IMAGE_GLOBAL_DAILY_LIMIT = "1";
  const db = new TestDb();
  const first = db.seed("images", {
    userId: "users:one",
    status: { kind: "uploaded", image: source },
  });
  const second = db.seed("images", {
    userId: "users:two",
    status: {
      kind: "generated",
      image: source,
      decoratedImage: source,
      prompt: "old",
    },
  });
  const runAfter = mock(async () => "scheduled");
  const deleteFile = mock(async () => {});
  const context = (id: string) => ({
    db,
    auth: auth(id),
    scheduler: { runAfter },
    storage: { delete: deleteFile },
  });
  await invoke(startGeneration, context("users:one"), {
    imageId: first,
    prompt: "Add a plant",
  });
  expect((await db.get(first)).status.kind).toBe("generating");
  expect(runAfter).toHaveBeenCalledTimes(1);
  await expect(
    invoke(startRegeneration, context("users:two"), {
      imageId: second,
      prompt: "Add a chair",
      baseImage: "original",
    }),
  ).rejects.toThrow("limit");
  expect((await db.get(second)).status.kind).toBe("generated");
  expect(runAfter).toHaveBeenCalledTimes(1);
  expect(deleteFile).not.toHaveBeenCalled();
});

test("bad prompts and duplicate starts do not schedule work or consume quota", async () => {
  const db = new TestDb();
  const id = db.seed("images", {
    userId: "users:owner",
    status: { kind: "uploaded", image: source },
  });
  const runAfter = mock(async () => "scheduled");
  const ctx = { db, auth: auth("users:owner"), scheduler: { runAfter } };
  await expect(
    invoke(startGeneration, ctx, { imageId: id, prompt: "x".repeat(2001) }),
  ).rejects.toThrow("prompt");
  expect(await db.query("abuseLimits").collect()).toHaveLength(0);
  await invoke(startGeneration, ctx, { imageId: id, prompt: "Add a plant" });
  await expect(
    invoke(startGeneration, ctx, { imageId: id, prompt: "Again" }),
  ).rejects.toThrow("not ready");
  expect(runAfter).toHaveBeenCalledTimes(1);
});

// Simulates the upload HTTP action's world: real handlers over a TestDb, with
// storage that tracks which blobs exist.
function uploadWorld() {
  const db = new TestDb();
  db.insert = async (table: string, row: any) =>
    db.seed(table, { _creationTime: Date.now(), ...row });
  const blobs = new Map<string, { size: number; contentType?: string }>();
  let blobCount = 0;
  (db as any).system = { get: async (id: string) => blobs.get(id) ?? null };
  const storage = {
    store: async (blob: Blob) => {
      const id = `_storage:upload${++blobCount}`;
      blobs.set(id, { size: blob.size, contentType: blob.type });
      return id;
    },
    getUrl: async (id: string) => `https://storage.invalid/${id}`,
    delete: async (id: string) => {
      blobs.delete(id);
    },
  };
  let mutations: Promise<unknown> = Promise.resolve();
  const action = {
    storage,
    runQuery: (ref: any, args: any) => {
      expect(getFunctionName(ref)).toBe("images:checkUploadTarget");
      return invoke(checkUploadTarget, { db }, args);
    },
    // Convex mutations are serializable, so run them one at a time here.
    runMutation: (ref: any, args: any) => {
      expect(getFunctionName(ref)).toBe("images:completeUpload");
      const run = mutations.then(() =>
        invoke(completeUpload, { db, storage }, args),
      );
      mutations = run.catch(() => {});
      return run;
    },
  };
  const as = (userId: string) => ({ db, storage, auth: auth(userId) });
  const startUpload = async (userId: string) => {
    const { uploadUrl, imageId } = await invoke(generateUploadUrl, as(userId));
    return { uploadUrl: uploadUrl as string, imageId: imageId as string };
  };
  const post = (url: string, type = "image/webp", bytes = 10) =>
    invoke(
      uploadImage,
      action,
      new Request(url, {
        method: "POST",
        headers: { "Content-Type": type },
        body: new Uint8Array(bytes),
      }),
    ) as Promise<Response>;
  return { db, blobs, storage, as, startUpload, post };
}

test("uploads are stored and linked by the server, not by a client storage ID", async () => {
  process.env.CONVEX_SITE_URL = "https://site.invalid";
  const world = uploadWorld();
  const { uploadUrl, imageId } = await world.startUpload("users:owner");
  expect(uploadUrl).toStartWith("https://site.invalid/images/upload?");

  const response = await world.post(uploadUrl);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    imageId,
    storageId: "_storage:upload1",
  });
  const image = await world.db.get(imageId);
  expect(image.status).toEqual({
    kind: "uploaded",
    image: {
      url: "https://storage.invalid/_storage:upload1",
      storageId: "_storage:upload1",
    },
  });

  // The link is single use, and a second (parallel) claim leaves no blob behind.
  const again = await world.post(uploadUrl);
  expect(again.status).toBe(403);
  expect([...world.blobs.keys()]).toEqual(["_storage:upload1"]);
  expect((await world.db.get(imageId)).status).toEqual(image.status);
});

test("racing claims on one upload link link exactly one blob", async () => {
  process.env.CONVEX_SITE_URL = "https://site.invalid";
  const world = uploadWorld();
  const { uploadUrl, imageId } = await world.startUpload("users:owner");
  const results = await Promise.all([
    world.post(uploadUrl),
    world.post(uploadUrl),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 403]);
  const linked = (await world.db.get(imageId)).status.image.storageId;
  expect([...world.blobs.keys()]).toEqual([linked]);
});

test("someone else's upload link, a wrong token or a bad file can't link a blob", async () => {
  process.env.CONVEX_SITE_URL = "https://site.invalid";
  const world = uploadWorld();
  const victim = await world.startUpload("users:victim");
  const attacker = await world.startUpload("users:attacker");

  // Attacker's own token against the victim's image.
  const forged = new URL(victim.uploadUrl);
  forged.searchParams.set(
    "token",
    new URL(attacker.uploadUrl).searchParams.get("token")!,
  );
  expect((await world.post(forged.toString())).status).toBe(403);
  // SVG and oversized uploads are refused before storing anything.
  expect((await world.post(attacker.uploadUrl, "image/svg+xml")).status).toBe(
    413,
  );
  expect(
    (await world.post(attacker.uploadUrl, "image/svg+xml;charset=utf-8")).status,
  ).toBe(413);
  expect(
    (await world.post(attacker.uploadUrl, "image/png", 11 * 1024 * 1024))
      .status,
  ).toBe(413);
  expect(world.blobs.size).toBe(0);
  expect((await world.db.get(victim.imageId)).status.kind).toBe("uploading");

  // Expired links stop working.
  await world.db.patch(attacker.imageId, {
    _creationTime: Date.now() - 2 * HOUR,
  });
  expect((await world.post(attacker.uploadUrl)).status).toBe(403);
  expect(world.blobs.size).toBe(0);
});

test("a cached old frontend can finish an upload the server already linked", async () => {
  process.env.CONVEX_SITE_URL = "https://site.invalid";
  const world = uploadWorld();
  const { uploadUrl, imageId } = await world.startUpload("users:owner");
  const response = await world.post(uploadUrl);
  // Old frontends read storageId from the response and pass it back.
  const { storageId } = await response.json();
  expect(storageId).toBe("_storage:upload1");
  const linked = await world.db.get(imageId);

  await invoke(markUploaded, world.as("users:owner"), { imageId, storageId });
  expect(await world.db.get(imageId)).toEqual(linked);
});

test("markUploaded never links a storage ID the server didn't link", async () => {
  process.env.CONVEX_SITE_URL = "https://site.invalid";
  const world = uploadWorld();
  const victim = await world.startUpload("users:victim");
  await world.post(victim.uploadUrl);
  const victimImage = await world.db.get(victim.imageId);
  const victimBlob = victimImage.status.image.storageId;
  const attacker = await world.startUpload("users:attacker");
  const attackerUploading = await world.db.get(attacker.imageId);

  const refused = (userId: string | null, imageId: string, storageId: string) =>
    expect(
      invoke(
        markUploaded,
        { db: world.db, storage: world.storage, auth: auth(userId) },
        { imageId, storageId },
      ),
    ).rejects.toThrow();

  // A still-uploading image (new token or a raw URL from before the change).
  await refused("users:attacker", attacker.imageId, victimBlob);
  const legacy = world.db.seed("images", {
    userId: "users:attacker",
    status: { kind: "uploading" },
  });
  await expect(
    invoke(markUploaded, world.as("users:attacker"), {
      imageId: legacy,
      storageId: victimBlob,
    }),
  ).rejects.toThrow("Refresh the page");
  // Someone else's image, a mismatched blob, or no sign-in.
  await refused("users:attacker", victim.imageId, victimBlob);
  await refused("users:victim", victim.imageId, "_storage:other");
  await refused(null, victim.imageId, victimBlob);

  expect(await world.db.get(attacker.imageId)).toEqual(attackerUploading);
  expect((await world.db.get(legacy)).status).toEqual({ kind: "uploading" });
  expect(await world.db.get(victim.imageId)).toEqual(victimImage);
  expect([...world.blobs.keys()]).toEqual([victimBlob]);
});

test("deleting an image that shares a legacy-adopted blob keeps the victim's blob", async () => {
  process.env.CONVEX_SITE_URL = "https://site.invalid";
  const world = uploadWorld();
  const victim = await world.startUpload("users:victim");
  await world.post(victim.uploadUrl);
  const victimImage = await world.db.get(victim.imageId);
  const victimBlob = victimImage.status.image.storageId;

  // Before this fix, markUploaded let anyone link a known storage ID.
  const adopted = world.db.seed("images", {
    userId: "users:attacker",
    status: {
      kind: "generated",
      image: victimImage.status.image,
      decoratedImage: victimImage.status.image,
      prompt: "steal",
    },
  });
  await invoke(deleteImage, world.as("users:attacker"), { imageId: adopted });
  expect(await world.db.get(adopted)).toBeNull();
  expect(world.blobs.has(victimBlob)).toBe(true);
  expect(await world.db.get(victim.imageId)).toEqual(victimImage);

  // The owner can still delete it once nothing else references it.
  await invoke(deleteImage, world.as("users:victim"), {
    imageId: victim.imageId,
  });
  expect(world.blobs.has(victimBlob)).toBe(false);
});

test("an upload started before this change can't be completed or hijacked", async () => {
  const world = uploadWorld();
  const legacy = world.db.seed("images", {
    _creationTime: Date.now(),
    userId: "users:owner",
    status: { kind: "uploading" },
  });
  const url = `https://site.invalid/images/upload?imageId=${legacy}&token=undefined`;
  expect((await world.post(url)).status).toBe(403);
  expect((await world.db.get(legacy)).status).toEqual({ kind: "uploading" });
});

test("quota rows roll over in place and a denied secondary bucket writes nothing", async () => {
  const db = new TestDb();
  const ctx = { db } as any;
  await reserveLimits(ctx, [{ key: "day", windowMs: DAY, maximum: 1 }], 0);
  await expect(
    reserveLimits(
      ctx,
      [
        { key: "new", windowMs: DAY, maximum: 1 },
        { key: "day", windowMs: DAY, maximum: 1 },
      ],
      1,
    ),
  ).rejects.toThrow("limit");
  expect(await db.query("abuseLimits").collect()).toHaveLength(1);
  await reserveLimits(ctx, [{ key: "day", windowMs: DAY, maximum: 1 }], DAY);
  expect(await db.query("abuseLimits").collect()).toHaveLength(1);
  process.env.IMAGE_GLOBAL_DAILY_LIMIT = "NaN";
  expect(dailyLimit("IMAGE_GLOBAL_DAILY_LIMIT", 30)).toBe(30);
});

test("scheduled generation finishes through the internal lookup without browser auth", async () => {
  const decorated = {
    url: "https://storage.invalid/decorated",
    storageId: "_storage:decorated",
  };
  mock.module("../convex/generate/openai", () => ({
    generateWithOpenAI: async () => decorated,
  }));
  mock.module("../convex/generate/google", () => ({
    generateWithGoogle: async () => decorated,
  }));
  const { generateDecoratedImage } = await import(
    "../convex/generate/generate"
  );
  const db = new TestDb();
  const imageId = db.seed("images", {
    userId: "users:owner",
    status: { kind: "generating", image: source, prompt: "Add a plant" },
  });
  await invoke(
    generateDecoratedImage,
    {
      storage: { delete: async () => {} },
      runQuery: async (ref: any) => {
        expect(getFunctionName(ref)).toBe("images:getImageInternal");
        return db.get(imageId);
      },
      runMutation: async (ref: any, args: any) =>
        invoke(
          getFunctionName(ref) === "images:finishGeneration"
            ? finishGeneration
            : failGeneration,
          { db },
          args,
        ),
    },
    {
      imageId,
      image: source,
      model: "openai/gpt-image-1",
      prompt: "Add a plant",
    },
  );
  expect((await db.get(imageId)).status.decoratedImage).toEqual(decorated);
  expect((await db.get(imageId)).status.kind).toBe("generated");
});

test("failed regeneration restores the previous decoration and prompt", async () => {
  const db = new TestDb();
  const imageId = db.seed("images", {
    userId: "users:owner",
    status: { kind: "generating", image: source, prompt: "new" },
  });
  const previousGeneration = {
    decoratedImage: { ...source, storageId: "_storage:old" },
    prompt: "old",
  };
  await invoke(failGeneration, { db }, { imageId, previousGeneration });
  expect((await db.get(imageId)).status).toEqual({
    kind: "generated",
    image: source,
    ...previousGeneration,
  });
});

// Runs a regeneration started through startRegeneration with a mocked
// provider, optionally deleting the image before work starts or while the
// provider is running. `legacy` strips the old decoration from the generating
// record, like jobs queued before it was kept there. `attacker` seeds someone
// else's legacy-adopted image pointing at the old decoration, which can be
// deleted while the provider runs.
async function runRegeneration({
  fails,
  deleteAt,
  legacy = false,
  attacker,
}: {
  fails: boolean;
  deleteAt?: "before" | "during";
  legacy?: boolean;
  attacker?: { linkAs: "image" | "decoratedImage"; deleteDuring: boolean };
}) {
  const db = new TestDb();
  const old = { url: "https://storage.invalid/old", storageId: "_storage:old" };
  const fresh = {
    url: "https://storage.invalid/new",
    storageId: "_storage:new",
  };
  const blobs = new Set([source.storageId, old.storageId]);
  (db as any).system = {
    get: async (id: string) => (blobs.has(id) ? { _id: id } : null),
  };
  const deleted: string[] = [];
  // Like Convex, deleting a missing file throws.
  const storage = {
    delete: async (id: string) => {
      if (!blobs.delete(id)) throw new Error("Storage already deleted");
      deleted.push(id);
    },
  };
  const imageId = db.seed("images", {
    userId: "users:owner",
    status: {
      kind: "generated",
      image: source,
      decoratedImage: old,
      prompt: "old",
    },
  });
  const attackerImageId =
    attacker &&
    db.seed("images", {
      userId: "users:attacker",
      status:
        attacker.linkAs === "image"
          ? { kind: "uploaded", image: old }
          : {
              kind: "generated",
              image: source,
              decoratedImage: old,
              prompt: "x",
            },
    });
  let jobArgs: any;
  await invoke(
    startRegeneration,
    {
      db,
      auth: auth("users:owner"),
      storage,
      scheduler: {
        runAfter: async (_delay: number, _ref: any, args: any) => {
          jobArgs = args;
        },
      },
    },
    { imageId, prompt: "new", baseImage: "decorated" },
  );
  if (legacy) {
    const { decoratedImage, ...status } = (await db.get(imageId)).status;
    await db.patch(imageId, { status });
  }
  const as = (userId: string) => ({ db, storage, auth: auth(userId) });
  const remove = () => invoke(deleteImage, as("users:owner"), { imageId });
  let providerCalls = 0;
  const provider = async () => {
    providerCalls++;
    if (attacker?.deleteDuring)
      await invoke(deleteImage, as("users:attacker"), {
        imageId: attackerImageId,
      });
    if (deleteAt === "during") await remove();
    if (fails) throw new Error("Provider failed");
    blobs.add(fresh.storageId);
    return fresh;
  };
  mock.module("../convex/generate/openai", () => ({
    generateWithOpenAI: provider,
  }));
  mock.module("../convex/generate/google", () => ({
    generateWithGoogle: provider,
  }));
  const { generateDecoratedImage } = await import(
    "../convex/generate/generate"
  );
  if (deleteAt === "before") await remove();
  const mutations: Record<string, any> = {
    "images:finishGeneration": finishGeneration,
    "images:failGeneration": failGeneration,
    "images:releaseStorage": releaseStorage,
  };
  await invoke(
    generateDecoratedImage,
    {
      storage,
      runQuery: async () => db.get(imageId),
      runMutation: async (ref: any, args: any) =>
        invoke(mutations[getFunctionName(ref)], { db, storage }, args),
    },
    { ...jobArgs, model: "openai/gpt-image-1" },
  );
  return {
    db,
    imageId,
    attackerImageId,
    blobs,
    deleted,
    providerCalls,
    remove,
  };
}

test("regeneration keeps the old decoration on the generating record", async () => {
  const run = await runRegeneration({ fails: true, deleteAt: undefined });
  // Restored after failure; the job args still carry the rollback data.
  expect((await run.db.get(run.imageId)).status).toMatchObject({
    kind: "generated",
    decoratedImage: { storageId: "_storage:old" },
    prompt: "old",
  });
  const db = new TestDb();
  const old = { url: "https://storage.invalid/old", storageId: "_storage:old" };
  const imageId = db.seed("images", {
    userId: "users:owner",
    status: {
      kind: "generated",
      image: source,
      decoratedImage: old,
      prompt: "old",
    },
  });
  await invoke(
    startRegeneration,
    { db, auth: auth("users:owner"), scheduler: { runAfter: async () => {} } },
    { imageId, prompt: "new", baseImage: "original" },
  );
  expect((await db.get(imageId)).status).toEqual({
    kind: "generating",
    image: source,
    prompt: "new",
    decoratedImage: old,
  });
});

for (const legacy of [false, true]) {
  const label = legacy ? " (job queued before this change)" : "";

  test(`deleting during a successful regeneration removes old and new decorations${label}`, async () => {
    const run = await runRegeneration({
      fails: false,
      deleteAt: "during",
      legacy,
    });
    expect(await run.db.get(run.imageId)).toBeNull();
    expect(run.deleted.sort()).toEqual(
      ["_storage:new", "_storage:old", "_storage:source"].sort(),
    );
    // Deleting again is a no-op rather than an error.
    await run.remove();
  });

  test(`deleting during a failed regeneration removes the preserved old decoration${label}`, async () => {
    const run = await runRegeneration({
      fails: true,
      deleteAt: "during",
      legacy,
    });
    expect(await run.db.get(run.imageId)).toBeNull();
    expect(run.deleted.sort()).toEqual(["_storage:old", "_storage:source"]);
  });

  test(`deleting before a queued regeneration runs skips the provider and cleans up${label}`, async () => {
    const run = await runRegeneration({
      fails: false,
      deleteAt: "before",
      legacy,
    });
    expect(run.providerCalls).toBe(0);
    expect(run.deleted.sort()).toEqual(["_storage:old", "_storage:source"]);
  });
}

test("a failed regeneration with the image still present keeps the old decoration", async () => {
  const run = await runRegeneration({ fails: true });
  expect(run.deleted).toEqual([]);
  expect((await run.db.get(run.imageId)).status).toMatchObject({
    kind: "generated",
    decoratedImage: { storageId: "_storage:old" },
    prompt: "old",
  });
});

test("a successful regeneration replaces and removes the old decoration", async () => {
  const run = await runRegeneration({ fails: false });
  expect(run.deleted).toEqual(["_storage:old"]);
  expect((await run.db.get(run.imageId)).status).toMatchObject({
    kind: "generated",
    decoratedImage: { storageId: "_storage:new" },
    prompt: "new",
  });
});

for (const linkAs of ["image", "decoratedImage"] as const) {
  test(`an attacker deleting a legacy ${linkAs} link mid-regeneration can't destroy the victim's old decoration`, async () => {
    const run = await runRegeneration({
      fails: true,
      attacker: { linkAs, deleteDuring: true },
    });
    expect(await run.db.get(run.attackerImageId)).toBeNull();
    expect(run.blobs.has("_storage:old")).toBe(true);
    expect(run.deleted).toEqual([]);
    expect((await run.db.get(run.imageId)).status).toMatchObject({
      kind: "generated",
      decoratedImage: { storageId: "_storage:old" },
      prompt: "old",
    });
  });

  test(`regeneration cleanup keeps an old decoration another image still links as ${linkAs}`, async () => {
    const attacker = { linkAs, deleteDuring: false };
    const replaced = await runRegeneration({ fails: false, attacker });
    expect(replaced.blobs.has("_storage:old")).toBe(true);
    expect(replaced.deleted).toEqual([]);
    expect((await replaced.db.get(replaced.imageId)).status).toMatchObject({
      decoratedImage: { storageId: "_storage:new" },
    });

    for (const deleteAt of ["before", "during"] as const) {
      for (const fails of [false, true]) {
        const run = await runRegeneration({ fails, deleteAt, attacker });
        expect(await run.db.get(run.imageId)).toBeNull();
        expect(run.blobs.has("_storage:old")).toBe(true);
        // The attacker's link still works until they delete it, which then
        // removes the last reference.
        expect(await run.db.get(run.attackerImageId)).not.toBeNull();
        await invoke(
          deleteImage,
          {
            db: run.db,
            storage: { delete: async (id: string) => run.blobs.delete(id) },
            auth: auth("users:attacker"),
          },
          { imageId: run.attackerImageId },
        );
        expect(run.blobs.has("_storage:old")).toBe(false);
      }
    }
  });
}
