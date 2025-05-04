# BitHedge Liquidity Pool: Component Interaction Flows

## 1. Introduction

This document details the interaction flows between components in the BitHedge platform related to the Liquidity Pool functionality. These flows illustrate how the frontend, Convex backend, and on-chain contracts communicate and coordinate during key processes like capital commitment, withdrawal, and settlement.

## 2. Capital Commitment Flow

### 2.1 Flow Diagram

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐         ┌─────────────────┐
│             │         │               │         │              │         │                 │
│  Frontend   │         │ Convex Backend│         │ Blockchain   │         │ Liquidity Pool  │
│  (UI)       │         │ (Liquidity Svc)│        │ Network      │         │ Vault Contract  │
│             │         │               │         │              │         │                 │
└──────┬──────┘         └───────┬───────┘         └──────┬───────┘         └────────┬────────┘
       │                        │                        │                          │
       │                        │                        │                          │
       │  1. Request Capital    │                        │                          │
       │     Commitment         │                        │                          │
       │ ─────────────────────► │                        │                          │
       │                        │                        │                          │
       │                        │  2. Validate Amount    │                          │
       │                        │     and Token Type     │                          │
       │                        │                        │                          │
       │                        │  3. Prepare Deposit    │                          │
       │                        │     Transaction        │                          │
       │                        │                        │                          │
       │  4. Return Transaction │                        │                          │
       │     for Signing        │                        │                          │
       │ ◄─────────────────────┐│                        │                          │
       │                        │                        │                          │
       │  5. User Signs and     │                        │                          │
       │     Submits Transaction│                        │                          │
       │ ───────────────────────────────────────────────►│                          │
       │                        │                        │                          │
       │                        │                        │  6. Execute Contract Call│
       │                        │                        │ ─────────────────────────►
       │                        │                        │                          │
       │                        │                        │  7. Process Deposit      │
       │                        │                        │     (Transfer Token)     │
       │                        │                        │ ◄─────────────────────────
       │                        │                        │                          │
       │                        │                        │  8. Update On-Chain State│
       │                        │                        │     (Total Balance)      │
       │                        │                        │ ◄─────────────────────────
       │                        │                        │                          │
       │                        │                        │  9. Event Emitted        │
       │                        │                        │ ◄─────────────────────────
       │                        │                        │                          │
       │                        │  10. Process Event     │                          │
       │                        │ ◄──────────────────────│                          │
       │                        │                        │                          │
       │                        │  11. Update Off-Chain  │                          │
       │                        │      Provider Records  │                          │
       │                        │                        │                          │
       │  12. Confirmation      │                        │                          │
       │ ◄─────────────────────┐│                        │                          │
       │                        │                        │                          │
       │  13. Update UI         │                        │                          │
       │                        │                        │                          │
