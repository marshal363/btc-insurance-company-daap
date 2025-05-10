import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Helper to insert a quote (can be called by other mutations if needed)
// For simplicity in this context, directly using db.insert in the main seedData.
// If reusability across different test setups is needed, this could be an internalMutation.

export const seedData = mutation({
  args: {
    initialMarketData: v.object({
      btcPrice: v.number(),
      volatility: v.number(),
      timestamp: v.string(),
    }),
    newMarketData: v.object({
      btcPrice: v.number(),
      volatility: v.number(),
    }),
    mockBuyerParams: v.object({
      protectedValuePercentage: v.number(),
      protectionAmount: v.number(),
      expirationDays: v.number(),
      policyType: v.string(),
    }),
    mockProviderParams: v.object({
      commitmentAmountUSD: v.number(),
      selectedTier: v.string(),
      selectedPeriod: v.number(),
      commitmentAmount: v.number(),
    }),
    initialRiskParamsBuyer: v.any(), // Assuming MockRiskParameters type structure
    initialRiskParamsProvider: v.any(), // Assuming MockRiskParameters type structure
  },
  handler: async (ctx, args) => {
    const {
      initialMarketData,
      newMarketData,
      mockBuyerParams,
      mockProviderParams,
      initialRiskParamsBuyer,
      initialRiskParamsProvider,
    } = args;

    // Seed initial market data
    await ctx.db.insert("aggregatedPrices", {
      price: initialMarketData.btcPrice,
      volatility: initialMarketData.volatility,
      timestamp: Date.parse(initialMarketData.timestamp),
      sourceCount: 1,
    });
    await ctx.db.insert("historicalVolatility", {
      period: 30, // Example period
      volatility: initialMarketData.volatility,
      timestamp: Date.parse(initialMarketData.timestamp),
    });

    // Seed initial quotes
    const buyerQuoteId = await ctx.db.insert("quotes", {
      userId: "testUser1",
      quoteType: "buyer",
      asset: "BTC",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: "active",
      buyerParamsSnapshot: mockBuyerParams,
      quoteResult: { premium: 500, breakEvenPrice: 49500, premiumPercentage: 1 },
      marketDataSnapshot: initialMarketData,
      riskParamsSnapshot: initialRiskParamsBuyer,
      isLocked: false,
    });

    const providerQuoteId = await ctx.db.insert("quotes", {
      userId: "testUser2",
      quoteType: "provider",
      asset: "BTC",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: "active",
      providerParamsSnapshot: mockProviderParams,
      quoteResult: { estimatedYield: 100, annualizedYieldPercentage: 5 }, // Placeholder
      marketDataSnapshot: initialMarketData,
      riskParamsSnapshot: initialRiskParamsProvider,
      isLocked: false,
    });

    // Seed "new" market data for finalization tests
    await ctx.db.insert("aggregatedPrices", {
      price: newMarketData.btcPrice,
      volatility: newMarketData.volatility,
      timestamp: Date.now(), // Freshest
      sourceCount: 1,
    });
    await ctx.db.insert("historicalVolatility", {
      period: 30,
      volatility: newMarketData.volatility,
      timestamp: Date.now(), // Freshest
    });

    return { initialBuyerQuoteId: buyerQuoteId, initialProviderQuoteId: providerQuoteId };
  },
});

export const createMinimalQuote = mutation({
  args: {
    minimalQuoteParams: v.object({
      userId: v.string(),
      quoteType: v.string(),
      asset: v.string(),
      createdAt: v.string(),
      expiresAt: v.string(),
      status: v.string(),
      isLocked: v.boolean(),
      buyerParamsSnapshot: v.any(),
      quoteResult: v.any(),
      marketDataSnapshot: v.any(),
      riskParamsSnapshot: v.any(),
    }),
  },
  handler: async (ctx, args) => {
    const quoteId = await ctx.db.insert("quotes", args.minimalQuoteParams as any); // Cast to any if schema is complex
    return { quoteId };
  },
}); 