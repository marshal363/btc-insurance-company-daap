# Convex-to-Blockchain Integration Patterns

## Overview

This document outlines best practices and patterns for integrating Convex Backend-as-a-Service with blockchain smart contracts, specifically focusing on the BitHedge platform's integration with Stacks blockchain and Clarity smart contracts.

## Core Integration Patterns

### 1. Transaction Management

#### 1.1 Transaction Building Pattern

```typescript
// src/blockchain/transaction-builder.ts
import { mutation, action } from "./_generated/server";
import { StacksMainnet, StacksTestnet } from "@stacks/network";
import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  stringAsciiCV,
  uintCV,
} from "@stacks/transactions";

// Configuration handler for contract addresses
const getContractAddress = (
  contractName: string,
  network: "mainnet" | "testnet"
): { address: string; name: string } => {
  const contracts = {
    mainnet: {
      oracle: { address: "SP000...", name: "oracle" },
      "policy-registry": { address: "SP000...", name: "policy-registry" },
      "liquidity-pool": { address: "SP000...", name: "liquidity-pool" },
    },
    testnet: {
      oracle: { address: "ST000...", name: "oracle" },
      "policy-registry": { address: "ST000...", name: "policy-registry" },
      "liquidity-pool": { address: "ST000...", name: "liquidity-pool" },
    },
  };

  return contracts[network][contractName];
};

// Get network object based on environment
const getNetwork = (env: "production" | "development") => {
  return env === "production" ? new StacksMainnet() : new StacksTestnet();
};

// Base transaction builder function
export const buildContractTransaction = async (
  contractName: string,
  functionName: string,
  functionArgs: any[],
  senderKey: string,
  env: "production" | "development" = "development"
) => {
  const network = getNetwork(env);
  const { address, name } = getContractAddress(
    contractName,
    env === "production" ? "mainnet" : "testnet"
  );

  const txOptions = {
    contractAddress: address,
    contractName: name,
    functionName: functionName,
    functionArgs: functionArgs,
    senderKey: senderKey,
    network: network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    postConditions: [],
  };

  const transaction = await makeContractCall(txOptions);
  return transaction;
};

// Oracle price update transaction builder
export const buildOraclePriceUpdateTx = async (
  price: number,
  timestamp: number,
  confidenceScore: number,
  senderKey: string,
  env: "production" | "development" = "development"
) => {
  const priceCV = uintCV(price); // Convert to micro-units before passing
  const timestampCV = uintCV(timestamp);
  const confidenceCV = uintCV(confidenceScore);

  return buildContractTransaction(
    "oracle",
    "update-btc-price",
    [priceCV, timestampCV, confidenceCV],
    senderKey,
    env
  );
};

// Broadcast transaction to the network
export const broadcastTx = async (
  transaction: any,
  env: "production" | "development" = "development"
) => {
  const network = getNetwork(env);
  return broadcastTransaction(transaction, network);
};
```

#### 1.2 Transaction Tracking Pattern

