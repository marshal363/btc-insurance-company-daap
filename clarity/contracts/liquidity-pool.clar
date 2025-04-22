;; title: liquidity-pool
;; version: 1.0.0
;; summary: Liquidity Pool Contract for BitHedge platform
;; description: Manages protection provider capital, risk tiers, and policy collateralization for the BitHedge platform.

;; traits
;;

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

;; data vars
;;
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

;; Provider deposits (Income Irene)
(define-map provider-deposits
  { provider: principal }
  {
    stx-amount: uint,
    sbtc-amount: uint,
    stx-locked: uint,     ;; Amount locked in active policies
    sbtc-locked: uint,    ;; Amount locked in active policies
    last-deposit-height: uint,
    deposit-count: uint,
    total-yield-earned: uint,
    current-policies-count: uint
  }
)

;; Provider yield tracking
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

;; public functions
;;

;; Initialize the pool with default settings
(define-public (initialize-pool)
  (begin
    ;; Only allow initialization once
    (asserts! (not (var-get pool-initialized)) ERR-NOT-AUTHORIZED)
    
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

;; Deposit STX collateral to the pool
(define-public (deposit-stx (amount uint))
  (let
    (
      (provider tx-sender)
      (current-height block-height)
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
        (map-get? provider-deposits { provider: provider })
      ))
    )
    
    ;; Check if pool is initialized and not paused
    (asserts! (var-get pool-initialized) ERR-POOL-NOT-INITIALIZED)
    (asserts! (not (var-get pool-paused)) ERR-POOL-PAUSED)
    
    ;; Check for valid amount
    (asserts! (> amount u0) ERR-INVALID-PARAMETERS)
    
    ;; TODO: Transfer STX from provider to contract
    ;; This will need to be implemented using STX transfer functions
    
    ;; Update provider deposit data
    (map-set provider-deposits
      { provider: provider }
      {
        stx-amount: (+ (get stx-amount provider-data) amount),
        sbtc-amount: (get sbtc-amount provider-data),
        stx-locked: (get stx-locked provider-data),
        sbtc-locked: (get sbtc-locked provider-data),
        last-deposit-height: current-height,
        deposit-count: (+ (get deposit-count provider-data) u1),
        total-yield-earned: (get total-yield-earned provider-data),
        current-policies-count: (get current-policies-count provider-data)
      }
    )
    
    ;; Update pool total
    (var-set total-stx-collateral (+ (var-get total-stx-collateral) amount))
    
    ;; Emit deposit event
    (print {
      event: "collateral-deposited",
      provider: provider,
      token-type: "STX",
      amount: amount,
      total-deposited: (+ (get stx-amount provider-data) amount)
    })
    
    (ok amount)
  )
)

;; Withdraw STX collateral from the pool
(define-public (withdraw-stx (amount uint))
  (let
    (
      (provider tx-sender)
      (provider-data (unwrap! (map-get? provider-deposits { provider: provider }) ERR-PROVIDER-NOT-FOUND))
      (available-amount (- (get stx-amount provider-data) (get stx-locked provider-data)))
    )
    
    ;; Check if pool is initialized and not paused
    (asserts! (var-get pool-initialized) ERR-POOL-NOT-INITIALIZED)
    (asserts! (not (var-get pool-paused)) ERR-POOL-PAUSED)
    
    ;; Check for valid amount and sufficient available balance
    (asserts! (> amount u0) ERR-INVALID-PARAMETERS)
    (asserts! (>= available-amount amount) ERR-WITHDRAWAL-LIMIT-EXCEEDED)
    
    ;; TODO: Transfer STX from contract to provider
    ;; This will need to be implemented using STX transfer functions
    
    ;; Update provider deposit data
    (map-set provider-deposits
      { provider: provider }
      (merge provider-data {
        stx-amount: (- (get stx-amount provider-data) amount)
      })
    )
    
    ;; Update pool total
    (var-set total-stx-collateral (- (var-get total-stx-collateral) amount))
    
    ;; Emit withdrawal event
    (print {
      event: "collateral-withdrawn",
      provider: provider,
      token-type: "STX",
      amount: amount,
      remaining-deposit: (- (get stx-amount provider-data) amount)
    })
    
    (ok amount)
  )
)

