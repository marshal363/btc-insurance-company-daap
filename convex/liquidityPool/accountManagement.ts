import { action, internalQuery, internalMutation, query } from "../_generated/server";
import { v } from "convex/values";
import { internal, api } from "../_generated/api";
import { Doc } from "../_generated/dataModel";
import { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

// TODO: Define any specific types/interfaces related to account management here
// e.g., ProviderPreferences, RegistrationResult etc.

// Functions will be added here based on Step 4.1 of the refactoring plan. 

// Helper internal query to check if a provider has any balance records
export const checkProviderHasActivity = internalQuery({
  args: { provider: v.string() },
  handler: async (ctx, args): Promise<boolean> => {
    const balanceRecord = await ctx.db
      .query("provider_balances")
      .withIndex("by_provider", q => q.eq("provider", args.provider))
      .first(); // Check if at least one record exists
    return balanceRecord !== null;
  },
});

export interface RegisterLiquidityProviderResult {
  success: boolean;
  message: string;
  isNewRegistration?: boolean; // True if this was effectively their first "registration" type action
  provider?: string;
}

export const registerLiquidityProvider = action({
  args: {},
  handler: async (ctx, args): Promise<RegisterLiquidityProviderResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.tokenIdentifier) {
      return { success: false, message: "Authentication required to register as a liquidity provider." };
    }
    const providerPrincipal = identity.tokenIdentifier;

    console.log(`Registering liquidity provider: ${providerPrincipal}`);

    const hasActivity = await ctx.runQuery(internal.liquidityPool.accountManagement.checkProviderHasActivity, {
      provider: providerPrincipal,
    });

    if (hasActivity) {
      return {
        success: true,
        message: "Provider is already known (has existing activity/balances).",
        isNewRegistration: false,
        provider: providerPrincipal,
      };
    }

    // At this point, the provider has no activity in provider_balances.
    // If there was a dedicated 'providers' table, we would add them here.
    // For now, this action acknowledges their intent.
    // Future: Could create an entry in a 'providers' table here if desired.
    // e.g., await ctx.runMutation(internal.liquidityPool.accountManagement.createProviderRecord, { provider: providerPrincipal });

    return {
      success: true,
      message: "Liquidity provider registration intent acknowledged. You can now commit capital.",
      isNewRegistration: true,
      provider: providerPrincipal,
    };
  },
});

// Define the structure of preferences for clarity and type safety
// This should align with the fields in the (to-be-created) provider_preferences table schema
export const providerPreferenceFields = {
  riskTierComfort: v.optional(v.string()), // e.g., "conservative", "balanced", "aggressive"
  notificationSettings: v.optional(v.object({
    emailOnSettlement: v.optional(v.boolean()),
    emailOnNewPolicyAllocated: v.optional(v.boolean()),
    // Add other notification flags as needed
  })),
  autoReinvestPremiums: v.optional(v.boolean()),
  // Add other preference fields here
};

// Internal mutation to save/update provider preferences
// Assumes a 'provider_preferences' table exists with an index on 'provider'
export const saveProviderPreferences = internalMutation({
  args: {
    provider: v.string(),
    preferencesToUpdate: v.object(providerPreferenceFields), // Pass only the fields to be updated
  },
  handler: async (ctx, args) => {
    const existingPreferences = await ctx.db
      .query("provider_preferences") // Target new table
      .withIndex("by_provider", q => q.eq("provider", args.provider))
      .unique();

    const updates = { ...args.preferencesToUpdate, lastUpdated: Date.now() };

    if (existingPreferences) {
      await ctx.db.patch(existingPreferences._id, updates);
      console.log(`Updated preferences for provider: ${args.provider}`);
      return await ctx.db.get(existingPreferences._id);
    } else {
      const newPrefsId = await ctx.db.insert("provider_preferences", {
        provider: args.provider,
        ...updates,
      });
      console.log(`Created new preferences for provider: ${args.provider}`);
      return await ctx.db.get(newPrefsId);
    }
  },
});

export interface UpdateProviderPreferencesResult {
  success: boolean;
  message: string;
  updatedPreferences?: Doc<"provider_preferences"> | null;
}

export const updateProviderPreferences = action({
  args: providerPreferenceFields, // Reuse the fields definition for action arguments
  handler: async (ctx, preferencesToUpdate): Promise<UpdateProviderPreferencesResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.tokenIdentifier) {
      return { success: false, message: "Authentication required." };
    }
    const providerPrincipal = identity.tokenIdentifier;

    console.log(`Updating preferences for provider: ${providerPrincipal}`);

    if (Object.keys(preferencesToUpdate).length === 0) {
        return { success: false, message: "No preferences provided to update." };
    }

    try {
      const updatedPreferencesDoc = await ctx.runMutation(internal.liquidityPool.accountManagement.saveProviderPreferences, {
        provider: providerPrincipal,
        preferencesToUpdate: preferencesToUpdate,
      });

      if (!updatedPreferencesDoc) {
        return { success: false, message: "Failed to save preferences." }; 
      }

      return {
        success: true,
        message: "Provider preferences updated successfully.",
        updatedPreferences: updatedPreferencesDoc,
      };
    } catch (error: any) {
      console.error(`Error updating provider preferences for ${providerPrincipal}:`, error);
      return { success: false, message: `Error updating preferences: ${error.message}` };
    }
  },
});

// Internal query to fetch preferences for a specific provider
export const fetchProviderPreferences = internalQuery({
  args: { provider: v.string() },
  handler: async (ctx, args): Promise<Doc<"provider_preferences"> | null> => {
    return await ctx.db
      .query("provider_preferences")
      .withIndex("by_provider", q => q.eq("provider", args.provider))
      .unique();
  },
});

export interface GetProviderPreferencesResult {
  success: boolean;
  message?: string; // Optional message, e.g., if no preferences found
  preferences: Doc<"provider_preferences"> | null;
}

export const getProviderPreferences = query({
  args: {},
  handler: async (ctx, args): Promise<GetProviderPreferencesResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.tokenIdentifier) {
      return { success: false, message: "Authentication required.", preferences: null };
    }
    const providerPrincipal = identity.tokenIdentifier;

    console.log(`Fetching preferences for provider: ${providerPrincipal}`);

    const preferencesDoc = await ctx.runQuery(internal.liquidityPool.accountManagement.fetchProviderPreferences, {
      provider: providerPrincipal,
    });

    if (!preferencesDoc) {
      return {
        success: true, // Success in fetching, but no data
        message: "No preferences found for this provider.",
        preferences: null,
      };
    }

    return {
      success: true,
      preferences: preferencesDoc,
    };
  },
}); 