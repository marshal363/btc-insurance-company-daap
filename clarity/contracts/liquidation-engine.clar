;; title: liquidation-engine
;; version: 1.0.0
;; summary: Liquidation Engine Contract for the BitHedge platform
;; description: Monitors collateralization levels, executes liquidations, and manages recovery operations.

;; traits
;;

;; token definitions
;;

;; constants
;;
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-NOT-INITIALIZED (err u101))
(define-constant ERR-INVALID-PARAMETERS (err u102))
(define-constant ERR-INVALID-POLICY (err u103))
(define-constant ERR-POLICY-NOT-FOUND (err u104))
(define-constant ERR-INSUFFICIENT-COLLATERAL (err u105))
(define-constant ERR-ALREADY-LIQUIDATED (err u106))
(define-constant ERR-NO-LIQUIDATION-NEEDED (err u107))
(define-constant ERR-NOT-UNDERCOLLATERALIZED (err u108))
(define-constant ERR-LIQUIDATION-FAILED (err u109))
(define-constant ERR-MARGIN-CALL-ACTIVE (err u110))
(define-constant ERR-NO-MARGIN-CALL-ACTIVE (err u111))
(define-constant ERR-CONTRACT-NOT-FOUND (err u112))
(define-constant ERR-STRATEGY-NOT-AVAILABLE (err u113))
(define-constant ERR-RECOVERY-NOT-NEEDED (err u114))
(define-constant ERR-TRANSFER-FAILED (err u115))
(define-constant ERR-SYSTEM-PAUSED (err u116))

;; data vars
;;

;; Engine initialization status
(define-data-var engine-initialized bool false)

;; Admin address
(define-data-var admin-address principal tx-sender)

;; Pause status
(define-data-var is-paused bool false)

;; Contract addresses
(define-data-var policy-registry-address principal tx-sender)
(define-data-var liquidity-pool-address principal tx-sender)
(define-data-var oracle-address principal tx-sender)
(define-data-var treasury-address principal tx-sender)
(define-data-var insurance-fund-address principal tx-sender)

;; Liquidation parameters
(define-data-var liquidation-threshold uint u800000) ;; 80% collateralization ratio (scaled by 1,000,000)
(define-data-var margin-call-threshold uint u900000) ;; 90% collateralization ratio (scaled by 1,000,000)
(define-data-var liquidation-penalty uint u100000)   ;; 10% penalty (scaled by 1,000,000)
(define-data-var margin-call-duration uint u144)     ;; ~24 hours in blocks (assuming 10 min block time)
(define-data-var minimum-liquidation-amount uint u1000000) ;; Minimum STX amount for liquidation

;; Liquidation counters
(define-data-var liquidation-counter uint u0)
(define-data-var margin-call-counter uint u0)
(define-data-var strategy-counter uint u0)

;; data maps
;;

;; Liquidation events
(define-map liquidations
  { liquidation-id: uint }
  {
    policy-id: uint,
    initiator: principal,
    amount: uint,
    collateral-value: uint,
    executed-at: uint,
    penalty-amount: uint,
    strategy-id: uint,
    status: (string-utf8 20),  ;; "executed", "partial", "failed", "recovered"
    recovered-amount: uint
  }
)

;; Margin calls
(define-map margin-calls
  { policy-id: uint }
  {
    margin-call-id: uint,
    initiated-at: uint,
    expires-at: uint,
    required-collateral: uint,
    current-collateral: uint,
    status: (string-utf8 20),  ;; "active", "resolved", "liquidated", "expired"
    notified: bool
  }
)

;; Liquidation strategies
(define-map liquidation-strategies
  { strategy-id: uint }
  {
    name: (string-utf8 50),
    description: (string-utf8 100),
    priority: uint,
    active: bool,
    min-size: uint,
    max-size: uint
  }
)

;; Collateralization status by policy
(define-map collateralization-status
  { policy-id: uint }
  {
    last-checked: uint,
    collateralization-ratio: uint,  ;; Scaled by 1,000,000
    status: (string-utf8 20),       ;; "healthy", "warning", "margin-call", "liquidatable"
    risk-score: uint                ;; 0-100 scale
  }
)

;; public functions
;;

