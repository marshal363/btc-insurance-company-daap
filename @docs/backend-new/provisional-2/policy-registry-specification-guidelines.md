# BitHedge Policy Registry: On-Chain Contract Specification

## 1. Introduction

This document outlines the specification for the on-chain Policy Registry contract within the BitHedge platform. Following the "On-Chain Light" approach, this contract is designed to store only the essential data and logic needed for secure, trustless operation while leaving complex business logic, indexing, and metadata management to the off-chain Convex backend.

## 2. Contract Purpose

The Policy Registry contract serves as the official on-chain record of all BitHedge protection policies. Its core purposes are:

1. Store essential policy terms that define the financial agreement
2. Track policy ownership and status
3. Validate policy operations (activation, expiration)
4. Emit events for off-chain synchronization
5. Provide controlled access to policy data

## 3. Data Structures

### 3.1 Primary Data Structure

```clarity
;; Policy entry - the core data structure
(define-map policies
  { id: uint }                              ;; Key: unique policy ID
  {
    owner: principal,                       ;; Policy owner (buyer)
    counterparty: principal,                ;; Counterparty (typically the pool)
    protected-value: uint,                  ;; Strike price in base units (e.g., satoshis for BTC)
    protection-amount: uint,                ;; Amount being protected in base units
    expiration-height: uint,                ;; Block height when policy expires
    premium: uint,                          ;; Premium amount paid in base units
    policy-type: (string-ascii 4),          ;; "PUT" or "CALL"
    status: (string-ascii 10),              ;; "Active", "Exercised", "Expired"
    creation-height: uint                   ;; Block height when policy was created
  }
)

;; Counter for policy IDs
(define-data-var policy-id-counter uint u0)

;; Backend authorized principal - for automated operations
(define-data-var backend-authorized-principal principal tx-sender)
```

### 3.2 Indexing Data Structures

```clarity
;; Index of policies by owner
(define-map policies-by-owner
  { owner: principal }
  { policy-ids: (list 50 uint) }
)
```

### 3.3 Constants and Error Codes

```clarity
;; Error codes
(define-constant ERR-NOT-FOUND (err u404))
(define-constant ERR-UNAUTHORIZED (err u401))
(define-constant ERR-ALREADY-EXISTS (err u409))
(define-constant ERR-INVALID-STATUS (err u400))
(define-constant ERR-NOT-ACTIVE (err u403))
(define-constant ERR-EXPIRED (err u410))

;; Status constants
(define-constant STATUS-ACTIVE "Active")
(define-constant STATUS-EXERCISED "Exercised")
(define-constant STATUS-EXPIRED "Expired")

;; Policy type constants
(define-constant POLICY-TYPE-PUT "PUT")
(define-constant POLICY-TYPE-CALL "CALL")
```

## 4. Core Functions

### 4.1 Administrative Functions

```clarity
;; Set the backend authorized principal
;; Can only be called by the contract owner
(define-public (set-backend-authorized-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender (contract-owner)) ERR-UNAUTHORIZED)
    (var-set backend-authorized-principal new-principal)
    (ok true)))
```

### 4.2 Policy Management Functions

```clarity
;; Create a new policy entry
;; Can be called by any user (typically the policy buyer)
(define-public (create-policy-entry
  (owner principal)
  (counterparty principal)
  (protected-value uint)
  (protection-amount uint)
  (expiration-height uint)
  (premium uint)
  (policy-type (string-ascii 4)))

  (let
    (
      ;; Get next policy ID and increment counter
      (policy-id (var-get policy-id-counter))
      (next-id (+ policy-id u1))
    )
    (begin
      ;; Basic validation
      (asserts! (or (is-eq policy-type POLICY-TYPE-PUT) (is-eq policy-type POLICY-TYPE-CALL))
                (err u1001)) ;; Invalid policy type
      (asserts! (> protected-value u0) (err u1002)) ;; Protected value must be positive
      (asserts! (> protection-amount u0) (err u1003)) ;; Protection amount must be positive
      (asserts! (> expiration-height block-height) (err u1004)) ;; Expiration must be in future

      ;; Insert the policy entry
      (map-set policies
        { id: policy-id }
        {
          owner: owner,
          counterparty: counterparty,
          protected-value: protected-value,
          protection-amount: protection-amount,
          expiration-height: expiration-height,
          premium: premium,
          policy-type: policy-type,
          status: STATUS-ACTIVE,
          creation-height: block-height
        }
      )

      ;; Update owner index
      (match (map-get? policies-by-owner { owner: owner })
        existing-entry (map-set policies-by-owner
                          { owner: owner }
                          { policy-ids: (unwrap! (as-max-len?
                                                  (append (get policy-ids existing-entry) policy-id)
                                                  u50)
                                                (err u1005)) }) ;; Too many policies for one owner
        ;; No existing policies, create new list
        (map-set policies-by-owner
          { owner: owner }
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
        counterparty: counterparty,
        expiration-height: expiration-height,
        protected-value: protected-value,
        protected-amount: protection-amount,
        policy-type: policy-type,
        premium: premium
      })

      ;; Return the created policy ID
      (ok policy-id)
    )
  )
)

;; Update policy status
;; Can be called by the policy owner to activate (exercise)
;; Can be called by the backend authorized principal to expire
(define-public (update-policy-status
  (policy-id uint)
  (new-status (string-ascii 10)))

  (let
    (
      ;; Get the policy entry
      (policy (unwrap! (map-get? policies { id: policy-id }) ERR-NOT-FOUND))
      (previous-status (get status policy))
    )
    (begin
      ;; Validate the status transition
      (asserts! (or
                 ;; Owner can activate (exercise) an active policy
                 (and (is-eq tx-sender (get owner policy))
                      (is-eq previous-status STATUS-ACTIVE)
                      (is-eq new-status STATUS-EXERCISED))

                 ;; Backend can expire an active policy
                 (and (is-eq tx-sender (var-get backend-authorized-principal))
                      (is-eq previous-status STATUS-ACTIVE)
                      (is-eq new-status STATUS-EXPIRED))
                )
                ERR-UNAUTHORIZED)

      ;; If expiring, verify the policy is actually expired
      (if (is-eq new-status STATUS-EXPIRED)
          (asserts! (>= block-height (get expiration-height policy))
                    (err u1006)) ;; Policy not yet expired
          true)

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
        block-height: block-height
      })

      (ok true)
    )
  )
)
```