```typescript
// src/blockchain/transaction-tracker.ts
import { mutation, action, query } from "./_generated/server";
import { getId } from "../_generated/server";
import { fetchTransaction } from "@stacks/blockchain-api-client";

// Schema definition for transaction tracking
// In schema.ts:
/*
  transactionTracker: defineTable({
    txId: v.string(),
    contractName: v.string(),
    functionName: v.string(),
    status: v.string(), // 'pending', 'confirmed', 'failed'
    timestamp: v.number(),
    lastChecked: v.number(),
    checkCount: v.number(),
    result: v.optional(v.object({})),
    errorMessage: v.optional(v.string()),
  }).index('by_txId', ['txId'])
    .index('by_status', ['status']),
*/

// Record a transaction for tracking
export const recordTransaction = mutation({
  args: {
    txId: "string",
    contractName: "string",
    functionName: "string",
  },
  handler: async (ctx, args) => {
    const { txId, contractName, functionName } = args;

    // Create transaction record
    const record = await ctx.db.insert("transactionTracker", {
      txId,
      contractName,
      functionName,
      status: "pending",
      timestamp: Date.now(),
      lastChecked: Date.now(),
      checkCount: 0,
    });

    // Schedule transaction check
    await ctx.scheduler.runAfter(
      60000, // 1 minute delay for first check
      "checkTransactionStatus",
      { transactionId: record._id }
    );

    return record;
  },
});

// Check transaction status
export const checkTransactionStatus = action({
  args: { transactionId: "string" },
  handler: async (ctx, args) => {
    const { transactionId } = args;

    // Get transaction record
    const record = await ctx.db.get(args.transactionId);
    if (!record) {
      throw new Error(`Transaction record ${transactionId} not found`);
    }

    // Update check count and timestamp
    await ctx.db.patch(transactionId, {
      lastChecked: Date.now(),
      checkCount: record.checkCount + 1,
    });

    try {
      // Fetch transaction status from blockchain
      const txStatus = await fetchTransaction(record.txId);

      if (txStatus.tx_status === "success") {
        // Transaction confirmed
        await ctx.db.patch(transactionId, {
          status: "confirmed",
          result: txStatus,
        });

        // Take action based on transaction type
        await handleConfirmedTransaction(ctx, record, txStatus);

        return { success: true, status: "confirmed" };
      } else if (txStatus.tx_status === "failed") {
        // Transaction failed
        await ctx.db.patch(transactionId, {
          status: "failed",
          errorMessage: txStatus.error || "Unknown error",
        });

        // Handle failed transaction
        await handleFailedTransaction(ctx, record, txStatus);

        return { success: false, status: "failed", error: txStatus.error };
      } else {
        // Still pending, schedule another check
        const backoffTime = Math.min(
          300000,
          30000 * Math.pow(1.5, record.checkCount)
        ); // Exponential backoff

        await ctx.scheduler.runAfter(backoffTime, "checkTransactionStatus", {
          transactionId,
        });

        return { success: true, status: "pending" };
      }
    } catch (error) {
      console.error(`Error checking transaction ${record.txId}:`, error);

      // Schedule retry
      await ctx.scheduler.runAfter(
        60000, // 1 minute retry
        "checkTransactionStatus",
        { transactionId }
      );

      return { success: false, error: error.message };
    }
  },
});

// Handle confirmed transaction based on type
const handleConfirmedTransaction = async (ctx, record, txStatus) => {
  switch (record.contractName) {
    case "oracle":
      if (record.functionName === "update-btc-price") {
        // Update local status that price is confirmed on-chain
        await ctx.db.insert("oracleUpdates", {
          txId: record.txId,
          timestamp: Date.now(),
          status: "confirmed",
        });
      }
      break;
    case "policy-registry":
      if (record.functionName === "create-policy") {
        // Update policy status
        // (implementation depends on how policy data is stored)
      }
      break;
    // Handle other contract types
  }
};

// Handle failed transactions
const handleFailedTransaction = async (ctx, record, txStatus) => {
  switch (record.contractName) {
    case "oracle":
      if (record.functionName === "update-btc-price") {
        // Schedule a retry or alert administrators
        await ctx.db.insert("oracleUpdates", {
          txId: record.txId,
          timestamp: Date.now(),
          status: "failed",
          error: txStatus.error,
        });

        // Maybe schedule a new price update
      }
      break;
    // Handle other contract types
  }
};
```

### 2. Blockchain Event Monitoring

#### 2.1 Event Listener Pattern

