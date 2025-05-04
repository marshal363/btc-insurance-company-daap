# BitHedge Policy Registry: Component Interaction Flows

## 1. Introduction

This document details the interaction flows between components in the BitHedge platform related to the Policy Registry functionality. These flows illustrate how the different components interact during key processes like policy creation, activation, and expiration.

## 2. Policy Creation Flow

### 2.1 Flow Diagram

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐         ┌─────────────────┐
│             │         │               │         │              │         │                 │
│  Frontend   │         │ Convex Backend│         │ Blockchain   │         │ Policy Registry │
│  (UI)       │         │ (Policy Svc)  │         │ Network      │         │ Contract        │
│             │         │               │         │              │         │                 │
└──────┬──────┘         └───────┬───────┘         └──────┬───────┘         └────────┬────────┘
       │                        │                        │                          │
       │                        │                        │                          │
       │  1. Request Policy     │                        │                          │
       │     Creation           │                        │                          │
       │ ─────────────────────► │                        │                          │
       │                        │                        │                          │
       │                        │  2. Validate Parameters│                          │
       │                        │ ◄──────────────────────│                          │
       │                        │                        │                          │
       │                        │  3. Calculate Premium  │                          │
       │                        │ ◄──────────────────────│                          │
       │                        │                        │                          │
       │                        │  4. Check Pool Liquidity                          │
       │                        │ ◄──────────────────────│                          │
       │                        │                        │                          │
       │                        │  5. Prepare Transaction│                          │
       │                        │ ◄──────────────────────│                          │
       │                        │                        │                          │
       │  6. Return Transaction │                        │                          │
       │     for Signing        │                        │                          │
       │ ◄─────────────────────┐│                        │                          │
       │                        │                        │                          │
       │  7. User Signs and     │                        │                          │
       │     Submits Transaction│                        │                          │
       │ ───────────────────────────────────────────────►│                          │
       │                        │                        │                          │
       │                        │                        │  8. Execute Contract Call│
       │                        │                        │ ─────────────────────────►
       │                        │                        │                          │
       │                        │                        │  9. Premium Payment +    │
       │                        │                        │     Policy Creation      │
       │                        │                        │ ◄─────────────────────────
       │                        │                        │                          │
       │                        │                        │  10. Events Emitted      │
       │                        │                        │ ◄─────────────────────────
       │                        │                        │                          │
       │                        │  11. Process Events    │                          │
       │                        │ ◄──────────────────────│                          │
       │                        │                        │                          │
       │                        │  12. Update Off-Chain  │                          │
       │                        │      State             │                          │
       │                        │ ◄──────────────────────│                          │
       │                        │                        │                          │
       │  13. Confirmation      │                        │                          │
       │ ◄─────────────────────┐│                        │                          │
       │                        │                        │                          │
       │  14. Update UI         │                        │                          │
       │ ◄──────────────────────│                        │                          │
       │                        │                        │                          │
