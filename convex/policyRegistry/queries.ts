import { query } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel"; // Adjusted path for Id, Doc
import { PolicyStatus, PolicyType, PositionType, TokenType } from "./types"; // Assuming types.ts is in the same directory

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
    positionTypeFilter: v.optional(v.string()),
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

    if (args.positionTypeFilter) {
      queryBuilder = queryBuilder.filter(q => q.eq(q.field("positionType"), args.positionTypeFilter!));
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
 * Get policies for a specific counterparty (e.g., liquidity provider).
 * Corresponds to CV-PR-217.
 */
export const getPoliciesForCounterparty = query({
  args: {
    statusFilter: v.optional(v.array(v.string())),
    policyTypeFilter: v.optional(v.string()),
    positionTypeFilter: v.optional(v.string()),
    collateralTokenFilter: v.optional(v.string()),
    fromTimestamp: v.optional(v.number()),
    toTimestamp: v.optional(v.number()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated to query their policies as counterparty.");
    }
    const counterparty = identity.tokenIdentifier;
    if (!counterparty) {
      throw new Error("Unable to determine user principal from identity.");
    }

    let queryBuilder = ctx.db
      .query("policies")
      .filter(q => q.eq(q.field("counterparty"), counterparty));

    if (args.statusFilter && args.statusFilter.length > 0) {
      queryBuilder = queryBuilder.filter(q => q.or(...args.statusFilter!.map((status: string) => q.eq(q.field("status"), status))));
    }

    if (args.policyTypeFilter) {
      queryBuilder = queryBuilder.filter(q => q.eq(q.field("policyType"), args.policyTypeFilter!));
    }

    if (args.positionTypeFilter) {
      queryBuilder = queryBuilder.filter(q => q.eq(q.field("positionType"), args.positionTypeFilter!));
    }

    if (args.collateralTokenFilter) {
      queryBuilder = queryBuilder.filter(q => q.eq(q.field("collateralToken"), args.collateralTokenFilter!));
    }

    if (args.fromTimestamp) {
      queryBuilder = queryBuilder.filter(q => q.gte(q.field("creationTimestamp"), args.fromTimestamp!));
    }

    if (args.toTimestamp) {
      queryBuilder = queryBuilder.filter(q => q.lte(q.field("creationTimestamp"), args.toTimestamp!));
    }

    // Collect and sort filtered policies
    const filteredPolicies = await queryBuilder.collect();
    const sortedPolicies = filteredPolicies.sort((a, b) => b.creationTimestamp - a.creationTimestamp);

    // Handle pagination
    const limit = args.limit || 20;
    const offset = args.offset || 0;
    const paginatedPolicies = sortedPolicies.slice(offset, offset + limit);

    return {
      policies: paginatedPolicies,
      total: filteredPolicies.length,
    };
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