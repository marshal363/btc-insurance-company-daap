# BitHedge Frontend: Convex & Wallet Integration Plan

## 1. Introduction

This document outlines the plan for integrating the BitHedge React frontend with the Convex backend and existing Stacks wallet providers (Hiro, Devnet). The goal is to replace the current placeholder UI (`CampaignDetails.tsx`) with the core BitHedge components (`Protection Center`, `Account Dashboard`, etc.) while preserving and adapting the essential wallet connection and transaction signing logic. This plan follows the architecture defined in `@docs/backend-new/bithedge-component-architecture.md` and `@docs/backend-new/convex-backend-implementation.md`.

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

| Implementation Area                       | Total Tasks | Not Started | In Progress | Completed | Completion % |
| ----------------------------------------- | ----------- | ----------- | ----------- | --------- | ------------ |
| 1. Convex Client & Wallet Provider Setup  | 9           | 1           | 0           | 8         | 89%          |
| 2. Read-Only Feature (Account Dashboard)  | 6           | 6           | 0           | 0         | 0%           |
| 3. Write Feature (Protection Center & Tx) | 14          | 14          | 0           | 0         | 0%           |
| 4. Code Cleanup & Refinement              | 5           | 5           | 0           | 0         | 0%           |
| **Overall Project**                       | **34**      | **26**      | **0**       | **8**     | **24%**      |

_Note: Task counts and estimates are initial values and may be refined._

## 4. Key Implementation Areas

### Area 1: Convex Client & Wallet Provider Setup

**Goal**: Establish the foundational connection between the React app, Convex backend, and Stacks wallet providers.

| Task ID | Description                                                                               | Est. Hours | Status | Dependencies                                 | Assignee |
| ------- | ----------------------------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------- | -------- |
| CWI-101 | Install `convex` npm package                                                              | 0.5        | 🟢     | -                                            |          |
| CWI-102 | Initialize `ConvexReactClient` in `src/app/layout.tsx` or equivalent root component       | 1          | 🟢     | CWI-101, Convex Project URL                  |          |
| CWI-103 | Wrap main application layout with `ConvexProvider`                                        | 0.5        | 🟢     | CWI-102                                      |          |
| CWI-104 | Verify `HiroWalletProvider` exists and is correctly placed relative to `ConvexProvider`   | 1          | 🟢     | CWI-103, Existing `HiroWalletProvider.tsx`   |          |
| CWI-105 | Verify `DevnetWalletProvider` exists and is correctly placed relative to `ConvexProvider` | 1          | 🟢     | CWI-103, Existing `DevnetWalletProvider.tsx` |          |
| CWI-106 | Review/adapt `ConnectWallet.tsx` for basic connect/disconnect within Convex context       | 1.5        | 🟢     | CWI-104                                      |          |
| CWI-107 | Review/adapt `DevnetWalletButton.tsx` for basic Devnet connect/disconnect                 | 1.5        | 🟢     | CWI-105                                      |          |
| CWI-108 | Test wallet connections (Hiro/Devnet), network switching, and address display             | 2          | ⬜     | CWI-106, CWI-107                             |          |
| CWI-109 | Remove `CampaignDetails` import and rendering from `src/app/page.tsx`                     | 0.5        | 🟢     | -                                            |          |

### Area 2: Read-Only Feature Implementation (Account Dashboard)

**Goal**: Implement a core feature that reads data from Convex, demonstrating successful data fetching using the established wallet context.

| Task ID | Description                                                                                       | Est. Hours | Status | Dependencies                                  | Assignee |
| ------- | ------------------------------------------------------------------------------------------------- | ---------- | ------ | --------------------------------------------- | -------- |
| RDO-201 | Create new component file `src/components/AccountDashboard.tsx`                                   | 0.5        | ⬜     | -                                             |          |
| RDO-202 | Define basic structure for displaying a list of policies                                          | 1          | ⬜     | RDO-201                                       |          |
| RDO-203 | Create Convex query hook using `useQuery` to call `api.policies.getUserPolicies` (or similar)     | 2          | ⬜     | CWI-108, Convex `getUserPolicies` query ready |          |
| RDO-204 | Integrate wallet context to pass the user's Stacks address to the `useQuery` hook                 | 1          | ⬜     | RDO-203, CWI-108                              |          |
| RDO-205 | Implement rendering logic in `AccountDashboard.tsx` for fetched policies, loading, & error states | 2          | ⬜     | RDO-203, RDO-204                              |          |
| RDO-206 | Add `AccountDashboard` component to the main application page/layout                              | 0.5        | ⬜     | RDO-205, CWI-109                              |          |

### Area 3: Write Feature Implementation (Protection Center & Transactions)

**Goal**: Implement a core feature involving user input, interaction with Convex mutations, and signing/submitting a Stacks transaction using the connected wallet.

