# Refactoring Plan: Blockchain Integration Layer Modularization

**Date:** 2024-09-03
**Status:** Draft

## 1. Introduction and Goal

The primary goal of this refactoring effort is to create a modular, scalable, and maintainable Blockchain Integration Layer that will serve multiple components of the BitHedge platform. Currently, blockchain integration code is focused on the Oracle component with code distributed across `blockchainIntegration.ts`, `blockchainPreparation.ts`, and `prices.ts`. With the upcoming implementation of Policy Registry and Liquidity Pool blockchain integrations (as outlined in the implementation roadmap Phase 3), now is the ideal time to establish a proper architecture for all blockchain interactions.

This initiative aims to:

1. Create a common foundation for all blockchain operations
2. Separate concerns into clearly defined modules
3. Reduce code duplication across blockchain integrations
4. Make the codebase more testable and maintainable
5. Support the efficient implementation of the roadmap's BI-PR-301 through BI-PR-314 and BI-LP-301 through BI-LP-318 tasks
6. Preserve backward compatibility with existing frontend components and services
7. Clearly identify and handle deprecated or legacy code

This plan is based on the analysis of existing blockchain integration code and in accordance with the project documentation, including:

- `@docs/backend-new/provisional-2/implementation-roadmap.md`
- `@docs/backend-new/provisional-2/contracts-interaction-flow.md`

## 2. Task Status Legend

| Status      | Symbol | Description                                           |
| ----------- | ------ | ----------------------------------------------------- |
| Not Started | ⬜     | Task has not been started yet.                        |
| In Progress | 🟡     | Task is actively being worked on.                     |
| Completed   | 🟢     | Task fully completed and verified.                    |
| Blocked     | 🔴     | Task is blocked by unresolved dependencies or issues. |
| Paused      | ⏸️     | Task is temporarily paused.                           |

## 3. Development Progress Dashboard

| Phase                                | Total Tasks | Not Started | In Progress | Completed | Blocked | Paused | Completion % |
| ------------------------------------ | ----------- | ----------- | ----------- | --------- | ------- | ------ | ------------ |
| Phase 0: Setup and Foundations       | 4           | 4           | 0           | 0         | 0       | 0      | 0%           |
| Phase 1: Common Blockchain Services  | 6           | 6           | 0           | 0         | 0       | 0      | 0%           |
| Phase 2: Oracle Integration Refactor | 6           | 6           | 0           | 0         | 0       | 0      | 0%           |
| Phase 3: Policy Registry Integration | 8           | 8           | 0           | 0         | 0       | 0      | 0%           |
| Phase 4: Liquidity Pool Integration  | 8           | 8           | 0           | 0         | 0       | 0      | 0%           |
| Phase 5: Testing and Finalization    | 6           | 6           | 0           | 0         | 0       | 0      | 0%           |
| **Overall Project**                  | **38**      | **38**      | **0**       | **0**     | **0**   | **0**  | **0%**       |

## 4. Overall Strategy

- **Modular Architecture:** The refactoring will follow a clear separation of concerns with well-defined module boundaries.

- **Recommended Folder Structure:** The following directory structure will be implemented:

  ```
  convex/
  ├── blockchain/
  │   ├── common/
  │   │   ├── network.ts         # Network configuration, environment vars
  │   │   ├── transaction.ts     # Transaction building, signing, broadcasting
  │   │   ├── contracts.ts       # Contract addresses and shared utilities
  │   │   ├── eventListener.ts   # Common event listening utilities
  │   │   └── utils.ts           # Common blockchain utilities
  │   ├── oracle/
  │   │   ├── priceReader.ts     # Reading price data from chain
  │   │   ├── priceWriter.ts     # Writing price updates to chain
  │   │   └── types.ts           # Oracle-specific types
  │   ├── policyRegistry/
  │   │   ├── reader.ts          # Policy read operations
  │   │   ├── writer.ts          # Policy write operations
  │   │   ├── events.ts          # Policy event handling
  │   │   └── types.ts           # Policy blockchain types
  │   └── liquidityPool/
  │       ├── reader.ts          # LP read operations
  │       ├── writer.ts          # LP write operations
  │       ├── events.ts          # LP event handling
  │       └── types.ts           # LP blockchain types
  │   ├── testing/
  │       ├── mocks.ts           # Shared testing utilities
  │       ├── oracleMocks.ts     # Oracle-specific mocks
  │       ├── policyMocks.ts     # Policy-specific mocks
  │       └── liquidityMocks.ts  # Liquidity pool-specific mocks
  ├── services/
      ├── oracle/                # Price calculation services
      │   └── premiumCalculation.ts # Move from premium.ts
      ├── policyRegistry/        # Already refactored policy services
      └── liquidityPool/         # Existing LP services
  ```

