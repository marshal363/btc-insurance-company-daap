# BitHedge Smart Contract Architecture: European-Style Implementation

## Executive Summary

This technical report outlines a comprehensive smart contract architecture for BitHedge's European-style options platform, based on analysis of your documented requirements and best practices from production Clarity contracts. The European-style settlement model (exercise only at expiration) enables significant architectural optimizations compared to American-style options, including batch processing, predictable liquidity needs, and simplified verification mechanisms.

The proposed architecture revolves around two core contracts that handle the complete policy lifecycle, supported by specialized contracts for critical functions like price feed verification, parameter management, and verification services.

## Core Architecture Principles

1. **European-Style Settlement Model**: All options settle only at predefined expiration points, not dynamically exercised
2. **Expiration-Focused Processing**: Batch operations organized around expiration heights
3. **Comprehensive Verification**: Explicit mechanisms to ensure system correctness
4. **Risk Tier System**: Structured mechanism for matching protection buyers with providers
5. **Gas Optimization**: Efficient batch operations and data structures for minimizing costs
6. **Separation of Concerns**: Clear division of responsibilities between contracts

## Contract Architecture Overview

```
┌────────────────────────────────┐      ┌─────────────────────────────────┐
│                                │      │                                 │
│    BitHedgePolicyRegistry      │◄────►│    BitHedgeLiquidityPool        │
│    (policy lifecycle mgmt)     │      │    (capital & settlement)       │
│                                │      │                                 │
└────────────────┬───────────────┘      └─────────────────┬───────────────┘
                 │                                         │
                 │                                         │
                 ▼                                         ▼
┌────────────────────────────────┐      ┌─────────────────────────────────┐
│                                │      │                                 │
│      BitHedgePriceOracle       │      │     BitHedgeVerification        │
│      (price data provider)     │      │     (system integrity)          │
│                                │      │                                 │
└────────────────────────────────┘      └─────────────────────────────────┘
                 │                                         │
                 │                                         │
                 ▼                                         ▼
┌────────────────────────────────┐      ┌─────────────────────────────────┐
│                                │      │                                 │
│     BitHedgeMathLibrary        │      │     BitHedgeParameters          │
│     (financial calculations)   │      │     (system configuration)      │
│                                │      │                                 │
└────────────────────────────────┘      └─────────────────────────────────┘
```

## 1. Core Contracts

### 1.1 BitHedgePolicyRegistry.clar

**Purpose**: Central management of protection policies and orchestration of the policy lifecycle.

**Key Responsibilities**:

- Policy creation and tracking
- Expiration batch processing
- Settlement coordination with Liquidity Pool
- Premium recording (of submitted, verified premium) and distribution tracking
- Policy status management
- Expiration-based organization of policies

**Critical Data Structures**:

```clarity
;; Primary Policy Registry
(define-map policies
  { id: uint }
  {
    owner: principal,                      ;; Policy owner (buyer)
    counterparty: principal,               ;; Typically Liquidity Pool
    protected-value: uint,                 ;; Strike price in base units
    protection-amount: uint,               ;; Amount being protected
    expiration-height: uint,               ;; Block height for expiration
    premium: uint,                         ;; Premium amount (submitted by user, verified on-chain)
    policy-type: (string-ascii 4),         ;; "PUT" or "CALL"
    position-type: (string-ascii 9),       ;; "LONG_PUT" or "LONG_CALL"
    collateral-token: (string-ascii 4),    ;; Token used as collateral
    protected-asset: (string-ascii 4),     ;; Asset being protected
    settlement-token: (string-ascii 4),    ;; Token used for settlement
    status: (string-ascii 10),             ;; "Active", "Settled", "Expired"
    creation-height: uint,                 ;; Block height when created
    premium-distributed: bool,             ;; Whether premium distributed
    settlement-price: uint,                ;; Price at expiration (if settled)
    settlement-amount: uint,               ;; Amount settled (if in-the-money)
    is-settled: bool,                      ;; Settlement processed flag
    risk-tier: (string-ascii 32)           ;; Risk tier selection
  }
)

;; Expiration-Focused Indexing (critical for European-style)
(define-map policies-by-expiration-height
  { height: uint }
  { policy-ids: (list 50 uint) }
)

;; Owner-Focused Indexing
(define-map policies-by-owner
  { owner: principal }
  { policy-ids: (list 50 uint) }
)
```

