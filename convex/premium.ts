import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import * as math from 'mathjs'; // Import math.js
import { 
  MarketData, 
  RiskParameters, 
  PremiumComponents,
  PriceScenario,
  BuyerPremiumQuoteResult,
  ProviderYieldQuoteResult,
  ProviderYieldComponents
} from './types';

/**
 * PremiumCalculationService
 * 
 * A conceptual service class that encapsulates premium calculation logic.
 * This is implemented as a collection of individual functions that follow 
 * the service pattern in a functional programming style.
 */

// --- MARKET DATA HELPERS ---

/**
 * Gets current market data for premium calculations
 */
export const getCurrentMarketData = internalQuery({
  args: {
    asset: v.string(),
  },
  handler: async (ctx, args): Promise<MarketData> => {
    const latestPrice = await ctx.db
      .query("aggregatedPrices")
      .order("desc")
      .first();
    
    if (!latestPrice) {
      throw new Error("No price data available");
    }

    return {
      price: latestPrice.price,
      volatility: latestPrice.volatility,
      timestamp: latestPrice.timestamp,
    };
  },
});

// --- RISK PARAMETERS ---

/**
 * Gets the active risk parameters for a specific asset and policy type
 */
export const getActiveRiskParameters = internalQuery({
  args: {
    assetType: v.string(),
    policyType: v.string(),
  },
  handler: async (ctx, args): Promise<RiskParameters> => {
    const riskParams = await ctx.db
      .query("riskParameters")
      .withIndex("by_asset_policy_active", (q) => 
        q.eq("assetType", args.assetType)
         .eq("policyType", args.policyType)
         .eq("isActive", true)
      )
      .first();
    
    if (riskParams) {
      return riskParams as RiskParameters;
    }
    
    // If no risk parameters are found, return default values
    // This ensures the system can function even without proper setup
    console.warn(`No active risk parameters found for ${args.assetType}/${args.policyType}. Using defaults.`);
    return {
      assetType: args.assetType,
      policyType: args.policyType,
      baseRate: 0.01,
      volatilityMultiplier: 1.5,
      durationFactor: 0.5,
      coverageFactor: 1.0,
      tierMultipliers: {
        conservative: 0.7,
        balanced: 1.0,
        aggressive: 1.3,
      },
      liquidityAdjustment: 1.0,
      marketTrendAdjustment: 1.0,
      version: 0,
      lastUpdated: new Date().toISOString(),
      updatedBy: "system",
      isActive: true,
    };
  },
});

// --- PREMIUM CALCULATION CORE LOGIC ---

/**
 * Calculates premium using Black-Scholes for a PUT option
 * This is adapted from the existing model in options.ts
 */
