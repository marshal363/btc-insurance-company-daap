# BitHedge Liquidity Pool: Vault Contract Specification

## 1. Introduction

This document outlines the specification for the on-chain Liquidity Pool Vault contract within the BitHedge platform. Following the "On-Chain Light" approach, this contract is designed to provide secure custody of provider funds, process deposits and withdrawals, and facilitate settlement payments while minimizing on-chain state and computation.

## 2. Contract Purpose

The Liquidity Pool Vault contract serves as the secure on-chain treasury for the BitHedge platform. Its core purposes are:

1. Securely hold deposited funds (STX and sBTC)
2. Process deposits from liquidity providers
3. Process withdrawals to authorized recipients
4. Lock and release collateral for policy backing
5. Execute settlements to policy owners upon activation
6. Maintain minimal but sufficient accounting of total funds

## 3. Data Structures

### 3.1 Primary Data Structures

```clarity
;; Track total deposited amount for each token
(define-map token-balances
  { token-id: principal }   ;; Key: token contract address or 'STX for native STX
  { total-amount: uint }    ;; Value: total amount in base units
)

;; Track total amount locked as collateral for each token
(define-map locked-collateral
  { token-id: principal }
  { locked-amount: uint }
)

;; Authorized principals
(define-data-var policy-registry-principal principal tx-sender)
(define-data-var backend-authorized-principal principal tx-sender)
```

### 3.2 Constants and Error Codes

```clarity
;; Error codes
(define-constant ERR-UNAUTHORIZED (err u401))
(define-constant ERR-INSUFFICIENT-FUNDS (err u402))
(define-constant ERR-TRANSFER-FAILED (err u500))
(define-constant ERR-INVALID-TOKEN (err u405))
(define-constant ERR-AMOUNT-ZERO (err u403))

;; Supported token constants
(define-constant TOKEN-STX 'STX)  ;; Special identifier for native STX
(define-constant TOKEN-SBTC (as-contract tx-sender))  ;; Will be replaced with actual sBTC contract
```

## 4. Core Functions

### 4.1 Administrative Functions

```clarity
;; Set the policy registry principal
;; Can only be called by the contract owner
(define-public (set-policy-registry-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender (contract-owner)) ERR-UNAUTHORIZED)
    (var-set policy-registry-principal new-principal)
    (ok true)))

;; Set the backend authorized principal
;; Can only be called by the contract owner
(define-public (set-backend-authorized-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender (contract-owner)) ERR-UNAUTHORIZED)
    (var-set backend-authorized-principal new-principal)
    (ok true)))
```

### 4.2 Token Management Functions

```clarity
;; Initialize or update the balance record for a token
;; Only contract owner can add supported tokens
(define-public (initialize-token (token-id principal))
  (begin
    (asserts! (is-eq tx-sender (contract-owner)) ERR-UNAUTHORIZED)
    (asserts! (or (is-eq token-id TOKEN-STX)
                 (contract-call? token-id is-token-valid))
             ERR-INVALID-TOKEN)

    ;; Initialize token balance if not present
    (match (map-get? token-balances { token-id: token-id })
      existing-balance true
      ;; New token, initialize
      (map-set token-balances
        { token-id: token-id }
        { total-amount: u0 })
    )

    ;; Initialize locked collateral if not present
    (match (map-get? locked-collateral { token-id: token-id })
      existing-lock true
      ;; New token, initialize locked amount
      (map-set locked-collateral
        { token-id: token-id }
        { locked-amount: u0 })
    )

    (ok true)
  ))
```

### 4.3 Deposit Functions

