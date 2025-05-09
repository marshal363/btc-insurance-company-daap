# BitHedge Policy Creation: Component Interaction Flows

## 1. Introduction

This document details the interaction flows between components in the BitHedge platform during the policy creation process. These flows illustrate how policy parameters, premium calculations, and blockchain transactions work together to create insurance policies for both buyer and seller personas.

The policy creation process is a critical component of the BitHedge platform, providing the foundation for:

- Creating binding insurance agreements between parties
- Calculating fair premiums based on current market conditions
- Recording policies on-chain for transparent verification
- Managing capital commitments for liquidity providers
- Establishing clear position types (LONG_PUT vs SHORT_PUT) for all participants

This document should be read in conjunction with the Oracle Component Interaction Flows and Premium Calculation Component Interaction Flows documents, as the policy creation system relies heavily on these components.

## 2. Policy Creation Flow for Protection Buyers (LONG_PUT)

### 2.1 Flow Diagram

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐         ┌─────────────────┐         ┌─────────────┐
│             │         │               │         │              │         │                 │         │             │
│  Frontend   │         │ Convex Backend│         │ Oracle &     │         │ Blockchain      │         │ Policy      │
│  Components │         │ (Quote Svc)   │         │ Premium Svc  │         │ Integration     │         │ Registry    │
│             │         │               │         │              │         │                 │         │             │
└──────┬──────┘         └───────┬───────┘         └──────┬───────┘         └────────┬────────┘         └─────┬───────┘
       │                        │                        │                          │                        │
       │                        │                        │                          │                        │
       │  1. User Finalizes     │                        │                          │                        │
       │     Policy Parameters  │                        │                          │                        │
       │ ◄────────────────────┐ │                        │                          │                        │
       │                        │                        │                          │                        │
       │  2. User Clicks        │                        │                          │                        │
       │     "Activate          │                        │                          │                        │
       │     Protection"        │                        │                          │                        │
       │ ◄────────────────────┐ │                        │                          │                        │
       │                        │                        │                          │                        │
       │  3. Request Final      │                        │                          │                        │
       │     Quote Confirmation │                        │                          │                        │
       │ ─────────────────────► │                        │                          │                        │
       │                        │                        │                          │                        │
       │                        │  4. Validate Quote     │                          │                        │
       │                        │     Parameters         │                          │                        │
       │                        │ ◄────────────────────┐ │                          │                        │
       │                        │                        │                          │                        │
       │                        │  5. Fetch Latest      │                          │                        │
       │                        │     Market Data        │                          │                        │
       │                        │ ─────────────────────► │                          │                        │
       │                        │                        │                          │                        │
       │                        │  6. Return Market      │                          │                        │
       │                        │     Data with          │                          │                        │
       │                        │     Timestamp          │                          │                        │
       │                        │ ◄─────────────────────┐│                          │                        │
       │                        │                        │                          │                        │
       │                        │  7. Calculate Final    │                          │                        │
       │                        │     Premium            │                          │                        │
       │                        │ ─────────────────────► │                          │                        │
       │                        │                        │                          │                        │
       │                        │  8. Return Final       │                          │                        │
       │                        │     Premium            │                          │                        │
       │                        │ ◄─────────────────────┐│                          │                        │
       │                        │                        │                          │                        │
       │                        │  9. Generate Policy    │                          │                        │
       │                        │     Creation Package   │                          │                        │
       │                        │ ◄────────────────────┐ │                          │                        │
       │                        │                        │                          │                        │
       │                        │  10. Prepare          │                          │                        │
       │                        │      Blockchain        │                          │                        │
       │                        │      Transaction       │                          │                        │
       │                        │ ─────────────────────────────────────────────────►│                        │
       │                        │                        │                          │                        │
       │  11. Return            │                        │                          │                        │
       │      Transaction       │                        │                          │                        │
       │      for User          │                        │                          │                        │
       │      Approval          │                        │                          │                        │
       │ ◄─────────────────────┐│                        │                          │                        │
       │                        │                        │                          │                        │
       │  12. User Approves     │                        │                          │                        │
       │      & Signs           │                        │                          │                        │
       │      Transaction       │                        │                          │                        │
       │ ◄────────────────────┐ │                        │                          │                        │
       │                        │                        │                          │                        │
       │  13. Submit Signed     │                        │                          │                        │
       │      Transaction       │                        │                          │                        │
       │ ─────────────────────────────────────────────────────────────────────────► │                        │
       │                        │                        │                          │                        │
       │                        │                        │                          │  14. Create Policy     │
       │                        │                        │                          │      Entry with        │
       │                        │                        │                          │      LONG_PUT Position │
       │                        │                        │                          │ ─────────────────────► │
       │                        │                        │                          │                        │
       │                        │                        │                          │  15. Process Premium   │
       │                        │                        │                          │      Payment           │
       │                        │                        │                          │ ◄─────────────────────┐│
       │                        │                        │                          │                        │
       │                        │                        │                          │  16. Emit Policy       │
       │                        │                        │                          │      Created Event     │
       │                        │                        │                          │ ◄─────────────────────┐│
       │                        │                        │                          │                        │
       │  17. Return            │                        │                          │                        │
       │      Transaction       │                        │                          │                        │
       │      Confirmation      │                        │                          │                        │
       │ ◄─────────────────────────────────────────────────────────────────────────┐│                        │
       │                        │                        │                          │                        │
       │                        │  18. Update Policy     │                          │                        │
       │                        │      Status in Backend │                          │                        │
       │                        │ ◄─────────────────────────────────────────────────┘                        │
       │                        │                        │                          │                        │
       │  19. Display           │                        │                          │                        │
       │      Confirmation to   │                        │                          │                        │
       │      User              │                        │                          │                        │
       │ ◄─────────────────────┐│                        │                          │                        │
       │                        │                        │                          │                        │
