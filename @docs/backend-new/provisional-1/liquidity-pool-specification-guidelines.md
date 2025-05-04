# Liquidity Pool Specification Guidelines (Hybrid MVP)

**Version:** 1.0
**Date:** 2024-08-21
**Status:** Draft

## 1. Introduction

This document provides the technical specification for the BitHedge Liquidity Pool component within the hybrid architecture. It defines the distinct responsibilities of the minimal on-chain Clarity contract (acting as a **Vault**) and the comprehensive off-chain Convex backend services that manage provider accounting, risk tiers, yield, and collateral health.

Following the "On-Chain Light / Off-Chain Heavy" principle, the on-chain contract solely holds pooled funds and executes transfers/locks based on authorized instructions, while Convex handles all individual provider logic and calculations.

## 2. On-Chain Specification (`liquidity-pool.clar` - Minimal Vault)

This contract acts as a simple, secure vault holding the collective STX and sBTC collateral. It does _not_ track individual provider balances or risk tiers.

**2.1. Core Responsibilities:**

- Securely hold pooled STX and sBTC collateral.
- Provide restricted functions for authorized principals (users for deposits/withdrawals via prepared TX, backend principal for aggregate locks/releases/settlements) to interact with the pooled funds.
- Track total balances per token type.
- Emit events for fund movements (deposits, withdrawals, settlements) and aggregate collateral status changes (lock/release).
- Implement basic security checks and access control.

**2.2. State Variables:**

- `contract-admin (define-data-var principal tx-sender)`: Initial admin.
- `backend-principal (define-data-var principal tx-sender)`: Authorized address for the Convex backend system (set during initialization).
- `total-stx-balance (define-data-var uint u0)`: Total micro-STX held by the contract.
- `total-sbtc-balance (define-data-var uint u0)`: Total satoshis held by the contract (requires sBTC token principal).
- `sbtc-token-principal (define-data-var principal tx-sender)`: Principal of the SIP-010 sBTC contract (set during initialization).
  _Optional Tracking (Consider for simple checks/events, but adds gas cost):_
- `total-stx-locked (define-data-var uint u0)`
- `total-sbtc-locked (define-data-var uint u0)`

**2.3. Data Maps:**

- None required for core vault functionality. All provider/tier accounting is off-chain.

**2.4. Trait Imports:**

- `(use-trait sbtc-token-trait 'SP...sbtc-token-trait.sip010-trait)`: Import the SIP-010 trait for sBTC interaction.

**2.5. Functions:**

- **(Public) `deposit-funds`**: _(Callable by user via prepared transaction)_

  - **Authorization:** `tx-sender` is the depositor.
  - **Parameters:** `amountBaseUnits: uint`, `tokenContractPrincipal: principal` (STX contract or sBTC contract).
  - **Logic:**
    - Assert `tokenContractPrincipal` is either STX or the known `sbtc-token-principal`.
    - Based on `tokenContractPrincipal`:
      - If STX: Execute `stx-transfer?` from `tx-sender` to `(as-contract tx-sender)`.
      - If sBTC: Execute `contract-call? .sbtc-token-trait transfer` from `tx-sender` to `(as-contract tx-sender)`.
    - Handle transfer failure.
    - Increment the corresponding `total-[stx/sbtc]-balance`.
    - Emit `funds-deposited` event.
  - **Returns:** `(ok bool)` or `(err uint)`.

- **(Public) `withdraw-funds`**: _(Callable by user via prepared transaction)_

  - **Authorization:** `tx-sender` is the withdrawer.
  - **Parameters:** `amountBaseUnits: uint`, `tokenContractPrincipal: principal`.
  - **Logic:**
    - Assert `tokenContractPrincipal` is valid.
    - Assert sufficient _total_ balance exists in the contract (`total-[stx/sbtc]-balance >= amountBaseUnits`). _Note: Off-chain logic MUST ensure the user is authorized to withdraw this amount based on their available off-chain balance BEFORE preparing this transaction._
    - Based on `tokenContractPrincipal`:
      - If STX: Execute `as-contract (stx-transfer? ...)` from contract to `tx-sender`.
      - If sBTC: Execute `as-contract (contract-call? .sbtc-token-trait transfer ...)` from contract to `tx-sender`.
    - Handle transfer failure.
    - Decrement the corresponding `total-[stx/sbtc]-balance`.
    - Emit `funds-withdrawn` event.
  - **Returns:** `(ok bool)` or `(err uint)`.

