# BitHedge: Account Dashboard - UI/UX Technical Specification

## 1. Introduction

This document outlines the UI/UX components and user flow for the BitHedge Account Dashboard. This page serves as the central hub for users (both Protection Buyers and Income Providers) to view their active policies/strategies, track performance, and manage their engagement with the BitHedge platform. It leverages data fetched from the Convex backend, specifically policy and strategy information associated with the connected user's wallet address.

This specification references the overall UI guidelines from `@docs/frontend-new/ui_ux_spec.md` and component architecture from `@docs/backend-new/bithedge-component-architecture.md`.

## 2. User Flow

```
Connect Wallet → Navigate to Dashboard (e.g., via Header Link)
↓
Dashboard View:
  - Display Summary Metrics (Total Protected Value / Total Committed Capital)
  - List Active Policies/Strategies
  - View Policy/Strategy Details (on click)
  - Access Historical Data (Optional)
  - Manage Account Settings (Optional)
```

## 3. Global UI Framework

- **Layout:** Consistent with the main application (centered content, max width, padding).
- **Styling:** Adheres to the established global styles (colors, typography, card styling) defined in `@docs/frontend-new/ui_ux_spec.md`.
- **Header/Footer:** Uses the same header (with wallet connection) and footer as the main application pages.
- **Data Fetching:** Primarily relies on Convex `useQuery` hooks. **Crucially, all data displayed (summary metrics, policies, strategies) MUST be filtered and fetched specifically for the currently connected wallet address.**

## 4. Detailed Screen Specifications

### 4.1 Dashboard Home View

**Purpose**: Provide a high-level overview of the user's current status and active engagements.

**Layout**: Main content area displaying summary cards and a list/table of active policies/strategies.

**UI Components**:

1.  **Header**: Standard application header with wallet connection status.
2.  **Page Title**: `h1` or `h2` (e.g., "Account Dashboard").
3.  **Summary Metrics Section**:
    - Layout: Row of 2-3 summary cards (similar style to `BitcoinPriceCard` sub-cards).
    - **Card 1 (Contextual)**:
      - _If Buyer Focus_: "Total Protected Value" - Displays the total USD value currently under active protection policies.
      - _If Provider Focus_: "Total Committed Capital" - Displays the total STX/BTC capital committed to income strategies.
      - _If Mixed_: May show both or prioritize one based on recent activity.
    - **Card 2**: "Active Policies/Strategies" - Displays the total count of active items.
    - **Card 3 (Optional)**:
      - _If Buyer Focus_: "Estimated P&L" (Calculated off-chain, potentially complex for MVP) - Shows overall unrealized profit/loss on active policies.
      - _If Provider Focus_: "Total Earned Yield (Lifetime/Current)" - Shows total income generated.
4.  **Active Policies/Strategies List/Table**:
    - Title: `h3` (e.g., "Your Active Engagements").
    - Filters/Tabs (Optional): Allow filtering by type (Protection/Income) or status (Active/Expired).
    - Layout: A list of cards or a table displaying key details for each active item.
    - **List Item / Table Row Content (per policy/strategy)**:
      - **Identifier**: Policy ID / Strategy ID (shortened or linked).
      - **Type**: "Protection Policy" / "Income Strategy" (with distinct icons, e.g., shield/business).
      - **Key Parameter 1**:
        - _Buyer_: Protected Value (e.g., "Protects @ $90,000").
        - _Provider_: Risk Tier (e.g., "Balanced Yield Tier").
      - **Key Parameter 2**:
        - _Buyer_: Protected Amount (e.g., "0.5 BTC").
        - _Provider_: Committed Capital (e.g., "500 STX").
      - **Status**: "Active", "Expires Soon", "In Profit" / "In Yield Zone", "At Risk" / "Acquisition Likely", "Expired", "Exercised" / "Settled". (Use color-coded badges).
      - **Expiration/End Date**: "Expires in 15 days" / "Ends May 30, 2024".
      - **Action Button/Link**: "View Details" -> Navigates to Policy/Strategy Detail View.
    - **Empty State**: Message displayed if the user has no active policies/strategies (e.g., "You have no active protection policies or income strategies. Get started [here].").

**Copy Approach**: Clear, concise labels. Use terminology consistent with the user's primary role (Buyer/Provider) where applicable, leveraging `@docs/frontend-new/bithedge-insurance-model-interface-approach.md`.

**Visual Elements**: Consistent card styling, iconography, color-coded status badges.

**Interaction Design**: List items/rows are clickable to view details. Optional filtering/sorting controls.

### 4.2 Policy/Strategy Detail View

**Purpose**: Show comprehensive information about a single selected policy or income strategy.

**Layout**: Can be a dedicated page or a modal overlay. Displays detailed parameters, current status, relevant performance metrics, and potential actions.

