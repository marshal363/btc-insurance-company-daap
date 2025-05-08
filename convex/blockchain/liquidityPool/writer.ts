/**
 * Liquidity Pool Blockchain Integration: Write Operations
 * 
 * This file contains functions for creating transactions to interact with the Liquidity Pool contract.
 */

import { getContractByName } from "../common/contracts";
import { buildTransaction } from "../common/transaction";
import { BlockchainWriteResponse } from "../common/types";
import {
  DepositParams,
  WithdrawalParams,
  CollateralParams,
  SettlementParams,
  PremiumDistributionParams,
  ProviderAllocationParams,
  LiquidityPoolError,
  LiquidityPoolErrorCode,
  TokenType
} from "./types";

import {
  stringAsciiCV,
  uintCV,
  principalCV,
  PostConditionMode,
  FungibleConditionCode,
  makeStandardSTXPostCondition,
  createAssetInfo
} from "@stacks/transactions";

/**
 * Build a transaction to deposit STX into the liquidity pool
 * @param params The deposit parameters
 * @returns Transaction payload for the deposit
 */
export async function buildDepositSTXTransaction(
  params: DepositParams
): Promise<BlockchainWriteResponse<string>> {
  try {
    const { amount, depositor } = params;
    const contract = getContractByName("liquidityPool");

    // Prepare post conditions to ensure token transfer
    const postConditions = [
      makeStandardSTXPostCondition(
        depositor, // sender
        FungibleConditionCode.Equal, // condition code
        amount // amount
      )
    ];

    // Build the transaction
    const txOptions = {
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: "deposit-stx",
      functionArgs: [uintCV(amount)],
      senderAddress: depositor,
      postConditions,
      postConditionMode: PostConditionMode.Deny
    };

    const transaction = await buildTransaction(txOptions);

    return {
      success: true,
      data: transaction
    };
  } catch (error: any) {
    return {
      success: false,
      error: new LiquidityPoolError(
        LiquidityPoolErrorCode.UNKNOWN_ERROR,
        `Error building STX deposit transaction: ${error.message}`,
        error
      )
    };
  }
}

/**
 * Build a transaction to deposit a SIP-010 token into the liquidity pool
 * @param params The deposit parameters
 * @returns Transaction payload for the deposit
 */
export async function buildDepositSIP010Transaction(
  params: DepositParams
): Promise<BlockchainWriteResponse<string>> {
  try {
    const { amount, depositor, token } = params;
    
    if (token !== TokenType.SBTC) {
      return {
        success: false,
        error: new LiquidityPoolError(
          LiquidityPoolErrorCode.INVALID_AMOUNT,
          `Only SBTC is supported for SIP-010 deposits`
        )
      };
    }
    
    const contract = getContractByName("liquidityPool");
    const tokenContract = getContractByName("sbtc");

    // Build the transaction
    const txOptions = {
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: "deposit-sip010",
      functionArgs: [
        // Token contract principal
        principalCV(`${tokenContract.address}.${tokenContract.name}`),
        // Amount to deposit
        uintCV(amount)
      ],
      senderAddress: depositor,
      postConditionMode: PostConditionMode.Deny
    };

    const transaction = await buildTransaction(txOptions);

    return {
      success: true,
      data: transaction
    };
  } catch (error: any) {
    return {
      success: false,
      error: new LiquidityPoolError(
        LiquidityPoolErrorCode.UNKNOWN_ERROR,
        `Error building SIP-010 deposit transaction: ${error.message}`,
        error
      )
    };
  }
}

/**
 * Build a transaction to withdraw STX from the liquidity pool
 * @param params The withdrawal parameters
 * @returns Transaction payload for the withdrawal
 */
export async function buildWithdrawSTXTransaction(
  params: WithdrawalParams
): Promise<BlockchainWriteResponse<string>> {
  try {
    const { amount, recipient } = params;
    const contract = getContractByName("liquidityPool");
    const backendAddress = contract.adminAddress;

    // Only the backend can initiate withdrawals in the "On-Chain Light" model
    const txOptions = {
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: "withdraw-stx",
      functionArgs: [
        uintCV(amount),
        principalCV(recipient)
      ],
      senderAddress: backendAddress
    };

    const transaction = await buildTransaction(txOptions);

    return {
      success: true,
      data: transaction
    };
  } catch (error: any) {
    return {
      success: false,
      error: new LiquidityPoolError(
        LiquidityPoolErrorCode.UNKNOWN_ERROR,
        `Error building STX withdrawal transaction: ${error.message}`,
        error
      )
    };
  }
}

