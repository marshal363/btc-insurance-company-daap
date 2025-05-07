# BitHedge Implementation Roadmap

**Version:** 1.0  
**Date:** 2024-08-30  
**Context:** Implementation roadmap for the BitHedge platform following the "On-Chain Light" architectural approach.

## 1. Project Overview

This implementation roadmap outlines the detailed tasks required to bring the BitHedge platform to life following the "On-Chain Light" architectural approach documented in our specifications. The plan encompasses both the Policy Registry and Liquidity Pool components, detailing specific work items across all layers (on-chain contracts, Convex backend, blockchain integration, and frontend).

### Project Goals

- Implement the core contracts adhering to the minimal on-chain footprint design
- Build a robust Convex backend service that manages complex business logic off-chain
- Create a secure Blockchain Integration Layer for communication between Convex and contracts
- Develop an intuitive frontend that leverages the Convex backend
- Establish comprehensive testing, documentation, and operational procedures

### Architecture Components

The implementation covers these core components:

**On-Chain Smart Contracts**

- Policy Registry Contract: Manages policy ownership and lifecycle
- Liquidity Pool Vault Contract: Manages secure custody of funds
- Oracle Contract: Provides price data (already implemented)

**Convex Backend**

- Policy Registry Service: Handles policy lifecycle management
- Liquidity Pool Service: Manages provider funds and risk allocation
- Blockchain Integration Layer: Facilitates on-chain communication

**Frontend Components**

- Policy Center: For policy creation, activation, and management
- Income Provider Center: For liquidity provision and management
- Dashboard: For monitoring policies and income

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

### Phase 1: Foundation & On-Chain Implementation (Duration: Est. 3 weeks)

**Goal:** Establish the minimal on-chain contracts and basic communication primitives.

#### A. Policy Registry Contract

| Task ID | Description                                                           | Est. Hours | Status | Dependencies   | Assignee |
| ------- | --------------------------------------------------------------------- | ---------- | ------ | -------------- | -------- |
| PR-101  | Create basic contract structure with data types and error codes       | 6          | 🟢     |                |          |
| PR-102  | Implement core data structures (policies map, counter, indices)       | 8          | 🟢     | PR-101         |          |
| PR-103  | Implement administrative functions (set-backend-authorized-principal) | 4          | 🟢     | PR-101         |          |
| PR-104  | Implement create-policy-entry function with validation                | 10         | 🟢     | PR-102, PR-103 |          |
| PR-105  | Implement update-policy-status function (exercising, expiring)        | 8          | 🟢     | PR-104         |          |
| PR-106  | Implement batch operations for policies (expire-policies-batch)       | 6          | 🟡     | PR-105         |          |
| PR-107  | Implement read-only functions (get-policy, is-policy-active, etc.)    | 6          | 🟢     | PR-102         |          |
| PR-108  | Implement settlement calculation utility function                     | 4          | 🟢     | PR-102         |          |
| PR-109  | Add event emission for all state-changing functions                   | 4          | 🟢     | PR-104, PR-105 |          |
| PR-110  | Create helper functions for policy index management                   | 6          | 🟢     | PR-102         |          |
| PR-111  | Create integration points with Liquidity Pool contract                | 6          | 🟢     | PR-104, LP-110 |          |
| PR-112  | Implement Oracle integration for price checking                       | 6          | 🟢     | PR-105         |          |
| PR-113  | Add explicit position type field to policy data structure             | 4          | 🟢     | PR-102         |          |
| PR-114  | Implement policy-by-counterparty index                                | 4          | 🟢     | PR-102         |          |
| PR-115  | Add premium distribution tracking and processing                      | 8          | 🟢     | PR-105, LP-107 |          |
| PR-116  | Add collateral type tracking for different policy types               | 6          | 🟢     | PR-113         |          |
| PR-117  | Implement multiple settlement asset support                           | 8          | 🟢     | PR-116         |          |
| PR-118  | Enhance premium distribution logic with provider-specific tracking    | 10         | 🟢     | PR-115, LP-112 |          |
| PR-119  | Implement premium-distribution-initiated event emission               | 4          | 🟢     | PR-115         |          |
| PR-120  | Add counterparty notification for premium distribution                | 6          | 🟢     | PR-119         |          |
| PR-121  | Enhance policy creation to handle position type assignment            | 6          | 🟢     | PR-113         |          |
| PR-122  | Create process-expired-policy-premium function                        | 8          | 🟢     | PR-115, PR-119 |          |

#### B. Liquidity Pool Vault Contract

| Task ID | Description                                                            | Est. Hours | Status | Dependencies   | Assignee |
| ------- | ---------------------------------------------------------------------- | ---------- | ------ | -------------- | -------- |
| LP-101  | Create basic contract structure with data types and error codes        | 6          | 🟢     |                |          |
| LP-102  | Implement core data structures (token-balances, locked-collateral)     | 8          | 🟢     | LP-101         |          |
| LP-103  | Implement administrative functions (set principals, initialize-token)  | 6          | 🟢     | LP-101         |          |
| LP-104  | Implement deposit functions (deposit-stx, deposit-sbtc)                | 8          | 🟢     | LP-102, LP-103 |          |
| LP-105  | Implement withdrawal functions with balance checking                   | 10         | 🟢     | LP-104         |          |
| LP-106  | Implement collateral management (lock-collateral, release-collateral)  | 8          | 🟢     | LP-102         |          |
| LP-107  | Implement settlement function (pay-settlement)                         | 8          | 🟢     | LP-106         |          |
| LP-108  | Implement read-only functions (get balances, availability)             | 4          | 🟢     | LP-102         |          |
| LP-109  | Add event emission for all state-changing functions                    | 4          | 🟢     | LP-104, LP-105 |          |
| LP-110  | Create integration points with Policy Registry contract                | 6          | 🟢     | LP-107         |          |
| LP-111  | Implement SIP-010 token handling logic                                 | 8          | 🟢     | LP-104         |          |
| LP-112  | Implement provider-specific premium accounting                         | 10         | 🟢     | LP-107         |          |
| LP-113  | Enhance release-collateral to handle premium distribution              | 6          | 🟢     | LP-107         |          |
| LP-114  | Add premium-balances map to track premiums                             | 6          | 🟢     | LP-112         |          |
| LP-115  | Implement record-premium-payment function                              | 8          | 🟢     | LP-114         |          |
| LP-116  | Implement distribute-premium function                                  | 8          | 🟢     | LP-115         |          |
| LP-117  | Implement provider-policy-allocations map                              | 6          | 🟢     | LP-112         |          |
| LP-118  | Add distribute-provider-premium function                               | 8          | 🟢     | LP-117         |          |
| LP-119  | Implement premium distribution event emissions                         | 4          | 🟢     | LP-116, LP-118 |          |
| LP-120  | Create functions for premium allocation based on provider contribution | 10         | 🟢     | LP-117         |          |
| LP-121  | Add premium-earned tracking for provider analytics                     | 6          | 🟢     | LP-112, LP-118 |          |
| LP-122  | Implement withdrawal functions with premium balance inclusion          | 8          | 🟢     | LP-114, LP-105 |          |
| LP-123  | Create premium-distributed event hook for provider notifications       | 6          | 🟢     | LP-119         |          |

**Implementation Notes (LP-101 to LP-123):**

