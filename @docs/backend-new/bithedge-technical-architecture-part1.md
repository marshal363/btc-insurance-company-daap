# BitHedge Technical Architecture - Assisted Counterparty Model

## 1. Executive Summary

This document details the technical implementation requirements for BitHedge's assisted counterparty model, designed to democratize options trading for Bitcoin holders through an insurance-like interface. The architecture balances user experience, technical feasibility, and decentralization while establishing a foundation for progressive transition to a fully peer-to-peer marketplace as the protocol matures.

Building on our ecosystem sustainability analysis, we've designed a modular system that maintains the core financial functionality of options trading while presenting an intuitive Bitcoin-native protection interface. This document serves as the comprehensive technical specification for implementing the smart contracts, off-chain components, and governance mechanisms necessary for our MVP deployment on the Stacks blockchain.

## 2. Design Principles and Requirements

### 2.1 Core Design Principles

1. **Bitcoin-Native Experience**: All interfaces and interactions must align with Bitcoin mental models
2. **Full Collateralization**: All protection policies must be 100% collateralized to maintain trust
3. **Progressive Decentralization**: Evolve from assisted counterparty to P2P marketplace over time
4. **Modular Architecture**: Separate concerns to facilitate future upgrades and enhancements
5. **Protocol Safety**: Implement multiple safeguards to protect against contract failures
6. **Chain-Specific Optimization**: Leverage Stacks blockchain capabilities while respecting its limitations
7. **Insurance-Focused Interface**: Implement terminology translation layer that reimagines options as protection
8. **Self-Custody Prioritization**: Minimize trust requirements while balancing user experience
9. **Dual-Persona Support**: Simultaneously serve both protection buyers and providers

### 2.2 Technical Requirements

#### 2.2.1 System Requirements

1. **Scalability**: Support at least 10,000 active protection policies with response times under 5 seconds
2. **Reliability**: Maintain 99.9% uptime for core contract functions
3. **Gas Efficiency**: Optimize all smart contracts for minimal transaction fees
4. **Data Availability**: Provide transparent, real-time access to all protection parameters
5. **Security**: Implement multiple layers of contract security with formal verification
6. **Integration**: Support easy integration with wallets and Bitcoin infrastructure
7. **Redundancy**: Eliminate single points of failure in all critical components

#### 2.2.2 User Experience Requirements

1. **Simplified Interface**: Abstract complex options mechanics behind intuitive protection concepts
2. **Bitcoin-Denominated**: Display all values in sats/BTC by default with USD equivalents
3. **Responsive Performance**: Maximum 3-second response time for all user interactions
4. **Clear Outcomes**: Unambiguous presentation of protection scenarios and potential results
5. **Cross-Segment Support**: Meet needs of both financial sophisticates and Bitcoin novices
6. **Transaction Transparency**: Clear explanation of all on-chain interactions before signing
7. **Education Integration**: Contextual learning elements throughout the protection flow

## 3. Smart Contract Architecture

### 3.1 Contract System Overview

The BitHedge smart contract system implements a modular design with clear separation of concerns. The core architecture consists of:

1. **Policy Registry Contract**: Central registry of all protection policies
2. **Liquidity Pool Contract**: Manages STX/sBTC collateral for the assisted counterparty model
3. **Oracle Contract**: Provides secure price feeds for Bitcoin and other required assets
4. **Parameter Contract**: Manages system parameters and configuration
5. **Governance Contract**: Handles protocol upgrades and parameter adjustments
6. **P2P Marketplace Contract**: Hidden during MVP but developed in parallel

These contracts interact via a well-defined API layer, ensuring minimal coupling while maintaining cohesive functionality.

