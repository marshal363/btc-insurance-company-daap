# BitHedge Policy Registry: Convex Backend Architecture

## 1. Introduction

This document outlines the architecture of the Policy Registry component within the BitHedge platform, focusing specifically on its off-chain implementation in the Convex backend. The Policy Registry is responsible for managing the complete lifecycle of protection policies from creation through activation/exercise, settlement, and expiration. Following the "On-Chain Light" approach described in the hybrid architecture overview, this component distributes responsibilities between minimal on-chain storage and comprehensive off-chain management.

## 2. System Context

The Policy Registry Service sits at the core of the BitHedge platform, interacting with several other components:

```
┌──────────────────────┐      ┌───────────────────┐      ┌─────────────────────┐
│                      │      │                   │      │                     │
│  Frontend Components ├─────►│  Policy Registry  │◄────►│  Liquidity Pool     │
│  (PolicySummary.tsx) │      │  Service          │      │  Service            │
│                      │      │                   │      │                     │
└──────────────────────┘      └─────┬─────────────┘      └─────────────────────┘
                                    │  ▲
                                    │  │
                                    ▼  │
┌──────────────────────┐      ┌─────┴──┴────────────┐      ┌─────────────────────┐
│                      │      │                      │      │                     │
│  Oracle Service      │◄────►│  Blockchain          │◄────►│  On-Chain           │
│                      │      │  Integration Layer   │      │  Policy Registry    │
│                      │      │                      │      │                     │
└──────────────────────┘      └──────────────────────┘      └─────────────────────┘
```

## 3. Data Model

### 3.1 Convex Schema

The Policy Registry manages several key data structures within Convex:

```typescript
// Primary policies table
defineTable({
  name: "policies",
  schema: {
    // Core fields that mirror on-chain data
    policyId: v.number(), // Unique identifier
    owner: v.string(), // Principal of the policy owner
    counterparty: v.string(), // Principal of counterparty (pool address)
    protectedValue: v.number(), // Strike price in base units (e.g., satoshis for BTC)
    protectionAmount: v.number(), // Amount protected in base units
    expirationHeight: v.number(), // Block height when policy expires
    premium: v.number(), // Premium amount in base units
    policyType: v.string(), // "PUT" or "CALL"
    positionType: v.string(), // "LONG_PUT", "SHORT_PUT", "LONG_CALL", or "SHORT_CALL"
    collateralToken: v.string(), // Token used as collateral ("STX" or "sBTC")
    protectedAsset: v.string(), // Asset being protected ("BTC")
    settlementToken: v.string(), // Token used for settlement if exercised ("STX" or "sBTC")
    status: v.string(), // "Active", "Exercised", "Expired"
    premiumDistributed: v.boolean(), // Whether premium has been distributed
    premiumPaid: v.boolean(), // Whether premium has been paid

    // Extended off-chain metadata
    creationTimestamp: v.number(), // Creation time (ms since epoch)
    lastUpdatedTimestamp: v.number(), // Last update time
    displayName: v.optional(v.string()), // User-friendly name
    description: v.optional(v.string()), // Optional description
    tags: v.array(v.string()), // Tags for filtering/categorization

    // Settlement data (populated if exercised)
    exercisePrice: v.optional(v.number()), // Price at exercise
    exerciseHeight: v.optional(v.number()), // Block height at exercise
    exerciseTimestamp: v.optional(v.number()), // Exercise time
    settlementAmount: v.optional(v.number()), // Amount settled
    transactionId: v.optional(v.string()), // Stacks txid of settlement

    // Risk metrics
    currentValueUSD: v.optional(v.number()), // Current valuation in USD
    breakEvenPrice: v.optional(v.number()), // Break-even price
    potentialSettlement: v.optional(v.number()), // Potential settlement amount

    // Linked data
    providerIds: v.array(v.string()), // Virtual link to backing providers (for yield attribution)
  },
  indexes: [
    // Efficiently find policies by owner
    { field: "owner" },
    // Efficiently find policies by counterparty
    { field: "counterparty" },
    // Efficiently find policies by status
    { field: "status" },
    // Efficiently find policies by expiration (for automated expiry)
    { field: "expirationHeight" },
    // Efficiently find policies by policy type
    { field: "policyType" },
    // Efficiently find policies by position type
    { field: "positionType" },
    // Efficiently find policies by collateral token
    { field: "collateralToken" },
    // Efficiently find policies by creation time (for reporting)
    { field: "creationTimestamp" },
  ],
});

// Policy events/history table
defineTable({
  name: "policyEvents",
  schema: {
    policyId: v.number(), // Reference to policy
    eventType: v.string(), // "Created", "Activated", "Expired", "PremiumDistributed", etc.
    timestamp: v.number(), // Event time
    blockHeight: v.optional(v.number()), // Block height if on-chain event
    transactionId: v.optional(v.string()), // Stacks txid if applicable
    previousStatus: v.optional(v.string()), // Previous policy status
    newStatus: v.optional(v.string()), // New policy status
    collateralToken: v.optional(v.string()), // Collateral token involved
    settlementToken: v.optional(v.string()), // Settlement token involved
    premiumAmount: v.optional(v.number()), // Premium amount for distribution events
    counterparty: v.optional(v.string()), // Counterparty for premium distribution
    data: v.any(), // Additional event-specific data
  },
  indexes: [
    // Look up events for a specific policy
    { field: "policyId" },
    // Look up events by type
    { field: "eventType" },
    // Look up events by time
    { field: "timestamp" },
  ],
});

// Pending policy transactions table
defineTable({
  name: "pendingPolicyTransactions",
  schema: {
    policyId: v.optional(v.number()), // Reference to policy (optional if new policy)
    actionType: v.string(), // "Create", "Activate", "Expire", etc.
    status: v.string(), // "Pending", "Submitted", "Confirmed", "Failed"
    createdAt: v.number(), // When transaction was initiated
    updatedAt: v.number(), // Last status update
    transactionId: v.optional(v.string()), // Stacks txid when available
    payload: v.any(), // Transaction payload/params
    error: v.optional(v.string()), // Error message if failed
    retryCount: v.number(), // Count of retry attempts
    userId: v.string(), // Principal of user who initiated (if user action)
  },
  indexes: [
    // Find pending transactions for a policy
    { field: "policyId" },
    // Find pending transactions by status
    { field: "status" },
    // Find pending transactions by user
    { field: "userId" },
  ],
});
```

