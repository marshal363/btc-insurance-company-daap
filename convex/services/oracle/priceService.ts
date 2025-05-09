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
  checkAndSubmitOraclePrice as submitToBlockchain, 
  ORACLE_UPDATE_THRESHOLDS 
} from '../../blockchain/oracle/priceWriter';

/**
 * Price Aggregation Result
 */
interface AggregatedPriceResult {
  price: number;
  timestamp: number;
  volatility: number;
  sourceCount: number;
  range24h?: number;
  weightedSum?: number;
  totalWeight?: number;
  sourcesUsed?: string[];
}

/**
 * Fetches current prices from priceFeed, filters outliers using IQR,
 * calculates weighted average, and gets associated volatility and range.
 */
export const aggregateCurrentPrices = internalQuery({
  args: {},
  handler: async (ctx): Promise<AggregatedPriceResult | null> => {
    console.log("aggregateCurrentPrices query running...");

    // 1. Get the latest price for each source from priceFeed within the last ~15 minutes
    // (Adjust timeframe as needed, maybe 5-10 mins is better for live data)
    const relevantTime = Date.now() - 15 * 60 * 1000;
    const recentPrices = await ctx.db
      .query("priceFeed")
      .withIndex("by_timestamp")
      .filter(q => q.gt(q.field("timestamp"), relevantTime))
      .collect();

    if (recentPrices.length === 0) {
      console.warn("No recent price feed data found for aggregation.");
      return null;
    }

    // Get the single most recent price for each unique source
    const sourceMap = new Map<string, { price: number; timestamp: number; weight: number }>();
    for (const entry of recentPrices) {
      const current = sourceMap.get(entry.source);
      if (!current || entry.timestamp > current.timestamp) {
        sourceMap.set(entry.source, { 
          price: entry.price, 
          timestamp: entry.timestamp, 
          weight: entry.weight 
        });
      }
    }
    
    const fetchedPrices: { source: string; price: number; weight: number }[] = Array.from(sourceMap.values()).map((v, i) => ({ ...v, source: Array.from(sourceMap.keys())[i] }));
    console.log(`Found latest prices for ${fetchedPrices.length} unique sources.`);

    if (fetchedPrices.length === 0) {
      console.warn("No valid fetched prices to aggregate.");
      return null;
    }

    // 2. Outlier Filtering using IQR
    let pricesToAggregate = [...fetchedPrices];
    if (pricesToAggregate.length >= 4) {
      pricesToAggregate.sort((a, b) => a.price - b.price);
      const q1Index = Math.floor(pricesToAggregate.length / 4);
      const q3Index = Math.floor(pricesToAggregate.length * 3 / 4);
      const q1 = pricesToAggregate[q1Index].price;
      const q3 = pricesToAggregate[q3Index].price;
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;
      
      console.log(`IQR Outlier Detection: Count=${pricesToAggregate.length}, Q1=${q1}, Q3=${q3}, IQR=${iqr}, LowerBound=${lowerBound}, UpperBound=${upperBound}`);
      
      const originalCount = pricesToAggregate.length;
      pricesToAggregate = pricesToAggregate.filter(p => p.price >= lowerBound && p.price <= upperBound);
      const removedCount = originalCount - pricesToAggregate.length;
      if (removedCount > 0) {
        console.warn(`Removed ${removedCount} outliers based on IQR.`);
      }
    } else {
      console.log(`Skipping IQR outlier detection: Not enough valid prices (${pricesToAggregate.length} < 4).`);
    }

    // 3. Calculate Weighted Average
    let weightedSum = 0;
    let totalWeight = 0;
    const sourcesUsed = pricesToAggregate.map(p => p.source);
    for (const item of pricesToAggregate) {
      weightedSum += item.price * item.weight;
      totalWeight += item.weight;
    }

    if (totalWeight === 0 || pricesToAggregate.length === 0) {
      console.warn("Could not aggregate price: Zero total weight or no sources after filtering.");
      return null;
    }

    const aggregatedPrice = weightedSum / totalWeight;
    const aggregationTimestamp = Date.now(); // Timestamp of this calculation
    console.log(`Calculated aggregated price: ${aggregatedPrice} (Sources: ${pricesToAggregate.length})`);

    // 4. Fetch latest stored Volatility (assuming 30-day standard)
    // We rely on the scheduled job `calculateAndStoreAllVolatilities` to keep this fresh.
    const latestVolatility = await ctx.db.query("historicalVolatility")
        .withIndex("by_timeframe_and_timestamp", (q) => q.eq("timeframe", 30))
        .order("desc")
        .first();
        
    const volatilityToUse = latestVolatility?.volatility ?? 0; // Use 0 if none found
    if (!latestVolatility) {
      console.warn("No stored 30-day volatility found. Using 0.");
    }

    // 5. Fetch latest 24h Range
    const rangeData = await ctx.runQuery(api.services.oracle.priceService.calculate24hRange, {});
    const range24hToUse = rangeData?.range;
    if (!rangeData) {
      console.warn("Could not calculate 24h range.");
    }

    // 6. Return combined result
    return {
      price: aggregatedPrice,
      timestamp: aggregationTimestamp,
      volatility: volatilityToUse,
      sourceCount: pricesToAggregate.length,
      range24h: range24hToUse,
      // Optional debug info
      // weightedSum,
      // totalWeight,
      // sourcesUsed,
    };
  }
});

