# BitHedge CTA Buttons Implementation Plan

## 1. Executive Summary

This document outlines the development plan for fully implementing the Call-To-Action (CTA) buttons that trigger the policy creation process in the BitHedge platform. Specifically, it addresses the implementation of the "Activate Protection" button for protection buyers (LONG_PUT position) and the "Commit Capital" button for liquidity providers (SHORT_PUT position).

These buttons serve as the critical transition point between the quote generation/customization phase and the actual policy creation phase, triggering a complex series of operations across multiple application layers while maintaining the state symbiosis relationship between the Convex backend and blockchain smart contracts.

### 1.1 Implementation Goals

1. **Complete End-to-End Flow**: Implement the full policy creation flow from button click to on-chain confirmation
2. **State Symbiosis**: Maintain synchronized state between Convex backend and blockchain contracts
3. **Error Resilience**: Implement robust error handling and recovery mechanisms
4. **User Experience**: Provide clear feedback throughout the transaction lifecycle
5. **Security**: Ensure secure transaction preparation and signing

## 2. Current State Assessment

### 2.1 Existing Implementation Status

| Component                 | Current State                                    | Missing Elements                                              |
| ------------------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| Frontend CTA Buttons      | UI components exist but lack full implementation | Transaction preparation, wallet integration, state management |
| PolicySummary.tsx         | Has basic structure and premium calculation      | Missing blockchain transaction methods                        |
| ProviderIncomeSummary.tsx | Has basic structure and yield calculation        | Missing capital commitment methods                            |
| Convex Backend            | Has premium calculation and policy schema        | Missing transaction preparation functions                     |
| Blockchain Integration    | Basic structure exists                           | Incomplete transaction flow to contracts                      |
| Policy Registry Contract  | Implemented but untested with frontend           | Integration with frontend transactions                        |
| Liquidity Pool Contract   | Implemented but untested with frontend           | Integration with frontend transactions                        |

### 2.2 Technical Gaps

1. **Frontend Transaction Flow**

   - Missing wallet connection and transaction signing logic
   - Incomplete transaction status tracking
   - No transaction confirmation UI

2. **Backend Integration**

   - Quote finalization endpoint incomplete
   - Missing transaction preparation logic
   - Incomplete event listeners for blockchain events

3. **State Synchronization**

   - Off-chain state not properly updated after on-chain events
   - Missing reconciliation logic for failed transactions

4. **Error Handling**
   - Incomplete validation before transaction preparation
   - Missing retry mechanisms for failed transactions
   - Inadequate user feedback for errors

## 3. Implementation Requirements

### 3.1 Technical Requirements

1. **Frontend Components**

   - Add transaction preparation and signing to CTA buttons
   - Implement transaction status UI (loading, success, failure states)
   - Add wallet connection and signature request handling
   - Implement transaction confirmation modal

2. **Convex Backend**

   - Implement quote finalization and locking functions
   - Create transaction preparation endpoints
   - Build blockchain event listeners
   - Implement state synchronization logic

3. **Blockchain Integration**

   - Complete transaction preparation functions
   - Implement transaction status tracking
   - Add event processing for policy creation events

4. **Testing & Validation**
   - Unit tests for each component
   - Integration tests for full flow
   - End-to-end testing with contracts

### 3.2 Functional Requirements

1. **Buyer Flow ("Activate Protection")**

   - Finalize premium quote with latest market data
   - Prepare policy creation transaction package
   - Handle wallet connection and transaction signing
   - Submit signed transaction to blockchain
   - Update UI based on transaction status
   - Process blockchain events and update Convex state
   - Update UI with policy status

2. **Provider Flow ("Commit Capital")**
   - Finalize yield quote with latest market data
   - Prepare capital commitment transaction package
   - Handle wallet connection and transaction signing
   - Submit signed transaction to blockchain
   - Update UI based on transaction status
   - Process blockchain events and update Convex state
   - Update UI with commitment status

### 3.3 User Experience Requirements

1. **Pre-Transaction**

   - Clear call-to-action buttons with appropriate labels
   - Informative tooltips explaining the action
   - Disabled states for invalid parameters

2. **During Transaction**

   - Loading indicators during transaction preparation
   - Clear wallet connection prompts
   - Transaction preview with confirmation step
   - Abort/Cancel options

3. **Post-Transaction**
   - Success/failure notifications
   - Transaction details summary
   - Next steps guidance
   - Error recovery options

## 4. Implementation Approach

### 4.1 Architecture Overview

The implementation will follow the existing "On-Chain Light" architecture with state symbiosis between Convex and blockchain:

1. **Frontend Layer**

   - React components with state management
   - Wallet integration via Connect Kit
   - Transaction status tracking

2. **Convex Backend Layer**

   - Quote finalization and locking
   - Transaction preparation
   - Event listening and processing
   - State synchronization

3. **Blockchain Layer**
   - Policy Registry contract for policy creation
   - Liquidity Pool Vault contract for capital commitment
   - Event emission for state changes

### 4.2 Component Interactions

The implementation will maintain the flows documented in policy-creation-component-interaction-flows.md with these key interaction points:

1. **Frontend → Convex**

   - Quote finalization requests
   - Transaction preparation requests
   - Status update requests

2. **Convex → Frontend**

   - Finalized quotes
   - Transaction packages for signing
   - Status updates and confirmations

3. **Frontend → Blockchain**

   - Signed transactions submission

4. **Blockchain → Convex**

   - Event notifications
   - Transaction confirmations

