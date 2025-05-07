import {
  AnchorMode,
  uintCV,
  makeContractCall,
  PostConditionMode,
  broadcastTransaction,
  deserializeTransaction,
  ClarityValue,
} from '@stacks/transactions';
import { 
  OracleSubmissionParams, 
  OracleSubmissionEvaluationResult, 
  OracleUpdateThresholds, 
  OracleErrorCode,
  OracleSubmissionResult,
  OracleSubmissionCheckResult
} from './types';
import { getOracleContract } from '../common/contracts';
import { getStacksNetwork, getNetworkEnvironment } from '../common/network';
import { 
  getBackendSignerKey, 
  getBackendAddress, 
  broadcastSignedTransaction, 
  buildSignAndBroadcastTransaction,
} from '../common/transaction';
import { BlockchainWriteResponse, NetworkEnvironment } from '../common/types';
import { readLatestOraclePrice } from './priceReader';

/**
 * Oracle update thresholds configuration.
 * These thresholds determine when a price update should be performed.
 */
export const ORACLE_UPDATE_THRESHOLDS: OracleUpdateThresholds = {
  MIN_PRICE_CHANGE_PERCENT: 1.0, // Minimum price change percentage to trigger an update
  MAX_TIME_BETWEEN_UPDATES_MS: 24 * 60 * 60 * 1000, // Maximum time allowed between updates (24 hours)
  MIN_TIME_BETWEEN_UPDATES_MS: 15 * 60 * 1000, // Minimum time between updates (15 minutes)
  MIN_SOURCE_COUNT: 3, // Minimum number of price sources required for update
};

/**
 * Prepares the latest aggregated price data for submission to the oracle contract.
 * Implements the multi-factor threshold logic to determine if an update should be performed.
 * 
 * @param {OracleSubmissionParams} params - Price submission parameters
 * @returns {Promise<OracleSubmissionEvaluationResult>} - Evaluation result
 */
