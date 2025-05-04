BitHedge Liquidity Pool: Convex Backend Architecture

1. Introduction
   This document outlines the architecture of the Liquidity Pool component within the BitHedge platform, focusing specifically on its off-chain implementation in the Convex backend. The Liquidity Pool is responsible for managing capital from providers, allocating collateral to policies, processing settlements, distributing yield, and providing risk management services. Following the "On-Chain Light" approach, this component distributes responsibilities between minimal on-chain storage and comprehensive off-chain management.
2. System Context
   The Liquidity Pool Service is a core component of the BitHedge platform, interacting with several other components:

┌──────────────────────┐ ┌───────────────┐ ┌─────────────────────┐
│ │ │ │ │ │
│ Frontend Components ├─────►│ Liquidity │◄────►│ Policy Registry │
│ (ProviderIncome.tsx)│ │ Pool Service │ │ Service │
│ │ │ │ │ │
└──────────────────────┘ └─────┬─────────┘ └─────────────────────┘
│ ▲
│ │
▼ │
┌──────────────────────┐ ┌─────┴──┴────────────┐ ┌─────────────────────┐
│ │ │ │ │ │
│ Oracle Service │◄────►│ Blockchain │◄────►│ On-Chain │
│ │ │ Integration Layer │ │ Liquidity Pool │
│ │ │ │ │ Vault │
└──────────────────────┘ └──────────────────────┘ └─────────────────────┘

3. Data Model
   3.1 Convex Schema
   The Liquidity Pool manages several key data structures within Convex:

// Provider deposits and balances table
defineTable({
name: "providerBalances",
schema: {
// Primary identification
providerId: v.string(), // Principal of the provider
tokenId: v.string(), // Token identifier (e.g., 'STX', 'sBTC')

    // Balance tracking
    totalDeposited: v.number(), // Total amount ever deposited
    currentBalance: v.number(), // Current balance (total - withdrawals)
    allocatedBalance: v.number(), // Amount backing active policies
    availableBalance: v.number(), // Amount available for withdrawal

    // Risk tier information
    riskTier: v.string(), // "Conservative", "Balanced", "Aggressive"
    riskMultiplier: v.number(), // Risk-based allocation multiplier

    // Yield tracking
    totalEarnedPremiums: v.number(), // Total earned from premiums
    totalSettlementLosses: v.number(), // Total lost to settlements
    netYield: v.number(), // Net yield (premiums - losses)

    // Time-based fields
    lastDepositTimestamp: v.number(), // Last deposit time
    lastWithdrawalTimestamp: v.number(), // Last withdrawal time
    lastUpdateTimestamp: v.number(), // Last update time

},
indexes: [
// Find balances for a provider
{ field: "providerId" },
// Find balances by token
{ field: "tokenId" },
// Find balances by risk tier
{ field: "riskTier" },
],
});

// Pool-wide metrics and state
defineTable({
name: "poolMetrics",
schema: {
tokenId: v.string(), // Token identifier (primary key)

    // Pool capacity metrics
    totalDeposited: v.number(), // Total ever deposited
    currentTotalBalance: v.number(), // Current total balance
    totalAllocated: v.number(), // Total allocated to policies
    totalAvailable: v.number(), // Total available for new policies

    // Risk tier distributions
    conservativeTierAmount: v.number(), // Amount in conservative tier
    balancedTierAmount: v.number(), // Amount in balanced tier
    aggressiveTierAmount: v.number(), // Amount in aggressive tier

    // Performance metrics
    totalPremiumsCollected: v.number(), // Total premiums collected
    totalSettlementsPaid: v.number(), // Total settlements paid
    netPoolYield: v.number(), // Net yield across the pool

    // Utilization metrics
    utilizationRate: v.number(), // Percentage of pool in use
    averageAPY: v.number(), // Average yield across all providers

    // Last updated timestamp
    lastUpdateTimestamp: v.number(),

},
});

// Policy allocations table (tracks which providers back which policies)
defineTable({
name: "policyAllocations",
schema: {
policyId: v.number(), // Reference to policy
providerId: v.string(), // Provider backing this policy
tokenId: v.string(), // Token type used for backing
allocatedAmount: v.number(), // Amount allocated from this provider
premiumShare: v.number(), // Provider's share of the premium
settlementLiability: v.number(), // Provider's liability if settled
allocationTimestamp: v.number(), // When allocation was made
},
indexes: [
// Find allocations for a policy
{ field: "policyId" },
// Find allocations by provider
{ field: "providerId" },
],
});

// Transaction history table
defineTable({
name: "poolTransactions",
schema: {
transactionId: v.string(), // Unique identifier or blockchain txid
providerId: v.string(), // Provider involved (if applicable)
transactionType: v.string(), // "Deposit", "Withdrawal", "Settlement", etc.
tokenId: v.string(), // Token involved
amount: v.number(), // Transaction amount
timestamp: v.number(), // Transaction time
status: v.string(), // "Pending", "Confirmed", "Failed"
blockHeight: v.optional(v.number()), // Block height if confirmed
relatedPolicyId: v.optional(v.number()), // Related policy if applicable
metadata: v.optional(v.any()), // Additional transaction-specific data
},
indexes: [
// Find transactions by provider
{ field: "providerId" },
// Find transactions by type
{ field: "transactionType" },
// Find transactions by status
{ field: "status" },
],
});

