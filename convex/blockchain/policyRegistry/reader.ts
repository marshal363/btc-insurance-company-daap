/**
 * Policy Registry Blockchain Integration: Read Operations
 * 
 * This file contains functions for reading policy data from the blockchain.
 */

import { getContractByName } from "../common/contracts";
import { getStacksNetwork, getCurrentNetworkConfig } from "../common/network";
import { formatContractError, parseClarityValue, retryWithBackoff } from "../common/utils";
import { PolicyData, PolicyExercisabilityResult, PolicyReadResponse, PolicyStatus, BlockchainErrorCode, BlockchainError, NetworkEnvironment } from "./types";

import { cvToValue, callReadOnlyFunction, uintCV, ReadOnlyFunctionOptions } from "@stacks/transactions";
import { StacksApiWebSocketClient } from '@stacks/blockchain-api-client';

// Default network environment to use if not specified
const DEFAULT_NETWORK_ENV = NetworkEnvironment.DEVNET;

/**
 * Retrieves a policy by its ID from the blockchain
 * 
 * @param policyId - The on-chain policy ID to retrieve
 * @param networkEnv - Optional network environment to use
 * @returns Promise<PolicyReadResponse> - The policy data or error
 */
export async function getPolicyById(
  policyId: string,
  networkEnv: NetworkEnvironment = DEFAULT_NETWORK_ENV
): Promise<PolicyReadResponse> {
  try {
    const network = getStacksNetwork(networkEnv);
    const policyContract = getContractByName("policy-registry");
    const networkConfig = getCurrentNetworkConfig();
    
    const result = await retryWithBackoff(async () => {
      const options: ReadOnlyFunctionOptions = {
        contractAddress: policyContract.address,
        contractName: policyContract.name,
        functionName: "get-policy",
        functionArgs: [uintCV(parseInt(policyId))],
        senderAddress: networkConfig.adminAddress || "",
        network
      };
      
      return await callReadOnlyFunction(options);
    });

    if (result.type === 'err') {
      return {
        success: false,
        error: new BlockchainError(
          `Failed to get policy with ID ${policyId}`,
          BlockchainErrorCode.CONTRACT_ERROR
        )
      };
    }

    const policyData = parsePolicyData(result.value);
    
    return {
      success: true,
      data: policyData,
    };
  } catch (error) {
    return {
      success: false,
      error: new BlockchainError(
        `Error fetching policy with ID ${policyId}`,
        BlockchainErrorCode.NETWORK_ERROR,
        { details: error instanceof Error ? error.message : String(error) }
      )
    };
  }
}

/**
 * Checks if a policy is active on the blockchain
 * 
 * @param policyId - The on-chain policy ID to check
 * @param networkEnv - Optional network environment to use
 * @returns Promise<PolicyReadResponse> - Boolean indicating if policy is active
 */
export async function getPolicyStatus(
  policyId: string, 
  networkEnv: NetworkEnvironment = DEFAULT_NETWORK_ENV
): Promise<PolicyReadResponse> {
  try {
    const network = getStacksNetwork(networkEnv);
    const policyContract = getContractByName("policy-registry");
    const networkConfig = getCurrentNetworkConfig();
    
    const result = await retryWithBackoff(async () => {
      const options: ReadOnlyFunctionOptions = {
        contractAddress: policyContract.address,
        contractName: policyContract.name,
        functionName: "is-policy-active",
        functionArgs: [uintCV(parseInt(policyId))],
        senderAddress: networkConfig.adminAddress || "",
        network
      };
      
      return await callReadOnlyFunction(options);
    });

    const isActive = cvToValue(result);
    
    // If we know it's active, return simplified policy data
    return {
      success: true,
      data: {
        id: policyId,
        status: isActive ? PolicyStatus.ACTIVE : PolicyStatus.EXPIRED,
      } as Partial<PolicyData> as PolicyData, // Using partial here as we only return minimal info
    };
  } catch (error) {
    return {
      success: false,
      error: new BlockchainError(
        `Error checking status for policy with ID ${policyId}`,
        BlockchainErrorCode.NETWORK_ERROR,
        { details: error instanceof Error ? error.message : String(error) }
      )
    };
  }
}

/**
 * Checks if a policy can be exercised based on current conditions
 * 
 * @param policyId - The on-chain policy ID to check
 * @param networkEnv - Optional network environment to use
 * @returns Promise<PolicyExercisabilityResult> - Result with exercisability status and details
 */