- **Module Responsibility:** Each module will have a clearly defined responsibility, with separation between read operations, write operations, and event handling.

- **Incremental Changes with Backward Compatibility:** The refactoring will be implemented incrementally with adapter layers to maintain backward compatibility:

  - Keep existing files working while implementing new structure
  - Test both implementations side-by-side
  - Switch over only after parity is confirmed
  - Use feature flags to control which implementation is active

- **Dependency Management:**

  - Types and interfaces: Centralized in component-specific `types.ts` files
  - Common utilities: Shared via imports from `convex/blockchain/common/*`
  - Clean dependencies: Minimize circular dependencies through careful module design

- **Testing:** Develop unit tests for each module alongside implementation to ensure reliability.

- **Frontend Integration Preservation:** Maintain compatibility with the existing frontend components, particularly `BitcoinPriceCard.tsx` and related hooks.

## 5. Current Interconnection Analysis

Before proceeding with refactoring, it's crucial to understand the existing interconnections in the codebase to prevent functionality breakage:

### 5.1 Backend Component Dependencies

1. **Oracle Data Flow**:

   - `prices.ts` → `blockchainIntegration.ts` → Oracle Contract
   - `hooks/useBitcoinPrice.ts` and `oracleQueries.ts` → Convex queries → Oracle data

2. **Transaction Handling**:

   - `transactionStatusJobs.ts` monitors transaction status with mocks
   - `poolTransactionWatcher.ts` tracks pool transactions
   - Both depend on blockchain interaction patterns

3. **Premium & Settlement Services**:

   - `premium.ts` (701 lines) provides core premium calculation logic
   - `settlementJobs.ts` processes settlement with mock blockchain interactions
   - These services depend on but are separate from direct blockchain interaction

4. **Simulation & Testing**:
   - `mocks.ts` provides blockchain simulation functions used throughout

### 5.2 Frontend Integration Points

The `BitcoinPriceCard.tsx` component is a critical frontend element that:

- Fetches price data via `api.prices.getLatestPrice`
- Uses `useCalculate24hRange()` from hooks
- Depends on `useIsAuthorizedSubmitter` to determine permissions
- Shows price feed, volatility, and 24h ranges

## 6. Risk Mitigation Strategy

To ensure a smooth refactoring process without breaking existing functionality:

### 6.1 Interface Preservation Pattern

We will create adapter layers between old and new implementations:

```typescript
// Example adapter approach
// in blockchainIntegration.ts (preserved file)

import { readLatestOraclePrice } from "./blockchain/oracle/priceReader";

// Keep original function signature but delegate to new implementation
export async function getOraclePrice() {
  return await readLatestOraclePrice();
}
```

### 6.2 Incremental Refactoring with Dual Implementation

- Keep existing files working while implementing new structure
- Test both implementations side-by-side
- Switch over only after parity is confirmed
- Use feature flags to control which implementation is active

### 6.3 Deprecated Code Identification

- Implement usage tracking/logging to identify truly unused files
- Create a deprecation registry that marks files with:
  - Last usage date
  - Replacement module
  - Planned removal date

### 6.4 Specific File Handling

- **premium.ts**: Move to `services/oracle/premiumCalculation.ts` as it contains business logic rather than blockchain integration
- **options.ts**: Compare with `premium.ts` to identify duplicated functionality; mark for deprecation if necessary
- **mocks.ts**: Restructure into component-specific mock files in the `blockchain/testing` directory

## 7. Refactoring Phases and Detailed Steps

### Phase 0: Setup and Foundations

- **Step 0.1: Create Directory Structure** ⬜

  - **Action:** Create the directory structure as outlined in the Overall Strategy section:
    ```
    convex/blockchain/
    ├── common/
    ├── oracle/
    ├── policyRegistry/
    ├── liquidityPool/
    └── testing/
    ```
  - **Rationale:** Establishes the high-level organization for all blockchain integration code.

