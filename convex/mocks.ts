import { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Mock function to simulate notifying the Liquidity Pool service that a premium 
 * has been distributed for a specific policy.
 * 
 * In a real implementation, this might trigger an action in the Liquidity Pool service
 * to update its internal accounting or provider balances.
 *
 * Corresponds to CV-PR-225 (replaces CV-LP-219 dependency for now).
 */
export async function mockNotifyLiquidityPoolOfPremiumDistribution(params: {
  policyId: Id<"policies">;
  premiumAmount: number;
  distributedToCounterparty: string;
  tokenId: string; // Token in which premium was paid and distributed
  distributionTxId?: string; // Optional on-chain transaction ID of the distribution
}): Promise<void> {
  console.log(
    `[MOCK] Notifying Liquidity Pool: Premium for policy ${params.policyId} distributed.`
  );
  console.log(`[MOCK] Details: `,
    `Amount: ${params.premiumAmount} ${params.tokenId}, `,
    `Counterparty: ${params.distributedToCounterparty}, `,
    `TxID: ${params.distributionTxId || 'N/A'}`
  );
  // In a real scenario, this would call an action/mutation in the Liquidity Pool service:
  // await ctx.runAction(api.liquidityPool.handlePremiumDistributionNotification, params);
}

/**
 * Mocks the retrieval of a blockchain transaction status.
 * In a real implementation, this would involve calling a blockchain API.
 * 
 * Behavior:
 * - Returns "Confirmed" for txIds ending in "1" (approx 10% chance)
 * - Returns "Failed" for txIds ending in "2" (approx 10% chance)
 * - Returns "Pending" for all others (approx 80% chance)
 */
export const mockGetBlockchainTransactionStatus = query({
  args: { onChainTxId: v.string() },
  handler: async (ctx, { onChainTxId }): Promise<"Confirmed" | "Failed" | "Pending"> => {
    // Simulate some delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

    if (onChainTxId.endsWith("1")) {
      return "Confirmed";
    } else if (onChainTxId.endsWith("2")) {
      return "Failed";
    } else {
      return "Pending";
    }
  }
});

// Add other general-purpose mock functions here as needed.

// Add other mock functions here as needed, for example:
// export async function mockAnotherService(...) 

// Removed deliberate syntax error
// export const testProcessing = query({{ 