```clarity
;; Deposit STX to the pool
;; Can be called by any user
(define-public (deposit-stx (amount uint))
  (begin
    ;; Validate amount
    (asserts! (> amount u0) ERR-AMOUNT-ZERO)

    ;; Transfer STX from sender to contract
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))

    ;; Update total balance
    (match (map-get? token-balances { token-id: TOKEN-STX })
      balance-data
        (map-set token-balances
          { token-id: TOKEN-STX }
          { total-amount: (+ (get total-amount balance-data) amount) })
      ;; Should never happen if properly initialized
      (map-set token-balances
        { token-id: TOKEN-STX }
        { total-amount: amount })
    )

    ;; Emit event
    (print {
      event: "funds-deposited",
      depositor: tx-sender,
      amount: amount,
      token: TOKEN-STX
    })

    (ok true)
  ))

;; Deposit sBTC to the pool
;; Can be called by any user
(define-public (deposit-sbtc (amount uint))
  (begin
    ;; Validate amount
    (asserts! (> amount u0) ERR-AMOUNT-ZERO)

    ;; Transfer sBTC from sender to contract using SIP-010 interface
    (try! (contract-call? TOKEN-SBTC transfer amount tx-sender (as-contract tx-sender) none))

    ;; Update total balance
    (match (map-get? token-balances { token-id: TOKEN-SBTC })
      balance-data
        (map-set token-balances
          { token-id: TOKEN-SBTC }
          { total-amount: (+ (get total-amount balance-data) amount) })
      ;; Should never happen if properly initialized
      (map-set token-balances
        { token-id: TOKEN-SBTC }
        { total-amount: amount })
    )

    ;; Emit event
    (print {
      event: "funds-deposited",
      depositor: tx-sender,
      amount: amount,
      token: TOKEN-SBTC
    })

    (ok true)
  ))
```

### 4.4 Withdrawal Functions

```clarity
;; Withdraw STX from the pool
;; Can only be called by the depositor (provider)
(define-public (withdraw-stx (amount uint))
  (begin
    ;; Validate amount
    (asserts! (> amount u0) ERR-AMOUNT-ZERO)

    ;; Verify sufficient available (unlocked) balance
    (match (map-get? token-balances { token-id: TOKEN-STX })
      balance-data
        (match (map-get? locked-collateral { token-id: TOKEN-STX })
          lock-data
            (let
              (
                (available-amount (- (get total-amount balance-data)
                                    (get locked-amount lock-data)))
              )
              ;; Check if enough unlocked balance
              (asserts! (>= available-amount amount) ERR-INSUFFICIENT-FUNDS)

              ;; Update total balance
              (map-set token-balances
                { token-id: TOKEN-STX }
                { total-amount: (- (get total-amount balance-data) amount) })

              ;; Transfer STX to withdrawer
              (as-contract (try! (stx-transfer? amount (as-contract tx-sender) tx-sender)))

              ;; Emit event
              (print {
                event: "funds-withdrawn",
                withdrawer: tx-sender,
                amount: amount,
                token: TOKEN-STX
              })

              (ok true)
            )
          ;; Should never happen if properly initialized
          (begin
            (map-set locked-collateral
              { token-id: TOKEN-STX }
              { locked-amount: u0 })

            ;; Recursively call this function again
            (withdraw-stx amount)
          )
        )
      ;; No balance record, nothing to withdraw
      (err ERR-INSUFFICIENT-FUNDS)
    )
  ))

;; Withdraw sBTC from the pool
;; Can only be called by the depositor (provider)
(define-public (withdraw-sbtc (amount uint))
  (begin
    ;; Validate amount
    (asserts! (> amount u0) ERR-AMOUNT-ZERO)

    ;; Verify sufficient available (unlocked) balance
    (match (map-get? token-balances { token-id: TOKEN-SBTC })
      balance-data
        (match (map-get? locked-collateral { token-id: TOKEN-SBTC })
          lock-data
            (let
              (
                (available-amount (- (get total-amount balance-data)
                                    (get locked-amount lock-data)))
              )
              ;; Check if enough unlocked balance
              (asserts! (>= available-amount amount) ERR-INSUFFICIENT-FUNDS)

              ;; Update total balance
              (map-set token-balances
                { token-id: TOKEN-SBTC }
                { total-amount: (- (get total-amount balance-data) amount) })

              ;; Transfer sBTC to withdrawer using SIP-010 interface
              (as-contract (try! (contract-call? TOKEN-SBTC transfer amount (as-contract tx-sender) tx-sender none)))

              ;; Emit event
              (print {
                event: "funds-withdrawn",
                withdrawer: tx-sender,
                amount: amount,
                token: TOKEN-SBTC
              })

              (ok true)
            )
          ;; Should never happen if properly initialized
          (begin
            (map-set locked-collateral
              { token-id: TOKEN-SBTC }
              { locked-amount: u0 })

            ;; Recursively call this function again
            (withdraw-sbtc amount)
          )
        )
      ;; No balance record, nothing to withdraw
      (err ERR-INSUFFICIENT-FUNDS)
    )
  ))
```

