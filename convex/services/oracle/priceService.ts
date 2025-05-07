/**
 * Oracle Price Service
 * 
 * This module provides services for price data aggregation, calculation, and blockchain interaction.
 * It serves as a bridge between the data layer and the blockchain integration layer.
 */

import { action, internalAction, query, internalQuery, internalMutation } from '../../_generated/server';
import { v } from "convex/values";
import { Id } from "../../_generated/dataModel";
import { internal, api } from "../../_generated/api";
import { OraclePriceData } from '../../blockchain/oracle/types';
import { getFormattedOraclePrice } from '../../blockchain/oracle/priceReader';
import { 
  checkAndSubmitOraclePrice, 
  ORACLE_UPDATE_THRESHOLDS 
} from '../../blockchain/oracle/priceWriter';

/**
 * Retrieves the latest price data from various sources and calculates a weighted average.
 * 
 * @returns {Promise<{ price: number; timestamp: number; sources: string[]; sourceCount: number } | null>}
 */
export const getLatestPrice = internalQuery({
  handler: async (ctx) => {
    // Get the latest raw price data from the database
    const latestPrices = await ctx.db
      .query("priceFeed")
      .withIndex("by_timestamp")
      .filter(q => q.gt(q.field("timestamp"), Date.now() - 24 * 60 * 60 * 1000))
      .collect();

    if (latestPrices.length === 0) {
      console.log("No recent price data found in the database");
      return null;
    }

    // Process the data to get the latest price for each source
    const sourceMap = new Map<string, { price: number, timestamp: number }>();
    for (const price of latestPrices) {
      const currentLatest = sourceMap.get(price.source);
      if (!currentLatest || price.timestamp > currentLatest.timestamp) {
        sourceMap.set(price.source, {
          price: price.price,
          timestamp: price.timestamp,
        });
      }
    }

    // Calculate the weighted average
    let totalWeight = 0;
    let weightedPrice = 0;
    const sources: string[] = [];

    sourceMap.forEach((value, source) => {
      // Assign weights to different sources (can be more sophisticated)
      let weight = 1;
      if (source === "binance" || source === "coinbase") weight = 1.5;
      if (source === "kraken") weight = 1.3;
      
      weightedPrice += value.price * weight;
      totalWeight += weight;
      sources.push(source);
    });

    if (totalWeight === 0) {
      console.log("No valid sources with weights found");
      return null;
    }

    const averagePrice = weightedPrice / totalWeight;
    
    return {
      price: averagePrice,
      timestamp: Date.now(),
      sources,
      sourceCount: sources.length
    };
  }
});

/**
 * Calculates the 24-hour price range from historical data.
 * 
 * @returns {Promise<{ high: number; low: number; range: number } | null>}
 */
export const calculate24hRange = internalQuery({
  handler: async (ctx) => {
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    // Fetch historical prices from the last 24 hours
    const recentPrices = await ctx.db
      .query("historicalPrices")
      .withIndex("by_timestamp")
      .filter(q => q.gt(q.field("timestamp"), twentyFourHoursAgo))
      .collect();
    
    if (recentPrices.length === 0) {
      return null;
    }
    
    // Find the highest and lowest prices
    let high = -Infinity;
    let low = Infinity;
    
    for (const price of recentPrices) {
      const highValue = price.high ?? price.price;
      const lowValue = price.low ?? price.price;
      
      if (highValue > high) high = highValue;
      if (lowValue < low) low = lowValue;
    }
    
    if (high === -Infinity || low === Infinity) {
      return null;
    }
    
    const range = high - low;
    
    return { high, low, range };
  }
});

/**
 * Retrieves the latest on-chain oracle price.
 * 
 * @returns {Promise<OraclePriceData | null>}
 */
export const getLatestOnChainPrice = internalAction({
  handler: async (ctx) => {
    const result = await getFormattedOraclePrice();
    return result.data || null;
  }
});

/**
 * Checks if oracle price update criteria are met and submits if necessary.
 */
export const checkAndSubmitPrice = internalAction({
  handler: async (ctx) => {
    // Get the latest aggregated price
    const latestPrice = await ctx.runQuery(api.prices.getLatestPrice, {});
    
    if (!latestPrice) {
      const reason = "No aggregated price data available";
      console.log(`Oracle price submission skipped: ${reason}`);
      return {
        updated: false,
        reason
      };
    }
    
    // Check if an update is needed and perform it
    const result = await checkAndSubmitOraclePrice({
      currentPriceUSD: latestPrice.price, 
      currentTimestamp: latestPrice.timestamp,
      sourceCount: latestPrice.sourceCount
    });

    // Log the submission attempt
    console.log(`Oracle price submission attempt: ${result.updated ? 'Updated' : 'Skipped'}, Reason: ${result.reason}`);
    
    if (result.updated && result.txid) {
      // Record the submission in the database
      await ctx.runMutation(internal.oracleSubmissions.recordOracleSubmission, {
        txid: result.txid,
        submittedPriceSatoshis: Math.round(latestPrice.price * 100000000),
        reason: result.reason,
        sourceCount: latestPrice.sourceCount,
        status: "submitted",
        submissionTimestamp: Date.now(),
        percentChange: result.percentChange || 0
      });
    }
    
    return result;
  }
});

/**
 * Inserts a new price data point into the database.
 * Used for collecting price data from external sources.
 * 
 * @param source - The source of the price data (e.g., "coinbase", "binance")
 * @param priceUSD - The Bitcoin price in USD
 * @returns The ID of the inserted price record
 */
export const insertPriceData = internalMutation({
  args: {
    source: v.string(),
    priceUSD: v.number(),
  },
  handler: async (ctx, { source, priceUSD }): Promise<Id<"prices">> => {
    return await ctx.db.insert("prices", {
      source,
      priceUSD,
      timestamp: Date.now(),
    });
  },
});

/**
 * Updates the aggregated price in the database.
 * This should be called after calculating a new aggregated price.
 * 
 * @param price - The aggregated price
 * @param timestamp - The timestamp of the aggregation
 * @param sourceCount - Number of sources used in aggregation
 * @returns The ID of the inserted aggregated price record
 */
export const updateAggregatedPrice = internalMutation({
  args: {
    price: v.number(),
    timestamp: v.number(),
    sourceCount: v.number(),
  },
  handler: async (ctx, { price, timestamp, sourceCount }): Promise<Id<"aggregatedPrices">> => {
    return await ctx.db.insert("aggregatedPrices", {
      price,
      timestamp,
      sourceCount,
    });
  },
}); 