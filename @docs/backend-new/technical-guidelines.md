# Technical Guidelines: Convex-Based Oracle and Premium Calculation Architecture

## 1. Introduction

This document provides detailed technical guidelines for implementing a hybrid oracle and premium calculation system for BitHedge, leveraging Convex as the primary backend platform with strategic integration to Clarity smart contracts on Stacks blockchain. This approach optimizes for performance, security, and real-time capabilities while maintaining trustless execution for critical functions.

## 2. Architectural Overview

```
┌─────────────────────────────────────────────────────────┐
│                    CONVEX PLATFORM                       │
│                 (PRIMARY BACKEND)                        │
│                                                          │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐    │
│  │   Price     │   │ Aggregation │   │ Premium     │    │
│  │   Feeds     │──>│    Engine   │──>│ Calculator  │    │
│  └─────────────┘   └─────────────┘   └─────────────┘    │
│         │                 │                │            │
│         │                 │                │            │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐    │
│  │ Historical  │   │ Blockchain  │   │ Simulation  │    │
│  │ Data Store  │<──│ Integration │   │   Engine    │    │
│  └─────────────┘   └─────────────┘   └─────────────┘    │
│                          │                              │
└──────────────────────────┼──────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│               STACKS BLOCKCHAIN LAYER                     │
│                (MINIMAL CONTRACTS)                        │
│                                                           │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐     │
│  │   Oracle    │   │  Parameter  │   │   Policy    │     │
│  │  Contract   │──>│  Contract   │──>│  Registry   │     │
│  └─────────────┘   └─────────────┘   └─────────────┘     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## 3. Convex Implementation Guidelines

### 3.1 Data Storage Design

Convex provides a document-based data store that will serve as our primary storage solution. The following tables should be implemented:

#### Core Tables

```typescript
// Price data table
priceHistory: defineTable({
  timestamp: v.number(),
  price: v.number(),
  confidence: v.number(),
  sourceCount: v.number(),
  deviation: v.number(),
  sources: v.array(v.string()),
  usedInOracle: v.optional(v.boolean()),
})
  .index("by_timestamp", ["timestamp"])
  .index("by_confidence", ["confidence"]);

// Premium parameters table
premiumParameters: defineTable({
  paramType: v.string(), // e.g., "volatility", "baseRate", "timeMultiplier"
  value: v.number(),
  lastUpdated: v.number(),
  updatedBy: v.string(),
  description: v.string(),
}).index("by_paramType", ["paramType"]);

// Calculation cache table
premiumCache: defineTable({
  cacheKey: v.string(), // hash of input parameters
  result: v.object({
    premium: v.number(),
    breakdown: v.array(
      v.object({
        factor: v.string(),
        value: v.number(),
        impact: v.number(),
      })
    ),
  }),
  calculatedAt: v.number(),
  expiresAt: v.number(),
}).index("by_expiresAt", ["expiresAt"]);

// Transaction records table
transactions: defineTable({
  txId: v.string(),
  operation: v.string(), // e.g., "updateOracle", "createPolicy"
  status: v.string(), // "pending", "confirmed", "failed"
  data: v.any(),
  createdAt: v.number(),
  confirmedAt: v.optional(v.number()),
})
  .index("by_status", ["status"])
  .index("by_operation", ["operation"]);
