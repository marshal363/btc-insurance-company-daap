# Convex Policy Registry Architecture (MVP)

**Version:** 1.0
**Date:** 2024-08-21
**Status:** Draft
**Related Spec:** `policy-registry-specification-guidelines.md`

## 1. Introduction

This document details the architecture of the Policy Registry component within the Convex backend. Following the "On-Chain Light / Off-Chain Heavy" principle, Convex manages the majority of policy data, lifecycle logic, and orchestration, interacting minimally with the simplified `policy-registry.clar` contract for final state anchoring.

## 2. Core Responsibilities (Recap)

- Store detailed policy information and metadata.
- Provide efficient querying capabilities for the UI.
- Orchestrate policy creation, activation, and expiration workflows.
- Interact with other Convex services (Oracle, Liquidity Pool, Premium Calculator).
- Synchronize state with minimal on-chain contract events.
- Manage user-facing policy status representations.

## 3. Convex Schema (`db/schema.ts`)

The primary table for policy management:

```typescript
export default defineSchema({
  // ... other tables (users, providers, etc.)

  policies: defineTable({
    // --- Core On-Chain Mirrored Data ---
    policyId_onChain: "number", // uint from Clarity contract. Unique identifier.
    ownerPrincipal: "string",
    counterpartyPrincipal: "string", // Expected: Liquidity Pool Vault Address
    protectedValuePriceFeedUnits: "number", // Strike price (e.g., USD 8 decimals)
    protectedAmountSats: "number", // Amount protected (Satoshis)
    expirationHeight: "number", // Block height
    policyType: "string", // "PUT" (MVP focus)
    status_onChain: "number", // 0 (Active), 1 (Settled), 2 (Expired)

    // --- Detailed Off-Chain Data & Metadata ---
    status_detailed: "string", // "PendingCreation", "Active", "Settling", "Settled", "Expiring", "Expired", "FailedCreation", "FailedSettlement"
    creationHeight: "number | null", // Block height confirmed on-chain
    creationTimestamp: "number | null", // Block timestamp estimate
    expirationTimestampEstimate: "number | null", // Estimated timestamp of expiration
    premiumAmountBaseUnits: "number | null", // ustx or sats paid (recorded after creation confirmation)
    premiumToken: "string | null", // "STX" or "sBTC"
    premiumFeeAmountBaseUnits: "number | null", // Platform fee portion
    settlementAmountBaseUnits: "number | null", // ustx or sats paid out
    settlementToken: "string | null",
    settlementTimestamp: "number | null",
    txId_creation: "string | null", // On-chain Tx ID for creation
    txId_statusUpdate: "string | null", // On-chain Tx ID for last status update (settle/expire)
    lastCheckedBlockHeight_expiry: "number | null", // For expiration job tracking

    // --- Relational / Contextual Data ---
    riskTier: "string", // "Conservative", "Balanced", "Aggressive" (Determined at creation)
    oracleDataSnapshot_creation: "any | null", // Store Oracle price/volatility at creation time
    oracleDataSnapshot_settlement: "any | null", // Store Oracle price at settlement time
  })
    // --- Indexes for Querying ---
    .index("by_policyId_onChain", ["policyId_onChain"])
    .index("by_ownerPrincipal", ["ownerPrincipal"])
    .index("by_status_detailed", ["status_detailed"])
    .index("by_expirationHeight", ["expirationHeight"])
    .index("by_status_onChain", ["status_onChain"])
    .index("by_tier_and_status", ["riskTier", "status_detailed"]), // For pool metrics

  // ... potentially a separate table for policy events/history if needed beyond basic status
});
```

## 4. Convex Functions (Queries - `convex/policies.ts`)

These functions provide read access to policy data for the UI and other services.

- **`listByOwner`**: `query({ args: { ownerPrincipal: v.string(), statusFilter: v.optional(v.string()) }, handler: async (ctx, args) => { ... } })`
  - Uses the `by_ownerPrincipal` index.
  - Optionally filters further by `status_detailed`.
  - Returns a list of detailed policy objects.
- **`getById`**: `query({ args: { policyId_onChain: v.number() }, handler: async (ctx, args) => { ... } })`
  - Uses the `by_policyId_onChain` index.
  - Returns a single detailed policy object or null.
