# Refactoring Plan: convex/policyRegistry.ts Modularization

**Date:** 2024-08-31
**Status:** In Progress

## 1. Introduction and Goal

The primary goal of this refactoring effort is to decompose the `convex/policyRegistry.ts` file (currently at 1569 lines) into a set of smaller, more manageable, and functionally cohesive modules. This initiative aims to significantly improve the maintainability, scalability, readability, and testability of the Policy Registry Convex backend codebase, following the same pattern successfully used for the Liquidity Pool refactoring.

This plan is based on the analysis of `convex/policyRegistry.ts` and in accordance with the existing project documentation.

## 2. Task Status Legend

| Status      | Symbol | Description                                           |
| ----------- | ------ | ----------------------------------------------------- |
| Not Started | ⬜     | Task has not been started yet.                        |
| In Progress | 🟡     | Task is actively being worked on.                     |
| Completed   | 🟢     | Task fully completed and verified.                    |
| Blocked     | 🔴     | Task is blocked by unresolved dependencies or issues. |
| Paused      | ⏸️     | Task is temporarily paused.                           |

## 3. Development Progress Dashboard

| Phase                                   | Total Tasks | Not Started | In Progress | Completed | Blocked | Paused | Completion % |
| --------------------------------------- | ----------- | ----------- | ----------- | --------- | ------- | ------ | ------------ |
| Phase 0: Setup and Foundations          | 2           | 0           | 0           | 2         | 0       | 0      | 100%         |
| Phase 1: Core Logic Modules             | 3           | 0           | 0           | 3         | 0       | 0      | 100%         |
| Phase 2: Policy Lifecycle Operations    | 3           | 0           | 0           | 3         | 0       | 0      | 100%         |
| Phase 3: Financial & Premium Management | 2           | 0           | 0           | 2         | 0       | 0      | 100%         |
| Phase 4: Counterparty & Specialization  | 2           | 0           | 0           | 2         | 0       | 0      | 100%         |
| Phase 5: Cleanup and Final Review       | 3           | 0           | 0           | 3         | 0       | 0      | 100%         |
| **Overall Project**                     | **15**      | **0**       | **0**       | **15**    | **0**   | **0**  | **100%**     |

## 4. Overall Strategy

- **Incremental Changes:** The refactoring will be performed module by module to minimize risk and allow for easier review and validation at each stage.
- **Directory Structure:** A new directory, `convex/policyRegistry/`, will be created to house the new, modularized files.
- **Module Responsibility:** Each new module will have a clearly defined responsibility, grouping related functionalities.
- **Dependency Management:**
  - Types and Enums: Centralized in `convex/policyRegistry/types.ts`.
  - Internal Module Dependencies: Direct relative imports will be used for dependencies between modules within `convex/policyRegistry/`.
- **Testing:** No new tests will be added as part of this refactoring phase, as per current requirements. The focus is on structural improvement.
- **Frontend Impact:** No direct frontend changes are anticipated in this phase; the external API of Convex actions and queries is expected to remain consistent.

## 5. Refactoring Phases and Detailed Steps

### Phase 0: Setup and Foundations

- **Step 0.1: Create Directory Structure** 🟢
  - **Action:** Create the `convex/policyRegistry/` directory.
  - **Rationale:** Establishes the designated location for the refactored modules.
- **Step 0.2: Create `types.ts`** 🟢
  - **Action:** Create `convex/policyRegistry/types.ts`.
  - **Move:** Migrate all enums (`PolicyStatus`, `PolicyType`, `PositionType`, `TokenType`, `PolicyEventType`, `TransactionStatus`) and any broadly shared interface/type definitions (`CalculatePremiumForCreationParams`, `PolicyActivationEligibilityResult`, `PolicyCreationParams`) from the original `convex/policyRegistry.ts` into this new file.
  - **Exports:** Ensure all necessary enums and types are exported from `types.ts`.
  - **Updates:** Modify the original `convex/policyRegistry.ts` to import these enums/types from the new `convex/policyRegistry/types.ts`. Original definitions in `convex/policyRegistry.ts` were commented out.
  - **Rationale:** Centralizes common type definitions, enhancing consistency and reusability across the new modules.

#### Phase 0: Notes and Comments

- The `convex/policyRegistry/` directory was created.
- `convex/policyRegistry/types.ts` was created and populated with the specified enums and interfaces, all of which are exported.
- `convex/policyRegistry.ts` was updated to import these from `convex/policyRegistry/types.ts`. The original definitions in `convex/policyRegistry.ts` have been commented out as requested.
- **Reminder:** Linter errors in `convex/policyRegistry.ts` concerning missing type definitions (due to commented-out original types) are expected at this stage. These should resolve as more functions are moved to their respective modules, which will then correctly import these types.