### 4.5 Collateral Management Functions

```clarity
;; Lock collateral for a policy
;; Can only be called by Policy Registry contract
(define-public (lock-collateral (token-id principal) (amount uint) (policy-id uint))
  (begin
    ;; Check authorization
    (asserts! (is-eq tx-sender (var-get policy-registry-principal))
              ERR-UNAUTHORIZED)

    ;; Validate amount
    (asserts! (> amount u0) ERR-AMOUNT-ZERO)

    ;; Verify sufficient available balance
    (match (map-get? token-balances { token-id: token-id })
      balance-data
        (match (map-get? locked-collateral { token-id: token-id })
          lock-data
            (let
              (
                (available-amount (- (get total-amount balance-data)
                                    (get locked-amount lock-data)))
              )
              ;; Check if enough unlocked balance
              (asserts! (>= available-amount amount) ERR-INSUFFICIENT-FUNDS)

              ;; Update locked amount
              (map-set locked-collateral
                { token-id: token-id }
                { locked-amount: (+ (get locked-amount lock-data) amount) })

              ;; Emit event
              (print {
                event: "collateral-locked",
                policy-id: policy-id,
                amount-locked: amount,
                token: token-id
              })

              (ok true)
            )
          ;; Should never happen if properly initialized
          (begin
            (map-set locked-collateral
              { token-id: token-id }
              { locked-amount: u0 })

            ;; Recursively call this function again
            (lock-collateral token-id amount policy-id)
          )
        )
      ;; No balance record
      (err ERR-INSUFFICIENT-FUNDS)
    )
  ))

;; Release collateral for a policy
;; Can only be called by Policy Registry contract
(define-public (release-collateral (token-id principal) (amount uint) (policy-id uint))
  (begin
    ;; Check authorization
    (asserts! (is-eq tx-sender (var-get policy-registry-principal))
              ERR-UNAUTHORIZED)

    ;; Validate amount
    (asserts! (> amount u0) ERR-AMOUNT-ZERO)

    ;; Verify sufficient locked amount
    (match (map-get? locked-collateral { token-id: token-id })
      lock-data
        (begin
          ;; Check if enough locked balance
          (asserts! (>= (get locked-amount lock-data) amount) ERR-INSUFFICIENT-FUNDS)

          ;; Update locked amount
          (map-set locked-collateral
            { token-id: token-id }
            { locked-amount: (- (get locked-amount lock-data) amount) })

          ;; Emit event
          (print {
            event: "collateral-released",
            policy-id: policy-id,
            amount-released: amount,
            token: token-id
          })

          (ok true)
        )
      ;; No lock record
      (err ERR-INSUFFICIENT-FUNDS)
    )
  ))
```

### 4.6 Settlement Functions