```

### 2.2 Step-by-Step Description

1. **User Initiates Capital Commitment (Frontend → Convex)**

   - User fills commitment parameters in ProviderIncomeSummary.tsx component
   - Frontend calls Convex action `requestCapitalCommitment` with parameters
   - Parameters include: token type (STX/sBTC), amount, risk tier preference

2. **Parameter Validation (Convex)**

   - Convex validates commitment parameters against business rules
   - Checks if amount meets minimum requirement
   - Verifies token type is supported

3. **Transaction Preparation (Convex)**

   - Convex builds transaction to call appropriate deposit function
   - Creates pending transaction record in database

4. **Return Transaction Details (Convex → Frontend)**

   - Convex returns transaction details and pending transaction ID
   - Frontend displays confirmation dialog with details

5. **User Signs and Submits (Frontend → Blockchain)**

   - User reviews and approves the transaction
   - Frontend uses Stacks wallet to sign the transaction
   - Signed transaction is submitted to Stacks blockchain

6. **Transaction Processing (Blockchain → Contract)**

   - Blockchain processes the transaction
   - Liquidity Pool Vault contract function is called (deposit-stx or deposit-sbtc)

7. **Token Transfer (Contract)**

   - Contract receives token transfer from user
   - For STX: Using stx-transfer?
   - For sBTC: Using SIP-010 transfer function

8. **On-Chain State Update (Contract)**

   - Contract updates total balance for the token type
   - No individual provider accounting is done on-chain

9. **Event Emission (Contract → Blockchain)**

   - Contract emits "funds-deposited" event
   - Event includes depositor address, amount, and token type

10. **Event Processing (Blockchain → Convex)**

    - Convex monitors blockchain for relevant events
    - Detects "funds-deposited" event
    - Extracts deposit details from event data

11. **Off-Chain State Update (Convex)**

    - Convex updates pending transaction status to "Confirmed"
    - Creates or updates provider's balance record
    - Updates provider's risk tier assignment
    - Recalculates pool capacity and risk metrics

12. **Confirmation (Convex → Frontend)**

    - Convex notifies frontend of successful deposit
    - Includes updated provider balance and pool metrics

13. **UI Update (Frontend)**
    - Frontend updates display to show new provider balance
    - Updates pool statistics and capacity indicators
    - Shows success notification to user

## 3. Capital Withdrawal Flow

### 3.1 Flow Diagram

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐         ┌─────────────────┐
│             │         │               │         │              │         │                 │
│  Frontend   │         │ Convex Backend│         │ Blockchain   │         │ Liquidity Pool  │
│  (UI)       │         │ (Liquidity Svc)│        │ Network      │         │ Vault Contract  │
│             │         │               │         │              │         │                 │
└──────┬──────┘         └───────┬───────┘         └──────┬───────┘         └────────┬────────┘
       │                        │                        │                          │
       │                        │                        │                          │
       │  1. Request Capital    │                        │                          │
       │     Withdrawal         │                        │                          │
       │ ─────────────────────► │                        │                          │
       │                        │                        │                          │
       │                        │  2. Check Provider     │                          │
       │                        │     Balance            │                          │
       │                        │                        │                          │
       │                        │  3. Calculate Available│                          │
       │                        │     Withdrawable Amount│                          │
       │                        │                        │                          │
       │                        │  4. Prepare Withdrawal │                          │
       │                        │     Transaction        │                          │
       │                        │                        │                          │
       │  5. Return Transaction │                        │                          │
       │     for Signing        │                        │                          │
       │ ◄─────────────────────┐│                        │                          │
       │                        │                        │                          │
       │  6. User Signs and     │                        │                          │
       │     Submits Transaction│                        │                          │
       │ ───────────────────────────────────────────────►│                          │
       │                        │                        │                          │
       │                        │                        │  7. Execute Contract Call│
       │                        │                        │ ─────────────────────────►
       │                        │                        │                          │
       │                        │                        │  8. Check Available      │
       │                        │                        │     (Unlocked) Balance   │
       │                        │                        │ ◄─────────────────────────
       │                        │                        │                          │
       │                        │                        │  9. Process Withdrawal   │
       │                        │                        │     (Transfer Token)     │
       │                        │                        │ ◄─────────────────────────
       │                        │                        │                          │
       │                        │                        │ 10. Update On-Chain State│
       │                        │                        │     (Total Balance)      │
       │                        │                        │ ◄─────────────────────────
       │                        │                        │                          │
       │                        │                        │ 11. Event Emitted        │
       │                        │                        │ ◄─────────────────────────
       │                        │                        │                          │
       │                        │ 12. Process Event      │                          │
       │                        │ ◄──────────────────────│                          │
       │                        │                        │                          │
       │                        │ 13. Update Off-Chain   │                          │
       │                        │     Provider Records   │                          │
       │                        │                        │                          │
       │ 14. Confirmation       │                        │                          │
       │ ◄─────────────────────┐│                        │                          │
       │                        │                        │                          │
       │ 15. Update UI          │                        │                          │
       │                        │                        │                          │
```

### 3.2 Step-by-Step Description

1. **User Initiates Capital Withdrawal (Frontend → Convex)**

   - User specifies withdrawal amount in ProviderIncomeSummary.tsx
   - Frontend calls Convex action `requestCapitalWithdrawal` with parameters
   - Parameters include: token type (STX/sBTC) and amount

2. **Provider Balance Check (Convex)**

   - Convex verifies provider has sufficient balance
   - Retrieves provider's current balance record

3. **Withdrawable Amount Calculation (Convex)**

   - Calculates provider's withdrawable amount considering:
     - Current balance
     - Amount backing active policies (locked)
     - Withdrawal restrictions (time locks, etc.)

4. **Transaction Preparation (Convex)**

   - Convex builds transaction to call appropriate withdrawal function
   - Creates pending transaction record in database

5. **Return Transaction Details (Convex → Frontend)**

   - Convex returns transaction details and pending transaction ID
   - Frontend displays confirmation dialog with details

6. **User Signs and Submits (Frontend → Blockchain)**

   - User reviews and approves the transaction
   - Frontend uses Stacks wallet to sign the transaction
   - Signed transaction is submitted to Stacks blockchain

7. **Transaction Processing (Blockchain → Contract)**

   - Blockchain processes the transaction
   - Liquidity Pool Vault contract function is called (withdraw-stx or withdraw-sbtc)

8. **Available Balance Check (Contract)**

   - Contract checks if there is sufficient unlocked balance
   - Calculates: Total Balance - Locked Collateral

9. **Token Transfer (Contract)**

   - Contract transfers tokens to user
   - For STX: Using stx-transfer?
   - For sBTC: Using SIP-010 transfer function

