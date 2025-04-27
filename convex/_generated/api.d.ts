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
import type * as http from "../http.js";
import type * as index from "../index.js";
import type * as oracle_aggregator from "../oracle/aggregator.js";
import type * as oracle_priceFeeds from "../oracle/priceFeeds.js";
import type * as oracle_queries from "../oracle/queries.js";
import type * as oracle_setup from "../oracle/setup.js";
import type * as oracle from "../oracle.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  http: typeof http;
  index: typeof index;
  "oracle/aggregator": typeof oracle_aggregator;
  "oracle/priceFeeds": typeof oracle_priceFeeds;
  "oracle/queries": typeof oracle_queries;
  "oracle/setup": typeof oracle_setup;
  oracle: typeof oracle;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
