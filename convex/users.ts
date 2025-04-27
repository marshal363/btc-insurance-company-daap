import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    // Using a constant ID since auth is removed
    const userId = "system";
    
    // Look up the user profile or return a default
    const user = await ctx.db.query("users")
      .filter(q => q.eq(q.field("name"), userId))
      .first();
      
    return user || { name: userId };
  },
});

export const createUser = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      lastLogin: Date.now()
    });
  }
});