// Pending pool transactions table
defineTable({
name: "pendingPoolTransactions",
schema: {
actionType: v.string(), // "Deposit", "Withdrawal", "Settlement", etc.
status: v.string(), // "Pending", "Submitted", "Confirmed", "Failed"
createdAt: v.number(), // When transaction was initiated
updatedAt: v.number(), // Last status update
transactionId: v.optional(v.string()), // Stacks txid when available
providerId: v.string(), // Principal of provider who initiated
tokenId: v.string(), // Token being transferred
amount: v.number(), // Amount being transferred
payload: v.any(), // Transaction payload/params
error: v.optional(v.string()), // Error message if failed
retryCount: v.number(), // Count of retry attempts
},
indexes: [
// Find pending transactions by provider
{ field: "providerId" },
// Find pending transactions by status
{ field: "status" },
],
});

3.2 Key Data Types

// Exported TypeScript types for use across the platform

// Risk tier enum
export enum RiskTier {
CONSERVATIVE = "Conservative",
BALANCED = "Balanced",
AGGRESSIVE = "Aggressive",
}

// Transaction type enum
export enum PoolTransactionType {
DEPOSIT = "Deposit",
WITHDRAWAL = "Withdrawal",
SETTLEMENT = "Settlement",
PREMIUM_EARNED = "PremiumEarned",
ALLOCATION = "Allocation",
RELEASE = "Release",
}

// Transaction status enum
export enum TransactionStatus {
PENDING = "Pending",
SUBMITTED = "Submitted",
CONFIRMED = "Confirmed",
FAILED = "Failed",
}

// Deposit parameters interface
export interface DepositParams {
providerId: string; // Principal of depositor
tokenId: string; // Token to deposit
amount: number; // Amount to deposit
riskTier: RiskTier; // Desired risk tier
}

// Withdrawal parameters interface
export interface WithdrawalParams {
providerId: string; // Principal of withdrawer
tokenId: string; // Token to withdraw
amount: number; // Amount to withdraw
}

// Policy allocation parameters interface
export interface PolicyAllocationParams {
policyId: number; // Policy to allocate for
premium: number; // Premium amount
protectedValue: number; // Strike price in base units
protectionAmount: number; // Amount protected in base units
policyType: string; // "PUT" or "CALL"
tokenId: string; // Token required for collateral
}

4. Services and Functions
   The Liquidity Pool Service exposes several key services to the rest of the application:
   4.1 Public API (Exposed to Frontend)
   Queries (Read-Only)

// Get provider balances across all tokens
export const getProviderBalances = query(
async ({ db, auth }) => {
// Check authentication
const identity = auth.getUserIdentity();
if (!identity) throw new Error("Not authenticated");

    const providerId = identity.tokenIdentifier;

    // Get provider balances for all tokens
    const balances = await db
      .query("providerBalances")
      .withIndex("providerId", (q) => q.eq("providerId", providerId))
      .collect();

    return balances;

}
);

// Get detailed provider dashboard data
export const getProviderDashboard = query(
async ({ db, auth }) => {
// Check authentication
const identity = auth.getUserIdentity();
if (!identity) throw new Error("Not authenticated");

    const providerId = identity.tokenIdentifier;

    // Get provider balances
    const balances = await db
      .query("providerBalances")
      .withIndex("providerId", (q) => q.eq("providerId", providerId))
      .collect();

    // Get provider's policy allocations
    const allocations = await db
      .query("policyAllocations")
      .withIndex("providerId", (q) => q.eq("providerId", providerId))
      .collect();

    // Get provider's recent transactions
    const transactions = await db
      .query("poolTransactions")
      .withIndex("providerId", (q) => q.eq("providerId", providerId))
      .order("desc")
      .take(20);

    // Get pool-wide metrics for context
    const poolMetrics = await Promise.all(
      [...new Set(balances.map((b) => b.tokenId))].map(async (tokenId) => {
        return await db.get("poolMetrics", tokenId);
      })
    );

    // Calculate provider-specific metrics
    const metrics = calculateProviderMetrics(balances, allocations, poolMetrics);

    return {
      balances,
      allocations,
      transactions,
      poolMetrics,
      providerMetrics: metrics,
    };

}
);

// Get pool-wide metrics for a specific token
export const getPoolMetrics = query(
async ({ db }, tokenId: string) => {
// Get pool metrics record
const metrics = await db.get("poolMetrics", tokenId);
if (!metrics) {
throw new Error(`No metrics found for token ${tokenId}`);
}

    return metrics;

}
);

// Check if a withdrawal is possible
export const checkWithdrawalEligibility = query(
async ({ db, auth }, { tokenId, amount }: { tokenId: string; amount: number }) => {
// Check authentication
const identity = auth.getUserIdentity();
if (!identity) throw new Error("Not authenticated");

    const providerId = identity.tokenIdentifier;

    // Get provider balance
    const balance = await db
      .query("providerBalances")
      .withIndex("providerId", (q) =>
        q.eq("providerId", providerId).eq("tokenId", tokenId)
      )
      .first();

    if (!balance) {
      return {
        eligible: false,
        reason: "No balance found for this token"
      };
    }

    // Check if amount is available
    if (balance.availableBalance < amount) {
      return {
        eligible: false,
        reason: `Insufficient available balance. Available: ${balance.availableBalance}`
      };
    }

    // Check for time-based restrictions (e.g., cooldown period)
    const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours in ms
    const now = Date.now();
    if (balance.lastDepositTimestamp > 0 &&
        now - balance.lastDepositTimestamp < cooldownPeriod) {
      const remainingTime = Math.ceil(
        (balance.lastDepositTimestamp + cooldownPeriod - now) / (60 * 60 * 1000)
      );
      return {
        eligible: false,
        reason: `Withdrawal available in ${remainingTime} hours due to cooldown period`
      };
    }

    // All checks passed
    return {
      eligible: true,
      availableBalance: balance.availableBalance
    };

}
);

