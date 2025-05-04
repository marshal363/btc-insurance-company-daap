# Policy Registry Dataflow Explanation (MVP)

**Version:** 1.0
**Date:** 2024-08-21
**Status:** Draft
**Related Specs:** `bithdge-hybrid-architecture-overview.md`, `policy-registry-specification-guidelines.md`, `core-data-types.md`, `policy-registry-component-interaction-flows.md`

## 1. Introduction

This document explains the flow and transformation of data related to protection policies throughout the BitHedge system layers, from user input in the UI to final state anchoring in the minimal on-chain `policy-registry.clar` contract and detailed representation in the Convex database.

Understanding this data flow is crucial for implementing consistent state management and synchronization across the hybrid architecture.

## 2. Data Sources and Representations

- **UI Input:** User-provided parameters (e.g., desired protection amount in BTC, strike price in USD, duration in days).
- **Convex Database (`policies` table):** The primary off-chain store holding detailed policy information, including both mirrored on-chain data and extensive off-chain metadata and status.
- **Convex Services (Oracle, Premium, Liquidity):** Provide contextual data like current prices, calculated premiums, and pool capacity.
- **On-Chain Contract (`policy-registry.clar`):** Stores the minimal, immutable core data (`policies` map) and essential status (`u0`, `u1`, `u2`).
- **On-Chain Events:** `policy-created` and `policy-status-updated` events emitted by the contract, serving as triggers for off-chain state synchronization.

## 3. Dataflow During Policy Lifecycle

**3.1. Policy Creation Request:**

1.  **UI -> Convex:** User submits desired parameters (e.g., 0.1 BTC protection, $40,000 strike, 30 days). Data is likely in display units.
    - _Transformation:_ Frontend converts display units (BTC, USD, days) into the required `PolicyParametersInput` DTO format (sats, USD 8 decimals, days) before sending to Convex action `requestPolicyCreation`.
2.  **Convex Action (`requestPolicyCreation`):**
    - Receives `PolicyParametersInput`.
    - Fetches current Oracle price (e.g., BTC/USD with 8 decimals).
    - Calculates final premium (e.g., in ustx or sats).
    - Determines `expirationHeight` (current block + days \* blocks_per_day).
    - Determines `counterpartyPrincipal` (Liquidity Pool Vault address).
    - _Transformation:_ Assembles the parameters needed for the on-chain `create-policy-entry` call (using base units like sats, ustx, price feed units).
    - _Transformation:_ Assembles parameters for the premium token transfer (ustx or sats amount, destination = Vault address).
    - _(Optional)_ Creates a `PendingCreation` record in Convex DB.
3.  **Convex -> UI:** Returns the prepared on-chain transaction parameters (for premium transfer + registry call).
4.  **UI -> Wallet -> Blockchain:** User signs the transaction. Transaction is broadcast.
5.  **On-Chain (`policy-registry.clar`):**
    - Receives parameters for `create-policy-entry`.
    - Stores the minimal data (owner, counterparty, protectedValuePriceFeedUnits, protectedAmountSats, expirationHeight, policyType, status=u0) in the `policies` map, keyed by the new `policyId`.
    - Emits `policy-created` event with these core details.
    - _(Simultaneously, the Vault receives the premium transfer)_.
6.  **Blockchain Event -> Blockchain Integration Layer -> Convex:**
    - BIL detects the confirmed `policy-created` event.
    - _Transformation:_ Parses event data.
    - Triggers Convex mutation `updatePolicyFromCreationEvent`.
7.  **Convex Mutation:**
    - Updates the existing `PendingCreation` record (or creates a new one if step 2 optional part was skipped) in the `policies` table.
    - Populates `policyId_onChain`, `creationHeight`, mirrors other on-chain data.
    - Sets `status_onChain = 0`, `status_detailed = "Active"`.
    - Records `premiumAmountBaseUnits`, `premiumToken` (from the transaction context or initial input).

**3.2. Policy Activation Request:**