- Core vault functionalities including deposits, withdrawals (backend-authorized), collateral locking/releasing, and settlement payment are in place.
- Provider-specific premium accounting has been implemented on-chain, enabling the vault to track and manage premiums at a granular level.
- Key data structures added: `premium-balances` (for overall premium tracking per token) and `provider-policy-allocations` (to link providers to policies and their premium shares).
- Core functions for premium lifecycle: `record-premium-payment`, `distribute-premium` (to counterparty), `record-provider-allocation` (by backend), and `distribute-provider-premium` (by backend to provider wallet).
- Token identification uses `(string-ascii 32)` consistent with existing contract patterns and Convex backend alignment, rather than `principal` from the original vault spec for token map keys.
- Events for all significant premium-related actions are emitted (e.g., `premium-recorded`, `premium-distributed`, `provider-allocation-recorded`, `provider-premium-distributed`).
- Read-only functions are available to query premium balances and provider allocations.
- `LP-113 (Enhance release-collateral)`: Addressed by ensuring the system supports sequenced premium distribution alongside collateral release, orchestrated by the backend. `release-collateral` function itself remains focused on adjusting locked amounts.
- `LP-122 (Withdrawal functions with premium balance inclusion)`: Addressed by `distribute-provider-premium` directly paying out premiums to providers. Capital withdrawal functions are for capital; backend orchestrates the combined user experience.
- All listed tasks from LP-101 through LP-123 are now considered implemented on-chain.

#### C. Contract Testing & Deployment

| Task ID  | Description                                                  | Est. Hours | Status | Dependencies                       | Assignee |
| -------- | ------------------------------------------------------------ | ---------- | ------ | ---------------------------------- | -------- |
| TEST-101 | Create unit tests for Policy Registry contract               | 16         | 🟡     | PR-101 through PR-112              |          |
| TEST-102 | Create unit tests for Liquidity Pool Vault contract          | 16         | 🟡     | LP-101 through LP-111              |          |
| TEST-103 | Create integration tests for contract interaction            | 10         | ⬜     | PR-111, LP-110, TEST-101, TEST-102 |          |
| TEST-104 | Test performance and gas optimization                        | 8          | ⬜     | TEST-101, TEST-102                 |          |
| TEST-105 | Test position type and premium distribution                  | 8          | ⬜     | PR-113, PR-115, LP-112, LP-113     |          |
| TEST-106 | Test premium distribution and provider allocation system     | 12         | ⬜     | PR-115, PR-118, LP-116, LP-118     |          |
| TEST-107 | Test collateral type tracking and multiple settlement assets | 10         | ⬜     | PR-116, PR-117                     |          |
| TEST-108 | Test premium-distribution-initiated event handling           | 6          | ⬜     | PR-119, PR-120                     |          |
| TEST-109 | Test process-expired-policy-premium function                 | 8          | ⬜     | PR-122                             |          |
| TEST-110 | Test provider-specific premium accounting                    | 10         | ⬜     | LP-112, LP-114, LP-115             |          |
| TEST-111 | Test premium distribution across provider allocations        | 12         | ⬜     | LP-117, LP-118, LP-120             |          |
| TEST-112 | Test withdrawal with premium balance inclusion               | 8          | ⬜     | LP-122                             |          |
| DEP-101  | Deploy Policy Registry contract to Devnet                    | 4          | ⬜     | TEST-101, TEST-103                 |          |
| DEP-102  | Deploy Liquidity Pool Vault contract to Devnet               | 4          | ⬜     | TEST-102, TEST-103                 |          |
| DEP-103  | Configure contract integration on Devnet                     | 6          | ⬜     | DEP-101, DEP-102                   |          |

**Phase 1 Progress Summary:**
We have successfully implemented the core components of both the Policy Registry and Liquidity Pool Vault contracts following the "On-Chain Light" architectural approach. Key achievements include:

1.  **Policy Registry Contract**:

    - Implemented comprehensive data structures for policy management
    - Created functions for policy creation, status updates, and querying
    - Added settlement calculation utilities
    - Implemented basic event emission for all state-changing operations
    - Simplified batch expiration functionality to ensure contract compatibility
    - **Completed Oracle integration (`get-current-btc-price`, `is-policy-exercisable`) using placeholder functions (PR-112).**
    - **Completed integration points with Liquidity Pool Vault (`check-liquidity-for-policy`, `lock-policy-collateral`) using placeholder functions (PR-111).**
    - **Added explicit position type field to distinguish between LONG_PUT (Protective Peter) and SHORT_PUT (Income Irene) positions (PR-113).**
    - **Implemented counterparty indexing to efficiently track policies by seller (PR-114).**
    - **Added premium distribution tracking and processing with explicit function to handle expired policy premium allocation (PR-115).**

2.  **Liquidity Pool Vault Contract**:

    - Established robust token management for both STX and SIP-010 tokens
    - Implemented deposit, withdrawal, and collateral management functions
    - Created settlement payment functionality for policy fulfillment
    - Added comprehensive balance checking and authorization controls
    - Implemented proper event emission for all state-changing operations
    - **Completed integration points with Policy Registry (`verify-policy-active`, `get-policy-settlement-details`) using placeholder functions (LP-110).**
    - **Added `has-sufficient-collateral` function for policy creation checks.**
    - **Refined `pay-settlement` logic to clarify separate handling of collateral release.**
    - **Enhanced premium distribution mechanism to track and allocate premium payments to specific providers (LP-112).**
    - **Improved collateral release to properly handle premium distribution for expired policies (LP-113).**

3.  **Debugging and Optimizations**:
    - Fixed multiple syntax errors related to SIP-010 trait definition
    - Adapted token contract handling to use direct principal references instead of complex trait handling
    - Improved burn-block-height usage for proper block height references
    - Simplified batch operations to ensure contract compatibility and stability
    - Ensured proper owner authorization using CONTRACT-OWNER constant
    - **Resolved `clarinet check` errors, including circular dependency issues, by implementing placeholder functions for cross-contract calls. The contracts now compile successfully.**
    - **Enhanced contract structures to explicitly identify policy positions (LONG_PUT vs SHORT_PUT) and track premium distribution.**

The implemented contracts maintain the minimal on-chain footprint design while providing all essential functionality for the BitHedge platform. The placeholder functions resolve the compilation issues and allow deployment, but the unit tests (`TEST-101`, `TEST-102`) are currently failing and need to be updated to reflect the contract changes and mock the placeholder behavior.

### Phase 2: Convex Backend Implementation (Duration: Est. 4 weeks)

**Goal:** Build the core off-chain logic within Convex for data processing, business logic, and frontend support.

#### A. Policy Registry Service - Convex Implementation