**Key Functions**:

```clarity
;; Create a new protection policy
(define-public (create-protection-policy
  (owner principal)
  (protected-value uint)
  (protection-amount uint)
  (expiration-height uint)
  (policy-type (string-ascii 4))
  (risk-tier (string-ascii 32))
  (submitted-premium uint)) ;; Premium calculated off-chain, submitted for on-chain verification
  ;; Implementation details...
)

;; Process batch of policies at expiration
(define-public (process-expiration-batch
  (block-height uint)
  (expiration-price uint))
  ;; Implementation details...
)

;; Distribute premium for out-of-the-money policies
(define-public (distribute-premium
  (policy-id uint))
  ;; Implementation details...
)

;; Process settlement for in-the-money policies
(define-private (process-settlement-at-expiration
  (policy-id uint)
  (expiration-price uint))
  ;; Implementation details...
)
```

### 1.2 BitHedgeLiquidityPool.clar

**Purpose**: Management of capital from providers, allocation to policies, and settlement processing.

**Key Responsibilities**:

- Provider capital management
- Collateral allocation to policies
- Settlement processing
- Premium distribution to providers
- Liquidity verification
- Risk tier matching
- Provider exposure tracking

**Critical Data Structures**:

```clarity
;; Provider Balance Tracking
(define-map provider-balances
  { provider: principal, token: (string-ascii 32) }
  {
    deposited-amount: uint,      ;; Total deposited
    allocated-amount: uint,      ;; Amount allocated to policies
    available-amount: uint,      ;; Amount available for allocation
    earned-premiums: uint,       ;; Total earned premiums
    pending-premiums: uint,      ;; Premiums pending distribution
    expiration-exposure: (map uint uint)  ;; Exposure by expiration height
  }
)

;; Provider Allocation Tracking
(define-map provider-allocations
  { provider: principal, policy-id: uint }
  {
    token: (string-ascii 32),
    allocated-amount: uint,           ;; Amount allocated
    allocation-percentage: uint,      ;; Percentage of total collateral
    premium-share: uint,              ;; Share of premium
    expiration-height: uint,          ;; When policy expires
    risk-tier: (string-ascii 32),     ;; Provider's risk tier
    premium-distributed: bool         ;; Whether premium distributed
  }
)

;; Settlement Impact Tracking
(define-map settlement-impacts
  { policy-id: uint, provider: principal }
  {
    original-allocation: uint,     ;; Before settlement
    settlement-contribution: uint, ;; Provider's settlement contribution
    remaining-allocation: uint,    ;; After settlement
    settlement-percentage: uint,   ;; Percentage of allocation used
    settlement-timestamp: uint     ;; When settlement occurred
  }
)

;; Expiration-Focused Liquidity Management
(define-map expiration-liquidity-needs
  { height: uint }
  {
    total-collateral-required: uint,   ;; Collateral needed at expiration
    max-potential-settlement: uint,    ;; Maximum possible settlement
    policies-expiring: uint,           ;; Count of policies expiring
    is-liquidity-prepared: bool        ;; Whether liquidity prepared
  }
)

;; Risk Tier Parameter Registry
(define-map risk-tier-parameters
  { tier: (string-ascii 32) }
  {
    collateral-ratio: uint,           ;; Required collateral ratio (e.g., 110%)
    premium-multiplier: uint,         ;; Premium adjustment multiplier
    max-exposure-percentage: uint,    ;; Maximum exposure per provider
    description: (string-ascii 256)   ;; Human-readable description
  }
)
```

**Key Functions**:

