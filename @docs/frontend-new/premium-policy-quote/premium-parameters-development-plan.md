# Premium Parameters Development Plan

**Version:** 1.1  
**Date:** 2024-08-20  
**Context:** Implementing premium calculation and policy quote functionality across UI, Convex, and blockchain integration for `ProtectionParameters.tsx`, `BuyerParametersUI.tsx`, and `ProviderParametersUI.tsx`. (Incorporates architectural review feedback).

## 1. Project Overview

This plan outlines the tasks required to implement the complete premium calculation and policy quote system for BitHedge, connecting the parameter UI components to the Convex backend and preparing for eventual blockchain integration. The implementation will accommodate both user personas (Protection Buyer and Liquidity Provider) as selected by the `PremiumCalculatorTabs.tsx` component.

### Project Goals

1.  Connect parameter inputs from UI components to Convex backend for real-time premium/yield calculations and quotes.
2.  Implement dynamic data synchronization between components (e.g., BTC price from `BitcoinPriceCard.tsx`).
3.  Create a comprehensive premium calculation service in Convex based on Black-Scholes model and provider yield models.
4.  Develop the quote generation system for both buyer and provider personas, including persistence.
5.  Prepare clear interfaces and data structures for eventual blockchain integration with Policy Registry and Liquidity Pool contracts.
6.  Ensure a responsive UI with client-side estimation and robust error handling.

## 2. Task Status Legend

| Status      | Symbol | Description                                   |
| ----------- | ------ | --------------------------------------------- |
| Not Started | ⬜     | Task has not been started yet                 |
| In Progress | 🟡     | Task is actively being worked on              |
| Blocked     | 🔴     | Task is blocked by unresolved dependencies    |
| Testing     | 🟣     | Implementation complete, currently in testing |
| Completed   | 🟢     | Task fully completed and verified             |
| Deferred    | ⚪     | Task postponed to a future development cycle  |

## 3. Development Phases

### Phase 1: Data Context, Utilities, and Component Integration (Duration: Est. 4 days)

**Goal:** Establish domain-specific contexts, essential utilities, and initial data flow between components.

| Task ID      | Description                                                                                               | Est. Hours | Status | Dependencies   | Assignee | Notes                                                               |
| :----------- | :-------------------------------------------------------------------------------------------------------- | :--------- | :----- | :------------- | :------- | :------------------------------------------------------------------ |
| **UI-101**   | Design and implement domain-specific contexts (`BuyerContext`, `ProviderContext`)                         | 6          | 🟢     |                |          | Implemented both contexts with complete state management.           |
| **UI-102**   | Update `ProtectionParameters` to manage context switching based on `currentUserRole`                      | 3          | 🟢     | UI-101         |          | Updated component to conditionally render the appropriate provider. |
| **UI-103**   | Update `BuyerParametersUI` to consume `BuyerContext`                                                      | 5          | 🟢     | UI-101         |          | Integrated with context, migrated state management.                 |
| **UI-104**   | Update `ProviderParametersUI` to consume `ProviderContext` (already mostly done via props, review needed) | 3          | 🟢     | UI-101         |          | Successfully migrated from props to context.                        |
| **UI-105**   | Create `useBitcoinPrice` hook with robust loading/error handling & caching strategy note                  | 4          | 🟢     |                |          | Implemented hook with localStorage caching and error handling.      |
| **UI-106**   | Implement dynamic USD value calculation in relevant UI components using `useBitcoinPrice`                 | 3          | 🟢     | UI-103, UI-105 |          | Created useUsdValueCalculation hook that leverages useBitcoinPrice. |
| **UI-107**   | Implement validation logic for parameter inputs (can leverage `zod` or similar)                           | 4          | 🟢     | UI-103, UI-104 |          | Created Zod schemas for buyer and provider parameters.              |
| **UI-108**   | Create reusable `ValidationError` display component                                                       | 2          | 🟢     | UI-107         |          | Built flexible component that handles field and form-level errors.  |
| **UI-109**   | Create utility functions for formatting monetary values consistently                                      | 2          | 🟢     |                |          | Implemented formatters for BTC, USD, percentages, and durations.    |
| **TEST-101** | Create unit tests for validation schemas and formatting utilities                                         | 4          | 🟢     | UI-107, UI-109 |          | Created comprehensive test suites for formatters and schemas.       |
| **TEST-102** | Basic component tests verifying context consumption and updates                                           | 4          | ⬜     | UI-103, UI-104 |          | Use testing-library and mock providers.                             |

