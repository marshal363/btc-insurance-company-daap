# Transitioning to European-Style Options: Smart Contract Implementation Strategy

## Executive Summary

This technical document outlines the implementation strategy for transitioning BitHedge's options platform from American-style to European-style settlement. After detailed analysis of the current `policy-registry.clar` and `liquidity-pool-vault.clar` implementations, we recommend implementing fresh contracts rather than modifying the existing ones. The European-style model (exercise only at expiration) represents a fundamental architectural shift that affects core data structures, settlement logic, and verification mechanisms. This document provides specific implementation guidance, code examples, and a phased development approach.

## 1. Current Smart Contract Analysis

### 1.1 policy-registry.clar Analysis

The current Policy Registry contract implements American-style options with the following key characteristics:

```clarity
;; Policy data structure
(define-map policies
  { id: uint }
  {
    owner: principal,
    counterparty: principal,
    protected-value: uint,
    protection-amount: uint,
    expiration-height: uint,
    premium: uint,
    policy-type: (string-ascii 4),
    position-type: (string-ascii 9),
    collateral-token: (string-ascii 4),
    protected-asset: (string-ascii 4),
    settlement-token: (string-ascii 4),
    status: (string-ascii 10),              ;; "Active", "Exercised", "Expired"
    creation-height: uint,
    premium-distributed: bool
  }
)

;; Policy activation (American-style)
(define-public (update-policy-status
  (policy-id uint)
  (new-status (string-ascii 10)))

  (let
    (
      (policy (unwrap! (map-get? policies { id: policy-id }) ERR-NOT-FOUND))
      (previous-status (get status policy))
    )
    (begin
      ;; Allow owner to exercise policy at any time before expiration
      (asserts!
        (or
          (and (is-eq tx-sender (get owner policy))
               (is-eq previous-status STATUS-ACTIVE)
               (is-eq new-status STATUS-EXERCISED)
               (< burn-block-height (get expiration-height policy)))

          (and (is-eq tx-sender (var-get backend-authorized-principal))
               (is-eq previous-status STATUS-ACTIVE)
               (is-eq new-status STATUS-EXPIRED)
               (>= burn-block-height (get expiration-height policy))))
        ERR-UNAUTHORIZED
      )

      ;; Update the policy status
      (map-set policies
        { id: policy-id }
        (merge policy { status: new-status })
      )

      ;; Emit event
      (print {
        event: "policy-status-updated",
        policy-id: policy-id,
        new-status: new-status,
        previous-status: previous-status,
        block-height: burn-block-height
      })

      (ok true)
    )
  )
)
```

Key limitations for European-style implementation:

1. Policy activation allows early exercise (American-style)
2. No expiration-specific processing logic
3. Limited settlement and premium distribution tracking
4. Insufficient batch processing capabilities
5. Basic verification mechanisms

### 1.2 liquidity-pool-vault.clar Analysis

The current Liquidity Pool Vault implements:

```clarity
;; Provider allocation tracking
(define-map provider-allocations
  { provider: principal, policy-id: uint }
  {
    token: (string-ascii 32),
    allocated-amount: uint,
    allocation-percentage: uint,
    premium-share: uint,
    premium-distributed: bool
  }
)

;; Settlement processing (on-demand)
(define-public (pay-settlement
  (token-id (string-ascii 32))
  (settlement-amount uint)
  (recipient principal)
  (policy-id uint))

  (let (
      (caller tx-sender)
      (current-balance (default-to u0 (get balance (map-get? token-balances { token: token-id }))))
      (current-locked (default-to u0 (get amount (map-get? locked-collateral { token: token-id }))))
    )
    (begin
      (asserts! (is-eq caller (var-get backend-authorized-principal)) ERR-UNAUTHORIZED)
      (asserts! (> settlement-amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
      (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)
      (asserts! (>= current-balance settlement-amount) ERR-NOT-ENOUGH-BALANCE)

      ;; Transfer the settlement amount
      (if (is-eq token-id "STX")
          (try! (as-contract (stx-transfer? settlement-amount tx-sender recipient)))
          (try! (as-contract (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer
                                           settlement-amount tx-sender recipient none)))
      )

      ;; Update token balance
      (map-set token-balances { token: token-id }
               { balance: (- current-balance settlement-amount) })

      ;; Emit event
      (print { event: "settlement-paid",
               policy-id: policy-id,
               buyer: recipient,
               settlement-amount: settlement-amount,
               token: token-id })
      (ok true)
    )
  )
)
```

Key limitations for European-style implementation:

1. No expiration-focused liquidity management
2. Limited provider allocation tracking
3. No settlement impact tracking
4. Basic premium distribution mechanism
5. Insufficient verification mechanisms
6. No risk tier implementation

## 2. Implementation Approach Justification

A fresh implementation approach is recommended for the following reasons:

### 2.1 Fundamental Architectural Differences

European-style options differ fundamentally from American-style options:

| Aspect                | American-Style (Current)     | European-Style (Target)        |
| --------------------- | ---------------------------- | ------------------------------ |
| Exercise Timing       | Any time before expiration   | Only at expiration             |
| Settlement Processing | On-demand by buyer           | Batch processing at expiration |
| Liquidity Management  | Continuous readiness         | Expiration-focused planning    |
| Premium Distribution  | After exercise or expiration | Only after expiration          |
| Verification Focus    | Individual transactions      | Batch correctness verification |

These differences affect the core architecture of both contracts, making modification more complex than fresh implementation.

### 2.2 Required Data Structure Enhancements

European-style options require numerous new data structures:

1. **Expiration-focused indexing**:

   ```clarity
   (define-map policies-by-expiration-height
     { height: uint }
     { policy-ids: (list 50 uint) }
   )
   ```

2. **Settlement tracking**:

   ```clarity
   (define-map policy-settlements
     { policy-id: uint }
     {
       settlement-price: uint,
       settlement-amount: uint,
       settlement-height: uint,
       settlement-timestamp: uint
     }
   )
   ```

3. **Provider expiration exposure**:

   ```clarity
   (define-map provider-expiration-exposure
     { provider: principal, expiration-height: uint }
     {
       allocated-amount: uint,
       policy-count: uint,
       max-potential-settlement: uint
     }
   )
   ```

4. **Settlement impact tracking**:
   ```clarity
   (define-map settlement-impacts
     { policy-id: uint, provider: principal }
     {
       original-allocation: uint,
       settlement-contribution: uint,
       remaining-allocation: uint,
       settlement-percentage: uint,
       settlement-timestamp: uint
     }
   )
   ```

Retrofitting these into existing contracts would be complex and error-prone.

### 2.3 Batch Processing Requirements

European-style options rely heavily on batch processing at expiration:

```clarity
(define-public (process-expiration-batch
  (block-height: uint)
  (expiration-price: uint))

  (let
    ((policies (get-policies-by-expiration-height block-height)))
    ;; Process each policy expiring at this height
    (fold process-policy-at-expiration
          policies
          { processedCount: u0, settledCount: u0, expiredCount: u0 })
  )
)
```

This batch-focused approach differs significantly from the current transaction-focused model.

### 2.4 Enhanced Verification System

