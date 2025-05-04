# Convex Oracle Implementation Guidelines

## 1. Overview

This document provides detailed implementation guidelines for the BitHedge Oracle component within the Convex Backend-as-a-Service platform. It outlines the technical approach, code structure, data models, and best practices for developing a robust, secure, and maintainable price oracle system.

## 2. Core Components

The BitHedge Oracle implementation in Convex consists of these core components:

### 2.1 Price Feed Connectors

Price Feed Connectors are responsible for fetching raw price data from external exchanges and APIs:

```typescript
// Example Price Feed Connector structure
export type PriceSource = {
  source: string; // Name of the exchange/API (e.g., "binance", "coinbase")
  price: number; // Price in USD
  timestamp: number; // Unix timestamp in milliseconds
  volume24h?: number; // Optional 24h volume information
  lastUpdated: number; // When this data was last fetched
  reliabilityScore: number; // Dynamic score based on historical reliability
};

// Example connector for Binance
export const binancePriceFeed = query(
  async ({ db, http }): Promise<PriceSource> => {
    try {
      // Fetch from Binance API
      const response = await http.get(
        "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"
      );
      const volumeData = await http.get(
        "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT"
      );

      if (response.status !== 200 || volumeData.status !== 200) {
        throw new Error(`Failed to fetch from Binance: ${response.status}`);
      }

      const price = parseFloat(response.body.price);
      const volume = parseFloat(volumeData.body.volume);

      // Get reliability score from database
      const reliabilityRecord = await db
        .query("sourceReliability")
        .filter((q) => q.eq(q.field("source"), "binance"))
        .first();

      return {
        source: "binance",
        price: price,
        timestamp: Date.now(),
        volume24h: volume,
        lastUpdated: Date.now(),
        reliabilityScore: reliabilityRecord?.reliabilityScore || 0.95, // Default if not found
      };
    } catch (error) {
      console.error("Binance feed error:", error);
      throw new Error(`Binance feed error: ${error.message}`);
    }
  }
);
```

Implement at least 3-5 exchange connectors prioritizing:

- Major exchanges (Binance, Coinbase, Kraken, etc.)
- API reliability and rate limits
- Data quality and consistency

### 2.2 Data Aggregation Engine

The Aggregation Engine processes raw price data to produce high-quality, reliable price information:

```typescript
// Example Aggregation Engine
export const aggregatePrices = mutation(
  async ({ db }, sources: PriceSource[]): Promise<AggregatedPrice> => {
    // Require minimum number of sources
    if (sources.length < 3) {
      throw new Error("Insufficient price sources for aggregation");
    }

    const prices = sources.map((source) => source.price);

    // Basic statistical calculations
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];
    const sum = prices.reduce((acc, price) => acc + price, 0);
    const mean = sum / prices.length;

    // Calculate deviation from median
    const deviations = prices.map(
      (price) => Math.abs(price - medianPrice) / medianPrice
    );
    const avgDeviation =
      deviations.reduce((acc, dev) => acc + dev, 0) / deviations.length;

    // Filter outliers (prices with deviation > 2x average)
    const filteredSources = sources.filter(
      (source, idx) => deviations[idx] <= avgDeviation * 2
    );

    // Calculate weighted average based on source reliability
    const weightedSum = filteredSources.reduce(
      (sum, source) => sum + source.price * source.reliabilityScore,
      0
    );
    const totalWeight = filteredSources.reduce(
      (sum, source) => sum + source.reliabilityScore,
      0
    );
    const weightedPrice = weightedSum / totalWeight;

    // Calculate confidence score
    const confidence = Math.min(
      0.95, // Cap at 0.95 to never have 100% confidence
      (filteredSources.length / sources.length) * (1 - avgDeviation * 5)
    );

    // Determine final price based on confidence
    const finalPrice = confidence > 0.7 ? weightedPrice : medianPrice;

    // Store result in database
    const aggregatedPrice = {
      timestamp: Date.now(),
      price: finalPrice,
      confidence,
      sourceCount: filteredSources.length,
      totalSources: sources.length,
      deviation: avgDeviation,
      sources: filteredSources.map((s) => s.source),
    };

    await db.insert("priceHistory", aggregatedPrice);

    return aggregatedPrice;
  }
);
```

The aggregation engine should implement:

- Outlier detection and filtering
- Weighted average calculation
- Confidence scoring
- Fallback mechanisms for insufficient data

### 2.3 Historical Data Store

Define schema for historical price data storage:

