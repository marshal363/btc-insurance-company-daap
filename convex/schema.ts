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
});
