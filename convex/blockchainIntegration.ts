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
      return new StacksMainnet();
    case "testnet":
      return new StacksTestnet();
    case "devnet":
    case "mocknet": // Treat mocknet as devnet for configuration purposes
      return new StacksMocknet();
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
 * Reads the latest price data from the on-chain oracle contract.
 * This can be called directly from the frontend using the Convex client.
 *
 * @returns {Promise<{ price: string | null, timestamp: string | null, error?: string }>} // Return strings for Convex compatibility
 *          An object containing the price and timestamp as strings if successful,
 *          or null values and an error message if the read fails or returns no data.
 */
export const readLatestOraclePrice = query({
  handler: async (ctx): Promise<{ price: string | null, timestamp: string | null, error?: string }> => {
    console.log(`Reading latest price from ${ORACLE_CONTRACT_ADDRESS}.${ORACLE_CONTRACT_NAME}`);

    try {
      const options = {
        contractAddress: ORACLE_CONTRACT_ADDRESS,
        contractName: ORACLE_CONTRACT_NAME,
        functionName: 'get-latest-price',
        functionArgs: [], // No arguments for get-latest-price
        network: network,
        senderAddress: ORACLE_CONTRACT_ADDRESS, // Sender address doesn't matter for read-only calls, but required
      };

      const resultCV: ClarityValue = await callReadOnlyFunction(options);
      const resultJson = cvToJSON(resultCV);

      if (resultJson.type.startsWith('(ok')) {
        const priceStr = resultJson.value?.value?.price?.value;
        const timestampStr = resultJson.value?.value?.timestamp?.value;

        if (priceStr && timestampStr) {
          console.log(`Successfully read price: ${priceStr}, timestamp: ${timestampStr} from oracle.`);
          return {
            price: priceStr, // Return as string
            timestamp: timestampStr, // Return as string
          };
        } else {
           console.error('Error parsing successful response from get-latest-price:', JSON.stringify(resultJson, null, 2));
           return { price: null, timestamp: null, error: 'Error parsing successful response structure.' };
        }
      } else if (resultJson.type.startsWith('(err')) {
         const errorCode = resultJson.value?.value; // e.g., '104' for ERR-NO-PRICE-DATA
         console.warn(`Oracle contract returned error: ${errorCode}. Price data might not be available yet.`);
         if (errorCode === '104') {
            return { price: null, timestamp: null, error: 'ERR_NO_PRICE_DATA' };
         }
         if (errorCode === '102') {
             console.warn(`Oracle contract returned ERR_TIMESTAMP_TOO_OLD (u102). Data is stale.`);
             return { price: null, timestamp: null, error: 'ERR_TIMESTAMP_TOO_OLD' };
         }
         return { price: null, timestamp: null, error: `Oracle contract error code: ${errorCode}` };
      } else {
         console.error('Unexpected response structure from get-latest-price:', JSON.stringify(resultJson, null, 2));
         return { price: null, timestamp: null, error: 'Unexpected response structure.' };
      }

    } catch (error: any) {
      console.error('Error calling read-only function get-latest-price:', error);
      return {
        price: null,
        timestamp: null,
        error: error.message || 'Failed to read from oracle contract.',
      };
    }
  },
});