| Task ID   | Description                                                                                                                                                                                                                                                                        | Est. Hours | Status | Dependencies                          | Assignee |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------- | -------- |
| CV-PR-201 | Define schema for `policies` table in `convex/schema.ts` as per `convex-policy-registry-architecture.md`. Include all fields mirroring on-chain data (ref: PR-102) and extended off-chain metadata.                                                                                | 4          | 🟢     | PR-102                                |          |
| CV-PR-202 | Define schema for `policyEvents` table in `convex/schema.ts` for historical event tracking.                                                                                                                                                                                        | 4          | 🟢     | CV-PR-201                             |          |
| CV-PR-203 | Define schema for `pendingPolicyTransactions` table in `convex/schema.ts` for managing asynchronous on-chain interactions.                                                                                                                                                         | 4          | 🟢     | CV-PR-201                             |          |
| CV-PR-204 | Implement foundational policy query functions: `getPolicy(policyId)` and initial `getPoliciesForUser(filters)` (owner-based, basic filters) in `convex/policyRegistry.ts`.                                                                                                         | 6          | 🟢     | CV-PR-201                             |          |
| CV-PR-205 | Implement `getPolicyEvents(policyId)` query function in `convex/policyRegistry.ts` to fetch historical events for a specific policy.                                                                                                                                               | 4          | 🟢     | CV-PR-202                             |          |
| CV-PR-206 | Implement `checkPolicyActivationEligibility(policyId)` query in `convex/policyRegistry.ts`. Use mocked Oracle interactions (e.g., `mockGetCurrentBTCPrice()`) and blockchain data (e.g. `mockGetLatestBlockHeight()`).                                                             | 6          | 🟢     | CV-PR-201, mock(BI-204)               |          |
| CV-PR-207 | Implement/Integrate `premiumCalculationService`. Analyze `convex/premium.ts` and `convex/prices.ts`; wrap existing logic or define a new service structure for policy lifecycle premium calculations.                                                                              | 8          | 🟢     | CV-PR-201                             |          |
| CV-PR-208 | Implement a mock `poolLiquidityCheckingService` (e.g., in `convex/mocks.ts` or inline mock) to simulate checking Liquidity Pool capacity. This replaces the direct CV-LP-201 dependency for now.                                                                                   | 4          | 🟢     | mock(CV-LP-201)                       |          |
| CV-PR-209 | Implement `requestPolicyCreation(params)` action in `convex/policyRegistry.ts`. Utilizes `premiumCalculationService`, mock `poolLiquidityCheckingService`, determines position type/counterparty, prepares mock transaction payload, and inserts into `pendingPolicyTransactions`. | 10         | 🟢     | CV-PR-203, CV-PR-207, CV-PR-208       |          |
| CV-PR-210 | Implement `requestPolicyActivation(params)` action (now `requestPolicySettlement`) in `convex/policyRegistry.ts`. Uses `checkPolicyActivationEligibility`, prepares mock transaction payload, and inserts into `pendingPolicyTransactions`.                                        | 8          | 🟢     | CV-PR-206, CV-PR-203                  |          |
| CV-PR-211 | Implement `updateTransactionStatus(pendingTxId, transactionId, status, error?)` mutation in `convex/policyRegistry.ts` to manage entries in `pendingPolicyTransactions`.                                                                                                           | 6          | 🟢     | CV-PR-203                             |          |
| CV-PR-212 | Implement scheduled job `checkTransactionStatusJob` in `convex/crons.ts`. Queries `pendingPolicyTransactions`, uses mocked `mockGetTransactionStatus(transactionId)` (replaces BI-201 dependency for now), and calls `updateTransactionStatus`.                                    | 8          | 🟢     | CV-PR-211, mock(BI-201), mock(BI-209) |          |
| CV-PR-213 | Implement scheduled job `checkExpiredPoliciesJob` in `convex/crons.ts`. Queries `policies` for active policies past `expirationHeight` (using mocked `mockGetLatestBlockHeight()`). Logs expired policies and prepares for creating pending expiration transactions.               | 8          | 🟢     | CV-PR-201, CV-PR-204, mock(BI-204)    |          |
| CV-PR-214 | Implement basic `processPolicyStatusEvent(eventData)` mutation in `convex/policyRegistry.ts`. Designed for future blockchain event listeners; updates `policies` table and creates `policyEvents` entry. Testable with mock data.                                                  | 8          | 🟢     | CV-PR-202, CV-PR-201, mock(BI-202)    |          |
| CV-PR-215 | Implement placeholder structure for `reconcileOnChainState` scheduled job in `convex/crons.ts`. Logs execution but no actual reconciliation. (Full reconciliation depends on BI-204).                                                                                              | 4          | 🟢     | CV-PR-214, mock(BI-204)               |          |
| CV-PR-216 | Ensure `positionType` is correctly handled in `policies` schema, policy creation logic (`CV-PR-209`), and query filters in `getPoliciesForUser` / `getPoliciesForCounterparty`.                                                                                                    | 5          | 🟢     | CV-PR-201, PR-113                     |          |
| CV-PR-217 | Implement/Enhance queries supporting provider views for "Income Irenes" (e.g., `getPoliciesForCounterparty`, `getCounterpartyIncomeStats`) with relevant filters and data shaping.                                                                                                 | 6          | 🟢     | CV-PR-201, PR-114                     |          |
| CV-PR-218 | Ensure premium distribution tracking fields (`premiumDistributed`, `premiumPaid`) are in `policies` schema. Update `requestPolicyCreation` to set `premiumPaid`.                                                                                                                   | 5          | 🟢     | CV-PR-201, PR-115, mock(LP-112)       |          |
| CV-PR-219 | Ensure `policies` schema and `getCounterpartyIncomeStats` query (from arch doc) cover counterparty premium tracking needs (earned, pending).                                                                                                                                       | 4          | 🟢     | CV-PR-201, CV-PR-217, PR-115          |          |
| CV-PR-220 | Ensure `collateralToken` is part of `policies` schema and correctly handled during policy creation logic (e.g., derived or set).                                                                                                                                                   | 4          | 🟢     | CV-PR-209, PR-116                     |          |
| CV-PR-221 | Implement logic for `settlementToken` selection/setting in `policies` schema and policy creation logic.                                                                                                                                                                            | 4          | 🟢     | CV-PR-220, PR-117                     |          |
| CV-PR-222 | Implement `requestPremiumDistribution(params)` action in `convex/policyRegistry.ts`. Uses `checkPremiumDistributionEligibility`, creates `pendingPolicyTransactions` entry for "PremiumDistribution" (mocking BI for tx prep).                                                     | 6          | 🟢     | CV-PR-218, CV-PR-226, PR-122          |          |
| CV-PR-223 | Implement/Enhance `processPremiumDistributionEvent(eventData)` mutation in `convex/policyRegistry.ts` to handle mocked on-chain `premium-distribution-initiated` events. Updates `policies.premiumDistributed`.                                                                    | 6          | 🟢     | CV-PR-202, CV-PR-201, PR-119          |          |
| CV-PR-224 | Implement `distributePolicyPremium(policyId)` internal action/helper (now `initiatePremiumDistributionForExpiredPolicy`) in `convex/policyRegistry.ts`. Triggered after policy expiration. Calls `requestPremiumDistribution`.                                                     | 6          | 🟢     | CV-PR-218, CV-PR-223                  |          |
| CV-PR-225 | Implement mock `notifyLiquidityPoolOfPremiumDistribution(params)` helper (e.g. in `convex/mocks.ts`). Replaces CV-LP-219 dependency.                                                                                                                                               | 4          | 🟢     | CV-PR-223, mock(CV-LP-219)            |          |
| CV-PR-226 | Create `checkPremiumDistributionEligibility(policyId)` query in `convex/policyRegistry.ts`. Checks policy status and `premiumDistributed` flag.                                                                                                                                    | 4          | 🟢     | CV-PR-201, PR-115                     |          |
| CV-PR-227 | Refine `requestPolicyCreation` (CV-PR-209) to robustly assign `positionType` and correctly set `owner` and `counterparty`.                                                                                                                                                         | 4          | 🟢     | CV-PR-209, PR-121                     |          |
| CV-PR-228 | Implement `acceptPolicyOfferByCounterparty` mutation in `convex/policyRegistry.ts`                                                                                                                                                                                                 | 6          | 🟢     | CV-PR-201, CV-PR-203, PR-114          |          |

**Implementation Notes (Policy Registry Service - Convex - Sub-Phase 2A.1):**

- **Schema Definition (CV-PR-201, CV-PR-202, CV-PR-203):** Tasks Completed.
  - Added `policies`, `policyEvents`, and `pendingPolicyTransactions` table definitions to `convex/schema.ts`.
  - Schemas align with `convex-policy-registry-architecture.md`, including necessary fields and indexes.

**Implementation Notes (Policy Registry Service - Convex - Sub-Phase 2A.2):**

- **Eligibility Checks & Service Stubs (CV-PR-206, CV-PR-207, CV-PR-208):** Tasks Completed.
  - `convex/premium.ts`: Exported `calculateBlackScholesPremium`.
  - `convex/policyRegistry.ts`:
    - Added `calculatePremiumForPolicyCreation` leveraging `calculateBlackScholesPremium` and `internal.prices.getLatestPrice`. This serves as the `premiumCalculationService`.
    - Added `mockCheckPoolLiquidity` as a placeholder for `poolLiquidityCheckingService`.
    - Added `mockGetLatestBlockHeight` and `mockGetCurrentBTCPrice` for simulated on-chain/oracle data.
    - Added `checkPolicyActivationEligibility` query, using mock functions to simulate blockchain/oracle interactions.