Mutations and Actions (Write Operations)

// Request capital commitment (deposit)
export const requestCapitalCommitment = action(
async ({ db, scheduler }, params: DepositParams) => {
// 1. Validate the parameters
validateDepositParameters(params);

    // 2. Check if provider already has a balance record for this token
    const existingBalance = await db
      .query("providerBalances")
      .withIndex("providerId", (q) =>
        q.eq("providerId", params.providerId).eq("tokenId", params.tokenId)
      )
      .first();

    // 3. Prepare the transaction based on token type
    const isStx = params.tokenId.toUpperCase() === 'STX';
    const depositTx = await prepareDepositTransaction({
      providerId: params.providerId,
      tokenId: params.tokenId,
      amount: params.amount,
      isStx: isStx
    });

    // 4. Create pending transaction record
    const pendingTxId = await db.insert("pendingPoolTransactions", {
      actionType: PoolTransactionType.DEPOSIT,
      status: TransactionStatus.PENDING,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      providerId: params.providerId,
      tokenId: params.tokenId,
      amount: params.amount,
      payload: {
        params,
        transaction: depositTx,
        riskTier: params.riskTier
      },
      retryCount: 0,
    });

    // 5. Return transaction data for user to sign
    return {
      pendingTxId,
      transaction: depositTx.txOptions,
      estimatedFee: depositTx.estimatedFee,
    };

}
);

// Request capital withdrawal
export const requestCapitalWithdrawal = action(
async ({ db, scheduler }, params: WithdrawalParams) => {
// 1. Check withdrawal eligibility (reusing query)
const eligibility = await checkWithdrawalEligibility({
tokenId: params.tokenId,
amount: params.amount
});

    if (!eligibility.eligible) {
      throw new Error(`Withdrawal not eligible: ${eligibility.reason}`);
    }

    // 2. Prepare the transaction based on token type
    const isStx = params.tokenId.toUpperCase() === 'STX';
    const withdrawalTx = await prepareWithdrawalTransaction({
      providerId: params.providerId,
      tokenId: params.tokenId,
      amount: params.amount,
      isStx: isStx
    });

    // 3. Create pending transaction record
    const pendingTxId = await db.insert("pendingPoolTransactions", {
      actionType: PoolTransactionType.WITHDRAWAL,
      status: TransactionStatus.PENDING,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      providerId: params.providerId,
      tokenId: params.tokenId,
      amount: params.amount,
      payload: {
        params,
        transaction: withdrawalTx
      },
      retryCount: 0,
    });

    // 4. Return transaction data for user to sign
    return {
      pendingTxId,
      transaction: withdrawalTx.txOptions,
      estimatedFee: withdrawalTx.estimatedFee,
    };

}
);

// Handle transaction status update (after user signs and submits)
export const updateTransactionStatus = mutation(
async ({ db }, pendingTxId: string, transactionId: string) => {
// Update the pending transaction with the Stacks txid
await db.patch("pendingPoolTransactions", pendingTxId, {
status: TransactionStatus.SUBMITTED,
transactionId,
updatedAt: Date.now(),
});

    // Schedule a job to check transaction status
    await scheduler.runAfter(60000, "internal:checkPoolTransactionStatus", {
      pendingTxId,
      transactionId,
    });

    return { success: true };

}
);

// Change provider's risk tier
export const updateProviderRiskTier = mutation(
async ({ db, auth }, { tokenId, newRiskTier }: { tokenId: string; newRiskTier: RiskTier }) => {
// Check authentication
const identity = auth.getUserIdentity();
if (!identity) throw new Error("Not authenticated");

    const providerId = identity.tokenIdentifier;

    // Get provider balance
    const balance = await db
      .query("providerBalances")
      .withIndex("providerId", (q) =>
        q.eq("providerId", providerId).eq("tokenId", tokenId)
      )
      .first();

    if (!balance) {
      throw new Error("No balance found for this token");
    }

    // Calculate new risk multiplier based on tier
    const riskMultiplier = getRiskMultiplierForTier(newRiskTier);

    // Update the balance record
    await db.patch("providerBalances", {
      providerId,
      tokenId
    }, {
      riskTier: newRiskTier,
      riskMultiplier,
      lastUpdateTimestamp: Date.now()
    });

    // Update pool metrics to reflect the tier change
    await updatePoolRiskTierDistribution(db, tokenId);

    return { success: true };

}
);

4.2 Internal Functions

// Check pool transaction status and update records
export const checkPoolTransactionStatus = action(
async (
{ db, scheduler },
{
pendingTxId,
transactionId,
}: { pendingTxId: string; transactionId: string }
) => {
// Get pending transaction
const pendingTx = await db.get("pendingPoolTransactions", pendingTxId);
if (!pendingTx) {
return { error: "Pending transaction not found" };
}

    // Query Stacks API for transaction status
    const txStatus = await getTransactionStatus(transactionId);

    if (txStatus.status === "pending") {
      // Still pending, check again later
      await scheduler.runAfter(60000, "internal:checkPoolTransactionStatus", {
        pendingTxId,
        transactionId,
      });
      return { status: "pending" };
    }

    if (txStatus.status === "success") {
      // Transaction confirmed - update records based on action type
      await db.patch("pendingPoolTransactions", pendingTxId, {
        status: TransactionStatus.CONFIRMED,
        updatedAt: Date.now(),
      });

      if (pendingTx.actionType === PoolTransactionType.DEPOSIT) {
        // Handle successful deposit
        await handleDepositSuccess(db, pendingTx, txStatus);
      } else if (pendingTx.actionType === PoolTransactionType.WITHDRAWAL) {
        // Handle successful withdrawal
        await handleWithdrawalSuccess(db, pendingTx, txStatus);
      }

      return { status: "confirmed" };
    }

    if (txStatus.status === "failed") {
      // Transaction failed
      await db.patch("pendingPoolTransactions", pendingTxId, {
        status: TransactionStatus.FAILED,
        error: txStatus.reason || "Transaction failed",
        updatedAt: Date.now(),
      });

      return { status: "failed", reason: txStatus.reason };
    }

}
);

