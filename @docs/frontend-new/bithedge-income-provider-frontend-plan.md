# BitHedge: Income Provider Frontend Integration Plan

## 1. Introduction

This plan details the steps required to integrate the "Income Provider" (Irene) user flow into the existing BitHedge frontend components. The current implementation primarily supports the "Protection Buyer" (Peter) flow. This plan aims to make the UI dynamic based on the role selected in `PremiumCalculatorTabs.tsx`, ensuring a seamless experience within the simplified single-page application designed for the MVP.

This plan assumes the completion of Area 1 (Convex Client & Wallet Provider Setup) from `@docs/frontend-new/bithedge-frontend-convex-integration-plan.md`. It focuses on adapting existing components and integrating provider-specific logic and Convex interactions.

## 2. Task Status Legend

| Status      | Symbol | Description                                   |
| ----------- | ------ | --------------------------------------------- |
| Not Started | ⬜     | Task has not been started yet                 |
| In Progress | 🟡     | Task is actively being worked on              |
| Blocked     | 🔴     | Task is blocked by unresolved dependencies    |
| Testing     | 🟣     | Implementation complete, currently in testing |
| Completed   | 🟢     | Task fully completed and verified             |
| Deferred    | ⚪     | Task postponed to a future development cycle  |

## 3. Overall Progress Dashboard

| Implementation Area                     | Total Tasks | Not Started | In Progress | Completed | Completion % |
| --------------------------------------- | ----------- | ----------- | ----------- | --------- | ------------ |
| 1. State Management & Role Propagation  | 3           | 3           | 0           | 0         | 0%           |
| 2. Dynamic Component UI (Provider View) | 12          | 12          | 0           | 0         | 0%           |
| 3. Copy & Terminology Updates           | 5           | 5           | 0           | 0         | 0%           |
| 4. Convex Integration (Provider Logic)  | 8           | 8           | 0           | 0         | 0%           |
| **Overall Project**                     | **28**      | **28**      | **0**       | **0**     | **0%**       |

_Note: Task counts and estimates are initial values and may be refined._

## 4. Key Implementation Areas

### Area 1: State Management & Role Propagation

**Goal**: Ensure the selected user role (Buyer vs. Provider) is tracked and communicated to the relevant components.

| Task ID | Description                                                                                                                                       | Est. Hours                                                        | Status | Dependencies                                  | Assignee                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------ | --------------------------------------------- | ------------------------------------ | --- |
| SRP-101 | Identify/Refactor the parent component that renders the sections below `PremiumCalculatorTabs.tsx`.                                               | 1                                                                 | ⬜     | Understanding of `src/app/page.tsx` structure |                                      |
| SRP-102 | Lift state up or use Context: Manage `currentUserRole: 'buyer'                                                                                    | 'provider'`state in the parent component, derived from`tabIndex`. | 2      | ⬜                                            | SRP-101, `PremiumCalculatorTabs.tsx` |     |
| SRP-103 | Propagate `currentUserRole` down to child components (`ProtectionParameters`, `ProtectionVisualization`, `ProtectionCost`, `AdvancedParameters`). | 1.5                                                               | ⬜     | SRP-102                                       |                                      |

### Area 2: Dynamic Component UI (Provider View)

**Goal**: Modify existing components to conditionally render UI elements specific to the Income Provider flow based on the `currentUserRole` state.