/**
 * Retrieves the latest aggregated price data.
 * Replaces the previous simpler implementation.
 * This is the primary query for fetching the current aggregated market price.
 */
export const getLatestPrice = query({
  handler: async (ctx): Promise<AggregatedPriceResult | null> => {
    // Calls the new aggregation logic
    return await ctx.runQuery(internal.services.oracle.priceService.aggregateCurrentPrices, {});
  }
});

/**
 * Retrieves the latest price data from various sources and calculates a weighted average.
 * 
 * @returns {Promise<{ price: number; timestamp: number; sources: string[]; sourceCount: number } | null>}
 */
// This version of getLatestPrice is simpler and might be deprecated or used for specific raw feed checks.
// For application use, prefer the getLatestPrice that calls aggregateCurrentPrices.
export const getRawLatestPricesFromFeed = internalQuery({
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
export const calculate24hRange = query({
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
    try {
      const priceData = await getFormattedOraclePrice();
      if (!priceData) {
        console.warn("getFormattedOraclePrice returned null or undefined.");
        return null;
      }
      return priceData;
    } catch (error: any) {
      console.error(`Error in getLatestOnChainPrice while calling getFormattedOraclePrice: ${error.message}`, error);
      return null;
    }
  }
});

/**
 * Checks if oracle price update criteria are met and submits if necessary.
 */
export const checkAndSubmitPrice = internalAction({
  handler: async (ctx) => {
    // Directly call aggregateCurrentPrices, as getLatestPrice is essentially a wrapper for it.
    // This avoids a layer of api.runQuery that might be causing TS inference issues.
    const latestPriceResult = await ctx.runQuery(internal.services.oracle.priceService.aggregateCurrentPrices, {});
    
    if (!latestPriceResult) {
      const reason = "No aggregated price data available from internal service";
      console.log(`Oracle price submission skipped: ${reason}`);
      return {
        updated: false,
        reason
      };
    }
    
    // Check if an update is needed and perform it
    // The checkAndSubmitOraclePrice function expects price in USD
    const result = await submitToBlockchain({
      currentPriceUSD: latestPriceResult.price, 
      currentTimestamp: latestPriceResult.timestamp,
      sourceCount: latestPriceResult.sourceCount
    });

    // Log the submission attempt
    console.log(`Oracle price submission attempt: ${result.updated ? 'Updated' : 'Skipped'}, Reason: ${result.reason}`);
    
    if (result.updated && result.txid) {
      // Record the submission in the database
      await ctx.runMutation(internal.oracleSubmissions.recordOracleSubmission, {
        txid: result.txid,
        submittedPriceSatoshis: Math.round(latestPriceResult.price * 100000000),
        reason: result.reason,
        sourceCount: latestPriceResult.sourceCount,
        status: "submitted",
        percentChange: result.percentChange || 0 // Use the percentChange from the check result
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
  // Correct table name to 'priceFeed'
  handler: async (ctx, { source, priceUSD }): Promise<Id<"priceFeed">> => {
    return await ctx.db.insert("priceFeed", {
      source,
      price: priceUSD, // Schema expects 'price'
      weight: 0, // Add a default weight or determine dynamically
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
    volatility: v.number(), // Add missing volatility field
    range24h: v.optional(v.number()), // Keep optional range
  },
  handler: async (ctx, { price, timestamp, sourceCount, volatility, range24h }): Promise<Id<"aggregatedPrices">> => {
    // Include volatility in the insert operation
    return await ctx.db.insert("aggregatedPrices", {
      price,
      timestamp,
      sourceCount,
      volatility,
      range24h,
    });
  },
});

/**
 * Get the most relevant volatility based on option duration
 * Finds the closest available pre-calculated timeframe volatility.
 */
export const getVolatilityForDuration = internalQuery({
  args: {
    durationSeconds: v.number(),
  },
  handler: async (ctx, args): Promise<number | null> => {
    const { durationSeconds } = args;
    const durationDays = Math.round(durationSeconds / (60 * 60 * 24));
    console.log(`getVolatilityForDuration called for duration: ${durationDays} days (${durationSeconds} seconds)`);

    const standardTimeframes = [30, 60, 90, 180, 360]; // Available calculated timeframes (in days)

    // Find the ideal timeframe (closest match)
    let idealTimeframe = standardTimeframes[0];
    let minDiff = Math.abs(durationDays - idealTimeframe);

    for (let i = 1; i < standardTimeframes.length; i++) {
      const diff = Math.abs(durationDays - standardTimeframes[i]);
      if (diff < minDiff) {
        minDiff = diff;
        idealTimeframe = standardTimeframes[i];
      }
    }
    console.log(`Ideal volatility timeframe determined: ${idealTimeframe} days`);

    // Attempt to fetch the latest volatility for the ideal timeframe
    // Assuming "standard" calculation method for now
    let latestVolatilityRecord = await ctx.db
      .query("historicalVolatility")
      .withIndex("by_timeframe_and_timestamp", (q) => q.eq("timeframe", idealTimeframe))
      .order("desc")
      .first();

    if (latestVolatilityRecord) {
      console.log(`Found volatility for ideal timeframe ${idealTimeframe}: ${latestVolatilityRecord.volatility}`);
      return latestVolatilityRecord.volatility;
    }

    // Fallback: If ideal timeframe data is missing, find the next closest available
    console.warn(`Volatility data not found for ideal timeframe ${idealTimeframe}. Searching for fallbacks...`);

    const fallbackTimeframes = standardTimeframes
      .filter(tf => tf !== idealTimeframe) // Exclude the ideal one
      .map(tf => ({ timeframe: tf, diff: Math.abs(durationDays - tf) }))
      .sort((a, b) => a.diff - b.diff); // Sort by closeness

    for (const fallback of fallbackTimeframes) {
      console.log(`Attempting fallback timeframe: ${fallback.timeframe} days (Difference: ${fallback.diff})`);
      latestVolatilityRecord = await ctx.db
        .query("historicalVolatility")
        .withIndex("by_timeframe_and_timestamp", (q) => q.eq("timeframe", fallback.timeframe))
        .order("desc")
        .first();

      if (latestVolatilityRecord) {
        console.warn(`Using fallback volatility from timeframe ${fallback.timeframe}: ${latestVolatilityRecord.volatility}`);
        return latestVolatilityRecord.volatility;
      }
    }

    // If no data found for any timeframe
    console.error(`CRITICAL: No historical volatility data found for any standard timeframe. Cannot determine volatility for duration ${durationDays} days.`);
    return null;
  }
});

// --- Cron Job Trigger Actions --- 

/**
 * Triggers the price data fetching and aggregation process.
 * This is typically called by a cron job.
 */
export const triggerPriceDataFetchingAndAggregation = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("Triggering price data fetching and aggregation...");
    await ctx.scheduler.runAfter(0, internal.dataIngestion.fetchAndAggregateCurrentPrices, {});
    console.log("Price data fetching and aggregation triggered.");
  },
});

/**
 * Triggers the fetching of historical price data.
 * This is typically called by a cron job.
 */
export const triggerHistoricalPriceFetching = internalAction({
  handler: async (ctx) => {
    console.log("Cron job: triggerHistoricalPriceFetching started.");
    await ctx.runAction(internal.services.oracle.historicalData.fetchHistoricalPrices, {});
    console.log("Cron job: triggerHistoricalPriceFetching finished.");
  }
});

/**
 * Internal action to be called by a cron job to trigger the fetching
 * of the latest daily price.
 */
export const triggerLatestDailyPriceFetching = internalAction({
  handler: async (ctx) => {
    console.log("Cron job: triggerLatestDailyPriceFetching started.");
    await ctx.runAction(internal.services.oracle.historicalData.fetchLatestDailyPrice, {});
    console.log("Cron job: triggerLatestDailyPriceFetching finished.");
  }
}); 