### 3.2 Key Data Types

```typescript
// Exported TypeScript types for use across the platform

// Policy status enum
export enum PolicyStatus {
  ACTIVE = "Active",
  EXERCISED = "Exercised",
  EXPIRED = "Expired",
  CANCELLED = "Cancelled", // Future extension
}

// Policy type enum
export enum PolicyType {
  PUT = "PUT",
  CALL = "CALL",
}

// Position type enum
export enum PositionType {
  LONG_PUT = "LONG_PUT",
  SHORT_PUT = "SHORT_PUT",
  LONG_CALL = "LONG_CALL",
  SHORT_CALL = "SHORT_CALL",
}

// Token type enum
export enum TokenType {
  STX = "STX",
  SBTC = "sBTC",
  BTC = "BTC",
}

// Policy event type enum
export enum PolicyEventType {
  CREATED = "Created",
  ACTIVATED = "Activated",
  EXPIRED = "Expired",
  CANCELLED = "Cancelled",
  UPDATED = "Updated",
  SETTLEMENT_COMPLETED = "SettlementCompleted",
  PREMIUM_DISTRIBUTED = "PremiumDistributed",
}

// Policy creation parameters interface
export interface PolicyCreationParams {
  owner: string; // Principal of policy owner
  counterparty: string; // Principal of counterparty (generally pool address)
  protectedValueUSD: number; // Protected value in USD
  protectionAmountBTC: number; // Amount to protect in BTC
  policyType: PolicyType; // PUT or CALL
  durationDays: number; // Duration in days
  premiumUSD?: number; // Optional - if premium already calculated
}

// Policy activation parameters interface
export interface PolicyActivationParams {
  policyId: number; // ID of policy to activate
  currentPriceUSD: number; // Current price from Oracle
}

// Premium distribution parameters interface
export interface PremiumDistributionParams {
  policyId: number; // ID of policy for premium distribution
  counterparty: string; // Principal of counterparty to receive premium
}
```

## 4. Services and Functions

The Policy Registry exposes several key services to the rest of the application:

### 4.1 Public API (Exposed to Frontend)

#### Queries (Read-Only)