```typescript
// price_history.ts
export interface PriceRecord {
  _id?: Id<"priceHistory">;
  timestamp: number;
  price: number;
  confidence: number;
  sourceCount: number;
  totalSources: number;
  deviation: number;
  sources: string[];
  volatility?: number;
  twap?: number;
}

// In schema.ts
export default defineSchema({
  priceHistory: defineTable({
    timestamp: v.number(),
    price: v.number(),
    confidence: v.number(),
    sourceCount: v.number(),
    totalSources: v.number(),
    deviation: v.number(),
    sources: v.array(v.string()),
    volatility: v.optional(v.number()),
    twap: v.optional(v.number()),
  }).index("by_timestamp", ["timestamp"]),

  sourceReliability: defineTable({
    source: v.string(),
    reliabilityScore: v.number(),
    successRate: v.number(),
    avgLatency: v.number(),
    lastUpdated: v.number(),
  }).index("by_source", ["source"]),

  volatilityHistory: defineTable({
    timestamp: v.number(),
    window: v.string(), // e.g., "1d", "7d", "30d"
    value: v.number(),
    sampleSize: v.number(),
  }).index("by_timestamp_window", ["timestamp", "window"]),
});
```

### 2.4 Derived Metrics Calculation

Implement functions to calculate important metrics from price history:

```typescript
// Calculate historical volatility
export const calculateVolatility = action(
  async ({ db }, windowDays: number = 30): Promise<number> => {
    const msPerDay = 86400000;
    const now = Date.now();
    const startTime = now - windowDays * msPerDay;

    // Get daily closing prices for the window
    const dailyPrices: number[] = [];

    // For a proper implementation, we would get one price per day at a specific time
    const priceRecords = await db
      .query("priceHistory")
      .filter((q) => q.gte(q.field("timestamp"), startTime))
      .filter((q) => q.gte(q.field("confidence"), 0.7))
      .order("desc")
      .collect();

    // Group by day and take the last record of each day
    const pricesByDay = new Map<string, number>();

    for (const record of priceRecords) {
      const date = new Date(record.timestamp).toISOString().split("T")[0];
      if (!pricesByDay.has(date)) {
        pricesByDay.set(date, record.price);
      }
    }

    // Convert to array of daily prices
    for (const price of pricesByDay.values()) {
      dailyPrices.push(price);
    }

    if (dailyPrices.length < 2) {
      throw new Error("Insufficient data for volatility calculation");
    }

    // Calculate returns: [ln(price_t / price_t-1)]
    const returns: number[] = [];
    for (let i = 1; i < dailyPrices.length; i++) {
      returns.push(Math.log(dailyPrices[i] / dailyPrices[i - 1]));
    }

    // Calculate standard deviation of returns
    const mean =
      returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const squaredDiffs = returns.map((value) => Math.pow(value - mean, 2));
    const variance =
      squaredDiffs.reduce((sum, value) => sum + value, 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Annualize: multiply by sqrt(365)
    const annualizedVolatility = stdDev * Math.sqrt(365);

    // Store in volatility history
    await db.insert("volatilityHistory", {
      timestamp: now,
      window: `${windowDays}d`,
      value: annualizedVolatility,
      sampleSize: returns.length,
    });

    return annualizedVolatility;
  }
);

// Calculate TWAP (Time-Weighted Average Price)
export const calculateTWAP = query(
  async ({ db }, hours: number = 24): Promise<number> => {
    const now = Date.now();
    const startTime = now - hours * 3600000;

    const prices = await db
      .query("priceHistory")
      .filter((q) => q.gte(q.field("timestamp"), startTime))
      .filter((q) => q.gte(q.field("confidence"), 0.7))
      .order("asc")
      .collect();

    if (prices.length < 2) {
      throw new Error("Insufficient data for TWAP calculation");
    }

    let twapSum = 0;
    let totalTime = 0;

    // Calculate time-weighted sum
    for (let i = 1; i < prices.length; i++) {
      const timeDelta = prices[i].timestamp - prices[i - 1].timestamp;
      const avgPrice = (prices[i].price + prices[i - 1].price) / 2;

      twapSum += avgPrice * timeDelta;
      totalTime += timeDelta;
    }

    // Divide by total time
    const twap =
      totalTime > 0 ? twapSum / totalTime : prices[prices.length - 1].price;

    return twap;
  }
);
```

### 2.5 Blockchain Integration

Build components for submitting price data to on-chain Oracle:

