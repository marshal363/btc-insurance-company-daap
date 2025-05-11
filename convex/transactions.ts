import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

// Define TransactionStatus enum matching the schema and common types
// This could also be imported if it's strictly identical and stable in common/types.ts
export enum TransactionStatus {
  PENDING = "PENDING",
  SUBMITTED = "SUBMITTED",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
  REPLACED = "REPLACED",
  EXPIRED = "EXPIRED",
}

export enum TransactionType {
  POLICY_CREATION = "POLICY_CREATION",
  CAPITAL_COMMITMENT = "CAPITAL_COMMITMENT",
}

// Helper for valid status transitions (TS-102)
const validTransitions: Record<TransactionStatus, TransactionStatus[]> = {
  [TransactionStatus.PENDING]: [
    TransactionStatus.SUBMITTED,
    TransactionStatus.FAILED,
    TransactionStatus.EXPIRED,
  ],
  [TransactionStatus.SUBMITTED]: [
    TransactionStatus.CONFIRMED,
    TransactionStatus.FAILED,
    TransactionStatus.REPLACED,
  ],
  [TransactionStatus.CONFIRMED]: [], // Terminal state
  [TransactionStatus.FAILED]: [TransactionStatus.REPLACED], // e.g. retry with replacement
  [TransactionStatus.REPLACED]: [], // Terminal state for the replaced transaction
  [TransactionStatus.EXPIRED]: [], // Terminal state
};

/**
 * TS-102: Implement updateTransactionStatus mutation with status state machine
 * TS-104 (partial): Implement error handling and storage in transaction records
 */
export const updateTransactionStatus = mutation({
  args: {
    transactionId: v.id("transactions"),
    newStatus: v.string(), // Expects a value from TransactionStatus enum
    txHash: v.optional(v.string()),
    blockHeight: v.optional(v.number()),
    network: v.optional(v.string()),
    errorDetails: v.optional(v.object({
      message: v.string(),
      code: v.optional(v.string()),
      rawError: v.optional(v.string()),
      retryable: v.optional(v.boolean()),
    })),
    parameters: v.optional(v.object({})),
    actionName: v.optional(v.string()),
    relatedId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const transaction = await ctx.db.get(args.transactionId);

    if (!transaction) {
      throw new Error(`Transaction not found: ${args.transactionId}`);
    }

    const currentStatus = transaction.status as TransactionStatus;
    const newStatus = args.newStatus as TransactionStatus;

    if (!Object.values(TransactionStatus).includes(newStatus)) {
      throw new Error(`Invalid new status: ${newStatus}`);
    }

    if (currentStatus === newStatus) {
      // If status is the same, still update other fields if provided
      // but don't re-validate transition or change timestamp logic for status change itself.
      const updates: Partial<Doc<"transactions">> = { updatedAt: Date.now() };
      if (args.txHash !== undefined) updates.txHash = args.txHash;
      if (args.blockHeight !== undefined) updates.blockHeight = args.blockHeight;
      if (args.network !== undefined) updates.network = args.network;
      if (args.errorDetails !== undefined) updates.errorDetails = args.errorDetails;
      if (args.parameters !== undefined) updates.parameters = args.parameters;
      if (args.actionName !== undefined) updates.actionName = args.actionName;
      if (args.relatedId !== undefined) updates.relatedId = args.relatedId;
      
      await ctx.db.patch(args.transactionId, updates);
      return await ctx.db.get(args.transactionId);
    }

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }

    const updatePayload: Partial<Doc<"transactions">> = {
      status: newStatus,
      updatedAt: Date.now(),
    };

    if (args.txHash !== undefined) updatePayload.txHash = args.txHash;
    if (args.blockHeight !== undefined) updatePayload.blockHeight = args.blockHeight;
    if (args.network !== undefined) updatePayload.network = args.network;
    if (args.parameters !== undefined) updatePayload.parameters = args.parameters;
    if (args.actionName !== undefined) updatePayload.actionName = args.actionName;
    if (args.relatedId !== undefined) updatePayload.relatedId = args.relatedId;
    
    if (newStatus === TransactionStatus.SUBMITTED) {
      updatePayload.submittedAt = Date.now();
      // Clear previous errors if any when resubmitting or submitting
      updatePayload.errorDetails = undefined; 
    }

    if (newStatus === TransactionStatus.CONFIRMED || newStatus === TransactionStatus.FAILED) {
      updatePayload.confirmedOrFailedAt = Date.now();
    }

    if (args.errorDetails) {
      updatePayload.errorDetails = args.errorDetails;
    } else if (newStatus !== TransactionStatus.FAILED) {
      // Clear error details if not moving to FAILED state and no new error is provided
      updatePayload.errorDetails = undefined;
    }

    await ctx.db.patch(args.transactionId, updatePayload as any); // Use `as any` to handle null for errorDetails
    return await ctx.db.get(args.transactionId);
  },
});

/**
 * TS-103: Create getTransactionStatus query endpoint
 */
export const getTransactionStatus = query({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.transactionId);
  },
});

/**
 * TS-105: Create getTransactionsForUser query for transaction history
 */
