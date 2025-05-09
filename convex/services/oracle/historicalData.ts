import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, query } from "../../_generated/server";
import { internal } from "../../_generated/api"; // May not be needed if no other internal calls from this file
import axios from "axios";
import { Id } from "../../_generated/dataModel"; // Added Id for document IDs

// --- Helper Query & Mutation for Actions ---
export const getExistingHistoricalPrice = internalQuery({
  args: { timestamp: v.number(), isDaily: v.boolean() },
  handler: async (ctx, { timestamp, isDaily }) => {
    return await ctx.db.query("historicalPrices")
      .withIndex("by_timestamp")
      .filter(q => q.eq(q.field("timestamp"), timestamp))
      .filter(q => q.eq(q.field("isDaily"), isDaily))
      .first();
  }
});

export const replaceHistoricalPrice = internalMutation({
  args: { id: v.id("historicalPrices"), record: v.any() }, // Assuming record structure is validated elsewhere or use specific v.object
  handler: async (ctx, { id, record }) => {
    await ctx.db.replace(id, record);
  }
});

// --- Historical Price Fetching ---

const HISTORICAL_PRICE_SOURCES = {
  cryptocompare: {
    name: "CryptoCompare",
    // Fetches daily OHLCV data. 'limit' is number of days BEFORE 'toTs' (timestamp).
    // For 360 days up to yesterday, toTs = end of yesterday, limit = 359 (since toTs is one data point)
    // Or, if toTs is now, limit = 360 to get (now - 360 days) up to now.
    // For daily data, it's often cleaner to fetch up to the PREVIOUS full day.
    getUrl: (days = 360) => { // Default to fetching approx 1 year of daily data
      const toTs = Math.floor(Date.now() / 1000); // Current time in seconds
      // Limit: number of data points to return UP TO toTs. If toTs is today, limit=N gives N past days.
      return `https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&limit=${days -1}&toTs=${toTs}&api_key=${process.env.CRYPTOCOMPARE_API_KEY}`;
    },
    parse: (data: any) => {
      if (!data.Data || !data.Data.Data) {
        throw new Error("Invalid data structure from CryptoCompare");
      }
      return data.Data.Data.map((item: any) => ({
        timestamp: item.time * 1000, // Convert seconds to milliseconds
        open: item.open,
        high: item.high,
        low: item.low,
        price: item.close, // 'close' is the 'price' for the day
        volume: item.volumefrom, // alebo volumeto, závisí od meny
        isDaily: true,
      }));
    },
  },
  // Fallback - CoinGecko (simpler, just close price)
  coingecko_historical: {
    name: "CoinGeckoHistorical",
    // Fetches daily data for a range of dates.
    // Requires start and end dates. For 360 days, from = (today - 360), to = today
    // Max 90 days for free tier for date ranges.
    // Alternative: /market_chart?vs_currency=usd&days=360&interval=daily
    getUrl: (days = 90) => `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`,
    parse: (data: any) => {
      if (!data.prices) {
        throw new Error("Invalid data structure from CoinGecko historical");
      }
      return data.prices.map((item: any) => ({
        timestamp: item[0],
        price: item[1],
        isDaily: true,
      }));
    },
  }
};