- **Step 0.2: Create Shared Types** ⬜

  - **Action:** Create `convex/blockchain/common/types.ts`
  - **Contents:** Define common interfaces and types for blockchain operations:
    - `NetworkEnvironment` (mainnet, testnet, devnet)
    - `TransactionStatus` (pending, submitted, confirmed, failed)
    - `BlockchainContract` (contract address, name, interfaces)
    - `TransactionParams` (Base interface for transaction parameters)
  - **Rationale:** Centralizes common type definitions used across all blockchain integrations.

- **Step 0.3: Create Component-Specific Types** ⬜

  - **Action:** Create type files for each component:
    - `convex/blockchain/oracle/types.ts`
    - `convex/blockchain/policyRegistry/types.ts`
    - `convex/blockchain/liquidityPool/types.ts`
  - **Contents:** Define component-specific types that extend the common base types.
  - **Rationale:** Separates concerns while maintaining type consistency across components.

- **Step 0.4: Create Dependency Analysis Tool** ⬜
  - **Action:** Create a simple script to analyze and log function calls across the codebase
  - **Implement:** Add logging to track usage of blockchain-related functions
  - **Outcome:** Generate a detailed dependency map to identify potential breakage points
  - **Rationale:** Provides empirical data about actual code dependencies to guide refactoring.

### Phase 1: Common Blockchain Services

- **Step 1.1: Network Configuration** ⬜

  - **Action:** Create `convex/blockchain/common/network.ts`
  - **Extract:** Move network configuration logic from `blockchainIntegration.ts`:
    - `getStacksNetwork()` function
    - Environment variable handling
    - Network selection logic
  - **Enhance:** Add network caching to avoid repeated initialization
  - **Exports:** Export functions for getting network objects and configuration
  - **Compatibility:** Create adapter functions in original location that call new implementations
  - **Rationale:** Centralize all network configuration to ensure consistency across integrations.

- **Step 1.2: Contract Management** ⬜

  - **Action:** Create `convex/blockchain/common/contracts.ts`
  - **Extract:** Move contract configuration from existing code:
    - Contract address configuration
    - Contract name management
    - Environment-specific contract selection
  - **Enhance:** Create a registry of all contracts with their addresses and names
  - **Exports:** Export functions for retrieving contract information
  - **Compatibility:** Create adapter functions in original location that call new implementations
  - **Rationale:** Provide a single source of truth for contract addressing.

- **Step 1.3: Transaction Management** ⬜

  - **Action:** Create `convex/blockchain/common/transaction.ts`
  - **Extract:** Move transaction-related utilities from existing code, including:
    - `getBackendSignerKey()`
    - `signSetPriceTransaction()` (generalize to `signTransaction()`)
    - `broadcastSignedTransaction()`
    - `fetchAccountNonce()`
    - Transaction building utilities for various operations
  - **Implement:** Create generic transaction builders for:
    - Read-only contract calls
    - Contract function calls
    - STX transfers
    - Token transfers
  - **Exports:** Export transaction building, signing, and broadcasting functions
  - **Compatibility:** Create adapter functions in original location that call new implementations
  - **Rationale:** Centralize all transaction operations into a single module.

- **Step 1.4: Event Listening** ⬜

  - **Action:** Create `convex/blockchain/common/eventListener.ts`
  - **Implement:** Create utilities for:
    - Subscribing to contract events
    - Filtering events by type
    - Processing event data
  - **Exports:** Export event listening functions
  - **Compatibility:** Create adapter functions where needed to maintain existing patterns
  - **Rationale:** Standardize event handling across all integrations.

- **Step 1.5: Utility Functions** ⬜

  - **Action:** Create `convex/blockchain/common/utils.ts`
  - **Implement:** Add helper functions for:
    - Value conversion (STX/microSTX, BTC/satoshis)
    - Block height calculation
    - Error handling and retry logic
  - **Exports:** Export utility functions
  - **Compatibility:** Create adapter functions where needed for existing code
  - **Rationale:** Provide common utilities to avoid duplication.

- **Step 1.6: Types Refinement** ⬜
  - **Action:** Review and refine `convex/blockchain/common/types.ts`
  - **Update:** After implementing the other common modules, update types as needed
  - **Rationale:** Ensure types accurately reflect the implemented interfaces.

### Phase 2: Oracle Integration Refactor

