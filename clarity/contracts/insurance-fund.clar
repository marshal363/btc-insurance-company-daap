;; title: insurance-fund
;; version: 1.0.0
;; summary: Insurance Fund Contract for BitHedge platform
;; description: Provides a safety net to cover potential shortfalls in the BitHedge platform.

;; traits
;;

;; token definitions
;;

;; constants
;;
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-NOT-INITIALIZED (err u101))
(define-constant ERR-INVALID-PARAMETERS (err u102))
(define-constant ERR-INSUFFICIENT-FUNDS (err u103))
(define-constant ERR-POLICY-NOT-FOUND (err u104))
(define-constant ERR-POLICY-NOT-TRANSFERABLE (err u105))
(define-constant ERR-POLICY-TRANSFER-FAILED (err u106))
(define-constant ERR-FUND-UTILIZATION-EXCEEDED (err u107))
(define-constant ERR-RECOVERY-IN-PROGRESS (err u108))
(define-constant ERR-TRANSFER-FAILED (err u109))
(define-constant ERR-INVALID-RECOVERY-MODE (err u110))
(define-constant ERR-NOT-MANAGED-POOL (err u111))

;; Fund status constants
(define-constant FUND-STATUS-NORMAL u0)
(define-constant FUND-STATUS-WARNING u1)
(define-constant FUND-STATUS-CRITICAL u2)
(define-constant FUND-STATUS-RECOVERY u3)

;; Recovery mode constants
(define-constant RECOVERY-MODE-NONE u0)
(define-constant RECOVERY-MODE-GRADUAL u1)
(define-constant RECOVERY-MODE-EMERGENCY u2)

;; data vars
;;
;; Insurance fund initialization status
(define-data-var fund-initialized bool false)

;; Insurance fund balance (STX)
(define-data-var fund-balance-stx uint u0)

;; Insurance fund status
(define-data-var fund-status uint FUND-STATUS-NORMAL)

;; Fund parameters
(define-data-var max-fund-utilization uint u800000)  ;; 80% (scaled by 1,000,000)
(define-data-var recovery-threshold uint u200000)  ;; 20% (scaled by 1,000,000)
(define-data-var warning-threshold uint u500000)  ;; 50% (scaled by 1,000,000)
(define-data-var fund-fee-percentage uint u10000)  ;; 1% (scaled by 1,000,000)
(define-data-var recovery-mode uint RECOVERY-MODE-NONE)

;; Total funds covered (STX)
(define-data-var total-covered-amount uint u0)

;; Total funds paid out (STX)
(define-data-var total-payouts uint u0)

;; Total fees collected (STX)
(define-data-var total-fees-collected uint u0)

;; Admin address
(define-data-var admin-address principal tx-sender)

;; Contract addresses
(define-data-var policy-registry-address principal tx-sender)
(define-data-var liquidity-pool-address principal tx-sender)
(define-data-var parameter-contract-address principal tx-sender)
(define-data-var governance-address principal tx-sender)

;; data maps
;;
;; Pool coverage (liquidity pool ID -> coverage details)
(define-map pool-coverage
  { pool-id: uint }
  {
    covered-amount: uint,
    active: bool,
    fee-rate: uint,  ;; Scaled by 1,000,000
    last-fee-payment: uint,
    total-fees-paid: uint
  }
)

;; Policy transfers (policy ID -> transfer details)
(define-map policy-transfers
  { policy-id: uint }
  {
    original-owner: principal,
    new-owner: principal,
    transfer-block: uint,
    transfer-fee: uint,
    status: uint  ;; 0: pending, 1: completed, 2: cancelled
  }
)

;; Recovery plans (recovery ID -> plan details)
(define-map recovery-plans
  { recovery-id: uint }
  {
    start-block: uint,
    end-block: uint,
    target-amount: uint,
    current-amount: uint,
    mode: uint,
    status: uint  ;; 0: active, 1: completed, 2: cancelled
  }
)