```typescript
// src/blockchain/event-listener.ts
import { action, mutation } from "./_generated/server";
import { StacksApiWebSocketClient } from "@stacks/blockchain-api-client";

// Initialize websocket connection to blockchain
export const initializeBlockchainListener = action(
  async ({ db, scheduler }) => {
    try {
      // Set up websocket client
      const socket = new StacksApiWebSocketClient(
        "wss://stacks-node-api.mainnet.stacks.co"
      );

      // Listen for address transactions (for contract events)
      socket.subscribeAddressTransactions("SP000..."); // Oracle contract address
      socket.subscribeAddressTransactions("SP000..."); // Policy Registry contract address

      // Listen for new blocks
      socket.subscribeBlocks();

      // Handle transaction events
      socket.onAddressTransactionEvent(async (event) => {
        // Process transaction event
        if (event.tx_type === "contract_call") {
          // Extract contract and function information
          const contractAddress = event.contract_call.contract_id.split(".")[0];
          const contractName = event.contract_call.contract_id.split(".")[1];
          const functionName = event.contract_call.function_name;

          // Process different contract events
          await processContractEvent(db, {
            txId: event.tx_id,
            contractAddress,
            contractName,
            functionName,
            rawEvent: event,
          });
        }
      });

      // Handle new blocks
      socket.onBlockEvent(async (block) => {
        // Process new block - useful for time-based operations
        await db.insert("blockchainBlocks", {
          blockHeight: block.block_height,
          blockHash: block.block_hash,
          timestamp: Date.now(),
        });

        // Schedule expiration checks or other block-height dependent actions
        await scheduler.runAfter(
          1000, // Run shortly after block processing
          "processBlockHeightActions",
          { blockHeight: block.block_height }
        );
      });

      // Handle connection errors
      socket.onConnectionError((error) => {
        console.error("Blockchain websocket connection error:", error);

        // Reconnect after delay
        scheduler.runAfter(
          30000, // 30 seconds
          "initializeBlockchainListener",
          {}
        );
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to initialize blockchain listener:", error);

      // Retry after delay
      scheduler.runAfter(
        60000, // 1 minute
        "initializeBlockchainListener",
        {}
      );

      return { success: false, error: error.message };
    }
  }
);

// Process contract events based on contract and function
const processContractEvent = async (db, event) => {
  const { contractName, functionName, txId, rawEvent } = event;

  // Record all events for analysis
  await db.insert("contractEvents", {
    txId,
    contractName,
    functionName,
    timestamp: Date.now(),
    rawEvent,
  });

  // Process specific contract events
  if (contractName === "policy-registry") {
    if (functionName === "create-policy") {
      // Process policy creation event
      await processNewPolicyEvent(db, event);
    } else if (functionName === "activate-policy") {
      // Process policy activation event
      await processPolicyActivationEvent(db, event);
    }
  } else if (contractName === "oracle") {
    if (functionName === "update-btc-price") {
      // Process oracle price update
      await processOraclePriceUpdateEvent(db, event);
    }
  }
};

// Example event processor for new policy creation
const processNewPolicyEvent = async (db, event) => {
  // Extract policy information from event
  const policyDetails = extractPolicyDetailsFromEvent(event.rawEvent);

  // Update local database with new policy
  await db.insert("policies", {
    policyId: policyDetails.policyId,
    owner: policyDetails.owner,
    counterparty: policyDetails.counterparty,
    protectedValue: policyDetails.protectedValue,
    premium: policyDetails.premium,
    expirationHeight: policyDetails.expirationHeight,
    status: "active",
    createdAt: Date.now(),
    txId: event.txId,
  });
};

// Helper to extract policy details from a contract event
const extractPolicyDetailsFromEvent = (event) => {
  // Logic to parse contract event data
  // This is simplified - actual implementation would depend on event structure
  const policyId = event.contract_call.contract_id + "::" + event.tx_id;

  return {
    policyId,
    owner: event.sender_address,
    counterparty: "", // Extract from event
    protectedValue: 0, // Extract from event
    premium: 0, // Extract from event
    expirationHeight: 0, // Extract from event
  };
};
```

### 3. State Synchronization

#### 3.1 On-Chain Read Pattern

