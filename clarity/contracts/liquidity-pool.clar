;; title: liquidity-pool
;; version: 1.0.0
;; summary: Liquidity Pool Contract for BitHedge platform
;; description: Manages protection provider capital, risk tiers, and policy collateralization for the BitHedge platform.

;; traits
;;
(define-trait policy-registry-trait
  (
    ;; Get the owner of a policy
    (get-policy-owner (uint) (response principal uint))
  )
)

(define-trait sbtc-token-trait
  (
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    (get-balance (principal) (response uint uint))
    (get-total-supply () (response uint uint))
    (get-token-uri () (response (optional (string-utf8 256)) uint))
  )
)

;; token definitions
;;

;; constants
;;
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-POOL-NOT-INITIALIZED (err u101))
(define-constant ERR-POOL-PAUSED (err u102))
(define-constant ERR-INVALID-PARAMETERS (err u103))
(define-constant ERR-INSUFFICIENT-FUNDS (err u104))
(define-constant ERR-INSUFFICIENT-COLLATERAL (err u105))
(define-constant ERR-AMOUNT-TOO-SMALL (err u106))
(define-constant ERR-WITHDRAWAL-LIMIT-EXCEEDED (err u107))
(define-constant ERR-TIER-CAPACITY-EXCEEDED (err u108))
(define-constant ERR-PROVIDER-NOT-FOUND (err u109))
(define-constant ERR-POLICY-NOT-FOUND (err u110))
(define-constant ERR-UNAUTHORIZED (err u111))
(define-constant ERR-INVALID-EPOCH (err u112))
(define-constant ERR-INVALID-AMOUNT (err u113))
(define-constant ERR-TRANSFER-FAILED (err u114))
(define-constant ERR-INVALID-TIER (err u115)) ;; New error for invalid/inactive tiers

;; Constants for block height calculation
(define-constant BLOCKS-PER-DAY u144)  ;; 144 blocks per day on average

