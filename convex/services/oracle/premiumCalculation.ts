/**
 * Premium Calculation Service
 * 
 * This module provides services for calculating policy premiums based on
 * various factors including price data, volatility, and policy parameters.
 */

import { action, internalAction, query, internalQuery } from '../../_generated/server';
import { v } from "convex/values";
import { Id } from "../../_generated/dataModel";
import { api, internal } from "../../_generated/api";
import { getFormattedOraclePrice } from '../../blockchain/oracle/priceReader';
import { OraclePriceData } from '../../blockchain/oracle/types';

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
    // Get current price and volatility
    let currentPrice = args.currentPrice;
    if (!currentPrice) {
      const aggregatedPrice = await ctx.runQuery(api.prices.getLatestPrice, {});
      if (!aggregatedPrice) {
        throw new Error("No price data available for premium calculation");
      }
      currentPrice = aggregatedPrice.price;
    }
    
    // Calculate protected value based on percentage of current price
    const protectedValue = (currentPrice * args.protectedValuePercentage) / 100;
    
    // Get volatility for the expiration duration
    const volatility = await ctx.runQuery(api.premium.getVolatilityForDuration, {
      durationSeconds: args.expirationDays * 24 * 60 * 60,
    }) || 0.3; // Fallback to 30% volatility if not available
    
    // Get risk parameters
    const riskParams = await ctx.runQuery(api.premium.getActiveRiskParameters, {
      assetType: "BTC",
      policyType: args.policyType,
    });
    
    // Calculate Black-Scholes premium using the existing implementation
    // This uses direct calculation instead of calling another function
    const baseRate = riskParams?.baseRate || 0.01;
    const volatilityMultiplier = riskParams?.volatilityMultiplier || 1.5;
    const durationFactor = riskParams?.durationFactor || 0.5;
    
    // Calculate components
    const timeComponent = Math.pow(args.expirationDays / 365, durationFactor);
    const volatilityComponent = volatility * volatilityMultiplier;
    const coverageComponent = Math.sqrt(protectedValue) * riskParams.coverageFactor / 10000;
    
    // Calculate premium
    const premium = baseRate * timeComponent * volatilityComponent * coverageComponent * args.protectionAmount;
    
    // Calculate intrinsic value, time value, and volatility impact
    const intrinsicValue = Math.max(0, protectedValue - currentPrice) * args.protectionAmount;
    const timeValue = premium * 0.3; // Simplified allocation
    const volatilityImpact = premium * 0.7; // Simplified allocation
    
    // Calculate premium percentage and annualized rate
    const premiumPercentage = (premium / (protectedValue * args.protectionAmount)) * 100;
    const annualizedPremium = premiumPercentage * (365 / args.expirationDays);
    
    // Calculate break-even price
    const breakEvenPrice = protectedValue - (premium / args.protectionAmount);
    
    // Return comprehensive results
    return {
      premium: Number(premium.toFixed(2)),
      premiumPercentage: Number(premiumPercentage.toFixed(2)),
      annualizedPremium: Number(annualizedPremium.toFixed(2)),
      breakEvenPrice: Number(breakEvenPrice.toFixed(2)),
      timeValue: Number(timeValue.toFixed(2)),
      intrinsicValue: Number(intrinsicValue.toFixed(2)),
      volatilityImpact: Number(volatilityImpact.toFixed(2)),
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
    // Get price from oracle directly instead of aggregated prices
    const oraclePriceResult = await getFormattedOraclePrice();
    const oraclePriceData = oraclePriceResult.data;
    
    if (!oraclePriceData || !oraclePriceData.priceInUSD) {
      throw new Error("No oracle price data available for premium calculation");
    }
    
    // Calculate premium using the oracle price
    const premiumResult = await ctx.runQuery(internal.services.oracle.premiumCalculation.calculatePremium, {
      protectedValuePercentage: args.protectedValuePercentage,
      protectionAmount: args.protectionAmount,
      expirationDays: args.expirationDays,
      policyType: args.policyType,
      currentPrice: oraclePriceData.priceInUSD,
    });
    
    // Return results with oracle price data
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
    // Calculate premium with aggregated price feeds
    const premiumWithAggregated = await ctx.runQuery(internal.services.oracle.premiumCalculation.calculatePremium, {
      ...args,
    });
    
    // Calculate premium with oracle price
    const premiumWithOracle = await ctx.runAction(internal.services.oracle.premiumCalculation.calculatePremiumWithOraclePrice, {
      ...args,
    });
    
    // Get current prices from both sources
    const aggregatedPrice = await ctx.runQuery(api.prices.getLatestPrice, {});
    
    // Calculate difference
    const priceDifference = aggregatedPrice ? 
      ((premiumWithOracle.oraclePriceData?.priceInUSD || 0) - aggregatedPrice.price) / aggregatedPrice.price * 100 : 0;
    
    const premiumDifference = 
      (premiumWithOracle.premium - premiumWithAggregated.premium) / premiumWithAggregated.premium * 100;
    
    // Return comparison
    return {
      aggregatedPricePremium: premiumWithAggregated,
      oraclePricePremium: premiumWithOracle,
      aggregatedPrice: aggregatedPrice?.price,
      oraclePrice: premiumWithOracle.oraclePriceData?.priceInUSD,
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
    assetPrice: v.number(),
    protectedAmount: v.number(),
    protectedValue: v.number(),
    expirationDays: v.number(),
    policyType: v.string(),
    volatility: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ 
    calculationId: Id<"premiumCalculations">, 
    result: PremiumCalculationResult 
  }> => {
    const {
      userId,
      asset,
      assetPrice,
      protectedAmount,
      protectedValue,
      expirationDays,
      policyType,
      volatility,
    } = args;

    // Calculate the premium
    const calculation = await ctx.runQuery(calculatePremium, {
      assetPrice,
      protectedAmount,
      protectedValue,
      expirationDays,
      policyType,
      volatility,
    });

    // Store the calculation in the database
    const calculationId = await ctx.runMutation(async (ctx) => {
      return await ctx.db.insert("premiumCalculations", {
        userId,
        asset,
        currentPrice: assetPrice,
        protectedValue,
        protectedAmount,
        expirationDays,
        policyType,
        volatilityUsed: calculation.volatilityUsed,
        premium: calculation.premium,
        premiumPercentage: calculation.premiumPercentage,
        annualizedPremium: calculation.annualizedPremium,
        breakEvenPrice: calculation.breakEvenPrice,
        intrinsicValue: calculation.intrinsicValue,
        timeValue: calculation.timeValue,
        volatilityImpact: calculation.volatilityImpact,
        calculationModel: calculation.calculationModel,
        timestamp: new Date().toISOString(),
        scenarios: calculation.scenarios,
      });
    });

    return {
      calculationId,
      result: calculation,
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