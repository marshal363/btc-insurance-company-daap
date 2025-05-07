import { query, mutation, action } from "./_generated/server"; // Basic Convex imports
import { v } from "convex/values"; // Validator import
import { Id, Doc } from "./_generated/dataModel"; // Data model types
import { internal, api } from "./_generated/api"; // API and internal functions access

// Utilities that might have been used by original top-level functions or are general
import { calculateBlackScholesPremium } from "./premium"; 
import { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import { mockNotifyLiquidityPoolOfPremiumDistribution } from "./mocks";

// Import all necessary types from the centralized types module
import {
  PolicyStatus,
  PolicyType,
  PositionType,
  TokenType,
  PolicyEventType,
  TransactionStatus,
  CalculatePremiumForCreationParams,
  PolicyActivationEligibilityResult,
  PolicyCreationParams
} from "./policyRegistry/types";

// Import public-facing functions from their new modules
import { getPolicy, getPoliciesForUser, getPoliciesForCounterparty, getPolicyEvents } from "./policyRegistry/queries";
import { updateTransactionStatusPublic } from "./policyRegistry/transactionManager";
import { checkPolicyActivationEligibility } from "./policyRegistry/eligibilityChecks"; // mockCheckPoolLiquidity is not re-exported
import { requestPolicyCreation } from "./policyRegistry/policyLifecycle";
import { getCounterpartyIncomeStats, acceptPolicyOfferByCounterparty } from "./policyRegistry/counterpartyOperations";

// --- Re-export public-facing functionalities --- 

// From queries.ts
export { getPolicy, getPoliciesForUser, getPoliciesForCounterparty, getPolicyEvents };

// From transactionManager.ts
export { updateTransactionStatusPublic };

// From eligibilityChecks.ts
export { checkPolicyActivationEligibility };

// From policyLifecycle.ts
export { requestPolicyCreation };

// From counterpartyOperations.ts
export { getCounterpartyIncomeStats, acceptPolicyOfferByCounterparty };

console.log("convex/policyRegistry.ts loaded: Main re-export file for Policy Registry."); 