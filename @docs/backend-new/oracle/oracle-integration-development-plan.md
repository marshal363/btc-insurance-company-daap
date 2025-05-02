# BitHedge Oracle Integration Development Plan

**Version:** 1.0
**Date:** 2024-08-13
**Context:** Implementing the Oracle system integration according to `bithedge-oracle-specification-guidelines.md` (Version 1.0).

## 1. Project Overview

This plan outlines the tasks required to implement the integrated BitHedge Oracle system, encompassing the refactored on-chain `oracle.clar` contract, the Convex Oracle Engine backend, and the frontend `BitcoinPriceCard.tsx` component. The goal is to realize the hybrid architecture specified in the guidelines, ensuring efficient off-chain computation and trust-minimized on-chain verification.

### Project Goals

1.  Refactor `oracle.clar` to align with the simplified specification (focus on storing validated price).
2.  Implement necessary Convex backend functions (aggregation, derived metrics, data serving, on-chain submission logic).
3.  Implement the Blockchain Integration Layer within Convex for secure interaction with `oracle.clar`.
4.  Integrate the `BitcoinPriceCard.tsx` component with the Convex backend for live data display.
5.  Establish the necessary testing and documentation for the integrated system.

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

### Phase 1: Foundation & On-Chain Refactoring (Duration: Est. 3 days)

**Goal:** Establish the simplified on-chain contract and basic communication primitives.

| Task ID      | Description                                                                           | Est. Hours | Status | Dependencies   | Assignee |
| :----------- | :------------------------------------------------------------------------------------ | :--------- | :----- | :------------- | :------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **OC-101**   | Refactor `oracle.clar`: Remove Volatility, TWAP, Price Change%, History logic/storage | 8          | 🟢     | Spec Guide     |          |
| **OC-102**   | Refactor `oracle.clar`: Implement `set-aggregated-price` function with auth check     | 4          | 🟢     | OC-101         |          | _Note: Timestamp handling fixed during testing._                                                                                  |
| **OC-103**   | Refactor `oracle.clar`: Implement `get-latest-price` read-only function               | 2          | 🟢     | OC-101         |          |
| **OC-104**   | Refactor `oracle.clar`: Implement `set-authorized-submitter` function                 | 1          | 🟢     | OC-101         |          |
| **OC-105**   | Refactor `oracle.clar`: Update constants, error codes, and events                     | 2          | 🟢     | OC-101         |          |
| **PC-101**   | Define Parameter Contract Trait (`parameter-trait.clar`) interface needed by Oracle   | 2          | ⚪     | Spec Guide     |          |
| **OC-106**   | Integrate `oracle.clar`: Add trait import and `contract-call?` for validation params  | 4          | ⚪     | OC-102, PC-101 |          |
| **BI-101**   | Implement Blockchain Integration (Convex): Basic `readLatestOraclePrice` function     | 3          | 🟢     | OC-103         |          |
| **OC-107**   | Deploy refactored `oracle.clar` to Devnet                                             | 2          | 🟢     | OC-105         |          | _Note: Deployed and tested successfully after fixes._                                                                             |
| **TEST-101** | Basic unit tests for refactored `oracle.clar` functions                               | 4          | 🟣     | OC-105         |          | _Note: Core functionality tested functionally via UI on Devnet, leading to timestamp fixes. Simnet unit test limitations remain._ |

**Phase 1 Notes & Commentary:**

- Tasks `OC-101` through `OC-105` were completed as planned, resulting in a simplified `oracle.clar` contract.
- **Trait Implementation (`PC-101`, `OC-106`) Aborted:** Significant challenges were encountered attempting to implement and integrate the `parameter-trait`. Persistent `unresolved contract` and `failed to parse type` errors arose within the Clarinet testing environment and linter, despite adhering to standard trait syntax. Extensive debugging (moving files, cache clearing, syntax checks, using `burn-block-height` vs `block-height`) did not resolve the root cause, potentially indicating a tooling issue. To avoid blocking progress, the decision was made to **hardcode validation parameters** directly into `oracle.clar`. The trait (`parameter-trait.clar`) and implementation (`parameter-oracle-impl.clar`) files were moved to `pending-contracts` for potential future revisiting. Tasks `PC-101` and `OC-106` are marked as Deferred (`⚪`).
- **Functional Testing & Fixes**: Debugging during Devnet deployment and UI testing revealed issues with timestamp handling (`ERR-INVALID-PARAMETERS` on submission) and timestamp interpretation in the frontend (`useLatestOraclePrice` hook). These were resolved by modifying `set-aggregated-price` to use `burn-block-height` internally and updating the frontend hook to correctly format the block height for display.