```typescript
// Get a specific policy by ID
export const getPolicy = query(async ({ db }, policyId: number) => {
  return await db.get("policies", policyId);
});

// Get policies for a specific user
export const getPoliciesForUser = query(
  async (
    { db, auth },
    filters?: {
      status?: PolicyStatus[];
      policyType?: PolicyType;
      from?: number;
      to?: number;
      limit?: number;
      offset?: number;
    }
  ) => {
    // Check authentication
    const identity = auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const owner = identity.tokenIdentifier;

    // Build query based on filters
    let policyQuery = db
      .query("policies")
      .withIndex("owner", (q) => q.eq("owner", owner));

    // Apply status filter if provided
    if (filters?.status && filters.status.length > 0) {
      policyQuery = policyQuery.filter((q) =>
        q.and(...filters.status.map((s) => q.eq((p) => p.status, s)))
      );
    }

    // Apply other filters...

    // Execute query with pagination
    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;

    return await policyQuery.take(limit, offset);
  }
);

// Get events for a specific policy
export const getPolicyEvents = query(async ({ db }, policyId: number) => {
  return await db
    .query("policyEvents")
    .withIndex("policyId", (q) => q.eq("policyId", policyId))
    .order("desc")
    .collect();
});

// Check if a policy is eligible for activation
export const checkPolicyActivationEligibility = query(
  async ({ db }, policyId: number) => {
    // Get policy
    const policy = await db.get("policies", policyId);
    if (!policy) throw new Error("Policy not found");

    // Check status
    if (policy.status !== PolicyStatus.ACTIVE) {
      return { eligible: false, reason: `Policy is ${policy.status}` };
    }

    // Check expiration
    const currentBlockHeight = await getLatestBlockHeight();
    if (currentBlockHeight > policy.expirationHeight) {
      return { eligible: false, reason: "Policy has expired" };
    }

    // Check price conditions via Oracle
    const currentPrice = await getCurrentBTCPrice();

    if (policy.policyType === PolicyType.PUT) {
      // For PUT: current price must be below strike price
      if (currentPrice >= policy.protectedValue) {
        return {
          eligible: false,
          reason: "Current price is not below protected value",
        };
      }
    } else {
      // For CALL: current price must be above strike price
      if (currentPrice <= policy.protectedValue) {
        return {
          eligible: false,
          reason: "Current price is not above protected value",
        };
      }
    }

    // All checks passed
    return {
      eligible: true,
      settlementAmount: calculateSettlementAmount(
        policy.policyType,
        policy.protectedValue,
        currentPrice,
        policy.protectionAmount
      ),
    };
  }
);

// Get policies for a specific counterparty
export const getPoliciesForCounterparty = query(
  async (
    { db, auth },
    filters?: {
      status?: PolicyStatus[];
      policyType?: PolicyType;
      positionType?: PositionType;
      collateralToken?: TokenType;
      from?: number;
      to?: number;
      limit?: number;
      offset?: number;
    }
  ) => {
    // Check authentication
    const identity = auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const counterparty = identity.tokenIdentifier;

    // Build query based on filters
    let policyQuery = db
      .query("policies")
      .withIndex("counterparty", (q) => q.eq("counterparty", counterparty));

    // Apply status filter if provided
    if (filters?.status && filters.status.length > 0) {
      policyQuery = policyQuery.filter((q) =>
        q.and(...filters.status.map((s) => q.eq((p) => p.status, s)))
      );
    }

    // Apply policy type filter if provided
    if (filters?.policyType) {
      policyQuery = policyQuery.filter((q) =>
        q.eq((p) => p.policyType, filters.policyType)
      );
    }

    // Apply position type filter if provided
    if (filters?.positionType) {
      policyQuery = policyQuery.filter((q) =>
        q.eq((p) => p.positionType, filters.positionType)
      );
    }

    // Apply collateral token filter if provided
    if (filters?.collateralToken) {
      policyQuery = policyQuery.filter((q) =>
        q.eq((p) => p.collateralToken, filters.collateralToken)
      );
    }

    // Execute query with pagination
    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;

    return await policyQuery.take(limit, offset);
  }
);

// Check if a policy is eligible for premium distribution
export const checkPremiumDistributionEligibility = query(
  async ({ db }, policyId: number) => {
    // Get policy
    const policy = await db.get("policies", policyId);
    if (!policy) throw new Error("Policy not found");

    // Check status
    if (policy.status !== PolicyStatus.EXPIRED) {
      return {
        eligible: false,
        reason: `Policy is ${policy.status}, not Expired`,
      };
    }

    // Check if premium already distributed
    if (policy.premiumDistributed) {
      return { eligible: false, reason: "Premium already distributed" };
    }

    // All checks passed
    return {
      eligible: true,
      premiumAmount: policy.premium,
      counterparty: policy.counterparty,
      collateralToken: policy.collateralToken,
    };
  }
);

// Get income statistics for counterparty
export const getCounterpartyIncomeStats = query(async ({ db, auth }) => {
  // Check authentication
  const identity = auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const counterparty = identity.tokenIdentifier;

  // Get all policies where user is counterparty
  const policies = await db
    .query("policies")
    .withIndex("counterparty", (q) => q.eq("counterparty", counterparty))
    .collect();

  // Calculate income statistics
  const stats = {
    totalPolicies: policies.length,
    activePolicies: policies.filter((p) => p.status === PolicyStatus.ACTIVE)
      .length,
    expiredPolicies: policies.filter((p) => p.status === PolicyStatus.EXPIRED)
      .length,
    exercisedPolicies: policies.filter(
      (p) => p.status === PolicyStatus.EXERCISED
    ).length,

    totalPremiumEarned: policies
      .filter((p) => p.premiumDistributed)
      .reduce((sum, p) => sum + p.premium, 0),

    pendingPremiums: policies
      .filter((p) => p.status === PolicyStatus.EXPIRED && !p.premiumDistributed)
      .reduce((sum, p) => sum + p.premium, 0),

    activeExposure: policies
      .filter((p) => p.status === PolicyStatus.ACTIVE)
      .reduce((sum, p) => sum + p.protectionAmount, 0),

    // Group by collateral token
    tokenBreakdown: policies.reduce((acc, policy) => {
      const token = policy.collateralToken;
      if (!acc[token]) {
        acc[token] = {
          totalPolicies: 0,
          activePolicies: 0,
          earnedPremium: 0,
          pendingPremium: 0,
          activeExposure: 0,
        };
      }

      acc[token].totalPolicies++;

      if (policy.status === PolicyStatus.ACTIVE) {
        acc[token].activePolicies++;
        acc[token].activeExposure += policy.protectionAmount;
      }

      if (policy.premiumDistributed) {
        acc[token].earnedPremium += policy.premium;
      } else if (policy.status === PolicyStatus.EXPIRED) {
        acc[token].pendingPremium += policy.premium;
      }

      return acc;
    }, {}),
  };

  return stats;
});
```