5. **Convex → Blockchain**
   - Read-only state queries
   - Transaction status checks

### 4.3 State Management Strategy

To maintain state symbiosis, the implementation will:

1. **Use Event-Driven Architecture**

   - Smart contracts emit detailed events
   - Convex listens for events to update state
   - Frontend subscribes to Convex state changes

2. **Implement Optimistic Updates**

   - Update UI immediately after transaction submission
   - Confirm updates after blockchain confirmation
   - Rollback on failure

3. **Maintain Transaction Status Tracking**

   - Create pending transaction records in Convex
   - Update status based on blockchain events
   - Provide status query endpoints for frontend

4. **Implement Reconciliation Processes**
   - Scheduled jobs to verify state consistency
   - Manual intervention hooks for exceptions

## 5. Task Status Legend

| Status      | Symbol | Description                                   |
| ----------- | ------ | --------------------------------------------- |
| Not Started | ⬜     | Task has not been started yet                 |
| In Progress | 🟡     | Task is actively being worked on              |
| Blocked     | 🔴     | Task is blocked by unresolved dependencies    |
| Testing     | 🟣     | Implementation complete, currently in testing |
| Completed   | 🟢     | Task fully completed and verified             |
| Deferred    | ⚪     | Task postponed to a future development cycle  |

## 6. Detailed Implementation Plan

### 6.1 Phase 1: Backend Preparation (Week 1)

#### 6.1.1 Quote Finalization and Locking

| Task ID | Description                                                 | Est. Hours | Status | Dependencies | Assignee |
| ------- | ----------------------------------------------------------- | ---------- | ------ | ------------ | -------- |
| QB-101  | Create schema updates for quote locking in `quotes` table   | 4          | 🟢     |              |          |
| QB-102  | Implement `finalizeQuote` mutation with market data refresh | 6          | 🟢     | QB-101       |          |
| QB-103  | Implement `lockQuote` helper function with expiration time  | 4          | 🟢     | QB-101       |          |
| QB-104  | Create unit tests for quote finalization endpoints          | 4          | 🟢     | QB-102       |          |
| QB-105  | Add validation for locked quotes to prevent modification    | 3          | 🟢     | QB-103       |          |

**Notes on Quote Finalization and Locking (Section 6.1.1):**

- **QB-101**: Schema fields `isLocked`, `lockedAt`, `lockExpiresAt` are implicitly defined by their usage in the `finalizeQuote` mutation and `_lockQuoteInternal` helper in `convex/quotes.ts`.
- **QB-102**: The `finalizeQuote` mutation in `convex/quotes.ts` is implemented. It fetches fresh market data (price and volatility), recalculates quote results for both buyer and provider types using internal helpers (`_recalculateBuyerQuoteResult`, `_recalculateProviderQuoteResult`) and active risk parameters, and updates relevant snapshots on the quote document.
- **QB-103**: An internal helper function `_lockQuoteInternal(ctx, quoteId, durationMs)` exists within `convex/quotes.ts`. It's used by `finalizeQuote` when `lockForTransaction` is true to set `isLocked`, `lockedAt`, and `lockExpiresAt` (5-minute duration).
- **QB-104**: Unit tests for `finalizeQuote` are present in `convex/quotes.test.ts`. They cover scenarios for both buyer and provider quotes, including recalculation with and without locking, and error handling for quote not found, already locked, and missing market data. (Note 1: Linter errors exist in `convex/quotes.ts` related to `math.sqrt` and in `convex/quotes.test.ts` related to `vi.spyOn` that need addressing for overall code health, but the test logic for finalization and locking is implemented).
- **QB-105**: Validation for locked quotes is implemented within `finalizeQuote` (preventing re-finalization if already locked and unexpired) and also in `updateQuoteStatus` (preventing status changes on locked quotes).

**Implementation Example:**

```typescript
// convex/quotes.ts
export const finalizeQuote = mutation({
  args: {
    quoteId: v.string(),
    lockForTransaction: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Finalize quote with latest market data
    // Lock quote if requested
    // Return finalized quote
  },
});
```

#### 6.1.2 Transaction Preparation

| Task ID | Description                                                     | Est. Hours | Status | Dependencies   | Assignee |
| ------- | --------------------------------------------------------------- | ---------- | ------ | -------------- | -------- |
| TP-101  | Create `transactionPreparation.ts` module for policy registry   | 3          | 🟢     |                |          |
| TP-102  | Implement `preparePolicyCreationTransaction` mutation           | 8          | 🟢     | QB-102, QB-103 |          |
| TP-103  | Create transaction package format for policy creation           | 4          | 🟢     | TP-101         |          |
| TP-104  | Create `transactionPreparation.ts` module for liquidity pool    | 3          | 🟢     |                |          |
| TP-105  | Implement `prepareCapitalCommitmentTransaction` mutation        | 8          | 🟡     | QB-102, QB-103 |          |
| TP-106  | Create transaction package format for capital commitment        | 4          | 🟢     | TP-104         |          |
| TP-107  | Add blockchain parameter conversion helpers (USD to sats, etc.) | 5          | 🟢     | TP-103, TP-106 |          |
| TP-108  | Create unit tests for transaction preparation endpoints         | 6          | ⬜     | TP-102, TP-105 |          |

**Notes on Transaction Preparation (Section 6.1.2):**