```
+-------------------+      +----------------------+      +-------------------+
| Protection Buyer  |      | Protection Provider  |      |    Governance     |
| Interface (Peter) |      | Interface (Irene)    |      |    Interface      |
+--------+----------+      +-----------+----------+      +---------+---------+
         |                             |                           |
         v                             v                           v
+--------+-----------------------------+---------------------------+---------+
|                             API & Translation Layer                        |
+--------+-----------------------------+---------------------------+---------+
         |                             |                           |
         v                             v                           v
+--------+----------+      +-----------+----------+     +----------+---------+
|  Policy Registry  |<---->|  Liquidity Pool      |<--->|    Parameter       |
|    Contract       |      |    Contract          |     |    Contract        |
+-------------------+      +----------------------+     +--------------------+
         ^                             ^                           ^
         |                             |                           |
         v                             v                           v
+--------+----------+      +-----------+----------+     +----------+---------+
|  Oracle Contract  |<---->|   Governance         |<--->|  P2P Marketplace   |
|                   |      |    Contract          |     |  Contract (hidden) |
+-------------------+      +----------------------+     +--------------------+
```

### 3.2 Policy Registry Contract

The Policy Registry Contract serves as the central directory for all protection policies, maintaining their states and facilitating lifecycle management.

#### 3.2.1 Key Functions

```clarity
;; Create a new protection policy
(define-public (create-protection-policy
  (owner principal)
  (protected-value uint)
  (expiration-height uint)
  (protected-amount uint)
  (premium uint)
  (policy-type (string-ascii 4))
  (counterparty principal)
)

;; Activate (exercise) a protection policy
(define-public (activate-protection
  (policy-id uint)
)

;; Claim expired premium for provider
(define-public (claim-premium
  (policy-id uint)
)

;; Cancel an active policy (if permitted by parameters)
(define-public (cancel-policy
  (policy-id uint)
)

;; Check if a policy is active
(define-public (is-policy-active
  (policy-id uint)
)

;; Get policy details
(define-read-only (get-policy-details
  (policy-id uint)
)
```

#### 3.2.2 Data Structure

```clarity
;; Policy Types: "PUT" or "CALL"
;; Status: 0=active, 1=exercised, 2=expired, 3=canceled

(define-map policies
  { policy-id: uint }
  {
    owner: principal,
    protected-value: uint, ;; strike price in STX satoshis
    expiration-height: uint,
    protected-amount: uint, ;; in Bitcoin satoshis
    premium: uint, ;; in STX satoshis
    policy-type: (string-ascii 4),
    counterparty: principal, ;; liquidity pool or direct provider
    creation-height: uint,
    status: uint,
    exercise-price: uint, ;; price at exercise if activated
    exercise-height: uint ;; block when exercised, 0 if not exercised
  }
)

;; Track policies by owner
(define-map policies-by-owner
  { owner: principal }
  { policy-ids: (list 250 uint) }
)

;; Track policies by provider
(define-map policies-by-provider
  { provider: principal }
  { policy-ids: (list 250 uint) }
)
```

#### 3.2.3 Key Events

```clarity
;; Emit when policy is created
(define-event policy-created (
  policy-id uint,
  owner principal,
  protected-value uint,
  expiration-height uint,
  protected-amount uint,
  premium uint,
  policy-type (string-ascii 4),
  counterparty principal
))

;; Emit when policy is activated
(define-event policy-activated (
  policy-id uint,
  exercise-price uint,
  exercise-height uint
))

;; Emit when policy expires without activation
(define-event policy-expired (
  policy-id uint
))
```

#### 3.2.4 Access Control

```clarity
;; Only policy owner can activate protection
(asserts! (is-eq tx-sender (get owner (unwrap-panic (get-policy-details policy-id))))
  (err u403))

;; Only counterparty can claim premium after expiration
(asserts! (is-eq tx-sender (get counterparty (unwrap-panic (get-policy-details policy-id))))
  (err u403))
```

### 3.3 Liquidity Pool Contract

The Liquidity Pool Contract manages the collateral pool that serves as the counterparty to all protection policies during the assisted counterparty phase.

#### 3.3.1 Key Functions