**Phase 1 Deliverables:**

- Refactored `oracle.clar` contract aligned with the simplified specification (with hardcoded parameters).
- ~~Defined Parameter Contract trait.~~ (Moved to `pending-contracts`)
- ~~Basic integration for reading parameters in `oracle.clar`.~~ (Removed due to hardcoding)
- Basic Convex function to read the latest price from the deployed contract. (BI-101 - Completed)
- Initial unit tests for `oracle.clar` (Passing with one known limitation).

### Phase 2: Convex Backend Implementation (Duration: Est. 5 days)

**Goal:** Build the core off-chain logic within Convex for data processing and serving the frontend.

| Task ID      | Description                                                                                    | Est. Hours | Status | Dependencies          | Assignee |
| :----------- | :--------------------------------------------------------------------------------------------- | :--------- | :----- | :-------------------- | :------- |
| **CVX-201**  | Implement/Refine Convex: Robust multi-source price fetching logic                              | 6          | 🟢     |                       |          |
| **CVX-202**  | Implement/Refine Convex: Aggregation logic (e.g., weighted median, outlier filtering)          | 8          | 🟢     | CVX-201               |          |
| **CVX-203**  | Implement/Refine Convex: Confidence scoring for aggregated price                               | 4          | 🟢     | CVX-202               |          |
| **CVX-204**  | Implement Convex: Volatility calculation (e.g., std dev) using `ConvexPriceHistory`            | 6          | 🟢     |                       |          |
| **CVX-205**  | Implement Convex: 24h Range calculation using `ConvexPriceHistory`                             | 4          | 🟢     |                       |          |
| **CVX-206**  | Implement Convex: Persist aggregated prices, volatility, etc., to Convex DB tables             | 5          | 🟢     | CVX-202, CVX-204, 205 |          |
| **CVX-207**  | Implement Convex: `getLatestPriceFeedData` query function for frontend                         | 6          | 🟢     | CVX-206               |          |
| **CVX-208**  | Implement Convex: Core `submitAggregatedPriceToOracle` action (logic _before_ threshold check) | 4          | 🟢     | CVX-202               |          |
| **CVX-209**  | Implement Convex: Cron job (`crons.ts`) to schedule `submitAggregatedPriceToOracle`            | 2          | 🟢     | CVX-208               |          |
| **TEST-201** | Unit/integration tests for Convex aggregation and calculation logic                            | 8          | 🟡     | CVX-202, 204, 205     |          |
| **TEST-202** | Test `getLatestPriceFeedData` query                                                            | 3          | 🟢     | CVX-207               |          |

**Phase 2 Notes & Commentary:**

- Tasks **CVX-201** (Multi-source Fetching), **CVX-202** (Aggregation Logic - refined with IQR filtering), **CVX-203** (Confidence Score - source count), **CVX-204** (Volatility Calculation - std dev), **CVX-205** (24h Range Calculation), and **CVX-206** (Persistence) were reviewed or implemented. Functionality exists within `convex/prices.ts`.
- **CVX-207** (Frontend Data Query): The existing `getLatestPrice` query provides the latest aggregated data. A new query, `getLatestSourcePrices`, was added to provide the breakdown of individual source data needed for the `PriceOracleNetwork.tsx` component.
- **CVX-208** (Submission Preparation): Implemented a new `prepareOracleSubmission` internal action in `convex/blockchainIntegration.ts` which formats the aggregated price for submission to the blockchain and calculates percent change to assist with threshold checks.
- **CVX-209** (Cron Job Scheduling): Added a cron job to `convex/crons.ts` to schedule the `prepareOracleSubmission` action every 5 minutes.
- **TEST-201** (Calculation Tests): Test file `convex/prices.test.ts` created. Tests for query functions (`calculate24hRange`, `calculateVolatilityWithTimeframe`) implemented. Tests for the `fetchPrices` action (aggregation/outlier filtering) require further investigation into mocking external calls (`axios`) and mutations within Convex testing framework and are pending.
- **TEST-202** (Frontend Query Tests): Implemented tests in `convex/prices.test.ts` for `getLatestPrice` and `getLatestSourcePrices` queries.

**Phase 2 Deliverables:**

- Functional off-chain price aggregation and validation in Convex.
- Off-chain calculation of volatility and range.
- Convex query ready to serve data to the frontend.
- Scheduled Convex action framework for initiating on-chain updates.
- Unit tests for Convex backend logic.

### Phase 3: Blockchain Integration & Connection (Duration: Est. 4 days)

**Goal:** Connect the Convex backend to the `oracle.clar` contract securely and implement update logic.

