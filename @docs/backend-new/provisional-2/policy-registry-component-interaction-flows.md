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
       │                        │  4. Determine Position │                          │
       │                        │    Type and Counterparty                          │
       │                        │ ◄──────────────────────│                          │
       │                        │                        │                          │
       │                        │  5. Check Pool Liquidity                          │
       │                        │ ◄──────────────────────│                          │
       │                        │                        │                          │
       │                        │  6. Prepare Transaction│                          │
       │                        │ ◄──────────────────────│                          │
       │                        │                        │                          │
       │  7. Return Transaction │                        │                          │
       │     for Signing        │                        │                          │
       │ ◄─────────────────────┐│                        │                          │
       │                        │                        │                          │
       │  8. User Signs and     │                        │                          │
       │     Submits Transaction│                        │                          │
       │ ───────────────────────────────────────────────►│                          │
       │                        │                        │                          │
       │                        │                        │  9. Execute Contract Call│
       │                        │                        │ ─────────────────────────►
       │                        │                        │                          │
       │                        │                        │  10. Premium Payment +   │
       │                        │                        │     Policy Creation +    │
       │                        │                        │     Position Assignment  │
       │                        │                        │ ◄─────────────────────────
       │                        │                        │                          │
       │                        │                        │  11. Events Emitted      │
       │                        │                        │ ◄─────────────────────────
       │                        │                        │                          │
       │                        │  12. Process Events    │                          │
       │                        │ ◄──────────────────────│                          │
       │                        │                        │                          │
       │                        │  13. Update Off-Chain  │                          │
       │                        │      State with Position│                         │
       │                        │      and Counterparty  │                          │
       │                        │ ◄──────────────────────│                          │
       │                        │                        │                          │
       │  14. Confirmation      │                        │                          │
       │ ◄─────────────────────┐│                        │                          │
       │                        │                        │                          │
       │  15. Update UI         │                        │                          │
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

4. **Position Type and Counterparty Determination (Convex)**

   - Assigns position type based on policy type and user role:
     - User buying protection: "LONG_PUT" for PUT options
     - Liquidity pool selling protection: "SHORT_PUT" for PUT options
   - Records counterparty information (typically liquidity pool address for buyer policies)
   - Determines collateral token and settlement asset based on position type

5. **Liquidity Verification (Convex → Liquidity Pool Service)**

   - Convex checks if the Liquidity Pool has sufficient collateral
   - Verifies if risk tiers can accommodate the new policy
   - Confirms capacity for the requested policy terms

6. **Transaction Preparation (Convex)**

   - Convex converts parameters to on-chain format (e.g., USD to satoshis)
   - Builds transaction to call Policy Registry contract
   - Includes position type and counterparty information
   - Creates pending transaction record in Convex database

7. **Return Transaction Details (Convex → Frontend)**

   - Convex returns transaction details and pending transaction ID
   - Includes premium amount and estimated gas
   - Frontend displays confirmation dialog with details

8. **User Signs and Submits (Frontend → Blockchain)**

   - User reviews and approves the transaction
   - Frontend uses Stacks wallet to sign the transaction
   - Signed transaction is submitted to Stacks blockchain

9. **Transaction Processing (Blockchain → Contract)**

   - Blockchain processes the transaction
   - Policy Registry contract function is called with policy parameters

10. **On-Chain Processing (Policy Registry Contract)**

    - Contract validates parameters
    - Creates new policy entry with unique ID
    - Assigns position type (LONG_PUT/SHORT_PUT)
    - Records counterparty information
    - Sets status to "Active"
    - Updates policy ownership and counterparty indices

11. **Event Emission (Contract → Blockchain)**

    - Contract emits "policy-created" event
    - Event includes policy ID, position type, counterparty, and core parameters
    - Blockchain records events in transaction receipt

12. **Event Processing (Blockchain → Convex)**

    - Convex monitors blockchain for relevant events
    - Detects "policy-created" event
    - Extracts policy details from event data

13. **Off-Chain State Update (Convex)**

    - Convex updates pending transaction status to "Confirmed"
    - Creates comprehensive policy record with extended metadata
    - Records position type and counterparty information
    - Updates indices for efficient querying (by owner, by counterparty)
    - Records policy creation event in history
    - Flags premium as not yet distributed for future tracking

