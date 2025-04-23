;; title: parameter
;; version: 1.0.0
;; summary: Parameter Contract for BitHedge platform
;; description: Manages system parameters, feature flags, and circuit breakers for the BitHedge platform.

;; traits
;;

;; token definitions
;;

;; constants
;;
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-PARAM-NOT-FOUND (err u101))
(define-constant ERR-INVALID-PARAMETER (err u102))
(define-constant ERR-CIRCUIT-BREAKER-TRIGGERED (err u103))
(define-constant ERR-FLASH-LOAN-DETECTED (err u104))
(define-constant ERR-NOT-INITIALIZED (err u105))
(define-constant ERR-UNAVAILABLE (err u106))

;; Authorization levels (bitmask)
(define-constant AUTH-LEVEL-NONE u0)
(define-constant AUTH-LEVEL-ADMIN u1)
(define-constant AUTH-LEVEL-GUARDIAN u2)
(define-constant AUTH-LEVEL-GOVERNANCE u4)

;; System status constants
(define-constant SYSTEM-STATUS-NORMAL u0)
(define-constant SYSTEM-STATUS-WARNING u1)
(define-constant SYSTEM-STATUS-RESTRICTED u2)
(define-constant SYSTEM-STATUS-HALTED u3)

;; data vars
;;
;; System initialization and status
(define-data-var system-initialized bool false)
(define-data-var system-status uint SYSTEM-STATUS-NORMAL)

;; System admin
(define-data-var system-admin principal tx-sender)

;; Guardian and contract addresses
(define-data-var guardian-address principal tx-sender)
(define-data-var policy-registry-address principal tx-sender)
(define-data-var liquidity-pool-address principal tx-sender)
(define-data-var oracle-address principal tx-sender)
(define-data-var treasury-address principal tx-sender)
(define-data-var insurance-fund-address principal tx-sender)

;; Last timestamp for flash loan protection
(define-data-var last-operation-timestamp uint u0)

;; data maps
;;
;; System parameters (name -> value and metadata)
(define-map system-parameters
  { param-name: (string-ascii 50) }
  {
    value: uint,
    description: (string-utf8 200),
    min-value: uint,
    max-value: uint,
    default-value: uint,
    auth-level: uint,
    last-updated: uint,
    last-updated-by: principal
  }
)

;; Feature flags (name -> status and metadata)
(define-map feature-flags
  { flag-name: (string-ascii 50) }
  {
    enabled: bool,
    description: (string-utf8 200),
    auth-level: uint,
    last-updated: uint,
    last-updated-by: principal
  }
)

;; Circuit breakers
(define-map circuit-breakers
  { breaker-name: (string-ascii 50) }
  {
    triggered: bool,
    threshold: uint,
    current-value: uint,
    description: (string-utf8 200),
    auth-level: uint,
    auto-reset: bool,
    reset-blocks: uint,
    triggered-at: uint,
    last-updated: uint,
    last-updated-by: principal
  }
)

;; Health checks
(define-map health-checks
  { check-name: (string-ascii 50) }
  {
    status: bool,
    description: (string-utf8 200),
    last-checked: uint,
    failure-count: uint,
    auth-level: uint
  }
)

;; public functions
;;

;; Initialize the parameter contract with default values
(define-public (initialize-system)
  (begin
    ;; Check if already initialized
    (asserts! (not (var-get system-initialized)) ERR-NOT-AUTHORIZED)
    
    ;; Set default system parameters
    (initialize-default-parameters)
    
    ;; Set default feature flags
    (initialize-default-flags)
    
    ;; Set default circuit breakers
    (initialize-default-breakers)
    
    ;; Set default health checks
    (initialize-default-health-checks)
    
    ;; Mark system as initialized
    (var-set system-initialized true)
    
    ;; Emit initialization event
    (print {
      event: "system-initialized",
      admin: tx-sender,
      block-height: block-height
    })
    
    (ok true)
  )
)

