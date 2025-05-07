import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Import necessary enums from policyRegistry but avoid circular imports
export enum TransactionStatus {
  PENDING = "Pending", // Initial state, transaction prepared but not submitted/confirmed
  SUBMITTED = "Submitted", // Transaction submitted to the blockchain
  CONFIRMED = "Confirmed", // Transaction confirmed on the blockchain
  FAILED = "Failed", // Transaction failed (e.g., rejected by blockchain)
  EXPIRED = "Expired", // Transaction too old, no longer valid
  REPLACED = "Replaced", // Transaction replaced by a newer one
}

export enum PolicyEventType {
  ERROR = "Error",
  STATUS_UPDATE = "StatusUpdate"
}

/**
 * Mock function to simulate getting a transaction status from the blockchain.
 * This is a placeholder until actual blockchain integration is implemented.
 * 
 * @param transactionId The ID of the transaction to check
 * @returns Object with transaction status information
 */
export const mockGetTransactionStatus = async (transactionId: string): Promise<{
  status: "success" | "pending" | "failed";
  blockHeight?: number;
  reason?: string;
}> => {
  console.log(`Checking status for transaction: ${transactionId}`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Generate a random number to simulate different transaction states
  // For testing purposes:
  // - 60% chance of success
  // - 30% chance of still pending
  // - 10% chance of failure
  const random = Math.random();
  
  if (random < 0.6) {
    // Mock success response
    return {
      status: "success",
      blockHeight: 800000 + Math.floor(Math.random() * 100) // Mock block height
    };
  } else if (random < 0.9) {
    // Mock pending response
    return {
      status: "pending"
    };
  } else {
    // Mock failure response
    return {
      status: "failed",
      reason: "Transaction rejected by network"
    };
  }
};

/**
 * Helper query to get pending transactions that need status checking.
 * Returns transactions with status "Pending" or "Submitted" that haven't been updated recently.
 */
export const getPendingTransactionsForStatusCheck = internalQuery({
  handler: async (ctx): Promise<Doc<"pendingPolicyTransactions">[]> => {
    // Get transactions with status Pending
    const pendingTxs = await ctx.db
      .query("pendingPolicyTransactions")
      .filter(q => q.eq(q.field("status"), TransactionStatus.PENDING))
      .collect();
    
    // Get transactions with status Submitted
    const submittedTxs = await ctx.db
      .query("pendingPolicyTransactions")
      .filter(q => q.eq(q.field("status"), TransactionStatus.SUBMITTED))
      .collect();
    
    // Combine both result sets
    return [...pendingTxs, ...submittedTxs];
  }
});

/**
 * Helper mutation to increment the retry count for a pending transaction.
 */
export const incrementTransactionRetryCount = internalMutation({
  args: {
    pendingTxId: v.id("pendingPolicyTransactions"),
  },
  handler: async (ctx, args): Promise<Doc<"pendingPolicyTransactions"> | null> => {
    const pendingTx = await ctx.db.get(args.pendingTxId);
    if (!pendingTx) {
      return null;
    }
    
    // Increment retry count and update lastAttemptedAt
    await ctx.db.patch(args.pendingTxId, {
      retryCount: (pendingTx.retryCount || 0) + 1,
      lastAttemptedAt: Date.now(),
    });
    
    return await ctx.db.get(args.pendingTxId);
  }
});

/**
 * Scheduled job to check the status of pending transactions.
 * Implements CV-PR-212 from the implementation roadmap.
 * 
 * This job:
 * 1. Queries pending transactions with non-terminal status
 * 2. Checks transaction status on the blockchain
 * 3. Updates transaction status via updateTransactionStatus mutation
 * 4. Implements a retry mechanism for failed blockchain queries
 * 
 * @returns Summary of processed transactions
 */
export const checkTransactionStatusJob = internalAction({
  handler: async (ctx): Promise<{
    processed: number;
    updated: number;
    retried: number;
    errors: number;
  }> => {
    console.log("Running scheduled job: checkTransactionStatusJob");
    
    // Track stats for reporting
    const stats = {
      processed: 0,
      updated: 0,
      retried: 0,
      errors: 0
    };
    
    try {
      // 1. Query pending transactions with non-terminal status (Pending, Submitted)
      const pendingTransactions = await ctx.runQuery(internal.transactionStatusJobs.getPendingTransactionsForStatusCheck, {});
      
      stats.processed = pendingTransactions.length;
      console.log(`Found ${pendingTransactions.length} transactions to check`);
      
      // 2. Process each transaction
      for (const pendingTx of pendingTransactions) {
        try {
          // Skip transactions without transaction ID (not yet submitted to blockchain)
          if (!pendingTx.transactionId) {
            console.log(`Skipping ${pendingTx._id}: No transaction ID`);
            continue;
          }
          
          // Check transaction status on blockchain
          const txStatus = await mockGetTransactionStatus(pendingTx.transactionId);
          console.log(`Transaction ${pendingTx.transactionId} status: ${txStatus.status}`);
          
          // Update transaction status based on blockchain status
          if (txStatus.status === "success") {
            // Transaction confirmed - update status
            await ctx.runMutation(internal.policyRegistry.updateTransactionStatus, {
              pendingTxId: pendingTx._id,
              status: TransactionStatus.CONFIRMED,
              data: { blockHeight: txStatus.blockHeight }
            });
            stats.updated++;
          } else if (txStatus.status === "failed") {
            // Transaction failed - update status with error
            await ctx.runMutation(internal.policyRegistry.updateTransactionStatus, {
              pendingTxId: pendingTx._id,
              status: TransactionStatus.FAILED,
              error: txStatus.reason || "Unknown error"
            });
            stats.updated++;
          } else if (txStatus.status === "pending") {
            // Transaction still pending - check if we need to retry
            const currentTime = Date.now();
            const submissionTime = pendingTx.updatedAt;
            const MAX_PENDING_TIME = 30 * 60 * 1000; // 30 minutes
            
            if (currentTime - submissionTime > MAX_PENDING_TIME) {
              // Transaction has been pending too long - increment retry count
              await ctx.runMutation(internal.transactionStatusJobs.incrementTransactionRetryCount, {
                pendingTxId: pendingTx._id,
              });
              stats.retried++;
            }
            // Otherwise, just wait for next check
          }
        } catch (error: any) {
          console.error(`Error processing transaction ${pendingTx._id}:`, error);
          stats.errors++;
        }
      }
      
      console.log(`Completed transaction status check: ${JSON.stringify(stats)}`);
      return stats;
      
    } catch (error: any) {
      console.error("Error in checkTransactionStatusJob:", error);
      stats.errors++;
      return stats;
    }
  }
});

/**
 * Mock function to get the latest blockchain height.
 * This is a placeholder until actual blockchain integration is implemented.
 * 
 * @returns Current blockchain height
 */
export const mockGetLatestBlockHeight = async (): Promise<number> => {
  // Simulate current block height
  // For a more realistic mock, this could interact with a simple counter or a test utility
  return Math.floor(Date.now() / 10000) + 700000; // Example: timestamp-based pseudo-height
};

/**
 * Helper query to find policies that have expired but are still marked as active.
 * Used by the checkExpiredPoliciesJob to identify policies that need to be expired.
 */
export const getExpiredActivePolicies = internalQuery({
  handler: async (ctx): Promise<Doc<"policies">[]> => {
    // Get current block height (using mock for now)
    const currentBlockHeight = await mockGetLatestBlockHeight();
    
    // Query for active policies that have passed their expiration height
    const expiredPolicies = await ctx.db
      .query("policies")
      .filter(q => 
        q.and(
          q.eq(q.field("status"), "Active"),
          q.lt(q.field("expirationHeight"), currentBlockHeight)
        )
      )
      .collect();
    
    return expiredPolicies;
  }
});

/**
 * Scheduled job to check for expired policies and mark them as expired.
 * Implements CV-PR-213 from the implementation roadmap.
 * 
 * This job:
 * 1. Queries active policies that have passed their expiration height
 * 2. Creates pending transactions for policy expiration
 * 3. Updates policy status to Expired
 * 
 * @returns Summary of processed policies
 */
export const checkExpiredPoliciesJob = internalAction({
  handler: async (ctx): Promise<{
    expiredPoliciesCount: number;
    pendingTransactionsCreated: number;
    errors: number;
  }> => {
    console.log("Running scheduled job: checkExpiredPoliciesJob");
    
    // Track stats for reporting
    const stats = {
      expiredPoliciesCount: 0,
      pendingTransactionsCreated: 0,
      errors: 0
    };
    
    try {
      // 1. Query active policies that have passed their expiration height
      const expiredPolicies = await ctx.runQuery(internal.transactionStatusJobs.getExpiredActivePolicies, {});
      
      stats.expiredPoliciesCount = expiredPolicies.length;
      console.log(`Found ${expiredPolicies.length} expired policies to process`);
      
      // 2. Process each expired policy
      for (const policy of expiredPolicies) {
        try {
          // Create a pending transaction for expiration
          // For on-chain integration, this would prepare a transaction to call the
          // policy registry contract's "expire-policy" function
          const pendingTxId = await ctx.runMutation(internal.policyRegistry.createPendingPolicyTransaction, {
            actionType: "Expire",
            status: TransactionStatus.PENDING,
            payload: {
              policyId: policy._id,
              onChainPolicyId: policy.onChainPolicyId,
              expirationHeight: policy.expirationHeight,
              params: {
                policyId: policy._id,
                // Add additional params needed for on-chain transaction
              }
            },
            userId: policy.owner,
          });
          
          // Update policy status to Expired
          await ctx.runMutation(internal.policyRegistry.updatePolicyStatus, {
            policyId: policy._id,
            newStatus: "Expired",
            reason: "Policy reached expiration height",
            data: {
              currentBlockHeight: await mockGetLatestBlockHeight(),
              pendingTxId: pendingTxId,
            }
          });
          
          // Create policy event for expiration
          await ctx.runMutation(internal.policyRegistry.createPolicyEvent, {
            policyConvexId: policy._id,
            eventType: "Expired",
            data: {
              pendingTxId: pendingTxId,
              expirationHeight: policy.expirationHeight,
              currentBlockHeight: await mockGetLatestBlockHeight(),
            }
          });
          
          stats.pendingTransactionsCreated++;
          
          // Check if premium distribution is needed for expired policy
          if (policy.premiumPaid && !policy.premiumDistributed) {
            console.log(`Policy ${policy._id} needs premium distribution after expiration. Initiating process.`);
            // Initiate the premium distribution process
            await ctx.runAction(internal.policyRegistry.initiatePremiumDistributionForExpiredPolicy, { 
              policyId: policy._id 
            });
          }
          
        } catch (error: any) {
          console.error(`Error processing expired policy ${policy._id}:`, error);
          stats.errors++;
        }
      }
      
      console.log(`Completed expired policies check: ${JSON.stringify(stats)}`);
      return stats;
      
    } catch (error: any) {
      console.error("Error in checkExpiredPoliciesJob:", error);
      stats.errors++;
      return stats;
    }
  }
}); 