- **Step 2.1: Oracle Types** ⬜

  - **Action:** Populate `convex/blockchain/oracle/types.ts`
  - **Define:**
    - `OraclePriceData` interface
    - `OracleSubmissionParams` interface
    - Oracle-specific error types
  - **Rationale:** Establish clear typing for Oracle operations.

- **Step 2.2: Oracle Read Operations** ⬜

  - **Action:** Create `convex/blockchain/oracle/priceReader.ts`
  - **Extract:** Move from `blockchainIntegration.ts`:
    - `readLatestOraclePrice()`
  - **Update:** Use new common utilities
  - **Exports:** Export Oracle reading functions
  - **Compatibility:** Create adapter functions in original location for backward compatibility
  - **Rationale:** Isolate Oracle reading operations.

- **Step 2.3: Oracle Write Operations** ⬜

  - **Action:** Create `convex/blockchain/oracle/priceWriter.ts`
  - **Extract:** Move from `blockchainIntegration.ts`:
    - `prepareOracleSubmission()`
    - `submitAggregatedPrice()`
    - `checkAndSubmitOraclePrice()`
  - **Update:** Use new common utilities
  - **Exports:** Export Oracle writing functions
  - **Compatibility:** Create adapter functions in original location for backward compatibility
  - **Rationale:** Isolate Oracle writing operations.

- **Step 2.4: Update Legacy References** ⬜

  - **Action:** Modify existing `blockchainIntegration.ts`
  - **Update:** Import and re-export functions from new modules
  - **Maintain:** Keep API compatibility for existing uses
  - **Testing:** Verify that `BitcoinPriceCard.tsx` and related components work correctly
  - **Rationale:** Ensure backward compatibility during transition.

- **Step 2.5: Integration with Price Service** ⬜

  - **Action:** Move price calculation logic to `convex/services/oracle/`
  - **Update:** Connect with blockchain modules via imports
  - **Compatibility:** Maintain support for existing frontend components, particularly `BitcoinPriceCard.tsx`
  - **Rationale:** Separate business logic from blockchain integration.

- **Step 2.6: Premium Calculation Service Migration** ⬜
  - **Action:** Move core logic from `premium.ts` to `convex/services/oracle/premiumCalculation.ts`
  - **Update:** Refactor to use new blockchain modules for any on-chain interactions
  - **Compatibility:** Maintain existing API to prevent breaking `quotes.ts` and other consumers
  - **Testing:** Create tests to verify calculation results remain consistent
  - **Rationale:** Properly separate business logic from blockchain integration while preserving functionality.

### Phase 3: Policy Registry Integration

- **Step 3.1: Policy Registry Types** ⬜

  - **Action:** Populate `convex/blockchain/policyRegistry/types.ts`
  - **Define:**
    - `PolicyParams` interface
    - `PolicyTransactionType` enum
    - `PolicyEventType` enum
  - **Rationale:** Establish clear typing for Policy Registry operations.

- **Step 3.2: Policy Registry Read Operations** ⬜

  - **Action:** Create `convex/blockchain/policyRegistry/reader.ts`
  - **Implement:**
    - `getPolicyById()` function
    - `getPolicyStatus()` function
    - `checkPolicyExercisability()` function
  - **Exports:** Export Policy reading functions
  - **Rationale:** Group all Policy Registry read operations.

- **Step 3.3: Policy Registry Write Operations** ⬜

  - **Action:** Create `convex/blockchain/policyRegistry/writer.ts`
  - **Implement:**
    - `buildPolicyCreationTransaction()` function
    - `buildUpdatePolicyStatusTransaction()` function
    - `buildExpirePoliciesBatchTransaction()` function
    - `buildPremiumDistributionTransaction()` function
    - Position type integration
  - **Exports:** Export Policy writing functions
  - **Rationale:** Group all Policy Registry write operations.

- **Step 3.4: Policy Events** ⬜

  - **Action:** Create `convex/blockchain/policyRegistry/events.ts`
  - **Implement:**
    - `subscribeToPolicyCreatedEvents()` function
    - `subscribeToPolicyStatusUpdatedEvents()` function
    - `subscribeToPremiumDistributionEvents()` function
    - Event processing functions
  - **Exports:** Export event subscription and processing functions
  - **Rationale:** Centralize event handling for Policy Registry.

