/**
 * Liquidity Pool Blockchain Integration: Read Operations
 * 
 * This file contains functions for reading liquidity pool data from the blockchain.
 */

import { getContractByName } from "../common/contracts";
import { getStacksNetwork, getCurrentNetworkConfig } from "../common/network";
import { formatContractError, parseClarityValue, retryWithBackoff } from "../common/utils";
import { BlockchainReadResponse, NetworkEnvironment } from "../common/types";
import { 
  TokenType, 
  PoolBalancesResponse, 
  PremiumBalancesResponse, 
  ProviderAllocationResponse,
  LiquidityPoolError,
  LiquidityPoolErrorCode
} from "./types";

import { callReadOnlyFunction, stringAsciiCV, ReadOnlyFunctionOptions } from "@stacks/transactions";

// Default network environment to use if not specified
const DEFAULT_NETWORK_ENV = NetworkEnvironment.DEVNET;

/**
 * Get the balance information for a specific token in the Liquidity Pool.
 * @param token The token to check balances for (STX or SBTC)
 * @param networkEnv Optional network environment to use
 * @returns Object containing total, locked, and available balances
 */
export async function getPoolBalances(
  token: TokenType,
  networkEnv: NetworkEnvironment = DEFAULT_NETWORK_ENV
): Promise<BlockchainReadResponse<PoolBalancesResponse>> {
  try {
    const network = getStacksNetwork(networkEnv);
    const contract = getContractByName('liquidityPool');
    const networkConfig = getCurrentNetworkConfig();
    
    // Call read-only functions to get different balance types
    const totalResponse = await retryWithBackoff(async () => {
      const options: ReadOnlyFunctionOptions = {
        contractAddress: contract.address,
        contractName: contract.name,
        functionName: 'get-total-token-balance',
        functionArgs: [stringAsciiCV(token)],
        senderAddress: networkConfig.adminAddress || "",
        network
      };
      
      return await callReadOnlyFunction(options);
    });
    
    const lockedResponse = await retryWithBackoff(async () => {
      const options: ReadOnlyFunctionOptions = {
        contractAddress: contract.address,
        contractName: contract.name,
        functionName: 'get-locked-collateral',
        functionArgs: [stringAsciiCV(token)],
        senderAddress: networkConfig.adminAddress || "",
        network
      };
      
      return await callReadOnlyFunction(options);
    });
    
    const availableResponse = await retryWithBackoff(async () => {
      const options: ReadOnlyFunctionOptions = {
        contractAddress: contract.address,
        contractName: contract.name,
        functionName: 'get-available-balance',
        functionArgs: [stringAsciiCV(token)],
        senderAddress: networkConfig.adminAddress || "",
        network
      };
      
      return await callReadOnlyFunction(options);
    });
    
    // Parse responses and handle conversions
    const total = parseInt(parseClarityValue(totalResponse));
    const locked = parseInt(parseClarityValue(lockedResponse));
    const available = parseInt(parseClarityValue(availableResponse));
    
    return {
      success: true,
      data: { total, locked, available }
    };
  } catch (error: any) {
    return {
      success: false,
      error: formatContractError(error)
    };
  }
}

/**
 * Get premium balance information for a specific token.
 * @param token The token type to check premium balances for
 * @param networkEnv Optional network environment to use
 * @returns Object containing total, distributed, and available premium amounts
 */
