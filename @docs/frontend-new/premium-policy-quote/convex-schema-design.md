# Convex Schema Design for Premium Calculation and Quotes

**Version:** 1.1  
**Date:** 2024-08-20  
**Context:** Schema design for premium calculation, quotes, and policy management in the Convex backend. (Incorporates architectural review feedback).

## 1. Overview

This document outlines the Convex schema design for the premium calculation system, policy quotes, and related components for the BitHedge platform. The schema design supports both Protection Buyer and Liquidity Provider personas and facilitates the user flow from parameter selection to premium calculation to quote generation.

## 2. Schema Tables

### 2.1 `premiumCalculations` Table

Stores records of premium calculations performed by users.

```typescript
// In schema.ts
export default defineSchema({
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
});
```

### 2.2 `yieldCalculations` Table

Stores records of yield calculations for liquidity providers.

```typescript
// In schema.ts
// Add to schema definition
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
```

### 2.3 `quotes` Table

Stores saved quotes for both buyer protection and provider liquidity. **Links to calculation record and stores parameters used at time of quote.**

```typescript
// In schema.ts
// Add to schema definition
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
        /*...*/
      })
    ),
    // Add other relevant risk params
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
  .index("by_userId_quoteType", ["userId", "quoteType"]);
```

### 2.4 `riskParameters` Table

Stores risk parameters used in premium calculations.

```typescript
// In schema.ts
// Add to schema definition
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
  .index("by_version", ["version"]);
```

## 3. Query and Mutation Functions

### 3.1 Premium Calculation Queries

```typescript
// In premium.ts (or a dedicated calculation service module)
export const getBuyerPremiumQuote = query({
  args: {
    protectedValuePercentage: v.number(),
    protectedAmount: v.number(),
    expirationDays: v.number(),
    policyType: v.string(), // Typically "PUT"
    currentPriceOverride: v.optional(v.number()),
    includeScenarios: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // 1. Get current market data (price, volatility)
    const marketData = await ctx.runQuery(
      internal.marketData.getCurrentMarketData,
      { asset: "BTC" }
    );
    const currentPrice = args.currentPriceOverride ?? marketData.price;
    const volatility = marketData.volatility; // Or fetch specific duration volatility

    // 2. Calculate protected value in USD
    const protectedValueUSD =
      (currentPrice * args.protectedValuePercentage) / 100;

    // 3. Get active risk parameters
    const riskParams = await ctx.runQuery(
      internal.premium.getActiveRiskParameters,
      {
        assetType: "BTC",
        policyType: args.policyType,
      }
    );
    if (!riskParams) throw new Error("Active risk parameters not found");

    // 4. Calculate premium using the appropriate model
    const result = calculatePremiumWithBlackScholes({
      currentPrice: currentPrice,
      strikePrice: protectedValueUSD,
      volatility: volatility,
      duration: args.expirationDays,
      amount: args.protectedAmount,
      riskParams: riskParams, // Pass fetched risk params
    });

    // 5. Generate price scenarios if requested
    let scenarios = [];
    if (args.includeScenarios) {
      scenarios = generatePriceScenarios({
        currentPrice: currentPrice,
        strikePrice: protectedValueUSD,
        premium: result.premium,
        amount: args.protectedAmount,
      });
    }

    // 6. Log the calculation (optional but recommended)
    // await ctx.runMutation(internal.premium.logPremiumCalculation, { ... });

    // 7. Return the comprehensive quote result
    return {
      ...result,
      scenarios,
      marketDataSnapshot: {
        // Include market data used
        btcPrice: currentPrice,
        volatility: volatility,
        timestamp: new Date().toISOString(),
      },
      riskParamsSnapshot: riskParams, // Include risk params used
    };
  },
});

export const getProviderYieldQuote = query({
  args: {
    commitmentAmount: v.number(), // In STX or USD based on UI convention
    commitmentAmountUSD: v.number(), // Ensure USD value is passed
    selectedTier: v.string(),
    selectedPeriod: v.number(),
  },
  handler: async (ctx, args) => {
    // 1. Get current market data
    const marketData = await ctx.runQuery(
      internal.marketData.getCurrentMarketData,
      { asset: "BTC" }
    );
    const volatility = marketData.volatility; // Or fetch specific duration volatility

    // 2. Get active risk parameters (assuming providers primarily underwrite PUTs)
    const riskParams = await ctx.runQuery(
      internal.premium.getActiveRiskParameters,
      {
        assetType: "BTC",
        policyType: "PUT",
      }
    );
    if (!riskParams) throw new Error("Active risk parameters not found");

    // 3. Calculate estimated yield using the provider model
    const result = calculateProviderYieldModel({
      commitmentAmountUSD: args.commitmentAmountUSD,
      selectedTier: args.selectedTier,
      selectedPeriod: args.selectedPeriod,
      volatility: volatility,
      riskParams: riskParams,
      marketConditions: marketData,
    });

    // 4. Log the calculation (optional)
    // await ctx.runMutation(internal.premium.logYieldCalculation, { ... });

    // 5. Return the comprehensive quote result
    return {
      ...result,
      marketDataSnapshot: {
        // Include market data used
        btcPrice: marketData.price,
        volatility: volatility,
        timestamp: new Date().toISOString(),
      },
      riskParamsSnapshot: riskParams, // Include risk params used
    };
  },
});
```