```clarity
;; Provider deposits capital
(define-public (deposit-capital
  (amount uint)
  (token-id (string-ascii 32))
  (risk-tier (string-ascii 32)))
  ;; Implementation details...
)

;; Check if sufficient liquidity is available
(define-public (check-liquidity
  (amount uint)
  (token-id (string-ascii 32))
  (risk-tier (string-ascii 32))
  (expiration-height uint))
  ;; Implementation details...
)

;; Lock collateral for a policy
(define-public (lock-collateral
  (policy-id uint)
  (amount uint)
  (token-id (string-ascii 32))
  (risk-tier (string-ascii 32))
  (expiration-height uint))
  ;; Implementation details...
)

;; Process settlement at expiration
(define-public (process-settlement-at-expiration
  (policy-id uint)
  (recipient principal)
  (settlement-amount uint)
  (token-id (string-ascii 32)))
  ;; Implementation details...
)

;; Distribute premium to providers
(define-public (distribute-premium-to-providers
  (policy-id uint)
  (premium-amount uint)
  (token-id (string-ascii 32)))
  ;; Implementation details...
)

;; Prepare liquidity for upcoming expirations
(define-public (prepare-liquidity-for-expirations
  (upcoming-block-height uint)
  (look-ahead-blocks uint))
  ;; Implementation details...
)
```

## 2. Supporting Contracts

### 2.1 BitHedgePriceOracle.clar

**Purpose**: Provides reliable price data for premium calculation and settlement processing.

**Key Responsibilities**:

- Fetch and store Bitcoin price data
- Validate price data from multiple sources
- Calculate settlement prices at expiration
- Implement price manipulation protection
- Provide historical price lookup

**Critical Data Structures**:

```clarity
;; Price data storage
(define-map bitcoin-prices
  { height: uint }
  {
    price: uint,
    timestamp: uint,
    source-count: uint,      ;; Number of sources aggregated
    sources: (list 5 principal),  ;; Price sources
    variance: uint           ;; Variance between sources
  }
)

;; Price source registry
(define-map price-sources
  { source: principal }
  {
    enabled: bool,
    weight: uint,
    deviation-threshold: uint   ;; Max allowed deviation
  }
)

;; Price update authorization
(define-data-var authorized-updaters (list 10 principal) (list))
```

**Key Functions**:

```clarity
;; Get Bitcoin price at a specific height
(define-read-only (get-bitcoin-price-at-height
  (height uint))
  ;; Implementation details...
)

;; Get current Bitcoin price
(define-read-only (get-current-bitcoin-price)
  ;; Implementation details...
)

;; Update Bitcoin price (protected)
(define-public (update-bitcoin-price
  (height uint)
  (price uint)
  (source-data (list 5 { source: principal, price: uint })))
  ;; Implementation details...
)

;; Calculate TWAP (Time-Weighted Average Price)
(define-read-only (calculate-twap
  (start-height uint)
  (end-height uint))
  ;; Implementation details...
)
```

### 2.2 BitHedgeVerification.clar

**Purpose**: Comprehensive verification mechanisms to ensure system integrity.

**Key Responsibilities**:

- Policy allocation verification
- Premium distribution verification
- Settlement impact verification
- Provider balance verification
- System invariant checking
- Cross-contract verification

**Critical Data Structures**:

```clarity
;; Verification status tracking
(define-map verification-results
  { verification-id: uint }
  {
    timestamp: uint,
    category: (string-ascii 32),
    subject-id: uint,           ;; Policy ID or other identifier
    passed: bool,
    error-details: (optional (string-ascii 256))
  }
)

;; Verification counter
(define-data-var verification-id-counter uint u0)

;; Verification configuration
(define-map verification-parameters
  { category: (string-ascii 32) }
  {
    frequency: uint,            ;; How often to run
    enabled: bool,
    last-run: uint,
    failure-action: (string-ascii 32)  ;; What to do on failure
  }
)
```

**Key Functions**:

