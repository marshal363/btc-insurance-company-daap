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
       │                        │  2. Check Provider     │
       │                        │     Balance            │                          │
       │                        │                        │                          │
       │                        │  3. Calculate Available│                          │
       │                        │     Withdrawable Amount│                          │
       │                        │                        │                          │
       │                        │  4. Include Premium    │                          │
       │                        │     Balances in Total  │                          │
       │                        │                        │                          │
       │                        │  5. Prepare Withdrawal │                          │
       │                        │     Transaction        │                          │
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
       │                        │                        │  9. Check Available      │
       │                        │                        │     (Unlocked) Balance   │
       │                        │                        │ ◄─────────────────────────
       │                        │                        │                          │
       │                        │                        │ 10. Include Premium      │
       │                        │                        │     Balances in Withdrawal│
       │                        │                        │ ◄─────────────────────────
       │                        │                        │                          │
       │                        │                        │ 11. Process Withdrawal   │
       │                        │                        │     (Transfer Token)     │
       │                        │                        │ ◄─────────────────────────
       │                        │                        │                          │
       │                        │                        │ 12. Update On-Chain State│
       │                        │                        │     (Total & Premium     │
       │                        │                        │      Balances)           │
       │                        │                        │ ◄─────────────────────────
       │                        │                        │                          │
       │                        │                        │ 13. Event Emitted        │
       │                        │                        │ ◄─────────────────────────
       │                        │                        │                          │
       │                        │ 14. Process Event      │                          │
       │                        │ ◄──────────────────────│                          │
       │                        │                        │                          │
       │                        │ 15. Update Off-Chain   │                          │
       │                        │     Provider Records   │                          │
       │                        │     & Premium Balances │                          │
       │                        │                        │                          │
       │ 16. Confirmation       │                        │                          │
       │ ◄─────────────────────┐│                        │                          │
       │                        │                        │                          │
       │ 17. Update UI with     │                        │                          │
       │     Premium Details    │                        │                          │
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
   - Includes both capital balance and premium balance

3. **Withdrawable Amount Calculation (Convex)**

   - Calculates provider's withdrawable amount considering:
     - Current balance
     - Amount backing active policies (locked)
     - Withdrawal restrictions (time locks, etc.)

4. **Premium Balance Inclusion (Convex)**

   - Includes accumulated premium earnings in withdrawable amount
   - Identifies premiums from expired policies
   - Adds premium balances to total withdrawable amount
   - Offers option to withdraw premiums along with capital

5. **Transaction Preparation (Convex)**

   - Convex builds transaction to call appropriate withdrawal function
   - Creates pending transaction record in database
   - Includes premium withdrawal flag if applicable

6. **Return Transaction Details (Convex → Frontend)**

   - Convex returns transaction details and pending transaction ID
   - Includes breakdown of capital vs. premium amount in withdrawal
   - Frontend displays confirmation dialog with details

7. **User Signs and Submits (Frontend → Blockchain)**

   - User reviews and approves the transaction
   - Frontend uses Stacks wallet to sign the transaction
   - Signed transaction is submitted to Stacks blockchain

8. **Transaction Processing (Blockchain → Contract)**

   - Blockchain processes the transaction
   - Liquidity Pool Vault contract function is called (withdraw-stx or withdraw-sbtc)

9. **Available Balance Check (Contract)**

   - Contract checks if there is sufficient unlocked balance
   - Calculates: Total Balance - Locked Collateral

10. **Premium Balance Inclusion (Contract)**

    - Contract checks if premium withdrawal was requested
    - Includes appropriate premium balance in withdrawal amount
    - Ensures provider is authorized to withdraw specific premiums

11. **Token Transfer (Contract)**

- Contract transfers tokens to user
- For STX: Using stx-transfer?
- For sBTC: Using SIP-010 transfer function
- Combined capital and premium amount transferred in single transaction

12. **On-Chain State Update (Contract)**

    - Contract updates total balance for the token type
    - Updates accounting of available balance
    - Updates premium balance tracking if applicable

13. **Event Emission (Contract → Blockchain)**

    - Contract emits "funds-withdrawn" event
    - Includes withdrawer address, amount, and token type
    - Includes premium amount details if applicable