```

### 2.2 Step-by-Step Description

1. **User Finalizes Policy Parameters (User → Frontend)**

   - User completes parameter selection in the BuyerParametersUI
   - Parameters include: protectedValuePercentage, protectionAmount, expirationDays
   - UI displays final quote details in PolicySummary component
   - Implementation in `front-end/src/components/BitHedge/PolicySummary.tsx`

2. **User Clicks "Activate Protection" (User → Frontend)**

   - User clicks the "Activate Protection" button in PolicySummary
   - This triggers the policy creation flow
   - Implementation in `handleActivateProtection` function in PolicySummary

3. **Request Final Quote Confirmation (Frontend → Convex)**

   - Frontend sends a request to finalize the premium quote
   - The most recent quote parameters are used
   - Request goes to the premium calculation service
   - Request includes a flag to "lock" the quote for policy creation

4. **Validate Quote Parameters (Convex)**

   - Backend validates all parameters for completeness and validity
   - Checks: amount limits, expiration constraints, protected value range
   - Ensures parameters match platform rules
   - Implementation in validation functions in `convex/quotes.ts`

5. **Fetch Latest Market Data (Convex → Oracle Service)**

   - Quote service requests current market data
   - Critical to use latest price data for final quote
   - Implementation in Oracle service call from premium service

6. **Return Market Data with Timestamp (Oracle Service → Convex)**

   - Oracle returns current BTC price, volatility, and timestamp
   - Data is used as basis for final premium calculation
   - Implementation in response handler from Oracle price service

7. **Calculate Final Premium (Convex → Premium Service)**

   - Quote service passes parameters to premium calculation service
   - Includes current market data from Oracle
   - Implementation in `convex/services/oracle/premiumCalculation.ts`

8. **Return Final Premium (Premium Service → Convex)**

   - Premium service returns calculated premium amount
   - Includes breakdown of premium components
   - Implementation in premium calculation return handler

9. **Generate Policy Creation Package (Convex)**

   - Backend prepares a complete policy creation package
   - Includes all parameters needed for on-chain creation:
     - Owner address (buyer)
     - Counterparty address (liquidity pool)
     - Protected value (strike price)
     - Protection amount
     - Expiration height (block height)
     - Premium amount
     - Policy type ("PUT")
   - Implementation in policy creation preparation functions

10. **Prepare Blockchain Transaction (Convex → Blockchain Integration)**

    - Backend prepares a transaction to call the policy-registry contract
    - Transaction targets the create-policy-entry function
    - Sets appropriate parameters for gas and confirmation
    - Implementation in `convex/blockchainIntegration.ts`

11. **Return Transaction for User Approval (Convex → Frontend)**

    - Prepared transaction is returned to frontend
    - Includes all details needed for user review
    - Frontend prepares to interact with user's wallet
    - Implementation in transaction preparation response handler

12. **User Approves & Signs Transaction (User → Frontend)**

    - User is prompted to review the transaction details
    - User approves and signs the transaction with their wallet
    - Wallet integration handles the signing process
    - Implementation in transaction signing handlers in frontend

13. **Submit Signed Transaction (Frontend → Blockchain)**

    - Frontend submits the signed transaction to the blockchain
    - Uses appropriate blockchain API for the network
    - Records transaction ID for status tracking
    - Implementation in transaction submission code

14. **Create Policy Entry with LONG_PUT Position (Blockchain → Policy Registry)**

    - Policy Registry contract processes the transaction
    - Creates a new policy entry with the provided parameters
    - Automatically assigns LONG_PUT position type to the buyer
    - Assigns SHORT_PUT position type to the counterparty (pool)
    - Implementation in the `create-policy-entry` function in policy-registry.clar

15. **Process Premium Payment (Policy Registry)**

    - Contract processes the premium payment
    - Records premium amount in the policy
    - May interact with other contracts for token transfers
    - Implementation in policy registry premium handling code

16. **Emit Policy Created Event (Policy Registry)**

    - Contract emits an event recording the policy creation
    - Event includes policy ID and key parameters
    - Event is recorded on-chain and available to listeners
    - Implementation in event printing in policy-registry.clar

17. **Return Transaction Confirmation (Blockchain → Frontend)**

    - Blockchain returns transaction result to frontend
    - Includes success status and event data
    - Frontend prepares to update UI with result
    - Implementation in transaction result handling

18. **Update Policy Status in Backend (Blockchain → Convex)**

    - Backend listens for policy creation events
    - Updates off-chain records with on-chain policy ID
    - Marks policy as active in database
    - Implementation in blockchain event listeners

19. **Display Confirmation to User (Convex → Frontend)**

    - Frontend displays success message to user
    - Shows policy details and confirmation
    - May redirect to policy management page
    - Implementation in confirmation UI components

## 3. Policy Creation Flow for Liquidity Providers (SHORT_PUT)

### 3.1 Flow Diagram

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐         ┌─────────────────┐         ┌─────────────┐
│             │         │               │         │              │         │                 │         │             │
│  Frontend   │         │ Convex Backend│         │ Oracle &     │         │ Blockchain      │         │ Liquidity   │
│  Components │         │ (Quote Svc)   │         │ Premium Svc  │         │ Integration     │         │ Pool Vault  │
│             │         │               │         │              │         │                 │         │             │
└──────┬──────┘         └───────┬───────┘         └──────┬───────┘         └────────┬────────┘         └─────┬───────┘
       │                        │                        │                          │                        │
       │                        │                        │                          │                        │
       │  1. User Finalizes     │                        │                          │                        │
       │     Provider           │                        │                          │                        │
       │     Parameters         │                        │                          │                        │
       │ ◄────────────────────┐ │                        │                          │                        │
       │                        │                        │                          │                        │
       │  2. User Clicks        │                        │                          │                        │
       │     "Commit Capital"   │                        │                          │                        │
       │ ◄────────────────────┐ │                        │                          │                        │
       │                        │                        │                          │                        │
       │  3. Request Final      │                        │                          │                        │
       │     Yield Quote        │                        │                          │                        │
       │     Confirmation       │                        │                          │                        │
       │ ─────────────────────► │                        │                          │                        │
       │                        │                        │                          │                        │
       │                        │  4. Validate Provider  │                          │                        │
       │                        │     Parameters         │                          │                        │
       │                        │ ◄────────────────────┐ │                          │                        │
       │                        │                        │                          │                        │
       │                        │  5. Fetch Latest      │                          │                        │
       │                        │     Market Data        │                          │                        │
       │                        │ ─────────────────────► │                          │                        │
       │                        │                        │                          │                        │
       │                        │  6. Return Market      │                          │                        │
       │                        │     Data               │                          │                        │
       │                        │ ◄─────────────────────┐│                          │                        │
       │                        │                        │                          │                        │
       │                        │  7. Calculate Final    │                          │                        │
       │                        │     Yield              │                          │                        │
       │                        │ ─────────────────────► │                          │                        │
       │                        │                        │                          │                        │
       │                        │  8. Return Final       │                          │                        │
       │                        │     Yield              │                          │                        │
       │                        │ ◄─────────────────────┐│                          │                        │
       │                        │                        │                          │                        │
       │                        │  9. Generate Capital   │                          │                        │
       │                        │     Commitment Package │                          │                        │
       │                        │ ◄────────────────────┐ │                          │                        │
       │                        │                        │                          │                        │
       │                        │  10. Prepare          │                          │                        │
       │                        │      Blockchain        │                          │                        │
       │                        │      Transaction       │                          │                        │
       │                        │ ─────────────────────────────────────────────────►│                        │
       │                        │                        │                          │                        │
       │  11. Return            │                        │                          │                        │
       │      Transaction       │                        │                          │                        │
       │      for User          │                        │                          │                        │
       │      Approval          │                        │                          │                        │
       │ ◄─────────────────────┐│                        │                          │                        │
       │                        │                        │                          │                        │
       │  12. User Approves     │                        │                          │                        │
       │      & Signs           │                        │                          │                        │
       │      Transaction       │                        │                          │                        │
       │ ◄────────────────────┐ │                        │                          │                        │
       │                        │                        │                          │                        │
       │  13. Submit Signed     │                        │                          │                        │
       │      Transaction       │                        │                          │                        │
       │ ─────────────────────────────────────────────────────────────────────────► │                        │
       │                        │                        │                          │                        │
       │                        │                        │                          │  14. Deposit           │
       │                        │                        │                          │      Capital into      │
       │                        │                        │                          │      Liquidity Pool    │
       │                        │                        │                          │ ─────────────────────► │
       │                        │                        │                          │                        │
       │                        │                        │                          │  15. Record Provider   │
       │                        │                        │                          │      Allocation        │
       │                        │                        │                          │ ◄─────────────────────┐│
       │                        │                        │                          │                        │
       │                        │                        │                          │  16. Emit Capital      │
       │                        │                        │                          │      Committed Event   │
       │                        │                        │                          │ ◄─────────────────────┐│
       │                        │                        │                          │                        │
       │  17. Return            │                        │                          │                        │
       │      Transaction       │                        │                          │                        │
       │      Confirmation      │                        │                          │                        │
       │ ◄─────────────────────────────────────────────────────────────────────────┐│                        │
       │                        │                        │                          │                        │
       │                        │  18. Update Provider   │                          │                        │
       │                        │      Status in Backend │                          │                        │
       │                        │ ◄─────────────────────────────────────────────────┘                        │
       │                        │                        │                          │                        │
       │  19. Display           │                        │                          │                        │
       │      Confirmation to   │                        │                          │                        │
       │      User              │                        │                          │                        │
       │ ◄─────────────────────┐│                        │                          │                        │
       │                        │                        │                          │                        │
```

