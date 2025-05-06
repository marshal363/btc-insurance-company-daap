# BitHedge Liquidity Pool: Convex Architecture

## 1. Introduction

This document outlines the architecture for the Convex backend implementation of the BitHedge Liquidity Pool. Following the "On-Chain Light" approach, the Convex backend handles complex provider-specific accounting, premium distribution tracking, yield calculations, and user interfaces while the on-chain contract provides secure custody and basic financial operations.

## 2. System Overview

The Liquidity Pool subsystem consists of:

1. **On-Chain Vault Contract**: Securely holds funds and handles basic financial operations.
2. **Convex Backend**: Manages provider-specific data, allocations, premium accounting, and interfaces with the Vault contract.
3. **Frontend Components**: Allow users to interact with the Liquidity Pool through the Convex backend.

## 3. Data Model

### 3.1 Key Tables

#### Provider Balances

```javascript
defineTable({
  name: "provider_balances",
  schema: {
    provider: v.string(), // Provider principal
    token: v.string(), // Token ID (STX, sBTC, etc.)
    total_deposited: v.number(), // Total amount deposited
    available_balance: v.number(), // Available (unlocked) balance
    locked_balance: v.number(), // Balance locked as collateral
    earned_premiums: v.number(), // Total premiums earned
    withdrawn_premiums: v.number(), // Premiums withdrawn
    pending_premiums: v.number(), // Premiums pending distribution
    last_updated: v.number(), // Timestamp of last update
  },
  primaryIndex: {
    name: "provider_token",
    field: ["provider", "token"],
  },
});
```

#### Policy Allocations

```javascript
defineTable({
  name: "policy_allocations",
  schema: {
    policy_id: v.number(), // Policy ID
    provider: v.string(), // Provider principal
    token: v.string(), // Token ID
    allocated_amount: v.number(), // Amount allocated as collateral
    allocation_percentage: v.number(), // Percentage of total policy collateral
    premium_share: v.number(), // Share of premium allocated to this provider
    premium_distributed: v.boolean(), // Whether premium has been distributed
    allocation_timestamp: v.number(), // When allocation was made
    status: v.string(), // ACTIVE, EXPIRED, EXERCISED, etc.
  },
  primaryIndex: {
    name: "policy_provider",
    field: ["policy_id", "provider"],
  },
});
```

#### Provider Transactions

```javascript
defineTable({
  name: "provider_transactions",
  schema: {
    provider: v.string(), // Provider principal
    tx_id: v.string(), // Transaction ID
    tx_type: v.string(), // DEPOSIT, WITHDRAWAL, PREMIUM, etc.
    amount: v.number(), // Amount involved
    token: v.string(), // Token ID
    timestamp: v.number(), // Transaction timestamp
    policy_id: v.optional(v.number()), // Associated policy (if applicable)
    status: v.string(), // PENDING, CONFIRMED, FAILED
    chain_tx_id: v.optional(v.string()), // On-chain transaction ID
  },
  primaryIndex: {
    name: "provider_timestamp",
    field: ["provider", "timestamp"],
  },
});
```

#### Premium Distribution Records

```javascript
defineTable({
  name: "premium_distributions",
  schema: {
    policy_id: v.number(), // Policy ID
    counterparty: v.string(), // Counterparty principal (pool address)
    total_premium: v.number(), // Total premium amount
    distribution_timestamp: v.number(), // When premium was distributed
    status: v.string(), // PENDING, COMPLETED, FAILED
    token: v.string(), // Token used for premium payment
    chain_tx_id: v.optional(v.string()), // On-chain transaction ID
  },
  primaryIndex: {
    name: "policy_id",
    field: ["policy_id"],
  },
});
```

#### Provider Premium Distributions

```javascript
defineTable({
  name: "provider_premium_distributions",
  schema: {
    policy_id: v.number(), // Policy ID
    provider: v.string(), // Provider principal
    premium_amount: v.number(), // Premium amount for this provider
    token: v.string(), // Token used for premium payment
    distribution_timestamp: v.number(), // When premium was distributed
    status: v.string(), // PENDING, COMPLETED, FAILED
    chain_tx_id: v.optional(v.string()), // On-chain transaction ID
  },
  primaryIndex: {
    name: "policy_provider",
    field: ["policy_id", "provider"],
  },
});
```

### 3.2 Indexes and Relationships

1. **Provider Balances by Provider**:

   - Index on `provider` to quickly retrieve all token balances for a provider

2. **Policy Allocations by Status**:

   - Index on `status` to filter allocations by their current status

3. **Provider Transactions by Type**:

   - Index on `tx_type` to filter different types of transactions