export async function getPremiumBalances(
  token: TokenType,
  networkEnv: NetworkEnvironment = DEFAULT_NETWORK_ENV
): Promise<BlockchainReadResponse<PremiumBalancesResponse>> {
  try {
    const network = getStacksNetwork(networkEnv);
    const contract = getContractByName('liquidityPool');
    const networkConfig = getCurrentNetworkConfig();
    
    // Call read-only function to get premium balance data
    const response = await retryWithBackoff(async () => {
      const options: ReadOnlyFunctionOptions = {
        contractAddress: contract.address,
        contractName: contract.name,
        functionName: 'get-premium-balances-for-token',
        functionArgs: [stringAsciiCV(token)],
        senderAddress: networkConfig.adminAddress || "",
        network
      };
      
      return await callReadOnlyFunction(options);
    });
    
    // Parse response to extract total and distributed premiums
    const premiumData = parseClarityValue(response);
    const totalPremiums = parseInt(premiumData['total-premiums']);
    const distributedPremiums = parseInt(premiumData['distributed-premiums']);
    const availablePremiums = totalPremiums - distributedPremiums;
    
    return {
      success: true,
      data: {
        total: totalPremiums,
        distributed: distributedPremiums,
        available: availablePremiums
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: formatContractError(error)
    };
  }
}

/**
 * Check if the Liquidity Pool has sufficient collateral available for a policy.
 * @param policyType The type of policy (e.g. 'PUT' or 'CALL')
 * @param protectedValue The value being protected
 * @param protectionAmount The protection amount
 * @param networkEnv Optional network environment to use
 * @returns Boolean indicating whether there is sufficient collateral
 */
export async function checkSufficientCollateral(
  policyType: string,
  protectedValue: number,
  protectionAmount: number,
  networkEnv: NetworkEnvironment = DEFAULT_NETWORK_ENV
): Promise<BlockchainReadResponse<boolean>> {
  try {
    const network = getStacksNetwork(networkEnv);
    const contract = getContractByName('liquidityPool');
    const networkConfig = getCurrentNetworkConfig();
    
    // Call read-only function to check collateral sufficiency
    const response = await retryWithBackoff(async () => {
      const options: ReadOnlyFunctionOptions = {
        contractAddress: contract.address,
        contractName: contract.name,
        functionName: 'has-sufficient-collateral',
        functionArgs: [protectedValue, protectionAmount, stringAsciiCV(policyType)],
        senderAddress: networkConfig.adminAddress || "",
        network
      };
      
      return await callReadOnlyFunction(options);
    });
    
    // Parse response (expecting a boolean)
    const isCollateralSufficient = parseClarityValue(response);
    
    return {
      success: true,
      data: isCollateralSufficient
    };
  } catch (error: any) {
    return {
      success: false,
      error: formatContractError(error)
    };
  }
}

/**
 * Get allocation details for a specific provider and policy.
 * @param provider The provider address
 * @param policyId The policy ID
 * @param networkEnv Optional network environment to use
 * @returns Allocation details including token, amount, premium share and distribution status
 */
export async function getProviderAllocation(
  provider: string,
  policyId: string,
  networkEnv: NetworkEnvironment = DEFAULT_NETWORK_ENV
): Promise<BlockchainReadResponse<ProviderAllocationResponse>> {
  try {
    const network = getStacksNetwork(networkEnv);
    const contract = getContractByName('liquidityPool');
    const networkConfig = getCurrentNetworkConfig();
    
    // Call read-only function to get provider allocation
    const response = await retryWithBackoff(async () => {
      const options: ReadOnlyFunctionOptions = {
        contractAddress: contract.address,
        contractName: contract.name,
        functionName: 'get-provider-allocation',
        functionArgs: [provider, policyId],
        senderAddress: networkConfig.adminAddress || "",
        network
      };
      
      return await callReadOnlyFunction(options);
    });
    
    // Parse the response
    const parsedResponse = parseClarityValue(response);
    
    // If no allocation exists, the contract would return none/null
    if (!parsedResponse) {
      return {
        success: false,
        error: new LiquidityPoolError(
          LiquidityPoolErrorCode.POLICY_NOT_FOUND,
          `No allocation found for provider ${provider} and policy ${policyId}`
        )
      };
    }
    
    // Parse the allocation data
    const token = parsedResponse.token;
    const allocatedAmount = parseInt(parsedResponse['allocated-amount']);
    const premiumShare = parseInt(parsedResponse['premium-share']);
    const premiumDistributed = parsedResponse['premium-distributed'];
    
    return {
      success: true,
      data: {
        token,
        allocatedAmount,
        premiumShare,
        premiumDistributed
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: formatContractError(error)
    };
  }
}

/**
 * Get the undistributed premium amount for a specific token.
 * @param token The token type to check
 * @param networkEnv Optional network environment to use
 * @returns The undistributed premium amount
 */
export async function getUndistributedPremiums(
  token: TokenType,
  networkEnv: NetworkEnvironment = DEFAULT_NETWORK_ENV
): Promise<BlockchainReadResponse<number>> {
  try {
    const network = getStacksNetwork(networkEnv);
    const contract = getContractByName('liquidityPool');
    const networkConfig = getCurrentNetworkConfig();
    
    // Call read-only function
    const response = await retryWithBackoff(async () => {
      const options: ReadOnlyFunctionOptions = {
        contractAddress: contract.address,
        contractName: contract.name,
        functionName: 'get-undistributed-premiums-for-token',
        functionArgs: [stringAsciiCV(token)],
        senderAddress: networkConfig.adminAddress || "",
        network
      };
      
      return await callReadOnlyFunction(options);
    });
    
    // Parse the response to get undistributed premium amount
    const undistributedAmount = parseInt(parseClarityValue(response));
    
    return {
      success: true,
      data: undistributedAmount
    };
  } catch (error: any) {
    return {
      success: false,
      error: formatContractError(error)
    };
  }
} 