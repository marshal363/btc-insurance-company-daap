# BitHedge On-Chain Data Model: Technical Specification

## Overview

This document details the on-chain data model for the BitHedge DeFi platform, implemented using Clarity smart contracts. The data model encompasses all blockchain-stored states, entities, and relationships that power BitHedge's decentralized insurance and hedging capabilities.

## Core Smart Contracts

### 1. Policy Management Contract

**Purpose:** Manages the lifecycle of insurance policies from creation to settlement.

#### Data Structures

```clarity
;; Policy data structure
(define-map policies
  { policy-id: uint }
  {
    owner: principal,
    policy-type: (string-ascii 20),
    asset-covered: (string-ascii 10),
    coverage-amount: uint,
    premium-amount: uint,
    start-block: uint,
    end-block: uint,
    status: (string-ascii 10), ;; active, expired, claimed, settled
    risk-tier: uint,
    collateral-required: uint,
    collateral-locked: uint,
    oracle-reference: (optional principal)
  }
)

;; Policy counter for unique IDs
(define-data-var policy-counter uint u0)

;; Policy type registry
(define-map policy-types
  { type-id: (string-ascii 20) }
  {
    base-premium-rate: uint,
    min-coverage-amount: uint,
    max-coverage-amount: uint,
    min-duration-blocks: uint,
    max-duration-blocks: uint,
    collateral-ratio: uint,
    oracle-reference: principal
  }
)

;; Policy claim data
(define-map policy-claims
  { claim-id: uint }
  {
    policy-id: uint,
    claimer: principal,
    claim-amount: uint,
    claim-evidence: (string-utf8 500),
    claim-status: (string-ascii 15), ;; pending, approved, rejected
    claim-timestamp: uint,
    settlement-amount: uint,
    settlement-timestamp: (optional uint)
  }
)

;; Claim counter for unique IDs
(define-data-var claim-counter uint u0)
```

#### Key Functions

```clarity
;; Create a new policy
(define-public (create-policy
  (policy-type (string-ascii 20))
  (asset-covered (string-ascii 10))
  (coverage-amount uint)
  (duration-blocks uint))
  (let
    (
      (policy-id (+ (var-get policy-counter) u1))
      (policy-type-details (map-get? policy-types { type-id: policy-type }))
      (premium-amount (calculate-premium policy-type coverage-amount duration-blocks))
      (collateral-required (calculate-collateral policy-type coverage-amount))
      (current-block block-height)
    )
    ;; Check if policy type exists and parameters are valid
    ;; Calculate premium based on policy type, coverage amount, and duration
    ;; Transfer premium from user to contract
    ;; Create policy record
    ;; Increase policy counter
  )
)

;; File a claim against a policy
(define-public (file-claim
  (policy-id uint)
  (claim-amount uint)
  (claim-evidence (string-utf8 500)))
  (let
    (
      (claim-id (+ (var-get claim-counter) u1))
      (policy (map-get? policies { policy-id: policy-id }))
    )
    ;; Check if policy exists and is active
    ;; Check if claimer is the policy owner
    ;; Check if claim amount is valid
    ;; Create claim record
    ;; Increase claim counter
  )
)

;; Settle a claim
(define-public (settle-claim
  (claim-id uint)
  (approval-status bool)
  (settlement-amount uint))
  (let
    (
      (claim (map-get? policy-claims { claim-id: claim-id }))
      (policy-id (get policy-id claim))
      (policy (map-get? policies { policy-id: policy-id }))
    )
    ;; Check if claim exists and is pending
    ;; Check if caller is authorized to settle claims
    ;; Update claim status
    ;; Transfer settlement amount if approved
    ;; Update policy status
  )
)
```

### 2. Collateral Management Contract

**Purpose:** Manages the collateral required for underwriting policies and handles margin calls.

#### Data Structures

