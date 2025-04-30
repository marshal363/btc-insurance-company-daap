;; title: parameter
;; version: 1.0.0
;; summary: Parameter Contract for BitHedge platform
;; description: Manages system parameters, feature flags, and circuit breakers for the BitHedge platform.

;; *******************************************************************************
;; * Authorization Roles                                                         *
;; *******************************************************************************
;; * The parameter contract uses a tiered authorization system:                  *
;; *                                                                             *
;; * 1. System Admin - Has initial deployment control and bootstrap authority.   *
;; *    Used primarily during setup and for basic maintenance.                   *
;; *                                                                             *
;; * 2. Guardian - Has authority to trigger emergency circuit breakers and       *
;; *    perform time-sensitive health monitoring. Limited to specific critical   *
;; *    functions that need rapid response.                                      *
;; *                                                                             *
;; * 3. Governance - Has highest authority for protocol changes after            *
;; *    deployment. Controls parameter updates, feature flags, and critical      *
;; *    contract addresses. Operates through proposal system.                    *
;; *                                                                             *
;; * 4. Authorized Contracts - Core contracts (like policy-registry,             *
;; *    liquidity-pool) can call specific functions.                             *
;; *                                                                             *
;; * This design ensures protocol control becomes progressively decentralized    *
;; * through governance while maintaining appropriate emergency safeguards.      *
;; *******************************************************************************

;; traits
;; Defines the interface for interacting with the Governance contract
(define-trait governance-trait
  (
    ;; Checks if a given proposal ID has been approved by governance
    (is-proposal-approved (uint) (response bool uint))
  )
)

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
(define-data-var governance-address principal tx-sender)

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

;; Parameter change history (tracks all parameter changes)
(define-map parameter-change-history
  { 
    param-name: (string-ascii 50),
    change-id: uint 
  }
  {
    previous-value: uint,
    new-value: uint,
    timestamp: uint,
    change-by: principal,
    proposal-id: (optional uint)
  }
)

;; Feature flag change history (tracks all feature flag changes)
(define-map feature-flag-change-history
  { 
    flag-name: (string-ascii 50),
    change-id: uint 
  }
  {
    previous-status: bool,
    new-status: bool,
    timestamp: uint,
    change-by: principal,
    proposal-id: (optional uint)
  }
)

;; Counter for history entry IDs
(define-data-var history-counter uint u0)

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
      burn-block-height: burn-block-height
    })
    
    (ok true)
  )
)

;; Set system parameter
(define-public (set-parameter 
    (param-name (string-ascii 50))
    (value uint)
    (proposal-id (optional uint)))
  (let
    (
      (param (unwrap! (map-get? system-parameters { param-name: param-name }) ERR-PARAM-NOT-FOUND))
      (current-time burn-block-height)
      (current-value (get value param))
      (change-id (var-get history-counter))
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
    
    ;; Record parameter change in history
    (map-set parameter-change-history
      { param-name: param-name, change-id: change-id }
      {
        previous-value: current-value,
        new-value: value,
        timestamp: current-time,
        change-by: tx-sender,
        proposal-id: proposal-id
      }
    )
    
    ;; Increment history counter
    (var-set history-counter (+ change-id u1))
    
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
      updater: tx-sender,
      proposal-id: proposal-id
    })
    
    (ok value)
  )
)

