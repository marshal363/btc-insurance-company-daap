# Convex Liquidity Pool Architecture (MVP)

**Version:** 1.0
**Date:** 2024-08-21
**Status:** Draft
**Related Spec:** `liquidity-pool-specification-guidelines.md`

## 1. Introduction

This document details the architecture of the Liquidity Pool component within the Convex backend. Following the "On-Chain Light / Off-Chain Heavy" principle, Convex manages all provider-specific accounting (balances, risk tiers, yield), collateral health monitoring, and orchestrates interactions with the minimal on-chain `liquidity-pool.clar` Vault contract.

## 2. Core Responsibilities (Recap)

- Manage individual provider accounts and virtual balances (total, available, locked) for STX and sBTC.
- Handle provider risk tier selection and associated logic (capacity checks, virtual allocation).
- Track policy backing assignments virtually (mapping policies to providers within tiers).
- Calculate and track required collateral per provider based on backed policies and Oracle data.
- Monitor provider collateral health and manage status updates (Healthy, Warning, etc.).
- Calculate and accrue yield virtually based on collected premiums.
- Orchestrate deposit/withdrawal flows, including preparing user-signed transactions for the Vault.
- Trigger backend-signed Vault interactions for aggregate collateral locking/releasing and policy settlements.
- Synchronize aggregate pool metrics with on-chain Vault events.

## 3. Convex Schema (`db/schema.ts`)

Key tables for managing liquidity providers and pool state:

```typescript
export default defineSchema({
  // ... policies table ...

  providers: defineTable({
    // --- Core Identifier & Links ---
    providerPrincipal: "string",
    user: "string | null", // Link to a potential users table

    // --- Virtual Balances (Off-Chain Accounting) ---
    // Amounts stored in base units (ustx or sats)
    totalUstxBalance_virtual: "number",
    totalSatsBalance_virtual: "number",
    availableUstxBalance_virtual: "number",
    availableSatsBalance_virtual: "number",
    lockedUstxBalance_virtual: "number",
    lockedSatsBalance_virtual: "number",

    // --- Risk & Yield ---
    riskTier: "string", // "Conservative", "Balanced", "Aggressive"
    accruedYieldUstx_virtual: "number", // Unrealized yield
    accruedYieldSats_virtual: "number",
    claimedYieldUstx: "number", // For historical tracking
    claimedYieldSats: "number",

    // --- Health & Status ---
    lastHealthCheckTimestamp: "number | null",
    collateralizationRatio_estimate: "number | null", // Scaled (e.g., 6 decimals, 1250000 = 125%)
    healthStatus: "string", // "Healthy", "Warning", "MarginCall" (MVP only)
    requiredCollateralValueUSD_estimate: "number | null", // Estimated required collateral in USD (8 decimals)

    // --- Metadata ---
    depositCount: "number",
    withdrawalCount: "number",
    firstDepositTimestamp: "number | null",
    lastActivityTimestamp: "number | null",
  })
    .index("by_principal", ["providerPrincipal"])
    .index("by_tier_and_health", ["riskTier", "healthStatus"]),

  // --- Pool & Tier Aggregate Metrics ---
  poolMetrics: defineTable({
    token: "string", // "STX" or "sBTC"
    totalBalance_onChain: "number", // Base units (ustx/sats), mirrors Vault
    totalLocked_estimate_onChain: "number | null", // Optional: mirror from Vault if tracked
    lastSyncTimestamp: "number",
  }).index("by_token", ["token"]),

  tierMetrics: defineTable({
    tierName: "string", // "Conservative", etc.
    token: "string", // "STX" or "sBTC"
    totalCapital_virtual: "number", // Sum of provider virtual balances in tier
    totalLocked_virtual: "number", // Sum of provider virtual locked balances
    utilization_estimate: "number | null", // Scaled (e.g., 6 decimals)
    providerCount: "number",
    activePolicyCount: "number", // Number of policies backed by this tier
    totalYieldAccrued_virtual: "number", // Sum of provider yields
    capacityLimitBaseUnits: "number | null", // Max deposit limit for the tier
  }).index("by_tier_and_token", ["tierName", "token"]),

  // --- Optional Tracking Tables ---
  // depositWithdrawalHistory: defineTable({
  //   providerPrincipal: "string", type: "string", amountBaseUnits:"number", token:"string", txId:"string", timestamp:"number"
  // }).index("by_provider", ["providerPrincipal"])

  // policyBacking: defineTable({ // Maps policies to backing providers
  //  policyId_onChain: "number",
  //  providerPrincipal: "string",
  //  tier: "string",
  //  allocatedCollateralBaseUnits: "number", // Portion this provider is backing
  //  token:"string"
  // }).index("by_policy", ["policyId_onChain"]).index("by_provider", ["providerPrincipal"])
});
```

_Note: The `policyBacking` table is crucial for accurately tracking which provider's virtual collateral is locked against which policy, enabling correct debiting during settlement and precise health checks. While marked optional, it's highly recommended._