/**
 * Build a transaction to withdraw a SIP-010 token from the liquidity pool
 * @param params The withdrawal parameters
 * @returns Transaction payload for the withdrawal
 */
export async function buildWithdrawSIP010Transaction(
  params: WithdrawalParams
): Promise<BlockchainWriteResponse<string>> {
  try {
    const { amount, recipient, token } = params;
    
    if (token !== TokenType.SBTC) {
      return {
        success: false,
        error: new LiquidityPoolError(
          LiquidityPoolErrorCode.INVALID_AMOUNT,
          `Only SBTC is supported for SIP-010 withdrawals`
        )
      };
    }
    
    const contract = getContractByName("liquidityPool");
    const tokenContract = getContractByName("sbtc");
    const backendAddress = contract.adminAddress;

    // Only the backend can initiate withdrawals in the "On-Chain Light" model
    const txOptions = {
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: "withdraw-sip010",
      functionArgs: [
        // Token contract trait reference
        principalCV(`${tokenContract.address}.${tokenContract.name}`),
        // Amount to withdraw
        uintCV(amount),
        // Recipient
        principalCV(recipient)
      ],
      senderAddress: backendAddress
    };

    const transaction = await buildTransaction(txOptions);

    return {
      success: true,
      data: transaction
    };
  } catch (error: any) {
    return {
      success: false,
      error: new LiquidityPoolError(
        LiquidityPoolErrorCode.UNKNOWN_ERROR,
        `Error building SIP-010 withdrawal transaction: ${error.message}`,
        error
      )
    };
  }
}

/**
 * Build a transaction to lock collateral for a policy
 * @param params The collateral parameters
 * @returns Transaction payload for locking collateral
 */
export async function buildLockCollateralTransaction(
  params: CollateralParams
): Promise<BlockchainWriteResponse<string>> {
  try {
    const { token, amount, policyId } = params;
    const contract = getContractByName("liquidityPool");
    const backendAddress = contract.adminAddress;

    // Only the backend can lock collateral in the "On-Chain Light" model
    const txOptions = {
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: "lock-collateral",
      functionArgs: [
        stringAsciiCV(token),
        uintCV(amount),
        uintCV(parseInt(policyId))
      ],
      senderAddress: backendAddress
    };

    const transaction = await buildTransaction(txOptions);

    return {
      success: true,
      data: transaction
    };
  } catch (error: any) {
    return {
      success: false,
      error: new LiquidityPoolError(
        LiquidityPoolErrorCode.UNKNOWN_ERROR,
        `Error building lock collateral transaction: ${error.message}`,
        error
      )
    };
  }
}

/**
 * Build a transaction to release collateral for a policy
 * @param params The collateral parameters
 * @returns Transaction payload for releasing collateral
 */
export async function buildReleaseCollateralTransaction(
  params: CollateralParams
): Promise<BlockchainWriteResponse<string>> {
  try {
    const { token, amount, policyId } = params;
    const contract = getContractByName("liquidityPool");
    const backendAddress = contract.adminAddress;

    // Only the backend can release collateral in the "On-Chain Light" model
    const txOptions = {
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: "release-collateral",
      functionArgs: [
        stringAsciiCV(token),
        uintCV(amount),
        uintCV(parseInt(policyId))
      ],
      senderAddress: backendAddress
    };

    const transaction = await buildTransaction(txOptions);

    return {
      success: true,
      data: transaction
    };
  } catch (error: any) {
    return {
      success: false,
      error: new LiquidityPoolError(
        LiquidityPoolErrorCode.UNKNOWN_ERROR,
        `Error building release collateral transaction: ${error.message}`,
        error
      )
    };
  }
}

/**
 * Build a transaction to pay settlement for an exercised policy
 * @param params The settlement parameters
 * @returns Transaction payload for settlement payment
 */
