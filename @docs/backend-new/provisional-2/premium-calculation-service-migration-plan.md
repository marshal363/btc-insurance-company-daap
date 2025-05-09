# Premium Calculation Service Migration Plan

## 1. Executive Summary

This document outlines the plan to migrate BitHedge's premium calculation functionality from the current implementation in `premium.ts` to the more service-oriented implementation in `services/oracle/premiumCalculation.ts`. This migration is part of our ongoing architecture refinement efforts to improve maintainability, separation of concerns, and integration with the Oracle system.

## 2. Current State Assessment

### 2.1 Duplicate Implementations

We currently have two implementations of premium calculation logic:

| File                    | Path                                           | Status                                                               |
| ----------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| `premium.ts`            | `convex/premium.ts`                            | Legacy implementation with monolithic structure                      |
| `premiumCalculation.ts` | `convex/services/oracle/premiumCalculation.ts` | New service-oriented implementation with improved Oracle integration |

### 2.2 Architectural Comparison

| Aspect                     | premium.ts                   | premiumCalculation.ts                                   |
| -------------------------- | ---------------------------- | ------------------------------------------------------- |
| **Architecture**           | Monolithic approach          | Service-oriented with better separation of concerns     |
| **Oracle Integration**     | Basic integration            | Deep integration with Oracle services                   |
| **API Approach**           | Direct queries and mutations | Standardized service pattern                            |
| **Code Organization**      | Mixed concerns               | Better encapsulation of related functionality           |
| **Modularity**             | Limited                      | Better separation between calculation and data fetching |
| **Blockchain Integration** | Limited                      | More robust with Oracle price data validation           |
| **Documentation**          | Limited inline comments      | More comprehensive documentation                        |
| **Error Handling**         | Basic                        | More comprehensive                                      |

### 2.3 Current Issues

1. **Inconsistent Usage**: Some components use `premium.ts` while others use `premiumCalculation.ts`
2. **Maintenance Overhead**: Changes need to be applied to both files
3. **Risk of Divergence**: Calculations could become inconsistent between implementations
4. **Oracle Integration**: `premium.ts` has more limited Oracle system integration

## 3. Migration Rationale

The migration to `premiumCalculation.ts` is recommended for the following reasons:

1. **Improved Architecture**: Better separation of concerns and service-oriented design
2. **Enhanced Oracle Integration**: Tighter integration with our price and volatility services
3. **Reduced Maintenance Burden**: Single source of premium calculation logic
4. **Better Blockchain Compatibility**: Improved on-chain data validation support
5. **Future Extensibility**: More modular design allows for easier future enhancements

## 4. Implementation Issues to Resolve

Before full migration, several issues need to be addressed:

### 4.1 Linter Errors in premiumCalculation.ts

| Error                                                         | Fix Required                                |
| ------------------------------------------------------------- | ------------------------------------------- |
| Import conflict for `PremiumComponents`                       | Use local interface instead of imported one |
| Nullable `currentPrice`                                       | Add null/undefined checking before usage    |
| Variable name error (`protectedAmount` vs `protectionAmount`) | Correct variable name                       |

### 4.2 API Compatibility

Ensure backward compatibility by maintaining the same API signature for frontend components.

## 5. Migration Approach

The recommended migration approach is gradual with backward compatibility to minimize disruption:

1. **Fix Implementation Issues**: Address linter errors in premiumCalculation.ts
2. **Create Proxy Methods**: Maintain backward compatibility through proxies
3. **Update Dependencies**: Migrate components one by one
4. **Testing**: Ensure all functionality works with new implementation
5. **Deprecation**: Mark old methods in premium.ts as deprecated
6. **Removal**: Eventually remove duplicate code from premium.ts

## 6. Component Migration Guide

### 6.1 Frontend Components Using premium.ts

The following frontend components need to be updated to use the new premium calculation service:

| Component/Hook               | Current Path                              | Current API                         | Migration Approach                                                       |
| ---------------------------- | ----------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| `useBuyerQuote`              | `front-end/src/hooks/useBuyerQuote.ts`    | `api.premium.getBuyerPremiumQuote`  | Update to `api.services.oracle.premiumCalculation.getBuyerPremiumQuote`  |
| `useProviderQuote`           | `front-end/src/hooks/useProviderQuote.ts` | `api.premium.getProviderYieldQuote` | Update to `api.services.oracle.premiumCalculation.getProviderYieldQuote` |
| `useDebounce` (used by both) | `front-end/src/hooks/useDebounce.ts`      | No direct premium.ts usage          | No changes needed                                                        |