### 3.2 Step-by-Step Description

1. **User Finalizes Provider Parameters (User → Frontend)**

   - User completes provider parameter selection in ProviderParametersUI
   - Parameters include: commitmentAmountUSD, selectedTier, selectedPeriodDays
   - UI displays yield and terms in ProviderIncomeSummary component
   - Implementation in `front-end/src/components/BitHedge/ProviderIncomeSummary.tsx`

2. **User Clicks "Commit Capital" (User → Frontend)**

   - User clicks the "Commit Capital" button in ProviderIncomeSummary
   - This triggers the capital commitment and liquidity provision flow
   - Implementation in `handleCommitCapital` function in ProviderIncomeSummary

3. **Request Final Yield Quote Confirmation (Frontend → Convex)**

   - Frontend sends a request to finalize the yield quote
   - Uses the most recent provider parameters
   - Request goes to the provider yield calculation service
   - Request includes a flag to "lock" the quote for capital commitment

4. **Validate Provider Parameters (Convex)**

   - Backend validates all provider parameters for completeness and validity
   - Checks: commitment amount limits, tier validity, period constraints
   - Ensures parameters match platform rules
   - Implementation in validation functions in `convex/quotes.ts`

5. **Fetch Latest Market Data (Convex → Oracle Service)**

   - Quote service requests current market data
   - Critical to use latest price data for final yield calculation
   - Implementation in Oracle service call from premium service