### 3.2 Premium Calculation Mutations (Logging - Internal)

```typescript
// In premium.ts (internal helpers)
export const logPremiumCalculation = internalMutation({
  args: {
    /* ... parameters from calculation ... */
  },
  handler: async (ctx, args) => {
    // Insert into premiumCalculations table
    // ... implementation ...
  },
});

export const logYieldCalculation = internalMutation({
  args: {
    /* ... parameters from calculation ... */
  },
  handler: async (ctx, args) => {
    // Insert into yieldCalculations table
    // ... implementation ...
  },
});
```

### 3.3 Quote Management

```typescript
// In quotes.ts
export const saveQuote = mutation({
  args: {
    quoteType: v.string(), // "buyer" or "provider"
    asset: v.string(),
    // Pass the *full* result object from the corresponding calculation query
    calculationResult: v.any(), // Use v.any() or a more specific validator
    // User-provided metadata
    metadata: v.optional(
      v.object({
        displayName: v.string(),
        notes: v.string(),
        tags: v.array(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;

    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h expiry

    // Extract parameters and results based on quoteType
    let buyerParamsSnapshot = undefined;
    let providerParamsSnapshot = undefined;
    let quoteResult = {};

    if (args.quoteType === "buyer" && args.calculationResult) {
      const result = args.calculationResult; // Cast to expected buyer result type
      buyerParamsSnapshot = {
        protectedValuePercentage: result.inputs.protectedValuePercentage,
        protectionAmount: result.inputs.protectedAmount,
        expirationDays: result.inputs.expirationDays,
        policyType: result.inputs.policyType,
      };
      quoteResult = {
        premium: result.premium,
        premiumPercentage: result.premiumPercentage,
        breakEvenPrice: result.breakEvenPrice,
      };
    } else if (args.quoteType === "provider" && args.calculationResult) {
      const result = args.calculationResult; // Cast to expected provider result type
      providerParamsSnapshot = {
        commitmentAmount: result.inputs.commitmentAmount,
        commitmentAmountUSD: result.inputs.commitmentAmountUSD,
        selectedTier: result.inputs.selectedTier,
        selectedPeriod: result.inputs.selectedPeriod,
      };
      quoteResult = {
        estimatedYield: result.estimatedYield,
        annualizedYieldPercentage: result.annualizedYieldPercentage,
        estimatedBTCAcquisitionPrice: result.estimatedBTCAcquisitionPrice,
        capitalEfficiency: result.capitalEfficiency,
      };
    } else {
      throw new Error("Invalid quote type or missing calculation result");
    }

    const id = await ctx.db.insert("quotes", {
      userId,
      quoteType: args.quoteType,
      asset: args.asset,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      status: "active",
      calculationId: args.calculationResult?._id, // Link if calculation was logged
      yieldCalculationId: args.calculationResult?._id, // Adjust based on logging
      buyerParamsSnapshot,
      providerParamsSnapshot,
      quoteResult,
      riskParamsSnapshot: args.calculationResult.riskParamsSnapshot,
      marketDataSnapshot: args.calculationResult.marketDataSnapshot,
      metadata: args.metadata,
    });

    return { id };
  },
});

export const getQuoteById = query({
  args: { id: v.id("quotes") },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.id);
    if (!quote) {
      throw new Error("Quote not found");
    }

    // Check if quote has expired
    const now = new Date();
    const expiresAt = new Date(quote.expiresAt);

    if (now > expiresAt && quote.status === "active") {
      // Optional: Update status if expired (or handle lazily on read)
      // await ctx.db.patch(args.id, { status: "expired" });
      return { ...quote, status: "expired", _needsStatusUpdate: true };
    }

    return quote;
  },
});

export const getUserQuotes = query({
  args: {
    quoteType: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;

    let dbQuery = ctx.db
      .query("quotes")
      .withIndex("by_userId_status", (q) => q.eq("userId", userId)); // Use appropriate index

    if (args.quoteType) {
      dbQuery = dbQuery.filter((q) =>
        q.eq(q.field("quoteType"), args.quoteType)
      );
    }

    if (args.status) {
      dbQuery = dbQuery.filter((q) => q.eq(q.field("status"), args.status));
    }

    const limit = args.limit || 10;
    const quotes = await dbQuery.order("desc").take(limit);

    // Optionally check expiry status for all returned quotes here

    return quotes;
  },
});
```