| Task ID      | Description                                                                                       | Est. Hours | Status | Dependencies    | Assignee |
| :----------- | :------------------------------------------------------------------------------------------------ | :--------- | :----- | :-------------- | :------- |
| **BI-301**   | Implement Blockchain Integration (Convex): Secure backend wallet/key loading from env variables   | 3          | 🟢     |                 |          |
| **BI-302**   | Implement Blockchain Integration (Convex): Transaction building for `set-aggregated-price`        | 4          | 🟢     | OC-102          |          |
| **BI-303**   | Implement Blockchain Integration (Convex): Transaction signing using backend identity             | 4          | 🟢     | BI-301, BI-302  |          |
| **BI-304**   | Implement Blockchain Integration (Convex): Transaction broadcasting & basic confirmation handling | 5          | 🟢     | BI-303          |          |
| **BI-305**   | Implement Blockchain Integration (Convex): `submitAggregatedPrice` action wrapper                 | 3          | 🟢     | BI-304          |          |
| **CVX-301**  | Implement Convex: Threshold check logic in `submitAggregatedPriceToOracle` (using BI-101)         | 5          | 🟢     | CVX-208, BI-101 |          |
| **CVX-302**  | Integrate Convex: Connect `submitAggregatedPriceToOracle` action to BI-305 for submission         | 3          | 🟢     | CVX-301, BI-305 |          |
| **CVX-303**  | Update Convex: Store on-chain submission status/timestamp in `ConvexOracleState`                  | 2          | 🟢     | CVX-302         |          |
| **TEST-301** | Integration tests for Convex -> Blockchain submission flow (Devnet)                               | 8          | 🟢     | OC-107, CVX-302 |          |

**Phase 3 Deliverables:**

- Secure mechanism for signing backend transactions within Convex.
- Functional Blockchain Integration layer for submitting prices to `oracle.clar`.
- Completed `submitAggregatedPriceToOracle` action with threshold checks and on-chain submission.
- Integration tests validating the backend-to-blockchain flow.

**Phase 3 Progress Notes (Updated: August 2024):**

All core implementation tasks for Phase 3 are now complete.

1. **BI-301 (Environment Variable Setup):** Implemented the `getBackendSignerKey` function in `convex/blockchainIntegration.ts` to securely retrieve the Stacks private key from environment variables. This function includes error handling for missing configuration.

2. **BI-302 (Transaction Building):** Added two key configuration helpers:

   - `getStacksNetwork`: Dynamically determines the appropriate Stacks network (Mainnet, Testnet, Devnet) based on the `STACKS_NETWORK` environment variable.
   - `getOracleContractInfo`: Retrieves contract details from `ORACLE_CONTRACT_ADDRESS` and `ORACLE_CONTRACT_NAME` environment variables.

   Also implemented the `buildSetPriceTransactionOptions` function which constructs the transaction options for `set-aggregated-price`, converting the price parameter to the expected Clarity Value format.

3. **BI-303 (Transaction Signing):** Created the `signSetPriceTransaction` internal action that:

   - Builds the transaction options using the previously implemented function
   - Retrieves the private key and derives the sender address
   - Fetches the current nonce from the Stacks API (with error handling for new accounts)
   - Assembles and signs the transaction using `makeContractCall` from the Stacks.js library

4. **CVX-301 (Threshold Check Logic - Implemented):** The `prepareOracleSubmission` action was refactored to implement multi-factor threshold checking. It now:

   - Fetches the latest aggregated price from the Convex DB (`api.prices.getLatestPrice` - Linter fix applied).
   - Fetches the last on-chain price using `api.blockchainIntegration.readLatestOraclePrice` - Linter fix applied).
   - Applies thresholds based on price change percentage, max/min time since last update, and minimum source count (using hardcoded values for MVP, defined in `ORACLE_UPDATE_THRESHOLDS`).
   - Returns a `shouldUpdate` flag and a reason.
   - ~~**Note:** There are remaining linter errors related to resolving `internal.prices.getLatestPrice` and `internal.blockchainIntegration.readLatestOraclePrice` within the `ctx.runQuery` calls. These appear to be type/reference resolution issues within the generated Convex API code and do not necessarily block functionality but should be investigated further for long-term stability.~~ (Linter errors resolved by using `api` reference).

5. **BI-304 (Transaction Broadcasting - Implemented):** Added the `broadcastSignedTransaction` internal action to `convex/blockchainIntegration.ts`. This action takes a signed transaction object and broadcasts it to the configured Stacks network using `broadcastTransaction` from `@stacks/transactions`. It includes basic error handling for broadcast failures and returns the `txid` on success. (Linter fix applied for function call).