- **TP-101**: `convex/policyRegistry/transactionPreparation.ts` created and initial structure established.
- **TP-102**: `preparePolicyCreationPackage` action (public) and `internalPreparePolicyCreationTransaction` (internal mutation) implemented.
  - Fetches locked quote, performs comprehensive validation.
  - Calculates all necessary parameters for the `policy-registry.create-policy-entry` smart contract call.
  - Integrates dynamic fetching of `currentBurnBlockHeight` via a new Convex action (`stacksNode.getCurrentBurnBlockHeight`) which uses centralized network configuration.
  - Counterparty address is now correctly sourced from `getLiquidityPoolContract()` in `convex/blockchain/common/contracts.ts`.
  - Unit conversions (USD to cents, BTC to Sats, STX to microSTX) are handled using centralized utility functions.
  - A persistent linter error ("Type instantiation is excessively deep") is present on the ctx.runMutation call within `preparePolicyCreationPackage` action and needs further investigation. **This task's output (now preparePolicyCreationPackage action) will be reassessed and potentially modified by LPI-101 (for collateral check) and LPI-103 (for premium transfer parameters) to ensure full Liquidity Pool integration.**
- **TP-103**: `PolicyCreationContractCallParams` and `PolicyCreationTransactionPackage` types are defined and validated in `transactionPreparation.ts`, accurately reflecting the data needed for the frontend and smart contract.
- **TP-104**: `convex/liquidityPool/transactionPreparation.ts` created and basic structure established during the initial implementation of TP-105.
- **TP-105**: Core implementation of the `prepareCapitalCommitmentTransaction` Convex action is complete in `convex/liquidityPool/transactionPreparation.ts`, including logic for quote-based and direct commitments, STX/sBTC handling, unit conversions, and internal quote locking. Pending unit tests (TP-108) for full completion.
- **TP-106**: `CapitalCommitmentContractCallParams` and `CapitalCommitmentTransactionPackage` types are defined in `convex/liquidityPool/transactionPreparation.ts` as part of TP-105 implementation.
- **TP-107**: Blockchain parameter conversion helpers for policy creation (`usdToCents`, `btcToSatoshis`, `stxToMicroStx`) are now centralized and used from `convex/blockchain/common/utils.ts`. The `usdToCents` function was added to this common utility file.

**Implementation Example:**

```typescript
// convex/policyRegistry/transactionPreparation.ts
export const preparePolicyCreationTransaction = mutation({
  args: {
    quoteId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get locked quote
    // Validate quote is still valid
    // Prepare transaction to call policy-registry.create-policy-entry
    // Return transaction package
  },
});
```

#### 6.1.3 Transaction Status Tracking

| Task ID | Description                                                            | Est. Hours | Status | Dependencies   | Assignee |
| ------- | ---------------------------------------------------------------------- | ---------- | ------ | -------------- | -------- |
| TS-101  | Create `transactionSchema` in schema.ts                                | 3          | 🟢     |                |          |
| TS-102  | Implement `updateTransactionStatus` mutation with status state machine | 6          | 🟢     | TS-101         |          |
| TS-103  | Create `getTransactionStatus` query endpoint                           | 4          | 🟢     | TS-101         |          |
| TS-104  | Implement error handling and storage in transaction records            | 5          | 🟢     | TS-102         |          |
| TS-105  | Create `getTransactionsForUser` query for transaction history          | 4          | 🟢     | TS-101         |          |
| TS-106  | Create unit tests for transaction status management                    | 5          | 🟢     | TS-102, TS-103 |          |

**Notes on Transaction Status Tracking (Section 6.1.3):**

- **TS-101 (transactionSchema)**: Implemented in `convex/schema.ts`. The `transactions` table includes fields for `userId`, `quoteId` (as `v.id("quotes")`), `type` (POLICY_CREATION, CAPITAL_COMMITMENT), `status` (PENDING, SUBMITTED, CONFIRMED, FAILED, REPLACED, EXPIRED), `txHash`, `blockHeight`, `network`, `parameters`, various timestamps (`createdAt`, `updatedAt`, `submittedAt`, `confirmedOrFailedAt`), `errorDetails` (structured object), `actionName`, and `relatedId`. Comprehensive indexes including `by_userId_and_status`, `by_quoteId`, `by_txHash`, `by_status_and_type`, `by_createdAt`, and the advanced `by_userId_and_type_and_status` have been added.
- **TS-102 (updateTransactionStatus)**: Implemented in `convex/transactions.ts`. This mutation includes a state machine to validate status transitions. It handles updates to all relevant fields, including setting `submittedAt` and `confirmedOrFailedAt` timestamps and clearing/setting `errorDetails` as appropriate during status changes. **This mutation will be refined under LPI-104 to ensure robust event correlation for buyer transactions that include both policy creation and premium transfer to the Liquidity Pool.**
- **TS-103 (getTransactionStatus)**: Implemented as a query in `convex/transactions.ts` to fetch a single transaction document by its `Id<"transactions">`.
- **TS-104 (Error Handling and Storage)**: Implemented as part of `convex/schema.ts` with the `errorDetails: v.optional(v.object({...}))` field in the `transactions` table, and handled within the `updateTransactionStatus` mutation in `convex/transactions.ts` where error objects are stored or cleared.
- **TS-105 (getTransactionsForUser)**: Implemented as a query in `convex/transactions.ts`. This query allows fetching transactions for a `userId`, with optional filters for `status` and `type`. It has been optimized to use a compound index `by_userId_and_type_and_status` when all three are provided, falling back to `by_userId_and_status` or in-memory filtering for `type` if only `userId` and `type` are given. It also supports a `limit` for pagination.
- **TS-106 (Unit Tests)**: Implemented in `convex/transactions.test.ts`. Tests cover `createTransaction` (helper), `updateTransactionStatus` (including valid and invalid transitions, error detail handling), `getTransactionStatus`, and `getTransactionsForUser` (including various filter combinations and the compound index usage).
- **Helper `createTransaction`**: A mutation was added to `convex/transactions.ts` to facilitate the creation of new transaction records in the `PENDING` state, which is essential for the overall workflow and used in unit tests.
- **Stronger `quoteId` Typing**: `quoteId` in `transactions` schema and related functions/tests was updated from `v.string()` to `v.id("quotes")`.
- **Advanced Querying for `getTransactionsForUser`**: Implemented by adding a compound index `by_userId_and_type_and_status` and updating the query logic to use it.