```

### 3.2 Price Feed Implementation

The price feed system collects and processes price data from multiple exchanges:

```typescript
// Schedule regular price updates
export const scheduledPriceUpdate = internalAction(async (ctx) => {
  try {
    // Fetch from multiple sources
    const [binancePrice, coinbasePrice, krakenPrice] = await Promise.all([
      fetchBinancePrice(),
      fetchCoinbasePrice(),
      fetchKrakenPrice(),
    ]);

    // Process and store prices
    const sources = [
      { source: "binance", price: binancePrice, reliabilityScore: 0.95 },
      { source: "coinbase", price: coinbasePrice, reliabilityScore: 0.95 },
      { source: "kraken", price: krakenPrice, reliabilityScore: 0.9 },
    ].filter((s) => !!s.price);

    // Aggregate prices
    if (sources.length >= 2) {
      await ctx.runMutation(internal.prices.aggregateAndStorePrices, sources);
    } else {
      console.error("Insufficient price sources available");
    }

    // Schedule next update (5 minute intervals)
    await scheduler.runAfter(
      5 * 60 * 1000,
      internal.prices.scheduledPriceUpdate
    );
  } catch (error) {
    console.error("Price update failed:", error);

    // Retry with backoff on failure (1 minute)
    await scheduler.runAfter(60 * 1000, internal.prices.scheduledPriceUpdate);
  }
});
```

### 3.3 Price Aggregation Strategy

Price aggregation should implement statistical filtering and confidence scoring:

```typescript
export const mutation.aggregateAndStorePrices = mutation(
  async ({ db }, sources: PriceSource[]) => {
    // Require minimum sources
    if (sources.length < 2) {
      throw new Error("Insufficient price sources for aggregation");
    }

    // Calculate median and filter outliers
    const prices = sources.map(s => s.price);
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];

    // Filter extreme outliers (>5% deviation from median)
    const filteredSources = sources.filter(s =>
      Math.abs(s.price - medianPrice) / medianPrice < 0.05
    );

    // Calculate weighted average
    const weightedSum = filteredSources.reduce(
      (sum, s) => sum + s.price * s.reliabilityScore, 0
    );
    const totalWeight = filteredSources.reduce(
      (sum, s) => sum + s.reliabilityScore, 0
    );
    const weightedPrice = weightedSum / totalWeight;

    // Calculate confidence based on agreement and source count
    const deviations = filteredSources.map(
      s => Math.abs(s.price - weightedPrice) / weightedPrice
    );
    const averageDeviation = deviations.reduce(
      (sum, d) => sum + d, 0
    ) / deviations.length;

    const confidence = Math.min(
      filteredSources.length / sources.length,
      1 - (averageDeviation * 10)
    );

    // Store in database
    const priceRecord = await db.insert("priceHistory", {
      timestamp: Date.now(),
      price: weightedPrice,
      confidence,
      sourceCount: filteredSources.length,
      deviation: averageDeviation,
      sources: filteredSources.map(s => s.source),
      usedInOracle: false
    });

    // Check if we should update the blockchain oracle
    if (confidence > 0.8 && filteredSources.length >= 3) {
      await scheduledAction(
        "updateOracleOnChain",
        { priceId: priceRecord._id },
        { delay: "10 seconds" }
      );
    }

    return {
      price: weightedPrice,
      confidence,
      timestamp: Date.now()
    };
  }
);
```

### 3.4 Blockchain Integration Layer

The blockchain integration layer handles all interaction with on-chain contracts:

```typescript
// Action to update the on-chain oracle contract
export const action.updateOracleOnChain = action(
  async ({ db, runMutation, scheduler }, { priceId }) => {
    try {
      // Fetch the price record
      const priceRecord = await db.get(priceId);
      if (!priceRecord) {
        throw new Error(`Price record ${priceId} not found`);
      }

      // Check if sufficient confidence
      if (priceRecord.confidence < 0.8) {
      return {
          success: false,
          error: "Insufficient confidence for on-chain update"
        };
      }

      // Get current on-chain price to check if update needed
      const onChainPrice = await getOraclePrice();
      const priceDifference = Math.abs(
        onChainPrice - priceRecord.price
      ) / onChainPrice;

      // Only update if significant change (>0.5%) or periodic update (every 4 hours)
      const lastUpdateTime = await getLastOracleUpdateTime();
      const fourHours = 4 * 60 * 60 * 1000;
      const shouldUpdate =
        priceDifference > 0.005 ||
        (Date.now() - lastUpdateTime > fourHours);

      if (!shouldUpdate) {
        return { success: true, noUpdateNeeded: true };
      }

      // Prepare and submit transaction
      const tx = await buildOracleUpdateTransaction({
        price: Math.round(priceRecord.price * 1000000), // Convert to micro-units
        timestamp: priceRecord.timestamp,
        confidence: Math.round(priceRecord.confidence * 1000000),
        sourceCount: priceRecord.sourceCount
      });

      // Record transaction and set up monitoring
      const txRecord = await runMutation(internal.transactions.recordTransaction, {
        txId: tx.txId,
        operation: "updateOracle",
        status: "pending",
        data: {
          priceId,
          price: priceRecord.price,
          timestamp: priceRecord.timestamp
        }
      });

      // Mark price record as used
      await runMutation(internal.prices.markPriceAsUsed, { priceId });

      // Schedule transaction status check
      await scheduler.runAfter(
        2 * 60 * 1000, // Check after 2 minutes
        internal.transactions.checkTransactionStatus,
        { txId: tx.txId }
      );

      return {
        success: true,
        txId: tx.txId
      };
    } catch (error) {
      console.error("Failed to update on-chain oracle:", error);

      // Schedule retry with backoff
      await scheduler.runAfter(
        5 * 60 * 1000, // Retry after 5 minutes
        action.updateOracleOnChain,
        { priceId }
      );

      return {
        success: false,
        error: error.message
      };
    }
  }
);
```

### 3.5 Premium Calculator Implementation

The premium calculator should be implemented in Convex to handle complex calculations efficiently:

```typescript
// Calculate premium with Black-Scholes model
export const query.calculatePremium = query(
  async ({ db }, {
    protectedValue,
    expirationDays,
    protectedAmount,
    policyType,
    useCache = true
  }) => {
    // Generate cache key
    const cacheKey = `${protectedValue}-${expirationDays}-${protectedAmount}-${policyType}`;

    // Check cache if enabled
    if (useCache) {
      const cachedResult = await db
        .query("premiumCache")
        .filter(q =>
          q.eq(q.field("cacheKey"), cacheKey) &&
          q.gt(q.field("expiresAt"), Date.now())
        )
        .first();

      if (cachedResult) {
        return cachedResult.result;
      }
    }

    // Get current BTC price
    const currentPrice = await getCurrentPrice(db);

    // Get volatility from historical data
    const volatility = await calculateHistoricalVolatility(db, 30); // 30-day vol

    // Calculate time to expiration in years
    const timeToExpYears = expirationDays / 365;

    // Calculate option price using Black-Scholes
    let premium;
    let breakdown = [];

    if (policyType === "PUT") {
      // Calculate PUT option (downside protection)
      const { premium: putPremium, factors } = calculatePutOption(
        currentPrice,
        protectedValue,
        timeToExpYears,
          volatility,
        0.01 // Risk-free rate
      );

      premium = putPremium * protectedAmount;
      breakdown = factors;
    } else if (policyType === "CALL") {
      // Calculate CALL option (upside protection)
      const { premium: callPremium, factors } = calculateCallOption(
        currentPrice,
        protectedValue,
        timeToExpYears,
          volatility,
        0.01 // Risk-free rate
      );

      premium = callPremium * protectedAmount;
      breakdown = factors;
    } else {
      throw new Error(`Unsupported policy type: ${policyType}`);
    }

    // Apply Bitcoin-specific adjustments
    const btcAdjustments = await applyBitcoinAdjustments(
      db,
      premium,
      policyType,
      protectedValue,
      currentPrice
    );

    premium = btcAdjustments.premium;
    breakdown = [...breakdown, ...btcAdjustments.factors];

    // Store result in cache
    const result = {
      premium,
      breakdown,
      parameters: {
        currentPrice,
        volatility,
        timeToExpYears
      },
      calculatedAt: Date.now()
    };

    await db.insert("premiumCache", {
      cacheKey,
      result,
      calculatedAt: Date.now(),
      expiresAt: Date.now() + (15 * 60 * 1000) // 15 minute cache
    });

    return result;
  }
);
```

## 4. On-Chain Smart Contract Guidelines

While most of the logic lives in Convex, we still need minimal on-chain components for trustless execution.

### 4.1 Minimal Oracle Contract

The oracle contract should be simplified to store verified price data:

```clarity
;; Oracle contract with minimal functionality
(define-map asset-prices
  { asset-symbol: (string-ascii 10) }
  {
    price: uint,
    timestamp: uint,
    confidence: uint,
    source-count: uint
  }
)