#### Mutations and Actions (Write Operations)

```typescript
// Request policy creation (buyer action)
export const requestPolicyCreation = action(
  async ({ db, scheduler }, params: PolicyCreationParams) => {
    // 1. Validate the parameters
    validatePolicyParameters(params);

    // 2. Calculate premium if not provided
    let premiumUSD = params.premiumUSD;
    if (!premiumUSD) {
      premiumUSD = await calculatePolicyPremium(params);
    }

    // 3. Check if the Liquidity Pool has sufficient collateral
    await checkPoolLiquidity(params);

    // 4. Convert duration days to expiration block height
    const expirationHeight = await daysToBlockHeight(params.durationDays);

    // 5. Prepare on-chain transaction
    const policyCreationTx = await preparePolicyCreationTransaction({
      owner: params.owner,
      protectedValue: usdToSats(params.protectedValueUSD),
      protectionAmount: btcToSats(params.protectionAmountBTC),
      expirationHeight,
      premium: usdToSats(premiumUSD),
      policyType: params.policyType,
    });

    // 6. Create pending transaction record
    const pendingTxId = await db.insert("pendingPolicyTransactions", {
      actionType: "Create",
      status: "Pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      payload: {
        params,
        transaction: policyCreationTx,
      },
      retryCount: 0,
      userId: params.owner,
    });

    // 7. Return transaction data for user to sign
    return {
      pendingTxId,
      transaction: policyCreationTx.txOptions,
      estimatedPremium: premiumUSD,
    };
  }
);

// Request policy activation (buyer action)
export const requestPolicyActivation = action(
  async ({ db, scheduler }, params: PolicyActivationParams) => {
    // 1. Get policy and verify ownership
    const policy = await db.get("policies", params.policyId);
    if (!policy) throw new Error("Policy not found");

    // 2. Check eligibility (reusing query)
    const eligibility = await checkPolicyActivationEligibility(params.policyId);

    if (!eligibility.eligible) {
      throw new Error(
        `Policy not eligible for activation: ${eligibility.reason}`
      );
    }

    // 3. Prepare on-chain transaction
    const activationTx = await preparePolicyActivationTransaction({
      policyId: params.policyId,
      currentPrice: usdToSats(params.currentPriceUSD),
      settlementAmount: eligibility.settlementAmount,
    });

    // 4. Create pending transaction record
    const pendingTxId = await db.insert("pendingPolicyTransactions", {
      policyId: params.policyId,
      actionType: "Activate",
      status: "Pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      payload: {
        params,
        transaction: activationTx,
      },
      retryCount: 0,
      userId: policy.owner,
    });

    // 5. Return transaction data for user to sign
    return {
      pendingTxId,
      transaction: activationTx.txOptions,
      settlementAmount: satsToUSD(eligibility.settlementAmount),
    };
  }
);

// Handle transaction status update (after user signs and submits)
export const updateTransactionStatus = mutation(
  async ({ db }, pendingTxId: string, transactionId: string) => {
    // Update the pending transaction with the Stacks txid
    await db.patch("pendingPolicyTransactions", pendingTxId, {
      status: "Submitted",
      transactionId,
      updatedAt: Date.now(),
    });

    // Schedule a job to check transaction status
    await scheduler.runAfter(60000, "internal:checkTransactionStatus", {
      pendingTxId,
      transactionId,
    });

    return { success: true };
  }
);

// Request premium distribution for an expired policy
export const requestPremiumDistribution = action(
  async ({ db, scheduler }, params: PremiumDistributionParams) => {
    // 1. Check eligibility
    const eligibility = await checkPremiumDistributionEligibility(
      params.policyId
    );

    if (!eligibility.eligible) {
      throw new Error(
        `Policy not eligible for premium distribution: ${eligibility.reason}`
      );
    }

    // 2. Verify the counterparty is correct
    if (params.counterparty !== eligibility.counterparty) {
      throw new Error(
        "Unauthorized: Only the policy counterparty can request premium distribution"
      );
    }

    // 3. Prepare transaction
    const distributionTx = await preparePremiumDistributionTransaction({
      policyId: params.policyId,
      counterparty: params.counterparty,
      premiumAmount: eligibility.premiumAmount,
      collateralToken: eligibility.collateralToken,
    });

    // 4. Create pending transaction record
    const pendingTxId = await db.insert("pendingPolicyTransactions", {
      policyId: params.policyId,
      actionType: "PremiumDistribution",
      status: "Pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      payload: {
        params,
        transaction: distributionTx,
      },
      retryCount: 0,
      userId: params.counterparty,
    });

    // 5. Return transaction data for counterparty to sign
    return {
      pendingTxId,
      transaction: distributionTx.txOptions,
      premiumAmount: eligibility.premiumAmount,
    };
  }
);
```

