"use node";

import { query, action, internalAction, internalMutation } from './_generated/server';
import {
  ClarityValue,
  cvToJSON,
  principalCV,
  contractPrincipalCV,
  callReadOnlyFunction,
  AnchorMode,
  uintCV,
  makeContractCall,
  getAddressFromPrivateKey,
  TransactionSigner,
  PostConditionMode,
  broadcastTransaction,
  deserializeTransaction,
} from '@stacks/transactions';
import { StacksMainnet, StacksTestnet, StacksMocknet, StacksNetwork } from '@stacks/network';
import { api, internal } from './_generated/api';
import { v } from "convex/values";

// --- Wallet/Signer Configuration ---

/**
 * Retrieves the backend's Stacks private key from environment variables.
 * IMPORTANT: Set STACKS_PRIVATE_KEY in the Convex dashboard environment variables.
 * @throws {Error} If STACKS_PRIVATE_KEY environment variable is not set.
 * @returns {string} The Stacks private key.
 */
const getBackendSignerKey = (): string => {
  const privateKey = process.env.STACKS_PRIVATE_KEY;
  if (!privateKey) {
    console.error("CRITICAL: STACKS_PRIVATE_KEY environment variable is not set in Convex dashboard.");
    throw new Error("Backend signer key is not configured. Set STACKS_PRIVATE_KEY environment variable.");
  }
  // TODO: Add validation for the key format if necessary
  return privateKey;
};

// --- Network and Contract Configuration ---

/**
 * Retrieves the Stacks network configuration based on environment variables.
 * IMPORTANT: Set STACKS_NETWORK in the Convex dashboard environment variables (e.g., "devnet", "testnet", "mainnet").
 * IMPORTANT: If using "devnet" with a cloud provider (like Hiro), set STACKS_DEVNET_API_URL.
 * @throws {Error} If STACKS_NETWORK environment variable is not set or invalid.
 * @returns {StacksNetwork} The configured Stacks network object.
 */
const getStacksNetwork = (): StacksNetwork => {
  const networkEnv = process.env.STACKS_NETWORK?.toLowerCase();
  if (!networkEnv) {
    console.error("CRITICAL: STACKS_NETWORK environment variable is not set in Convex dashboard.");
    throw new Error("Stacks network is not configured. Set STACKS_NETWORK environment variable (e.g., 'devnet', 'testnet', 'mainnet').");
  }

  switch (networkEnv) {
    case "mainnet":
      // Consider adding STACKS_MAINNET_API_URL override if needed
      return new StacksMainnet(); 
    case "testnet":
      // Consider adding STACKS_TESTNET_API_URL override if needed
      return new StacksTestnet(); 
    case "devnet":
    case "mocknet": // Treat mocknet as devnet for configuration purposes
      const devnetApiUrl = process.env.STACKS_DEVNET_API_URL;
      if (!devnetApiUrl) {
        // Default to localhost:3999 if STACKS_DEVNET_API_URL is not set, with a warning.
        console.warn("STACKS_DEVNET_API_URL environment variable is not set. Defaulting to local DevNet API at http://localhost:3999. If using Hiro Platform or other cloud DevNet, ensure STACKS_DEVNET_API_URL is set correctly in Convex dashboard.");
        return new StacksMocknet(); // Default to localhost
      } else {
        // Use the custom URL if STACKS_DEVNET_API_URL is set.
        console.log(`Using custom Devnet API URL from STACKS_DEVNET_API_URL: ${devnetApiUrl}`);
        return new StacksMocknet({ url: devnetApiUrl }); 
      }
    default:
      console.error(`CRITICAL: Invalid STACKS_NETWORK environment variable value: "${networkEnv}".`);
      throw new Error(`Invalid STACKS_NETWORK. Use 'devnet', 'testnet', or 'mainnet'. Found: ${networkEnv}`);
  }
};

/**
 * Retrieves the Oracle contract details from environment variables.
 * IMPORTANT: Set ORACLE_CONTRACT_ADDRESS and ORACLE_CONTRACT_NAME in the Convex dashboard.
 * @throws {Error} If required environment variables are missing.
 * @returns {{ contractAddress: string, contractName: string }} Oracle contract details.
 */
const getOracleContractInfo = (): { contractAddress: string; contractName: string } => {
  const contractAddress = process.env.ORACLE_CONTRACT_ADDRESS;
  const contractName = process.env.ORACLE_CONTRACT_NAME;

  if (!contractAddress || !contractName) {
    console.error("CRITICAL: Oracle contract details are not fully configured in Convex environment variables.");
    throw new Error("Missing ORACLE_CONTRACT_ADDRESS or ORACLE_CONTRACT_NAME environment variable.");
  }

  // Basic validation (can be enhanced)
  if (!contractAddress.includes('.') || contractAddress.split('.').length !== 1) {
      // Basic check if it looks like a principal (ST...) rather than identifier (ST....contract)
      // Allows passing just the address if contract name is separate
  } else {
      console.warn(`ORACLE_CONTRACT_ADDRESS might be a full identifier ("${contractAddress}"). Usually, only the address part is needed.`);
      // Optionally split here if needed: const [addr, _] = contractAddress.split('.'); contractAddress = addr;
  }

  return { contractAddress, contractName };
};