1.  **UI -> Convex:** User triggers activation for a specific `policyId_onChain`.
2.  **Convex Action (`requestPolicyActivation`):**
    - Fetches detailed policy data and current Oracle price from Convex queries.
    - Validates activation conditions (status == Active, price < strike).
    - _Transformation:_ Calculates settlement amount (off-chain) in base units (ustx or sats).
    - Updates policy status in Convex DB to `Settling` (`setPolicyStatusDetailed` mutation).
    - Triggers Liquidity Pool action `requestSettlement` with necessary details (policy ID, buyer, amount, token).
3.  **Liquidity Pool Action -> BIL -> Vault:** (Backend-signed) Triggers Vault `settle-policy` call.
4.  **Vault:** Executes transfer, emits `settlement-paid` event.
5.  **Liquidity Pool Action -> Policy Registry Action:** Upon confirmation, triggers `triggerPolicyStatusUpdate`.
6.  **Policy Registry Action -> BIL -> Registry:** (Backend-signed) Triggers Registry `update-policy-status` call with `newStatus=1`.
7.  **Registry:** Updates on-chain status to `u1`, emits `policy-status-updated` event.
8.  **Event -> BIL -> Convex:** Detects `policy-status-updated` event.
9.  **Convex Mutation (`updatePolicyFromStatusEvent`):**
    - Updates policy record in Convex DB.
    - Sets `status_onChain = 1`, `status_detailed = "Settled"`.
    - Records `settlementAmountBaseUnits`, `settlementToken`, `settlementTimestamp`.

**3.3. Policy Expiration Processing:**

1.  **Convex Scheduled Job (`checkForExpirations`):**
    - Queries Convex DB for active policies past `expirationHeight`.
2.  **Convex Action (Job Handler):**
    - For each expired policy, updates status in Convex DB to `Expiring` (`setPolicyStatusDetailed`).
    - Triggers Liquidity Pool action `requestCollateralRelease` (backend-signed).
3.  **Liquidity Pool Action -> BIL -> Vault:** Triggers Vault `release-collateral-aggregate` call.
4.  **Vault:** Releases collateral (internal accounting), emits `collateral-released` event.
5.  **Liquidity Pool Action -> Policy Registry Action:** Upon confirmation, triggers `triggerPolicyStatusUpdate`.
6.  **Policy Registry Action -> BIL -> Registry:** (Backend-signed) Triggers Registry `update-policy-status` call with `newStatus=2`.
7.  **Registry:** Updates on-chain status to `u2`, emits `policy-status-updated` event.
8.  **Event -> BIL -> Convex:** Detects `policy-status-updated` event.
9.  **Convex Mutation (`updatePolicyFromStatusEvent`):**
    - Updates policy record in Convex DB.
    - Sets `status_onChain = 2`, `status_detailed = "Expired"`.

## 4. Data Synchronization and Consistency

- **Source of Truth:** The minimal on-chain contract is the ultimate source of truth for core immutable terms (`policyId`, `owner`, `strike`, `amount`, `expirationHeight`, `type`) and the final lifecycle status (`Active`, `Settled`, `Expired`).
- **Off-Chain Enrichment:** Convex DB holds a richer, denormalized view including calculated fields, user-friendly statuses, timestamps, and related data snapshots.
- **Synchronization:** Convex state is updated based on confirmed on-chain events. This ensures eventual consistency. The Blockchain Integration Layer plays a key role in detecting these events and triggering the appropriate Convex mutations.
- **Status Management:** The `status_onChain` (number) mirrors the contract, while `status_detailed` (string) provides richer, user-facing context including intermediate states (e.g., `PendingCreation`, `Settling`) managed solely within Convex.

## 5. Conclusion

The data flow for the Policy Registry is designed to keep on-chain data minimal while providing a detailed and responsive experience off-chain. Transformations focus on converting user inputs to standardized base units for internal/on-chain processing and converting on-chain event data back into the enriched off-chain representation. Synchronization relies on monitoring on-chain events to update the primary off-chain data store in Convex.