function calculateBlackScholesPremium({
  currentPrice,  // S
  strikePrice,   // K
  volatility,    // σ
  duration,      // T (in days)
  amount,        // Multiplier for final premium
  riskFreeRate = 0.02,  // r
  riskParams = null,    // Risk parameters for adjustments
}: {
  currentPrice: number;
  strikePrice: number;
  volatility: number;
  duration: number;
  amount: number;
  riskFreeRate?: number;
  riskParams?: RiskParameters | null;
}): PremiumComponents {
  // Validate inputs
  if (currentPrice <= 0 || strikePrice <= 0 || volatility <= 0 || duration <= 0 || amount <= 0) {
    console.warn(`Invalid input for Black-Scholes: S=${currentPrice}, K=${strikePrice}, σ=${volatility}, T(days)=${duration}, Amount=${amount}, r=${riskFreeRate}. Returning 0 premium.`);
    return {
      premium: 0,
      intrinsicValue: 0,
      timeValue: 0,
      volatilityImpact: 0,
    };
  }

  // --- Black-Scholes Implementation --- 
  const S = currentPrice;
  const K = strikePrice;
  const sigma = volatility;
  const T = duration / 365; // Time to expiration in years
  const r = riskFreeRate;

  const sqrtT = Number(math.sqrt(T)); // Cast result to number

  // Check for zero volatility or time - edge case leading to division by zero
  if (sigma * sqrtT === 0) {
    // If vol or time is zero, the PUT premium is the intrinsic value discounted
    const intrinsicValue = Number(math.max(0, K - S)); // Cast result to number
    const discountedExp = Number(math.exp(-r * T)); // Cast result to number
    const discountedValue = intrinsicValue * discountedExp; 
    console.warn(`Edge case: sigma*sqrt(T) is zero. Returning discounted intrinsic value: ${discountedValue}`);
    const finalPremium = discountedValue * amount;
    
    return {
      premium: Number(math.max(0, Number(math.round(finalPremium * 100)) / 100)),
      intrinsicValue: intrinsicValue,
      timeValue: 0,
      volatilityImpact: 0,
    };
  }
  
  // Calculate d1 and d2
  // Explicitly cast intermediate math.js results
  const logSK = Number(math.log(S / K));
  const powSigma = Number(math.pow(sigma, 2));
  const d1_numerator = logSK + (r + 0.5 * powSigma) * T;
  const d1_denominator = sigma * sqrtT;
  const d1 = d1_numerator / d1_denominator;

  const d2 = d1 - sigma * sqrtT;

  // Calculate PUT premium using N(-d2) and N(-d1)
  // N(x) is the cumulative distribution function (CDF) for a standard normal distribution
  const erf_neg_d1 = Number(math.erf((-d1) / Number(math.sqrt(2)))); // Cast erf & inner sqrt result
  const erf_neg_d2 = Number(math.erf((-d2) / Number(math.sqrt(2)))); // Cast erf & inner sqrt result
  const N_neg_d1: number = erf_neg_d1 / 2 + 0.5; // Explicitly type N_neg_d1
  const N_neg_d2: number = erf_neg_d2 / 2 + 0.5; // Explicitly type N_neg_d2

  const expRT = Number(math.exp(-r * T)); // Cast exp result
  // Ensure all components are explicitly numbers before arithmetic
  const term1: number = K * expRT * N_neg_d2;
  const term2: number = S * N_neg_d1;
  const putPremiumPerUnit: number = term1 - term2; 
  
  // Calculate intrinsic and time value components
  const intrinsicValue = Number(math.max(0, K - S));
  const timeValueWithVol = putPremiumPerUnit - intrinsicValue;
  
  // Estimate the time value vs volatility impact (simplified)
  const timeValue = timeValueWithVol * 0.3; // Arbitrary split, can be refined
  const volatilityImpact = timeValueWithVol * 0.7;
  
  // Apply risk parameter adjustments if provided
  let adjustedPremium = putPremiumPerUnit;
  if (riskParams) {
    // Apply some basic adjustment using risk parameters
    adjustedPremium = putPremiumPerUnit * 
      (1 + riskParams.baseRate) * 
      riskParams.volatilityMultiplier * 
      (1 + (duration / 365) * riskParams.durationFactor);
  }
  
  // Scale premium by the amount (e.g., number of BTC)
  const totalPremium: number = adjustedPremium * amount;

  // Final checks and rounding
  if (isNaN(totalPremium) || !isFinite(totalPremium)) {
    console.error(`Black-Scholes calculation resulted in NaN or Infinity. Inputs: S=${S}, K=${K}, sigma=${sigma}, T=${T}, r=${r}. Returning 0.`);
    return {
      premium: 0,
      intrinsicValue: 0,
      timeValue: 0,
      volatilityImpact: 0,
    };
  }

  // Return rounded, non-negative premium with component breakdown
  const roundedPremium = Number(math.round(totalPremium * 100)) / 100;
  return {
    premium: Number(math.max(0, roundedPremium)),
    intrinsicValue: Number(math.round(intrinsicValue * amount * 100)) / 100,
    timeValue: Number(math.round(timeValue * amount * 100)) / 100,
    volatilityImpact: Number(math.round(volatilityImpact * amount * 100)) / 100,
  };
}

/**
 * Calculate provider yield based on tier, period, and volatility
 */
