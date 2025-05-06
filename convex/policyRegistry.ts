import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { calculateBlackScholesPremium } from "./premium";

// --- Enums (as defined in convex-policy-registry-architecture.md) ---
export enum PolicyStatus {
  PENDING = "Pending", // Policy created off-chain, awaiting on-chain confirmation or premium payment
  ACTIVE = "Active",
  EXERCISED = "Exercised",
  EXPIRED = "Expired",
  CANCELLED = "Cancelled",
}

export enum PolicyType {
  PUT = "PUT",
  CALL = "CALL",
}

export enum PositionType {
  LONG_PUT = "LONG_PUT",
  SHORT_PUT = "SHORT_PUT",
  LONG_CALL = "LONG_CALL",
  SHORT_CALL = "SHORT_CALL",
}

export enum TokenType {
  STX = "STX",
  SBTC = "sBTC", // Example SIP-010 token
  BTC = "BTC",   // Underlying asset
}

export enum PolicyEventType {
  CREATED = "Created", // Policy record created in Convex
  ONCHAIN_SUBMITTED = "OnChainSubmitted", // Submitted to on-chain contract
  ONCHAIN_CONFIRMED = "OnChainConfirmed", // Confirmed on-chain (e.g. policy-created event from contract)
  ACTIVATED = "Activated", // Policy exercised by owner
  EXPIRED = "Expired", // Policy reached expiration height
  CANCELLED = "Cancelled",
  PREMIUM_PAID = "PremiumPaid",
  PREMIUM_DISTRIBUTION_REQUESTED = "PremiumDistributionRequested",
  PREMIUM_DISTRIBUTED = "PremiumDistributed", // Premium given to counterparty/providers
  SETTLEMENT_REQUESTED = "SettlementRequested",
  SETTLEMENT_COMPLETED = "SettlementCompleted",
  STATUS_UPDATE = "StatusUpdate", // Generic status change
  ERROR = "Error", // An error occurred during processing
  RECONCILIATION_UPDATE = "ReconciliationUpdate", // Updated due to state reconciliation
}

// --- Queries --- 

/**
 * Get a specific policy by its Convex ID.
 * Corresponds to CV-PR-204 (partial).
 */
export const getPolicy = query({
  args: { policyId: v.id("policies") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.policyId);
  },
});

/**
 * Get policies for a specific user (owner).
 * Basic version with optional status filtering.
 * Corresponds to CV-PR-204 (partial).
 */
export const getPoliciesForUser = query({
  args: {
    owner: v.string(), // Stacks address of the policy owner
    statusFilter: v.optional(v.array(v.string())),
    // TODO: Add pagination args: limit: v.optional(v.number()), cursor: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    let policyQuery = ctx.db
      .query("policies")
      .withIndex("by_owner_and_status", (q) => q.eq("owner", args.owner));

    if (args.statusFilter && args.statusFilter.length > 0) {
      // If there's a status filter, we might need to fetch all by owner and then filter in memory
      // or create more specific compound indexes if performance is an issue for common filter combinations.
      // For now, a simple approach: fetch all by owner and filter. 
      // This is not ideal for performance with many policies.
      const policies = await policyQuery.collect();
      return policies.filter(policy => args.statusFilter!.includes(policy.status));
    } else {
      return await policyQuery.collect();
    }
    // Consider pagination in future enhancements for this query.
  },
});

/**
 * Get events for a specific policy by its Convex ID.
 * Corresponds to CV-PR-205.
 */