```clarity
;; Collateral pool data
(define-map collateral-pools
  { pool-id: uint }
  {
    risk-tier: uint,
    asset-type: (string-ascii 10),
    total-collateral: uint,
    allocated-collateral: uint,
    minimum-collateral-ratio: uint,
    current-collateral-ratio: uint,
    liquidation-threshold: uint,
    participants: (list 100 principal)
  }
)

;; Collateral contributions by underwriters
(define-map collateral-balances
  { pool-id: uint, underwriter: principal }
  {
    deposited-amount: uint,
    allocated-amount: uint,
    rewards-earned: uint,
    last-update-block: uint
  }
)

;; Margin call records
(define-map margin-calls
  { call-id: uint }
  {
    pool-id: uint,
    call-timestamp: uint,
    required-collateral: uint,
    current-collateral: uint,
    grace-period-blocks: uint,
    status: (string-ascii 15) ;; active, resolved, liquidated
  }
)

;; Margin call counter
(define-data-var margin-call-counter uint u0)

;; Health factor tracking for each pool
(define-map pool-health-factors
  { pool-id: uint }
  {
    current-health-factor: uint,
    last-check-block: uint,
    historical-health-factors: (list 100 { block: uint, factor: uint })
  }
)
```

#### Key Functions

```clarity
;; Deposit collateral to a pool
(define-public (deposit-collateral
  (pool-id uint)
  (amount uint))
  (let
    (
      (pool (map-get? collateral-pools { pool-id: pool-id }))
      (balance (map-get? collateral-balances { pool-id: pool-id, underwriter: tx-sender }))
    )
    ;; Check if pool exists
    ;; Transfer collateral from user to contract
    ;; Update collateral balances
    ;; Update pool data
    ;; Recalculate health factors
  )
)

;; Withdraw available collateral
(define-public (withdraw-collateral
  (pool-id uint)
  (amount uint))
  (let
    (
      (pool (map-get? collateral-pools { pool-id: pool-id }))
      (balance (map-get? collateral-balances { pool-id: pool-id, underwriter: tx-sender }))
      (available-amount (- (get deposited-amount balance) (get allocated-amount balance)))
    )
    ;; Check if withdrawal amount is available
    ;; Check if withdrawal would not trigger a margin call
    ;; Update balances
    ;; Transfer collateral back to user
  )
)

;; Trigger margin call for undercollateralized pool
(define-public (trigger-margin-call
  (pool-id uint))
  (let
    (
      (pool (map-get? collateral-pools { pool-id: pool-id }))
      (current-ratio (get current-collateral-ratio pool))
      (min-ratio (get minimum-collateral-ratio pool))
      (call-id (+ (var-get margin-call-counter) u1))
    )
    ;; Check if pool is undercollateralized
    ;; Create margin call record
    ;; Notify participants
    ;; Increase margin call counter
  )
)

;; Respond to margin call by adding collateral
(define-public (respond-to-margin-call
  (call-id uint)
  (amount uint))
  (let
    (
      (call (map-get? margin-calls { call-id: call-id }))
      (pool-id (get pool-id call))
      (pool (map-get? collateral-pools { pool-id: pool-id }))
    )
    ;; Check if margin call is active
    ;; Transfer additional collateral
    ;; Update pool data
    ;; Check if margin call is resolved
    ;; Update margin call status if resolved
  )
)

;; Execute liquidation for unresolved margin call
(define-public (liquidate-undercollateralized-pool
  (call-id uint))
  (let
    (
      (call (map-get? margin-calls { call-id: call-id }))
      (pool-id (get pool-id call))
      (pool (map-get? collateral-pools { pool-id: pool-id }))
      (grace-period (get grace-period-blocks call))
      (call-block (get call-timestamp call))
    )
    ;; Check if margin call grace period has expired
    ;; Check if margin call is still active
    ;; Distribute remaining collateral to policy holders
    ;; Mark affected policies as liquidated
    ;; Update pool status
  )
)
```

### 3. Risk-Reward Tier Matching System

**Purpose:** Manages risk tiers and matches policy requests with appropriate underwriter pools.

#### Data Structures

```clarity
;; Risk tier configuration
(define-map risk-tiers
  { tier-id: uint }
  {
    name: (string-ascii 20),
    description: (string-utf8 200),
    min-collateral-ratio: uint,
    premium-multiplier: uint,
    reward-multiplier: uint,
    max-exposure-per-asset: uint,
    required-oracle-confirmations: uint
  }
)

;; Tier assignment for assets
(define-map asset-risk-profiles
  { asset-ticker: (string-ascii 10) }
  {
    current-tier: uint,
    historical-tiers: (list 50 { block: uint, tier: uint }),
    volatility-score: uint,
    liquidity-score: uint,
    market-cap-score: uint,
    last-updated-block: uint
  }
)

;; Matching preferences for underwriters
(define-map underwriter-preferences
  { underwriter: principal }
  {
    preferred-assets: (list 10 (string-ascii 10)),
    preferred-tiers: (list 5 uint),
    max-exposure-per-policy: uint,
    auto-matching-enabled: bool,
    risk-appetite-score: uint
  }
)

;; Match history
(define-map policy-matches
  { policy-id: uint }
  {
    matched-pools: (list 10 uint),
    allocation-percentages: (list 10 uint),
    match-timestamp: uint,
    match-score: uint
  }
)
```