```

### 2.2 Step-by-Step Description

1. **User Initiates Policy Creation (Frontend → Convex)**

   - User fills policy parameters in PolicySummary.tsx component
   - Frontend calls Convex action `requestPolicyCreation` with parameters
   - Parameters include: protected value, protection amount, duration, policy type

2. **Parameter Validation (Convex)**

   - Convex validates policy parameters against business rules
   - Checks if parameters are within allowed ranges
   - Verifies if the policy type is valid

3. **Premium Calculation (Convex)**

   - Convex calls premium calculation service
   - Factors in current BTC volatility from Oracle
   - Applies parameter-based pricing algorithm
   - Returns estimated premium in USD

4. **Liquidity Verification (Convex → Liquidity Pool Service)**

   - Convex checks if the Liquidity Pool has sufficient collateral
   - Verifies if risk tiers can accommodate the new policy
   - Confirms capacity for the requested policy terms

5. **Transaction Preparation (Convex)**

   - Convex converts parameters to on-chain format (e.g., USD to satoshis)
   - Builds transaction to call Policy Registry contract
   - Creates pending transaction record in Convex database

6. **Return Transaction Details (Convex → Frontend)**

   - Convex returns transaction details and pending transaction ID
   - Includes premium amount and estimated gas
   - Frontend displays confirmation dialog with details

7. **User Signs and Submits (Frontend → Blockchain)**

   - User reviews and approves the transaction
   - Frontend uses Stacks wallet to sign the transaction
   - Signed transaction is submitted to Stacks blockchain

8. **Transaction Processing (Blockchain → Contract)**

   - Blockchain processes the transaction
   - Policy Registry contract function is called with policy parameters

9. **On-Chain Processing (Policy Registry Contract)**

   - Contract validates parameters
   - Creates new policy entry with unique ID
   - Sets status to "Active"
   - Updates policy ownership index

10. **Event Emission (Contract → Blockchain)**

    - Contract emits "policy-created" event
    - Event includes policy ID and core parameters
    - Blockchain records events in transaction receipt

11. **Event Processing (Blockchain → Convex)**

    - Convex monitors blockchain for relevant events
    - Detects "policy-created" event
    - Extracts policy details from event data

12. **Off-Chain State Update (Convex)**

    - Convex updates pending transaction status to "Confirmed"
    - Creates comprehensive policy record with extended metadata
    - Updates indices for efficient querying
    - Records policy creation event in history

13. **Confirmation (Convex → Frontend)**

    - Convex notifies frontend of successful policy creation
    - Includes policy ID and core details

14. **UI Update (Frontend)**
    - Frontend updates display to show policy status
    - Adds policy to user's active policies list
    - Shows success notification to user

## 3. Policy Activation (Exercise) Flow

### 3.1 Flow Diagram

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐         ┌─────────────────┐         ┌─────────────────┐
│             │         │               │         │              │         │                 │         │                 │
│  Frontend   │         │ Convex Backend│         │ Blockchain   │         │ Policy Registry │         │ Liquidity Pool  │
│  (UI)       │         │ (Policy Svc)  │         │ Network      │         │ Contract        │         │ Contract        │
│             │         │               │         │              │         │                 │         │                 │
└──────┬──────┘         └───────┬───────┘         └──────┬───────┘         └────────┬────────┘         └────────┬────────┘
       │                        │                        │                          │                          │
       │ 1. Request Policy      │                        │                          │                          │
       │    Activation          │                        │                          │                          │
       │ ─────────────────────► │                        │                          │                          │
       │                        │                        │                          │                          │
       │                        │ 2. Check Eligibility   │                          │                          │
       │                        │ (Oracle Price Check)   │                          │                          │
       │                        │ ◄──────────────────────│                          │                          │
       │                        │                        │                          │                          │
       │                        │ 3. Calculate Settlement│                          │                          │
       │                        │    Amount              │                          │                          │
       │                        │ ◄──────────────────────│                          │                          │
       │                        │                        │                          │                          │
       │                        │ 4. Prepare Transaction │                          │                          │
       │                        │ ◄──────────────────────│                          │                          │
       │                        │                        │                          │                          │
       │ 5. Return Transaction  │                        │                          │                          │
       │    for Signing         │                        │                          │                          │
       │ ◄─────────────────────┐│                        │                          │                          │
       │                        │                        │                          │                          │
       │ 6. User Signs and      │                        │                          │                          │
       │    Submits Transaction │                        │                          │                          │
       │ ───────────────────────────────────────────────►│                          │                          │
       │                        │                        │                          │                          │
       │                        │                        │ 7. Execute Contract Calls│                          │
       │                        │                        │ ─────────────────────────►                          │
       │                        │                        │                          │                          │
       │                        │                        │ 8. Update Status to      │                          │
       │                        │                        │    Exercised             │                          │
       │                        │                        │ ◄─────────────────────────                          │
       │                        │                        │                          │                          │
       │                        │                        │ 9. Call Settlement       │                          │
       │                        │                        │ ─────────────────────────────────────────────────────►
       │                        │                        │                          │                          │
       │                        │                        │                         10. Transfer Settlement     │
       │                        │                        │                          │    to Policy Owner       │
       │                        │                        │                          │ ◄─────────────────────────
       │                        │                        │                          │                          │
       │                        │                        │ 11. Events Emitted       │                          │
       │                        │                        │ ◄─────────────────────────                          │
       │                        │                        │                          │                          │
       │                        │                        │ 12. Events Emitted       │                          │
       │                        │                        │ ◄─────────────────────────────────────────────────────
       │                        │                        │                          │                          │
       │                        │ 13. Process Events     │                          │                          │
       │                        │ ◄──────────────────────│                          │                          │
       │                        │                        │                          │                          │
       │                        │ 14. Update Off-Chain   │                          │                          │
       │                        │     State              │                          │                          │
       │                        │ ◄──────────────────────│                          │                          │
       │                        │                        │                          │                          │
       │ 15. Confirmation       │                        │                          │                          │
       │ ◄─────────────────────┐│                        │                          │                          │
       │                        │                        │                          │                          │
       │ 16. Update UI          │                        │                          │                          │
       │ ◄──────────────────────│                        │                          │                          │
       │                        │                        │                          │                          │
```