### 4.3 Batch Operations

```clarity
;; Expire multiple policies in a single transaction
;; Can only be called by the backend authorized principal
(define-public (expire-policies-batch (policy-ids (list 50 uint)))
  (begin
    ;; Verify caller is authorized
    (asserts! (is-eq tx-sender (var-get backend-authorized-principal))
              ERR-UNAUTHORIZED)

    ;; Use fold to process each policy ID
    (fold expire-policy-fold policy-ids (ok true))
  )
)

;; Helper function for batch expiration
(define-private (expire-policy-fold (policy-id uint) (previous-result (response bool uint)))
  (begin
    ;; Only proceed if previous operations succeeded
    (asserts! (is-ok previous-result) previous-result)

    ;; Try to expire this policy
    (match (try-expire-policy policy-id)
      success success
      error (ok true)) ;; Continue even if a policy fails
  )
)

;; Try to expire a single policy
(define-private (try-expire-policy (policy-id uint))
  (let
    (
      ;; Get the policy entry
      (policy (map-get? policies { id: policy-id }))
    )
    (match policy
      entry (begin
        ;; Only expire if active and past expiration
        (if (and (is-eq (get status entry) STATUS-ACTIVE)
                 (>= block-height (get expiration-height entry)))
            (begin
              ;; Update the policy status
              (map-set policies
                { id: policy-id }
                (merge entry { status: STATUS-EXPIRED })
              )

              ;; Emit event
              (print {
                event: "policy-status-updated",
                policy-id: policy-id,
                new-status: STATUS-EXPIRED,
                previous-status: (get status entry),
                block-height: block-height
              })

              (ok true)
            )
            (ok true)) ;; Skip if already non-active or not expired
      )
      (ok true) ;; Policy not found, just continue
    )
  )
)
```

> **IMPLEMENTATION NOTE:** The current implementation of `expire-policies-batch` has been simplified for the initial version of the contract. Instead of using the `fold` operation described above, it currently verifies authorization and logs the batch attempt but doesn't actually expire individual policies. This simplified approach was adopted to ensure contract compatibility and avoid potential syntax errors during the initial deployment.
>
> For the time being, the Convex backend should:
>
> 1. Continue to call `expire-policies-batch` for tracking purposes
> 2. Additionally use individual `update-policy-status` calls for each policy requiring expiration
> 3. A future update will implement the full fold-based batch processing as described in this specification
>
> This temporary limitation doesn't affect the core functionality as policies can still be expired individually, and the full batch implementation will be added in a subsequent update without changing the function signature.

### 4.4 Read-Only Functions

```clarity
;; Get a policy by ID
(define-read-only (get-policy (policy-id uint))
  (map-get? policies { id: policy-id }))

;; Get policy IDs for an owner
(define-read-only (get-policy-ids-by-owner (owner principal))
  (default-to { policy-ids: (list) }
              (map-get? policies-by-owner { owner: owner })))

;; Check if a policy is active
(define-read-only (is-policy-active (policy-id uint))
  (match (map-get? policies { id: policy-id })
    policy (is-eq (get status policy) STATUS-ACTIVE)
    false))

;; Check if a policy is exercisable
(define-read-only (is-policy-exercisable (policy-id uint) (current-price uint))
  (match (map-get? policies { id: policy-id })
    policy
    (and
      ;; Must be active
      (is-eq (get status policy) STATUS-ACTIVE)
      ;; Not expired
      (< block-height (get expiration-height policy))
      ;; Price conditions depending on policy type
      (if (is-eq (get policy-type policy) POLICY-TYPE-PUT)
          ;; For PUT: current price must be below protected value
          (< current-price (get protected-value policy))
          ;; For CALL: current price must be above protected value
          (> current-price (get protected-value policy))
      )
    )
    false))

;; Calculate settlement amount for a policy
(define-read-only (calculate-settlement-amount (policy-id uint) (current-price uint))
  (match (map-get? policies { id: policy-id })
    policy
    (let
      (
        (protected-value (get protected-value policy))
        (protection-amount (get protection-amount policy))
        (policy-type (get policy-type policy))
      )
      (if (is-eq policy-type POLICY-TYPE-PUT)
          ;; For PUT: (strike_price - current_price) * protection_amount / strike_price
          (/ (* (- protected-value current-price) protection-amount) protected-value)
          ;; For CALL: (current_price - strike_price) * protection_amount / strike_price
          (/ (* (- current-price protected-value) protection-amount) protected-value)
      )
    )
    u0))

;; Get the total number of policies
(define-read-only (get-policy-count)
  (var-get policy-id-counter))
```

