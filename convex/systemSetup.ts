import { v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Public action to bootstrap all necessary oracle data.
 * This includes fetching initial current prices and historical data.
 */
export const bootstrapOracleData = action({
  args: {},
  handler: async (ctx) => {
    console.log("Starting bootstrapOracleData action...");
    
    // Fetch initial current prices
    console.log("Triggering dataIngestion.fetchAndAggregateCurrentPrices...");
    await ctx.runAction(internal.dataIngestion.fetchAndAggregateCurrentPrices, {});
    console.log("fetchAndAggregateCurrentPrices completed.");
    
    // Check if historical data needs initial loading
    console.log("Checking for existing historical data via systemSetup.checkHistoricalDataExists...");
    const historicalDataCheck = await ctx.runQuery(internal.systemSetup.checkHistoricalDataExists, {});
    console.log(`Historical data check result: exists=${historicalDataCheck.exists}, count=${historicalDataCheck.count}`);
    
    if (!historicalDataCheck.exists) {
      console.log("No historical data found. Triggering historicalData.fetchHistoricalPrices for initial bulk fetch...");
      // Consider specifying days, e.g., { daysToFetch: 365 }
      await ctx.runAction(internal.services.oracle.historicalData.fetchHistoricalPrices, {}); 
      console.log("fetchHistoricalPrices completed.");
    } else {
      console.log("Historical data already exists. Skipping initial bulk fetch.");
    }
    
    console.log("bootstrapOracleData action finished.");
  },
});

/**
 * Internal helper query to check if historical price data exists in the database.
 */
export const checkHistoricalDataExists = internalQuery({
  args: {},
  handler: async (ctx) => {
    console.log("internal.systemSetup.checkHistoricalDataExists running...");
    const anyRecord = await ctx.db.query("historicalPrices").first();
    // const allRecords = await ctx.db.query("historicalPrices").collect(); // Getting full count can be slow if many records
    // const count = allRecords.length;
    // For just checking existence, .first() is enough. If count is truly needed elsewhere, reconsider.
    const exists = anyRecord !== null;
    
    // If you need a count without fetching all records (more efficient for large tables):
    // This requires an index, and Convex's count on queries might not be direct.
    // A workaround could be to maintain a counter document, or accept that .collect().length is the way for now.
    // For now, let's return a basic count if a record exists, or 0 if not,
    // understanding this count isn't from a direct DB count method.
    let count = 0;
    if (exists) {
        // This is NOT an efficient way to get a true count of a large table.
        // It's a placeholder if a rough idea of "some data exists" is needed.
        // For an accurate count, you'd typically .collect().length, which we avoid for performance here.
        // Let's assume for "exists" check, a count of 1 if data exists is fine, 0 otherwise.
        // If the full count from historicalDataCheck was critical, it needs a proper solution.
        const fewRecords = await ctx.db.query("historicalPrices").take(1); // Fetch 1 to confirm >0
        count = fewRecords.length > 0 ? (await ctx.db.query("historicalPrices").collect()).length : 0; // Get full count only if needed by caller
        console.log(`Historical data exists. Estimated count (can be slow for large tables if fetched fully): ${count}`);
    } else {
        console.log("No historical data found.");
    }
    
    return { exists, count }; // Caller should be aware of how count is derived.
  },
}); 