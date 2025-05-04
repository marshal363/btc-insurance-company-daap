# Policy Registry Specification Guidelines (Hybrid MVP)

**Version:** 1.0
**Date:** 2024-08-21
**Status:** Draft

## 1. Introduction

This document provides the technical specification for the BitHedge Policy Registry component within the hybrid architecture. It details the distinct responsibilities of the minimal on-chain Clarity contract (`policy-registry.clar`) and the corresponding off-chain Convex backend services.

The goal is an "On-Chain Light / Off-Chain Heavy" implementation where the blockchain provides the immutable record of core policy terms and final status, while Convex handles the complex logic, metadata management, and workflow orchestration.

## 2. On-Chain Specification (`policy-registry.clar` - Minimal)

This contract serves as a minimal, trust-anchored ledger for essential policy details and status transitions.

**2.1. Core Responsibilities:**

- Store immutable core details of created policies.
- Provide functions for authorized principals (users or backend) to create policy entries and update their status.
- Maintain essential state variables (e.g., policy counter).
- Emit events for critical state changes (creation, status updates).
- Ensure basic data integrity and access control.

**2.2. State Variables:**

- `policy-counter (define-data-var uint u0)`: Tracks the next available policy ID.
- `contract-admin (define-data-var principal tx-sender)`: Initial admin, potentially updatable later.
- `backend-principal (define-data-var principal tx-sender)`: The authorized address for the Convex backend system (set during initialization).

**2.3. Data Maps:**

- `policies (define-map { policy-id: uint } { owner: principal, counterparty: principal, protectedValuePriceFeedUnits: uint, protectedAmountSats: uint, expirationHeight: uint, policyType: (string-ascii 4), status: uint })`: Stores the minimal, essential policy data.
  - `status`: `u0` (Active), `u1` (Settled), `u2` (Expired). Note: `Canceled` status might be purely off-chain for MVP.

**2.4. Functions:**

- **(Public) `create-policy-entry`**: _(Callable by user via prepared transaction)_

  - **Authorization:** `tx-sender` must be the policy owner.
  - **Parameters:** `owner: principal`, `counterparty: principal` (Vault Address), `protectedValuePriceFeedUnits: uint`, `protectedAmountSats: uint`, `expirationHeight: uint`, `policyType: (string-ascii 4)`.
  - **Logic:**
    - Assert `tx-sender` matches `owner` parameter.
    - Assert basic validity (amounts > 0, expiration > current height, valid type).
    - Increment `policy-counter`.
    - `map-set` the new policy entry in `policies` map with `status: u0`.
    - Emit `policy-created` event.
  - **Returns:** `(ok uint)` (new policy ID) or `(err uint)`.
  - _Note: Does NOT handle premium transfer or collateral locking; these are assumed to happen atomically in the same user-signed transaction targeting the Vault contract._

- **(Public) `update-policy-status`**: _(Callable ONLY by `backend-principal`)_

  - **Authorization:** Check `(is-eq tx-sender (var-get backend-principal))`.
  - **Parameters:** `policyId: uint`, `newStatus: uint` (must be `u1` or `u2`).
  - **Logic:**
    - Fetch the policy from `policies` map.
    - Assert policy exists and current status is `u0` (Active).
    - Assert `newStatus` is valid (`u1` or `u2`).
    - If `newStatus` is `u2` (Expired), assert `block-height > expirationHeight`.
    - `map-set` the policy entry with the `newStatus`.
    - Emit `policy-status-updated` event.
  - **Returns:** `(ok bool)` or `(err uint)`.

- **(Public) `set-backend-principal`**: _(Callable ONLY by `contract-admin`)_

  - **Authorization:** Check `(is-eq tx-sender (var-get contract-admin))`.
  - **Parameters:** `newBackendPrincipal: principal`.
  - **Logic:** Update `backend-principal` data variable.
  - **Returns:** `(ok bool)`.

- **(Read-Only) `get-policy-data`**:

  - **Parameters:** `policyId: uint`.
  - **Returns:** `(optional { owner: principal, ... status: uint })` - The data stored in the `policies` map entry.

- **(Read-Only) `get-policy-counter`**:
  - **Returns:** `uint` - Current value of `policy-counter`.

**2.5. Error Codes:**

- `ERR-NOT-AUTHORIZED (u100)`
- `ERR-POLICY-NOT-FOUND (u101)`
- `ERR-INVALID-PARAMETERS (u102)`
- `ERR-INVALID-STATUS-TRANSITION (u103)`
- `ERR-POLICY-NOT-EXPIRED (u104)`
- `ERR-BACKEND-PRINCIPAL-ALREADY-SET (u105)` (If setter should be one-time)

**2.6. Events:**

- `(print { event: "policy-created", policyId: uint, owner: principal, ... })` - As defined in `core-data-types.md`.
- `(print { event: "policy-status-updated", policyId: uint, newStatus: uint, ... })` - As defined in `core-data-types.md`.

**2.7. Security Considerations:**

- Strict authorization on `update-policy-status` and `set-backend-principal` is paramount.
- Simplicity minimizes attack surface.
- Input validation is essential.

## 3. Off-Chain Specification (Convex Backend)

Handles detailed policy management, lifecycle orchestration, and user-facing data presentation.

**3.1. Core Responsibilities:**