```typescript
// Update on-chain oracle with latest aggregated price
export const updateOracleOnChain = action(
  async ({ db, scheduler }, priceId: Id<"priceHistory">) => {
    try {
      // Get the price record
      const priceRecord = await db.get(priceId);
      if (!priceRecord) {
        throw new Error(`Price record ${priceId} not found`);
      }

      // Only update on-chain if confidence is high enough
      if (priceRecord.confidence < 0.8) {
        console.log(
          `Skipping on-chain update due to low confidence: ${priceRecord.confidence}`
        );
        return { success: false, reason: "low_confidence" };
      }

      // Prepare transaction to update on-chain oracle
      // This would use a Stacks API client or similar
      const txResult = await submitOracleUpdate({
        price: Math.round(priceRecord.price * 1_000_000), // Convert to micro-units
        timestamp: priceRecord.timestamp,
        confidence: Math.round(priceRecord.confidence * 1_000_000),
        sourceCount: priceRecord.sourceCount,
      });

      // Record transaction in database
      await db.insert("oracleTransactions", {
        priceId,
        txId: txResult.txId,
        status: "pending",
        timestamp: Date.now(),
      });

      // Schedule job to check transaction status
      await scheduler.runAfter(
        60_000, // 1 minute
        "checkTransactionStatus",
        { txId: txResult.txId }
      );

      return { success: true, txId: txResult.txId };
    } catch (error) {
      console.error("Failed to update on-chain oracle:", error);

      // Schedule retry with backoff
      await scheduler.runAfter(
        300_000, // 5 minutes
        "updateOracleOnChain",
        { priceId }
      );

      return { success: false, error: error.message };
    }
  }
);
```

## 3. Scheduled Jobs

Implement scheduled jobs for data collection and processing:

```typescript
// Scheduled job to collect prices from all sources
export const collectLatestPrices = action(async ({ runQuery, runMutation }) => {
  try {
    // Collect prices from all sources in parallel
    const [binance, coinbase, kraken, gemini, bitfinex] = await Promise.all([
      runQuery(binancePriceFeed),
      runQuery(coinbasePriceFeed),
      runQuery(krakenPriceFeed),
      runQuery(geminiPriceFeed),
      runQuery(bitfinexPriceFeed),
    ]);

    // Filter out any failed sources (will be undefined)
    const validSources = [binance, coinbase, kraken, gemini, bitfinex].filter(
      Boolean
    );

    // Aggregate prices
    const aggregated = await runMutation(aggregatePrices, validSources);

    // Update derived metrics if needed
    if (shouldUpdateMetrics()) {
      await runAction(calculateVolatility, 30); // 30-day volatility
      await runAction(calculateVolatility, 7); // 7-day volatility
    }

    // Determine if on-chain update is needed
    if (shouldUpdateOnChain(aggregated)) {
      await runAction(updateOracleOnChain, aggregated._id);
    }

    return { success: true, price: aggregated.price };
  } catch (error) {
    console.error("Price collection failed:", error);
    return { success: false, error: error.message };
  }
});

// Helper to determine if metrics should be updated
function shouldUpdateMetrics() {
  // Update volatility every hour
  const now = new Date();
  return now.getMinutes() < 5; // First 5 minutes of each hour
}

// Helper to determine if on-chain update is needed
function shouldUpdateOnChain(aggregated: AggregatedPrice) {
  return aggregated.confidence > 0.8 && aggregated.sourceCount >= 3;
}
```

## 4. Error Handling & Fallback Mechanisms

Implement robust error handling and fallback strategies:

```typescript
// Example error handling for price feeds
export const getFallbackPrice = query(async ({ db }) => {
  try {
    // Try to get most recent high-confidence price
    const recentPrice = await db
      .query("priceHistory")
      .filter((q) => q.gte(q.field("confidence"), 0.8))
      .order("desc")
      .first();

    if (recentPrice) {
      return recentPrice;
    }

    // If no recent high-confidence price, get median of last 10 records
    const last10 = await db
      .query("priceHistory")
      .order("desc")
      .take(10)
      .collect();

    if (last10.length > 0) {
      const prices = last10.map((record) => record.price);
      const sortedPrices = [...prices].sort((a, b) => a - b);
      const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];

      return {
        price: medianPrice,
        timestamp: Date.now(),
        confidence: 0.5, // Lower confidence for fallback
        sourceCount: 0,
        totalSources: 0,
        deviation: 0,
        sources: ["fallback"],
      };
    }

    // Last resort: Use hardcoded fallback
    return {
      price: 40000, // Example fallback price
      timestamp: Date.now(),
      confidence: 0.2, // Very low confidence
      sourceCount: 0,
      totalSources: 0,
      deviation: 0,
      sources: ["hardcoded_fallback"],
    };
  } catch (error) {
    console.error("Fallback price mechanism failed:", error);
    throw error;
  }
});
```

## 5. Monitoring & Alerting

Implement monitoring endpoints for system health:

