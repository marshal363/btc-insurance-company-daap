# BitHedge European-Style Options Architecture: Technical Specification

## Executive Summary

This technical specification details BitHedge's European-style options architecture, focusing on data models, data flows, and component interactions across the smart contract system. The European-style model (settlement only at expiration) offers significant advantages for gas efficiency, capital utilization, and verification mechanisms while simplifying the settlement process. This document provides implementation guidance for Clarity smart contracts on the Stacks blockchain.

## 1. System Architecture Overview

### 1.1 Core Components

BitHedge's European-style options platform consists of four primary components:

1. **Policy Registry Contract**: Manages policy creation, expiration processing, and settlement coordination
2. **Liquidity Pool Vault Contract**: Handles capital management, collateral allocation, and premium distribution
3. **Oracle Contract**: Provides reliable price data for settlement at expiration
4. **Parameter Contract**: Stores system configuration values and risk tier parameters

```
┌───────────────────────────────┐      ┌─────────────────────────────┐
│                               │      │                             │
│    Policy Registry Contract   │◄────►│   Liquidity Pool Contract   │
│                               │      │                             │
└───────────────┬───────────────┘      └──────────────┬──────────────┘
                │                                      │
                │                                      │
                ▼                                      ▼
┌───────────────────────────────┐      ┌─────────────────────────────┐
│                               │      │                             │
│       Oracle Contract         │      │    Parameter Contract       │
│                               │      │                             │
└───────────────────────────────┘      └─────────────────────────────┘
```

### 1.2 Key Design Principles

1. **European-Style Settlement**: All options settle only at expiration, not before
2. **Batch Processing**: Expiration processing is optimized for handling multiple policies at once
3. **Expiration-Focused Liquidity**: Capital management optimized around expiration dates
4. **Risk Tier System**: Structured approach to matching buyer protection with provider risk preference
5. **Comprehensive Verification**: Explicit verification systems ensure correct allocation and settlement

## 2. Data Models

### 2.1 Policy Registry Contract Data Model

```clarity
;; Primary Policy Data Structure
(define-map policies
  { id: uint }
  {
    owner: principal,                       ;; Policy owner (buyer)
    counterparty: principal,                ;; Counterparty (typically the pool)
    protected-value: uint,                  ;; Strike price in base units
    protection-amount: uint,                ;; Amount being protected
    expiration-height: uint,                ;; Block height when policy expires
    premium: uint,                          ;; Premium amount paid
    policy-type: (string-ascii 4),          ;; "PUT" or "CALL"
    position-type: (string-ascii 9),        ;; "LONG_PUT" or "LONG_CALL"
    counterparty-position-type: (string-ascii 9), ;; "SHORT_PUT" or "SHORT_CALL"
    collateral-token: (string-ascii 4),     ;; Token used as collateral
    protected-asset: (string-ascii 4),      ;; Asset being protected
    settlement-token: (string-ascii 4),     ;; Token used for settlement
    status: (string-ascii 10),              ;; "Active", "Settled", "Expired"
    creation-height: uint,                  ;; Block height when created
    premium-distributed: bool,              ;; Whether premium distributed
    settlement-price: uint,                 ;; Price at expiration (if settled)
    settlement-amount: uint,                ;; Amount settled (if in-the-money)
    risk-tier: (string-ascii 32),           ;; Selected risk tier
    is-settled: bool                        ;; Settlement processed flag
  }
)

;; Indexing Data Structures
(define-map policies-by-owner
  { owner: principal }
  { policy-ids: (list 50 uint) }
)

(define-map policies-by-counterparty
  { counterparty: principal }
  { policy-ids: (list 50 uint) }
)

;; Expiration-focused indexing - critical for European-style
(define-map policies-by-expiration-height
  { height: uint }
  { policy-ids: (list 50 uint) }
)

;; Premium Distribution Queue
(define-map pending-premium-distributions
  { policy-id: uint }
  { ready-for-distribution: bool }
)

;; Settlement Tracking
(define-map policy-settlements
  { policy-id: uint }
  {
    settlement-price: uint,
    settlement-amount: uint,
    settlement-height: uint,
    settlement-timestamp: uint
  }
)

;; Policy ID Counter
(define-data-var policy-id-counter uint u0)

;; Authorized principals
(define-data-var backend-authorized-principal principal tx-sender)
(define-data-var oracle-principal principal tx-sender)
(define-data-var liquidity-pool-principal principal tx-sender)
```

### 2.2 Liquidity Pool Vault Data Model

