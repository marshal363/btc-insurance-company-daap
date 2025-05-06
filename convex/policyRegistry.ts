import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

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

// Placeholder for future actions and mutations that will be added in subsequent tasks
// export const requestPolicyCreation = action ({ args: { /* ... */ }, handler: async (ctx, args) => { /* ... */ } });
// export const updateTransactionStatus = mutation ({ args: { /* ... */ }, handler: async (ctx, args) => { /* ... */ } });

console.log("convex/policyRegistry.ts loaded: Defines Policy Registry enums and initial queries."); 