```typescript
// src/blockchain/contract-reader.ts
import { query, action } from "./_generated/server";
import { callReadOnlyFunction, cvToValue } from "@stacks/transactions";
import { StacksMainnet, StacksTestnet } from "@stacks/network";

// Get read-only contract data
export const readContractFunction = query({
  args: {
    contractName: "string",
    functionName: "string",
    functionArgs: "array",
    env: { defaultValue: "development", type: "string" },
  },
  handler: async (ctx, args) => {
    const { contractName, functionName, functionArgs, env } = args;

    // Get network and contract details
    const network =
      env === "production" ? new StacksMainnet() : new StacksTestnet();
    const { address, name } = getContractAddress(
      contractName,
      env === "production" ? "mainnet" : "testnet"
    );

    try {
      // Call read-only function
      const result = await callReadOnlyFunction({
        contractAddress: address,
        contractName: name,
        functionName,
        functionArgs,
        network,
        senderAddress: address, // For read-only, can use contract address
      });

      // Convert Clarity value to JavaScript value
      return cvToValue(result);
    } catch (error) {
      console.error(
        `Error reading contract ${contractName}.${functionName}:`,
        error
      );
      throw new Error(`Failed to read contract: ${error.message}`);
    }
  },
});

// Helper to get latest policies from on-chain registry
export const syncPoliciesFromChain = action({
  args: { batchSize: { defaultValue: 10, type: "number" } },
  handler: async (ctx, args) => {
    const { batchSize } = args;

    try {
      // Get local state - last synced policy ID
      const syncState = await ctx.db
        .query("blockchainSyncState")
        .filter((q) => q.eq(q.field("type"), "policy-registry"))
        .first();

      const lastSyncedId = syncState?.lastId || 0;

      // Read total policy count from chain
      const totalPolicies = await ctx.runQuery(readContractFunction, {
        contractName: "policy-registry",
        functionName: "get-policy-counter",
        functionArgs: [],
      });

      // Calculate how many policies to sync
      const policiesToSync = Math.min(batchSize, totalPolicies - lastSyncedId);

      if (policiesToSync <= 0) {
        return { success: true, message: "No new policies to sync" };
      }

      // Read policies from chain
      const syncedPolicies = [];
      for (let i = lastSyncedId + 1; i <= lastSyncedId + policiesToSync; i++) {
        const policy = await ctx.runQuery(readContractFunction, {
          contractName: "policy-registry",
          functionName: "get-policy",
          functionArgs: [i],
        });

        // Transform and store policy in local database
        await ctx.db.insert("policies", {
          policyId: i,
          owner: policy.owner,
          counterparty: policy.counterparty,
          protectedValue: policy.protectedValue,
          premium: policy.premium,
          expirationHeight: policy.expirationHeight,
          status: policy.status,
          createdAt: Date.now(),
          syncedFromChain: true,
        });

        syncedPolicies.push(i);
      }

      // Update sync state
      if (syncState) {
        await ctx.db.patch(syncState._id, {
          lastId: lastSyncedId + policiesToSync,
          lastSyncTime: Date.now(),
        });
      } else {
        await ctx.db.insert("blockchainSyncState", {
          type: "policy-registry",
          lastId: lastSyncedId + policiesToSync,
          lastSyncTime: Date.now(),
        });
      }

      // Schedule next batch if more policies exist
      if (lastSyncedId + policiesToSync < totalPolicies) {
        await ctx.scheduler.runAfter(
          5000, // 5 seconds delay
          "syncPoliciesFromChain",
          { batchSize }
        );
      }

      return {
        success: true,
        syncedCount: policiesToSync,
        totalPolicies: totalPolicies,
        progress: `${lastSyncedId + policiesToSync}/${totalPolicies}`,
      };
    } catch (error) {
      console.error("Policy sync error:", error);

      // Retry after delay
      await ctx.scheduler.runAfter(
        60000, // 1 minute
        "syncPoliciesFromChain",
        { batchSize }
      );

      return { success: false, error: error.message };
    }
  },
});
```