14. **Confirmation (Convex → Frontend)**

    - Convex notifies frontend of successful policy creation
    - Includes policy ID, position type, and core details

15. **UI Update (Frontend)**
    - Frontend updates display to show policy status
    - Shows position type (LONG_PUT/SHORT_PUT) appropriate to user role
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
        │ ───────────────────────────────────────────────────►                         │
        │                        │                          │
        │                        │                          │
        │                        │ 4. Execute Contract Call │
        │                        │ ─────────────────────────►                          │
        │                        │                          │
        │                        │ 5. Expire Policies in    │
        │                        │    Batch                 │
        │                        │ ◄─────────────────────────                          │
        │                        │                          │
        │                        │ 6. Notify Liquidity Pool │
        │                        │    for each Policy       │
        │                        │ ─────────────────────────────────────────────────────►
        │                        │                          │
        │                        │                          │ 7. Release Collateral    │
        │                        │                          │    for Expired Policies  │
        │                        │                          │
        │                        │                          │ ◄─────────────────────────
        │                        │                          │
        │                        │                          │ 8. Process Premium       │
        │                        │                          │    Distribution          │
        │                        │                          │ ─────────────────────────►
        │                        │                          │
        │                        │                          │ 9. Distribute Premium to │
        │                        │                          │    Providers             │
        │                        │                          │ ◄─────────────────────────
        │                        │                          │
        │                        │ 10. Events Emitted       │
        │                        │ ◄─────────────────────────                          │
        │                        │                          │
        │                        │ 11. Events Emitted       │
        │                        │ ◄─────────────────────────────────────────────────────
        │                        │                          │
        │ 12. Process Events     │                          │
        │ ◄──────────────────────│                          │
        │                        │                          │
        │ 13. Update Off-Chain   │                          │
        │     State with Premium │                          │
        │     Distribution Data  │                          │
        │ ◄──────────────────────│                          │
        │                        │                          │
        │ 14. Notify Counterparty│                          │
        │     of Premium         │                          │
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
     - Marks premium as available for distribution
     - Emits "policy-status-updated" event

6. **Collateral Release Request (Policy Registry → Liquidity Pool)**

   - For each expired policy, notifies Liquidity Pool
   - Requests release of collateral

7. **Collateral Release Processing (Liquidity Pool Contract)**

   - Liquidity Pool verifies request is from Policy Registry
   - Releases collateral previously locked for the policy
   - Returns collateral to available pool capacity
   - Emits "collateral-released" event

8. **Premium Distribution Request (Policy Registry → Liquidity Pool)**

   - For each expired policy, initiates premium distribution
   - Passes premium amount, counterparty, and policy ID to Liquidity Pool

9. **Premium Distribution Processing (Liquidity Pool Contract)**

   - Records premium amount for distribution to providers
   - Updates provider-specific premium balances based on policy allocation
   - Tracks premium distribution by provider
   - Emits "premium-distributed" event

10. **Policy Registry Events (Contract → Blockchain)**

    - "policy-status-updated" events for each expired policy
    - "premium-distribution-initiated" events for each policy
    - Includes policy ID, status change details, premium amounts

11. **Liquidity Pool Events (Contract → Blockchain)**

    - "collateral-released" events for each expired policy
    - "premium-distributed" events with distribution details
    - Includes amount released, premium amounts, and policy reference

12. **Event Processing (Blockchain → Convex)**

    - Convex monitors blockchain for relevant events
    - Detects policy expiration, collateral release, and premium distribution events
    - Extracts details from event data

13. **Off-Chain State Update (Convex)**

    - Updates pending transaction status to "Confirmed"
    - Updates each policy status to "Expired"
    - Records premium distribution details
    - Updates Liquidity Pool state (released collateral, distributed premiums)
    - Updates provider records with premium earnings
    - Records events in policy history
    - Updates indices and aggregated metrics

14. **Counterparty Notification (Convex)**

    - Convex notifies policy counterparty of premium distribution
    - Updates counterparty dashboard with premium earnings
    - Prepares premium data for display in provider dashboard

15. **Confirmation (Convex → Frontend)**

    - Convex notifies frontend of successful policy expiration
    - Includes policy ID and updated policy details