// Allocate collateral for policies from the pool
export const allocateCollateralForPolicy = mutation(
async ({ db }, params: PolicyAllocationParams) => {
// Calculate required collateral based on policy type and terms
const requiredCollateral = calculateRequiredCollateral(
params.policyType,
params.protectedValue,
params.protectionAmount
);

    // Get all providers for this token with available balance
    const eligibleProviders = await db
      .query("providerBalances")
      .withIndex("tokenId", (q) => q.eq("tokenId", params.tokenId))
      .filter((q) => q.gt((p) => p.availableBalance, 0))
      .collect();

    // Sort providers by risk tier (aggressive first) and then by available balance
    const sortedProviders = sortProvidersByRiskAndBalance(eligibleProviders);

    // Check if we have enough total available balance
    const totalAvailable = sortedProviders.reduce(
      (sum, p) => sum + p.availableBalance,
      0
    );

    if (totalAvailable < requiredCollateral) {
      throw new Error(`Insufficient pool liquidity. Required: ${requiredCollateral}, Available: ${totalAvailable}`);
    }

    // Allocate collateral from providers based on risk tier
    const allocations = allocateCollateralFromProviders(
      sortedProviders,
      requiredCollateral,
      params.premium
    );

    // Record allocations in database
    for (const allocation of allocations) {
      await db.insert("policyAllocations", {
        policyId: params.policyId,
        providerId: allocation.providerId,
        tokenId: params.tokenId,
        allocatedAmount: allocation.allocatedAmount,
        premiumShare: allocation.premiumShare,
        settlementLiability: allocation.settlementLiability,
        allocationTimestamp: Date.now()
      });

      // Update provider's balance
      const provider = sortedProviders.find(p => p.providerId === allocation.providerId)!;
      await db.patch("providerBalances", {
        providerId: provider.providerId,
        tokenId: params.tokenId
      }, {
        allocatedBalance: provider.allocatedBalance + allocation.allocatedAmount,
        availableBalance: provider.availableBalance - allocation.allocatedAmount,
        lastUpdateTimestamp: Date.now()
      });

      // Record allocation transaction
      await db.insert("poolTransactions", {
        transactionId: `allocation-${params.policyId}-${allocation.providerId}`,
        providerId: allocation.providerId,
        transactionType: PoolTransactionType.ALLOCATION,
        tokenId: params.tokenId,
        amount: allocation.allocatedAmount,
        timestamp: Date.now(),
        status: TransactionStatus.CONFIRMED,
        relatedPolicyId: params.policyId,
        metadata: {
          premiumShare: allocation.premiumShare,
          settlementLiability: allocation.settlementLiability
        }
      });
    }

    // Update pool metrics
    await updatePoolMetrics(db, params.tokenId);

    return {
      success: true,
      allocations: allocations.map(a => ({
        providerId: a.providerId,
        allocatedAmount: a.allocatedAmount,
        premiumShare: a.premiumShare
      }))
    };

}
);

// Process policy settlement
export const processSettlement = mutation(
async ({ db }, {
policyId,
tokenId,
settlementAmount
}: {
policyId: number;
tokenId: string;
settlementAmount: number
}) => {
// Get all allocations for the policy
const allocations = await db
.query("policyAllocations")
.withIndex("policyId", (q) => q.eq("policyId", policyId))
.collect();

    if (allocations.length === 0) {
      throw new Error(`No allocations found for policy ${policyId}`);
    }

    // Calculate settlement impact on each provider
    for (const allocation of allocations) {
      // Get provider's balance
      const balance = await db
        .query("providerBalances")
        .withIndex("providerId", (q) =>
          q.eq("providerId", allocation.providerId).eq("tokenId", tokenId)
        )
        .first();

      if (!balance) {
        throw new Error(`Provider balance not found: ${allocation.providerId}`);
      }

      // Calculate provider's share of the settlement
      const providerSettlementShare =
        (allocation.allocatedAmount / allocations.reduce((sum, a) => sum + a.allocatedAmount, 0)) *
        settlementAmount;

      // Update provider's balance
      await db.patch("providerBalances", {
        providerId: allocation.providerId,
        tokenId
      }, {
        allocatedBalance: balance.allocatedBalance - allocation.allocatedAmount,
        currentBalance: balance.currentBalance - providerSettlementShare,
        totalSettlementLosses: balance.totalSettlementLosses + providerSettlementShare,
        netYield: balance.netYield - providerSettlementShare,
        lastUpdateTimestamp: Date.now()
      });

      // Record settlement transaction
      await db.insert("poolTransactions", {
        transactionId: `settlement-${policyId}-${allocation.providerId}`,
        providerId: allocation.providerId,
        transactionType: PoolTransactionType.SETTLEMENT,
        tokenId,
        amount: providerSettlementShare,
        timestamp: Date.now(),
        status: TransactionStatus.CONFIRMED,
        relatedPolicyId: policyId,
        metadata: {
          allocationAmount: allocation.allocatedAmount,
          settlementShare: providerSettlementShare
        }
      });
    }

    // Update pool metrics
    await updatePoolMetrics(db, tokenId);

    return { success: true };

}
);