#### 3.2 Optimistic Update Pattern

```typescript
// src/blockchain/optimistic-updates.ts
import { mutation } from "./_generated/server";

// Optimistically update local state before blockchain confirmation
export const createPolicyOptimistic = mutation({
  args: {
    owner: "string",
    counterparty: "string",
    protectedValue: "number",
    premium: "number",
    duration: "number",
    type: "string",
  },
  handler: async (ctx, args) => {
    const { owner, counterparty, protectedValue, premium, duration, type } =
      args;

    // Get current block height (for expiration calculation)
    const latestBlock = await ctx.db
      .query("blockchainBlocks")
      .order("desc")
      .first();

    if (!latestBlock) {
      throw new Error("Cannot determine current block height");
    }

    // Calculate expiration height
    const expirationHeight = latestBlock.blockHeight + duration;

    // Create optimistic policy entry
    const policy = await ctx.db.insert("policies", {
      owner,
      counterparty,
      protectedValue,
      premium,
      expirationHeight,
      type,
      status: "pending", // Optimistic status until confirmed
      createdAt: Date.now(),
      optimistic: true, // Flag indicating this is an optimistic update
      confirmedOnChain: false,
    });

    // Prepare and send transaction
    try {
      // Build transaction to create policy on-chain
      // (implementation would use transaction builder from earlier)

      // Record transaction for tracking
      const txRecord = await ctx.runMutation(recordTransaction, {
        txId: "pending", // Placeholder until real txId is available
        contractName: "policy-registry",
        functionName: "create-policy",
        entityId: policy._id,
        entityType: "policy",
      });

      return {
        success: true,
        policy,
        transactionId: txRecord._id,
      };
    } catch (error) {
      // Revert optimistic update on failure
      await ctx.db.delete(policy._id);

      throw new Error(`Failed to create policy: ${error.message}`);
    }
  },
});

// Update optimistic entry when transaction is confirmed
export const updateOptimisticPolicy = mutation({
  args: {
    policyId: "string",
    onChainId: "number",
    txId: "string",
    status: "string",
  },
  handler: async (ctx, args) => {
    const { policyId, onChainId, txId, status } = args;

    // Update optimistic policy with confirmed data
    await ctx.db.patch(policyId, {
      onChainId,
      status: status === "success" ? "active" : "failed",
      confirmedOnChain: status === "success",
      optimistic: false,
      confirmedAt: Date.now(),
      txId,
    });

    return { success: true };
  },
});
```

### 4. Provider Authentication Pattern

```typescript
// src/auth/wallet-authentication.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyMessageSignature } from "@stacks/encryption";

// Generate authentication challenge
export const generateAuthChallenge = mutation({
  args: { address: v.string() },
  handler: async (ctx, args) => {
    const { address } = args;

    // Create a random challenge
    const challenge = `Sign this message to authenticate with BitHedge: ${crypto.randomUUID()}`;

    // Store challenge
    await ctx.db.insert("authChallenges", {
      address,
      challenge,
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      used: false,
    });

    return { challenge };
  },
});

// Verify signed challenge
export const verifyAuthSignature = mutation({
  args: {
    address: v.string(),
    challenge: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, args) => {
    const { address, challenge, signature } = args;

    // Get stored challenge
    const storedChallenge = await ctx.db
      .query("authChallenges")
      .filter((q) => q.eq(q.field("address"), address))
      .filter((q) => q.eq(q.field("challenge"), challenge))
      .filter((q) => q.eq(q.field("used"), false))
      .first();

    if (!storedChallenge) {
      throw new Error("Invalid or expired challenge");
    }

    // Check if challenge is expired
    if (storedChallenge.expiresAt < Date.now()) {
      throw new Error("Challenge expired");
    }

    // Verify signature
    const isValid = verifyMessageSignature({
      message: challenge,
      signature,
      publicKey: address,
    });

    if (!isValid) {
      throw new Error("Invalid signature");
    }

    // Mark challenge as used
    await ctx.db.patch(storedChallenge._id, { used: true });

    // Create or update user session
    const sessionId = await ctx.db.insert("userSessions", {
      address,
      lastLogin: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      success: true,
      sessionId,
      address,
    };
  },
});

// Authenticate user for API calls
export const getUserSession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const { sessionId } = args;

    // Get session
    const session = await ctx.db.get(sessionId);

    if (!session || session.expiresAt < Date.now()) {
      return null;
    }

    return {
      address: session.address,
      lastLogin: session.lastLogin,
      expiresAt: session.expiresAt,
    };
  },
});
```