**Current Linter/Test Issues to Address:**

- The test file `convex/transactions.test.ts` currently has linter errors related to:
  1.  `Cannot find module 'convex-test-utils'`: This package needs to be installed/resolved in the project's dev dependencies.
  2.  `Type instantiation is excessively deep`: This often arises from complex generic type interactions, potentially exacerbated by the test setup or `Id` type usage with `convex-test-utils`. Further investigation is needed after the `convex-test-utils` module is correctly resolved.

**Implementation Example:**

```typescript
// convex/schema.ts
// ... (transactions table definition as described in TS-101 notes)
// ... existing code ...
// convex/transactions.ts
// ... (implementation of createTransaction, updateTransactionStatus, getTransactionStatus, getTransactionsForUser)
// ... existing code ...
```

#### 6.1.4 Liquidity Pool Interaction Assessment & Backend Refinement (NEW SUB-PHASE)

**Architectural Context:** This sub-phase addresses critical interactions with the Liquidity Pool during the buyer's policy creation flow. The primary goals are to:

1.  Ensure the Convex backend verifies sufficient collateral in the Liquidity Pool _before_ preparing a policy creation transaction. This aligns with the "On-Chain Light" principle by keeping complex queries off-chain.
2.  Define and implement a robust mechanism for transferring the buyer's premium to the Liquidity Pool Vault as part of the policy creation transaction, preferably via a single user signature using frontend-constructed multi-call transactions.

| Task ID | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Est. Hours | Status | Dependencies                     | Assignee |
| :------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- | :------------------------------- | :------- |
| LPI-101 | **Assess & Implement Collateral Check**: Review/Implement Convex backend logic in `preparePolicyCreationPackage` (related to TP-102) to query Liquidity Pool service for sufficient collateral (considering available capital, risk tier capacities) before returning transaction package. Ensure clear error handling for insufficient collateral scenarios, preventing users from proceeding. <br> **Note:** This check is an off-chain backend responsibility.                                                                                                                                      | 6          | ⬜     | TP-102 (for assessment)          |          |
| LPI-102 | **Assess Premium Transfer Mechanism**: Review `policy-registry.clar` (`create-policy-entry`), existing `preparePolicyCreationPackage` (related to TP-102), and current frontend transaction construction (related to BF-104) to determine how premium is currently handled. Decide on the final mechanism for transferring premium to Liquidity Pool Vault. <br> **Architectural Recommendation:** Favor a frontend-constructed multi-call transaction (user signs once) that 1) transfers premium to LP Vault, 2) calls `create-policy-entry` on Policy Registry. This keeps Policy Registry "light". | 4          | ⬜     | TP-102, BF-104 (for assessment)  |          |
| LPI-103 | **Refine `preparePolicyCreationPackage` for Premium Transfer**: Based on LPI-102 decision (likely multi-call), update the `preparePolicyCreationPackage` backend action to provide all necessary parameters to the frontend. This includes parameters for the `Policy Registry` call _and_ for the premium transfer to `Liquidity Pool Vault` (e.g., LP Vault contract address, premium amount in base units, premium token identifier like sBTC contract principal or native STX indicator, target function on LP Vault if applicable).                                                               | 5          | ⬜     | LPI-102                          |          |
| LPI-104 | **Enhance Backend Event Listening for Premium**: Refine `updateTransactionStatus` (related to TS-102) and associated backend event listeners to correctly process and correlate `funds-deposited` (or equivalent premium received) events from the `Liquidity Pool Vault` with `policy-created` events from the `Policy Registry` for the buyer's single transaction. Ensure transaction status reflects both operations.                                                                                                                                                                              | 4          | ⬜     | TS-102 (for refinement), LPI-102 |          |
| LPI-105 | **Unit Tests for Backend LP Interactions**: Add comprehensive unit tests for the backend collateral check logic (LPI-101) and for the updated `preparePolicyCreationPackage` ensuring correct parameter generation for premium transfer (LPI-103).                                                                                                                                                                                                                                                                                                                                                     | 4          | ⬜     | LPI-101, LPI-103                 |          |

### 6.2 Phase 2: Frontend Implementation (Week 2)

#### 6.2.1 Buyer Flow Implementation

