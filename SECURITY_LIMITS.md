# Image API abuse controls

## Limits and privacy

- `IMAGE_GLOBAL_DAILY_LIMIT`: **30** image generations/regenerations globally per UTC day, with 3/minute globally. Each authenticated user gets 4/hour and 10/day across both models and both entry points.
- `IMAGE_UPLOAD_DAILY_LIMIT`: **200** upload URL issuances globally per day. Each authenticated user gets 10/hour.

Generation quota is reserved in the same mutation as the status transition and scheduled action. Repeated starts or quota refusals cannot enqueue extra work or delete an existing decoration. Both `images.getImage` and `images.findImage` enforce ownership; scheduled generation uses a dedicated internal lookup without relying on browser auth. Upload completion cannot overwrite an image already uploaded or generating.

Prompts are limited to 2000 characters. Raster uploads are checked for a maximum of 10 MiB before generation; uploaded storage bytes cannot be capped by the existing direct-upload URL before upload completes. Source images are read by trusted storage ID, limited to 20 million decoded pixels, and normalized to at most 1024 by 1024 pixels. Output decoding also limits pixels and accepts at most 24 MiB of base64 data (18 MiB decoded). OpenAI uses one medium-quality 1024-square output, no automatic retries and a 60-second timeout. Gemini uses one candidate, a 2048-token output cap and a 60-second timeout.

The previous decorated image is retained until replacement succeeds, and restored with its previous prompt on generation failure. While a regeneration is queued or running, the old decoration also stays on the `generating` record as an optional `decoratedImage`, so it is still indexed and counts as a reference: another image being deleted can't treat it as unreferenced, and `deleteImage` on the regenerating image releases it too. The rollback prompt and image still travel in the job arguments. If the image is deleted while a regeneration is queued or running, the job removes any new output (which belongs to nothing) and releases the old decoration. When the document still exists, a failed regeneration never deletes the old decoration.

Every old decoration the job gives up (after a successful replace, or after its image was deleted) goes through the internal `images.releaseStorage` mutation, which deletes the blob only if no image references it as an original or decoration, checking and deleting in one transaction. Blobs another image still links, including legacy-adopted links, are kept until that image is deleted too. `deleteImage` on an already-deleted image is a no-op, and storage cleanup tolerates files that are already gone. The old optional queued-job argument remains accepted so already-scheduled work is compatible with the function update.

## Upload ownership

`images.generateUploadUrl` keeps its quota and return shape, but the URL now points at our own HTTP action (`/images/upload` in `convex/http.ts`) with a single-use token bound to that image, valid for an hour and only returned to its owner. The action checks the token, rejects SVG/non-image and over-10 MiB bodies, stores the bytes itself and links the new blob in an internal mutation; a losing parallel claim deletes its own blob. Clients never supply a storage ID, and the updated frontend just checks for a 2xx response.

Frontends cached from before this change still call `generateUploadUrl` (so they get the new URL), read `storageId` from the upload response and call `markUploaded({ imageId, storageId })`. The upload response still includes `storageId` for them, and `markUploaded` keeps its name and arguments but no longer writes anything. It succeeds only for the signed-in owner when the upload action has already linked that exact storage ID to that image. An image that's still uploading, belongs to someone else, or holds a different blob is refused and left untouched, so it can't be used to adopt a storage ID.

A raw storage upload URL issued before the deploy can't be supported safely: its image has no token and is still `uploading`, so `markUploaded` refuses it with a message telling the user to refresh and upload again. Any blob that upload created stays unlinked.

`deleteImage` only deletes a blob when no other image references it as its original or decoration. That covers images that linked someone else's blob under the old flow: deleting them can't remove the victim's blob, while the owner's own delete still cleans up once nothing else points at it. There's no reliable backfill that can tell which legacy link was the original, so such a legacy link keeps read access to that blob until it's deleted. One narrow gap remains for regenerations already queued or running at deploy time: their `generating` records predate the stored `decoratedImage`, so for those jobs only the job arguments know about the old decoration. If someone else's legacy link to that exact blob is deleted while such a job runs, it can still delete the blob and a failed regeneration would restore a broken decoration. It closes once those jobs finish, typically within a minute. Uploads left half-finished under the old flow have no token and can't be completed; the user just uploads again.

## Reservation behavior and schema

The additive `abuseLimits` table has `key: string`, `windowStart: number`, and `used: number`, indexed by `by_key`. Each scope reuses its counter row. The `uploading` image state gains an optional `uploadToken`, the `generating` state gains an optional `decoratedImage`, and `images` gains `by_image_storage` and `by_decorated_storage` indexes; all additive. No existing business records, API keys, or data need migration or deletion.

All applicable counters are checked and incremented in one mutation before paid work or its scheduler entry. Conflicting requests rely on [Convex atomic transactions and OCC](https://docs.convex.dev/database/advanced/occ). Failed provider attempts still consume reservations; there are no refunds that could permit retry abuse. Daily windows reset at midnight UTC, with fixed minute/hour windows where listed. These limits count requests, rather than estimating a dollar balance.

The new environment variables are optional numeric daily ceilings. Unset, empty, negative, fractional, or malformed values use the documented default; integers above 100000 also use the default. An explicit `0` stops that operation. There is no bypass flag. Per-user limits use the authenticated server identity. Anonymous demos retain shared global limits.

## Review and setup

Deploy the additive schema with the functions and frontend through the normal project workflow, and smoke-test an upload (it now POSTs to the deployment's `.convex.site` URL, which needs the CORS preflight route included here). Existing provider credentials remain required and unchanged. Defaults apply without adding any environment variables.


## Validation

Run `bun --no-env-file test tests/security.test.ts`. These tests invoke registered Convex handlers against a test database with mocked providers; they do not contact a deployment.

Run `./node_modules/.bin/tsc -p convex --noEmit --pretty false` for backend types. Run `./node_modules/.bin/tsc -p tsconfig.app.json --noEmit --pretty false` for app types.

Expected test count after this change: 26.

## Files changed

- `SECURITY_LIMITS.md`
- `convex/abuse.ts`
- `convex/generate/generate.ts`
- `convex/generate/google.ts`
- `convex/generate/lib.ts`
- `convex/generate/openai.ts`
- `convex/http.ts`
- `convex/images.ts`
- `convex/schema.ts`
- `tests/security.test.ts`
- `src/common/utils.ts`
- `tests/support.ts`

## Vercel previews

Production builds keep the existing Convex deploy and frontend build. Previews only build the frontend, using `VITE_CONVEX_URL` if supplied or the existing development backend `rare-grouse-703`. The build child has no Convex deploy key. A production key configured in Vercel therefore cannot deploy PR code to production.