function calculateProviderYield({
  commitmentAmountUSD,
  selectedTier,
  selectedPeriod,
  volatility,
  riskParams,
  marketConditions,
}: {
  commitmentAmountUSD: number;
  selectedTier: string;
  selectedPeriod: number; // in days
  volatility: number;
  riskParams: RiskParameters;
  marketConditions: {
    btcPrice: number;
    volatility: number;
    liquidity: number;
  };
}): ProviderYieldComponents {
  // Validate inputs
  if (commitmentAmountUSD <= 0 || selectedPeriod <= 0 || volatility <= 0) {
    console.warn(`Invalid input for Yield Calculation: Amount=${commitmentAmountUSD}, Period=${selectedPeriod}, σ=${volatility}. Returning 0 yield.`);
    return {
      estimatedYield: 0,
      annualizedYieldPercentage: 0,
      baseYield: 0,
      tierAdjustment: 0,
      durationAdjustment: 0,
      marketConditionAdjustment: 0,
      riskLevel: 0,
    };
  }

  // Get tier multiplier from risk params or use defaults
  const tierMultiplier = selectedTier === "conservative" 
    ? riskParams?.tierMultipliers?.conservative 
    : selectedTier === "balanced" 
    ? riskParams?.tierMultipliers?.balanced
    : selectedTier === "aggressive" 
    ? riskParams?.tierMultipliers?.aggressive
    : 1.0;

  // Base yield calculation depends on volatility
  const baseAnnualYieldRate = volatility * 0.8; // 80% of volatility as base yield
  
  // Adjust for duration - shorter periods have relatively lower annualized yields
  const durationFactor = 1 - Math.exp(-selectedPeriod / 90); // Exponential curve that approaches 1
  
  // Market condition adjustment - use market data for a multiplier
  const marketFactor = 1 + (marketConditions.volatility - 0.2) * 0.5; // Adjust based on how far volatility is from 20%
  
  // Calculate components
  const baseYield = baseAnnualYieldRate * (selectedPeriod / 365) * commitmentAmountUSD;
  const tierAdjustment = baseYield * (tierMultiplier - 1); // How much the tier impacts the base
  const durationAdjustment = baseYield * (durationFactor - 0.8); // Adjust if duration factor is not medium-term
  const marketConditionAdjustment = baseYield * (marketFactor - 1); // How much market conditions affect yield
  
  // Total annualized yield rate
  const annualizedYieldRate = baseAnnualYieldRate * tierMultiplier * durationFactor * marketFactor;
  
  // Estimated actual yield for the period
  const estimatedYield = annualizedYieldRate * (selectedPeriod / 365) * commitmentAmountUSD;
  
  // Risk level assessment (1-10 scale)
  const riskLevel = Math.min(10, Math.round(
    1 + // Base risk
    (selectedTier === "conservative" ? 1 : selectedTier === "balanced" ? 3 : 5) + // Tier risk
    (Math.min(3, selectedPeriod / 120)) + // Duration risk
    (Math.min(2, volatility * 10)) // Volatility risk
  ));
  
  // Estimated BTC acquisition price (for liquidity providers)
  // This is a simplified model - assumes acquisition at worse than current price
  const estimatedBTCAcquisitionPrice = marketConditions.btcPrice * (1 - volatility * tierMultiplier * 0.5);
  
  // Return the calculation results
  return {
    estimatedYield: Number(math.round(estimatedYield * 100)) / 100,
    annualizedYieldPercentage: Number(math.round(annualizedYieldRate * 10000)) / 100, // Convert to percentage with 2 decimals
    estimatedBTCAcquisitionPrice: Number(math.round(estimatedBTCAcquisitionPrice * 100)) / 100,
    riskLevel,
    baseYield: Number(math.round(baseYield * 100)) / 100,
    tierAdjustment: Number(math.round(tierAdjustment * 100)) / 100,
    durationAdjustment: Number(math.round(durationAdjustment * 100)) / 100,
    marketConditionAdjustment: Number(math.round(marketConditionAdjustment * 100)) / 100,
    capitalEfficiency: tierMultiplier * 0.8, // Simple efficiency model
  };
}

/**
 * Generate price scenarios for visualization
 */
function generatePriceScenarios({
  currentPrice,
  strikePrice,
  premium,
  amount,
}: {
  currentPrice: number;
  strikePrice: number;
  premium: number;
  amount: number;
}): PriceScenario[] {
  const scenarios: PriceScenario[] = [];
  const priceRange = 0.5; // Show prices from -50% to +50% of current
  
  for (let i = -10; i <= 10; i++) {
    const priceChange = i * (priceRange / 10);
    const scenarioPrice = currentPrice * (1 + priceChange);
    
    // Protection value (intrinsic value of the option)
    const protectionValue = Math.max(0, (strikePrice - scenarioPrice) * amount);
    
    // Net value (protection minus premium)
    const netValue = protectionValue - premium;
    
    scenarios.push({
      price: Number(math.round(scenarioPrice * 100)) / 100,
      protectionValue: Number(math.round(protectionValue * 100)) / 100,
      netValue: Number(math.round(netValue * 100)) / 100,
    });
  }
  
  return scenarios;
}

/**
 * Calculate break-even price for a PUT option (where protection value equals premium)
 */
function calculateBreakEvenPrice({
  strikePrice,
  premium,
  amount,
}: {
  strikePrice: number;
  premium: number;
  amount: number;
}): number {
  // Break-even for PUT: Strike Price - Premium/Amount
  return Number(math.round((strikePrice - (premium / amount)) * 100)) / 100;
}

