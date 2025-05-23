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
| 1. State Management & Role Propagation  | 3           | 0           | 0           | 3         | 100%         |
| 2. Dynamic Component UI (Provider View) | 13          | 1           | 0           | 12        | ~92%         |
| 3. Copy & Terminology Updates           | 5           | 5           | 0           | 0         | 0%           |
| 4. Convex Integration (Provider Logic)  | 8           | 8           | 0           | 0         | 0%           |
| **Overall Project**                     | **29**      | **14**      | **0**       | **15**    | **~52%**     |

_Note: Task counts and estimates are initial values and may be refined. Adjusted Area 2 count._

## 4. Key Implementation Areas

### Area 1: State Management & Role Propagation

**Goal**: Ensure the selected user role (Buyer vs. Provider) is tracked and communicated to the relevant components.

| Task ID | Description                                                                                                                                      | Est. Hours                                                        | Status | Dependencies                                  | Assignee                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------ | --------------------------------------------- | ------------------------------------ | --- |
| SRP-101 | Identify/Refactor the parent component that renders the sections below `PremiumCalculatorTabs.tsx`.                                              | 1                                                                 | 🟢     | Understanding of `src/app/page.tsx` structure |                                      |
| SRP-102 | Lift state up or use Context: Manage `currentUserRole: 'buyer'                                                                                   | 'provider'`state in the parent component, derived from`tabIndex`. | 2      | 🟢                                            | SRP-101, `PremiumCalculatorTabs.tsx` |     |
| SRP-103 | Propagate `currentUserRole` down to child components (`ProtectionParameters`, `ProtectionVisualization`, `PolicySummary`, `AdvancedParameters`). | 1.5                                                               | 🟢     | SRP-102                                       |                                      |

### Area 2: Dynamic Component UI (Provider View)

**Goal**: Modify existing components to conditionally render UI elements specific to the Income Provider flow based on the `currentUserRole` state.

| Task ID | Description                                                                                                                                                                                                  | Est. Hours | Status | Dependencies                                                                         | Assignee |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ | ------------------------------------------------------------------------------------ | -------- |
| DCU-201 | **ProtectionParameters:** Add conditional rendering logic based on `currentUserRole`. _(Refactored component internally into `BuyerParametersUI` and `ProviderParametersUI`)_                                | 1          | 🟢     | SRP-103, `ProtectionParameters.tsx`                                                  |          |
| DCU-202 | **ProtectionParameters:** Implement "Risk-Reward Tier" selection UI (e.g., cards/buttons) for provider view (`ProviderParametersUI`).                                                                        | 2.5        | 🟢     | DCU-201, `@docs/frontend-new/bithedge-income-provider-center-streamlined-ux-spec.md` |          |
| DCU-203 | **ProtectionParameters:** Implement "Capital Commitment" selection UI (e.g., input field, quick-select buttons) for provider view (`ProviderParametersUI`).                                                  | 2.5        | 🟢     | DCU-201, Provider UX Spec                                                            |          |
| DCU-204 | **ProtectionParameters:** Implement "Income Period" selection UI (e.g., duration cards/tabs) for provider view (`ProviderParametersUI`).                                                                     | 2.5        | 🟢     | DCU-201, Provider UX Spec                                                            |          |
| DCU-205 | **ProtectionParameters:** Implement state management within the component (`ProviderParametersUI`) to handle provider inputs. _(Addressed via lifting state to parent)_                                      | 2          | 🟢     | DCU-202, DCU-203, DCU-204                                                            |          |
| DCU-206 | **ProtectionVisualization:** Add conditional rendering logic based on `currentUserRole`.                                                                                                                     | 1          | 🟢     | SRP-103, `ProtectionVisualization.tsx`                                               |          |
| DCU-207 | **ProtectionVisualization:** Adapt the chart component to display potential income/loss scenarios for selling protection (provider view). Uses mock data.                                                    | 4          | 🟡     | DCU-206, Provider UX Spec, `chartUtils.ts`                                           |          |
| DCU-208 | **ProtectionVisualization:** Update summary boxes below the chart to display provider-relevant metrics (e.g., Max Potential Yield, Strike Price Provided, Break-even for Provider). Uses mock data.          | 2          | 🟢     | DCU-206, Provider UX Spec, `chartUtils.ts`                                           |          |
| DCU-209 | **PolicySummary:** Add conditional rendering logic based on `currentUserRole`. (Formerly `ProtectionCost`)                                                                                                   | 1          | 🟢     | SRP-103, `PolicySummary.tsx`                                                         |          |
| DCU-210 | **PolicySummary:** Change main display from "Protection Cost" to "Potential Income / Estimated Yield". Update value display (STX/BTC earned, APY). Uses mock data.                                           | 2.5        | 🟢     | DCU-209, Provider UX Spec                                                            |          |
| DCU-211 | **PolicySummary:** Update sub-cards/breakdown to show provider metrics (e.g., Yield Rate, Capital Efficiency). Uses mock data.                                                                               | 1.5        | 🟢     | DCU-209, Provider UX Spec                                                            |          |
| DCU-212 | **PolicySummary:** Change the main call-to-action button text and associated action handler based on `currentUserRole` (e.g., "Commit Capital"). Connects to console.log for now.                            | 1          | 🟢     | DCU-209                                                                              |          |
| DCU-213 | **AdvancedParameters:** Add conditional rendering logic or adjust defaults/labels based on `currentUserRole` if necessary (e.g., Risk-Free Rate might be less relevant for provider yield calculation view). | 1.5        | ⬜     | SRP-103, `AdvancedParameters.tsx`                                                    |          |

