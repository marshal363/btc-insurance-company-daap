/**
 * Transaction Management Module
 *
 * This module handles all transaction-related operations like building, signing, and broadcasting.
 * It provides utilities for constructing transaction options, signing, and monitoring transactions.
 */

// Handle browser environments that don't have Buffer
// This is needed because Convex serverless functions run in a browser-like environment
// that doesn't have the Node.js Buffer global
let hasBuffer = false;
try {
  // Check if Buffer exists
  hasBuffer = typeof Buffer !== 'undefined';
  if (!hasBuffer) {
    console.log("Buffer not available in this environment - transaction serialization will use alternate approach");
  }
} catch (err) {
  console.warn("Error checking Buffer availability:", err);
}

import {
  ClarityValue,
  makeContractCall,
  getAddressFromPrivateKey,
  TransactionSigner,
  AnchorMode,
  PostConditionMode,
  deserializeTransaction,
  broadcastTransaction,
} from '@stacks/transactions';
import { fetchAccountNonce, getStacksNetwork } from './network';
import { NetworkEnvironment, BlockchainWriteResponse, TransactionStatus } from './types';

/**
 * Get the backend's private key for signing transactions
 * @returns The private key from environment variables
 * @throws Error if the private key is not configured
 */
export function getBackendSignerKey(): string {
  const privateKey = process.env.STACKS_PRIVATE_KEY;
  if (!privateKey) {
    console.error("CRITICAL: STACKS_PRIVATE_KEY environment variable is not set in Convex dashboard.");
    throw new Error("Backend signer key is not configured. Set STACKS_PRIVATE_KEY environment variable.");
  }
  return privateKey;
}

/**
 * Get the backend's address derived from the private key
 * @param networkEnv Network environment to derive the address for
 * @returns The Stacks address corresponding to the backend's private key
 * @throws Error if the private key is not configured
 */
export function getBackendAddress(networkEnv: NetworkEnvironment): string {
  const privateKey = getBackendSignerKey();
  const network = getStacksNetwork(networkEnv);
  return getAddressFromPrivateKey(privateKey, network.version);
}

/**
 * Basic transaction configuration
 */
interface TransactionConfig {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  networkEnv: NetworkEnvironment;
  senderKey?: string;
  fee?: number;
  nonce?: number;
  anchorMode?: AnchorMode;
  postConditionMode?: PostConditionMode;
  postConditions?: any[];
}

/**
 * Build a transaction for contract call
 * @param config Transaction configuration
 * @returns Promise resolving to a transaction options object
 */
export async function buildTransaction(config: TransactionConfig): Promise<any> {
  console.log(`Building transaction for ${config.contractName}.${config.functionName}`);
  
  // Default to backend signer if not provided
  const senderKey = config.senderKey || getBackendSignerKey();
  const network = getStacksNetwork(config.networkEnv);
  const senderAddress = getAddressFromPrivateKey(senderKey, network.version);
  
  // Fetch nonce if not provided
  let nonce = config.nonce;
  if (nonce === undefined) {
    try {
      nonce = await fetchAccountNonce(senderAddress);
    } catch (error: any) {
      console.error(`Error fetching nonce for ${senderAddress}:`, error);
      throw new Error(`Failed to fetch nonce: ${error.message}`);
    }
  }
  
  // Build transaction options
  const txOptions = {
    contractAddress: config.contractAddress,
    contractName: config.contractName,
    functionName: config.functionName,
    functionArgs: config.functionArgs,
    senderKey: senderKey,
    network: network,
    nonce: nonce,
    fee: config.fee || 1000, // Default fee
    anchorMode: config.anchorMode || AnchorMode.Any,
    postConditionMode: config.postConditionMode || PostConditionMode.Allow,
    postConditions: config.postConditions || [],
  };
  
  console.log(`Transaction built for ${config.contractName}.${config.functionName} with nonce ${nonce}`);
  return txOptions;
}

/**
 * Sign a transaction for contract call
 * @param txOptions Transaction options created with buildTransaction
 * @returns Promise resolving to the serialized signed transaction as a hex string
 */