// --- Oracle Threshold Configuration ---

/**
 * Configuration for update thresholds. These could eventually be moved to environment variables or 
 * a configuration table in the database for easier tuning without code changes.
 */
const ORACLE_UPDATE_THRESHOLDS = {
  // Minimum percentage change in price to trigger an update (e.g., 0.5 = 0.5%)
  MIN_PRICE_CHANGE_PERCENT: 0.5,
  
  // Maximum time (in milliseconds) to allow between updates regardless of price change
  // Default: 6 hours (in milliseconds)
  MAX_TIME_BETWEEN_UPDATES_MS: 6 * 60 * 60 * 1000,
  
  // Minimum time (in milliseconds) to enforce between updates regardless of price change
  // to prevent excessive updates/fees in volatile markets
  // Default: 30 minutes (in milliseconds)
  MIN_TIME_BETWEEN_UPDATES_MS: 30 * 60 * 1000,
  
  // Minimum number of price sources required for confidence in the update
  MIN_SOURCE_COUNT: 3,
};

// Use the helper functions
const network = getStacksNetwork();
const { contractAddress: ORACLE_CONTRACT_ADDRESS, contractName: ORACLE_CONTRACT_NAME } = getOracleContractInfo();
const stacksApiUrl = network.coreApiUrl;

// Configure Stacks API Client for nonce fetching
// Avoid direct AccountsApi instantiation since it might not be available in this context
// Instead, use fetch directly when needed

// --- Blockchain Interaction Functions ---

/**
 * LEGACY ADAPTER: This function uses the new modular Oracle implementation.
 * It is maintained for backward compatibility.
 */
export const readLatestOraclePrice = internalAction({
  handler: async (ctx): Promise<{ price: string | null, timestamp: string | null, error?: string }> => {
    console.log("Legacy adapter: Redirecting to new Oracle implementation");
    return await ctx.runAction(internal.blockchain.oracle.adapter.readLatestOraclePriceAdapter, {});
  },
});

/**
 * LEGACY ADAPTER: This function uses the new modular Oracle implementation.
 * It is maintained for backward compatibility.
 */
export const prepareOracleSubmission = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    shouldUpdate: boolean;
    reason: string;
    priceInSatoshis?: number;
    currentTimestamp?: number;
    percentChange?: number | null;
    sourceCount?: number;
  }> => {
    console.log("Legacy adapter: Redirecting to new Oracle implementation");
    
    // Get the latest aggregated price data to pass to the adapter
    const latestAggregatedPriceData = await ctx.runQuery(api.prices.getLatestPrice, {});
    
    if (!latestAggregatedPriceData) {
      return { 
        shouldUpdate: false, 
        reason: "No aggregated price data available in the database." 
      };
    }
    
    // Call the adapter with the price data
    return await ctx.runAction(internal.blockchain.oracle.adapter.prepareOracleSubmissionAdapter, {
      price: latestAggregatedPriceData.price,
      timestamp: latestAggregatedPriceData.timestamp,
      sourceCount: latestAggregatedPriceData.sourceCount
    });
  }
});

/**
 * LEGACY ADAPTER: This function uses the new modular Oracle implementation.
 * It is maintained for backward compatibility.
 */
export const submitAggregatedPrice = action({
  args: { priceInSatoshis: v.number() },
  handler: async (ctx, { priceInSatoshis }): Promise<{ txid: string }> => {
    console.log("Legacy adapter: Redirecting to new Oracle implementation");
    return await ctx.runAction(api.blockchain.oracle.adapter.submitAggregatedPriceAdapter, {
      priceInSatoshis
    });
  },
});

/**
 * LEGACY ADAPTER: This function uses the new modular Oracle implementation.
 * It is maintained for backward compatibility.
 */