/**
 * Prepares the latest aggregated price data for submission to the oracle contract.
 * Implements the multi-factor threshold logic (CVX-301) to determine if an update should be performed.
 * 
 * This action:
 * 1. Fetches the latest aggregated price from the Convex DB
 * 2. Fetches the last submitted on-chain price from the blockchain
 * 3. Evaluates if an update is needed based on configured thresholds:
 *    - Price change percentage threshold
 *    - Maximum time since last update threshold
 *    - Minimum time between updates threshold
 *    - Minimum source count threshold
 * 4. If update is needed, returns the price data; if not, returns a result indicating no update needed
 * 
 * @returns {Promise<{ shouldUpdate: boolean, reason: string, priceInSatoshis?: number, currentTimestamp?: number, percentChange?: number | null, sourceCount?: number }>}
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
    console.log("prepareOracleSubmission action running with multi-factor threshold logic...");
    
    // Step 1: Fetch the latest aggregated price from the Convex DB
    const latestAggregatedPriceData = await ctx.runQuery(api.prices.getLatestPrice, {});
    
    if (!latestAggregatedPriceData) {
      console.warn("No aggregated price data available in the database. Cannot prepare oracle submission.");
      return { 
        shouldUpdate: false, 
        reason: "No aggregated price data available in the database." 
      };
    }

    // Check minimum source count threshold
    if (latestAggregatedPriceData.sourceCount !== undefined && 
        latestAggregatedPriceData.sourceCount < ORACLE_UPDATE_THRESHOLDS.MIN_SOURCE_COUNT) {
      console.warn(`Insufficient price sources (${latestAggregatedPriceData.sourceCount}) for confident update. Minimum required: ${ORACLE_UPDATE_THRESHOLDS.MIN_SOURCE_COUNT}`);
      return {
        shouldUpdate: false,
        reason: `Insufficient price sources (${latestAggregatedPriceData.sourceCount}) for confident update. Minimum required: ${ORACLE_UPDATE_THRESHOLDS.MIN_SOURCE_COUNT}`
      };
    }
    
    // Extract price in USD and convert to satoshis
    const currentPriceUSD = latestAggregatedPriceData.price;
    const priceInSatoshis = Math.round(currentPriceUSD * 100000000);
    const currentTimestamp = latestAggregatedPriceData.timestamp;
    
    console.log(`Latest aggregated price data: ${currentPriceUSD} USD (${priceInSatoshis} satoshis), Timestamp: ${new Date(currentTimestamp).toISOString()}, Sources: ${latestAggregatedPriceData.sourceCount}`);
    
    // Step 2: Fetch the last submitted on-chain price from the blockchain
    const onChainPriceData = await ctx.runQuery(api.blockchainIntegration.readLatestOraclePrice, {});
    
    // Case: No on-chain price exists yet (first submission) - always submit
    if (!onChainPriceData.price || onChainPriceData.error === 'ERR_NO_PRICE_DATA') {
      console.log("No existing on-chain price data found. This appears to be the first submission.");
      return {
        shouldUpdate: true,
        reason: "Initial price submission (no existing on-chain data).",
        priceInSatoshis,
        currentTimestamp,
        percentChange: null,
        sourceCount: latestAggregatedPriceData.sourceCount,
      };
    }
    
    // Case: Error reading on-chain price (not NO_PRICE_DATA error)
    if (onChainPriceData.error && onChainPriceData.error !== 'ERR_NO_PRICE_DATA') {
      console.error(`Error reading on-chain price: ${onChainPriceData.error}. Cannot determine if update is needed.`);
      return {
        shouldUpdate: false,
        reason: `Error reading on-chain price: ${onChainPriceData.error}. Cannot determine if update is needed.`,
      };
    }
    
    // Parse on-chain price and timestamp
    const lastSubmittedPriceStr = onChainPriceData.price!;
    const lastSubmittedTimestampStr = onChainPriceData.timestamp!;
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
    
    // Step 3: Calculate percentage change and time elapsed
    const percentChange = ((priceInSatoshis - lastSubmittedPrice) / lastSubmittedPrice) * 100;
    const absPercentChange = Math.abs(percentChange);
    
    // Convert block height timestamp to milliseconds for comparison
    // Stacks block timestamps are Unix timestamps in seconds, convert to milliseconds
    const lastSubmittedTimestampMs = lastSubmittedTimestamp * 1000;
    const timeElapsedMs = currentTimestamp - lastSubmittedTimestampMs;
    
    console.log(`Calculated metrics: ` +
      `Percent change: ${percentChange.toFixed(4)}% (absolute: ${absPercentChange.toFixed(4)}%), ` +
      `Time elapsed since last update: ${(timeElapsedMs / (60 * 1000)).toFixed(2)} minutes`);
    
    // Step 4: Apply threshold checks
    
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
        sourceCount: latestAggregatedPriceData.sourceCount,
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
        sourceCount: latestAggregatedPriceData.sourceCount,
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
        sourceCount: latestAggregatedPriceData.sourceCount,
      };
    } else {
      console.log(`No update needed. Price change (${absPercentChange.toFixed(4)}%) below threshold and time elapsed (${(timeElapsedMs / (60 * 60 * 1000)).toFixed(2)} hours) within limits.`);
      return {
        shouldUpdate: false,
        reason: `Price change (${absPercentChange.toFixed(4)}%) below threshold and time elapsed (${(timeElapsedMs / (60 * 60 * 1000)).toFixed(2)} hours) within limits.`,
        priceInSatoshis,
        currentTimestamp,
        percentChange,
        sourceCount: latestAggregatedPriceData.sourceCount,
      };
    }
  }
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
    uintCV(price), // price: uint
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

  console.log("Transaction options built (unsigned):", JSON.stringify(txOptions, null, 2));
  return txOptions;
};

// --- Transaction Signing (BI-303) ---

/**
 * Internal action to sign the `set-aggregated-price` transaction using the backend identity.
 *
 * @param {object} args - The arguments object.
 * @param {number} args.price - The aggregated price in the smallest unit (e.g., satoshis).
 * @returns {Promise<object>} The signed Stacks transaction object (not serialized yet).
 * @throws {Error} If nonce fetching or signing fails.
 */