```clarity
;; Deposit collateral (STX/sBTC) into the pool
(define-public (deposit-collateral
  (amount uint)
  (token-contract principal)
)

;; Withdraw available collateral from the pool
(define-public (withdraw-collateral
  (amount uint)
  (token-contract principal)
)

;; Create a protection policy using pool as counterparty
(define-public (create-pool-protection-policy
  (owner principal)
  (protected-value uint)
  (expiration-height uint)
  (protected-amount uint)
  (policy-type (string-ascii 4))
)

;; Process a protection activation (called by Policy Registry)
(define-public (process-protection-activation
  (policy-id uint)
  (current-price uint)
)

;; Calculate premium for a protection policy
(define-read-only (calculate-premium
  (protected-value uint)
  (expiration-height uint)
  (protected-amount uint)
  (policy-type (string-ascii 4))
)

;; Get pool liquidity and utilization
(define-read-only (get-pool-status)
)
```

#### 3.3.2 Data Structure

```clarity
;; Track total pool collateral
(define-data-var total-stx-collateral uint u0)
(define-data-var total-sbtc-collateral uint u0)

;; Track provider deposits
(define-map provider-deposits
  { provider: principal }
  {
    stx-amount: uint,
    sbtc-amount: uint,
    stx-locked: uint, ;; amount locked in active policies
    sbtc-locked: uint, ;; amount locked in active policies
    last-deposit-height: uint,
    deposit-count: uint
  }
)

;; Track pool utilization for premium calculations
(define-data-var pool-utilization-rate uint u0) ;; scaled by 1,000,000

;; Policy risk parameters
(define-map policy-risk-parameters
  { policy-type: (string-ascii 4) }
  {
    base-premium-rate: uint, ;; scaled by 1,000,000
    utilization-multiplier: uint, ;; scaled by 1,000,000
    max-utilization: uint, ;; scaled by 1,000,000
    moneyness-multiplier: uint, ;; scaled by 1,000,000
    duration-multiplier: uint, ;; scaled by 1,000,000
    min-collateralization: uint ;; scaled by 1,000,000
  }
)
```

#### 3.3.3 Premium Calculation Logic

The premium calculation implements the Black-Scholes options pricing model adjusted for Bitcoin-specific volatility patterns:

```clarity
;; Premium calculation factors in:
;; 1. Base premium rate (set by governance)
;; 2. Moneyness (difference between current price and protected value)
;; 3. Time to expiration (longer duration = higher premium)
;; 4. Current volatility (from oracle)
;; 5. Pool utilization (higher utilization = higher premium)

(define-read-only (calculate-premium
  (protected-value uint)
  (expiration-height uint)
  (protected-amount uint)
  (policy-type (string-ascii 4))
)
  (let (
    (current-price (unwrap-panic (get-current-btc-price)))
    (time-factor (/ (- expiration-height block-height) u144)) ;; Convert to days
    (moneyness (if (is-eq policy-type "PUT")
                (/ (* u1000000 (- current-price protected-value)) current-price)
                (/ (* u1000000 (- protected-value current-price)) current-price)))
    (params (unwrap-panic (map-get? policy-risk-parameters { policy-type: policy-type })))
    (base-rate (get base-premium-rate params))
    (utilization-factor (+ u1000000 (/ (* (get utilization-multiplier params) pool-utilization-rate) u1000000)))
    (moneyness-factor (+ u1000000 (/ (* (get moneyness-multiplier params) moneyness) u1000000)))
    (time-factor (+ u1000000 (/ (* (get duration-multiplier params) time-factor) u1000000)))
    (volatility-factor (unwrap-panic (get-volatility-factor)))

    ;; Combined premium calculation
    (premium-rate (/ (* (* (* base-rate utilization-factor) moneyness-factor) time-factor) u1000000000000))
    (premium-amount (/ (* protected-amount premium-rate) u1000000))
  )
  premium-amount)
)
```

#### 3.3.4 Collateralization and Risk Management

```clarity
;; Check if policy creation would exceed pool capacity
(define-private (check-pool-capacity
  (protected-value uint)
  (protected-amount uint)
  (policy-type (string-ascii 4))
)
  (let (
    (current-price (unwrap-panic (get-current-btc-price)))
    (required-collateral (if (is-eq policy-type "PUT")
                          (/ (* protected-amount protected-value) current-price)
                          protected-amount))
    (available-collateral (if (is-eq policy-type "PUT")
                           (- total-stx-collateral stx-locked)
                           (- total-sbtc-collateral sbtc-locked)))
    (min-collateralization (get min-collateralization
                             (unwrap-panic (map-get? policy-risk-parameters { policy-type: policy-type }))))
    (required-total (/ (* required-collateral min-collateralization) u1000000))
  )
  (<= required-total available-collateral))
)
```

