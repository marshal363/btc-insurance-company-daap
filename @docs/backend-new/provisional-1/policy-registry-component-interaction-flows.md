# Policy Registry Component Interaction Flows (MVP)

**Version:** 1.0
**Date:** 2024-08-21
**Status:** Draft
**Related Specs:** `bithdge-hybrid-architecture-overview.md`, `policy-registry-specification-guidelines.md`, `convex-policy-registry-architecture.md`

## 1. Introduction

This document illustrates the key interaction sequences involving the Policy Registry component in the BitHedge MVP. These flows demonstrate how user actions initiated in the frontend UI propagate through the Convex backend, Blockchain Integration Layer, and the minimal on-chain `policy-registry.clar` contract.

## 2. Flow 1: Buyer Requests Protection (Policy Creation)

This flow describes how a user (Protective Peter) purchases a protection policy.

```mermaid
sequenceDiagram
    participant UI as Frontend UI
    participant Wallet as User Wallet
    participant CPA as Convex Action<br>(policies.requestPolicyCreation)
    participant CPQ as Convex Query<br>(premiums, oracle, liquidity)
    participant CPM as Convex Mutation<br>(internal.policies...)
    participant BIL as Blockchain Integration Layer<br>(Convex Helpers)
    participant PRC as Policy Registry Contract<br>(on-chain)
    participant LPV as Liquidity Pool Vault<br>(on-chain)

    UI->>CPA: Initiate requestPolicyCreation(input: PolicyParametersInput)
    CPA->>CPQ: Get Oracle Price, Premium, Pool Availability
    CPQ-->>CPA: Return calculation data
    CPA-->>CPM: (Optional) recordNewPolicyAttempt (status: PendingCreation)
    CPM-->>CPA: Confirm attempt recorded
    CPA->>BIL: Prepare User-Signed TX Parameters (Premium Transfer to LPV + PRC.create-policy-entry call)
    BIL-->>CPA: Return TX parameters
    CPA-->>UI: Return TX parameters needed for signing
    UI->>Wallet: Prompt user to sign transaction
    Wallet-->>UI: User signs TX
    UI->>BIL: Broadcast Signed TX
    BIL->>PRC: Execute create-policy-entry(...)
    Note over BIL, PRC: TX also includes premium transfer to LPV
    PRC-->>BIL: TX Confirmed (Success/Fail)
    PRC-->>PRC: Emit "policy-created" event

    alt Transaction Successful
        BIL-->>CPM: Trigger updatePolicyFromCreationEvent (via event listener or polling confirmation)
        CPM-->>CPM: Update policy status to Active
        UI-->>CPQ: (Later) Query policy status, shows Active
    else Transaction Failed
        BIL-->>CPM: Trigger updatePolicyStatusDetailed (status: FailedCreation)
        CPM-->>CPM: Update policy status
        UI-->>CPA: Show error to user
    end
```

**Key Steps:**

1.  UI triggers the Convex action with policy parameters.
2.  Convex action performs off-chain checks, calculations (premium, tier), and capacity validation.
3.  Convex action prepares the parameters for a combined on-chain transaction (premium transfer + policy entry creation).
4.  UI prompts the user to sign this transaction via their wallet.
5.  The signed transaction is broadcast.
6.  On-chain contracts execute the premium transfer (to the Vault) and create the policy entry in the Registry.
7.  Convex backend confirms the transaction and updates the off-chain policy status to `Active`.

## 3. Flow 2: Buyer Requests Activation (Policy Settlement)

This flow describes how a user activates their policy when conditions are met.

```mermaid
sequenceDiagram
    participant UI as Frontend UI
    participant Wallet as User Wallet
    participant CPA as Convex Action<br>(policies.requestPolicyActivation)
    participant CPQ as Convex Query<br>(policies, oracle)
    participant CPM as Convex Mutation<br>(internal.policies...)
    participant CLA as Convex Action<br>(liquidity.requestSettlement)
    participant CLM as Convex Mutation<br>(internal.liquidity...)
    participant CPSU as Convex Action<br>(internal.policies.triggerPolicyStatusUpdate)
    participant BIL as Blockchain Integration Layer
    participant PRC as Policy Registry Contract
    participant LPV as Liquidity Pool Vault

    UI->>CPA: Initiate requestPolicyActivation(policyId_onChain)
    CPA->>CPQ: Get Policy Data & Oracle Price
    CPQ-->>CPA: Return policy & price data
    CPA->>CPA: Validate activation condition (price < strike)
    alt Condition Met
        CPA->>CPM: Update status_detailed to "Settling"
        CPM-->>CPA: Confirm status updated
        CPA->>CLA: Initiate requestSettlement(policyId, settlementAmount, buyerPrincipal)
        CLA->>BIL: Prepare Backend-Signed TX (LPV.settle-policy call)
        BIL-->>CLA: Return signed TX
        CLA->>BIL: Broadcast Signed TX to LPV
        BIL->>LPV: Execute settle-policy(...)
        LPV-->>BIL: TX Confirmed (Success/Fail)
        LPV-->>LPV: Emit "settlement-paid" event

        alt Settlement TX Successful
            BIL-->>CLM: (Via Event/Poll) Update Vault balance off-chain
            CLA->>CPSU: Trigger triggerPolicyStatusUpdate(policyId, newStatus=1)
            CPSU->>BIL: Prepare Backend-Signed TX (PRC.update-policy-status call)
            BIL-->>CPSU: Return signed TX
            CPSU->>BIL: Broadcast Signed TX to PRC
            BIL->>PRC: Execute update-policy-status(...)
            PRC-->>BIL: TX Confirmed (Success/Fail)
            PRC-->>PRC: Emit "policy-status-updated" event
            BIL-->>CPM: (Via Event/Poll) Trigger updatePolicyFromStatusEvent
            CPM-->>CPM: Update policy status to Settled
            UI-->>CPQ: (Later) Query policy status, shows Settled
        else Settlement TX Failed
            CLA->>CPM: Update status_detailed to "FailedSettlement"
            CPM-->>CLA: Confirm status updated
            UI-->>CPQ: (Later) Query policy status, shows FailedSettlement
        end
    else Condition Not Met
        CPA-->>UI: Return error "Activation condition not met"
    end
```