export async function prepareOracleSubmission(params: OracleSubmissionParams): Promise<OracleSubmissionEvaluationResult> {
  console.log("prepareOracleSubmission running with multi-factor threshold logic...");
  
  const { currentPriceUSD, currentTimestamp, sourceCount } = params;
  
  // Check minimum source count threshold
  if (sourceCount !== undefined && sourceCount < ORACLE_UPDATE_THRESHOLDS.MIN_SOURCE_COUNT) {
    console.warn(`Insufficient price sources (${sourceCount}) for confident update. Minimum required: ${ORACLE_UPDATE_THRESHOLDS.MIN_SOURCE_COUNT}`);
    return {
      shouldUpdate: false,
      reason: `Insufficient price sources (${sourceCount}) for confident update. Minimum required: ${ORACLE_UPDATE_THRESHOLDS.MIN_SOURCE_COUNT}`
    };
  }
  
  // Extract price in USD and convert to satoshis
  const priceInSatoshis = Math.round(currentPriceUSD * 100000000);
  
  console.log(`Latest aggregated price data: ${currentPriceUSD} USD (${priceInSatoshis} satoshis), Timestamp: ${new Date(currentTimestamp).toISOString()}, Sources: ${sourceCount}`);
  
  // Fetch the last submitted on-chain price from the blockchain
  const onChainPriceData = await readLatestOraclePrice();
  
  // Case: No on-chain price exists yet (first submission) - always submit
  if (!onChainPriceData.data?.price || onChainPriceData.error === OracleErrorCode.NO_PRICE_DATA) {
    console.log("No existing on-chain price data found. This appears to be the first submission.");
    return {
      shouldUpdate: true,
      reason: "Initial price submission (no existing on-chain data).",
      priceInSatoshis,
      currentTimestamp,
      percentChange: null,
      sourceCount,
    };
  }
  
  // Case: Error reading on-chain price (not NO_PRICE_DATA error)
  if (onChainPriceData.error && onChainPriceData.error !== OracleErrorCode.NO_PRICE_DATA) {
    console.error(`Error reading on-chain price: ${onChainPriceData.error}. Cannot determine if update is needed.`);
    return {
      shouldUpdate: false,
      reason: `Error reading on-chain price: ${onChainPriceData.error}. Cannot determine if update is needed.`,
    };
  }
  
  // Parse on-chain price and timestamp
  const lastSubmittedPriceStr = onChainPriceData.data!.price!;
  const lastSubmittedTimestampStr = onChainPriceData.data!.timestamp!;
  const lastSubmittedPrice = parseInt(lastSubmittedPriceStr, 10);
  const lastSubmittedTimestamp = parseInt(lastSubmittedTimestampStr, 10);
  
  if (isNaN(lastSubmittedPrice) || isNaN(lastSubmittedTimestamp)) {
    console.error(`Invalid on-chain price or timestamp format. Price: ${lastSubmittedPriceStr}, Timestamp: ${lastSubmittedTimestampStr}`);
    return {
      shouldUpdate: false,
      reason: `Invalid on-chain price or timestamp format. Cannot determine if update is needed.`,
    };
  }
  
  console.log(`Last on-chain price: ${lastSubmittedPrice} satoshis, Timestamp: ${lastSubmittedTimestamp} (${new Date(lastSubmittedTimestamp * 1000).toISOString()})`);
  
  // Calculate percentage change and time elapsed
  const percentChange = ((priceInSatoshis - lastSubmittedPrice) / lastSubmittedPrice) * 100;
  const absPercentChange = Math.abs(percentChange);
  
  // Convert block height timestamp to milliseconds for comparison
  // Stacks block timestamps are Unix timestamps in seconds, convert to milliseconds
  const lastSubmittedTimestampMs = lastSubmittedTimestamp * 1000;
  const timeElapsedMs = currentTimestamp - lastSubmittedTimestampMs;
  
  console.log(`Calculated metrics: ` +
    `Percent change: ${percentChange.toFixed(4)}% (absolute: ${absPercentChange.toFixed(4)}%), ` +
    `Time elapsed since last update: ${(timeElapsedMs / (60 * 1000)).toFixed(2)} minutes`);
  
  // Apply threshold checks
  
  // Check minimum time threshold (to prevent excessive updates)
  if (timeElapsedMs < ORACLE_UPDATE_THRESHOLDS.MIN_TIME_BETWEEN_UPDATES_MS) {
    const minutesSinceLastUpdate = (timeElapsedMs / (60 * 1000)).toFixed(2);
    const minimumMinutes = (ORACLE_UPDATE_THRESHOLDS.MIN_TIME_BETWEEN_UPDATES_MS / (60 * 1000)).toFixed(2);
    console.log(`Too soon since last update. Minutes elapsed: ${minutesSinceLastUpdate}, Minimum required: ${minimumMinutes}`);
    return {
      shouldUpdate: false,
      reason: `Minimum time between updates not yet reached. Minutes elapsed: ${minutesSinceLastUpdate}, Minimum required: ${minimumMinutes}`,
      priceInSatoshis,
      currentTimestamp,
      percentChange,
      sourceCount,
    };
  }
  
  // Check price change threshold
  const priceChangeExceedsThreshold = absPercentChange >= ORACLE_UPDATE_THRESHOLDS.MIN_PRICE_CHANGE_PERCENT;
  
  // Check maximum time threshold
  const timeExceedsMaxThreshold = timeElapsedMs >= ORACLE_UPDATE_THRESHOLDS.MAX_TIME_BETWEEN_UPDATES_MS;
  
  // Decision logic
  if (priceChangeExceedsThreshold) {
    console.log(`Price change (${absPercentChange.toFixed(4)}%) exceeds threshold (${ORACLE_UPDATE_THRESHOLDS.MIN_PRICE_CHANGE_PERCENT}%). Update recommended.`);
    return {
      shouldUpdate: true,
      reason: `Price change (${absPercentChange.toFixed(4)}%) exceeds threshold (${ORACLE_UPDATE_THRESHOLDS.MIN_PRICE_CHANGE_PERCENT}%).`,
      priceInSatoshis,
      currentTimestamp,
      percentChange,
      sourceCount,
    };
  } else if (timeExceedsMaxThreshold) {
    const hoursElapsed = (timeElapsedMs / (60 * 60 * 1000)).toFixed(2);
    const maxHours = (ORACLE_UPDATE_THRESHOLDS.MAX_TIME_BETWEEN_UPDATES_MS / (60 * 60 * 1000)).toFixed(2);
    console.log(`Maximum time threshold exceeded. Hours elapsed: ${hoursElapsed}, Maximum: ${maxHours}. Update recommended despite small price change.`);
    return {
      shouldUpdate: true,
      reason: `Maximum time threshold exceeded. Hours elapsed: ${hoursElapsed}, Maximum: ${maxHours}.`,
      priceInSatoshis,
      currentTimestamp,
      percentChange,
      sourceCount,
    };
  } else {
    console.log(`No update needed. Price change (${absPercentChange.toFixed(4)}%) below threshold and time elapsed (${(timeElapsedMs / (60 * 60 * 1000)).toFixed(2)} hours) within limits.`);
    return {
      shouldUpdate: false,
      reason: `Price change (${absPercentChange.toFixed(4)}%) below threshold and time elapsed (${(timeElapsedMs / (60 * 60 * 1000)).toFixed(2)} hours) within limits.`,
      priceInSatoshis,
      currentTimestamp,
      percentChange,
      sourceCount,
    };
  }
}

/**
 * Transaction configuration for Oracle operations
 */