```clarity
;; Token Balance Tracking
(define-map token-balances 
  { token: (string-ascii 32) }
  { 
    balance: uint,              ;; Total balance of token in vault
    available-balance: uint,    ;; Available balance (not locked)
    locked-balance: uint        ;; Locked balance (allocated to policies)
  }
)

;; Provider Balance Tracking
(define-map provider-balances
  { provider: principal, token: (string-ascii 32) }
  {
    deposited-amount: uint,     ;; Total deposited amount
    allocated-amount: uint,     ;; Amount allocated to policies
    available-amount: uint,     ;; Amount available for allocation
    earned-premiums: uint,      ;; Total earned premiums
    pending-premiums: uint,     ;; Premiums pending distribution
    expiration-exposure: (map uint uint)  ;; Map of expiration heights to exposure amounts
  }
)

;; Provider Allocation Tracking
(define-map provider-allocations
  { provider: principal, policy-id: uint }
  {
    token: (string-ascii 32),
    allocated-amount: uint,          ;; Amount allocated to this policy
    allocation-percentage: uint,     ;; Percentage of policy's total collateral
    premium-share: uint,             ;; Share of premium for this policy
    expiration-height: uint,         ;; Expiration height
    risk-tier: (string-ascii 32),    ;; Risk tier
    allocation-timestamp: uint,      ;; When allocation occurred
    premium-distributed: bool        ;; Whether premium has been distributed
  }
)

;; Provider Expiration Exposure
(define-map provider-expiration-exposure
  { provider: principal, expiration-height: uint }
  {
    allocated-amount: uint,       ;; Total amount allocated to this expiration height
    policy-count: uint,           ;; Number of policies at this expiration height
    max-potential-settlement: uint ;; Maximum potential settlement amount
  }
)

;; Settlement Impact Tracking
(define-map settlement-impacts
  { policy-id: uint, provider: principal }
  {
    original-allocation: uint,     ;; Provider's original allocation 
    settlement-contribution: uint, ;; Provider's contribution to settlement
    remaining-allocation: uint,    ;; Remaining allocation after settlement
    settlement-percentage: uint,   ;; Percentage of provider's allocation used
    settlement-timestamp: uint     ;; When settlement occurred
  }
)

;; Premium Distribution Records
(define-map premium-distributions
  { policy-id: uint, provider: principal }
  {
    premium-amount: uint,         ;; Provider's share of premium
    calculation-basis: uint,      ;; Original allocation amount used for calculation
    allocation-percentage: uint,  ;; Provider's percentage of total collateral
    distribution-timestamp: uint, ;; When distribution occurred
    status: (string-ascii 32)    ;; "Pending", "Processing", "Completed"
  }
)

;; Expiration Liquidity Needs
(define-map expiration-liquidity-needs
  { height: uint }
  {
    total-collateral-required: uint,   ;; Total collateral needed at this expiration
    max-potential-settlement: uint,    ;; Maximum possible settlement amount
    policies-expiring: uint,          ;; Count of policies expiring
    is-liquidity-prepared: bool       ;; Whether liquidity has been prepared
  }
)

;; Premium Accounting
(define-map premium-balances
  { token: (string-ascii 32) }
  {
    total-premiums: uint,          ;; Total premiums collected
    distributed-premiums: uint     ;; Total premiums distributed
  }
)

;; Risk Tier Parameters
(define-map risk-tier-parameters
  { tier: (string-ascii 32) }
  {
    collateral-ratio: uint,           ;; Required collateral ratio (e.g., 110 for 110%)
    premium-multiplier: uint,         ;; Premium adjustment multiplier
    max-exposure-percentage: uint,    ;; Maximum exposure per provider
    description: (string-ascii 256)   ;; Human-readable description
  }
)

;; Authorized principals
(define-data-var backend-authorized-principal principal tx-sender)
(define-data-var policy-registry-principal principal tx-sender)
```

### 2.3 Risk Tier System Mapping

The European-style model uses a risk tier system to map between buyer protection preferences and provider risk tolerance:

```
// For Buyers (Protective Peter)
Conservative: 100% of current value - Maximum protection
Standard: 90% of current value - Standard protection 
Flexible: 80% of current value - Balanced protection
Crash Insurance: 70% of current value - Minimal protection

// For Providers (Income Irene)
Conservative: Low risk, lower yield, higher collateral ratio (110%)
Balanced: Medium risk, medium yield, standard collateral ratio (100%)
Aggressive: Higher risk, higher yield, lower collateral ratio (90%)

// Tier Matching Rules
ConservativeBuyer -> ConservativeProvider
StandardBuyer -> BalancedProvider, ConservativeProvider
FlexibleBuyer -> AggressiveProvider, BalancedProvider
CrashInsuranceBuyer -> Any provider tier
```

## 3. Data Flows and Component Interactions

### 3.1 Policy Creation Flow

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐         ┌─────────────────┐
│             │         │               │         │              │         │                 │
│  Frontend   │         │ Policy        │         │ Oracle &     │         │ Liquidity       │
│  Components │         │ Registry      │         │ Parameter    │         │ Pool Vault      │
│             │         │               │         │              │         │                 │
└──────┬──────┘         └───────┬───────┘         └──────┬───────┘         └────────┬────────┘
       │                        │                        │                          │
       │  1. User selects       │                        │                          │
       │     policy parameters  │                        │                          │
       │ ────────────────────►  │                        │                          │
       │                        │                        │                          │
       │                        │  2. Get current        │                          │
       │                        │     BTC price          │                          │
       │                        │ ────────────────────►  │                          │
       │                        │                        │                          │
       │                        │  3. Return current     │                          │
       │                        │     BTC price          │                          │
       │                        │ ◄────────────────────  │                          │
       │                        │                        │                          │
       │                        │  4. Calculate          │                          │
       │                        │     premium            │                          │
       │                        │ ────────────────────►  │                          │
       │                        │                        │                          │
       │                        │  5. Return premium     │                          │
       │                        │     amount             │                          │
       │                        │ ◄────────────────────  │                          │
       │                        │                        │                          │
       │                        │  6. Check liquidity    │                          │
       │                        │     availability       │                          │
       │                        │ ─────────────────────────────────────────────────►│
       │                        │                        │                          │
       │                        │  7. Confirm liquidity  │                          │
       │                        │     is available       │                          │
       │                        │ ◄─────────────────────────────────────────────────│
       │                        │                        │                          │
       │  8. Return premium     │                        │                          │
       │     and transaction    │                        │                          │
       │     details            │                        │                          │
       │ ◄────────────────────  │                        │                          │
       │                        │                        │                          │
       │  9. User pays premium  │                        │                          │
       │     and signs TX       │                        │                          │
       │ ────────────────────►  │                        │                          │
       │                        │                        │                          │
       │                        │ 10. Create policy      │                          │
       │                        │     record             │                          │
       │                        │                        │                          │
       │                        │ 11. Request collateral │                          │
       │                        │     locking            │                          │
       │                        │ ─────────────────────────────────────────────────►│
       │                        │                        │                          │
       │                        │                        │ 12. Allocate provider    │
       │                        │                        │     capital              │
       │                        │                        │                          │
       │                        │                        │ 13. Update provider      │
       │                        │                        │     allocations          │
       │                        │                        │                          │
       │                        │ 14. Collateral locked  │                          │
       │                        │     confirmation       │                          │
       │                        │ ◄─────────────────────────────────────────────────│
       │                        │                        │                          │
       │                        │ 15. Record premium     │                          │
       │                        │     payment            │                          │
       │                        │ ─────────────────────────────────────────────────►│
       │                        │                        │                          │
       │ 16. Return policy      │                        │                          │
       │     creation result    │                        │                          │
       │ ◄────────────────────  │                        │                          │
       │                        │                        │                          │
