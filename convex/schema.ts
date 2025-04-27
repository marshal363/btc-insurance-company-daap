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
  }).index("by_timestamp", ["timestamp"]),
  
  historicalVolatility: defineTable({
    period: v.number(),
    volatility: v.number(),
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]),
  
  aggregatedPrices: defineTable({
    price: v.number(),
    timestamp: v.number(),
    volatility: v.number(),
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
