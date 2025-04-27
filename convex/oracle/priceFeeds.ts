import { query } from "../_generated/server";

// Define the PriceSource type
export type PriceSource = {
  source: string; // Name of the exchange/API
  price: number; // Price in USD
  timestamp: number; // Unix timestamp in milliseconds
  volume24h?: number; // Optional 24h volume information
  lastUpdated: number; // When this data was last fetched
  reliabilityScore: number; // Dynamic score based on historical reliability
};

// Default reliability score for new or reset sources
const DEFAULT_RELIABILITY = 0.95;

// Binance price feed connector
export const binancePriceFeed = query({
  args: {},
  handler: async (ctx) => {
    try {
      // Create a mock price until HTTP is properly configured
      const price = 42000 + (Math.random() * 1000 - 500); // Mock BTC price ~$42K with variation
      
      // Get reliability score from database
      const reliabilityRecord = await ctx.db
        .query("sourceReliability")
        .withIndex("by_source", (q) => q.eq("source", "binance"))
        .first();

      return {
        source: "binance",
        price: price,
        timestamp: Date.now(),
        volume24h: 1000, // Mock volume
        lastUpdated: Date.now(),
        reliabilityScore: reliabilityRecord?.reliabilityScore || DEFAULT_RELIABILITY,
      } as PriceSource;
    } catch (error) {
      console.error("Binance feed error:", error);
      if (error instanceof Error) {
        throw new Error(`Binance feed error: ${error.message}`);
      }
      throw new Error("Binance feed error: Unknown error");
    }
  }
});

// Coinbase price feed connector
export const coinbasePriceFeed = query({
  args: {},
  handler: async (ctx) => {
    try {
      // Create a mock price until HTTP is properly configured
      const price = 41800 + (Math.random() * 1000 - 500); // Mock BTC price ~$41.8K with variation
      
      // Get reliability score from database
      const reliabilityRecord = await ctx.db
        .query("sourceReliability")
        .withIndex("by_source", (q) => q.eq("source", "coinbase"))
        .first();

      return {
        source: "coinbase",
        price: price,
        timestamp: Date.now(),
        lastUpdated: Date.now(),
        reliabilityScore: reliabilityRecord?.reliabilityScore || DEFAULT_RELIABILITY,
      } as PriceSource;
    } catch (error) {
      console.error("Coinbase feed error:", error);
      if (error instanceof Error) {
        throw new Error(`Coinbase feed error: ${error.message}`);
      }
      throw new Error("Coinbase feed error: Unknown error");
    }
  }
});

// Kraken price feed connector
export const krakenPriceFeed = query({
  args: {},
  handler: async (ctx) => {
    try {
      // Create a mock price until HTTP is properly configured
      const price = 42100 + (Math.random() * 1000 - 500); // Mock BTC price ~$42.1K with variation
      
      // Get reliability score from database
      const reliabilityRecord = await ctx.db
        .query("sourceReliability")
        .withIndex("by_source", (q) => q.eq("source", "kraken"))
        .first();

      return {
        source: "kraken",
        price: price,
        timestamp: Date.now(),
        volume24h: 800, // Mock volume
        lastUpdated: Date.now(),
        reliabilityScore: reliabilityRecord?.reliabilityScore || DEFAULT_RELIABILITY,
      } as PriceSource;
    } catch (error) {
      console.error("Kraken feed error:", error);
      if (error instanceof Error) {
        throw new Error(`Kraken feed error: ${error.message}`);
      }
      throw new Error("Kraken feed error: Unknown error");
    }
  }
});

// Helper function to get a mock price (for testing purposes)
export const mockPriceFeed = query({
  args: {},
  handler: async (ctx) => {
    const basePrice = 45000;
    // Randomize slightly to simulate market movement
    const variance = Math.random() * 1000 - 500; // +/- $500
    
    return {
      source: "mock",
      price: basePrice + variance,
      timestamp: Date.now(),
      lastUpdated: Date.now(),
      reliabilityScore: 0.5, // Lower reliability for mock data
    } as PriceSource;
  }
}); 