### 4.2 Internal Functions

```typescript
// Check transaction status and update records
export const checkTransactionStatus = action(
  async (
    { db, scheduler },
    {
      pendingTxId,
      transactionId,
    }: { pendingTxId: string; transactionId: string }
  ) => {
    // Get pending transaction
    const pendingTx = await db.get("pendingPolicyTransactions", pendingTxId);
    if (!pendingTx) {
      return { error: "Pending transaction not found" };
    }

    // Query Stacks API for transaction status
    const txStatus = await getTransactionStatus(transactionId);

    if (txStatus.status === "pending") {
      // Still pending, check again later
      await scheduler.runAfter(60000, "internal:checkTransactionStatus", {
        pendingTxId,
        transactionId,
      });
      return { status: "pending" };
    }

    if (txStatus.status === "success") {
      // Transaction confirmed - update records based on action type
      await db.patch("pendingPolicyTransactions", pendingTxId, {
        status: "Confirmed",
        updatedAt: Date.now(),
      });

      if (pendingTx.actionType === "Create") {
        // Handle successful policy creation
        await handlePolicyCreationSuccess(pendingTx, txStatus);
      } else if (pendingTx.actionType === "Activate") {
        // Handle successful policy activation
        await handlePolicyActivationSuccess(pendingTx, txStatus);
      }

      return { status: "confirmed" };
    }

    if (txStatus.status === "failed") {
      // Transaction failed
      await db.patch("pendingPolicyTransactions", pendingTxId, {
        status: "Failed",
        error: txStatus.reason || "Transaction failed",
        updatedAt: Date.now(),
      });

      return { status: "failed", reason: txStatus.reason };
    }
  }
);

// Scheduled job to check for expired policies
export const checkExpiredPolicies = action(async ({ db, scheduler }) => {
  // Get current block height
  const currentBlockHeight = await getLatestBlockHeight();

  // Find policies that have expired but still marked as active
  const expiredPolicies = await db
    .query("policies")
    .withIndex("status", (q) => q.eq("status", PolicyStatus.ACTIVE))
    .filter((q) => q.lt((p) => p.expirationHeight, currentBlockHeight))
    .collect();

  // Process in smaller batches if many policies expired
  const batchSize = 10;
  for (let i = 0; i < expiredPolicies.length; i += batchSize) {
    const batch = expiredPolicies.slice(i, i + batchSize);

    // For each batch, prepare a transaction to expire policies on-chain
    const policyIds = batch.map((p) => p.policyId);

    // Handle expiration using backend key (no user signature needed)
    await expirePoliciesBatch(policyIds);

    // TEMPORARY WORKAROUND: Due to simplified batch expiration in the initial contract implementation,
    // we also need to expire each policy individually until the full batch functionality is implemented
    for (const policy of batch) {
      await updatePolicyStatus({
        policyId: policy.policyId,
        newStatus: PolicyStatus.EXPIRED,
      });
    }
  }

  // Schedule next check (e.g., every hour)
  await scheduler.runAfter(3600000, "internal:checkExpiredPolicies", {});

  return { processedCount: expiredPolicies.length };
});

// Handle on-chain events for policy status updates
export const processPolicyStatusEvent = mutation(
  async ({ db }, eventData: any) => {
    // Extract event data from Stacks event
    const { policyId, newStatus, previousStatus, blockHeight } = eventData;

    // Update policy record
    await db.patch("policies", policyId, {
      status: newStatus,
      lastUpdatedTimestamp: Date.now(),
    });

    // Add event to history
    await db.insert("policyEvents", {
      policyId,
      eventType: mapStatusToEventType(newStatus),
      timestamp: Date.now(),
      blockHeight,
      previousStatus,
      newStatus,
      data: eventData,
    });

    // If policy was exercised, update additional settlement information
    if (newStatus === PolicyStatus.EXERCISED) {
      await db.patch("policies", policyId, {
        exerciseHeight: blockHeight,
        exerciseTimestamp: Date.now(),
        // Other settlement data from event
      });
    }

    return { success: true };
  }
);

// Process premium distribution
export const handlePremiumDistributionSuccess = async (
  db,
  pendingTx,
  txStatus
) => {
  const { policyId, userId: counterparty } = pendingTx;
  const { premiumAmount, collateralToken } = pendingTx.payload.params;

  // Update policy premium distribution status
  await db.patch("policies", policyId, {
    premiumDistributed: true,
    lastUpdatedTimestamp: Date.now(),
  });

  // Add event to history
  await db.insert("policyEvents", {
    policyId,
    eventType: PolicyEventType.PREMIUM_DISTRIBUTED,
    timestamp: Date.now(),
    blockHeight: txStatus.blockHeight,
    transactionId: pendingTx.transactionId,
    premiumAmount,
    counterparty,
    collateralToken,
    data: {
      transactionDetails: txStatus,
    },
  });

  // Also update liquidity pool records about premium distribution
  // This will likely involve calling a function from the Liquidity Pool service
  await distributePremiumToPool(
    policyId,
    counterparty,
    premiumAmount,
    collateralToken
  );

  return { success: true };
};

// Helper function for premium distribution blockchain integration
async function preparePremiumDistributionTransaction(params: {
  policyId: number;
  counterparty: string;
  premiumAmount: number;
  collateralToken: string;
}): Promise<{ txOptions: any }> {
  // Get contract addresses
  const policyRegistryContract = await getContractAddress("policyRegistry");

  // Construct transaction options
  return {
    txOptions: {
      network: getNetwork(),
      anchorMode: AnchorMode.Any,
      fee: calculateFee(1),
      postConditionMode: PostConditionMode.Deny,
      txType: "contract_call",
      contractAddress: policyRegistryContract.address,
      contractName: policyRegistryContract.name,
      functionName: "process-expired-policy-premium",
      functionArgs: [
        // Convert policyId to Clarity uint
        uintCV(params.policyId),
      ],
    },
  };
}
```