### Area 3: Copy & Terminology Updates

**Goal**: Ensure all text labels, descriptions, and tooltips dynamically reflect the selected user role and adhere to the insurance metaphor.

| Task ID | Description                                                                                                                   | Est. Hours | Status | Dependencies                                                                 | Assignee |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------- | -------- |
| CTU-301 | **ProtectionParameters:** Update all titles, labels, descriptions, and info tooltips based on `currentUserRole`.              | 2          | ⬜     | DCU-201, `@docs/frontend-new/bithedge-insurance-model-interface-approach.md` |          |
| CTU-302 | **ProtectionVisualization:** Update chart labels, axes, legend, summary box titles, and info text based on `currentUserRole`. | 1.5        | ⬜     | DCU-206, Insurance Model Doc                                                 |          |
| CTU-303 | **PolicySummary:** Update titles, labels, and button text based on `currentUserRole`. (Formerly `ProtectionCost`)             | 1          | ⬜     | DCU-209, Insurance Model Doc                                                 |          |
| CTU-304 | **AdvancedParameters:** Update titles, labels, and info text based on `currentUserRole` if needed.                            | 0.5        | ⬜     | DCU-213, Insurance Model Doc                                                 |          |
| CTU-305 | Review overall application copy for consistency between buyer and provider flows.                                             | 1          | ⬜     | Completion of CTU-301-304                                                    |          |

### Area 4: Convex Integration (Provider Logic)

**Goal**: Connect the Income Provider UI elements to the relevant Convex backend queries and mutations/actions, including transaction signing.

| Task ID | Description                                                                                                                                                                            | Est. Hours | Status | Dependencies                                                                | Assignee |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------- | -------- |
| CIP-401 | **ProtectionParameters:** Connect provider inputs (Tier, Commitment, Period) to state and pass them to the yield calculation query.                                                    | 1.5        | ⬜     | DCU-205, `PremiumDataContext`                                               |          |
| CIP-402 | **PolicySummary:** Implement `useQuery` hook calling the relevant Convex query for calculating potential provider yield (e.g., `api.premium.calculatePotentialYield`) based on inputs. | 2.5        | ⬜     | CIP-401, Convex `calculatePotentialYield` query ready, `PremiumDataContext` |          |
| CIP-403 | **ProtectionVisualization:** Connect chart data generation logic to use results from the potential yield query or a dedicated simulation query for providers.                          | 2          | ⬜     | CIP-402, DCU-207, Relevant Convex query ready, `PremiumDataContext`         |          |
| CIP-404 | Create or adapt transaction hook (`useBitHedgeProviderTransaction`?) specifically for the provider flow (committing capital/selling protection).                                       | 1          | ⬜     | Understanding of `useBitHedgeTransaction.ts`, `PremiumDataContext`          |          |
| CIP-405 | In provider hook: Implement `useMutation` for preparing the provider transaction data (e.g., `api.liquidity.prepareCommitment`).                                                       | 1.5        | ⬜     | CIP-404, Convex `prepareCommitment` action ready                            |          |
| CIP-406 | In provider hook: Adapt transaction signing/broadcasting logic for the provider-specific smart contract interaction.                                                                   | 3          | ⬜     | CIP-404, CIP-405, Wallet integration (Area 1 of main plan)                  |          |
| CIP-407 | Connect the "Commit Capital" button in `PolicySummary` to trigger the provider transaction hook.                                                                                       | 1          | ⬜     | DCU-212, CIP-406                                                            |          |
| CIP-408 | Test end-to-end provider flow: Configure strategy, see potential yield, commit capital, sign transaction, verify on explorer.                                                          | 3          | ⬜     | CIP-407                                                                     |          |

## 5. Implementation Strategy

1.  **State First (Area 1):** Implement the `currentUserRole` state management and propagation.
2.  **UI Scaffolding (Area 2):** Add the conditional rendering logic and basic UI structure for the provider view **within the existing components (`ProtectionParameters`, `ProtectionVisualization`, `PolicySummary`, `AdvancedParameters`)**. This approach is preferred for the MVP to maintain simplicity and reduce code duplication. Avoid creating entirely separate component trees for the provider flow unless absolutely necessary. _Note: For `ProtectionParameters`, this was achieved by creating internal `BuyerParametersUI` and `ProviderParametersUI` functional components within the main file to keep the main component clean._
3.  **Copy Updates (Area 3):** Populate the provider UI structure with the correct terminology.
4.  **Convex Connections (Area 4):** Connect the provider UI elements to Convex queries for displaying data (yield) and then implement the transaction hook for submitting provider actions.
5.  **Testing:** Test each component's dynamic behavior and the end-to-end flow for providers thoroughly.