- **(Public) `lock-collateral-aggregate`**: _(Callable ONLY by `backend-principal`)_

  - **Authorization:** Check `(is-eq tx-sender (var-get backend-principal))`.
  - **Parameters:** `policyIds: (list MAX_BATCH_SIZE uint)`, `amountToLockBaseUnits: uint`, `tokenContractPrincipal: principal`.
  - **Logic:**
    - Assert `tokenContractPrincipal` is valid.
    - _(Optional Logic):_ Increment `total-[stx/sbtc]-locked`.
    - _(Optional Validation):_ Check `total-[stx/sbtc]-balance - total-[stx/sbtc]-locked >= amountToLockBaseUnits`.
    - Emit `collateral-locked` event (including `policyIds` for off-chain mapping).
  - **Returns:** `(ok bool)` or `(err uint)`.
  - _Note: This function DOES NOT move funds, only potentially updates internal tracking and emits an event. The funds are already in the Vault._

- **(Public) `release-collateral-aggregate`**: _(Callable ONLY by `backend-principal`)_

  - **Authorization:** Check `(is-eq tx-sender (var-get backend-principal))`.
  - **Parameters:** `policyIds: (list MAX_BATCH_SIZE uint)`, `amountToReleaseBaseUnits: uint`, `tokenContractPrincipal: principal`.
  - **Logic:**
    - Assert `tokenContractPrincipal` is valid.
    - _(Optional Logic):_ Decrement `total-[stx/sbtc]-locked` (ensure >= 0).
    - Emit `collateral-released` event (including `policyIds`).
  - **Returns:** `(ok bool)` or `(err uint)`.
  - _Note: This function makes funds logically available for withdrawal but doesn't transfer them._

- **(Public) `settle-policy`**: _(Callable ONLY by `backend-principal`)_

  - **Authorization:** Check `(is-eq tx-sender (var-get backend-principal))`.
  - **Parameters:** `policyId: uint`, `buyerPrincipal: principal`, `settlementAmountBaseUnits: uint`, `tokenContractPrincipal: principal`.
  - **Logic:**
    - Assert `tokenContractPrincipal` is valid.
    - Assert sufficient _total_ balance exists (`total-[stx/sbtc]-balance >= settlementAmountBaseUnits`).
    - Based on `tokenContractPrincipal`:
      - If STX: Execute `as-contract (stx-transfer? ...)` from contract to `buyerPrincipal`.
      - If sBTC: Execute `as-contract (contract-call? .sbtc-token-trait transfer ...)` from contract to `buyerPrincipal`.
    - Handle transfer failure.
    - Decrement `total-[stx/sbtc]-balance`.
    - _(Optional Logic - Requires coordination):_ Decrement `total-[stx/sbtc]-locked` if this settlement amount was considered locked.
    - Emit `settlement-paid` event.
  - **Returns:** `(ok bool)` or `(err uint)`.

- **(Admin Functions)**: `set-backend-principal`, `set-sbtc-token-principal` (callable only by `contract-admin`, ideally only once).

- **(Read-Only Functions):** `get-total-stx-balance`, `get-total-sbtc-balance`, `get-sbtc-token-principal`, `get-backend-principal`. (Optional: `get-total-stx-locked`, `get-total-sbtc-locked`).

**2.6. Error Codes:**

- `ERR-NOT-AUTHORIZED (u200)`
- `ERR-INSUFFICIENT-BALANCE (u201)`
- `ERR-INVALID-TOKEN-CONTRACT (u202)`
- `ERR-TRANSFER-FAILED (u203)`
- `ERR-ALREADY-INITIALIZED (u204)`
- `ERR-LOCK-AMOUNT-EXCEEDS-AVAILABLE (u205)`
- `ERR-UNLOCK-AMOUNT-EXCEEDS-LOCKED (u206)`

**2.7. Events:**

- As defined in `core-data-types.md`: `funds-deposited`, `funds-withdrawn`, `collateral-locked`, `collateral-released`, `settlement-paid`.

**2.8. Security Considerations:**

- Strict authorization is paramount for all functions except `deposit-funds` and `withdraw-funds` (which rely on `tx-sender` and off-chain validation before TX preparation).
- Protection against reentrancy (minimal risk due to simple structure and limited external calls).
- Correct balance updates are critical.
- Secure initialization of `backend-principal` and `sbtc-token-principal`.

