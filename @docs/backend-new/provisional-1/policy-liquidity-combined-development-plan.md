# BitHedge Policy Registry & Liquidity Pool Combined Development Plan (Hybrid MVP)

**Version:** 1.0
**Date:** 2024-08-21
**Status:** Draft
**Related Specs:** All foundational & component-specific documents in `@docs/backend-new/provisional-1/`

## 1. Project Overview

This development plan outlines the strategy for implementing the integrated Policy Registry and Liquidity Pool components for the BitHedge MVP. It follows the "On-Chain Light / Off-Chain Heavy" hybrid architecture defined in previous documentation, leveraging Convex for off-chain logic and minimal Clarity contracts for on-chain trust and settlement.

### Project Goals

1.  Implement the minimal on-chain `policy-registry.clar` contract.
2.  Implement the minimal on-chain `liquidity-pool.clar` Vault contract.
3.  Develop the Convex backend services for managing the full policy lifecycle (creation, activation, expiration).
4.  Develop the Convex backend services for managing liquidity providers (deposits, withdrawals, virtual accounting, basic health checks).
5.  Integrate these components with each other, the Oracle service, and the Blockchain Integration Layer (BIL).
6.  Provide the necessary Convex APIs (queries/actions) for frontend integration.
7.  Ensure security, consistency, and testability of the integrated system.

### Key Components Recap

1.  **Convex Backend:** Data storage, business logic, workflow orchestration for policies and providers.
2.  **Blockchain Integration Layer (within Convex):** Handles Stacks interactions (Tx building, signing, broadcasting, monitoring).
3.  **On-Chain Contracts:** `policy-registry.clar` (minimal ledger), `liquidity-pool.clar` (minimal vault).
4.  **Frontend UI:** User interface for interacting with policies and provider functions.

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

### Phase 1: Foundation & On-Chain Contracts (Duration: Est. 5 days)

**Goal:** Implement the minimal on-chain contracts and foundational Convex schemas.

| Task ID       | Description                                                                                                | Est. Hours | Status | Dependencies                         | Assignee |
| :------------ | :--------------------------------------------------------------------------------------------------------- | :--------- | :----- | :----------------------------------- | :------- |
| **OC-PR-101** | Implement `policy-registry.clar`: State vars, maps, constants, errors, events                              | 6          | ⬜     | policy-registry-spec.md              |          |
| **OC-PR-102** | Implement `policy-registry.clar`: `create-policy-entry` function                                           | 4          | ⬜     | OC-PR-101                            |          |
| **OC-PR-103** | Implement `policy-registry.clar`: `update-policy-status` function (backend auth)                           | 3          | ⬜     | OC-PR-101                            |          |
| **OC-PR-104** | Implement `policy-registry.clar`: Admin & Read-only functions (`set-backend-principal`, `get-policy-data`) | 2          | ⬜     | OC-PR-101                            |          |
| **OC-LP-101** | Implement `liquidity-pool.clar`: State vars, constants, errors, events, sBTC trait import                  | 5          | ⬜     | liquidity-pool-spec.md               |          |
| **OC-LP-102** | Implement `liquidity-pool.clar`: `deposit-funds` function                                                  | 4          | ⬜     | OC-LP-101                            |          |
| **OC-LP-103** | Implement `liquidity-pool.clar`: `withdraw-funds` function (user auth)                                     | 4          | ⬜     | OC-LP-101                            |          |
| **OC-LP-104** | Implement `liquidity-pool.clar`: `lock/release-collateral-aggregate` functions (backend auth)              | 4          | ⬜     | OC-LP-101                            |          |
| **OC-LP-105** | Implement `liquidity-pool.clar`: `settle-policy` function (backend auth)                                   | 3          | ⬜     | OC-LP-101                            |          |
| **OC-LP-106** | Implement `liquidity-pool.clar`: Admin & Read-only functions                                               | 2          | ⬜     | OC-LP-101                            |          |
| **CVX-S-101** | Implement Convex Schema (`schema.ts`): Define `policies` table structure                                   | 3          | ⬜     | convex-policy-registry-arch.md       |          |
| **CVX-S-102** | Implement Convex Schema (`schema.ts`): Define `providers` table structure                                  | 3          | ⬜     | convex-liquidity-pool-arch.md        |          |
| **CVX-S-103** | Implement Convex Schema (`schema.ts`): Define `poolMetrics`, `tierMetrics` tables                          | 2          | ⬜     | convex-liquidity-pool-arch.md        |          |
| **CVX-S-104** | Implement Convex Schema (`schema.ts`): Define `policyBacking` table (recommended)                          | 1          | ⬜     | convex-liquidity-pool-arch.md        |          |
| **BI-101**    | Refine/Confirm BIL: Backend private key loading (`getBackendSignerKey`)                                    | 1          | 🟢     | blockchain-integration-layer-spec.md |          |
| **BI-102**    | Refine/Confirm BIL: Network & Contract Info helpers (`getStacksNetwork`, `getOracleContractInfo` etc.)     | 2          | 🟢     | BI-101                               |          |
| **DEP-101**   | Deploy `policy-registry.clar` & `liquidity-pool.clar` to Devnet/Testnet                                    | 3          | ⬜     | OC-PR-104, OC-LP-106                 |          |
| **TEST-101**  | Basic unit tests (Clarinet checks) for on-chain contracts                                                  | 8          | ⬜     | DEP-101                              |          |

