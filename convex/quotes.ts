import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api"; // Added for risk params
import * as math from 'mathjs'; // For Black-Scholes and rounding

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

    // Check if the quote is locked
    const now = Date.now();
    if (quote.isLocked && quote.lockExpiresAt && quote.lockExpiresAt > now) {
      throw new Error(
        `Quote is locked and cannot be modified. Lock expires at ${new Date(
          quote.lockExpiresAt
        ).toISOString()}`
      );
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
    const currentTime = Date.now(); // For lock checking
    
    // Find active quotes that have expired and are not locked
    const expiredQuotes = await ctx.db
      .query("quotes")
      // TODO: This should iterate over all users or have a better indexing strategy for system-wide expiration
      .withIndex("by_userId_status", (q) => q.eq("userId", "system").eq("status", "active"))
      .filter((q) => 
        // Check for expiration
        q.lt(q.field("expiresAt"), now) &&
        // Check that the quote is not locked or the lock has expired
        q.or(
          q.eq(q.field("isLocked"), false),
          q.eq(q.field("isLocked"), undefined),
          q.lt(q.field("lockExpiresAt"), currentTime)
        )
      )
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

// --- Start: Copied from convex/services/oracle/premiumCalculation.ts (with adaptations) ---
// TODO: Centralize these calculation helpers or make them importable if they are pure.

// Standard normal cumulative distribution function
function normDist(x: number): number {
  return (1 + Number(math.erf(x / Number(math.sqrt(2))))) / 2;
}

interface PremiumComponents {
  premium: number;
  intrinsicValue: number;
  timeValue: number;
  volatilityImpact: number; // Or some other breakdown if BS model implies differently
}

// Adapted Black-Scholes calculation logic
// Based on convex/services/oracle/premiumCalculation.ts version
function calculateBlackScholesPremiumInternal({
  currentPrice,  // S
  strikePrice,   // K
  volatility,    // σ
  durationDays,  // T (in days)
  amount,        // Multiplier for final premium
  riskFreeRate = 0.02,  // r (annual)
  // riskParams might be used for adjustments if the model is extended
  // riskParams = null,
}: {
  currentPrice: number;
  strikePrice: number;
  volatility: number;
  durationDays: number;
  amount: number;
  riskFreeRate?: number;
  // riskParams?: any; // Define RiskParameters type if used here
}): PremiumComponents {
  if (durationDays <= 0) {
    // For expired options, premium is intrinsic value only
    const intrinsic = Math.max(0, strikePrice - currentPrice) * amount; // For a PUT
    return {
      premium: intrinsic,
      intrinsicValue: intrinsic,
      timeValue: 0,
      volatilityImpact: 0, // No volatility impact if no time value
    };
  }

  const T = durationDays / 365; // Time to maturity in years

  const d1 = (Number(math.log(currentPrice / strikePrice)) + (riskFreeRate + (volatility ** 2) / 2) * T) / (volatility * Number(math.sqrt(T)));
  const d2 = d1 - volatility * Number(math.sqrt(T));

  let premiumValue;
  // Assuming policyType is PUT as per typical buyer scenario
  // For CALL: currentPrice * normDist(d1) - strikePrice * math.exp(-riskFreeRate * T) * normDist(d2);
  // For PUT: strikePrice * math.exp(-riskFreeRate * T) * normDist(-d2) - currentPrice * normDist(-d1);
  premiumValue = strikePrice * math.exp(-riskFreeRate * T) * normDist(-d2) - currentPrice * normDist(-d1);
  premiumValue = premiumValue * amount; // Scale by amount

  // Ensure premium is not negative (can happen with deep OTM options and model nuances)
  premiumValue = Math.max(0, premiumValue);

  const intrinsicValue = Math.max(0, strikePrice - currentPrice) * amount; // For a PUT
  const timeValue = Math.max(0, premiumValue - intrinsicValue);

  // Note: Volatility impact isn't a direct output of BS, but often time value is highly correlated.
  // Here, assigning a part of time value or relating it to vega could be an approach if needed.
  // For simplicity, we can say timeValue itself represents this, or set volatilityImpact to a portion.
  return {
    premium: premiumValue,
    intrinsicValue: intrinsicValue,
    timeValue: timeValue,
    volatilityImpact: timeValue, // Simplified: time value is the primary impact from vol & time decay
  };
}

function calculateBreakEvenPriceInternal({
  strikePrice,
  premium,
  amount,
  // policyType = "PUT" // Add if call option break-even is different
}: {
  strikePrice: number;
  premium: number;
  amount: number;
  // policyType?: string;
}): number {
  if (amount === 0) return strikePrice; // Avoid division by zero
  // For a PUT option, breakeven is Strike - Premium per unit
  return strikePrice - (premium / amount);
}

// --- End: Copied helpers ---

// --- Start: Recalculation Helper for Buyer Quotes ---
async function _recalculateBuyerQuoteResult( 
  ctx: any, // Use proper Convex context type QueryCtx or MutationCtx
  buyerParamsSnapshot: any, // Define this type based on schema
  newMarketData: { btcPrice: number; volatility: number; timestamp: string },
  activeRiskParams: any // Define RiskParameters type from schema/types.ts
) {
  const { 
    protectedValuePercentage,
    protectionAmount,
    expirationDays,
    // policyType, // Assuming PUT for now based on BlackScholes adaptation
  } = buyerParamsSnapshot;

  const currentPrice = newMarketData.btcPrice;
  const volatility = newMarketData.volatility;

  const protectedValueUSD = (currentPrice * protectedValuePercentage) / 100;

  const premiumComponents = calculateBlackScholesPremiumInternal({
    currentPrice: currentPrice,
    strikePrice: protectedValueUSD,
    volatility: volatility,
    durationDays: expirationDays,
    amount: protectionAmount,
    // riskParams: activeRiskParams, // Pass if BS internal model uses it for adjustments
  });

  const breakEvenPrice = calculateBreakEvenPriceInternal({
    strikePrice: protectedValueUSD,
    premium: premiumComponents.premium,
    amount: protectionAmount,
  });

  const premium = premiumComponents.premium;
  let premiumPercentage = 0;
  if (protectedValueUSD > 0 && protectionAmount > 0) {
    premiumPercentage = (premium / (protectedValueUSD * protectionAmount)) * 100;
  }
  
  let annualizedPremium = 0;
  if (expirationDays > 0) {
    annualizedPremium = premiumPercentage * (365 / expirationDays);
  }

  return {
    premium: Number(math.round(premium, 2)), // Round to 2 decimal places
    premiumPercentage: Number(math.round(premiumPercentage, 2)),
    annualizedPremium: Number(math.round(annualizedPremium, 2)),
    breakEvenPrice: Number(math.round(breakEvenPrice, 2)),
    // Include factorsBreakdown similar to BuyerPremiumQuoteResult
    factorsBreakdown: {
        intrinsicValue: Number(math.round(premiumComponents.intrinsicValue, 2)),
        timeValue: Number(math.round(premiumComponents.timeValue, 2)),
        volatilityImpact: Number(math.round(premiumComponents.volatilityImpact, 2)), // Or however it's defined
    },
  };
}
// --- End: Recalculation Helper for Buyer Quotes ---

const QUOTE_LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Internal helper function to lock a quote
async function _lockQuoteInternal(ctx: any, quoteId: any, durationMs: number) {
  const now = Date.now();
  const quote = await ctx.db.get(quoteId);
  if (!quote) {
    // This should ideally not happen if called from finalizeQuote which already checks
    throw new Error("[Internal] Quote not found for locking.");
  }

  // Check if quote is already locked by an unexpired lock
  // finalizeQuote already does this, but good for helper to be robust or have clear preconditions
  if (quote.isLocked && quote.lockExpiresAt && quote.lockExpiresAt > now) {
    throw new Error(
      `[Internal] Quote is already locked. Lock expires at ${new Date(
        quote.lockExpiresAt
      ).toISOString()}`
    );
  }

  const lockPatchData = {
    isLocked: true,
    lockedAt: now,
    lockExpiresAt: now + durationMs,
  };

  await ctx.db.patch(quoteId, lockPatchData);
  const lockedQuote = await ctx.db.get(quoteId);
  if (!lockedQuote) {
    throw new Error("[Internal] Failed to retrieve quote after locking.");
  }
  return lockedQuote;
}

// --- Start: Copied Provider Calculation Helpers ---
// TODO: Centralize these calculation helpers or make them importable.
// Based on convex/services/oracle/premiumCalculation.ts

interface ProviderYieldComponents {
  estimatedYield: number;
  annualizedYieldPercentage: number;
  baseYield?: number; // Made optional to match what calculateProviderYield might return directly if simplified
  tierAdjustment?: number;
  durationAdjustment?: number;
  marketConditionAdjustment?: number;
  riskLevel?: number;
  estimatedBTCAcquisitionPrice?: number;
  capitalEfficiency?: number;
}

// Copied and adapted from convex/services/oracle/premiumCalculation.ts
function calculateProviderYieldInternal({
  commitmentAmountUSD,
  selectedTier,
  selectedPeriod, // in days
  volatility,
  riskParams,    // RiskParameters type
  marketConditions, // { btcPrice: number; volatility: number; liquidity: number; }
}: {
  commitmentAmountUSD: number;
  selectedTier: string;
  selectedPeriod: number;
  volatility: number;
  riskParams: any; // TODO: Replace with actual RiskParameters type
  marketConditions: { btcPrice: number; volatility: number; liquidity: number; };
}): ProviderYieldComponents {
  if (commitmentAmountUSD <= 0 || selectedPeriod <= 0 || volatility < 0) {
    console.warn(`Invalid input for Yield Calculation: Amount=${commitmentAmountUSD}, Period=${selectedPeriod}, σ=${volatility}. Returning 0 yield.`);
    return {
      estimatedYield: 0,
      annualizedYieldPercentage: 0,
      riskLevel: 0,
    };
  }

  const tierMultConserv: number = typeof riskParams?.tierMultipliers?.conservative === 'number' ? riskParams.tierMultipliers.conservative : 0.7;
  const tierMultBalanced: number = typeof riskParams?.tierMultipliers?.balanced === 'number' ? riskParams.tierMultipliers.balanced : 1.0;
  const tierMultAggressive: number = typeof riskParams?.tierMultipliers?.aggressive === 'number' ? riskParams.tierMultipliers.aggressive : 1.3;

  const tierMultiplier: number = selectedTier === "conservative" 
    ? tierMultConserv
    : selectedTier === "balanced" 
    ? tierMultBalanced
    : selectedTier === "aggressive" 
    ? tierMultAggressive
    : 1.0;

  const rpVolatilityMultiplier: number = typeof riskParams?.volatilityMultiplier === 'number' ? riskParams.volatilityMultiplier : 0.8;
  const rpDurationFactor: number = typeof riskParams?.durationFactor === 'number' ? riskParams.durationFactor : 90;
  const rpBaseRate: number = typeof riskParams?.baseRate === 'number' ? riskParams.baseRate : 0.2;
  const rpCoverageFactor: number = typeof riskParams?.coverageFactor === 'number' ? riskParams.coverageFactor : 0.5;
  const rpCustomProviderFactor: number = typeof riskParams?.customProviderFactor === 'number' ? riskParams.customProviderFactor : 0.5;

  const baseAnnualYieldRate: number = volatility * rpVolatilityMultiplier;
  const safeDurationFactor = rpDurationFactor === 0 ? 90 : rpDurationFactor; // Default to 90 if 0 to avoid division by zero or exp issues
  const durationFactor: number = 1 - math.exp(-selectedPeriod / safeDurationFactor); 
  const marketFactor: number = 1 + (marketConditions.volatility - rpBaseRate) * rpCoverageFactor;
  
  const annualizedYieldRate: number = baseAnnualYieldRate * tierMultiplier * durationFactor * marketFactor;
  const estimatedYield: number = annualizedYieldRate * (selectedPeriod / 365) * commitmentAmountUSD;
  
  const riskLevel: number = Math.min(10, Math.round(
    1 +
    (selectedTier === "conservative" ? 1 : selectedTier === "balanced" ? 3 : 5) +
    (Math.min(3, selectedPeriod / 120)) +
    (Math.min(2, volatility * 10))
  ));
  
  const estimatedBTCAcquisitionPrice: number = marketConditions.btcPrice * (1 - volatility * tierMultiplier * rpCustomProviderFactor);
  const capitalEfficiencyValue: number = tierMultiplier * rpVolatilityMultiplier;

  return {
    estimatedYield: Number(math.round(estimatedYield, 2)),
    annualizedYieldPercentage: Number(math.round(annualizedYieldRate * 100, 2)), 
    estimatedBTCAcquisitionPrice: Number(math.round(estimatedBTCAcquisitionPrice, 2)),
    riskLevel,
    baseYield: Number(math.round(baseAnnualYieldRate * (selectedPeriod / 365) * commitmentAmountUSD, 2)),
    tierAdjustment: Number(math.round(baseAnnualYieldRate * (selectedPeriod / 365) * commitmentAmountUSD * (tierMultiplier -1), 2)),
    capitalEfficiency: Number(math.round(capitalEfficiencyValue, 2)),
  };
}

// Copied and adapted from convex/services/oracle/premiumCalculation.ts
function calculateProviderBreakEvenPriceInternal({
  commitmentAmountUSD,
  estimatedYieldUSD,
  currentBtcPrice,
}: {
  commitmentAmountUSD: number;
  estimatedYieldUSD: number;
  currentBtcPrice: number;
}): number | undefined {
  if (currentBtcPrice <= 0 || commitmentAmountUSD <= 0) {
    return undefined;
  }
  const bufferPercentage = estimatedYieldUSD / commitmentAmountUSD;
  const breakEvenPrice = currentBtcPrice * (1 - bufferPercentage);
  return Math.max(0, Number(math.round(breakEvenPrice, 2)));
}
// --- End: Copied Provider Calculation Helpers ---

// --- Start: Recalculation Helper for Provider Quotes ---
async function _recalculateProviderQuoteResult(
  ctx: any, // QueryCtx or MutationCtx
  providerParamsSnapshot: any, // Define type
  newMarketData: { btcPrice: number; volatility: number; timestamp: string },
  activeRiskParams: any // Define RiskParameters type
) {
  const {
    commitmentAmountUSD,
    selectedTier,
    selectedPeriod, // This is selectedPeriod in providerParamsSnapshot in schema
  } = providerParamsSnapshot;

  // Construct marketConditions for calculateProviderYieldInternal
  const marketConditions = {
    btcPrice: newMarketData.btcPrice,
    volatility: newMarketData.volatility,
    // Liquidity might come from activeRiskParams or a global setting
    liquidity: activeRiskParams?.liquidityAdjustment ?? 0, 
  };

  const yieldComponents = calculateProviderYieldInternal({
    commitmentAmountUSD,
    selectedTier,
    selectedPeriod,
    volatility: newMarketData.volatility, // Pass overall market volatility
    riskParams: activeRiskParams,
    marketConditions,
  });

  const breakEvenPriceUSD = calculateProviderBreakEvenPriceInternal({
    commitmentAmountUSD,
    estimatedYieldUSD: yieldComponents.estimatedYield,
    currentBtcPrice: newMarketData.btcPrice,
  });

  return {
    estimatedYield: yieldComponents.estimatedYield, // This is for the specific period
    annualizedYieldPercentage: yieldComponents.annualizedYieldPercentage,
    // Re-map from yieldComponents to match schema's quoteResult structure for providers
    estimatedBTCAcquisitionPrice: yieldComponents.estimatedBTCAcquisitionPrice,
    capitalEfficiency: yieldComponents.capitalEfficiency,
    // Optional: if you want to store the full breakdown from yieldComponents
    // yieldComponentsBreakdown: yieldComponents, 
    // Optional: if breakEvenPriceUSD is part of quoteResult for provider
    // breakEvenPriceUSD: breakEvenPriceUSD,
  };
}
// --- End: Recalculation Helper for Provider Quotes ---

export const finalizeQuote = mutation({
  args: {
    quoteId: v.id("quotes"),
    lockForTransaction: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existingQuote = await ctx.db.get(args.quoteId);
    if (!existingQuote) {
      throw new Error("Quote not found.");
    }
    if (existingQuote.isLocked && existingQuote.lockExpiresAt && existingQuote.lockExpiresAt > now) {
      throw new Error(
        `Quote is already locked. Lock expires at ${new Date(
          existingQuote.lockExpiresAt
        ).toISOString()}`
      );
    }
    
    const latestPriceData = await ctx.db
      .query("aggregatedPrices")
      .order("desc")
      .first();
    const latestVolatilityData = await ctx.db
      .query("historicalVolatility")
      .order("desc")
      .first();

    if (!latestPriceData || !latestVolatilityData) {
      throw new Error("Could not fetch latest market data.");
    }

    const newMarketDataSnapshot = {
      btcPrice: latestPriceData.price,
      volatility: latestVolatilityData.volatility,
      timestamp: new Date(now).toISOString(),
    };

    let updatedQuoteResult = existingQuote.quoteResult; 
    let activeRiskParamsSnapshot = existingQuote.riskParamsSnapshot;

    if (existingQuote.quoteType === "buyer" && existingQuote.buyerParamsSnapshot) {
      const activeRiskParams = await ctx.runQuery(internal.premium.getActiveRiskParameters, { 
        assetType: existingQuote.asset,
        policyType: existingQuote.buyerParamsSnapshot.policyType,
      });
      if (!activeRiskParams) {
        throw new Error(`Active risk parameters not found for ${existingQuote.asset}/${existingQuote.buyerParamsSnapshot.policyType}`);
      }
      activeRiskParamsSnapshot = activeRiskParams;
      updatedQuoteResult = await _recalculateBuyerQuoteResult(
        ctx,
        existingQuote.buyerParamsSnapshot,
        newMarketDataSnapshot,
        activeRiskParams
      );
    } else if (existingQuote.quoteType === "provider" && existingQuote.providerParamsSnapshot) {
      const activeRiskParams = await ctx.runQuery(internal.premium.getActiveRiskParameters, { 
        assetType: existingQuote.asset,
        // Ensure this policyType matches how provider risk parameters are stored/keyed
        policyType: "ProviderYield", // Or derive from quote if stored, e.g. existingQuote.providerParamsSnapshot.policyType 
      });
      if (!activeRiskParams) {
        // It might be acceptable to proceed with default/fallback risk params for providers if none are explicitly configured.
        // Or throw an error if they are strictly required.
        // For now, let's log a warning and potentially use a default structure or parts of existing snapshot.
        console.warn(`Active risk parameters for ProviderYield not found for asset ${existingQuote.asset}. Using existing or defaults.`);
        // Fallback or use existing if appropriate, otherwise this could be an error condition.
        // activeRiskParamsSnapshot will retain existingQuote.riskParamsSnapshot in this case or could be a default structure.
        // If activeRiskParams are critical, throw new Error(...);
      }
      // Ensure activeRiskParams is not null if we proceed, even if it's a default set.
      // For recalculation, it's better to have *some* consistent risk param object.
      const riskParamsForCalc = activeRiskParams || existingQuote.riskParamsSnapshot || {}; // Basic fallback
      activeRiskParamsSnapshot = riskParamsForCalc; // Update to what was actually used.

      updatedQuoteResult = await _recalculateProviderQuoteResult(
        ctx,
        existingQuote.providerParamsSnapshot,
        newMarketDataSnapshot,
        riskParamsForCalc // Use the fetched or fallbacked risk params
      );
      console.log("Provider quote finalized (recalculation) was attempted.");
    }

    const patchData: any = {
      marketDataSnapshot: newMarketDataSnapshot,
      quoteResult: updatedQuoteResult,
      riskParamsSnapshot: activeRiskParamsSnapshot, 
      status: "active",
      expiresAt: new Date(now + (24 * 60 * 60 * 1000)).toISOString(),
      isLocked: false,
      lockedAt: undefined,
      lockExpiresAt: undefined,
    };

    await ctx.db.patch(args.quoteId, patchData);
    let finalizedQuote = await ctx.db.get(args.quoteId);
    if (!finalizedQuote) {
        throw new Error("Failed to retrieve quote after market data patch.");
    }

    if (args.lockForTransaction) {
      finalizedQuote = await _lockQuoteInternal(ctx, args.quoteId, QUOTE_LOCK_DURATION_MS);
    }

    return finalizedQuote;
  },
}); 