import { query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { v } from "convex/values";

/**
 * Get the latest price from the oracle
 * @returns The most recent price data with high confidence
 */
export const getLatestPrice = query({
  args: {},
  handler: async (ctx) => {
    // Try to get the most recent high-confidence price (>= 0.7)
    const highConfidencePrice = await ctx.db
      .query("priceHistory")
      .filter((q) => q.gte(q.field("confidence"), 0.7))
      .order("desc")
      .first();

    if (highConfidencePrice) {
      return {
        price: highConfidencePrice.price,
        timestamp: highConfidencePrice.timestamp,
        confidence: highConfidencePrice.confidence,
        ageInSeconds: (Date.now() - highConfidencePrice.timestamp) / 1000,
        sources: highConfidencePrice.sources,
      };
    }

    // Fallback to most recent price regardless of confidence
    const latestPrice = await ctx.db.query("priceHistory").order("desc").first();

    if (latestPrice) {
      return {
        price: latestPrice.price,
        timestamp: latestPrice.timestamp,
        confidence: latestPrice.confidence,
        ageInSeconds: (Date.now() - latestPrice.timestamp) / 1000,
        sources: latestPrice.sources,
        warning: "Low confidence price data",
      };
    }

    // No price data available
    return {
      price: null,
      timestamp: null,
      confidence: 0,
      ageInSeconds: null,
      sources: [],
      error: "No price data available",
    };
  },
});

/**
 * Get historical price data for a specific time range
 */
export const getPriceHistory = query({
  args: {
    startTime: v.number(),
    endTime: v.number(),
    interval: v.optional(v.string()), // e.g. '1h', '1d', etc.
  },
  handler: async (ctx, args) => {
    // Default end time to now if not provided
    const endTime = args.endTime || Date.now();
    const startTime = args.startTime;

    // Validate time range
    if (startTime >= endTime) {
      throw new Error("startTime must be less than endTime");
    }

    // Query all prices within the time range
    const prices = await ctx.db
      .query("priceHistory")
      .filter((q) => q.gte(q.field("timestamp"), startTime))
      .filter((q) => q.lte(q.field("timestamp"), endTime))
      .order("asc")
      .collect();

    // If interval is specified, aggregate the data to that interval
    if (args.interval) {
      return aggregatePricesByInterval(prices, args.interval, startTime, endTime);
    }

    // Otherwise return raw data
    return prices.map(price => ({
      timestamp: price.timestamp,
      price: price.price,
      confidence: price.confidence,
    }));
  },
});

/**
 * Get price information from a specific exchange source
 */
export const getSourcePrice = query({
  args: {
    source: v.string(),
  },
  handler: async (ctx, args) => {
    // Get all price records
    const allPrices = await ctx.db
      .query("priceHistory")
      .order("desc")
      .collect();

    // Find the first one with our source (filter in-memory)
    const priceRecord = allPrices.find(price =>
      price.sources.includes(args.source)
    );

    if (!priceRecord) {
      return {
        source: args.source,
        available: false,
        error: "No data available for this source",
      };
    }

    // Get reliability information
    const reliabilityRecord = await ctx.db
      .query("sourceReliability")
      .withIndex("by_source", (q) => q.eq("source", args.source))
      .first();

    return {
      source: args.source,
      available: true,
      lastSeen: priceRecord.timestamp,
      ageInSeconds: (Date.now() - priceRecord.timestamp) / 1000,
      reliabilityScore: reliabilityRecord?.reliabilityScore || 0,
      successRate: reliabilityRecord?.successRate || 0,
    };
  },
});

/**
 * Get the current health status of the oracle system
 */
export const getOracleHealth = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const fiveMinutesAgo = now - 300000;

    // Check recent price data
    const recentPrices = await ctx.db
      .query("priceHistory")
      .filter((q) => q.gte(q.field("timestamp"), fiveMinutesAgo))
      .collect();

    // Check source reliability
    const sourceReliability = await ctx.db.query("sourceReliability").collect();

    // Calculate health metrics
    const health = {
      status: "healthy",
      lastUpdateTimestamp: recentPrices.length > 0
        ? Math.max(...recentPrices.map(p => p.timestamp))
        : null,
      priceUpdateFrequency: recentPrices.length,
      activeSources: sourceReliability
        .filter((s) => s.reliabilityScore > 0.5)
        .map((s) => s.source),
      warnings: [] as string[],
    };

    // Add warnings if needed
    if (recentPrices.length === 0) {
      health.status = "degraded";
      health.warnings.push("No recent price updates");
    }

    if (health.activeSources.length < 2) {
      health.status = "degraded";
      health.warnings.push("Insufficient active price sources");
    }

    if (health.lastUpdateTimestamp && (now - health.lastUpdateTimestamp) > 600000) {
      health.status = "critical";
      health.warnings.push("Price data is stale (>10 minutes old)");
    }

    return health;
  },
});

/**
 * Helper function to aggregate price data by a specified interval
 */
function aggregatePricesByInterval(
  prices: any[],
  interval: string,
  startTime: number,
  endTime: number
) {
  // Parse interval string (e.g., "1h", "15m", "1d")
  const intervalUnit = interval.slice(-1);
  const intervalValue = parseInt(interval.slice(0, -1));

  let intervalMs: number;

  // Convert interval to milliseconds
  switch (intervalUnit) {
    case 'm': // minutes
      intervalMs = intervalValue * 60 * 1000;
      break;
    case 'h': // hours
      intervalMs = intervalValue * 60 * 60 * 1000;
      break;
    case 'd': // days
      intervalMs = intervalValue * 24 * 60 * 60 * 1000;
      break;
    default:
      throw new Error(`Unsupported interval unit: ${intervalUnit}`);
  }

  // Create time buckets
  const buckets: Record<number, any[]> = {};

  // Initialize buckets
  for (let time = startTime; time < endTime; time += intervalMs) {
    buckets[time] = [];
  }

  // Assign prices to buckets
  for (const price of prices) {
    const bucketTime = Math.floor((price.timestamp - startTime) / intervalMs) * intervalMs + startTime;
    if (buckets[bucketTime]) {
      buckets[bucketTime].push(price);
    }
  }

  // Aggregate each bucket
  const result = [];

  for (const [timestamp, bucketPrices] of Object.entries(buckets)) {
    if (bucketPrices.length === 0) {
      // Skip empty buckets
      continue;
    }

    // Calculate aggregated values for this bucket
    const priceSum = bucketPrices.reduce((sum, p) => sum + p.price, 0);
    const avgPrice = priceSum / bucketPrices.length;

    // Calculate weighted confidence
    const weightedConfidence = bucketPrices.reduce(
      (sum, p) => sum + p.confidence,
      0
    ) / bucketPrices.length;

    result.push({
      timestamp: parseInt(timestamp),
      price: avgPrice,
      confidence: weightedConfidence,
      count: bucketPrices.length,
    });
  }

  return result;
} 