// --- PUBLIC FACING QUERIES ---

/**
 * Get buyer premium quote with all details
 */
export const getBuyerPremiumQuote = query({
  args: {
    protectedValuePercentage: v.number(),
    protectionAmount: v.number(),
    expirationDays: v.number(),
    policyType: v.string(), // Typically "PUT"
    currentPriceOverride: v.optional(v.number()),
    includeScenarios: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<BuyerPremiumQuoteResult> => {
    // 1. Get current market data (price, volatility)
    const marketData: MarketData = await ctx.runQuery(
      internal.premium.getCurrentMarketData,
      { asset: "BTC" }
    );
    const currentPrice: number = args.currentPriceOverride ?? marketData.price;
    const volatility: number = marketData.volatility; // Or fetch specific duration volatility

    // 2. Calculate protected value in USD
    const protectedValueUSD: number =
      (currentPrice * args.protectedValuePercentage) / 100;

    // 3. Get active risk parameters
    const riskParams: RiskParameters = await ctx.runQuery(
      internal.premium.getActiveRiskParameters,
      {
        assetType: "BTC",
        policyType: args.policyType,
      }
    );

    // 4. Calculate premium using Black-Scholes
    const premiumResult = calculateBlackScholesPremium({
      currentPrice: currentPrice,
      strikePrice: protectedValueUSD,
      volatility: volatility,
      duration: args.expirationDays,
      amount: args.protectionAmount,
      riskParams: riskParams,
    });

    // 5. Calculate break-even price
    const breakEvenPrice = calculateBreakEvenPrice({
      strikePrice: protectedValueUSD,
      premium: premiumResult.premium,
      amount: args.protectionAmount,
    });

    // 6. Calculate premium percentage of protected value and annualized
    const premiumPercentage = (premiumResult.premium / (protectedValueUSD * args.protectionAmount)) * 100;
    const annualizedPremium = premiumPercentage * (365 / args.expirationDays);

    // 7. Generate price scenarios if requested
    let scenarios: PriceScenario[] = [];
    if (args.includeScenarios) {
      scenarios = generatePriceScenarios({
        currentPrice: currentPrice,
        strikePrice: protectedValueUSD,
        premium: premiumResult.premium,
        amount: args.protectionAmount,
      });
    }

    // 8. Return the comprehensive quote result
    return {
      inputs: {
        protectedValuePercentage: args.protectedValuePercentage,
        protectionAmount: args.protectionAmount,
        expirationDays: args.expirationDays,
        policyType: args.policyType,
        protectedValueUSD: protectedValueUSD,
      },
      premium: premiumResult.premium,
      premiumPercentage: Number(math.round(premiumPercentage * 100)) / 100,
      annualizedPremium: Number(math.round(annualizedPremium * 100)) / 100,
      breakEvenPrice,
      factorsBreakdown: {
        intrinsicValue: premiumResult.intrinsicValue,
        timeValue: premiumResult.timeValue,
        volatilityImpact: premiumResult.volatilityImpact,
      },
      scenarios,
      marketDataSnapshot: {
        btcPrice: currentPrice,
        volatility: volatility,
        timestamp: new Date().toISOString(),
      },
      riskParamsSnapshot: riskParams,
    };
  },
});

/**
 * Get provider yield quote with all details
 */
export const getProviderYieldQuote = query({
  args: {
    commitmentAmount: v.number(), // In STX or USD based on UI convention
    commitmentAmountUSD: v.number(), // Ensure USD value is passed
    selectedTier: v.string(),
    selectedPeriod: v.number(),
  },
  handler: async (ctx, args): Promise<ProviderYieldQuoteResult> => {
    // 1. Get current market data
    const marketData: MarketData = await ctx.runQuery(
      internal.premium.getCurrentMarketData,
      { asset: "BTC" }
    );

    // 2. Get active risk parameters (assuming providers primarily underwrite PUTs)
    const riskParams: RiskParameters = await ctx.runQuery(
      internal.premium.getActiveRiskParameters,
      {
        assetType: "BTC",
        policyType: "PUT",
      }
    );

    // 3. Calculate estimated yield using the provider model
    const result = calculateProviderYield({
      commitmentAmountUSD: args.commitmentAmountUSD,
      selectedTier: args.selectedTier,
      selectedPeriod: args.selectedPeriod,
      volatility: marketData.volatility,
      riskParams: riskParams,
      marketConditions: {
        btcPrice: marketData.price,
        volatility: marketData.volatility,
        liquidity: 1.0, // Default value, could be derived from market data
      },
    });

    // 4. Return the comprehensive quote result
    return {
      inputs: {
        commitmentAmount: args.commitmentAmount,
        commitmentAmountUSD: args.commitmentAmountUSD,
        selectedTier: args.selectedTier,
        selectedPeriod: args.selectedPeriod,
      },
      ...result,
      marketDataSnapshot: {
        btcPrice: marketData.price,
        volatility: marketData.volatility,
        timestamp: new Date().toISOString(),
      },
      riskParamsSnapshot: riskParams,
    };
  },
});

// --- LOGGING MUTATIONS ---

/**
 * Log premium calculation to the database
 */
export const logPremiumCalculation = internalMutation({
  args: {
    userId: v.string(),
    asset: v.string(),
    currentPrice: v.number(),
    protectedValue: v.number(),
    protectedAmount: v.number(),
    expirationDays: v.number(),
    policyType: v.string(),
    volatilityUsed: v.number(),
    premium: v.number(),
    premiumPercentage: v.number(),
    annualizedPremium: v.number(),
    breakEvenPrice: v.number(),
    intrinsicValue: v.number(),
    timeValue: v.number(),
    volatilityImpact: v.number(),
    calculationModel: v.string(),
    scenarios: v.array(
      v.object({
        price: v.number(),
        protectionValue: v.number(),
        netValue: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("premiumCalculations", {
      ...args,
      timestamp: new Date().toISOString(),
    });
  },
});

/**
 * Log yield calculation to the database
 */
export const logYieldCalculation = internalMutation({
  args: {
    userId: v.string(),
    asset: v.string(),
    commitmentAmount: v.number(),
    commitmentAmountUSD: v.number(),
    selectedTier: v.string(),
    selectedPeriod: v.number(),
    estimatedYield: v.number(),
    annualizedYieldPercentage: v.number(),
    estimatedBTCAcquisitionPrice: v.optional(v.number()),
    riskLevel: v.number(),
    capitalEfficiency: v.optional(v.number()),
    baseYield: v.number(),
    tierAdjustment: v.number(),
    durationAdjustment: v.number(),
    marketConditionAdjustment: v.number(),
    calculationModel: v.string(),
    marketConditions: v.object({
      btcPrice: v.number(),
      volatility: v.number(),
      liquidity: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("yieldCalculations", {
      ...args,
      timestamp: new Date().toISOString(),
    });
  },
});

// --- DEFAULT RISK PARAMETERS SETUP ---

/**
 * Initialize default risk parameters if none exist
 */
export const initializeDefaultRiskParameters = mutation({
  args: {},
  handler: async (ctx) => {
    const existingParams = await ctx.db
      .query("riskParameters")
      .filter((q) => q.eq(q.field("assetType"), "BTC"))
      .first();
    
    if (existingParams) {
      return { status: "Already initialized", id: existingParams._id };
    }
    
    // Create default parameters for BTC PUT options
    const putParamsId = await ctx.db.insert("riskParameters", {
      assetType: "BTC",
      policyType: "PUT",
      baseRate: 0.01, // 1% base rate
      volatilityMultiplier: 1.5, // Volatility impact multiplier
      durationFactor: 0.5, // Duration impact
      coverageFactor: 1.0, // Coverage amount impact
      tierMultipliers: {
        conservative: 0.7,
        balanced: 1.0,
        aggressive: 1.3,
      },
      liquidityAdjustment: 1.0,
      marketTrendAdjustment: 1.0,
      version: 1,
      lastUpdated: new Date().toISOString(),
      updatedBy: "system",
      isActive: true,
    });
    
    // Create default parameters for BTC CALL options
    const callParamsId = await ctx.db.insert("riskParameters", {
      assetType: "BTC",
      policyType: "CALL",
      baseRate: 0.01, // 1% base rate
      volatilityMultiplier: 1.4, // Slightly different for CALLs
      durationFactor: 0.5,
      coverageFactor: 1.0,
      tierMultipliers: {
        conservative: 0.7,
        balanced: 1.0,
        aggressive: 1.3,
      },
      liquidityAdjustment: 1.0,
      marketTrendAdjustment: 1.0,
      version: 1,
      lastUpdated: new Date().toISOString(),
      updatedBy: "system",
      isActive: true,
    });
    
    return { 
      status: "Initialized default parameters", 
      putParamsId, 
      callParamsId 
    };
  },
}); 