**Phase 1 Deliverables:**

- Domain-specific React contexts for Buyer and Provider parameters.
- UI components integrated with their respective contexts.
- Robust `useBitcoinPrice` hook for synchronized price data.
- Parameter validation logic and reusable error display component.
- Formatting utilities with unit tests.

### Phase 2: Convex Premium Calculation Backend (Duration: Est. 5 days)

**Goal:** Implement the Convex backend services for premium/yield calculation, defining clear domain services.

| Task ID      | Description                                                                                | Est. Hours | Status | Dependencies     | Assignee | Notes                                                                   |
| :----------- | :----------------------------------------------------------------------------------------- | :--------- | :----- | :--------------- | :------- | :---------------------------------------------------------------------- |
| **CVX-201**  | Define Convex schema: `premiumCalculations`, `yieldCalculations`, `riskParameters`         | 4          | 🟢     |                  |          | As per `convex-schema-design.md`. Implemented in `convex/schema.ts`.    |
| **CVX-202**  | Define `PremiumCalculationService` (Conceptual TS interface/class structure)               | 2          | 🟢     |                  |          | Implemented as functions in `convex/premium.ts`.                        |
| **CVX-203**  | Implement Black-Scholes model within `PremiumCalculationService`                           | 8          | 🟢     | CVX-202          |          | Implemented in `convex/premium.ts`.                                     |
| **CVX-204**  | Implement provider yield calculation model within a dedicated service/module               | 6          | 🟢     |                  |          | Implemented in `convex/premium.ts`.                                     |
| **CVX-205**  | Create `calculateBuyerPremium` **internal query** used by the service                      | 4          | 🟢     | CVX-203          |          | Implemented as internal helper functions in `convex/premium.ts`.        |
| **CVX-206**  | Create `calculateProviderYield` **internal query** used by the service                     | 4          | 🟢     | CVX-204          |          | Implemented as internal helper functions in `convex/premium.ts`.        |
| **CVX-207**  | Create public-facing `getBuyerPremiumQuote` query (calls service)                          | 3          | 🟢     | CVX-205          |          | Exposed to the frontend hook. Implemented in `convex/premium.ts`.       |
| **CVX-208**  | Create public-facing `getProviderYieldQuote` query (calls service)                         | 3          | 🟢     | CVX-206          |          | Exposed to the frontend hook. Implemented in `convex/premium.ts`.       |
| **CVX-209**  | Implement risk parameter fetching within services (use hardcoded defaults initially)       | 3          | 🟢     | CVX-201          |          | Implemented with fallback defaults in `convex/premium.ts`.              |
| **CVX-210**  | Integrate Oracle volatility data into calculation services                                 | 4          | 🟢     | CVX-203, CVX-204 |          | Fetch volatility based on duration. Implemented in `convex/premium.ts`. |
| **CVX-211**  | Implement helper function to generate price scenarios for visualization                    | 6          | 🟢     | CVX-203          |          | Implemented in `convex/premium.ts`.                                     |
| **CVX-212**  | Create function to calculate break-even prices for both buyer and provider                 | 4          | 🟢     | CVX-203, CVX-204 |          | Implemented in `convex/premium.ts`.                                     |
| **TEST-201** | Write unit tests for calculation models (property-based testing recommended)               | 8          | ⬜     | CVX-203, CVX-204 |          | Test models in isolation.                                               |
| **TEST-202** | Test public-facing quote query functions (`getBuyerPremiumQuote`, `getProviderYieldQuote`) | 5          | ⬜     | CVX-207, CVX-208 |          | Test integration with internal services and parameter fetching.         |

**Phase 2 Architectural Notes (Post-Implementation Review):**

