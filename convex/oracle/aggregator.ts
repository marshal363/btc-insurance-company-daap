import { mutation, action } from "../_generated/server";
import { PriceSource } from "./priceFeeds";
import { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { api } from "../_generated/api";

// Console logging for debugging
console.log("Convex version:", process.env.CONVEX_VERSION || "unknown");
console.log("Node version:", process.version);

// Type for the aggregated price result
export type AggregatedPrice = {
  timestamp: number;
  price: number;
  confidence: number;
  sourceCount: number;
  totalSources: number;
  deviation: number;
  sources: string[];
  _id?: Id<"priceHistory">;
};

// Type for the return value of collectLatestPrices
export type PriceCollectionResult = {
  success: boolean;
  price?: number;
  timestamp?: number;
  sources?: number;
  error?: string;
};

/**
 * Aggregates price data from multiple sources and stores the result
 */
export const aggregatePrices = mutation({
  args: {
    sources: v.array(
      v.object({
        source: v.string(),
        price: v.number(),
        timestamp: v.number(),
        lastUpdated: v.number(),
        reliabilityScore: v.number(),
        volume24h: v.optional(v.number())
      })
    )
  },
  handler: async (ctx, args) => {
    const sources = args.sources as PriceSource[];
    
    console.log("Starting price aggregation with sources:", sources.length);
    
    // Require minimum number of sources
    if (sources.length < 2) {
      throw new Error("Insufficient price sources for aggregation (minimum 2 required)");
    }

    const prices = sources.map((source) => source.price);

    // Basic statistical calculations
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];
    const sum = prices.reduce((acc, price) => acc + price, 0);
    const mean = sum / prices.length;

    // Calculate deviation from median
    const deviations = prices.map(
      (price) => Math.abs(price - medianPrice) / medianPrice
    );
    const avgDeviation =
      deviations.reduce((acc, dev) => acc + dev, 0) / deviations.length;

    // Filter out outliers (prices with deviation > 2x average)
    const filteredSources = sources.filter(
      (source, idx) => deviations[idx] <= avgDeviation * 2
    );

    // If filtering removed too many sources, fall back to using all sources
    const finalSources = filteredSources.length >= 2 ? filteredSources : sources;

    // Calculate weighted average based on source reliability
    const weightedSum = finalSources.reduce(
      (sum, source) => sum + source.price * source.reliabilityScore,
      0
    );
    const totalWeight = finalSources.reduce(
      (sum, source) => sum + source.reliabilityScore,
      0
    );
    const weightedPrice = weightedSum / totalWeight;

    // Calculate confidence score
    const confidence = Math.min(
      0.95, // Cap at 0.95 to never have 100% confidence
      (finalSources.length / sources.length) * (1 - avgDeviation * 5)
    );

    // Determine final price based on confidence
    const finalPrice = confidence > 0.7 ? weightedPrice : medianPrice;

    // Store result in database
    const aggregatedPrice: AggregatedPrice = {
      timestamp: Date.now(),
      price: finalPrice,
      confidence,
      sourceCount: finalSources.length,
      totalSources: sources.length,
      deviation: avgDeviation,
      sources: finalSources.map((s) => s.source),
    };

    // Debug query structure
    console.log("About to query sourceReliability");
    console.log("Available index methods:", Object.keys(ctx.db.query("sourceReliability").withIndex("by_source")));

    // Insert into database
    const priceId = await ctx.db.insert("priceHistory", aggregatedPrice);

    // Update source reliability scores based on deviation from final price
    for (const source of sources) {
      const deviation = Math.abs(source.price - finalPrice) / finalPrice;
      
      // Get current reliability record using proper query syntax
      console.log(`Looking up reliability for source: ${source.source}`);
      
      try {
        const reliabilityRecord = await ctx.db
          .query("sourceReliability")
          .withIndex("by_source", (q) => q.eq("source", source.source))
          .first();
        
        console.log("Reliability record found:", reliabilityRecord ? "yes" : "no");
        
        if (reliabilityRecord) {
          // Update existing record - slightly adjust reliability score based on accuracy
          const newScore = calculateNewReliabilityScore(
            reliabilityRecord.reliabilityScore, 
            deviation
          );
          
          await ctx.db.patch(reliabilityRecord._id, {
            reliabilityScore: newScore,
            lastUpdated: Date.now()
          });
        } else {
          // Create new reliability record
          await ctx.db.insert("sourceReliability", {
            source: source.source,
            reliabilityScore: 0.95, // Default initial score
            successRate: 1.0,
            avgLatency: 0,
            lastUpdated: Date.now()
          });
        }
      } catch (error) {
        console.error("Error updating reliability:", error);
      }
    }

    return {
      ...aggregatedPrice,
      _id: priceId
    };
  },
});

