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
import type * as liquidityPool_accountManagement from "../liquidityPool/accountManagement.js";
import type * as liquidityPool_adminOperations from "../liquidityPool/adminOperations.js";
import type * as liquidityPool_capitalManagement from "../liquidityPool/capitalManagement.js";
import type * as liquidityPool_policyLifecycle from "../liquidityPool/policyLifecycle.js";
import type * as liquidityPool_poolState from "../liquidityPool/poolState.js";
import type * as liquidityPool_premiumOperations from "../liquidityPool/premiumOperations.js";
import type * as liquidityPool_providerState from "../liquidityPool/providerState.js";
import type * as liquidityPool_settlementProcessing from "../liquidityPool/settlementProcessing.js";
import type * as liquidityPool_transactionManager from "../liquidityPool/transactionManager.js";
import type * as liquidityPool_types from "../liquidityPool/types.js";
import type * as liquidityPool from "../liquidityPool.js";
import type * as mocks from "../mocks.js";
import type * as options from "../options.js";
import type * as oracleSubmissions from "../oracleSubmissions.js";
import type * as policyRegistry_counterpartyOperations from "../policyRegistry/counterpartyOperations.js";
import type * as policyRegistry_eligibilityChecks from "../policyRegistry/eligibilityChecks.js";
import type * as policyRegistry_eventTracking from "../policyRegistry/eventTracking.js";
import type * as policyRegistry_policyLifecycle from "../policyRegistry/policyLifecycle.js";
import type * as policyRegistry_premiumDistribution from "../policyRegistry/premiumDistribution.js";
import type * as policyRegistry_premiumServices from "../policyRegistry/premiumServices.js";
import type * as policyRegistry_queries from "../policyRegistry/queries.js";
import type * as policyRegistry_reconciliation from "../policyRegistry/reconciliation.js";
import type * as policyRegistry_settlementServices from "../policyRegistry/settlementServices.js";
import type * as policyRegistry_transactionManager from "../policyRegistry/transactionManager.js";
import type * as policyRegistry_types from "../policyRegistry/types.js";
import type * as policyRegistry from "../policyRegistry.js";
import type * as poolTransactionWatcher from "../poolTransactionWatcher.js";
import type * as premium from "../premium.js";
import type * as prices from "../prices.js";
import type * as quotes from "../quotes.js";
import type * as reconciliationJobs from "../reconciliationJobs.js";
import type * as router from "../router.js";
import type * as settlementJobs from "../settlementJobs.js";
import type * as transactionStatusJobs from "../transactionStatusJobs.js";
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
  "liquidityPool/accountManagement": typeof liquidityPool_accountManagement;
  "liquidityPool/adminOperations": typeof liquidityPool_adminOperations;
  "liquidityPool/capitalManagement": typeof liquidityPool_capitalManagement;
  "liquidityPool/policyLifecycle": typeof liquidityPool_policyLifecycle;
  "liquidityPool/poolState": typeof liquidityPool_poolState;
  "liquidityPool/premiumOperations": typeof liquidityPool_premiumOperations;
  "liquidityPool/providerState": typeof liquidityPool_providerState;
  "liquidityPool/settlementProcessing": typeof liquidityPool_settlementProcessing;
  "liquidityPool/transactionManager": typeof liquidityPool_transactionManager;
  "liquidityPool/types": typeof liquidityPool_types;
  liquidityPool: typeof liquidityPool;
  mocks: typeof mocks;
  options: typeof options;
  oracleSubmissions: typeof oracleSubmissions;
  "policyRegistry/counterpartyOperations": typeof policyRegistry_counterpartyOperations;
  "policyRegistry/eligibilityChecks": typeof policyRegistry_eligibilityChecks;
  "policyRegistry/eventTracking": typeof policyRegistry_eventTracking;
  "policyRegistry/policyLifecycle": typeof policyRegistry_policyLifecycle;
  "policyRegistry/premiumDistribution": typeof policyRegistry_premiumDistribution;
  "policyRegistry/premiumServices": typeof policyRegistry_premiumServices;
  "policyRegistry/queries": typeof policyRegistry_queries;
  "policyRegistry/reconciliation": typeof policyRegistry_reconciliation;
  "policyRegistry/settlementServices": typeof policyRegistry_settlementServices;
  "policyRegistry/transactionManager": typeof policyRegistry_transactionManager;
  "policyRegistry/types": typeof policyRegistry_types;
  policyRegistry: typeof policyRegistry;
  poolTransactionWatcher: typeof poolTransactionWatcher;
  premium: typeof premium;
  prices: typeof prices;
  quotes: typeof quotes;
  reconciliationJobs: typeof reconciliationJobs;
  router: typeof router;
  settlementJobs: typeof settlementJobs;
  transactionStatusJobs: typeof transactionStatusJobs;
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
