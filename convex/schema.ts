import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Price History Table - For storing historical BTC price data
  priceHistory: defineTable({
    timestamp: v.number(), // Unix timestamp in milliseconds
    price: v.number(), // Price in USD
    confidence: v.number(), // Confidence score (0-1)
    sourceCount: v.number(), // Number of sources used
    totalSources: v.number(), // Total number of sources available
    deviation: v.number(), // Average deviation from median
    sources: v.array(v.string()), // List of source names used
    volatility: v.optional(v.number()), // Optional calculated volatility
    twap: v.optional(v.number()), // Optional time-weighted average price
  }).index("by_timestamp", ["timestamp"]),

  // Source Reliability Table - For tracking source reliability metrics
  sourceReliability: defineTable({
    source: v.string(), // Name of the exchange/API
    reliabilityScore: v.number(), // Dynamic score (0-1)
    successRate: v.number(), // Percentage of successful requests
    avgLatency: v.number(), // Average response time in ms
    lastUpdated: v.number(), // When metrics were last updated
  }).index("by_source", ["source"]),

  // Volatility History Table - For storing volatility calculations
  volatilityHistory: defineTable({
    timestamp: v.number(), // When volatility was calculated
    window: v.string(), // Time window (e.g., "1d", "7d", "30d")
    value: v.number(), // Calculated volatility value
    sampleSize: v.number(), // Number of data points used
  }).index("by_timestamp_window", ["timestamp", "window"]),

  // Oracle Transactions Table - For tracking on-chain oracle updates
  oracleTransactions: defineTable({
    priceId: v.id("priceHistory"), // Reference to price record
    txId: v.string(), // Blockchain transaction ID
    status: v.string(), // "pending", "confirmed", "failed"
    timestamp: v.number(), // When transaction was initiated
    confirmationTime: v.optional(v.number()), // When transaction was confirmed
    error: v.optional(v.string()), // Error message if failed
  }).index("by_status", ["status"]).index("by_timestamp", ["timestamp"]),

  // Parameters Table - For configurable system parameters
  parameters: defineTable({
    key: v.string(), // Parameter key
    value: v.any(), // Parameter value (can be any type)
    description: v.string(), // Description of the parameter
    lastUpdated: v.number(), // When parameter was last updated
    updatedBy: v.optional(v.string()), // Who updated the parameter
  }).index("by_key", ["key"]),
}); 