4. **Premium Distributions by Status**:

   - Index on `status` to track pending and completed distributions

5. **Provider Premium Distributions by Provider**:
   - Index on `provider` to retrieve all premium distributions for a provider

## 4. Key Services and Functions

### 4.1 Provider Balance Management

#### Track Provider Deposits

```javascript
// Record a new deposit from a provider
export const recordProviderDeposit = mutation(
  async ({ db }, { provider, token, amount, chainTxId }) => {
    // Get current balance
    const currentBalance = await db
      .query("provider_balances")
      .filter(
        (q) =>
          q.eq(q.field("provider"), provider) && q.eq(q.field("token"), token)
      )
      .unique();

    if (currentBalance) {
      // Update existing balance
      await db.patch(
        "provider_balances",
        { provider, token },
        {
          total_deposited: currentBalance.total_deposited + amount,
          available_balance: currentBalance.available_balance + amount,
          last_updated: Date.now(),
        }
      );
    } else {
      // Create new balance record
      await db.insert("provider_balances", {
        provider,
        token,
        total_deposited: amount,
        available_balance: amount,
        locked_balance: 0,
        earned_premiums: 0,
        withdrawn_premiums: 0,
        pending_premiums: 0,
        last_updated: Date.now(),
      });
    }

    // Record transaction
    await db.insert("provider_transactions", {
      provider,
      tx_id: genId(),
      tx_type: "DEPOSIT",
      amount,
      token,
      timestamp: Date.now(),
      status: "CONFIRMED",
      chain_tx_id: chainTxId,
    });

    return { success: true };
  }
);

// Process a provider withdrawal
export const processProviderWithdrawal = mutation(
  async ({ db }, { provider, token, amount }) => {
    // Get current balance
    const currentBalance = await db
      .query("provider_balances")
      .filter(
        (q) =>
          q.eq(q.field("provider"), provider) && q.eq(q.field("token"), token)
      )
      .unique();

    if (!currentBalance || currentBalance.available_balance < amount) {
      return {
        success: false,
        error: "Insufficient available balance",
      };
    }

    // Record transaction as pending
    const txId = genId();
    await db.insert("provider_transactions", {
      provider,
      tx_id: txId,
      tx_type: "WITHDRAWAL",
      amount,
      token,
      timestamp: Date.now(),
      status: "PENDING",
    });

    return {
      success: true,
      txId,
      withdrawalData: {
        provider,
        token,
        amount,
      },
    };
  }
);

// Confirm withdrawal after on-chain execution
export const confirmProviderWithdrawal = mutation(
  async ({ db }, { txId, chainTxId, status }) => {
    // Get the transaction
    const tx = await db
      .query("provider_transactions")
      .filter((q) => q.eq(q.field("tx_id"), txId))
      .unique();

    if (!tx) {
      return { success: false, error: "Transaction not found" };
    }

    // Update transaction status
    await db.patch(
      "provider_transactions",
      { tx_id: txId },
      {
        status: status,
        chain_tx_id: chainTxId,
      }
    );

    if (status === "CONFIRMED") {
      // Update provider balance
      await db.patch(
        "provider_balances",
        { provider: tx.provider, token: tx.token },
        {
          available_balance: (q) =>
            q.sub(q.field("available_balance"), tx.amount),
          last_updated: Date.now(),
        }
      );
    }

    return { success: true };
  }
);
```

### 4.2 Policy Allocation Management