### 3.4 Oracle Contract

The Oracle Contract provides secure, reliable price data essential for policy creation, premium calculation, and protection activation.

#### 3.4.1 Key Functions

```clarity
;; Get current Bitcoin price
(define-read-only (get-current-btc-price)
)

;; Get historical Bitcoin price at block height
(define-read-only (get-btc-price-at-height
  (block-height uint)
)

;; Get current Bitcoin volatility
(define-read-only (get-btc-volatility)
)

;; Update price information (restricted to authorized providers)
(define-public (update-btc-price
  (price uint)
)

;; Update volatility information (restricted to authorized providers)
(define-public (update-btc-volatility
  (volatility uint)
)
```

#### 3.4.2 Data Structure

```clarity
;; Price history maintaining recent values
(define-map btc-price-history
  { block-height: uint }
  { price: uint }
)

;; Current price information
(define-data-var current-btc-price uint u0)
(define-data-var current-btc-volatility uint u0) ;; scaled by 1,000,000
(define-data-var last-price-update-height uint u0)

;; Authorized oracle providers
(define-map authorized-providers
  { provider: principal }
  { status: bool }
)
```

#### 3.4.3 Oracle Security

```clarity
;; Only authorized providers can update prices
(define-public (update-btc-price
  (price uint)
)
  (begin
    (asserts! (is-authorized-provider tx-sender) (err u403))
    ;; Additional safeguards to prevent price manipulation
    (asserts! (is-valid-price-update current-btc-price price) (err u400))

    (var-set current-btc-price price)
    (var-set last-price-update-height block-height)
    (map-set btc-price-history { block-height: block-height } { price: price })
    (ok true))
)

;; Check if price update is within valid range
(define-private (is-valid-price-update
  (old-price uint)
  (new-price uint)
)
  (let (
    (min-valid (/ (* old-price u900000) u1000000)) ;; 90% of old price
    (max-valid (/ (* old-price u1100000) u1000000)) ;; 110% of old price
  )
  (and (>= new-price min-valid) (<= new-price max-valid)))
)
```

### 3.5 Parameter Contract

The Parameter Contract manages configurable system parameters used by all other contracts.

#### 3.5.1 Key Functions

```clarity
;; Get parameter value (generic interface)
(define-read-only (get-parameter
  (parameter-name (string-ascii 50))
)

;; Update parameter value (restricted to governance)
(define-public (update-parameter
  (parameter-name (string-ascii 50))
  (parameter-value uint)
)

;; Check if feature flag is enabled
(define-read-only (is-feature-enabled
  (feature-name (string-ascii 50))
)
```

#### 3.5.2 Data Structure

```clarity
;; System parameters with numeric values
(define-map numeric-parameters
  { name: (string-ascii 50) }
  { value: uint }
)

;; Feature flags
(define-map feature-flags
  { name: (string-ascii 50) }
  { enabled: bool }
)

;; Parameter update history for transparency
(define-map parameter-history
  {
    name: (string-ascii 50),
    update-height: uint
  }
  {
    old-value: uint,
    new-value: uint,
    changed-by: principal
  }
)
```

#### 3.5.3 Core System Parameters

```clarity
;; Initialize with default values
(map-set numeric-parameters { name: "min-policy-duration" } { value: u1008 }) ;; 7 days in blocks
(map-set numeric-parameters { name: "max-policy-duration" } { value: u52560 }) ;; 365 days in blocks
(map-set numeric-parameters { name: "platform-fee-rate" } { value: u10000 }) ;; 1% (scaled by 1,000,000)
(map-set numeric-parameters { name: "max-pool-utilization" } { value: u800000 }) ;; 80% (scaled by 1,000,000)
(map-set numeric-parameters { name: "emergency-shutdown-delay" } { value: u1008 }) ;; 7 days in blocks

;; Feature flags
(map-set feature-flags { name: "allow-policy-creation" } { enabled: true })
(map-set feature-flags { name: "allow-policy-activation" } { enabled: true })
(map-set feature-flags { name: "enable-p2p-marketplace" } { enabled: false })
(map-set feature-flags { name: "enable-early-exercise" } { enabled: true })
```