European-style options benefit from comprehensive verification mechanisms:

```clarity
;; Verify sum of all provider allocations equals policy collateral requirement
(define-private (verify-allocation-sum (policy-id: uint))
  (let ((policy (get-policy policy-id))
        (allocations (get-policy-allocations policy-id))
        (allocation-sum (fold + (map get-amount allocations) u0)))
    (is-eq allocation-sum (get required-collateral policy))))

;; Verify sum of all premium distributions equals policy premium
(define-private (verify-premium-distribution-sum (policy-id: uint))
  (let ((policy (get-policy policy-id))
        (distributions (get-premium-distributions-by-policy policy-id))
        (distribution-sum (fold + (map get-amount distributions) u0)))
    (is-eq distribution-sum (get premium policy))))

;; Verify sum of all provider settlement contributions equals total settlement
(define-private (verify-settlement-sum (policy-id: uint))
  (let ((policy (get-policy policy-id))
        (settlement-impacts (get-settlement-impacts-by-policy policy-id))
        (impact-sum (fold + (map get-contribution settlement-impacts) u0)))
    (is-eq impact-sum (get settlementAmount policy))))
```

These verification mechanisms represent substantial additions to the current contracts.

## 3. European-Policy-Registry.clar Implementation

### 3.1 Core Data Structures

```clarity
;; Enhanced policy structure with European-specific fields
(define-map policies
  { id: uint }
  {
    owner: principal,                       ;; Policy owner (buyer)
    counterparty: principal,                ;; Counterparty (typically the pool)
    protected-value: uint,                  ;; Strike price in base units
    protection-amount: uint,                ;; Amount being protected
    expiration-height: uint,                ;; Block height when policy expires
    premium: uint,                          ;; Premium amount paid (submitted, verified on-chain)
    policy-type: (string-ascii 4),          ;; "PUT" or "CALL"
    position-type: (string-ascii 9),        ;; "LONG_PUT" or "LONG_CALL"
    counterparty-position-type: (string-ascii 9), ;; "SHORT_PUT" or "SHORT_CALL"
    collateral-token: (string-ascii 4),     ;; Token used as collateral
    protected-asset: (string-ascii 4),      ;; Asset being protected
    settlement-token: (string-ascii 4),     ;; Token used for settlement if exercised
    status: (string-ascii 10),              ;; "Active", "Settled", "Expired"
    creation-height: uint,                  ;; Block height when created
    premium-distributed: bool,              ;; Whether premium distributed to counterparty
    settlement-price: uint,                 ;; Price at expiration (new)
    settlement-amount: uint,                ;; Amount settled (new)
    is-settled: bool,                       ;; Whether settlement processed (new)
    risk-tier: (string-ascii 32)            ;; Risk tier (e.g., "Conservative", "Standard")
  }
)

;; Counter for policy IDs
(define-data-var policy-id-counter uint u0)

;; Policy indexing by owner
(define-map policies-by-owner
  { owner: principal }
  { policy-ids: (list 50 uint) }
)

;; Policy indexing by counterparty
(define-map policies-by-counterparty
  { counterparty: principal }
  { policy-ids: (list 50 uint) }
)

;; Expiration-focused indexing (new)
(define-map policies-by-expiration-height
  { height: uint }
  { policy-ids: (list 50 uint) }
)

;; Settlement tracking (new)
(define-map policy-settlements
  { policy-id: uint }
  {
    settlement-price: uint,
    settlement-amount: uint,
    settlement-height: uint,
    settlement-timestamp: uint
  }
)

;; Pending premium distributions queue (new)
(define-map pending-premium-distributions
  { policy-id: uint }
  { ready-for-distribution: bool }
)

;; Constants
(define-constant STATUS-ACTIVE "Active")
(define-constant STATUS-SETTLED "Settled")  ;; Changed from "Exercised" to "Settled"
(define-constant STATUS-EXPIRED "Expired")
```

### 3.2 Policy Creation (Similar to Current)

