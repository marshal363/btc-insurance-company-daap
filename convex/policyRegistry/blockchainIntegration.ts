import { action, internalAction, internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { ActionCtx, MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";

// Import blockchain integration layer functions
import { 
  getPolicyById, 
  checkPolicyExercisability,
  getPolicyStatus
} from "../blockchain/policyRegistry/reader";

import { 
  buildPolicyCreationTransaction,
  buildUpdatePolicyStatusTransaction,
  buildExpirePoliciesBatchTransaction,
  buildPremiumDistributionTransaction
} from "../blockchain/policyRegistry/writer";

import {
  subscribeToPolicyCreatedEvents,
  subscribeToPolicyStatusUpdatedEvents,
  subscribeToPremiumDistributionEvents,
  fetchPolicyCreatedEvents,
  fetchPolicyStatusUpdatedEvents,
  fetchPremiumDistributionEvents
} from "../blockchain/policyRegistry/events";

// Import types
import {
  PolicyCreationParams,
  PolicyStatus,
  PolicyType,
  PositionType,
  NetworkEnvironment
} from "../blockchain/policyRegistry/types";

// Import our service layer types to ensure compatibility
import {
  PolicyCreationParams as ConvexPolicyCreationParams
} from "./types";

/**
 * Converts Convex policy creation parameters to blockchain-compatible parameters
 */
function convertToBlockchainPolicyParams(
  convexParams: ConvexPolicyCreationParams,
  positionType: PositionType,
  expirationHeight: number
): PolicyCreationParams {
  return {
    policyType: convexParams.policyType,
    positionType: positionType,
    owner: convexParams.owner,
    counterparty: convexParams.counterparty || undefined,
    strikePrice: convexParams.protectedValueUSD,
    amount: convexParams.protectionAmountBTC,
    premium: convexParams.premiumUSD || 0,
    expirationHeight: expirationHeight,
    collateralToken: convexParams.collateralToken || "STX",
    settlementToken: convexParams.settlementToken || "STX",
    network: "devnet" as NetworkEnvironment // Cast to NetworkEnvironment
  };
}

/**
 * Creates a policy creation transaction for the blockchain
 * This function bridges between our Convex service and blockchain integration layer
 */
export const createPolicyCreationTransaction = internalAction({
  args: {
    params: v.object({
      owner: v.string(),
      counterparty: v.optional(v.string()),
      protectedValueUSD: v.number(),
      protectionAmountBTC: v.number(),
      policyType: v.string(),
      positionType: v.string(),
      durationDays: v.number(),
      premiumUSD: v.number(),
      collateralToken: v.optional(v.string()),
      settlementToken: v.optional(v.string()),
      expirationHeight: v.number()
    })
  },
  handler: async (ctx, args) => {
    // Convert parameters
    const blockchainParams = convertToBlockchainPolicyParams(
      args.params as unknown as ConvexPolicyCreationParams,
      args.params.positionType as PositionType,
      args.params.expirationHeight
    );

    // Build the transaction
    const txResponse = await buildPolicyCreationTransaction({
      ...blockchainParams,
      // No senderKey here - that will be provided by the frontend
    });

    // Return the transaction details
    return {
      txResponse,
      params: blockchainParams
    };
  }
});

/**
 * Creates a policy status update transaction for the blockchain
 */
export const createPolicyStatusUpdateTransaction = internalAction({
  args: {
    policyId: v.string(),
    newStatus: v.string(),
    settlementAmount: v.optional(v.number()),
    settlementPrice: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    // Build the transaction
    const txResponse = await buildUpdatePolicyStatusTransaction({
      policyId: args.policyId,
      newStatus: args.newStatus as PolicyStatus,
      settlementAmount: args.settlementAmount,
      settlementPrice: args.settlementPrice,
      network: "devnet" as NetworkEnvironment // Cast to NetworkEnvironment
    });

    // Return the transaction details
    return {
      txResponse,
      policyId: args.policyId,
      newStatus: args.newStatus
    };
  }
});

/**
 * Creates a batch expiration transaction for the blockchain
 */
export const createExpirePoliciesBatchTransaction = internalAction({
  args: {
    policyIds: v.array(v.string()),
    currentBlockHeight: v.number()
  },
  handler: async (ctx, args) => {
    // Build the transaction
    const txResponse = await buildExpirePoliciesBatchTransaction({
      policyIds: args.policyIds,
      currentBlockHeight: args.currentBlockHeight,
      network: "devnet" as NetworkEnvironment // Cast to NetworkEnvironment
    });

    // Return the transaction details
    return {
      txResponse,
      policyIds: args.policyIds
    };
  }
});

/**
 * Creates a premium distribution transaction for the blockchain
 */
export const createPremiumDistributionTransaction = internalAction({
  args: {
    policyId: v.string(),
    amount: v.number(),
    token: v.string(),
    recipient: v.string()
  },
  handler: async (ctx, args) => {
    // Build the transaction
    const txResponse = await buildPremiumDistributionTransaction({
      policyId: args.policyId,
      amount: args.amount,
      token: args.token,
      recipient: args.recipient,
      network: "devnet" as NetworkEnvironment // Cast to NetworkEnvironment
    });

    // Return the transaction details
    return {
      txResponse,
      policyId: args.policyId,
      amount: args.amount
    };
  }
});

/**
 * Checks if a policy exists on the blockchain
 */
export const verifyPolicyOnChain = internalAction({
  args: {
    policyId: v.string()
  },
  handler: async (ctx, args) => {
    // Query the blockchain
    const policyResponse = await getPolicyById(args.policyId);
    
    return {
      exists: policyResponse.success,
      policy: policyResponse.success ? policyResponse.data : null
    };
  }
});

/**
 * Setup event listeners for policy events
 * This would typically be done on service initialization
 */
export const setupPolicyEventListeners = action({
  args: {},
  handler: async (ctx) => {
    // This is just a placeholder for how this would work
    // In a real implementation, we would likely use a different pattern
    // since subscriptions need to persist beyond the action's execution
    
    console.log("Setting up policy event listeners...");
    
    // Example of how we would handle events:
    const policyCreatedSubscription = subscribeToPolicyCreatedEvents(
      async (event) => {
        // Process the event
        console.log("Policy created event:", event);
        
        // Create a policy record in our database
        await ctx.runMutation(internal.policyRegistry.transactionManager.handlePolicyCreatedEvent, {
          policyId: event.policyId,
          owner: event.owner,
          counterparty: event.counterparty,
          // ... other event data
        });
      }
    );
    
    // Similarly for other event types...
    
    return {
      message: "Event listeners set up successfully"
    };
  }
});

/**
 * Fetch and process historical events for a policy
 */
export const fetchPolicyEvents = internalAction({
  args: {
    policyId: v.string(),
    fromBlock: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    // Fetch events from the blockchain
    const createdEvents = await fetchPolicyCreatedEvents({
      fromBlock: args.fromBlock,
      // Remove the policyId parameter as it's not in the expected type
    });
    
    const statusEvents = await fetchPolicyStatusUpdatedEvents({
      fromBlock: args.fromBlock,
      // Similarly, remove policyId or update the type definition
    });
    
    const premiumEvents = await fetchPremiumDistributionEvents({
      fromBlock: args.fromBlock,
      // Similarly, remove policyId or update the type definition
    });
    
    // Filter events for the specific policy ID after fetching
    const filteredCreatedEvents = createdEvents.filter(
      e => e.policyId === args.policyId
    );
    
    const filteredStatusEvents = statusEvents.filter(
      e => e.policyId === args.policyId
    );
    
    const filteredPremiumEvents = premiumEvents.filter(
      e => e.policyId === args.policyId
    );
    
    // Combine and sort all events by block height
    const allEvents = [
      ...filteredCreatedEvents.map(e => ({ ...e, eventType: 'created' })),
      ...filteredStatusEvents.map(e => ({ ...e, eventType: 'status' })),
      ...filteredPremiumEvents.map(e => ({ ...e, eventType: 'premium' }))
    ].sort((a, b) => (a.blockHeight || 0) - (b.blockHeight || 0));
    
    return {
      events: allEvents
    };
  }
}); 