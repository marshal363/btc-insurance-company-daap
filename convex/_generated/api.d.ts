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
import type * as blockchainIntegration from "../blockchainIntegration.js";
import type * as blockchainPreparation from "../blockchainPreparation.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as options from "../options.js";
import type * as oracleSubmissions from "../oracleSubmissions.js";
import type * as policyRegistry from "../policyRegistry.js";
import type * as premium from "../premium.js";
import type * as prices from "../prices.js";
import type * as quotes from "../quotes.js";
import type * as router from "../router.js";
import type * as types from "../types.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  blockchainIntegration: typeof blockchainIntegration;
  blockchainPreparation: typeof blockchainPreparation;
  crons: typeof crons;
  http: typeof http;
  options: typeof options;
  oracleSubmissions: typeof oracleSubmissions;
  policyRegistry: typeof policyRegistry;
  premium: typeof premium;
  prices: typeof prices;
  quotes: typeof quotes;
  router: typeof router;
  types: typeof types;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