6. **Return Market Data (Oracle Service → Convex)**

   - Oracle returns current BTC price, volatility, and timestamp
   - Data is used as basis for final yield calculation
   - Implementation in response handler from Oracle price service

7. **Calculate Final Yield (Convex → Premium Service)**

   - Quote service passes parameters to yield calculation service
   - Includes current market data from Oracle
   - Implementation in `convex/services/oracle/premiumCalculation.ts`

8. **Return Final Yield (Premium Service → Convex)**

   - Premium service returns calculated yield amount and percentage
   - Includes breakdown of yield components
   - Implementation in yield calculation return handler

9. **Generate Capital Commitment Package (Convex)**

   - Backend prepares a complete capital commitment package
   - Includes all parameters needed for on-chain commitment:
     - Provider address
     - Commitment amount
     - Selected tier
     - Commitment period
     - Expected yield
   - Implementation in capital commitment preparation functions

10. **Prepare Blockchain Transaction (Convex → Blockchain Integration)**

    - Backend prepares a transaction to call the liquidity-pool-vault contract
    - Transaction targets the deposit functions (deposit-stx or deposit-sip010)
    - Sets appropriate parameters for gas and confirmation
    - Implementation in `convex/blockchainIntegration.ts`

11. **Return Transaction for User Approval (Convex → Frontend)**

    - Prepared transaction is returned to frontend
    - Includes all details needed for user review
    - Frontend prepares to interact with user's wallet
    - Implementation in transaction preparation response handler