;; Reserve collateral for a policy
(define-public (reserve-policy-collateral 
    (policy-id uint)
    (amount uint)
    (policy-type (string-ascii 4))
    (counterparty principal))
  (let
    (
      (provider counterparty)
      (provider-data (unwrap! (map-get? provider-deposits { provider: provider }) ERR-PROVIDER-NOT-FOUND))
      (available-amount (- (get stx-amount provider-data) (get stx-locked provider-data)))
    )
    
    ;; Check if pool is initialized and not paused
    (asserts! (var-get pool-initialized) ERR-POOL-NOT-INITIALIZED)
    (asserts! (not (var-get pool-paused)) ERR-POOL-PAUSED)
    
    ;; Check for sufficient available collateral
    (asserts! (>= available-amount amount) ERR-INSUFFICIENT-COLLATERAL)
    
    ;; Check if policy type is valid
    (asserts! (or (is-eq policy-type "PUT") (is-eq policy-type "CALL")) ERR-INVALID-PARAMETERS)
    
    ;; TODO: Validate against policy parameters from Policy Registry
    
    ;; Update provider deposit data to lock collateral
    (map-set provider-deposits
      { provider: provider }
      (merge provider-data {
        stx-locked: (+ (get stx-locked provider-data) amount),
        current-policies-count: (+ (get current-policies-count provider-data) u1)
      })
    )
    
    ;; Update pool total locked amount
    (var-set stx-locked (+ (var-get stx-locked) amount))
    
    ;; Update utilization rates
    (update-utilization-rates)
    
    ;; Emit collateral reservation event
    (print {
      event: "collateral-reserved",
      policy-id: policy-id,
      provider: provider,
      amount: amount,
      policy-type: policy-type
    })
    
    (ok amount)
  )
)

;; Release collateral when a policy expires
(define-public (release-policy-collateral 
    (policy-id uint)
    (amount uint)
    (counterparty principal))
  (let
    (
      (provider counterparty)
      (provider-data (unwrap! (map-get? provider-deposits { provider: provider }) ERR-PROVIDER-NOT-FOUND))
    )
    
    ;; TODO: Validate that the caller is the Policy Registry contract
    
    ;; Update provider deposit data to unlock collateral
    (map-set provider-deposits
      { provider: provider }
      (merge provider-data {
        stx-locked: (- (get stx-locked provider-data) amount),
        current-policies-count: (if (> (get current-policies-count provider-data) u0)
                                   (- (get current-policies-count provider-data) u1)
                                   u0)
      })
    )
    
    ;; Update pool total locked amount
    (var-set stx-locked (- (var-get stx-locked) amount))
    
    ;; Update utilization rates
    (update-utilization-rates)
    
    ;; Emit collateral release event
    (print {
      event: "collateral-released",
      policy-id: policy-id,
      provider: provider,
      amount: amount
    })
    
    (ok amount)
  )
)

;; Process policy settlement (when a policy is activated/exercised)
(define-public (process-policy-settlement 
    (policy-id uint)
    (settlement-amount uint)
    (counterparty principal))
  (let
    (
      (provider counterparty)
      (provider-data (unwrap! (map-get? provider-deposits { provider: provider }) ERR-PROVIDER-NOT-FOUND))
    )
    
    ;; TODO: Validate that the caller is the Policy Registry contract
    
    ;; Ensure provider has enough locked collateral
    (asserts! (>= (get stx-locked provider-data) settlement-amount) ERR-INSUFFICIENT-COLLATERAL)
    
    ;; TODO: Transfer settlement amount to policy owner
    
    ;; Update provider deposit data
    (map-set provider-deposits
      { provider: provider }
      (merge provider-data {
        stx-amount: (- (get stx-amount provider-data) settlement-amount),
        stx-locked: (- (get stx-locked provider-data) settlement-amount),
        current-policies-count: (if (> (get current-policies-count provider-data) u0)
                                   (- (get current-policies-count provider-data) u1)
                                   u0)
      })
    )
    
    ;; Update pool totals
    (var-set total-stx-collateral (- (var-get total-stx-collateral) settlement-amount))
    (var-set stx-locked (- (var-get stx-locked) settlement-amount))
    
    ;; Update utilization rates
    (update-utilization-rates)
    
    ;; Emit settlement event
    (print {
      event: "policy-settlement-processed",
      policy-id: policy-id,
      provider: provider,
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
      (base-rate (get base-premium-rate risk-params))
      (utilization-rate (if (is-eq policy-type "PUT")
                           (var-get put-utilization-rate)
                           (var-get call-utilization-rate)))
      (utilization-factor (min u1000000 (/ (* utilization-rate (get utilization-multiplier risk-params)) u1000000)))
      (duration-factor (/ (* duration-blocks (get duration-multiplier risk-params)) u1440)) ;; Assuming blocks per day = 144
      (tier-multiplier (get premium-multiplier tier-config))
      (premium-rate (/ (* (+ base-rate utilization-factor duration-factor) tier-multiplier) u1000000))
      (premium-amount (/ (* protected-amount premium-rate) u1000000))
    )
    
    premium-amount
  )
)

;; Record premium for yield distribution
(define-public (record-premium 
    (premium-amount uint)
    (policy-id uint)
    (counterparty principal))
  (let
    (
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
          distribution-height: block-height,
          claimed: false
        }
        (map-get? provider-yield { provider: provider, epoch: current-ep })
      ))
    )
    
    ;; Check if pool is initialized
    (asserts! (var-get pool-initialized) ERR-POOL-NOT-INITIALIZED)
    
    ;; TODO: Validate that the caller is the Policy Registry contract
    
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
        distribution-height: block-height,
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
    
    ;; Only authorized admin can start new epoch
    ;; TODO: Add proper authorization check
    
    ;; Increment epoch counter
    (var-set current-epoch (+ (var-get current-epoch) u1))
    
    ;; Emit new epoch event
    (print {
      event: "new-epoch-started",
      epoch: (var-get current-epoch),
      start-height: block-height
    })
    
    (ok (var-get current-epoch))
  )
)