#### Key Functions

```clarity
;; Update asset risk profile
(define-public (update-asset-risk-profile
  (asset-ticker (string-ascii 10))
  (volatility-score uint)
  (liquidity-score uint)
  (market-cap-score uint))
  (let
    (
      (current-profile (map-get? asset-risk-profiles { asset-ticker: asset-ticker }))
      (calculated-tier (calculate-risk-tier volatility-score liquidity-score market-cap-score))
      (current-block block-height)
    )
    ;; Check if caller is authorized
    ;; Calculate new risk tier based on scores
    ;; Update profile with new data
    ;; If tier changed, add to historical record
  )
)

;; Set underwriter matching preferences
(define-public (set-matching-preferences
  (preferred-assets (list 10 (string-ascii 10)))
  (preferred-tiers (list 5 uint))
  (max-exposure-per-policy uint)
  (auto-matching-enabled bool))
  (let
    (
      (current-prefs (map-get? underwriter-preferences { underwriter: tx-sender }))
      (risk-score (calculate-risk-appetite preferred-tiers))
    )
    ;; Validate inputs
    ;; Update preferences
  )
)

;; Match policy to underwriter pools
(define-public (match-policy-to-pools
  (policy-id uint))
  (let
    (
      (policy (map-get? policies { policy-id: policy-id }))
      (asset (get asset-covered policy))
      (asset-profile (map-get? asset-risk-profiles { asset-ticker: asset }))
      (risk-tier (get current-tier asset-profile))
      (amount (get coverage-amount policy))
      (matching-pools (find-matching-pools risk-tier asset amount))
    )
    ;; Check if policy exists and is pending matching
    ;; Find appropriate underwriter pools
    ;; Allocate policy across pools
    ;; Record match details
  )
)
```

### 4. Oracle Integration Contract

**Purpose:** Connects with external oracles to fetch price data and verify claim conditions.

#### Data Structures

```clarity
;; Oracle registrations
(define-map oracles
  { oracle-id: principal }
  {
    name: (string-ascii 30),
    data-types: (list 10 (string-ascii 20)),
    trust-score: uint,
    response-timeout-blocks: uint,
    last-active-block: uint,
    verified: bool
  }
)

;; Price feed data
(define-map price-feeds
  { asset: (string-ascii 10) }
  {
    current-price: uint,
    last-update-block: uint,
    update-frequency: uint,
    source-oracle: principal,
    historical-prices: (list 100 { block: uint, price: uint }),
    24h-high: uint,
    24h-low: uint
  }
)

;; Oracle requests
(define-map oracle-requests
  { request-id: uint }
  {
    requester: principal,
    request-type: (string-ascii 20),
    request-data: (string-utf8 200),
    response-data: (optional (string-utf8 500)),
    request-block: uint,
    response-block: (optional uint),
    status: (string-ascii 10) ;; pending, fulfilled, expired
  }
)

;; Request counter
(define-data-var request-counter uint u0)

;; Claim verification results
(define-map claim-verifications
  { claim-id: uint }
  {
    verification-results: (list 10 { 
      oracle: principal, 
      result: bool, 
      confidence: uint,
      data: (string-utf8 200)
    }),
    consensus-result: (optional bool),
    verification-timestamp: uint
  }
)
```

#### Key Functions