#### Implementation Example

```typescript
// Original in useBuyerQuote.ts
const calculatePremiumMutation = useMutation(api.premium.getBuyerPremiumQuote);

// Updated in useBuyerQuote.ts
const calculatePremiumMutation = useMutation(
  api.services.oracle.premiumCalculation.getBuyerPremiumQuote
);
```

### 6.2 Backend Services Using premium.ts

The following backend services need to be updated to import from the new service:

| Service                 | File Path                                  | Current Import                                               | Migration Approach                                              |
| ----------------------- | ------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------- |
| Policy Registry Premium | `convex/policyRegistry/premiumServices.ts` | `import { calculateBlackScholesPremium } from "../premium";` | Update to import from `"../services/oracle/premiumCalculation"` |
| Risk Parameters         | `convex/riskParameters.ts`                 | Various premium.ts functions                                 | Update imports to premiumCalculation.ts                         |
| Quotes Service          | `convex/quotes.ts`                         | May reference premium.ts                                     | Update references to premiumCalculation.ts                      |

#### Implementation Example

```typescript
// Original in premiumServices.ts
import { calculateBlackScholesPremium } from "../premium";

// Updated in premiumServices.ts
import { calculateBlackScholesPremium } from "../services/oracle/premiumCalculation";
```

### 6.3 Backward Compatibility Layer

To ensure smooth migration, implement proxy methods in premium.ts:

```typescript
// In premium.ts - add at the bottom

// Mark as deprecated but maintain backward compatibility
/**
 * @deprecated Use api.services.oracle.premiumCalculation.getBuyerPremiumQuote instead
 */
export const getBuyerPremiumQuote = query({
  args: {
    protectedValuePercentage: v.number(),
    protectionAmount: v.number(),
    expirationDays: v.number(),
    policyType: v.string(),
    currentPriceOverride: v.optional(v.number()),
    includeScenarios: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    console.warn(
      "DEPRECATED: Using premium.ts getBuyerPremiumQuote. Please migrate to services.oracle.premiumCalculation."
    );
    // Delegate to new implementation
    return await ctx.runQuery(
      internal.services.oracle.premiumCalculation.getBuyerPremiumQuote,
      args
    );
  },
});

/**
 * @deprecated Use api.services.oracle.premiumCalculation.getProviderYieldQuote instead
 */
export const getProviderYieldQuote = query({
  args: {
    commitmentAmountUSD: v.number(),
    selectedTier: v.string(),
    selectedPeriodDays: v.number(),
  },
  handler: async (ctx, args) => {
    console.warn(
      "DEPRECATED: Using premium.ts getProviderYieldQuote. Please migrate to services.oracle.premiumCalculation."
    );
    // Delegate to new implementation
    return await ctx.runQuery(
      internal.services.oracle.premiumCalculation.getProviderYieldQuote,
      args
    );
  },
});
```

## 7. Testing Strategy

### 7.1 Unit Tests

Create or update unit tests for the premium calculation service:

1. **Core Calculation Tests**: Ensure mathematical correctness
2. **Service Integration Tests**: Verify Oracle integration
3. **API Compatibility Tests**: Ensure output format matches expected structure

### 7.2 Integration Tests

1. **End-to-End Frontend Tests**: Verify UI components display correct premium calculations
2. **Policy Creation Tests**: Verify premium calculation during policy creation
3. **Quote Generation Tests**: Ensure quote generation works with new premium service

### 7.3 Comparison Testing

Before final cutover, run comparison tests:

1. Generate premium calculations using both old and new implementations
2. Compare results to ensure consistency
3. Document and resolve any discrepancies

## 8. Migration Timeline