| Task ID | Description                                                                                                                                                                                                  | Est. Hours | Status | Dependencies                                                                         | Assignee |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ | ------------------------------------------------------------------------------------ | -------- |
| DCU-201 | **ProtectionParameters:** Add conditional rendering logic based on `currentUserRole`.                                                                                                                        | 1          | ⬜     | SRP-103, `ProtectionParameters.tsx`                                                  |          |
| DCU-202 | **ProtectionParameters:** Implement "Risk-Reward Tier" selection UI (e.g., cards/buttons) for provider view.                                                                                                 | 2.5        | ⬜     | DCU-201, `@docs/frontend-new/bithedge-income-provider-center-streamlined-ux-spec.md` |          |
| DCU-203 | **ProtectionParameters:** Implement "Capital Commitment" selection UI (e.g., input field, quick-select buttons) for provider view.                                                                           | 2.5        | ⬜     | DCU-201, Provider UX Spec                                                            |          |
| DCU-204 | **ProtectionParameters:** Implement "Income Period" selection UI (e.g., duration cards/tabs) for provider view.                                                                                              | 2.5        | ⬜     | DCU-201, Provider UX Spec                                                            |          |
| DCU-205 | **ProtectionParameters:** Implement state management within the component to handle provider inputs.                                                                                                         | 2          | ⬜     | DCU-202, DCU-203, DCU-204                                                            |          |
| DCU-206 | **ProtectionVisualization:** Add conditional rendering logic based on `currentUserRole`.                                                                                                                     | 1          | ⬜     | SRP-103, `ProtectionVisualization.tsx`                                               |          |
| DCU-207 | **ProtectionVisualization:** Adapt the chart component to display potential income/loss scenarios for selling protection (provider view). Consider using or adapting existing chart library.                 | 4          | ⬜     | DCU-206, Provider UX Spec                                                            |          |
| DCU-208 | **ProtectionVisualization:** Update summary boxes below the chart to display provider-relevant metrics (e.g., Max Potential Yield, Strike Price Provided, Break-even for Provider).                          | 2          | ⬜     | DCU-206, Provider UX Spec                                                            |          |
| DCU-209 | **ProtectionCost:** Add conditional rendering logic based on `currentUserRole`.                                                                                                                              | 1          | ⬜     | SRP-103, `ProtectionCost.tsx`                                                        |          |
| DCU-210 | **ProtectionCost:** Change main display from "Protection Cost" to "Potential Income / Estimated Yield". Update value calculation and display (STX/BTC earned, APY).                                          | 2.5        | ⬜     | DCU-209, Provider UX Spec                                                            |          |
| DCU-211 | **ProtectionCost:** Update sub-cards/breakdown to show provider metrics (e.g., Yield Rate, Capital Efficiency).                                                                                              | 1.5        | ⬜     | DCU-209, Provider UX Spec                                                            |          |
| DCU-212 | **ProtectionCost:** Change the main call-to-action button text and associated action handler based on `currentUserRole` (e.g., "Commit Capital").                                                            | 1          | ⬜     | DCU-209                                                                              |          |
| DCU-213 | **AdvancedParameters:** Add conditional rendering logic or adjust defaults/labels based on `currentUserRole` if necessary (e.g., Risk-Free Rate might be less relevant for provider yield calculation view). | 1.5        | ⬜     | SRP-103, `AdvancedParameters.tsx`                                                    |          |

### Area 3: Copy & Terminology Updates

**Goal**: Ensure all text labels, descriptions, and tooltips dynamically reflect the selected user role and adhere to the insurance metaphor.

| Task ID | Description                                                                                                                   | Est. Hours | Status | Dependencies                                                                 | Assignee |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------- | -------- |
| CTU-301 | **ProtectionParameters:** Update all titles, labels, descriptions, and info tooltips based on `currentUserRole`.              | 2          | ⬜     | DCU-201, `@docs/frontend-new/bithedge-insurance-model-interface-approach.md` |          |
| CTU-302 | **ProtectionVisualization:** Update chart labels, axes, legend, summary box titles, and info text based on `currentUserRole`. | 1.5        | ⬜     | DCU-206, Insurance Model Doc                                                 |          |
| CTU-303 | **ProtectionCost:** Update titles, labels, and button text based on `currentUserRole`.                                        | 1          | ⬜     | DCU-209, Insurance Model Doc                                                 |          |
| CTU-304 | **AdvancedParameters:** Update titles, labels, and info text based on `currentUserRole` if needed.                            | 0.5        | ⬜     | DCU-213, Insurance Model Doc                                                 |          |
| CTU-305 | Review overall application copy for consistency between buyer and provider flows.                                             | 1          | ⬜     | Completion of CTU-301-304                                                    |          |

