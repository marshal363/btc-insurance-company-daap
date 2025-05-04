# State Management & Data Flow Approach (Post-Refactoring)

## 1. Introduction

This document outlines the current state management strategy after the refactoring of `ProtectionParameters.tsx`. The goal was to centralize state where necessary, improve component separation, and prepare for integrating Convex queries/mutations for dynamic calculations (premium for buyers, yield for providers) and data display in related components (`ProtectionVisualization`, `ProtectionCost`).

## 2. Component & Data Flow Diagram

```mermaid
graph TD

    subgraph "Page Level"
        Page[\`page.tsx\`] -- Manages --> CurrentUserRole[ (\`currentUserRole: 'buyer' | 'provider'\`) ];
        PremiumTabs[\`PremiumCalculatorTabs.tsx\`] -- 'onTabChange(index)' --> Page;
    end

    subgraph "Parameter Input Section"
        ProtectionParams[\`ProtectionParameters.tsx\`];
        ProtectionParams -- Manages --> ProviderState[ (\`providerInputs: {tier, commitment, period}\`) ];
        ProtectionParams -- Renders --> BuyerUI[\`BuyerParametersUI.tsx\`];
        ProtectionParams -- Renders --> ProviderUI[\`ProviderParametersUI.tsx\`];
        BuyerUI -- Manages --> BuyerState[ (\`buyerInputs: {value, amount, period}\`) ];
        Page -- 'props.currentUserRole' --> ProtectionParams;
        ProtectionParams -- 'props: {inputs, handlers}' --> ProviderUI;
    end

    subgraph "Data Calculation & Display (Conceptual)"
        Convex[ (\`Convex Backend\`) ];
        SharedDataContext[ (\`Shared Data / Context (e.g., PremiumContext)\`) ];
        ProtectionViz[\`ProtectionVisualization.tsx\`];
        ProtectionCost[\`ProtectionCost.tsx\`];

        ProtectionParams -- 'Triggers useQuery/useMutation w/ providerInputs' --> Convex;
        %% Buyer flow would likely trigger from BuyerParametersUI or need state lifted %%
        %% BuyerUI -- 'Triggers useQuery w/ buyerInputs' --> Convex; %% Example: Needs state lift/context
        Convex -- 'Returns: calculatedYield / calculatedPremium' --> SharedDataContext; %% Or directly back to triggering hook

        SharedDataContext -- 'Provides: {role, inputs, results}' --> ProtectionParams;
        SharedDataContext -- 'Provides: {role, results}' --> ProtectionViz;
        SharedDataContext -- 'Provides: {role, results}' --> ProtectionCost;
    end

    ProtectionParams -- Reads/Updates --> SharedDataContext;
    ProtectionViz -- Reads --> SharedDataContext;
    ProtectionCost -- Reads --> SharedDataContext;

    %% Styling
    classDef component fill:#D6EAF8,stroke:#5DADE2,stroke-width:2px;
    classDef state fill:#FEF9E7,stroke:#F8C471,stroke-width:1px,stroke-dasharray: 5 5;
    classDef backend fill:#E8F8F5,stroke:#76D7C4,stroke-width:2px;

    class Page,PremiumTabs,ProtectionParams,BuyerUI,ProviderUI,ProtectionViz,ProtectionCost component;
    class CurrentUserRole,ProviderState,BuyerState,SharedDataContext state;
    class Convex backend;
```

## 3. Explanation

1.  **Role Management (`page.tsx`)**:
    The main page component (`page.tsx`) holds the `currentUserRole` state. It receives the selected tab index from `PremiumCalculatorTabs` and determines the role, passing it down as a prop to `ProtectionParameters`.

2.  **Parameter Controller (`ProtectionParameters.tsx`)**:
    This component now acts as a controller based on `currentUserRole`.

    - **State:** It holds the state specifically for the _Provider_ inputs (`selectedTier`, `commitmentAmount`, `selectedPeriod`) and the necessary handlers (`handleTierSelect`, `handleCommitmentChange`, etc.). This state was lifted from the UI component.
    - **Rendering:** It conditionally renders _either_ `BuyerParametersUI` or `ProviderParametersUI`.
    - **Props:** It passes the lifted provider state and handlers down as props to `ProviderParametersUI`.

3.  **UI Components (`BuyerParametersUI.tsx`, `ProviderParametersUI.tsx`)**:
    These components are now primarily responsible for rendering the UI for their respective roles.

    - `ProviderParametersUI` receives all the data and callbacks it needs via props.
    - `BuyerParametersUI` _currently_ still manages its own state locally (Protected Value, Amount, Period). This might need to be lifted later if `ProtectionParameters` or other components need direct access to the buyer's inputs for calculations.