10. **On-Chain State Update (Contract)**

    - Contract updates total balance for the token type
    - Updates accounting of available balance

11. **Event Emission (Contract → Blockchain)**

    - Contract emits "funds-withdrawn" event
    - Event includes withdrawer address, amount, and token type

12. **Event Processing (Blockchain → Convex)**

    - Convex monitors blockchain for relevant events
    - Detects "funds-withdrawn" event
    - Extracts withdrawal details from event data

13. **Off-Chain State Update (Convex)**

    - Convex updates pending transaction status to "Confirmed"
    - Updates provider's balance record
    - Recalculates pool capacity and risk metrics

14. **Confirmation (Convex → Frontend)**

    - Convex notifies frontend of successful withdrawal
    - Includes updated provider balance and pool metrics

15. **UI Update (Frontend)**
    - Frontend updates display to show new provider balance
    - Updates pool statistics and capacity indicators
    - Shows success notification to user

## 4. Settlement Flow (Automated)

### 4.1 Flow Diagram

```
┌───────────────┐      ┌─────────────────┐      ┌──────────────┐      ┌────────────────┐      ┌─────────────────┐
│               │      │                 │      │              │      │                │      │                 │
│ Convex Backend│      │ Policy Registry │      │ Blockchain   │      │ Liquidity Pool │      │ Policy Owner    │
│ (Policy Svc)  │      │ Contract        │      │ Network      │      │ Vault Contract │      │ (User Wallet)   │
│               │      │                 │      │              │      │                │      │                 │
└───────┬───────┘      └────────┬────────┘      └──────┬───────┘      └───────┬────────┘      └────────┬────────┘
        │                       │                      │                      │                       │
        │ 1. User Activates     │                      │                      │                       │
        │    Policy             │                      │                      │                       │
        │ ──────────────────────►                      │                      │                       │
        │                       │                      │                      │                       │
        │                       │ 2. Update Policy     │                      │                       │
        │                       │    Status            │                      │                       │
        │                       │ ─────────────────────►                      │                       │
        │                       │                      │                      │                       │
        │                       │ 3. Request Settlement│                      │                       │
        │                       │ ──────────────────────────────────────────► │                       │
        │                       │                      │                      │                       │
        │                       │                      │                      │ 4. Verify Request     │
        │                       │                      │                      │    Authorization      │
        │                       │                      │                      │                       │
        │                       │                      │                      │ 5. Update Balances    │
        │                       │                      │                      │    (Total & Locked)   │
        │                       │                      │                      │                       │
        │                       │                      │                      │ 6. Transfer Settlement│
        │                       │                      │                      │    Amount             │
        │                       │                      │                      │ ──────────────────────►
        │                       │                      │                      │                       │
        │                       │                      │                      │ 7. Emit Events        │
        │                       │                      │ ◄─────────────────── │                       │
        │                       │                      │                      │                       │
        │ 8. Process Events     │                      │                      │                       │
        │ ◄─────────────────────────────────────────── │                      │                       │
        │                       │                      │                      │                       │
        │ 9. Update Off-Chain   │                      │                      │                       │
        │    Provider Records   │                      │                      │                       │
        │                       │                      │                      │                       │
        │10. Calculate Yield    │                      │                      │                       │
        │    Distribution       │                      │                      │                       │
        │                       │                      │                      │                       │
```

### 4.2 Step-by-Step Description

1. **Policy Activation (Convex → Policy Registry)**

   - User activates a policy (as described in Policy Registry flows)
   - Policy Registry contract receives activation request

2. **Policy Status Update (Policy Registry → Blockchain)**

   - Policy Registry updates policy status to "Exercised"
   - Calculates settlement amount based on policy terms

3. **Settlement Request (Policy Registry → Liquidity Pool)**

   - Policy Registry calls Liquidity Pool Vault's `pay-settlement` function
   - Provides settlement amount, recipient, and policy reference

4. **Authorization Verification (Liquidity Pool)**

   - Vault contract verifies the caller is the authorized Policy Registry
   - Checks if settlement amount is valid and within constraints

5. **Balance Update (Liquidity Pool)**

   - Updates total token balance (reducing it by settlement amount)
   - Updates locked collateral amount (reducing it by settlement amount)

6. **Settlement Transfer (Liquidity Pool → User Wallet)**

   - Transfers settlement amount to policy owner's wallet
   - For STX: Using stx-transfer?
   - For sBTC: Using SIP-010 transfer function

7. **Event Emission (Liquidity Pool → Blockchain)**

   - Emits "settlement-paid" event
   - Includes policy ID, recipient, amount, and token type

8. **Event Processing (Blockchain → Convex)**

   - Convex monitors blockchain for relevant events
   - Detects "settlement-paid" event
   - Extracts settlement details from event data

