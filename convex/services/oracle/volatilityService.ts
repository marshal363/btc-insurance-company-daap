import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../../_generated/server";
import { internal, api } from "../../_generated/api"; // api might be needed if it calls public queries

// --- Volatility Data Storage ---
export const storeVolatility = internalMutation({
  args: {
    timestamp: v.number(),
    period: v.number(), // e.g., 30 for 30-day volatility
    volatility: v.number(),
    timeframe: v.optional(v.number()), // Redundant with period, but kept for original schema compatibility
    calculationMethod: v.optional(v.string()),
    dataPoints: v.optional(v.number()),
    startTimestamp: v.optional(v.number()),
    endTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // console.log(`Storing volatility for period ${args.period} day(s) at ${new Date(args.timestamp).toISOString()}: ${args.volatility}`);
    // Ensure timeframe is consistent with period if both are used
    const dataToStore = {
        ...args,
        timeframe: args.timeframe ?? args.period // Prioritize period, fallback to timeframe argument
    };
    await ctx.db.insert("historicalVolatility", dataToStore);
  },
});

// --- Volatility Calculation Helpers ---

// Helper to calculate standard deviation
function calculateStandardDeviation(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  return Math.sqrt(variance);
}

// Helper to calculate annualized volatility
function annualizedVolatility(dailyStdDev: number, daysInYear: number = 365): number {
  return dailyStdDev * Math.sqrt(daysInYear);
}

// --- Core Volatility Calculation Logic (from historical prices) ---

// This is the primary query for calculating volatility for a specific lookback period (timeframe).
// It's used by calculateAndStoreAllVolatilities and can be called directly.
export const calculateVolatilityForTimeframe = internalQuery({
  args: {
    timeframeDays: v.number(), // e.g., 30, 60, 90 days
    endDate: v.optional(v.number()), // Timestamp for the end of the period (defaults to now)
  },
  handler: async (ctx, { timeframeDays, endDate }) => {
    // console.log(`calculateVolatilityForTimeframe query: ${timeframeDays}-day volatility ending around ${endDate ? new Date(endDate).toISOString() : 'now'}`);
    const endTimestamp = endDate || Date.now();
    // Start timestamp is X days before the end timestamp
    const startTimestamp = endTimestamp - timeframeDays * 24 * 60 * 60 * 1000;

    const prices = await ctx.db
      .query("historicalPrices")
      .withIndex("by_timestamp") 
      .filter(q => 
        q.and(
          q.gte(q.field("timestamp"), startTimestamp),
          q.lte(q.field("timestamp"), endTimestamp),
          q.eq(q.field("isDaily"), true) // Filter for daily prices here
        )
      )
      .order("asc") 
      .collect();

    if (prices.length < timeframeDays * 0.8 && prices.length < 2) { // Need at least 2 points, ideally ~80% of timeframe
      console.warn(`Not enough historical data points (${prices.length}/${timeframeDays}) to calculate ${timeframeDays}-day volatility. Need at least 2 and preferably ~${Math.round(timeframeDays*0.8)}.`);
      return null;
    }

    // Calculate daily returns (log returns are often preferred for financial data)
    const logReturns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i-1].price > 0) { // Avoid division by zero or log of non-positive
        logReturns.push(Math.log(prices[i].price / prices[i-1].price));
      }
    }

    if (logReturns.length < 1) {
      console.warn("Not enough log returns to calculate volatility.");
      return null;
    }

    const dailyStdDev = calculateStandardDeviation(logReturns);
    const calculatedVolatility = annualizedVolatility(dailyStdDev);

    // console.log(`Calculated ${timeframeDays}-day annualized volatility: ${calculatedVolatility} (Daily StdDev: ${dailyStdDev}, Data points: ${prices.length}, LogReturns: ${logReturns.length})`);
    return {
      volatility: calculatedVolatility,
      dataPoints: prices.length,
      logReturnsCount: logReturns.length,
      dailyStdDev,
      timeframe: timeframeDays,
      startTimestamp: prices[0]?.timestamp, // Actual start of data used
      endTimestamp: prices[prices.length-1]?.timestamp, // Actual end of data used
    };
  },
});

// Action to calculate and store volatilities for standard timeframes
export const calculateAndStoreAllVolatilities = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("Starting calculateAndStoreAllVolatilities action...");
    const standardTimeframes = [30, 60, 90, 180, 360]; // Days
    let successfulCalculations = 0;
    const timestamp = Date.now();

    for (const timeframe of standardTimeframes) {
      try {
        const result = await ctx.runQuery(internal.services.oracle.volatilityService.calculateVolatilityForTimeframe, { 
            timeframeDays: timeframe 
        });

        if (result && typeof result.volatility === 'number') {
          await ctx.runMutation(internal.services.oracle.volatilityService.storeVolatility, {
            timestamp: timestamp, // Use consistent timestamp for this batch
            period: timeframe,
            volatility: result.volatility,
            timeframe: timeframe, // Store original timeframe for clarity
            calculationMethod: "log_returns_std_dev_annualized",
            dataPoints: result.dataPoints,
            startTimestamp: result.startTimestamp,
            endTimestamp: result.endTimestamp,
          });
          successfulCalculations++;
          console.log(`Successfully calculated and stored ${timeframe}-day volatility: ${result.volatility}`);
        } else {
          console.warn(`Failed to calculate ${timeframe}-day volatility or result was invalid. Result:`, result);
        }
      } catch (error: any) {
        console.error(`Error calculating or storing ${timeframe}-day volatility: ${error.message}`);
      }
    }
    console.log(`calculateAndStoreAllVolatilities action finished. Successful calculations: ${successfulCalculations}/${standardTimeframes.length}.`);
    return { successfulCalculations, totalTimeframes: standardTimeframes.length };
  },
});

// --- Public Query for Volatility ---

// This is the query that fetchAndAggregateCurrentPrices in dataIngestion.ts will call.
// It aims to get the most recent, relevant (e.g., 30-day) stored volatility.
export const getStandardVolatility = internalQuery({
    args: { periodDays: v.optional(v.number()) },
    handler: async (ctx, { periodDays = 30 }) => { // Default to 30-day volatility
        // console.log(`Querying for latest stored ${periodDays}-day volatility...`);
        const latestVolatilityRecord = await ctx.db
            .query("historicalVolatility")
            .withIndex("by_timeframe_and_timestamp", (q) => q.eq("timeframe", periodDays))
            .order("desc")
            .first();

        if (latestVolatilityRecord) {
            // console.log(`Found latest ${periodDays}-day volatility: ${latestVolatilityRecord.volatility} from ${new Date(latestVolatilityRecord.timestamp).toISOString()}`);
            return latestVolatilityRecord.volatility;
        }
        
        console.warn(`No stored ${periodDays}-day volatility found. Returning null.`);
        // Fallback: Trigger a calculation? Or handle upstream?
        // For now, just return null. The caller (dataIngestion) handles null by storing 0.
        return null;
    },
}); 