```clarity
(define-public (create-protection-policy
  (owner principal)
  (protected-value uint)
  (protection-amount uint)
  (expiration-height uint)
  (policy-type (string-ascii 4))
  (risk-tier (string-ascii 32))
  (submitted-premium uint)) ;; Premium calculated off-chain

  (let
    (
      (policy-id (var-get policy-id-counter))
      (next-id (+ policy-id u1))
      (owner-position-type (if (is-eq policy-type POLICY-TYPE-PUT)
                              POSITION-LONG-PUT
                              POSITION-LONG-CALL))
      (counterparty-position-type (if (is-eq policy-type POLICY-TYPE-PUT)
                                    POSITION-SHORT-PUT
                                    POSITION-SHORT-CALL))
      (collateral-token (if (is-eq policy-type POLICY-TYPE-PUT) TOKEN-STX TOKEN-SBTC))
      (settlement-token (if (is-eq policy-type POLICY-TYPE-PUT) TOKEN-STX TOKEN-SBTC))
      (protected-asset ASSET-BTC)
      (required-collateral (calculate-required-collateral protected-value protection-amount policy-type))
    )
    (begin
      ;; Basic validation
      (asserts! (or (is-eq policy-type POLICY-TYPE-PUT) (is-eq policy-type POLICY-TYPE-CALL))
                ERR-INVALID-POLICY-TYPE)
      (asserts! (> protected-value u0) ERR-ZERO-PROTECTED-VALUE)
      (asserts! (> protection-amount u0) ERR-ZERO-PROTECTION-AMOUNT)
      (asserts! (> expiration-height burn-block-height) ERR-EXPIRATION-IN-PAST)
      (asserts! (> submitted-premium u0) ERR-ZERO-PREMIUM) ;; Ensure submitted premium is positive

      ;; NEW: Verify the submitted premium (call to Math Library or specific verification function)
      (try! (contract-call? .math-library verify-premium
                             submitted-premium
                             protected-value
                             protection-amount
                             expiration-height
                             policy-type
                             risk-tier))

      ;; Check Liquidity Pool for available collateral BEFORE accepting premium
      (asserts!
        (unwrap! (contract-call? .european-liquidity-pool-vault check-liquidity
                       required-collateral collateral-token risk-tier expiration-height) ERR-LIQUIDITY-CHECK-FAILED)
        ERR-INSUFFICIENT-LIQUIDITY)

      ;; Collect premium from buyer (tx-sender is assumed to be the buyer or an agent)
      (try! (stx-transfer? submitted-premium tx-sender (as-contract tx-sender)))

      ;; Lock collateral in Liquidity Pool
      (try! (contract-call? .european-liquidity-pool-vault lock-collateral
                          policy-id required-collateral collateral-token risk-tier expiration-height))

      ;; Record premium payment in Liquidity Pool
      (try! (contract-call? .european-liquidity-pool-vault record-premium-payment
                          policy-id submitted-premium collateral-token expiration-height))

      ;; Insert the policy entry
      (map-set policies
        { id: policy-id }
        {
          owner: owner,
          counterparty: (contract-of .european-liquidity-pool-vault),  ;; Liquidity pool as counterparty
          protected-value: protected-value,
          protection-amount: protection-amount,
          expiration-height: expiration-height,
          premium: submitted-premium, ;; Use the verified submitted premium
          policy-type: policy-type,
          position-type: owner-position-type,
          counterparty-position-type: counterparty-position-type,
          collateral-token: collateral-token,
          protected-asset: protected-asset,
          settlement-token: settlement-token,
          status: STATUS-ACTIVE,
          creation-height: burn-block-height,
          premium-distributed: false,
          settlement-price: u0,
          settlement-amount: u0,
          is-settled: false,
          risk-tier: risk-tier
        }
      )

      ;; Update owner index
      (match (map-get? policies-by-owner { owner: owner })
        existing-entry
        (let
          (
            (existing-ids (get policy-ids existing-entry))
            (new-list (append existing-ids policy-id))
            (checked-list (unwrap! (as-max-len? new-list u50) ERR-POLICY-LIMIT-REACHED))
          )
          (map-set policies-by-owner
            { owner: owner }
            { policy-ids: checked-list }
          )
        )
        ;; No existing policies, create new list
        (map-set policies-by-owner
          { owner: owner }
          { policy-ids: (list policy-id) }
        )
      )

      ;; Update counterparty index
      (match (map-get? policies-by-counterparty
                     { counterparty: (contract-of .european-liquidity-pool-vault) })
        existing-entry
        (let
          (
            (existing-ids (get policy-ids existing-entry))
            (new-list (append existing-ids policy-id))
            (checked-list (unwrap! (as-max-len? new-list u50) ERR-POLICY-LIMIT-REACHED))
          )
          (map-set policies-by-counterparty
            { counterparty: (contract-of .european-liquidity-pool-vault) }
            { policy-ids: checked-list }
          )
        )
        ;; No existing policies, create new list
        (map-set policies-by-counterparty
          { counterparty: (contract-of .european-liquidity-pool-vault) }
          { policy-ids: (list policy-id) }
        )
      )

      ;; NEW: Update expiration index
      (match (map-get? policies-by-expiration-height { height: expiration-height })
        existing-entry
        (let
          (
            (existing-ids (get policy-ids existing-entry))
            (new-list (append existing-ids policy-id))
            (checked-list (unwrap! (as-max-len? new-list u50) ERR-POLICY-LIMIT-REACHED))
          )
          (map-set policies-by-expiration-height
            { height: expiration-height }
            { policy-ids: checked-list }
          )
        )
        ;; No existing policies for this height, create new list
        (map-set policies-by-expiration-height
          { height: expiration-height }
          { policy-ids: (list policy-id) }
        )
      )

      ;; Update counter
      (var-set policy-id-counter next-id)

      ;; Emit event
      (print {
        event: "policy-created",
        policy-id: policy-id,
        owner: owner,
        counterparty: (contract-of .european-liquidity-pool-vault),
        expiration-height: expiration-height,
        protected-value: protected-value,
        protection-amount: protection-amount,
        policy-type: policy-type,
        position-type: owner-position-type,
        counterparty-position-type: counterparty-position-type,
        collateral-token: collateral-token,
        settlement-token: settlement-token,
        protected-asset: protected-asset,
        premium: submitted-premium, ;; Use submitted premium in event
        risk-tier: risk-tier
      })

      (ok policy-id)
    )
  )
)
```

### 3.3 Expiration and Settlement Processing (Replacing Activation)

```clarity
;; Process policy at expiration
(define-public (process-expiration-and-settlement
  (policy-id uint)
  (expiration-price uint))

  (let
    (
      (policy (unwrap! (map-get? policies { id: policy-id }) ERR-NOT-FOUND))
      (previous-status (get status policy))
    )
    (begin
      ;; Verify caller is authorized
      (asserts! (is-eq tx-sender (var-get backend-authorized-principal)) ERR-UNAUTHORIZED)

      ;; Verify policy is active and has reached expiration
      (asserts! (is-eq previous-status STATUS-ACTIVE) ERR-NOT-ACTIVE)
      (asserts! (>= burn-block-height (get expiration-height policy)) ERR-NOT-YET-EXPIRED)

      ;; Determine if in-the-money (settlement needed) or out-of-the-money (premium distribution)
      (if (is-policy-in-the-money policy-id expiration-price)
          ;; In-the-money: Process settlement
          (process-settlement-at-expiration policy-id expiration-price)
          ;; Out-of-the-money: Prepare premium distribution
          (prepare-premium-distribution policy-id))
    )
  )
)

;; Determine if policy is in-the-money at expiration
(define-private (is-policy-in-the-money
  (policy-id uint)
  (expiration-price uint))

  (let
    ((policy (unwrap! (map-get? policies { id: policy-id }) ERR-NOT-FOUND)))
    (if (is-eq (get policy-type policy) POLICY-TYPE-PUT)
        ;; For PUT: in-the-money if price < strike
        (< expiration-price (get protected-value policy))
        ;; For CALL: in-the-money if price > strike
        (> expiration-price (get protected-value policy)))
  )
)

;; Process settlement for in-the-money policy
(define-private (process-settlement-at-expiration
  (policy-id uint)
  (expiration-price uint))

  (let
    (
      (policy (unwrap! (map-get? policies { id: policy-id }) ERR-NOT-FOUND))
      (settlement-amount (calculate-settlement-amount
                           (get policy-type policy)
                           (get protected-value policy)
                           expiration-price
                           (get protection-amount policy)))
    )
    (begin
      ;; Update policy status to Settled
      (map-set policies
        { id: policy-id }
        (merge policy
              { status: STATUS-SETTLED,
                settlement-price: expiration-price,
                settlement-amount: settlement-amount,
                is-settled: true }))

      ;; Process settlement through Liquidity Pool
      (try! (contract-call? .european-liquidity-pool-vault process-settlement-at-expiration
                          policy-id
                          (get owner policy)
                          settlement-amount
                          (get settlement-token policy)))

      ;; Record settlement details
      (map-set policy-settlements
               { policy-id: policy-id }
               { settlement-price: expiration-price,
                 settlement-amount: settlement-amount,
                 settlement-height: burn-block-height,
                 settlement-timestamp: burn-block-height })

      ;; Emit settlement event
      (print {
        event: "policy-settled-at-expiration",
        policy-id: policy-id,
        expiration-price: expiration-price,
        settlement-amount: settlement-amount,
        owner: (get owner policy),
        counterparty: (get counterparty policy),
        block-height: burn-block-height
      })

      (ok { status: "settled", settlement-amount: settlement-amount })
    )
  )
)

;; Prepare premium distribution for out-of-the-money policy
(define-private (prepare-premium-distribution
  (policy-id uint))

  (let
    ((policy (unwrap! (map-get? policies { id: policy-id }) ERR-NOT-FOUND)))
    (begin
      ;; Update policy status to Expired
      (map-set policies
        { id: policy-id }
        (merge policy
              { status: STATUS-EXPIRED }))

      ;; Add to premium distribution queue
      (map-set pending-premium-distributions
               { policy-id: policy-id }
               { ready-for-distribution: true })

      ;; Emit expiration event
      (print {
        event: "policy-expired-at-expiration",
        policy-id: policy-id,
        premium-amount: (get premium policy),
        owner: (get owner policy),
        counterparty: (get counterparty policy),
        block-height: burn-block-height
      })

      (ok { status: "expired" })
    )
  )
)

;; Batch process policies expiring at a specific height
(define-public (process-expiration-batch
  (block-height uint)
  (expiration-price uint))

  (let
    ((expiring-policies (unwrap! (map-get? policies-by-expiration-height
                                         { height: block-height })
                               (ok { policy-ids: (list) }))))
    (fold process-policy-at-expiration
          (get policy-ids expiring-policies)
          { processed-count: u0,
            settled-count: u0,
            expired-count: u0 })
  )
)

;; Helper function for batch processing
(define-private (process-policy-at-expiration
  (policy-id uint)
  (result { processed-count: uint, settled-count: uint, expired-count: uint }))

  (match (process-expiration-and-settlement policy-id expiration-price)
    settlement-result
      (if (is-policy-in-the-money policy-id expiration-price)
          ;; Policy was settled
          (merge result
                { processed-count: (+ (get processed-count result) u1),
                  settled-count: (+ (get settled-count result) u1) })
          ;; Policy was expired
          (merge result
                { processed-count: (+ (get processed-count result) u1),
                  expired-count: (+ (get expired-count result) u1) }))
    ;; Error case - just increment processed count
    (merge result
          { processed-count: (+ (get processed-count result) u1) })
  )
)
```

