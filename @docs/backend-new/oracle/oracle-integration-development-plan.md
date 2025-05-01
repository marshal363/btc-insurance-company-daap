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
| **CVX-201**  | Implement/Refine Convex: Robust multi-source price fetching logic                              | 6          | ⬜     |                       |          |
| **CVX-202**  | Implement/Refine Convex: Aggregation logic (e.g., weighted median, outlier filtering)          | 8          | ⬜     | CVX-201               |          |
| **CVX-203**  | Implement/Refine Convex: Confidence scoring for aggregated price                               | 4          | ⬜     | CVX-202               |          |
| **CVX-204**  | Implement Convex: Volatility calculation (e.g., std dev) using `ConvexPriceHistory`            | 6          | ⬜     |                       |          |
| **CVX-205**  | Implement Convex: 24h Range calculation using `ConvexPriceHistory`                             | 4          | ⬜     |                       |          |
| **CVX-206**  | Implement Convex: Persist aggregated prices, volatility, etc., to Convex DB tables             | 5          | ⬜     | CVX-202, CVX-204, 205 |          |
| **CVX-207**  | Implement Convex: `getLatestPriceFeedData` query function for frontend                         | 6          | ⬜     | CVX-206               |          |
| **CVX-208**  | Implement Convex: Core `submitAggregatedPriceToOracle` action (logic _before_ threshold check) | 4          | ⬜     | CVX-202               |          |
| **CVX-209**  | Implement Convex: Cron job (`crons.ts`) to schedule `submitAggregatedPriceToOracle`            | 2          | ⬜     | CVX-208               |          |
| **TEST-201** | Unit/integration tests for Convex aggregation and calculation logic                            | 8          | ⬜     | CVX-202, 204, 205     |          |
| **TEST-202** | Test `getLatestPriceFeedData` query                                                            | 3          | ⬜     | CVX-207               |          |

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
| **BI-301**   | Implement Blockchain Integration (Convex): Secure backend wallet/key loading from env variables   | 3          | ⬜     |                 |          |
| **BI-302**   | Implement Blockchain Integration (Convex): Transaction building for `set-aggregated-price`        | 4          | ⬜     | OC-102          |          |
| **BI-303**   | Implement Blockchain Integration (Convex): Transaction signing using backend identity             | 4          | ⬜     | BI-301, BI-302  |          |
| **BI-304**   | Implement Blockchain Integration (Convex): Transaction broadcasting & basic confirmation handling | 5          | ⬜     | BI-303          |          |
| **BI-305**   | Implement Blockchain Integration (Convex): `submitAggregatedPrice` action wrapper                 | 3          | ⬜     | BI-304          |          |
| **CVX-301**  | Implement Convex: Threshold check logic in `submitAggregatedPriceToOracle` (using BI-101)         | 5          | ⬜     | CVX-208, BI-101 |          |
| **CVX-302**  | Integrate Convex: Connect `submitAggregatedPriceToOracle` action to BI-305 for submission         | 3          | ⬜     | CVX-301, BI-305 |          |
| **CVX-303**  | Update Convex: Store on-chain submission status/timestamp in `ConvexOracleState`                  | 2          | ⬜     | CVX-302         |          |
| **TEST-301** | Integration tests for Convex -> Blockchain submission flow (Devnet)                               | 8          | ⬜     | OC-107, CVX-302 |          |

**Phase 3 Deliverables:**

- Secure mechanism for signing backend transactions within Convex.
- Functional Blockchain Integration layer for submitting prices to `oracle.clar`.
- Completed `submitAggregatedPriceToOracle` action with threshold checks and on-chain submission.
- Integration tests validating the backend-to-blockchain flow.

### Phase 4: Frontend Integration & Testing (Duration: Est. 3 days)

**Goal:** Connect the UI to the backend and perform end-to-end testing.

| Task ID      | Description                                                                             | Est. Hours | Status | Dependencies    | Assignee |
| :----------- | :-------------------------------------------------------------------------------------- | :--------- | :----- | :-------------- | :------- | --------------------------------------------------------------------------------------------------------- |
| **FE-401**   | Implement Frontend: `hooks/oracleQueries.ts` with `useOracleData` hook                  | 4          | 🟢     | CVX-207         |          | _Note: Implemented direct blockchain call via `useLatestOraclePrice` and fixed timestamp interpretation._ |
| **FE-402**   | Integrate Frontend: Connect `BitcoinPriceCard.tsx` to `useOracleData`                   | 5          | 🟢     | FE-401          |          | _Note: Integration successful using `useLatestOraclePrice`. Displaying price and block height._           |
| **FE-403**   | Integrate Frontend: Implement "Refresh" button functionality                            | 2          | ⬜     | FE-402          |          |
| **FE-404**   | Implement Frontend (Optional): Direct read-only call for on-chain price display         | 4          | ⚪     | FE-402          |          |
| **TEST-401** | End-to-End Testing: Verify data flow from external APIs -> Convex -> UI                 | 6          | ⬜     | FE-402          |          |
| **TEST-402** | End-to-End Testing: Verify data flow from Convex -> `oracle.clar` -> (Optional UI Read) | 6          | ⬜     | CVX-302, FE-404 |          |
| **DOC-401**  | Update README and other relevant documentation with final architecture & usage          | 4          | ⬜     |                 |          |

**Phase 4 Deliverables:**

- `BitcoinPriceCard.tsx` displaying live data from the ~~Convex backend~~ **blockchain via hook**.
- Completed end-to-end testing of the Oracle system.
- Updated project documentation.

## 4. Overall Progress Dashboard (Example)

| Phase                                     | Total Tasks | Not Started | In Progress | Completed | Completion % |
| :---------------------------------------- | :---------- | :---------- | :---------- | :-------- | :----------- |
| Phase 1: Foundation & On-Chain Refactor   | 10          | 3           | 0           | 7         | 70%          |
| Phase 2: Convex Backend Implementation    | 11          | 11          | 0           | 0         | 0%           |
| Phase 3: Blockchain Integration & Connect | 8           | 8           | 0           | 0         | 0%           |
| Phase 4: Frontend Integration & Testing   | 7           | 6           | 0           | 1         | 14%          |
| **Overall Project**                       | **36**      | **28**      | **0**       | **8**     | **22%**      |

_(Note: Status markers and percentages need to be updated as tasks progress.)_

## 5. Conclusion

This plan provides a structured approach to implementing the BitHedge Oracle system, focusing on the hybrid architecture defined in the specification guidelines. Successful completion will result in a functional, efficient, and maintainable oracle integration connecting the frontend UI, Convex backend, and the simplified `oracle.clar` smart contract.