| Phase                            | Description                                           | Timeline       | Dependencies |
| -------------------------------- | ----------------------------------------------------- | -------------- | ------------ |
| 1. Fix Implementation Issues     | Address linter errors in premiumCalculation.ts        | Week 1         | None         |
| 2. Create Backward Compatibility | Implement proxy methods in premium.ts                 | Week 1         | Phase 1      |
| 3. Update Backend Services       | Migrate backend services to use premiumCalculation.ts | Week 2         | Phases 1-2   |
| 4. Update Frontend Hooks         | Migrate frontend hooks to use new API endpoints       | Week 3         | Phases 1-3   |
| 5. Testing                       | Comprehensive testing of all components               | Week 4         | Phases 1-4   |
| 6. Deprecation                   | Mark premium.ts methods as deprecated                 | Week 5         | Phases 1-5   |
| 7. Final Cleanup                 | Remove duplicate code from premium.ts                 | Future Release | Phases 1-6   |

## 9. Risk Assessment and Mitigation

| Risk                    | Probability | Impact | Mitigation                                             |
| ----------------------- | ----------- | ------ | ------------------------------------------------------ |
| API incompatibility     | Medium      | High   | Maintain backward compatibility through proxy methods  |
| Calculation differences | Medium      | High   | Conduct thorough comparison testing                    |
| Performance degradation | Low         | Medium | Profile performance before and after migration         |
| UI regression           | Medium      | High   | Comprehensive UI testing with various parameters       |
| Integration failures    | Medium      | High   | Test each component individually before full migration |

## 10. Conclusion

Migration to the new premium calculation service provides significant architectural benefits while improving maintainability and Oracle integration. By following this phased migration plan with careful testing, we can ensure a smooth transition with minimal disruption to users and developers.

## Appendix A: Code References

### A.1 Premium Calculation Core Function

The core premium calculation function should be consistent between implementations:

```typescript
function calculateBlackScholesPremium({
  currentPrice, // S
  strikePrice, // K
  volatility, // σ
  duration, // T (in days)
  amount, // Multiplier for final premium
  riskFreeRate = 0.02, // r
  riskParams = null, // Risk parameters for adjustments
}) {
  // Black-Scholes implementation
  // ...
}
```

## Appendix B: Specific Code Fixes

### B.1 Fix Linter Errors in premiumCalculation.ts

#### B.1.1 Fix Import Conflict

```typescript
// Current code with conflict:
import {
  MarketData,
  RiskParameters,
  PremiumComponents, // This conflicts with local interface
  PriceScenario,
  BuyerPremiumQuoteResult,
  ProviderYieldQuoteResult,
} from "../../types";

// Modified code:
import {
  MarketData,
  RiskParameters,
  // Remove conflicting import
  PriceScenario,
  BuyerPremiumQuoteResult,
  ProviderYieldQuoteResult,
} from "../../types";

// Use local interface definition
interface PremiumComponents {
  premium: number;
  intrinsicValue: number;
  timeValue: number;
  volatilityImpact: number;
}
```

#### B.1.2 Fix Nullable currentPrice

```typescript
// Current code with potential undefined:
const protectedValue = (currentPrice * args.protectedValuePercentage) / 100;
const intrinsicValue =
  Math.max(0, protectedValue - currentPrice) * args.protectionAmount;

// Modified code with null checks:
const protectedValue =
  currentPrice !== undefined
    ? (currentPrice * args.protectedValuePercentage) / 100
    : 0;

const intrinsicValue =
  currentPrice !== undefined
    ? Math.max(0, protectedValue - currentPrice) * args.protectionAmount
    : 0;
```

#### B.1.3 Fix Variable Name Error

```typescript
// Current code with incorrect variable name:
return await ctx.db.insert("premiumCalculations", {
  ...args,
  currentPrice: currentPriceForStorage,
  protectedValue: protectedValueForStorage,
  protectedAmount, // This should be protectionAmount
  expirationDays,
  policyType,
  // ...
});

// Modified code:
return await ctx.db.insert("premiumCalculations", {
  ...args,
  currentPrice: currentPriceForStorage,
  protectedValue: protectedValueForStorage,
  protectionAmount, // Corrected variable name
  expirationDays,
  policyType,
  // ...
});
```

### B.2 Frontend Hook Updates

#### B.2.1 Update useBuyerQuote.ts

```typescript
// Current implementation:
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function useBuyerQuote() {
  // ...
  const calculatePremiumMutation = useMutation(
    api.premium.getBuyerPremiumQuote
  );
  // ...
}

// Updated implementation:
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function useBuyerQuote() {
  // ...
  const calculatePremiumMutation = useMutation(
    api.services.oracle.premiumCalculation.getBuyerPremiumQuote
  );
  // ...
}
```