export async function buildPaySettlementTransaction(
  params: SettlementParams
): Promise<BlockchainWriteResponse<string>> {
  try {
    const { token, amount, recipient, policyId } = params;
    const contract = getContractByName("liquidityPool");
    const backendAddress = contract.adminAddress;

    // Only the backend can pay settlements in the "On-Chain Light" model
    const txOptions = {
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: "pay-settlement",
      functionArgs: [
        stringAsciiCV(token),
        uintCV(amount),
        principalCV(recipient),
        uintCV(parseInt(policyId))
      ],
      senderAddress: backendAddress
    };

    const transaction = await buildTransaction(txOptions);

    return {
      success: true,
      data: transaction
    };
  } catch (error: any) {
    return {
      success: false,
      error: new LiquidityPoolError(
        LiquidityPoolErrorCode.UNKNOWN_ERROR,
        `Error building pay settlement transaction: ${error.message}`,
        error
      )
    };
  }
}

/**
 * Build a transaction to distribute premium to a counterparty
 * @param params The premium distribution parameters
 * @returns Transaction payload for premium distribution
 */
export async function buildDistributePremiumTransaction(
  params: PremiumDistributionParams
): Promise<BlockchainWriteResponse<string>> {
  try {
    const { token, amount, recipient, policyId } = params;
    const contract = getContractByName("liquidityPool");
    const backendAddress = contract.adminAddress;

    // Only the backend can distribute premiums in the "On-Chain Light" model
    const txOptions = {
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: "distribute-premium",
      functionArgs: [
        stringAsciiCV(token),
        uintCV(amount),
        principalCV(recipient),
        uintCV(parseInt(policyId))
      ],
      senderAddress: backendAddress
    };

    const transaction = await buildTransaction(txOptions);

    return {
      success: true,
      data: transaction
    };
  } catch (error: any) {
    return {
      success: false,
      error: new LiquidityPoolError(
        LiquidityPoolErrorCode.UNKNOWN_ERROR,
        `Error building distribute premium transaction: ${error.message}`,
        error
      )
    };
  }
}

/**
 * Build a transaction to record a provider allocation for a policy
 * @param params The provider allocation parameters
 * @returns Transaction payload for provider allocation
 */
export async function buildProviderAllocationTransaction(
  params: ProviderAllocationParams
): Promise<BlockchainWriteResponse<string>> {
  try {
    const { provider, policyId, token, allocatedAmount, premiumShare } = params;
    const contract = getContractByName("liquidityPool");
    const backendAddress = contract.adminAddress;

    // Only the backend can record provider allocations in the "On-Chain Light" model
    const txOptions = {
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: "record-provider-allocation",
      functionArgs: [
        principalCV(provider),
        uintCV(parseInt(policyId)),
        stringAsciiCV(token),
        uintCV(allocatedAmount),
        uintCV(premiumShare)
      ],
      senderAddress: backendAddress
    };

    const transaction = await buildTransaction(txOptions);

    return {
      success: true,
      data: transaction
    };
  } catch (error: any) {
    return {
      success: false,
      error: new LiquidityPoolError(
        LiquidityPoolErrorCode.UNKNOWN_ERROR,
        `Error building provider allocation transaction: ${error.message}`,
        error
      )
    };
  }
}

/**
 * Build a transaction to distribute premium to a provider
 * @param params The premium distribution parameters
 * @returns Transaction payload for provider premium distribution
 */
export async function buildDistributeProviderPremiumTransaction(
  params: { provider: string; policyId: string; premiumAmount: number }
): Promise<BlockchainWriteResponse<string>> {
  try {
    const { provider, policyId, premiumAmount } = params;
    const contract = getContractByName("liquidityPool");
    const backendAddress = contract.adminAddress;

    // Only the backend can distribute provider premiums in the "On-Chain Light" model
    const txOptions = {
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: "distribute-provider-premium",
      functionArgs: [
        principalCV(provider),
        uintCV(parseInt(policyId)),
        uintCV(premiumAmount)
      ],
      senderAddress: backendAddress
    };

    const transaction = await buildTransaction(txOptions);

    return {
      success: true,
      data: transaction
    };
  } catch (error: any) {
    return {
      success: false,
      error: new LiquidityPoolError(
        LiquidityPoolErrorCode.UNKNOWN_ERROR,
        `Error building distribute provider premium transaction: ${error.message}`,
        error
      )
    };
  }
} 