export const fetchHistoricalPrices = internalAction({
  args: { daysToFetch: v.optional(v.number()) }, // Allow specifying days, default to ~1 year
  handler: async (ctx, { daysToFetch = 361 }) => { // Default to 361 to get 360 prior days + today if toTs is now
    console.log(`Starting fetchHistoricalPrices action for ${daysToFetch} days...`);

    if (!process.env.CRYPTOCOMPARE_API_KEY) {
      console.error("CRYPTOCOMPARE_API_KEY is not set. Skipping historical price fetch from CryptoCompare.");
      // Optionally, trigger fallback or simply return
      // For now, we'll try CoinGecko if CryptoCompare key is missing
    } else {
      const source = HISTORICAL_PRICE_SOURCES.cryptocompare;
      try {
        const url = source.getUrl(daysToFetch);
        console.log(`Fetching historical data from ${source.name}: ${url.substring(0, url.indexOf("api_key=")) + "api_key=REDACTED"}`);
        const response = await axios.get(url);
        const parsedData = source.parse(response.data);
        console.log(`Fetched and parsed ${parsedData.length} historical records from ${source.name}.`);

        let storedCount = 0;
        for (const record of parsedData) {
          const existing = await ctx.runQuery(internal.services.oracle.historicalData.getExistingHistoricalPrice, { 
            timestamp: record.timestamp, 
            isDaily: record.isDaily 
          });

          if (!existing) {
            await ctx.runMutation(internal.services.oracle.historicalData.storeHistoricalPrice, record);
            storedCount++;
          }
        }
        console.log(`Stored ${storedCount} new historical records from ${source.name}. Skipped ${parsedData.length - storedCount} duplicates.`);
        // If primary source succeeds, we might not need fallback unless specified
        if (storedCount > 0 || parsedData.length > 0) {
           console.log("fetchHistoricalPrices action finished successfully with CryptoCompare.");
           return { success: true, source: source.name, fetched: parsedData.length, stored: storedCount };
        }
      } catch (error: any) {
        console.error(`Failed to fetch or process historical data from ${source.name}: ${error.message}`);
        // Fall through to try CoinGecko if CryptoCompare failed and API key was present
        if (!process.env.CRYPTOCOMPARE_API_KEY) { // if API key was missing, we already logged and might skip fallback
             console.log("Skipping CoinGecko fallback as CryptoCompare API key was missing.");
             return { success: false, error: `CryptoCompare API key missing, and it failed: ${error.message}` };
        }
      }
    }

    // Fallback to CoinGecko if CryptoCompare failed or API key was missing and it implicitly failed
    console.log("Attempting fallback to CoinGecko for historical prices...");
    const fallbackSource = HISTORICAL_PRICE_SOURCES.coingecko_historical;
    try {
      // CoinGecko's free tier for market_chart might be limited in days (e.g., 90 or 365 max)
      // Adjust daysToFetch if necessary for CoinGecko's limits.
      const coingeckoDays = Math.min(daysToFetch, 365); // Cap at 365 for CoinGecko daily
      const url = fallbackSource.getUrl(coingeckoDays);
      console.log(`Fetching historical data from ${fallbackSource.name}: ${url}`);
      const response = await axios.get(url);
      const parsedData = fallbackSource.parse(response.data);
      console.log(`Fetched and parsed ${parsedData.length} historical records from ${fallbackSource.name}.`);
      
      let storedCount = 0;
      for (const record of parsedData) {
         const existing = await ctx.runQuery(internal.services.oracle.historicalData.getExistingHistoricalPrice, {
           timestamp: record.timestamp,
           isDaily: record.isDaily
         });
        if (!existing) {
            await ctx.runMutation(internal.services.oracle.historicalData.storeHistoricalPrice, record);
            storedCount++;
        }
      }
      console.log(`Stored ${storedCount} new historical records from ${fallbackSource.name}. Skipped ${parsedData.length - storedCount} duplicates.`);
      console.log("fetchHistoricalPrices action finished with CoinGecko fallback.");
      return { success: true, source: fallbackSource.name, fetched: parsedData.length, stored: storedCount };
    } catch (error: any) {
      console.error(`Failed to fetch or process historical data from ${fallbackSource.name} (fallback): ${error.message}`);
      console.log("fetchHistoricalPrices action finished with errors on all sources.");
      return { success: false, error: `All sources failed. Last error (CoinGecko): ${error.message}` };
    }
  },
});

// Internal mutation to store a single historical price record
export const storeHistoricalPrice = internalMutation({
  args: {
    timestamp: v.number(),
    price: v.number(),
    open: v.optional(v.number()),
    high: v.optional(v.number()),
    low: v.optional(v.number()),
    volume: v.optional(v.number()),
    source: v.optional(v.string()), // Optional: record which source this entry came from
    isDaily: v.optional(v.boolean()), // To distinguish daily OHLCV from more granular data
    dayIndex: v.optional(v.number()), // Optional: for an index like YYYYMMDD
  },
  handler: async (ctx, args) => {
    // console.log(`Storing historical price for timestamp: ${new Date(args.timestamp).toISOString()}`);
    // Ensure isDaily is explicitly set if not provided, default to true for this context
    const dataToStore = { ...args, isDaily: args.isDaily ?? true };
    await ctx.db.insert("historicalPrices", dataToStore);
  },
});