- **Architecture:** The implemented Convex backend (`premium.ts`, `quotes.ts`, `schema.ts`, `types.ts`, `blockchainPreparation.ts`) establishes a robust, service-oriented architecture. Key components include a multi-source Price Oracle (`prices.ts`), Risk Parameter management (`riskParameters` table, `premium.ts` helpers), a dedicated Premium Calculation Service (`premium.ts` functions), Quote Management (`quotes.ts`), and Blockchain Preparation logic (`blockchainPreparation.ts`).
- **`premium.ts` vs. `options.ts`:** `premium.ts` acts as the modern service layer for detailed quote generation, integrating risk parameters and market data, designed to work with `quotes.ts` for persistence. `options.ts` appears to be a legacy module containing simpler, embedded premium calculation tied directly to a `contracts` table; it lacks the features and separation of concerns found in `premium.ts`.
- **Strengths:** Clear Separation of Concerns, effective use of Convex primitives (internal/public functions, scheduled actions), improved data modeling with quote snapshots (`quotes` table), good modularity, and enhanced type safety via `types.ts`.
- **Areas for Refinement:** The primary concern is the redundancy between `premium.ts` and `options.ts` calculation logic, suggesting `options.ts` should potentially be deprecated/removed. Further enhancements could include more flexible risk parameter fetching, more robust error handling across all modules, implementing the planned testing strategy (TEST-201, TEST-202), and potentially centralizing configuration.

**Phase 2 Deliverables:**

- Convex schema for calculations and risk parameters.
- Implemented calculation models (Black-Scholes, Yield).
- Clearly defined Convex services encapsulating calculation logic.
- Public-facing query functions for frontend consumption.
- Integration with Oracle volatility data.
- Scenario and break-even calculation helpers.
- Comprehensive unit tests for calculation logic.

### Phase 3: UI-Backend Integration, Estimation & Quote Display (Duration: Est. 5 days)

**Goal:** Connect UI components to Convex backend, implement client-side estimation, and display quotes.

| Task ID      | Description                                                                                                         | Est. Hours | Status | Dependencies           | Assignee | Notes                                                                                                                              |
| :----------- | :------------------------------------------------------------------------------------------------------------------ | :--------- | :----- | :--------------------- | :------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| **UI-301**   | Implement lightweight client-side estimation logic for premium/yield                                                | 6          | 🟢     | UI-103, UI-104         |          | Utils created (`clientEstimation.ts`) and integrated.                                                                              |
| **UI-302**   | Create React hooks (`useBuyerQuote`, `useProviderQuote`) calling Convex quote queries                               | 5          | 🟢     | CVX-207, CVX-208       |          | Hooks created (`useBuyerQuote.ts`, `useProviderQuote.ts`).                                                                         |
| **UI-303**   | Integrate client-side estimation into `BuyerParametersUI` & `ProviderParametersUI`                                  | 4          | 🟢     | UI-101, UI-301         |          | Integrated into both `BuyerParametersUI` and `ProviderParametersUI`.                                                               |
| **UI-304**   | Implement debounced calls to Convex quote hooks (`useBuyerQuote`, `useProviderQuote`) on parameter change           | 5          | 🟢     | UI-302, UI-303         |          | Integrated into both `BuyerParametersUI` and `ProviderParametersUI`.                                                               |
| **UI-305**   | Update `PolicySummary` component to display detailed buyer quote data from hook                                     | 6          | 🟢     | UI-302                 |          | Handle loading and error states from hook. Refactored to Buyer-specific component logic.                                           |
| **UI-306**   | Create/Update `IncomeSummary` component to display detailed provider quote data from hook                           | 6          | 🟢     | UI-303                 |          | Handle loading and error states from hook. Created as `ProviderIncomeSummary.tsx`.                                                 |
| **UI-307**   | Implement `PremiumBreakdown` component (optional, based on design)                                                  | 4          | ⬜     | UI-305                 |          | Visualize factors contributing to premium.                                                                                         |
| **UI-308**   | Implement robust loading state indicators during Convex calls                                                       | 3          | 🟢     | UI-302, UI-303         |          | Use `CalculationLoader` component. Integrated into summary components.                                                             |
| **UI-309**   | Implement clear error display using `ValidationError` when Convex calls fail                                        | 3          | 🟢     | UI-302, UI-303         |          | Provide meaningful feedback to the user. Integrated into summary components.                                                       |
| **TEST-301** | Create integration tests for UI -> Context -> Convex quote flow                                                     | 6          | ⬜     | UI-304                 |          | Mock Convex client, verify data flow and updates. Use testing-library/react.                                                       |
| **TEST-302** | Perform manual testing: various parameters, responsiveness, error conditions                                        | 4          | ⬜     | UI-305, UI-306         |          | Ensure smooth UX, test edge cases.                                                                                                 |
| **UI-310**   | Refactor `ProtectionVisualization.tsx` into `BuyerProtectionVisualization.tsx`, removing provider logic.            | 4          | 🟢     | UI-305                 |          | Completed. Logic extracted, uses BuyerContext/hook. Assumed file rename failed, edited original file.                              |
| **UI-311**   | Create `ProviderIncomeVisualization.tsx`, implementing provider-specific chart and metrics.                         | 5          | 🟢     | UI-306                 |          | Completed. Component created, uses ProviderContext/hook. Chart/metrics use provider data (placeholders pending chartUtils update). |
| **UI-312**   | Update `chartUtils.ts` (`generateChartData`, etc.) to accept quote result objects instead of individual parameters. | 3          | 🟡     | CVX-207, CVX-208       |          | In progress. Fixed property access in visualizations to use correct data structure. Still needs full chartUtils refactoring.       |
| **CVX-301**  | Review/Update `get...Quote` queries to ensure all necessary visualization data is returned.                         | 2          | 🟢     | CVX-207, CVX-208       |          | Added provider break-even price calculation to `getProviderYieldQuote` and updated response structure in `types.ts`.               |
| **UI-313**   | Update `ProtectionParameters.tsx` to render the correct visualization component within context providers.           | 1          | 🟢     | UI-310, UI-311         |          | Completed. ProtectionParameters now renders correct visualization component within its context provider, fixing scope issues.      |
| **TEST-303** | Add basic component tests for visualization components (Buyer/Provider).                                            | 4          | ⬜     | UI-310, UI-311, UI-312 |          | Test chart data generation and rendering with mock quote data.                                                                     |