| Task ID | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Est. Hours | Status | Dependencies                                        | Assignee |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ | --------------------------------------------------- | -------- |
| BF-101  | Add transaction state management to PolicySummary.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 4          | 🟢     |                                                     |          |
| BF-102  | Implement `handleActivateProtection` method                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 8          | 🟢     | BF-101, QB-102, TP-102                              |          |
| BF-103  | Create wallet connection and signature handling                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 6          | 🟡     | BF-101                                              |          |
| BF-104  | Implement transaction submission to blockchain                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 5          | 🟢     | BF-103                                              |          |
| BF-105  | Create transaction status polling mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 5          | 🟢     | TS-103                                              |          |
| BF-106  | Create `useTransactionStatus` hook                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 4          | ⚪     | TS-103                                              |          |
| BF-107  | Implement UI state updates based on transaction status                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 5          | 🟢     | BF-105, BF-106                                      |          |
| BFC-101 | **Implement Frontend Multi-Call Transaction Construction**: If LPI-103 (backend) dictates providing parameters for a multi-call transaction, refactor `executeContractCall` in `lib/contract-utils.ts` and its usage in `PolicySummary.tsx` (`handleActivateProtection`). This involves constructing and submitting a single Stacks transaction that bundles: 1) The premium transfer call to the `Liquidity Pool Vault` contract. 2) The `create-policy-entry` call to the `Policy Registry` contract. Ensure user signs only once. | 6          | ⬜     | BF-104 (for refinement based on this), LPI-103      |          |
| BF-108  | Add error handling and recovery for failed transactions, **including specific frontend handling for "insufficient collateral" errors from backend (LPI-101) and potential multi-call transaction failures (BFC-101)**                                                                                                                                                                                                                                                                                                                | 6          | 🟡     | BF-102, BF-104, **BFC-101 (if impl.)**, **LPI-101** |          |
| BF-109  | Create unit tests for buyer flow, **ensuring coverage for multi-call transaction construction (if BFC-101 is implemented) and related error handling**                                                                                                                                                                                                                                                                                                                                                                               | 6          | ⬜     | BF-102, BF-107, **BFC-101 (if impl.)**              |          |

**Notes on Buyer Flow Implementation (Section 6.2.1):**

- **BF-101 (Add transaction state management to PolicySummary.tsx):**

  - Status: 🟢 Completed
  - Notes: `TransactionContext.tsx` effectively centralizes transaction state (`activeConvexId`, `blockchainTxId`, `uiStatus` via `TransactionUiStatus` enum, and `errorDetails`). `PolicySummary.tsx` consumes this context to manage and display transaction progress and outcomes.

- **BF-102 (Implement `handleActivateProtection` method):**

  - Status: 🟢 Completed (Pending Review for LP Integration)
  - Notes: The `handleActivateProtection` method in `PolicySummary.tsx` successfully orchestrates the buyer's policy activation. It calls backend Convex actions: `finalizeQuote` and `preparePolicyCreationPackage`. The latter now correctly returns serializable parameters which are then used for frontend transaction construction. **This method will be reviewed and potentially updated based on the outcomes of LPI-103 to correctly utilize parameters for a multi-call transaction if that mechanism is chosen for premium transfer to the Liquidity Pool.**

- **BF-103 (Create wallet connection and signature handling):**

  - Status: 🟡 In Progress
  - Notes: The immediate "Invalid Clarity Value" and "SerializationError" issues related to preparing parameters for Stacks.js have been resolved by ensuring `functionArgs` are correctly (re)constructed as `ClarityValue` instances on the frontend (`lib/contract-utils.ts`). Full wallet integration (e.g., Hiro Wallet connect, Ledger) beyond the current DevNet mock/direct execution is still pending but the foundational parameter handling is fixed.

- **BF-104 (Implement transaction submission to blockchain):**

  - Status: 🟢 Completed (Pending Review for LP Integration)
  - Notes:
    - Frontend successfully receives serializable contract call parameters from the backend (`preparePolicyCreationPackage`).
    - `lib/contract-utils.ts` (`executeContractCall`) was refactored to include `convertToActualClarityValues`, ensuring `functionArgs` are transformed into an array of `ClarityValue` instances before calling `makeContractCall`.
    - This resolved the "Invalid Clarity Value" error, and transactions are now being successfully constructed and broadcasted (as evidenced by `blockchainTxHash` being generated).
    - `PolicySummary.tsx` calls `api.transactions.updateTransactionStatus` to store the `blockchainTxHash` and update the backend transaction status to `SUBMITTED`.
    - **The `executeContractCall` function and its usage will be reviewed and potentially refactored as part of new task BFC-101 to support constructing and broadcasting multi-call transactions, should this be required by LPI-103 for premium transfer to the Liquidity Pool.**

- **BF-105 (Create transaction status polling mechanism):**

  - Status: 🟢 Completed
  - Notes: Polling logic using `useQuery` and the backend query `api.transactions.pollTransactionStatus` is implemented and functional within `TransactionContext.tsx`. The frontend correctly maps backend transaction statuses (e.g., "PENDING", "SUBMITTED") to the frontend's `TransactionUiStatus` enum, providing real-time (via polling) updates. This includes handling `errorDetails` from the backend if a transaction fails.

- **BF-106 (Create `useTransactionStatus` hook):**

  - Status: ⚪ Deferred
  - Notes: The current polling and status management logic is integrated within `TransactionContext.tsx`. While a dedicated `useTransactionStatus` hook was planned, the context currently provides the necessary functionality. This task is deferred, and can be revisited if a standalone hook offers significant advantages or is needed for other components.

- **BF-107 (Implement UI state updates based on transaction status):**

  - Status: 🟢 Completed
  - Notes: The UI in `PolicySummary.tsx` dynamically updates based on `transactionUiStatus` sourced from `TransactionContext`. This now reflects actual transaction states derived from backend polling, an improvement over previous mock states.