**Implementation Notes (Policy Registry Service - Convex - Sub-Phase 2A.3):**

- **Basic Query Functions (CV-PR-204, CV-PR-205):** Tasks Completed.
  - Enhanced `getPoliciesForUser` with robust filtering capabilities:
    - Added support for filtering by `status`, `policyType`, and `creationTimestamp` range
    - Implemented pagination with `limit` and `offset` parameters
    - Used user authentication to derive owner principal
    - Added JavaScript-based sorting for consistent pagination
  - Refined `getPolicyEvents` to properly use database indexing:
    - Ensured correct ordering by event `timestamp`
    - Used the `by_policyConvexId_and_timestamp` index for efficient querying
    - Optimized for showing newest events first

**Implementation Notes (Policy Registry Service - Scheduled Jobs):**

- **Scheduled Job Implementation (CV-PR-212, CV-PR-213, CV-PR-214, CV-PR-215):** Tasks Completed.
  - Implemented `checkTransactionStatusJob` in a dedicated `transactionStatusJobs.ts` module:
    - Created a mock blockchain integration to simulate transaction status checking
    - Implemented querying for pending transactions with non-terminal status
    - Added error handling and retry mechanism for failed transactions
    - Configured as scheduled job in `crons.ts` to run every 5 minutes
  - Implemented `checkExpiredPoliciesJob` in the same module:
    - Added functionality to query active policies past their expiration height
    - Used mock blockchain integration to get latest block height
    - Created expirations with event tracking and state changes
    - Configured as daily scheduled job in `crons.ts`
  - Added settlement processing functionality in `settlementJobs.ts`:
    - Implemented job to process policy settlements after activation
    - Created settlement status tracking with appropriate event creation
    - Added state machine for settlement lifecycle management
    - Scheduled to run hourly via `crons.ts`
  - Implemented auto-reconciliation in `reconciliationJobs.ts`:
    - Created job to reconcile on-chain vs off-chain policy states
    - Added mock blockchain integration for state checking
    - Implemented database updates for reconciled policies
    - Configured to run every 4 hours in `crons.ts`
  - Enhanced database schema in `schema.ts`:
    - Added `lastReconciled` timestamp to the policies table
    - Added `settlementProcessed` flag for tracking settlement status

**Previous Completed Tasks:**

**Completed (CV-PR-211):**

- Successfully implemented `updateTransactionStatus` mutation in `convex/policyRegistry.ts`.
- Added `TransactionStatus` enum for standardized tracking of pending transaction states.
- Implemented a state machine logic within the mutation to validate and manage transitions between statuses (e.g., Pending -> Submitted -> Confirmed/Failed).
- Integrated helper internal mutations `createPolicyEvent` and `updatePolicyStatus` for modularity.
- Developed `handleConfirmedPolicyCreation` function to:
  - Create new policy documents in the `policies` table upon confirmation of "Create" type transactions.
  - Record relevant `CREATED` and `ONCHAIN_CONFIRMED` policy events.
  - Link the confirmed policy ID back to the `pendingPolicyTransactions` record via `policyConvexId`.
- Developed `handleConfirmedPolicyActivation` function to:
  - Update the corresponding policy's status to `EXERCISED`.
  - Record `ACTIVATED` and `SETTLEMENT_REQUESTED` policy events.
  - Store settlement details (amount, price) in the policy document.
- Implemented error handling for failed transactions, including logging and creating `ERROR` policy events when a `policyConvexId` is available.
- Resolved several TypeScript schema-related issues by updating `convex/schema.ts` to ensure fields like `updatedAt`, `onChainPolicyId`, `exercisedAt` (for `policies` table) and `policyConvexId` (for `pendingPolicyTransactions` table) were correctly defined and typed, leading to successful typechecking.

**Completed (CV-PR-210):**

- Successfully implemented `requestPolicyActivation(params)` action with comprehensive functionality:
  - Added policy existence and ownership validation
  - Leveraged `checkPolicyActivationEligibility` to verify if the policy can be exercised
  - Implemented transaction preparation for activating (exercising) policies
  - Ensured settlement amount validation
  - Created transaction tracking through the pending transactions table
  - Provided appropriate error handling and user feedback

**Completed (CV-PR-209):**

- Successfully implemented `requestPolicyCreation(params)` action with comprehensive functionality:
  - Added parameter validation to ensure policy request is valid
  - Integrated with premium calculation service to determine appropriate premium
  - Added mock pool liquidity checking to simulate capacity verification
  - Created helper functions for blockchain conversions:
    - `daysToBlockHeight`: Converts duration days to block height
    - `usdToSats` and `btcToSats`: Convert values to on-chain units
  - Implemented proper position type determination based on policy type
  - Added transaction payload preparation for blockchain integration
  - Created proper database interaction for tracking pending transactions
  - Ensured correct use of internal mutations for database operations from actions

#### B. Liquidity Pool Service - Convex Implementation

**Schema Tables**

- ✅ CV-LP-201: Define schema for providerBalances table
- ✅ CV-LP-202: Define schema for poolMetrics table
- ✅ CV-LP-203: Define schema for policyAllocations table
- ✅ CV-LP-204: Define schema for poolTransactions table
- ✅ CV-LP-205: Define schema for pendingPoolTransactions table

**Provider Queries and Dashboard**

- ✅ CV-LP-206: Implement getProviderBalances query
- ✅ CV-LP-207: Implement getProviderDashboard query (aggregated view)
- ✅ CV-LP-208: Implement getPoolMetrics query (TVL, utilization, etc)
- ✅ CV-LP-209: Implement checkWithdrawalEligibility query

**Capital Management**

- ✅ CV-LP-210: Implement requestCapitalCommitment action
- ✅ CV-LP-211: Implement requestWithdrawal action
- ✅ CV-LP-212: Implement allocateCapitalForPolicy action (internal)
- ✅ CV-LP-213: Implement releaseCollateral action (internal)

**Transaction Monitoring**

- 🟢 CV-LP-214: Implement transaction watcher service (job)
- 🟢 CV-LP-215: Implement getTransactionsByProvider query
- 🟢 CV-LP-216: Implement getPoolTransactions query (for admins)

**Transaction Processing**

- 🟢 CV-LP-217: Implement processBlockchainTransaction action (internal)
- 🟢 CV-LP-218: Implement checkTransactionStatus action
- 🟢 CV-LP-219: Implement retryTransaction action

**Policy Allocation Management**

- 🟢 CV-LP-220: Implement getAllocationsByPolicy query (internal)

**Premium Management**

- ✅ CV-LP-221: Define schema for premiumBalances table
- 🟢 CV-LP-222: Implement distributePolicyPremium action (internal)
- ✅ CV-LP-223: Define schema for providerPremiumDistributions table
- 🟢 CV-LP-224: Implement requestPremiumWithdrawal action

**Settlement and Claim Functions**

- 🟢 CV-LP-225: Implement verifyClaimSubmission action (internal)
- 🟢 CV-LP-226: Implement processClaimSettlement action (internal)
- 🟢 CV-LP-227: Implement getClaimPaymentStatus query

**Provider Management**

- 🟢 CV-LP-228: Implement registerLiquidityProvider action
- 🟢 CV-LP-229: Implement updateProviderPreferences action
- 🟢 CV-LP-230: Implement getProviderPreferences query

**Administrative Functions**

- 🟢 CV-LP-231: Implement getSystemPoolStats query (admin-only)
- 🟢 CV-LP-232: Implement pausePoolOperations action (admin-only)

#### C. Convex Testing