;; Initialize engine
(define-public (initialize-engine
    (policy-registry principal)
    (liquidity-pool principal)
    (oracle principal)
    (treasury principal)
    (insurance-fund principal))
  (begin
    ;; Check if already initialized
    (asserts! (not (var-get engine-initialized)) ERR-NOT-AUTHORIZED)
    
    ;; Set admin and initial variables
    (var-set admin-address tx-sender)
    (var-set engine-initialized true)
    
    ;; Set contract addresses
    (var-set policy-registry-address policy-registry)
    (var-set liquidity-pool-address liquidity-pool)
    (var-set oracle-address oracle)
    (var-set treasury-address treasury)
    (var-set insurance-fund-address insurance-fund)
    
    ;; Initialize default liquidation strategies
    (try! (add-liquidation-strategy "Auction" "Auction-based liquidation for large positions" u1 true u10000000 u0))
    (try! (add-liquidation-strategy "Direct Sale" "Immediate liquidation at current price with penalty" u2 true u0 u10000000))
    (try! (add-liquidation-strategy "Partial Liquidation" "Liquidate part of collateral to restore health" u3 true u5000000 u100000000))
    
    ;; Emit initialization event
    (print {
      event: "engine-initialized",
      admin: tx-sender,
      policy-registry: policy-registry,
      liquidity-pool: liquidity-pool,
      oracle: oracle,
      treasury: treasury,
      insurance-fund: insurance-fund,
      block-height: block-height
    })
    
    (ok true)
  )
)