### 4.3 Helper Functions

```typescript
// Calculate policy premium based on parameters
async function calculatePolicyPremium(
  params: PolicyCreationParams
): Promise<number> {
  // Call premium calculation service
  return await callPremiumCalculationService({
    protectedValueUSD: params.protectedValueUSD,
    protectionAmountBTC: params.protectionAmountBTC,
    durationDays: params.durationDays,
    policyType: params.policyType,
  });
}

// Calculate settlement amount for a policy
function calculateSettlementAmount(
  policyType: PolicyType,
  protectedValue: number,
  currentPrice: number,
  protectionAmount: number
): number {
  if (policyType === PolicyType.PUT) {
    // For PUT: (strike_price - current_price) * protection_amount / strike_price
    return (
      ((protectedValue - currentPrice) * protectionAmount) / protectedValue
    );
  } else {
    // For CALL: (current_price - strike_price) * protection_amount / strike_price
    return (
      ((currentPrice - protectedValue) * protectionAmount) / protectedValue
    );
  }
}

// Convert days to block height
async function daysToBlockHeight(days: number): Promise<number> {
  // Get current block height
  const currentHeight = await getLatestBlockHeight();

  // Estimate blocks per day (144 for Bitcoin, ~1440 for Stacks)
  const blocksPerDay = 1440;

  // Calculate expiration height
  return currentHeight + Math.floor(days * blocksPerDay);
}

// Map policy status to event type
function mapStatusToEventType(status: PolicyStatus): PolicyEventType {
  switch (status) {
    case PolicyStatus.ACTIVE:
      return PolicyEventType.CREATED;
    case PolicyStatus.EXERCISED:
      return PolicyEventType.ACTIVATED;
    case PolicyStatus.EXPIRED:
      return PolicyEventType.EXPIRED;
    case PolicyStatus.CANCELLED:
      return PolicyEventType.CANCELLED;
    default:
      return PolicyEventType.UPDATED;
  }
}
```

## 5. Blockchain Integration

The Policy Registry Service interacts with the minimal on-chain Policy Registry contract through the Blockchain Integration Layer. This includes:

### 5.1 Transaction Preparation