### 3.4 Premium Distribution

```clarity
;; Distribute premium for expired policy
(define-public (distribute-premium
  (policy-id uint))

  (let
    (
      (policy (unwrap! (map-get? policies { id: policy-id }) ERR-NOT-FOUND))
      (is-ready (unwrap! (map-get? pending-premium-distributions
                                  { policy-id: policy-id })
                        ERR-NOT-FOUND))
    )
    (begin
      ;; Verify caller is authorized
      (asserts! (is-eq tx-sender (var-get backend-authorized-principal)) ERR-UNAUTHORIZED)

      ;; Verify policy is expired and premium not yet distributed
      (asserts! (is-eq (get status policy) STATUS-EXPIRED) ERR-NOT-EXPIRED)
      (asserts! (not (get premium-distributed policy)) ERR-PREMIUM-ALREADY-DISTRIBUTED)
      (asserts! (get ready-for-distribution is-ready) ERR-NOT-READY)

      ;; Distribute premium to counterparty (Liquidity Pool)
      (try! (contract-call? .european-liquidity-pool-vault distribute-premium-to-providers
                          policy-id
                          (get premium policy)
                          (get collateral-token policy)))

      ;; Mark premium as distributed
      (map-set policies
        { id: policy-id }
        (merge policy { premium-distributed: true }))

      ;; Remove from distribution queue
      (map-delete pending-premium-distributions { policy-id: policy-id })

      ;; Emit premium distribution event
      (print {
        event: "premium-distributed",
        policy-id: policy-id,
        premium-amount: (get premium policy),
        counterparty: (get counterparty policy),
        block-height: burn-block-height
      })

      (ok { premium-distributed: true })
    )
  )
)

;; Batch distribute premiums
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
    success
      (merge result
            { distributed-count: (+ (get distributed-count result) u1) })
    error
      (merge result
            { failed-count: (+ (get failed-count result) u1) })
  )
)
```

### 3.5 Read-Only Functions

```clarity
;; Get policies expiring at a specific block height
(define-read-only (get-policies-by-expiration-height
  (height uint))

  (map-get? policies-by-expiration-height { height: height })
)

;; Check if policy is ready for premium distribution
(define-read-only (is-ready-for-premium-distribution
  (policy-id uint))

  (match (map-get? pending-premium-distributions { policy-id: policy-id })
    distribution-status (get ready-for-distribution distribution-status)
    false)
)

;; Get settlement details for a policy
(define-read-only (get-settlement-details
  (policy-id uint))

  (map-get? policy-settlements { policy-id: policy-id })
)

;; Calculate settlement amount based on expiration price
(define-read-only (calculate-settlement-amount
  (policy-type (string-ascii 4))
  (protected-value uint)
  (expiration-price uint)
  (protection-amount uint))

  (if (is-eq policy-type POLICY-TYPE-PUT)
      ;; For PUT: (strike - price) * amount / strike
      (if (>= expiration-price protected-value)
          u0
          (/ (* (- protected-value expiration-price) protection-amount) protected-value))
      ;; For CALL: (price - strike) * amount / strike
      (if (<= expiration-price protected-value)
          u0
          (/ (* (- expiration-price protected-value) protection-amount) protected-value))
  )
)

;; NEW: Example structure for a premium verification function (likely in Math Library)
;; This is a placeholder and needs to be defined based on actual verification logic.
(define-read-only (verify-premium
  (submitted-premium uint)
  (protected-value uint)
  (protection-amount uint)
  (expiration-height uint)
  (policy-type (string-ascii 4))
  (risk-tier (string-ascii 32)))
  (begin
    ;; Example: Basic sanity check - premium should not be excessively large or small.
    ;; More sophisticated checks would involve parameters from BitHedgeParametersContract
    ;; and potentially simplified calculations or range checks based on inputs.
    (asserts! (is-ok (check-premium-bounds submitted-premium protected-value expiration-height risk-tier)) ERR-PREMIUM-OUT-OF-BOUNDS)
    ;; If all checks pass:
    (ok true)
  )
)

(define-private (check-premium-bounds
  (premium uint)
  (value uint)
  (expiry uint)
  (tier (string-ascii 32)))
  ;; Placeholder for actual bounds checking logic.
  ;; This would likely involve parameters for min/max acceptable premium ratios or ranges.
  ;; For example, premium should be > 0.01% of value and < 50% of value (highly simplified).
  (if (and (> premium (/ value u10000)) (< premium (/ value u2)))
      (ok true)
      (err ERR-PREMIUM-OUT-OF-BOUNDS)
  )
)

;; Get theoretical value of a policy at current price
;; Note: This is for UI display only, not for settlement
(define-read-only (get-theoretical-value
  (policy-id uint)
  (current-price uint))

  (let
    ((policy (unwrap! (map-get? policies { id: policy-id }) (ok u0))))

    ;; Only calculate theoretical value for active policies
    (if (not (is-eq (get status policy) STATUS-ACTIVE))
        (ok u0)
        (ok (calculate-settlement-amount
              (get policy-type policy)
              (get protected-value policy)
              current-price
              (get protection-amount policy))))
  )
)
```

## 4. European-Liquidity-Pool-Vault.clar Implementation

### 4.1 Core Data Structures