```clarity
;; Pay settlement to policy buyer when policy is exercised
;; Can only be called by Policy Registry contract
(define-public (pay-settlement (token-id principal) (amount uint) (recipient principal) (policy-id uint))
  (begin
    ;; Check authorization
    (asserts! (is-eq tx-sender (var-get policy-registry-principal))
              ERR-UNAUTHORIZED)

    ;; Validate amount
    (asserts! (> amount u0) ERR-AMOUNT-ZERO)

    ;; Verify sufficient total balance
    (match (map-get? token-balances { token-id: token-id })
      balance-data
        (begin
          ;; Check if enough total balance
          (asserts! (>= (get total-amount balance-data) amount) ERR-INSUFFICIENT-FUNDS)

          ;; Update total balance
          (map-set token-balances
            { token-id: token-id }
            { total-amount: (- (get total-amount balance-data) amount) })

          ;; Verify sufficient locked amount and update
          (match (map-get? locked-collateral { token-id: token-id })
            lock-data
              (begin
                ;; Check if enough locked balance
                (asserts! (>= (get locked-amount lock-data) amount) ERR-INSUFFICIENT-FUNDS)

                ;; Update locked amount
                (map-set locked-collateral
                  { token-id: token-id }
                  { locked-amount: (- (get locked-amount lock-data) amount) })

                ;; Transfer funds to recipient based on token type
                (if (is-eq token-id TOKEN-STX)
                    ;; Transfer STX
                    (as-contract (try! (stx-transfer? amount (as-contract tx-sender) recipient)))
                    ;; Transfer token using SIP-010 interface
                    (as-contract (try! (contract-call? token-id transfer amount (as-contract tx-sender) recipient none)))
                )

                ;; Emit event
                (print {
                  event: "settlement-paid",
                  policy-id: policy-id,
                  buyer: recipient,
                  settlement-amount: amount,
                  token: token-id
                })

                (ok true)
              )
            ;; No lock record
            (err ERR-INSUFFICIENT-FUNDS)
          )
        )
      ;; No balance record
      (err ERR-INSUFFICIENT-FUNDS)
    )
  ))
```

### 4.7 Read-Only Functions

```clarity
;; Get total balance for a token
(define-read-only (get-total-balance (token-id principal))
  (default-to { total-amount: u0 }
              (map-get? token-balances { token-id: token-id })))

;; Get total locked amount for a token
(define-read-only (get-locked-amount (token-id principal))
  (default-to { locked-amount: u0 }
              (map-get? locked-collateral { token-id: token-id })))

;; Get available (unlocked) balance for a token
(define-read-only (get-available-balance (token-id principal))
  (let
    (
      (total (get total-amount (get-total-balance token-id)))
      (locked (get locked-amount (get-locked-amount token-id)))
    )
    (- total locked)
  ))

;; Check if a token is supported
(define-read-only (is-token-supported (token-id principal))
  (is-some (map-get? token-balances { token-id: token-id })))
```

## 5. Security Considerations

### 5.1 Authorization Model

The contract has a strict authorization model:

1. **Provider Operations**:

   - Users can deposit freely to the pool
   - Users can only withdraw their available (unlocked) balance
   - Users cannot affect other providers' funds

2. **Policy Registry Operations**:

   - Only the registered Policy Registry contract can:
     - Lock collateral for policies
     - Release collateral from expired/settled policies
     - Trigger settlement payments

3. **Admin Operations**:
   - Contract owner can only:
     - Set authorized principals
     - Initialize supported tokens
   - Cannot directly access or transfer user funds

### 5.2 Balance Management

The contract maintains a strict accounting system:

1. **Total Balance Tracking**:

   - All deposits increase total balance
   - All withdrawals and settlements decrease total balance
   - Balance tracking is per token type

2. **Collateral Locking**:
   - Locked collateral is tracked separately
   - Available balance = Total balance - Locked collateral
   - Withdrawals are limited to available balance
   - Ensures policy collateral is secured

### 5.3 Potential Vulnerabilities

1. **Re-entrancy**:

   - State changes before external calls to prevent re-entrancy attacks
   - Proper validation of amounts and balances