### 3.2 Step-by-Step Description

1. **User Initiates Policy Activation (Frontend → Convex)**

   - User selects "Exercise Policy" option for an eligible policy
   - Frontend calls Convex action `requestPolicyActivation` with policy ID
   - Current price from Oracle is included in request

2. **Eligibility Verification (Convex)**

   - Convex checks if policy is active and not expired
   - Verifies ownership against the authenticated user
   - Validates current price against policy terms (e.g., price below strike for PUT)

3. **Settlement Calculation (Convex)**

   - Convex calculates settlement amount based on:
     - Policy type (PUT/CALL)
     - Protected value (strike price)
     - Current price
     - Protection amount

4. **Transaction Preparation (Convex)**

   - Convex builds transaction to call Policy Registry and Liquidity Pool contracts
   - Creates pending transaction record in database

5. **Return Transaction Details (Convex → Frontend)**

   - Convex returns transaction details and pending transaction ID
   - Includes settlement amount and estimated gas
   - Frontend displays confirmation dialog with details

6. **User Signs and Submits (Frontend → Blockchain)**

   - User reviews and approves the transaction
   - Frontend uses Stacks wallet to sign the transaction
   - Signed transaction is submitted to Stacks blockchain

7. **Transaction Processing (Blockchain → Contracts)**

   - Blockchain processes the transaction
   - Multiple contract calls are executed

8. **Policy Status Update (Policy Registry Contract)**

   - Contract verifies policy eligibility and ownership
   - Updates policy status from "Active" to "Exercised"
   - Emits "policy-status-updated" event

9. **Settlement Request (Policy Registry → Liquidity Pool)**

   - Policy Registry requests settlement payout from Liquidity Pool
   - Passes settlement amount and recipient (policy owner)

10. **Settlement Processing (Liquidity Pool Contract)**

    - Liquidity Pool verifies the request is from Policy Registry
    - Transfers settlement amount to policy owner
    - Releases remaining collateral
    - Emits "settlement-paid" event

11. **Policy Registry Events (Contract → Blockchain)**

    - "policy-status-updated" event with new status
    - Includes policy ID, old and new status

12. **Liquidity Pool Events (Contract → Blockchain)**

    - "settlement-paid" event with payment details
    - "collateral-released" event for remaining collateral

13. **Event Processing (Blockchain → Convex)**

    - Convex monitors blockchain for relevant events
    - Detects policy and settlement events
    - Extracts details from event data

14. **Off-Chain State Update (Convex)**

    - Updates pending transaction status to "Confirmed"
    - Updates policy status to "Exercised"
    - Records settlement details (amount, timestamp)
    - Updates Liquidity Pool state
    - Records events in policy history

15. **Confirmation (Convex → Frontend)**

    - Convex notifies frontend of successful policy activation
    - Includes settlement amount and updated policy details

16. **UI Update (Frontend)**
    - Frontend updates policy display to show "Exercised" status
    - Shows settlement amount received
    - Displays success notification to user

## 4. Policy Expiration Flow (Automated)

### 4.1 Flow Diagram