```

#### Key Data Flow Details:

1. **Liquidity Check Before Premium Payment**: Policy Registry checks available liquidity with the Liquidity Pool *before* accepting premium from user (steps 6-7).

2. **Data passed during liquidity check**:
   ```clarity
   ;; Policy Registry -> Liquidity Pool
   (contract-call? .liquidity-pool-vault check-liquidity
     required-collateral       ;; Amount of collateral needed
     collateral-token          ;; Token type for collateral
     risk-tier                 ;; Selected risk tier
     expiration-height)        ;; When policy expires
   ```

3. **Data passed during collateral locking**:
   ```clarity
   ;; Policy Registry -> Liquidity Pool
   (contract-call? .liquidity-pool-vault lock-collateral
     policy-id                 ;; Unique policy identifier
     required-collateral       ;; Amount to lock
     collateral-token          ;; Token type
     risk-tier                 ;; Risk tier for provider selection
     expiration-height)        ;; For expiration tracking
   ```

4. **Provider allocation selection process** (step 12):
   - Liquidity Pool selects providers based on risk tier matching
   - Allocated amount is proportional to available capital
   - Expiration exposure is tracked for each provider
   - Allocation percentage determines future premium share

5. **Premium recording data** (step 15):
   ```clarity
   ;; Policy Registry -> Liquidity Pool
   (contract-call? .liquidity-pool-vault record-premium-payment
     policy-id                 ;; Unique policy identifier
     premium-amount            ;; Amount of premium paid
     premium-token             ;; Token used for premium
     expiration-height)        ;; For premium tracking by expiration
   ```

### 3.2 Expiration Settlement Flow (European-Style)

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐         ┌─────────────────┐
│             │         │               │         │              │         │                 │
│  Backend    │         │ Policy        │         │ Oracle       │         │ Liquidity       │
│  System     │         │ Registry      │         │              │         │ Pool Vault      │
│             │         │               │         │              │         │                 │
└──────┬──────┘         └───────┬───────┘         └──────┬───────┘         └────────┬────────┘
       │                        │                        │                          │
       │  1. Detect block height│                        │                          │
       │     with expirations   │                        │                          │
       │ ────────────────────►  │                        │                          │
       │                        │                        │                          │
       │                        │  2. Find policies      │                          │
       │                        │     expiring at height │                          │
       │                        │                        │                          │
       │                        │  3. Get BTC price at   │                          │
       │                        │     expiration         │                          │
       │                        │ ────────────────────►  │                          │
       │                        │                        │                          │
       │                        │  4. Return expiration  │                          │
       │                        │     price              │                          │
       │                        │ ◄────────────────────  │                          │
       │                        │                        │                          │
       │                        │  5. Process expiration │                          │
       │                        │     batch              │                          │
       │                        │                        │                          │
       │                        │           For each policy: determine if ITM or OTM│
       │                        │                        │                          │
       │                        │  6a. For ITM policies: │                          │
       │                        │      Process settlement│                          │
       │                        │ ─────────────────────────────────────────────────►│
       │                        │                        │                          │
       │                        │                        │  7a. Calculate provider  │
       │                        │                        │      settlement impact   │
       │                        │                        │                          │
       │                        │                        │  8a. Process settlement  │
       │                        │                        │      to policy owner     │
       │                        │                        │                          │
       │                        │                        │  9a. Release remaining   │
       │                        │                        │      collateral          │
       │                        │                        │                          │
       │                        │ 10a. Settlement        │                          │
       │                        │      confirmation      │                          │
       │                        │ ◄─────────────────────────────────────────────────│
       │                        │                        │                          │
       │                        │  6b. For OTM policies: │                          │
       │                        │      Queue premium     │                          │
       │                        │      distribution      │                          │
       │                        │                        │                          │
       │ 11. Return batch       │                        │                          │
       │     processing result  │                        │                          │
       │ ◄────────────────────  │                        │                          │
       │                        │                        │                          │
       │ 12. Process premium    │                        │                          │
       │     distributions      │                        │                          │
       │ ────────────────────►  │                        │                          │
       │                        │                        │                          │
       │                        │ 13. Distribute premiums│                          │
       │                        │     to providers       │                          │
       │                        │ ─────────────────────────────────────────────────►│
       │                        │                        │                          │
       │                        │                        │ 14. Calculate provider   │
       │                        │                        │     premium shares       │
       │                        │                        │                          │
       │                        │                        │ 15. Update provider      │
       │                        │                        │     premium balances     │
       │                        │                        │                          │
       │                        │                        │ 16. Release collateral   │
       │                        │                        │                          │
       │                        │ 17. Premium            │                          │
       │                        │     distribution       │                          │
       │                        │     confirmation       │                          │
       │                        │ ◄─────────────────────────────────────────────────│
       │                        │                        │                          │
       │ 18. Return premium     │                        │                          │
       │     distribution result│                        │                          │
       │ ◄────────────────────  │                        │                          │
```