## 5. Testing Guidelines

The Policy Registry contract should be thoroughly tested across the following dimensions:

### 5.1 Unit Tests

1. Policy creation with various parameters
2. Status transitions (Active → Exercised, Active → Expired)
3. Batch expiration of multiple policies
4. Authorization checks for all sensitive functions
5. Edge cases (e.g., policy at expiration boundary)

### 5.2 Integration Tests

1. Policy creation with premium payment to Liquidity Pool
2. Policy exercise with settlement from Liquidity Pool
3. Multi-contract workflows with Oracle price checks
4. Event emission and consumption by off-chain components

## 6. Gas Optimization Considerations

The "On-Chain Light" approach significantly reduces gas costs through several techniques:

1. **Minimal Data Storage**:

   - Only essential policy terms are stored on-chain
   - Derived data calculated off-chain

2. **Efficient Indexing**:

   - Limited number of indices
   - Constrained list sizes (e.g., max 50 policies per owner)

3. **Batch Operations**:

   - Support for bulk expiration reduces per-policy gas costs
   - Backend-initiated maintenance operations

4. **Read vs. Write Optimization**:
   - Expensive calculations available via read-only functions
   - Status updates only when necessary

## 7. Security Considerations

### 7.1 Authorization Model

1. **Owner-Only Operations**:

   - Policy owners can exercise their own policies
   - Owners cannot modify policy terms or affect others' policies

2. **Backend Operations**:

   - Backend can expire policies but only if they're past expiration
   - Backend cannot exercise policies or modify terms

3. **Contract Owner**:
   - Can update the backend authorized principal
   - Cannot directly modify policy data

### 7.2 Potential Vulnerabilities

1. **Front-Running**:

   - Policy activation could be front-run near boundary conditions
   - Mitigated by Oracle integration and price validation

2. **DoS Risks**:

   - List length limits prevent resource exhaustion
   - Batch operations constrained to reasonable sizes

3. **Data Validation**:
   - All inputs validated before processing
   - Explicit checks on critical values (e.g., prices, amounts)

## 8. Event Emission Standards

For effective off-chain synchronization, the contract emits standardized events:

```clarity
;; Policy Creation
(print {
  event: "policy-created",
  policy-id: uint,
  owner: principal,
  counterparty: principal,
  expiration-height: uint,
  protected-value: uint,
  protected-amount: uint,
  policy-type: (string-ascii 4),
  premium: uint
})

;; Status Updates
(print {
  event: "policy-status-updated",
  policy-id: uint,
  new-status: (string-ascii 10),
  previous-status: (string-ascii 10),
  block-height: uint
})
```

## 9. Performance Considerations

To optimize for performance, the contract:

1. Uses simple data structures that minimize lookup costs
2. Provides batch operations for efficiency
3. Keeps index updates minimal (one policy list per owner)
4. Avoids complex calculations in write operations
5. Uses appropriate data types to minimize storage needs

## 10. Contract Dependencies

The Policy Registry has these dependencies:

1. **Oracle Contract**: For price data during activation checks
2. **Liquidity Pool Vault**: For premium collection and settlement
3. **Parameter Contract**: For system configuration values

These contracts are referenced but not directly imported, maintaining modularity.

## 11. Comparison With Previous Approach

This "On-Chain Light" approach differs from the previous implementation:

### Previous Approach:

- Stored extensive metadata on-chain
- Managed complex indices for efficient queries
- Performed calculations and validations on-chain
- Attempted to handle all policy lifecycle management in contract

### Current Approach:

- Stores minimal core data on-chain
- Uses Convex for extensive indexing and queries
- Performs complex calculations off-chain
- Splits lifecycle management between on-chain and off-chain

## 12. Conclusion

The Policy Registry contract specification embodies the "On-Chain Light" architectural approach by focusing on:

1. Essential data storage for trust and security
2. Clear ownership and authorization boundaries
3. Minimal but sufficient event emission
4. Gas-efficient operations
5. Integration with the broader hybrid architecture

By keeping the on-chain footprint small while providing the necessary trust guarantees, this design balances security, scalability, and cost efficiency for the BitHedge platform.