- **Step 3.5: Integration with Convex Services** ⬜

  - **Action:** Update `convex/services/policyRegistry/` to use the new blockchain modules
  - **Implement:**
    - Bridge functions connecting blockchain operations with Convex services
    - Data transformation between service models and blockchain parameters
  - **Rationale:** Connect blockchain layer with existing Convex services.

- **Step 3.6: Position Type Integration** ⬜

  - **Action:** Enhance `convex/blockchain/policyRegistry/writer.ts`
  - **Implement:**
    - Position type validation and conversion functions
    - Integration with policy creation transaction building
  - **Rationale:** Handle the position type aspect of policies.

- **Step 3.7: Premium Distribution Integration** ⬜

  - **Action:** Enhance `convex/blockchain/policyRegistry/writer.ts` and `events.ts`
  - **Implement:**
    - Premium distribution transaction building
    - Premium distribution event processing
    - Counterparty notification handling
  - **Rationale:** Handle the premium distribution aspect of policies.

- **Step 3.8: Policy Creation Workflow Integration** ⬜
  - **Action:** Create bridge functions in Convex services
  - **Implement:**
    - End-to-end policy creation workflow
    - Testing of complete flow from Convex to blockchain and back
  - **Rationale:** Verify the complete integration works as expected.

### Phase 4: Liquidity Pool Integration

- **Step 4.1: Liquidity Pool Types** ⬜

  - **Action:** Populate `convex/blockchain/liquidityPool/types.ts`
  - **Define:**
    - `DepositParams`, `WithdrawalParams` interfaces
    - `CollateralParams` interface
    - `SettlementParams` interface
    - LP-specific event types
  - **Rationale:** Establish clear typing for Liquidity Pool operations.

- **Step 4.2: Liquidity Pool Read Operations** ⬜

  - **Action:** Create `convex/blockchain/liquidityPool/reader.ts`
  - **Implement:**
    - `getPoolBalances()` function
    - `getLockedCollateral()` function
    - `getPremiumBalances()` function
  - **Exports:** Export LP reading functions
  - **Rationale:** Group all Liquidity Pool read operations.

- **Step 4.3: Liquidity Pool Write Operations** ⬜

  - **Action:** Create `convex/blockchain/liquidityPool/writer.ts`
  - **Implement:**
    - `buildDepositTransaction()` function for both STX and sBTC
    - `buildWithdrawalTransaction()` function for both STX and sBTC
    - `buildLockCollateralTransaction()` function
    - `buildReleaseCollateralTransaction()` function
    - `buildPaySettlementTransaction()` function
    - `buildDistributePremiumTransaction()` function
    - `buildProviderPremiumAllocationTransaction()` function
  - **Exports:** Export LP writing functions
  - **Rationale:** Group all Liquidity Pool write operations.

- **Step 4.4: Liquidity Pool Events** ⬜

  - **Action:** Create `convex/blockchain/liquidityPool/events.ts`
  - **Implement:**
    - Event subscription functions for all LP events:
      - Funds deposited/withdrawn
      - Collateral locked/released
      - Settlement paid
      - Premium distributed
    - Event processing functions
  - **Exports:** Export event subscription and processing functions
  - **Rationale:** Centralize event handling for Liquidity Pool.

- **Step 4.5: Integration with Convex Services** ⬜

  - **Action:** Update `convex/services/liquidityPool/` to use the new blockchain modules
  - **Implement:**
    - Bridge functions connecting blockchain operations with Convex services
    - Data transformation between service models and blockchain parameters
  - **Rationale:** Connect blockchain layer with existing Convex services.

- **Step 4.6: Capital Operations Integration** ⬜

  - **Action:** Enhance `convex/services/liquidityPool/capitalManagement.ts`
  - **Implement:**
    - Integration with blockchain deposit/withdrawal functions
    - End-to-end testing of capital flows
  - **Rationale:** Complete the capital management integration.

- **Step 4.7: Settlement Integration** ⬜

  - **Action:** Enhance `convex/services/liquidityPool/settlementProcessing.ts`
  - **Implement:**
    - Integration with blockchain settlement functions
    - End-to-end testing of settlement flows
  - **Rationale:** Complete the settlement integration.

- **Step 4.8: Premium Distribution Integration** ⬜
  - **Action:** Enhance `convex/services/liquidityPool/premiumOperations.ts`
  - **Implement:**
    - Integration with blockchain premium distribution functions
    - End-to-end testing of premium flows
  - **Rationale:** Complete the premium distribution integration.