## 6. Key Dependencies

- **Convex Backend**: Readiness of provider-specific Convex functions/actions (e.g., `calculatePotentialYield`, `prepareCommitment`).
- **UX Specifications**: Relies on `@docs/frontend-new/bithedge-income-provider-center-streamlined-ux-spec.md` for UI details and `@docs/frontend-new/bithedge-insurance-model-interface-approach.md` for terminology.
- **Completed Area 1 (Main Plan):** Assumes wallet and basic Convex client setup is functional.

## 7. Conclusion

This plan addresses the gap identified in the current frontend implementation by outlining the steps to make the UI fully dynamic for both Protection Buyers and Income Providers. Completing these tasks will result in a unified interface that adapts correctly based on user role selection, moving closer to the MVP goal.

## 8. Refactoring Recommendations & Next Steps (Pre-Area 2 Continuation)

Based on the implementation progress through DCU-205, several scalability and maintainability improvements are recommended before proceeding with further tasks in Area 2 (DCU-206 onwards) or Area 4 (Convex Integration). Addressing these now will establish a cleaner foundation.

### Summary of Recommendations:

1.  **Centralized `UserRole` Type (Completed):**

    - **Status:** Done.
    - **Description:** The `UserRole` type (`'buyer' | 'provider'`) was initially defined in multiple components. It has been centralized into `front-end/src/types/index.ts` and imported where needed.
    - **Benefit:** Improves maintainability and type consistency across the application.

2.  **Lift Provider State from `ProviderParametersUI`:**

    - **Status:** Done.
    - **Description:** The state variables managing the provider's selections (`selectedTier`, `commitmentAmount`, `selectedPeriod`) and their corresponding handler functions (e.g., `handleCommitmentChange`, `handleQuickSelect`, `setSelectedTier`, `setSelectedPeriod`) were previously defined locally.
    - **Recommendation:** Lift this state and the handlers up into the main `ProtectionParameters` component. (Completed)
    - **Benefit:** Centralizes the complete provider configuration state in one place (`ProtectionParameters`). This is crucial for Area 4, where this combined state will be needed to trigger Convex queries (like `calculatePotentialYield`) and mutations (like `prepareCommitment`). It avoids prop drilling _up_ or needing complex callbacks later.

3.  **Extract `ProviderParametersUI` Component:**

    - **Status:** Done.
    - **Description:** The `ProviderParametersUI` component was previously an internal functional component within `ProtectionParameters.tsx`.
    - **Recommendation:** Extract this component into its own file: `front-end/src/components/BitHedge/ProviderParametersUI.tsx`. This new component will accept the lifted state and handlers (from Recommendation #2) as props. (Completed)
    - **Benefit:** Reduces the size and complexity of `ProtectionParameters.tsx`, improving readability and separation of concerns. `ProtectionParameters.tsx` becomes primarily responsible for role switching and managing the state for the _active_ role's UI.

4.  **Extract `BuyerParametersUI` Component (Optional but Recommended):**

    - **Status:** Done.
    - **Description:** Similar to `ProviderParametersUI`, the `BuyerParametersUI` was previously an internal component.
    - **Recommendation:** Extract this component into its own file: `front-end/src/components/BitHedge/BuyerParametersUI.tsx`. It would continue managing its own state for now, unless buyer state also needs to be accessed by the parent for backend integration. (Completed)
    - **Benefit:** Further cleans up `ProtectionParameters.tsx` and maintains consistency in component structure.

5.  **Shared Constants/Hooks (Future Consideration):**
    - **Status:** Future Improvement.
    - **Description:** Neumorphic style constants and potentially data arrays (like `tiers`, period definitions) are duplicated or defined within components.
    - **Recommendation:** Consider extracting these into shared constant files (e.g., `src/styles/neumorphism.ts`) or custom hooks if logic becomes more complex.
    - **Benefit:** Reduces code duplication and centralizes theme/configuration elements.

### Immediate Next Steps:

The refactoring steps (Lifting provider state, Extracting UI components) identified previously have been confirmed as completed.

The next critical step, as outlined in the `state-management-and-data-flow.md` document **and Area 4**, is to implement the **Shared Data Layer** using React Context API (e.g., `PremiumDataContext`) and connect it to the backend. This will facilitate communication of calculation inputs and results between `ProtectionParameters`, `ProtectionVisualization`, and `PolicySummary` (replacing mock data) before proceeding with Area 3 (Copy Updates) or final E2E testing (CIP-408).

Once this context integration is complete and verified, the codebase will be better structured for the remaining tasks.