```clarity
;; Verify policy allocation integrity
(define-read-only (verify-policy-allocation-integrity
  (policy-id uint))
  ;; Implementation details...
)

;; Verify premium distribution correctness
(define-read-only (verify-premium-distribution-integrity
  (policy-id uint))
  ;; Implementation details...
)

;; Verify settlement impact correctness
(define-read-only (verify-settlement-integrity
  (policy-id uint))
  ;; Implementation details...
)

;; Verify provider balance consistency
(define-read-only (verify-provider-balance-integrity
  (provider principal)
  (token-id (string-ascii 32)))
  ;; Implementation details...
)

;; Verify core system invariants
(define-public (verify-system-invariants)
  ;; Implementation details...
)
```

### 2.3 BitHedgeMathLibrary.clar

**Purpose**: Financial calculations and mathematical utilities for the platform.

**Key Responsibilities**:

- Fixed-point math operations
- Option pricing model _parameter provision_ (e.g., for off-chain models)
- Settlement amount calculations
- Premium _verification_ logic (e.g., bounds checking, sanity checks for submitted premiums)
- Risk adjustment _factor application_ during verification

**Critical Data Structures**:

```clarity
;; Constants
(define-constant ONE_8 u100000000)  ;; 8 decimal precision
(define-constant MAX_UINT u340282366920938463463374607431768211455)
(define-constant DAYS_IN_YEAR u365)

;; Option pricing model parameters
(define-map volatility-parameters
  { term-days: uint }
  {
    base-volatility: uint,
    market-adjustment: uint
  }
)
```

**Key Functions**:

```clarity
;; Fixed-point multiplication (round down)
(define-read-only (mul-down (a uint) (b uint))
  (/ (* a b) ONE_8))

;; Fixed-point division (round down)
(define-read-only (div-down (a uint) (b uint))
  (if (is-eq a u0) u0 (/ (* a ONE_8) b)))

;; Verify a submitted option premium
(define-read-only (verify-premium
  (submitted-premium uint)   ;; Premium calculated off-chain
  (protected-value uint)     ;; Strike price
  (protection-amount uint)   ;; Amount protected
  (days-to-expiration uint)  ;; Time to expiration
  (policy-type (string-ascii 4))  ;; PUT or CALL
  (risk-tier (string-ascii 32))  ;; Risk tier
  ;; (oracle-price (optional uint)) ;; Potentially current oracle price for basic checks
  ;; (volatility-proxy (optional uint))) ;; Potentially a volatility proxy for bounds
  ;; This function would use parameters from BitHedgeParameters.clar
  ;; to perform checks like:
  ;; 1. Is submitted-premium within a reasonable percentage of protected-value?
  ;; 2. Does submitted-premium align with min/max bounds for the given risk-tier and days-to-expiration?
  ;; 3. Basic sanity checks (not zero, not excessively large).
  ;; It does NOT perform a full on-chain Black-Scholes calculation.
  (begin
    ;; Example: (asserts! (is-within-bounds submitted-premium protected-value risk-tier days-to-expiration) (err ERR_PREMIUM_OUT_OF_BOUNDS))
    (ok true) ;; Placeholder for actual verification logic
  )
)

;; Calculate settlement amount
(define-read-only (calculate-settlement-amount
  (policy-type (string-ascii 4))
  (protected-value uint)
  (expiration-price uint)
  (protection-amount uint))
  ;; Implementation details...
)
```

### 2.4 BitHedgeParameters.clar

**Purpose**: Central repository for system configuration parameters.

**Key Responsibilities**:

- Store system-wide parameters
- Risk tier parameter management (including parameters used in premium _verification_)
- Fee configuration
- Protocol limits and thresholds (potentially including premium verification bounds)
- Manage authorized principals

**Critical Data Structures**:

```clarity
;; System parameters
(define-map system-parameters
  { parameter-id: (string-ascii 32) }
  {
    value: uint,
    description: (string-ascii 256),
    last-updated: uint,
    updater: principal
  }
)

;; Fee structure
(define-map fee-structure
  { fee-type: (string-ascii 32) }
  {
    percentage: uint,
    min-amount: uint,
    max-amount: uint,
    recipient: principal
  }
)

;; Authorized principals
(define-map authorized-roles
  { principal: principal, role: (string-ascii 32) }
  {
    enabled: bool,
    expiration: uint
  }
)
```