export async function checkPolicyExercisability(
  policyId: string,
  networkEnv: NetworkEnvironment = DEFAULT_NETWORK_ENV
): Promise<PolicyExercisabilityResult> {
  try {
    // First get the policy data to have strike price and other details
    const policyResponse = await getPolicyById(policyId, networkEnv);
    
    if (!policyResponse.success || !policyResponse.data) {
      return {
        isExercisable: false,
        policyId,
        strikePrice: 0,
        reason: policyResponse.error instanceof BlockchainError 
          ? policyResponse.error.message 
          : "Failed to retrieve policy data",
      };
    }
    
    const policyData = policyResponse.data;
    
    // If policy is not active, it cannot be exercised
    if (policyData.status !== PolicyStatus.ACTIVE) {
      return {
        isExercisable: false,
        policyId,
        strikePrice: policyData.strikePrice,
        reason: `Policy is not active, current status: ${policyData.status}`,
      };
    }
    
    // Call the on-chain exercisability check
    const network = getStacksNetwork(networkEnv);
    const policyContract = getContractByName("policy-registry");
    const networkConfig = getCurrentNetworkConfig();
    
    const result = await retryWithBackoff(async () => {
      const options: ReadOnlyFunctionOptions = {
        contractAddress: policyContract.address,
        contractName: policyContract.name,
        functionName: "is-policy-exercisable",
        functionArgs: [uintCV(parseInt(policyId))],
        senderAddress: networkConfig.adminAddress || "",
        network
      };
      
      return await callReadOnlyFunction(options);
    });
    
    // Get current price from oracle for the response
    const oracleContract = getContractByName("oracle");
    const priceResult = await retryWithBackoff(async () => {
      const options: ReadOnlyFunctionOptions = {
        contractAddress: oracleContract.address,
        contractName: oracleContract.name,
        functionName: "get-current-btc-price",
        functionArgs: [],
        senderAddress: networkConfig.adminAddress || "",
        network
      };
      
      return await callReadOnlyFunction(options);
    });
    
    const currentPrice = parseClarityValue(priceResult);
    const isExercisable = cvToValue(result);
    
    return {
      isExercisable,
      policyId,
      currentPrice: currentPrice?.value / 100, // Assuming price is stored as USD * 100
      strikePrice: policyData.strikePrice,
      reason: isExercisable ? undefined : "Current price conditions do not allow exercise",
    };
  } catch (error) {
    return {
      isExercisable: false,
      policyId,
      strikePrice: 0,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Helper function to parse policy data from contract response
 * 
 * @param clarityCVValue - The Clarity value returned from the contract
 * @returns PolicyData - Parsed policy data
 */
function parsePolicyData(clarityCVValue: any): PolicyData {
  const rawData = parseClarityValue(clarityCVValue);
  
  // Transform contract data format to our TypeScript model
  return {
    id: rawData.id.toString(),
    policyType: rawData.policy_type,
    positionType: rawData.position_type,
    owner: rawData.owner,
    counterparty: rawData.counterparty,
    strikePrice: rawData.strike_price / 100, // Convert from micro-units if needed
    amount: rawData.amount / 100000000, // Convert from satoshis to BTC
    premium: rawData.premium / 100, // Convert from micro-units if needed
    status: mapContractStatusToEnum(rawData.status),
    creationHeight: rawData.creation_height,
    expirationHeight: rawData.expiration_height,
    settlement: rawData.settlement_details ? {
      amount: rawData.settlement_details.amount / 100000000, // Convert from satoshis
      price: rawData.settlement_details.price / 100, // Convert from micro-units
      blockHeight: rawData.settlement_details.block_height,
    } : undefined,
    premiumDistributed: rawData.premium_distributed,
    collateralToken: rawData.collateral_token,
    settlementToken: rawData.settlement_token
  };
}

/**
 * Maps contract status values to PolicyStatus enum
 */
function mapContractStatusToEnum(contractStatus: number | string): PolicyStatus {
  // Different contracts might return either a number or string for status
  const statusMap: Record<string, PolicyStatus> = {
    '0': PolicyStatus.ACTIVE,
    '1': PolicyStatus.EXERCISED,
    '2': PolicyStatus.EXPIRED,
    '3': PolicyStatus.SETTLED,
    'active': PolicyStatus.ACTIVE,
    'exercised': PolicyStatus.EXERCISED,
    'expired': PolicyStatus.EXPIRED,
    'settled': PolicyStatus.SETTLED,
  };
  
  return statusMap[contractStatus.toString()] || PolicyStatus.ACTIVE;
}

/**
 * Export the main functions
 */
export default {
  getPolicyById,
  getPolicyStatus,
  checkPolicyExercisability,
}; 