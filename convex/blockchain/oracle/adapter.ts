/**
 * Oracle Adapter Module
 * 
 * This module provides backward compatibility for the existing
 * blockchainIntegration.ts functions by adapting them to use the new
 * modular Oracle implementation.
 */

import { v } from "convex/values";
import { action, internalAction } from '../../_generated/server';
import { 
  OraclePriceReadResponse, 
  OracleSubmissionParams, 
  OracleSubmissionEvaluationResult,
  OracleSubmissionCheckResult
} from './types';
import { readLatestOraclePrice, getFormattedOraclePrice } from './priceReader';
import { 
  prepareOracleSubmission, 
  submitAggregatedPrice as submitPrice, 
  checkAndSubmitOraclePrice 
} from './priceWriter';

/**
 * Adapter for the original readLatestOraclePrice function.
 * 
 * @returns {Promise<{ price: string | null, timestamp: string | null, error?: string }>}
 */
export const readLatestOraclePriceAdapter = internalAction({
  handler: async (ctx): Promise<{ price: string | null, timestamp: string | null, error?: string }> => {
    console.log("Oracle adapter: Executing readLatestOraclePrice");
    try {
      const result = await readLatestOraclePrice();
      return {
        price: result.data?.price || null,
        timestamp: result.data?.timestamp || null,
        error: result.error
      };
    } catch (error: any) {
      console.error("Error in readLatestOraclePriceAdapter:", error);
      return {
        price: null,
        timestamp: null,
        error: error.message || "Unknown error in Oracle adapter"
      };
    }
  }
});

/**
 * Adapter for the original prepareOracleSubmission function.
 * 
 * @param price - The current price value
 * @param timestamp - The current timestamp
 * @param sourceCount - Number of sources used to calculate the aggregated price
 * @returns Submission preparation result
 */
export const prepareOracleSubmissionAdapter = internalAction({
  args: {
    price: v.number(),
    timestamp: v.number(),
    sourceCount: v.optional(v.number())
  },
  handler: async (ctx, args): Promise<OracleSubmissionEvaluationResult> => {
    console.log("Oracle adapter: Executing prepareOracleSubmission");
    try {
      const { price, timestamp, sourceCount } = args;
      const priceInSatoshis = Math.round(price * 100000000);
      
      const result = await prepareOracleSubmission({
        currentPriceUSD: price,
        currentTimestamp: timestamp,
        sourceCount: sourceCount || 0
      });
      
      return {
        shouldUpdate: result.shouldUpdate,
        reason: result.reason,
        priceInSatoshis: priceInSatoshis,
        currentTimestamp: timestamp,
        percentChange: result.percentChange,
        sourceCount: sourceCount
      };
    } catch (error: any) {
      console.error("Error in prepareOracleSubmissionAdapter:", error);
      return {
        shouldUpdate: false,
        reason: `Error preparing oracle submission: ${error.message}`
      };
    }
  }
});

/**
 * Adapter for the original submitAggregatedPrice function.
 * 
 * @param priceInSatoshis - The price in satoshis to submit
 * @returns Transaction ID result
 */
export const submitAggregatedPriceAdapter = action({
  args: { priceInSatoshis: v.number() },
  handler: async (ctx, { priceInSatoshis }): Promise<{ txid: string }> => {
    console.log(`Oracle adapter: Executing submitAggregatedPrice with price: ${priceInSatoshis}`);
    try {
      const result = await submitPrice({ priceInSatoshis });
      return { txid: result.txid };
    } catch (error: any) {
      console.error("Error in submitAggregatedPriceAdapter:", error);
      throw new Error(`Failed to submit aggregated price: ${error.message}`);
    }
  }
});

/**
 * Adapter for the original checkAndSubmitOraclePrice function.
 * 
 * @param price - The current price value
 * @param timestamp - The current timestamp
 * @param sourceCount - Number of sources used to calculate the aggregated price
 * @returns Result of the check and submit operation
 */
export const checkAndSubmitOraclePriceAdapter = internalAction({
  args: {
    price: v.number(),
    timestamp: v.number(),
    sourceCount: v.optional(v.number())
  },
  handler: async (ctx, args): Promise<{ txid?: string, reason?: string, percentChange?: number | null } | undefined> => {
    console.log("Oracle adapter: Executing checkAndSubmitOraclePrice");
    try {
      const { price, timestamp, sourceCount } = args;
      
      const result = await checkAndSubmitOraclePrice({
        currentPriceUSD: price,
        currentTimestamp: timestamp,
        sourceCount: sourceCount || 0
      }) as OracleSubmissionCheckResult;
      
      if (result && result.txid) {
        return {
          txid: result.txid,
          reason: result.reason,
          percentChange: result.percentChange
        };
      }
      
      return undefined;
    } catch (error: any) {
      console.error("Error in checkAndSubmitOraclePriceAdapter:", error);
      return undefined;
    }
  }
}); 