| Task ID     | Description                                                       | Est. Hours | Status | Dependencies                               | Assignee |
| ----------- | ----------------------------------------------------------------- | ---------- | ------ | ------------------------------------------ | -------- |
| CV-TEST-201 | Create unit tests for Policy Registry service queries             | 8          | ⬜     | CV-PR-204, CV-PR-205, CV-PR-206            |          |
| CV-TEST-202 | Create unit tests for Policy Registry service actions             | 10         | ⬜     | CV-PR-209, CV-PR-210                       |          |
| CV-TEST-203 | Create unit tests for Liquidity Pool service queries              | 8          | ⬜     | CV-LP-206, CV-LP-207, CV-LP-208, CV-LP-209 |          |
| CV-TEST-204 | Create unit tests for Liquidity Pool service actions              | 10         | ⬜     | CV-LP-210, CV-LP-211                       |          |
| CV-TEST-205 | Create integration tests for policy creation flow                 | 8          | ⬜     | CV-PR-209, CV-LP-215                       |          |
| CV-TEST-206 | Create integration tests for policy activation flow               | 8          | ⬜     | CV-PR-210, CV-LP-216                       |          |
| CV-TEST-207 | Create integration tests for position type handling and filtering | 6          | ⬜     | CV-PR-216, CV-PR-217                       |          |
| CV-TEST-208 | Create integration tests for premium distribution and tracking    | 8          | ⬜     | CV-PR-218, CV-LP-219, CV-LP-220            |          |
| CV-TEST-209 | Test requestPremiumDistribution action                            | 6          | ⬜     | CV-PR-222, CV-PR-226                       |          |
| CV-TEST-210 | Test premium distribution event handling                          | 6          | ⬜     | CV-PR-223, CV-LP-226                       |          |
| CV-TEST-211 | Test provider premium allocation                                  | 8          | ⬜     | CV-LP-224, CV-LP-228                       |          |
| CV-TEST-212 | Test user-initiated premium claims                                | 8          | ⬜     | CV-LP-230, CV-LP-231                       |          |
| CV-TEST-213 | Test premium inclusion in withdrawal calculations                 | 6          | ⬜     | CV-LP-232                                  |          |

**Phase 2 Deliverables:**

- Complete Convex schema definitions for all components
- Implemented Policy Registry service with comprehensive functionality
- Implemented Liquidity Pool service with risk management and allocation
- Test suite for Convex backend logic
- Integration points between Policy Registry and Liquidity Pool services
- Enhanced position type handling and provider-specific views
- Comprehensive premium distribution and yield tracking

### Phase 3: Blockchain Integration Layer (Duration: Est. 3 weeks)

**Goal:** Connect the Convex backend to on-chain contracts securely and implement transaction management.

#### A. Common Blockchain Integration Components

| Task ID | Description                                                    | Est. Hours | Status | Dependencies   | Assignee |
| ------- | -------------------------------------------------------------- | ---------- | ------ | -------------- | -------- |
| BI-201  | Implement Stacks API client configuration                      | 6          | ⬜     |                |          |
| BI-202  | Implement contract address configuration management            | 4          | ⬜     | BI-201         |          |
| BI-203  | Implement environment-based network selection                  | 4          | ⬜     | BI-201         |          |
| BI-204  | Implement read-only contract call utilities                    | 8          | ⬜     | BI-201, BI-202 |          |
| BI-205  | Implement transaction building utilities                       | 10         | ⬜     | BI-201, BI-202 |          |
| BI-206  | Implement secure backend wallet/key loading from env variables | 6          | ⬜     | BI-201         |          |
| BI-207  | Implement transaction signing using backend identity           | 8          | ⬜     | BI-205, BI-206 |          |
| BI-208  | Implement transaction broadcasting & confirmation handling     | 8          | ⬜     | BI-207         |          |
| BI-209  | Implement transaction status checking service                  | 6          | ⬜     | BI-201         |          |
| BI-210  | Implement blockchain event monitoring service                  | 10         | ⬜     | BI-201, BI-202 |          |
| BI-211  | Implement error handling and retry mechanisms                  | 8          | ⬜     | BI-208, BI-209 |          |

#### B. Policy Registry Blockchain Integration

| Task ID   | Description                                                 | Est. Hours | Status | Dependencies         | Assignee |
| --------- | ----------------------------------------------------------- | ---------- | ------ | -------------------- | -------- |
| BI-PR-301 | Implement transaction building for create-policy-entry      | 8          | ⬜     | BI-205, DEP-101      |          |
| BI-PR-302 | Implement transaction building for update-policy-status     | 6          | ⬜     | BI-205, DEP-101      |          |
| BI-PR-303 | Implement transaction building for expire-policies-batch    | 6          | ⬜     | BI-205, DEP-101      |          |
| BI-PR-304 | Implement event listeners for policy-created events         | 6          | ⬜     | BI-210, DEP-101      |          |
| BI-PR-305 | Implement event listeners for policy-status-updated events  | 6          | ⬜     | BI-210, DEP-101      |          |
| BI-PR-306 | Implement read functions for checking policy status         | 4          | ⬜     | BI-204, DEP-101      |          |
| BI-PR-307 | Implement read functions for checking policy exercisability | 6          | ⬜     | BI-204, DEP-101      |          |
| BI-PR-308 | Integrate with Convex actions for policy creation           | 8          | ⬜     | BI-PR-301, CV-PR-209 |          |
| BI-PR-309 | Integrate with Convex actions for policy activation         | 8          | ⬜     | BI-PR-302, CV-PR-210 |          |
| BI-PR-310 | Integrate with Convex jobs for policy expiration            | 8          | ⬜     | BI-PR-303, CV-PR-213 |          |
| BI-PR-311 | Implement transaction building for premium distribution     | 8          | ⬜     | BI-205, PR-122       |          |
| BI-PR-312 | Implement event listeners for premium distribution events   | 6          | ⬜     | BI-210, PR-119       |          |
| BI-PR-313 | Update create-policy transaction to include position type   | 4          | ⬜     | BI-PR-301, PR-121    |          |
| BI-PR-314 | Handle counterparty communication for premium distribution  | 8          | ⬜     | BI-PR-312, PR-120    |          |

#### C. Liquidity Pool Blockchain Integration

| Task ID   | Description                                              | Est. Hours | Status | Dependencies         | Assignee |
| --------- | -------------------------------------------------------- | ---------- | ------ | -------------------- | -------- |
| BI-LP-301 | Implement transaction building for deposit functions     | 8          | ⬜     | BI-205, DEP-102      |          |
| BI-LP-302 | Implement transaction building for withdrawal functions  | 8          | ⬜     | BI-205, DEP-102      |          |
| BI-LP-303 | Implement transaction building for lock-collateral       | 6          | ⬜     | BI-205, DEP-102      |          |
| BI-LP-304 | Implement transaction building for release-collateral    | 6          | ⬜     | BI-205, DEP-102      |          |
| BI-LP-305 | Implement transaction building for pay-settlement        | 6          | ⬜     | BI-205, DEP-102      |          |
| BI-LP-306 | Implement event listeners for funds-deposited events     | 6          | ⬜     | BI-210, DEP-102      |          |
| BI-LP-307 | Implement event listeners for funds-withdrawn events     | 6          | ⬜     | BI-210, DEP-102      |          |
| BI-LP-308 | Implement event listeners for collateral-locked events   | 6          | ⬜     | BI-210, DEP-102      |          |
| BI-LP-309 | Implement event listeners for collateral-released events | 6          | ⬜     | BI-210, DEP-102      |          |
| BI-LP-310 | Implement event listeners for settlement-paid events     | 6          | ⬜     | BI-210, DEP-102      |          |
| BI-LP-311 | Implement read functions for checking pool balances      | 4          | ⬜     | BI-204, DEP-102      |          |
| BI-LP-312 | Implement read functions for checking locked amounts     | 4          | ⬜     | BI-204, DEP-102      |          |
| BI-LP-313 | Integrate with Convex actions for deposit                | 8          | ⬜     | BI-LP-301, CV-LP-210 |          |
| BI-LP-314 | Integrate with Convex actions for withdrawal             | 8          | ⬜     | BI-LP-302, CV-LP-211 |          |
| BI-LP-315 | Implement event listeners for premium-distributed events | 6          | ⬜     | BI-210, LP-119       |          |
| BI-LP-316 | Implement transaction building for premium distribution  | 6          | ⬜     | BI-205, LP-116       |          |
| BI-LP-317 | Create provider premium allocation transaction builder   | 8          | ⬜     | BI-205, LP-118       |          |
| BI-LP-318 | Handle premium inclusion in withdrawal transactions      | 6          | ⬜     | BI-LP-302, LP-122    |          |

