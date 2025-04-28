import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

export const createContract = mutation({
  args: {
    type: v.string(),
    strikePrice: v.number(),
    amount: v.number(),
    duration: v.number(), // in seconds
  },
  handler: async (ctx, args) => {
    // Using a dummy user ID since auth is removed
    const userId = "system";

    // Get current price for premium calculation
    const latestPrice = await ctx.db
      .query("aggregatedPrices")
      .order("desc")
      .first();
    
    if (!latestPrice) {
      throw new Error("No price data available to calculate premium");
    }

    // --- NEW: Get dynamic volatility based on duration ---
    const dynamicVolatility = await ctx.runQuery(internal.prices.getVolatilityForDuration, {
      durationSeconds: args.duration
    });

    if (dynamicVolatility === null) {
      // Log the critical error from the query function if needed, but throw here
      console.error(`Failed to retrieve volatility for duration ${args.duration} seconds. Cannot create contract.`);
      throw new Error("Volatility data unavailable for the specified duration. Cannot calculate premium.");
    }
    // --- END NEW ---

    // Calculate premium using Black-Scholes
    const premium = calculatePremium({
      currentPrice: latestPrice.price,
      strikePrice: args.strikePrice,
      volatility: dynamicVolatility,
      duration: args.duration,
      amount: args.amount,
    });

    // Create the contract
    return await ctx.db.insert("contracts", {
      ...args,
      premium,
      status: "open",
      createdBy: userId,
      expiresAt: Date.now() + args.duration * 1000,
    });
  },
});

export const listContracts = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Using a dummy user ID since auth is removed
    const userId = "system";

    const baseQuery = ctx.db.query("contracts");
    
    if (args.status !== undefined) {
      return await baseQuery
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    }

    return await baseQuery.collect();
  },
});

// Helper function to calculate premium
function calculatePremium({
  currentPrice,
  strikePrice,
  volatility,
  duration,
  amount
}: {
  currentPrice: number;
  strikePrice: number;
  volatility: number;
  duration: number;
  amount: number;
}) {
  // Simple premium calculation for now
  // TODO: Implement full Black-Scholes
  const daysToExpiry = duration / (24 * 60 * 60);
  // Ensure volatility is non-zero and days are positive before sqrt
  if (volatility <= 0 || daysToExpiry <= 0) {
      console.warn(`Invalid input for premium calculation: Volatility=${volatility}, Days=${daysToExpiry}. Returning 0 premium.`);
      return 0;
  }
  const premium = currentPrice * volatility * Math.sqrt(daysToExpiry/365) * amount;
  return Math.max(0, Math.round(premium * 100) / 100); // Ensure premium is not negative
}
