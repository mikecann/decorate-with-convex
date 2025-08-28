/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as auth from "../auth.js";
import type * as generate_generate from "../generate/generate.js";
import type * as generate_google from "../generate/google.js";
import type * as generate_lib from "../generate/lib.js";
import type * as generate_openai from "../generate/openai.js";
import type * as http from "../http.js";
import type * as images from "../images.js";
import type * as resend_ResendOTPPasswordReset from "../resend/ResendOTPPasswordReset.js";
import type * as router from "../router.js";
import type * as userSettings from "../userSettings.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "generate/generate": typeof generate_generate;
  "generate/google": typeof generate_google;
  "generate/lib": typeof generate_lib;
  "generate/openai": typeof generate_openai;
  http: typeof http;
  images: typeof images;
  "resend/ResendOTPPasswordReset": typeof resend_ResendOTPPasswordReset;
  router: typeof router;
  userSettings: typeof userSettings;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