;; Authorized updaters (Convex application address)
(define-map authorized-updaters
  { updater: principal }
  { authorized: bool }
)

;; Update price (called by Convex backend only)
(define-public (update-price
  (asset-symbol (string-ascii 10))
  (price uint)
  (timestamp uint)
  (confidence uint)
  (source-count uint))
  (begin
    ;; Only authorized updaters can call this
    (asserts! (default-to false (get authorized (map-get? authorized-updaters { updater: tx-sender }))) (err u403))

    ;; Basic validation
    (asserts! (> price u0) (err u400))
    (asserts! (>= confidence u500000) (err u401)) ;; Minimum 50% confidence

    ;; Store price data
    (map-set asset-prices
      { asset-symbol: asset-symbol }
      {
        price: price,
        timestamp: timestamp,
        confidence: confidence,
        source-count: source-count
      }
    )

    ;; Emit event
    (print {
      event: "price-updated",
      asset: asset-symbol,
      price: price,
      timestamp: timestamp
    })

    (ok true)
  )
)

;; Read-only function to get current price
(define-read-only (get-price (asset-symbol (string-ascii 10)))
  (map-get? asset-prices { asset-symbol: asset-symbol })
)
```

### 4.2 Parameter Contract

A minimal parameter contract for premium calculation settings:

```clarity
;; Parameter contract for system configuration
(define-map parameters
  { param-name: (string-ascii 20) }
  {
    value: uint,
    last-updated: uint
  }
)