### 3.4 Blockchain Preparation Utilities

```typescript
// In blockchain.ts (or blockchainInteractionService)
export const prepareQuoteForBlockchain = internalQuery({
  // Changed to internalQuery for service layer pattern
  args: {
    quoteId: v.id("quotes"),
  },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);
    if (!quote) throw new Error("Quote not found");

    // Check quote status
    if (quote.status !== "active" || new Date(quote.expiresAt) < new Date()) {
      throw new Error("Quote is not active or has expired.");
    }

    // Use snapshots stored in the quote
    const marketData = quote.marketDataSnapshot;
    const riskParams = quote.riskParamsSnapshot;

    // Get current block height (needs access to blockchain integration layer)
    const blockHeight = await ctx.runQuery(
      api.blockchain.getCurrentBlockHeight,
      {}
    );

    const BLOCKS_PER_DAY = 144; // Example value
    let blockchainParamsDTO;

    if (quote.quoteType === "buyer" && quote.buyerParamsSnapshot) {
      const params = quote.buyerParamsSnapshot;
      const result = quote.quoteResult;
      const expirationBlocks = Math.floor(
        params.expirationDays * BLOCKS_PER_DAY
      );

      // Convert USD premium to STX microSTX (requires Oracle or conversion rate)
      // Placeholder: Needs actual conversion logic
      const premiumMicroStx = BigInt(
        Math.floor(((result.premium || 0) / 0.45) * 1000000)
      );
      const protectedValueMicroStx = BigInt(
        Math.floor(
          ((marketData.btcPrice * params.protectedValuePercentage) /
            100 /
            0.45) *
            1000000
        )
      ); // Example conversion

      blockchainParamsDTO = {
        policyType: params.policyType,
        protectedValueMicroStx,
        protectedAmountSats: BigInt(
          Math.floor(params.protectionAmount * 100000000)
        ),
        expirationBlocks: BigInt(expirationBlocks),
        premiumMicroStx,
        currentBlockHeight: BigInt(blockHeight),
        expirationHeight: BigInt(blockHeight + expirationBlocks),
      };
    } else if (quote.quoteType === "provider" && quote.providerParamsSnapshot) {
      const params = quote.providerParamsSnapshot;
      const durationBlocks = Math.floor(params.selectedPeriod * BLOCKS_PER_DAY);

      // Convert USD commitment to STX microSTX (requires Oracle or conversion rate)
      // Placeholder: Needs actual conversion logic
      const commitmentMicroStx = BigInt(
        Math.floor((params.commitmentAmountUSD / 0.45) * 1000000)
      );

      blockchainParamsDTO = {
        tierName: params.selectedTier,
        commitmentAmountMicroStx: commitmentMicroStx,
        durationBlocks: BigInt(durationBlocks),
        currentBlockHeight: BigInt(blockHeight),
        expirationHeight: BigInt(blockHeight + durationBlocks),
      };
    } else {
      throw new Error("Invalid quote type or missing parameter snapshot");
    }

    return blockchainParamsDTO; // Return the prepared DTO
  },
});
```

## 4. Integration with UI Components

The schema and functions defined above are designed to integrate seamlessly with the UI components:

1.  **`BuyerParametersUI` Integration**:

    - Uses `getBuyerPremiumQuote` query when parameters change (debounced).
    - Stores and retrieves parameters via `BuyerContext`.
    - Displays premium results in real-time.

2.  **`ProviderParametersUI` Integration**:

    - Uses `getProviderYieldQuote` query when parameters change (debounced).
    - Stores and retrieves parameters via `ProviderContext`.
    - Displays yield results in real-time.

3.  **Quote Generation**:
    - Uses `saveQuote` mutation when user confirms parameters.
    - Retrieves saved quotes with `getUserQuotes` and `getQuoteById`.
    - Prepares for blockchain with `prepareQuoteForBlockchain`.

## 5. Future Enhancements

1.  **Historical Quote Analysis**:

    - Add functions to track quote history and analyze user preferences.
    - Implement recommendation engine based on past quotes.

2.  **Advanced Risk Parameters**:

    - Develop dynamic risk parameter adjustment based on market conditions.
    - Implement tier-specific premium calculation models.

3.  **Blockchain Transaction Management**:

    - Add transaction submission, tracking, and receipt storage.
    - Implement policy lifecycle management (exercise, expiration).

4.  **Multi-Asset Support**:
    - Extend schema to support multiple assets beyond Bitcoin.
    - Implement cross-asset correlation in premium calculations.
