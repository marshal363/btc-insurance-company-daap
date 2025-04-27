import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
      throw new Error("No price data available");
    }

    // Calculate premium using Black-Scholes
    const premium = calculatePremium({
      currentPrice: latestPrice.price,
      strikePrice: args.strikePrice,
      volatility: latestPrice.volatility,
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
  const premium = currentPrice * volatility * Math.sqrt(daysToExpiry/365) * amount;
  return Math.round(premium * 100) / 100;
}