/**
 * Helper function to calculate new reliability score based on deviation
 */
function calculateNewReliabilityScore(currentScore: number, deviation: number): number {
  // If deviation is very small (< 0.1%), slightly increase reliability
  if (deviation < 0.001) {
    return Math.min(0.99, currentScore + 0.001);
  }
  
  // If deviation is moderate, slightly decrease reliability
  if (deviation > 0.01) {
    return Math.max(0.5, currentScore - 0.002);
  }
  
  // Otherwise keep the same
  return currentScore;
}

/**
 * Scheduled job to collect prices from all configured sources
 */
export const collectLatestPrices = action({
  args: {},
  handler: async (ctx): Promise<PriceCollectionResult> => {
    try {
      console.log("Starting price collection");
      
      // Import price feed functions
      const { binancePriceFeed, coinbasePriceFeed, krakenPriceFeed, mockPriceFeed } = await import("./priceFeeds");
      
      // Collect prices from all sources in parallel
      const sources: PriceSource[] = [];
      
      try {
        console.log("Fetching Binance price");
        const binancePrice = await ctx.runQuery(api.oracle.priceFeeds.binancePriceFeed);
        if (binancePrice) sources.push(binancePrice);
      } catch (error) {
        console.error("Failed to fetch Binance price:", error);
      }
      
      try {
        console.log("Fetching Coinbase price");
        const coinbasePrice = await ctx.runQuery(api.oracle.priceFeeds.coinbasePriceFeed);
        if (coinbasePrice) sources.push(coinbasePrice);
      } catch (error) {
        console.error("Failed to fetch Coinbase price:", error);
      }
      
      try {
        console.log("Fetching Kraken price");
        const krakenPrice = await ctx.runQuery(api.oracle.priceFeeds.krakenPriceFeed);
        if (krakenPrice) sources.push(krakenPrice);
      } catch (error) {
        console.error("Failed to fetch Kraken price:", error);
      }
      
      // If no real sources available, use mock as fallback
      if (sources.length < 2) {
        try {
          console.log("Insufficient real sources, fetching mock price");
          const mockPrice = await ctx.runQuery(api.oracle.priceFeeds.mockPriceFeed);
          if (mockPrice) sources.push(mockPrice);
        } catch (error) {
          console.error("Failed to fetch mock price:", error);
        }
      }
      
      // If we still don't have enough sources, throw error
      if (sources.length < 2) {
        throw new Error("Failed to collect enough price sources");
      }
      
      console.log(`Collected ${sources.length} price sources, aggregating...`);
      
      // Aggregate the collected prices - use any type to avoid circular reference
      const aggregated: any = await ctx.runMutation(api.oracle.aggregator.aggregatePrices, { sources });
      
      console.log("Price aggregation successful:", aggregated.price);
      
      // Schedule next run (5 minutes later)
      await ctx.scheduler.runAfter(5 * 60 * 1000, api.oracle.aggregator.collectLatestPrices, {});
      
      return { 
        success: true, 
        price: aggregated.price,
        timestamp: aggregated.timestamp,
        sources: aggregated.sources.length
      };
    } catch (error) {
      console.error("Price collection failed:", error);
      
      // Even on failure, schedule next run
      await ctx.scheduler.runAfter(60 * 1000, api.oracle.aggregator.collectLatestPrices, {});
      
      if (error instanceof Error) {
        return { 
          success: false, 
          error: error.message 
        };
      }
      return {
        success: false,
        error: "Unknown error"
      };
    }
  },
}); 