;; Managed pools (pool ID -> management details)
(define-map managed-pools
  { pool-id: uint }
  {
    active: bool,
    max-coverage: uint,
    current-coverage: uint,
    shortfall-events: uint,
    fee-multiplier: uint  ;; Scaled by 1,000,000 (1 = standard fee)
  }
)

;; Payouts history (payout ID -> payout details)
(define-map payouts
  { payout-id: uint }
  {
    recipient: principal,
    amount: uint,
    block-height: uint,
    reason: (string-utf8 100),
    policy-id: uint,
    pool-id: uint
  }
)

;; Recovery contributions (recovery ID -> contributions list)
(define-map recovery-contributions
  { recovery-id: uint }
  {
    contributions: (list 20 { 
      contributor: principal, 
      amount: uint, 
      block-height: uint 
    })
  }
)

;; Counter for various IDs
(define-data-var payout-counter uint u0)
(define-data-var recovery-plan-counter uint u0)

;; public functions
;;

;; Initialize insurance fund
(define-public (initialize-fund)
  (begin
    ;; Check if already initialized
    (asserts! (not (var-get fund-initialized)) ERR-NOT-AUTHORIZED)
    
    ;; Set admin and initial variables
    (var-set admin-address tx-sender)
    (var-set fund-initialized true)
    (var-set fund-status FUND-STATUS-NORMAL)
    
    ;; Emit initialization event
    (print {
      event: "fund-initialized",
      admin: tx-sender,
      block-height: block-height
    })
    
    (ok true)
  )
)