export async function signTransaction(txOptions: any): Promise<string> {
  console.log(`Signing transaction for ${txOptions.contractName}.${txOptions.functionName}`);
  
  try {
    // Check if Buffer exists in the environment
    console.log("Buffer availability check:", hasBuffer ? "Buffer is defined" : "Buffer is NOT defined");
    
    const signedTransaction = await makeContractCall(txOptions);
    console.log("Transaction contract call completed successfully");
    
    // Store the signed transaction for direct broadcasting if needed
    // @ts-ignore - adding custom property
    txOptions.__signedTransaction = signedTransaction;
    
    // If Buffer is not available, return a special marker and store the transaction
    if (!hasBuffer) {
      console.log("Using direct transaction approach instead of serialization due to missing Buffer");
      // Return a special marker that broadcastSignedTransaction will recognize
      return `DIRECT_TX:${txOptions.contractName}.${txOptions.functionName}`;
    }
    
    // Safely handle serialization with explicit error checking
    try {
      // Serialize transaction to hex string
      console.log("About to serialize transaction");
      const serializedTx = Buffer.from(signedTransaction.serialize()).toString('hex');
      console.log(`Transaction signed successfully. Serialized Hex (first 64 chars): ${serializedTx.substring(0, 64)}...`);
      
      return serializedTx;
    } catch (serializeError: any) {
      console.error("Error in transaction serialization step:", serializeError);
      throw new Error(`Failed to serialize transaction: ${serializeError.message}`);
    }
  } catch (error: any) {
    console.error('Error signing transaction:', error);
    throw new Error(`Failed to sign transaction: ${error.message}`);
  }
}

/**
 * Broadcast a signed transaction to the network
 * @param serializedTxHex Serialized transaction hex string from signTransaction or DIRECT_TX marker
 * @param networkEnv Network environment to broadcast on
 * @param txOptions Optional transaction options with __signedTransaction when using direct approach
 * @returns Promise resolving to the broadcast result with transaction ID
 */
export async function broadcastSignedTransaction(
  serializedTxHex: string, 
  networkEnv: NetworkEnvironment,
  txOptions?: any
): Promise<BlockchainWriteResponse> {
  console.log("Broadcasting signed transaction...");
  const network = getStacksNetwork(networkEnv);
  
  try {
    let transaction;
    
    // Check if we're using the direct transaction approach
    if (serializedTxHex.startsWith('DIRECT_TX:')) {
      console.log("Using direct transaction approach for broadcasting");
      if (!txOptions || !txOptions.__signedTransaction) {
        throw new Error("Direct transaction requested but signed transaction not found in options");
      }
      transaction = txOptions.__signedTransaction;
    } else {
      // Traditional approach using serialized hex
      console.log("Using serialized transaction approach for broadcasting");
      // Deserialize the hex string back into a StacksTransaction object
      transaction = deserializeTransaction(Buffer.from(serializedTxHex, 'hex'));
    }
    
    // Broadcast the transaction
    const result = await broadcastTransaction(transaction, network);
    
    console.log("Broadcast result:", result);
    
    // Check if the broadcast returned an error
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      const rawError = String(result.error);
      const rawReason = ('reason' in result && typeof result.reason === 'string') ? result.reason : 'Unknown reason';
      const rawTxId = ('txid'in result && typeof result.txid === 'string') ? result.txid : 'No txid in error';
      let rawReasonDataStr = ('reason_data' in result && result.reason_data) ? JSON.stringify(result.reason_data) : 'No reason data';
      let finalErrorMessage = `Transaction broadcast failed: ${rawError}. Reason: ${rawReason}. TxID: ${rawTxId}. Data: ${rawReasonDataStr}`;
      let expectedNonceForRetry: number | undefined = undefined;

      if (rawReason === 'BadNonce' && 'reason_data' in result && typeof result.reason_data === 'object' && result.reason_data !== null) {
        const nonceData = result.reason_data as any;
        if (nonceData.expected !== undefined && nonceData.actual !== undefined) {
          expectedNonceForRetry = Number(nonceData.expected);
          rawReasonDataStr = `BadNonce: Got ${nonceData.actual}, Expected ${expectedNonceForRetry}`;
          finalErrorMessage = `Transaction rejected due to BadNonce. Expected: ${expectedNonceForRetry}, Actual: ${nonceData.actual}. TxID: ${rawTxId}.`;
        }
      }
      
      console.error(finalErrorMessage, result); // Log the full error message and the original result object

      return {
        success: false,
        txId: rawTxId, // Include TxID even on failure if available
        error: finalErrorMessage, // This is the descriptive message
        data: result,
        // Add errorType and expectedNonce if it's a BadNonce error eligible for retry
        ...(rawReason === 'BadNonce' && expectedNonceForRetry !== undefined && { errorType: 'BadNonce', expectedNonce: expectedNonceForRetry })
      };
    }
    
    // Check if txid is missing in a success-like response
    if (!result || typeof result !== 'object' || !('txid' in result) || !result.txid) {
      console.error("Broadcast seemed successful but txid is missing:", result);
      return {
        success: false,
        error: "Transaction broadcast status uncertain: txid missing from response.",
        data: result,
      };
    }
    
    // Broadcast was accepted by the node, return the txid
    console.log(`Transaction broadcast successful. TxId: ${result.txid}`);
    return {
      success: true,
      txId: result.txid,
      data: result,
    };
  } catch (error: any) {
    console.error("Error during transaction broadcast:", error);
    return {
      success: false,
      error: `Failed to broadcast transaction: ${error.message || error}`,
      data: error,
    };
  }
}

