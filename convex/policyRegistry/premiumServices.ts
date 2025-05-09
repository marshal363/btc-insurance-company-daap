import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { CalculatePremiumForCreationParams, PolicyType } from "./types";
import { calculateBlackScholesPremium } from "../services/oracle/premiumCalculation"; // Updated import path

/**
 * Calculates the premium for a new policy at the time of creation.
 * This acts as the premium calculation service for the Policy Registry.
 * Now structured as an internalQuery.
 * 
 * @param ctx Convex query context.
 * @param args Parameters for premium calculation conforming to CalculatePremiumForCreationParams.
 * @returns The calculated premium amount (number).
 */
export const calculatePremiumForPolicyCreation = internalQuery({
  args: {
    policyType: v.string(), // Expecting PolicyType enum string
    strikePriceUSD: v.number(),
    durationDays: v.number(),
    protectionAmount: v.number(), // Corresponds to protectionAmount in the interface
  },
  handler: async (
    ctx: QueryCtx,
    args: CalculatePremiumForCreationParams // Use the interface directly for type safety
  ): Promise<number> => {
    // 1. Get current market data (price, volatility)
    const marketData = await ctx.runQuery(internal.premium.getCurrentMarketData, { asset: "BTC" });
    if (!marketData) {
      throw new Error("Failed to fetch current market data for premium calculation.");
    }
    const currentPriceUSD = marketData.price;
    const volatility = marketData.volatility;

    // 2. Get active risk parameters
    const riskParams = await ctx.runQuery(internal.premium.getActiveRiskParameters, {
      assetType: "BTC",
      policyType: args.policyType, // Use args.policyType
    });
    if (!riskParams) {
      console.warn(`Risk parameters not found for ${args.policyType}, BlackScholes will use defaults if applicable.`);
    }

    // 3. Calculate premium using Black-Scholes
    const premiumComponents = calculateBlackScholesPremium({
      currentPrice: currentPriceUSD,
      strikePrice: args.strikePriceUSD,
      volatility: volatility,
      duration: args.durationDays,
      amount: args.protectionAmount,
      riskParams: riskParams,
    });

    return premiumComponents.premium;
  }
}); 