#### B.2.2 Update useProviderQuote.ts

```typescript
// Current implementation:
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function useProviderQuote() {
  // ...
  const calculateYieldMutation = useMutation(api.premium.getProviderYieldQuote);
  // ...
}

// Updated implementation:
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function useProviderQuote() {
  // ...
  const calculateYieldMutation = useMutation(
    api.services.oracle.premiumCalculation.getProviderYieldQuote
  );
  // ...
}
```

### B.3 Backend Services Updates

#### B.3.1 Update Policy Registry Premium Service

```typescript
// Current implementation in convex/policyRegistry/premiumServices.ts:
import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { CalculatePremiumForCreationParams, PolicyType } from "./types";
import { calculateBlackScholesPremium } from "../premium"; // Old import

// Updated implementation:
import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { CalculatePremiumForCreationParams, PolicyType } from "./types";
import { calculateBlackScholesPremium } from "../services/oracle/premiumCalculation"; // New import
```

## Appendix C: Testing Checklist

### C.1 Unit Test Coverage

| Component                  | Test Case                                        | Expected Outcome                                   |
| -------------------------- | ------------------------------------------------ | -------------------------------------------------- |
| Black-Scholes Calculation  | Calculate premium with standard inputs           | Match expected output within tolerance             |
| Black-Scholes Calculation  | Calculate premium with edge case inputs          | Handle edge cases gracefully                       |
| Black-Scholes Calculation  | Calculate premium with invalid inputs            | Return appropriate error or fallback               |
| Provider Yield Calculation | Calculate yield with standard inputs             | Match expected output within tolerance             |
| Provider Yield Calculation | Calculate yield across different tiers           | Different tiers return appropriate relative yields |
| Price Scenarios            | Generate scenarios for varying market conditions | Scenarios cover expected price range               |

### C.2 Integration Test Coverage

| Component Integration      | Test Case                                     | Expected Outcome                             |
| -------------------------- | --------------------------------------------- | -------------------------------------------- |
| Frontend to Backend        | Buyer premium request/response                | Frontend displays correct premium values     |
| Frontend to Backend        | Provider yield request/response               | Frontend displays correct yield values       |
| Policy Registry to Premium | Calculate premium during policy creation      | Policy created with correct premium          |
| Oracle to Premium          | Premium calculation with latest price data    | Premium reflects current market conditions   |
| Oracle to Premium          | Premium calculation with simulated volatility | Premium reflects market volatility correctly |

### C.3 Comparison Testing

Run the following comparison tests before finalizing the migration:

1. Generate premium quotes using both implementations with identical inputs
2. Compare results for the following scenarios:
   - Standard PUT protection at 80%, 100%, and 120% of current price
   - Short (30 days), medium (90 days), and long (360 days) durations
   - Small (0.1 BTC), medium (1 BTC), and large (10 BTC) protection amounts
   - Low, medium, and high volatility scenarios
3. Document any differences and determine if they represent:
   - Bug fixes in the new implementation
   - Different mathematical approaches
   - Potential regression issues
4. Create a reference table of expected differences to share with stakeholders

## Appendix D: Rollback Plan

In case of critical issues during migration, the following rollback steps should be followed:

1. **Revert Frontend Hooks**: Return frontend hooks to use the original premium.ts endpoints
2. **Revert Backend Services**: Return backend services to import from premium.ts
3. **Remove Proxy Methods**: Remove any proxy methods added to premium.ts
4. **Update Documentation**: Document the rollback reason and update migration timeline

## Appendix E: Additional Resources

### E.1 Decision Making Process

The decision to migrate to premiumCalculation.ts was based on:

- Architecture review conducted on [YYYY-MM-DD]
- Performance analysis of both implementations
- Maintainability assessment by the development team
- Long-term alignment with service-oriented architecture

### E.2 Reference Documentation

- [Black-Scholes Option Pricing Model](https://www.investopedia.com/terms/b/blackscholes.asp)
- [BitHedge Oracle Component Interaction Flows](./oracle-component-interaction-flows.md)
- [BitHedge Premium & Volatility Component Interaction Flows](./premium-volatility-component-interaction-flows.md)
- [BitHedge Frontend UI Component Guide](../frontend-new/policy-center/premium-components-structure.md)