```javascript
// Allocate provider funds to a policy
export const allocateProviderToPolicy = mutation(
  async (
    { db },
    {
      policyId,
      provider,
      token,
      allocatedAmount,
      allocationPercentage,
      premiumShare,
    }
  ) => {
    // Get current provider balance
    const currentBalance = await db
      .query("provider_balances")
      .filter(
        (q) =>
          q.eq(q.field("provider"), provider) && q.eq(q.field("token"), token)
      )
      .unique();

    if (!currentBalance || currentBalance.available_balance < allocatedAmount) {
      return {
        success: false,
        error: "Insufficient available balance",
      };
    }

    // Update provider balance
    await db.patch(
      "provider_balances",
      { provider, token },
      {
        available_balance: currentBalance.available_balance - allocatedAmount,
        locked_balance: currentBalance.locked_balance + allocatedAmount,
        last_updated: Date.now(),
      }
    );

    // Create policy allocation record
    await db.insert("policy_allocations", {
      policy_id: policyId,
      provider,
      token,
      allocated_amount: allocatedAmount,
      allocation_percentage: allocationPercentage,
      premium_share: premiumShare,
      premium_distributed: false,
      allocation_timestamp: Date.now(),
      status: "ACTIVE",
    });

    // Record transaction
    await db.insert("provider_transactions", {
      provider,
      tx_id: genId(),
      tx_type: "ALLOCATION",
      amount: allocatedAmount,
      token,
      timestamp: Date.now(),
      policy_id: policyId,
      status: "CONFIRMED",
    });

    return { success: true };
  }
);

// Update policy allocation status
export const updatePolicyAllocationStatus = mutation(
  async ({ db }, { policyId, status }) => {
    // Get all allocations for this policy
    const allocations = await db
      .query("policy_allocations")
      .filter((q) => q.eq(q.field("policy_id"), policyId))
      .collect();

    // Update status for all allocations
    for (const allocation of allocations) {
      await db.patch(
        "policy_allocations",
        { policy_id: policyId, provider: allocation.provider },
        { status }
      );

      // If policy expired or exercised, release collateral back to available balance
      if (status === "EXPIRED" || status === "EXERCISED") {
        // For exercised policies, we only release remaining collateral after settlement
        // This is handled by the settlement confirmation process
        if (status === "EXPIRED") {
          await db.patch(
            "provider_balances",
            { provider: allocation.provider, token: allocation.token },
            {
              available_balance: (q) =>
                q.add(
                  q.field("available_balance"),
                  allocation.allocated_amount
                ),
              locked_balance: (q) =>
                q.sub(q.field("locked_balance"), allocation.allocated_amount),
              last_updated: Date.now(),
            }
          );

          // Record transaction
          await db.insert("provider_transactions", {
            provider: allocation.provider,
            tx_id: genId(),
            tx_type: "COLLATERAL_RELEASE",
            amount: allocation.allocated_amount,
            token: allocation.token,
            timestamp: Date.now(),
            policy_id: policyId,
            status: "CONFIRMED",
          });
        }
      }
    }

    return { success: true };
  }
);
```

### 4.3 Premium Distribution Management