### Phase 1: Core Logic Modules (Foundational Services)

- **Step 1.1: Extract `queries.ts`** 🟢

  - **Action:** Create `convex/policyRegistry/queries.ts`.
  - **Responsibilities:** Houses core policy data retrieval functionalities.
  - **Key Functions to Move:**
    - `getPolicy` (query)
    - `getPoliciesForUser` (query)
    - `getPoliciesForCounterparty` (query)
    - `getPolicyEvents` (query)
  - **Updates:** Adjust imports (from `../types.ts` and other necessary Convex imports). Export all functions. Original functions in `convex/policyRegistry.ts` were commented out and re-exports were added in `convex/policyRegistry.ts` to point to the new module, maintaining API consistency.
  - **Rationale:** Isolates basic data retrieval functions, which are core to all policy operations.

- **Step 1.2: Extract `transactionManager.ts`** 🟢

  - **Action:** Create `convex/policyRegistry/transactionManager.ts`.
  - **Responsibilities:** Manages policy transaction lifecycle.
  - **Key Functions to Move:**
    - `createPendingPolicyTransaction` (internal mutation)
    - `updateTransactionStatus` (internal mutation)
    - `updateTransactionStatusPublic` (mutation)
    - Transaction handling functions (`handleConfirmedPolicyCreation`, `handleConfirmedPolicyActivation`) - these helper functions were moved and remain un-exported within `transactionManager.ts`.
  - **Updates:** Adjust imports and exports. Original functions in `convex/policyRegistry.ts` were commented out. Calls to `internal.policyRegistry.createPendingPolicyTransaction` in `convex/policyRegistry.ts` were updated to `internal.policyRegistry.transactionManager.createPendingPolicyTransaction`. A re-export for `updateTransactionStatusPublic` was added to `convex/policyRegistry.ts`.
  - **Rationale:** Centralizes transaction management for all policy operations.

- **Step 1.3: Extract `eligibilityChecks.ts`** 🟢
  - **Action:** Create `convex/policyRegistry/eligibilityChecks.ts`.
  - **Responsibilities:** Houses validation and eligibility checking logic.
  - **Key Functions to Move:**
    - `checkPolicyActivationEligibility` (query)
    - `validatePolicyParameters` (internal function)
    - `mockGetLatestBlockHeight` (moved from mock services)
    - `mockGetCurrentBTCPrice` (moved from mock services)
    - `mockCheckPoolLiquidity` (moved from mock services)
  - **Updates:** Adjust imports and exports. Original functions commented out in `convex/policyRegistry.ts`. `checkPolicyActivationEligibility` and `mockCheckPoolLiquidity` re-exported from `convex/policyRegistry.ts`. `validatePolicyParameters`, `mockGetLatestBlockHeight`, `mockGetCurrentBTCPrice` exported from `eligibilityChecks.ts` for use by other modules.
  - **Rationale:** Groups validation logic in one place for better maintenance.

#### Phase 1: Notes and Comments

- **`queries.ts` (Step 1.1):** Successfully created and populated. Original query functions in `convex/policyRegistry.ts` commented out and re-exported.
- **`transactionManager.ts` (Step 1.2):** Successfully created and populated. Original transaction functions in `convex/policyRegistry.ts` commented out. `updateTransactionStatusPublic` re-exported. Internal calls updated.
- **`eligibilityChecks.ts` (Step 1.3):** Successfully created and populated. Original functions commented out in `convex/policyRegistry.ts`. `checkPolicyActivationEligibility` and `mockCheckPoolLiquidity` re-exported. Other necessary functions (`validatePolicyParameters`, `mockGetLatestBlockHeight`, `mockGetCurrentBTCPrice`) are exported from `eligibilityChecks.ts` for direct import by modules like `policyLifecycle.ts` and `settlementServices.ts`.
- **Reminders:**
  - The linter error "Type instantiation is excessively deep and possibly infinite" may persist in `convex/policyRegistry.ts`. This will be monitored as refactoring continues.
  - The call to `internal.policyRegistry.processPremiumDistributionEvent` within `transactionManager.ts` was updated to `internal.policyRegistry.premiumDistribution.processPremiumDistributionEvent` after `premiumDistribution.ts` was created in Phase 3.
  - As noted for Phase 0, linter errors in `convex/policyRegistry.ts` regarding missing types are expected due to the ongoing refactoring and commented-out code. These will gradually resolve.

### Phase 2: Policy Lifecycle Operations