## Best Practices

### 1. Error Handling and Recovery

- Implement exponential backoff for retries
- Use circuit breakers for repeated failures
- Maintain detailed error logs for debugging
- Design fallback mechanisms for critical operations

### 2. Transaction Security

- Always validate transaction parameters before submission
- Implement transaction simulation where possible
- Use proper post-conditions to prevent unexpected token transfers
- Securely manage private keys for transaction signing

### 3. Performance Optimization

- Batch blockchain read operations where possible
- Cache frequently accessed blockchain data
- Use optimistic UI updates for better user experience
- Implement pagination for large data sets

### 4. Testing

- Set up a comprehensive testing environment with blockchain testnet
- Create mock blockchain responses for unit testing
- Test failure scenarios and recovery mechanisms
- Implement end-to-end tests for critical flows

## Integration Examples

### Example 1: Creating a Policy with Convex and Blockchain

```typescript
// Frontend integration example
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';

const CreatePolicyComponent = () => {
  const createPolicy = useMutation(api.policies.createPolicyOptimistic);

  const handleSubmit = async (formData) => {
    try {
      // Call Convex mutation which will optimize update and send blockchain tx
      const result = await createPolicy({
        owner: formData.owner,
        counterparty: formData.counterparty,
        protectedValue: formData.protectedValue,
        premium: formData.premium,
        duration: formData.duration,
        type: formData.type
      });

      console.log('Policy created with ID:', result.policy._id);
      console.log('Transaction being tracked:', result.transactionId);

      // Subscribe to transaction status updates or poll
    } catch (error) {
      console.error('Failed to create policy:', error);
    }
  };

  return (
    // Policy creation form
  );
};
```

### Example 2: Dashboard with On-Chain Data

```typescript
// Frontend integration example
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

const PolicyDashboard = () => {
  // Get policies from Convex (which syncs with blockchain)
  const policies = useQuery(api.policies.getPolicies);

  // Get blockchain stats from Convex
  const stats = useQuery(api.blockchain.getBlockchainStats);

  if (!policies || !stats) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div>
        <h2>Blockchain Stats</h2>
        <p>Current Block: {stats.currentBlock}</p>
        <p>Total Policies: {stats.totalPolicies}</p>
        <p>Active Policies: {stats.activePolicies}</p>
      </div>

      <div>
        <h2>Your Policies</h2>
        <ul>
          {policies.map((policy) => (
            <li key={policy._id}>
              <div>Policy #{policy.onChainId || "Pending"}</div>
              <div>Status: {policy.status}</div>
              <div>Protected Value: {policy.protectedValue}</div>
              <div>Premium: {policy.premium}</div>
              <div>Expires at block: {policy.expirationHeight}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
```

## Conclusion

This document outlines key patterns and best practices for integrating Convex backend services with blockchain smart contracts. By following these patterns, developers can create robust, secure, and user-friendly applications that leverage the strengths of both platforms:

- Convex provides real-time updates, scalable computation, and simplified data access
- Blockchain provides trustless execution, decentralized state, and tamper-proof records

The recommended approach is to use Convex as the primary application backend with strategic blockchain integration for critical operations that require trust and decentralization.