#### Key Data Flow Details:

1. **Expiration batch processing** (step 5):
   ```clarity
   ;; Backend -> Policy Registry
   (contract-call? .policy-registry process-expiration-batch
     expiration-height         ;; Block height to process
     expiration-price)         ;; BTC price at this height
   ```

2. **In-The-Money (ITM) determination**:
   ```clarity
   ;; For PUT options:
   (< expiration-price protected-value)
   
   ;; For CALL options:
   (> expiration-price protected-value)
   ```

3. **Settlement amount calculation**:
   ```clarity
   ;; For PUT options:
   (let ((price-difference (- protected-value expiration-price))
         (settlement-proportion (/ price-difference protected-value)))
     (* protection-amount settlement-proportion))
     
   ;; For CALL options:
   (let ((price-difference (- expiration-price protected-value))
         (settlement-proportion (/ price-difference protected-value)))
     (* protection-amount settlement-proportion))
   ```

4. **Settlement processing data** (step 6a):
   ```clarity
   ;; Policy Registry -> Liquidity Pool
   (contract-call? .liquidity-pool-vault process-settlement-at-expiration
     policy-id                 ;; Policy being settled
     (get owner policy)        ;; Settlement recipient
     settlement-amount         ;; Amount to settle
     settlement-token)         ;; Token for settlement
   ```

5. **Provider settlement impact calculation** (step 7a):
   - Each provider is affected proportionally to their allocation percentage
   - Settlement impact is recorded for verification and accounting

6. **Premium distribution data** (step 13):
   ```clarity
   ;; Policy Registry -> Liquidity Pool
   (contract-call? .liquidity-pool-vault distribute-premium-to-providers
     policy-id                 ;; Policy with premium to distribute
     premium-amount            ;; Amount of premium to distribute
     premium-token)            ;; Token type for premium
   ```

7. **Provider premium share calculation** (step 14):
   ```clarity
   ;; For each provider allocation:
   (let ((provider-percentage (get allocation-percentage provider-allocation)))
     (/ (* premium-amount provider-percentage) u100))
   ```

### 3.3 Provider Capital Management Flow

```
┌─────────────┐         ┌───────────────┐         ┌─────────────────┐
│             │         │               │         │                 │
│  Frontend   │         │ Liquidity     │         │ Policy          │
│  Components │         │ Pool Vault    │         │ Registry        │
│             │         │               │         │                 │
└──────┬──────┘         └───────┬───────┘         └────────┬────────┘
       │                        │                          │
       │  1. Provider commits   │                          │
       │     capital            │                          │
       │ ────────────────────►  │                          │
       │                        │                          │
       │                        │  2. Record deposit       │                         
       │                        │     Update balances      │                         
       │                        │                          │
       │  3. Return deposit     │                          │
       │     confirmation       │                          │
       │ ◄────────────────────  │                          │
       │                        │                          │
       │                        │  4. Allocate capital     │
       │                        │     to policies          │
       │                        │  (automatic process)     │
       │                        │                          │
       │                        │  5. Update provider      │
       │                        │     allocations          │
       │                        │                          │
       │  6. User views         │                          │
       │     allocations        │                          │
       │ ────────────────────►  │                          │
       │                        │                          │
       │  7. Return allocation  │                          │
       │     details            │                          │
       │ ◄────────────────────  │                          │
       │                        │                          │
       │                        │  8. Premiums are         │
       │                        │     distributed at       │
       │                        │     policy expiration    │
       │                        │ ◄─────────────────────────
       │                        │                          │
       │                        │  9. Update provider      │
       │                        │     premium balances     │
       │                        │                          │
       │ 10. User requests to   │                          │
       │     claim premiums     │                          │
       │ ────────────────────►  │                          │
       │                        │                          │
       │                        │ 11. Transfer premiums    │
       │                        │     to provider          │
       │                        │                          │
       │ 12. Return premium     │                          │
       │     claim result       │                          │
       │ ◄────────────────────  │                          │
       │                        │                          │
       │ 13. Provider requests  │                          │
       │     withdrawal         │                          │
       │ ────────────────────►  │                          │
       │                        │                          │
       │                        │ 14. Verify available     │
       │                        │     balance              │
       │                        │                          │
       │                        │ 15. Process withdrawal   │
       │                        │                          │
       │ 16. Return withdrawal  │                          │
       │     result             │                          │
       │ ◄────────────────────  │                          │
       │                        │                          │
```

#### Key Data Flow Details:

1. **Capital commitment data** (step 1):
   ```clarity
   ;; Frontend -> Liquidity Pool
   (contract-call? .liquidity-pool-vault deposit-capital
     amount                    ;; Amount to deposit
     token-id                  ;; Token type (STX or sBTC)
     risk-tier)                ;; Provider's risk preference
   ```

2. **Provider deposit recording** (step 2):
   ```clarity
   ;; Update token balances
   (map-set token-balances
     { token: token-id }
     { balance: (+ existing-balance amount),
       available-balance: (+ existing-available amount),
       locked-balance: existing-locked })
   
   ;; Update provider balances
   (map-set provider-balances
     { provider: tx-sender, token: token-id }
     { deposited-amount: (+ existing-deposited amount),
       allocated-amount: existing-allocated,
       available-amount: (+ existing-available amount),
       earned-premiums: existing-earned,
       pending-premiums: existing-pending,
       expiration-exposure: existing-exposure })
   ```