// Process premium distribution
export const distributePremium = mutation(
async ({ db }, {
policyId,
tokenId,
premiumAmount
}: {
policyId: number;
tokenId: string;
premiumAmount: number
}) => {
// Get all allocations for the policy
const allocations = await db
.query("policyAllocations")
.withIndex("policyId", (q) => q.eq("policyId", policyId))
.collect();

    if (allocations.length === 0) {
      throw new Error(`No allocations found for policy ${policyId}`);
    }

    // Distribute premium to each provider
    for (const allocation of allocations) {
      // Get provider's balance
      const balance = await db
        .query("providerBalances")
        .withIndex("providerId", (q) =>
          q.eq("providerId", allocation.providerId).eq("tokenId", tokenId)
        )
        .first();

      if (!balance) {
        throw new Error(`Provider balance not found: ${allocation.providerId}`);
      }

      // Calculate provider's share of the premium
      const premiumShare = allocation.premiumShare;

      // Update provider's balance
      await db.patch("providerBalances", {
        providerId: allocation.providerId,
        tokenId
      }, {
        totalEarnedPremiums: balance.totalEarnedPremiums + premiumShare,
        netYield: balance.netYield + premiumShare,
        lastUpdateTimestamp: Date.now()
      });

      // Record premium transaction
      await db.insert("poolTransactions", {
        transactionId: `premium-${policyId}-${allocation.providerId}`,
        providerId: allocation.providerId,
        transactionType: PoolTransactionType.PREMIUM_EARNED,
        tokenId,
        amount: premiumShare,
        timestamp: Date.now(),
        status: TransactionStatus.CONFIRMED,
        relatedPolicyId: policyId,
        metadata: {
          allocationAmount: allocation.allocatedAmount,
          premiumShare
        }
      });
    }

    // Update pool metrics
    await updatePoolMetrics(db, tokenId);

    return { success: true };

}
);

4.3 Helper Functions

// Handle successful deposit transaction
async function handleDepositSuccess(db, pendingTx, txStatus) {
const { providerId, tokenId, amount } = pendingTx;
const { riskTier } = pendingTx.payload;

// Check if provider already has a balance record
const existingBalance = await db
.query("providerBalances")
.withIndex("providerId", (q) =>
q.eq("providerId", providerId).eq("tokenId", tokenId)
)
.first();

if (existingBalance) {
// Update existing balance
await db.patch("providerBalances", {
providerId,
tokenId
}, {
totalDeposited: existingBalance.totalDeposited + amount,
currentBalance: existingBalance.currentBalance + amount,
availableBalance: existingBalance.availableBalance + amount,
lastDepositTimestamp: Date.now(),
lastUpdateTimestamp: Date.now()
});
} else {
// Create new balance record
const riskMultiplier = getRiskMultiplierForTier(riskTier);

    await db.insert("providerBalances", {
      providerId,
      tokenId,
      totalDeposited: amount,
      currentBalance: amount,
      allocatedBalance: 0,
      availableBalance: amount,
      riskTier,
      riskMultiplier,
      totalEarnedPremiums: 0,
      totalSettlementLosses: 0,
      netYield: 0,
      lastDepositTimestamp: Date.now(),
      lastWithdrawalTimestamp: 0,
      lastUpdateTimestamp: Date.now()
    });

}

// Record transaction in history
await db.insert("poolTransactions", {
transactionId: pendingTx.transactionId,
providerId,
transactionType: PoolTransactionType.DEPOSIT,
tokenId,
amount,
timestamp: Date.now(),
status: TransactionStatus.CONFIRMED,
blockHeight: txStatus.blockHeight,
metadata: {
riskTier
}
});

// Update pool metrics
await updatePoolMetrics(db, tokenId);
await updatePoolRiskTierDistribution(db, tokenId);
}

// Handle successful withdrawal transaction
async function handleWithdrawalSuccess(db, pendingTx, txStatus) {
const { providerId, tokenId, amount } = pendingTx;

// Get provider's balance
const balance = await db
.query("providerBalances")
.withIndex("providerId", (q) =>
q.eq("providerId", providerId).eq("tokenId", tokenId)
)
.first();

if (!balance) {
throw new Error(`Provider balance not found: ${providerId}`);
}

// Update balance
await db.patch("providerBalances", {
providerId,
tokenId
}, {
currentBalance: balance.currentBalance - amount,
availableBalance: balance.availableBalance - amount,
lastWithdrawalTimestamp: Date.now(),
lastUpdateTimestamp: Date.now()
});

// Record transaction in history
await db.insert("poolTransactions", {
transactionId: pendingTx.transactionId,
providerId,
transactionType: PoolTransactionType.WITHDRAWAL,
tokenId,
amount,
timestamp: Date.now(),
status: TransactionStatus.CONFIRMED,
blockHeight: txStatus.blockHeight
});

// Update pool metrics
await updatePoolMetrics(db, tokenId);
}

