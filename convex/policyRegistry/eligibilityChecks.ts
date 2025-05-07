import { query, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import {
  PolicyStatus,
  PolicyType,
  TokenType,
  PolicyActivationEligibilityResult,
  PolicyCreationParams
} from "./types";

// --- Mock Services (for dependencies from other modules/phases) ---

/**
 * Mock Pool Liquidity Checking Service.
 * Simulates checking if the liquidity pool has sufficient capacity for a policy.
 * Corresponds to CV-PR-208.
 * 
 * @param _ctx Convex context (unused in mock).
 * @param _params Parameters for the liquidity check (e.g., policy details, amount).
 * @returns Promise<{ sufficient: boolean; reason?: string }>
 */
export async function mockCheckPoolLiquidity(
  _ctx: any, 
  _params: {
    collateralToken: TokenType;
    collateralAmount: number;
    // Potentially other params like policyType, duration to assess risk capacity
  }
): Promise<{ sufficient: boolean; reason?: string }> {
  // Simulate a 5% chance of failure for testing purposes
  if (Math.random() < 0.05) {
    console.warn("MockPoolLiquidityCheck: Insufficient liquidity (simulated failure).");
    return { sufficient: false, reason: "Insufficient pool liquidity (simulated)." };
  }
  console.log("MockPoolLiquidityCheck: Sufficient liquidity (simulated success).");
  return { sufficient: true };
}

/**
 * Mock function to get a simulated current block height.
 */
export async function mockGetLatestBlockHeight(): Promise<number> {
  // Simulate a steadily increasing block height
  // For a more realistic mock, this could interact with a simple counter or a test utility
  return Math.floor(Date.now() / 10000) + 700000; // Example: timestamp-based pseudo-height
}

/**
 * Mock function to get a simulated current BTC price in USD.
 */
export async function mockGetCurrentBTCPrice(): Promise<number> {
  // Simulate some price fluctuation
  return 60000 + (Math.random() - 0.5) * 5000; // e.g., $57,500 to $62,500
}

// --- Eligibility Checks ---

/**
 * Checks if a policy is eligible for activation (exercise).
 * Corresponds to CV-PR-206.
 * Uses mocked Oracle and blockchain data.
 */
export const checkPolicyActivationEligibility = query({
  args: { policyId: v.id("policies") },
  handler: async (ctx: QueryCtx, args): Promise<PolicyActivationEligibilityResult> => {
    const policy = await ctx.db.get(args.policyId);

    if (!policy) {
      return { eligible: false, reason: "Policy not found." };
    }

    if (policy.status !== PolicyStatus.ACTIVE) {
      return { eligible: false, reason: `Policy is not Active. Current status: ${policy.status}` };
    }

    const currentBlockHeight = await mockGetLatestBlockHeight();
    if (currentBlockHeight > policy.expirationHeight) {
      // TODO: In a real scenario, a scheduled job should have already marked this as EXPIRED.
      // For now, this check is a safeguard.
      // Consider calling a mutation to update status if found here, or rely on scheduled job.
      return { eligible: false, reason: `Policy has expired at block ${policy.expirationHeight}. Current: ${currentBlockHeight}` };
    }

    const currentBTCPriceUSD = await mockGetCurrentBTCPrice();
    let settlementAmount = 0;
    let eligibleForExercise = false; 

    // Assuming protectedValue is the strike price in USD
    // and protectionAmount is the quantity of the underlying (e.g. BTC quantity)
    // Premium is typically in the settlementToken or a stablecoin.
    // Settlement amount should be in the policy\'s settlementToken.
    // For this mock, let\'s assume settlementAmount is calculated in USD terms first if strike is USD.

    if (policy.policyType === PolicyType.PUT) {
      if (currentBTCPriceUSD < policy.protectedValue) {
        eligibleForExercise = true;
        // For a PUT: Settlement = (Strike Price - Current Price) * Protection Amount
        // This calculation needs to be in the context of the protected asset and settlement token.
        // If strike is USD, current price is USD, protection amount is in BTC, then settlement is more complex.
        // For simplicity, let\'s assume protectedValue = strike in USD, currentBTCPriceUSD is market price in USD.
        // If settlementToken is STX/sBTC, we\'d need conversion. Architecture doc implies settlementAmount from eligibility.
        // Let\'s assume protectionAmount is a multiplier and settlement reflects profit in USD terms.
        settlementAmount = (policy.protectedValue - currentBTCPriceUSD) * policy.protectionAmount; 
      } else {
        return { eligible: false, reason: `PUT Option: Current price (${currentBTCPriceUSD}) is not below strike price (${policy.protectedValue}).` };
      }
    } else if (policy.policyType === PolicyType.CALL) {
      if (currentBTCPriceUSD > policy.protectedValue) {
        eligibleForExercise = true;
        // For a CALL: Settlement = (Current Price - Strike Price) * Protection Amount
        settlementAmount = (currentBTCPriceUSD - policy.protectedValue) * policy.protectionAmount;
      } else {
        return { eligible: false, reason: `CALL Option: Current price (${currentBTCPriceUSD}) is not above strike price (${policy.protectedValue}).` };
      }
    } else {
      return { eligible: false, reason: `Unknown policy type: ${policy.policyType}` };
    }

    if (eligibleForExercise) {
      // Ensure settlement amount is not negative (should be handled by eligibility checks)
      settlementAmount = Math.max(0, settlementAmount); 
      return { eligible: true, settlementAmount };
    }

    // Should not be reached if logic is correct
    return { eligible: false, reason: "Eligibility check failed due to an unknown reason." };
  }
});

/**
 * Validates policy creation parameters for required fields and value constraints.
 * 
 * @param params Policy creation parameters
 * @throws Error if parameters are invalid
 */
export function validatePolicyParameters(params: PolicyCreationParams): void {
  // Check required fields
  if (!params.owner) {
    throw new Error("Owner principal is required.");
  }
  
  if (params.protectedValueUSD <= 0) {
    throw new Error("Protected value must be greater than 0.");
  }
  
  if (params.protectionAmountBTC <= 0) {
    throw new Error("Protection amount must be greater than 0.");
  }
  
  if (params.durationDays <= 0) {
    throw new Error("Duration must be greater than 0 days.");
  }
  
  if (!Object.values(PolicyType).includes(params.policyType)) {
    throw new Error(`Invalid policy type: ${params.policyType}. Must be one of: ${Object.values(PolicyType).join(", ")}`);
  }

  // Add additional validation as needed
  // For example, check max values, validate format of owner/counterparty addresses, etc.
} 