## 3. Off-Chain Specification (Convex Backend)

Handles all provider-specific accounting, risk management, yield calculations, and orchestration of on-chain Vault interactions.

**3.1. Core Responsibilities:**

- Manage individual provider accounts, including deposits, withdrawals, balances (total, available, locked), and chosen risk tier.
- Allocate newly created policies to providers within the corresponding risk tier (virtual allocation).
- Track collateral requirements for each provider based on the policies they are virtually backing.
- Monitor provider collateral health ratios using Oracle data.
- Implement margin call logic (notifications, potentially penalties - although full liquidation engine deferred post-MVP).
- Calculate and accrue yield based on collected premiums and provider contributions.
- Orchestrate on-chain Vault interactions (preparing user-signed TX for deposit/withdrawal, triggering backend-signed TX for lock/release/settlement).
- Synchronize provider balances and pool metrics based on on-chain Vault events.

**3.2. Convex Schema (`db/schema.ts` - relevant parts):**

```typescript
export default defineSchema({
  // ... policies table ...

  providers: defineTable({
    providerPrincipal: "string",
    totalUstxBalance_virtual: "number", // Off-chain tracked total ustx
    totalSatsBalance_virtual: "number", // Off-chain tracked total sats
    availableUstxBalance_virtual: "number", // total - locked
    availableSatsBalance_virtual: "number", // total - locked
    lockedUstxBalance_virtual: "number",
    lockedSatsBalance_virtual: "number",
    riskTier: "string", // "Conservative", "Balanced", "Aggressive"
    accruedYieldUstx_virtual: "number",
    accruedYieldSats_virtual: "number",
    lastHealthCheckTimestamp: "number | null",
    collateralizationRatio_estimate: "number | null", // Scaled (e.g., 6 decimals)
    healthStatus: "string", // "Healthy", "Warning", "MarginCall", "Liquidating"
    // ... other provider metadata
  })
    .index("by_principal", ["providerPrincipal"])
    .index("by_tier_and_health", ["riskTier", "healthStatus"]),

  // Optional: Track individual deposit/withdrawal history if needed
  // depositWithdrawalHistory: defineTable({ ... })

  // Optional: Table mapping policies to backing providers (off-chain)
  // policyBacking: defineTable({ policyId_onChain: "number", providerPrincipal: "string", allocatedCollateral: "number", token:"string", tier: "string" }).index(...)

  poolMetrics: defineTable({
    token: "string", // "STX" or "sBTC"
    totalBalance_onChain: "number", // Mirror from Vault contract
    totalLocked_estimate: "number", // Aggregated from provider locked balances
    totalAvailable_estimate: "number", // total - locked
    lastSyncTimestamp: "number",
  }).index("by_token", ["token"]),

  tierMetrics: defineTable({
    tierName: "string", // "Conservative", etc.
    token: "string", // "STX" or "sBTC"
    totalCapital_virtual: "number",
    totalLocked_virtual: "number",
    utilization_estimate: "number", // Scaled
    providerCount: "number",
    activePolicyCount: "number",
    totalYieldAccrued_virtual: "number",
    capacityLimit: "number | null",
  }).index("by_tier_and_token", ["tierName", "token"]),
});
```

**3.3. Convex Functions (Queries - `convex/liquidity.ts`):**

- `getProviderPortfolio(providerPrincipal: string)`: Returns detailed balance, locked amounts, risk tier, yield, and health status for a specific provider.
- `getPoolStats()`: Returns aggregate metrics for the overall pool (total balances, estimated locked/available per token).
- `getTierStats()`: Returns metrics per risk tier (total capital, locked, utilization, provider count).
- `getTierAvailability(tier: string, requiredCollateral: number, token: string)`: Checks if a tier has enough _available_ virtual capital.

**3.4. Convex Functions (Mutations - `convex/liquidity.ts`):**