12. **User Approves & Signs Transaction (User → Frontend)**

    - User is prompted to review the transaction details
    - User approves and signs the transaction with their wallet
    - Wallet integration handles the signing process
    - Implementation in transaction signing handlers in frontend

13. **Submit Signed Transaction (Frontend → Blockchain)**

    - Frontend submits the signed transaction to the blockchain
    - Uses appropriate blockchain API for the network
    - Records transaction ID for status tracking
    - Implementation in transaction submission code

14. **Deposit Capital into Liquidity Pool (Blockchain → Liquidity Pool Vault)**

    - Liquidity Pool Vault contract processes the transaction
    - Receives the deposited STX or SIP-010 tokens
    - Updates total pool balance
    - Implementation in deposit functions in liquidity-pool-vault.clar

15. **Record Provider Allocation (Liquidity Pool Vault)**

    - Contract records the provider's capital allocation
    - Links provider address to committed amount and terms
    - Sets up premium sharing rules based on tier
    - Implementation in allocation tracking functions in liquidity-pool-vault.clar

16. **Emit Capital Committed Event (Liquidity Pool Vault)**

    - Contract emits an event recording the capital commitment
    - Event includes provider address, amount, and terms
    - Event is recorded on-chain and available to listeners
    - Implementation in event printing in liquidity-pool-vault.clar

17. **Return Transaction Confirmation (Blockchain → Frontend)**

    - Blockchain returns transaction result to frontend
    - Includes success status and event data
    - Frontend prepares to update UI with result
    - Implementation in transaction result handling

18. **Update Provider Status in Backend (Blockchain → Convex)**

    - Backend listens for capital commitment events
    - Updates off-chain records with commitment details
    - Marks provider as active in database
    - Implementation in blockchain event listeners

19. **Display Confirmation to User (Convex → Frontend)**

    - Frontend displays success message to user
    - Shows commitment details and confirmation
    - May redirect to provider dashboard page
    - Implementation in confirmation UI components

## 4. Blockchain Integration Details

### 4.1 Policy Registry Contract Integration

The Policy Registry smart contract (`policy-registry.clar`) serves as the central repository for all insurance policies on the BitHedge platform. It is responsible for:

1. **Creating and storing policy entries**:

   - Stores all policy terms, including protected value, protection amount, expiration
   - Maintains the relationship between policy owner (buyer) and counterparty (seller)
   - Tracks the policy status (Active, Exercised, Expired)

2. **Position type assignment**:

   - Explicitly assigns LONG_PUT position type to policy owners (Protection Peter)
   - Assigns SHORT_PUT position type to counterparties (Income Irene/Liquidity Pool)
   - Records both positions in the policy data structure

3. **Policy lifecycle management**:

   - Enables status transitions between Active, Exercised, and Expired states
   - Enforces authorization rules for state transitions
   - Verifies policy parameters during creation

4. **Premium tracking**:

   - Records the premium amount paid for each policy
   - Tracks whether the premium has been distributed to the counterparty
   - Enables premium distribution for expired policies