9. **Provider Records Update (Convex)**

   - Updates affected providers' balance records
   - Distributes settlement impact across providers based on risk allocation
   - Updates collateral allocation and availability

10. **Yield Distribution Calculation (Convex)**
    - Calculates impact on yield for all providers
    - Updates yield metrics and distribution records
    - Prepares data for provider analytics in UI

## 5. Off-Chain Provider Management Flow

### 5.1 Flow Diagram

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐
│             │         │               │         │              │
│  Frontend   │         │ Convex Backend│         │ Liquidity Pool│
│  (UI)       │         │ (Liquidity Svc)│        │ Vault Contract│
│             │         │               │         │ (Read-Only)   │
│             │         │               │         │              │
└──────┬──────┘         └───────┬───────┘         └──────┬───────┘
       │                        │                        │
       │ 1. Request Provider    │                        │
       │    Dashboard           │                        │
       │ ─────────────────────► │                        │
       │                        │                        │
       │                        │ 2. Authenticate User   │
       │                        │                        │
       │                        │ 3. Query Provider      │
       │                        │    Records             │
       │                        │                        │
       │                        │ 4. Calculate Provider  │
       │                        │    Metrics             │
       │                        │                        │
       │                        │ 5. (Optional) Verify   │
       │                        │    On-Chain Totals     │
       │                        │ ─────────────────────► │
       │                        │                        │
       │                        │ 6. Return On-Chain     │
       │                        │    State               │
       │                        │ ◄─────────────────────┐│
       │                        │                        │
       │                        │ 7. Assemble Provider   │
       │                        │    Dashboard Data      │
       │                        │                        │
       │ 8. Return Dashboard    │                        │
       │    Data                │                        │
       │ ◄─────────────────────┐│                        │
       │                        │                        │
       │ 9. Display Provider    │                        │
       │    Dashboard           │                        │
       │                        │                        │
```

### 5.2 Step-by-Step Description

1. **User Requests Dashboard (Frontend → Convex)**

   - User navigates to provider dashboard view
   - Frontend calls Convex query `getProviderDashboard`

2. **User Authentication (Convex)**

   - Convex verifies user is authenticated
   - Extracts provider principal from authentication context

3. **Provider Records Query (Convex)**

   - Queries provider's balance records across all tokens
   - Retrieves yield history and allocation records
   - Gets provider's risk tier assignment

4. **Metrics Calculation (Convex)**

   - Calculates current yields, APY, and earnings
   - Determines collateral utilization and risk exposure
   - Computes available withdrawal amount

5. **Optional On-Chain Verification (Convex → Liquidity Pool)**

   - For reconciliation, Convex may verify on-chain total balances
   - Calls read-only functions to get current pool state

6. **On-Chain State Return (Liquidity Pool → Convex)**

   - Contract returns current total and locked balances
   - Provides data for pool-wide metrics

7. **Dashboard Data Assembly (Convex)**

   - Combines provider-specific data with pool-wide metrics
   - Formats data for UI consumption
   - Includes actionable insights and recommendations

8. **Return Dashboard Data (Convex → Frontend)**

   - Convex returns comprehensive dashboard data
   - Includes balances, yields, allocation, and analytics

9. **UI Display (Frontend)**
   - Frontend renders provider dashboard
   - Shows balance breakdown, yield metrics, and pool statistics
   - Provides deposit/withdrawal controls

## 6. Error Handling and Recovery Flows

### 6.1 Transaction Failure Flow

Similar to the transaction failure flow described in the Policy Registry documentation, the Liquidity Pool implements robust error handling for deposit and withdrawal transactions:

1. Frontend submits transaction to blockchain
2. Convex records transaction status as "Submitted"
3. Scheduled job checks transaction status
4. If transaction fails, error details are recorded
5. Provider is notified of failure with specific error details
6. UI displays appropriate error message and recovery options

### 6.2 Pool State Reconciliation

To ensure consistency between off-chain provider records and on-chain state:

1. Scheduled job runs to verify total balances match sum of provider balances
2. Any discrepancies trigger alerts for manual review
3. Reconciliation process updates off-chain records if needed
4. Event log maintains audit trail of all reconciliation activities

## 7. Conclusion

These component interaction flows illustrate how the Liquidity Pool operates within the BitHedge hybrid architecture:

1. **On-Chain Security**: Funds always reside in the blockchain-secured Vault contract
2. **Off-Chain Flexibility**: Complex provider tracking and risk management handled in Convex
3. **Clear Responsibilities**: Each component has well-defined roles and interfaces
4. **Event-Driven Synchronization**: On-chain events drive off-chain state updates
5. **User Experience**: Rich provider analytics without blockchain constraints

The combination of secure on-chain custody with flexible off-chain management provides an optimal balance of security, usability, and efficiency for liquidity providers.