;; data vars
;;
;; Contract Owner / Admin
(define-data-var contract-owner principal tx-sender) ;; Set deployer as initial owner
;; Integration update pending pending
;; Related Contract Addresses (Placeholders - Update with actual addresses post-deployment)
(define-data-var policy-registry-address principal 'SP000000000000000000002Q6VF78) ;; Placeholder
(define-data-var treasury-address principal 'SP000000000000000000002Q6VF78) ;; Placeholder
(define-data-var insurance-fund-address principal 'SP000000000000000000002Q6VF78) ;; Placeholder
(define-data-var sbtc-token-address principal 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4) ;; Placeholder for sBTC token contract

;; Pool configuration and status
(define-data-var pool-initialized bool false)
(define-data-var pool-paused bool false)
(define-data-var pool-version uint u1)

;; Fee structure
(define-data-var platform-fee-percentage uint u10000)  ;; 1% (scaled by 1,000,000)
(define-data-var provider-fee-percentage uint u950000)  ;; 95% (scaled by 1,000,000)
(define-data-var protocol-reserve-percentage uint u40000)  ;; 4% (scaled by 1,000,000)

;; Track total pool collateral
(define-data-var total-stx-collateral uint u0)
(define-data-var total-sbtc-collateral uint u0)
(define-data-var stx-locked uint u0)  ;; Amount locked in active policies
(define-data-var sbtc-locked uint u0)  ;; Amount locked in active policies

;; Pool utilization metrics for premium calculations
(define-data-var put-utilization-rate uint u0)  ;; scaled by 1,000,000
(define-data-var call-utilization-rate uint u0)  ;; scaled by 1,000,000
(define-data-var overall-utilization-rate uint u0)  ;; scaled by 1,000,000

;; Track current epoch for yield distribution
(define-data-var current-epoch uint u0)

;; data maps
;;

;; Provider deposits per tier (Income Irene)
;; Key changed to include tier-name
(define-map provider-deposits
  { provider: principal, tier-name: (string-ascii 20) }
  {
    stx-amount: uint,
    sbtc-amount: uint,
    stx-locked: uint,     ;; Amount locked in active policies within this tier
    sbtc-locked: uint,    ;; Amount locked in active policies within this tier
    last-deposit-height: uint,
    deposit-count: uint, ;; Total deposits by provider across all tiers might need separate tracking if needed
    total-yield-earned: uint, ;; Yield might need tier-specific tracking later
    current-policies-count: uint ;; Policies within this tier
  }
)

;; Provider yield tracking (Remains per provider, per epoch for now)
(define-map provider-yield
  { provider: principal, epoch: uint }
  {
    yield-amount: uint,
    policies-count: uint,
    average-premium-rate: uint,
    distribution-height: uint,
    claimed: bool
  }
)

;; Risk parameters for policy types
(define-map policy-risk-parameters
  { policy-type: (string-ascii 4) }
  {
    base-premium-rate: uint,         ;; scaled by 1,000,000
    utilization-multiplier: uint,    ;; scaled by 1,000,000
    max-utilization: uint,           ;; scaled by 1,000,000
    moneyness-multiplier: uint,      ;; scaled by 1,000,000
    duration-multiplier: uint,       ;; scaled by 1,000,000
    min-collateralization: uint      ;; scaled by 1,000,000
  }
)

;; Risk tier configuration (mapped to UX tiers)
(define-map risk-tiers
  { tier-name: (string-ascii 20) }
  {
    min-protected-value-percentage: uint,  ;; minimum strike as % of current price
    max-protected-value-percentage: uint,  ;; maximum strike as % of current price
    premium-multiplier: uint,              ;; premium adjustment for tier
    max-duration-days: uint,               ;; maximum allowed duration in days
    status: bool                           ;; whether tier is active
  }
)

;; New map for Tier Capital Tracking
(define-map tier-capital
  { tier-name: (string-ascii 20) }
  {
    total-stx-deposited: uint,
    total-sbtc-deposited: uint,
    total-stx-locked: uint,
    total-sbtc-locked: uint,
    provider-count: uint ;; Number of unique providers in this tier
  }
)

;; New map for Tier Capacity Limits
(define-map tier-capacity-limits
  { tier-name: (string-ascii 20) }
  {
    stx-limit: uint,
    sbtc-limit: uint
  }
)

;; public functions
;;

;; Initialize the pool with default settings
(define-public (initialize-pool)
  (begin
    ;; Only allow initialization once
    (asserts! (not (var-get pool-initialized)) ERR-NOT-AUTHORIZED)
    ;; Set deployer as owner
    (var-set contract-owner tx-sender)
    ;; Set default sBTC token address (assuming standard deployer)
    ;; TODO: Consider making this updatable via governance
    (var-set sbtc-token-address 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token)
    
    ;; Set up default risk parameters for PUT options
    (map-set policy-risk-parameters
      { policy-type: "PUT" }
      {
        base-premium-rate: u50000,         ;; 5% base premium
        utilization-multiplier: u2000000,   ;; 2x multiplier based on utilization
        max-utilization: u800000,          ;; 80% maximum utilization
        moneyness-multiplier: u1500000,    ;; 1.5x multiplier for at-the-money
        duration-multiplier: u100000,      ;; 10% increase per 30 days
        min-collateralization: u1100000    ;; 110% minimum collateralization
      }
    )
    
    ;; Set up default risk parameters for CALL options
    (map-set policy-risk-parameters
      { policy-type: "CALL" }
      {
        base-premium-rate: u60000,         ;; 6% base premium
        utilization-multiplier: u2000000,   ;; 2x multiplier based on utilization
        max-utilization: u700000,          ;; 70% maximum utilization
        moneyness-multiplier: u1600000,    ;; 1.6x multiplier for at-the-money
        duration-multiplier: u120000,      ;; 12% increase per 30 days
        min-collateralization: u1200000    ;; 120% minimum collateralization
      }
    )
    
    ;; Set up default risk tiers
    (map-set risk-tiers
      { tier-name: "Conservative" }
      {
        min-protected-value-percentage: u800000,  ;; 80% of current price
        max-protected-value-percentage: u900000,  ;; 90% of current price
        premium-multiplier: u800000,              ;; 80% of standard premium
        max-duration-days: u30,                   ;; 30 days max
        status: true                              ;; active
      }
    )
    
    (map-set risk-tiers
      { tier-name: "Moderate" }
      {
        min-protected-value-percentage: u700000,  ;; 70% of current price
        max-protected-value-percentage: u850000,  ;; 85% of current price
        premium-multiplier: u1000000,             ;; 100% of standard premium
        max-duration-days: u60,                   ;; 60 days max
        status: true                              ;; active
      }
    )
    
    (map-set risk-tiers
      { tier-name: "Aggressive" }
      {
        min-protected-value-percentage: u500000,  ;; 50% of current price
        max-protected-value-percentage: u800000,  ;; 80% of current price
        premium-multiplier: u1300000,             ;; 130% of standard premium
        max-duration-days: u90,                   ;; 90 days max
        status: true                              ;; active
      }
    )
    
    ;; Initialize Tier Capital map for each default tier
    (map-set tier-capital { tier-name: "Conservative" } { total-stx-deposited: u0, total-sbtc-deposited: u0, total-stx-locked: u0, total-sbtc-locked: u0, provider-count: u0 })
    (map-set tier-capital { tier-name: "Moderate" } { total-stx-deposited: u0, total-sbtc-deposited: u0, total-stx-locked: u0, total-sbtc-locked: u0, provider-count: u0 })
    (map-set tier-capital { tier-name: "Aggressive" } { total-stx-deposited: u0, total-sbtc-deposited: u0, total-stx-locked: u0, total-sbtc-locked: u0, provider-count: u0 })

    ;; Initialize Tier Capacity Limits (Example values - adjust as needed, potentially via governance later)
    (map-set tier-capacity-limits { tier-name: "Conservative" } { stx-limit: u1000000000000, sbtc-limit: u10000000000 }) ;; 1M STX, 100 BTC
    (map-set tier-capacity-limits { tier-name: "Moderate" } { stx-limit: u2000000000000, sbtc-limit: u20000000000 }) ;; 2M STX, 200 BTC
    (map-set tier-capacity-limits { tier-name: "Aggressive" } { stx-limit: u3000000000000, sbtc-limit: u30000000000 }) ;; 3M STX, 300 BTC

    ;; Mark pool as initialized
    (var-set pool-initialized true)
    
    ;; Emit initialization event
    (print {
      event: "pool-initialized",
      version: (var-get pool-version)
    })
    
    (ok true)
  )
)

;; Deposit STX collateral to the pool into a specific tier
(define-public (deposit-stx (amount uint) (tier-name (string-ascii 20)))
  (let
    (
      (provider tx-sender)
      (current-height burn-block-height)
      (tier-info (unwrap! (map-get? risk-tiers { tier-name: tier-name }) ERR-INVALID-TIER))
      (tier-limits (unwrap! (map-get? tier-capacity-limits { tier-name: tier-name }) ERR-INVALID-TIER)) ;; Assumes limits are set for all valid tiers
      (tier-cap (unwrap! (map-get? tier-capital { tier-name: tier-name }) ERR-INVALID-TIER)) ;; Assumes capital map is initialized
      (provider-key { provider: provider, tier-name: tier-name })
      (provider-data (default-to
        {
          stx-amount: u0,
          sbtc-amount: u0,
          stx-locked: u0,
          sbtc-locked: u0,
          last-deposit-height: u0,
          deposit-count: u0,
          total-yield-earned: u0,
          current-policies-count: u0
        }
        (map-get? provider-deposits provider-key)
      ))
      (is-new-provider-for-tier (is-none (map-get? provider-deposits provider-key)))
    )

    ;; Check if pool is initialized and not paused
    (asserts! (var-get pool-initialized) ERR-POOL-NOT-INITIALIZED)
    (asserts! (not (var-get pool-paused)) ERR-POOL-PAUSED)

    ;; Check if tier is active
    (asserts! (get status tier-info) ERR-INVALID-TIER)

    ;; Check for valid amount
    (asserts! (> amount u0) ERR-INVALID-PARAMETERS)

    ;; Check Tier Capacity Limit for STX
    (asserts! (<= (+ (get total-stx-deposited tier-cap) amount) (get stx-limit tier-limits))
              ERR-TIER-CAPACITY-EXCEEDED)

    ;; Transfer STX from provider to this contract
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))

    ;; Update provider deposit data for this tier
    (map-set provider-deposits
      provider-key
      {
        stx-amount: (+ (get stx-amount provider-data) amount),
        sbtc-amount: (get sbtc-amount provider-data), ;; Keep sBTC amount as is for this tier entry
        stx-locked: (get stx-locked provider-data),
        sbtc-locked: (get sbtc-locked provider-data),
        last-deposit-height: current-height,
        deposit-count: (+ (get deposit-count provider-data) u1), ;; Increment deposit count for this provider/tier
        total-yield-earned: (get total-yield-earned provider-data), ;; Yield remains aggregated for now
        current-policies-count: (get current-policies-count provider-data)
      }
    )

    ;; Update tier capital data
    (map-set tier-capital
      { tier-name: tier-name }
      (merge tier-cap {
        total-stx-deposited: (+ (get total-stx-deposited tier-cap) amount),
        provider-count: (if is-new-provider-for-tier (+ (get provider-count tier-cap) u1) (get provider-count tier-cap))
      })
    )

    ;; Update overall pool total
    (var-set total-stx-collateral (+ (var-get total-stx-collateral) amount))

    ;; Emit deposit event
    (print {
      event: "collateral-deposited",
      provider: provider,
      tier: tier-name, ;; Add tier info
      token-type: "STX",
      amount: amount,
      tier-total-deposited: (+ (get total-stx-deposited tier-cap) amount), ;; Total in this tier after deposit
      provider-tier-total: (+ (get stx-amount provider-data) amount) ;; Provider's total in this tier after deposit
    })

    (ok amount)
  )
)

;; Deposit sBTC collateral to the pool into a specific tier
(define-public (deposit-sbtc (amount uint) (tier-name (string-ascii 20)))
  (let
    (
      (provider tx-sender)
      (current-height burn-block-height)
      (tier-info (unwrap! (map-get? risk-tiers { tier-name: tier-name }) ERR-INVALID-TIER))
      (tier-limits (unwrap! (map-get? tier-capacity-limits { tier-name: tier-name }) ERR-INVALID-TIER))
      (tier-cap (unwrap! (map-get? tier-capital { tier-name: tier-name }) ERR-INVALID-TIER))
      (provider-key { provider: provider, tier-name: tier-name })
      (provider-data (default-to
        {
          stx-amount: u0,
          sbtc-amount: u0,
          stx-locked: u0,
          sbtc-locked: u0,
          last-deposit-height: u0,
          deposit-count: u0,
          total-yield-earned: u0,
          current-policies-count: u0
        }
        (map-get? provider-deposits provider-key)
      ))
      (is-new-provider-for-tier (is-none (map-get? provider-deposits provider-key)))
    )

    ;; Check if pool is initialized and not paused
    (asserts! (var-get pool-initialized) ERR-POOL-NOT-INITIALIZED)
    (asserts! (not (var-get pool-paused)) ERR-POOL-PAUSED)

    ;; Check if tier is active
    (asserts! (get status tier-info) ERR-INVALID-TIER)

    ;; Check for valid amount
    (asserts! (> amount u0) ERR-INVALID-PARAMETERS)

    ;; Check Tier Capacity Limit for sBTC
    (asserts! (<= (+ (get total-sbtc-deposited tier-cap) amount) (get sbtc-limit tier-limits))
              ERR-TIER-CAPACITY-EXCEEDED)

    ;; Transfer sBTC from provider to this contract - using direct contract-call instead of contract-of
    (try! (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer amount tx-sender provider none))

    ;; Update provider deposit data for this tier
    (map-set provider-deposits
      provider-key
      {
        stx-amount: (get stx-amount provider-data), ;; Keep STX amount as is
        sbtc-amount: (+ (get sbtc-amount provider-data) amount),
        stx-locked: (get stx-locked provider-data),
        sbtc-locked: (get sbtc-locked provider-data),
        last-deposit-height: current-height,
        deposit-count: (+ (get deposit-count provider-data) u1), ;; Increment deposit count for this provider/tier
        total-yield-earned: (get total-yield-earned provider-data), ;; Yield remains aggregated
        current-policies-count: (get current-policies-count provider-data)
      }
    )

    ;; Update tier capital data
    (map-set tier-capital
      { tier-name: tier-name }
      (merge tier-cap {
        total-sbtc-deposited: (+ (get total-sbtc-deposited tier-cap) amount),
        provider-count: (if is-new-provider-for-tier (+ (get provider-count tier-cap) u1) (get provider-count tier-cap))
      })
    )

    ;; Update overall pool total
    (var-set total-sbtc-collateral (+ (var-get total-sbtc-collateral) amount))

    ;; Emit deposit event
    (print {
      event: "collateral-deposited",
      provider: provider,
      tier: tier-name, ;; Add tier info
      token-type: "SBTC",
      amount: amount,
      tier-total-deposited: (+ (get total-sbtc-deposited tier-cap) amount), ;; Total in this tier after deposit
      provider-tier-total: (+ (get sbtc-amount provider-data) amount) ;; Provider's total in this tier after deposit
    })

    (ok amount)
  )
)

;; Withdraw STX collateral from the pool from a specific tier
(define-public (withdraw-stx (amount uint) (tier-name (string-ascii 20)))
  (let
    (
      (provider tx-sender)
      (provider-key { provider: provider, tier-name: tier-name })
      (provider-data (unwrap! (map-get? provider-deposits provider-key) ERR-PROVIDER-NOT-FOUND)) ;; Ensure provider has deposit in this tier
      (tier-cap (unwrap! (map-get? tier-capital { tier-name: tier-name }) ERR-INVALID-TIER)) ;; Fetch tier capital data
      (available-amount (- (get stx-amount provider-data) (get stx-locked provider-data)))
      (new-stx-amount (- (get stx-amount provider-data) amount))
      (new-sbtc-amount (get sbtc-amount provider-data))
      (is-provider-leaving-tier (and (is-eq new-stx-amount u0) (is-eq new-sbtc-amount u0)))
    )

    ;; Check if pool is initialized and not paused
    (asserts! (var-get pool-initialized) ERR-POOL-NOT-INITIALIZED)
    (asserts! (not (var-get pool-paused)) ERR-POOL-PAUSED)

    ;; Check for valid amount and sufficient available balance in this tier
    (asserts! (> amount u0) ERR-INVALID-PARAMETERS)
    (asserts! (>= available-amount amount) ERR-WITHDRAWAL-LIMIT-EXCEEDED)
    ;; TODO: Integrate health ratio checks (Phase 4)

    ;; Transfer STX from this contract to provider
    (try! (as-contract (stx-transfer? amount tx-sender provider)))

    ;; Update provider deposit data for this tier
    (map-set provider-deposits
      provider-key
      (merge provider-data {
        stx-amount: new-stx-amount
      })
    )

    ;; Update tier capital data
    (map-set tier-capital
      { tier-name: tier-name }
      (merge tier-cap {
        total-stx-deposited: (- (get total-stx-deposited tier-cap) amount),
        ;; Decrement provider count only if this withdrawal removes the provider entirely from this tier
        provider-count: (if is-provider-leaving-tier (if (> (get provider-count tier-cap) u0) (- (get provider-count tier-cap) u1) u0) (get provider-count tier-cap))
      })
    )

    ;; Update overall pool total
    (var-set total-stx-collateral (- (var-get total-stx-collateral) amount))

    ;; Emit withdrawal event
    (print {
      event: "collateral-withdrawn",
      provider: provider,
      tier: tier-name, ;; Add tier info
      token-type: "STX",
      amount: amount,
      tier-total-remaining: (- (get total-stx-deposited tier-cap) amount), ;; Total in tier after withdrawal
      provider-tier-remaining: new-stx-amount ;; Provider's total in this tier after withdrawal
    })

    (ok amount)
  )
)

;; Withdraw sBTC collateral from the pool from a specific tier
(define-public (withdraw-sbtc (amount uint) (tier-name (string-ascii 20)))
  (let
    (
      (provider tx-sender)
      (provider-key { provider: provider, tier-name: tier-name })
      (provider-data (unwrap! (map-get? provider-deposits provider-key) ERR-PROVIDER-NOT-FOUND)) ;; Ensure provider has deposit in this tier
      (tier-cap (unwrap! (map-get? tier-capital { tier-name: tier-name }) ERR-INVALID-TIER)) ;; Fetch tier capital data
      (available-amount (- (get sbtc-amount provider-data) (get sbtc-locked provider-data)))
      (new-stx-amount (get stx-amount provider-data))
      (new-sbtc-amount (- (get sbtc-amount provider-data) amount))
      (is-provider-leaving-tier (and (is-eq new-stx-amount u0) (is-eq new-sbtc-amount u0)))
    )

    ;; Check if pool is initialized and not paused
    (asserts! (var-get pool-initialized) ERR-POOL-NOT-INITIALIZED)
    (asserts! (not (var-get pool-paused)) ERR-POOL-PAUSED)

    ;; Check for valid amount and sufficient available balance in this tier
    (asserts! (> amount u0) ERR-INVALID-PARAMETERS)
    (asserts! (>= available-amount amount) ERR-WITHDRAWAL-LIMIT-EXCEEDED)
    ;; TODO: Integrate health ratio checks (Phase 4)

    ;; Transfer sBTC from this contract to provider - using direct contract-call instead of contract-of
    (try! (as-contract (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer amount tx-sender provider none)))

    ;; Update provider deposit data for this tier
    (map-set provider-deposits
      provider-key
      (merge provider-data {
        sbtc-amount: new-sbtc-amount
      })
    )

    ;; Update tier capital data
    (map-set tier-capital
      { tier-name: tier-name }
      (merge tier-cap {
        total-sbtc-deposited: (- (get total-sbtc-deposited tier-cap) amount),
        ;; Decrement provider count only if this withdrawal removes the provider entirely from this tier
        provider-count: (if is-provider-leaving-tier (if (> (get provider-count tier-cap) u0) (- (get provider-count tier-cap) u1) u0) (get provider-count tier-cap))
      })
    )

    ;; Update overall pool total
    (var-set total-sbtc-collateral (- (var-get total-sbtc-collateral) amount))

    ;; Emit withdrawal event
    (print {
      event: "collateral-withdrawn",
      provider: provider,
      tier: tier-name, ;; Add tier info
      token-type: "SBTC",
      amount: amount,
      tier-total-remaining: (- (get total-sbtc-deposited tier-cap) amount), ;; Total in tier after withdrawal
      provider-tier-remaining: new-sbtc-amount ;; Provider's total in this tier after withdrawal
    })

    (ok amount)
  )
)

;; Reserve collateral for a policy within a specific tier
(define-public (reserve-policy-collateral
    (policy-id uint)
    (amount uint)
    (token-type (string-ascii 4)) ;; "STX" or "SBTC"
    (policy-type (string-ascii 4))
    (tier-name (string-ascii 20)) ;; Tier this policy belongs to/requires collateral from
    (counterparty principal))
  (let
    (
      (provider counterparty)
      ;; Authorization: Check if called by the registered policy registry contract
      (is-authorized (is-eq tx-sender (var-get policy-registry-address)))
      (tier-info (unwrap! (map-get? risk-tiers { tier-name: tier-name }) ERR-INVALID-TIER))
    )

    ;; Check authorization
    (asserts! is-authorized ERR-UNAUTHORIZED)
    ;; Check if tier is active
    (asserts! (get status tier-info) ERR-INVALID-TIER)

    (let
      (
        (provider-key { provider: provider, tier-name: tier-name })
        (provider-data (unwrap! (map-get? provider-deposits provider-key) ERR-PROVIDER-NOT-FOUND)) ;; Provider must have funds in this specific tier
        (tier-cap (unwrap! (map-get? tier-capital { tier-name: tier-name }) ERR-INVALID-TIER))
        (is-stx (is-eq token-type "STX"))
        (is-sbtc (is-eq token-type "SBTC"))
        (available-amount (if is-stx
                           (- (get stx-amount provider-data) (get stx-locked provider-data))
                           (if is-sbtc
                             (- (get sbtc-amount provider-data) (get sbtc-locked provider-data))
                             u0)))
      )

      ;; Check if pool is initialized and not paused
      (asserts! (var-get pool-initialized) ERR-POOL-NOT-INITIALIZED)
      (asserts! (not (var-get pool-paused)) ERR-POOL-PAUSED)

      ;; Validate token type
      (asserts! (or is-stx is-sbtc) ERR-INVALID-PARAMETERS)

      ;; Validate amount and provider's available collateral IN THIS TIER
      (asserts! (> amount u0) ERR-INVALID-AMOUNT)
      (asserts! (>= available-amount amount) ERR-INSUFFICIENT-COLLATERAL)

      ;; Check if policy type is valid
      (asserts! (or (is-eq policy-type "PUT") (is-eq policy-type "CALL")) ERR-INVALID-PARAMETERS)

      ;; Update provider deposit data to lock collateral within the tier
      (map-set provider-deposits
        provider-key
        (merge provider-data {
          stx-locked: (if is-stx (+ (get stx-locked provider-data) amount) (get stx-locked provider-data)),
          sbtc-locked: (if is-sbtc (+ (get sbtc-locked provider-data) amount) (get sbtc-locked provider-data)),
          current-policies-count: (+ (get current-policies-count provider-data) u1) ;; Increment policy count for this tier
        })
      )

      ;; Update tier capital locked amount
      (map-set tier-capital
        { tier-name: tier-name }
        (merge tier-cap {
          total-stx-locked: (if is-stx (+ (get total-stx-locked tier-cap) amount) (get total-stx-locked tier-cap)),
          total-sbtc-locked: (if is-sbtc (+ (get total-sbtc-locked tier-cap) amount) (get total-sbtc-locked tier-cap))
        })
      )

      ;; Update overall pool total locked amount
      (if is-stx
        (var-set stx-locked (+ (var-get stx-locked) amount))
        (var-set sbtc-locked (+ (var-get sbtc-locked) amount))
      )

      ;; Update utilization rates
      ;; TODO: Update utilization rates considering sBTC and Tiers (Phase 4/5)
      (update-utilization-rates) ;; Currently only updates STX-based overall rate

      ;; Emit collateral reservation event
      (print {
        event: "collateral-reserved",
        policy-id: policy-id,
        provider: provider,
        tier: tier-name, ;; Add tier info
        token-type: token-type,
        amount: amount,
        policy-type: policy-type
      })

      (ok amount)
    )
  )
)

;; Release collateral when a policy expires from a specific tier
(define-public (release-policy-collateral
    (policy-id uint)
    (amount uint)
    (token-type (string-ascii 4)) ;; "STX" or "SBTC"
    (tier-name (string-ascii 20)) ;; Tier the policy collateral was reserved in
    (counterparty principal))
  (let
    (
      ;; Authorization: Check if called by the registered policy registry contract
      (is-authorized (is-eq tx-sender (var-get policy-registry-address)))
      (provider counterparty)
      (provider-key { provider: provider, tier-name: tier-name })
      (provider-data (unwrap! (map-get? provider-deposits provider-key) ERR-PROVIDER-NOT-FOUND)) ;; Provider must have entry for this tier
      (tier-cap (unwrap! (map-get? tier-capital { tier-name: tier-name }) ERR-INVALID-TIER))
      (is-stx (is-eq token-type "STX"))
      (is-sbtc (is-eq token-type "SBTC"))
    )

    ;; Check authorization
    (asserts! is-authorized ERR-UNAUTHORIZED)

    ;; Validate token type
    (asserts! (or is-stx is-sbtc) ERR-INVALID-PARAMETERS)

    ;; Ensure provider has enough locked collateral of the specified type IN THIS TIER
    (asserts! (if is-stx
               (>= (get stx-locked provider-data) amount)
               (>= (get sbtc-locked provider-data) amount))
             ERR-INSUFFICIENT-COLLATERAL) ;; Should perhaps be a different error like ERR-UNLOCK-FAILED?

    ;; Update provider deposit data to unlock collateral within the tier
    (map-set provider-deposits
      provider-key
      (merge provider-data {
        stx-locked: (if is-stx (- (get stx-locked provider-data) amount) (get stx-locked provider-data)),
        sbtc-locked: (if is-sbtc (- (get sbtc-locked provider-data) amount) (get sbtc-locked provider-data)),
        current-policies-count: (if (> (get current-policies-count provider-data) u0)
                                   (- (get current-policies-count provider-data) u1)
                                   u0) ;; Decrement policy count for this tier
      })
    )

    ;; Update tier capital locked amount
    (map-set tier-capital
      { tier-name: tier-name }
      (merge tier-cap {
        total-stx-locked: (if is-stx (if (> (get total-stx-locked tier-cap) amount) (- (get total-stx-locked tier-cap) amount) u0) (get total-stx-locked tier-cap)),
        total-sbtc-locked: (if is-sbtc (if (> (get total-sbtc-locked tier-cap) amount) (- (get total-sbtc-locked tier-cap) amount) u0) (get total-sbtc-locked tier-cap))
      })
    )

    ;; Update overall pool total locked amount
    (if is-stx
      (var-set stx-locked (- (var-get stx-locked) amount))
      (var-set sbtc-locked (- (var-get sbtc-locked) amount))
    )

    ;; Update utilization rates
    ;; TODO: Update utilization rates considering sBTC and Tiers (Phase 4/5)
    (update-utilization-rates) ;; Currently only updates STX-based overall rate

    ;; Emit collateral release event
    (print {
      event: "collateral-released",
      policy-id: policy-id,
      provider: provider,
      tier: tier-name, ;; Add tier info
      token-type: token-type,
      amount: amount
    })

    (ok amount)
  )
)

;; Process policy settlement (when a policy is activated/exercised) from a specific tier
(define-public (process-policy-settlement
    (policy-id uint)
    (settlement-amount uint)
    (token-type (string-ascii 4)) ;; "STX" or "SBTC"
    (tier-name (string-ascii 20)) ;; Tier the policy collateral was reserved in
    (counterparty principal)
    (policy-buyer principal))
  (let
    (
      ;; Authorization: Check if called by the registered policy registry contract
      (is-authorized (is-eq tx-sender (var-get policy-registry-address)))
      (provider counterparty)
      (provider-key { provider: provider, tier-name: tier-name })
      (provider-data (unwrap! (map-get? provider-deposits provider-key) ERR-PROVIDER-NOT-FOUND)) ;; Provider must have entry for this tier
      (tier-cap (unwrap! (map-get? tier-capital { tier-name: tier-name }) ERR-INVALID-TIER))
      (is-stx (is-eq token-type "STX"))
      (is-sbtc (is-eq token-type "SBTC"))
    )

    ;; Check authorization
    (asserts! is-authorized ERR-UNAUTHORIZED)

    ;; Validate token type
    (asserts! (or is-stx is-sbtc) ERR-INVALID-PARAMETERS)

    ;; Ensure provider has enough locked collateral of the specified type IN THIS TIER
    (asserts! (if is-stx
               (>= (get stx-locked provider-data) settlement-amount)
               (>= (get sbtc-locked provider-data) settlement-amount))
             ERR-INSUFFICIENT-COLLATERAL)

    ;; Transfer settlement amount from this contract to policy owner (buyer)
    (if is-stx
      (try! (as-contract (stx-transfer? settlement-amount tx-sender policy-buyer)))
      (try! (as-contract (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer settlement-amount tx-sender policy-buyer none)))
    )

    ;; Update provider deposit data for the tier: Reduce total amount and locked amount
    (map-set provider-deposits
      provider-key
      (merge provider-data {
        stx-amount: (if is-stx (- (get stx-amount provider-data) settlement-amount) (get stx-amount provider-data)),
        sbtc-amount: (if is-sbtc (- (get sbtc-amount provider-data) settlement-amount) (get sbtc-amount provider-data)),
        stx-locked: (if is-stx (- (get stx-locked provider-data) settlement-amount) (get stx-locked provider-data)),
        sbtc-locked: (if is-sbtc (- (get sbtc-locked provider-data) settlement-amount) (get sbtc-locked provider-data)),
        current-policies-count: (if (> (get current-policies-count provider-data) u0)
                                   (- (get current-policies-count provider-data) u1)
                                   u0) ;; Decrement policy count for this tier
      })
    )

    ;; Update tier capital data: Reduce total deposited and total locked
    (map-set tier-capital
      { tier-name: tier-name }
      (merge tier-cap {
        total-stx-deposited: (if is-stx (if (> (get total-stx-deposited tier-cap) settlement-amount) (- (get total-stx-deposited tier-cap) settlement-amount) u0) (get total-stx-deposited tier-cap)),
        total-sbtc-deposited: (if is-sbtc (if (> (get total-sbtc-deposited tier-cap) settlement-amount) (- (get total-sbtc-deposited tier-cap) settlement-amount) u0) (get total-sbtc-deposited tier-cap)),
        total-stx-locked: (if is-stx (if (> (get total-stx-locked tier-cap) settlement-amount) (- (get total-stx-locked tier-cap) settlement-amount) u0) (get total-stx-locked tier-cap)),
        total-sbtc-locked: (if is-sbtc (if (> (get total-sbtc-locked tier-cap) settlement-amount) (- (get total-sbtc-locked tier-cap) settlement-amount) u0) (get total-sbtc-locked tier-cap))
        ;; provider-count is not decremented here, only on full withdrawal
      })
    )

    ;; Update overall pool totals
    (if is-stx
      (begin
        (var-set total-stx-collateral (- (var-get total-stx-collateral) settlement-amount))
        (var-set stx-locked (- (var-get stx-locked) settlement-amount))
      )
      (begin
        (var-set total-sbtc-collateral (- (var-get total-sbtc-collateral) settlement-amount))
        (var-set sbtc-locked (- (var-get sbtc-locked) settlement-amount))
      )
    )

    ;; Update utilization rates
    ;; TODO: Update utilization rates considering sBTC and Tiers (Phase 4/5)
    (update-utilization-rates) ;; Currently only updates STX-based overall rate

    ;; Emit settlement event
    (print {
      event: "policy-settlement-processed",
      policy-id: policy-id,
      provider: provider,
      tier: tier-name, ;; Add tier info
      token-type: token-type,
      settlement-amount: settlement-amount
    })

    (ok settlement-amount)
  )
)

;; Calculate premium for a policy based on parameters
(define-read-only (calculate-premium
    (policy-type (string-ascii 4))
    (protected-value uint)
    (protected-amount uint)
    (duration-blocks uint)
    (tier-name (string-ascii 20)))
  (let
    (
      (risk-params (unwrap! (map-get? policy-risk-parameters { policy-type: policy-type }) (err u0)))
      (tier-config (unwrap! (map-get? risk-tiers { tier-name: tier-name }) (err u0)))
    )
    ;; Check if the tier is active
    (if (get status tier-config)
        ;; Tier is active, proceed with calculation inside a nested let
        (let
          (
            (base-rate (get base-premium-rate risk-params))
            (utilization-rate (if (is-eq policy-type "PUT")
                                (var-get put-utilization-rate)
                                (var-get call-utilization-rate)))
            (utilization-factor (min-uint u1000000 (/ (* utilization-rate (get utilization-multiplier risk-params)) u1000000)))
            ;; Simplified duration factor: % increase per 30 days (scaled)
            (days (/ duration-blocks BLOCKS-PER-DAY))
            (duration-periods (/ days u30))
            (duration-increase (* duration-periods (get duration-multiplier risk-params)))
            (duration-factor (/ duration-increase u1000000))
            (tier-multiplier (get premium-multiplier tier-config))
            (effective-rate (+ base-rate utilization-factor duration-factor))
            (adjusted-rate (/ (* effective-rate tier-multiplier) u1000000))
            (premium-amount (/ (* protected-amount adjusted-rate) u1000000))
          )
          (ok premium-amount) ;; Return calculated premium
        )
        ;; Else, tier is inactive, return error
        (err ERR-INVALID-TIER)
    )
  )
)

;; Record premium for yield distribution
(define-public (record-premium
    (premium-amount uint)
    (policy-id uint)
    (counterparty principal))
  (let
    (
      ;; Authorization: Check if called by the registered policy registry contract
      (is-authorized (is-eq tx-sender (var-get policy-registry-address)))
      (provider counterparty)
      (provider-data (unwrap! (map-get? provider-deposits { provider: provider }) ERR-PROVIDER-NOT-FOUND))
      (current-ep (var-get current-epoch))
      (platform-fee (/ (* premium-amount (var-get platform-fee-percentage)) u1000000))
      (protocol-reserve (/ (* premium-amount (var-get protocol-reserve-percentage)) u1000000))
      (provider-premium (- premium-amount (+ platform-fee protocol-reserve)))
      (provider-yield-data (default-to 
        {
          yield-amount: u0,
          policies-count: u0,
          average-premium-rate: u0,
          distribution-height: burn-block-height,
          claimed: false
        }
        (map-get? provider-yield { provider: provider, epoch: current-ep })
      ))
    )
    
    ;; Check if pool is initialized
    (asserts! (var-get pool-initialized) ERR-POOL-NOT-INITIALIZED)
    
    ;; Check authorization
    (asserts! is-authorized ERR-UNAUTHORIZED)
    
    ;; TODO: Transfer platform fee to treasury
    
    ;; TODO: Transfer protocol reserve to insurance fund
    
    ;; Update provider yield data for current epoch
    (map-set provider-yield
      { provider: provider, epoch: current-ep }
      {
        yield-amount: (+ (get yield-amount provider-yield-data) provider-premium),
        policies-count: (+ (get policies-count provider-yield-data) u1),
        average-premium-rate: (if (> (get policies-count provider-yield-data) u0)
                               (/ (+ (* (get average-premium-rate provider-yield-data) (get policies-count provider-yield-data)) 
                                    (/ (* provider-premium u1000000) premium-amount))
                                 (+ (get policies-count provider-yield-data) u1))
                               (/ (* provider-premium u1000000) premium-amount)),
        distribution-height: burn-block-height,
        claimed: false
      }
    )
    
    ;; Update provider total yield earned
    (map-set provider-deposits
      { provider: provider }
      (merge provider-data {
        total-yield-earned: (+ (get total-yield-earned provider-data) provider-premium)
      })
    )
    
    ;; Emit premium recorded event
    (print {
      event: "premium-recorded",
      policy-id: policy-id,
      provider: provider,
      premium-amount: premium-amount,
      provider-premium: provider-premium,
      platform-fee: platform-fee,
      protocol-reserve: protocol-reserve,
      epoch: current-ep
    })
    
    (ok provider-premium)
  )
)

;; Start a new yield distribution epoch
(define-public (start-new-epoch)
  (begin
    ;; Check if pool is initialized
    (asserts! (var-get pool-initialized) ERR-POOL-NOT-INITIALIZED)
    
    ;; Authorization check: Only contract owner
    (asserts! (is-owner) ERR-UNAUTHORIZED)
    
    ;; Increment epoch counter
    (var-set current-epoch (+ (var-get current-epoch) u1))
    
    ;; Emit new epoch event
    (print {
      event: "new-epoch-started",
      epoch: (var-get current-epoch),
      start-height: burn-block-height
    })
    
    (ok (var-get current-epoch))
  )
)

;; Claim yield for a specific epoch
(define-public (claim-yield (epoch uint))
  (let
    (
      (provider tx-sender)
      (current-ep (var-get current-epoch))
    )
    
    ;; Validate epoch
    (asserts! (<= epoch current-ep) ERR-INVALID-EPOCH)
    
    (let
      (
        (yield-data (unwrap! (map-get? provider-yield { provider: provider, epoch: epoch }) ERR-INVALID-PARAMETERS))
      )
      
      ;; Check if pool is initialized and not paused
      (asserts! (var-get pool-initialized) ERR-POOL-NOT-INITIALIZED)
      (asserts! (not (var-get pool-paused)) ERR-POOL-PAUSED)
      
      ;; Check if yield is not already claimed
      (asserts! (not (get claimed yield-data)) ERR-INVALID-PARAMETERS)
      
      ;; Get yield amount
      (let
        (
          (yield-amount (get yield-amount yield-data))
        )
        
        ;; Validate yield amount
        (asserts! (> yield-amount u0) ERR-INVALID-AMOUNT)
        
        ;; Transfer yield amount from this contract to provider
        (try! (as-contract (stx-transfer? yield-amount tx-sender provider)))
        
        ;; Mark yield as claimed
        (map-set provider-yield
          { provider: provider, epoch: epoch }
          (merge yield-data {
            claimed: true
          })
        )
        
        ;; Emit yield claimed event
        (print {
          event: "yield-claimed",
          provider: provider,
          epoch: epoch,
          yield-amount: yield-amount
        })
        
        (ok yield-amount)
      )
    )
  )
)

;; Pause the pool (emergency function)
(define-public (pause-pool)
  (begin
    ;; Authorization check: Only contract owner
    (asserts! (is-owner) ERR-UNAUTHORIZED)
    
    ;; Set pool to paused
    (var-set pool-paused true)
    
    ;; Emit pause event
    (print {
      event: "pool-paused",
      height: burn-block-height
    })
    
    (ok true)
  )
)

;; Unpause the pool
(define-public (unpause-pool)
  (begin
    ;; Authorization check: Only contract owner
    (asserts! (is-owner) ERR-UNAUTHORIZED)
    
    ;; Set pool to not paused
    (var-set pool-paused false)
    
    ;; Emit unpause event
    (print {
      event: "pool-unpaused",
      height: burn-block-height
    })
    
    (ok true)
  )
)

;; Update policy risk parameters
(define-public (update-policy-risk-parameters
    (policy-type (string-ascii 4))
    (base-premium-rate uint)
    (utilization-multiplier uint)
    (max-utilization uint)
    (moneyness-multiplier uint)
    (duration-multiplier uint)
    (min-collateralization uint))
  (begin
    ;; Authorization check: Only contract owner
    (asserts! (is-owner) ERR-UNAUTHORIZED)
    
    ;; Validate parameters
    (asserts! (and (> base-premium-rate u0) 
                  (> utilization-multiplier u0)
                  (> max-utilization u0)
                  (> moneyness-multiplier u0)
                  (> duration-multiplier u0)
                  (> min-collateralization u1000000))
             ERR-INVALID-PARAMETERS)
    
    ;; Update policy risk parameters
    (map-set policy-risk-parameters
      { policy-type: policy-type }
      {
        base-premium-rate: base-premium-rate,
        utilization-multiplier: utilization-multiplier,
        max-utilization: max-utilization,
        moneyness-multiplier: moneyness-multiplier,
        duration-multiplier: duration-multiplier,
        min-collateralization: min-collateralization
      }
    )
    
    ;; Emit parameter update event
    (print {
      event: "policy-risk-parameters-updated",
      policy-type: policy-type,
      base-premium-rate: base-premium-rate,
      utilization-multiplier: utilization-multiplier,
      max-utilization: max-utilization,
      moneyness-multiplier: moneyness-multiplier,
      duration-multiplier: duration-multiplier,
      min-collateralization: min-collateralization
    })
    
    (ok true)
  )
)

;; Update risk tier configuration
(define-public (update-risk-tier
    (tier-name (string-ascii 20))
    (min-protected-value-percentage uint)
    (max-protected-value-percentage uint)
    (premium-multiplier uint)
    (max-duration-days uint)
    (status bool))
  (begin
    ;; Authorization check: Only contract owner
    (asserts! (is-owner) ERR-UNAUTHORIZED)
    
    ;; Validate parameters
    (asserts! (and (> min-protected-value-percentage u0) 
                  (> max-protected-value-percentage min-protected-value-percentage)
                  (> premium-multiplier u0)
                  (> max-duration-days u0))
             ERR-INVALID-PARAMETERS)
    
    ;; Update risk tier
    (map-set risk-tiers
      { tier-name: tier-name }
      {
        min-protected-value-percentage: min-protected-value-percentage,
        max-protected-value-percentage: max-protected-value-percentage,
        premium-multiplier: premium-multiplier,
        max-duration-days: max-duration-days,
        status: status
      }
    )
    
    ;; Emit tier update event
    (print {
      event: "risk-tier-updated",
      tier-name: tier-name,
      min-protected-value-percentage: min-protected-value-percentage,
      max-protected-value-percentage: max-protected-value-percentage,
      premium-multiplier: premium-multiplier,
      max-duration-days: max-duration-days,
      status: status
    })
    
    (ok true)
  )
)

;; Update fee structure
(define-public (update-fee-structure
    (platform-fee uint)
    (provider-fee uint)
    (protocol-reserve uint))
  (begin
    ;; Authorization check: Only contract owner
    (asserts! (is-owner) ERR-UNAUTHORIZED)
    
    ;; Validate that fees add up to 1,000,000 (100%)
    (asserts! (is-eq (+ platform-fee provider-fee protocol-reserve) u1000000) ERR-INVALID-PARAMETERS)
    
    ;; Update fee structure
    (var-set platform-fee-percentage platform-fee)
    (var-set provider-fee-percentage provider-fee)
    (var-set protocol-reserve-percentage protocol-reserve)
    
    ;; Emit fee update event
    (print {
      event: "fee-structure-updated",
      platform-fee: platform-fee,
      provider-fee: provider-fee,
      protocol-reserve: protocol-reserve
    })
    
    (ok true)
  )
)

;; read only functions
;;

;; Get provider deposit details for a specific tier
(define-read-only (get-provider-deposits (provider principal) (tier-name (string-ascii 20)))
  (map-get? provider-deposits { provider: provider, tier-name: tier-name })
)

;; Get pool collateral totals
(define-read-only (get-pool-collateral)
  {
    total-stx-collateral: (var-get total-stx-collateral),
    total-sbtc-collateral: (var-get total-sbtc-collateral),
    stx-locked: (var-get stx-locked),
    sbtc-locked: (var-get sbtc-locked),
    stx-available: (- (var-get total-stx-collateral) (var-get stx-locked)),
    sbtc-available: (- (var-get total-sbtc-collateral) (var-get sbtc-locked))
  }
)

;; Get risk parameters for a specific policy type
(define-read-only (get-policy-risk-parameters (policy-type (string-ascii 4)))
  (map-get? policy-risk-parameters { policy-type: policy-type })
)

;; Get risk tier configuration
(define-read-only (get-risk-tier (tier-name (string-ascii 20)))
  (map-get? risk-tiers { tier-name: tier-name })
)

;; Get utilization rates
(define-read-only (get-utilization-rates)
  {
    put-utilization-rate: (var-get put-utilization-rate),
    call-utilization-rate: (var-get call-utilization-rate),
    overall-utilization-rate: (var-get overall-utilization-rate)
  }
)

;; Get provider yield for a specific epoch
(define-read-only (get-provider-yield (provider principal) (epoch uint))
  (map-get? provider-yield { provider: provider, epoch: epoch })
)

;; Get current epoch number
(define-read-only (get-current-epoch)
  (var-get current-epoch)
)

;; Calculate the total locked and available collateral for a provider in a specific tier
(define-read-only (get-provider-collateral-status (provider principal) (tier-name (string-ascii 20)))
  (let
    (
      (provider-data (default-to
        {
          stx-amount: u0,
          sbtc-amount: u0,
          stx-locked: u0,
          sbtc-locked: u0,
          last-deposit-height: u0,
          deposit-count: u0,
          total-yield-earned: u0,
          current-policies-count: u0
        }
        ;; Use the new key structure including tier-name
        (map-get? provider-deposits { provider: provider, tier-name: tier-name })
      ))
    )
    {
      tier: tier-name, ;; Add tier info to response
      stx-amount: (get stx-amount provider-data),
      stx-locked: (get stx-locked provider-data),
      stx-available: (- (get stx-amount provider-data) (get stx-locked provider-data)),
      sbtc-amount: (get sbtc-amount provider-data), ;; Add sBTC details
      sbtc-locked: (get sbtc-locked provider-data),
      sbtc-available: (- (get sbtc-amount provider-data) (get sbtc-locked provider-data)),
      stx-utilization-percentage: (if (> (get stx-amount provider-data) u0)
                                (/ (* (get stx-locked provider-data) u1000000) (get stx-amount provider-data))
                                u0),
      sbtc-utilization-percentage: (if (> (get sbtc-amount provider-data) u0)
                                 (/ (* (get sbtc-locked provider-data) u1000000) (get sbtc-amount provider-data))
                                 u0),
      active-policies: (get current-policies-count provider-data), ;; Policies in this tier
      total-yield-earned: (get total-yield-earned provider-data) ;; Note: yield is currently assumed STX only and not tier-specific
    }
  )
)

;; Get Tier Capital details
(define-read-only (get-tier-capital (tier-name (string-ascii 20)))
  (map-get? tier-capital { tier-name: tier-name })
)

;; Get Tier Capacity Limits
(define-read-only (get-tier-limits (tier-name (string-ascii 20)))
  (map-get? tier-capacity-limits { tier-name: tier-name })
)

;; private functions
;;

;; Helper function to check if the caller is the contract owner
(define-private (is-owner)
  (is-eq tx-sender (var-get contract-owner))
)

;; Implement min function since Clarity doesn't have one built-in
(define-private (min-uint (a uint) (b uint))
  (if (<= a b) a b)
)

;; Update pool utilization rates
(define-private (update-utilization-rates)
  (let
    (
      (total-stx (var-get total-stx-collateral))
      ;; TODO: Add sBTC value calculation here once Oracle is integrated (Phase 4)
      ;; For now, only STX utilization is calculated
      (stx-locked-amount (var-get stx-locked))
      (new-overall-rate (if (> total-stx u0)
                           (/ (* stx-locked-amount u1000000) total-stx)
                           u0))
      ;; TODO: Calculate PUT and CALL specific rates based on policy data (Phase 5)
      ;; TODO: Calculate sBTC utilization rate separately or combined (Phase 4/5)
    )

    ;; Only update the overall rate for now
    ;; PUT and CALL specific rates would need policy type information when reserving/releasing
    (var-set overall-utilization-rate new-overall-rate)

    ;; Emit utilization update event
    (print {
      event: "pool-utilization-updated",
      put-utilization: (var-get put-utilization-rate), ;; Placeholder
      call-utilization: (var-get call-utilization-rate), ;; Placeholder
      overall-utilization: new-overall-rate ;; Currently STX-based only
    })

    new-overall-rate
  )
) 