import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Price feed tables
  priceFeed: defineTable({
    source: v.string(),
    price: v.number(),
    weight: v.number(),
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]),
  
  historicalPrices: defineTable({
    timestamp: v.number(),
    price: v.number(),
    source: v.optional(v.string()),
    isDaily: v.optional(v.boolean()),
    dayIndex: v.optional(v.number()),
    high: v.optional(v.number()),
    low: v.optional(v.number()),
    open: v.optional(v.number()),
    volume: v.optional(v.number()),
  })
  .index("by_timestamp", ["timestamp"])
  .index("by_source_and_timestamp", ["source", "timestamp"])
  .index("by_day_index", ["dayIndex"]),
  
  historicalVolatility: defineTable({
    period: v.number(),
    volatility: v.number(),
    timestamp: v.number(),
    timeframe: v.optional(v.number()),
    calculationMethod: v.optional(v.string()),
    dataPoints: v.optional(v.number()),
    startTimestamp: v.optional(v.number()),
    endTimestamp: v.optional(v.number()),
  })
  .index("by_timestamp", ["timestamp"])
  .index("by_timeframe_and_timestamp", ["timeframe", "timestamp"]),
  
  aggregatedPrices: defineTable({
    price: v.number(),
    timestamp: v.number(),
    volatility: v.number(),
    sourceCount: v.optional(v.number()),
    range24h: v.optional(v.number()),
  }).index("by_timestamp", ["timestamp"]),
  
  // Options tables
  contracts: defineTable({
    type: v.string(), // "PUT" or "CALL"
    strikePrice: v.number(),
    amount: v.number(),
    duration: v.number(), // in seconds
    premium: v.number(),
    status: v.string(), // "open", "filled", "expired", "cancelled"
    createdBy: v.string(), // Changed from v.id("users") to v.string()
    filledBy: v.optional(v.string()), // Changed from v.id("users") to v.string()
    expiresAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_creator", ["createdBy"])
    .index("by_filler", ["filledBy"]),
  
  // Users table to replace auth tables
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    lastLogin: v.optional(v.number())
  }),

  // Table to record Oracle submission attempts
  oracleSubmissions: defineTable({
    txid: v.string(), // The transaction ID returned by the broadcast
    submittedPriceSatoshis: v.number(), // The price (in satoshis) that was submitted
    submissionTimestamp: v.number(), // Convex server timestamp when the submission was initiated
    status: v.string(), // e.g., "submitted", "confirmed", "failed"
    confirmationTimestamp: v.optional(v.number()), // Timestamp when confirmed on-chain (if tracked)
    blockHeight: v.optional(v.number()), // Block height of confirmation (if tracked)
    reason: v.string(), // Reason for the submission (e.g., "Price threshold exceeded", "Max time elapsed")
    percentChange: v.optional(v.float64()), // Percent change triggering the update (if applicable)
    sourceCount: v.number(), // Number of sources used for the submitted price
  })
    .index("by_txid", ["txid"])
    .index("by_status", ["status"])
    .index("by_submission_timestamp", ["submissionTimestamp"]),

  // --- Premium Calculation Tables (New) ---
  premiumCalculations: defineTable({
    // User identification
    userId: v.string(),

    // Input parameters
    asset: v.string(), // e.g., "BTC"
    currentPrice: v.number(), // Price at calculation time
    protectedValue: v.number(), // Strike price in USD
    protectedAmount: v.number(), // Amount of BTC to protect
    expirationDays: v.number(), // Days until expiration
    policyType: v.string(), // "PUT" or "CALL"
    volatilityUsed: v.number(), // Volatility value used in calculation

    // Calculation results
    premium: v.number(), // Cost in USD
    premiumPercentage: v.number(), // As percentage of protected value
    annualizedPremium: v.number(), // Annualized percentage
    breakEvenPrice: v.number(), // Price at which protection has zero net value

    // Component factors (for breakdown visualization)
    intrinsicValue: v.number(),
    timeValue: v.number(),
    volatilityImpact: v.number(),

    // Metadata
    calculationModel: v.string(), // e.g., "BlackScholes"
    timestamp: v.string(), // ISO date string

    // Additional data
    scenarios: v.array(
      v.object({
        price: v.number(),
        protectionValue: v.number(),
        netValue: v.number(),
      })
    ),
  })
    .index("by_userId", ["userId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_asset", ["asset"]),

  yieldCalculations: defineTable({
    // User identification
    userId: v.string(),

    // Input parameters
    asset: v.string(), // e.g., "BTC"
    commitmentAmount: v.number(), // Amount in USD or STX
    commitmentAmountUSD: v.number(), // USD value of commitment
    selectedTier: v.string(), // "conservative", "balanced", "aggressive"
    selectedPeriod: v.number(), // Days

    // Calculation results
    estimatedYield: v.number(), // Absolute return in USD or STX
    annualizedYieldPercentage: v.number(), // Annualized percentage
    estimatedBTCAcquisitionPrice: v.optional(v.number()), // Price at which BTC might be acquired

    // Risk metrics
    riskLevel: v.number(), // 1-10 scale
    capitalEfficiency: v.optional(v.number()), // Calculated efficiency

    // Component factors
    baseYield: v.number(),
    tierAdjustment: v.number(),
    durationAdjustment: v.number(),
    marketConditionAdjustment: v.number(),

    // Metadata
    calculationModel: v.string(), // e.g., "ProviderYieldModel"
    timestamp: v.string(), // ISO date string
    marketConditions: v.object({
      btcPrice: v.number(),
      volatility: v.number(),
      liquidity: v.number(),
    }),
  })
    .index("by_userId", ["userId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_tier", ["selectedTier"]),

  quotes: defineTable({
    // Common fields
    userId: v.string(),
    quoteType: v.string(), // "buyer" or "provider"
    asset: v.string(), // e.g., "BTC"
    createdAt: v.string(), // ISO date string
    expiresAt: v.string(), // ISO date string when quote expires
    status: v.string(), // "active", "expired", "purchased", "committed", "declined"

    // Link to the specific calculation that generated this quote
    calculationId: v.optional(v.id("premiumCalculations")), // If buyer
    yieldCalculationId: v.optional(v.id("yieldCalculations")), // If provider

    // Buyer-specific parameters *at the time of quoting*
    buyerParamsSnapshot: v.optional(
      v.object({
        protectedValuePercentage: v.number(),
        protectionAmount: v.number(),
        expirationDays: v.number(),
        policyType: v.string(),
      })
    ),

    // Provider-specific parameters *at the time of quoting*
    providerParamsSnapshot: v.optional(
      v.object({
        commitmentAmount: v.number(),
        commitmentAmountUSD: v.number(),
        selectedTier: v.string(),
        selectedPeriod: v.number(),
      })
    ),

    // Results from the linked calculation (denormalized for display)
    quoteResult: v.object({
      // Buyer result fields
      premium: v.optional(v.number()),
      premiumPercentage: v.optional(v.number()),
      breakEvenPrice: v.optional(v.number()),
      // Provider result fields
      estimatedYield: v.optional(v.number()),
      annualizedYieldPercentage: v.optional(v.number()),
      estimatedBTCAcquisitionPrice: v.optional(v.number()),
      capitalEfficiency: v.optional(v.number()),
    }),

    // Risk parameters used for this specific quote calculation
    riskParamsSnapshot: v.object({
      baseRate: v.number(),
      volatilityMultiplier: v.number(),
      durationFactor: v.number(),
      coverageFactor: v.number(),
      tierMultipliers: v.optional(
        v.object({
          conservative: v.optional(v.number()),
          balanced: v.optional(v.number()),
          aggressive: v.optional(v.number()),
        })
      ),
    }),

    // Market data at quote time
    marketDataSnapshot: v.object({
      btcPrice: v.number(),
      volatility: v.number(),
      timestamp: v.string(), // ISO date string
    }),

    // Transaction data (populated after purchase/commitment)
    transaction: v.optional(
      v.object({
        txHash: v.string(),
        blockHeight: v.number(),
        status: v.string(),
        confirmedAt: v.string(),
      })
    ),

    // User-provided metadata
    metadata: v.optional(
      v.object({
        displayName: v.string(),
        notes: v.string(),
        tags: v.array(v.string()),
      })
    ),
  })
    .index("by_userId_status", ["userId", "status"])
    .index("by_userId_expiresAt", ["userId", "expiresAt"])
    .index("by_userId_quoteType", ["userId", "quoteType"]),

  riskParameters: defineTable({
    assetType: v.string(), // e.g., "BTC", "ETH"
    policyType: v.string(), // "PUT" or "CALL"

    // Base parameters
    baseRate: v.number(), // Base premium rate
    volatilityMultiplier: v.number(), // Volatility impact factor
    durationFactor: v.number(), // Duration impact factor
    coverageFactor: v.number(), // Coverage amount impact factor

    // Tier-specific adjustments
    tierMultipliers: v.object({
      conservative: v.number(),
      balanced: v.number(),
      aggressive: v.number(),
    }),

    // Market condition adjustments
    liquidityAdjustment: v.number(), // Adjustment for market liquidity
    marketTrendAdjustment: v.number(), // Adjustment for market trend

    // Metadata
    version: v.number(), // Version number for tracking changes
    lastUpdated: v.string(), // ISO date string
    updatedBy: v.string(), // User ID who last updated
    isActive: v.boolean(), // Whether these parameters are active
  })
    .index("by_asset_policy_active", ["assetType", "policyType", "isActive"])
    .index("by_version", ["version"]),

  // Policy Registry Tables
  policies: defineTable({
    owner: v.string(), // Stacks Principal of the policyholder
    counterparty: v.optional(v.string()), // Stacks Principal of the counterparty (e.g., pool)
    
    // Core Policy Terms
    policyType: v.string(), // e.g., "PUT", "CALL"
    positionType: v.string(), // e.g., "LONG_PUT", "SHORT_PUT"
    protectedValue: v.number(), // Strike price (e.g., in USD)
    protectionAmount: v.number(), // Quantity of the underlying asset (e.g., BTC amount)
    premium: v.number(), // Premium paid for the policy (e.g., in USD or STX equivalent)
    
    // Timestamps & Expiration
    creationTimestamp: v.number(), // Convex server timestamp of creation
    activationTimestamp: v.optional(v.number()), // Timestamp of on-chain activation (if applicable)
    expirationHeight: v.number(), // Stacks block height at which policy expires
    exercisedAt: v.optional(v.number()), // Timestamp when policy was exercised
    updatedAt: v.optional(v.number()), // Timestamp of last update to this record
    lastReconciled: v.optional(v.number()), // Timestamp of last on-chain reconciliation
    
    // Status & Lifecycle
    status: v.string(), // e.g., "Pending", "Active", "Exercised", "Expired", "Cancelled"
    
    // On-Chain Identifiers
    onChainPolicyId: v.optional(v.string()), // ID from the Stacks smart contract
    
    // Token Information
    collateralToken: v.string(), // Token used for collateral (e.g., "STX", "sBTC")
    settlementToken: v.string(), // Token used for settlement (e.g., "STX", "sBTC")
    
    // Financials & Payout
    settlementAmount: v.optional(v.number()), // Amount paid out upon exercise
    settlementPrice: v.optional(v.number()), // Price of underlying at exercise
    breakEvenPrice: v.optional(v.number()), // Price at which P&L is zero for buyer
    exercisePrice: v.optional(v.number()), // Price at which the policy was exercised (market price)
    
    // Settlement Processing
    settlementStatus: v.optional(v.string()), // e.g., "Requested", "Processing", "Completed", "Failed"
    settlementProcessed: v.optional(v.boolean()), // Whether settlement has been processed
    settlementTransactionId: v.optional(v.string()), // Transaction ID of the settlement
    settlementCompletedAt: v.optional(v.number()), // Timestamp when settlement was completed
    settlementError: v.optional(v.string()), // Error if settlement failed
    settlementBlockHeight: v.optional(v.number()), // Block height of settlement confirmation
    
    // Premium Distribution
    premiumPaid: v.optional(v.boolean()), // Whether premium has been paid
    premiumDistributed: v.optional(v.boolean()), // Whether premium has been distributed to counterparty

    // User-Facing Information
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),

    // TODO: Consider adding fields from the old `contracts` table if they are relevant for policies
    // and not covered, e.g. `duration` (though covered by expirationHeight and creationTimestamp)
  })
    .index("by_owner_and_status", ["owner", "status"])
    .index("by_status", ["status"])
    .index("by_expirationHeight", ["expirationHeight"])
    .index("by_policyType", ["policyType"])
    .index("by_positionType", ["positionType"])
    .index("by_counterparty", ["counterparty"]),

  policyEvents: defineTable({
    policyConvexId: v.id("policies"), // Link to the policy in Convex
    eventType: v.string(), // e.g., "Created", "Activated", "Expired", "Error"
    timestamp: v.number(), // Convex server timestamp of the event
    data: v.any(), // Flexible field for event-specific data
    transactionId: v.optional(v.string()), // On-chain transaction ID if applicable
    blockHeight: v.optional(v.number()), // Block height if applicable
  })
    .index("by_policyConvexId_and_timestamp", ["policyConvexId", "timestamp"]),

  pendingPolicyTransactions: defineTable({
    actionType: v.string(), // e.g., "CreatePolicy", "ActivatePolicy", "UpdatePolicyStatus"
    status: v.string(), // e.g., "Pending", "Submitted", "Confirmed", "Failed"
    payload: v.any(), // Data needed for the transaction (e.g., policy params, user inputs)
    
    // Timestamps
    createdAt: v.number(), // Convex server timestamp of creation
    updatedAt: v.number(), // Timestamp of last update
    confirmedAt: v.optional(v.number()), // Timestamp of on-chain confirmation
    
    // Transaction Details
    transactionId: v.optional(v.string()), // On-chain TX ID, once submitted
    blockHeight: v.optional(v.number()), // Block height of confirmation
    
    // Link to Policy & User
    policyConvexId: v.optional(v.id("policies")), // Link to the policy in Convex, if applicable
    userId: v.optional(v.string()), // User who initiated the action
    
    // Error & Retry Information
    error: v.optional(v.string()), // Error message if the transaction failed
    retryCount: v.number(), // Number of times this transaction has been retried
    lastAttemptedAt: v.optional(v.number()), // Timestamp of the last attempt

    // Additional context
    notes: v.optional(v.string()), // Any internal notes about this transaction
    
  })
    .index("by_status_and_actionType", ["status", "actionType"])
    .index("by_policyConvexId", ["policyConvexId"])
    .index("by_userId", ["userId"]),

  // --- Liquidity Pool Tables ---
  
  // CV-LP-201: Provider Balances Table
  provider_balances: defineTable({
    provider: v.string(), // Provider principal (Stacks address)
    token: v.string(), // Token ID (STX, sBTC, etc.)
    total_deposited: v.number(), // Total amount deposited
    available_balance: v.number(), // Available (unlocked) balance
    locked_balance: v.number(), // Balance locked as collateral
    earned_premiums: v.number(), // Total premiums earned
    withdrawn_premiums: v.number(), // Premiums withdrawn
    pending_premiums: v.number(), // Premiums pending distribution
    last_updated: v.number(), // Timestamp of last update
  })
    .index("by_provider_token", ["provider", "token"])
    .index("by_provider", ["provider"])
    .index("by_token", ["token"]),

  // CV-LP-202: Pool Metrics Table
  pool_metrics: defineTable({
    timestamp: v.number(), // When the metrics were recorded
    token: v.string(), // Token ID (STX, sBTC, etc.)
    total_liquidity: v.number(), // Total funds in the pool for this token
    available_liquidity: v.number(), // Unlocked funds available for new policies
    locked_liquidity: v.number(), // Funds locked as collateral
    total_providers: v.number(), // Number of providers with active deposits
    active_policies: v.number(), // Number of active policies backed by this pool
    total_premiums_collected: v.number(), // Total premiums collected (lifetime)
    premiums_distributed: v.number(), // Total premiums distributed to providers
    annualized_yield: v.number(), // Current annualized yield for this token
    avg_policy_duration: v.optional(v.number()), // Average duration of active policies
    utilization_rate: v.number(), // Percentage of pool funds utilized (locked/total)
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_token_timestamp", ["token", "timestamp"]),

  // CV-LP-203: Policy Allocations Table
  policy_allocations: defineTable({
    policy_id: v.id("policies"), // Policy ID
    provider: v.string(), // Provider principal
    token: v.string(), // Token ID
    allocated_amount: v.number(), // Amount allocated as collateral
    allocation_percentage: v.number(), // Percentage of total policy collateral
    premium_share: v.number(), // Share of premium allocated to this provider
    premium_distributed: v.boolean(), // Whether premium has been distributed
    allocation_timestamp: v.number(), // When allocation was made
    status: v.string(), // ACTIVE, EXPIRED, EXERCISED, etc.
  })
    .index("by_policy_provider", ["policy_id", "provider"])
    .index("by_provider", ["provider"])
    .index("by_status", ["status"])
    .index("by_provider_status", ["provider", "status"])
    .index("by_policy_status", ["policy_id", "status"]),

  // CV-LP-204: Pool Transactions Table 
  pool_transactions: defineTable({
    provider: v.string(), // Provider principal (Stacks address)
    tx_id: v.string(), // Internal transaction ID
    tx_type: v.string(), // DEPOSIT, WITHDRAWAL, PREMIUM, ALLOCATION, etc.
    amount: v.number(), // Amount involved in the transaction
    token: v.string(), // Token ID (STX, sBTC, etc.)
    timestamp: v.number(), // Transaction timestamp
    policy_id: v.optional(v.id("policies")), // Associated policy (if applicable)
    status: v.string(), // PENDING, CONFIRMED, FAILED
    chain_tx_id: v.optional(v.string()), // On-chain transaction ID
    description: v.optional(v.string()), // Human-readable description
    metadata: v.optional(v.any()), // Additional transaction-specific data
  })
    .index("by_provider_timestamp", ["provider", "timestamp"])
    .index("by_tx_type", ["tx_type"])
    .index("by_provider_tx_type", ["provider", "tx_type"])
    .index("by_policy_id", ["policy_id"])
    .index("by_status", ["status"]),

  // CV-LP-205: Pending Pool Transactions Table
  pending_pool_transactions: defineTable({
    provider: v.string(), // Provider principal (Stacks address)
    tx_id: v.string(), // Internal transaction ID
    tx_type: v.string(), // DEPOSIT, WITHDRAWAL, PREMIUM_DISTRIBUTION, etc.
    amount: v.number(), // Amount involved
    token: v.string(), // Token ID (STX, sBTC, etc.)
    timestamp: v.number(), // Creation timestamp
    payload: v.any(), // Transaction-specific data for processing
    status: v.string(), // PENDING, SUBMITTED, CONFIRMED, FAILED
    chain_tx_id: v.optional(v.string()), // On-chain transaction ID once submitted
    last_checked: v.optional(v.number()), // When status was last checked
    retry_count: v.number(), // Number of retry attempts
    error: v.optional(v.string()), // Error message if failed
    policy_id: v.optional(v.id("policies")), // Associated policy (if applicable)
    metadata: v.optional(v.any()), // Additional processing metadata
  })
    .index("by_provider", ["provider"])
    .index("by_status", ["status"])
    .index("by_tx_type_status", ["tx_type", "status"])
    .index("by_policy_id", ["policy_id"]),

  // CV-LP-221: Premium Balances Table
  premium_balances: defineTable({
    token: v.string(), // Token ID used for premium (STX, sBTC, etc.)
    total_premiums: v.number(), // Total premiums collected in this token
    distributed_premiums: v.number(), // Total premiums distributed to providers
    last_updated: v.number(), // Timestamp of last update
    last_distribution: v.optional(v.number()), // Timestamp of last distribution
    distribution_count: v.optional(v.number()), // Count of distribution events
  })
    .index("by_token", ["token"]),

  // CV-LP-223: Provider Premium Distributions Table
  provider_premium_distributions: defineTable({
    policy_id: v.id("policies"), // Policy ID
    provider: v.string(), // Provider principal (Stacks address)
    premium_amount: v.number(), // Premium amount for this provider
    token: v.string(), // Token used for premium payment
    distribution_timestamp: v.number(), // When premium was distributed/recorded
    status: v.string(), // PENDING, COMPLETED, FAILED
    chain_tx_id: v.optional(v.string()), // On-chain transaction ID if applicable
    allocation_percentage: v.optional(v.number()), // Provider's percentage of total premium
    source: v.optional(v.string()), // Source of distribution (e.g., "policy_expiration", "manual")
    batch_id: v.optional(v.string()), // ID for batch distributions
  })
    .index("by_policy_provider", ["policy_id", "provider"])
    .index("by_provider", ["provider"])
    .index("by_provider_status", ["provider", "status"])
    .index("by_distribution_timestamp", ["distribution_timestamp"])
    .index("by_status", ["status"])
    .index("by_batch_id", ["batch_id"]),
});
