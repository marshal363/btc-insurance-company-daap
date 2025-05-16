/**
 * Policy Registry Blockchain Integration: Write Operations
 * 
 * This file contains functions for creating and updating policies on the blockchain.
 */

import { getContractByName } from "../common/contracts";
import { getStacksNetwork, getCurrentNetworkConfig } from "../common/network";
import { buildSignAndBroadcastTransaction } from "../common/transaction";
import { 
  UpdatePolicyStatusParams, 
  ExpirePoliciesBatchParams,
  PremiumDistributionParams,
  PolicyWriteResponse,
  PolicyStatus,
  NetworkEnvironment,
  PolicyType,
  PositionType,
} from "./types";
import { 
  TransactionParams,
  BlockchainWriteResponse
} from "../common/types";

import {
  uintCV,
  stringAsciiCV,
  standardPrincipalCV,
  boolCV,
  falseCV,
  someCV,
  noneCV,
  ClarityValue,
  AnchorMode,
  PostConditionMode
} from "@stacks/transactions";

// Default network environment to use if not specified
const DEFAULT_NETWORK_ENV = NetworkEnvironment.DEVNET;

/**
 * Extended params interface with transaction-specific properties
 */
interface ExtendedTransactionParams extends TransactionParams {
  senderKey?: string;
  postConditions?: any[];
  nonce?: number;
  anchorMode?: AnchorMode;
  postConditionMode?: PostConditionMode;
}

/**
 * Parameters for policy creation
 */
export interface PolicyCreationParams extends TransactionParams {
  // Owner's principal (e.g., STxxxxxxxx)
  owner: string;
  // Policy type (e.g., "PUT", "CALL") - must be string-ascii 8
  policyType: PolicyType; 
  // Risk tier - canonical lowercase string (e.g., "conservative") - must be string-ascii 32
  riskTier: string;
  // Asset being protected (e.g., "BTC") - must be string-ascii 10. For MVP, this will always be "BTC".
  protectedAssetName: string; 
  // Token used for paying premium (e.g., "STX") - must be string-ascii 32. For MVP, this will always be "STX".
  collateralTokenName: string;
  // Strike price, in USD (e.g., 50000 for $50,000.00). Will be scaled to cents for the contract.
  strikePrice: number;
  // Amount of the protected asset (e.g., 1.5 for 1.5 BTC). Will be scaled to smallest unit (e.g., satoshis).
  amount: number;
  // Premium amount, in STX (e.g., 100.50 for 100.50 STX). Will be scaled to microSTX for the contract.
  premium: number;
  // Expiration block height
  expirationHeight: number;
  // Fields to be removed as they are not direct contract params for create-protection-policy:
  // positionType: PositionType;
  // counterparty?: string;
  // collateralToken: string; (renamed to collateralTokenName and usage clarified)
  // settlementToken: string;
}

/**
 * Builds and sends a transaction to create a new policy on the blockchain
 * 
 * @param params - Policy creation parameters
 * @returns Promise<PolicyWriteResponse> - Transaction information or error
 */