4.  **Convex Integration (Conceptual)**:

    - **Triggering:** The ideal place to trigger Convex calculations (`useQuery` for premium/yield, `useMutation` for actions) is from the component that holds the complete set of necessary inputs.
      - For the **provider**, this is now `ProtectionParameters.tsx`, as it holds the lifted `providerInputs` state.
      - For the **buyer**, this is currently inside `BuyerParametersUI`. If calculations need to happen outside this component, the buyer state would also need lifting (likely to `ProtectionParameters` or even `page.tsx`).
    - **Data Flow:** The inputs (e.g., `providerInputs`) are passed to the Convex function via the query/mutation hook. Convex performs the calculation and returns the result (e.g., `calculatedYield` or `calculatedPremium`).

5.  **Sharing Results (`Shared Data / Context`)**:
    This is the **critical next step** for connecting everything.

    - The calculated results (premium, yield, visualization data points, etc.) returned from Convex need to be accessible by `ProtectionVisualization` and `ProtectionCost`.
    - Direct prop drilling from `ProtectionParameters` down to `Visualization`/`Cost` is not feasible as they are siblings rendered within `page.tsx`.
    - **Solution:** Introduce a shared data layer. The best approach is likely **React Context API** (e.g., create a `PremiumDataContext`).
      - This Context would be provided higher up (e.g., in `page.tsx`).
      - `ProtectionParameters` (or wherever the Convex hook is triggered) would update the context with the latest calculation results.
      - `ProtectionVisualization` and `ProtectionCost` would consume this context to get the results they need to display the correct chart, cost breakdown, APY, etc., dynamically based on the current role and calculations.

6.  **Interaction with `Visualization` & `Cost`**:
    These components will need to be refactored (Tasks DCU-206 to DCU-212) to:
    - Accept the `currentUserRole` prop (already done, but needs implementation).
    - Conditionally render different titles, charts, data points, and summary boxes based on the role.
    - **Consume the shared context** (e.g., `PremiumDataContext`) to get the calculated premium/yield data needed for display.
    - The chart in `ProtectionVisualization` (DCU-207) will need different data series and potentially different reference lines for the provider.
    - `ProtectionCost` (DCU-210, DCU-211) will display yield/APY instead of cost for the provider and will need different metrics in its breakdown.

## 4. Benefits of Current (Refactored) Approach

- **Improved Separation of Concerns:** `ProtectionParameters` focuses on state management (for provider) and role switching, while `BuyerParametersUI` and `ProviderParametersUI` focus solely on UI rendering.
- **Simplified Convex Integration (Provider):** Having the provider state lifted to `ProtectionParameters` makes it the clear location to trigger Convex queries/mutations that require the combined provider inputs.
- **Reduced Component Size:** Prevents `ProtectionParameters.tsx` from becoming excessively large.
- **Clearer Props Interface:** `ProviderParametersUI` has a clear contract defined by its props.

## 5. Rationale for Context API Implementation Order

Before proceeding with the UI adaptations for `ProtectionVisualization` (DCU-206 to DCU-208) and `ProtectionCost` (DCU-209 to DCU-212), it is strategically advantageous to implement the **Shared Data Layer** (using React Context API, proposed as `PremiumDataContext`) first. The reasoning is as follows:

1.  **Data Dependency:** The core changes required for `ProtectionVisualization` and `ProtectionCost` revolve around displaying _dynamic data_ specific to the selected role (buyer premium/payoff vs. provider yield/scenarios). This data originates from calculations based on inputs selected in `ProtectionParameters`.
2.  **Data Flow Mechanism:** These components (`Visualization`, `Cost`) are siblings to `ProtectionParameters` within `page.tsx`. A shared state mechanism like Context is necessary to pass the calculation results between them without excessive prop drilling or complex state lifting to the page level.
3.  **Avoiding Rework:** Implementing the UI changes in `Visualization` and `Cost` _before_ establishing the data flow mechanism would require using placeholder data. Once the Context and backend connections (Area 4) are implemented later, these components would need significant refactoring to consume the real data from the context. Implementing the Context first creates the data pipeline, allowing subsequent UI adaptations to directly integrate with the intended data source, minimizing rework.

Therefore, establishing the `PremiumDataContext` provides the necessary foundation for the data-dependent UI changes in the subsequent steps.

## 6. Next Step Before Further Implementation

Implement the **Shared Data Layer** (likely using React Context API) to allow communication of calculation inputs and results between `ProtectionParameters`, `ProtectionVisualization`, and `ProtectionCost`. This is essential before proceeding with DCU-206 onwards.