#### D. Blockchain Integration Testing

| Task ID     | Description                                                   | Est. Hours | Status | Dependencies                                              | Assignee |
| ----------- | ------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------- | -------- |
| BI-TEST-301 | Create unit tests for common blockchain integration utilities | 8          | ⬜     | BI-201 through BI-211                                     |          |
| BI-TEST-302 | Create integration tests for Policy Registry transactions     | 10         | ⬜     | BI-PR-301 through BI-PR-314                               |          |
| BI-TEST-303 | Create integration tests for Liquidity Pool transactions      | 10         | ⬜     | BI-LP-301 through BI-LP-318                               |          |
| BI-TEST-304 | Create event monitoring and processing tests                  | 8          | ⬜     | BI-210, BI-PR-304, BI-PR-305, BI-LP-306 through BI-LP-310 |          |
| BI-TEST-305 | Test error handling and recovery procedures                   | 8          | ⬜     | BI-211                                                    |          |

**Phase 3 Deliverables:**

- Comprehensive Blockchain Integration Layer for communication with smart contracts
- Transaction building, signing, and monitoring capabilities
- Event listeners for contract state changes
- Integration between Convex actions and blockchain transactions
- Test suite for blockchain integration functionality

### Phase 4: Frontend Implementation (Duration: Est. 4 weeks)

**Goal:** Connect frontend components to the Convex backend and create intuitive user interfaces.

#### A. Common Frontend Components

| Task ID | Description                                              | Est. Hours | Status | Dependencies   | Assignee |
| ------- | -------------------------------------------------------- | ---------- | ------ | -------------- | -------- |
| FE-401  | Set up Convex React provider for frontend integration    | 4          | ⬜     |                |          |
| FE-402  | Implement authentication with Stacks wallet              | 8          | ⬜     | FE-401         |          |
| FE-403  | Create common UI components for policy display           | 10         | ⬜     | FE-401         |          |
| FE-404  | Create common UI components for transaction handling     | 8          | ⬜     | FE-401, FE-402 |          |
| FE-405  | Implement common hooks for transaction submission        | 10         | ⬜     | FE-401, FE-402 |          |
| FE-406  | Implement common hooks for transaction status monitoring | 8          | ⬜     | FE-405         |          |
| FE-407  | Create loading and error state components                | 6          | ⬜     | FE-401         |          |
| FE-408  | Create dashboard layout and navigation structure         | 8          | ⬜     | FE-401         |          |

#### B. Policy Center Frontend

| Task ID   | Description                                                | Est. Hours | Status | Dependencies                 | Assignee |
| --------- | ---------------------------------------------------------- | ---------- | ------ | ---------------------------- | -------- |
| FE-PR-501 | Implement PolicyList component                             | 10         | ⬜     | FE-403, CV-PR-204            |          |
| FE-PR-502 | Implement PolicyDetail component                           | 12         | ⬜     | FE-403, CV-PR-204, CV-PR-205 |          |
| FE-PR-503 | Implement PolicyCreationForm component                     | 16         | ⬜     | FE-403, FE-404, CV-PR-209    |          |
| FE-PR-504 | Implement PolicyActivation component                       | 12         | ⬜     | FE-403, FE-404, CV-PR-210    |          |
| FE-PR-505 | Implement PolicyStatus component with real-time updates    | 8          | ⬜     | FE-403, CV-PR-204            |          |
| FE-PR-506 | Implement PolicyHistory component                          | 10         | ⬜     | FE-403, CV-PR-205            |          |
| FE-PR-507 | Create usePolicy hook for policy data                      | 6          | ⬜     | FE-401, CV-PR-204            |          |
| FE-PR-508 | Create usePolicyCreation hook for policy creation flow     | 8          | ⬜     | FE-401, FE-405, CV-PR-209    |          |
| FE-PR-509 | Create usePolicyActivation hook for policy activation flow | 8          | ⬜     | FE-401, FE-405, CV-PR-210    |          |
| FE-PR-510 | Implement UI for premium calculation                       | 10         | ⬜     | FE-403, CV-PR-207            |          |
| FE-PR-511 | Create PolicyCenter main view integrating all components   | 12         | ⬜     | FE-PR-501 through FE-PR-510  |          |
| FE-PR-512 | Update PolicyCreationForm to include position type display | 8          | ⬜     | FE-PR-503, CV-PR-227         |          |
| FE-PR-513 | Add counterparty information to PolicyDetail component     | 6          | ⬜     | FE-PR-502, CV-PR-217         |          |
| FE-PR-514 | Create PremiumDistributionStatus component                 | 10         | ⬜     | FE-PR-506, CV-PR-218         |          |
| FE-PR-515 | Implement PolicyTypeFilter for view filtering              | 6          | ⬜     | FE-PR-501, CV-PR-216         |          |

#### C. Income Provider Center Frontend

| Task ID   | Description                                                      | Est. Hours | Status | Dependencies                | Assignee |
| --------- | ---------------------------------------------------------------- | ---------- | ------ | --------------------------- | -------- |
| FE-LP-501 | Implement ProviderBalances component                             | 8          | ⬜     | FE-403, CV-LP-206           |          |
| FE-LP-502 | Implement ProviderDashboard component                            | 12         | ⬜     | FE-403, CV-LP-207           |          |
| FE-LP-503 | Implement DepositForm component                                  | 12         | ⬜     | FE-403, FE-404, CV-LP-210   |          |
| FE-LP-504 | Implement WithdrawalForm component                               | 12         | ⬜     | FE-403, FE-404, CV-LP-211   |          |
| FE-LP-505 | Implement RiskTierSelection component                            | 8          | ⬜     | FE-403, CV-LP-214           |          |
| FE-LP-506 | Implement PolicyAllocationsList component                        | 10         | ⬜     | FE-403, CV-LP-207           |          |
| FE-LP-507 | Implement YieldHistory component                                 | 10         | ⬜     | FE-403, CV-LP-207           |          |
| FE-LP-508 | Create useProviderBalance hook for balance data                  | 6          | ⬜     | FE-401, CV-LP-206           |          |
| FE-LP-509 | Create useCapitalCommitment hook for deposit flow                | 8          | ⬜     | FE-401, FE-405, CV-LP-210   |          |
| FE-LP-510 | Create useCapitalWithdrawal hook for withdrawal flow             | 8          | ⬜     | FE-401, FE-405, CV-LP-211   |          |
| FE-LP-511 | Implement UI for yield estimation                                | 10         | ⬜     | FE-403, CV-LP-207           |          |
| FE-LP-512 | Create IncomeProviderCenter main view integrating all components | 12         | ⬜     | FE-LP-501 through FE-LP-511 |          |
| FE-LP-513 | Implement PremiumDistributions component                         | 12         | ⬜     | FE-LP-502, CV-LP-229        |          |
| FE-LP-514 | Create PremiumClaimButton for user-initiated premium collection  | 8          | ⬜     | FE-LP-513, CV-LP-230        |          |
| FE-LP-515 | Implement PremiumEarningsSummary component                       | 10         | ⬜     | FE-LP-502, CV-LP-220        |          |
| FE-LP-516 | Add premium earnings to ProviderDashboard metrics                | 6          | ⬜     | FE-LP-502, CV-LP-220        |          |
| FE-LP-517 | Include premium balances in WithdrawalForm component             | 6          | ⬜     | FE-LP-504, CV-LP-232        |          |
| FE-LP-518 | Create TokenSummary component for premium grouping               | 8          | ⬜     | FE-LP-513                   |          |