- **Step 2.1: Extract `policyLifecycle.ts`** 🟢

  - **Action:** Create `convex/policyRegistry/policyLifecycle.ts`.
  - **Responsibilities:** Handles policy creation and status updates.
  - **Key Functions to Move:**
    - `requestPolicyCreation` (action)
    - `determinePolicyPositionType` (internal function)
    - `createPolicyEvent` (internal mutation)
    - `updatePolicyStatus` (internal mutation)
    - Helper functions: `daysToBlockHeight`, `usdToSats`, `btcToSats`
  - **Updates:** Adjust imports and exports. Original functions commented out in `convex/policyRegistry.ts`. Re-export `requestPolicyCreation`.
  - **Rationale:** Centralizes the core policy lifecycle management.

- **Step 2.2: Extract `settlementServices.ts`** 🟢

  - **Action:** Create `convex/policyRegistry/settlementServices.ts`.
  - **Responsibilities:** Manages the settlement process for exercised policies.
  - **Key Functions to Move:**
    - `requestPolicySettlement` (mutation)
    - `updatePolicyToSettled` (internal mutation)
    - `calculateSettlementAmount` (internal function)
    - `preparePolicySettlementTransaction` (internal function)
  - **Updates:** Adjust imports and exports. Original functions commented out in `convex/policyRegistry.ts`. Re-export `requestPolicySettlement`.
  - **Rationale:** Groups settlement logic in one cohesive module.

- **Step 2.3: Extract `eventTracking.ts`** 🟢
  - **Action:** Create `convex/policyRegistry/eventTracking.ts`.
  - **Responsibilities:** Manages the creation and tracking of policy events.
  - **Key Functions to Move:**
    - `createPolicyEvent` (internal mutation - moved from `policyLifecycle.ts` where it landed in Step 2.1).
    - Any helper functions related to event creation and tracking (none identified).
    - Event-related internal functions (none identified).
  - **Updates:** Adjust imports and exports. Update callers (`updatePolicyStatus` in `policyLifecycle.ts`, `updatePolicyToSettled` in `settlementServices.ts`) to use the new path `internal.policyRegistry.eventTracking.createPolicyEvent`.
  - **Rationale:** Separates event management from core policy operations.

#### Phase 2: Notes and Comments

- **`policyLifecycle.ts` (Step 2.1):** Created and populated. Moved `createPolicyEvent` out in Step 2.3. Updated call to `calculatePremiumForPolicyCreation` to use the new internal query path after Step 3.1.
- **`settlementServices.ts` (Step 2.2):** Created and populated.
- **`eventTracking.ts` (Step 2.3):** Created and populated by moving `createPolicyEvent` from `policyLifecycle.ts`. Call sites updated.
- **Reminder:** `determinePolicyPositionType` was exported from `policyLifecycle.ts` for temporary use by `acceptPolicyOfferByCounterparty` (still in `convex/policyRegistry.ts`). This dependency might change when `acceptPolicyOfferByCounterparty` is moved in Phase 4.

### Phase 3: Financial & Premium Management

- **Step 3.1: Extract `premiumServices.ts`** 🟢

  - **Action:** Create `convex/policyRegistry/premiumServices.ts`.
  - **Responsibilities:** Handles premium calculation and management.
  - **Key Functions to Move:**
    - `calculatePremiumForPolicyCreation` (internal function - converted to `internalQuery`).
    - Premium-related interfaces and helper functions (none identified besides types already moved).
  - **Updates:** Adjust imports and exports. Original function commented out in `convex/policyRegistry.ts`. Updated call site in `policyLifecycle.ts`.
  - **Rationale:** Centralizes premium management functionality.

- **Step 3.2: Extract `premiumDistribution.ts`** 🟢
  - **Action:** Create `convex/policyRegistry/premiumDistribution.ts`.
  - **Responsibilities:** Manages premium distribution to counterparties.
  - **Key Functions to Move:**
    - `initiatePremiumDistributionForExpiredPolicy` (internal action)
    - `processPremiumDistributionEvent` (internal mutation)
    - `mockNotifyLiquidityPoolOfPremiumDistribution` (helper/mock - imported from `../mocks`)
  - **Updates:** Adjust imports and exports. Original functions commented out/removed from `convex/policyRegistry.ts`. Updated call site (`processPremiumDistributionEvent`) in `transactionManager.ts`.
  - **Rationale:** Isolates premium distribution logic for better maintenance.

#### Phase 3: Notes and Comments

- **`premiumServices.ts` (Step 3.1):** Created and populated. `calculatePremiumForPolicyCreation` converted to an `internalQuery`.
- **`premiumDistribution.ts` (Step 3.2):** Created and populated. Imported mock from `../mocks`. Call site in `transactionManager.ts` updated.

### Phase 4: Counterparty & Specialization

