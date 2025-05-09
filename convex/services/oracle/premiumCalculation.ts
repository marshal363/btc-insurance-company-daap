/**
 * Premium Calculation Service
 * 
 * This module provides services for calculating policy premiums based on
 * various factors including price data, volatility, and policy parameters.
 */

import { action, internalAction, query, internalQuery, internalMutation } from '../../_generated/server';
import { v } from "convex/values";
import { Id } from "../../_generated/dataModel";
import { api, internal } from "../../_generated/api";
import { getFormattedOraclePrice } from '../../blockchain/oracle/priceReader';
import { OraclePriceData } from '../../blockchain/oracle/types';
import * as math from 'mathjs';
import { 
  MarketData, 
  RiskParameters, 
  PremiumComponents,
  PriceScenario,
  BuyerPremiumQuoteResult,
  ProviderYieldQuoteResult,
  ProviderYieldComponents
} from '../../types'; // Corrected path

/**
 * Premium calculation parameters
 */
export interface PremiumCalculationParams {
  assetPrice: number;          // Current price of the asset (e.g., BTC price in USD)
  protectedAmount: number;     // Amount of asset being protected
  protectedValue: number;      // Value being protected (e.g., USD value)
  durationDays: number;        // Duration of protection in days
  volatility: number;          // Market volatility as a decimal
  policyType: string;          // Type of policy (e.g., "PUT")
}

/**
 * Result of premium calculation
 */
export interface PremiumCalculationResult {
  premium: number;             // Total premium in USD
  premiumPercentage: number;   // Premium as percentage of protected value
  annualizedPremium: number;   // Annualized premium percentage
  breakEvenPrice: number;      // Price at which protection value equals premium
  timeValue: number;           // Time value component of premium
  intrinsicValue: number;      // Intrinsic value component of premium
  volatilityImpact: number;    // Volatility impact on premium
  volatilityUsed: number;
  calculationModel: string;
  scenarios: PriceScenario[];
}

// Interface for premium components from the existing calculations
interface PremiumComponents {
  premium: number;
  intrinsicValue: number;
  timeValue: number;
  volatilityImpact: number;
}

/**
 * Calculate premium for a policy using Black-Scholes model and risk parameters
 * 
 * @param {PremiumCalculationParams} params - Premium calculation parameters
 * @returns {Promise<PremiumCalculationResult>} The premium calculation result
 */