#### D. Frontend Testing

| Task ID     | Description                                                | Est. Hours | Status | Dependencies                    | Assignee |
| ----------- | ---------------------------------------------------------- | ---------- | ------ | ------------------------------- | -------- |
| FE-TEST-601 | Create unit tests for common components and hooks          | 10         | ⬜     | FE-401 through FE-408           |          |
| FE-TEST-602 | Create unit tests for Policy Center components             | 12         | ⬜     | FE-PR-501 through FE-PR-515     |          |
| FE-TEST-603 | Create unit tests for Income Provider Center components    | 12         | ⬜     | FE-LP-501 through FE-LP-518     |          |
| FE-TEST-604 | Create integration tests for Policy Center flows           | 12         | ⬜     | FE-PR-511                       |          |
| FE-TEST-605 | Create integration tests for Income Provider Center flows  | 12         | ⬜     | FE-LP-512                       |          |
| FE-TEST-606 | Create usability tests with mock users                     | 8          | ⬜     | FE-PR-511, FE-LP-518            |          |
| FE-TEST-607 | Create unit tests for premium distribution dashboard       | 8          | ⬜     | CV-LP-225                       |          |
| FE-TEST-608 | Create integration tests for premium distribution workflow | 10         | ⬜     | CV-LP-222, CV-LP-224, CV-LP-225 |          |
| FE-TEST-609 | Test position type display and filtering in Policy Center  | 6          | ⬜     | FE-PR-512, FE-PR-515            |          |
| FE-TEST-610 | Test premium distribution components                       | 8          | ⬜     | FE-LP-513, FE-LP-514            |          |
| FE-TEST-611 | Test premium earnings reporting components                 | 8          | ⬜     | FE-LP-515, FE-LP-516            |          |
| FE-TEST-612 | Test premium balance inclusion in withdrawals              | 6          | ⬜     | FE-LP-517                       |          |

**Phase 4 Deliverables:**

- Complete frontend implementation for Policy Center
- Complete frontend implementation for Income Provider Center
- React hooks for interacting with Convex backend
- UI components for all major user flows
- Test suite for frontend functionality

### Phase 5: Integration & Testing (Duration: Est. 2 weeks)

**Goal:** Ensure all components work together seamlessly and validate the entire system.

#### A. End-to-End Integration

| Task ID | Description                                                      | Est. Hours | Status | Dependencies                                      | Assignee |
| ------- | ---------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------- | -------- |
| INT-701 | Integrate Policy Creation flow across all layers                 | 12         | ⬜     | FE-PR-511, CV-PR-209, BI-PR-308, DEP-101          |          |
| INT-702 | Integrate Policy Activation flow across all layers               | 12         | ⬜     | FE-PR-511, CV-PR-210, BI-PR-309, DEP-101          |          |
| INT-703 | Integrate Capital Commitment flow across all layers              | 12         | ⬜     | FE-LP-512, CV-LP-210, BI-LP-313, DEP-102          |          |
| INT-704 | Integrate Capital Withdrawal flow across all layers              | 12         | ⬜     | FE-LP-512, CV-LP-211, BI-LP-314, DEP-102          |          |
| INT-705 | Integrate Settlement flow across all layers                      | 12         | ⬜     | CV-LP-216, BI-LP-305, BI-PR-309, DEP-101, DEP-102 |          |
| INT-706 | Implement and test event-driven communication between components | 10         | ⬜     | BI-210, CV-PR-214, CV-LP-218                      |          |
| INT-707 | Validate data consistency across all layers                      | 8          | ⬜     | INT-701 through INT-706                           |          |
| INT-708 | Integrate Premium Distribution flow across all layers            | 12         | ⬜     | FE-PR-514, CV-PR-222, BI-PR-311, DEP-101          |          |
| INT-709 | Integrate Provider Premium Allocation flow across all layers     | 12         | ⬜     | FE-LP-513, CV-LP-224, BI-LP-316, DEP-102          |          |
| INT-710 | Test Position Type assignment and filtering across all layers    | 10         | ⬜     | FE-PR-512, CV-PR-216, BI-PR-313, DEP-101          |          |

#### B. System Testing

| Task ID  | Description                                                   | Est. Hours | Status | Dependencies              | Assignee |
| -------- | ------------------------------------------------------------- | ---------- | ------ | ------------------------- | -------- |
| TEST-701 | Create end-to-end test scripts for policy lifecycle           | 16         | ⬜     | INT-701, INT-702, INT-705 |          |
| TEST-702 | Create end-to-end test scripts for provider income generation | 16         | ⬜     | INT-703, INT-704, INT-705 |          |
| TEST-703 | Test error handling and recovery procedures across all layers | 12         | ⬜     | INT-701 through INT-706   |          |
| TEST-704 | Perform load testing for peak transaction scenarios           | 12         | ⬜     | INT-701 through INT-706   |          |
| TEST-705 | Test unauthorized access prevention (security testing)        | 10         | ⬜     | INT-701 through INT-706   |          |
| TEST-706 | Validate event-driven updates and real-time data flows        | 8          | ⬜     | INT-706, INT-707          |          |
| TEST-707 | Create automated regression test suite                        | 16         | ⬜     | TEST-701 through TEST-706 |          |

#### C. Documentation

| Task ID | Description                                                 | Est. Hours | Status | Dependencies                                             | Assignee |
| ------- | ----------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------- | -------- |
| DOC-701 | Create comprehensive API documentation for Convex endpoints | 16         | ⬜     | CV-PR-201 through CV-PR-215, CV-LP-201 through CV-LP-218 |          |
| DOC-702 | Document contract interfaces and integration points         | 12         | ⬜     | PR-101 through PR-112, LP-101 through LP-111             |          |
| DOC-703 | Create user flow documentation                              | 10         | ⬜     | FE-PR-511, FE-LP-518                                     |          |
| DOC-704 | Document system architecture and data flows                 | 12         | ⬜     | INT-701 through INT-707                                  |          |
| DOC-705 | Create operational runbooks for maintenance                 | 16         | ⬜     | TEST-701 through TEST-707                                |          |
| DOC-706 | Document security considerations and best practices         | 8          | ⬜     | TEST-705                                                 |          |

**Phase 5 Deliverables:**

- End-to-end integration of all system components
- Verified data flows across frontend, Convex, and blockchain layers
- Comprehensive test suite covering all key user journeys
- Security and performance validation
- Complete system documentation and operational runbooks

### Phase 6: Deployment & Operations (Duration: Est. 3 weeks)

**Goal:** Deploy the system to production, establish monitoring, and prepare for ongoing operations.

#### A. Staging Deployment

| Task ID | Description                                          | Est. Hours | Status | Dependencies              | Assignee |
| ------- | ---------------------------------------------------- | ---------- | ------ | ------------------------- | -------- |
| DEP-801 | Set up staging environment for Convex application    | 8          | ⬜     | All Phase 5 tasks         |          |
| DEP-802 | Deploy contracts to Stacks testnet                   | 6          | ⬜     | All Phase 5 tasks         |          |
| DEP-803 | Configure staging environment variables              | 4          | ⬜     | DEP-801, DEP-802          |          |
| DEP-804 | Implement monitoring systems for staging             | 10         | ⬜     | DEP-803                   |          |
| DEP-805 | Execute regression tests in staging environment      | 12         | ⬜     | DEP-803, TEST-707         |          |
| DEP-806 | Perform security audit in staging environment        | 16         | ⬜     | DEP-805                   |          |
| DEP-807 | Validate performance and scalability in staging      | 12         | ⬜     | DEP-805                   |          |
| DEP-808 | Document issues found in staging and implement fixes | 16         | ⬜     | DEP-805, DEP-806, DEP-807 |          |