export const signSetPriceTransaction = internalAction({
  args: { price: v.number() }, // Use Convex validation
  handler: async (ctx, { price }): Promise<object> => {
    console.log(`Signing transaction for set-aggregated-price with price: ${price}`);

    // 1. Build base transaction options
    const baseTxOptions = await buildSetPriceTransactionOptions({ price });

    // 2. Get backend signer key
    const privateKey = getBackendSignerKey();
    const senderAddress = getAddressFromPrivateKey(privateKey, network.version);
    console.log(`Signer address derived from private key: ${senderAddress}`);

    // 3. Fetch nonce
    let nonce = 0; // Default to 0
    try {
      // Instead of accountsApi.getAccountInfo, use direct fetch
      nonce = await fetchAccountNonce(senderAddress);
    } catch (error: any) {
      console.error(`Error fetching nonce for ${senderAddress}:`, error);
      throw new Error(`Failed to fetch nonce: ${error.message}`);
    }

    // 4. Assemble final options and sign
    const txOptions = {
      ...baseTxOptions, // Spread the options from build step
      senderKey: privateKey,
      nonce: nonce,
      postConditionMode: PostConditionMode.Allow, // Allow any post conditions for simplicity
      // fee: calculateFee(), // Optional: Add fee calculation if needed
    };

    try {
      console.log("Calling makeContractCall with options:", JSON.stringify({ ...txOptions, senderKey: '[REDACTED]' }, null, 2));
      const signedTransaction = await makeContractCall(txOptions as any); // Type assertion might be needed depending on exact Stacks.js version

      console.log(`Transaction signed successfully. TxID (potential): ${signedTransaction.txid()}`);
      // Note: The transaction object itself is needed for broadcasting, not just the ID yet.
      return signedTransaction;
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
    console.log(`Fetched nonce for ${address}: ${data.last_executed_tx_nonce}`);
    return data.last_executed_tx_nonce;
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
 * @param {object} args.signedTransaction - The signed transaction object from makeContractCall.
 * @returns {Promise<{ txid: string }>} The transaction ID if broadcast is successful.
 * @throws {Error} If broadcasting fails or returns an error response.
 */
export const broadcastSignedTransaction = internalAction({
  args: {
    // We expect the signed transaction object, which might be complex.
    // Using v.any() for flexibility, but validate structure internally if needed.
    signedTransaction: v.any(),
  },
  handler: async (_ctx, { signedTransaction }): Promise<{ txid: string }> => {
    console.log("Broadcasting signed transaction...");

    // The signedTransaction object should have methods like serialize()
    // and properties required by broadcastTransaction.
    if (!signedTransaction || typeof signedTransaction.serialize !== 'function') {
        throw new Error("Invalid signed transaction object received for broadcasting.");
    }

    try {
      // FIX: Pass transaction and network directly to broadcastTransaction
      const result = await broadcastTransaction(signedTransaction, network);

      console.log("Broadcast result:", result);

      // Check if the broadcast returned an error
      if (result && typeof result === 'object' && 'error' in result) {
        console.error("Transaction broadcast failed:", result.error);
        // Include reason if available
        const reason = 'reason' in result ? result.reason : 'No reason provided';
        const reasonData = 'reason_data' in result ? JSON.stringify(result.reason_data) : '';
        throw new Error(`Transaction broadcast failed: ${result.error}. Reason: ${reason}. ${reasonData}`);
      }

      // Check if txid is missing, which indicates an unexpected success response format
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

// --- Oracle Submission Action Wrapper (BI-305) ---

/**
 * Public action to sign and broadcast the `set-aggregated-price` transaction.
 * This encapsulates the signing and broadcasting steps.
 *
 * @param {object} args - The arguments object.
 * @param {number} args.priceInSatoshis - The aggregated price in the smallest unit (e.g., satoshis).
 * @returns {Promise<{ txid: string }>} The transaction ID if broadcast is successful.
 * @throws {Error} If signing or broadcasting fails.
 */
export const submitAggregatedPrice = action({
  args: { priceInSatoshis: v.number() },
  handler: async (ctx, { priceInSatoshis }): Promise<{ txid: string }> => {
    console.log(`submitAggregatedPrice action initiated for price: ${priceInSatoshis}`);

    // Validate input price
    if (!Number.isInteger(priceInSatoshis) || priceInSatoshis < 0) {
      throw new Error("Invalid price format: must be a non-negative integer.");
    }

    try {
      // Step 1: Sign the transaction using the internal action
      console.log("Calling internal action to sign transaction...");
      const signedTransaction = await ctx.runAction(internal.blockchainIntegration.signSetPriceTransaction, {
        price: priceInSatoshis,
      });
      console.log("Transaction signed successfully.");

      // Step 2: Broadcast the signed transaction using the internal action
      console.log("Calling internal action to broadcast transaction...");
      const broadcastResult = await ctx.runAction(internal.blockchainIntegration.broadcastSignedTransaction, {
        signedTransaction: signedTransaction,
      });
      console.log(`Transaction broadcast initiated. TxID: ${broadcastResult.txid}`);

      // CVX-303: Record the submission attempt
      try {
        await ctx.runMutation(internal.blockchainIntegration.recordOracleSubmission, {
          txid: broadcastResult.txid,
          submittedPriceSatoshis: priceInSatoshis,
        });
      } catch (recordError: any) {
        console.error(`Error recording oracle submission to DB (TxID: ${broadcastResult.txid}): ${recordError.message}`, recordError);
        // Log the error, but don't fail the whole action just because DB write failed.
        // The transaction was still submitted.
      }

      // Return the transaction ID
      return { txid: broadcastResult.txid };

    } catch (error: any) {
      console.error(`Error in submitAggregatedPrice action: ${error.message}`, error);
      // Rethrow the error to be handled by the caller (e.g., the cron job)
      throw new Error(`Failed to submit aggregated price: ${error.message}`);
    }
  },
});

// --- Oracle Submission Orchestrator (CVX-302 Integration) ---

/**
 * Internal action scheduled by the cron job to check if an oracle price update
 * is needed and trigger the submission if required.
 */
export const checkAndSubmitOraclePrice = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    console.log("Cron Job: Running checkAndSubmitOraclePrice...");

    try {
      // 1. Prepare submission data and check thresholds
      const preparationResult = await ctx.runAction(internal.blockchainIntegration.prepareOracleSubmission, {});

      console.log(`Preparation result: Should Update: ${preparationResult.shouldUpdate}, Reason: ${preparationResult.reason}`);

      // 2. If update is needed, submit the price
      if (preparationResult.shouldUpdate && preparationResult.priceInSatoshis !== undefined) {
        console.log(`Update required. Submitting price: ${preparationResult.priceInSatoshis}...`);
        
        try {
          const submissionResult = await ctx.runAction(api.blockchainIntegration.submitAggregatedPrice, {
            priceInSatoshis: preparationResult.priceInSatoshis,
          });
          console.log(`Successfully submitted price update. TxID: ${submissionResult.txid}`);
          
          // CVX-303: Record the submission attempt
          try {
            await ctx.runMutation(internal.blockchainIntegration.recordOracleSubmission, {
              txid: submissionResult.txid,
              submittedPriceSatoshis: preparationResult.priceInSatoshis,
            });
          } catch (recordError: any) {
            console.error(`Error recording oracle submission to DB (TxID: ${submissionResult.txid}): ${recordError.message}`, recordError);
            // Log the error, but don't fail the whole action just because DB write failed.
            // The transaction was still submitted.
          }
           
        } catch (submissionError: any) {
          console.error(`Error submitting price update after check: ${submissionError.message}`, submissionError);
          // Decide if we want to retry or just log the error. For now, just log.
        }

      } else {
        console.log("No price update needed based on current thresholds.");
      }

    } catch (error: any) {
      console.error(`Error during checkAndSubmitOraclePrice: ${error.message}`, error);
      // Log error, cron will run again later.
    }
  },
});

// --- Oracle Submission Recording (CVX-303) ---

/**
 * Internal mutation to record an oracle price submission attempt in the database.
 *
 * @param {object} args - The arguments object.
 * @param {string} args.txid - The transaction ID from the broadcast.
 * @param {number} args.submittedPriceSatoshis - The price that was submitted.
 */
export const recordOracleSubmission = internalMutation({
  args: {
    txid: v.string(),
    submittedPriceSatoshis: v.number(),
  },
  handler: async (ctx, { txid, submittedPriceSatoshis }) => {
    const submissionTimestamp = Date.now();
    console.log(`Recording oracle submission: TxID: ${txid}, Price: ${submittedPriceSatoshis}, Timestamp: ${submissionTimestamp}`);
    
    await ctx.db.insert("oracleSubmissions", {
      txid: txid,
      submittedPriceSatoshis: submittedPriceSatoshis,
      submissionTimestamp: submissionTimestamp,
      status: "submitted", // Initial status
      // confirmationTimestamp and blockHeight will be null initially
    });
    
    console.log("Oracle submission recorded successfully.");
  },
}); 