**Phase 1 Deliverables:**

- Deployed minimal Clarity contracts for Policy Registry and Liquidity Pool Vault.
- Established Convex database schemas for core entities.
- Confirmed basic Blockchain Integration Layer utilities for configuration and signing.
- Initial unit tests for Clarity contracts.

### Phase 2: Core Off-Chain Logic (Convex - Policy Creation & Provider Deposits) (Duration: Est. 7 days)

**Goal:** Implement the workflows for users to create policies and providers to deposit funds.

| Task ID       | Description                                                                                                              | Est. Hours | Status | Dependencies                                         | Assignee |
| :------------ | :----------------------------------------------------------------------------------------------------------------------- | :--------- | :----- | :--------------------------------------------------- | :------- |
| **CVX-P-201** | Implement Convex Queries (`policies.ts`): `listByOwner`, `getById`                                                       | 3          | ⬜     | CVX-S-101                                            |          |
| **CVX-P-202** | Implement Convex Mutations (`policies.ts`): `(internal) recordNewPolicyAttempt`, `updatePolicyFromCreationEvent`         | 4          | ⬜     | CVX-S-101                                            |          |
| **CVX-P-203** | Implement Convex Action (`policies.ts`): `requestPolicyCreation` (Validation, Oracle/Premium/LP checks, Prepare TX)      | 10         | ⬜     | CVX-P-201, CVX-P-202, Oracle/Premium APIs, CVX-L-201 |          |
| **CVX-L-201** | Implement Convex Queries (`liquidity.ts`): `getProviderPortfolio`, `getPoolStats`, `getTierStats`, `getTierAvailability` | 6          | ⬜     | CVX-S-102, CVX-S-103                                 |          |
| **CVX-L-202** | Implement Convex Mutations (`liquidity.ts`): `(internal) createOrUpdateProvider`, `updateProviderBalance` (deposit)      | 5          | ⬜     | CVX-S-102                                            |          |
| **CVX-L-203** | Implement Convex Mutations (`liquidity.ts`): `(internal) syncPoolBalancesFromEvent`, `updateTierMetrics` (deposit)       | 4          | ⬜     | CVX-S-103                                            |          |
| **CVX-L-204** | Implement Convex Action (`liquidity.ts`): `requestCommitCapital` (Validation, Capacity check, Prepare TX)                | 6          | ⬜     | CVX-L-201, CVX-L-202                                 |          |
| **BI-201**    | Implement BIL Helper: Prepare user-signed TX for combined LPV deposit + PRC create (`prepareUserSignedTx`)               | 5          | ⬜     | BI-102, OC-PR-102, OC-LP-102                         |          |
| **BI-202**    | Implement BIL Event Handler: Basic listener/poller for `policy-created` & `funds-deposited` events                       | 6          | ⬜     | BI-102                                               |          |
| **BI-203**    | Connect BIL Event Handler to trigger Convex Mutations (`updatePolicyFromCreationEvent`, `syncPoolBalances...` etc.)      | 4          | ⬜     | BI-202, CVX-P-202, CVX-L-203                         |          |
| **FE-201**    | Implement Frontend: Basic UI component for Policy Creation form                                                          | 5          | ⬜     |                                                      |          |
| **FE-202**    | Implement Frontend: Basic UI component for Provider Deposit form                                                         | 5          | ⬜     |                                                      |          |
| **FE-203**    | Integrate Frontend: Connect UI forms to Convex Actions (`requestPolicyCreation`, `requestCommitCapital`)                 | 4          | ⬜     | FE-201, FE-202, CVX-P-203, CVX-L-204                 |          |
| **FE-204**    | Integrate Frontend: Handle TX parameter return & trigger user signing (@stacks/connect)                                  | 6          | ⬜     | FE-203, BI-201                                       |          |
| **TEST-201**  | Implement Convex Tests: Unit tests for Policy creation queries/mutations/actions                                         | 8          | ⬜     | CVX-P-203                                            |          |
| **TEST-202**  | Implement Convex Tests: Unit tests for Liquidity deposit queries/mutations/actions                                       | 8          | ⬜     | CVX-L-204                                            |          |
| **TEST-203**  | Functional Test: End-to-end Policy Creation flow (UI -> Convex -> On-Chain -> Convex Update) on Devnet                   | 6          | ⬜     | FE-204, BI-203                                       |          |
| **TEST-204**  | Functional Test: End-to-end Provider Deposit flow (UI -> Convex -> On-Chain -> Convex Update) on Devnet                  | 6          | ⬜     | FE-204, BI-203                                       |          |

