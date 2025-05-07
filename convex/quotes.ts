import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Save a quote for either buyer or provider
 */
export const saveQuote = mutation({
  args: {
    quoteType: v.string(), // "buyer" or "provider"
    asset: v.string(),
    // Pass the *full* result object from the corresponding calculation query
    calculationResult: v.any(), // Use v.any() or a more specific validator
    // User-provided metadata
    metadata: v.optional(
      v.object({
        displayName: v.string(),
        notes: v.string(),
        tags: v.array(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Authentication would normally go here
    // For now, use a placeholder user ID
    const userId = "system";

    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h expiry

    // Extract parameters and results based on quoteType
    let buyerParamsSnapshot: any = undefined;
    let providerParamsSnapshot: any = undefined;
    let quoteResult = {};

    if (args.quoteType === "buyer" && args.calculationResult) {
      const result = args.calculationResult; // Cast to expected buyer result type
      buyerParamsSnapshot = {
        protectedValuePercentage: result.inputs.protectedValuePercentage,
        protectionAmount: result.inputs.protectionAmount,
        expirationDays: result.inputs.expirationDays,
        policyType: result.inputs.policyType,
      };
      quoteResult = {
        premium: result.premium,
        premiumPercentage: result.premiumPercentage,
        breakEvenPrice: result.breakEvenPrice,
      };
    } else if (args.quoteType === "provider" && args.calculationResult) {
      const result = args.calculationResult; // Cast to expected provider result type
      providerParamsSnapshot = {
        commitmentAmount: result.inputs.commitmentAmount,
        commitmentAmountUSD: result.inputs.commitmentAmountUSD,
        selectedTier: result.inputs.selectedTier,
        selectedPeriod: result.inputs.selectedPeriod,
      };
      quoteResult = {
        estimatedYield: result.estimatedYield,
        annualizedYieldPercentage: result.annualizedYieldPercentage,
        estimatedBTCAcquisitionPrice: result.estimatedBTCAcquisitionPrice,
        capitalEfficiency: result.capitalEfficiency,
      };
    } else {
      throw new Error("Invalid quote type or missing calculation result");
    }

    const id = await ctx.db.insert("quotes", {
      userId,
      quoteType: args.quoteType,
      asset: args.asset,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      status: "active",
      calculationId: args.calculationResult?._id, // Link if calculation was logged
      yieldCalculationId: args.calculationResult?._id, // Adjust based on logging
      buyerParamsSnapshot,
      providerParamsSnapshot,
      quoteResult,
      riskParamsSnapshot: args.calculationResult.riskParamsSnapshot,
      marketDataSnapshot: args.calculationResult.marketDataSnapshot,
      metadata: args.metadata,
    });

    return { id };
  },
});

/**
 * Get a quote by ID
 */
export const getQuoteById = query({
  args: { id: v.id("quotes") },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.id);
    if (!quote) {
      throw new Error("Quote not found");
    }

    // Check if quote has expired
    const now = new Date();
    const expiresAt = new Date(quote.expiresAt);

    if (now > expiresAt && quote.status === "active") {
      // Return with expired status, but don't update DB
      return { ...quote, status: "expired", _needsStatusUpdate: true };
    }

    return quote;
  },
});

/**
 * Get user quotes based on filters
 */
export const getUserQuotes = query({
  args: {
    quoteType: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Authentication would normally go here
    // For now, use a placeholder user ID
    const userId = "system";

    let dbQuery = ctx.db
      .query("quotes")
      .withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", args.status || "active"));

    if (args.quoteType) {
      dbQuery = dbQuery.filter((q) =>
        q.eq(q.field("quoteType"), args.quoteType)
      );
    }

    // No need to filter by status again since we're using the index

    const limit = args.limit || 10;
    const quotes = await dbQuery.order("desc").take(limit);

    // Update expiry status for display
    return quotes.map(quote => {
      if (quote.status === "active" && 
          new Date(quote.expiresAt) < new Date()) {
        return { ...quote, status: "expired", _needsStatusUpdate: true };
      }
      return quote;
    });
  },
});

/**
 * Update a quote's status
 */
export const updateQuoteStatus = mutation({
  args: {
    id: v.id("quotes"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.id);
    if (!quote) {
      throw new Error("Quote not found");
    }

    // Authentication check would normally go here
    
    // Only allow certain status transitions
    const validStatuses = ["active", "expired", "purchased", "committed", "declined"];
    if (!validStatuses.includes(args.status)) {
      throw new Error(`Invalid status: ${args.status}`);
    }

    // Update quote status
    await ctx.db.patch(args.id, { status: args.status });
    
    return { success: true };
  },
});

/**
 * Handle expiring quotes (could be called by a scheduled job)
 */
export const expireQuotes = mutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date().toISOString();
    
    // Find active quotes that have expired
    const expiredQuotes = await ctx.db
      .query("quotes")
      .withIndex("by_userId_status", (q) => q.eq("userId", "system").eq("status", "active"))
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();
    
    // Update all expired quotes
    let updated = 0;
    for (const quote of expiredQuotes) {
      await ctx.db.patch(quote._id, { status: "expired" });
      updated++;
    }
    
    return { updated };
  },
}); 