```
┌───────────────┐         ┌──────────────┐         ┌─────────────────┐         ┌─────────────────┐
│               │         │              │         │                 │         │                 │
│ Convex Backend│         │ Blockchain   │         │ Policy Registry │         │ Liquidity Pool  │
│ (Policy Svc)  │         │ Network      │         │ Contract        │         │ Contract        │
│               │         │              │         │                 │         │                 │
└───────┬───────┘         └──────┬───────┘         └────────┬────────┘         └────────┬────────┘
        │                        │                          │
        │                        │                          │
        │ 1. Scheduled Job       │                          │
        │    Checks for Expired  │                          │
        │    Policies            │                          │
        │ ◄──────────────────────│                          │
        │                        │                          │
        │ 2. Prepare Transaction │                          │
        │    for Batch Expiration│                          │
        │ ◄──────────────────────│                          │
        │                        │                          │
        │ 3. Sign Transaction with│                         │
        │    Backend Key and Submit                         │
        │ ───────────────────────────────────────────────────►
        │                        │                          │
        │                        │                          │
        │                        │ 4. Execute Contract Call │
        │                        │ ─────────────────────────►
        │                        │                          │
        │                        │ 5. Expire Policies in    │
        │                        │    Batch                 │
        │                        │ ◄─────────────────────────
        │                        │                          │
        │                        │ 6. Notify Liquidity Pool │
        │                        │    for each Policy       │
        │                        │ ─────────────────────────────────────────────────────►
        │                        │                          │
        │                        │                          │
        │                        │ 7. Release Collateral   │
        │                        │    for Expired Policies  │
        │                        │                          │
        │                        │ ◄─────────────────────────
        │                        │                          │
        │                        │ 8. Events Emitted        │
        │                        │ ◄─────────────────────────
        │                        │                          │
        │                        │ 9. Events Emitted        │
        │                        │ ◄─────────────────────────────────────────────────────
        │                        │                          │
        │ 10. Process Events     │                          │
        │ ◄──────────────────────│                          │
        │                        │                          │
        │ 11. Update Off-Chain   │                          │
        │     State              │                          │
        │ ◄──────────────────────│                          │
        │                        │                          │
```

### 4.2 Step-by-Step Description

1. **Scheduled Job Execution (Convex)**

   - Scheduled job `checkExpiredPolicies` runs at regular intervals
   - Queries database for policies where:
     - Status is "Active"
     - Expiration height < current block height

2. **Transaction Preparation (Convex)**

   - Convex builds batch transaction to expire multiple policies
   - Creates pending transaction record in database
   - Groups policies into batches of reasonable size (e.g., 10)

3. **Backend-Signed Transaction (Convex → Blockchain)**

   - Convex signs transaction using backend authorized principal's key
   - Submits transaction to Stacks blockchain
   - No user interaction required

4. **Transaction Processing (Blockchain → Policy Registry)**

   - Blockchain processes the transaction
   - Policy Registry contract function `expire-policies-batch` is called

5. **Batch Expiration Processing (Policy Registry Contract)**

   - Contract verifies caller is authorized backend principal
   - For each policy in batch:
     - Verifies it's active and past expiration
     - Updates status from "Active" to "Expired"
     - Emits "policy-status-updated" event

6. **Collateral Release Request (Policy Registry → Liquidity Pool)**

   - For each expired policy, notifies Liquidity Pool
   - Requests release of collateral

7. **Collateral Release Processing (Liquidity Pool Contract)**

   - Liquidity Pool verifies request is from Policy Registry
   - Releases collateral previously locked for the policy
   - Returns collateral to available pool capacity
   - Emits "collateral-released" event

8. **Policy Registry Events (Contract → Blockchain)**

   - "policy-status-updated" events for each expired policy
   - Includes policy ID, status change details

9. **Liquidity Pool Events (Contract → Blockchain)**

   - "collateral-released" events for each expired policy
   - Includes amount released and policy reference

10. **Event Processing (Blockchain → Convex)**

    - Convex monitors blockchain for relevant events
    - Detects policy expiration and collateral release events
    - Extracts details from event data

11. **Off-Chain State Update (Convex)**
    - Updates pending transaction status to "Confirmed"
    - Updates each policy status to "Expired"
    - Updates Liquidity Pool state (released collateral)
    - Records events in policy history
    - Updates indices and aggregated metrics

## 5. Policy Query Flow

### 5.1 Flow Diagram

```
┌─────────────┐         ┌───────────────┐         ┌──────────────────┐
│             │         │               │         │                  │
│  Frontend   │         │ Convex Backend│         │ Policy Registry  │
│  (UI)       │         │ (Policy Svc)  │         │ Contract         │
│             │         │               │         │ (Read-Only)      │
│             │         │               │         │                  │
└──────┬──────┘         └───────┬───────┘         └────────┬─────────┘
       │                        │                          │
       │ 1. Request User's      │                          │
       │    Policies            │                          │
       │ ─────────────────────► │                          │
       │                        │                          │
       │                        │ 2. Authenticate User     │
       │                        │ ◄──────────────────────  │
       │                        │                          │
       │                        │ 3. Query Database with   │
       │                        │    Filters               │
       │                        │ ◄──────────────────────  │
       │                        │                          │
       │                        │ 4. (If needed) Verify    │
       │                        │    On-Chain State        │
       │                        │ ─────────────────────────►
       │                        │                          │
       │                        │ 5. Return Policy Data    │
       │                        │ ◄─────────────────────────
       │                        │                          │
       │                        │ 6. Assemble Response with│
       │                        │    Full Metadata         │
       │                        │ ◄─────────────────────── │
       │                        │                          │
       │ 7. Return Policies with│                          │
       │    Metadata & Analytics│                          │
       │ ◄─────────────────────┐│                          │
       │                        │                          │
       │ 8. Display Policies    │                          │
       │ ◄──────────────────── │                          │
       │                        │                          │
```