export const checkAndSubmitOraclePrice = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    console.log("Legacy adapter: Redirecting to new Oracle implementation");
    
    // Get the latest aggregated price data to pass to the adapter
    const latestAggregatedPriceData = await ctx.runQuery(api.prices.getLatestPrice, {});
    
    if (!latestAggregatedPriceData) {
      console.log("No aggregated price data available in the database. Cannot check for submission.");
      return;
    }
    
    // Call the adapter with the price data
    const result = await ctx.runAction(internal.blockchain.oracle.adapter.checkAndSubmitOraclePriceAdapter, {
      price: latestAggregatedPriceData.price,
      timestamp: latestAggregatedPriceData.timestamp,
      sourceCount: latestAggregatedPriceData.sourceCount
    });
    
    // Record the submission (if a transaction was created)
    // Note: In the new architecture, this would be handled elsewhere,
    // but we keep it here for compatibility
    if (result && result.txid) {
      try {
        await ctx.runMutation(internal.oracleSubmissions.recordOracleSubmission, {
          txid: result.txid,
          submittedPriceSatoshis: Math.round(latestAggregatedPriceData.price * 100000000), // Convert to satoshis
          reason: result.reason || "Price update required",
          percentChange: result.percentChange,
          sourceCount: latestAggregatedPriceData.sourceCount || 0,
          status: "submitted",
        });
      } catch (recordError: any) {
        console.error(`Error recording oracle submission to DB (TxID: ${result.txid}): ${recordError.message}`, recordError);
      }
    }
  },
});

// --- Transaction Building (BI-302) ---

/**
 * Internal helper to build the transaction options for calling `set-aggregated-price`.
 * Does NOT sign or broadcast the transaction.
 *
 * @param {object} args - The arguments object.
 * @param {number} args.price - The aggregated price in the smallest unit (e.g., satoshis or equivalent scaled integer).
 * @returns {Promise<object>} The transaction options object for use with Stacks.js signing/broadcasting.
 */
const buildSetPriceTransactionOptions = async ({ price }: { price: number }): Promise<object> => {
  console.log(`Building transaction options for set-aggregated-price with price: ${price}`);

  // Ensure price is a non-negative integer
  if (!Number.isInteger(price) || price < 0) {
    throw new Error(`Invalid price format for transaction building: must be a non-negative integer. Received: ${price}`);
  }

  const functionArgs = [
    uintCV(BigInt(price)), // price: uint
    // The contract now uses burn-block-height internally for the timestamp
  ];

  // We need the sender's private key to get the public key for nonce retrieval,
  // but nonce retrieval itself happens later during signing/broadcasting.
  // For now, we just prepare the core options.
  // The actual sender address will be derived from the private key in the signing step.
  const txOptions = {
    contractAddress: ORACLE_CONTRACT_ADDRESS,
    contractName: ORACLE_CONTRACT_NAME,
    functionName: 'set-aggregated-price',
    functionArgs: functionArgs,
    anchorMode: AnchorMode.Any, // Standard mode
    network: network,
    // senderKey, postConditionMode, postConditions, nonce will be added during signing/broadcasting
  };

  // FIX: Remove problematic JSON.stringify causing BigInt serialization error
  // console.log("Transaction options built (unsigned):", JSON.stringify(txOptions, null, 2));
  return txOptions;
};

// --- Transaction Signing (BI-303) ---

/**
 * Internal action to sign the `set-aggregated-price` transaction using the backend identity.
 *
 * @param {object} args - The arguments object.
 * @param {number} args.price - The aggregated price in the smallest unit (e.g., satoshis).
 * @returns {Promise<string>} The signed Stacks transaction object serialized to a hex string.
 * @throws {Error} If nonce fetching or signing fails.
 */
export const signSetPriceTransaction = internalAction({
  args: { price: v.number() }, // Use Convex validation
  handler: async (ctx, { price }): Promise<string> => {
    console.log(`Signing transaction for set-aggregated-price with price: ${price}`);

    // 1. Build base transaction options
    const baseTxOptions = await buildSetPriceTransactionOptions({ price });

    // 2. Get backend signer key
    const privateKey = getBackendSignerKey();
    const senderAddress = getAddressFromPrivateKey(privateKey, network.version);
    console.log(`Signer address derived from private key: ${senderAddress}`);

    // 3. Fetch nonce -- Re-enabled dynamic fetching
    let nonce = 0; // Default to 0
    try {
      // Instead of accountsApi.getAccountInfo, use direct fetch
      nonce = await fetchAccountNonce(senderAddress);
    } catch (error: any) {
      console.error(`Error fetching nonce for ${senderAddress}:`, error);
      throw new Error(`Failed to fetch nonce: ${error.message}`);
    }
    // const nonce = 5; // <<< REMOVED HARDCODED NONCE >>>
    // console.log(`<<< USING HARDCODED NONCE: ${nonce} >>>`);

    // 4. Assemble final options and sign
    const txOptions = {
      ...baseTxOptions, // Spread the options from build step
      senderKey: privateKey,
      nonce: nonce,
      postConditionMode: PostConditionMode.Allow, // Allow any post conditions for simplicity
      // FIX: Explicitly set a fee to bypass estimation failure on Hiro Devnet API
      fee: 1000, 
    };

    try {
      // console.log("Calling makeContractCall with options:", JSON.stringify({ ...txOptions, senderKey: '[REDACTED]' }, null, 2));
      const signedTransaction = await makeContractCall(txOptions as any); 

      // FIX: Serialize the transaction to hex before returning
      // Convert Buffer to hex string properly
      const serializedTx = Buffer.from(signedTransaction.serialize()).toString('hex');
      console.log(`Transaction signed successfully. Serialized Hex (first 64 chars): ${serializedTx.substring(0, 64)}...`);
      
      // Return the hex string, not the object
      return serializedTx; 

    } catch (error: any) {
      console.error('Error signing transaction:', error);
      throw new Error(`Failed to sign transaction: ${error.message}`);
    }
  },
});