;; Set parameter (admin only)
(define-public (set-parameter
  (param-name (string-ascii 20))
  (value uint))
  (begin
    ;; Admin check
    (asserts! (is-admin tx-sender) (err u403))

    ;; Store parameter
    (map-set parameters
      { param-name: param-name }
      {
        value: value,
        last-updated: block-height
      }
    )

    (ok true)
  )
)

;; Get parameter value
(define-read-only (get-parameter (param-name (string-ascii 20)))
  (default-to u0 (get value (map-get? parameters { param-name: param-name })))
)
```

## 5. Frontend Integration Guidelines

### 5.1 Convex React Hooks

Implement custom React hooks for seamless frontend integration:

```typescript
// Hook for real-time price data
export function useBitcoinPrice() {
  const price = useQuery(api.prices.getCurrentPrice);
  const history = useQuery(api.prices.getPriceHistory, { days: 30 });

  return {
    currentPrice: price.data?.price,
    isLoading: price.isLoading,
    history: history.data,
    refreshPrice: price.refresh,
  };
}

// Hook for premium calculations
export function usePremiumCalculator() {
  const calculatePremium = useMutation(api.premium.calculatePremium);

  return {
    calculatePremium: async (params) => {
      try {
        return await calculatePremium(params);
      } catch (error) {
        console.error("Premium calculation failed:", error);
        throw error;
      }
    },
    isCalculating: calculatePremium.isLoading,
  };
}

