import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import * as math from 'mathjs'; // Import math.js

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

    // --- Get dynamic volatility based on duration ---
    const dynamicVolatility = await ctx.runQuery(internal.prices.getVolatilityForDuration, {
      durationSeconds: args.duration
    });

    if (dynamicVolatility === null) {
      console.error(`Failed to retrieve volatility for duration ${args.duration} seconds. Cannot create contract.`);
      throw new Error("Volatility data unavailable for the specified duration. Cannot calculate premium.");
    }

    // --- Get Risk-Free Rate from Environment Variable ---
    const riskFreeRateString = process.env.RISK_FREE_RATE;
    let riskFreeRate = 0.02; // Default rate (2%)
    if (riskFreeRateString) {
        const parsedRate = parseFloat(riskFreeRateString);
        if (!isNaN(parsedRate)) {
            riskFreeRate = parsedRate;
            console.log(`Using risk-free rate from env: ${riskFreeRate}`);
        } else {
            console.warn(`Invalid RISK_FREE_RATE env var: "${riskFreeRateString}". Using default: ${riskFreeRate}`);
        }
    } else {
        console.warn(`RISK_FREE_RATE env var not set. Using default: ${riskFreeRate}`);
    }
    // --- END --- 

    // Calculate premium using Black-Scholes
    const premium = calculatePremium({
      currentPrice: latestPrice.price,
      strikePrice: args.strikePrice,
      volatility: dynamicVolatility,
      duration: args.duration,
      amount: args.amount,
      riskFreeRate: riskFreeRate
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

// Helper function to calculate premium using Black-Scholes for a PUT option
function calculatePremium({
  currentPrice,  // S
  strikePrice,   // K
  volatility,    // σ
  duration,      // T (in seconds)
  amount,        // Multiplier for final premium
  riskFreeRate   // r
}: {
  currentPrice: number;
  strikePrice: number;
  volatility: number;
  duration: number;
  amount: number;
  riskFreeRate: number;
}) {
  // Validate inputs
  if (currentPrice <= 0 || strikePrice <= 0 || volatility <= 0 || duration <= 0 || amount <= 0) {
    console.warn(`Invalid input for Black-Scholes: S=${currentPrice}, K=${strikePrice}, σ=${volatility}, T(sec)=${duration}, Amount=${amount}, r=${riskFreeRate}. Returning 0 premium.`);
    return 0;
  }

  // --- Black-Scholes Implementation --- 
  const S = currentPrice;
  const K = strikePrice;
  const sigma = volatility;
  const T = duration / (365 * 24 * 60 * 60); // Time to expiration in years
  const r = riskFreeRate; // Use passed-in rate

  const sqrtT = Number(math.sqrt(T)); // Cast result to number

  // Check for zero volatility or time - edge case leading to division by zero
  if (sigma * sqrtT === 0) {
      // If vol or time is zero, the PUT premium is the intrinsic value discounted
      const intrinsicValue = Number(math.max(0, K - S)); // Cast result to number
      const discountedExp = Number(math.exp(-r * T)); // Cast result to number
      const discountedValue = intrinsicValue * discountedExp; 
      console.warn(`Edge case: sigma*sqrt(T) is zero. Returning discounted intrinsic value: ${discountedValue}`);
      const finalPremium = discountedValue * amount;
      // Cast math.round result before math.max
      return Number(math.max(0, Number(math.round(finalPremium * 100)) / 100)); 
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
  
  // Scale premium by the amount (e.g., number of BTC)
  const totalPremium: number = putPremiumPerUnit * amount;

  // Final checks and rounding
  if (isNaN(totalPremium) || !isFinite(totalPremium)) {
      console.error(`Black-Scholes calculation resulted in NaN or Infinity. Inputs: S=${S}, K=${K}, sigma=${sigma}, T=${T}, r=${r}. Returning 0.`);
      return 0;
  }

  // Return rounded, non-negative premium
  // Cast math.round result before math.max
  const roundedPremium = Number(math.round(totalPremium * 100)) / 100;
  return Number(math.max(0, roundedPremium)); 
}