5. **Key Contract Functions**:

   a. **`create-policy-entry`**: Creates a new policy with the specified parameters

   ```clarity
   (define-public (create-policy-entry
     (owner principal)
     (counterparty principal)
     (protected-value uint)
     (protection-amount uint)
     (expiration-height uint)
     (premium uint)
     (policy-type (string-ascii 4)))
     ;; Implementation details
   )
   ```

   b. **`update-policy-status`**: Updates the status of a policy (Exercised or Expired)

   ```clarity
   (define-public (update-policy-status
     (policy-id uint)
     (new-status (string-ascii 10)))
     ;; Implementation details
   )
   ```

   c. **`process-expired-policy-premium`**: Processes premium distribution for expired policies

   ```clarity
   (define-public (process-expired-policy-premium (policy-id uint))
     ;; Implementation details
   )
   ```

### 4.2 Liquidity Pool Vault Integration

The Liquidity Pool Vault contract (`liquidity-pool-vault.clar`) manages the capital pool that backs insurance policies. It's responsible for:

1. **Capital management**:

   - Securely holds STX and SIP-010 tokens as capital
   - Tracks total balance and locked amounts
   - Ensures sufficient capital is available for policies

2. **Premium distribution**:

   - Records premiums received from policy buyers
   - Distributes premiums to liquidity providers based on their share
   - Maintains accounting of distributed and undistributed premiums

3. **Provider allocation tracking**:

   - Records individual provider contributions
   - Tracks each provider's share of premiums
   - Links providers to specific policies they're backing

4. **Settlement processing**:

   - Manages capital release for expired policies
   - Processes payments for exercised policies
   - Updates accounting records after settlements

5. **Key Contract Functions**:

   a. **`deposit-stx`/`deposit-sip010`**: Handles capital deposits from providers

   ```clarity
   (define-public (deposit-stx (amount uint))
     ;; Implementation details
   )

   (define-public (deposit-sip010 (token <sip-010-trait>) (amount uint))
     ;; Implementation details
   )
   ```

   b. **`record-premium-payment`**: Records premium payments from buyers

   ```clarity
   (define-public (record-premium-payment (token-id (string-ascii 32)) (amount uint) (policy-id uint) (counterparty principal))
     ;; Implementation details
   )
   ```

   c. **`distribute-premium`**: Distributes premiums to counterparties

   ```clarity
   (define-public (distribute-premium (token-id (string-ascii 32)) (amount uint) (counterparty principal) (policy-id uint))
     ;; Implementation details
   )
   ```

   d. **`record-provider-allocation`**: Records a provider's allocation to a policy

   ```clarity
   (define-public (record-provider-allocation (provider principal) (policy-id uint) (token-id (string-ascii 32)) (allocated-amount uint) (premium-share uint))
     ;; Implementation details
   )
   ```

## 5. Position Type Assignment and Premium Distribution Flow

### 5.1 Flow Diagram

```
┌───────────────┐         ┌───────────────┐         ┌─────────────┐         ┌──────────────┐
│               │         │               │         │             │         │              │
│ Policy        │         │ Liquidity     │         │ Convex      │         │ Frontend     │
│ Registry      │         │ Pool Vault    │         │ Backend     │         │ Components   │
│               │         │               │         │             │         │              │
└───────┬───────┘         └───────┬───────┘         └─────┬───────┘         └──────┬───────┘
        │                         │                       │                        │
        │                         │                       │                        │
        │  1. Policy Creation     │                       │                        │
        │     Transaction         │                       │                        │
        │ ◄─────────────────────────────────────────────────────────────────────────
        │                         │                       │                        │
        │  2. Assign LONG_PUT     │                       │                        │
        │     to Owner            │                       │                        │
        │ ◄────────────────────┐  │                       │                        │
        │                         │                       │                        │
        │  3. Assign SHORT_PUT    │                       │                        │
        │     to Counterparty     │                       │                        │
        │ ◄────────────────────┐  │                       │                        │
        │                         │                       │                        │
        │  4. Record Premium      │                       │                        │
        │     Amount              │                       │                        │
        │ ◄────────────────────┐  │                       │                        │
        │                         │                       │                        │
        │  5. Emit Policy         │                       │                        │
        │     Created Event       │                       │                        │
        │ ◄────────────────────┐  │                       │                        │
        │                         │                       │                        │
        │                         │                       │  6. Detect Policy      │
        │                         │                       │     Created Event      │
        │ ────────────────────────────────────────────────►                        │
        │                         │                       │                        │
        │                         │                       │  7. Process Premium    │
        │                         │                       │     Payment            │
        │                         │                       │ ◄──────────────────┐   │
        │                         │                       │                        │
        │                         │                       │  8. Record Policy      │
        │                         │                       │     in Database        │
        │                         │                       │ ◄──────────────────┐   │
        │                         │                       │                        │
        │                         │  9. Record Premium    │                        │
        │                         │     in Pool           │                        │
        │                         │ ◄───────────────────────                        │
        │                         │                       │                        │
        │                         │  10. Allocate Premium │                        │
        │                         │      to Providers     │                        │
        │                         │ ◄────────────────────┐│                        │
        │                         │                       │                        │
        │                         │                       │  11. Update UI         │
        │                         │                       │      with Position     │
        │                         │                       │      Type              │
        │                         │                       │ ────────────────────────►
        │                         │                       │                        │
        │                         │                       │                        │  12. Show User
        │                         │                       │                        │      Their Position
        │                         │                       │                        │      Type
        │                         │                       │                        │ ◄─────────────────┐
        │                         │                       │                        │
```