- **`listExpiringBetween`**: `query({ args: { minHeight: v.number(), maxHeight: v.number() }, handler: async (ctx, args) => { ... } })`
  - Uses the `by_expirationHeight` index to fetch policies within a block height range.
  - Useful for UI display ("Expiring Soon").
- **`listActiveByTier`**: `query({ args: { riskTier: v.string() }, handler: async (ctx, args) => { ... } })`
  - Uses `by_tier_and_status` index to fetch active policies for a specific tier.
  - Used internally by Liquidity Pool service for collateral calculations.
- **`getPlatformStats`**: `query({ handler: async (ctx) => { ... } })`
  - Aggregates data (e.g., count active, total premium, total settled) across the `policies` table.

## 5. Convex Functions (Mutations - `convex/policies.ts`)

Mutations handle direct, synchronous updates to the Convex database, often called internally or by actions after successful operations.

- **`(internal) recordNewPolicyAttempt`**: `mutation({ args: { ...policyInputData }, handler: async (ctx, args) => { ... } })`
  - Creates a new policy entry in Convex DB with `status_detailed: "PendingCreation"`.
  - Returns the Convex document ID.
- **`(internal) updatePolicyFromCreationEvent`**: `mutation({ args: { convexPolicyId: v.id("policies"), onChainData: v.object({...}) }, handler: async (ctx, args) => { ... } })`
  - Updates the Convex policy document identified by `convexPolicyId` with the confirmed on-chain data (`policyId_onChain`, `creationHeight`, etc.).
  - Sets `status_onChain: 0`, `status_detailed: "Active"`.
  - Records `txId_creation`.
- **`(internal) updatePolicyFromStatusEvent`**: `mutation({ args: { policyId_onChain: v.number(), eventData: v.object({...}) }, handler: async (ctx, args) => { ... } })`
  - Finds policy using `by_policyId_onChain` index.
  - Updates `status_onChain` based on `eventData.newStatus`.
  - Updates `status_detailed` accordingly ("Settled", "Expired").
  - Records `settlementAmountBaseUnits`, `settlementToken`, `settlementTimestamp` if applicable.
  - Records `txId_statusUpdate`.
- **`(internal) setPolicyStatusDetailed`**: `mutation({ args: { policyId_onChain: v.number(), newDetailedStatus: v.string() }, handler: async (ctx, args) => { ... } })`
  - Updates only the `status_detailed` field. Used for intermediate states like "Settling", "Expiring", or failure states.

## 6. Convex Functions (Actions - `convex/policies.ts`)

Actions orchestrate workflows involving potential side effects (API calls, other actions, blockchain interactions).

- **`requestPolicyCreation`**: `action({ args: { input: /* PolicyParametersInput */ }, handler: async (ctx, args) => { ... } })`

  1.  **Get Auth:** Get `ownerPrincipal` from `ctx.auth`.
  2.  **Validate Input:** Basic sanity checks on `args.input`.
  3.  **Fetch Market Data:** Call `ctx.runQuery(api.oracle.getLatestPrice)`.
  4.  **Validate Parameters:** Check duration/strike against `parameter.clar` or off-chain config (requires Parameter service/query).
  5.  **Calculate Premium:** Call `ctx.runQuery(api.premiums.calculateBuyerPremium, { ... })`.
  6.  **Determine Tier:** Classify the request into a risk tier based on strike/duration.
  7.  **Check Pool Capacity:** Call `ctx.runQuery(api.liquidity.getTierAvailability, { tier: calculatedTier, requiredCollateral: ... })`. Handle insufficient capacity error.
  8.  **(Optional) Record Attempt:** Call `ctx.runMutation(internal.policies.recordNewPolicyAttempt, { ... })`.
  9.  **Prepare TX:** Construct the parameters for the user-signed transaction (Premium transfer to Vault + `policy-registry.clar::create-policy-entry` call) using Blockchain Integration Layer helpers.
  10. **Return Payload:** Return the parameters needed for the frontend to initiate the signing process via `@stacks/connect`.