**Phase 2 Deliverables:**

- Functional off-chain logic for policy creation request processing.
- Functional off-chain logic for provider deposit request processing.
- Mechanism for preparing user-signed transactions for creation/deposit.
- Basic event handling to update off-chain state post-confirmation.
- Basic UI components for triggering these flows.
- Unit tests for core Convex logic.
- Successful functional tests for both flows on Devnet.

### Phase 3: Core Off-Chain Logic (Convex - Activation, Expiration & Withdrawals) (Duration: Est. 10 days)

**Goal:** Implement the backend-driven policy status updates and provider withdrawals.

| Task ID       | Description                                                                                                                               | Est. Hours | Status | Dependencies                                     | Assignee |
| :------------ | :---------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- | :----------------------------------------------- | :------- |
| **CVX-P-301** | Implement Convex Mutations (`policies.ts`): `(internal) updatePolicyFromStatusEvent`, `setPolicyStatusDetailed` (Settling, Expiring etc.) | 4          | ⬜     | CVX-S-101                                        |          |
| **CVX-P-302** | Implement Convex Action (`policies.ts`): `requestPolicyActivation` (Validation, Oracle Check, Trigger Settlement)                         | 8          | ⬜     | CVX-P-201, CVX-P-301, Oracle API, CVX-L-304      |          |
| **CVX-P-303** | Implement Convex Action (`policies.ts`): `(internal) triggerPolicyStatusUpdate` (Calls BIL for backend-signed TX)                         | 4          | ⬜     | CVX-P-301, BI-301                                |          |
| **CVX-P-304** | Implement Convex Action (`policies.ts`): `(internal) checkAndTriggerExpirations` (Query DB, Trigger Release/Status Update)                | 6          | ⬜     | CVX-P-201, CVX-L-305, CVX-P-303                  |          |
| **CVX-P-305** | Implement Convex Cron Job (`crons.ts`): Schedule `checkAndTriggerExpirations`                                                             | 1          | ⬜     | CVX-P-304                                        |          |
| **CVX-L-301** | Implement Convex Mutations (`liquidity.ts`): `updateProviderBalance` (withdrawal, lock, release, settlement_debit)                        | 6          | ⬜     | CVX-S-102                                        |          |
| **CVX-L-302** | Implement Convex Mutations (`liquidity.ts`): `updateTierMetrics` (withdrawal, lock, release, settlement_debit)                            | 4          | ⬜     | CVX-S-103                                        |          |
| **CVX-L-303** | Implement Convex Action (`liquidity.ts`): `allocatePolicyCollateral` (Off-chain: Provider selection, update balances/metrics)             | 6          | ⬜     | CVX-L-201, CVX-L-301, CVX-L-302, (PolicyBacking) |          |
| **CVX-L-304** | Implement Convex Action (`liquidity.ts`): `requestSettlement` (Triggers backend-signed Vault TX, updates state post-confirmation)         | 7          | ⬜     | CVX-L-301, CVX-L-302, BI-302, CVX-P-303          |          |
| **CVX-L-305** | Implement Convex Action (`liquidity.ts`): `requestCollateralRelease` (Off-chain updates, triggers backend-signed Vault TX)                | 6          | ⬜     | CVX-L-301, CVX-L-302, BI-303                     |          |
| **CVX-L-306** | Implement Convex Action (`liquidity.ts`): `requestWithdrawal` (Health Check Logic - basic MVP, Prepare User TX)                           | 10         | ⬜     | CVX-L-201, CVX-L-301, Oracle API, BI-201         |          |
| **BI-301**    | Implement BIL Helper: Prepare & Execute Backend-Signed TX for `policy-registry::update-policy-status`                                     | 5          | ⬜     | BI-102, OC-PR-103                                |          |
| **BI-302**    | Implement BIL Helper: Prepare & Execute Backend-Signed TX for `liquidity-pool::settle-policy`                                             | 5          | ⬜     | BI-102, OC-LP-105                                |          |
| **BI-303**    | Implement BIL Helper: Prepare & Execute Backend-Signed TX for `liquidity-pool::lock/release-collateral-aggregate`                         | 5          | ⬜     | BI-102, OC-LP-104                                |          |
| **BI-304**    | Implement BIL Helper: Refine nonce management for backend principal                                                                       | 3          | ⬜     | BI-301, BI-302, BI-303                           |          |
| **BI-305**    | Implement BIL Event Handler: Add handlers for `policy-status-updated`, `settlement-paid`, `collateral-released` events                    | 4          | ⬜     | BI-202                                           |          |
| **BI-306**    | Connect BIL Event Handler to trigger relevant Convex Mutations (`updatePolicyFromStatusEvent`, `updateProviderBalance` etc.)              | 4          | ⬜     | BI-305, CVX-P-301, CVX-L-301                     |          |
| **FE-301**    | Implement Frontend: UI components for displaying Policy List & Details (read from Convex query)                                           | 6          | ⬜     | CVX-P-201                                        |          |
| **FE-302**    | Implement Frontend: UI components for displaying Provider Portfolio (read from Convex query)                                              | 6          | ⬜     | CVX-L-201                                        |          |
| **FE-303**    | Implement Frontend: Button/Action trigger for `requestPolicyActivation`                                                                   | 2          | ⬜     | FE-301, CVX-P-302                                |          |
| **FE-304**    | Implement Frontend: Form/Action trigger for `requestWithdrawal`                                                                           | 4          | ⬜     | FE-302, CVX-L-306                                |          |
| **FE-305**    | Integrate Frontend: Handle TX parameter return & trigger user signing for withdrawals                                                     | 4          | ⬜     | FE-304, BI-201                                   |          |
| **TEST-301**  | Implement Convex Tests: Unit tests for Policy activation/expiration logic                                                                 | 8          | ⬜     | CVX-P-302, CVX-P-304                             |          |
| **TEST-302**  | Implement Convex Tests: Unit tests for Liquidity withdrawal/settlement/release logic (incl. health check)                                 | 10         | ⬜     | CVX-L-306, CVX-L-304, CVX-L-305                  |          |
| **TEST-303**  | Functional Test: End-to-end Policy Activation flow on Devnet                                                                              | 6          | ⬜     | FE-303, BI-306                                   |          |
| **TEST-304**  | Functional Test: End-to-end Provider Withdrawal flow on Devnet                                                                            | 6          | ⬜     | FE-305, BI-306                                   |          |
| **TEST-305**  | Functional Test: End-to-end Policy Expiration flow on Devnet (manual trigger/wait)                                                        | 4          | ⬜     | CVX-P-305, BI-306                                |          |