## 4. Convex Functions (Queries - `convex/liquidity.ts`)

Provide read access to provider and pool data.

- **`getProviderPortfolio`**: `query({ args: { providerPrincipal: v.string() }, handler: async (ctx, args) => { ... } })`
  - Fetches the detailed provider document from the `providers` table.
  - Returns balances, tier, health status, yield, etc.
- **`getPoolStats`**: `query({ handler: async (ctx) => { ... } })`
  - Fetches STX and sBTC documents from `poolMetrics`.
  - Returns total on-chain balances.
- **`getTierStats`**: `query({ args: { tierName: v.optional(v.string()) }, handler: async (ctx, args) => { ... } })`
  - Fetches documents from `tierMetrics`, optionally filtered by `tierName`.
  - Returns capital, locked amounts, utilization, counts per tier/token.
- **`getTierAvailability`**: `query({ args: { tier: v.string(), token: v.string(), requiredCollateral: v.number() }, handler: async (ctx, args) => { ... } })`
  - Fetches the specific `tierMetrics` document.
  - Calculates `available = totalCapital_virtual - totalLocked_virtual`.
  - Checks if `available >= requiredCollateral` and if `totalCapital_virtual < capacityLimit`.
  - Returns `{ isAvailable: boolean, availableAmount: number }`.

## 5. Convex Functions (Mutations - `convex/liquidity.ts`)

Handle direct, internal updates to the Convex database.

- **`(internal) updateProviderBalance`**: `mutation({ args: { ... }, handler: async (ctx, args) => { ... } })`
  - Atomically updates a provider's virtual balances (total, available, locked, yield) based on the `type` argument (deposit, withdrawal, lock, release, yield_accrual, settlement_debit).
  - Ensures available balance doesn't go negative during withdrawals/locks.
  - Needs careful implementation to handle concurrent updates if necessary.
- **`(internal) syncPoolBalancesFromEvent`**: `mutation({ args: { eventData: VaultEvent }, handler: async (ctx, args) => { ... } })`
  - Parses on-chain Vault event data (`funds-deposited`, `funds-withdrawn`).
  - Updates the corresponding `totalBalance_onChain` in the `poolMetrics` table.
  - Updates `lastSyncTimestamp`.
- **`(internal) updateTierMetrics`**: `mutation({ args: { ... }, handler: async (ctx, args) => { ... } })`
  - Updates the specified `tierMetrics` document (total capital, locked, counts) based on provider joins/leaves, deposits/withdrawals, or policy allocations/releases.
  - Recalculates `utilization_estimate`.
- **`(internal) setProviderHealthStatus`**: `mutation({ args: { providerPrincipal: v.string(), newStatus: v.string(), ratioEstimate: v.number(), checkTimestamp: v.number() }, handler: async (ctx, args) => { ... } })`
  - Updates the provider's `healthStatus`, `collateralizationRatio_estimate`, and `lastHealthCheckTimestamp`.
- **`(internal) createOrUpdateProvider`**: `mutation({ args: { ... }, handler: async (ctx, args) => { ... } })`
  - Creates a provider record on first deposit or updates existing data.

## 6. Convex Functions (Actions - `convex/liquidity.ts`)

Orchestrate workflows involving side effects.

- **`requestCommitCapital`**: `action({ args: { input: ProviderContributionInput }, handler: async (ctx, args) => { ... } })`

  1.  Get `providerPrincipal` from `ctx.auth`.
  2.  Validate `args.input`.
  3.  Query `getTierStats` to check `capacityLimit` for the chosen tier and token.
  4.  If capacity allows, prepare the user-signed `deposit-funds` transaction parameters via BIL.
  5.  Return TX params to UI.
  6.  _(Post-Confirmation - Handled by `handleOnChainEvent`):_ This separate action/mutation flow will:
      - Call `internal.syncPoolBalancesFromEvent`.
      - Call `internal.createOrUpdateProvider`.
      - Call `internal.updateProviderBalance` (type: 'deposit').
      - Call `internal.updateTierMetrics`.