export interface OracleTransactionConfig {
  network: any;
  senderAddress: string;
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  postConditionMode: PostConditionMode;
  anchorMode: AnchorMode;
  fee?: number;
}

/**
 * Builds and prepares the transaction options for setting a price in the Oracle contract.
 * 
 * @param {number} priceInSatoshis - The aggregated price in satoshis
 * @returns {OracleTransactionConfig} Transaction configuration
 */
export function buildSetPriceTransactionOptions(priceInSatoshis: number): OracleTransactionConfig {
  const oracleContract = getOracleContract();
  const network = getStacksNetwork();
  const senderAddress = getBackendAddress(NetworkEnvironment.TESTNET);
  
  console.log(`Building set-price transaction with price: ${priceInSatoshis} satoshis`);
  
  // Validate price
  if (!Number.isInteger(priceInSatoshis) || priceInSatoshis < 0) {
    throw new Error("Invalid price: must be a non-negative integer representing satoshis.");
  }
  
  // Create the price argument as a uint clarity value
  const priceArg = uintCV(priceInSatoshis);
  
  // Build the transaction
  return {
    network,
    senderAddress,
    contractAddress: oracleContract.address,
    contractName: oracleContract.name,
    functionName: 'set-aggregated-price',
    functionArgs: [priceArg],
    postConditionMode: PostConditionMode.Deny,
    anchorMode: AnchorMode.Any,
    fee: 50000, // Use a higher fee for faster confirmation
  };
}

/**
 * Interface for Oracle price submission
 */
export interface OraclePriceSubmission {
  priceInSatoshis: number;
}

/**
 * Submits the aggregated price to the oracle contract.
 * 
 * @param {OraclePriceSubmission} params - The price submission parameters
 * @returns {Promise<OracleSubmissionResult>} The transaction result
 */
export async function submitAggregatedPrice(params: OraclePriceSubmission): Promise<OracleSubmissionResult> {
  console.log(`submitAggregatedPrice initiated for price: ${params.priceInSatoshis}`);
  
  // Validate input price
  if (!Number.isInteger(params.priceInSatoshis) || params.priceInSatoshis < 0) {
    throw new Error("Invalid price format: must be a non-negative integer.");
  }
  
  try {
    // Build the transaction options
    const txOptions = buildSetPriceTransactionOptions(params.priceInSatoshis);
    
    // Convert to TransactionConfig expected by buildSignAndBroadcastTransaction
    const transactionConfig = {
      contractAddress: txOptions.contractAddress,
      contractName: txOptions.contractName,
      functionName: txOptions.functionName,
      functionArgs: txOptions.functionArgs,
      networkEnv: NetworkEnvironment.TESTNET,
      anchorMode: txOptions.anchorMode,
      postConditionMode: txOptions.postConditionMode,
      fee: txOptions.fee
    };
    
    // Sign and broadcast the transaction
    const signerKey = getBackendSignerKey();
    const result = await buildSignAndBroadcastTransaction(transactionConfig);
    
    console.log(`Transaction broadcast successfully. TxID: ${result.txId}`);
    
    // Return using the expected interface
    return { txid: result.txId || "" };
  } catch (error: any) {
    console.error(`Error submitting aggregated price: ${error.message}`, error);
    throw new Error(`Failed to submit aggregated price: ${error.message}`);
  }
}

/**
 * Checks if a price update is needed and submits if conditions are met.
 * 
 * @param {OracleSubmissionParams} params - The price data to evaluate
 * @returns {Promise<OracleSubmissionCheckResult>} The result of the check and submission
 */
export async function checkAndSubmitOraclePrice(params: OracleSubmissionParams): Promise<OracleSubmissionCheckResult> {
  console.log("checkAndSubmitOraclePrice running...");
  
  try {
    // Step 1: Check if we should update the price
    const evaluationResult = await prepareOracleSubmission(params);
    
    // If no update needed, return early
    if (!evaluationResult.shouldUpdate) {
      console.log(`No price update required. Reason: ${evaluationResult.reason}`);
      return {
        updated: false,
        reason: evaluationResult.reason,
      };
    }
    
    // Step 2: Submit the price update if needed
    console.log(`Price update required. Reason: ${evaluationResult.reason}. Submitting price: ${evaluationResult.priceInSatoshis} satoshis...`);
    
    const submissionResult = await submitAggregatedPrice({
      priceInSatoshis: evaluationResult.priceInSatoshis || 0
    });
    
    console.log(`Price update submitted. TxID: ${submissionResult.txid}`);
    
    // Return success result
    return {
      updated: true,
      txid: submissionResult.txid,
      reason: evaluationResult.reason,
      percentChange: evaluationResult.percentChange || undefined
    };
  } catch (error: any) {
    console.error(`Error in checkAndSubmitOraclePrice: ${error.message}`, error);
    return {
      updated: false,
      reason: `Error: ${error.message}`
    };
  }
} 