;; Set system parameter
(define-public (set-parameter 
    (param-name (string-ascii 50))
    (value uint))
  (let
    (
      (param (unwrap! (map-get? system-parameters { param-name: param-name }) ERR-PARAM-NOT-FOUND))
      (current-time (get time (unwrap! (block-info?) ERR-INVALID-PARAMETER)))
    )
    
    ;; Check system state
    (asserts! (var-get system-initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (is-eq (var-get system-status) SYSTEM-STATUS-HALTED)) ERR-UNAVAILABLE)
    
    ;; Check authorization
    (check-auth (get auth-level param))
    
    ;; Check flash loan protection
    (check-flash-loan-protection)
    
    ;; Validate parameter bounds
    (asserts! (and (>= value (get min-value param)) (<= value (get max-value param))) ERR-INVALID-PARAMETER)
    
    ;; Update parameter
    (map-set system-parameters
      { param-name: param-name }
      (merge param {
        value: value,
        last-updated: current-time,
        last-updated-by: tx-sender
      })
    )
    
    ;; Update operation timestamp
    (var-set last-operation-timestamp current-time)
    
    ;; Emit parameter update event
    (print {
      event: "parameter-updated",
      param-name: param-name,
      value: value,
      updater: tx-sender
    })
    
    (ok value)
  )
)

;; Set feature flag
(define-public (set-feature-flag
    (flag-name (string-ascii 50))
    (enabled bool))
  (let
    (
      (flag (unwrap! (map-get? feature-flags { flag-name: flag-name }) ERR-PARAM-NOT-FOUND))
      (current-time (get time (unwrap! (block-info?) ERR-INVALID-PARAMETER)))
    )
    
    ;; Check system state
    (asserts! (var-get system-initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (is-eq (var-get system-status) SYSTEM-STATUS-HALTED)) ERR-UNAVAILABLE)
    
    ;; Check authorization
    (check-auth (get auth-level flag))
    
    ;; Check flash loan protection
    (check-flash-loan-protection)
    
    ;; Update feature flag
    (map-set feature-flags
      { flag-name: flag-name }
      (merge flag {
        enabled: enabled,
        last-updated: current-time,
        last-updated-by: tx-sender
      })
    )
    
    ;; Update operation timestamp
    (var-set last-operation-timestamp current-time)
    
    ;; Emit feature flag update event
    (print {
      event: "feature-flag-updated",
      flag-name: flag-name,
      enabled: enabled,
      updater: tx-sender
    })
    
    (ok enabled)
  )
)