- **`requestWithdrawal`**: `action({ args: { amountBaseUnits: v.number(), token: v.string() }, handler: async (ctx, args) => { ... } })`

  1.  Get `providerPrincipal` from `ctx.auth`.
  2.  Fetch provider portfolio (`getProviderPortfolio` query).
  3.  **Perform Collateral Health Check:**
      - Query `policyBacking` table for active policies backed by this provider.
      - Query Oracle Service for current prices.
      - Calculate `requiredCollateralValueUSD` based on backed policies.
      - Fetch buffer percentage (`parameter.clar` or config).
      - Calculate `minimumRequiredWithBuffer`.
      - Calculate `currentCollateralValueUSD` from provider's virtual balances.
      - Calculate `maxWithdrawable = currentCollateralValueUSD - minimumRequiredWithBuffer` (converted to requested token's base units).
  4.  Assert `args.amountBaseUnits <= maxWithdrawable`.
  5.  Prepare user-signed `withdraw-funds` transaction parameters via BIL.
  6.  Return TX params to UI.
  7.  _(Post-Confirmation - Handled by `handleOnChainEvent`):_ This separate flow will:
      - Call `internal.syncPoolBalancesFromEvent`.
      - Call `internal.updateProviderBalance` (type: 'withdrawal').
      - Call `internal.updateTierMetrics`.

- **`allocatePolicyCollateral`**: `action({ args: { policyId_onChain: v.number(), requiredCollateral: v.number(), token: v.string(), tier: v.string() }, handler: async (ctx, args) => { ... } })`

  1.  _(Off-Chain Logic):_ Determine which provider(s) in the specified `tier` will back this policy (e.g., FIFO, proportional, random). This requires querying `providers` indexed by tier.
  2.  _(Off-Chain Update):_ For each allocated provider:
      - Call `internal.updateProviderBalance` (type: 'lock').
      - Create entry in `policyBacking` table (if used).
  3.  _(Off-Chain Update):_ Call `internal.updateTierMetrics` (increment locked, update utilization).
  4.  _(Optional On-Chain):_ Trigger `lock-collateral-aggregate` Vault call (backend-signed) via BIL.

- **`requestCollateralRelease`**: `action({ args: { policyId_onChain: v.number() }, handler: async (ctx, args) => { ... } })`

  1.  Fetch policy details (amount, token, tier) from `policies` table.
  2.  Identify backing provider(s) from `policyBacking` table (or determine based on original allocation logic).
  3.  _(Off-Chain Update):_ For each backing provider:
      - Call `internal.updateProviderBalance` (type: 'release').
      - Remove entry from `policyBacking` table (if used).
  4.  _(Off-Chain Update):_ Call `internal.updateTierMetrics` (decrement locked, update utilization).
  5.  _(On-Chain):_ Trigger `release-collateral-aggregate` Vault call (backend-signed) via BIL.
  6.  Return confirmation/status.

- **`requestSettlement`**: `action({ args: { policyId_onChain: v.number(), settlementAmount: v.number(), settlementToken: v.string(), buyerPrincipal: v.string() }, handler: async (ctx, args) => { ... } })`

  1.  Identify backing provider(s) and tier from `policyBacking` / `policies` table.
  2.  _(On-Chain):_ Trigger `settle-policy` Vault call (backend-signed) via BIL.
  3.  Monitor TX confirmation.
  4.  _(Post-Confirmation Off-Chain Update):_
      - Call `internal.syncPoolBalancesFromEvent`.
      - For each backing provider, call `internal.updateProviderBalance` (type: 'settlement_debit', potentially also 'release' lock).
      - Call `internal.updateTierMetrics`.
      - Trigger `policies.triggerPolicyStatusUpdate` action.
  5.  Handle potential Vault transfer failures.

- **`monitorCollateralHealth`**: `action({ handler: async (ctx) => { ... } })` _(Called by Scheduled Job)_

  1.  Query `providers` table (potentially filtering for active providers or batching).
  2.  Fetch current Oracle prices.
  3.  For each provider:
      - Query `policyBacking` for their active backed policies.
      - Calculate `requiredCollateralValueUSD` and `currentCollateralValueUSD`.
      - Calculate ratio.
      - Fetch thresholds (from config/Parameter contract).
      - Determine `healthStatus` ("Healthy", "Warning", "MarginCall").
      - Call `internal.setProviderHealthStatus` mutation to update DB.
      - If status becomes "Warning" or "MarginCall", potentially trigger a notification action.

- **`handleOnChainEvent`**: `action({ args: { event: v.any() }, handler: async (ctx, args) => { ... } })` _(Called by BIL listener/poller)_
  1.  Determine event type (`funds-deposited`, `funds-withdrawn`, `settlement-paid`, etc.).
  2.  Parse data.
  3.  Call appropriate internal mutation(s) (`syncPoolBalancesFromEvent`, potentially triggering provider balance updates based on deposit/withdrawal events if needed for reconciliation).

## 7. Interactions with Other Services

- **Policy Registry Service:** Provides policy data, triggers collateral allocation/release requests.
- **Oracle Service:** Provides STX and sBTC prices for health checks and valuations.
- **Parameter Service/Contract:** Provides configuration like buffer percentages, tier capacity limits.
- **Blockchain Integration Layer:** Used for all on-chain Vault interactions.
- **Notification Service (Conceptual):** Triggered when provider health status changes to Warning/MarginCall.

## 8. Conclusion

This Convex architecture for the Liquidity Pool component centralizes the complex logic of provider accounting, risk tier management, collateral health monitoring, and yield accrual off-chain. It interacts with a minimal on-chain Vault contract purely for holding funds and executing authorized transfers/locks. This hybrid model offers significant advantages in terms of cost, flexibility, and the ability to implement sophisticated risk management features for the BitHedge MVP.