- Provide APIs (queries/mutations/actions) for UI to interact with policy data.
- Store detailed policy information beyond the minimal on-chain data.
- Manage policy indexing for efficient querying (by owner, status, expiration range, etc.).
- Orchestrate the policy creation flow, including premium calculation, parameter validation, and preparation of the user-signed transaction.
- Orchestrate policy activation flow, including Oracle checks, settlement calculation, and triggering on-chain settlement and status updates.
- Detect policy expirations via scheduled jobs and trigger on-chain status updates and collateral release.
- Synchronize off-chain state with on-chain events.

**3.2. Convex Schema (`db/schema.ts` - relevant parts):**

```typescript
export default defineSchema({
  policies: defineTable({
    policyId_onChain: "number", // Stored uint from the on-chain contract
    ownerPrincipal: "string",
    counterpartyPrincipal: "string", // Pool Vault Address
    protectedValuePriceFeedUnits: "number", // Stored as number/bigint
    protectedAmountSats: "number", // Stored as number/bigint
    expirationHeight: "number",
    policyType: "string", // "PUT"
    status_onChain: "number", // 0, 1, 2 - mirrors on-chain
    status_detailed: "string", // "Active", "Settled", "Expired", "Cancelling", "Cancelled" etc. - user-facing
    creationHeight: "number",
    creationTimestamp: "number",
    expirationTimestampEstimate: "number",
    premiumAmountBaseUnits: "number", // ustx or sats paid
    premiumToken: "string", // "STX" or "sBTC"
    premiumFeeAmountBaseUnits: "number",
    settlementAmountBaseUnits: "number | null",
    settlementToken: "string | null",
    settlementTimestamp: "number | null",
    // ... other metadata, indices ...
  })
    .index("by_owner", ["ownerPrincipal"])
    .index("by_status_detailed", ["status_detailed"])
    .index("by_expirationHeight", ["expirationHeight"]),
  // ... other tables (providers, oracleData etc.)
});
```

**3.3. Convex Functions (Queries - `convex/policies.ts`):**

- `listByOwner(ownerPrincipal: string, statusFilter?: string)`: Fetch policies for a user, optionally filtered by detailed status.
- `getById(policyId_onChain: number)`: Fetch detailed policy data by its on-chain ID.
- `listExpiringSoon(currentTime: number, windowSeconds: number)`: Fetch policies expiring within a certain timeframe.
- `getPlatformStats()`: Aggregate statistics (total active, total value, etc.).

**3.4. Convex Functions (Mutations - `convex/policies.ts`):**

- `(internal) updatePolicyFromEvent(eventData: OnChainPolicyEvent)`: Updates the Convex DB based on confirmed on-chain events (e.g., `policy-created`, `policy-status-updated`). Handles state synchronization.
- `(internal) setPolicyStatusDetailed(policyId_onChain: number, newDetailedStatus: string)`: Updates the user-facing status in Convex DB.

**3.5. Convex Functions (Actions - `convex/policies.ts`):**

- `requestPolicyCreation(input: PolicyParametersInput)`:

  - Performs detailed validation (input sanity, user balance checks - maybe?, parameter checks against Parameter contract/off-chain config).
  - Calls Oracle service (`actions.oracle.getCurrentPrice`) for current BTC price.
  - Calls Premium Calculation service (`actions.premiums.calculateBuyerPremium`) to get premium.
  - Checks Liquidity Pool service (`actions.liquidity.checkTierAvailability`) for sufficient capacity in the corresponding tier.
  - Prepares the parameters for the _user-signed_ transaction (including premium transfer to Vault, call to `policy-registry.clar::create-policy-entry`).
  - Returns the prepared transaction parameters to the UI.
  - _May_ optimistically create a 'PendingCreation' entry in Convex DB.

- `requestPolicyActivation(policyId_onChain: number)`:

  - Validates the policy exists and is active (checks Convex DB `status_onChain == 0`).
  - Calls Oracle service (`actions.oracle.getCurrentPrice`) for current BTC price.
  - Validates activation condition (strike vs current price).
  - If valid, calculates settlement amount.
  - Calls Liquidity Pool service (`actions.liquidity.requestSettlement`) to trigger the on-chain Vault settlement transfer (backend-signed).
  - Upon Vault settlement confirmation (monitored by `actions.liquidity`), triggers `triggerPolicyStatusUpdate`.
  - Updates Convex DB status to 'Settling'.

- `(internal) triggerPolicyStatusUpdate(policyId_onChain: number, newStatus_onChain: number)`:

  - Calls the Blockchain Integration Layer to build/sign/broadcast a backend-signed transaction calling `policy-registry.clar::update-policy-status`.
  - Monitors the transaction.
  - Upon confirmation, triggers `internal.policies.updatePolicyFromEvent` (which updates Convex DB).

- `checkForExpirations()`: _(Called by Scheduled Job)_
  - Queries Convex DB for policies where `expirationHeight < currentBlockHeight` and `status_onChain == 0`.
  - For each expired policy:
    - Calls Liquidity Pool service (`actions.liquidity.requestCollateralRelease`) for the associated collateral (backend-signed).
    - Upon collateral release confirmation, calls `internal.policies.triggerPolicyStatusUpdate(policyId, 2)` to update on-chain status to Expired.
  - Updates Convex DB status to 'Expired'.

**3.6. Error Handling:**

- Implement robust error handling for failed validations, Oracle calls, premium calculations, blockchain interactions, and state updates.
- Provide clear error messages back to the UI.

## 4. Conclusion

This specification outlines a clear division of responsibilities for the Policy Registry. The on-chain contract acts as a minimal, secure ledger for core data and status, while the Convex backend manages the complexity of the policy lifecycle, calculations, user interactions, and data indexing. This hybrid approach optimizes for gas efficiency, flexibility, and user experience within the MVP constraints.