- **Step 4.1: Extract `counterpartyOperations.ts`** 🟢

  - **Action:** Create `convex/policyRegistry/counterpartyOperations.ts`.
  - **Responsibilities:** Handles counterparty-specific operations.
  - **Key Functions to Move:**
    - `acceptPolicyOfferByCounterparty` (mutation)
    - `getCounterpartyIncomeStats` (query)
    - `preparePolicyAcceptanceTransaction` (internal function - moved and remains un-exported helper in `counterpartyOperations.ts`)
  - **Updates:** Adjust imports and exports. Original functions commented out in `convex/policyRegistry.ts`. `getCounterpartyIncomeStats` and `acceptPolicyOfferByCounterparty` re-exported from `convex/policyRegistry.ts`.
  - **Rationale:** Groups counterparty-specific functionality.

- **Step 4.2: Extract `reconciliation.ts`** 🟢
  - **Action:** Create `convex/policyRegistry/reconciliation.ts`.
  - **Responsibilities:** Handles reconciliation between on-chain and off-chain state.
  - **Key Functions to Move:**
    - Any existing reconciliation functions or scheduled jobs (None identified in `convex/policyRegistry.ts` for immediate move).
    - Placeholder for future reconciliation logic (File created with comments and example structure).
  - **Updates:** Adjust imports and exports (No re-exports needed from `convex/policyRegistry.ts` as no public functions were moved here).
  - **Rationale:** Prepares for future state reconciliation functionality.

### Phase 5: Cleanup and Final Review

- **Step 5.1: Update Original `convex/policyRegistry.ts`** 🟢

  - **Action:** After all modules are populated, thoroughly review the original `convex/policyRegistry.ts` file.
  - **Goal:** This file should be significantly reduced in size, ideally becoming a lean re-export layer.
  - **Implementation:** Replaced implementation with re-exports from the new modules. All commented-out code (original function bodies) and functions that were moved (like `calculatePremiumForPolicyCreation`) have been removed from `convex/policyRegistry.ts`, leaving only necessary imports and the re-export statements for the public API.

- **Step 5.2: Final Import/Export Validation** 🟢

  - **Action:** Systematically check all newly created modules for correct import paths and ensure that all functions are correctly exported.
  - **Goal:** Ensure complete functionality with the new modular structure.
  - **Implementation:** Reviewed all created modules (`types.ts`, `queries.ts`, `transactionManager.ts`, `eligibilityChecks.ts`, `policyLifecycle.ts`, `settlementServices.ts`, `eventTracking.ts`, `premiumServices.ts`, `premiumDistribution.ts`, `counterpartyOperations.ts`, `reconciliation.ts`) and the main `convex/policyRegistry.ts`. Verified import paths (relative for intra-module, correct for Convex specifics). Verified that public functions are exported and internal helpers are not, maintaining API consistency. Corrected `settlementServices.ts` to import `mockGetLatestBlockHeight` from `eligibilityChecks.ts`.

- **Step 5.3: Verify Convex API Generation** 🟢
  - **Action:** Confirm that Convex's code generation process (`convex/_generated/api.ts`) runs without errors and accurately reflects the new modular structure.
  - **Goal:** Ensure that the refactoring does not break the API generation.
  - **Implementation:** Ran `npx convex dev`. Code generation completed successfully despite a lingering (unrelated) type error in `crons.ts`. Inspected `convex/_generated/api.d.ts` and confirmed that `api.policyRegistry.*` correctly reflects the functions re-exported from `convex/policyRegistry.ts`.

## 6. Execution and Review Process

- **Iterative Execution:** Each step outlined above will be executed sequentially.
- **Communication:** Upon completion of each significant step, report on the changes made.
- **Review:** Review changes after each step to ensure correctness and alignment with the plan.
- **`internal` Functions:** Functions designated as `internalQuery`, `internalMutation`, or `internalAction` will be maintained as internal to their respective modules or the broader `convex/policyRegistry/` scope.

## 7. Assessing Success

The successful completion of this refactoring will be assessed based on the following criteria:

- **Modular Structure:** The `convex/policyRegistry.ts` file is substantially reduced in size, with its functionalities cleanly distributed across the new modules.
- **Clear Responsibilities:** Each new module has a well-defined and distinct responsibility.
- **Maintainability:** The codebase is easier to navigate, understand, and modify.
- **No Functional Regression:** The refactoring should not introduce any changes to the existing external behavior.
- **Convex Generation:** The Convex framework successfully generates the `convex/_generated/api.ts` file without errors.
- **Code Integrity:** All original logic is preserved and correctly relocated.

This plan provides a structured and incremental approach to refactoring `convex/policyRegistry.ts`, aiming for a significantly more robust and maintainable system.