2. **Front-running**:

   - Limited impact as most operations require appropriate authorization
   - User-initiated withdrawals subject to normal front-running risks

3. **Authorization Bypass**:
   - Multiple checks for authorized callers
   - Clear separation between user, registry, and admin operations

## 6. Gas Optimization Considerations

The "On-Chain Light" approach significantly reduces gas costs through:

1. **Minimal State Storage**:

   - Only track total balances and locked amounts
   - No per-provider accounting on-chain
   - Reuse maps for multiple tokens

2. **Efficient Operations**:

   - Direct token transfers without complex calculations
   - Minimal event data emission

3. **Batching Potential**:
   - Settlement and collateral management could be batched in future extensions

## 7. Testing Guidelines

The Liquidity Pool Vault contract should be thoroughly tested across:

### 7.1 Unit Tests

1. Deposit flows for STX and sBTC tokens
2. Withdrawal flows with sufficient/insufficient balance scenarios
3. Collateral locking and release mechanisms
4. Settlement payment processing
5. Authorization checks for all sensitive functions

### 7.2 Integration Tests

1. End-to-end policy creation with collateral locking
2. End-to-end policy exercise with settlement
3. End-to-end policy expiration with collateral release
4. Multiple provider deposit/withdrawal scenarios

## 8. Contract Integration

### 8.1 Policy Registry Integration

The Liquidity Pool Vault integrates with the Policy Registry contract:

1. Policy Registry calls `lock-collateral` when a policy is created
2. Policy Registry calls `release-collateral` when a policy expires
3. Policy Registry calls `pay-settlement` when a policy is exercised

### 8.2 Frontend Integration

Frontend integration occurs through Convex backend:

1. Convex prepares and monitors deposit transactions
2. Convex prepares and monitors withdrawal transactions
3. Convex tracks individual provider balances off-chain

## 9. Event Emission Standards

For effective off-chain synchronization, the contract emits standardized events:

```clarity
;; Deposit
(print {
  event: "funds-deposited",
  depositor: principal,
  amount: uint,
  token: principal
})

;; Withdrawal
(print {
  event: "funds-withdrawn",
  withdrawer: principal,
  amount: uint,
  token: principal
})

;; Collateral Management
(print {
  event: "collateral-locked",
  policy-id: uint,
  amount-locked: uint,
  token: principal
})

(print {
  event: "collateral-released",
  policy-id: uint,
  amount-released: uint,
  token: principal
})

;; Settlement
(print {
  event: "settlement-paid",
  policy-id: uint,
  buyer: principal,
  settlement-amount: uint,
  token: principal
})
```

## 10. Future Extensions

The contract design allows for future extensions:

1. **Multi-Tier Pools**: Add support for multiple pools with different risk profiles
2. **Enhanced Token Support**: Add support for additional token types
3. **Governance Integration**: Allow parameter updates through governance
4. **Fee Management**: Add support for platform fees

## 11. Comparison with Previous Approach

This "On-Chain Light" approach differs significantly from the previous implementation:

### Previous Approach:

- Tracked individual provider balances on-chain
- Managed risk tier assignments on-chain
- Allocated collateral to specific providers on-chain
- Calculated yields and distributions on-chain

### Current Approach:

- Tracks only total and locked balances on-chain
- Manages all provider-specific data off-chain
- Handles only aggregate collateral management on-chain
- Performs complex calculations off-chain

## 12. Conclusion

The Liquidity Pool Vault contract specification embodies the "On-Chain Light" architectural approach by:

1. Securing funds on-chain while minimizing storage requirements
2. Providing essential financial functions with minimal complexity
3. Maintaining clear authorization boundaries
4. Enabling efficient off-chain tracking and management
5. Focusing on the core value proposition: secure custody and authorized transfers

By keeping the on-chain footprint small while providing the necessary security guarantees, this design achieves an optimal balance of security, scalability, and cost efficiency for the BitHedge platform.