```typescript
// Prepare policy creation transaction
async function preparePolicyCreationTransaction(params: {
  owner: string;
  protectedValue: number;
  protectionAmount: number;
  expirationHeight: number;
  premium: number;
  policyType: PolicyType;
}): Promise<{ txOptions: any }> {
  // 1. Get contract addresses
  const policyRegistryContract = await getContractAddress("policyRegistry");
  const liquidityPoolContract = await getContractAddress("liquidityPoolVault");

  // 2. Determine position type based on policy type
  const positionType =
    params.policyType === PolicyType.PUT
      ? PositionType.LONG_PUT
      : PositionType.LONG_CALL;

  // 3. Set counterparty to liquidity pool for now (in MVP)
  const counterparty = liquidityPoolContract.address;

  // 4. Construct transaction options for a combined transaction:
  //    - Premium payment to Liquidity Pool
  //    - Policy creation in Policy Registry with position type and counterparty
  return {
    txOptions: {
      network: getNetwork(),
      anchorMode: AnchorMode.Any,
      fee: calculateFee(2), // Fee for a transaction with 2 post-conditions
      postConditionMode: PostConditionMode.Deny,
      postConditions: [],
      // This will be a transaction with multiple contract calls
      txType: "contract_call",
      contractAddress: policyRegistryContract.address,
      contractName: policyRegistryContract.name,
      functionName: "create-policy-entry",
      functionArgs: [
        // Owner principal
        principalCV(params.owner),
        // Counterparty principal (liquidity pool)
        principalCV(counterparty),
        // Protected value in sats
        uintCV(params.protectedValue),
        // Protection amount in base units
        uintCV(params.protectionAmount),
        // Premium amount
        uintCV(params.premium),
        // Expiration height
        uintCV(params.expirationHeight),
        // Policy type (PUT/CALL)
        stringCV(params.policyType),
        // Position type (LONG_PUT/LONG_CALL)
        stringCV(positionType),
      ],
    },
  };
}

// Prepare policy activation transaction
async function preparePolicyActivationTransaction(params: {
  policyId: number;
  currentPrice: number;
  settlementAmount: number;
}): Promise<{ txOptions: any }> {
  // Similar to above, prepare transaction for policy activation
  // ...
}
```

### 5.2 Event Handling

```typescript
// Set up listeners for on-chain events
export function initializeEventListeners() {
  // Listen for policy creation events
  listenForContractEvent({
    contractAddress: policyRegistryContract.address,
    contractName: policyRegistryContract.name,
    eventName: "policy-created",
    callback: (event) => {
      // Process event data
      const {
        policyId,
        owner,
        counterparty,
        protectedValue,
        protectionAmount,
        premium,
        expirationHeight,
        policyType,
        positionType,
      } = event;

      // Create corresponding record in Convex
      db.insert("policies", {
        policyId,
        owner,
        counterparty,
        protectedValue,
        protectionAmount,
        expirationHeight,
        premium,
        policyType,
        positionType,
        status: PolicyStatus.ACTIVE,
        premiumDistributed: false,
        premiumPaid: true, // Premium is paid at creation
        creationTimestamp: Date.now(),
        lastUpdatedTimestamp: Date.now(),
        collateralToken:
          policyType === PolicyType.PUT ? TokenType.STX : TokenType.SBTC,
        protectedAsset: TokenType.BTC,
        settlementToken:
          policyType === PolicyType.PUT ? TokenType.STX : TokenType.SBTC,
        tags: [],
      });
    },
  });

  // Listen for policy status update events
  listenForContractEvent({
    contractAddress: policyRegistryContract.address,
    contractName: policyRegistryContract.name,
    eventName: "policy-status-updated",
    callback: (event) => {
      // Process event data
      processPolicyStatusEvent(event);

      // If policy expired, check for premium distribution
      if (event.newStatus === PolicyStatus.EXPIRED) {
        schedulePremiumDistribution(event.policyId);
      }
    },
  });

  // Listen for premium distribution events
  listenForContractEvent({
    contractAddress: policyRegistryContract.address,
    contractName: policyRegistryContract.name,
    eventName: "premium-distribution-initiated",
    callback: (event) => {
      // Process premium distribution event
      processPremiumDistributionEvent(event);
    },
  });
}

// Process premium distribution event
export const processPremiumDistributionEvent = mutation(
  async ({ db }, eventData) => {
    const { policyId, counterparty, premiumAmount, token } = eventData;

    // Update policy record to mark premium as distributed
    await db.patch("policies", policyId, {
      premiumDistributed: true,
      lastUpdatedTimestamp: Date.now(),
    });

    // Add premium distribution event to history
    await db.insert("policyEvents", {
      policyId,
      eventType: PolicyEventType.PREMIUM_DISTRIBUTED,
      timestamp: Date.now(),
      blockHeight: eventData.blockHeight,
      transactionId: eventData.transactionId,
      premiumAmount,
      counterparty,
      collateralToken: token,
      data: eventData,
    });

    // Notify Liquidity Pool service about the premium distribution
    await notifyLiquidityPoolOfPremiumDistribution({
      policyId,
      counterparty,
      premiumAmount,
      token,
      transactionId: eventData.transactionId,
    });

    return { success: true };
  }
);

// Schedule premium distribution for an expired policy
async function schedulePremiumDistribution(policyId: number) {
  // Get policy details
  const policy = await db.get("policies", policyId);

  // Only process if premium hasn't been distributed yet
  if (!policy || policy.premiumDistributed) {
    return;
  }

  // Schedule premium distribution task
  await scheduler.runAfter(
    300000, // 5 minutes delay to ensure policy is fully expired on-chain
    "internal:distributePolicyPremium",
    { policyId }
  );
}

// Distribute premium for an expired policy
export const distributePolicyPremium = action(
  async ({ db, scheduler }, { policyId }) => {
    // Check eligibility
    const eligibility = await checkPremiumDistributionEligibility(policyId);

    if (!eligibility.eligible) {
      return { success: false, reason: eligibility.reason };
    }

    // Prepare premium distribution transaction
    const distributionTx = await preparePremiumDistributionTransaction({
      policyId,
      counterparty: eligibility.counterparty,
      premiumAmount: eligibility.premiumAmount,
      collateralToken: eligibility.collateralToken,
    });

    // Create pending transaction record
    const pendingTxId = await db.insert("pendingPolicyTransactions", {
      policyId,
      actionType: "PremiumDistribution",
      status: "Pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      payload: {
        policyId,
        counterparty: eligibility.counterparty,
        premiumAmount: eligibility.premiumAmount,
        collateralToken: eligibility.collateralToken,
      },
      retryCount: 0,
      // System-initiated transaction uses backend principal
      userId: await getBackendPrincipal(),
    });

    // Submit transaction using backend key
    const txid = await submitBackendTransaction(distributionTx.txOptions);

    // Update pending transaction record
    await db.patch("pendingPolicyTransactions", pendingTxId, {
      status: "Submitted",
      transactionId: txid,
      updatedAt: Date.now(),
    });

    // Schedule transaction status check
    await scheduler.runAfter(60000, "internal:checkTransactionStatus", {
      pendingTxId,
      transactionId: txid,
    });

    return { success: true, transactionId: txid };
  }
);

// Notify Liquidity Pool service about premium distribution
async function notifyLiquidityPoolOfPremiumDistribution(params: {
  policyId: number;
  counterparty: string;
  premiumAmount: number;
  token: string;
  transactionId: string;
}) {
  // Call the Liquidity Pool service to record premium distribution
  // This will trigger provider-specific premium allocation
  await callLiquidityPoolService("recordPolicyPremium", params);

  return { success: true };
}
```