```clarity
;; Register a new oracle
(define-public (register-oracle
  (name (string-ascii 30))
  (data-types (list 10 (string-ascii 20)))
  (response-timeout-blocks uint))
  (let
    (
      (oracle-exists (map-get? oracles { oracle-id: tx-sender }))
    )
    ;; Check if oracle already registered
    ;; Verify oracle meets requirements
    ;; Create oracle registration
  )
)

;; Submit price update
(define-public (update-price-feed
  (asset (string-ascii 10))
  (price uint))
  (let
    (
      (oracle (map-get? oracles { oracle-id: tx-sender }))
      (feed (map-get? price-feeds { asset: asset }))
      (current-block block-height)
    )
    ;; Check if caller is a registered oracle
    ;; Verify update frequency
    ;; Update price feed
    ;; Update historical records
  )
)

;; Request oracle verification for claim
(define-public (request-claim-verification
  (claim-id uint))
  (let
    (
      (claim (map-get? policy-claims { claim-id: claim-id }))
      (policy-id (get policy-id claim))
      (policy (map-get? policies { policy-id: policy-id }))
      (policy-type-details (map-get? policy-types { type-id: (get policy-type policy) }))
      (required-oracle (get oracle-reference policy-type-details))
      (request-id (+ (var-get request-counter) u1))
    )
    ;; Check if claim exists
    ;; Format verification request
    ;; Submit to oracle
    ;; Record request
  )
)

;; Submit oracle verification result
(define-public (submit-verification-result
  (request-id uint)
  (result bool)
  (confidence uint)
  (data (string-utf8 200)))
  (let
    (
      (request (map-get? oracle-requests { request-id: request-id }))
      (claim-id (get-claim-id-from-request request))
      (verification (map-get? claim-verifications { claim-id: claim-id }))
    )
    ;; Check if caller is the requested oracle
    ;; Record verification result
    ;; Update request status
    ;; Check if consensus is reached
  )
)
```

### 5. Governance and Protocol Parameters Contract

**Purpose:** Manages protocol parameters and governance decisions.

#### Data Structures

```clarity
;; Protocol parameters
(define-map protocol-parameters
  { param-id: (string-ascii 30) }
  {
    value: uint,
    min-value: uint,
    max-value: uint,
    description: (string-utf8 200),
    last-updated-block: uint,
    update-requires-vote: bool
  }
)

;; Governance proposals
(define-map governance-proposals
  { proposal-id: uint }
  {
    proposer: principal,
    title: (string-utf8 100),
    description: (string-utf8 500),
    param-changes: (list a),
    status: (string-ascii 15), ;; pending, active, passed, rejected, executed
    start-block: uint,
    end-block: uint,
    votes-for: uint,
    votes-against: uint,
    execution-block: (optional uint)
  }
)

;; Proposal counter
(define-data-var proposal-counter uint u0)

;; Voting power
(define-map voting-power
  { voter: principal }
  {
    base-power: uint,
    delegated-power: uint,
    delegation-target: (optional principal),
    last-vote-block: (optional uint)
  }
)

;; Votes cast
(define-map votes
  { proposal-id: uint, voter: principal }
  {
    vote-amount: uint,
    vote-direction: bool,
    vote-block: uint
  }
)
```

#### Key Functions

```clarity
;; Create governance proposal
(define-public (create-proposal
  (title (string-utf8 100))
  (description (string-utf8 500))
  (param-changes (list a))
  (voting-period-blocks uint))
  (let
    (
      (proposal-id (+ (var-get proposal-counter) u1))
      (voter-power (map-get? voting-power { voter: tx-sender }))
      (current-block block-height)
    )
    ;; Check if caller has enough voting power to propose
    ;; Validate parameter changes
    ;; Create proposal
  )
)

;; Cast vote on proposal
(define-public (cast-vote
  (proposal-id uint)
  (vote-direction bool))
  (let
    (
      (proposal (map-get? governance-proposals { proposal-id: proposal-id }))
      (voter-power (map-get? voting-power { voter: tx-sender }))
      (current-block block-height)
    )
    ;; Check if proposal is active
    ;; Check if voter has not already voted
    ;; Record vote
    ;; Update proposal vote counts
  )
)

;; Execute passed proposal
(define-public (execute-proposal
  (proposal-id uint))
  (let
    (
      (proposal (map-get? governance-proposals { proposal-id: proposal-id }))
      (status (get status proposal))
      (votes-for (get votes-for proposal))
      (votes-against (get votes-against proposal))
    )
    ;; Check if proposal passed
    ;; Apply parameter changes
    ;; Update proposal status
  )
)

;; Update protocol parameter (admin only)
(define-public (update-protocol-parameter
  (param-id (string-ascii 30))
  (new-value uint))
  (let
    (
      (param (map-get? protocol-parameters { param-id: param-id }))
      (requires-vote (get update-requires-vote param))
    )
    ;; Check if caller is authorized
    ;; Validate new value is within range
    ;; If requires vote, fail
    ;; Otherwise update parameter
  )
)
```

## Entity Relationships and Data Flow

### Policy Creation and Settlement Flow