3. **Capital allocation process** (steps 4-5):
   - Triggered by policy creation requests
   - Uses risk tier matching to select providers
   - Allocates capital proportionally based on available balances
   - Updates provider allocation records and exposure tracking

4. **Premium claim data** (step 10):
   ```clarity
   ;; Frontend -> Liquidity Pool
   (contract-call? .liquidity-pool-vault claim-pending-premiums
     provider                  ;; Provider principal (tx-sender)
     token-id)                 ;; Token type for premiums
   ```

5. **Premium transfer processing** (step 11):
   ```clarity
   ;; Transfer premiums to provider
   (as-contract
     (stx-transfer?
       (get earned-premiums provider-balance)
       tx-sender
       provider))
   
   ;; Update provider balance
   (map-set provider-balances 
     { provider: provider, token: token-id }
     (merge provider-balance { earned-premiums: u0 }))
   ```

6. **Withdrawal request data** (step 13):
   ```clarity
   ;; Frontend -> Liquidity Pool
   (contract-call? .liquidity-pool-vault withdraw-capital
     amount                    ;; Amount to withdraw
     token-id)                 ;; Token type
   ```

7. **Available balance verification** (step 14):
   ```clarity
   ;; Check if provider has sufficient available balance
   (>= (get available-amount provider-balance) amount)
   ```

## 4. Critical Technical Components

### 4.1 Risk Tier Implementation

```clarity
;; Risk Tier Parameter Definition
(map-set risk-tier-parameters 
  { tier: "Conservative" }
  { collateral-ratio: u110,        ;; 110% collateral requirement
    premium-multiplier: u80,       ;; 80% of standard premium
    max-exposure-percentage: u25,  ;; Max 25% exposure per expiration date
    description: "Lower risk, lower returns with premium discount" })
    
(map-set risk-tier-parameters 
  { tier: "Balanced" }
  { collateral-ratio: u100,        ;; 100% collateral requirement
    premium-multiplier: u100,      ;; Standard premium
    max-exposure-percentage: u33,  ;; Max 33% exposure per expiration date
    description: "Balanced risk-reward profile" })
    
(map-set risk-tier-parameters 
  { tier: "Aggressive" }
  { collateral-ratio: u90,         ;; 90% collateral requirement
    premium-multiplier: u120,      ;; 120% premium boost
    max-exposure-percentage: u50,  ;; Max 50% exposure per expiration date
    description: "Higher risk, higher potential returns" })

;; Risk Tier Matching Function
(define-private (is-valid-tier-match
  (policy-tier (string-ascii 32))
  (provider-tier (string-ascii 32)))
  
  (or
    ;; Conservative policies can only use Conservative providers
    (and (is-eq policy-tier "Conservative") 
         (is-eq provider-tier "Conservative"))
    
    ;; Standard policies can use Balanced or Conservative providers
    (and (is-eq policy-tier "Standard")
         (or (is-eq provider-tier "Balanced")
             (is-eq provider-tier "Conservative")))
    
    ;; Flexible policies can use Aggressive or Balanced providers
    (and (is-eq policy-tier "Flexible")
         (or (is-eq provider-tier "Aggressive")
             (is-eq provider-tier "Balanced")))
    
    ;; Crash Insurance can use any provider tier
    (is-eq policy-tier "Crash Insurance")
  )
)

;; Get Required Collateral With Risk Tier
(define-private (get-required-collateral-with-tier
  (collateral-base-amount uint)
  (provider-tier (string-ascii 32)))
  
  (let ((tier-params (unwrap! (map-get? risk-tier-parameters 
                                       { tier: provider-tier })
                            ERR-INVALID-TIER)))
    (/ (* collateral-base-amount (get collateral-ratio tier-params)) u100))
)
```

### 4.2 Expiration-Focused Liquidity Management

```clarity
;; Prepare Liquidity for Upcoming Expirations
(define-public (prepare-liquidity-for-expirations
  (upcoming-block-height uint)
  (look-ahead-blocks uint))
  
  (begin
    ;; Verify caller authorization
    (asserts! (is-eq tx-sender (var-get backend-authorized-principal))
              ERR-UNAUTHORIZED)
    
    ;; Get all expiration heights in the look-ahead window
    (let ((expiration-heights (get-expiration-heights-in-range 
                              upcoming-block-height 
                              (+ upcoming-block-height look-ahead-blocks))))
      
      ;; For each expiration height, prepare liquidity
      (fold prepare-liquidity-for-height 
            expiration-heights
            { prepared-expirations: u0, 
              total-liquidity-reserved: u0 }))
  )
)

;; Prepare Liquidity for a Specific Expiration Height
(define-private (prepare-liquidity-for-height
  (expiration-height uint)
  (result { prepared-expirations: uint, total-liquidity-reserved: uint }))
  
  (let ((expiration-need (unwrap! (map-get? expiration-liquidity-needs 
                                          { height: expiration-height })
                                ERR-NO-EXPIRATION-NEEDS)))
    
    ;; Skip if already prepared or no policies expiring
    (if (or (get is-liquidity-prepared expiration-need)
            (is-eq (get policies-expiring expiration-need) u0))
        result
        
        ;; Calculate required liquidity
        (let ((collateral-needed (get total-collateral-required expiration-need))
              (potential-settlement (get max-potential-settlement expiration-need)))
          
          ;; Optimize provider allocations for this expiration
          (optimize-allocations-for-expiration expiration-height)
          
          ;; Mark liquidity as prepared
          (map-set expiration-liquidity-needs
                  { height: expiration-height }
                  (merge expiration-need 
                         { is-liquidity-prepared: true }))
          
          ;; Update tracking result
          (merge result
                { prepared-expirations: (+ (get prepared-expirations result) u1),
                  total-liquidity-reserved: (+ (get total-liquidity-reserved result) 
                                             collateral-needed) }))
    )
  )
)
```

