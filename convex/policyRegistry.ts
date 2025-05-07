import { query, mutation, action } from "./_generated/server"; // Basic Convex imports
import { v } from "convex/values"; // Validator import
import { Id, Doc } from "./_generated/dataModel"; // Data model types
import { internal, api } from "./_generated/api"; // API and internal functions access

// Utilities that might have been used by original top-level functions or are general
import { calculateBlackScholesPremium } from "./premium"; 
import { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

// Re-export public-facing functions from their new modules
// No need to import types here since we're re-exporting from modules that already have them

// From queries.ts
export { getPolicy, getPoliciesForUser, getPoliciesForCounterparty, getPolicyEvents } from "./policyRegistry/queries";

// From transactionManager.ts
export { updateTransactionStatusPublic } from "./policyRegistry/transactionManager";

// From eligibilityChecks.ts
export { checkPolicyActivationEligibility } from "./policyRegistry/eligibilityChecks";

// From policyLifecycle.ts
export { requestPolicyCreation } from "./policyRegistry/policyLifecycle";

// From counterpartyOperations.ts
export { getCounterpartyIncomeStats, acceptPolicyOfferByCounterparty } from "./policyRegistry/counterpartyOperations";

// Re-export types for external use
export * from "./policyRegistry/types";

console.log("convex/policyRegistry.ts loaded: Main re-export file for Policy Registry."); 