- **BF-108 (Add error handling and recovery for failed transactions):**

  - Status: 🟡 In Progress
  - Notes: Basic error display from `TransactionContext` (which now receives `errorDetails` from backend polling) is implemented. The critical runtime errors during transaction preparation and submission ("Invalid Clarity Value", Convex serialization errors) have been resolved. More nuanced error categorization, user-friendly messages for different failure scenarios (e.g., insufficient funds, contract errors), and specific recovery options (e.g., retry) are still areas for enhancement.

- **BF-109 (Create unit tests for buyer flow):**
  - Status: ⬜ Not Started

**Implementation Example:**

```typescript
// front-end/src/hooks/useTransactionStatus.ts
export function useTransactionStatus(transactionId) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!transactionId) return;

    const interval = setInterval(async () => {
      const transaction = await getTransactionStatusQuery({ transactionId });
      setStatus(transaction.status);

      if (["confirmed", "failed"].includes(transaction.status)) {
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [transactionId]);

  return status;
}
```

#### 6.2.2 Provider Flow Implementation

| Task ID | Description                                                   | Est. Hours | Status | Dependencies           | Assignee |
| ------- | ------------------------------------------------------------- | ---------- | ------ | ---------------------- | -------- |
| PF-101  | Add transaction state management to ProviderIncomeSummary.tsx | 4          | ⬜     |                        |          |
| PF-102  | Implement `handleCommitCapital` method                        | 8          | ⬜     | PF-101, QB-102, TP-105 |          |
| PF-103  | Create wallet connection and signature handling               | 6          | ⬜     | PF-101                 |          |
| PF-104  | Implement transaction submission to blockchain                | 5          | ⬜     | PF-103                 |          |
| PF-105  | Create transaction status polling mechanism                   | 5          | ⬜     | TS-103                 |          |
| PF-106  | Adapt `useTransactionStatus` hook for provider flow           | 3          | ⬜     | BF-106                 |          |
| PF-107  | Implement UI state updates based on transaction status        | 5          | ⬜     | PF-105, PF-106         |          |
| PF-108  | Add error handling and recovery for failed transactions       | 6          | ⬜     | PF-102, PF-104         |          |
| PF-109  | Create unit tests for provider flow                           | 6          | ⬜     | PF-102, PF-107         |          |

#### 6.2.3 Transaction Confirmation UI

| Task ID | Description                                            | Est. Hours | Status | Dependencies   | Assignee |
| ------- | ------------------------------------------------------ | ---------- | ------ | -------------- | -------- |
| UI-101  | Create `TransactionConfirmationModal` component        | 5          | ⬜     |                |          |
| UI-102  | Implement `TransactionSummary` component               | 4          | ⬜     | UI-101         |          |
| UI-103  | Create `TransactionStatusIndicator` component          | 4          | ⬜     |                |          |
| UI-104  | Implement loading states and spinners                  | 3          | ⬜     |                |          |
| UI-105  | Create `ErrorMessage` component for transaction errors | 4          | ⬜     | UI-103         |          |
| UI-106  | Integrate confirmation modal with buyer flow           | 3          | ⬜     | UI-101, BF-102 |          |
| UI-107  | Integrate confirmation modal with provider flow        | 3          | ⬜     | UI-101, PF-102 |          |
| UI-108  | Add unit tests for UI components                       | 5          | ⬜     | UI-101, UI-103 |          |

### 6.3 Phase 3: Blockchain Event Handling (Week 3)

#### 6.3.1 Event Listener Implementation

| Task ID | Description                                                       | Est. Hours | Status | Dependencies   | Assignee |
| ------- | ----------------------------------------------------------------- | ---------- | ------ | -------------- | -------- |
| EV-101  | Create `blockchainEvents` directory structure                     | 2          | ⬜     |                |          |
| EV-102  | Implement `setupPolicyEventListeners` mutation                    | 6          | ⬜     | EV-101         |          |
| EV-103  | Create `handlePolicyCreatedEvent` event handler                   | 8          | ⬜     | EV-102, TS-102 |          |
| EV-104  | Implement `setupLiquidityPoolEventListeners` mutation             | 6          | ⬜     | EV-101         |          |
| EV-105  | Create `handleFundsDepositedEvent` event handler                  | 8          | ⬜     | EV-104, TS-102 |          |
| EV-106  | Implement blockchain polling mechanism for events                 | 5          | ⬜     | EV-102, EV-104 |          |
| EV-107  | Create mapping between blockchain events and Convex state updates | 6          | ⬜     | EV-103, EV-105 |          |
| EV-108  | Add event handling unit tests                                     | 6          | ⬜     | EV-103, EV-105 |          |

**Implementation Example:**

```typescript
// convex/blockchainEvents/policyEvents.ts
export const setupPolicyEventListeners = mutation({
  handler: async (ctx) => {
    // Set up listener for policy-created events
    // Handle new events and update off-chain state
  },
});

async function handlePolicyCreatedEvent(ctx, event) {
  // Extract policy details from event
  // Update policy status in Convex
  // Update transaction status to 'confirmed'
  // Update related records (e.g., quotes)
}
```

#### 6.3.2 State Reconciliation