- `(internal) updateProviderBalance(providerPrincipal: string, amountBaseUnits: number, token: string, type: 'deposit' | 'withdrawal' | 'yield_accrual' | 'settlement_debit' | 'lock' | 'release')`: Core function to update a provider's virtual balances (total, available, locked, yield). Must be called atomically or idempotently.
- `(internal) syncPoolBalancesFromEvent(eventData: VaultEvent)`: Updates the `poolMetrics` table based on confirmed on-chain `funds-deposited` or `funds-withdrawn` events.
- `(internal) updateTierMetrics(...)`: Updates `tierMetrics` based on provider deposits, withdrawals, or policy allocations.
- `(internal) setProviderHealthStatus(...)`: Updates provider health status based on checks.

**3.5. Convex Functions (Actions - `convex/liquidity.ts`):**

- `requestCommitCapital(input: ProviderContributionInput)`:

  - Validate input (amount, token, tier).
  - Check tier capacity against `tierMetrics`.
  - Prepare parameters for user-signed `deposit-funds` call to the Vault contract (via BIL).
  - Return TX parameters to UI.
  - _(Upon confirmation via event):_ Call `internal.liquidity.updateProviderBalance` and `internal.liquidity.updateTierMetrics`.

- `requestWithdrawal(amountBaseUnits: number, token: string)`:

  - Get provider principal from `ctx.auth`.
  - Fetch provider data (`getProviderPortfolio` query).
  - **Perform Collateral Health Check (CRITICAL):** Query active backed policies (off-chain), get Oracle prices, calculate required collateral + buffer, determine max withdrawable amount.
  - Assert requested `amountBaseUnits <= maxWithdrawable`.
  - Prepare parameters for user-signed `withdraw-funds` call from the Vault contract (via BIL).
  - Return TX parameters to UI.
  - _(Upon confirmation via event):_ Call `internal.liquidity.updateProviderBalance` and `internal.liquidity.updateTierMetrics`.

- `allocatePolicyCollateral(policyId_onChain: number, requiredCollateral: number, token: string, tier: string)`: _(Called internally, likely by `policies.requestPolicyCreation` after user TX confirmed)_

  - Identify providers in the specified `tier` with available capacity (off-chain logic).
  - Update relevant providers' `locked[Ustx/Sats]Balance_virtual` in Convex DB (via internal mutation).
  - Update `tierMetrics` (locked amount, utilization).
  - _(Optional for MVP):_ Trigger `lock-collateral-aggregate` call to on-chain Vault (backend-signed) to update optional on-chain locked counters and emit event.

- `requestCollateralRelease(policyId_onChain: number)`: _(Called internally by `policies.checkForExpirations` or settlement flow)_

  - Identify policy details (amount, token, tier) from Convex DB.
  - Identify the backing providers (off-chain mapping).
  - Update relevant providers' `locked[Ustx/Sats]Balance_virtual` (decrease) in Convex DB.
  - Update `tierMetrics`.
  - Trigger `release-collateral-aggregate` call to on-chain Vault (backend-signed) via BIL.

- `requestSettlement(policyId_onChain: number, settlementAmount: number, settlementToken: string, buyerPrincipal: string)`: _(Called internally by `policies.requestPolicyActivation`)_

  - Trigger `settle-policy` call to on-chain Vault (backend-signed) via BIL.
  - Monitor TX confirmation.
  - _(Upon confirmation):_ Update affected providers' `total[Ustx/Sats]Balance_virtual` (debit) via `internal.liquidity.updateProviderBalance`. Update `tierMetrics`. Trigger policy status update action.

- `monitorCollateralHealth()`: _(Called by Scheduled Job)_
  - Fetch all active providers.
  - For each provider (or batches): Fetch Oracle prices, calculate current collateralization ratio.
  - Update `healthStatus` and `collateralizationRatio_estimate` in `providers` table (via internal mutation).
  - If status changes to Warning/MarginCall, trigger notification process (potentially another action).

**3.6. Error Handling:**

- Handle insufficient off-chain available balance for withdrawals.
- Handle tier capacity limits.
- Handle failed on-chain vault interactions (deposit, withdraw, settle) and potentially revert related off-chain state changes or mark for reconciliation.
- Handle Oracle data unavailability during health checks.

## 4. Conclusion

This specification details a hybrid Liquidity Pool where the on-chain contract is a simple, secure Vault, and the Convex backend handles all complex accounting and logic. This approach drastically simplifies the on-chain component, reducing gas costs and security risks, while providing the flexibility needed for sophisticated provider management, risk tiering, and yield calculation off-chain. Careful implementation of the state synchronization logic based on Vault events is crucial for maintaining consistency.
