/**
 * Liquidity Pool Service Blockchain Integration
 * 
 * This file serves as a bridge between the Convex service layer and the blockchain integration layer.
 * It provides methods for interacting with the Liquidity Pool smart contract from Convex services.
 */

import { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { 
  buildDepositSTXTransaction,
  buildDepositSIP010Transaction,
  buildWithdrawSTXTransaction, 
  buildWithdrawSIP010Transaction,
  buildLockCollateralTransaction,
  buildReleaseCollateralTransaction,
  buildPaySettlementTransaction,
  buildDistributePremiumTransaction,
  buildProviderAllocationTransaction,
  buildDistributeProviderPremiumTransaction
} from "../blockchain/liquidityPool/writer";
import { 
  getPoolBalances, 
  getPremiumBalances,
  checkSufficientCollateral
} from "../blockchain/liquidityPool/reader";
import {
  subscribeToPremiumDistributedEvents,
  subscribeToPremiumRecordedEvents,
  subscribeToProviderPremiumDistributedEvents,
  fetchPolicyEvents
} from "../blockchain/liquidityPool/events";
import { 
  TokenType, 
  DepositParams, 
  WithdrawalParams, 
  CollateralParams, 
  SettlementParams, 
  PremiumDistributionParams,
  ProviderAllocationParams
} from "../blockchain/liquidityPool/types";
import { buildSignAndBroadcastTransaction } from "../blockchain/common/transaction";
import { NetworkEnvironment } from "../blockchain/common/network";

/**
 * Create a STX deposit transaction for a provider
 * 
 * @param depositor The address of the provider depositing STX
 * @param amount The amount of STX to deposit (in microSTX)
 * @returns Transaction ID if successful
 */
export async function createSTXDepositTransaction(
  depositor: string,
  amount: number
): Promise<string> {
  // Build the transaction parameters
  const depositParams: DepositParams = {
    token: TokenType.STX,
    amount,
    depositor
  };
  
  // Create the transaction
  const txResult = await buildDepositSTXTransaction(depositParams);
  
  if (!txResult.success) {
    throw new Error(`Failed to create STX deposit transaction: ${txResult.error}`);
  }
  
  return txResult.data;
}

/**
 * Create a sBTC deposit transaction for a provider
 * 
 * @param depositor The address of the provider depositing sBTC
 * @param amount The amount of sBTC to deposit (in satoshis)
 * @returns Transaction ID if successful
 */
export async function createSBTCDepositTransaction(
  depositor: string,
  amount: number
): Promise<string> {
  // Build the transaction parameters
  const depositParams: DepositParams = {
    token: TokenType.SBTC,
    amount,
    depositor
  };
  
  // Create the transaction
  const txResult = await buildDepositSIP010Transaction(depositParams);
  
  if (!txResult.success) {
    throw new Error(`Failed to create sBTC deposit transaction: ${txResult.error}`);
  }
  
  return txResult.data;
}

/**
 * Execute a withdrawal of STX from the liquidity pool to a provider
 * 
 * @param recipient The address of the provider receiving the withdrawal
 * @param amount The amount of STX to withdraw (in microSTX)
 * @param includePremium Whether to include earned premiums in the withdrawal
 * @returns Transaction ID if successful
 */
export async function executeSTXWithdrawal(
  recipient: string,
  amount: number,
  includePremium: boolean = false
): Promise<string> {
  // Build the transaction parameters
  const withdrawalParams: WithdrawalParams = {
    token: TokenType.STX,
    amount,
    recipient,
    includePremium
  };
  
  // Create the withdrawal transaction
  const txResult = await buildWithdrawSTXTransaction(withdrawalParams);
  
  if (!txResult.success) {
    throw new Error(`Failed to create STX withdrawal transaction: ${txResult.error}`);
  }
  
  // Sign and broadcast the transaction using the backend identity
  const txId = await buildSignAndBroadcastTransaction(txResult.data);
  
  return txId;
}

/**
 * Lock collateral for a policy
 * 
 * @param token The token type to use as collateral (STX or SBTC)
 * @param amount The amount to lock as collateral
 * @param policyId The on-chain policy ID
 * @returns Transaction ID if successful
 */
export async function lockCollateralForPolicy(
  token: TokenType,
  amount: number,
  policyId: string
): Promise<string> {
  // Build the transaction parameters
  const collateralParams: CollateralParams = {
    token,
    amount,
    policyId
  };
  
  // Create the transaction
  const txResult = await buildLockCollateralTransaction(collateralParams);
  
  if (!txResult.success) {
    throw new Error(`Failed to create lock collateral transaction: ${txResult.error}`);
  }
  
  // Sign and broadcast the transaction using the backend identity
  const txId = await buildSignAndBroadcastTransaction(txResult.data);
  
  return txId;
}

/**
 * Release collateral for a policy
 * 
 * @param token The token type to release
 * @param amount The amount to release
 * @param policyId The on-chain policy ID
 * @returns Transaction ID if successful
 */
export async function releaseCollateralForPolicy(
  token: TokenType,
  amount: number,
  policyId: string
): Promise<string> {
  // Build the transaction parameters
  const collateralParams: CollateralParams = {
    token,
    amount,
    policyId
  };
  
  // Create the transaction
  const txResult = await buildReleaseCollateralTransaction(collateralParams);
  
  if (!txResult.success) {
    throw new Error(`Failed to create release collateral transaction: ${txResult.error}`);
  }
  
  // Sign and broadcast the transaction using the backend identity
  const txId = await buildSignAndBroadcastTransaction(txResult.data);
  
  return txId;
}

/**
 * Pay settlement for an exercised policy
 * 
 * @param token The token type for settlement
 * @param amount The settlement amount
 * @param recipient The policy buyer receiving the settlement
 * @param policyId The on-chain policy ID
 * @returns Transaction ID if successful
 */
export async function payPolicySettlement(
  token: TokenType,
  amount: number,
  recipient: string,
  policyId: string
): Promise<string> {
  // Build the transaction parameters
  const settlementParams: SettlementParams = {
    token,
    amount,
    recipient,
    policyId
  };
  
  // Create the transaction
  const txResult = await buildPaySettlementTransaction(settlementParams);
  
  if (!txResult.success) {
    throw new Error(`Failed to create settlement payment transaction: ${txResult.error}`);
  }
  
  // Sign and broadcast the transaction using the backend identity
  const txId = await buildSignAndBroadcastTransaction(txResult.data);
  
  return txId;
}

/**
 * Check if there is sufficient collateral available in the pool for a policy
 * 
 * @param policyType The type of policy (e.g. 'PUT' or 'CALL')
 * @param protectedValue The value being protected
 * @param protectionAmount The amount of protection
 * @returns True if sufficient collateral is available
 */
export async function checkPoolLiquiditySufficiency(
  policyType: string,
  protectedValue: number,
  protectionAmount: number
): Promise<boolean> {
  const result = await checkSufficientCollateral(policyType, protectedValue, protectionAmount);
  
  if (!result.success) {
    throw new Error(`Failed to check collateral sufficiency: ${result.error}`);
  }
  
  return result.data;
}

/**
 * Distribute premium from a policy to its counterparty
 * 
 * @param token The token type for premium
 * @param amount The premium amount
 * @param recipient The counterparty receiving the premium
 * @param policyId The on-chain policy ID
 * @returns Transaction ID if successful
 */
export async function distributePremiumToCounterparty(
  token: TokenType,
  amount: number,
  recipient: string,
  policyId: string
): Promise<string> {
  // Build the transaction parameters
  const premiumDistParams: PremiumDistributionParams = {
    token,
    amount,
    recipient,
    policyId
  };
  
  // Create the transaction
  const txResult = await buildDistributePremiumTransaction(premiumDistParams);
  
  if (!txResult.success) {
    throw new Error(`Failed to create premium distribution transaction: ${txResult.error}`);
  }
  
  // Sign and broadcast the transaction using the backend identity
  const txId = await buildSignAndBroadcastTransaction(txResult.data);
  
  return txId;
}

/**
 * Record a provider's allocation for a policy
 * 
 * @param provider The provider address
 * @param policyId The on-chain policy ID
 * @param token The token type (STX or SBTC)
 * @param allocatedAmount The amount allocated by this provider
 * @param premiumShare The provider's share of premium (percentage 0-100)
 * @returns Transaction ID if successful
 */
export async function recordProviderPolicyAllocation(
  provider: string,
  policyId: string,
  token: TokenType,
  allocatedAmount: number,
  premiumShare: number
): Promise<string> {
  // Build the transaction parameters
  const allocationParams: ProviderAllocationParams = {
    provider,
    policyId,
    token,
    allocatedAmount,
    premiumShare
  };
  
  // Create the transaction
  const txResult = await buildProviderAllocationTransaction(allocationParams);
  
  if (!txResult.success) {
    throw new Error(`Failed to create provider allocation transaction: ${txResult.error}`);
  }
  
  // Sign and broadcast the transaction using the backend identity
  const txId = await buildSignAndBroadcastTransaction(txResult.data);
  
  return txId;
}

/**
 * Distribute premium to a provider based on their allocation
 * 
 * @param provider The provider address
 * @param policyId The on-chain policy ID
 * @param premiumAmount The premium amount to distribute
 * @returns Transaction ID if successful
 */
export async function distributeProviderPremium(
  provider: string,
  policyId: string,
  premiumAmount: number
): Promise<string> {
  // Create the transaction
  const txResult = await buildDistributeProviderPremiumTransaction({
    provider,
    policyId,
    premiumAmount
  });
  
  if (!txResult.success) {
    throw new Error(`Failed to create provider premium distribution transaction: ${txResult.error}`);
  }
  
  // Sign and broadcast the transaction using the backend identity
  const txId = await buildSignAndBroadcastTransaction(txResult.data);
  
  return txId;
}

/**
 * Get the current balances of the liquidity pool
 * 
 * @param token The token type (STX or SBTC)
 * @returns Object with total, locked, and available balances
 */
export async function getLiquidityPoolBalances(token: TokenType) {
  const result = await getPoolBalances(token);
  
  if (!result.success) {
    throw new Error(`Failed to get pool balances: ${result.error}`);
  }
  
  return result.data;
}

/**
 * Get the premium balances in the liquidity pool
 * 
 * @param token The token type (STX or SBTC)
 * @returns Object with total, distributed, and available premium amounts
 */
export async function getLiquidityPoolPremiumBalances(token: TokenType) {
  const result = await getPremiumBalances(token);
  
  if (!result.success) {
    throw new Error(`Failed to get premium balances: ${result.error}`);
  }
  
  return result.data;
}

/**
 * Process premium distribution events
 * 
 * This function is meant to be called by a scheduled job to process all premium distribution events
 * and update the Convex database with the latest information.
 * 
 * @param updatedAt Timestamp to use for updating records
 */
export async function processPremiumDistributionEvents(updatedAt: number) {
  // Set up an event handler for premium distributed events
  const onPremiumDistributed = async (event: any) => {
    try {
      // Find the pending premium distribution in Convex
      const pendingDistribution = await internal.query.premiumDistributions.findFirst({
        where: { policyId: event.policyId, status: 'pending' }
      });
      
      // Skip if not found
      if (!pendingDistribution) {
        console.log(`No pending premium distribution found for policy ${event.policyId}`);
        return;
      }
      
      // Update the distribution status
      await internal.mutation.premiumDistributions.update({
        id: pendingDistribution._id,
        data: {
          status: 'distributed',
          transactionId: event.txId,
          distributedAt: updatedAt,
          amount: event.premiumAmount,
          updatedAt
        }
      });
      
      // Notify providers if this was a policy with provider allocations
      await notifyProvidersOfPremiumDistribution(event.policyId);
      
      console.log(`Updated premium distribution for policy ${event.policyId}`);
    } catch (error) {
      console.error(`Error processing premium distributed event for policy ${event.policyId}:`, error);
    }
  };
  
  // Set up subscription (this would normally be done at app startup)
  subscribeToPremiumDistributedEvents(onPremiumDistributed);
}

/**
 * Notify providers that a premium has been distributed for a policy they have allocation in
 * 
 * @param policyId The on-chain policy ID
 */
async function notifyProvidersOfPremiumDistribution(policyId: string) {
  try {
    // Find all provider allocations for this policy
    const allocations = await internal.query.policyAllocations.get({
      where: { policyId }
    });
    
    // Process each allocation
    for (const allocation of allocations) {
      // Calculate the provider's share of the premium
      const premiumShare = allocation.premiumShare;
      const provider = allocation.provider;
      
      // Create a premium distribution record for this provider
      await internal.mutation.providerPremiumDistributions.create({
        data: {
          provider,
          policyId,
          amount: premiumShare,
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      });
      
      console.log(`Created pending provider premium distribution for provider ${provider} on policy ${policyId}`);
    }
  } catch (error) {
    console.error(`Error notifying providers of premium distribution for policy ${policyId}:`, error);
  }
}

/**
 * Process pending provider premium distributions
 * 
 * This function is meant to be called by a scheduled job to process all pending provider premium distributions
 * and execute the necessary blockchain transactions.
 */
export async function processProviderPremiumDistributions() {
  try {
    // Find all pending provider premium distributions
    const pendingDistributions = await internal.query.providerPremiumDistributions.get({
      where: { status: 'pending' }
    });
    
    console.log(`Found ${pendingDistributions.length} pending provider premium distributions to process`);
    
    // Process each distribution
    for (const distribution of pendingDistributions) {
      try {
        // Execute the blockchain transaction
        const txId = await distributeProviderPremium(
          distribution.provider,
          distribution.policyId,
          distribution.amount
        );
        
        // Update the distribution status
        await internal.mutation.providerPremiumDistributions.update({
          id: distribution._id,
          data: {
            status: 'processing',
            transactionId: txId,
            updatedAt: Date.now()
          }
        });
        
        console.log(`Processed premium distribution for provider ${distribution.provider} on policy ${distribution.policyId}`);
      } catch (error) {
        console.error(`Error processing provider premium distribution for ${distribution.provider} on policy ${distribution.policyId}:`, error);
        
        // Update the distribution with error status
        await internal.mutation.providerPremiumDistributions.update({
          id: distribution._id,
          data: {
            status: 'error',
            error: error.message,
            updatedAt: Date.now()
          }
        });
      }
    }
  } catch (error) {
    console.error('Error processing provider premium distributions:', error);
  }
} 