### Area 4: Convex Integration (Provider Logic)

**Goal**: Connect the Income Provider UI elements to the relevant Convex backend queries and mutations/actions, including transaction signing.

| Task ID | Description                                                                                                                                                                             | Est. Hours | Status | Dependencies                                               | Assignee |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------- | -------- |
| CIP-401 | **ProtectionParameters:** Connect provider inputs (Tier, Commitment, Period) to state and pass them to the yield calculation query.                                                     | 1.5        | ⬜     | DCU-205                                                    |          |
| CIP-402 | **ProtectionCost:** Implement `useQuery` hook calling the relevant Convex query for calculating potential provider yield (e.g., `api.premium.calculatePotentialYield`) based on inputs. | 2.5        | ⬜     | CIP-401, Convex `calculatePotentialYield` query ready      |          |
| CIP-403 | **ProtectionVisualization:** Connect chart data generation logic to use results from the potential yield query or a dedicated simulation query for providers.                           | 2          | ⬜     | CIP-402, DCU-207, Relevant Convex query ready              |          |
| CIP-404 | Create or adapt transaction hook (`useBitHedgeProviderTransaction`?) specifically for the provider flow (committing capital/selling protection).                                        | 1          | ⬜     | Understanding of `useBitHedgeTransaction.ts`               |          |
| CIP-405 | In provider hook: Implement `useMutation` for preparing the provider transaction data (e.g., `api.liquidity.prepareCommitment`).                                                        | 1.5        | ⬜     | CIP-404, Convex `prepareCommitment` action ready           |          |
| CIP-406 | In provider hook: Adapt transaction signing/broadcasting logic for the provider-specific smart contract interaction.                                                                    | 3          | ⬜     | CIP-404, CIP-405, Wallet integration (Area 1 of main plan) |          |
| CIP-407 | Connect the "Commit Capital" button in `ProtectionCost` to trigger the provider transaction hook.                                                                                       | 1          | ⬜     | DCU-212, CIP-406                                           |          |
| CIP-408 | Test end-to-end provider flow: Configure strategy, see potential yield, commit capital, sign transaction, verify on explorer.                                                           | 3          | ⬜     | CIP-407                                                    |          |

## 5. Implementation Strategy

1.  **State First (Area 1):** Implement the `currentUserRole` state management and propagation.
2.  **UI Scaffolding (Area 2):** Add the conditional rendering logic and basic UI structure for the provider view **within the existing components (`ProtectionParameters`, `ProtectionVisualization`, `ProtectionCost`, `AdvancedParameters`)**. This approach is preferred for the MVP to maintain simplicity and reduce code duplication. Avoid creating entirely separate component trees for the provider flow unless absolutely necessary.
3.  **Copy Updates (Area 3):** Populate the provider UI structure with the correct terminology.
4.  **Convex Connections (Area 4):** Connect the provider UI elements to Convex queries for displaying data (yield) and then implement the transaction hook for submitting provider actions.
5.  **Testing:** Test each component's dynamic behavior and the end-to-end flow for providers thoroughly.

## 6. Key Dependencies

- **Convex Backend**: Readiness of provider-specific Convex functions/actions (e.g., `calculatePotentialYield`, `prepareCommitment`).
- **UX Specifications**: Relies on `@docs/frontend-new/bithedge-income-provider-center-streamlined-ux-spec.md` for UI details and `@docs/frontend-new/bithedge-insurance-model-interface-approach.md` for terminology.
- **Completed Area 1 (Main Plan):** Assumes wallet and basic Convex client setup is functional.

## 7. Conclusion

This plan addresses the gap identified in the current frontend implementation by outlining the steps to make the UI fully dynamic for both Protection Buyers and Income Providers. Completing these tasks will result in a unified interface that adapts correctly based on user role selection, moving closer to the MVP goal.