```clarity
;; Token balance tracking
(define-map token-balances
  { token: (string-ascii 32) }
  {
    balance: uint,              ;; Total balance of token in vault
    availableBalance: uint,     ;; Available balance (not locked)
    lockedBalance: uint         ;; Locked balance (allocated to policies)
  }
)

;; Enhanced provider balance tracking
(define-map provider-balances
  { provider: principal, token: (string-ascii 32) }
  {
    depositedAmount: uint,      ;; Total deposited amount
    allocatedAmount: uint,      ;; Amount allocated to policies
    availableAmount: uint,      ;; Amount available for allocation
    earnedPremiums: uint,       ;; Total earned premiums
    pendingPremiums: uint,      ;; Premiums pending distribution
    expirationExposure: (map uint uint)  ;; Map of expiration heights to exposure amounts
  }
)

;; Enhanced provider allocation tracking
(define-map provider-allocations
  { provider: principal, policy-id: uint }
  {
    token: (string-ascii 32),
    allocatedAmount: uint,           ;; Amount allocated to this policy
    allocationPercentage: uint,      ;; Percentage of policy's total collateral
    premiumShare: uint,              ;; Share of premium for this policy
    expirationHeight: uint,          ;; NEW: Expiration height
    riskTier: (string-ascii 32),     ;; NEW: Risk tier
    allocationTimestamp: uint,       ;; NEW: Allocation timestamp
    premiumDistributed: bool         ;; Whether premium has been distributed
  }
)

;; Provider expiration exposure tracking (NEW)
(define-map provider-expiration-exposure
  { provider: principal, expiration-height: uint }
  {
    allocatedAmount: uint,       ;; Total amount allocated to this expiration height
    policyCount: uint,           ;; Number of policies at this expiration height
    maxPotentialSettlement: uint ;; Maximum potential settlement amount
  }
)

;; Settlement impact tracking (NEW)
(define-map settlement-impacts
  { policy-id: uint, provider: principal }
  {
    originalAllocation: uint,     ;; Provider's original allocation
    settlementContribution: uint, ;; Provider's contribution to settlement
    remainingAllocation: uint,    ;; Remaining allocation after settlement
    settlementPercentage: uint,   ;; Percentage of provider's allocation used
    settlementTimestamp: uint     ;; When settlement occurred
  }
)

;; Premium distribution records (NEW)
(define-map premium-distributions
  { policy-id: uint, provider: principal }
  {
    premiumAmount: uint,         ;; Provider's share of premium
    calculationBasis: uint,      ;; Original allocation amount used for calculation
    allocationPercentage: uint,  ;; Provider's percentage of total collateral
    distributionTimestamp: uint, ;; When distribution occurred
    status: (string-ascii 32)    ;; "Pending", "Processing", "Completed"
  }
)

;; Expiration liquidity needs tracking (NEW)
(define-map expiration-liquidity-needs
  { height: uint }
  {
    totalCollateralRequired: uint,   ;; Total collateral needed at this expiration
    maxPotentialSettlement: uint,    ;; Maximum possible settlement amount
    policiesExpiring: uint,          ;; Count of policies expiring
    isLiquidityPrepared: bool        ;; Whether liquidity has been prepared
  }
)

;; Risk tier parameters (NEW)
(define-map risk-tier-parameters
  { tier: (string-ascii 32) }
  {
    collateralRatio: uint,           ;; Required collateral ratio (e.g., 110 for 110%)
    premiumMultiplier: uint,         ;; Premium adjustment multiplier
    maxExposurePercentage: uint,     ;; Maximum exposure per provider
    description: (string-ascii 256)  ;; Human-readable description
  }
)

;; Premium accounting
(define-map premium-balances
  { token: (string-ascii 32) }
  {
    totalPremiums: uint,          ;; Total premiums collected
    distributedPremiums: uint     ;; Total premiums distributed
  }
)
```

### 4.2 Capital Management

```clarity
;; Deposit capital into the liquidity pool
(define-public (deposit-capital
  (amount uint)
  (token-id (string-ascii 32))
  (risk-tier (string-ascii 32)))

  (begin
    (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
    (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)
    (asserts! (is-valid-risk-tier risk-tier) ERR-INVALID-RISK-TIER)

    ;; Transfer tokens from user to contract
    (if (is-eq token-id "STX")
        (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
        (try! (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer
                            amount tx-sender (as-contract tx-sender) none))
    )

    ;; Update global token balance
    (let ((current-balance (default-to { balance: u0, availableBalance: u0, lockedBalance: u0 }
                                    (map-get? token-balances { token: token-id }))))
      (map-set token-balances
              { token: token-id }
              { balance: (+ (get balance current-balance) amount),
                availableBalance: (+ (get availableBalance current-balance) amount),
                lockedBalance: (get lockedBalance current-balance) })
    )

    ;; Update provider's balance
    (let ((provider-balance (default-to
                            { depositedAmount: u0,
                              allocatedAmount: u0,
                              availableAmount: u0,
                              earnedPremiums: u0,
                              pendingPremiums: u0,
                              expirationExposure: (map-new) }
                            (map-get? provider-balances
                                    { provider: tx-sender, token: token-id }))))
      (map-set provider-balances
               { provider: tx-sender, token: token-id }
               { depositedAmount: (+ (get depositedAmount provider-balance) amount),
                 allocatedAmount: (get allocatedAmount provider-balance),
                 availableAmount: (+ (get availableAmount provider-balance) amount),
                 earnedPremiums: (get earnedPremiums provider-balance),
                 pendingPremiums: (get pendingPremiums provider-balance),
                 expirationExposure: (get expirationExposure provider-balance) })
    )

    ;; Emit deposit event
    (print {
      event: "funds-deposited",
      depositor: tx-sender,
      amount: amount,
      token: token-id,
      risk-tier: risk-tier,
      timestamp: burn-block-height
    })

    (ok { success: true })
  )
)

;; Withdraw available capital
(define-public (withdraw-capital
  (amount uint)
  (token-id (string-ascii 32)))

  (let (
      (provider-balance (unwrap! (map-get? provider-balances
                                         { provider: tx-sender, token: token-id })
                               ERR-NOT-FOUND))
      (available-amount (get availableAmount provider-balance))
    )
    (begin
      (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
      (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)
      (asserts! (>= available-amount amount) ERR-NOT-ENOUGH-BALANCE)

      ;; Transfer tokens from contract to user
      (if (is-eq token-id "STX")
          (try! (as-contract (stx-transfer? amount tx-sender tx-sender)))
          (try! (as-contract (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer
                                           amount tx-sender tx-sender none)))
      )

      ;; Update global token balance
      (let ((current-balance (unwrap! (map-get? token-balances { token: token-id })
                                    ERR-NOT-FOUND)))
        (map-set token-balances
                { token: token-id }
                { balance: (- (get balance current-balance) amount),
                  availableBalance: (- (get availableBalance current-balance) amount),
                  lockedBalance: (get lockedBalance current-balance) })
      )

      ;; Update provider's balance
      (map-set provider-balances
               { provider: tx-sender, token: token-id }
               { depositedAmount: (get depositedAmount provider-balance),
                 allocatedAmount: (get allocatedAmount provider-balance),
                 availableAmount: (- available-amount amount),
                 earnedPremiums: (get earnedPremiums provider-balance),
                 pendingPremiums: (get pendingPremiums provider-balance),
                 expirationExposure: (get expirationExposure provider-balance) })

      ;; Emit withdrawal event
      (print {
        event: "funds-withdrawn",
        withdrawer: tx-sender,
        amount: amount,
        token: token-id,
        timestamp: burn-block-height
      })

      (ok { success: true })
    )
  )
)
```

