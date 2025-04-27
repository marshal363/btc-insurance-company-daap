import { action } from "../_generated/server";
import { collectLatestPrices } from "./aggregator";
import { v } from "convex/values";

/**
 * Initialize the Oracle system by setting up default source reliability records
 * and triggering the first price collection
 */
export const initializeOracle = action({
  args: {},
  handler: async (ctx) => {
    const result = {
      sourcesInitialized: 0,
      priceCollectionScheduled: false,
      errors: [] as string[],
    };

    try {
      // Initialize source reliability records for known exchanges
      // This helps avoid cold-start issues with new deployments
      const defaultSources = [
        { source: "binance", reliabilityScore: 0.95, successRate: 1.0 },
        { source: "coinbase", reliabilityScore: 0.92, successRate: 1.0 },
        { source: "kraken", reliabilityScore: 0.94, successRate: 1.0 },
        { source: "mock", reliabilityScore: 0.5, successRate: 1.0 },
      ];

      // Check for existing records first
      for (const source of defaultSources) {
        const existingRecord = await ctx.db
          .query("sourceReliability")
          .withIndex("by_source", (q) => q.eq("source", source.source))
          .first();

        if (!existingRecord) {
          // Create a new record
          await ctx.db.insert("sourceReliability", {
            source: source.source,
            reliabilityScore: source.reliabilityScore,
            successRate: source.successRate,
            avgLatency: 0,
            lastUpdated: Date.now(),
          });
          result.sourcesInitialized++;
        }
      }

      // Store default system parameters
      const defaultParameters = [
        {
          key: "priceUpdateInterval",
          value: 5 * 60 * 1000, // 5 minutes in milliseconds
          description: "Interval between price updates in milliseconds",
        },
        {
          key: "confidenceThreshold",
          value: 0.7,
          description: "Minimum confidence for a price to be considered reliable",
        },
        {
          key: "onchainUpdateThreshold",
          value: 0.8,
          description: "Minimum confidence for a price to be pushed on-chain",
        },
        {
          key: "priceDeviationThreshold",
          value: 0.01, // 1%
          description: "Minimum price deviation to trigger on-chain update",
        },
      ];

      // Add parameters if they don't exist
      for (const param of defaultParameters) {
        const existingParam = await ctx.db
          .query("parameters")
          .withIndex("by_key", (q) => q.eq("key", param.key))
          .first();

        if (!existingParam) {
          await ctx.db.insert("parameters", {
            ...param,
            lastUpdated: Date.now(),
          });
        }
      }

      // Schedule the first price collection to start the system
      // Subsequent runs will be scheduled by the collectLatestPrices action itself
      await ctx.scheduler.runAfter(5000, collectLatestPrices, {});
      result.priceCollectionScheduled = true;

      return {
        ...result,
        success: true,
        message: "Oracle system initialized successfully",
      };
    } catch (error: any) {
      console.error("Failed to initialize oracle:", error);
      result.errors.push(error.message || "Unknown error");
      return {
        ...result,
        success: false,
        message: "Oracle initialization failed",
        error: error.message,
      };
    }
  },
});

/**
 * Add a manual price entry (for testing or bootstrapping)
 */
export const addManualPrice = action({
  args: {
    price: v.number(),
    confidence: v.number(),
    sources: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      // Insert a manual price entry
      const priceId = await ctx.db.insert("priceHistory", {
        timestamp: Date.now(),
        price: args.price,
        confidence: args.confidence,
        sourceCount: args.sources.length,
        totalSources: args.sources.length,
        deviation: 0,
        sources: args.sources,
      });

      return {
        success: true,
        priceId,
        message: "Manual price added successfully",
      };
    } catch (error: any) {
      console.error("Failed to add manual price:", error);
      return {
        success: false,
        message: "Failed to add manual price",
        error: error.message,
      };
    }
  },
}); 