14. **Event Processing (Blockchain → Convex)**

    - Convex monitors blockchain for relevant events
    - Detects "funds-withdrawn" event
    - Extracts withdrawal details from event data

15. **Off-Chain State Update (Convex)**

    - Convex updates pending transaction status to "Confirmed"
    - Updates provider's balance record
    - Updates provider's premium balance record if applicable
    - Recalculates pool capacity and risk metrics

16. **Confirmation (Convex → Frontend)**

    - Convex notifies frontend of successful withdrawal
    - Includes updated provider balance and pool metrics
    - Shows breakdown of capital vs. premium in withdrawal

17. **UI Update (Frontend)**
    - Frontend updates display to show new provider balance
    - Shows updated premium earnings balance
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
        │                       │                      │                      │ 5. Identify Provider  │
        │                       │                      │                      │    Allocations        │
        │                       │                      │                      │                       │
        │                       │                      │                      │ 6. Update Balances    │
        │                       │                      │                      │    (Total & Locked)   │
        │                       │                      │                      │                       │
        │                       │                      │                      │ 7. Record Provider    │
        │                       │                      │                      │    Settlement Impact  │
        │                       │                      │                      │                       │
        │                       │                      │                      │ 8. Transfer Settlement│
        │                       │                      │                      │    Amount             │
        │                       │                      │                      │ ──────────────────────►
        │                       │                      │                      │                       │
        │                       │                      │                      │ 9. Emit Events with   │
        │                       │                      │                      │    Provider Details   │
        │                       │                      │ ◄─────────────────── │                       │
        │                       │                      │                      │                       │
        │ 10. Process Events    │                      │                      │                       │
        │ ◄─────────────────────────────────────────── │                      │                       │
        │                       │                      │                      │                       │
       │ 11. Update Off-Chain  │                      │                      │                       │
        │    Provider Records   │                      │                      │                       │
        │                       │                      │                      │                       │
       │ 12. Track Settlement  │                      │                      │                       │
       │     by Provider       │                      │                      │                       │
       │                       │                      │                      │                       │
       │ 13. Calculate Impact  │                      │                      │                       │
       │     on Yield          │                      │                      │                       │
        │                       │                      │                      │                       │