;; Capitalize the fund (add STX to the fund)
(define-public (capitalize-fund (amount uint))
  (begin
    ;; Check if fund is initialized
    (asserts! (var-get fund-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if amount is valid
    (asserts! (> amount u0) ERR-INVALID-PARAMETERS)
    
    ;; Transfer STX from sender to contract
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    
    ;; Update fund balance
    (var-set fund-balance-stx (+ (var-get fund-balance-stx) amount))
    
    ;; Update fund status if needed
    (update-fund-status)
    
    ;; Emit capitalization event
    (print {
      event: "fund-capitalized",
      contributor: tx-sender,
      amount: amount,
      new-balance: (var-get fund-balance-stx),
      block-height: block-height
    })
    
    (ok true)
  )
)

;; Register a liquidity pool for coverage
(define-public (register-pool 
    (pool-id uint)
    (covered-amount uint)
    (fee-rate uint))
  (let
    (
      (caller tx-sender)
      (current-block block-height)
    )
    
    ;; Check if fund is initialized
    (asserts! (var-get fund-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is liquidity pool contract
    (asserts! (is-eq caller (var-get liquidity-pool-address)) ERR-NOT-AUTHORIZED)
    
    ;; Validate parameters
    (asserts! (and (> covered-amount u0) (<= fee-rate u1000000)) ERR-INVALID-PARAMETERS)
    
    ;; Check if fund has enough capacity
    (asserts! (<= (+ (var-get total-covered-amount) covered-amount)
                  (calculate-max-coverage))
             ERR-FUND-UTILIZATION-EXCEEDED)
    
    ;; Register the pool coverage
    (map-set pool-coverage
      { pool-id: pool-id }
      {
        covered-amount: covered-amount,
        active: true,
        fee-rate: fee-rate,
        last-fee-payment: current-block,
        total-fees-paid: u0
      }
    )
    
    ;; Add pool to managed pools
    (map-set managed-pools
      { pool-id: pool-id }
      {
        active: true,
        max-coverage: covered-amount,
        current-coverage: covered-amount,
        shortfall-events: u0,
        fee-multiplier: u1000000
      }
    )
    
    ;; Update total covered amount
    (var-set total-covered-amount (+ (var-get total-covered-amount) covered-amount))
    
    ;; Emit pool registration event
    (print {
      event: "pool-registered",
      pool-id: pool-id,
      covered-amount: covered-amount,
      fee-rate: fee-rate,
      block-height: current-block
    })
    
    (ok true)
  )
)

;; Update pool coverage amount
(define-public (update-pool-coverage
    (pool-id uint)
    (new-covered-amount uint))
  (let
    (
      (caller tx-sender)
      (pool-data (unwrap! (map-get? pool-coverage { pool-id: pool-id }) ERR-NOT-MANAGED-POOL))
      (current-covered-amount (get covered-amount pool-data))
      (current-block block-height)
      (coverage-difference (if (> new-covered-amount current-covered-amount)
                            (- new-covered-amount current-covered-amount)
                            (- current-covered-amount new-covered-amount)))
    )
    
    ;; Check if fund is initialized
    (asserts! (var-get fund-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is liquidity pool contract
    (asserts! (is-eq caller (var-get liquidity-pool-address)) ERR-NOT-AUTHORIZED)
    
    ;; If increasing coverage, check fund capacity
    (if (> new-covered-amount current-covered-amount)
      (asserts! (<= (+ (var-get total-covered-amount) coverage-difference)
                   (calculate-max-coverage))
                ERR-FUND-UTILIZATION-EXCEEDED)
      true
    )
    
    ;; Update the pool coverage
    (map-set pool-coverage
      { pool-id: pool-id }
      (merge pool-data { covered-amount: new-covered-amount })
    )
    
    ;; Update managed pool data
    (match (map-get? managed-pools { pool-id: pool-id })
      managed-pool-data 
        (map-set managed-pools
          { pool-id: pool-id }
          (merge managed-pool-data {
            max-coverage: new-covered-amount,
            current-coverage: new-covered-amount
          }))
      ERR-NOT-MANAGED-POOL
    )
    
    ;; Update total covered amount
    (var-set total-covered-amount 
      (if (> new-covered-amount current-covered-amount)
        (+ (var-get total-covered-amount) coverage-difference)
        (- (var-get total-covered-amount) coverage-difference)))
    
    ;; Emit coverage update event
    (print {
      event: "pool-coverage-updated",
      pool-id: pool-id,
      old-coverage: current-covered-amount,
      new-coverage: new-covered-amount,
      block-height: current-block
    })
    
    (ok true)
  )
)

;; Pay fee for coverage
(define-public (pay-coverage-fee
    (pool-id uint)
    (amount uint))
  (let
    (
      (caller tx-sender)
      (pool-data (unwrap! (map-get? pool-coverage { pool-id: pool-id }) ERR-NOT-MANAGED-POOL))
      (current-block block-height)
    )
    
    ;; Check if fund is initialized
    (asserts! (var-get fund-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is liquidity pool contract
    (asserts! (is-eq caller (var-get liquidity-pool-address)) ERR-NOT-AUTHORIZED)
    
    ;; Transfer STX from caller to contract
    (try! (stx-transfer? amount caller (as-contract tx-sender)))
    
    ;; Update fund balance
    (var-set fund-balance-stx (+ (var-get fund-balance-stx) amount))
    
    ;; Update pool coverage data
    (map-set pool-coverage
      { pool-id: pool-id }
      (merge pool-data {
        last-fee-payment: current-block,
        total-fees-paid: (+ (get total-fees-paid pool-data) amount)
      })
    )
    
    ;; Update total fees collected
    (var-set total-fees-collected (+ (var-get total-fees-collected) amount))
    
    ;; Emit fee payment event
    (print {
      event: "coverage-fee-paid",
      pool-id: pool-id,
      amount: amount,
      block-height: current-block
    })
    
    (ok true)
  )
)

;; Cover shortfall in liquidity pool
(define-public (cover-shortfall
    (pool-id uint)
    (shortfall-amount uint)
    (policy-id uint)
    (reason (string-utf8 100)))
  (let
    (
      (caller tx-sender)
      (pool-data (unwrap! (map-get? pool-coverage { pool-id: pool-id }) ERR-NOT-MANAGED-POOL))
      (managed-pool (unwrap! (map-get? managed-pools { pool-id: pool-id }) ERR-NOT-MANAGED-POOL))
      (current-block block-height)
      (covered-amount (get covered-amount pool-data))
      (payout-id (+ (var-get payout-counter) u1))
    )
    
    ;; Check if fund is initialized
    (asserts! (var-get fund-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is liquidity pool contract
    (asserts! (is-eq caller (var-get liquidity-pool-address)) ERR-NOT-AUTHORIZED)
    
    ;; Check if pool coverage is active
    (asserts! (get active pool-data) ERR-NOT-MANAGED-POOL)
    
    ;; Check if shortfall amount is within coverage limits
    (asserts! (<= shortfall-amount covered-amount) ERR-INSUFFICIENT-FUNDS)
    
    ;; Check if fund has enough balance
    (asserts! (<= shortfall-amount (var-get fund-balance-stx)) ERR-INSUFFICIENT-FUNDS)
    
    ;; Transfer STX to cover shortfall
    (try! (as-contract (stx-transfer? shortfall-amount tx-sender caller)))
    
    ;; Update fund balance
    (var-set fund-balance-stx (- (var-get fund-balance-stx) shortfall-amount))
    
    ;; Record payout
    (map-set payouts
      { payout-id: payout-id }
      {
        recipient: caller,
        amount: shortfall-amount,
        block-height: current-block,
        reason: reason,
        policy-id: policy-id,
        pool-id: pool-id
      }
    )
    
    ;; Update payout counter
    (var-set payout-counter payout-id)
    
    ;; Update total payouts
    (var-set total-payouts (+ (var-get total-payouts) shortfall-amount))
    
    ;; Update managed pool data
    (map-set managed-pools
      { pool-id: pool-id }
      (merge managed-pool {
        shortfall-events: (+ (get shortfall-events managed-pool) u1),
        fee-multiplier: (calculate-fee-multiplier (+ (get shortfall-events managed-pool) u1))
      })
    )
    
    ;; Update fund status
    (update-fund-status)
    
    ;; Emit shortfall coverage event
    (print {
      event: "shortfall-covered",
      pool-id: pool-id,
      policy-id: policy-id,
      amount: shortfall-amount,
      payout-id: payout-id,
      block-height: current-block
    })
    
    (ok true)
  )
)

;; Initiate policy transfer to insurance fund
(define-public (initiate-policy-transfer
    (policy-id uint)
    (transfer-fee uint))
  (let
    (
      (caller tx-sender)
      (current-block block-height)
    )
    
    ;; Check if fund is initialized
    (asserts! (var-get fund-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is policy registry contract
    (asserts! (is-eq caller (var-get policy-registry-address)) ERR-NOT-AUTHORIZED)
    
    ;; Record policy transfer
    (map-set policy-transfers
      { policy-id: policy-id }
      {
        original-owner: caller,
        new-owner: (as-contract tx-sender),
        transfer-block: current-block,
        transfer-fee: transfer-fee,
        status: u0  ;; pending
      }
    )
    
    ;; Emit policy transfer initiation event
    (print {
      event: "policy-transfer-initiated",
      policy-id: policy-id,
      original-owner: caller,
      transfer-fee: transfer-fee,
      block-height: current-block
    })
    
    (ok true)
  )
)

;; Complete policy transfer to insurance fund
(define-public (complete-policy-transfer
    (policy-id uint))
  (let
    (
      (caller tx-sender)
      (transfer-data (unwrap! (map-get? policy-transfers { policy-id: policy-id }) ERR-POLICY-NOT-FOUND))
      (current-block block-height)
    )
    
    ;; Check if fund is initialized
    (asserts! (var-get fund-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is policy registry contract
    (asserts! (is-eq caller (var-get policy-registry-address)) ERR-NOT-AUTHORIZED)
    
    ;; Check if transfer is pending
    (asserts! (is-eq (get status transfer-data) u0) ERR-POLICY-NOT-TRANSFERABLE)
    
    ;; Update transfer status to completed
    (map-set policy-transfers
      { policy-id: policy-id }
      (merge transfer-data { status: u1 })  ;; completed
    )
    
    ;; If transfer fee exists, pay it to original owner
    (if (> (get transfer-fee transfer-data) u0)
      (begin
        (try! (as-contract (stx-transfer? 
                (get transfer-fee transfer-data) 
                tx-sender 
                (get original-owner transfer-data))))
        (var-set fund-balance-stx (- (var-get fund-balance-stx) (get transfer-fee transfer-data)))
        true)
      true)
    
    ;; Emit policy transfer completion event
    (print {
      event: "policy-transfer-completed",
      policy-id: policy-id,
      original-owner: (get original-owner transfer-data),
      transfer-fee: (get transfer-fee transfer-data),
      block-height: current-block
    })
    
    (ok true)
  )
)

;; Start recovery mode
(define-public (start-recovery-mode 
    (mode uint)
    (target-amount uint))
  (let
    (
      (caller tx-sender)
      (current-block block-height)
      (recovery-id (+ (var-get recovery-plan-counter) u1))
      (end-block (+ current-block (if (is-eq mode RECOVERY-MODE-EMERGENCY) u144 u8640)))  ;; 1 day or 2 months
    )
    
    ;; Check if fund is initialized
    (asserts! (var-get fund-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Check if no recovery is in progress
    (asserts! (is-eq (var-get recovery-mode) RECOVERY-MODE-NONE) ERR-RECOVERY-IN-PROGRESS)
    
    ;; Check if mode is valid
    (asserts! (or (is-eq mode RECOVERY-MODE-GRADUAL) (is-eq mode RECOVERY-MODE-EMERGENCY)) 
              ERR-INVALID-RECOVERY-MODE)
    
    ;; Validate target amount
    (asserts! (> target-amount (var-get fund-balance-stx)) ERR-INVALID-PARAMETERS)
    
    ;; Create recovery plan
    (map-set recovery-plans
      { recovery-id: recovery-id }
      {
        start-block: current-block,
        end-block: end-block,
        target-amount: target-amount,
        current-amount: (var-get fund-balance-stx),
        mode: mode,
        status: u0  ;; active
      }
    )
    
    ;; Initialize contributions list
    (map-set recovery-contributions
      { recovery-id: recovery-id }
      { contributions: (list) }
    )
    
    ;; Update recovery plan counter
    (var-set recovery-plan-counter recovery-id)
    
    ;; Update fund status and mode
    (var-set fund-status FUND-STATUS-RECOVERY)
    (var-set recovery-mode mode)
    
    ;; Emit recovery mode event
    (print {
      event: "recovery-mode-started",
      recovery-id: recovery-id,
      mode: mode,
      target-amount: target-amount,
      start-block: current-block,
      end-block: end-block
    })
    
    (ok recovery-id)
  )
)

;; Contribute to recovery plan
(define-public (contribute-to-recovery
    (recovery-id uint)
    (amount uint))
  (let
    (
      (contributor tx-sender)
      (current-block block-height)
      (recovery-plan (unwrap! (map-get? recovery-plans { recovery-id: recovery-id }) ERR-INVALID-PARAMETERS))
      (contributions-data (unwrap! (map-get? recovery-contributions { recovery-id: recovery-id }) ERR-INVALID-PARAMETERS))
    )
    
    ;; Check if fund is initialized
    (asserts! (var-get fund-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if recovery plan is active
    (asserts! (is-eq (get status recovery-plan) u0) ERR-INVALID-RECOVERY-MODE)
    
    ;; Check if amount is valid
    (asserts! (> amount u0) ERR-INVALID-PARAMETERS)
    
    ;; Transfer STX from contributor to contract
    (try! (stx-transfer? amount contributor (as-contract tx-sender)))
    
    ;; Update fund balance
    (var-set fund-balance-stx (+ (var-get fund-balance-stx) amount))
    
    ;; Update recovery plan
    (map-set recovery-plans
      { recovery-id: recovery-id }
      (merge recovery-plan {
        current-amount: (+ (get current-amount recovery-plan) amount)
      })
    )
    
    ;; Add contribution to list
    (map-set recovery-contributions
      { recovery-id: recovery-id }
      {
        contributions: (unwrap-panic (as-max-len? 
                        (append (get contributions contributions-data) 
                                {
                                  contributor: contributor,
                                  amount: amount,
                                  block-height: current-block
                                })
                        u20))
      }
    )
    
    ;; Check if target amount reached
    (if (>= (+ (get current-amount recovery-plan) amount) (get target-amount recovery-plan))
      (complete-recovery recovery-id)
      (ok true))
    
    ;; Emit contribution event
    (print {
      event: "recovery-contribution",
      recovery-id: recovery-id,
      contributor: contributor,
      amount: amount,
      block-height: current-block
    })
    
    (ok true)
  )
)

;; Complete recovery plan
(define-public (complete-recovery
    (recovery-id uint))
  (let
    (
      (caller tx-sender)
      (current-block block-height)
      (recovery-plan (unwrap! (map-get? recovery-plans { recovery-id: recovery-id }) ERR-INVALID-PARAMETERS))
    )
    
    ;; Check if fund is initialized
    (asserts! (var-get fund-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if recovery plan is active
    (asserts! (is-eq (get status recovery-plan) u0) ERR-INVALID-RECOVERY-MODE)
    
    ;; Check if caller is admin or recovery completed naturally
    (asserts! (or 
                (is-eq caller (var-get admin-address))
                (>= (get current-amount recovery-plan) (get target-amount recovery-plan))
                (>= current-block (get end-block recovery-plan)))
             ERR-NOT-AUTHORIZED)
    
    ;; Update recovery plan
    (map-set recovery-plans
      { recovery-id: recovery-id }
      (merge recovery-plan { status: u1 })  ;; completed
    )
    
    ;; Reset fund status and mode if no other active recoveries
    (var-set recovery-mode RECOVERY-MODE-NONE)
    (update-fund-status)
    
    ;; Emit recovery completion event
    (print {
      event: "recovery-completed",
      recovery-id: recovery-id,
      final-amount: (get current-amount recovery-plan),
      target-amount: (get target-amount recovery-plan),
      block-height: current-block
    })
    
    (ok true)
  )
)

;; Update fund parameters
(define-public (update-fund-parameters
    (new-max-utilization uint)
    (new-recovery-threshold uint)
    (new-warning-threshold uint)
    (new-fee-percentage uint))
  (let
    (
      (caller tx-sender)
    )
    
    ;; Check if fund is initialized
    (asserts! (var-get fund-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is admin or governance
    (asserts! (or 
                (is-eq caller (var-get admin-address))
                (is-eq caller (var-get governance-address)))
             ERR-NOT-AUTHORIZED)
    
    ;; Validate parameters
    (asserts! (and 
                (> new-max-utilization u0)
                (> new-recovery-threshold u0)
                (> new-warning-threshold u0)
                (>= new-fee-percentage u0))
             ERR-INVALID-PARAMETERS)
    
    ;; Update parameters
    (var-set max-fund-utilization new-max-utilization)
    (var-set recovery-threshold new-recovery-threshold)
    (var-set warning-threshold new-warning-threshold)
    (var-set fund-fee-percentage new-fee-percentage)
    
    ;; Update fund status based on new parameters
    (update-fund-status)
    
    ;; Emit parameters update event
    (print {
      event: "fund-parameters-updated",
      max-utilization: new-max-utilization,
      recovery-threshold: new-recovery-threshold,
      warning-threshold: new-warning-threshold,
      fee-percentage: new-fee-percentage,
      updater: caller
    })
    
    (ok true)
  )
)

;; Update contract addresses
(define-public (set-contract-addresses
    (policy-registry principal)
    (liquidity-pool principal)
    (parameter-contract principal)
    (governance principal))
  (let
    (
      (caller tx-sender)
    )
    
    ;; Check if fund is initialized
    (asserts! (var-get fund-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Update contract addresses
    (var-set policy-registry-address policy-registry)
    (var-set liquidity-pool-address liquidity-pool)
    (var-set parameter-contract-address parameter-contract)
    (var-set governance-address governance)
    
    ;; Emit address update event
    (print {
      event: "contract-addresses-updated",
      policy-registry: policy-registry,
      liquidity-pool: liquidity-pool,
      parameter-contract: parameter-contract,
      governance: governance,
      updater: caller
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
    
    ;; Check if fund is initialized
    (asserts! (var-get fund-initialized) ERR-NOT-INITIALIZED)
    
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

;; Get insurance fund balance and status
(define-read-only (get-fund-info)
  {
    fund-balance: (var-get fund-balance-stx),
    fund-status: (var-get fund-status),
    recovery-mode: (var-get recovery-mode),
    total-covered-amount: (var-get total-covered-amount),
    total-payouts: (var-get total-payouts),
    total-fees-collected: (var-get total-fees-collected),
    max-fund-utilization: (var-get max-fund-utilization),
    recovery-threshold: (var-get recovery-threshold),
    warning-threshold: (var-get warning-threshold),
    fund-fee-percentage: (var-get fund-fee-percentage)
  }
)

;; Get pool coverage details
(define-read-only (get-pool-coverage-details (pool-id uint))
  (map-get? pool-coverage { pool-id: pool-id })
)

;; Get policy transfer details
(define-read-only (get-policy-transfer-details (policy-id uint))
  (map-get? policy-transfers { policy-id: policy-id })
)

;; Get recovery plan details
(define-read-only (get-recovery-plan (recovery-id uint))
  (map-get? recovery-plans { recovery-id: recovery-id })
)

;; Get recovery contributions
(define-read-only (get-recovery-contributions (recovery-id uint))
  (map-get? recovery-contributions { recovery-id: recovery-id })
)

;; Get payout details
(define-read-only (get-payout-details (payout-id uint))
  (map-get? payouts { payout-id: payout-id })
)

;; Get managed pool details
(define-read-only (get-managed-pool-details (pool-id uint))
  (map-get? managed-pools { pool-id: pool-id })
)

;; Check if fund has capacity for coverage
(define-read-only (has-coverage-capacity (amount uint))
  (let
    (
      (max-coverage (calculate-max-coverage))
      (current-coverage (var-get total-covered-amount))
    )
    (<= (+ current-coverage amount) max-coverage)
  )
)

;; Calculate max coverage based on fund balance
(define-read-only (calculate-max-coverage)
  (let
    (
      (balance (var-get fund-balance-stx))
      (utilization-rate (var-get max-fund-utilization))
    )
    (/ (* balance utilization-rate) u1000000)
  )
)

;; private functions
;;

;; Update fund status based on current metrics
(define-private (update-fund-status)
  (let
    (
      (balance (var-get fund-balance-stx))
      (covered (var-get total-covered-amount))
      (utilization-rate (if (> balance u0) (/ (* covered u1000000) balance) u1000000))
      (recovery-rate (var-get recovery-threshold))
      (warning-rate (var-get warning-threshold))
    )
    
    ;; Determine new status
    (var-set fund-status 
      (cond
        ;; If in recovery mode, keep it
        ((is-eq (var-get recovery-mode) RECOVERY-MODE-NONE) 
          (cond
            ((>= utilization-rate u1000000) FUND-STATUS-CRITICAL)
            ((>= utilization-rate warning-rate) FUND-STATUS-WARNING)
            (true FUND-STATUS-NORMAL)))
        (true FUND-STATUS-RECOVERY)))
    
    true
  )
)

;; Calculate fee multiplier based on shortfall events
(define-private (calculate-fee-multiplier (shortfall-events uint))
  (cond
    ((is-eq shortfall-events u0) u1000000)  ;; 1x
    ((is-eq shortfall-events u1) u1500000)  ;; 1.5x
    ((is-eq shortfall-events u2) u2000000)  ;; 2x
    ((is-eq shortfall-events u3) u2500000)  ;; 2.5x
    (true u3000000))                         ;; 3x max
) 