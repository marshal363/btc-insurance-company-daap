import { action, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { internal, api } from "../_generated/api";
import {
  PolicyCreationParams,
  PolicyType,
  PositionType,
  TokenType,
  TransactionStatus,
  PolicyEventType,
  PolicyStatus,
  CalculatePremiumForCreationParams
} from "./types";
import {
  validatePolicyParameters,
  mockCheckPoolLiquidity
} from "./eligibilityChecks";

// --- Helper Functions (originally in policyRegistry.ts) ---

/**
 * Converts duration in days to expiration block height.
 */
async function daysToBlockHeight(days: number): Promise<number> {
  // In a real scenario, this might call an internal query to get actual block height from a mock or real source
  // For now, replicating the simple mock logic directly here.
  const currentHeight = Math.floor(Date.now() / 10000) + 700000; // Simplified mock
  const blocksPerDay = 144; // Bitcoin blocks
  return currentHeight + Math.floor(days * blocksPerDay);
}

/**
 * Converts USD to satoshis using current price.
 */
function usdToSats(usdAmount: number): number {
  return Math.floor(usdAmount * 100000000 / 60000); // Assuming BTC price ~$60,000
}

/**
 * Converts BTC to satoshis.
 */
function btcToSats(btcAmount: number): number {
  return Math.floor(btcAmount * 100000000);
}

/**
 * Prepares a mock transaction for policy creation.
 */
async function preparePolicyCreationTransaction(params: any): Promise<any> {
  console.log("Preparing mock transaction for policy creation:", params);
  return {
    txOptions: {
      contractAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      contractName: "policy-registry",
      functionName: "create-policy-entry",
      functionArgs: [
        { type: "principal", value: params.owner },
        { type: "principal", value: params.counterparty },
        { type: "uint", value: params.protectedValue.toString() },
        { type: "uint", value: params.protectionAmount.toString() },
        { type: "uint", value: params.premium.toString() },
        { type: "uint", value: params.expirationHeight.toString() },
        { type: "string-ascii", value: params.policyType },
        { type: "string-ascii", value: params.positionType },
      ],
      postConditions: [],
      fee: "10000",
      nonce: 0,
    }
  };
}

// --- Policy Lifecycle Functions ---

/**
 * Determines the position type based on policy type and role.
 */
export function determinePolicyPositionType(policyType: PolicyType, isBuyer: boolean): PositionType {
  if (policyType === PolicyType.PUT) {
    return isBuyer ? PositionType.LONG_PUT : PositionType.SHORT_PUT;
  } else { // Assuming CALL
    return isBuyer ? PositionType.LONG_CALL : PositionType.SHORT_CALL;
  }
}

/**
 * Creates a policy event record.
 */
/*
export const createPolicyEvent = internalMutation({
  args: {
    policyConvexId: v.id("policies"),
    eventType: v.string(), // Consider using v.union with PolicyEventType values if strictly typed args are feasible
    data: v.optional(v.any()),
    timestamp: v.optional(v.number()),
    blockHeight: v.optional(v.number()),
    transactionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
*/

/**
 * Updates a policy's status.
 */
export const updatePolicyStatus = internalMutation({
  args: {
    policyId: v.id("policies"),
    newStatus: v.string(), // Consider using v.union with PolicyStatus values
    reason: v.optional(v.string()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const policy = await ctx.db.get(args.policyId);
    if (!policy) {
      throw new Error(`Policy not found with ID: ${args.policyId}`);
    }
    
    if (policy.status === args.newStatus) {
      console.log(`Policy ${args.policyId} already has status ${args.newStatus}. No update needed.`);
      return policy;
    }
    
    console.log(`Updating policy ${args.policyId} status from ${policy.status} to ${args.newStatus}`);
    
    await ctx.db.patch(args.policyId, {
      status: args.newStatus,
      updatedAt: Date.now(),
    });
    
    // Updated call path to eventTracking module
    await ctx.runMutation(internal.policyRegistry.eventTracking.createPolicyEvent, {
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
        
    return await ctx.db.get(args.policyId);
  },
});

/**
 * Request policy creation. Builds a transaction for the user to sign.
 * Modified to use blockchain integration for transaction building.
 */
export const requestPolicyCreation = action({
  args: {
    protectedValueUSD: v.number(),
    protectionAmountBTC: v.number(),
    policyType: v.string(), // Expecting PolicyType enum string
    durationDays: v.number(),
    premiumUSD: v.optional(v.number()),
    counterparty: v.optional(v.string()),
    collateralToken: v.optional(v.string()), // Expecting TokenType enum string
    settlementToken: v.optional(v.string()), // Expecting TokenType enum string
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx: ActionCtx, args): Promise<{ pendingTxId: Id<"pendingPolicyTransactions">; transaction: any; estimatedPremium: number; positionType: PositionType; }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const owner = identity.tokenIdentifier;

    const params: PolicyCreationParams = {
      owner,
      counterparty: args.counterparty || "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      protectedValueUSD: args.protectedValueUSD,
      protectionAmountBTC: args.protectionAmountBTC,
      policyType: args.policyType as PolicyType,
      durationDays: args.durationDays,
      premiumUSD: args.premiumUSD,
      collateralToken: args.collateralToken as TokenType | undefined,
      settlementToken: args.settlementToken as TokenType | undefined,
      displayName: args.displayName,
      description: args.description,
      tags: args.tags,
    };

    validatePolicyParameters(params);

    let premiumUSD = params.premiumUSD;
    if (!premiumUSD) {
      // Updated to call the internal query in premiumServices
      premiumUSD = await ctx.runQuery(internal.policyRegistry.premiumServices.calculatePremiumForPolicyCreation, {
        policyType: params.policyType,
        strikePriceUSD: params.protectedValueUSD,
        durationDays: params.durationDays,
        // Ensure the argument name matches the internalQuery's args definition ('protectionAmount')
        protectionAmount: params.protectionAmountBTC, 
      });
      params.premiumUSD = premiumUSD;
    }

    if (!params.collateralToken) {
      params.collateralToken = params.policyType === PolicyType.PUT ? TokenType.STX : TokenType.SBTC;
    }
    if (!params.settlementToken) {
      params.settlementToken = params.policyType === PolicyType.PUT ? TokenType.STX : TokenType.SBTC;
    }

    const positionType = determinePolicyPositionType(params.policyType, true);
    
    await mockCheckPoolLiquidity(ctx, {
      collateralToken: params.collateralToken || TokenType.STX, 
      collateralAmount: params.protectionAmountBTC,
    });

    const expirationHeight = await daysToBlockHeight(params.durationDays);

    // UPDATED: Use blockchain integration instead of mock transaction preparation
    // Get transaction from blockchain integration
    const blockchainTxResult = await ctx.runAction(internal.policyRegistry.blockchainIntegration.createPolicyCreationTransaction, {
      params: {
        ...params,
        positionType,
        expirationHeight,
        premiumUSD: premiumUSD!,
      }
    });

    // Use the transaction response from blockchain integration
    const policyCreationTx = blockchainTxResult.txResponse;

    const pendingTxId: Id<"pendingPolicyTransactions"> = await ctx.runMutation(internal.policyRegistry.transactionManager.createPendingPolicyTransaction, {
      actionType: "Create",
      status: TransactionStatus.PENDING,
      payload: {
        params: {
          ...params,
          positionType,
          expirationHeight,
          premiumUSD: premiumUSD, 
        },
        txOptions: policyCreationTx.success ? policyCreationTx.txOptions : undefined
      },
      error: policyCreationTx.success ? undefined : policyCreationTx.error
    });

    // If there was an error in building the transaction, still return but include the error
    if (!policyCreationTx.success) {
      console.error("Error building policy creation transaction:", policyCreationTx.error);
      throw new Error(`Failed to create policy transaction: ${policyCreationTx.error}`);
    }

    return {
      pendingTxId,
      transaction: policyCreationTx.txOptions,
      estimatedPremium: premiumUSD!,
      positionType,
    };
  },
}); 