// Update pool metrics based on current state
async function updatePoolMetrics(db, tokenId) {
// Get all provider balances for this token
const balances = await db
.query("providerBalances")
.withIndex("tokenId", (q) => q.eq("tokenId", tokenId))
.collect();

// Calculate aggregated metrics
const totalDeposited = balances.reduce((sum, b) => sum + b.totalDeposited, 0);
const currentTotalBalance = balances.reduce((sum, b) => sum + b.currentBalance, 0);
const totalAllocated = balances.reduce((sum, b) => sum + b.allocatedBalance, 0);
const totalAvailable = balances.reduce((sum, b) => sum + b.availableBalance, 0);

const totalPremiumsCollected = balances.reduce((sum, b) => sum + b.totalEarnedPremiums, 0);
const totalSettlementsPaid = balances.reduce((sum, b) => sum + b.totalSettlementLosses, 0);
const netPoolYield = totalPremiumsCollected - totalSettlementsPaid;

const utilizationRate = currentTotalBalance > 0 ?
(totalAllocated / currentTotalBalance) \* 100 : 0;

const weightedYield = balances.reduce(
(sum, b) => sum + (b.netYield \* (b.currentBalance / currentTotalBalance)),
0
);
const averageAPY = calculateAnnualizedYield(weightedYield, currentTotalBalance);

// Update risk tier distribution
const conservativeTierAmount = balances
.filter(b => b.riskTier === RiskTier.CONSERVATIVE)
.reduce((sum, b) => sum + b.currentBalance, 0);

const balancedTierAmount = balances
.filter(b => b.riskTier === RiskTier.BALANCED)
.reduce((sum, b) => sum + b.currentBalance, 0);

const aggressiveTierAmount = balances
.filter(b => b.riskTier === RiskTier.AGGRESSIVE)
.reduce((sum, b) => sum + b.currentBalance, 0);

// Update or create pool metrics record
const existingMetrics = await db.get("poolMetrics", tokenId);

if (existingMetrics) {
await db.patch("poolMetrics", tokenId, {
totalDeposited,
currentTotalBalance,
totalAllocated,
totalAvailable,
conservativeTierAmount,
balancedTierAmount,
aggressiveTierAmount,
totalPremiumsCollected,
totalSettlementsPaid,
netPoolYield,
utilizationRate,
averageAPY,
lastUpdateTimestamp: Date.now()
});
} else {
await db.insert("poolMetrics", {
tokenId,
totalDeposited,
currentTotalBalance,
totalAllocated,
totalAvailable,
conservativeTierAmount,
balancedTierAmount,
aggressiveTierAmount,
totalPremiumsCollected,
totalSettlementsPaid,
netPoolYield,
utilizationRate,
averageAPY,
lastUpdateTimestamp: Date.now()
});
}
}

// Get risk multiplier based on tier
function getRiskMultiplierForTier(tier: RiskTier): number {
switch (tier) {
case RiskTier.CONSERVATIVE:
return 0.5; // Lower risk, lower reward
case RiskTier.BALANCED:
return 1.0; // Balanced risk/reward
case RiskTier.AGGRESSIVE:
return 2.0; // Higher risk, higher reward
default:
return 1.0;
}
}

// Sort providers by risk tier and available balance
function sortProvidersByRiskAndBalance(providers) {
// Custom sort: Aggressive first, then by available balance (high to low)
return [...providers].sort((a, b) => {
// First sort by risk tier (Aggressive > Balanced > Conservative)
const tierOrder = {
[RiskTier.AGGRESSIVE]: 0,
[RiskTier.BALANCED]: 1,
[RiskTier.CONSERVATIVE]: 2
};

    const tierDiff = tierOrder[a.riskTier] - tierOrder[b.riskTier];
    if (tierDiff !== 0) return tierDiff;

    // Then sort by available balance (high to low)
    return b.availableBalance - a.availableBalance;

});
}

// Allocate collateral from providers based on risk preference
function allocateCollateralFromProviders(
sortedProviders,
requiredCollateral,
premium
) {
const allocations = [];
let remainingCollateral = requiredCollateral;

// First pass: allocate from aggressive providers
const aggressiveProviders = sortedProviders.filter(
p => p.riskTier === RiskTier.AGGRESSIVE
);

    for (const provider of aggressiveProviders) {
    const allocation = Math.min(provider.availableBalance, remainingCollateral);
    if (allocation > 0) {
      allocations.push({
        providerId: provider.providerId,
        allocatedAmount: allocation,
        premiumShare: (allocation / requiredCollateral) * premium,
        settlementLiability: allocation
      });
      remainingCollateral -= allocation;
    }

    if (remainingCollateral <= 0) break;

}

// Second pass: allocate from balanced providers if needed
if (remainingCollateral > 0) {
const balancedProviders = sortedProviders.filter(
p => p.riskTier === RiskTier.BALANCED
);

    for (const provider of balancedProviders) {
      const allocation = Math.min(provider.availableBalance, remainingCollateral);
      if (allocation > 0) {
        allocations.push({
          providerId: provider.providerId,
          allocatedAmount: allocation,
          premiumShare: (allocation / requiredCollateral) * premium,
          settlementLiability: allocation
        });
        remainingCollateral -= allocation;
      }

      if (remainingCollateral <= 0) break;
    }

}

// Final pass: allocate from conservative providers if still needed
if (remainingCollateral > 0) {
const conservativeProviders = sortedProviders.filter(
p => p.riskTier === RiskTier.CONSERVATIVE
);

    for (const provider of conservativeProviders) {
      const allocation = Math.min(provider.availableBalance, remainingCollateral);
      if (allocation > 0) {
        allocations.push({
          providerId: provider.providerId,
          allocatedAmount: allocation,
          premiumShare: (allocation / requiredCollateral) * premium,
          settlementLiability: allocation
        });
        remainingCollateral -= allocation;
      }

      if (remainingCollateral <= 0) break;
    }

}

return allocations;
}

// Calculate required collateral based on policy parameters
function calculateRequiredCollateral(policyType, protectedValue, protectionAmount) {
// For PUT options, collateral is the full protected amount
if (policyType === "PUT") {
return protectionAmount;
}

// For CALL options, collateral is calculated differently
// This is a simplified version - actual implementation may vary
if (policyType === "CALL") {
return protectionAmount \* 0.5; // Example: 50% collateralization for CALLs
}

throw new Error(`Unsupported policy type: ${policyType}`);
}