**Phase 3 Deliverables:**

- Functional backend-driven policy activation and expiration workflows.
- Functional provider withdrawal workflow with basic health checks.
- Robust backend signing and transaction monitoring via BIL.
- Comprehensive event handling for state synchronization.
- UI components for viewing policies/portfolios and triggering activation/withdrawal.
- Unit tests for Convex logic.
- Successful functional tests for activation, expiration, and withdrawal flows.

### Phase 4: Integration, Testing & Refinement (Duration: Est. 5 days)

**Goal:** Ensure all components work together seamlessly, perform thorough testing, and refine the system.

| Task ID      | Description                                                                                   | Est. Hours | Status | Dependencies       | Assignee |
| :----------- | :-------------------------------------------------------------------------------------------- | :--------- | :----- | :----------------- | :------- |
| **TEST-401** | Integration Testing: Combined flow (Deposit -> Create Policy -> Expire -> Withdraw)           | 8          | ⬜     | All Phase 3 Tasks  |          |
| **TEST-402** | Integration Testing: Combined flow (Deposit -> Create Policy -> Activate -> Withdraw)         | 8          | ⬜     | All Phase 3 Tasks  |          |
| **TEST-403** | Edge Case Testing: Insufficient funds, capacity limits, health check failures, API failures   | 10         | ⬜     | TEST-401, TEST-402 |          |
| **TEST-404** | Security Review: Check access controls (backend principal, user auth), input validation       | 6          | ⬜     | TEST-403           |          |
| **TEST-405** | Stress Testing (Optional for MVP): Simulate concurrent users/transactions on Devnet           | 8          | ⚪     | TEST-403           |          |
| **FE-401**   | UI/UX Refinement: Improve clarity, error handling, loading states based on testing            | 10         | ⬜     | FE-301 - FE-305    |          |
| **CVX-401**  | Code Cleanup & Refactoring: Address TODOs, improve comments, optimize queries/actions         | 8          | ⬜     | TEST-403           |          |
| **OC-401**   | On-Chain Code Review: Final check of Clarity contracts for logic errors or gas inefficiencies | 4          | ⬜     | TEST-101           |          |
| **DOC-401**  | Update Documentation: Finalize component specs, architecture diagrams, data flows             | 10         | ⬜     | CVX-401, FE-401    |          |
| **DEP-401**  | Prepare Deployment Scripts: Configuration for Testnet/Mainnet deployment                      | 6          | ⬜     | DOC-401            |          |
| **DEP-402**  | Create Operational Runbook: Monitoring checks, recovery steps (basic)                         | 5          | ⬜     | DEP-401            |          |

**Phase 4 Deliverables:**

- Thoroughly tested and integrated Policy Registry and Liquidity Pool system.
- Refined UI/UX based on testing feedback.
- Cleaned and documented codebase (Convex & Clarity).
- Finalized technical documentation.
- Basic deployment scripts and operational runbook.

## 4. Post-MVP Considerations (Deferred Tasks)

- Advanced Collateral Health Checks (Liquidation engine).
- Yield Distribution Mechanism.
- Governance for Parameter Updates.
- Multi-signature control for Backend Principal.
- Advanced monitoring and alerting.
- Gas optimization for on-chain contracts.
- More sophisticated provider allocation logic.
- Support for CALL options.

## 5. Conclusion

This plan outlines the necessary steps to develop the core Policy Registry and Liquidity Pool functionalities for the BitHedge MVP using the defined hybrid architecture. Successful execution requires careful coordination between on-chain and off-chain development, robust testing at each phase, and attention to the integration points between components.