;; Trigger circuit breaker
(define-public (trigger-circuit-breaker
    (breaker-name (string-ascii 50)))
  (let
    (
      (breaker (unwrap! (map-get? circuit-breakers { breaker-name: breaker-name }) ERR-PARAM-NOT-FOUND))
      (current-time (get time (unwrap! (block-info?) ERR-INVALID-PARAMETER)))
    )
    
    ;; Check system state
    (asserts! (var-get system-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check authorization
    (check-auth (get auth-level breaker))
    
    ;; Update circuit breaker
    (map-set circuit-breakers
      { breaker-name: breaker-name }
      (merge breaker {
        triggered: true,
        triggered-at: block-height,
        last-updated: current-time,
        last-updated-by: tx-sender
      })
    )
    
    ;; If this is a system-wide emergency breaker, update system status
    (if (is-eq breaker-name "emergency-halt")
      (var-set system-status SYSTEM-STATUS-HALTED)
      true
    )
    
    ;; Emit circuit breaker event
    (print {
      event: "circuit-breaker-triggered",
      breaker-name: breaker-name,
      updater: tx-sender,
      block-height: block-height
    })
    
    (ok true)
  )
)

;; Reset circuit breaker
(define-public (reset-circuit-breaker
    (breaker-name (string-ascii 50)))
  (let
    (
      (breaker (unwrap! (map-get? circuit-breakers { breaker-name: breaker-name }) ERR-PARAM-NOT-FOUND))
      (current-time (get time (unwrap! (block-info?) ERR-INVALID-PARAMETER)))
    )
    
    ;; Check system state
    (asserts! (var-get system-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check authorization - require higher level for reset
    (check-auth (get auth-level breaker))
    
    ;; For auto-reset breakers, check if enough blocks have passed
    (if (and (get auto-reset breaker) (get triggered breaker))
      (asserts! (>= block-height (+ (get triggered-at breaker) (get reset-blocks breaker))) ERR-NOT-AUTHORIZED)
      true
    )
    
    ;; Update circuit breaker
    (map-set circuit-breakers
      { breaker-name: breaker-name }
      (merge breaker {
        triggered: false,
        current-value: u0,
        last-updated: current-time,
        last-updated-by: tx-sender
      })
    )
    
    ;; If this is a system-wide emergency breaker, update system status
    (if (is-eq breaker-name "emergency-halt")
      (var-set system-status SYSTEM-STATUS-NORMAL)
      true
    )
    
    ;; Emit circuit breaker reset event
    (print {
      event: "circuit-breaker-reset",
      breaker-name: breaker-name,
      updater: tx-sender,
      block-height: block-height
    })
    
    (ok true)
  )
)

;; Update circuit breaker value
(define-public (update-circuit-breaker-value
    (breaker-name (string-ascii 50))
    (current-value uint))
  (let
    (
      (breaker (unwrap! (map-get? circuit-breakers { breaker-name: breaker-name }) ERR-PARAM-NOT-FOUND))
      (current-time (get time (unwrap! (block-info?) ERR-INVALID-PARAMETER)))
      (threshold (get threshold breaker))
    )
    
    ;; Check system state
    (asserts! (var-get system-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if allowed to update
    (check-contract-auth)
    
    ;; Update circuit breaker value
    (map-set circuit-breakers
      { breaker-name: breaker-name }
      (merge breaker {
        current-value: current-value,
        last-updated: current-time,
        last-updated-by: tx-sender
      })
    )
    
    ;; Check if threshold is exceeded and trigger if needed
    (if (and (> current-value threshold) (not (get triggered breaker)))
      (trigger-circuit-breaker breaker-name)
      (ok true))
  )
)

;; Update system status
(define-public (update-system-status
    (new-status uint))
  (begin
    ;; Check system state
    (asserts! (var-get system-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check authorization - only admin can update system status
    (asserts! (is-eq tx-sender (var-get system-admin)) ERR-NOT-AUTHORIZED)
    
    ;; Validate status value
    (asserts! (<= new-status SYSTEM-STATUS-HALTED) ERR-INVALID-PARAMETER)
    
    ;; Update system status
    (var-set system-status new-status)
    
    ;; Emit system status update event
    (print {
      event: "system-status-updated",
      status: new-status,
      updater: tx-sender,
      block-height: block-height
    })
    
    (ok new-status)
  )
)

;; Update health check status
(define-public (update-health-check
    (check-name (string-ascii 50))
    (status bool))
  (let
    (
      (check (unwrap! (map-get? health-checks { check-name: check-name }) ERR-PARAM-NOT-FOUND))
      (current-time (get time (unwrap! (block-info?) ERR-INVALID-PARAMETER)))
    )
    
    ;; Check system state
    (asserts! (var-get system-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check authorization
    (check-contract-auth)
    
    ;; Update health check
    (map-set health-checks
      { check-name: check-name }
      (merge check {
        status: status,
        last-checked: current-time,
        failure-count: (if status 
                         u0 
                         (+ (get failure-count check) u1))
      })
    )
    
    ;; Check if need to trigger circuit breaker based on health
    (if (and (not status) (>= (+ (get failure-count check) u1) u3))
      (trigger-circuit-breaker (concat "health-" check-name))
      (ok true))
  )
)

;; Update contract addresses
(define-public (set-contract-address
    (contract-name (string-ascii 50))
    (address principal))
  (begin
    ;; Check system state
    (asserts! (var-get system-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check authorization - only admin can update contract addresses
    (asserts! (is-eq tx-sender (var-get system-admin)) ERR-NOT-AUTHORIZED)
    
    ;; Update appropriate contract address
    (match contract-name
      "policy-registry" (begin
        (var-set policy-registry-address address)
        (ok true))
      "liquidity-pool" (begin
        (var-set liquidity-pool-address address)
        (ok true))
      "oracle" (begin
        (var-set oracle-address address)
        (ok true))
      "treasury" (begin
        (var-set treasury-address address)
        (ok true))
      "insurance-fund" (begin
        (var-set insurance-fund-address address)
        (ok true))
      "guardian" (begin
        (var-set guardian-address address)
        (ok true))
      (err ERR-INVALID-PARAMETER))
  )
)

;; Transfer system admin
(define-public (transfer-admin
    (new-admin principal))
  (begin
    ;; Check system state
    (asserts! (var-get system-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check authorization - only current admin can transfer
    (asserts! (is-eq tx-sender (var-get system-admin)) ERR-NOT-AUTHORIZED)
    
    ;; Update admin
    (var-set system-admin new-admin)
    
    ;; Emit admin transfer event
    (print {
      event: "admin-transferred",
      old-admin: tx-sender,
      new-admin: new-admin,
      block-height: block-height
    })
    
    (ok true)
  )
)

;; read only functions
;;

;; Check if a circuit breaker is triggered
(define-read-only (is-circuit-breaker-triggered (breaker-name (string-ascii 50)))
  (match (map-get? circuit-breakers { breaker-name: breaker-name })
    breaker (get triggered breaker)
    false)
)

;; Check if a feature flag is enabled
(define-read-only (is-feature-enabled (flag-name (string-ascii 50)))
  (match (map-get? feature-flags { flag-name: flag-name })
    flag (get enabled flag)
    false)
)

;; Get parameter value
(define-read-only (get-parameter (param-name (string-ascii 50)))
  (match (map-get? system-parameters { param-name: param-name })
    param (ok (get value param))
    (err ERR-PARAM-NOT-FOUND))
)

;; Get parameter details
(define-read-only (get-parameter-details (param-name (string-ascii 50)))
  (map-get? system-parameters { param-name: param-name })
)

;; Get feature flag details
(define-read-only (get-feature-flag-details (flag-name (string-ascii 50)))
  (map-get? feature-flags { flag-name: flag-name })
)

;; Get circuit breaker details
(define-read-only (get-circuit-breaker-details (breaker-name (string-ascii 50)))
  (map-get? circuit-breakers { breaker-name: breaker-name })
)

;; Get health check details
(define-read-only (get-health-check-details (check-name (string-ascii 50)))
  (map-get? health-checks { check-name: check-name })
)

;; Get system status
(define-read-only (get-system-status)
  {
    status: (var-get system-status),
    initialized: (var-get system-initialized),
    admin: (var-get system-admin)
  }
)

;; Check if a function can execute given circuit breakers
(define-read-only (can-execute (function-name (string-ascii 50)))
  (and
    (var-get system-initialized)
    (< (var-get system-status) SYSTEM-STATUS-HALTED)
    (not (is-circuit-breaker-triggered (concat "function-" function-name)))
    (not (is-circuit-breaker-triggered "emergency-halt"))
  )
)

;; Check if sender has appropriate authorization level
(define-read-only (has-auth-level (auth-level uint))
  (or
    (is-eq tx-sender (var-get system-admin))
    (and 
      (is-eq auth-level AUTH-LEVEL-GUARDIAN)
      (is-eq tx-sender (var-get guardian-address)))
    (and
      (is-eq auth-level AUTH-LEVEL-NONE)
      true)
  )
)

;; private functions
;;

;; Initialize default parameters
(define-private (initialize-default-parameters)
  (begin
    ;; Policy parameters
    (map-set system-parameters
      { param-name: "policy-min-premium" }
      {
        value: u1000,
        description: u"Minimum premium amount in STX satoshis",
        min-value: u100,
        max-value: u1000000,
        default-value: u1000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: block-height,
        last-updated-by: tx-sender
      }
    )
    
    (map-set system-parameters
      { param-name: "policy-max-duration" }
      {
        value: u4320,
        description: u"Maximum policy duration in blocks (30 days)",
        min-value: u144,
        max-value: u43200,
        default-value: u4320,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: block-height,
        last-updated-by: tx-sender
      }
    )
    
    ;; Liquidity pool parameters
    (map-set system-parameters
      { param-name: "min-collateralization-ratio" }
      {
        value: u1500000,
        description: u"Minimum collateralization ratio (150%, scaled by 1,000,000)",
        min-value: u1000000,
        max-value: u5000000,
        default-value: u1500000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: block-height,
        last-updated-by: tx-sender
      }
    )
    
    (map-set system-parameters
      { param-name: "max-utilization-rate" }
      {
        value: u800000,
        description: u"Maximum utilization rate (80%, scaled by 1,000,000)",
        min-value: u100000,
        max-value: u1000000,
        default-value: u800000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: block-height,
        last-updated-by: tx-sender
      }
    )
    
    ;; Fee parameters
    (map-set system-parameters
      { param-name: "platform-fee-percentage" }
      {
        value: u10000,
        description: u"Platform fee percentage (1%, scaled by 1,000,000)",
        min-value: u0,
        max-value: u100000,
        default-value: u10000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: block-height,
        last-updated-by: tx-sender
      }
    )
    
    ;; Flash loan protection
    (map-set system-parameters
      { param-name: "min-blocks-between-operations" }
      {
        value: u1,
        description: u"Minimum blocks between operations for flash loan protection",
        min-value: u0,
        max-value: u10,
        default-value: u1,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: block-height,
        last-updated-by: tx-sender
      }
    )
    
    ;; Return true to continue
    true
  )
)

;; Initialize default feature flags
(define-private (initialize-default-flags)
  (begin
    (map-set feature-flags
      { flag-name: "policy-creation" }
      {
        enabled: true,
        description: u"Whether users can create new policies",
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: block-height,
        last-updated-by: tx-sender
      }
    )
    
    (map-set feature-flags
      { flag-name: "policy-activation" }
      {
        enabled: true,
        description: u"Whether users can activate/exercise policies",
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: block-height,
        last-updated-by: tx-sender
      }
    )
    
    (map-set feature-flags
      { flag-name: "deposit-collateral" }
      {
        enabled: true,
        description: u"Whether liquidity providers can deposit collateral",
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: block-height,
        last-updated-by: tx-sender
      }
    )
    
    (map-set feature-flags
      { flag-name: "withdraw-collateral" }
      {
        enabled: true,
        description: u"Whether liquidity providers can withdraw collateral",
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: block-height,
        last-updated-by: tx-sender
      }
    )
    
    (map-set feature-flags
      { flag-name: "claim-yield" }
      {
        enabled: true,
        description: u"Whether liquidity providers can claim yield",
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: block-height,
        last-updated-by: tx-sender
      }
    )
    
    ;; Return true to continue
    true
  )
)

;; Initialize default circuit breakers
(define-private (initialize-default-breakers)
  (begin
    ;; Emergency halt breaker
    (map-set circuit-breakers
      { breaker-name: "emergency-halt" }
      {
        triggered: false,
        threshold: u0,
        current-value: u0,
        description: u"Emergency halt for the entire system",
        auth-level: AUTH-LEVEL-GUARDIAN,
        auto-reset: false,
        reset-blocks: u0,
        triggered-at: u0,
        last-updated: block-height,
        last-updated-by: tx-sender
      }
    )
    
    ;; Utilization rate breaker
    (map-set circuit-breakers
      { breaker-name: "utilization-rate" }
      {
        triggered: false,
        threshold: u900000,
        current-value: u0,
        description: u"Triggered when utilization rate exceeds 90%",
        auth-level: AUTH-LEVEL-GUARDIAN,
        auto-reset: true,
        reset-blocks: u288,
        triggered-at: u0,
        last-updated: block-height,
        last-updated-by: tx-sender
      }
    )
    
    ;; Price deviation breaker
    (map-set circuit-breakers
      { breaker-name: "price-deviation" }
      {
        triggered: false,
        threshold: u200000,
        current-value: u0,
        description: u"Triggered when price deviates more than 20% in a short period",
        auth-level: AUTH-LEVEL-GUARDIAN,
        auto-reset: true,
        reset-blocks: u144,
        triggered-at: u0,
        last-updated: block-height,
        last-updated-by: tx-sender
      }
    )
    
    ;; Function-specific breakers
    (map-set circuit-breakers
      { breaker-name: "function-create-policy" }
      {
        triggered: false,
        threshold: u0,
        current-value: u0,
        description: u"Specifically blocks policy creation",
        auth-level: AUTH-LEVEL-GUARDIAN,
        auto-reset: false,
        reset-blocks: u0,
        triggered-at: u0,
        last-updated: block-height,
        last-updated-by: tx-sender
      }
    )
    
    ;; Return true to continue
    true
  )
)

;; Initialize default health checks
(define-private (initialize-default-health-checks)
  (begin
    (map-set health-checks
      { check-name: "oracle-freshness" }
      {
        status: true,
        description: u"Check if oracle data is fresh",
        last-checked: block-height,
        failure-count: u0,
        auth-level: AUTH-LEVEL-GUARDIAN
      }
    )
    
    (map-set health-checks
      { check-name: "liquidity-ratio" }
      {
        status: true,
        description: u"Check if liquidity ratio is adequate",
        last-checked: block-height,
        failure-count: u0,
        auth-level: AUTH-LEVEL-GUARDIAN
      }
    )
    
    (map-set health-checks
      { check-name: "system-contracts" }
      {
        status: true,
        description: u"Check if all system contracts are responsive",
        last-checked: block-height,
        failure-count: u0,
        auth-level: AUTH-LEVEL-GUARDIAN
      }
    )
    
    ;; Return true to continue
    true
  )
)

;; Check authorization
(define-private (check-auth (required-level uint))
  (begin
    (asserts! 
      (or
        (is-eq tx-sender (var-get system-admin))
        (and 
          (is-eq required-level AUTH-LEVEL-GUARDIAN)
          (is-eq tx-sender (var-get guardian-address)))
        (and
          (is-eq required-level AUTH-LEVEL-NONE)
          true)
      )
      ERR-NOT-AUTHORIZED)
    true
  )
)

;; Check if sender is an authorized contract
(define-private (check-contract-auth)
  (begin
    (asserts! 
      (or
        (is-eq tx-sender (var-get system-admin))
        (is-eq tx-sender (var-get policy-registry-address))
        (is-eq tx-sender (var-get liquidity-pool-address))
        (is-eq tx-sender (var-get oracle-address))
        (is-eq tx-sender (var-get treasury-address))
        (is-eq tx-sender (var-get insurance-fund-address))
        (is-eq tx-sender (var-get guardian-address))
      )
      ERR-NOT-AUTHORIZED)
    true
  )
)

;; Check flash loan protection
(define-private (check-flash-loan-protection)
  (let
    (
      (current-time (get time (unwrap! (block-info?) ERR-INVALID-PARAMETER)))
      (min-time-diff (unwrap-panic (get-parameter "min-blocks-between-operations")))
      (last-time (var-get last-operation-timestamp))
    )
    
    ;; If this is the first operation or enough time has passed, proceed
    (if (or 
          (is-eq last-time u0)
          (>= (- current-time last-time) min-time-diff))
      true
      (begin
        (print {
          event: "flash-loan-protection-triggered",
          current-time: current-time,
          last-time: last-time,
          required-diff: min-time-diff
        })
        (asserts! false ERR-FLASH-LOAN-DETECTED)
      ))
  )
) 