;; Set liquidation parameters
(define-public (set-liquidation-parameters
    (new-liquidation-threshold uint)
    (new-margin-call-threshold uint)
    (new-liquidation-penalty uint)
    (new-margin-call-duration uint)
    (new-minimum-liquidation-amount uint))
  (let
    (
      (caller tx-sender)
    )
    
    ;; Check if engine is initialized
    (asserts! (var-get engine-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Validate parameters
    (asserts! (and
                (< new-liquidation-threshold new-margin-call-threshold)
                (<= new-margin-call-threshold u1000000)
                (<= new-liquidation-penalty u500000)
                (> new-margin-call-duration u0))
             ERR-INVALID-PARAMETERS)
    
    ;; Set parameters
    (var-set liquidation-threshold new-liquidation-threshold)
    (var-set margin-call-threshold new-margin-call-threshold)
    (var-set liquidation-penalty new-liquidation-penalty)
    (var-set margin-call-duration new-margin-call-duration)
    (var-set minimum-liquidation-amount new-minimum-liquidation-amount)
    
    ;; Emit event
    (print {
      event: "liquidation-parameters-updated",
      liquidation-threshold: new-liquidation-threshold,
      margin-call-threshold: new-margin-call-threshold,
      liquidation-penalty: new-liquidation-penalty,
      margin-call-duration: new-margin-call-duration,
      minimum-liquidation-amount: new-minimum-liquidation-amount,
      updater: caller
    })
    
    (ok true)
  )
)

;; Add liquidation strategy
(define-public (add-liquidation-strategy
    (name (string-utf8 50))
    (description (string-utf8 100))
    (priority uint)
    (active bool)
    (min-size uint)
    (max-size uint))
  (let
    (
      (caller tx-sender)
      (strategy-id (+ (var-get strategy-counter) u1))
    )
    
    ;; Check if engine is initialized
    (asserts! (var-get engine-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Validate parameters
    (asserts! (and
                (> (len name) u0)
                (> (len description) u0)
                (or (is-eq max-size u0) (> max-size min-size)))
             ERR-INVALID-PARAMETERS)
    
    ;; Add strategy
    (map-set liquidation-strategies
      { strategy-id: strategy-id }
      {
        name: name,
        description: description,
        priority: priority,
        active: active,
        min-size: min-size,
        max-size: max-size
      }
    )
    
    ;; Update counter
    (var-set strategy-counter strategy-id)
    
    ;; Emit event
    (print {
      event: "liquidation-strategy-added",
      strategy-id: strategy-id,
      name: name,
      priority: priority,
      active: active
    })
    
    (ok strategy-id)
  )
)

;; Update liquidation strategy
(define-public (update-liquidation-strategy
    (strategy-id uint)
    (new-priority (optional uint))
    (new-active (optional bool))
    (new-min-size (optional uint))
    (new-max-size (optional uint)))
  (let
    (
      (caller tx-sender)
      (strategy (unwrap! (map-get? liquidation-strategies { strategy-id: strategy-id }) ERR-STRATEGY-NOT-AVAILABLE))
      (updated-priority (default-to (get priority strategy) new-priority))
      (updated-active (default-to (get active strategy) new-active))
      (updated-min-size (default-to (get min-size strategy) new-min-size))
      (updated-max-size (default-to (get max-size strategy) new-max-size))
    )
    
    ;; Check if engine is initialized
    (asserts! (var-get engine-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Validate parameters
    (asserts! (or (is-eq updated-max-size u0) (> updated-max-size updated-min-size)) ERR-INVALID-PARAMETERS)
    
    ;; Update strategy
    (map-set liquidation-strategies
      { strategy-id: strategy-id }
      (merge strategy {
        priority: updated-priority,
        active: updated-active,
        min-size: updated-min-size,
        max-size: updated-max-size
      })
    )
    
    ;; Emit event
    (print {
      event: "liquidation-strategy-updated",
      strategy-id: strategy-id,
      priority: updated-priority,
      active: updated-active,
      min-size: updated-min-size,
      max-size: updated-max-size
    })
    
    (ok true)
  )
)

;; Pause/unpause engine
(define-public (set-pause-status (new-status bool))
  (let
    (
      (caller tx-sender)
    )
    
    ;; Check if engine is initialized
    (asserts! (var-get engine-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Set pause status
    (var-set is-paused new-status)
    
    ;; Emit event
    (print {
      event (if new-status "engine-paused" "engine-unpaused"),
      admin: caller,
      block-height: block-height
    })
    
    (ok true)
  )
)

;; Update contract addresses
(define-public (set-contract-addresses
    (policy-registry (optional principal))
    (liquidity-pool (optional principal))
    (oracle (optional principal))
    (treasury (optional principal))
    (insurance-fund (optional principal)))
  (let
    (
      (caller tx-sender)
      (updated-policy-registry (default-to (var-get policy-registry-address) policy-registry))
      (updated-liquidity-pool (default-to (var-get liquidity-pool-address) liquidity-pool))
      (updated-oracle (default-to (var-get oracle-address) oracle))
      (updated-treasury (default-to (var-get treasury-address) treasury))
      (updated-insurance-fund (default-to (var-get insurance-fund-address) insurance-fund))
    )
    
    ;; Check if engine is initialized
    (asserts! (var-get engine-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Update contract addresses
    (var-set policy-registry-address updated-policy-registry)
    (var-set liquidity-pool-address updated-liquidity-pool)
    (var-set oracle-address updated-oracle)
    (var-set treasury-address updated-treasury)
    (var-set insurance-fund-address updated-insurance-fund)
    
    ;; Emit event
    (print {
      event: "contract-addresses-updated",
      policy-registry: updated-policy-registry,
      liquidity-pool: updated-liquidity-pool,
      oracle: updated-oracle,
      treasury: updated-treasury,
      insurance-fund: updated-insurance-fund
    })
    
    (ok true)
  )
)

;; Transfer admin role
(define-public (transfer-admin
    (new-admin principal))
  (let
    (
      (current-admin tx-sender)
    )
    
    ;; Check if engine is initialized
    (asserts! (var-get engine-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is current admin
    (asserts! (is-eq current-admin (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Update admin
    (var-set admin-address new-admin)
    
    ;; Emit admin transfer event
    (print {
      event: "admin-transferred",
      previous-admin: current-admin,
      new-admin: new-admin
    })
    
    (ok true)
  )
)

;; read only functions
;;

;; Get engine info
(define-read-only (get-engine-info)
  {
    initialized: (var-get engine-initialized),
    paused: (var-get is-paused),
    liquidation-threshold: (var-get liquidation-threshold),
    margin-call-threshold: (var-get margin-call-threshold),
    liquidation-penalty: (var-get liquidation-penalty),
    margin-call-duration: (var-get margin-call-duration),
    minimum-liquidation-amount: (var-get minimum-liquidation-amount),
    liquidation-count: (var-get liquidation-counter),
    margin-call-count: (var-get margin-call-counter),
    strategy-count: (var-get strategy-counter)
  }
)

;; Get liquidation details
(define-read-only (get-liquidation-details (liquidation-id uint))
  (map-get? liquidations { liquidation-id: liquidation-id })
)

;; Get margin call details
(define-read-only (get-margin-call (policy-id uint))
  (map-get? margin-calls { policy-id: policy-id })
)

;; Get liquidation strategy details
(define-read-only (get-liquidation-strategy (strategy-id uint))
  (map-get? liquidation-strategies { strategy-id: strategy-id })
)

;; Get policy collateralization status
(define-read-only (get-collateralization-status (policy-id uint))
  (map-get? collateralization-status { policy-id: policy-id })
)

;; private functions
;;

;; Run a health check on a policy to determine its collateralization status
;; Will need to implement in phase 2
(define-private (check-policy-health (policy-id uint))
  ;; TODO: Implement policy health check
  ;; Should call policy-registry to get policy details
  ;; Should call oracle to get current price
  ;; Should calculate collateralization ratio
  ;; Should update collateralization-status map
  ;; Should return collateralization status
  (begin
    (print { event: "health-check-placeholder", policy-id: policy-id })
    ;; Placeholder return - this would be replaced with actual implementation
    { collateralization-ratio: u900000, status: "healthy", needs-action: false }
  )
)

;; Select appropriate liquidation strategy based on size and other factors
;; Will need to implement in phase 2
(define-private (select-liquidation-strategy (collateral-value uint))
  ;; TODO: Implement strategy selection logic
  ;; Should find strategy based on position size, priority, and active status
  ;; Placeholder return - this would be replaced with actual implementation
  u1
)

;; Execute liquidation using the selected strategy
;; Will need to implement in phase 2
(define-private (execute-liquidation-with-strategy 
    (policy-id uint) 
    (strategy-id uint)
    (collateral-value uint))
  ;; TODO: Implement liquidation execution
  ;; Should implement different strategies based on strategy-id
  ;; Should interact with liquidity-pool to execute liquidation
  ;; Placeholder return - this would be replaced with actual implementation
  (begin
    (print { event: "liquidation-execution-placeholder", policy-id: policy-id, strategy-id: strategy-id })
    (ok u1000000) ;; Return liquidated amount as placeholder
  )
)

;; Check collateralization and update status
(define-public (check-collateralization (policy-id uint))
  (let
    (
      (caller tx-sender)
      (current-block block-height)
    )
    
    ;; Check if engine is initialized and not paused
    (asserts! (var-get engine-initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-SYSTEM-PAUSED)
    
    ;; Check if caller is authorized
    (asserts! (or
                (is-eq caller (var-get admin-address))
                (is-eq caller (var-get policy-registry-address))
                (is-eq caller (var-get liquidity-pool-address)))
             ERR-NOT-AUTHORIZED)
    
    ;; Get policy health status
    (let
      (
        (health-result (check-policy-health policy-id))
        (collateralization-ratio (get collateralization-ratio health-result))
        (status-text (get status health-result))
        (needs-action (get needs-action health-result))
      )
      
      ;; Update collateralization status
      (map-set collateralization-status
        { policy-id: policy-id }
        {
          last-checked: current-block,
          collateralization-ratio: collateralization-ratio,
          status: status-text,
          risk-score: (calculate-risk-score collateralization-ratio)
        }
      )
      
      ;; Emit event
      (print {
        event: "collateralization-checked",
        policy-id: policy-id,
        collateralization-ratio: collateralization-ratio,
        status: status-text,
        block-height: current-block
      })
      
      ;; Return result
      (ok {
        policy-id: policy-id,
        collateralization-ratio: collateralization-ratio,
        status: status-text,
        needs-action: needs-action
      })
    )
  )
)

;; Issue margin call for undercollateralized policy
(define-public (issue-margin-call (policy-id uint))
  (let
    (
      (caller tx-sender)
      (current-block block-height)
      (collateral-status (unwrap! (map-get? collateralization-status { policy-id: policy-id }) ERR-POLICY-NOT-FOUND))
      (collateralization-ratio (get collateralization-ratio collateral-status))
    )
    
    ;; Check if engine is initialized and not paused
    (asserts! (var-get engine-initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-SYSTEM-PAUSED)
    
    ;; Check if caller is authorized
    (asserts! (or
                (is-eq caller (var-get admin-address))
                (is-eq caller (var-get policy-registry-address))
                (is-eq caller (var-get liquidity-pool-address)))
             ERR-NOT-AUTHORIZED)
    
    ;; Check if policy is undercollateralized enough for margin call
    (asserts! (< collateralization-ratio (var-get margin-call-threshold)) ERR-NO-MARGIN-CALL-ACTIVE)
    
    ;; Check if policy is already liquidatable
    (asserts! (>= collateralization-ratio (var-get liquidation-threshold)) ERR-INSUFFICIENT-COLLATERAL)
    
    ;; Check if margin call already exists
    (asserts! (is-none (map-get? margin-calls { policy-id: policy-id })) ERR-MARGIN-CALL-ACTIVE)
    
    ;; Calculate required collateral
    (let
      (
        (policy-details (contract-call? (var-get policy-registry-address) get-policy-details policy-id))
        (required-collateral (calculate-required-collateral policy-id))
        (current-collateral (calculate-current-collateral policy-id))
        (margin-call-id (+ (var-get margin-call-counter) u1))
        (expires-at (+ current-block (var-get margin-call-duration)))
      )
      
      ;; Create margin call
      (map-set margin-calls
        { policy-id: policy-id }
        {
          margin-call-id: margin-call-id,
          initiated-at: current-block,
          expires-at: expires-at,
          required-collateral: required-collateral,
          current-collateral: current-collateral,
          status: "active",
          notified: false
        }
      )
      
      ;; Update margin call counter
      (var-set margin-call-counter margin-call-id)
      
      ;; Emit event
      (print {
        event: "margin-call-issued",
        policy-id: policy-id,
        margin-call-id: margin-call-id,
        required-collateral: required-collateral,
        current-collateral: current-collateral,
        expires-at: expires-at,
        block-height: current-block
      })
      
      (ok margin-call-id)
    )
  )
)

;; Add collateral to respond to margin call
(define-public (add-collateral (policy-id uint) (amount uint))
  (let
    (
      (caller tx-sender)
      (current-block block-height)
      (margin-call (unwrap! (map-get? margin-calls { policy-id: policy-id }) ERR-NO-MARGIN-CALL-ACTIVE))
      (margin-call-id (get margin-call-id margin-call))
      (is-active (is-eq (get status margin-call) "active"))
      (expired (> current-block (get expires-at margin-call)))
    )
    
    ;; Check if engine is initialized and not paused
    (asserts! (var-get engine-initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-SYSTEM-PAUSED)
    
    ;; Check if margin call is active
    (asserts! is-active ERR-NO-MARGIN-CALL-ACTIVE)
    (asserts! (not expired) ERR-NO-MARGIN-CALL-ACTIVE)
    
    ;; Check if amount is greater than zero
    (asserts! (> amount u0) ERR-INVALID-PARAMETERS)
    
    ;; Calculate new collateral level
    (let
      (
        (current-collateral (get current-collateral margin-call))
        (required-collateral (get required-collateral margin-call))
        (new-collateral (+ current-collateral amount))
        (status (if (>= new-collateral required-collateral) "resolved" "active"))
      )
      
      ;; Add collateral to policy through liquidity pool
      (try! (contract-call? (var-get liquidity-pool-address) add-policy-collateral policy-id amount caller))
      
      ;; Update margin call
      (map-set margin-calls
        { policy-id: policy-id }
        (merge margin-call {
          current-collateral: new-collateral,
          status: status
        })
      )
      
      ;; Update collateralization status
      (try! (check-collateralization policy-id))
      
      ;; Emit event
      (print {
        event: "collateral-added",
        policy-id: policy-id,
        margin-call-id: margin-call-id,
        amount: amount,
        new-collateral: new-collateral,
        status: status,
        block-height: current-block
      })
      
      (ok { 
        status: status, 
        added-amount: amount, 
        new-collateral: new-collateral, 
        required: required-collateral 
      })
    )
  )
)

;; Execute liquidation for undercollateralized policy
(define-public (execute-liquidation (policy-id uint))
  (let
    (
      (caller tx-sender)
      (current-block block-height)
      (collateral-status (unwrap! (map-get? collateralization-status { policy-id: policy-id }) ERR-POLICY-NOT-FOUND))
      (collateralization-ratio (get collateralization-ratio collateral-status))
    )
    
    ;; Check if engine is initialized and not paused
    (asserts! (var-get engine-initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-SYSTEM-PAUSED)
    
    ;; Check if caller is authorized
    (asserts! (or
                (is-eq caller (var-get admin-address))
                (is-eq caller (var-get policy-registry-address))
                (is-eq caller (var-get liquidity-pool-address)))
             ERR-NOT-AUTHORIZED)
    
    ;; Check if policy is below liquidation threshold
    (asserts! (< collateralization-ratio (var-get liquidation-threshold)) ERR-NO-LIQUIDATION-NEEDED)
    
    ;; Get policy details and calculate values
    (let
      (
        (collateral-value (calculate-policy-collateral policy-id))
        (liquidation-id (+ (var-get liquidation-counter) u1))
        (strategy-id (select-liquidation-strategy collateral-value))
        (penalty-amount (/ (* collateral-value (var-get liquidation-penalty)) u1000000))
      )
      
      ;; Check that collateral value is above minimum
      (asserts! (>= collateral-value (var-get minimum-liquidation-amount)) ERR-INSUFFICIENT-COLLATERAL)
      
      ;; Execute liquidation with selected strategy
      (match (execute-liquidation-with-strategy policy-id strategy-id collateral-value)
        liquidated-amount
          (begin
            ;; Create liquidation record
            (map-set liquidations
              { liquidation-id: liquidation-id }
              {
                policy-id: policy-id,
                initiator: caller,
                amount: liquidated-amount,
                collateral-value: collateral-value,
                executed-at: current-block,
                penalty-amount: penalty-amount,
                strategy-id: strategy-id,
                status: "executed",
                recovered-amount: u0
              }
            )
            
            ;; Update liquidation counter
            (var-set liquidation-counter liquidation-id)
            
            ;; Clear any margin calls
            (process-margin-call policy-id "liquidated")
            
            ;; Update collateralization status
            (try! (check-collateralization policy-id))
            
            ;; Emit event
            (print {
              event: "liquidation-executed",
              liquidation-id: liquidation-id,
              policy-id: policy-id,
              amount: liquidated-amount,
              collateral-value: collateral-value,
              penalty-amount: penalty-amount,
              strategy-id: strategy-id,
              block-height: current-block
            })
            
            (ok liquidation-id)
          )
        error-code error-code
      )
    )
  )
)

;; Process recovery from insurance fund for liquidation shortfalls
(define-public (process-recovery (liquidation-id uint))
  (let
    (
      (caller tx-sender)
      (current-block block-height)
      (liquidation (unwrap! (map-get? liquidations { liquidation-id: liquidation-id }) ERR-LIQUIDATION-FAILED))
      (policy-id (get policy-id liquidation))
      (liquidation-amount (get amount liquidation))
      (collateral-value (get collateral-value liquidation))
      (shortfall (- collateral-value liquidation-amount))
    )
    
    ;; Check if engine is initialized and not paused
    (asserts! (var-get engine-initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-SYSTEM-PAUSED)
    
    ;; Check if caller is authorized
    (asserts! (or
                (is-eq caller (var-get admin-address))
                (is-eq caller (var-get insurance-fund-address)))
             ERR-NOT-AUTHORIZED)
    
    ;; Check if recovery is needed
    (asserts! (and
                (> shortfall u0)
                (is-eq (get status liquidation) "executed"))
             ERR-RECOVERY-NOT-NEEDED)
    
    ;; Request recovery from insurance fund
    (try! (contract-call? (var-get insurance-fund-address) process-shortfall policy-id shortfall))
    
    ;; Update liquidation record
    (map-set liquidations
      { liquidation-id: liquidation-id }
      (merge liquidation {
        status: "recovered",
        recovered-amount: shortfall
      })
    )
    
    ;; Emit event
    (print {
      event: "recovery-processed",
      liquidation-id: liquidation-id,
      policy-id: policy-id,
      shortfall: shortfall,
      block-height: current-block
    })
    
    (ok { liquidation-id: liquidation-id, recovered-amount: shortfall })
  )
)

;; Expire unfulfilled margin calls and process liquidation if needed
(define-public (expire-margin-call (policy-id uint))
  (let
    (
      (caller tx-sender)
      (current-block block-height)
      (margin-call (unwrap! (map-get? margin-calls { policy-id: policy-id }) ERR-NO-MARGIN-CALL-ACTIVE))
      (margin-call-id (get margin-call-id margin-call))
      (expires-at (get expires-at margin-call))
      (status (get status margin-call))
    )
    
    ;; Check if engine is initialized and not paused
    (asserts! (var-get engine-initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-SYSTEM-PAUSED)
    
    ;; Check if caller is authorized
    (asserts! (or
                (is-eq caller (var-get admin-address))
                (is-eq caller (var-get policy-registry-address))
                (is-eq caller (var-get liquidity-pool-address)))
             ERR-NOT-AUTHORIZED)
    
    ;; Check if margin call is active
    (asserts! (is-eq status "active") ERR-NO-MARGIN-CALL-ACTIVE)
    
    ;; Check if margin call has expired
    (asserts! (>= current-block expires-at) ERR-MARGIN-CALL-ACTIVE)
    
    ;; Mark margin call as expired
    (process-margin-call policy-id "expired")
    
    ;; Check current collateralization level
    (let
      (
        (collateral-status (map-get? collateralization-status { policy-id: policy-id }))
        (collateralization-ratio (if (is-some collateral-status) 
                                   (get collateralization-ratio (unwrap-panic collateral-status))
                                   u0))
      )
      
      ;; If still below liquidation threshold, execute liquidation
      (if (< collateralization-ratio (var-get liquidation-threshold))
        (match (execute-liquidation policy-id)
          liquidation-id (ok liquidation-id)
          error (ok u0)
        )
        
        ;; Emit event
        (begin
          (print {
            event: "margin-call-expired",
            policy-id: policy-id,
            margin-call-id: margin-call-id,
            block-height: current-block
          })
          
          (ok u0)
        )
      )
    )
  )
)

;; Process margin call status change
(define-private (process-margin-call (policy-id uint) (new-status (string-utf8 20)))
  (match (map-get? margin-calls { policy-id: policy-id })
    margin-call
      (map-set margin-calls
        { policy-id: policy-id }
        (merge margin-call {
          status: new-status
        })
      )
    true
  )
)

;; Calculate risk score from collateralization ratio
(define-private (calculate-risk-score (collateralization-ratio uint))
  (let
    (
      (liquidation-threshold (var-get liquidation-threshold))
      (margin-call-threshold (var-get margin-call-threshold))
      (full-collateral u1000000)
    )
    
    (cond
      ;; Below liquidation threshold: high risk (70-100)
      ((< collateralization-ratio liquidation-threshold)
       (+ u70 (/ (* (- liquidation-threshold collateralization-ratio) u30) liquidation-threshold)))
      
      ;; Between liquidation and margin call: medium risk (30-70)
      ((< collateralization-ratio margin-call-threshold)
       (+ u30 (/ (* (- margin-call-threshold collateralization-ratio) u40) 
                  (- margin-call-threshold liquidation-threshold))))
      
      ;; Between margin call and full collateral: low risk (0-30)
      ((< collateralization-ratio full-collateral)
       (/ (* (- full-collateral collateralization-ratio) u30)
           (- full-collateral margin-call-threshold)))
       
      ;; Above full collateral: no risk (0)
      (true u0)
    )
  )
)

;; Placeholder functions to be implemented in phase 2
;; These will interact with other contracts to get real data

(define-private (calculate-required-collateral (policy-id uint))
  ;; TODO: Implement actual calculation based on policy details
  ;; This would call the policy registry to get policy details and calculate required collateral
  ;; For now, return a placeholder value
  u5000000
)

(define-private (calculate-current-collateral (policy-id uint))
  ;; TODO: Implement actual calculation based on policy details
  ;; This would call the liquidity pool to get current collateral
  ;; For now, return a placeholder value
  u4000000
)

(define-private (calculate-policy-collateral (policy-id uint))
  ;; TODO: Implement actual calculation of policy collateral value
  ;; This would call the policy registry and oracle to calculate collateral value
  ;; For now, return a placeholder value
  u4000000
) 