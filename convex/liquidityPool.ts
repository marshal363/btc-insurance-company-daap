import { query, mutation, action, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { internal, api } from "./_generated/api";

// Import types (though not directly used here, good for context if this file evolves)
import * as Types from "./liquidityPool/types";

// Import functions from new modules
import { getProviderBalances, getProviderBalanceSummary, getProviderDashboard } from "./liquidityPool/providerState";
import { 
    checkWithdrawalEligibility, getMaxWithdrawalAmounts, 
    requestCapitalCommitment, confirmCapitalCommitment, 
    requestWithdrawal, confirmWithdrawal 
} from "./liquidityPool/capitalManagement";
import { 
    registerLiquidityProvider, updateProviderPreferences, getProviderPreferences 
} from "./liquidityPool/accountManagement";
import { 
    getSystemPoolStats, pausePoolOperations 
} from "./liquidityPool/adminOperations";
import { 
    getTransactionsByProvider, getPoolTransactions, 
    checkTransactionStatus, retryTransaction 
} from "./liquidityPool/transactionManager";
import { 
    getPoolMetrics, getPoolMetricsHistory 
} from "./liquidityPool/poolState";
import { 
    requestPremiumWithdrawal 
} from "./liquidityPool/premiumOperations";

// Re-export public-facing functions to maintain the API discoverable via api.liquidityPool.functionName

// From providerState.ts
export { getProviderBalances, getProviderBalanceSummary, getProviderDashboard };

// From capitalManagement.ts
export { 
    checkWithdrawalEligibility, getMaxWithdrawalAmounts, 
    requestCapitalCommitment, confirmCapitalCommitment, 
    requestWithdrawal, confirmWithdrawal 
};

// From accountManagement.ts
export { 
    registerLiquidityProvider, updateProviderPreferences, getProviderPreferences 
};

// From adminOperations.ts
export { 
    getSystemPoolStats, pausePoolOperations 
};

// From transactionManager.ts
export { 
    getTransactionsByProvider, getPoolTransactions, 
    checkTransactionStatus, retryTransaction 
};

// From poolState.ts
export { 
    getPoolMetrics, getPoolMetricsHistory 
};

// From premiumOperations.ts
export { 
    requestPremiumWithdrawal 
};

// Example of how internal functions are now referenced (no re-export needed for these from this file)
// To call an internal function from another module (e.g., from an action in this backend):
// await ctx.runQuery(internal.liquidityPool.policyLifecycle.getPolicyAllocations, { ... });
// await ctx.runMutation(internal.liquidityPool.transactionManager.createPendingPoolTransaction, { ... });
// await ctx.runAction(internal.liquidityPool.settlementProcessing.processClaimSettlement, { ... });