/**
 * Build, sign, and broadcast a transaction in one operation
 * @param config Transaction configuration
 * @param retryAttempt Number of times this transaction has been attempted
 * @returns Promise resolving to the broadcast result with transaction ID
 */
export async function buildSignAndBroadcastTransaction(
  config: TransactionConfig,
  retryAttempt: number = 0 // Added for retry limiting
): Promise<BlockchainWriteResponse> {
  const MAX_RETRIES = 1; // Allow one retry for BadNonce

  try {
    // Build and sign the transaction
    const txOptions = await buildTransaction(config);
    const serializedTxOrMarker = await signTransaction(txOptions);
    
    // Broadcast the transaction
    const broadcastResult = await broadcastSignedTransaction(serializedTxOrMarker, config.networkEnv, txOptions);

    // Check for BadNonce specific errorType from our updated broadcastSignedTransaction response
    if (!broadcastResult.success && broadcastResult.errorType === 'BadNonce' && broadcastResult.expectedNonce !== undefined) {
      if (retryAttempt < MAX_RETRIES) {
        console.log(`BadNonce detected (attempt ${retryAttempt + 1}/${MAX_RETRIES + 1}). Retrying with expected nonce: ${broadcastResult.expectedNonce}. Original TxID: ${broadcastResult.txId || 'N/A'}`);
        const newConfig = { ...config, nonce: broadcastResult.expectedNonce };
        // Recursively call self, incrementing retryAttempt
        return buildSignAndBroadcastTransaction(newConfig, retryAttempt + 1);
      } else {
        const finalErrorMsg = `Transaction failed after ${MAX_RETRIES + 1} attempts due to persistent BadNonce. Last expected nonce: ${broadcastResult.expectedNonce}. Last TxID: ${broadcastResult.txId || 'N/A'}. Original error: ${broadcastResult.error}`;
        console.error(finalErrorMsg);
        // Return the error from the last failed attempt, ensuring a clear message
        return {
            success: false,
            error: finalErrorMsg,
            txId: broadcastResult.txId,
            data: broadcastResult.data,
            errorType: 'BadNoncePersistence' // Custom error type for final failure
        };
      }
    }
    return broadcastResult; // Return original result if not BadNonce or no retry needed / successful retry

  } catch (error: any) {
    console.error("Error in buildSignAndBroadcastTransaction:", error);
    return {
      success: false,
      error: `Transaction processing failed: ${error.message || error}`,
      data: error,
    };
  }
}

/**
 * Check the status of a transaction
 * @param txid Transaction ID to check
 * @param networkEnv Network environment the transaction was sent to
 * @returns Promise resolving to the transaction status
 */
export async function checkTransactionStatus(
  txid: string, 
  networkEnv: NetworkEnvironment
): Promise<{ status: TransactionStatus, blockHeight?: number, error?: string }> {
  console.log(`Checking status for transaction ${txid}`);
  const network = getStacksNetwork(networkEnv);
  const apiUrl = network.coreApiUrl;
  
  try {
    const response = await fetch(`${apiUrl}/extended/v1/tx/${txid}`);
    
    if (!response.ok) {
      // Handle different error status codes
      if (response.status === 404) {
        // Transaction not found yet, might still be pending
        return { status: TransactionStatus.PENDING };
      }
      
      const errorText = await response.text();
      console.error(`Error fetching transaction status: ${response.status} ${response.statusText} - ${errorText}`);
      return { 
        status: TransactionStatus.PENDING, 
        error: `Failed to fetch transaction status: ${response.status} ${response.statusText}` 
      };
    }
    
    const data = await response.json();
    
    // Check the transaction status
    if (data.tx_status === 'success') {
      return { 
        status: TransactionStatus.CONFIRMED, 
        blockHeight: data.block_height 
      };
    } else if (data.tx_status === 'pending') {
      return { status: TransactionStatus.PENDING };
    } else if (data.tx_status === 'failed') {
      return { 
        status: TransactionStatus.FAILED, 
        error: data.tx_result || 'Transaction execution failed' 
      };
    } else if (data.tx_status === 'abort_by_post_condition') {
      return { 
        status: TransactionStatus.FAILED, 
        error: 'Transaction aborted by post condition' 
      };
    } else if (data.tx_status === 'dropped_replace_by_fee') {
      return { 
        status: TransactionStatus.REPLACED, 
        error: 'Transaction was replaced by a higher fee transaction' 
      };
    } else {
      return { 
        status: TransactionStatus.PENDING, 
        error: `Unknown transaction status: ${data.tx_status}` 
      };
    }
  } catch (error: any) {
    console.error(`Error checking transaction status: ${error.message}`, error);
    return { 
      status: TransactionStatus.PENDING, 
      error: `Failed to check transaction status: ${error.message}` 
    };
  }
} 