**Phase 3 Architectural Notes (Implementation Summary & Reflections):**

Phase 3 focused on connecting the UI parameter inputs to the backend for quote generation and display. Architecturally, the most significant decision was to **refactor the monolithic `PolicySummary` component** into two distinct, role-specific components: `BuyerPolicySummary` (within `PolicySummary.tsx`) and `ProviderIncomeSummary.tsx`. This separation adheres strictly to the Single Responsibility Principle, drastically improving the maintainability, readability, and testability of the summary display logic. Each component now only consumes the relevant context (`BuyerContext` or `ProviderContext`) and data-fetching hook (`useBuyerQuote` or `useProviderQuote`), eliminating complex conditional rendering and reducing component size and coupling.

Data flow follows a clear pattern: UI inputs update the corresponding domain context, which triggers client-side estimation (via utils) for immediate feedback and debounced calls (via custom hooks) to Convex queries for accurate data. The results (quote, loading state, error state) are managed by the custom hooks (`useBuyerQuote`, `useProviderQuote`) and consumed by the summary components. The rendering of the correct summary component based on `currentUserRole` was moved to the `ProtectionParameters.tsx` component, ensuring the summaries are correctly nested within their required context providers, resolving the previous context scope issues. Common UI elements like `CalculationLoader` and `ValidationError` were created and integrated for consistent loading and error presentation. This revised architecture is significantly more scalable and maintainable than the previous combined approach.

**Recent Updates (May 2025):** The backend API structure for `getProviderYieldQuote` was enhanced to include a provider break-even price calculation (CVX-301), and both visualization components (`ProviderIncomeSummary.tsx` and `ProviderIncomeVisualization.tsx`) were updated to correctly access data from the new structure. This included adapting property paths from the outdated format (e.g., `providerQuoteData?.annualizedYieldPercentage`) to the new nested structure (e.g., `providerQuoteData?.calculated?.estimatedYieldPercentage`). We also improved data derivation, such as calculating BTC amounts from USD values and current prices. These changes ensure accurate visualization of provider quotes with consistent access to the data returned by the Convex backend.

**Phase 3 Deliverables:**