### 5.2 Step-by-Step Description

1. **Policy Creation Transaction (Blockchain Network → Policy Registry)**

   - Smart contract transaction is executed on the blockchain
   - The `create-policy-entry` function is called with all necessary parameters
   - Policy Registry contract begins processing the transaction
   - Implementation in policy-registry.clar create-policy-entry function

2. **Assign LONG_PUT to Owner (Policy Registry)**

   - Contract automatically assigns LONG_PUT position type to the policy owner
   - Based on the policy type (PUT options in current implementation)
   - Position type is stored directly in policy data structure
   - Implementation in position type assignment in create-policy-entry function

3. **Assign SHORT_PUT to Counterparty (Policy Registry)**

   - Contract also assigns SHORT_PUT position type to the counterparty
   - This is typically the liquidity pool address for buyer-initiated policies
   - For direct peer-to-peer policies, would be another user address
   - Implementation alongside owner position assignment

4. **Record Premium Amount (Policy Registry)**

   - Contract stores the premium amount in the policy record
   - Sets premium_distributed flag to false initially
   - Implementation in premium field of policy data structure

5. **Emit Policy Created Event (Policy Registry)**

   - Contract emits an event with the policy details
   - Includes position types and all relevant policy parameters
   - Event is recorded on-chain and available to listeners
   - Implementation in print statement in create-policy-entry function:

   ```clarity
   (print {
     event: "policy-created",
     policy-id: policy-id,
     owner: owner,
     counterparty: counterparty,
     policy-type: policy-type,
     position-type: owner-position-type,
     counterparty-position-type: counterparty-position-type,
     ...
   })
   ```

6. **Detect Policy Created Event (Blockchain Network → Convex Backend)**

   - Convex backend listens for policy-created events
   - Event detection is part of blockchain event monitoring system
   - Implementation in blockchain event listeners in Convex

7. **Process Premium Payment (Convex Backend)**

   - Backend processes the premium payment transaction
   - Ensures premium is properly recorded and accounted for
   - Implementation in premium payment processing functions

8. **Record Policy in Database (Convex Backend)**

   - Backend records the new policy in the Convex database
   - Includes all policy details including position types
   - Maintains off-chain record for efficient querying
   - Implementation in database operations after event detection

9. **Record Premium in Pool (Convex Backend → Liquidity Pool Vault)**

   - Backend triggers premium recording in the Liquidity Pool
   - Calls the record-premium-payment function in liquidity-pool-vault
   - Updates total premium amounts in the pool
   - Implementation in premium recording flow

10. **Allocate Premium to Providers (Liquidity Pool Vault)**

    - Pool contract allocates the premium among providers based on their share
    - Uses the provider allocation records to determine shares
    - Prepares for future premium distribution when policy expires
    - Implementation in premium allocation functions

11. **Update UI with Position Type (Convex Backend → Frontend)**

    - Backend sends updated policy data to frontend
    - Includes explicit position type (LONG_PUT or SHORT_PUT)
    - Frontend updates user interface based on position type
    - Implementation in UI update handlers

12. **Show User Their Position Type (Frontend)**

    - Frontend displays appropriate UI based on user's position type
    - LONG_PUT users see Protection/Buyer interface
    - SHORT_PUT users see Provider/Seller interface
    - Implementation in conditional rendering in UI components