### 5.2 Step-by-Step Description

1. **User Requests Policies (Frontend → Convex)**

   - User navigates to policy list view
   - Frontend calls Convex query `getPoliciesForUser` with filters
   - Filters may include status, policy type, date range, etc.

2. **User Authentication (Convex)**

   - Convex verifies user is authenticated
   - Extracts user principal from authentication context

3. **Database Query (Convex)**

   - Convex queries off-chain database for policies owned by user
   - Applies specified filters
   - Uses indices for efficient retrieval
   - Handles pagination if needed

4. **Optional On-Chain Verification (Convex → Policy Registry)**

   - For critical data or reconciliation, Convex may verify key fields
   - Calls read-only contract functions to check current status
   - This step is optional and typically only done for reconciliation

5. **On-Chain Data Return (Policy Registry → Convex)**

   - Contract returns requested policy data
   - Includes current on-chain status and essential fields

6. **Response Assembly (Convex)**

   - Combines on-chain verified data with rich off-chain metadata
   - Calculates derived metrics (e.g., current policy value)
   - Formats data for UI consumption

7. **Return Policy Data (Convex → Frontend)**

   - Convex returns comprehensive policy data
   - Includes core terms, status, and extended metadata
   - May include analytics (e.g., performance metrics)

8. **UI Display (Frontend)**
   - Frontend renders policy list with rich information
   - Highlights actionable policies (e.g., eligible for exercise)
   - Provides filtering and sorting options

## 6. Error Handling and Recovery Flows

### 6.1 Transaction Failure Flow

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐
│             │         │               │         │              │
│  Frontend   │         │ Convex Backend│         │ Blockchain   │
│  (UI)       │         │ (Policy Svc)  │         │ Network      │
│             │         │               │         │              │
└──────┬──────┘         └───────┬───────┘         └──────┬───────┘
       │                        │                        │
       │ 1. User Action         │                        │
       │    (Create/Activate)   │                        │
       │ ─────────────────────► │                        │
       │                        │                        │
       │ 2. Return Transaction  │                        │
       │    for Signing         │                        │
       │ ◄─────────────────────┐│                        │
       │                        │                        │
       │ 3. User Signs and      │                        │
       │    Submits Transaction │                        │
       │ ───────────────────────────────────────────────►│
       │                        │                        │
       │ 4. Update Transaction  │                        │
       │    Status (Submitted)  │                        │
       │ ─────────────────────► │                        │
       │                        │                        │
       │                        │ 5. Schedule Transaction│
       │                        │    Status Check        │
       │                        │ ◄──────────────────────│
       │                        │                        │
       │                        │ 6. Check Transaction   │
       │                        │    Status (Failed)     │
       │                        │ ─────────────────────► │
       │                        │                        │
       │                        │ 7. Return Error Details│
       │                        │ ◄─────────────────────┐│
       │                        │                        │
       │                        │ 8. Update Transaction  │
       │                        │    Status to Failed    │
       │                        │ ◄──────────────────────│
       │                        │                        │
       │ 9. Notify User of      │                        │
       │    Failure             │                        │
       │ ◄─────────────────────┐│                        │
       │                        │                        │
       │ 10. Display Error and  │                        │
       │     Retry Options      │                        │
       │ ◄──────────────────── │                        │
       │                        │                        │