**Key Functions**:

```clarity
;; Get system parameter
(define-read-only (get-system-parameter
  (parameter-id (string-ascii 32)))
  ;; Implementation details...
)

;; Update system parameter (protected)
(define-public (update-system-parameter
  (parameter-id (string-ascii 32))
  (new-value uint))
  ;; Implementation details...
)

;; Check if principal has role
(define-read-only (has-role
  (principal principal)
  (role (string-ascii 32)))
  ;; Implementation details...
)

;; Grant role to principal (admin only)
(define-public (grant-role
  (principal principal)
  (role (string-ascii 32))
  (expiration uint))
  ;; Implementation details...
)
```

## 3. Key Implementation Patterns

### 3.1 European-Style Expiration Processing

The most significant pattern in this architecture is the European-style settlement model, which enables several optimizations:

```clarity
;; Process all policies expiring at a specific block height
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

      ;; Process each policy using fold for efficiency
      (fold process-policy-at-expiration
            (get policy-ids expiring-policies)
            { processed-count: u0,
              settled-count: u0,
              expired-count: u0 })
    )
  )
)

;; Helper function for batch processing
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

This pattern:

1. Processes all policies expiring at a specific block height
2. Uses fold for gas-efficient batch processing
3. Handles in-the-money vs. out-of-the-money policies differently
4. Tracks processing results

### 3.2 Advanced Provider Selection Algorithm

The provider selection algorithm is critical for fair and efficient capital allocation:

```clarity
;; Select providers for allocation
(define-private (select-providers-for-allocation
  (amount uint)
  (token-id (string-ascii 32))
  (risk-tier (string-ascii 32)))

  (let (
      ;; Get eligible providers (matching risk tier with available capital)
      (eligible-providers (get-eligible-providers token-id risk-tier))

      ;; Sort providers by optimal allocation strategy
      (sorted-providers (sort-providers-by-allocation-strategy eligible-providers))

      ;; Initialize empty result
      (result { providers: (list), amounts: (list) })
  )
    ;; Early exit if no eligible providers
    (if (is-eq (len sorted-providers) u0)
        result

        ;; Process in a single pass with proportional allocation
        (let (
            (total-available (calculate-total-available-balance sorted-providers))
            (remaining-amount amount)
        )
          ;; Fold through providers allocating capital
          (fold allocate-to-provider
                sorted-providers
                { providers: (list),
                  amounts: (list),
                  remaining: remaining-amount,
                  total-available: total-available })
        )
    )
  )
)
```

This pattern ensures:

1. Optimal provider selection based on risk tier matching
2. Fair allocation proportional to available capital
3. Gas-efficient processing through fold operations
4. Minimum allocation thresholds to prevent excessive fragmentation

### 3.3 Settlement Impact Tracking

For robust accounting when policies settle:

```clarity
;; Calculate provider settlement impacts
(define-private (distribute-settlement-impact
  (policy-id uint)
  (total-settlement uint)
  (token-id (string-ascii 32)))

  (let ((allocations (get-policy-allocations policy-id)))
    ;; Process each provider allocation
    (map
      (lambda (allocation)
        (let (
            (provider (get provider allocation))
            (allocation-percentage (get allocation-percentage allocation))
            (provider-settlement (/ (* total-settlement allocation-percentage) u100))
        )
          ;; Record settlement impact
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
          (update-provider-balance provider provider-settlement token-id "settle")
        )
      )
      allocations
    )

    ;; Verify settlement distribution
    (verify-settlement-sum policy-id total-settlement)
  )
)
```

This ensures:

1. Proper settlement impact tracking for each provider
2. Proportional settlement based on allocation percentage
3. Verification that settlement sum equals total amount
4. Balance updates reflect settlements

### 3.4 Comprehensive Verification Mechanisms

The system implements extensive verification mechanisms:

```clarity
;; Verify allocation sum matches policy requirement
(define-private (verify-policy-allocation-integrity (policy-id uint))
  (let (
      (policy (unwrap! (map-get? policies { id: policy-id }) ERR-NOT-FOUND))
      (allocations (get-policy-allocations policy-id))
      (allocation-sum (fold sum-allocations allocations u0))
  )
    (is-eq allocation-sum (calculate-required-collateral
                          (get protected-value policy)
                          (get protection-amount policy)
                          (get policy-type policy)))
  )
)