### 3.6 Governance Contract

The Governance Contract manages protocol updates, parameter changes, and emergency actions.

#### 3.6.1 Key Functions

```clarity
;; Propose a parameter change
(define-public (propose-parameter-change
  (parameter-name (string-ascii 50))
  (parameter-value uint)
  (justification (string-utf8 500))
)

;; Vote on a parameter change proposal
(define-public (vote-on-proposal
  (proposal-id uint)
  (approve bool)
)

;; Execute an approved parameter change
(define-public (execute-parameter-change
  (proposal-id uint)
)

;; Trigger emergency shutdown (restricted to emergency committee)
(define-public (trigger-emergency-shutdown
  (justification (string-utf8 500))
)
```

#### 3.6.2 Data Structure

```clarity
;; Governance proposals
(define-map proposals
  { proposal-id: uint }
  {
    proposer: principal,
    parameter-name: (string-ascii 50),
    parameter-value: uint,
    justification: (string-utf8 500),
    proposal-height: uint,
    status: uint, ;; 0=pending, 1=approved, 2=rejected, 3=executed
    votes-for: uint,
    votes-against: uint,
    execution-height: uint
  }
)

;; Votes on proposals
(define-map votes
  {
    proposal-id: uint,
    voter: principal
  }
  {
    approved: bool,
    vote-height: uint
  }
)

;; Emergency committee members
(define-map emergency-committee
  { member: principal }
  { status: bool }
)

;; Emergency shutdown status
(define-data-var emergency-shutdown-active bool false)
(define-data-var emergency-shutdown-height uint u0)
```

#### 3.6.3 Governance Logic

```clarity
;; Execute parameter change only if approved and delay period passed
(define-public (execute-parameter-change
  (proposal-id uint)
)
  (let (
    (proposal (unwrap-panic (map-get? proposals { proposal-id: proposal-id })))
  )
    (asserts! (is-eq (get status proposal) u1) (err u403)) ;; Must be approved
    (asserts! (>= block-height (+ (get proposal-height proposal) (get-governance-delay))) (err u403))

    ;; Execute the parameter change
    (try! (update-parameter (get parameter-name proposal) (get parameter-value proposal)))

    ;; Update proposal status
    (map-set proposals { proposal-id: proposal-id }
      (merge proposal {
        status: u3,
        execution-height: block-height
      })
    )
    (ok true))
)
```

### 3.7 P2P Marketplace Contract (Initially Hidden)

While not exposed in the MVP interface, this contract will be developed in parallel to facilitate the transition to a peer-to-peer marketplace in later phases.

#### 3.7.1 Key Functions

```clarity
;; Create a protection offer (limit order)
(define-public (create-protection-offer
  (protected-value uint)
  (expiration-height uint)
  (protected-amount uint)
  (premium uint)
  (policy-type (string-ascii 4))
)

;; Cancel an open protection offer
(define-public (cancel-protection-offer
  (offer-id uint)
)

;; Fill a protection offer (create policy)
(define-public (fill-protection-offer
  (offer-id uint)
)

;; Get open protection offers
(define-read-only (get-protection-offers
  (policy-type (string-ascii 4))
  (limit uint)
  (offset uint)
)
```

#### 3.7.2 Data Structure

```clarity
;; Protection offers (limit orders)
(define-map protection-offers
  { offer-id: uint }
  {
    creator: principal,
    protected-value: uint,
    expiration-height: uint,
    protected-amount: uint,
    premium: uint,
    policy-type: (string-ascii 4),
    creation-height: uint,
    status: uint ;; 0=open, 1=filled, 2=canceled
  }
)

;; Index for efficient querying of open offers
(define-map open-offers-by-type
  { policy-type: (string-ascii 4) }
  { offer-ids: (list 250 uint) }
)
```