16. **UI Update (Frontend)**
    - Frontend updates policy display to show "Expired" status
    - Shows expiration date and updated policy details
    - Displays success notification to user

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
       │    Policies with Filters│                         │
       │ ─────────────────────► │                          │
       │                        │                          │
       │                        │ 2. Authenticate User     │
       │                        │ ◄──────────────────────  │
       │                        │                          │
       │                        │ 3. Determine User Role   │
       │                        │    (Buyer/Counterparty)  │
       │                        │ ◄──────────────────────  │
       │                        │                          │
       │                        │ 4. Query Database with   │
       │                        │    Filters (Position Type,│
       │                        │    Status, Date Range)   │
       │                        │ ◄──────────────────────  │
       │                        │                          │
       │                        │ 5. (If needed) Verify    │
       │                        │    On-Chain State        │
       │                        │ ─────────────────────────►
       │                        │                          │
       │                        │ 6. Return Policy Data    │
       │                        │ ◄─────────────────────────
       │                        │                          │
       │                        │ 7. Apply User-Specific   │
       │                        │    View Logic (LONG/SHORT)│
       │                        │ ◄─────────────────────── │
       │                        │                          │
       │                        │ 8. Calculate Premium     │
       │                        │    Distribution Status   │
       │                        │ ◄─────────────────────── │
       │                        │                          │
       │                        │ 9. Assemble Response with│
       │                        │    Full Metadata         │
       │                        │ ◄─────────────────────── │
       │                        │                          │
       │ 10. Return Policies with│                         │
       │    Metadata & Analytics│                          │
       │ ◄─────────────────────┐│                          │
       │                        │                          │
       │ 11. Display Policies   │                          │
       │    Based on User Role  │                          │
       │ ◄──────────────────── │                          │
       │                        │                          │
```

### 5.2 Step-by-Step Description

1. **User Requests Policies (Frontend → Convex)**

   - User navigates to policy list view
   - Frontend calls Convex query `getPoliciesForUser` or `getPoliciesForCounterparty` with filters
   - Filters may include status, policy type, position type, collateral token, date range, etc.

2. **User Authentication (Convex)**

   - Convex verifies user is authenticated
   - Extracts user principal from authentication context

3. **User Role Determination (Convex)**

   - Convex determines if user is querying as policy buyer or counterparty (liquidity provider)
   - Selects appropriate query method based on role
   - For buyers: uses owner index to find policies
   - For counterparties: uses counterparty index to find policies

4. **Database Query (Convex)**

   - Convex queries off-chain database for policies matching user role
   - Applies specified filters including position type (LONG_PUT, SHORT_PUT)
   - Uses indices for efficient retrieval
   - Handles pagination if needed
   - Includes premium distribution status in query

5. **Optional On-Chain Verification (Convex → Policy Registry)**

   - For critical data or reconciliation, Convex may verify key fields
   - Calls read-only contract functions to check current status
   - This step is optional and typically only done for reconciliation

6. **On-Chain Data Return (Policy Registry → Convex)**

   - Contract returns requested policy data
   - Includes current on-chain status and essential fields

7. **User-Specific View Logic (Convex)**

   - For buyers: focuses on policy protection details, exercise eligibility
   - For counterparties: focuses on premium income, exposure, yield metrics
   - Filters interface elements based on position type (LONG_PUT vs SHORT_PUT)

8. **Premium Distribution Status Calculation (Convex)**

   - For expired policies, checks if premium has been distributed
   - For counterparties, calculates potential premium income
   - Determines if premium distribution action is available

9. **Response Assembly (Convex)**

   - Combines on-chain verified data with rich off-chain metadata
   - Calculates derived metrics (e.g., current policy value)
   - Includes position-specific data based on user role
   - Adds premium distribution status information
   - Formats data for UI consumption

10. **Return Policy Data (Convex → Frontend)**

    - Convex returns comprehensive policy data
    - Includes core terms, status, and extended metadata
    - Includes position type and counterparty information
    - Returns premium distribution status where applicable
    - May include analytics (e.g., performance metrics)

11. **UI Display (Frontend)**
    - Frontend renders policy list with rich information
    - Shows different views based on user role:
      - For buyers (LONG positions): emphasizes protection and exercise options
      - For counterparties (SHORT positions): emphasizes premium income and yield
    - Highlights actionable policies (e.g., eligible for exercise or premium distribution)
    - Provides filtering by position type, counterparty, and other criteria
    - Provides sorting options appropriate to user role

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