1. **Policy Creation**:
   - User selects policy type from `policy-types`
   - System calculates premium based on risk tier from `risk-tiers`
   - Policy is created and stored in `policies` map
   - Policy is matched to underwriter pools via `match-policy-to-pools`
   - Collateral is allocated from matching pools

2. **Claim Processing**:
   - User files claim, creating entry in `policy-claims`
   - System requests verification via `request-claim-verification`
   - Oracle provides verification results stored in `claim-verifications`
   - If verified, claim is settled by transferring funds from allocated collateral

3. **Risk Management**:
   - System regularly monitors `collateral-pools` health factors
   - If health factor drops below threshold, `trigger-margin-call` is executed
   - Underwriters can `respond-to-margin-call` or face liquidation
   - `liquidate-undercollateralized-pool` is executed if margin call is not resolved

## Key Data Model Constraints

1. **Collateralization Requirements**:
   - Each policy must be fully collateralized at all times
   - Collateral requirements are determined by risk tier
   - Minimum collateral ratio must be maintained

2. **Policy Matching**:
   - Policies must be matched to pools with adequate collateral
   - Multiple pools can underwrite a single policy
   - Matching must respect underwriter preferences

3. **Oracle Verification**:
   - Claims require verification from authorized oracles
   - Different policy types may require different oracle types
   - Multiple oracle confirmations may be required based on risk tier

4. **Governance Parameters**:
   - Changes to critical protocol parameters require governance approval
   - Protocol can be upgraded through governance proposals
   - Parameter changes must stay within defined min/max bounds

## Entity Linkage Table

| Primary Entity | Related Entity | Relationship Type | Linking Field |
|----------------|----------------|-------------------|---------------|
| Policy | Policy Type | Many-to-One | policy-type |
| Policy | Collateral Pool | Many-to-Many | via policy-matches |
| Policy | Claim | One-to-Many | policy-id |
| Claim | Verification | One-to-One | claim-id |
| Collateral Pool | Margin Call | One-to-Many | pool-id |
| Collateral Pool | Underwriter | Many-to-Many | via collateral-balances |
| Risk Tier | Asset | One-to-Many | current-tier |
| Oracle | Price Feed | One-to-Many | source-oracle |
| Governance Proposal | Protocol Parameter | One-to-Many | via param-changes |

## Dependencies and External Interfaces

1. **SIP-010 Token Interface**:
   ```clarity
   ;; SIP-010 Compliance for token operations
   (impl-trait .sip-010-trait.sip-010-trait)
   ```

2. **Oracle Interface**:
   ```clarity
   ;; Oracle provider interface
   (define-trait oracle-provider-trait
     (
       (provide-data ((string-ascii 20) (string-utf8 200)) (response (string-utf8 500) uint))
       (verify-condition ((string-ascii 20) (string-utf8 200)) (response bool uint))
     )
   )
   ```

3. **External Contract Calls**:
   ```clarity
   ;; Call to token contract for transfers
   (contract-call? .token-contract transfer amount sender recipient)
   
   ;; Call to oracle contract for data
   (contract-call? .oracle-contract provide-data data-type request-data)
   ```

## Data Security and Access Control

1. **Principal-Based Authorization**:
   ```clarity
   ;; Check if caller is authorized
   (asserts! (is-eq tx-sender (var-get contract-owner)) (err u403))
   
   ;; Check if caller is policy owner
   (asserts! (is-eq tx-sender (get owner policy)) (err u401))
   ```

2. **Role-Based Permissions**:
   ```clarity
   ;; Define roles
   (define-map user-roles
     { user: principal }
     { role: (string-ascii 20) }
   )
   
   ;; Check if user has required role
   (define-private (has-role (user principal) (required-role (string-ascii 20)))
     (let ((user-role (default-to "" (get role (map-get? user-roles { user: user })))))
       (is-eq user-role required-role)
     )
   )
   ```

3. **Multi-Signature Requirements**:
   ```clarity
   ;; For critical operations
   (define-map multi-sig-operations
     { operation-id: uint }
     {
       required-signatures: uint,
       signatures: (list 10 principal),
       expiration-block: uint
     }
   )
   ```

## Conclusion

This on-chain data model specification provides a comprehensive blueprint for implementing the BitHedge DeFi platform using Clarity smart contracts. The model defines all necessary data structures, relationships, and functions to support the full lifecycle of insurance policies, from creation through claims and settlement, while maintaining appropriate risk management and governance controls.