;; Verify premium distribution sum matches policy premium
(define-private (verify-premium-distribution-sum
  (policy-id uint)
  (premium-amount uint))

  (let (
      (distributions (get-premium-distributions-by-policy policy-id))
      (distribution-sum (fold sum-premium-distributions distributions u0))
  )
    (asserts! (is-eq distribution-sum premium-amount)
              ERR-DISTRIBUTION-SUM-MISMATCH)
    true
  )
)

;; Verify settlement sum matches policy settlement amount
(define-private (verify-settlement-sum
  (policy-id uint)
  (settlement-amount uint))

  (let (
      (impacts (get-settlement-impacts policy-id))
      (impact-sum (fold sum-settlement-impacts impacts u0))
  )
    (asserts! (is-eq impact-sum settlement-amount)
              ERR-SETTLEMENT-SUM-MISMATCH)
    true
  )
)

;; Verify risk tier compatibility
(define-private (verify-tier-compatibility
  (policy-tier (string-ascii 32))
  (provider-tier (string-ascii 32)))

  (or
    (and (is-eq policy-tier "Conservative")
         (is-eq provider-tier "Conservative"))

    (and (is-eq policy-tier "Standard")
         (or (is-eq provider-tier "Balanced")
             (is-eq provider-tier "Conservative")))

    (and (is-eq policy-tier "Flexible")
         (or (is-eq provider-tier "Aggressive")
             (is-eq provider-tier "Balanced")))

    (is-eq policy-tier "Crash Insurance")  ;; Can use any tier
  )
)
```

These verification mechanisms ensure:

1. Allocation integrity across multiple providers
2. Correct premium distribution proportional to allocation
3. Accurate settlement impact tracking
4. Adherence to risk tier compatibility rules

## 4. Implementation Approach

### 4.1 Phased Development

Implementing this architecture should follow a phased approach:

1. **Phase 1: Core Infrastructure**

   - Basic Policy Registry contract
   - Simple Liquidity Pool with deposit/withdrawal
   - Price Oracle integration
   - Essential math functions

2. **Phase 2: Basic European-Style Options**

   - Complete policy lifecycle
   - Expiration batch processing
   - Simple premium distribution
   - Basic settlement processing

3. **Phase 3: Risk Tier System**

   - Risk tier parameters
   - Tier matching rules
   - Tier-specific collateral requirements
   - Premium adjustments by tier

4. **Phase 4: Advanced Features**

   - Settlement impact tracking
   - Comprehensive verification system
   - Expiration-focused liquidity planning
   - Advanced provider selection algorithm

5. **Phase 5: Optimization & Testing**
   - Gas optimization for all operations
   - Comprehensive test suite
   - Security audits
   - Performance testing under load

### 4.2 Testing Strategy

The testing strategy should focus on all aspects of the system:

1. **Unit Tests**

   - Individual function testing
   - Edge case verification
   - Parameter boundary testing
   - Error handling validation

2. **Integration Tests**

   - Cross-contract interaction testing
   - Full lifecycle scenario testing
   - Multi-user transaction sequences
   - Verification system validation

3. **System Tests**

   - Large batch processing
   - High volume operations
   - Expiration clustering testing
   - Network congestion simulation

4. **Security Testing**
   - Authorization bypass attempts
   - Invariant violation attempts
   - Economic attack simulations
   - Settlement manipulation attempts

## 5. Key Architectural Benefits

The proposed architecture offers several significant benefits:

1. **Gas Efficiency**

   - Batch processing reduces transaction count
   - Fold-based operations minimize gas costs
   - Efficient data structures reduce storage costs
   - Expiration-based organization prevents scanning

2. **Capital Efficiency**

   - Predictable settlement enables better planning
   - Provider selection algorithm optimizes allocation
   - Risk tier system matches capital appropriately
   - Expiration-focused liquidity management

3. **System Correctness**

   - Comprehensive verification mechanisms
   - Clear separation of concerns
   - Explicit settlement impact tracking
   - Detailed audit trail for all operations

4. **User Experience**

   - Clear, predictable settlement at expiration
   - Well-defined risk tier options for buyers
   - Transparent premium calculations
   - Detailed settlement records

5. **Operational Simplicity**
   - Fewer contract interactions than American-style
   - Predictable operational patterns
   - Clear authorization boundaries
   - Simpler state management

## 6. Conclusion

The proposed European-style smart contract architecture for BitHedge creates a robust, gas-efficient foundation for Bitcoin options on the Stacks blockchain. By focusing on expiration-based processing, comprehensive verification, and sophisticated risk tier matching, the system achieves high capital efficiency while ensuring correctness and transparency.

The architecture's clear separation of concerns allows for future extension while maintaining a manageable codebase. The emphasis on batch processing and verification aligns perfectly with the European-style settlement model, creating significant advantages over American-style alternatives in terms of gas costs and operational complexity.

This architecture positions BitHedge to offer a secure, efficient platform for Bitcoin options that aligns with Bitcoin holder mental models while maintaining the technical precision required for financial contracts.

## 4. Policy Creation Flow (Hybrid Premium Model)

The policy creation process integrates off-chain calculation with on-chain verification:

1.  **User Request (Frontend)**:

    - User specifies desired policy parameters: `protected-value`, `protection-amount`, `expiration-height`, `policy-type`, `risk-tier`.

2.  **Off-Chain Premium Calculation (e.g., Convex Backend)**:

    - The frontend sends these parameters to an off-chain service.
    - The off-chain service (e.g., Convex) uses its sophisticated pricing models (Black-Scholes, binomial, etc.), incorporating real-time market data, volatility, interest rates, and specific risk tier adjustments to calculate an accurate `premium`.
    - This `calculatedPremium` is returned to the frontend.

3.  **Transaction Submission (Frontend to Policy Registry)**:

    - User reviews the `calculatedPremium`.
    - Frontend constructs a transaction to call `BitHedgePolicyRegistry.create-protection-policy`.
    - The transaction includes all initial parameters _plus_ the `calculatedPremium` as `submitted-premium`.

4.  **On-Chain Verification & Execution (BitHedgePolicyRegistry)**:
    - `create-protection-policy` receives `submitted-premium`.
    - **Premium Verification**: It calls `BitHedgeMathLibrary.verify-premium`, passing `submitted-premium` and other relevant policy details.
      - `BitHedgeMathLibrary.verify-premium` uses parameters from `BitHedgeParameters.clar` (e.g., min/max premium ratios for the risk tier, allowable deviation from a simplified on-chain check) to validate `submitted-premium`. It does _not_ recalculate the full premium. It ensures the submitted value is not obviously gamed or erroneous.
    - **Liquidity Check**: If premium verification passes, Policy Registry calls `BitHedgeLiquidityPool.check-liquidity` to ensure sufficient collateral is available for the chosen risk tier and expiration.
    - **Payment & Locking**: If both checks pass:
      - The user is prompted (or the transaction proceeds if pre-approved) to transfer the `submitted-premium` amount to the system.
      - Policy Registry calls `BitHedgeLiquidityPool.lock-collateral`.
      - Policy Registry calls `BitHedgeLiquidityPool.record-premium-payment`.
    - **Policy Storage**: The policy is created and stored with the `submitted-premium` as its official premium.
    - An event is emitted, and the new `policy-id` is returned.

This hybrid approach ensures accurate and market-sensitive premium pricing (off-chain) while maintaining on-chain integrity and control through verification and transparent recording of the paid premium.