export async function buildPolicyCreationTransaction(
  params: PolicyCreationParams & ExtendedTransactionParams
): Promise<PolicyWriteResponse> {
  try {
    const policyContract = getContractByName("policy-registry");
    
    // Format parameters for Clarity contract according to policy-registry.clar::create-protection-policy
    // (policy-owner-principal principal)
    // (policy-type (string-ascii 8))
    // (risk-tier (string-ascii 32))
    // (protected-asset-name (string-ascii 10))
    // (collateral-token-name (string-ascii 32))
    // (protected-value-scaled uint)       ; USD Strike Price, scaled to cents (input USD * 100)
    // (protection-amount-scaled uint)     ; BTC Amount, scaled to satoshis (input BTC * 10^8)
    // (expiration-height uint)
    // (submitted-premium-scaled uint)     ; STX Premium, scaled to microSTX (input STX * 10^6)

    const clarityArgs: ClarityValue[] = [
      standardPrincipalCV(params.owner),
      stringAsciiCV(params.policyType.padEnd(8, ' ')), // Ensure length for string-ascii 8
      stringAsciiCV(params.riskTier.padEnd(32, ' ')), // Ensure length for string-ascii 32
      stringAsciiCV(params.protectedAssetName.padEnd(10, ' ')), // Use param, ensure length for string-ascii 10
      stringAsciiCV(params.collateralTokenName.padEnd(32, ' ')), // Use param, ensure length for string-ascii 32
      uintCV(Math.round(params.strikePrice * 100)),      // protected-value-scaled (USD cents)
      uintCV(Math.round(params.amount * 100000000)), // protection-amount-scaled (Satoshis for BTC)
      uintCV(params.expirationHeight),
      uintCV(Math.round(params.premium * 1000000))    // submitted-premium-scaled (microSTX)
    ];
    
    // Build, sign, and broadcast the transaction
    return await buildSignAndBroadcastTransaction({
      contractAddress: policyContract.address,
      contractName: policyContract.name,
      functionName: "create-protection-policy",
      functionArgs: clarityArgs,
      senderKey: params.senderKey,
      postConditions: params.postConditions || [],
      nonce: params.nonce,
      anchorMode: params.anchorMode,
      networkEnv: params.network || DEFAULT_NETWORK_ENV
    });
  } catch (error) {
    return {
      success: false,
      error: `Failed to create policy transaction: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Builds and sends a transaction to update a policy's status on the blockchain
 * 
 * @param params - Policy status update parameters
 * @returns Promise<PolicyWriteResponse> - Transaction information or error
 */
export async function buildUpdatePolicyStatusTransaction(
  params: UpdatePolicyStatusParams & ExtendedTransactionParams
): Promise<PolicyWriteResponse> {
  try {
    const policyContract = getContractByName("policy-registry");
    
    // Determine which function to call based on the new status
    let functionName: string;
    let functionArgs: ClarityValue[];
    
    switch (params.newStatus) {
      case PolicyStatus.EXERCISED:
        if (!params.settlementAmount || !params.settlementPrice) {
          throw new Error("Settlement amount and price are required for exercising a policy");
        }
        
        functionName = "update-policy-status";
        functionArgs = [
          uintCV(parseInt(params.policyId)), // policy ID
          uintCV(1), // status code for EXERCISED
          someCV(uintCV(Math.round(params.settlementAmount * 100000000))), // settlement amount in satoshis
          someCV(uintCV(Math.round(params.settlementPrice * 100))), // settlement price (USD * 100)
        ];
        break;
        
      case PolicyStatus.EXPIRED:
        functionName = "update-policy-status";
        functionArgs = [
          uintCV(parseInt(params.policyId)), // policy ID
          uintCV(2), // status code for EXPIRED
          noneCV(), // no settlement amount
          noneCV(), // no settlement price
        ];
        break;
        
      case PolicyStatus.SETTLED:
        functionName = "update-policy-status";
        functionArgs = [
          uintCV(parseInt(params.policyId)), // policy ID
          uintCV(3), // status code for SETTLED
          noneCV(), // no settlement amount
          noneCV(), // no settlement price
        ];
        break;
        
      default:
        throw new Error(`Unsupported policy status update: ${params.newStatus}`);
    }
    
    // Build, sign, and broadcast the transaction
    return await buildSignAndBroadcastTransaction({
      contractAddress: policyContract.address,
      contractName: policyContract.name,
      functionName,
      functionArgs,
      senderKey: params.senderKey,
      postConditions: params.postConditions || [],
      nonce: params.nonce,
      anchorMode: params.anchorMode,
      networkEnv: params.network || DEFAULT_NETWORK_ENV
    });
  } catch (error) {
    return {
      success: false,
      error: `Failed to update policy ${params.policyId} status to ${params.newStatus}: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Builds and sends a transaction to expire multiple policies in a batch
 * 
 * @param params - Batch expiration parameters
 * @returns Promise<PolicyWriteResponse> - Transaction information or error
 */
export async function buildExpirePoliciesBatchTransaction(
  params: ExpirePoliciesBatchParams & ExtendedTransactionParams
): Promise<PolicyWriteResponse> {
  try {
    const policyContract = getContractByName("policy-registry");
    
    // Convert policy IDs to Clarity values
    const policyIdsCV = params.policyIds.map(id => uintCV(parseInt(id)));
    
    // Build a list with all policy IDs (assuming the contract expects a list)
    // If the contract requires a different format, adjust this part accordingly
    const functionArgs: ClarityValue[] = [
      // List of policy IDs (assuming this is expected by the contract)
      // Replace this with proper list creation if needed
      uintCV(params.currentBlockHeight), // current block height for verification
    ];
    
    // Build, sign, and broadcast the transaction
    return await buildSignAndBroadcastTransaction({
      contractAddress: policyContract.address,
      contractName: policyContract.name,
      functionName: "expire-policies-batch",
      functionArgs,
      senderKey: params.senderKey,
      postConditions: params.postConditions || [],
      nonce: params.nonce,
      anchorMode: params.anchorMode,
      networkEnv: params.network || DEFAULT_NETWORK_ENV
    });
  } catch (error) {
    return {
      success: false,
      error: `Failed to expire policies in batch: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Builds and sends a transaction to distribute premium for a policy
 * 
 * @param params - Premium distribution parameters
 * @returns Promise<PolicyWriteResponse> - Transaction information or error
 */
export async function buildPremiumDistributionTransaction(
  params: PremiumDistributionParams & ExtendedTransactionParams
): Promise<PolicyWriteResponse> {
  try {
    const policyContract = getContractByName("policy-registry");
    
    // Build, sign, and broadcast the transaction
    return await buildSignAndBroadcastTransaction({
      contractAddress: policyContract.address,
      contractName: policyContract.name,
      functionName: "distribute-premium",
      functionArgs: [
        uintCV(parseInt(params.policyId)), // policy ID
        uintCV(Math.round(params.amount * 100)), // premium amount (USD * 100)
        stringAsciiCV(params.token), // token (e.g., "STX", "sBTC")
        standardPrincipalCV(params.recipient), // recipient principal
      ],
      senderKey: params.senderKey,
      postConditions: params.postConditions || [],
      nonce: params.nonce,
      anchorMode: params.anchorMode,
      networkEnv: params.network || DEFAULT_NETWORK_ENV
    });
  } catch (error) {
    return {
      success: false,
      error: `Failed to distribute premium for policy ${params.policyId}: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Export the main functions
 */
export default {
  buildPolicyCreationTransaction,
  buildUpdatePolicyStatusTransaction,
  buildExpirePoliciesBatchTransaction,
  buildPremiumDistributionTransaction,
}; 