export const getTransactionsForUser = query({
  args: {
    userId: v.string(),
    status: v.optional(v.string()), // Filter by TransactionStatus
    type: v.optional(v.string()),   // Filter by TransactionType
    limit: v.optional(v.number()),  // For pagination
  },
  handler: async (ctx, args) => {
    let txQuery;

    const isValidStatus = args.status && Object.values(TransactionStatus).includes(args.status as TransactionStatus);
    const isValidType = args.type && Object.values(TransactionType).includes(args.type as TransactionType);

    if (isValidType && isValidStatus) {
      // Use the new compound index when both type and status are provided and valid
      txQuery = ctx.db
        .query("transactions")
        .withIndex("by_userId_and_type_and_status", (q) =>
          q.eq("userId", args.userId)
           .eq("type", args.type as TransactionType)
           .eq("status", args.status as TransactionStatus)
        )
        .order("desc");
    } else if (isValidStatus) {
      // Use existing index if only status is provided and valid
      txQuery = ctx.db
        .query("transactions")
        .withIndex("by_userId_and_status", (q) =>
          q.eq("userId", args.userId).eq("status", args.status as TransactionStatus)
        )
        .order("desc");
    } else {
      // Fallback to querying by userId and then filtering type in memory if only type is provided or filters are invalid
      // This part maintains previous behavior for other cases.
      txQuery = ctx.db
        .query("transactions")
        .withIndex("by_userId_and_status", (q) => q.eq("userId", args.userId)) // Base query by user
        .order("desc");
    }

    if (args.status && !isValidStatus) {
      console.warn(`Invalid status filter provided: ${args.status}. It will be ignored.`);
    }
    if (args.type && !isValidType && !(isValidType && isValidStatus)) {
        // If type is provided but not valid, or not handled by a specific index path above, it will be filtered in memory.
        // (This warning is for cases where type might be ignored by indexing strategy if not combined with status)
        console.warn(`Type filter '${args.type}' will be applied in memory if not part of an index used.`);
    }

    const transactions = await txQuery.collect();
    
    let filteredTransactions = transactions;

    // In-memory filter for type if not handled by the index already (e.g., only type provided, or invalid type)
    if (isValidType && !isValidStatus) { // Only apply if type is valid and not already part of compound index query
        filteredTransactions = transactions.filter(tx => tx.type === args.type);
    }

    if (args.limit) {
      return filteredTransactions.slice(0, args.limit);
    }
    return filteredTransactions;
  },
});

/**
 * Helper to create a new transaction record. 
 * This is not explicitly in TS-101-106 but essential for using the system.
 */
export const createTransaction = mutation({
    args: {
        userId: v.string(),
        quoteId: v.id("quotes"), 
        type: v.string(), // Expects TransactionType
        parameters: v.optional(v.object({
            owner: v.optional(v.string()),
            counterparty: v.optional(v.string()),
            protectedValue: v.optional(v.number()),
            protectionAmount: v.optional(v.number()),
            expirationHeight: v.optional(v.number()),
            premium: v.optional(v.number()),
            policyType: v.optional(v.string()),
            collateralToken: v.optional(v.string()),
            positionType: v.optional(v.string()),
            settlementToken: v.optional(v.string()),
        })),
        network: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        if (!Object.values(TransactionType).includes(args.type as TransactionType)) {
            throw new Error(`Invalid transaction type: ${args.type}`);
        }

        const now = Date.now();
        const transactionId = await ctx.db.insert("transactions", {
            userId: args.userId,
            quoteId: args.quoteId,
            type: args.type as TransactionType,
            status: TransactionStatus.PENDING,
            parameters: args.parameters ?? {},
            network: args.network,
            createdAt: now,
            updatedAt: now,
            // txHash, blockHeight, submittedAt, confirmedOrFailedAt, errorDetails, actionName, relatedId are optional and will be set later
        });
        return transactionId;
    }
});

/**
 * BF-105: New query for polling transaction status by its Convex ID.
 * Returns the transaction document or null if not found.
 * The frontend will then map these fields to its TransactionUiStatus enum.
 */
export const pollTransactionStatus = query({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    const transaction = await ctx.db.get(args.transactionId);
    if (!transaction) {
      // Option 1: Return null, frontend useQuery will receive null.
      return null; 
      // Option 2: Throw an error if a transaction ID is provided but not found.
      // throw new Error(`Transaction not found for polling: ${args.transactionId}`);
    }
    // We return the relevant parts of the transaction document that the frontend needs.
    // The frontend's TransactionContext expects `status` and `errorDetails` (can be an object).
    return {
      status: transaction.status, // This is the backend status string (e.g., "PENDING", "CONFIRMED", "FAILED")
      errorDetails: transaction.errorDetails, // This is the error object/string stored in the DB
      // Include any other fields the frontend might need from the transaction document for display or logic
      type: transaction.type,
      blockchainTxId: transaction.txHash,
      // Note: The frontend `TransactionUiStatus` is a UI-specific enum.
      // The mapping from `transaction.status` (backend) to `TransactionUiStatus` (frontend) happens in TransactionContext.tsx.
    };
  },
}); 