```javascript
// Record policy premium for a policy
export const recordPolicyPremium = mutation(
  async (
    { db },
    { policyId, counterparty, totalPremium, token, transactionId }
  ) => {
    // Record premium distribution as completed (since it was initiated by Policy Registry)
    await db.insert("premium_distributions", {
      policy_id: policyId,
      counterparty,
      total_premium: totalPremium,
      token,
      distribution_timestamp: Date.now(),
      status: "COMPLETED",
      chain_tx_id: transactionId,
    });

    // Get all allocations for this policy
    const allocations = await db
      .query("policy_allocations")
      .filter((q) => q.eq(q.field("policy_id"), policyId))
      .collect();

    // Record pending premium for each provider based on their allocation percentage
    for (const allocation of allocations) {
      const providerPremium = totalPremium * (allocation.premium_share / 100);

      // Update provider balance with pending premium
      await db.patch(
        "provider_balances",
        { provider: allocation.provider, token },
        {
          pending_premiums: (q) =>
            q.add(q.field("pending_premiums"), providerPremium),
          last_updated: Date.now(),
        }
      );

      // Record provider premium distribution as pending
      await db.insert("provider_premium_distributions", {
        policy_id: policyId,
        provider: allocation.provider,
        premium_amount: providerPremium,
        token,
        distribution_timestamp: Date.now(),
        status: "PENDING",
      });
    }

    // Schedule automatic provider premium distribution (optional)
    await scheduler.runAfter(
      3600000, // 1 hour delay before automatic distribution
      "internal:processProviderPremiumDistributions",
      { policyId }
    );

    return { success: true };
  }
);

// Process premium distributions for providers
export const processProviderPremiumDistributions = internalMutation(
  async ({ db, scheduler }, { policyId }) => {
    // Get all pending premium distributions for this policy
    const providerDists = await db
      .query("provider_premium_distributions")
      .filter(
        (q) =>
          q.eq(q.field("policy_id"), policyId) &&
          q.eq(q.field("status"), "PENDING")
      )
      .collect();

    // Process each provider distribution
    for (const dist of providerDists) {
      // Schedule distribution for each provider
      await scheduler.runAfter(0, "internal:distributeProviderPremium", {
        policyId,
        provider: dist.provider,
        token: dist.token,
      });
    }

    return { success: true, processedCount: providerDists.length };
  }
);

// Distribute premium to individual provider
export const distributeProviderPremium = internalMutation(
  async ({ db }, { policyId, provider, token }) => {
    // Get provider premium distribution
    const providerDist = await db
      .query("provider_premium_distributions")
      .filter(
        (q) =>
          q.eq(q.field("policy_id"), policyId) &&
          q.eq(q.field("provider"), provider) &&
          q.eq(q.field("status"), "PENDING")
      )
      .unique();

    if (!providerDist) {
      return {
        success: false,
        error: "No pending provider premium distribution found",
      };
    }

    // Update status to processing
    await db.patch(
      "provider_premium_distributions",
      { policy_id: policyId, provider },
      { status: "PROCESSING" }
    );

    // In MVP, we simply move premium from pending to earned since
    // there's no separate on-chain transaction for each provider
    // Future enhancement: Implement on-chain provider-specific premium distribution

    // Update provider balance
    await db.patch(
      "provider_balances",
      { provider, token },
      {
        pending_premiums: (q) =>
          q.sub(q.field("pending_premiums"), providerDist.premium_amount),
        earned_premiums: (q) =>
          q.add(q.field("earned_premiums"), providerDist.premium_amount),
        last_updated: Date.now(),
      }
    );

    // Update provider premium distribution record
    await db.patch(
      "provider_premium_distributions",
      { policy_id: policyId, provider },
      {
        status: "COMPLETED",
      }
    );

    // Update policy allocation
    await db.patch(
      "policy_allocations",
      { policy_id: policyId, provider },
      { premium_distributed: true }
    );

    // Record transaction
    await db.insert("provider_transactions", {
      provider,
      tx_id: genId(),
      tx_type: "PREMIUM",
      amount: providerDist.premium_amount,
      token,
      timestamp: Date.now(),
      policy_id: policyId,
      status: "CONFIRMED",
    });

    return { success: true };
  }
);

// Get pending premium distributions for a provider
export const getPendingPremiumDistributions = query(
  async ({ db, auth }, { limit = 20, offset = 0 }) => {
    // Check authentication
    const identity = auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const provider = identity.tokenIdentifier;

    // Get pending premium distributions
    const distributions = await db
      .query("provider_premium_distributions")
      .filter(
        (q) =>
          q.eq(q.field("provider"), provider) &&
          q.eq(q.field("status"), "PENDING")
      )
      .order("desc")
      .take(limit, offset);

    // Get policy details for each distribution
    const results = [];
    for (const dist of distributions) {
      const policy = await db.get("policies", dist.policy_id);
      results.push({
        distribution: dist,
        policy: {
          policyId: policy?.policyId,
          positionType: policy?.positionType,
          policyType: policy?.policyType,
          expirationHeight: policy?.expirationHeight,
          expirationDate: policy
            ? new Date(policy.expirationTimestamp).toLocaleDateString()
            : null,
        },
      });
    }

    return results;
  }
);

// User-initiated request to claim premiums
export const claimPendingPremiums = action(async ({ db, scheduler, auth }) => {
  // Check authentication
  const identity = auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const provider = identity.tokenIdentifier;

  // Get all pending premium distributions for this provider
  const providerDists = await db
    .query("provider_premium_distributions")
    .filter(
      (q) =>
        q.eq(q.field("provider"), provider) &&
        q.eq(q.field("status"), "PENDING")
    )
    .collect();

  if (providerDists.length === 0) {
    return {
      success: false,
      error: "No pending premiums to claim",
    };
  }

  // Group by token for consolidated processing
  const tokenGroups = {};
  for (const dist of providerDists) {
    if (!tokenGroups[dist.token]) {
      tokenGroups[dist.token] = [];
    }
    tokenGroups[dist.token].push(dist);
  }

  // Process each token group
  const results = [];
  for (const [token, dists] of Object.entries(tokenGroups)) {
    // Calculate total premium amount for this token
    const totalAmount = dists.reduce(
      (sum, dist) => sum + dist.premium_amount,
      0
    );

    // List of policy IDs included in this claim
    const policyIds = dists.map((dist) => dist.policy_id);

    // Schedule batch distribution task
    const taskId = await scheduler.runAfter(
      0,
      "internal:processBatchPremiumClaim",
      {
        provider,
        token,
        policyIds,
        totalAmount,
      }
    );

    results.push({
      token,
      count: dists.length,
      totalAmount,
      taskId,
    });
  }

  return {
    success: true,
    claimRequests: results,
  };
});

// Process batch premium claim
export const processBatchPremiumClaim = internalMutation(
  async ({ db }, { provider, token, policyIds, totalAmount }) => {
    // Update all distributions in batch
    for (const policyId of policyIds) {
      // Find the specific distribution
      const dist = await db
        .query("provider_premium_distributions")
        .filter(
          (q) =>
            q.eq(q.field("policy_id"), policyId) &&
            q.eq(q.field("provider"), provider) &&
            q.eq(q.field("status"), "PENDING")
        )
        .unique();

      if (dist) {
        // Process this distribution
        await distributeProviderPremium({
          policyId,
          provider,
          token,
        });
      }
    }

    // Record a consolidated transaction
    await db.insert("provider_transactions", {
      provider,
      tx_id: genId(),
      tx_type: "PREMIUM_BATCH",
      amount: totalAmount,
      token,
      timestamp: Date.now(),
      status: "CONFIRMED",
    });

    return { success: true, processedCount: policyIds.length };
  }
);
```