```typescript
// Health check endpoint
export const getOracleHealth = query(async ({ db }) => {
  const now = Date.now();
  const fiveMinutesAgo = now - 300000;

  // Check recent price data
  const recentPrices = await db
    .query("priceHistory")
    .filter((q) => q.gte(q.field("timestamp"), fiveMinutesAgo))
    .collect();

  // Check source reliability
  const sourceReliability = await db.query("sourceReliability").collect();

  // Check on-chain sync status
  const lastOnChainUpdate = await db
    .query("oracleTransactions")
    .filter((q) => q.eq(q.field("status"), "confirmed"))
    .order("desc")
    .first();

  const health = {
    status: "healthy",
    lastUpdateTimestamp:
      recentPrices.length > 0 ? recentPrices[0].timestamp : null,
    priceUpdateFrequency: recentPrices.length,
    activeSources: sourceReliability
      .filter((s) => s.reliabilityScore > 0.5)
      .map((s) => s.source),
    lastOnChainUpdateTimestamp: lastOnChainUpdate?.timestamp || null,
    warnings: [],
  };

  // Add warnings if needed
  if (recentPrices.length === 0) {
    health.status = "degraded";
    health.warnings.push("No recent price updates");
  }

  if (health.activeSources.length < 3) {
    health.status = "degraded";
    health.warnings.push("Insufficient active price sources");
  }

  if (!lastOnChainUpdate || lastOnChainUpdate.timestamp < now - 3600000) {
    health.warnings.push("On-chain oracle not updated recently");
  }

  return health;
});
```

## 6. Security Considerations

### 6.1 Authentication & Authorization

- Use Convex authentication with wallet integration for admin functions
- Implement role-based access control for sensitive operations
- Require multi-sig approval for critical parameter changes

### 6.2 Rate Limiting & DOS Prevention

- Implement rate limiting for public endpoints
- Use Convex's built-in rate limiting features
- Design defensive API patterns

### 6.3 Secure Key Management

- Never store private keys in code or Convex database
- Use environment variables or secure secret storage
- Rotate API keys regularly

## 7. Testing & QA

Implement comprehensive testing:

```typescript
// Example test structure for price aggregation
describe("Price Aggregation", () => {
  test("successfully aggregates valid price sources", async () => {
    const mockSources = [
      {
        source: "binance",
        price: 40000,
        timestamp: Date.now(),
        lastUpdated: Date.now(),
        reliabilityScore: 0.95,
      },
      {
        source: "coinbase",
        price: 40100,
        timestamp: Date.now(),
        lastUpdated: Date.now(),
        reliabilityScore: 0.9,
      },
      {
        source: "kraken",
        price: 39900,
        timestamp: Date.now(),
        lastUpdated: Date.now(),
        reliabilityScore: 0.92,
      },
    ];

    const result = await runMutation(aggregatePrices, mockSources);

    expect(result.price).toBeGreaterThan(39900);
    expect(result.price).toBeLessThan(40100);
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.sourceCount).toBe(3);
  });

  test("correctly filters outliers", async () => {
    const mockSources = [
      {
        source: "binance",
        price: 40000,
        timestamp: Date.now(),
        lastUpdated: Date.now(),
        reliabilityScore: 0.95,
      },
      {
        source: "coinbase",
        price: 40100,
        timestamp: Date.now(),
        lastUpdated: Date.now(),
        reliabilityScore: 0.9,
      },
      {
        source: "kraken",
        price: 39900,
        timestamp: Date.now(),
        lastUpdated: Date.now(),
        reliabilityScore: 0.92,
      },
      {
        source: "outlier",
        price: 45000,
        timestamp: Date.now(),
        lastUpdated: Date.now(),
        reliabilityScore: 0.7,
      },
    ];

    const result = await runMutation(aggregatePrices, mockSources);

    expect(result.sourceCount).toBe(3); // The outlier is filtered out
    expect(result.price).toBeGreaterThan(39900);
    expect(result.price).toBeLessThan(40100);
  });
});
```

## 8. Deployment Guidelines

### 8.1 Environment Setup

- Create separate development, staging, and production environments
- Use environment variables for configuration
- Set up CI/CD pipeline for deployments

### 8.2 Monitoring & Logging

- Implement comprehensive logging
- Set up monitoring dashboards
- Configure alerts for critical events

## 9. Maintenance & Operations

### 9.1 Regular Tasks

- Monitor source reliability daily
- Validate aggregation quality weekly
- Review and optimize performance monthly

### 9.2 Emergency Procedures

- Define response procedures for price feed outages
- Create circuit breaker triggers for extreme price movements
- Establish communication protocols for critical issues

## 10. Conclusion

By following these implementation guidelines, the BitHedge Oracle system on Convex will provide reliable, secure, and efficient price data for the entire BitHedge platform.