// Calculate annualized yield percentage
function calculateAnnualizedYield(yield, principal) {
if (principal <= 0) return 0;

// Simple annualization assuming yield is accrued over last 30 days
const annualizedYield = (yield / principal) _ (365 / 30) _ 100;
return Math.max(0, annualizedYield); // Ensure non-negative
}

5. Blockchain Integration
   The Liquidity Pool Service interacts with the minimal on-chain Liquidity Pool Vault contract through the Blockchain Integration Layer:
   5.1 Transaction Preparation

// Prepare deposit transaction
async function prepareDepositTransaction(params: {
providerId: string;
tokenId: string;
amount: number;
isStx: boolean;
}): Promise<{ txOptions: any; estimatedFee: number }> {
// 1. Get contract address for Liquidity Pool Vault
const vaultContract = await getContractAddress("liquidityPoolVault");

// 2. Construct transaction options based on token type
if (params.isStx) {
// STX deposit
return {
txOptions: {
network: getNetwork(),
anchorMode: AnchorMode.Any,
fee: calculateFee(1), // Fee for a transaction with 1 post-condition
postConditionMode: PostConditionMode.Deny,
postConditions: [
makeStandardSTXPostCondition(
params.providerId,
FungibleConditionCode.Equal,
params.amount
),
],
txType: "contract_call",
contractAddress: vaultContract.address,
contractName: vaultContract.name,
functionName: "deposit-stx",
functionArgs: [
uintCV(params.amount),
],
},
estimatedFee: calculateFee(1),
};
} else {
// Token deposit (e.g., sBTC)
const tokenContract = await getTokenContractDetails(params.tokenId);

    return {
      txOptions: {
        network: getNetwork(),
        anchorMode: AnchorMode.Any,
        fee: calculateFee(1),
        postConditionMode: PostConditionMode.Deny,
        postConditions: [
          makeStandardFungiblePostCondition(
            params.providerId,
            FungibleConditionCode.Equal,
            params.amount,
            createAssetInfo(tokenContract.address, tokenContract.name, tokenContract.assetName)
          ),
        ],
        txType: "contract_call",
        contractAddress: vaultContract.address,
        contractName: vaultContract.name,
        functionName: "deposit-sbtc",
        functionArgs: [
          uintCV(params.amount),
        ],
      },
      estimatedFee: calculateFee(1),
    };

}
}

// Prepare withdrawal transaction
async function prepareWithdrawalTransaction(params: {
providerId: string;
tokenId: string;
amount: number;
isStx: boolean;
}): Promise<{ txOptions: any; estimatedFee: number }> {
// 1. Get contract address for Liquidity Pool Vault
const vaultContract = await getContractAddress("liquidityPoolVault");

// 2. Construct transaction options based on token type
if (params.isStx) {
// STX withdrawal
return {
txOptions: {
network: getNetwork(),
anchorMode: AnchorMode.Any,
fee: calculateFee(1),
postConditionMode: PostConditionMode.Deny,
txType: "contract_call",
contractAddress: vaultContract.address,
contractName: vaultContract.name,
functionName: "withdraw-stx",
functionArgs: [
uintCV(params.amount),
],
},
estimatedFee: calculateFee(1),
};
} else {
// Token withdrawal (e.g., sBTC)
return {
txOptions: {
network: getNetwork(),
anchorMode: AnchorMode.Any,
fee: calculateFee(1),
postConditionMode: PostConditionMode.Deny,
txType: "contract_call",
contractAddress: vaultContract.address,
contractName: vaultContract.name,
functionName: "withdraw-sbtc",
functionArgs: [
uintCV(params.amount),
],
},
estimatedFee: calculateFee(1),
};
}
}

5.2 Event Handling

// Set up listeners for on-chain events
export function initializePoolEventListeners() {
// Get Liquidity Pool Vault contract details
const vaultContract = getContractDetails("liquidityPoolVault");

// Listen for deposit events
listenForContractEvent({
contractAddress: vaultContract.address,
contractName: vaultContract.name,
eventName: "funds-deposited",
callback: (event) => {
// Process deposit event
processDepositEvent(event);
},
});

// Listen for withdrawal events
listenForContractEvent({
contractAddress: vaultContract.address,
contractName: vaultContract.name,
eventName: "funds-withdrawn",
callback: (event) => {
// Process withdrawal event
processWithdrawalEvent(event);
},
});

// Listen for settlement events
listenForContractEvent({
contractAddress: vaultContract.address,
contractName: vaultContract.name,
eventName: "settlement-paid",
callback: (event) => {
// Process settlement event
processSettlementEvent(event);
},
});

// Listen for collateral events
listenForContractEvent({
contractAddress: vaultContract.address,
contractName: vaultContract.name,
eventName: "collateral-locked",
callback: (event) => {
// Process collateral locked event
processCollateralLockedEvent(event);
},
});

listenForContractEvent({
contractAddress: vaultContract.address,
contractName: vaultContract.name,
eventName: "collateral-released",
callback: (event) => {
// Process collateral released event
processCollateralReleasedEvent(event);
},
});
}

6. Error Handling and Recovery
   The Liquidity Pool Service implements several strategies for robust error handling:
   6.1 Transaction Monitoring
   Every submitted transaction is tracked with a corresponding record in the pendingPoolTransactions table
   Scheduled jobs check transaction status regularly
   Failed transactions are clearly marked, with error details captured
   6.2 State Reconciliation