### 4.4 Yield Calculation

```javascript
// Calculate provider yield statistics
export const getProviderYieldStats = query(async ({ db }, { provider }) => {
  // Get all balances for this provider
  const balances = await db
    .query("provider_balances")
    .filter((q) => q.eq(q.field("provider"), provider))
    .collect();

  // Get all transactions for this provider
  const transactions = await db
    .query("provider_transactions")
    .filter((q) => q.eq(q.field("provider"), provider))
    .collect();

  // Calculate yield stats per token
  const yieldStats = {};

  for (const balance of balances) {
    const token = balance.token;

    // Filter transactions for this token
    const tokenTransactions = transactions.filter((tx) => tx.token === token);

    // Calculate first deposit date
    const deposits = tokenTransactions.filter((tx) => tx.tx_type === "DEPOSIT");
    const firstDepositDate =
      deposits.length > 0
        ? Math.min(...deposits.map((tx) => tx.timestamp))
        : Date.now();

    // Calculate time elapsed in days
    const daysElapsed = (Date.now() - firstDepositDate) / (1000 * 60 * 60 * 24);

    // Calculate annualized yield
    const totalEarned = balance.earned_premiums + balance.pending_premiums;
    const averageBalance = balance.total_deposited / 2; // Simplified average

    let annualizedYield = 0;
    if (averageBalance > 0 && daysElapsed > 0) {
      annualizedYield =
        (totalEarned / averageBalance) * (365 / daysElapsed) * 100;
    }

    yieldStats[token] = {
      totalDeposited: balance.total_deposited,
      currentAvailable: balance.available_balance,
      currentLocked: balance.locked_balance,
      totalEarned,
      earnedPremiums: balance.earned_premiums,
      pendingPremiums: balance.pending_premiums,
      annualizedYield,
      daysActive: daysElapsed,
    };
  }

  // Get active policies with this provider
  const activeAllocations = await db
    .query("policy_allocations")
    .filter(
      (q) =>
        q.eq(q.field("provider"), provider) && q.eq(q.field("status"), "ACTIVE")
    )
    .collect();

  return {
    yieldStats,
    activeAllocations: activeAllocations.length,
    activeExposure: activeAllocations.reduce(
      (sum, allocation) => sum + allocation.allocated_amount,
      0
    ),
  };
});
```

### 4.5 Background Tasks

```javascript
// Task to process expired policies
export const processExpiredPolicies = internalMutation(
  async ({ db, scheduler }) => {
    // This task would be scheduled to run periodically

    // Get policies that have expired but haven't distributed premiums
    const expiredPolicies = await db
      .query("premium_distributions")
      .filter((q) => q.eq(q.field("status"), "PENDING"))
      .collect();

    // Process each policy
    for (const policy of expiredPolicies) {
      await scheduler.runAfter(0, "distributePremiumToCounterparty", {
        policyId: policy.policy_id,
      });
    }
  }
);

// Task to sync provider balances with on-chain state
export const syncProviderBalances = internalMutation(
  async ({ db, scheduler }) => {
    // This task would be scheduled to run periodically

    // Get all provider balances
    const balances = await db.query("provider_balances").collect();

    // For each balance, query the on-chain state and update if needed
    // This is a placeholder for the actual implementation

    return { success: true };
  }
);
```

## 5. User Interaction Flows

### 5.1 Provider Deposit Flow

1. User initiates deposit through frontend
2. Convex prepares deposit transaction parameters
3. User signs and submits on-chain transaction
4. Blockchain event listener detects deposit
5. `recordProviderDeposit` is called to update Convex state
6. UI reflects updated balance

### 5.2 Provider Withdrawal Flow

1. User initiates withdrawal through frontend
2. `processProviderWithdrawal` validates and records pending withdrawal
3. Convex prepares withdrawal transaction parameters
4. User signs and submits on-chain transaction
5. Blockchain event listener detects withdrawal
6. `confirmProviderWithdrawal` is called to update Convex state
7. UI reflects updated balance

### 5.3 Policy Premium Distribution Flow