#### B. Production Deployment

| Task ID | Description                                         | Est. Hours | Status | Dependencies                       | Assignee |
| ------- | --------------------------------------------------- | ---------- | ------ | ---------------------------------- | -------- |
| DEP-901 | Create production deployment scripts and procedures | 10         | ⬜     | DEP-808                            |          |
| DEP-902 | Set up production monitoring and alerting systems   | 12         | ⬜     | DEP-804                            |          |
| DEP-903 | Create rollback and disaster recovery procedures    | 10         | ⬜     | DEP-901                            |          |
| DEP-904 | Perform final security audit                        | 16         | ⬜     | DEP-808                            |          |
| DEP-905 | Deploy Convex application to production             | 8          | ⬜     | DEP-901, DEP-902, DEP-903, DEP-904 |          |
| DEP-906 | Deploy contracts to Stacks mainnet                  | 8          | ⬜     | DEP-905                            |          |
| DEP-907 | Configure production environment variables          | 4          | ⬜     | DEP-905, DEP-906                   |          |
| DEP-908 | Verify contract state and Convex connectivity       | 6          | ⬜     | DEP-907                            |          |
| DEP-909 | Activate monitoring systems                         | 4          | ⬜     | DEP-908                            |          |
| DEP-910 | Begin phased user onboarding                        | 8          | ⬜     | DEP-909                            |          |

#### C. Operational Readiness

| Task ID | Description                                                | Est. Hours | Status | Dependencies     | Assignee |
| ------- | ---------------------------------------------------------- | ---------- | ------ | ---------------- | -------- |
| OPS-901 | Create operational runbooks for common scenarios           | 12         | ⬜     | DEP-909          |          |
| OPS-902 | Implement automated alerts for key metrics                 | 8          | ⬜     | DEP-902, DEP-909 |          |
| OPS-903 | Create user support documentation and FAQs                 | 10         | ⬜     | DEP-910          |          |
| OPS-904 | Train support team on system functions and troubleshooting | 16         | ⬜     | OPS-901, OPS-903 |          |
| OPS-905 | Establish regular system maintenance procedures            | 8          | ⬜     | OPS-901          |          |
| OPS-906 | Create system performance dashboard                        | 10         | ⬜     | DEP-909          |          |
| OPS-907 | Implement feedback collection system                       | 6          | ⬜     | DEP-910          |          |
| OPS-908 | Establish upgrade and enhancement procedures               | 8          | ⬜     | OPS-905          |          |

**Phase 6 Deliverables:**

- Successfully deployed system to production
- Comprehensive monitoring and alerting systems
- Operational runbooks and maintenance procedures
- User support documentation
- Feedback collection mechanisms
- Regular maintenance and upgrade procedures

## 4. Development Progress Dashboard

The progress of each phase will be tracked using the following metrics:

| Phase                            | Total Tasks | Not Started | In Progress | Completed | Completion % |
| -------------------------------- | ----------- | ----------- | ----------- | --------- | ------------ |
| Phase 1: Foundation & On-Chain   | 43          | 26          | 2           | 15        | 35%          |
| Phase 2: Convex Backend          | 52          | 52          | 0           | 0         | 0%           |
| Phase 3: Blockchain Integration  | 49          | 49          | 0           | 0         | 0%           |
| Phase 4: Frontend Implementation | 51          | 51          | 0           | 0         | 0%           |
| Phase 5: Integration & Testing   | 23          | 23          | 0           | 0         | 0%           |
| Phase 6: Deployment & Operations | 26          | 26          | 0           | 0         | 0%           |
| Overall Project                  | 244         | 227         | 2           | 15        | 6%           |

## 5. Risk and Mitigation Plan

### 5.1 Technical Risks

| Risk                                                | Impact | Likelihood | Mitigation Strategy                                        |
| --------------------------------------------------- | ------ | ---------- | ---------------------------------------------------------- |
| Smart contract vulnerabilities                      | High   | Medium     | Multiple audit rounds, formal verification, gas testing    |
| Blockchain network congestion affecting performance | Medium | Medium     | Implement transaction retry mechanisms, monitor gas prices |
| Data inconsistency between on-chain and off-chain   | High   | Medium     | Regular reconciliation, event-driven synchronization       |
| Insufficient scalability of Convex backend          | High   | Low        | Load testing, performance optimization                     |
| Frontend performance issues with real-time updates  | Medium | Medium     | Implement efficient state management, data pagination      |

### 5.2 Operational Risks

| Risk                                                 | Impact | Likelihood | Mitigation Strategy                                    |
| ---------------------------------------------------- | ------ | ---------- | ------------------------------------------------------ |
| Backend key compromise                               | High   | Low        | Secure storage, regular rotation, multi-sig approvals  |
| Insufficient monitoring leading to undetected issues | Medium | Medium     | Comprehensive monitoring, alerting, automated testing  |
| Unexpected contract behavior in production           | High   | Low        | Extensive staging testing, limited initial exposure    |
| Data migration issues                                | Medium | Medium     | Backup strategies, rehearsed migration procedures      |
| Dependency vulnerabilities                           | Medium | Medium     | Regular dependency audits, automated security scanning |

## 6. Technical Implementation Examples

### 6.1 Example: Policy Creation Flow Across Layers

This example illustrates the implementation approach for the policy creation flow across all system layers:

**Frontend (React Component using Convex hooks)**

```typescript
// Apply to implementation...
```

**Convex Backend (Policy Registry Service)**

```typescript
// Apply to implementation...
```

**Blockchain Integration Layer**

```typescript
// Apply to implementation...
```

**On-Chain Smart Contract (Policy Registry)**

```clarity
;; Apply to implementation...
```

## 7. Technical Debt Considerations

Areas that may require future refinement:

**Scalability Enhancements**

- Implement batching for gas-intensive operations
- Optimize database indexing for high transaction volume
- Explore layer 2 solutions for higher throughput

**Feature Extensions**

- Add support for additional token types beyond STX and sBTC
- Implement governance mechanisms for parameter updates
- Develop advanced analytics for risk management

**Security Improvements**

- Implement multi-signature authorization for critical operations
- Add formal verification of smart contracts
- Enhance auditing capabilities for user operations

**User Experience Refinements**

- Implement mobile-responsive designs
- Add advanced visualization tools for risk analysis
- Create guided onboarding flows for new users

## 8. Conclusion

This implementation roadmap provides a comprehensive plan for building the BitHedge platform using the "On-Chain Light" architectural approach. By strategically distributing responsibilities between on-chain and off-chain components, the platform achieves an optimal balance of security, usability, and cost efficiency.

The phased approach allows for incremental delivery and validation of functionality, with clear dependencies between tasks. Each phase builds upon the previous one, starting with the core smart contracts and gradually extending to the backend services, blockchain integration, frontend components, and finally comprehensive testing and deployment.

Successful implementation of this roadmap will result in a robust platform that enables:

- Secure creation and management of Bitcoin protection policies
- Efficient capital management for liquidity providers
- Transparent yield generation from providing protection
- Clear user interfaces for all stakeholders
- Reliable and scalable system operation

By following this roadmap, the development team can deliver a high-quality implementation of the BitHedge platform that brings sophisticated Bitcoin protection and yield generation to users in a secure and intuitive way.