### 4.3 Liquidity and Collateral Management

```clarity
;; Check if sufficient liquidity is available
(define-public (check-liquidity
  (amount uint)
  (token-id (string-ascii 32))
  (risk-tier (string-ascii 32))
  (expiration-height uint))

  (let (
      (current-balance (default-to
                       { balance: u0, availableBalance: u0, lockedBalance: u0 }
                       (map-get? token-balances { token: token-id })))
      (available-balance (get availableBalance current-balance))
      (expiration-needs (default-to
                        { totalCollateralRequired: u0,
                          maxPotentialSettlement: u0,
                          policiesExpiring: u0,
                          isLiquidityPrepared: false }
                        (map-get? expiration-liquidity-needs
                                 { height: expiration-height })))
      (tier-params (unwrap! (map-get? risk-tier-parameters { tier: risk-tier })
                          ERR-INVALID-RISK-TIER))
    )
    (begin
      ;; Check token support
      (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)

      ;; Check if sufficient total liquidity exists
      (asserts! (>= available-balance amount) ERR-INSUFFICIENT-LIQUIDITY)

      ;; Check if sufficient liquidity exists in the requested risk tier
      (asserts! (has-sufficient-tier-liquidity amount token-id risk-tier)
              ERR-INSUFFICIENT-TIER-LIQUIDITY)

      ;; Check if there's no excessive concentration at the expiration height
      (asserts! (< (+ (get totalCollateralRequired expiration-needs) amount)
                 (* available-balance (get maxExposurePercentage tier-params) u100))
              ERR-EXCESSIVE-EXPIRATION-CONCENTRATION)

      (ok true)
    )
  )
)

;; Lock collateral for a policy
(define-public (lock-collateral
  (policy-id uint)
  (amount uint)
  (token-id (string-ascii 32))
  (risk-tier (string-ascii 32))
  (expiration-height uint))

  (let (
      (current-balance (unwrap! (map-get? token-balances { token: token-id })
                               ERR-NOT-FOUND))
      (expiration-needs (default-to
                        { totalCollateralRequired: u0,
                          maxPotentialSettlement: u0,
                          policiesExpiring: u0,
                          isLiquidityPrepared: false }
                        (map-get? expiration-liquidity-needs
                                 { height: expiration-height })))
    )
    (begin
      ;; Verify caller is the policy registry
      (asserts! (is-eq tx-sender (var-get policy-registry-principal)) ERR-UNAUTHORIZED)
      (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
      (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)

      ;; Verify sufficient liquidity is available
      (asserts! (>= (get availableBalance current-balance) amount)
               ERR-INSUFFICIENT-LIQUIDITY)

      ;; Update global token balance locking
      (map-set token-balances
              { token: token-id }
              { balance: (get balance current-balance),
                availableBalance: (- (get availableBalance current-balance) amount),
                lockedBalance: (+ (get lockedBalance current-balance) amount) })

      ;; Update expiration-specific tracking
      (map-set expiration-liquidity-needs
              { height: expiration-height }
              { totalCollateralRequired: (+ (get totalCollateralRequired expiration-needs) amount),
                maxPotentialSettlement: (+ (get maxPotentialSettlement expiration-needs) amount),
                policiesExpiring: (+ (get policiesExpiring expiration-needs) u1),
                isLiquidityPrepared: (get isLiquidityPrepared expiration-needs) })

      ;; Allocate provider capital to this policy
      (allocate-provider-capital policy-id amount token-id risk-tier expiration-height)

      ;; Emit collateral locked event
      (print {
        event: "collateral-locked",
        policy-id: policy-id,
        amount-locked: amount,
        token: token-id,
        expiration-height: expiration-height,
        timestamp: burn-block-height
      })

      (ok { success: true })
    )
  )
)

;; Allocate provider capital to a policy
(define-private (allocate-provider-capital
  (policy-id uint)
  (amount uint)
  (token-id (string-ascii 32))
  (risk-tier (string-ascii 32))
  (expiration-height uint))

  (let (
      (providers (select-providers-for-allocation amount token-id risk-tier))
      (selected-providers (get providers providers))
      (allocated-amounts (get amounts providers))
    )
    (begin
      ;; Allocate to each selected provider
      (map allocate-to-provider (zip selected-providers allocated-amounts))

      ;; Verify total allocation equals requested amount
      (verify-allocation-sum policy-id amount)

      { success: true }
    )
  )
)

;; Helper function to allocate to a specific provider
(define-private (allocate-to-provider
  (provider-allocation (tuple (provider principal) (amount uint))))

  (let (
      (provider (get provider provider-allocation))
      (amount (get amount provider-allocation))
      (percentage (calculate-percentage amount total-allocation))
      (provider-balance (unwrap! (map-get? provider-balances
                                          { provider: provider, token: token-id })
                                ERR-NOT-FOUND))
    )
    (begin
      ;; Update provider's balance
      (map-set provider-balances
               { provider: provider, token: token-id }
               { depositedAmount: (get depositedAmount provider-balance),
                 allocatedAmount: (+ (get allocatedAmount provider-balance) amount),
                 availableAmount: (- (get availableAmount provider-balance) amount),
                 earnedPremiums: (get earnedPremiums provider-balance),
                 pendingPremiums: (get pendingPremiums provider-balance),
                 expirationExposure: (get expirationExposure provider-balance) })

      ;; Record allocation
      (map-set provider-allocations
               { provider: provider, policy-id: policy-id }
               { token: token-id,
                 allocatedAmount: amount,
                 allocationPercentage: percentage,
                 premiumShare: percentage,
                 expirationHeight: expiration-height,
                 riskTier: risk-tier,
                 allocationTimestamp: burn-block-height,
                 premiumDistributed: false })

      ;; Update provider's expiration exposure
      (update-provider-expiration-exposure
        provider expiration-height amount true)

      ;; Emit allocation event
      (print {
        event: "provider-allocated",
        provider: provider,
        policy-id: policy-id,
        amount: amount,
        percentage: percentage,
        token: token-id,
        expiration-height: expiration-height,
        risk-tier: risk-tier,
        timestamp: burn-block-height
      })
    )
  )
)
```

### 4.4 Settlement Processing