```

#### 6.1.1 Step-by-Step Description

1-3. **Normal Transaction Flow** (as described in previous sections)

4. **Record Transaction Submission (Frontend → Convex)**

   - Frontend calls Convex to update pending transaction status
   - Provides blockchain transaction ID
   - Convex records "Submitted" status with timestamp

5. **Schedule Status Check (Convex)**

   - Convex schedules job to check transaction status
   - Typically 1-2 minutes after submission
   - Uses blockchain API to check status

6. **Status Check Execution (Convex → Blockchain)**

   - Scheduled job executes and checks transaction status
   - Detects that transaction failed
   - Retrieves error details from blockchain

7. **Error Details Return (Blockchain → Convex)**

   - Blockchain API returns transaction failure details
   - May include error code, reason, and block height

8. **Update Failed Status (Convex)**

   - Convex updates pending transaction status to "Failed"
   - Records error details and timestamp
   - Updates retry count if applicable

9. **User Notification (Convex → Frontend)**

   - If user is still in session, pushes notification
   - Otherwise, flags for notification on next login
   - Includes error details and suggested actions

10. **Error Display (Frontend)**
    - Frontend displays error message to user
    - Offers retry options if applicable
    - Provides guidance on next steps

### 6.2 State Reconciliation Flow

```
┌───────────────┐         ┌──────────────┐         ┌─────────────────┐
│               │         │              │         │                 │
│ Convex Backend│         │ Blockchain   │         │ Policy Registry │
│ (Policy Svc)  │         │ Network      │         │ Contract        │
│               │         │              │         │                 │
└───────┬───────┘         └──────┬───────┘         └────────┬────────┘
        │                        │                          │
        │ 1. Scheduled           │                          │
        │    Reconciliation Job  │                          │
        │ ◄──────────────────────│                          │
        │                        │                          │
        │ 2. Fetch Batch of      │                          │
        │    Policies from DB    │                          │
        │ ◄──────────────────────│                          │
        │                        │                          │
        │ 3. Query On-Chain State│                          │
        │    for Each Policy     │                          │
        │ ───────────────────────────────────────────────────►
        │                        │                          │
        │                        │ 4. Return Current        │
        │                        │    On-Chain State        │
        │                        │ ◄─────────────────────────
        │                        │                          │
        │ 5. Compare Off-Chain vs│                          │
        │    On-Chain State      │                          │
        │ ◄──────────────────────│                          │
        │                        │                          │
        │ 6. Update Off-Chain    │                          │
        │    State if Mismatch   │                          │
        │ ◄──────────────────────│                          │
        │                        │                          │
        │ 7. Log Reconciliation  │                          │
        │    Events              │                          │
        │ ◄──────────────────────│                          │
        │                        │                          │
        │ 8. Schedule Next Batch │                          │
        │ ◄──────────────────────│                          │
        │                        │                          │
```

#### 6.2.1 Step-by-Step Description

1. **Scheduled Reconciliation (Convex)**

   - Scheduled job `reconcileOnChainState` runs daily
   - Processes policies in batches to manage load

2. **Fetch Policies (Convex)**

   - Convex fetches a batch of policies from database
   - Prioritizes older records or those flagged for verification
   - Typically 100-200 policies per batch

3. **Query On-Chain State (Convex → Policy Registry)**

   - For each policy in batch, queries on-chain state
   - Uses read-only contract functions
   - Batches requests to minimize RPC calls

4. **Return On-Chain State (Policy Registry → Convex)**

   - Contract returns current state for each policy
   - Includes status, ownership, and core terms

5. **State Comparison (Convex)**

   - Compares off-chain state with on-chain state
   - Identifies discrepancies in status, ownership, or terms
   - Prioritizes critical fields (e.g., status)

6. **State Update (Convex)**

   - For each mismatch, updates off-chain record
   - Uses on-chain state as source of truth
   - Preserves extended metadata not on-chain

7. **Log Reconciliation (Convex)**

   - Records reconciliation events in policy history
   - Logs statistics about mismatches found
   - Flags severe discrepancies for review

8. **Schedule Next Batch (Convex)**
   - Schedules processing of next batch
   - Continues until all policies are checked
   - Repeats full process on regular schedule

## 7. Conclusion

These component interaction flows illustrate the coordinated operation of the BitHedge platform during key policy lifecycle events. By clearly defining the responsibilities and interactions between components, the architecture ensures:

1. **Data Consistency**: On-chain and off-chain state remain synchronized through event processing and reconciliation
2. **Error Resilience**: Robust handling of transaction failures and state inconsistencies
3. **Clear Boundaries**: Well-defined interfaces between frontend, Convex, and blockchain components
4. **Operational Transparency**: Comprehensive tracking of all lifecycle events
5. **System Cohesion**: Components work together while maintaining separation of concerns

The combination of user-initiated flows (creation, activation) and automated flows (expiration, reconciliation) provides a complete system that balances user control with operational efficiency in line with the "On-Chain Light" architectural approach.
