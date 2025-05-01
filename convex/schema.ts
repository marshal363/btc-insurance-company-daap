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
  })
});
