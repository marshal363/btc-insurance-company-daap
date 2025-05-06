import { query, mutation, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { internal, api } from "./_generated/api";
import { calculateBlackScholesPremium } from "./premium";
import { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

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
    statusFilter: v.optional(v.array(v.string())), 
    policyTypeFilter: v.optional(v.string()), 
    fromTimestamp: v.optional(v.number()), 
    toTimestamp: v.optional(v.number()),   
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated to query their policies.");
    }
    const owner = identity.tokenIdentifier; 
    if (!owner) {
      throw new Error("Unable to determine user principal from identity.");
    }

    let queryBuilder = ctx.db
      .query("policies")
      .filter(q => q.eq(q.field("owner"), owner));

    if (args.statusFilter && args.statusFilter.length > 0) {
      queryBuilder = queryBuilder.filter(q => q.or(...args.statusFilter!.map((status: string) => q.eq(q.field("status"), status))));
    }

    if (args.policyTypeFilter) {
      queryBuilder = queryBuilder.filter(q => q.eq(q.field("policyType"), args.policyTypeFilter!));
    }

    if (args.fromTimestamp) {
      queryBuilder = queryBuilder.filter(q => q.gte(q.field("creationTimestamp"), args.fromTimestamp!));
    }

    if (args.toTimestamp) {
      queryBuilder = queryBuilder.filter(q => q.lte(q.field("creationTimestamp"), args.toTimestamp!));
    }

    // Collect all filtered policies first.
    // Note: For very large datasets, filtering without a specific index for all combined filter fields
    // and then sorting/paginating in JS can be inefficient. Consider optimizing indexes
    // or using cursor-based pagination if performance issues arise.
    const filteredPolicies = await queryBuilder.collect();

    // Sort in JavaScript by creationTimestamp descending for consistent pagination.
    const sortedPolicies = filteredPolicies.sort((a, b) => {
      // Ensure creationTimestamp exists and provide a default for comparison if necessary
      const tsA = typeof a.creationTimestamp === 'number' ? a.creationTimestamp : 0;
      const tsB = typeof b.creationTimestamp === 'number' ? b.creationTimestamp : 0;
      return tsB - tsA; // Descending order
    });

    const effectiveLimit = args.limit ?? 10; // Default limit
    const effectiveOffset = args.offset ?? 0;  // Default offset

    // Manual pagination slice.
    const paginatedPolicies = sortedPolicies.slice(effectiveOffset, effectiveOffset + effectiveLimit);

    return paginatedPolicies;
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
      // This assumes the index `by_policyConvexId_and_timestamp` is defined to allow sorting by timestamp descending
      // (e.g., if the index is on [policyConvexId ASC, timestamp DESC]).
      // .order("desc") will then use the timestamp part of the index for ordering.
      .order("desc") 
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
  ctx: QueryCtx | MutationCtx | ActionCtx, // Use specific context types
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

// --- Policy Actions ---

/**
 * Interface for policy creation parameters.
 * Based on the PolicyCreationParams from convex-policy-registry-architecture.md
 */
export interface PolicyCreationParams {
  owner: string; // Principal of policy owner (Stacks address)
  counterparty?: string; // Optional principal of counterparty (typically pool address if not specified)
  protectedValueUSD: number; // Protected value in USD (strike price)
  protectionAmountBTC: number; // Amount to protect in BTC
  policyType: PolicyType; // "PUT" or "CALL"
  durationDays: number; // Duration in days
  premiumUSD?: number; // Optional - if premium already calculated
  collateralToken?: TokenType; // Optional - token used for collateral, derived from policyType if not specified
  settlementToken?: TokenType; // Optional - token used for settlement if exercised, derived if not specified
  displayName?: string; // Optional - user-friendly name for the policy
  description?: string; // Optional - description of the policy
  tags?: string[]; // Optional - tags for categorization
}

/**
 * Converts duration in days to expiration block height.
 * Uses mock blockchain data for initial implementation.
 * 
 * @param days Number of days until expiration
 * @returns Future block height for policy expiration
 */
async function daysToBlockHeight(days: number): Promise<number> {
  // Get current block height (using mock for now)
  const currentHeight = await mockGetLatestBlockHeight();

  // Estimate blocks per day (144 for Bitcoin ~10 min blocks, ~1440 for Stacks ~1 min blocks)
  // For BitHedge, we'll typically use Bitcoin burn block height for time references
  const blocksPerDay = 144; // Bitcoin blocks

  // Calculate expiration height
  return currentHeight + Math.floor(days * blocksPerDay);
}

/**
 * Converts USD to satoshis using current price.
 * Simplified for initial implementation.
 * 
 * @param usdAmount USD amount to convert
 * @returns Equivalent amount in satoshis
 */
function usdToSats(usdAmount: number): number {
  // For simplicity, assume 1 BTC = 100,000,000 satoshis
  // In real implementation, this would use an oracle or price feed
  return Math.floor(usdAmount * 100000000 / 60000); // Assuming BTC price ~$60,000
}

/**
 * Converts BTC to satoshis.
 * 
 * @param btcAmount BTC amount to convert
 * @returns Equivalent amount in satoshis
 */
function btcToSats(btcAmount: number): number {
  return Math.floor(btcAmount * 100000000);
}

/**
 * Validates policy creation parameters for required fields and value constraints.
 * 
 * @param params Policy creation parameters
 * @throws Error if parameters are invalid
 */
function validatePolicyParameters(params: PolicyCreationParams): void {
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

/**
 * Prepares a mock transaction for policy creation.
 * This is a placeholder for real blockchain integration.
 * 
 * @param params Parameters for on-chain policy creation
 * @returns Prepared transaction object
 */
async function preparePolicyCreationTransaction(params: any): Promise<any> {
  // This is a mock implementation - in a real scenario, this would use
  // blockchain integration code similar to blockchainIntegration.ts or blockchainPreparation.ts
  
  console.log("Preparing mock transaction for policy creation:", params);
  
  // Mock transaction structure similar to blockchainPreparation.ts example
  return {
    txOptions: {
      contractAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      contractName: "policy-registry",
      functionName: "create-policy-entry",
      functionArgs: [
        { type: "principal", value: params.owner }, // owner
        { type: "principal", value: params.counterparty }, // counterparty
        { type: "uint", value: params.protectedValue.toString() }, // protectedValue
        { type: "uint", value: params.protectionAmount.toString() }, // protectionAmount
        { type: "uint", value: params.premium.toString() }, // premium
        { type: "uint", value: params.expirationHeight.toString() }, // expirationHeight
        { type: "string-ascii", value: params.policyType }, // policyType
        { type: "string-ascii", value: params.positionType }, // positionType
      ],
      postConditions: [
        // In a real implementation, add post conditions to ensure proper token transfers
        // Example: User must transfer exactly premiumAmount to contract
      ],
      fee: "10000", // Mock fee in microSTX
      nonce: 0, // Would be replaced with actual nonce during signing
    }
  };
}

/**
 * Internal mutation to create pending policy transaction record.
 */
export const createPendingPolicyTransaction = internalMutation({
  args: {
    actionType: v.string(),
    status: v.string(),
    payload: v.any(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("pendingPolicyTransactions", {
      actionType: args.actionType,
      status: args.status,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      payload: args.payload,
      retryCount: 0,
      userId: args.userId,
    });
  },
});

/**
 * Enum defining the possible statuses for a pending transaction.
 */
export enum TransactionStatus {
  PENDING = "Pending", // Initial state, transaction prepared but not submitted/confirmed
  SUBMITTED = "Submitted", // Transaction submitted to the blockchain
  CONFIRMED = "Confirmed", // Transaction confirmed on the blockchain
  FAILED = "Failed", // Transaction failed (e.g., rejected by blockchain)
  EXPIRED = "Expired", // Transaction too old, no longer valid
  REPLACED = "Replaced", // Transaction replaced by a newer one
}

/**
 * Creates a policy event record.
 */
export const createPolicyEvent = internalMutation({
  args: {
    policyConvexId: v.id("policies"),
    eventType: v.string(),
    data: v.optional(v.any()),
    timestamp: v.optional(v.number()),
    blockHeight: v.optional(v.number()),
    transactionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Create policy event
    return await ctx.db.insert("policyEvents", {
      policyConvexId: args.policyConvexId,
      eventType: args.eventType,
      data: args.data || {},
      timestamp: args.timestamp || Date.now(),
      blockHeight: args.blockHeight,
      transactionId: args.transactionId,
    });
  },
});

/**
 * Updates a policy's status.
 */
export const updatePolicyStatus = internalMutation({
  args: {
    policyId: v.id("policies"),
    newStatus: v.string(),
    reason: v.optional(v.string()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Get the current policy first
    const policy = await ctx.db.get(args.policyId);
    if (!policy) {
      throw new Error(`Policy not found with ID: ${args.policyId}`);
    }
    
    // Only update if the status is actually changing
    if (policy.status === args.newStatus) {
      console.log(`Policy ${args.policyId} already has status ${args.newStatus}. No update needed.`);
      return policy;
    }
    
    console.log(`Updating policy ${args.policyId} status from ${policy.status} to ${args.newStatus}`);
    
    // Update the policy status
    await ctx.db.patch(args.policyId, {
      status: args.newStatus,
      updatedAt: Date.now(),
    });
    
    // Create a status update event
    await ctx.db.insert("policyEvents", {
      policyConvexId: args.policyId,
      eventType: PolicyEventType.STATUS_UPDATE,
      data: {
        previousStatus: policy.status,
        newStatus: args.newStatus,
        reason: args.reason || "Status updated via updatePolicyStatus",
        additionalData: args.data || {},
      },
      timestamp: Date.now(),
    });
    
    // Return the updated policy
    return await ctx.db.get(args.policyId);
  },
});

/**
 * Updates the status of a pending policy transaction.
 * Implements CV-PR-211 from the implementation roadmap.
 * 
 * This mutation:
 * 1. Updates the status of a pending transaction
 * 2. Performs necessary follow-up actions based on the new status
 * 3. Creates appropriate policy events
 * 
 * @param args Parameters for updating transaction status
 * @returns The updated pending transaction record
 */
export const updateTransactionStatus = mutation({
  args: {
    pendingTxId: v.id("pendingPolicyTransactions"),
    transactionId: v.optional(v.string()), // On-chain TX ID, if available
    status: v.string(), // New status (use TransactionStatus enum values)
    error: v.optional(v.string()), // Error message if status is FAILED
    data: v.optional(v.any()), // Additional data (e.g., transaction receipt details)
  },
  handler: async (ctx, args): Promise<any> => {
    console.log(`Updating transaction status for ${args.pendingTxId} to ${args.status}`);
    
    // 1. Get the pending transaction
    const pendingTx = await ctx.db.get(args.pendingTxId);
    if (!pendingTx) {
      throw new Error(`Pending transaction not found with ID: ${args.pendingTxId}`);
    }
    
    // 2. Validate status transition
    // This is a simplified validation - in production you might want more complex state transition rules
    const currentStatus = pendingTx.status;
    const newStatus = args.status;
    
    const validTransitions = {
      [TransactionStatus.PENDING]: [TransactionStatus.SUBMITTED, TransactionStatus.FAILED, TransactionStatus.EXPIRED, TransactionStatus.REPLACED],
      [TransactionStatus.SUBMITTED]: [TransactionStatus.CONFIRMED, TransactionStatus.FAILED, TransactionStatus.REPLACED],
      [TransactionStatus.CONFIRMED]: [], // Terminal state, no transitions
      [TransactionStatus.FAILED]: [TransactionStatus.REPLACED], // Can only be replaced
      [TransactionStatus.EXPIRED]: [TransactionStatus.REPLACED], // Can only be replaced
      [TransactionStatus.REPLACED]: [], // Terminal state, no transitions
    };
    
    // Check if the transition is valid
    if (currentStatus === newStatus) {
      console.log(`Transaction ${args.pendingTxId} already has status ${newStatus}. No update needed.`);
      return pendingTx;
    }
    
    // @ts-ignore - TypeScript doesn't know the structure of validTransitions
    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
    
    // 3. Update the pending transaction
    const updateData: any = {
      status: newStatus,
      updatedAt: Date.now(),
    };
    
    if (args.transactionId) {
      updateData.transactionId = args.transactionId;
    }
    
    if (args.error) {
      updateData.error = args.error;
    }
    
    if (args.data) {
      updateData.resultData = args.data;
    }
    
    await ctx.db.patch(args.pendingTxId, updateData);
    
    // 4. Perform actions based on the transaction type and new status
    if (newStatus === TransactionStatus.CONFIRMED) {
      if (pendingTx.actionType === "Create") {
        await handleConfirmedPolicyCreation(ctx, pendingTx, args);
      } else if (pendingTx.actionType === "Activate") {
        await handleConfirmedPolicyActivation(ctx, pendingTx, args);
      }
      // Add other action types as needed (e.g., Cancel, Expire)
    } else if (newStatus === TransactionStatus.FAILED) {
      // Handle failed transactions (e.g., log, notify, etc.)
      console.error(`Transaction ${args.pendingTxId} failed: ${args.error || "No error details provided"}`);
      
      // Optionally create policy event for failure
      if (pendingTx.payload?.policyId) {
        await ctx.db.insert("policyEvents", {
          policyConvexId: pendingTx.payload.policyId,
          eventType: PolicyEventType.ERROR,
          data: {
            error: args.error || "Transaction failed",
            transactionId: args.transactionId,
            pendingTxId: args.pendingTxId,
          },
          timestamp: Date.now(),
        });
      }
    }
    
    // 5. Return the updated pending transaction
    return await ctx.db.get(args.pendingTxId);
  },
});

/**
 * Handles follow-up actions when a policy creation transaction is confirmed.
 * 
 * @param ctx Mutation context
 * @param pendingTx The pending transaction that was confirmed
 * @param args Arguments from updateTransactionStatus
 */
async function handleConfirmedPolicyCreation(ctx: MutationCtx, pendingTx: Doc<"pendingPolicyTransactions">, args: any): Promise<void> {
  console.log(`Handling confirmed policy creation for ${pendingTx._id}`);
  
  // Get the policy creation parameters from the pending transaction
  const params = pendingTx.payload.params;
  let policyIdToUseForEvents: Id<"policies"> | null = pendingTx.policyConvexId || null;
  
  try {
    // Create the policy record
    const newlyCreatedPolicyId = await ctx.db.insert("policies", {
      owner: params.owner,
      counterparty: params.counterparty,
      protectedValue: params.protectedValueUSD,
      protectionAmount: params.protectionAmountBTC,
      premium: params.premiumUSD,
      creationTimestamp: Date.now(),
      expirationHeight: params.expirationHeight,
      status: PolicyStatus.ACTIVE,
      policyType: params.policyType,
      positionType: params.positionType,
      onChainPolicyId: args.data?.onChainPolicyId || "mock-policy-id-" + Math.floor(Math.random() * 1000000),
      collateralToken: params.collateralToken,
      settlementToken: params.settlementToken,
      displayName: params.displayName || `${params.policyType} Option - ${params.protectedValueUSD} USD`,
      description: params.description,
      tags: params.tags,
      updatedAt: Date.now(), 
    });
    
    policyIdToUseForEvents = newlyCreatedPolicyId; // Policy successfully created, use its ID for events
    console.log(`Created policy with ID: ${newlyCreatedPolicyId}`);
    
    // Create policy events for successful creation
    await ctx.db.insert("policyEvents", {
      policyConvexId: newlyCreatedPolicyId,
      eventType: PolicyEventType.CREATED,
      data: {
        pendingTxId: pendingTx._id,
        transactionId: args.transactionId,
        params: params,
      },
      timestamp: Date.now(),
      transactionId: args.transactionId,
    });
    
    await ctx.db.insert("policyEvents", {
      policyConvexId: newlyCreatedPolicyId,
      eventType: PolicyEventType.ONCHAIN_CONFIRMED,
      data: {
        pendingTxId: pendingTx._id,
        transactionId: args.transactionId,
        blockHeight: args.data?.blockHeight,
      },
      timestamp: Date.now(),
      transactionId: args.transactionId,
      blockHeight: args.data?.blockHeight,
    });
    
    // Update the pending transaction with the policy ID
    await ctx.db.patch(pendingTx._id, {
      policyConvexId: newlyCreatedPolicyId, 
    });
    
  } catch (error: any) {
    console.error(`Error handling confirmed policy creation:`, error);
    // Create error event only if we have a policy ID to associate it with
    if (policyIdToUseForEvents) {
      // At this point, policyIdToUseForEvents is guaranteed to be Id<"policies">, not null.
      const finalPolicyIdForErrorEvent: Id<"policies"> = policyIdToUseForEvents;
      await ctx.db.insert("policyEvents", {
        policyConvexId: finalPolicyIdForErrorEvent,
        eventType: PolicyEventType.ERROR,
        data: {
          error: `Error handling confirmed policy creation: ${error.message}`,
          pendingTxId: pendingTx._id,
          transactionId: args.transactionId,
        },
        timestamp: Date.now(),
      });
    } else {
      console.error(`Could not record ERROR policyEvent for policy creation failure as policyConvexId is unavailable. PendingTxID: ${pendingTx._id}`);
    }
  }
}

/**
 * Handles follow-up actions when a policy activation transaction is confirmed.
 * 
 * @param ctx Mutation context
 * @param pendingTx The pending transaction that was confirmed
 * @param args Arguments from updateTransactionStatus
 */
async function handleConfirmedPolicyActivation(ctx: MutationCtx, pendingTx: Doc<"pendingPolicyTransactions">, args: any): Promise<void> {
  console.log(`Handling confirmed policy activation for ${pendingTx._id}`);
  
  try {
    // Get the policy ID from the pending transaction
    const policyId = pendingTx.payload.policyId; // This assumes payload.policyId exists
    
    if (!policyId) {
      // Try to get it from the top-level field if payload doesn't have it
      const topLevelPolicyId = pendingTx.policyConvexId;
      if (!topLevelPolicyId) {
        throw new Error("Policy ID not found in pending transaction payload or top-level field.");
      }
      // If found at top-level, use it. This part of the logic might need review
      // based on how policyId is actually stored in pendingTx.payload for "Activate" types.
      // For now, we assume it *should* be in pendingTx.payload.policyId for activation.
      throw new Error("Policy ID found at top-level, but expected in payload for activation.");
    }
    
    // Get the current policy
    const policy = await ctx.db.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found with ID: ${policyId}`);
    }
    
    // Update the policy status to EXERCISED
    await ctx.db.patch(policyId, {
      status: PolicyStatus.EXERCISED,
      updatedAt: Date.now(),
      exercisedAt: Date.now(),
      settlementAmount: pendingTx.payload.settlementAmount,
      settlementPrice: pendingTx.payload.currentPrice,
    });
    
    // Create policy events
    await ctx.db.insert("policyEvents", {
      policyConvexId: policyId,
      eventType: PolicyEventType.ACTIVATED,
      data: {
        pendingTxId: pendingTx._id,
        transactionId: args.transactionId,
        settlementAmount: pendingTx.payload.settlementAmount,
        currentPrice: pendingTx.payload.currentPrice,
      },
      timestamp: Date.now(),
      transactionId: args.transactionId,
    });
    
    // Add SETTLEMENT_REQUESTED event
    await ctx.db.insert("policyEvents", {
      policyConvexId: policyId,
      eventType: PolicyEventType.SETTLEMENT_REQUESTED,
      data: {
        pendingTxId: pendingTx._id,
        transactionId: args.transactionId,
        settlementAmount: pendingTx.payload.settlementAmount,
      },
      timestamp: Date.now(),
      transactionId: args.transactionId,
    });
    
    // In a real implementation, you might trigger additional processes here
    // For example, notifying the counterparty, starting settlement processes, etc.
    
  } catch (error: any) {
    console.error(`Error handling confirmed policy activation:`, error);
    // Create error event
    if (pendingTx.payload?.policyId) {
      await ctx.db.insert("policyEvents", {
        policyConvexId: pendingTx.payload.policyId,
        eventType: PolicyEventType.ERROR,
        data: {
          error: `Error handling confirmed policy activation: ${error.message}`,
          pendingTxId: pendingTx._id,
          transactionId: args.transactionId,
        },
        timestamp: Date.now(),
      });
    }
  }
}

console.log("convex/policyRegistry.ts loaded: Defines Policy Registry enums and initial queries."); 