**UI Components**:

1.  **Header**: Title indicating Policy/Strategy ID and Type (e.g., "Protection Policy #12345"). Back button to return to Dashboard Home.
2.  **Parameter Summary Section**: Displays all configuration parameters set during creation.
    - _Buyer_: Protected Value, Protected Amount, Duration, Premium Paid, Creation Date, Expiration Date.
    - _Provider_: Risk Tier, Committed Capital, Income Period, Estimated Yield at Creation, Creation Date, End Date.
3.  **Current Status & Performance Section**:
    - **Status Badge**: Prominent display of the current status (Active, Expired, Exercised/Settled, etc.).
    - **Market Context**: Current BTC Price, Current Volatility (relevant to the item).
    - **Performance Metrics (Contextual)**:
      - _Buyer_: Current P&L (Unrealized), Protection Value (if active), Distance to Break-even.
      - _Provider_: Accrued Yield to Date, Current APY (Annualized), Capital Efficiency, Likelihood of Acquisition (Risk Level).
    - **Timeline Visualization (Optional)**: Visual representation of the policy/strategy duration, showing current position relative to start/end dates.
4.  **Protection/Yield Simulator (Re-used Component)**:
    - Integrate the `ProtectionVisualization` component (or a similar one adapted for providers) pre-populated with the specific policy/strategy parameters. Allows users to re-evaluate scenarios.
5.  **Transaction History Section (Optional for MVP)**: Link to relevant Stacks transaction(s) on an explorer (Creation Tx, Exercise/Settlement Tx).
6.  **Action Buttons (Contextual & State-Dependent)**:
    - _General_: "Close" (if applicable, potentially with penalty), "Renew" (if nearing expiration and applicable), "Export Details".
    - _Buyer (If Exercised)_: "Claim Payout" (if manual step needed, unlikely with automation).
    - _Provider (If Settled)_: "Withdraw Capital/Yield".

**Copy Approach**: Detailed and precise information. Use tooltips for complex metrics. Maintain consistency with the insurance metaphor.

**Visual Elements**: Clear separation of sections, data visualization for performance, consistent button styling for actions.

**Interaction Design**: Action buttons trigger relevant Convex mutations/actions and subsequent wallet interactions (transaction signing).

## 5. Key Components & Data Flow

- **`AccountDashboard.tsx` (Container)**: Manages overall layout, fetches summary data, renders child components.
- **`SummaryMetricsCard.tsx`**: Reusable card for displaying a single high-level metric.
- **`ActivePoliciesList.tsx` / `ActivePoliciesTable.tsx`**: Renders the list/table of active items.
  - Fetches data using `useQuery(api.policies.getUserPolicies, { userAddress: connectedAddress })` (or similar Convex query).
  - Handles loading and empty states.
- **`PolicyListItem.tsx` / `PolicyTableRow.tsx`**: Renders a single item in the list/table.
  - Displays summarized data passed as props.
  - Handles navigation to the detail view.
- **`PolicyDetailView.tsx` (Container/Page/Modal)**: Displays details for a single policy/strategy.
  - Fetches detailed data using `useQuery(api.policies.getPolicyDetails, { policyId: selectedId })` (or similar).
  - Renders detailed sections and action buttons.
  - Integrates the simulator component.
  - Handles actions by calling relevant `useMutation` hooks (which in turn use wallet signing).

## 6. Implementation Requirements

- **Convex Backend**: Requires Convex queries like `getUserPolicies`, `getPolicyDetails`, `getSummaryMetrics` and mutations/actions for any management functions (e.g., `closePolicy`, `renewStrategy`, `withdrawYield`).
- **Wallet Integration**: Relies on the connected wallet address being available in the frontend context to filter data.
- **Routing**: Requires a routing solution (e.g., Next.js App Router) if the Detail View is a separate page.
- **State Management**: Needs state to manage which policy/strategy detail is being viewed (if not using route parameters).

## 7. Testing Strategy

- **Component Tests**: Verify rendering of dashboard components with mock data (loading, empty, populated states).
- **Integration Tests**: Test data fetching from Convex using `useQuery` and ensure correct data is displayed for the connected user.
- **End-to-End Tests**: Simulate user connecting wallet, navigating to dashboard, viewing policies, viewing details, and potentially triggering an action.
- **Role-Based Testing**: Ensure the dashboard correctly displays relevant information and metrics for both Protection Buyers and Income Providers.

## 8. Conclusion

The Account Dashboard is a crucial component for user retention and ongoing engagement. By providing a clear overview of active policies/strategies and their performance, tailored to the user's role (Buyer or Provider), we empower users to effectively manage their BitHedge activities. This specification provides a blueprint for building this essential feature, integrating seamlessly with the Convex backend and existing frontend architecture.