### 4.3 Batch Expiration Processing

```clarity
;; Process Expiration Batch
(define-public (process-expiration-batch
  (block-height uint)
  (expiration-price uint))
  
  (begin
    ;; Verify caller authorization
    (asserts! (is-eq tx-sender (var-get backend-authorized-principal))
              ERR-UNAUTHORIZED)
    
    ;; Get all policies expiring at this height
    (let ((expiring-policies (unwrap! (map-get? policies-by-expiration-height 
                                              { height: block-height })
                                     (ok { policy-ids: (list) }))))
      
      ;; Process each policy at this expiration height
      (fold process-policy-at-expiration
            (get policy-ids expiring-policies)
            { processed-count: u0, 
              settled-count: u0, 
              expired-count: u0 })
    )
  )
)

;; Process Each Policy at Expiration
(define-private (process-policy-at-expiration
  (policy-id uint)
  (result { processed-count: uint, settled-count: uint, expired-count: uint }))
  
  (let ((policy (unwrap! (map-get? policies { id: policy-id }) ERR-NOT-FOUND)))
    ;; Skip if policy is not active
    (if (not (is-eq (get status policy) STATUS-ACTIVE))
        result
        
        ;; Determine if policy is in-the-money
        (if (is-policy-in-the-money policy-id expiration-price)
            ;; In-the-money: Process settlement
            (match (process-settlement-at-expiration policy-id expiration-price)
              success (merge result 
                           { processed-count: (+ (get processed-count result) u1),
                             settled-count: (+ (get settled-count result) u1) })
              failure result)
            
            ;; Out-of-the-money: Prepare premium distribution
            (match (prepare-premium-distribution policy-id)
              success (merge result 
                           { processed-count: (+ (get processed-count result) u1),
                             expired-count: (+ (get expired-count result) u1) })
              failure result))
    )
  )
)
```

### 4.4 Settlement Impact Tracking

```clarity
;; Calculate Provider Settlement Impacts
(define-private (distribute-settlement-impact
  (policy-id uint)
  (total-settlement uint)
  (token-id (string-ascii 32)))
  
  (let ((allocations (get-policy-allocations policy-id)))
    (begin
      ;; Process each provider allocation
      (map 
        (lambda (allocation)
          (let ((provider (get provider allocation))
                (allocation-percentage (get allocation-percentage allocation))
                (provider-settlement (/ (* total-settlement allocation-percentage) u100)))
            
            ;; Record provider's settlement contribution
            (map-set settlement-impacts
                    { policy-id: policy-id, provider: provider }
                    { original-allocation: (get allocated-amount allocation),
                      settlement-contribution: provider-settlement,
                      remaining-allocation: (- (get allocated-amount allocation) 
                                             provider-settlement),
                      settlement-percentage: (/ (* provider-settlement u100) 
                                              (get allocated-amount allocation)),
                      settlement-timestamp: burn-block-height })
            
            ;; Update provider's balance
            (update-provider-balance 
              provider provider-settlement token-id "settle")))
        allocations)
      
      ;; Verify settlement distribution
      (verify-settlement-sum policy-id total-settlement)
      
      { success: true }))
)

;; Verify Settlement Sum
(define-private (verify-settlement-sum
  (policy-id uint)
  (total-settlement uint))
  
  (let ((impacts (get-settlement-impacts policy-id))
        (impact-sum (fold sum-settlement-impacts impacts u0)))
    (asserts! (is-eq impact-sum total-settlement) 
             ERR-SETTLEMENT-SUM-MISMATCH)
    true)
)
```

### 4.5 Premium Distribution System

```clarity
;; Distribute Premium to Providers
(define-public (distribute-premium-to-providers
  (policy-id uint)
  (premium-amount uint)
  (token-id (string-ascii 32)))
  
  (begin
    ;; Verify caller is the policy registry
    (asserts! (is-eq tx-sender (var-get policy-registry-principal)) 
             ERR-UNAUTHORIZED)
    
    ;; Get policy allocations
    (let ((allocations (get-policy-allocations policy-id)))
      ;; Process each provider allocation
      (map 
        (lambda (allocation)
          (let ((provider (get provider allocation))
                (percentage (get premium-share allocation))
                (provider-premium (/ (* premium-amount percentage) u100)))
            
            ;; Record premium distribution
            (map-set premium-distributions
                    { policy-id: policy-id, provider: provider }
                    { premium-amount: provider-premium,
                      calculation-basis: (get allocated-amount allocation),
                      allocation-percentage: percentage,
                      distribution-timestamp: burn-block-height,
                      status: "Completed" })
            
            ;; Update provider's premium balance
            (update-provider-premium-balance 
              provider provider-premium token-id)
            
            ;; Update allocation record
            (map-set provider-allocations
                    { provider: provider, policy-id: policy-id }
                    (merge allocation { premium-distributed: true }))))
        allocations)
      
      ;; Update global distributed premium accounting
      (update-distributed-premium-total token-id premium-amount)
      
      ;; Release collateral for all providers
      (release-policy-collateral policy-id token-id)
      
      ;; Verify premium distribution
      (verify-premium-distribution-sum policy-id premium-amount)
      
      (ok { success: true })))
)

;; Verify Premium Distribution Sum
(define-private (verify-premium-distribution-sum
  (policy-id uint)
  (premium-amount uint))
  
  (let ((distributions (get-premium-distributions-by-policy policy-id))
        (distribution-sum (fold sum-premium-distributions distributions u0)))
    (asserts! (is-eq distribution-sum premium-amount) 
             ERR-DISTRIBUTION-SUM-MISMATCH)
    true)
)
```