| Task ID | Description                                                                                              | Est. Hours | Status | Dependencies                                                                    | Assignee |
| ------- | -------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------- | -------- |
| WFI-301 | Create component file(s) for `Protection Center` UI (e.g., `src/components/ProtectionCenter.tsx`)        | 1          | ⬜     | -                                                                               |          |
| WFI-302 | Implement UI elements for selecting Protection Percentage, Duration, and Amount (as per UX specs)        | 3          | ⬜     | WFI-301, `@docs/frontend-new/bithedge-protection-center-streamlined-ux-spec.md` |          |
| WFI-303 | Implement `useQuery` hook calling `api.premium.calculatePremium` for real-time premium display           | 2.5        | ⬜     | WFI-302, Convex `calculatePremium` query ready                                  |          |
| WFI-304 | Create new hook file `src/hooks/useBitHedgeTransaction.ts`                                               | 0.5        | ⬜     | -                                                                               |          |
| WFI-305 | Define input parameters for `useBitHedgeTransaction` hook (e.g., `policyParams`)                         | 0.5        | ⬜     | WFI-304                                                                         |          |
| WFI-306 | In hook: Import & use `useMutation` for `api.policies.preparePolicyCreation` (or similar backend action) | 1          | ⬜     | WFI-304, Convex `preparePolicyCreation` action ready                            |          |
| WFI-307 | In hook: Access wallet context (Hiro/Devnet)                                                             | 1          | ⬜     | WFI-304, CWI-108                                                                |          |
| WFI-308 | In hook: Implement logic to select the correct wallet instance based on current network context          | 1          | ⬜     | WFI-307                                                                         |          |
| WFI-309 | In hook: Adapt core transaction signing/broadcasting logic from template (`useTransactionExecuter`)      | 4          | ⬜     | WFI-306, WFI-308, Understanding of `useTransactionExecuter` pattern             |          |
| WFI-310 | In hook: Implement loading, success (returning `txId`), and error state management                       | 1.5        | ⬜     | WFI-309                                                                         |          |
| WFI-311 | (Optional) In hook: Implement `useMutation` call for `api.policies.recordPendingPolicy` on success       | 1          | ⬜     | WFI-310, Convex `recordPendingPolicy` mutation ready                            |          |
| WFI-312 | Connect `Protection Center` UI form/button to the `useBitHedgeTransaction` hook                          | 1.5        | ⬜     | WFI-302, WFI-310                                                                |          |
| WFI-313 | Implement UI feedback for transaction submission (pending, success, error) based on hook state           | 1          | ⬜     | WFI-312                                                                         |          |
| WFI-314 | Test end-to-end flow: Configure policy, see premium, submit, sign, verify transaction on explorer        | 3          | ⬜     | WFI-313                                                                         |          |

### Area 4: Code Cleanup & Refinement

**Goal**: Remove obsolete code from the template project and ensure the new structure is clean and maintainable.

| Task ID | Description                                                                                       | Est. Hours | Status | Dependencies              | Assignee |
| ------- | ------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------- | -------- |
| CLN-401 | Delete `CampaignDetails.tsx` file                                                                 | 0.5        | ⬜     | CWI-109                   |          |
| CLN-402 | Delete `CampaignAdminControls.tsx` file                                                           | 0.5        | ⬜     | -                         |          |
| CLN-403 | Delete `DonationModal.tsx` file                                                                   | 0.5        | ⬜     | -                         |          |
| CLN-404 | Delete unused campaign-related hooks (`useCampaignInfo`, `useExistingDonation`), utils, constants | 1.5        | ⬜     | CLN-401, CLN-402, CLN-403 |          |
| CLN-405 | Review `useBitHedgeTransaction` hook for clarity, reusability, and potential abstractions         | 2          | ⬜     | Completion of Area 3      |          |

## 5. Implementation Strategy (Phased Rollout)

The implementation will follow the sequence of the areas defined above:

1.  **Phase 1: Foundation (Area 1)**: Ensure Convex and wallets are integrated and communicating correctly. This is the bedrock for all subsequent work.
2.  **Phase 2: Read Path (Area 2)**: Implement a feature that primarily reads data from Convex via the user's wallet identity. This validates the data fetching pipeline.
3.  **Phase 3: Write Path (Area 3)**: Implement a feature that requires preparing data, interacting with Convex mutations, and signing/submitting blockchain transactions. This validates the core action-taking pipeline.
4.  **Phase 4: Cleanup (Area 4)**: Remove dead code and refactor key components like the transaction hook for maintainability.

This phased approach allows for incremental validation of the core architecture and interaction patterns.

## 6. Key Dependencies

- **Convex Backend**: Successful completion of relevant Convex backend functions and actions as outlined in `@docs/backend-new/convex-backend-implementation.md` (e.g., `api.policies.getUserPolicies`, `api.premium.calculatePremium`, `api.policies.preparePolicyCreation`, `api.policies.recordPendingPolicy`). Tasks in this plan may be blocked if corresponding backend functionality is not ready.
- **Existing Wallet Components**: Relies on the presence and basic functionality of `HiroWalletProvider.tsx`, `DevnetWalletProvider.tsx`, `ConnectWallet.tsx`, `DevnetWalletButton.tsx`.
- **UX Specifications**: UI implementation tasks (WFI-302) depend on finalized UX designs/specifications like `@docs/frontend-new/bithedge-protection-center-streamlined-ux-spec.md`.

## 7. Conclusion

This plan provides a structured approach to migrating the frontend from the initial template structure to a functional BitHedge application integrated with Convex and Stacks wallets. By breaking down the work into distinct areas and tasks, we can track progress effectively and ensure all necessary components are built and integrated correctly, preserving the critical wallet interaction logic while implementing the target BitHedge UI and features.