// Instead of accountsApi.getAccountInfo, use direct fetch
async function fetchAccountNonce(address: string): Promise<number> {
  try {
    const response = await fetch(`${stacksApiUrl}/extended/v1/address/${address}/nonces`);
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Account ${address} not found on chain, assuming nonce 0.`);
        return 0;
      }
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    // Use the possible_next_nonce for the upcoming transaction
    const nextNonce = data.possible_next_nonce;
    console.log(`Fetched nonces for ${address}: Last Executed: ${data.last_executed_tx_nonce}, Possible Next: ${nextNonce}`);
    
    if (typeof nextNonce !== 'number') {
        console.error("Possible next nonce is not a number:", nextNonce);
        // Fallback or throw error? Let's try falling back to last_executed + 1, but log clearly
        const fallbackNonce = (data.last_executed_tx_nonce ?? -1) + 1;
        console.warn(`Falling back to calculated nonce: ${fallbackNonce}`);
        return fallbackNonce; 
    }

    return nextNonce; 
  } catch (error: any) {
    console.error(`Error fetching nonce for ${address}:`, error);
    if (error.message && error.message.includes('not found')) {
      console.warn(`Account ${address} not found or has no transactions, assuming nonce 0.`);
      return 0;
    }
    throw new Error(`Failed to fetch nonce: ${error.message}`);
  }
}

// --- Transaction Broadcasting (BI-304) ---

/**
 * Internal action to broadcast a signed Stacks transaction.
 *
 * @param {object} args - The arguments object.
 * @param {string} args.serializedTxHex - The signed transaction object serialized to a hex string.
 * @returns {Promise<{ txid: string }>} The transaction ID if broadcast is successful.
 * @throws {Error} If broadcasting fails or returns an error response.
 */
export const broadcastSignedTransaction = internalAction({
  args: {
    serializedTxHex: v.string(),
  },
  handler: async (_ctx, { serializedTxHex }): Promise<{ txid: string }> => {
    console.log("Broadcasting signed transaction...");

    if (!serializedTxHex || serializedTxHex.length === 0) { 
        throw new Error("Invalid or empty serialized transaction hex received for broadcasting.");
    }

    try {
      // FIX: Deserialize the hex string back into a StacksTransaction object
      // Convert hex string to Buffer before deserializing
      const transaction = deserializeTransaction(Buffer.from(serializedTxHex, 'hex'));
      
      // Now broadcast the actual transaction object
      const result = await broadcastTransaction(transaction, network); 

      console.log("Broadcast result:", result);

      // Check if the broadcast returned an error
      if (result && typeof result === 'object' && 'error' in result && result.error) {
        const errorDetails = result.error as any; // Type assertion for easier access
        const reason = errorDetails.reason || 'Unknown reason';
        const reasonData = errorDetails.reason_data ? JSON.stringify(errorDetails.reason_data) : 'No reason data';
        const txid = errorDetails.txid || 'No txid in error';
        
        console.error(`Transaction broadcast failed: ${errorDetails.error || 'No error message'}. Reason: ${reason}. Data: ${reasonData}. TxID: ${txid}`);
        throw new Error(`Transaction broadcast failed: ${reason}. TxID: ${txid}. Data: ${reasonData}`);
      }

      // Check if txid is missing in a success-like response
      if (!result || typeof result !== 'object' || !('txid' in result) || !result.txid) {
         console.error("Broadcast seemed successful but txid is missing:", result);
         throw new Error("Transaction broadcast status uncertain: txid missing from response.");
      }

      // Broadcast was accepted by the node, return the txid
      console.log(`Transaction broadcast successful. TxId: ${result.txid}`);
      return { txid: result.txid };

    } catch (error: any) {
      console.error("Error during transaction broadcast:", error);
      // Rethrow or handle specific broadcast errors as needed
      throw new Error(`Failed to broadcast transaction: ${error.message || error}`);
    }
  },
}); 