;; Claim yield for a specific epoch
(define-public (claim-yield (epoch uint))
  (let
    (
      (provider tx-sender)
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
      
      ;; TODO: Transfer yield amount to provider
      
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

;; Pause the pool (emergency function)
(define-public (pause-pool)
  (begin
    ;; Only authorized admin can pause
    ;; TODO: Add proper authorization check
    
    ;; Set pool to paused
    (var-set pool-paused true)
    
    ;; Emit pause event
    (print {
      event: "pool-paused",
      height: block-height
    })
    
    (ok true)
  )
)

;; Unpause the pool
(define-public (unpause-pool)
  (begin
    ;; Only authorized admin can unpause
    ;; TODO: Add proper authorization check
    
    ;; Set pool to not paused
    (var-set pool-paused false)
    
    ;; Emit unpause event
    (print {
      event: "pool-unpaused",
      height: block-height
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
    ;; Only authorized admin can update parameters
    ;; TODO: Add proper authorization check
    
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
    ;; Only authorized admin can update parameters
    ;; TODO: Add proper authorization check
    
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
    ;; Only authorized admin can update fees
    ;; TODO: Add proper authorization check
    
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

;; Get provider deposit details
(define-read-only (get-provider-deposits (provider principal))
  (map-get? provider-deposits { provider: provider })
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

;; Calculate the total locked and available collateral for a provider
(define-read-only (get-provider-collateral-status (provider principal))
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
        (map-get? provider-deposits { provider: provider })
      ))
    )
    {
      stx-amount: (get stx-amount provider-data),
      stx-locked: (get stx-locked provider-data),
      stx-available: (- (get stx-amount provider-data) (get stx-locked provider-data)),
      utilization-percentage: (if (> (get stx-amount provider-data) u0)
                                (/ (* (get stx-locked provider-data) u1000000) (get stx-amount provider-data))
                                u0),
      active-policies: (get current-policies-count provider-data),
      total-yield-earned: (get total-yield-earned provider-data)
    }
  )
)

;; private functions
;;

;; Update pool utilization rates
(define-private (update-utilization-rates)
  (let
    (
      (total-stx (var-get total-stx-collateral))
      (stx-locked-amount (var-get stx-locked))
      (new-overall-rate (if (> total-stx u0)
                           (/ (* stx-locked-amount u1000000) total-stx)
                           u0))
    )
    
    ;; Only update the overall rate for now
    ;; PUT and CALL specific rates would need policy type information
    (var-set overall-utilization-rate new-overall-rate)
    
    ;; Emit utilization update event
    (print {
      event: "pool-utilization-updated",
      put-utilization: (var-get put-utilization-rate),
      call-utilization: (var-get call-utilization-rate),
      overall-utilization: new-overall-rate
    })
    
    new-overall-rate
  )
) 