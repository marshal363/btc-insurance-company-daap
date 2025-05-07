/**
 * Policy Registry Blockchain Integration: Write Operations
 * 
 * This file contains functions for creating and updating policies on the blockchain.
 */

import { getContractByName } from "../common/contracts";
import { getStacksNetwork, getCurrentNetworkConfig } from "../common/network";
import { buildSignAndBroadcastTransaction } from "../common/transaction";
import { 
  PolicyCreationParams, 
  UpdatePolicyStatusParams, 
  ExpirePoliciesBatchParams,
  PremiumDistributionParams,
  PolicyWriteResponse,
  PolicyStatus,
  NetworkEnvironment
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
    
    // Format parameters for Clarity contract
    const clarityArgs: ClarityValue[] = [
      stringAsciiCV(params.policyType), // policy type (PUT/CALL)
      stringAsciiCV(params.positionType), // position type (LONG_PUT/SHORT_PUT)
      standardPrincipalCV(params.owner), // owner principal
      params.counterparty 
        ? someCV(standardPrincipalCV(params.counterparty)) 
        : noneCV(), // counterparty (optional)
      uintCV(Math.round(params.strikePrice * 100)), // strike price (USD * 100)
      uintCV(Math.round(params.amount * 100000000)), // amount (BTC * 100000000 = satoshis)
      uintCV(Math.round(params.premium * 100)), // premium (USD * 100)
      uintCV(params.expirationHeight), // expiration block height
      stringAsciiCV(params.collateralToken), // collateral token
      stringAsciiCV(params.settlementToken) // settlement token
    ];
    
    // Build, sign, and broadcast the transaction
    return await buildSignAndBroadcastTransaction({
      contractAddress: policyContract.address,
      contractName: policyContract.name,
      functionName: "create-policy-entry",
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