// Hook for policy creation flow
export function usePolicyCreation() {
  const createPolicy = useMutation(api.policies.createPolicy);
  const [transactions, setTransactions] = useState([]);

  // Subscribe to transaction status updates
  useEffect(() => {
    const { unsubscribe } = onTransactionStatusChange((tx) => {
      setTransactions((prev) =>
        prev.map((t) => (t.id === tx.id ? { ...t, ...tx } : t))
      );
    });

    return unsubscribe;
  }, []);

  return {
    createPolicy: async (policyParams) => {
      try {
        const result = await createPolicy(policyParams);
        setTransactions((prev) => [...prev, result.transaction]);
        return result;
      } catch (error) {
        console.error("Policy creation failed:", error);
        throw error;
      }
    },
    transactions,
    isCreating: createPolicy.isLoading,
  };
}
```

### 5.2 Optimistic UI Patterns

Implement optimistic UI updates for better user experience:

```typescript
// Example optimistic UI pattern
export function useOptimisticPolicyList() {
  const policies = useQuery(api.policies.getUserPolicies);
  const [optimisticPolicies, setOptimisticPolicies] = useState([]);

  // Merge actual and optimistic policies
  const mergedPolicies = useMemo(() => {
    if (!policies.data) return optimisticPolicies;

    // Remove optimistic policies that now exist in real data
    const filteredOptimistic = optimisticPolicies.filter(
      (op) => !policies.data.find((p) => p.pendingId === op.pendingId)
    );

    return [...policies.data, ...filteredOptimistic];
  }, [policies.data, optimisticPolicies]);

  // Add optimistic policy
  const addOptimisticPolicy = useCallback((policy) => {
    setOptimisticPolicies((prev) => [
      ...prev,
      {
        ...policy,
        pendingId: `pending-${Date.now()}`,
        status: "pending",
      },
    ]);

    return policy.pendingId;
  }, []);

  // Remove optimistic policy (e.g., on error)
  const removeOptimisticPolicy = useCallback((pendingId) => {
    setOptimisticPolicies((prev) =>
      prev.filter((p) => p.pendingId !== pendingId)
    );
  }, []);

  return {
    policies: mergedPolicies,
    isLoading: policies.isLoading && optimisticPolicies.length === 0,
    addOptimisticPolicy,
    removeOptimisticPolicy,
    refresh: policies.refresh,
  };
}
```

## 6. Security Considerations

### 6.1 Authentication and Authorization

```typescript
// Auth handling in Convex
export const mutation.authenticateUser = mutation(
  async ({ db, auth }, { address, signature, message }) => {
    // Verify wallet signature
    const isValid = verifySignature(address, signature, message);
    if (!isValid) {
      throw new Error("Invalid signature");
    }

    // Check if user exists
    let user = await db
      .query("users")
      .filter(q => q.eq(q.field("address"), address))
      .first();

    // Create user if not exists
    if (!user) {
      user = await db.insert("users", {
        address,
        createdAt: Date.now(),
        lastLoginAt: Date.now()
      });
    } else {
      // Update last login
      await db.patch(user._id, {
        lastLoginAt: Date.now()
      });
    }

    // Generate JWT token for session
    const token = await auth.issueToken({
      userId: user._id,
      address,
      role: user.role || "user"
    });

    return {
      token,
      user: {
        id: user._id,
        address,
        role: user.role || "user"
      }
    };
  }
);
```

### 6.2 Circuit Breakers

```typescript
// Circuit breakers for extreme market conditions
export const query.shouldAllowOperation = query(
  async ({ db }, { operation, parameters }) => {
    // Get current market conditions
    const currentPrice = await getCurrentPrice(db);
    const priceHistory = await db
      .query("priceHistory")
      .order("desc", "timestamp")
      .take(288); // Last 24 hours @ 5 min intervals

    // Check for extreme volatility
    const volatility = calculateRecentVolatility(priceHistory);
    const volatilityThreshold = await db
      .query("parameters")
      .filter(q => q.eq(q.field("paramType"), "volatilityThreshold"))
      .first();

    if (volatility > (volatilityThreshold?.value || 150)) {
      return {
        allowed: false,
        reason: "Circuit breaker: Extreme market volatility"
      };
    }

    // Check for extreme price movements
    const oneDayAgo = priceHistory[priceHistory.length - 1]?.price;
    if (oneDayAgo) {
      const priceChange = Math.abs(currentPrice - oneDayAgo) / oneDayAgo;
      if (priceChange > 0.20) { // 20% daily move
        return {
          allowed: false,
          reason: "Circuit breaker: Extreme price movement"
        };
      }
    }

    // Check operation-specific conditions
    if (operation === "createPolicy") {
      // Check if policy size is too large
      const maxPolicySize = await db
        .query("parameters")
        .filter(q => q.eq(q.field("paramType"), "maxPolicySize"))
        .first();

      if (parameters.protectedAmount > (maxPolicySize?.value || 10)) {
        return {
          allowed: false,
          reason: "Policy size exceeds current system limits"
        };
      }
    }

    return {
      allowed: true
    };
  }
);
```

## 7. Performance Optimization Guidelines

### 7.1 Caching Strategy

```typescript
// Implement multi-level caching
const CACHE_TTL = {
  SHORT: 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 60 * 60 * 1000 // 1 hour
};

// Cache manager with tiered expiration
export const mutation.setCacheValue = mutation(
  async ({ db }, { key, value, ttlCategory = "MEDIUM" }) => {
    const existingCache = await db
      .query("cache")
      .filter(q => q.eq(q.field("key"), key))
      .first();

    if (existingCache) {
      await db.patch(existingCache._id, {
        value,
        updatedAt: Date.now(),
        expiresAt: Date.now() + CACHE_TTL[ttlCategory]
      });
      return existingCache._id;
    } else {
      const cacheRecord = await db.insert("cache", {
        key,
        value,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + CACHE_TTL[ttlCategory]
      });
      return cacheRecord._id;
    }
  }
);