```

### 4.2 Step-by-Step Description

1. **Policy Activation (Convex → Policy Registry)**

   - User activates a policy (as described in Policy Registry flows)
   - Policy Registry contract receives activation request

2. **Policy Status Update (Policy Registry → Blockchain)**

   - Policy Registry updates policy status to "Exercised"
   - Calculates settlement amount based on policy terms
   - Records policy's position type (LONG_PUT/SHORT_PUT)

3. **Settlement Request (Policy Registry → Liquidity Pool)**

   - Policy Registry calls Liquidity Pool Vault's `pay-settlement` function
   - Provides settlement amount, recipient, position type, and policy reference

4. **Authorization Verification (Liquidity Pool)**

   - Vault contract verifies the caller is the authorized Policy Registry
   - Checks if settlement amount is valid and within constraints

5. **Provider Allocation Identification (Liquidity Pool)**

   - Identifies which providers contributed to the policy's collateral
   - Determines each provider's allocation percentage
   - Records provider-specific settlement impact

6. **Balance Update (Liquidity Pool)**

   - Updates total token balance (reducing it by settlement amount)
   - Updates locked collateral amount (reducing it by settlement amount)
   - Maintains association between policy and affected providers

7. **Provider Settlement Recording (Liquidity Pool)**

   - Records settlement impact on specific providers
   - Updates provider-specific settlement tracking
   - Maintains historical record of settlements affecting each provider

8. **Settlement Transfer (Liquidity Pool → User Wallet)**

   - Transfers settlement amount to policy owner's wallet
   - For STX: Using stx-transfer?
   - For sBTC: Using SIP-010 transfer function

9. **Event Emission (Liquidity Pool → Blockchain)**

   - Emits "settlement-paid" event with provider allocation details
   - Includes policy ID, recipient, amount, token type, and provider impact
   - Emits "provider-settlement-impact" events for each affected provider

10. **Event Processing (Blockchain → Convex)**

- Convex monitors blockchain for relevant events
- Detects "settlement-paid" and "provider-settlement-impact" events
  - Extracts settlement details from event data

11. **Provider Records Update (Convex)**

- Updates affected providers' balance records
- Records settlement impact for each provider
  - Updates collateral allocation and availability

12. **Settlement Tracking (Convex)**

    - Records detailed settlement history by provider
    - Links settlement to specific policies
    - Maintains settlement impact attribution to specific providers

13. **Yield Distribution Calculation (Convex)**
    - Calculates impact on yield for all affected providers
    - Updates yield metrics and distribution records
    - Prepares settlement impact data for provider dashboards

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
       │                        │ 5. Query Premium       │
       │                        │    Distribution Records│
       │                        │                        │
       │                        │ 6. Calculate Yield     │
       │                        │    Attribution         │
       │                        │                        │
       │                        │ 7. (Optional) Verify   │
       │                        │    On-Chain Totals     │
       │                        │ ─────────────────────► │
       │                        │                        │
       │                        │ 8. Return On-Chain     │
       │                        │    State               │
       │                        │ ◄─────────────────────┐│
       │                        │                        │
       │                        │ 9. Assemble Provider   │
       │                        │    Dashboard Data      │
       │                        │                        │
       │ 10. Return Dashboard   │                        │
       │    Data with Premium   │                        │
       │    Distribution        │                        │
       │ ◄─────────────────────┐│                        │
       │                        │                        │
       │ 11. Display Provider   │                        │
       │    Dashboard with      │                        │
       │    Income Breakdown    │                        │
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
   - Retrieves position information (SHORT_PUT positions)

4. **Metrics Calculation (Convex)**

   - Calculates current yields, APY, and earnings
   - Determines collateral utilization and risk exposure
   - Computes available withdrawal amount

5. **Premium Distribution Records Query (Convex)**

   - Queries premium distribution records for the provider
   - Retrieves historical premium payments by policy
   - Gets pending premium distributions for expired policies
   - Calculates total premium income across all positions

6. **Yield Attribution Calculation (Convex)**

   - Calculates yield attribution by policy
   - Computes premium yield separate from capital gains/losses
   - Determines percentage of earnings from premium vs. other sources
   - Prepares premium earnings history for time-series display

7. **Optional On-Chain Verification (Convex → Liquidity Pool)**

   - For reconciliation, Convex may verify on-chain total balances
   - Calls read-only functions to get current pool state
   - Verifies premium distribution status

8. **On-Chain State Return (Liquidity Pool → Convex)**

   - Contract returns current total and locked balances
   - Returns premium distribution information
   - Provides data for pool-wide metrics

9. **Dashboard Data Assembly (Convex)**

   - Combines provider-specific data with pool-wide metrics
   - Integrates premium distribution data with overall yield information
   - Formats data for UI consumption with income breakdown
   - Includes actionable insights and recommendations

10. **Return Dashboard Data (Convex → Frontend)**

- Convex returns comprehensive dashboard data
- Includes balances, yields, allocation, and analytics
- Includes premium distribution breakdown and history
- Provides premium collection opportunities for expired policies

11. **UI Display (Frontend)**

- Frontend renders provider dashboard
- Shows balance breakdown, yield metrics, and pool statistics
- Displays premium income section with history and projections
- Shows income breakdown by source (premium vs. other)
- Highlights available premium collection actions
  - Provides deposit/withdrawal controls

## 6. Premium Distribution Flow

### 6.1 Flow Diagram

```
┌─────────────┐      ┌───────────────┐      ┌─────────────────┐      ┌────────────────┐      ┌─────────────────┐
│             │      │               │      │                 │      │                │      │                 │
│  Frontend   │      │ Convex Backend│      │ Policy Registry │      │ Liquidity Pool │      │ Liquidity       │
│  (UI)       │      │ (Liquidity Svc)│     │ Contract        │      │ Vault Contract │      │ Providers       │
│             │      │               │      │                 │      │                │      │                 │
└──────┬──────┘      └───────┬───────┘      └────────┬────────┘      └───────┬────────┘      └────────┬────────┘
       │                     │                       │                       │                        │
       │                     │                       │                       │                        │
       │ 1. Request Premium  │                       │                       │                        │
       │    Distribution View│                       │                       │                        │
       │ ────────────────────►                       │                       │                        │
       │                     │                       │                       │                        │
       │                     │ 2. Authenticate User  │                       │                        │
       │                     │                       │                       │                        │
       │                     │ 3. Identify Eligible  │                       │                        │
       │                     │    Expired Policies   │                       │                        │
       │                     │                       │                       │                        │
       │                     │ 4. Query Premium      │                       │                        │
       │                     │    Distribution Status│                       │                        │
       │                     │ ────────────────────────────────────────────► │                        │
       │                     │                       │                       │                        │
       │                     │                       │                       │ 5. Return Premium      │
       │                     │                       │                       │    Distribution Data   │
       │                     │                       │                       │ ◄────────────────────── │
       │                     │                       │                       │                        │
       │                     │ 6. Assemble Premium   │                       │                        │
       │                     │    Distribution Data  │                       │                        │
       │                     │                       │                       │                        │
       │ 7. Return Premium   │                       │                       │                        │
       │    Distribution View│                       │                       │                        │
       │ ◄────────────────────                       │                       │                        │
       │                     │                       │                       │                        │
       │ 8. Display Premium  │                       │                       │                        │
       │    Distribution UI  │                       │                       │                        │
       │                     │                       │                       │                        │
       │ 9. User Requests    │                       │                       │                        │
       │    Premium Collection│                      │                       │                        │
       │ ────────────────────►                       │                       │                        │
       │                     │                       │                       │                        │
       │                     │ 10. Prepare Premium   │                       │                        │
       │                     │     Collection Tx     │                       │                        │
       │                     │                       │                       │                        │
       │ 11. Return Transaction                      │                       │                        │
       │    for Signing      │                       │                       │                        │
       │ ◄────────────────────                       │                       │                        │
       │                     │                       │                       │                        │
       │ 12. User Signs and  │                       │                       │                        │
       │     Submits Tx      │                       │                       │                        │
       │ ──────────────────────────────────────────────────────────────────► │                        │
       │                     │                       │                       │                        │
       │                     │                       │                       │ 13. Process Premium    │
       │                     │                       │                       │     Distribution       │
       │                     │                       │                       │                        │
       │                     │                       │                       │ 14. Update Provider    │
       │                     │                       │                       │     Premium Balances   │
       │                     │                       │                       │                        │
       │                     │                       │                       │ 15. Emit Distribution  │
       │                     │                       │                       │     Events             │
       │                     │                       │                       │ ◄────────────────────── │
       │                     │                       │                       │                        │
       │                     │ 16. Process Events    │                       │                        │
       │                     │ ◄───────────────────────────────────────────── │                        │
       │                     │                       │                       │                        │
       │                     │ 17. Update Provider   │                       │                        │
       │                     │     Premium Records   │                       │                        │
       │                     │                       │                       │                        │
       │ 18. Confirm Premium │                       │                       │                        │
       │     Distribution    │                       │                       │                        │
       │ ◄────────────────────                       │                       │                        │
       │                     │                       │                       │                        │
       │ 19. Provider Premium│                       │                       │                        │
       │     Dashboard Update│                       │                       │                        │
       │                     │                       │                       │                        │
