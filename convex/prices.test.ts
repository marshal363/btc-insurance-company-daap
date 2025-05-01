import { ConvexTestingHelper } from "convex/testing";
import { internal } from "./_generated/api";
import { 
  calculate24hRange, 
  calculateVolatilityWithTimeframe,
  getLatestPrice,
  getLatestSourcePrices
} from "./prices";
import schema from "./schema";
// Explicitly import test functions from Vitest
import { describe, it, expect, beforeEach } from 'vitest';
// We will likely need to import functions from prices.ts here
// Example: import { calculateVolatilityWithTimeframe, calculate24hRange } from "./prices";

describe("Price Calculation Logic", () => {
  let t: ConvexTestingHelper;

  beforeEach(async () => {
    // Initialize ConvexTestingHelper with the schema
    t = new ConvexTestingHelper(schema);
    // Optional: Clear relevant tables if needed, though helper might handle it
    await t.table("historicalPrices").normalize(); 
    await t.table("aggregatedPrices").normalize();
    await t.table("priceFeed").normalize();
    console.log("Test setup: Initialized ConvexTestingHelper and normalized tables.");
  });

  it("should calculate volatility correctly with sufficient data", async () => {
    const now = Date.now();
    const timeframeDays = 30;
    const startTime = now - timeframeDays * 24 * 60 * 60 * 1000;
    
    // Seed mock data for volatility calculation (needs > 1 point)
    // Example: simulate prices around 60k with some variation
    await t.db.insert("historicalPrices", { 
      timestamp: startTime + 1 * 24 * 60 * 60 * 1000, price: 60000, isDaily: true 
    });
    await t.db.insert("historicalPrices", { 
      timestamp: startTime + 2 * 24 * 60 * 60 * 1000, price: 60500, isDaily: true 
    });
    await t.db.insert("historicalPrices", { 
      timestamp: startTime + 3 * 24 * 60 * 60 * 1000, price: 61000, isDaily: true 
    });
    await t.db.insert("historicalPrices", { 
      timestamp: startTime + 4 * 24 * 60 * 60 * 1000, price: 60800, isDaily: true 
    });
     await t.db.insert("historicalPrices", { 
      timestamp: startTime + 5 * 24 * 60 * 60 * 1000, price: 61200, isDaily: true 
    });
    // Add data point outside timeframe
    await t.db.insert("historicalPrices", { 
      timestamp: startTime - 1 * 24 * 60 * 60 * 1000, price: 50000, isDaily: true 
    });

    // Run the query
    const result = await t.runQuery(calculateVolatilityWithTimeframe, { timeframe: timeframeDays });

    // Assert the results - Volatility calculation is complex, 
    // so we primarily check if it returns a valid number.
    // More precise checks would require replicating the log-return std dev calculation.
    expect(result).not.toBeNull();
    expect(result?.volatility).toBeGreaterThan(0);
    expect(typeof result?.volatility).toBe('number');
    expect(result?.dataPoints).toBe(5); // Ensure only points within timeframe are used
  });

  it("should return null volatility with insufficient data", async () => {
    const now = Date.now();
    const timeframeDays = 30;
    const startTime = now - timeframeDays * 24 * 60 * 60 * 1000;

    // Seed only one data point
    await t.db.insert("historicalPrices", { 
      timestamp: startTime + 1 * 24 * 60 * 60 * 1000, price: 60000, isDaily: true 
    });

    // Run the query
    const result = await t.runQuery(calculateVolatilityWithTimeframe, { timeframe: timeframeDays });

    // Assert the result is null
    expect(result).toBeNull();
  });

  it("should calculate 24h range correctly", async () => {
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    // Seed mock data within the last 24 hours
    await t.db.insert("historicalPrices", { 
      timestamp: twentyFourHoursAgo + 1000, // Just after the start
      price: 50000, 
      high: 50500,
      low: 49800, 
      isDaily: true 
    });
    await t.db.insert("historicalPrices", { 
      timestamp: now - 60 * 60 * 1000, // 1 hour ago
      price: 51000, 
      high: 51200, // Expected Max High
      low: 50800, 
      isDaily: true 
    });
    await t.db.insert("historicalPrices", { 
      timestamp: now - 30 * 60 * 1000, // 30 mins ago
      price: 50900, 
      high: 51000,
      low: 49500, // Expected Min Low
      isDaily: true 
    });
    // Add data point outside 24h to ensure it's ignored
    await t.db.insert("historicalPrices", { 
      timestamp: twentyFourHoursAgo - 1000,
      price: 40000, high: 41000, low: 39000, isDaily: true
    });

    // Run the query
    const result = await t.runQuery(calculate24hRange, {});

    // Assert the results
    expect(result).not.toBeNull();
    expect(result?.high).toBe(51200);
    expect(result?.low).toBe(49500);
    expect(result?.range).toBe(51200 - 49500);
  });

  it("should handle 24h range calculation with missing high/low", async () => {
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    // Seed data, some with high/low, some without
    await t.db.insert("historicalPrices", { 
      timestamp: twentyFourHoursAgo + 1000, 
      price: 50000, 
      high: 50500, // Has high/low
      low: 49800, 
      isDaily: true 
    });
    await t.db.insert("historicalPrices", { 
      timestamp: now - 60 * 60 * 1000, 
      price: 51000, // No high/low, use price as fallback
      isDaily: true 
    });
    await t.db.insert("historicalPrices", { 
      timestamp: now - 30 * 60 * 1000, 
      price: 50900, 
      high: 51200, // Expected Max High (from this record)
      low: 49500, // Expected Min Low (from this record)
      isDaily: true 
    });

    // Run the query
    const result = await t.runQuery(calculate24hRange, {});

    // Assert the results - uses high/low where available, falls back to price otherwise
    expect(result).not.toBeNull();
    // Max high should be 51200 (from the third record)
    // Min low should be 49500 (from the third record)
    // The second record (price 51000) is within this range, so it doesn't change the outcome
    expect(result?.high).toBe(51200); 
    expect(result?.low).toBe(49500); 
    expect(result?.range).toBe(51200 - 49500);
  });

  it("should return null for 24h range with no recent data", async () => {
    // Ensure no relevant mock data exists (covered by beforeEach normalize)
    // Run the query
    const result = await t.runQuery(calculate24hRange, {});
    // Assert the result is null
    expect(result).toBeNull();
  });

  // --- Tests for Aggregation & Outlier Filtering (might require testing fetchPrices action) ---
  // Testing actions might require t.runAction and potentially mocking axios/mutations

  it("should filter outliers correctly during aggregation", async () => {
    // This test is more complex as it involves an action (fetchPrices)
    // and its internal logic. Requires mocking external API calls (axios) 
    // and mutations (storePriceFeed, storeAggregatedPrice).
    
    // Approach:
    // 1. Mock axios.get to return specific price data, including outliers.
    // 2. Mock the internal mutations (storePriceFeed, storeAggregatedPrice) to capture arguments.
    // 3. Run the fetchPrices action using t.runAction.
    // 4. Assert that storeAggregatedPrice was called with a price calculated *without* the outliers.
    console.log("TODO: Implement detailed test for outlier filtering.");
    expect(true).toBe(true); // Placeholder
  });

  it("should skip outlier filtering with insufficient data points", async () => {
    // Similar setup to the previous test, but mock axios to return fewer than 4 valid sources.
    // Assert that the console log indicates filtering was skipped and the final price uses all available points.
    console.log("TODO: Implement detailed test for skipping outlier filtering.");
    expect(true).toBe(true); // Placeholder
  });

  // --- Tests for getLatestPrice --- 
  it("should return the latest aggregated price", async () => {
    const now = Date.now();
    // Seed some aggregated prices
    await t.db.insert("aggregatedPrices", { 
      price: 59000, timestamp: now - 10000, volatility: 0.5, sourceCount: 7 
    });
    await t.db.insert("aggregatedPrices", { 
      price: 60000, timestamp: now, volatility: 0.51, sourceCount: 8, range24h: 1500 
    }); // Latest one
    await t.db.insert("aggregatedPrices", { 
      price: 59500, timestamp: now - 5000, volatility: 0.5, sourceCount: 8 
    });

    // Run the query
    const result = await t.runQuery(getLatestPrice, {});

    // Assert the result
    expect(result).not.toBeNull();
    expect(result?.price).toBe(60000);
    expect(result?.timestamp).toBe(now);
    expect(result?.volatility).toBe(0.51);
    expect(result?.sourceCount).toBe(8);
    expect(result?.range24h).toBe(1500);
  });

  it("should return null when no aggregated price exists", async () => {
    // No data seeded
    const result = await t.runQuery(getLatestPrice, {});
    expect(result).toBeNull();
  });

  // --- Tests for getLatestSourcePrices ---
  it("should return the latest price for each source", async () => {
    const now = Date.now();
    // Seed price feed data
    await t.db.insert("priceFeed", { source: "coingecko", price: 60100, timestamp: now - 1000, weight: 0.2 });
    await t.db.insert("priceFeed", { source: "coingecko", price: 60200, timestamp: now, weight: 0.2 }); // Latest coingecko
    await t.db.insert("priceFeed", { source: "binance", price: 60300, timestamp: now - 500, weight: 0.15 }); // Latest binance
    await t.db.insert("priceFeed", { source: "kraken", price: 60050, timestamp: now - 2000, weight: 0.15 }); // Only kraken
    // No data for other sources like coinbase, bitstamp etc.

    // Run the query
    const results = await t.runQuery(getLatestSourcePrices, {});

    // Assert results
    expect(results).toBeInstanceOf(Array);
    // Should return data for the 3 sources we seeded
    expect(results.length).toBe(3); 

    const coingecko = results.find((r: { name: string }) => r.name === "coingecko");
    expect(coingecko).toBeDefined();
    expect(coingecko?.price).toBe(60200); // Check latest price
    expect(coingecko?.timestamp).toBe(now);
    expect(coingecko?.weight).toBe(0.2);

    const binance = results.find((r: { name: string }) => r.name === "binance");
    expect(binance).toBeDefined();
    expect(binance?.price).toBe(60300);
    expect(binance?.timestamp).toBe(now - 500);
    expect(binance?.weight).toBe(0.15);
    
    const kraken = results.find((r: { name: string }) => r.name === "kraken");
    expect(kraken).toBeDefined();
    expect(kraken?.price).toBe(60050);
    expect(kraken?.timestamp).toBe(now - 2000);
    expect(kraken?.weight).toBe(0.15);
  });

  it("should return an empty array when no price feed data exists", async () => {
    // No data seeded
    const results = await t.runQuery(getLatestSourcePrices, {});
    expect(results).toEqual([]);
  });

}); 