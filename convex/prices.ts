import { v } from "convex/values";
import { internalAction, internalMutation, query, action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import axios from "axios";
import { api } from "./_generated/api";

// MOVED to convex/systemSetup.ts as bootstrapOracleData
/*
export const initializePriceFeed = action({
  args: {},
  handler: async (ctx) => {
    console.log("Starting initializePriceFeed action...");
    
    // Fetch initial current prices
    await ctx.runAction(internal.dataIngestion.fetchAndAggregateCurrentPrices, {});
    
    // Check if historical data needs initial loading
    const historicalDataCheck = await ctx.runQuery(internal.prices.checkHistoricalDataExists, {});
    
    if (!historicalDataCheck.exists) {
      console.log(`No historical data found (exists: ${historicalDataCheck.exists}, count: ${historicalDataCheck.count}). Triggering initial 360-day bulk fetch...`);
      await ctx.runAction(internal.services.oracle.historicalData.fetchHistoricalPrices, {});
    } else {
      console.log(`Historical data already exists (exists: ${historicalDataCheck.exists}, count: ${historicalDataCheck.count}). Skipping initial bulk fetch.`);
    }
    
    console.log("initializePriceFeed action finished.");
  },
});
*/

// MOVED to convex/systemSetup.ts
/*
export const checkHistoricalDataExists = internalQuery({
  args: {},
  handler: async (ctx) => {
    const anyRecord = await ctx.db.query("historicalPrices").first();
    const allRecords = await ctx.db.query("historicalPrices").collect(); 
    const count = allRecords.length;
    const exists = anyRecord !== null;
    return { exists, count };
  },
});
*/

// REVIEW: getLatestPrice query removed as it's redundant with the one in priceService.ts
// Update getLatestPrice to handle no data case better
/*
export const getLatestPrice = query({
  args: {},
  handler: async (ctx) => {
    const latest = await ctx.db.query("aggregatedPrices").order("desc").first();
    if (!latest) {
      return null;
    }
    return latest;
  },
});
*/

// --- Functions kept for now (May need review/removal) ---

// NEW QUERY: Get the latest price reported by each individual source
// MOVED to dataIngestion.ts
/*
export const getLatestSourcePrices = query({
  args: {},
  handler: async (ctx) => {
    // ... implementation ...
  },
});
*/

// NEW QUERY: Get historical price closest to a target timestamp
// MOVED to historicalData.ts
/*
export const getHistoricalPrice = query({
  args: { targetTimestamp: v.number() },
  handler: async (ctx, args): Promise<{ price: number; timestamp: number } | null> => {
    // ... implementation ...
  },
});
*/
