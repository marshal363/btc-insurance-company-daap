/**
 * Oracle Module Interface
 * 
 * This file re-exports essential functions from the oracle module
 * to simplify access to the bitcoin price oracle functionality
 */

// Export query functions
export { getLatestPrice, getPriceHistory, getSourcePrice, getOracleHealth } from "./oracle/queries";

// Export setup functions
export { initializeOracle, addManualPrice } from "./oracle/setup";

// Export types
export type { AggregatedPrice } from "./oracle/aggregator";
export type { PriceSource } from "./oracle/priceFeeds"; 