;; Set feature flag
(define-public (set-feature-flag
    (flag-name (string-ascii 50))
    (enabled bool)
    (proposal-id (optional uint)))
  (let
    (
      (flag (unwrap! (map-get? feature-flags { flag-name: flag-name }) ERR-PARAM-NOT-FOUND))
      (current-time burn-block-height)
      (current-status (get enabled flag))
      (change-id (var-get history-counter))
    )
    
    ;; Check system state
    (asserts! (var-get system-initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (is-eq (var-get system-status) SYSTEM-STATUS-HALTED)) ERR-UNAVAILABLE)
    
    ;; Check authorization
    (check-auth (get auth-level flag))
    
    ;; Check flash loan protection
    (check-flash-loan-protection)
    
    ;; Record feature flag change in history
    (map-set feature-flag-change-history
      { flag-name: flag-name, change-id: change-id }
      {
        previous-status: current-status,
        new-status: enabled,
        timestamp: current-time,
        change-by: tx-sender,
        proposal-id: proposal-id
      }
    )
    
    ;; Increment history counter
    (var-set history-counter (+ change-id u1))
    
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
      updater: tx-sender,
      proposal-id: proposal-id
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
      (current-time burn-block-height)
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
        triggered-at: burn-block-height,
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
      burn-block-height: burn-block-height
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
      (current-time burn-block-height)
    )
    
    ;; Check system state
    (asserts! (var-get system-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check authorization - require higher level for reset
    (check-auth (get auth-level breaker))
    
    ;; For auto-reset breakers, check if enough blocks have passed
    (if (and (get auto-reset breaker) (get triggered breaker))
      (asserts! (>= burn-block-height (+ (get triggered-at breaker) (get reset-blocks breaker))) ERR-NOT-AUTHORIZED)
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
      burn-block-height: burn-block-height
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
      (current-time burn-block-height)
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
      burn-block-height: burn-block-height
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
      (current-time burn-block-height)
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
      (trigger-circuit-breaker (concat "health-" check-name) none)
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
    
    ;; Different authorization based on contract type
    ;; Non-critical contracts can be updated by admin
    ;; Critical contracts (like governance) require governance approval
    (if (or (is-eq contract-name "governance") (is-eq contract-name "treasury"))
      ;; For critical contracts, require governance approval
      (check-auth AUTH-LEVEL-GOVERNANCE)
      ;; For other contracts, admin is sufficient
    (asserts! (is-eq tx-sender (var-get system-admin)) ERR-NOT-AUTHORIZED)
    )
    
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
      "governance" (begin
        (var-set governance-address address)
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
      burn-block-height: burn-block-height
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
    ;; Admin always has access
    (is-eq tx-sender (var-get system-admin))
    ;; Guardian has access to guardian-level or none-level
    (and 
      (or (is-eq auth-level AUTH-LEVEL-GUARDIAN) (is-eq auth-level AUTH-LEVEL-NONE))
      (is-eq tx-sender (var-get guardian-address)))
    ;; Anyone has access to none-level
    (and
      (is-eq auth-level AUTH-LEVEL-NONE)
      true)
    ;; For governance-level, governance contract has access
    (and
      (is-eq auth-level AUTH-LEVEL-GOVERNANCE)
      (is-eq tx-sender (var-get governance-address)))
  )
)

;; Get parameter change history entry by ID
(define-read-only (get-parameter-change-entry (param-name (string-ascii 50)) (change-id uint))
  (map-get? parameter-change-history { param-name: param-name, change-id: change-id })
)

;; Get feature flag change history entry by ID
(define-read-only (get-feature-flag-change-entry (flag-name (string-ascii 50)) (change-id uint))
  (map-get? feature-flag-change-history { flag-name: flag-name, change-id: change-id })
)

;; Get the most recent parameter change
(define-read-only (get-last-parameter-change (param-name (string-ascii 50)))
  (let
    (
      (history-count (var-get history-counter))
    )
    (if (> history-count u0)
      (map-get? parameter-change-history 
        { param-name: param-name, change-id: (- history-count u1) })
      none
    )
  )
)

;; Get the most recent feature flag change
(define-read-only (get-last-feature-flag-change (flag-name (string-ascii 50)))
  (let
    (
      (history-count (var-get history-counter))
    )
    (if (> history-count u0)
      (map-get? feature-flag-change-history 
        { flag-name: flag-name, change-id: (- history-count u1) })
      none
    )
  )
)

;; Get latest history counter (useful for pagination)
(define-read-only (get-history-counter)
  (var-get history-counter)
)

;; private functions
;;

;; Initialize default parameters
(define-private (initialize-default-parameters)
  (begin
    ;; Initialize the history counter
    (var-set history-counter u0)
    
    ;; Set default system parameters
    (map-set system-parameters
      { param-name: "policy-min-premium" }
      {
        value: u1000,
        description: u"Minimum premium amount in STX satoshis",
        min-value: u100,
        max-value: u1000000,
        default-value: u1000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
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
        last-updated: burn-block-height,
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
        last-updated: burn-block-height,
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
        last-updated: burn-block-height,
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
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    
    ;; Flash loan protection
    (map-set system-parameters
      { param-name: "min-blocks-between-operations" }
      {
        value: u1,
        description: u"Minimum blocks between certain state-changing operations (basic flash loan protection)",
        min-value: u0,
        max-value: u1000, ;; Max 1000 blocks delay
        default-value: u1,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    
    ;; Policy Registry Related
    (map-set system-parameters
      { param-name: "policy-cancellation-fee-pct" }
      {
        value: u50000, ;; 5%
        description: u"Percentage fee charged on premium for early cancellation (if supported)",
        min-value: u0,
        max-value: u1000000, ;; Max 100%
        default-value: u50000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "policy-activation-window-blocks" }
      {
        value: u144, ;; ~1 day
        description: u"Time window in blocks after conditions are met for a user to activate a policy",
        min-value: u0,
        max-value: u10080, ;; Max ~10 weeks
        default-value: u144,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )

    ;; Liquidity Pool Related
    (map-set system-parameters
      { param-name: "withdrawal-delay-blocks" }
      {
        value: u144, ;; ~1 day
        description: u"Cooldown period in blocks required before a provider can withdraw non-locked funds",
        min-value: u0,
        max-value: u10080, ;; Max ~10 weeks
        default-value: u144,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )

    ;; Oracle Related
    (map-set system-parameters
      { param-name: "oracle-max-price-deviation-pct" }
      {
        value: u50000, ;; 5%
        description: u"Maximum allowed deviation percentage between a new price update and the current price",
        min-value: u0,
        max-value: u1000000, ;; Max 100%
        default-value: u50000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "oracle-minimum-providers" }
      {
        value: u3,
        description: u"Minimum number of provider submissions required for consensus",
        min-value: u1,
        max-value: u10, ;; Max 10 providers
        default-value: u3,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "oracle-max-price-age-seconds" }
      {
        value: u3600, ;; 1 hour
        description: u"Maximum age in seconds for oracle price data to be considered valid",
        min-value: u60, ;; Min 1 minute
        max-value: u86400, ;; Max 1 day
        default-value: u3600,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "oracle-volatility-window-days" }
      {
        value: u14,
        description: u"Lookback period in days for volatility calculation",
        min-value: u1,
        max-value: u90, ;; Max 90 days
        default-value: u14,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )

    ;; Treasury / Fee Related
    (map-set system-parameters
      { param-name: "fee-insurance-fund-pct" }
      {
        value: u40000, ;; 4%
        description: u"Percentage of premium allocated to the Insurance Fund",
        min-value: u0,
        max-value: u1000000, ;; Max 100%
        default-value: u40000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "fee-provider-pct" }
      {
        value: u950000, ;; 95%
        description: u"Percentage of premium allocated to the liquidity provider (calculated, ensure sum = 100%)",
        min-value: u0,
        max-value: u1000000, ;; Max 100%
        default-value: u950000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "fee-discount-tier1-pct" }
      {
        value: u0, ;; 0% for MVP
        description: u"Fee discount percentage for Tier 1 users",
        min-value: u0,
        max-value: u1000000, ;; Max 100%
        default-value: u0,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "fee-discount-tier2-pct" }
      {
        value: u0, ;; 0% for MVP
        description: u"Fee discount percentage for Tier 2 users",
        min-value: u0,
        max-value: u1000000, ;; Max 100%
        default-value: u0,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "fee-discount-threshold-tier1" }
      {
        value: u100000000000000, ;; Very high / Effectively disabled for MVP
        description: u"Threshold (e.g., volume, stake) to qualify for Tier 1 discount",
        min-value: u0,
        max-value: u1000000000000000000, ;; Very large number
        default-value: u100000000000000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "fee-discount-threshold-tier2" }
      {
        value: u1000000000000000, ;; Very high / Effectively disabled for MVP
        description: u"Threshold to qualify for Tier 2 discount",
        min-value: u0,
        max-value: u10000000000000000000, ;; Even larger number
        default-value: u1000000000000000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )

    ;; Insurance Fund Related
    (map-set system-parameters
      { param-name: "insurance-min-fund-size-stx" }
      {
        value: u1000000000000, ;; 1M STX
        description: u"Minimum required capital in the Insurance Fund (STX equivalent)",
        min-value: u0,
        max-value: u100000000000000, ;; Max 100M STX
        default-value: u1000000000000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "insurance-target-reserve-ratio-pct" }
      {
        value: u50000, ;; 5%
        description: u"Target fund size relative to total system TVL or risk exposure",
        min-value: u0,
        max-value: u1000000, ;; Max 100%
        default-value: u50000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "insurance-utilization-limit-pct" }
      {
        value: u250000, ;; 25%
        description: u"Maximum percentage of the fund usable for a single shortfall event",
        min-value: u0,
        max-value: u1000000, ;; Max 100%
        default-value: u250000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )

    ;; Liquidation Engine Related
    (map-set system-parameters
      { param-name: "liquidation-threshold-ratio" }
      {
        value: u990000, ;; 99%
        description: u"Collateralization ratio below which liquidation process begins",
        min-value: u0, ;; Needs careful consideration - setting to 0 min for now
        max-value: u1000000, ;; Max 100% - Also needs careful consideration
        default-value: u990000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "liquidation-penalty-pct" }
      {
        value: u100000, ;; 10%
        description: u"Penalty percentage applied to collateral during liquidation",
        min-value: u0,
        max-value: u1000000, ;; Max 100%
        default-value: u100000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "liquidation-grace-period-blocks" }
      {
        value: u144, ;; ~1 day
        description: u"Blocks allowed for a provider to top up collateral after a margin call",
        min-value: u0,
        max-value: u10080, ;; Max ~10 weeks
        default-value: u144,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "liquidation-partial-pct" }
      {
        value: u500000, ;; 50%
        description: u"Percentage of position liquidated during a partial liquidation event",
        min-value: u0,
        max-value: u1000000, ;; Max 100%
        default-value: u500000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )

    ;; Governance Related
    (map-set system-parameters
      { param-name: "gov-proposal-threshold" }
      {
        value: u1000000000000, ;; Example: 1M tokens
        description: u"Minimum governance token balance required to create a proposal",
        min-value: u0,
        max-value: u10000000000000000000, ;; Very large number
        default-value: u1000000000000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "gov-proposal-period-blocks" }
      {
        value: u1008, ;; ~7 days
        description: u"Duration of the voting period for proposals in blocks",
        min-value: u144, ;; Min 1 day
        max-value: u40320, ;; Max ~40 weeks
        default-value: u1008,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "gov-quorum-pct" }
      {
        value: u200000, ;; 20%
        description: u"Minimum percentage of total voting power required to participate for a vote to be valid",
        min-value: u0,
        max-value: u1000000, ;; Max 100%
        default-value: u200000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "gov-pass-threshold-pct" }
      {
        value: u510000, ;; 51%
        description: u"Minimum percentage of participating voting power voting 'YES' for a proposal to pass",
        min-value: u0,
        max-value: u1000000, ;; Max 100%
        default-value: u510000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "gov-timelock-delay-blocks" }
      {
        value: u288, ;; ~2 days
        description: u"Delay in blocks between proposal passing and execution",
        min-value: u0,
        max-value: u10080, ;; Max ~10 weeks
        default-value: u288,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )

    ;; P2P Marketplace Related
    (map-set system-parameters
      { param-name: "p2p-listing-fee" }
      {
        value: u0, ;; 0 for MVP
        description: u"Fee to list an offer on the P2P marketplace (STX satoshis)",
        min-value: u0,
        max-value: u10000000000, ;; Max 100 STX
        default-value: u0,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "p2p-match-fee-pct" }
      {
        value: u5000, ;; 0.5%
        description: u"Percentage fee charged on matched P2P premium",
        min-value: u0,
        max-value: u1000000, ;; Max 100%
        default-value: u5000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )

    ;; Dispute Resolution Related
    (map-set system-parameters
      { param-name: "dispute-filing-window-blocks" }
      {
        value: u1008, ;; ~7 days
        description: u"Time window in blocks allowed to file a dispute after an event",
        min-value: u144, ;; Min 1 day
        max-value: u10080, ;; Max ~10 weeks
        default-value: u1008,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "dispute-resolution-timeframe-blocks" }
      {
        value: u2016, ;; ~14 days
        description: u"Maximum time in blocks allocated for resolving a dispute",
        min-value: u144, ;; Min 1 day
        max-value: u40320, ;; Max ~40 weeks
        default-value: u2016,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    (map-set system-parameters
      { param-name: "dispute-deposit-stx" }
      {
        value: u10000000, ;; 10 STX
        description: u"Deposit amount in STX satoshis required to file a dispute",
        min-value: u0,
        max-value: u10000000000, ;; Max 100 STX
        default-value: u10000000,
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )

    ;; Return true to continue initialization
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
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    
    (map-set feature-flags
      { flag-name: "policy-activation" }
      {
        enabled: true,
        description: u"Whether users can activate/exercise policies",
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    
    (map-set feature-flags
      { flag-name: "deposit-collateral" }
      {
        enabled: true,
        description: u"Whether liquidity providers can deposit collateral",
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    
    (map-set feature-flags
      { flag-name: "withdraw-collateral" }
      {
        enabled: true,
        description: u"Whether liquidity providers can withdraw collateral",
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    
    (map-set feature-flags
      { flag-name: "claim-yield" }
      {
        enabled: true,
        description: u"Whether liquidity providers can claim yield",
        auth-level: AUTH-LEVEL-ADMIN,
        last-updated: burn-block-height,
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
        last-updated: burn-block-height,
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
        last-updated: burn-block-height,
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
        last-updated: burn-block-height,
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
        last-updated: burn-block-height,
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
        last-checked: burn-block-height,
        failure-count: u0,
        auth-level: AUTH-LEVEL-GUARDIAN
      }
    )
    
    (map-set health-checks
      { check-name: "liquidity-ratio" }
      {
        status: true,
        description: u"Check if liquidity ratio is adequate",
        last-checked: burn-block-height,
        failure-count: u0,
        auth-level: AUTH-LEVEL-GUARDIAN
      }
    )
    
    (map-set health-checks
      { check-name: "system-contracts" }
      {
        status: true,
        description: u"Check if all system contracts are responsive",
        last-checked: burn-block-height,
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
        ;; Admin always has access
        (is-eq tx-sender (var-get system-admin))
        ;; Guardian has access to guardian-level functions
        (and 
          (is-eq required-level AUTH-LEVEL-GUARDIAN)
          (is-eq tx-sender (var-get guardian-address)))
        ;; Anyone has access to public functions
        (and
          (is-eq required-level AUTH-LEVEL-NONE)
          true)
        ;; For governance-level actions, check if sender is governance contract
        (and
          (is-eq required-level AUTH-LEVEL-GOVERNANCE)
          (is-eq tx-sender (var-get governance-address)))
      )
      ERR-NOT-AUTHORIZED)
    (ok true)
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
      (current-time burn-block-height)
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