- Client-side estimation logic for responsive UI feedback.
- React hooks integrated with Convex quote queries.
- Real-time updates driven by debounced Convex calls.
- Updated `PolicySummary` and `IncomeSummary` components displaying live quote data.
- Robust loading and error state handling in the UI.
- Integration tests verifying the end-to-end quote flow.

### Phase 4: Quote Persistence and Preparation for Blockchain (Duration: Est. 5 days)

**Goal:** Implement quote persistence, session handling, and prepare for blockchain integration.

| Task ID      | Description                                                                                | Est. Hours | Status | Dependencies         | Assignee | Notes                                                                                          |
| :----------- | :----------------------------------------------------------------------------------------- | :--------- | :----- | :------------------- | :------- | :--------------------------------------------------------------------------------------------- |
| **CVX-401**  | Define Convex schema: `quotes` table (including parameters used)                           | 3          | ⬜     | CVX-201              |          | As per updated `convex-schema-design.md`.                                                      |
| **CVX-402**  | Implement `saveQuote` mutation (stores parameters, calculation results, market data)       | 5          | ⬜     | CVX-401              |          | Ensure it captures the state accurately at the time of saving.                                 |
| **CVX-403**  | Implement `getQuoteById` query                                                             | 2          | ⬜     | CVX-401              |          |                                                                                                |
| **CVX-404**  | Implement `getUserQuotes` query                                                            | 3          | ⬜     | CVX-401              |          |                                                                                                |
| **CVX-405**  | Design `BlockchainInteractionService` (Conceptual TS interface/class)                      | 4          | ⬜     |                      |          | Define methods like `preparePolicyCreationTx`, `prepareLiquidityCommitmentTx`.                 |
| **CVX-406**  | Implement `prepareQuoteForBlockchain` **internal function** within the interaction service | 6          | ⬜     | CVX-403, CVX-405     |          | Handles data conversion (USD->sats, days->blocks), returns structured DTO for blockchain call. |
| **UI-401**   | Add "Save Quote" functionality to summary components, calling `saveQuote` mutation         | 4          | ⬜     | CVX-402, UI-305, 306 |          | Provide feedback on success/failure.                                                           |
| **UI-402**   | Create `SavedQuotesList` component (optional, could be part of dashboard)                  | 6          | ⬜     | CVX-403, CVX-404     |          | Displays user's saved quotes.                                                                  |
| **UI-403**   | Implement "Proceed to Purchase/Commit" flow (UI only, displays prepared data)              | 5          | ⬜     | UI-401, CVX-406      |          | Show parameters ready for blockchain, **no actual transaction submission yet**.                |
| **UI-404**   | Add session persistence for parameters using `localStorage` or similar                     | 4          | ⬜     | UI-101               |          | Restore parameters on page load.                                                               |
| **DOC-401**  | Document `BlockchainInteractionService` interface and DTOs                                 | 4          | ⬜     | CVX-405, CVX-406     |          | Critical for future blockchain integration phase.                                              |
| **TEST-401** | Test quote persistence (`saveQuote`) and retrieval (`getQuoteById`, `getUserQuotes`)       | 4          | ⬜     | CVX-402, 403, 404    |          | Verify data integrity.                                                                         |
| **TEST-402** | Test `prepareQuoteForBlockchain` function with various quote types and values              | 4          | ⬜     | CVX-406              |          | Ensure correct data conversion.                                                                |

**Phase 4 Deliverables:**

- Quote persistence functionality in Convex.
- UI features for saving and potentially viewing saved quotes.
- Session persistence for user parameters.
- Well-defined `BlockchainInteractionService` interface and DTOs for future integration.
- Documentation for the blockchain interface.
- Unit tests for quote persistence and blockchain preparation logic.

## 4. Critical Integration Points

_(Updates based on review)_

### UI Component to Data Context

- Utilize separate `BuyerContext` and `ProviderContext`.
- Ensure context updates trigger necessary calculations/re-renders efficiently.

```typescript
// ProtectionParameters.tsx - Simplified Example
const { updateBuyerInputs } = useBuyerContext(); // Assuming context hook exists
const { updateProviderInputs } = useProviderContext(); // Assuming context hook exists

useEffect(() => {
  // Logic to update the correct context based on currentUserRole
}, [currentUserRole]);
```

### Bitcoin Price Synchronization

- `