1. Policy expires without being exercised
2. Policy Registry triggers premium distribution on-chain
   - This updates the policy status to "Expired"
   - Records the policy's position type (SHORT_PUT/LONG_PUT)
   - Identifies the counterparty relationship
3. Blockchain event listener detects premium distribution event
4. `recordPolicyPremium` is called with:
   - Policy ID
   - Counterparty information (liquidity pool address)
   - Premium amount
   - Token type (STX for PUT options in MVP)
   - Transaction ID of the on-chain event
5. For each provider that contributed to the policy's collateral:
   - Premium is allocated based on the provider's allocation percentage
   - Provider's pending premium balance is updated
   - Provider-specific premium distribution record is created
6. Each provider can view pending premiums in their dashboard
7. Providers can claim premiums through two methods:
   - Automatic distribution after a delay (system-initiated)
   - Manual claim through UI (user-initiated)
8. When premiums are claimed:
   - Pending premium moves to earned premium
   - Provider's yield statistics are updated
   - UI reflects updated premium earnings with counterparty attribution
   - Transaction history shows premium source by policy

### 5.4 Premium Distribution User Interface

```jsx
// Premium Distribution Component
function PremiumDistributions({ provider }) {
  const { data, loading } = useQuery(getPendingPremiumDistributions, {});
  const [claiming, setClaiming] = useState(false);

  const handleClaimAll = async () => {
    setClaiming(true);
    try {
      await mutation.claimPendingPremiums({});
      // Refresh data after claim
      await data.refetch();
    } catch (error) {
      console.error("Error claiming premiums:", error);
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return <Loading />;

  // Group by token type
  const tokenGroups = data.reduce((groups, item) => {
    const { token } = item.distribution;
    if (!groups[token]) groups[token] = [];
    groups[token].push(item);
    return groups;
  }, {});

  // Calculate totals by token
  const tokenTotals = Object.entries(tokenGroups).map(([token, items]) => ({
    token,
    count: items.length,
    total: items.reduce(
      (sum, item) => sum + item.distribution.premium_amount,
      0
    ),
  }));

  return (
    <div className="premium-distributions">
      <div className="header-section">
        <h3>Pending Premium Distributions</h3>
        <button
          className="claim-all-btn"
          disabled={data.length === 0 || claiming}
          onClick={handleClaimAll}
        >
          {claiming ? "Processing..." : "Claim All Premiums"}
        </button>
      </div>

      {/* Token Summary */}
      <div className="token-summary">
        {tokenTotals.map(({ token, count, total }) => (
          <div key={token} className="token-card">
            <h4>{token}</h4>
            <div className="token-stats">
              <div>Policies: {count}</div>
              <div>
                Total: {total.toFixed(6)} {token}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed list */}
      <div className="distributions-list">
        {data.length === 0 ? (
          <div className="empty-state">No pending premium distributions</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Policy ID</th>
                <th>Type</th>
                <th>Expired</th>
                <th>Amount</th>
                <th>Token</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr
                  key={`${item.distribution.policy_id}-${item.distribution.provider}`}
                >
                  <td>{item.distribution.policy_id}</td>
                  <td>{item.policy.positionType}</td>
                  <td>{item.policy.expirationDate}</td>
                  <td>{item.distribution.premium_amount.toFixed(6)}</td>
                  <td>{item.distribution.token}</td>
                  <td>{item.distribution.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

This component allows providers to view and claim their pending premium distributions, organized by token type and with details about each policy. It shows the position type (SHORT_PUT) that the provider held in relation to each policy, helping them understand the source of their premium income.

## 6. Frontend Components

### 6.1 Provider Dashboard

```jsx
// Provider Dashboard Component
function ProviderDashboard({ provider }) {
  const { data, loading } = useQuery(getProviderYieldStats, { provider });

  if (loading) return <Loading />;

  return (
    <div className="provider-dashboard">
      <BalanceSummary yieldStats={data.yieldStats} />
      <ActivityChart transactions={data.transactions} />
      <YieldPerformance yieldStats={data.yieldStats} />
      <ActiveAllocations
        count={data.activeAllocations}
        exposure={data.activeExposure}
      />
      <PremiumEarnings yieldStats={data.yieldStats} />
    </div>
  );
}