```clarity
;; Process settlement at expiration
(define-public (process-settlement-at-expiration
  (policy-id uint)
  (recipient principal)
  (settlement-amount uint)
  (token-id (string-ascii 32)))

  (begin
    ;; Verify caller is the policy registry
    (asserts! (is-eq tx-sender (var-get policy-registry-principal)) ERR-UNAUTHORIZED)
    (asserts! (> settlement-amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
    (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)

    ;; Get total pool balance
    (let ((current-balance (unwrap! (map-get? token-balances { token: token-id })
                                  ERR-NOT-FOUND)))
      ;; Ensure sufficient balance for settlement
      (asserts! (>= (get balance current-balance) settlement-amount)
               ERR-NOT-ENOUGH-BALANCE)

      ;; Transfer settlement amount to recipient
      (if (is-eq token-id "STX")
          (try! (as-contract (stx-transfer? settlement-amount tx-sender recipient)))
          (try! (as-contract (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer
                                          settlement-amount tx-sender recipient none)))
      )

      ;; Update global token balance
      (map-set token-balances
              { token: token-id }
              { balance: (- (get balance current-balance) settlement-amount),
                availableBalance: (get availableBalance current-balance),
                lockedBalance: (- (get lockedBalance current-balance) settlement-amount) })

      ;; Calculate and record each provider's settlement contribution
      (distribute-settlement-impact policy-id settlement-amount token-id)

      ;; Release remaining collateral
      (release-remaining-collateral policy-id token-id)

      ;; Emit settlement event
      (print {
        event: "settlement-at-expiration",
        policy-id: policy-id,
        recipient: recipient,
        settlement-amount: settlement-amount,
        token: token-id,
        timestamp: burn-block-height
      })

      (ok { success: true })
    )
  )
)

;; Calculate each provider's settlement contribution
(define-private (distribute-settlement-impact
  (policy-id uint)
  (total-settlement uint)
  (token-id (string-ascii 32)))

  (let ((allocations (get-policy-allocations policy-id)))
    (begin
      (map
        (lambda (allocation)
          (let ((provider (get provider allocation))
                (allocation-percentage (get allocationPercentage allocation))
                (provider-settlement (/ (* total-settlement allocation-percentage) u100)))

            ;; Record provider's settlement contribution
            (map-set settlement-impacts
                    { policy-id: policy-id, provider: provider }
                    { originalAllocation: (get allocatedAmount allocation),
                      settlementContribution: provider-settlement,
                      remainingAllocation: (- (get allocatedAmount allocation) provider-settlement),
                      settlementPercentage: (/ (* provider-settlement u100)
                                              (get allocatedAmount allocation)),
                      settlementTimestamp: burn-block-height })

            ;; Update provider's balance
            (update-provider-balance
              provider provider-settlement token-id "settle")
          ))
        allocations
      )

      ;; Verify settlement distribution
      (verify-settlement-sum policy-id total-settlement)

      { success: true }
    )
  )
)

;; Release remaining collateral after settlement
(define-private (release-remaining-collateral
  (policy-id uint)
  (token-id (string-ascii 32)))

  (let ((allocations (get-policy-allocations policy-id))
        (settlement-impacts (get-settlement-impacts policy-id)))
    (begin
      ;; Calculate total remaining collateral
      (let ((total-allocated (fold sum-allocations allocations u0))
            (total-settled (fold sum-settlements settlement-impacts u0))
            (remaining-collateral (- total-allocated total-settled)))

        ;; Update global token balances
        (let ((current-balance (unwrap! (map-get? token-balances { token: token-id })
                                      ERR-NOT-FOUND)))
          (map-set token-balances
                  { token: token-id }
                  { balance: (get balance current-balance),
                    availableBalance: (+ (get availableBalance current-balance) remaining-collateral),
                    lockedBalance: (- (get lockedBalance current-balance) remaining-collateral) })
        )

        ;; Update each provider's available balance
        (map
          (lambda (allocation)
            (let ((provider (get provider allocation))
                  (impact (unwrap! (map-get? settlement-impacts
                                          { policy-id: policy-id, provider: provider })
                                 (default-settlement-impact))))
              ;; Update provider's available balance with remaining allocation
              (update-provider-balance
                provider
                (get remainingAllocation impact)
                token-id
                "release")
            ))
          allocations
        )

        ;; Emit event
        (print {
          event: "remaining-collateral-released",
          policy-id: policy-id,
          remaining-collateral: remaining-collateral,
          token: token-id,
          timestamp: burn-block-height
        })

        { released-amount: remaining-collateral }
      )
    )
  )
)
```

### 4.5 Premium Distribution

```clarity
;; Record premium payment
(define-public (record-premium-payment
  (policy-id uint)
  (premium uint)
  (token-id (string-ascii 32))
  (expiration-height uint))

  (begin
    ;; Verify caller is the policy registry
    (asserts! (is-eq tx-sender (var-get policy-registry-principal)) ERR-UNAUTHORIZED)
    (asserts! (> premium u0) ERR-AMOUNT-MUST-BE-POSITIVE)
    (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)

    ;; Update premium accounting
    (let ((current-premiums (default-to
                            { totalPremiums: u0, distributedPremiums: u0 }
                            (map-get? premium-balances { token: token-id }))))
      (map-set premium-balances
              { token: token-id }
              { totalPremiums: (+ (get totalPremiums current-premiums) premium),
                distributedPremiums: (get distributedPremiums current-premiums) })
    )

    ;; Emit premium recording event
    (print {
      event: "premium-recorded",
      policy-id: policy-id,
      premium-amount: premium,
      token: token-id,
      expiration-height: expiration-height,
      timestamp: burn-block-height
    })

    (ok { success: true })
  )
)

;; Distribute premium to providers
(define-public (distribute-premium-to-providers
  (policy-id uint)
  (premium-amount uint)
  (token-id (string-ascii 32)))

  (begin
    ;; Verify caller is the policy registry
    (asserts! (is-eq tx-sender (var-get policy-registry-principal)) ERR-UNAUTHORIZED)
    (asserts! (> premium-amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)

    ;; Get policy allocations
    (let ((allocations (get-policy-allocations policy-id)))
      ;; Distribute premium to each provider
      (map
        (lambda (allocation)
          (let ((provider (get provider allocation))
                (percentage (get premiumShare allocation))
                (provider-premium (/ (* premium-amount percentage) u100)))

            ;; Record premium distribution
            (map-set premium-distributions
                    { policy-id: policy-id, provider: provider }
                    { premiumAmount: provider-premium,
                      calculationBasis: (get allocatedAmount allocation),
                      allocationPercentage: percentage,
                      distributionTimestamp: burn-block-height,
                      status: "Completed" })

            ;; Update provider's premium balance
            (update-provider-premium-balance
              provider provider-premium token-id)

            ;; Update allocation record
            (map-set provider-allocations
                    { provider: provider, policy-id: policy-id }
                    (merge allocation { premiumDistributed: true }))

            ;; Emit premium distribution event
            (print {
              event: "premium-distributed-to-provider",
              policy-id: policy-id,
              provider: provider,
              premium-amount: provider-premium,
              allocation-percentage: percentage,
              token: token-id,
              timestamp: burn-block-height
            })
          ))
        allocations
      )

      ;; Update global distributed premium accounting
      (let ((current-premiums (unwrap! (map-get? premium-balances { token: token-id })
                                     ERR-NOT-FOUND)))
        (map-set premium-balances
                { token: token-id }
                { totalPremiums: (get totalPremiums current-premiums),
                  distributedPremiums: (+ (get distributedPremiums current-premiums)
                                         premium-amount) })
      )

      ;; Verify premium distribution
      (verify-premium-distribution-sum policy-id premium-amount)

      ;; Release collateral
      (release-policy-collateral policy-id token-id)

      (ok { success: true })
    )
  )
)

;; Release collateral for expired policy
(define-private (release-policy-collateral
  (policy-id uint)
  (token-id (string-ascii 32)))

  (let ((allocations (get-policy-allocations policy-id)))
    (begin
      ;; Calculate total allocated collateral
      (let ((total-allocated (fold sum-allocations allocations u0)))

        ;; Update global token balances
        (let ((current-balance (unwrap! (map-get? token-balances { token: token-id })
                                       ERR-NOT-FOUND)))
          (map-set token-balances
                  { token: token-id }
                  { balance: (get balance current-balance),
                    availableBalance: (+ (get availableBalance current-balance) total-allocated),
                    lockedBalance: (- (get lockedBalance current-balance) total-allocated) })
        )

        ;; Update each provider's available balance
        (map
          (lambda (allocation)
            (let ((provider (get provider allocation))
                  (amount (get allocatedAmount allocation))
                  (expiration-height (get expirationHeight allocation)))

              ;; Update provider's available balance
              (update-provider-balance
                provider amount token-id "release")

              ;; Update provider's expiration exposure
              (update-provider-expiration-exposure
                provider expiration-height amount false)
            ))
          allocations
        )

        ;; Emit event
        (print {
          event: "policy-collateral-released",
          policy-id: policy-id,
          total-released: total-allocated,
          token: token-id,
          timestamp: burn-block-height
        })

        { released-amount: total-allocated }
      )
    )
  )
)

;; Claim pending premiums
(define-public (claim-pending-premiums
  (provider principal)
  (token-id (string-ascii 32)))

  (let ((provider-balance (unwrap! (map-get? provider-balances
                                          { provider: provider, token: token-id })
                                 ERR-NOT-FOUND)))
    (begin
      ;; Verify caller is the provider
      (asserts! (is-eq tx-sender provider) ERR-UNAUTHORIZED)

      ;; Verify there are premiums to claim
      (asserts! (> (get earnedPremiums provider-balance) u0) ERR-NO-PREMIUMS)

      ;; Transfer premiums to provider
      (if (is-eq token-id "STX")
          (try! (as-contract (stx-transfer?
                            (get earnedPremiums provider-balance)
                            tx-sender
                            provider)))
          (try! (as-contract (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer
                                           (get earnedPremiums provider-balance)
                                           tx-sender
                                           provider
                                           none)))
      )

      ;; Update provider's premium balance
      (map-set provider-balances
              { provider: provider, token: token-id }
              (merge provider-balance { earnedPremiums: u0 }))

      ;; Emit event
      (print {
        event: "premiums-claimed",
        provider: provider,
        amount: (get earnedPremiums provider-balance),
        token: token-id,
        timestamp: burn-block-height
      })

      (ok { claimed-amount: (get earnedPremiums provider-balance) })
    )
  )
)
```