```

### 6.2 Step-by-Step Description

1. **Provider Requests Premium View (Frontend → Convex)**

   - Provider navigates to Income dashboard
   - Frontend calls Convex query for premium distribution status
   - Request includes provider principal

2. **User Authentication (Convex)**

   - Convex verifies provider is authenticated
   - Extracts provider principal from authentication context

3. **Eligible Policies Identification (Convex)**

   - Convex identifies expired policies where:
     - Provider has contributed collateral
     - Premium has not yet been distributed
     - Policy status is "Expired"

4. **Premium Distribution Status Query (Convex → Liquidity Pool)**

   - Convex queries Liquidity Pool for premium distribution status
   - Checks which premiums are available for distribution
   - Retrieves provider-specific premium allocation

5. **Premium Data Return (Liquidity Pool → Convex)**

   - Returns information about available premiums
   - Includes policy-specific premium amounts
   - Includes provider-specific allocation percentages

6. **Premium Data Assembly (Convex)**

   - Combines premium information with policy details
   - Calculates total premium earnings
   - Prepares data for display in provider dashboard

7. **Return Premium View (Convex → Frontend)**

   - Convex returns premium distribution data
   - Includes actionable policies for premium collection
   - Includes historical premium earnings

8. **Display Premium UI (Frontend)**

   - Frontend displays premium distribution dashboard
   - Shows available premiums by policy
   - Provides "Collect Premium" action for eligible policies

9. **Provider Requests Premium Collection (Frontend → Convex)**

   - Provider selects policies for premium collection
   - Frontend calls Convex action `requestPremiumCollection`
   - Request includes policy IDs and provider principal

10. **Transaction Preparation (Convex)**

    - Convex builds transaction to call premium distribution function
    - Creates pending transaction record in database
    - Prepares transaction for provider signature

11. **Return Transaction Details (Convex → Frontend)**

    - Convex returns transaction details and pending transaction ID
    - Includes total premium amount to be collected
    - Frontend displays confirmation dialog with details

12. **Provider Signs and Submits (Frontend → Blockchain)**

    - Provider reviews and approves the transaction
    - Frontend uses Stacks wallet to sign the transaction
    - Signed transaction is submitted to Stacks blockchain

13. **Premium Distribution Processing (Liquidity Pool)**

    - Contract verifies the caller is authorized provider
    - Processes premium distribution for specified policies
    - Updates premium distribution tracking

14. **Provider Balance Update (Liquidity Pool)**

    - Updates provider-specific premium balances
    - Records premium distribution by policy
    - Maintains historical record of distributions

15. **Event Emission (Liquidity Pool → Blockchain)**

    - Contract emits "premium-distributed" events
    - Includes provider principal, premium amounts, and policy references
    - Blockchain records events in transaction receipt

16. **Event Processing (Blockchain → Convex)**

    - Convex monitors blockchain for relevant events
    - Detects "premium-distributed" events
    - Extracts premium distribution details from event data

17. **Provider Records Update (Convex)**

    - Updates pending transaction status to "Confirmed"
    - Updates provider's premium earnings record
    - Updates policy premium distribution status
    - Records events in provider history
    - Updates yield metrics and statistics

18. **Confirmation (Convex → Frontend)**

    - Convex notifies frontend of successful premium collection
    - Includes updated premium balances and metrics

19. **Dashboard Update (Frontend)**
    - Frontend updates premium dashboard display
    - Shows updated premium earnings history
    - Updates yield metrics and statistics
    - Shows success notification to provider

## 7. Error Handling and Recovery Flows

### 7.1 Transaction Failure Flow

Similar to the transaction failure flow described in the Policy Registry documentation, the Liquidity Pool implements robust error handling for deposit and withdrawal transactions:

1. Frontend submits transaction to blockchain
2. Convex records transaction status as "Submitted"
3. Scheduled job checks transaction status
4. If transaction fails, error details are recorded
5. Provider is notified of failure with specific error details
6. UI displays appropriate error message and recovery options

### 7.2 Pool State Reconciliation

To ensure consistency between off-chain provider records and on-chain state:

1. Scheduled job runs to verify total balances match sum of provider balances
2. Any discrepancies trigger alerts for manual review
3. Reconciliation process updates off-chain records if needed
4. Event log maintains audit trail of all reconciliation activities

## 8. Conclusion

These component interaction flows illustrate how the Liquidity Pool operates within the BitHedge hybrid architecture:

1. **On-Chain Security**: Funds always reside in the blockchain-secured Vault contract
2. **Off-Chain Flexibility**: Complex provider tracking and risk management handled in Convex
3. **Clear Responsibilities**: Each component has well-defined roles and interfaces
4. **Event-Driven Synchronization**: On-chain events drive off-chain state updates
5. **User Experience**: Rich provider analytics without blockchain constraints

The combination of secure on-chain custody with flexible off-chain management provides an optimal balance of security, usability, and efficiency for liquidity providers.
