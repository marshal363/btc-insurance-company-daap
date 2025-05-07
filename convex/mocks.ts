import { Id } from "./_generated/dataModel";

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

// Add other mock functions here as needed, for example:
// export async function mockAnotherService(...) 