### 4.6 Provider Balance Management

```clarity
;; Update Provider Balance
(define-private (update-provider-balance
  (provider principal)
  (amount uint)
  (token-id (string-ascii 32))
  (operation (string-ascii 10)))
  
  (let ((provider-balance (unwrap! (map-get? provider-balances 
                                          { provider: provider, token: token-id })
                                ERR-NOT-FOUND)))
    (match operation
      "allocate" (map-set provider-balances
                        { provider: provider, token: token-id }
                        { deposited-amount: (get deposited-amount provider-balance),
                          allocated-amount: (+ (get allocated-amount provider-balance) amount),
                          available-amount: (- (get available-amount provider-balance) amount),
                          earned-premiums: (get earned-premiums provider-balance),
                          pending-premiums: (get pending-premiums provider-balance),
                          expiration-exposure: (get expiration-exposure provider-balance) })
                          
      "release" (map-set provider-balances
                       { provider: provider, token: token-id }
                       { deposited-amount: (get deposited-amount provider-balance),
                         allocated-amount: (- (get allocated-amount provider-balance) amount),
                         available-amount: (+ (get available-amount provider-balance) amount),
                         earned-premiums: (get earned-premiums provider-balance),
                         pending-premiums: (get pending-premiums provider-balance),
                         expiration-exposure: (get expiration-exposure provider-balance) })
                         
      "settle" (map-set provider-balances
                      { provider: provider, token: token-id }
                      { deposited-amount: (- (get deposited-amount provider-balance) amount),
                        allocated-amount: (- (get allocated-amount provider-balance) amount),
                        available-amount: (get available-amount provider-balance),
                        earned-premiums: (get earned-premiums provider-balance),
                        pending-premiums: (get pending-premiums provider-balance),
                        expiration-exposure: (get expiration-exposure provider-balance) })
                        
      "premium" (map-set provider-balances
                       { provider: provider, token: token-id }
                       { deposited-amount: (get deposited-amount provider-balance),
                         allocated-amount: (get allocated-amount provider-balance),
                         available-amount: (get available-amount provider-balance),
                         earned-premiums: (+ (get earned-premiums provider-balance) amount),
                         pending-premiums: (get pending-premiums provider-balance),
                         expiration-exposure: (get expiration-exposure provider-balance) })
      
      (err ERR-INVALID-OPERATION))
  )
)

;; Update Provider Expiration Exposure
(define-private (update-provider-expiration-exposure
  (provider principal)
  (expiration-height uint)
  (amount uint)
  (is-addition bool))
  
  (let ((provider-balance (unwrap! (map-get? provider-balances 
                                          { provider: provider, token: token-id })
                                ERR-NOT-FOUND))
        (exposure-map (get expiration-exposure provider-balance))
        (current-exposure (default-to u0 (map-get? exposure-map expiration-height))))
    
    ;; Update exposure map
    (if is-addition
        (map-insert exposure-map expiration-height (+ current-exposure amount))
        (map-insert exposure-map expiration-height (- current-exposure amount)))
    
    ;; Update provider's expiration exposure in balance record
    (map-set provider-balances
           { provider: provider, token: token-id }
           (merge provider-balance
                 { expiration-exposure: exposure-map }))
  )
)
```

## 5. Verification Mechanisms

The European-style options architecture implements comprehensive verification mechanisms:

### 5.1 Core Verification Functions

```clarity
;; Verify Pool Balance Integrity
(define-read-only (verify-pool-balance-integrity (token-id (string-ascii 32)))
  (let ((token-balance (unwrap! (map-get? token-balances { token: token-id })
                              ERR-TOKEN-NOT-INITIALIZED))
        (provider-balances (get-all-provider-balances-by-token token-id))
        (total-provider-deposits (fold sum-provider-deposits provider-balances u0)))
    (is-eq (get balance token-balance) total-provider-deposits)))

;; Verify Policy Allocation Integrity
(define-read-only (verify-policy-allocation-integrity (policy-id uint))
  (let ((policy (unwrap! (map-get? policies { id: policy-id }) ERR-NOT-FOUND))
        (allocations (get-policy-allocations policy-id))
        (allocation-sum (fold sum-allocations allocations u0)))
    (is-eq allocation-sum (calculate-required-collateral 
                         (get protected-value policy)
                         (get protection-amount policy)
                         (get policy-type policy)))))

;; Verify Provider Balance Integrity
(define-read-only (verify-provider-balance-integrity 
  (provider principal) 
  (token-id (string-ascii 32)))
  
  (let ((provider-balance (unwrap! (map-get? provider-balances 
                                          { provider: provider, token: token-id })
                                ERR-NOT-FOUND))
        (provider-allocations (get-all-provider-allocations provider))
        (allocation-sum (fold sum-allocations provider-allocations u0)))
    (is-eq (get allocated-amount provider-balance) allocation-sum)))

;; Verify Premium Distribution Integrity  
(define-read-only (verify-premium-distribution-integrity (policy-id uint))
  (let ((policy (unwrap! (map-get? policies { id: policy-id }) ERR-NOT-FOUND))
        (distributions (get-premium-distributions-by-policy policy-id))
        (distribution-sum (fold sum-premium-distributions distributions u0)))
    (is-eq distribution-sum (get premium policy))))

;; Verify Settlement Integrity
(define-read-only (verify-settlement-integrity (policy-id uint))
  (let ((policy (unwrap! (map-get? policies { id: policy-id }) ERR-NOT-FOUND))
        (settlement-impacts (get-settlement-impacts-by-policy policy-id))
        (impact-sum (fold sum-settlement-impacts settlement-impacts u0)))
    (is-eq impact-sum (get settlement-amount policy))))
```

