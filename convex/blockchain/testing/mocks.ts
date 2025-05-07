/**
 * Blockchain Integration Mocks
 * 
 * This file contains shared mock functions for testing blockchain interactions.
 * It consolidates and standardizes mocks across the application.
 */

import { NetworkEnvironment } from "../common/types";

/**
 * Mock network configurations for different environments
 */
export const mockNetworkConfigs = {
  [NetworkEnvironment.MAINNET]: {
    url: "https://stacks-node-api.mainnet.stacks.co",
    chainId: 1,
  },
  [NetworkEnvironment.TESTNET]: {
    url: "https://stacks-node-api.testnet.stacks.co",
    chainId: 2147483648,
  },
  [NetworkEnvironment.DEVNET]: {
    url: "http://localhost:3999",
    chainId: 2147483649,
  },
};

/**
 * Mock contract addresses for different environments
 */
export const mockContractAddresses = {
  oracle: {
    [NetworkEnvironment.MAINNET]: "SP000000000000000000002Q6VF78.btc-oracle",
    [NetworkEnvironment.TESTNET]: "ST000000000000000000002AMW42H.btc-oracle",
    [NetworkEnvironment.DEVNET]: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.btc-oracle",
  },
  policyRegistry: {
    [NetworkEnvironment.MAINNET]: "SP000000000000000000002Q6VF78.policy-registry",
    [NetworkEnvironment.TESTNET]: "ST000000000000000000002AMW42H.policy-registry",
    [NetworkEnvironment.DEVNET]: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.policy-registry",
  },
  liquidityPool: {
    [NetworkEnvironment.MAINNET]: "SP000000000000000000002Q6VF78.liquidity-pool-vault",
    [NetworkEnvironment.TESTNET]: "ST000000000000000000002AMW42H.liquidity-pool-vault",
    [NetworkEnvironment.DEVNET]: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.liquidity-pool-vault",
  },
};

/**
 * Mock function to simulate getting a transaction status from the blockchain.
 * This is a placeholder until actual blockchain integration is implemented.
 * 
 * @param transactionId The ID of the transaction to check
 * @returns Object with transaction status information
 */
export async function mockGetTransactionStatus(transactionId: string): Promise<{
  status: "success" | "pending" | "failed";
  blockHeight?: number;
  reason?: string;
}> {
  console.log(`[MOCK] Checking status for transaction: ${transactionId}`);
  
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
}

/**
 * Direct function to get blockchain transaction status
 * This is a workaround for TypeScript's "Type instantiation is excessively deep and possibly infinite" error
 */
export function getBlockchainStatus(onChainTxId: string): "Confirmed" | "Failed" | "Pending" {
  if (onChainTxId.endsWith("1")) {
    return "Confirmed";
  } else if (onChainTxId.endsWith("2")) {
    return "Failed";
  } else {
    return "Pending";
  }
}

/**
 * Mock function to get the latest blockchain height.
 * @returns Current blockchain height
 */
export async function mockGetLatestBlockHeight(): Promise<number> {
  // Simulate current block height
  return Math.floor(Date.now() / 10000) + 700000; // Example: timestamp-based pseudo-height
}

/**
 * Mock function to simulate getting the current BTC price
 * @returns Current BTC price in USD
 */
export async function mockGetCurrentBTCPrice(): Promise<number> {
  // Simulate a realistic BTC price (around $50,000) with some random variation
  return 50000 + (Math.random() * 5000 - 2500);
}

/**
 * Mock function to check if the pool has sufficient liquidity
 * @param amount Amount of required liquidity
 * @param token Token type (e.g., "STX", "sBTC")
 * @returns Boolean indicating if sufficient liquidity is available
 */
export async function mockCheckPoolLiquidity(amount: number, token: string): Promise<boolean> {
  // Simulate liquidity check, usually returning true for most reasonable amounts
  if (token === "STX") {
    return amount < 5000000; // Mock 5M STX cap
  } else if (token === "sBTC") {
    return amount < 50; // Mock 50 sBTC cap
  }
  return false;
}

/**
 * Mock function to simulate notifying the Liquidity Pool service that a premium has been distributed.
 * @param params Parameters for the notification
 */
export async function mockNotifyLiquidityPoolOfPremiumDistribution(params: {
  policyId: string;
  premiumAmount: number;
  distributedToCounterparty: string;
  tokenId: string;
  distributionTxId?: string;
}): Promise<void> {
  console.log(
    `[MOCK] Notifying Liquidity Pool: Premium for policy ${params.policyId} distributed.`
  );
  console.log(`[MOCK] Details: `,
    `Amount: ${params.premiumAmount} ${params.tokenId}, `,
    `Counterparty: ${params.distributedToCounterparty}, `,
    `TxID: ${params.distributionTxId || 'N/A'}`
  );
} 