// Scheduled job to reconcile on-chain and off-chain state
export const reconcilePoolState = action(async ({ db, scheduler }) => {
// Get all supported tokens
const tokens = await getSupportedTokens();

for (const tokenId of tokens) {
// 1. Get on-chain state from Vault contract
const onChainData = await getPoolOnChainState(tokenId);

    // 2. Calculate off-chain state from provider records
    const providers = await db
      .query("providerBalances")
      .withIndex("tokenId", (q) => q.eq("tokenId", tokenId))
      .collect();

    const offChainTotal = providers.reduce((sum, p) => sum + p.currentBalance, 0);
    const offChainLocked = providers.reduce((sum, p) => sum + p.allocatedBalance, 0);

    // 3. Check for discrepancies
    if (Math.abs(onChainData.totalAmount - offChainTotal) > 0.00001) {
      console.warn(`Total balance mismatch for ${tokenId}:
        On-chain: ${onChainData.totalAmount},
        Off-chain: ${offChainTotal}`);

      // Record discrepancy for review
      await recordStateDiscrepancy(db, {
        tokenId,
        discrepancyType: "TotalBalance",
        onChainValue: onChainData.totalAmount,
        offChainValue: offChainTotal,
        timestamp: Date.now()
      });
    }

    if (Math.abs(onChainData.lockedAmount - offChainLocked) > 0.00001) {
      console.warn(`Locked amount mismatch for ${tokenId}:
        On-chain: ${onChainData.lockedAmount},
        Off-chain: ${offChainLocked}`);

      // Record discrepancy for review
      await recordStateDiscrepancy(db, {
        tokenId,
        discrepancyType: "LockedAmount",
        onChainValue: onChainData.lockedAmount,
        offChainValue: offChainLocked,
        timestamp: Date.now()
      });
    }

}

// Schedule next reconciliation (e.g., daily)
await scheduler.runAfter(24 _ 60 _ 60 \* 1000, "internal:reconcilePoolState", {});

return { success: true };
});

7. Risk Management
   The Liquidity Pool Service incorporates a sophisticated risk management system:
   7.1 Risk Tier System

// Update pool risk tier distribution
async function updatePoolRiskTierDistribution(db, tokenId) {
// Get all provider balances for this token
const balances = await db
.query("providerBalances")
.withIndex("tokenId", (q) => q.eq("tokenId", tokenId))
.collect();

// Calculate amounts by tier
const conservativeTierAmount = balances
.filter(b => b.riskTier === RiskTier.CONSERVATIVE)
.reduce((sum, b) => sum + b.currentBalance, 0);

const balancedTierAmount = balances
.filter(b => b.riskTier === RiskTier.BALANCED)
.reduce((sum, b) => sum + b.currentBalance, 0);

const aggressiveTierAmount = balances
.filter(b => b.riskTier === RiskTier.AGGRESSIVE)
.reduce((sum, b) => sum + b.currentBalance, 0);

// Update pool metrics
const existingMetrics = await db.get("poolMetrics", tokenId);

if (existingMetrics) {
await db.patch("poolMetrics", tokenId, {
conservativeTierAmount,
balancedTierAmount,
aggressiveTierAmount,
lastUpdateTimestamp: Date.now()
});
}

// Calculate risk capacity based on tier distribution
const riskCapacity = calculatePoolRiskCapacity(
conservativeTierAmount,
balancedTierAmount,
aggressiveTierAmount
);

// Update risk capacity metrics
await updateRiskCapacityMetrics(db, tokenId, riskCapacity);

return {
conservativeTierAmount,
balancedTierAmount,
aggressiveTierAmount
};
}

// Calculate pool risk capacity
function calculatePoolRiskCapacity(conservative, balanced, aggressive) {
// Apply risk multipliers to each tier
const conservativeCapacity = conservative _ 0.5; // Lower risk factor
const balancedCapacity = balanced _ 1.0; // Standard risk factor
const aggressiveCapacity = aggressive \* 2.0; // Higher risk factor

// Calculate capacities for different policy types
const putCapacity = conservativeCapacity + balancedCapacity + aggressiveCapacity;
const callCapacity = (conservativeCapacity _ 0.25) + (balancedCapacity _ 0.5) + aggressiveCapacity;

// Calculate maximum policy sizes based on tier distribution
const maxPolicySize = Math.min(
aggressive _ 0.75, // No single policy should use more than 75% of aggressive tier
(aggressive + balanced) _ 0.5, // Or more than 50% of aggressive+balanced
(aggressive + balanced + conservative) \* 0.25 // Or more than 25% of total pool
);

return {
putCapacity,
callCapacity,
conservativeCapacity,
balancedCapacity,
aggressiveCapacity,
maxPolicySize
};
}

7.2 Allocation Strategy
The allocation algorithm preferentially assigns risk to providers based on their chosen risk tier:
Allocate first from aggressive providers who seek higher returns and accept higher risk
Then use balanced providers to meet remaining collateral needs
Only use conservative providers when necessary to fulfill policy requirements
This tiered approach ensures that risk and reward are properly aligned with provider preferences. 8. Conclusion
The Liquidity Pool Service design follows the "On-Chain Light" approach by:
Storing minimal, essential financial data on-chain (total balances, locked amounts)
Managing comprehensive provider tracking, risk allocation, and yield calculations off-chain in Convex
Orchestrating the complete capital lifecycle from deposit through allocation to withdrawal
Providing robust error handling and recovery mechanisms
Synchronizing state between on-chain and off-chain components
This architecture achieves the important balance between:
Blockchain security for custody of funds
Off-chain flexibility for complex business logic
Cost efficiency through minimized on-chain operations
Rich user experience with detailed analytics and reporting
The Liquidity Pool Service works in concert with the Policy Registry to provide a complete solution for BitHedge's protection platform, enabling secure, flexible, and efficient management of capital for Bitcoin protection policies.