6. **BI-305 (Submission Wrapper - Implemented):** Added the `submitAggregatedPrice` public action to `convex/blockchainIntegration.ts`. This action orchestrates the submission process by calling the internal `signSetPriceTransaction` and `broadcastSignedTransaction` actions. (Linter fixes applied for internal action calls).

7. **CVX-302 (Cron Job Integration - Implemented):** Created a new internal action `checkAndSubmitOraclePrice` in `convex/blockchainIntegration.ts`. This action calls `prepareOracleSubmission` to check thresholds and, if needed, calls `submitAggregatedPrice`. Updated `convex/crons.ts` to schedule `checkAndSubmitOraclePrice` every 5 minutes instead of directly scheduling `prepareOracleSubmission`.

8. **CVX-303 (Submission Recording - Implemented):** Defined a new table `oracleSubmissions` in `convex/schema.ts` to store details of submission attempts. Created the `recordOracleSubmission` internal mutation in `convex/blockchainIntegration.ts` to insert records into this table. Integrated the call to this mutation into `checkAndSubmitOraclePrice`

### Phase 4: Frontend Implementation & Integration (Duration: Est. 5 days)

**Goal:** Connect frontend components to the Convex backend, replace mock data with live data, and perform UI testing.

| Task ID      | Description                                                                                                                                                           | Est. Hours | Status | Dependencies       | Assignee | Notes                                                                                    |
| :----------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- | :----------------- | :------- | :--------------------------------------------------------------------------------------- |
| **FE-401**   | Implement `BitcoinPriceCard.tsx`: Basic structure & layout (Already exists, review needed)                                                                            | 1          | 🟢     |                    |          | Structure confirmed, mock data identified.                                               |
| **FE-402**   | Connect `BitcoinPriceCard.tsx` to `api.prices.getLatestPrice` Convex query using `convex/react` hook.                                                                 | 3          | ⬜     | CVX-207            |          |                                                                                          |
| **FE-403**   | Update `BitcoinPriceCard.tsx`: Display **Price** and **Timestamp** from `getLatestPrice` query data.                                                                  | 2          | ⬜     | FE-402             |          | Requires formatting logic (USD, relative time).                                          |
| **FE-404**   | Update `BitcoinPriceCard.tsx`: Display **Volatility** (`volatility`) from `getLatestPrice` query data, replacing `mockVolatility`.                                    | 1          | ⬜     | FE-402             |          | Value is % (e.g., 0.03 for 3%), may need formatting (`* 100`).                           |
| **FE-405**   | Update `BitcoinPriceCard.tsx`: Display **Active Sources** (`sourceCount`) from `getLatestPrice` query data, replacing `mockActiveSources`.                            | 1          | ⬜     | FE-402             |          |                                                                                          |
| **FE-406**   | Update `BitcoinPriceCard.tsx`: Display **24h Range High/Low**. Use `api.prices.calculate24hRange` query? Adapt display to use `high` and `low` from Convex data.      | 3          | ⬜     | FE-402, CVX-205    |          | Need hook for `calculate24hRange`. Display High/Low, calc progress bar.                  |
| **FE-407**   | Implement Convex Query & Hook: Create `getHistoricalPrice(timestamp)` query and `useHistoricalPrice` hook to fetch price from `historicalPrices` for a specific time. | 4          | ⬜     |                    |          | Query should find closest historical price to target timestamp.                          |
| **FE-408**   | Update `BitcoinPriceCard.tsx`: Use `useHistoricalPrice` to get price from ~24h ago, calculate **24h Price Change %**, and display it, replacing `priceChange`.        | 3          | ⬜     | FE-402, FE-407     |          | Requires calling hook with `Date.now() - 24*60*60*1000`. Handle cases with missing data. |
| **FE-409**   | Implement `PriceOracleNetwork.tsx`: Basic structure for displaying individual source data.                                                                            | 2          | ⬜     |                    |          | Needs table/list layout for source name, price, timestamp, weight.                       |
| **FE-410**   | Connect `PriceOracleNetwork.tsx` to `api.prices.getLatestSourcePrices` Convex query.                                                                                  | 3          | ⬜     | CVX-207 (Sub-task) |          | Loop through results, display each source.                                               |
| **TEST-401** | UI Testing: Verify data display, loading states, error handling, and refresh functionality in `BitcoinPriceCard`.                                                     | 4          | ⬜     | FE-408, FE-410     |          | Test with empty data, errors, varying values.                                            |
| **DOC-401**  | Update Frontend Documentation: Reflect changes in data sources and component interactions (`oracle-dataflow-explanation.md`).                                         | 2          | ⬜     | TEST-401           |          | Update diagrams and flow descriptions.                                                   |