export const getPolicyEvents = query({
  args: { policyConvexId: v.id("policies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("policyEvents")
      .withIndex("by_policyConvexId_and_timestamp", (q) =>
        q.eq("policyConvexId", args.policyConvexId)
      )
      .order("desc") // Show newest events first
      .collect();
  },
});

// --- Premium Calculation Service (for Policy Registry) ---

/**
 * Interface for parameters needed to calculate premium for a new policy.
 * Derived from PolicyCreationParams in architecture and inputs to BlackScholes.
 */
interface CalculatePremiumForCreationParams {
  policyType: PolicyType; // "PUT" or "CALL"
  strikePriceUSD: number; // K (Protected Value in USD)
  durationDays: number; // T (Expiration in days)
  protectionAmount: number; // Multiplier for final premium (e.g., amount of BTC)
  // currentPriceUSD and volatility will be fetched internally
}

/**
 * Calculates the premium for a new policy at the time of creation.
 * This acts as the premium calculation service for the Policy Registry.
 * Corresponds to CV-PR-207.
 * 
 * @param ctx Convex query/mutation/action context.
 * @param params Parameters for premium calculation.
 * @returns The calculated premium amount (number).
 */
export async function calculatePremiumForPolicyCreation(
  ctx: any, // Should be QueryCtx, MutationCtx, or ActionCtx depending on where it's called
  params: CalculatePremiumForCreationParams
): Promise<number> {
  // 1. Get current market data (price, volatility)
  const marketData = await ctx.runQuery(internal.premium.getCurrentMarketData, { asset: "BTC" });
  if (!marketData) {
    throw new Error("Failed to fetch current market data for premium calculation.");
  }
  const currentPriceUSD = marketData.price;
  const volatility = marketData.volatility;

  // 2. Get active risk parameters
  // Assuming policyType in riskParameters matches PolicyType enum (e.g., "PUT", "CALL")
  const riskParams = await ctx.runQuery(internal.premium.getActiveRiskParameters, {
    assetType: "BTC", // Assuming BTC for now
    policyType: params.policyType,
  });
  // calculateBlackScholesPremium can handle null riskParams, but log if not found
  if (!riskParams) {
    console.warn(`Risk parameters not found for ${params.policyType}, BlackScholes will use defaults if applicable.`);
  }

  // 3. Calculate premium using Black-Scholes
  const premiumComponents = calculateBlackScholesPremium({
    currentPrice: currentPriceUSD,
    strikePrice: params.strikePriceUSD,
    volatility: volatility,
    duration: params.durationDays,
    amount: params.protectionAmount,
    // riskFreeRate can be defaulted in calculateBlackScholesPremium or fetched/configured
    riskParams: riskParams, // Pass fetched risk parameters (can be null)
  });

  return premiumComponents.premium;
}

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
async function mockGetLatestBlockHeight(): Promise<number> {
  // Simulate a steadily increasing block height
  // For a more realistic mock, this could interact with a simple counter or a test utility
  return Math.floor(Date.now() / 10000) + 700000; // Example: timestamp-based pseudo-height
}

/**
 * Mock function to get a simulated current BTC price in USD.
 */
async function mockGetCurrentBTCPrice(): Promise<number> {
  // Simulate some price fluctuation
  return 60000 + (Math.random() - 0.5) * 5000; // e.g., $57,500 to $62,500
}

// --- Eligibility Checks ---

interface PolicyActivationEligibilityResult {
  eligible: boolean;
  reason?: string;
  settlementAmount?: number; // In settlementToken units (e.g. STX or sBTC if policy settles in crypto)
  // Note: The architecture doc mentions settlementAmount in relation to PolicyActivationParams
  // and currentPrice. For PUT, it would be (Strike - Current) * ProtectionAmount. For CALL, (Current - Strike) * P.A.
  // This mock will need to calculate it based on the policy type.
}

/**
 * Checks if a policy is eligible for activation (exercise).
 * Corresponds to CV-PR-206.
 * Uses mocked Oracle and blockchain data.
 */
export const checkPolicyActivationEligibility = query({
  args: { policyId: v.id("policies") },
  handler: async (ctx, args): Promise<PolicyActivationEligibilityResult> => {
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
    // Settlement amount should be in the policy's settlementToken.
    // For this mock, let's assume settlementAmount is calculated in USD terms first if strike is USD.

    if (policy.policyType === PolicyType.PUT) {
      if (currentBTCPriceUSD < policy.protectedValue) {
        eligibleForExercise = true;
        // For a PUT: Settlement = (Strike Price - Current Price) * Protection Amount
        // This calculation needs to be in the context of the protected asset and settlement token.
        // If strike is USD, current price is USD, protection amount is in BTC, then settlement is more complex.
        // For simplicity, let's assume protectedValue = strike in USD, currentBTCPriceUSD is market price in USD.
        // If settlementToken is STX/sBTC, we'd need conversion. Architecture doc implies settlementAmount from eligibility.
        // Let's assume protectionAmount is a multiplier and settlement reflects profit in USD terms.
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

console.log("convex/policyRegistry.ts loaded: Defines Policy Registry enums and initial queries."); 