| Task ID | Description                                        | Est. Hours | Status | Dependencies   | Assignee |
| ------- | -------------------------------------------------- | ---------- | ------ | -------------- | -------- |
| SR-101  | Create `reconciliation.ts` module                  | 3          | ⬜     |                |          |
| SR-102  | Implement `reconcileTransactions` mutation         | 8          | ⬜     | SR-101, TS-102 |          |
| SR-103  | Add transaction status checking with blockchain    | 6          | ⬜     | SR-102         |          |
| SR-104  | Implement `reconcilePolicyStatus` mutation         | 8          | ⬜     | SR-101         |          |
| SR-105  | Create on-chain query utilities for policy status  | 5          | ⬜     | SR-104         |          |
| SR-106  | Add scheduled job for transaction reconciliation   | 4          | ⬜     | SR-102, SR-103 |          |
| SR-107  | Add scheduled job for policy status reconciliation | 4          | ⬜     | SR-104, SR-105 |          |
| SR-108  | Create unit tests for reconciliation logic         | 6          | ⬜     | SR-102, SR-104 |          |

### 6.4 Phase 4: Integration and Error Handling (Week 4)

#### 6.4.1 Error Handling Implementation

| Task ID | Description                                             | Est. Hours | Status | Dependencies   | Assignee |
| ------- | ------------------------------------------------------- | ---------- | ------ | -------------- | -------- |
| EH-101  | Create `errorHandling.ts` utility module                | 3          | ⬜     |                |          |
| EH-102  | Implement `handleTransactionError` function             | 6          | ⬜     | EH-101         |          |
| EH-103  | Create error categorization logic                       | 5          | ⬜     | EH-102         |          |
| EH-104  | Implement `TransactionErrorRecovery` component          | 6          | ⬜     | EH-102, UI-105 |          |
| EH-105  | Add retry mechanisms for recoverable errors             | 5          | ⬜     | EH-103, EH-104 |          |
| EH-106  | Create user-friendly error messages for common failures | 4          | ⬜     | EH-103         |          |
| EH-107  | Integrate error handling with buyer flow                | 4          | ⬜     | EH-104, BF-108 |          |
| EH-108  | Integrate error handling with provider flow             | 4          | ⬜     | EH-104, PF-108 |          |
| EH-109  | Create unit tests for error handling logic              | 5          | ⬜     | EH-102, EH-104 |          |

**Implementation Example:**

```typescript
// front-end/src/utils/errorHandling.ts
export function handleTransactionError(error) {
  // Categorize errors
  if (error.message.includes("rejected by user")) {
    return {
      type: "user_rejection",
      message: "Transaction was rejected by the user.",
      recoverable: true,
    };
  }

  if (error.message.includes("insufficient funds")) {
    return {
      type: "insufficient_funds",
      message:
        "Your wallet does not have sufficient funds for this transaction.",
      recoverable: true,
    };
  }

  // Additional error categories...

  return {
    type: "unknown",
    message: "An unknown error occurred. Please try again later.",
    recoverable: false,
    details: error.message,
  };
}
```

#### 6.4.2 Integration Testing

| Task ID | Description                                   | Est. Hours | Status | Dependencies                   | Assignee |
| ------- | --------------------------------------------- | ---------- | ------ | ------------------------------ | -------- |
| IT-101  | Create integration test framework setup       | 5          | ⬜     |                                |          |
| IT-102  | Implement mock blockchain client for testing  | 8          | ⬜     | IT-101                         |          |
| IT-103  | Create end-to-end test for buyer flow         | 8          | ⬜     | IT-102, BF-109                 |          |
| IT-104  | Create end-to-end test for provider flow      | 8          | ⬜     | IT-102, PF-109                 |          |
| IT-105  | Implement wallet rejection test scenarios     | 4          | ⬜     | IT-103, IT-104                 |          |
| IT-106  | Implement blockchain failure test scenarios   | 5          | ⬜     | IT-103, IT-104                 |          |
| IT-107  | Create network failure test scenarios         | 5          | ⬜     | IT-103, IT-104                 |          |
| IT-108  | Implement event processing tests              | 6          | ⬜     | IT-102, EV-108                 |          |
| IT-109  | Create state reconciliation tests             | 6          | ⬜     | IT-102, SR-108                 |          |
| IT-110  | Complete integration test suite for all flows | 10         | ⬜     | IT-103, IT-104, IT-108, IT-109 |          |

## 7. Testing Strategy

### 7.1 Unit Testing

| Component               | Test Cases                            | Priority |
| ----------------------- | ------------------------------------- | -------- |
| Quote Finalization      | Finalize with valid parameters        | High     |
| Quote Finalization      | Handle invalid parameters             | High     |
| Quote Finalization      | Locking mechanism                     | Medium   |
| Transaction Preparation | Prepare valid buyer transaction       | High     |
| Transaction Preparation | Prepare valid provider transaction    | High     |
| Transaction Preparation | Handle expired quotes                 | Medium   |
| Transaction Status      | Create and update transaction records | High     |
| Transaction Status      | Handle status transitions             | Medium   |
| Error Handling          | Classify and handle various errors    | High     |
| UI Components           | Render confirmation modal             | Medium   |
| UI Components           | Render status indicators              | Medium   |

### 7.2 Integration Testing

| Flow                     | Test Scenarios                             | Priority |
| ------------------------ | ------------------------------------------ | -------- |
| End-to-End Buyer Flow    | Happy path (successful policy creation)    | Critical |
| End-to-End Buyer Flow    | Wallet rejection                           | High     |
| End-to-End Buyer Flow    | Blockchain rejection                       | High     |
| End-to-End Buyer Flow    | Network failure during submission          | Medium   |
| End-to-End Provider Flow | Happy path (successful capital commitment) | Critical |
| End-to-End Provider Flow | Insufficient funds                         | High     |
| Event Processing         | Policy creation event processing           | High     |
| Event Processing         | Capital commitment event processing        | High     |
| State Reconciliation     | Detect and fix state inconsistencies       | Medium   |