// Premium Earnings Component
function PremiumEarnings({ yieldStats }) {
  return (
    <div className="premium-earnings">
      <h3>Premium Earnings</h3>
      {Object.entries(yieldStats).map(([token, stats]) => (
        <div key={token} className="token-earnings">
          <h4>{token}</h4>
          <div className="stats-row">
            <div className="stat">
              <label>Total Earned</label>
              <value>{stats.totalEarned}</value>
            </div>
            <div className="stat">
              <label>Distributed</label>
              <value>{stats.earnedPremiums}</value>
            </div>
            <div className="stat">
              <label>Pending</label>
              <value>{stats.pendingPremiums}</value>
            </div>
            <div className="stat">
              <label>Annual Yield</label>
              <value>{stats.annualizedYield.toFixed(2)}%</value>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 6.2 Transaction History

```jsx
// Transaction History Component
function TransactionHistory({ provider }) {
  const [filter, setFilter] = useState("ALL");
  const { data, loading } = useQuery(getProviderTransactions, {
    provider,
    filter,
  });

  if (loading) return <Loading />;

  return (
    <div className="transaction-history">
      <div className="filters">
        <button
          className={filter === "ALL" ? "active" : ""}
          onClick={() => setFilter("ALL")}
        >
          All
        </button>
        <button
          className={filter === "DEPOSIT" ? "active" : ""}
          onClick={() => setFilter("DEPOSIT")}
        >
          Deposits
        </button>
        <button
          className={filter === "WITHDRAWAL" ? "active" : ""}
          onClick={() => setFilter("WITHDRAWAL")}
        >
          Withdrawals
        </button>
        <button
          className={filter === "PREMIUM" ? "active" : ""}
          onClick={() => setFilter("PREMIUM")}
        >
          Premiums
        </button>
      </div>

      <table className="transactions-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Token</th>
            <th>Status</th>
            <th>Policy ID</th>
          </tr>
        </thead>
        <tbody>
          {data.transactions.map((tx) => (
            <tr key={tx.tx_id}>
              <td>{new Date(tx.timestamp).toLocaleString()}</td>
              <td>{tx.tx_type}</td>
              <td>{tx.amount}</td>
              <td>{tx.token}</td>
              <td>{tx.status}</td>
              <td>{tx.policy_id || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## 7. API Integration

### 7.1 Public API Endpoints

```javascript
// Get pool statistics
export const getPoolStats = query(async ({ db }) => {
  // Calculate total balances for each token
  const tokenBalances = {};

  // Get all provider balances
  const balances = await db.query("provider_balances").collect();

  // Aggregate by token
  for (const balance of balances) {
    const token = balance.token;
    if (!tokenBalances[token]) {
      tokenBalances[token] = {
        totalDeposited: 0,
        availableBalance: 0,
        lockedBalance: 0,
        totalEarned: 0,
      };
    }

    tokenBalances[token].totalDeposited += balance.total_deposited;
    tokenBalances[token].availableBalance += balance.available_balance;
    tokenBalances[token].lockedBalance += balance.locked_balance;
    tokenBalances[token].totalEarned +=
      balance.earned_premiums + balance.pending_premiums;
  }

  // Get active policy count
  const activePolicies = await db
    .query("policy_allocations")
    .filter((q) => q.eq(q.field("status"), "ACTIVE"))
    .collect();

  const uniquePolicies = [...new Set(activePolicies.map((a) => a.policy_id))];

  return {
    tokenBalances,
    activePolicyCount: uniquePolicies.length,
    providerCount: [...new Set(balances.map((b) => b.provider))].length,
  };
});

// Get provider allocations
export const getProviderAllocations = query(async ({ db }, { provider }) => {
  // Get all allocations for this provider
  const allocations = await db
    .query("policy_allocations")
    .filter((q) => q.eq(q.field("provider"), provider))
    .collect();

  return { allocations };
});
```

### 7.2 Webhook Integration

The Convex backend will set up webhooks for blockchain events:

```javascript
// Register blockchain event listener for premium distributions
export const handlePremiumDistributionEvent = internalMutation(
  async (
    { db },
    { policyId, counterparty, premiumAmount, token, chainTxId }
  ) => {
    // Find the premium distribution record
    const premiumDist = await db
      .query("premium_distributions")
      .filter((q) => q.eq(q.field("policy_id"), policyId))
      .unique();

    if (premiumDist) {
      // Update with chain tx ID and status
      await db.patch(
        "premium_distributions",
        { policy_id: policyId },
        {
          status: "COMPLETED",
          chain_tx_id: chainTxId,
        }
      );
    } else {
      // Create a new record if one doesn't exist (edge case)
      await db.insert("premium_distributions", {
        policy_id: policyId,
        counterparty,
        total_premium: premiumAmount,
        token,
        distribution_timestamp: Date.now(),
        status: "COMPLETED",
        chain_tx_id: chainTxId,
      });
    }

    return { success: true };
  }
);
```

## 8. Security Considerations

### 8.1 Data Access Controls

```javascript
// Example access control rules

// Provider Balance Rules
defineRule({
  name: "provider_can_read_own_balances",
  resource: "provider_balances",
  action: "read",
  condition: ({ context, resource }) => {
    return context.identity?.provider === resource.provider;
  },
});

// Policy Allocation Rules
defineRule({
  name: "provider_can_read_own_allocations",
  resource: "policy_allocations",
  action: "read",
  condition: ({ context, resource }) => {
    return context.identity?.provider === resource.provider;
  },
});

// Transaction Rules
defineRule({
  name: "provider_can_read_own_transactions",
  resource: "provider_transactions",
  action: "read",
  condition: ({ context, resource }) => {
    return context.identity?.provider === resource.provider;
  },
});

// Premium Distribution Rules
defineRule({
  name: "admin_only_premium_distribution",
  resource: "premium_distributions",
  action: "write",
  condition: ({ context }) => {
    return context.identity?.roles?.includes("admin");
  },
});
```

### 8.2 On-Chain Transaction Validation

```javascript
// Validate on-chain transaction before execution
export const validateOnChainTransaction = query(
  async ({ db }, { txType, params }) => {
    switch (txType) {
      case "WITHDRAWAL":
        // Verify sufficient available balance
        const balance = await db
          .query("provider_balances")
          .filter(
            (q) =>
              q.eq(q.field("provider"), params.provider) &&
              q.eq(q.field("token"), params.token)
          )
          .unique();

        if (!balance || balance.available_balance < params.amount) {
          return {
            valid: false,
            reason: "Insufficient available balance",
          };
        }
        break;

      case "PREMIUM_DISTRIBUTION":
        // Verify premium not already distributed
        const premiumDist = await db
          .query("premium_distributions")
          .filter((q) => q.eq(q.field("policy_id"), params.policyId))
          .unique();

        if (!premiumDist || premiumDist.status !== "PENDING") {
          return {
            valid: false,
            reason: "Premium already distributed or not ready",
          };
        }
        break;

      // Add more validation cases as needed
    }

    return { valid: true };
  }
);
```

## 9. Performance Considerations

### 9.1 Indexing Strategy

Optimizing database queries through proper indexing:

1. All tables have primary indexes on their most frequently queried fields
2. Secondary indexes are created for common filtering operations
3. Compound indexes for relationship queries

### 9.2 Caching Strategy

1. Provider balance summaries are cached for quick dashboard loading
2. Pool statistics are cached with a short TTL for public API consumption
3. Transaction histories use pagination to limit data transfer

### 9.3 Background Processing

1. Premium distributions are processed asynchronously
2. Balance synchronization runs as a background task
3. Large data calculations like yield statistics run in dedicated tasks

## 10. Future Extensions

### 10.1 Governance Integration

The Liquidity Pool architecture is designed to integrate with future governance mechanisms:

1. Fee parameter updates
2. Risk tier adjustments
3. Token support expansion

### 10.2 Advanced Premium Distribution

Future enhancements to premium distribution:

1. Risk-based premium allocation
2. Loyalty rewards for long-term providers
3. Automatic reinvestment options

### 10.3 Analytics and Reporting

Future data analysis capabilities:

1. Provider performance dashboards
2. Risk exposure analysis
3. Yield optimization recommendations

## 11. Implementation Roadmap

### Phase 1: Basic Provider Management

1. **LP-101**: Core provider balance tracking
2. **LP-102**: Deposit and withdrawal flows
3. **LP-103**: Basic provider dashboard

### Phase 2: Policy Allocation

1. **LP-104**: Policy allocation tracking
2. **LP-105**: Collateral locking and release
3. **LP-106**: Provider yield calculations

### Phase 3: Premium Management

1. **LP-112**: Premium accounting
2. **LP-113**: Counterparty premium distribution
3. **LP-114**: Provider-specific premium distribution

### Phase 4: Advanced Features

1. **LP-115**: Enhanced yield analytics
2. **LP-116**: Risk tier management
3. **LP-117**: Governance integration

## 12. Conclusion

The BitHedge Liquidity Pool Convex architecture complements the on-chain Vault contract by providing comprehensive provider-specific accounting, premium tracking, yield calculations, and user interfaces. The "On-Chain Light" approach minimizes gas costs while maintaining security by keeping funds and basic financial operations on-chain while leveraging Convex for complex calculations and user experience.

This architecture enables BitHedge to offer a robust, scalable platform for liquidity providers to participate in the BTC options market with transparent tracking of their contributions, allocations, and earnings.