// --- Latest Daily Price Fetching ---

export const fetchLatestDailyPrice = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("Starting fetchLatestDailyPrice action...");
    // This typically fetches "yesterday's" complete daily data or the last few days
    // to ensure data integrity, as "today's" data might be incomplete.
    // For simplicity, let's fetch the last 2-3 days from CryptoCompare.
    // CryptoCompare's histoday with limit=1 and toTs=now gets data for "yesterday".
    // limit=2 gets "day before yesterday" and "yesterday".
    const daysToFetch = 3; // Fetch last 3 data points (e.g., T-2, T-1, T)
    
    if (!process.env.CRYPTOCOMPARE_API_KEY) {
      console.error("CRYPTOCOMPARE_API_KEY is not set. Skipping latest daily price fetch.");
      return { success: false, error: "CRYPTOCOMPARE_API_KEY missing" };
    }

    const source = HISTORICAL_PRICE_SOURCES.cryptocompare;
    try {
      const toTs = Math.floor(Date.now() / 1000); // End of today
      const url = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&limit=${daysToFetch -1}&toTs=${toTs}&api_key=${process.env.CRYPTOCOMPARE_API_KEY}`;
      console.log(`Fetching latest daily data from ${source.name}: ${url.substring(0, url.indexOf("api_key=")) + "api_key=REDACTED"}`);
      
      const response = await axios.get(url);
      const parsedData = source.parse(response.data); // Uses the same parser
      
      console.log(`Fetched and parsed ${parsedData.length} latest daily records from ${source.name}.`);

      let storedNewCount = 0;
      let updatedCount = 0;

      for (const record of parsedData) {
        const existing = await ctx.runQuery(internal.services.oracle.historicalData.getExistingHistoricalPrice, { 
          timestamp: record.timestamp, 
          isDaily: record.isDaily 
        });

        if (existing) {
          // Potentially update if data is different, e.g., volume or close price adjusted
          // For simplicity, we'll just overwrite if it exists for the latest daily check,
          // assuming newer data is more accurate.
          // More robust: check if existing.price !== record.price etc.
          await ctx.runMutation(internal.services.oracle.historicalData.replaceHistoricalPrice, {id: existing._id, record });
          updatedCount++;
        } else {
          await ctx.runMutation(internal.services.oracle.historicalData.storeHistoricalPrice, record);
          storedNewCount++;
        }
      }
      console.log(`Stored ${storedNewCount} new latest daily records, Updated ${updatedCount} existing records from ${source.name}.`);
      console.log("fetchLatestDailyPrice action finished successfully.");
      return { success: true, fetched: parsedData.length, new: storedNewCount, updated: updatedCount };

    } catch (error: any) {
      console.error(`Failed to fetch or process latest daily data from ${source.name}: ${error.message}`);
      // Add CoinGecko fallback for latest daily if needed, similar to fetchHistoricalPrices
      console.log("fetchLatestDailyPrice action finished with errors.");
      return { success: false, error: error.message };
    }
  },
});

// --- Utility Queries ---

// Get historical price closest to a target timestamp
export const getHistoricalPrice = query({
  args: { targetTimestamp: v.number() },
  handler: async (ctx, args): Promise<{ price: number; timestamp: number } | null> => {
    console.log(`getHistoricalPrice query running for target timestamp: ${new Date(args.targetTimestamp).toISOString()} (${args.targetTimestamp})`);
    
    const historicalRecord = await ctx.db
      .query("historicalPrices")
      .withIndex("by_timestamp") 
      .filter((q) => q.lte(q.field("timestamp"), args.targetTimestamp)) 
      .filter((q) => q.eq(q.field("isDaily"), true)) 
      .order("desc") 
      .first(); 
      
    if (historicalRecord) {
      return {
        price: historicalRecord.price,
        timestamp: historicalRecord.timestamp
      };
    } else {
      console.warn(`No historical daily price found at or before ${new Date(args.targetTimestamp).toISOString()}`);
      return null;
    }
  },
}); 