### 7.3 Test Environment

1. **Local Development Environment**

   - Mock blockchain interactions for rapid testing
   - Simulate events for testing event listeners
   - Unit test individual components

2. **Staging Environment**

   - Use testnet for blockchain interactions
   - Test complete flows with actual blockchain transactions
   - Verify event processing with testnet events

3. **Production Simulation**
   - Use mainnet with minimal amounts
   - Verify gas estimations are accurate
   - Test under production-like conditions

## 8. Rollout Plan

### 8.1 Phase-Based Rollout

| Phase      | Components              | Timeline | Success Criteria                  |
| ---------- | ----------------------- | -------- | --------------------------------- |
| Alpha      | Backend Endpoints       | Week 5   | All backend endpoints pass tests  |
| Alpha      | Frontend Implementation | Week 6   | Frontend components passing tests |
| Beta       | Controlled User Testing | Week 7-8 | Successful test transactions      |
| Production | Full Release            | Week 9   | Feature available to all users    |

### 8.2 Feature Flagging Strategy

1. **Backend Feature Flags**

   ```typescript
   // convex/featureFlags.ts
   export const getFeatureFlags = query({
     args: {
       feature: v.optional(v.string()),
     },
     handler: async (ctx, args) => {
       const flags = {
         "enable-policy-creation":
           process.env.ENABLE_POLICY_CREATION === "true",
         "enable-capital-commitment":
           process.env.ENABLE_CAPITAL_COMMITMENT === "true",
       };

       return args.feature ? flags[args.feature] : flags;
     },
   });
   ```

### 8.3 Monitoring and Metrics

1. **Key Metrics to Track**

   - Transaction success rate
   - Average time from button click to confirmation
   - Error frequency by category
   - State reconciliation frequency

2. **Alerting System**
   - Set up alerts for transaction failures
   - Monitor for stuck transactions
   - Track state inconsistencies

### 8.4 Rollback Plan

In case of critical issues, the following rollback steps will be taken:

1. Disable feature flags to turn off new transactions
2. Continue processing existing submitted transactions
3. Revert code changes while maintaining data compatibility
4. Communicate with users about temporary unavailability

## 9. Risk Assessment and Mitigation

### 9.1 Risk Matrix

| Risk                        | Probability | Impact   | Overall | Mitigation                                         |
| --------------------------- | ----------- | -------- | ------- | -------------------------------------------------- |
| Transaction failures        | Medium      | High     | High    | Robust error handling, retry mechanisms            |
| State inconsistencies       | Medium      | High     | High    | Reconciliation processes, event validations        |
| Poor user experience        | Low         | Medium   | Medium  | Comprehensive status updates, clear error messages |
| Blockchain congestion       | Medium      | Medium   | Medium  | Dynamic gas price adjustment, transaction queuing  |
| Contract bugs               | Low         | Critical | High    | Thorough testing, audit before implementation      |
| Wallet compatibility issues | Medium      | High     | High    | Test with multiple wallets, graceful fallbacks     |

### 9.2 Mitigation Strategies

1. **For Transaction Failures**

   - Implement retry mechanisms with backoff
   - Provide clear manual recovery options
   - Maintain transaction history for support

2. **For State Inconsistencies**

   - Implement automated reconciliation processes
   - Use event-driven architecture for state updates
   - Maintain audit logs for debugging

3. **For User Experience Issues**

   - Provide clear status updates throughout the process
   - Implement informative error messages
   - Create help documentation for common issues

4. **For Blockchain Congestion**
   - Implement dynamic gas price adjustment
   - Allow users to customize transaction priority
   - Provide estimated confirmation times

## 10. Conclusion

This implementation plan provides a comprehensive approach to fully implementing the CTA buttons for both buyer and provider flows in the BitHedge platform. By following this phased approach with a focus on state symbiosis between Convex and blockchain, we can ensure a robust, reliable, and user-friendly experience for policy creation and capital commitment.

The plan maintains the architectural principles established in the system, particularly the "On-Chain Light" approach with rich off-chain functionality complemented by secure on-chain execution. The event-driven architecture ensures state consistency while providing a responsive user experience.

Key success factors for this implementation include:

1. **Thorough Testing**: Comprehensive testing of all components and flows
2. **Robust Error Handling**: Graceful handling of various failure scenarios
3. **Clear User Feedback**: Transparent status updates throughout the process
4. **State Consistency**: Reliable synchronization between Convex and blockchain

With this implementation, users will be able to seamlessly transition from policy customization to policy creation, completing the critical policy lifecycle flow in the BitHedge platform.

## 11. Progress Tracking Dashboard

| Phase                                   | Total Tasks | Not Started | In Progress | Testing | Completed | Completion % |
| --------------------------------------- | ----------- | ----------- | ----------- | ------- | --------- | ------------ |
| Phase 1: Backend Preparation            | 21          | 12          | 0           | 0       | 9         | 43%          |
| Phase 2: Frontend Implementation        | 26          | 26          | 0           | 0       | 0         | 0%           |
| Phase 3: Blockchain Event Handling      | 16          | 16          | 0           | 0       | 0         | 0%           |
| Phase 4: Integration and Error Handling | 19          | 19          | 0           | 0       | 0         | 0%           |
| Overall Implementation                  | 82          | 73          | 0           | 0       | 9         | 11%          |

</rewritten_file>