// Cache retrieval with expiration check
export const query.getCacheValue = query(
  async ({ db }, { key }) => {
    const cacheRecord = await db
      .query("cache")
      .filter(q =>
        q.eq(q.field("key"), key) &&
        q.gt(q.field("expiresAt"), Date.now())
      )
      .first();

    if (cacheRecord) {
      return {
        hit: true,
        value: cacheRecord.value,
        age: Date.now() - cacheRecord.updatedAt
      };
    }

    return { hit: false };
  }
);
```

### 7.2 Database Index Optimization

```typescript
// Optimized indexes for common query patterns
export default defineSchema({
  // Price history with compound indexes for efficient range queries
  priceHistory: defineTable({
    timestamp: v.number(),
    price: v.number(),
    source: v.string(),
    confidence: v.number(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_timestamp_and_confidence", ["timestamp", "confidence"]),

  // Policies with efficient lookup patterns
  policies: defineTable({
    owner: v.string(),
    status: v.number(),
    creationTime: v.number(),
    expirationTime: v.number(),
    type: v.string(),
    protectedValue: v.number(),
  })
    .index("by_owner", ["owner"])
    .index("by_status", ["status"])
    .index("by_expiration", ["expirationTime"])
    .index("by_owner_and_status", ["owner", "status"])
    .index("active_expiring_soon", (q) =>
      q
        .eq(q.field("status"), 0)
        .lt(q.field("expirationTime"), q.add(Date.now(), 86400000))
    ),
});
```

## 8. Monitoring and Observability

### 8.1 Logging Strategy

```typescript
// Structured logging helper
export const mutation.logEvent = mutation(
  async ({ db }, {
    eventType,
    severity = "info",
    context,
    data
  }) => {
    return await db.insert("activityLogs", {
      eventType,
      severity,
          timestamp: Date.now(),
      context,
      data
    });
  }
);

// Implement application monitoring
export const action.monitorSystemHealth = action(
  async ({ runQuery, runMutation, scheduler }) => {
    try {
      // Check price feed status
      const priceStatus = await runQuery(internal.monitoring.checkPriceFeedStatus);
      if (!priceStatus.healthy) {
        await runMutation(internal.logs.logEvent, {
          eventType: "PRICE_FEED_UNHEALTHY",
          severity: "error",
          context: "system_monitoring",
          data: priceStatus
        });

        // Trigger alert via webhook
        await sendAlert("PRICE_FEED_ISSUE", priceStatus);
      }

      // Check blockchain connection
      const blockchainStatus = await runQuery(
        internal.monitoring.checkBlockchainStatus
      );
      if (!blockchainStatus.connected) {
        await runMutation(internal.logs.logEvent, {
          eventType: "BLOCKCHAIN_CONNECTION_ISSUE",
          severity: "error",
          context: "system_monitoring",
          data: blockchainStatus
        });

        // Trigger alert
        await sendAlert("BLOCKCHAIN_CONNECTION_ISSUE", blockchainStatus);
      }

      // Schedule next health check (5 minute intervals)
      await scheduler.runAfter(
        5 * 60 * 1000,
        internal.monitoring.monitorSystemHealth
      );
  } catch (error) {
      console.error("Health monitoring failed:", error);

      // Still schedule next run despite failure
      await scheduler.runAfter(
        60 * 1000, // Shorter interval on failure
        internal.monitoring.monitorSystemHealth
      );
    }
  }
);
```

## 9. Conclusion

This Convex-based approach offers several advantages:

1. **Performance**: Real-time data processing and responsive premium calculations
2. **Scalability**: Serverless architecture that automatically scales
3. **Developer Experience**: Streamlined development with unified backend platform
4. **Security**: Minimal on-chain contract code reduces attack surface
5. **Maintainability**: Centralized codebase with strong typing and modern patterns

The system does this while maintaining the trustless execution benefits of blockchain for critical settlement functions. This hybrid architecture represents an optimal balance for the BitHedge platform, enabling rapid development and a responsive user experience.
