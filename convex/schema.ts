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
    // Core fields that mirror on-chain data
    policyId: v.number(), // Unique identifier from on-chain contract
    owner: v.string(), // Principal of the policy owner (Stacks address)
    counterparty: v.string(), // Principal of counterparty (e.g., pool address or another user)
    protectedValue: v.number(), // Strike price in base units (e.g., satoshis for BTC, or USD cents)
    protectionAmount: v.number(), // Amount protected in base units
    expirationHeight: v.number(), // Block height when policy expires
    premium: v.number(), // Premium amount in base units (e.g., STX, sBTC, or USD cents)
    policyType: v.string(), // "PUT" or "CALL"
    positionType: v.string(), // "LONG_PUT", "SHORT_PUT", "LONG_CALL", or "SHORT_CALL"
    collateralToken: v.string(), // Token used as collateral ("STX" or "sBTC")
    protectedAsset: v.string(), // Asset being protected ("BTC")
    settlementToken: v.string(), // Token used for settlement if exercised ("STX" or "sBTC")
    status: v.string(), // e.g., "Pending", "Active", "Exercised", "Expired", "Cancelled"
    premiumDistributed: v.boolean(), // Whether premium has been distributed to counterparty/providers
    premiumPaid: v.boolean(), // Whether premium has been paid by the buyer

    // Extended off-chain metadata
    creationTimestamp: v.number(), // Creation time (ms since epoch on Convex server)
    activationTimestamp: v.optional(v.number()), // Activation/Purchase time
    lastUpdatedTimestamp: v.number(), // Last update time on Convex server
    displayName: v.optional(v.string()), // User-friendly name for the policy
    description: v.optional(v.string()), // Optional description
    tags: v.optional(v.array(v.string())), // Tags for filtering/categorization

    // Settlement data (populated if exercised)
    exercisePrice: v.optional(v.number()), // Price at exercise (in protectedAsset units)
    exerciseHeight: v.optional(v.number()), // Block height at exercise
    exerciseTimestamp: v.optional(v.number()), // Exercise time (ms since epoch)
    settlementAmount: v.optional(v.number()), // Amount settled (in settlementToken units)
    settlementTransactionId: v.optional(v.string()), // Stacks txid of on-chain settlement

    // Risk metrics (can be calculated and updated periodically)
    currentValueUSD: v.optional(v.number()), // Current estimated market value of the policy in USD
    breakEvenPrice: v.optional(v.number()), // Break-even price for the policyholder
    potentialSettlement: v.optional(v.number()), // Potential settlement amount based on current prices

    // Linked data (primarily for off-chain relationships)
    providerIds: v.optional(v.array(v.string())), // Virtual link to backing providers (if applicable, for yield attribution)
    quoteId: v.optional(v.id("quotes")), // Optional link to the quote that generated this policy
  })
  .index("by_policyId", ["policyId"]) // For direct lookup if on-chain ID is known
  .index("by_owner_and_status", ["owner", "status"])
  .index("by_counterparty_and_status", ["counterparty", "status"])
  .index("by_status_and_expiration", ["status", "expirationHeight"])
  .index("by_expirationHeight", ["expirationHeight"]) // For automated expiry check
  .index("by_policyType", ["policyType"])
  .index("by_positionType", ["positionType"])
  .index("by_collateralToken", ["collateralToken"])
  .index("by_creationTimestamp", ["creationTimestamp"]),

  policyEvents: defineTable({
    policyConvexId: v.id("policies"), // Reference to the policy in Convex policies table
    onChainPolicyId: v.optional(v.number()), // On-chain policy ID, if available
    eventType: v.string(), // e.g., "Created", "Activated", "Expired", "PremiumPaid", "PremiumDistributed", "SettlementRequested", "SettlementCompleted", "StatusUpdate", "Error"
    timestamp: v.number(), // Event time (ms since epoch on Convex server)
    blockHeight: v.optional(v.number()), // Block height if the event originated from an on-chain transaction
    transactionId: v.optional(v.string()), // Stacks txid if applicable
    previousStatus: v.optional(v.string()), // Previous policy status (if status change)
    newStatus: v.optional(v.string()), // New policy status (if status change)
    collateralTokenInvolved: v.optional(v.string()),
    settlementTokenInvolved: v.optional(v.string()),
    premiumAmountInvolved: v.optional(v.number()),
    settlementAmountInvolved: v.optional(v.number()),
    actor: v.optional(v.string()), // Principal/User ID of who initiated/caused the event
    notes: v.optional(v.string()), // Additional human-readable notes
    data: v.optional(v.any()), // Additional event-specific structured data
  })
  .index("by_policyConvexId_and_timestamp", ["policyConvexId", "timestamp"])
  .index("by_eventType_and_timestamp", ["eventType", "timestamp"])
  .index("by_transactionId", ["transactionId"]),

  pendingPolicyTransactions: defineTable({
    policyConvexId: v.optional(v.id("policies")), // Reference to policy (if existing policy)
    onChainPolicyId: v.optional(v.number()), // On-chain policy ID if known
    actionType: v.string(), // e.g., "CreatePolicy", "ActivatePolicy", "ExpirePolicyBatch", "DistributePremium"
    status: v.string(), // "PendingUserInput", "SubmittedToChain", "ConfirmedOnChain", "FailedOnChain", "Retrying"
    createdAt: v.number(), // When transaction was initiated in Convex (ms since epoch)
    updatedAt: v.number(), // Last status update in Convex (ms since epoch)
    submittedAt: v.optional(v.number()), // Timestamp when submitted to chain
    confirmedAt: v.optional(v.number()), // Timestamp when confirmed on chain
    failedAt: v.optional(v.number()), // Timestamp if failed
    transactionId: v.optional(v.string()), // Stacks txid when available
    payload: v.any(), // Transaction payload/params sent to chain or parameters for the action
    onChainCallDetails: v.optional(v.object({ // Details specific to the on-chain call
      contractAddress: v.string(),
      contractName: v.string(),
      functionName: v.string(),
      // functionArgs can be complex, store as string or structured if simple enough
      functionArgsRepresentation: v.optional(v.string()), 
    })),
    error: v.optional(v.string()), // Error message if failed
    retryCount: v.optional(v.number()), // Count of retry attempts for this action
    userId: v.optional(v.string()), // Principal of user who initiated (if user action) or system for automated
    nonce: v.optional(v.number()), // Optional nonce if used for tx submission
  })
  .index("by_status_and_updatedAt", ["status", "updatedAt"])
  .index("by_actionType_and_status", ["actionType", "status"])
  .index("by_transactionId", ["transactionId"])
  .index("by_userId_and_status", ["userId", "status"]),
});