- **`requestPolicyActivation`**: `action({ args: { policyId_onChain: v.number() }, handler: async (ctx, args) => { ... } })`

  1.  **Get Auth & Policy:** Get `ownerPrincipal` from `ctx.auth`. Fetch policy data from Convex DB using `ctx.runQuery(api.policies.getById, { policyId_onChain: args.policyId_onChain })`. Verify ownership and `status_detailed == "Active"` / `status_onChain == 0`.
  2.  **Fetch Oracle Price:** Call `ctx.runQuery(api.oracle.getLatestPrice)`.
  3.  **Validate Activation:** Check if `currentBtcPrice < policy.protectedValuePriceFeedUnits`.
  4.  **Calculate Settlement:** Perform settlement calculation off-chain.
  5.  **Update Status (Optimistic):** Call `ctx.runMutation(internal.policies.setPolicyStatusDetailed, { policyId_onChain: args.policyId_onChain, newDetailedStatus: "Settling" })`.
  6.  **Trigger Settlement:** Call `ctx.runAction(api.liquidity.requestSettlement, { policyId_onChain: args.policyId_onChain, settlementAmount: calculatedAmount, settlementToken: ..., buyerPrincipal: policy.ownerPrincipal })`.
  7.  _(Liquidity action handles Vault interaction and monitoring)_.
  8.  **(Handled by Liquidity action upon success):** Call `ctx.runAction(internal.policies.triggerPolicyStatusUpdate, { policyId_onChain: args.policyId_onChain, newStatus_onChain: 1 /* Settled */ })`.
  9.  Handle errors from settlement; potentially revert status to "Active" or set to "FailedSettlement".

- **`(internal) triggerPolicyStatusUpdate`**: `action({ args: { policyId_onChain: v.number(), newStatus_onChain: v.number() }, handler: async (ctx, args) => { ... } })`

  1.  **Prepare TX:** Call Blockchain Integration Layer helper `prepareBackendSignedTx` for `policy-registry.clar::update-policy-status` with `args.policyId_onChain` and `args.newStatus_onChain`.
  2.  **Sign & Broadcast:** Call `signAndBroadcastBackendTx`.
  3.  **Monitor TX:** Call `monitorTransaction`.
  4.  **Update Off-Chain State:** If successful, call `ctx.runMutation(internal.policies.updatePolicyFromStatusEvent, { ... })`. If failed, log error and potentially update status to a failed state.

- **`handleOnChainEvent`**: `action({ args: { event: v.any() }, handler: async (ctx, args) => { ... } })` _(Called by Blockchain Integration Layer's event listener/poller)_
  1.  Determine event type (`policy-created`, `policy-status-updated`).
  2.  Parse `args.event` data.
  3.  Call the appropriate internal mutation (`updatePolicyFromCreationEvent`, `updatePolicyFromStatusEvent`) to synchronize Convex DB.

## 7. Scheduled Jobs (`convex/crons.ts`)

- **`checkForExpirations`**: `cronJobs.interval("Check for Policy Expirations", { hours: 1 }, internal.policies.checkAndTriggerExpirations)`
  - Associated Action `internal.policies.checkAndTriggerExpirations`: Queries Convex DB for active policies past their `expirationHeight`. For each, calls `ctx.runAction(api.liquidity.requestCollateralRelease, { policyId_onChain: ... })`. Upon successful collateral release confirmation (potentially via another scheduled check or callback), it calls `ctx.runAction(internal.policies.triggerPolicyStatusUpdate, { policyId_onChain: ..., newStatus_onChain: 2 /* Expired */ })`.

## 8. Interactions with Other Services

- **Oracle Service:** Relied upon for current price data during creation and activation.
- **Premium Calculation Service:** Used during `requestPolicyCreation`.
- **Liquidity Pool Service:** Checked for capacity during creation, triggered for settlement and collateral release.
- **Blockchain Integration Layer:** Used by actions to interact with the on-chain contracts.

## 9. Conclusion

This Convex architecture places the majority of the policy management burden off-chain, enabling complex workflows, rich data storage, and efficient querying. It relies on the minimal on-chain contract as a source of truth for core immutable data and final status, ensuring trust and settlement guarantees while optimizing for performance and cost.
