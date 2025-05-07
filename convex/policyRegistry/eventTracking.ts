import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { PolicyEventType } from "./types";

/**
 * Creates a policy event record.
 */
export const createPolicyEvent = internalMutation({
  args: {
    policyConvexId: v.id("policies"),
    eventType: v.string(), // Consider v.union with PolicyEventType values if strictly typed args needed
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