### Phase 5: Testing and Finalization

- **Step 5.1: Unit Testing** ⬜

  - **Action:** Create unit tests for all modules
  - **Implement:** Test files for:
    - Common utilities
    - Oracle integration
    - Policy Registry integration
    - Liquidity Pool integration
  - **Rationale:** Ensure individual module correctness.

- **Step 5.2: Integration Testing** ⬜

  - **Action:** Create integration tests
  - **Implement:** Test files that verify:
    - Cross-module integration
    - End-to-end workflows
    - Error handling and recovery
  - **Rationale:** Verify components work together correctly.

- **Step 5.3: Frontend Integration Testing** ⬜

  - **Action:** Create frontend integration tests
  - **Implement:** Testing harness for `BitcoinPriceCard.tsx` and other components
  - **Verify:** Rendering with both old and new data sources
  - **Use:** Snapshot testing to detect visual regressions
  - **Rationale:** Ensure frontend components work correctly with refactored backend.

- **Step 5.4: Code Review and Documentation** ⬜

  - **Action:** Review code and add documentation
  - **Implement:**
    - Inline code comments
    - API documentation
    - Architecture documentation
  - **Rationale:** Ensure code is understandable and maintainable.

- **Step 5.5: Deprecation Management** ⬜

  - **Action:** Create deprecation plan for legacy files
  - **Implement:**
    - Mark functions as deprecated with JSDoc tags
    - Create deprecation registry
    - Document migration paths
  - **Rationale:** Provide clear path for future cleanup while maintaining stability.

- **Step 5.6: Final Clean-Up** ⬜
  - **Action:** Final code cleanup and organization
  - **Implement:**
    - Remove any redundant code
    - Resolve any remaining TODOs
    - Ensure consistent formatting and naming
  - **Rationale:** Ensure codebase is clean and professional.

## 8. Execution and Review Process

- **Task Execution:** Each phase will be executed sequentially, with tasks within phases potentially executed in parallel where dependencies allow.
- **Testing Strategy:** Each module will be tested as it's completed, with integration tests added as modules are connected.
- **Code Review:** Regular code reviews will ensure adherence to the architectural plan and coding standards.
- **API Stability:** Maintain backward compatibility for existing services during the refactoring using adapter layers.
- **Documentation:** Generate up-to-date API documentation as modules are completed.
- **Risk Monitoring:** Continuously track dependencies and potential breaking changes.

## 9. Timeline and Trade-offs

**Proposed Timeline:**

- Phase 0-1: Week 1
- Phase 2: Week 2
- Phase 3-4: Weeks 3-4
- Phase 5: Week 4 (in parallel with Phase 4)

**Key Trade-offs:**

1. **Full Rewrite vs. Incremental Refactoring**

   - Full rewrite: Cleaner architecture but higher risk
   - Incremental: Lower risk but temporary complexity
   - **Decision**: Incremental approach with adapter layers to minimize risk

2. **Monolithic vs. Microservice Architecture**

   - Current approach is module-based but still within single codebase
   - Future could separate concerns more drastically
   - **Decision**: Modular monolith as intermediate step

3. **Testing vs. Development Speed**

   - More testing = lower risk but slower progress
   - **Decision**: Focus testing on critical paths (price data, transactions)

4. **Migration Timeline**
   - Aggressive: Complete in 2-3 weeks with dedicated focus
   - Conservative: 4-6 weeks with parallel feature development
   - **Decision**: 4-week timeline with checkpoints after each phase

## 10. Assessing Success

The successful completion of this refactoring will be assessed based on the following criteria:

- **Modularity:** Blockchain integration code is properly separated into focused modules.
- **Code Reuse:** Common operations are implemented once and reused across components.
- **Testing:** Comprehensive test coverage for all modules.
- **Performance:** No regression in performance for existing functionality.
- **Maintainability:** Codebase is easier to understand, modify, and extend.
- **Roadmap Alignment:** Implementation successfully supports all Phase 3 roadmap tasks.
- **Frontend Compatibility:** No breakage of existing frontend components, particularly `BitcoinPriceCard.tsx`.
- **Service Stability:** All dependent services continue to function correctly.

This plan provides a structured approach to creating a robust Blockchain Integration Layer that will serve the BitHedge platform's current and future needs, with careful attention to preserving existing functionality throughout the refactoring process.