## 6. Error Handling and Recovery

The Policy Registry implements several strategies for robust error handling:

### 6.1 Transaction Monitoring

- Every submitted transaction is tracked with a corresponding record in the `pendingPolicyTransactions` table
- Scheduled jobs check transaction status regularly
- Failed transactions are clearly marked, with error details captured

### 6.2 State Reconciliation

```typescript
// Scheduled job to reconcile on-chain and off-chain state
export const reconcileOnChainState = action(async ({ db, scheduler }) => {
  // 1. Get a batch of policies to check
  const policies = await db.query("policies").take(100); // Limit batch size

  // 2. For each policy, check on-chain status
  for (const policy of policies) {
    const onChainStatus = await getPolicyOnChainStatus(policy.policyId);

    // 3. If there's a mismatch, update off-chain record
    if (policy.status !== onChainStatus) {
      await db.patch("policies", policy.policyId, {
        status: onChainStatus,
        lastUpdatedTimestamp: Date.now(),
      });

      // 4. Log the reconciliation
      await db.insert("policyEvents", {
        policyId: policy.policyId,
        eventType: PolicyEventType.UPDATED,
        timestamp: Date.now(),
        previousStatus: policy.status,
        newStatus: onChainStatus,
        data: { reconciliation: true },
      });
    }
  }

  // 5. Schedule next reconciliation
  await scheduler.runAfter(24 * 3600000, "internal:reconcileOnChainState", {});

  return { checkedCount: policies.length };
});
```

## 7. Conclusion

The Policy Registry Service design follows the "On-Chain Light" approach by:

1. Storing minimal, essential data on-chain (policy ID, owner, core terms, status)
2. Managing comprehensive metadata, indices, and derived metrics off-chain in Convex
3. Orchestrating the complete policy lifecycle from creation through settlement and expiration
4. Providing robust error handling and recovery mechanisms
5. Synchronizing state between on-chain and off-chain components

This architecture achieves the important balance between:

- Blockchain security and trust for essential operations
- Off-chain flexibility and cost efficiency for complex logic
- Comprehensive history and metadata for a rich user experience

## 8. Next Steps

The next documentation components will cover:

1. On-chain Policy Registry contract specification (`policy-registry-specification-guidelines.md`)
2. Policy Registry component interaction flows (`policy-registry-component-interaction-flows.md`)
3. Policy Registry data flows (`policy-registry-dataflow-explanation.md`)
