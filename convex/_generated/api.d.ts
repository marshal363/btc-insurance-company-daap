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
import type * as blockchain_common_contracts from "../blockchain/common/contracts.js";
import type * as blockchain_common_eventListener from "../blockchain/common/eventListener.js";
import type * as blockchain_common_index from "../blockchain/common/index.js";
import type * as blockchain_common_network from "../blockchain/common/network.js";
import type * as blockchain_common_transaction from "../blockchain/common/transaction.js";
import type * as blockchain_common_types from "../blockchain/common/types.js";
import type * as blockchain_common_utils from "../blockchain/common/utils.js";
import type * as blockchain_index from "../blockchain/index.js";
import type * as blockchain_liquidityPool_events from "../blockchain/liquidityPool/events.js";
import type * as blockchain_liquidityPool_index from "../blockchain/liquidityPool/index.js";
import type * as blockchain_liquidityPool_reader from "../blockchain/liquidityPool/reader.js";
import type * as blockchain_liquidityPool_types from "../blockchain/liquidityPool/types.js";
import type * as blockchain_liquidityPool_writer from "../blockchain/liquidityPool/writer.js";
import type * as blockchain_oracle_adapter from "../blockchain/oracle/adapter.js";
import type * as blockchain_oracle_index from "../blockchain/oracle/index.js";
import type * as blockchain_oracle_priceReader from "../blockchain/oracle/priceReader.js";
import type * as blockchain_oracle_priceWriter from "../blockchain/oracle/priceWriter.js";
import type * as blockchain_oracle_types from "../blockchain/oracle/types.js";
import type * as blockchain_policyRegistry_events from "../blockchain/policyRegistry/events.js";
import type * as blockchain_policyRegistry_index from "../blockchain/policyRegistry/index.js";
import type * as blockchain_policyRegistry_reader from "../blockchain/policyRegistry/reader.js";
import type * as blockchain_policyRegistry_types from "../blockchain/policyRegistry/types.js";
import type * as blockchain_policyRegistry_utils from "../blockchain/policyRegistry/utils.js";
import type * as blockchain_policyRegistry_writer from "../blockchain/policyRegistry/writer.js";
import type * as blockchain_testing_dependencyAnalyzer from "../blockchain/testing/dependencyAnalyzer.js";
import type * as blockchain_testing_mocks from "../blockchain/testing/mocks.js";
import type * as blockchainIntegration from "../blockchainIntegration.js";
import type * as blockchainPreparation from "../blockchainPreparation.js";
import type * as crons from "../crons.js";
import type * as dataIngestion from "../dataIngestion.js";
import type * as http from "../http.js";
import type * as liquidityPool_accountManagement from "../liquidityPool/accountManagement.js";
import type * as liquidityPool_adminOperations from "../liquidityPool/adminOperations.js";
import type * as liquidityPool_blockchainIntegration from "../liquidityPool/blockchainIntegration.js";
import type * as liquidityPool_capitalManagement from "../liquidityPool/capitalManagement.js";
import type * as liquidityPool_index from "../liquidityPool/index.js";
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
import type * as policyRegistry_blockchainIntegration from "../policyRegistry/blockchainIntegration.js";
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
import type * as services_index from "../services/index.js";
import type * as services_oracle_historicalData from "../services/oracle/historicalData.js";
import type * as services_oracle_index from "../services/oracle/index.js";
import type * as services_oracle_premiumCalculation from "../services/oracle/premiumCalculation.js";
import type * as services_oracle_priceService from "../services/oracle/priceService.js";
import type * as services_oracle_volatilityService from "../services/oracle/volatilityService.js";
import type * as settlementJobs from "../settlementJobs.js";
import type * as systemSetup from "../systemSetup.js";
import type * as testUtils from "../testUtils.js";
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
  "blockchain/common/contracts": typeof blockchain_common_contracts;
  "blockchain/common/eventListener": typeof blockchain_common_eventListener;
  "blockchain/common/index": typeof blockchain_common_index;
  "blockchain/common/network": typeof blockchain_common_network;
  "blockchain/common/transaction": typeof blockchain_common_transaction;
  "blockchain/common/types": typeof blockchain_common_types;
  "blockchain/common/utils": typeof blockchain_common_utils;
  "blockchain/index": typeof blockchain_index;
  "blockchain/liquidityPool/events": typeof blockchain_liquidityPool_events;
  "blockchain/liquidityPool/index": typeof blockchain_liquidityPool_index;
  "blockchain/liquidityPool/reader": typeof blockchain_liquidityPool_reader;
  "blockchain/liquidityPool/types": typeof blockchain_liquidityPool_types;
  "blockchain/liquidityPool/writer": typeof blockchain_liquidityPool_writer;
  "blockchain/oracle/adapter": typeof blockchain_oracle_adapter;
  "blockchain/oracle/index": typeof blockchain_oracle_index;
  "blockchain/oracle/priceReader": typeof blockchain_oracle_priceReader;
  "blockchain/oracle/priceWriter": typeof blockchain_oracle_priceWriter;
  "blockchain/oracle/types": typeof blockchain_oracle_types;
  "blockchain/policyRegistry/events": typeof blockchain_policyRegistry_events;
  "blockchain/policyRegistry/index": typeof blockchain_policyRegistry_index;
  "blockchain/policyRegistry/reader": typeof blockchain_policyRegistry_reader;
  "blockchain/policyRegistry/types": typeof blockchain_policyRegistry_types;
  "blockchain/policyRegistry/utils": typeof blockchain_policyRegistry_utils;
  "blockchain/policyRegistry/writer": typeof blockchain_policyRegistry_writer;
  "blockchain/testing/dependencyAnalyzer": typeof blockchain_testing_dependencyAnalyzer;
  "blockchain/testing/mocks": typeof blockchain_testing_mocks;
  blockchainIntegration: typeof blockchainIntegration;
  blockchainPreparation: typeof blockchainPreparation;
  crons: typeof crons;
  dataIngestion: typeof dataIngestion;
  http: typeof http;
  "liquidityPool/accountManagement": typeof liquidityPool_accountManagement;
  "liquidityPool/adminOperations": typeof liquidityPool_adminOperations;
  "liquidityPool/blockchainIntegration": typeof liquidityPool_blockchainIntegration;
  "liquidityPool/capitalManagement": typeof liquidityPool_capitalManagement;
  "liquidityPool/index": typeof liquidityPool_index;
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
  "policyRegistry/blockchainIntegration": typeof policyRegistry_blockchainIntegration;
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
  "services/index": typeof services_index;
  "services/oracle/historicalData": typeof services_oracle_historicalData;
  "services/oracle/index": typeof services_oracle_index;
  "services/oracle/premiumCalculation": typeof services_oracle_premiumCalculation;
  "services/oracle/priceService": typeof services_oracle_priceService;
  "services/oracle/volatilityService": typeof services_oracle_volatilityService;
  settlementJobs: typeof settlementJobs;
  systemSetup: typeof systemSetup;
  testUtils: typeof testUtils;
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