### 4.6 Verification Functions

```clarity
;; Verify allocation sum matches policy requirement
(define-private (verify-allocation-sum
  (policy-id uint)
  (required-amount uint))

  (let ((allocations (get-policy-allocations policy-id))
        (total-allocated (fold sum-allocations allocations u0)))
    (asserts! (is-eq total-allocated required-amount) ERR-ALLOCATION-SUM-MISMATCH)
    true)
)

;; Verify premium distribution sum matches policy premium
(define-private (verify-premium-distribution-sum
  (policy-id uint)
  (premium-amount uint))

  (let ((distributions (get-premium-distributions-by-policy policy-id))
        (total-distributed (fold sum-premium-distributions distributions u0)))
    (asserts! (is-eq total-distributed premium-amount) ERR-DISTRIBUTION-SUM-MISMATCH)
    true)
)

;; Verify settlement sum matches policy settlement amount
(define-private (verify-settlement-sum
  (policy-id uint)
  (settlement-amount uint))

  (let ((impacts (get-settlement-impacts policy-id))
        (total-impact (fold sum-settlement-impacts impacts u0)))
    (asserts! (is-eq total-impact settlement-amount) ERR-SETTLEMENT-SUM-MISMATCH)
    true)
)

;; Get all allocations for a policy
(define-read-only (get-policy-allocations
  (policy-id uint))

  ;; Implementation details omitted for brevity
)

;; Get all premium distributions for a policy
(define-read-only (get-premium-distributions-by-policy
  (policy-id uint))

  ;; Implementation details omitted for brevity
)

;; Get all settlement impacts for a policy
(define-read-only (get-settlement-impacts
  (policy-id uint))

  ;; Implementation details omitted for brevity
)
```

## 5. Implementation Approach

### 5.1 Phased Approach

1. **Phase 1: Core Functionality**

   - Implement basic data structures and core functions
   - Focus on policy creation and management
   - Implement expiration processing logic
   - Develop settlement and premium distribution basics

2. **Phase 2: Enhanced Verification**

   - Add comprehensive verification mechanisms
   - Implement allocation tracking
   - Develop settlement impact tracking
   - Create premium distribution records

3. **Phase 3: Risk Tier System**

   - Implement risk tier parameters
   - Develop tier-aware allocation algorithms
   - Create tier-based premium calculations
   - Build validation mechanisms for risk tiers

4. **Phase 4: Optimization**
   - Implement batch processing for gas efficiency
   - Develop expiration-focused liquidity optimization
   - Create advanced allocation strategies
   - Build comprehensive event system for tracking

### 5.2 Migration Considerations

If migration from existing contracts is necessary:

1. **Data Migration Functions**

   ```clarity
   ;; Migrate an existing policy to the European model
   (define-public (migrate-policy
     (old-policy-id uint)
     (old-registry-principal principal))

     ;; Implementation details would depend on old contract structure
   )
   ```

2. **Phase-Out Period**

   - Allow existing American-style policies to reach natural expiration
   - Prevent new policies on the old contract
   - Redirect new creation to European-style contracts

3. **User Communication**
   - Clear UI explanations of the model change
   - Education about European-style settlement

## 6. Contract Deployment Strategy

1. **Initial Contracts**

   - Deploy `european-policy-registry.clar` and `european-liquidity-pool-vault.clar`
   - Configure contract addresses and principals

2. **Contract Integration**

   - Set up contract references between Policy Registry and Liquidity Pool
   - Connect to Oracle for price data
   - Establish administrative privileges

3. **Testing Phase**

   - Deploy to testnet with limited parameters
   - Test expiration and settlement processes
   - Verify verification mechanism accuracy

4. **Production Deployment**
   - Deploy final contracts with security audits completed
   - Configure risk tiers and parameters
   - Set up monitoring for expiration events

## 7. Conclusion

Transitioning to European-style options represents a significant architectural enhancement for BitHedge. By implementing fresh contracts rather than modifying the existing ones, we can create a cleaner, more efficient system with:

1. **Enhanced Capital Efficiency**: The European-style settlement model enables better capital planning and utilization.

2. **Improved Gas Efficiency**: Batch processing at expiration reduces overall transaction costs.

3. **Stronger Verification**: Comprehensive verification mechanisms ensure system correctness.

4. **Expiration-Optimized Architecture**: The entire system can be optimized around the predictable settlement points.

The implementation strategy outlined in this document provides a clear path forward, with specific code examples and a phased approach to minimize disruption while maximizing the benefits of the European-style model.