export const calculatePremium = internalQuery({
  args: {
    protectedValuePercentage: v.number(),
    protectionAmount: v.number(),
    expirationDays: v.number(),
    policyType: v.string(),
    currentPrice: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<PremiumCalculationResult> => {
    let currentPrice = args.currentPrice;
    if (currentPrice === undefined) {
      const aggregatedPrice = await ctx.runQuery(api.services.oracle.priceService.getLatestPrice, {}); 
      if (!aggregatedPrice || aggregatedPrice.price === undefined) {
        throw new Error("No price data available for premium calculation");
      }
      currentPrice = aggregatedPrice.price;
    }
    
    const protectedValue = (currentPrice * args.protectedValuePercentage) / 100;
    
    const volatility = await ctx.runQuery(api.services.oracle.priceService.getVolatilityForDuration, { 
      durationSeconds: args.expirationDays * 24 * 60 * 60,
    }) || 0.3;
    
    const riskParams = await ctx.runQuery(api.premium.getActiveRiskParameters, { 
      assetType: "BTC",
      policyType: args.policyType,
    });
    if (!riskParams) {
       throw new Error("Risk parameters not found for BTC/" + args.policyType);
    }
    
    const baseRate = riskParams.baseRate || 0.01;
    const volatilityMultiplier = riskParams.volatilityMultiplier || 1.5;
    const durationFactor = riskParams.durationFactor || 0.5;
    const coverageFactor = riskParams.coverageFactor || 1.0;
    
    const timeComponent = Math.pow(args.expirationDays / 365, durationFactor);
    const volatilityComponent = volatility * volatilityMultiplier;
    const coverageComponentValue = protectedValue > 0 ? Math.sqrt(protectedValue) * coverageFactor / 10000 : 0;
    
    const premium = baseRate * timeComponent * volatilityComponent * coverageComponentValue * args.protectionAmount;
    
    const intrinsicValue = Math.max(0, protectedValue - currentPrice) * args.protectionAmount;
    const timeValue = premium * 0.3; 
    const volatilityImpact = premium * 0.7;
    
    const premiumPercentage = (protectedValue * args.protectionAmount) > 0 ? 
      (premium / (protectedValue * args.protectionAmount)) 
      : 0;
    const annualizedPremium = args.expirationDays > 0 ? 
      premiumPercentage * (365 / args.expirationDays) 
      : 0;
    
    const breakEvenPrice = protectedValue - (premium / args.protectionAmount);
    
    return {
      premium: Number(premium.toFixed(2)),
      premiumPercentage: premiumPercentage,
      annualizedPremium: annualizedPremium,
      breakEvenPrice: Number(breakEvenPrice.toFixed(2)),
      timeValue: Number(timeValue.toFixed(2)),
      intrinsicValue: Number(intrinsicValue.toFixed(2)),
      volatilityImpact: Number(volatilityImpact.toFixed(2)),
      volatilityUsed: riskParams.volatilityUsed,
      calculationModel: riskParams.calculationModel,
      scenarios: riskParams.scenarios,
    };
  },
});

/**
 * Calculate premium with on-chain oracle price data 
 * instead of aggregated price feeds
 */
export const calculatePremiumWithOraclePrice = internalAction({
  args: {
    protectedValuePercentage: v.number(),
    protectionAmount: v.number(),
    expirationDays: v.number(),
    policyType: v.string(),
  },
  handler: async (ctx, args): Promise<PremiumCalculationResult & { oraclePriceData: OraclePriceData | null }> => {
    const oraclePriceData = await getFormattedOraclePrice();
    
    if (!oraclePriceData || typeof oraclePriceData.priceInUSD !== 'number') {
      throw new Error("No valid oracle price data available for premium calculation");
    }
    
    const premiumResult = await ctx.runQuery(internal.services.oracle.premiumCalculation.calculatePremium, {
      protectedValuePercentage: args.protectedValuePercentage,
      protectionAmount: args.protectionAmount,
      expirationDays: args.expirationDays,
      policyType: args.policyType,
      currentPrice: oraclePriceData.priceInUSD,
    });
    
    return {
      ...premiumResult,
      oraclePriceData,
    };
  },
});

/**
 * Compare premium calculated with aggregated price feeds vs oracle price
 */
export const comparePremiumSources = internalAction({
  args: {
    protectedValuePercentage: v.number(),
    protectionAmount: v.number(),
    expirationDays: v.number(),
    policyType: v.string(),
  },
  handler: async (ctx, args) => {
    const premiumWithAggregated: PremiumCalculationResult | null = await ctx.runQuery(internal.services.oracle.premiumCalculation.calculatePremium, {
      ...args,
      currentPrice: undefined, 
    });
    
    const premiumWithOracle: (PremiumCalculationResult & { oraclePriceData: OraclePriceData | null }) | null = await ctx.runAction(internal.services.oracle.premiumCalculation.calculatePremiumWithOraclePrice, {
      ...args,
    });

    if (!premiumWithAggregated || !premiumWithOracle) {
        throw new Error("Failed to calculate one or both premium sources for comparison.");
    }
    
    const aggregatedPriceData = await ctx.runQuery(api.services.oracle.priceService.getLatestPrice, {});
    const aggregatedPrice = aggregatedPriceData?.price;
    const oraclePrice = premiumWithOracle.oraclePriceData?.priceInUSD;
    
    const priceDifference = (aggregatedPrice && oraclePrice) ? 
      ((oraclePrice - aggregatedPrice) / aggregatedPrice) * 100 : 0;
    
    const premiumDifference = premiumWithAggregated.premium !== 0 ?
      (premiumWithOracle.premium - premiumWithAggregated.premium) / premiumWithAggregated.premium * 100 : 0;
    
    return {
      aggregatedPricePremium: premiumWithAggregated,
      oraclePricePremium: premiumWithOracle,
      aggregatedPrice: aggregatedPrice,
      oraclePrice: oraclePrice,
      priceDifferencePercent: Number(priceDifference.toFixed(2)),
      premiumDifferencePercent: Number(premiumDifference.toFixed(2)),
      timestamp: Date.now(),
    };
  },
});

/**
 * Calculates and stores a premium calculation for later reference.
 * 
 * @param params - Parameters for premium calculation
 * @returns The stored calculation ID and result
 */
export const calculateAndStorePremium = action({
  args: {
    userId: v.string(),
    asset: v.string(),
    protectionAmount: v.number(),
    protectedValuePercentage: v.number(),
    expirationDays: v.number(),
    policyType: v.string(),
    currentPriceOverride: v.optional(v.number()),
    volatilityOverride: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ 
    calculationId: Id<"premiumCalculations">, 
    result: PremiumCalculationResult 
  }> => {
    const {
      userId,
      asset,
      protectionAmount,
      protectedValuePercentage,
      expirationDays,
      policyType,
      currentPriceOverride,
      volatilityOverride,
    } = args;

    const calculationResult = await ctx.runQuery(internal.services.oracle.premiumCalculation.calculatePremium, {
      currentPrice: currentPriceOverride,
      protectionAmount,
      protectedValuePercentage,
      expirationDays,
      policyType,
      volatility: volatilityOverride,
    });
    
    const currentPriceForStorage = currentPriceOverride ?? 
      (await ctx.runQuery(api.services.oracle.priceService.getLatestPrice, {}))?.price ?? 0;
    if (currentPriceForStorage === 0) {
        throw new Error("Could not determine current price for storing calculation.");
    }
    const protectedValueForStorage = (currentPriceForStorage * protectedValuePercentage) / 100;

    const mutationArgs = {
        userId,
        asset,
        currentPrice: currentPriceForStorage,
        protectedValue: protectedValueForStorage,
        protectedAmount,
        expirationDays,
        policyType,
        volatilityUsed: calculationResult.volatilityUsed,
        premium: calculationResult.premium,
        premiumPercentage: calculationResult.premiumPercentage,
        annualizedPremium: calculationResult.annualizedPremium,
        breakEvenPrice: calculationResult.breakEvenPrice,
        intrinsicValue: calculationResult.intrinsicValue,
        timeValue: calculationResult.timeValue,
        volatilityImpact: calculationResult.volatilityImpact,
        calculationModel: calculationResult.calculationModel,
        timestamp: new Date().toISOString(),
        scenarios: calculationResult.scenarios,
    };

    const calculationId = await ctx.runMutation(internal.services.oracle.premiumCalculation.insertPremiumCalculationEntry, mutationArgs);

    return {
      calculationId,
      result: calculationResult, 
    };
  },
});

/**
 * Get a previously stored premium calculation.
 * 
 * @param calculationId - ID of the stored calculation
 * @returns The stored calculation
 */
export const getStoredPremiumCalculation = query({
  args: {
    calculationId: v.id("premiumCalculations"),
  },
  handler: async (ctx, { calculationId }): Promise<any> => {
    return await ctx.db.get(calculationId);
  },
});

// --- Moved Calculation Logic from premium.ts --- 

/**
 * Calculates premium using Black-Scholes for a PUT option
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
  // ... (Full Black-Scholes implementation copied from premium.ts) ...
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
    const intrinsicValue = Number(math.max(0, K - S)); 
    const discountedExp = Number(math.exp(-r * T));
    const discountedValue = intrinsicValue * discountedExp; 
    console.warn(`Edge case: sigma*sqrt(T) is zero. Returning discounted intrinsic value: ${discountedValue}`);
    const finalPremium = discountedValue * amount;
    
    return {
      premium: Number(math.max(0, Number(math.round(finalPremium * 100)) / 100)),
      intrinsicValue: intrinsicValue * amount, // Scale intrinsic value by amount here
      timeValue: 0,
      volatilityImpact: 0,
    };
  }
  
  const logSK = Number(math.log(S / K));
  const powSigma = Number(math.pow(sigma, 2));
  const d1_numerator = logSK + (r + 0.5 * powSigma) * T;
  const d1_denominator = sigma * sqrtT;
  const d1 = d1_numerator / d1_denominator;
  const d2 = d1 - sigma * sqrtT;

  const erf_neg_d1 = Number(math.erf((-d1) / Number(math.sqrt(2))));
  const erf_neg_d2 = Number(math.erf((-d2) / Number(math.sqrt(2))));
  const N_neg_d1: number = erf_neg_d1 / 2 + 0.5;
  const N_neg_d2: number = erf_neg_d2 / 2 + 0.5;

  const expRT = Number(math.exp(-r * T));
  const term1: number = K * expRT * N_neg_d2;
  const term2: number = S * N_neg_d1;
  const putPremiumPerUnit: number = term1 - term2; 
  
  const intrinsicValuePerUnit = Number(math.max(0, K - S));
  const timeValueWithVol = putPremiumPerUnit - intrinsicValuePerUnit;
  
  const timeValuePerUnit = timeValueWithVol * 0.3; // Simplified split
  const volatilityImpactPerUnit = timeValueWithVol * 0.7;
  
  let adjustedPremiumPerUnit = putPremiumPerUnit;
  if (riskParams) {
    adjustedPremiumPerUnit = putPremiumPerUnit * 
      (1 + riskParams.baseRate) * 
      riskParams.volatilityMultiplier * 
      (1 + (duration / 365) * riskParams.durationFactor);
  }
  
  const totalPremium: number = adjustedPremiumPerUnit * amount;

  if (isNaN(totalPremium) || !isFinite(totalPremium)) {
    console.error(`Black-Scholes calculation resulted in NaN or Infinity. Inputs: S=${S}, K=${K}, sigma=${sigma}, T=${T}, r=${r}. Returning 0.`);
    return {
      premium: 0,
      intrinsicValue: 0,
      timeValue: 0,
      volatilityImpact: 0,
    };
  }

  const roundedPremium = Number(math.round(totalPremium * 100)) / 100;
  return {
    premium: Number(math.max(0, roundedPremium)),
    // Ensure components are also scaled by amount
    intrinsicValue: Number(math.round(intrinsicValuePerUnit * amount * 100)) / 100,
    timeValue: Number(math.round(timeValuePerUnit * amount * 100)) / 100,
    volatilityImpact: Number(math.round(volatilityImpactPerUnit * amount * 100)) / 100,
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
  // ... (Full implementation copied from premium.ts) ...
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

  const tierMultiplier = selectedTier === "conservative" 
    ? riskParams?.tierMultipliers?.conservative ?? 0.7
    : selectedTier === "balanced" 
    ? riskParams?.tierMultipliers?.balanced ?? 1.0
    : selectedTier === "aggressive" 
    ? riskParams?.tierMultipliers?.aggressive ?? 1.3
    : 1.0;

  const baseAnnualYieldRate = volatility * 0.8; 
  const durationFactor = 1 - Math.exp(-selectedPeriod / 90); 
  const marketFactor = 1 + (marketConditions.volatility - 0.2) * 0.5;
  
  const baseYield = baseAnnualYieldRate * (selectedPeriod / 365) * commitmentAmountUSD;
  const tierAdjustment = baseYield * (tierMultiplier - 1);
  const durationAdjustment = baseYield * (durationFactor - 0.8);
  const marketConditionAdjustment = baseYield * (marketFactor - 1);
  
  const annualizedYieldRate = baseAnnualYieldRate * tierMultiplier * durationFactor * marketFactor;
  const estimatedYield = annualizedYieldRate * (selectedPeriod / 365) * commitmentAmountUSD;
  
  const riskLevel = Math.min(10, Math.round(
    1 + 
    (selectedTier === "conservative" ? 1 : selectedTier === "balanced" ? 3 : 5) + 
    (Math.min(3, selectedPeriod / 120)) + 
    (Math.min(2, volatility * 10))
  ));
  
  const estimatedBTCAcquisitionPrice = marketConditions.btcPrice * (1 - volatility * tierMultiplier * 0.5);
  
  return {
    estimatedYield: Number(math.round(estimatedYield * 100)) / 100,
    annualizedYieldPercentage: Number(math.round(annualizedYieldRate * 10000)) / 100, 
    estimatedBTCAcquisitionPrice: Number(math.round(estimatedBTCAcquisitionPrice * 100)) / 100,
    riskLevel,
    baseYield: Number(math.round(baseYield * 100)) / 100,
    tierAdjustment: Number(math.round(tierAdjustment * 100)) / 100,
    durationAdjustment: Number(math.round(durationAdjustment * 100)) / 100,
    marketConditionAdjustment: Number(math.round(marketConditionAdjustment * 100)) / 100,
    capitalEfficiency: tierMultiplier * 0.8, 
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
  // ... (Full implementation copied from premium.ts) ...
  const scenarios: PriceScenario[] = [];
  const priceRange = 0.5;
  
  for (let i = -10; i <= 10; i++) {
    const priceChange = i * (priceRange / 10);
    const scenarioPrice = currentPrice * (1 + priceChange);
    const protectionValue = Math.max(0, (strikePrice - scenarioPrice) * amount);
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
 * Calculate break-even price for a PUT option
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
  // ... (Full implementation copied from premium.ts) ...
  return Number(math.round((strikePrice - (premium / amount)) * 100)) / 100;
}

/**
 * Calculate provider's approximate break-even BTC price
 */
function calculateProviderBreakEvenPrice({
  commitmentAmountUSD,
  estimatedYieldUSD,
  currentBtcPrice,
}: {
  commitmentAmountUSD: number;
  estimatedYieldUSD: number;
  currentBtcPrice: number;
}): number | undefined {
  // ... (Full implementation copied from premium.ts) ...
  if (currentBtcPrice <= 0 || commitmentAmountUSD <= 0) {
    return undefined;
  }
  const bufferPercentage = estimatedYieldUSD / commitmentAmountUSD;
  const breakEvenPrice = currentBtcPrice * (1 - bufferPercentage);
  return Math.max(0, breakEvenPrice);
}

// --- NEW PUBLIC FACING QUERIES --- 

/**
 * Get buyer premium quote with all details, using new services.
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
    // 1. Get current market data using new priceService
    const aggregatedPriceResult = await ctx.runQuery(api.services.oracle.priceService.getLatestPrice, {});
    if (!aggregatedPriceResult) {
      throw new Error("Market data (aggregated price) not available.");
    }
    const currentPrice: number = args.currentPriceOverride ?? aggregatedPriceResult.price;
    
    // 2. Get relevant volatility using new priceService
    const volatilityResult = await ctx.runQuery(internal.services.oracle.priceService.getVolatilityForDuration, {
        durationSeconds: args.expirationDays * 24 * 60 * 60,
    });
    const volatility: number = volatilityResult ?? 0.3; // Default to 30% if null
    if (volatilityResult === null) {
        console.warn(`Could not find specific volatility for ${args.expirationDays} days. Using default: ${volatility}`);
    }

    // 3. Calculate protected value in USD
    const protectedValueUSD: number =
      (currentPrice * args.protectedValuePercentage) / 100;

    // 4. Get active risk parameters (using existing path for now)
    // TODO: Update this if risk parameters are moved to the oracle service
    const riskParams: RiskParameters = await ctx.runQuery(
      internal.premium.getActiveRiskParameters, // OLD PATH - NEEDS CHECKING/UPDATING LATER
      {
        assetType: "BTC",
        policyType: args.policyType,
      }
    );

    // 5. Calculate premium using Black-Scholes (now local to this file)
    const premiumResult = calculateBlackScholesPremium({
      currentPrice: currentPrice,
      strikePrice: protectedValueUSD,
      volatility: volatility, // Use volatility from priceService
      duration: args.expirationDays,
      amount: args.protectionAmount,
      riskParams: riskParams,
    });

    // 6. Calculate break-even price (now local to this file)
    const breakEvenPrice = calculateBreakEvenPrice({
      strikePrice: protectedValueUSD,
      premium: premiumResult.premium,
      amount: args.protectionAmount,
    });

    // 7. Calculate premium percentage and annualized
    const premiumPercentage = (protectedValueUSD * args.protectionAmount) > 0 
        ? (premiumResult.premium / (protectedValueUSD * args.protectionAmount)) * 100 
        : 0;
    const annualizedPremium = args.expirationDays > 0 
        ? premiumPercentage * (365 / args.expirationDays) 
        : 0;

    // 8. Generate price scenarios if requested (now local to this file)
    let scenarios: PriceScenario[] = [];
    if (args.includeScenarios) {
      scenarios = generatePriceScenarios({
        currentPrice: currentPrice,
        strikePrice: protectedValueUSD,
        premium: premiumResult.premium,
        amount: args.protectionAmount,
      });
    }

    // 9. Construct and return the comprehensive quote result
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
        volatility: volatility, // The volatility used in calculation
        timestamp: new Date(aggregatedPriceResult.timestamp).toISOString(), // Use timestamp from aggregation
      },
      riskParamsSnapshot: riskParams,
    };
  },
});

/**
 * Get provider yield quote with all details, using new services.
 */
export const getProviderYieldQuote = query({
  args: {
    commitmentAmountUSD: v.number(),
    selectedTier: v.string(),
    selectedPeriodDays: v.number(),
  },
  handler: async (ctx, args): Promise<ProviderYieldQuoteResult> => {
    const quoteId = `prov-${new Date().toISOString()}-${Math.random().toString(16).slice(2)}`;
    const timestamp = Date.now();

    // 1. Fetch market data using new priceService
    const aggregatedPriceResult = await ctx.runQuery(api.services.oracle.priceService.getLatestPrice, {});
    if (!aggregatedPriceResult) {
      throw new Error("Market data (aggregated price) not available for yield quote.");
    }
    const marketData: MarketData = {
        price: aggregatedPriceResult.price,
        volatility: aggregatedPriceResult.volatility,
        timestamp: aggregatedPriceResult.timestamp,
    };

    // 2. Fetch risk parameters (using existing path for now)
    let riskParams = await ctx.runQuery(internal.premium.getActiveRiskParameters, { 
      assetType: "BTC",
      policyType: "ProviderYield",
    });
    if (!riskParams) {
        console.warn(`No active risk parameters found for BTC/ProviderYield. Using defaults.`);
        riskParams = { 
            baseRate: 0.01, 
            volatilityMultiplier: 1.5, 
            durationFactor: 0.5, 
            coverageFactor: 1.0, 
            tierMultipliers: { conservative: 0.7, balanced: 1.0, aggressive: 1.3 },
            liquidityAdjustment: 0,
            marketTrendAdjustment: 0,
            assetType: 'BTC',
            policyType: 'ProviderYield'
        };
    }

    // 3. Calculate yield components 
    const yieldComponents = calculateProviderYield({
      commitmentAmountUSD: args.commitmentAmountUSD,
      selectedTier: args.selectedTier,
      selectedPeriod: args.selectedPeriodDays,
      volatility: marketData.volatility,
      riskParams: riskParams,
      marketConditions: {
        btcPrice: marketData.price,
        volatility: marketData.volatility, 
        liquidity: riskParams.liquidityAdjustment ?? 0, // Use nullish coalescing for safety
      },
    });

    // 4. Calculate annualized percentage (adjust calculation)
    const annualizedYieldPercentage = yieldComponents.annualizedYieldPercentage; // Use value from calculateProviderYield

    // 5. Calculate provider break-even price (now local to this file)
    const breakEvenPrice = calculateProviderBreakEvenPrice({
      commitmentAmountUSD: args.commitmentAmountUSD,
      estimatedYieldUSD: yieldComponents.estimatedYield,
      currentBtcPrice: marketData.price,
    });

    // 6. Return the comprehensive quote result
    return {
      quoteId,
      timestamp,
      parameters: {
        commitmentAmountUSD: args.commitmentAmountUSD,
        selectedTier: args.selectedTier,
        selectedPeriodDays: args.selectedPeriodDays,
      },
      calculated: {
        // Use the annualized percentage calculated within yieldComponents
        estimatedYieldPercentage: annualizedYieldPercentage, 
        estimatedYieldUSD: yieldComponents.estimatedYield, // Yield for the specific period
        yieldComponents: yieldComponents,
        breakEvenPriceUSD: breakEvenPrice, 
      },
      marketData, // Snapshot of market data used
      riskParametersUsed: riskParams, // Snapshot of risk parameters used
      visualizationData: {
        // Placeholder
      },
    };
  },
});

// New internal mutation for storing premium calculations
export const insertPremiumCalculationEntry = internalMutation({
  args: {
    userId: v.string(),
    asset: v.string(),
    currentPrice: v.number(),
    protectedValue: v.number(), // This is strikePrice in USD
    protectedAmount: v.number(), // This is amount of asset
    expirationDays: v.number(),
    policyType: v.string(),
    volatilityUsed: v.number(),
    premium: v.number(),
    premiumPercentage: v.number(), // As decimal
    annualizedPremium: v.number(), // As decimal
    breakEvenPrice: v.number(),
    intrinsicValue: v.number(),
    timeValue: v.number(),
    volatilityImpact: v.number(),
    calculationModel: v.string(),
    timestamp: v.string(), // ISOString
    scenarios: v.array(v.object({ // Define PriceScenario structure
        price: v.number(),
        protectionValue: v.number(),
        netValue: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("premiumCalculations", args);
  },
}); 