### 5.2 System-Level Verification

```clarity
;; Verify System Invariants
(define-public (verify-system-invariants)
  (begin
    (asserts! (is-eq tx-sender (var-get backend-authorized-principal)) 
             ERR-UNAUTHORIZED)
    
    (let ((invariant-results (list)))
      ;; Check global invariants for each token type
      (let ((token-types (list "STX" "sBTC")))
        (fold
          (lambda (token-id results)
            (begin
              (let ((pool-integrity (verify-pool-balance-integrity token-id))
                    (updated-results (append results pool-integrity)))
                updated-results)))
          token-types
          invariant-results))
      
      ;; Check policy-level invariants for active policies
      (let ((active-policies (get-active-policies)))
        (fold
          (lambda (policy-id results)
            (begin
              (let ((allocation-integrity (verify-policy-allocation-integrity policy-id))
                    (updated-results (append results allocation-integrity)))
                updated-results)))
          active-policies
          invariant-results))
      
      ;; Return verification results
      (ok invariant-results))))
```

## 6. Gas Optimization Techniques

The European-style architecture implements several gas optimization techniques:

### 6.1 Batch Processing

```clarity
;; Batch process multiple policies at one expiration height
(define-public (process-expiration-batch
  (block-height uint)
  (expiration-price uint))
  ;; Implementation details as shown in section 4.3
)

;; Batch distribute premiums for multiple policies
(define-public (distribute-premium-batch
  (policy-ids (list 50 uint)))
  
  (fold distribute-premium-fold
        policy-ids
        { distributed-count: u0, failed-count: u0 })
)

;; Helper function for batch premium distribution
(define-private (distribute-premium-fold
  (policy-id uint)
  (result { distributed-count: uint, failed-count: uint }))
  
  (match (distribute-premium policy-id)
    success (merge result 
                  { distributed-count: (+ (get distributed-count result) u1) })
    error (merge result 
               { failed-count: (+ (get failed-count result) u1) })
  )
)
```

### 6.2 Efficient Data Storage

```clarity
;; Use defined list size limitations to prevent excessive storage
(define-map policies-by-owner
  { owner: principal }
  { policy-ids: (list 50 uint) }  ;; Limited to 50 policies per owner
)

;; Store minimum necessary data on-chain
;; Original approach stored extensive policy metadata
;; New approach keeps only essential data and moves the rest off-chain

;; Use map indexing for O(1) lookups
(define-map policies-by-expiration-height
  { height: uint }
  { policy-ids: (list 50 uint) }
)
```

### 6.3 Minimal On-Chain Calculation

```clarity
;; For expensive calculations like provider selection, the architecture
;; implements an algorithmic approach that minimizes on-chain computation:

;; 1. Use sorted selection algorithm that's O(n log n) instead of O(n²)
;; 2. Implement early exit conditions to avoid unnecessary iterations
;; 3. Cache intermediate results to avoid redundant calculations

;; Example of optimized provider selection:
(define-private (select-providers-for-allocation
  (amount uint)
  (token-id (string-ascii 32))
  (risk-tier (string-ascii 32)))
  
  (let ((eligible-providers (get-eligible-providers token-id risk-tier))
        (sorted-providers (sort-providers-by-available-balance eligible-providers))
        (result { providers: (list), amounts: (list) }))
    
    ;; Early exit if no eligible providers
    (if (is-eq (len sorted-providers) u0)
        result
        
        ;; Process in a single pass with proportional allocation
        (let ((total-available (calculate-total-available-balance sorted-providers))
              (remaining-amount amount))
          
          (fold allocate-to-provider
                sorted-providers
                { providers: (list),
                  amounts: (list),
                  remaining: remaining-amount,
                  total-available: total-available })))))
```

## 7. Implementation Roadmap

### 7.1 Contract Development Phases

1. **Phase 1: Core Functionality**
   - Policy Registry with basic policy lifecycle
   - Liquidity Pool with capital management
   - Simple risk tier system
   - Basic expiration processing

2. **Phase 2: Enhanced Settlement and Verification**
   - Settlement impact tracking
   - Premium distribution records
   - Verification mechanisms
   - Expiration batch processing

3. **Phase 3: Advanced Features**
   - Expiration-focused liquidity management
   - Optimized provider allocation
   - Enhanced premium distribution
   - Comprehensive verification system

### 7.2 Testing Strategy

1. **Unit Testing**
   - Test individual functions in isolation
   - Verify correct balance accounting
   - Check risk tier behavior
   - Validate settlement calculations

2. **Integration Testing**
   - Test complete policy lifecycle
   - Verify cross-contract interactions
   - Test expiration batch processing
   - Validate verification mechanisms

3. **Stress Testing**
   - Test with large numbers of policies
   - Test with multiple expirations
   - Verify gas efficiency under load
   - Test edge cases and boundary conditions

## 8. Conclusion

The BitHedge European-style options architecture provides a robust, gas-efficient implementation for Bitcoin options on the Stacks blockchain. By leveraging batch processing, expiration-focused liquidity management, and comprehensive verification mechanisms, the architecture ensures correctness while optimizing for on-chain efficiency.

The European-style settlement model (exercise only at expiration) significantly simplifies the contract architecture compared to American-style options, allowing for more predictable liquidity needs, more efficient collateral utilization, and reduced gas costs through batch processing.

This architecture enables BitHedge to provide a secure, efficient platform for Bitcoin options that aligns with Bitcoin holder mental models while maintaining the technical precision required for financial contracts.