**Key Steps:**

1.  UI triggers the activation request.
2.  Convex action validates the request off-chain using current Oracle price data.
3.  If valid, Convex optimistically updates its DB status to `Settling`.
4.  Convex triggers the Liquidity Pool service action (`requestSettlement`).
5.  The Liquidity action prepares and executes a **backend-signed** transaction calling the on-chain Vault to transfer settlement funds to the buyer.
6.  Upon successful settlement transfer confirmation, the Liquidity action triggers the Policy Registry action (`triggerPolicyStatusUpdate`).
7.  The Policy Registry action prepares and executes a **backend-signed** transaction calling the on-chain Registry to update the policy status to `Settled` (`u1`).
8.  Convex backend confirms the status update and updates its off-chain policy record definitively.

## 4. Flow 3: System Triggers Expiration

This flow describes the automated process for marking policies as expired.

```mermaid
sequenceDiagram
    participant CSJ as Convex Scheduled Job<br>(crons.checkForExpirations)
    participant CPA as Convex Action<br>(internal.policies.checkAndTriggerExpirations)
    participant CPQ as Convex Query<br>(policies)
    participant CPM as Convex Mutation<br>(internal.policies...)
    participant CLA as Convex Action<br>(liquidity.requestCollateralRelease)
    participant CLM as Convex Mutation<br>(internal.liquidity...)
    participant CPSU as Convex Action<br>(internal.policies.triggerPolicyStatusUpdate)
    participant BIL as Blockchain Integration Layer
    participant PRC as Policy Registry Contract
    participant LPV as Liquidity Pool Vault

    CSJ->>CPA: Trigger checkAndTriggerExpirations
    CPA->>CPQ: Query policies past expirationHeight with status_onChain = 0
    CPQ-->>CPA: Return list of expired policy IDs
    loop For Each Expired Policy
        CPA->>CPM: Update status_detailed to "Expiring"
        CPA->>CLA: Initiate requestCollateralRelease(policyId)
        CLA->>BIL: Prepare Backend-Signed TX (LPV.release-collateral-aggregate call)
        BIL-->>CLA: Return signed TX
        CLA->>BIL: Broadcast Signed TX to LPV
        BIL->>LPV: Execute release-collateral-aggregate(...)
        LPV-->>BIL: TX Confirmed (Success/Fail)
        LPV-->>LPV: Emit "collateral-released" event

        alt Collateral Release Successful
            BIL-->>CLM: (Via Event/Poll) Update Vault locked balance off-chain
            CLA->>CPSU: Trigger triggerPolicyStatusUpdate(policyId, newStatus=2)
            CPSU->>BIL: Prepare Backend-Signed TX (PRC.update-policy-status call)
            BIL-->>CPSU: Return signed TX
            CPSU->>BIL: Broadcast Signed TX to PRC
            BIL->>PRC: Execute update-policy-status(...)
            PRC-->>BIL: TX Confirmed (Success/Fail)
            PRC-->>PRC: Emit "policy-status-updated" event
            BIL-->>CPM: (Via Event/Poll) Trigger updatePolicyFromStatusEvent
            CPM-->>CPM: Update policy status to Expired
        else Collateral Release Failed
            CLA->>CPA: Report failure (e.g., log error)
            CPA->>CPM: Potentially update status_detailed to "FailedExpiration"
        end
    end
```

**Key Steps:**

1.  A scheduled Convex job runs periodically.
2.  It queries the Convex database for active policies whose `expirationHeight` has passed.
3.  For each identified policy, it initiates the collateral release process by calling the Liquidity Pool service action (`requestCollateralRelease`).
4.  The Liquidity action prepares and executes a **backend-signed** transaction calling the on-chain Vault to release the aggregate collateral associated with the policy (or batch of policies).
5.  Upon successful collateral release confirmation, the Liquidity action triggers the Policy Registry action (`triggerPolicyStatusUpdate`).
6.  The Policy Registry action prepares and executes a **backend-signed** transaction calling the on-chain Registry to update the policy status to `Expired` (`u2`).
7.  Convex backend confirms the status update and updates its off-chain policy record.

## 5. Conclusion

These flows illustrate the orchestration role of the Convex backend in managing the policy lifecycle. User-initiated actions involve user signatures for the final on-chain step, while system-initiated actions (settlement, expiration) are handled via backend-signed transactions, all interacting with the minimal on-chain contracts for finality.
