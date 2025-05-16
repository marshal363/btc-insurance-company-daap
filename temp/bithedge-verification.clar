;; BitHedge Verification Contract
;; Version: 0.1 (Phase 2 - VC-201 Initial Setup)
;; Summary: Provides verification mechanisms for system integrity.
;; Description: This contract contains functions to verify system invariants,
;;              data integrity across contracts, and correctness of
;;              critical operations within the BitHedge platform.

;; --- Traits ---
;; (No traits defined in this initial version)

;; --- Constants ---
(define-constant CONTRACT-OWNER tx-sender)

;; Error Codes (aligned with PA-104)
;; General Verification Errors (u2000 range - Verification specific)
(define-constant ERR-UNAUTHORIZED (err u2000))
(define-constant ERR-VERIFICATION-FAILED (err u2001))
(define-constant ERR-CONTRACT-NOT-SET (err u2002))
(define-constant ERR-DATA-NOT-FOUND (err u2003))
(define-constant ERR-INSUFFICIENT-VERIFICATION-DATA (err u2004))
(define-constant ERR-INVALID-VERIFICATION-TYPE (err u2005))
(define-constant ERR-VERIFICATION-ALREADY-RUNNING (err u2006))
(define-constant ERR-VERIFICATION-PARAM-NOT-FOUND (err u2007))

;; Specific Verification Error Codes
(define-constant ERR-POOL-BALANCE-MISMATCH (err u2100))
(define-constant ERR-POLICY-ALLOCATION-MISMATCH (err u2101))
(define-constant ERR-PREMIUM-DISTRIBUTION-MISMATCH (err u2102))
(define-constant ERR-SETTLEMENT-IMPACT-MISMATCH (err u2103))
(define-constant ERR-PROVIDER-BALANCE-MISMATCH (err u2104))
(define-constant ERR-RISK-TIER-INCOMPATIBLE (err u2105))

;; Verification Status Constants
(define-constant STATUS-PENDING "PENDING")
(define-constant STATUS-SUCCESS "SUCCESS") 
(define-constant STATUS-FAILURE "FAILURE")
(define-constant STATUS-SKIPPED "SKIPPED")

;; Verification Type Constants
(define-constant VERIFICATION-TYPE-POOL-BALANCE "POOL_BALANCE")
(define-constant VERIFICATION-TYPE-POLICY-ALLOCATION "POLICY_ALLOCATION")
(define-constant VERIFICATION-TYPE-PREMIUM-DISTRIBUTION "PREMIUM_DISTRIBUTION")
(define-constant VERIFICATION-TYPE-SETTLEMENT-IMPACT "SETTLEMENT_IMPACT")
(define-constant VERIFICATION-TYPE-PROVIDER-BALANCE "PROVIDER_BALANCE")
(define-constant VERIFICATION-TYPE-RISK-TIER-COMPATIBILITY "RISK_TIER_COMPATIBILITY")
(define-constant VERIFICATION-TYPE-SYSTEM-INVARIANTS "SYSTEM_INVARIANTS")

;; Role Constants (aligned with BitHedgeParametersContract)
(define-constant ROLE-ADMIN "ROLE-ADMIN")
(define-constant ROLE-VERIFICATION-MANAGER "ROLE-VERIFICATION-MANAGER")

;; Failure Action Constants
(define-constant FAILURE-ACTION-LOG "LOG")
(define-constant FAILURE-ACTION-REVERT "REVERT")
(define-constant FAILURE-ACTION-CIRCUIT-BREAK "CIRCUIT_BREAK")

;; --- Data Variables ---
(define-data-var parameters-contract-principal (optional principal) none)
(define-data-var policy-registry-principal (optional principal) none)
(define-data-var liquidity-pool-principal (optional principal) none)
(define-data-var price-oracle-principal (optional principal) none)
(define-data-var math-library-principal (optional principal) none)
(define-data-var contract-owner principal CONTRACT-OWNER)

;; --- Data Maps ---

;; Tracks the results of verification operations
;; This allows for historical verification results to be queried
(define-map verification-results
  {
    verification-id: uint,
    verification-type: (string-ascii 64)
  }
  {
    status: (string-ascii 16),                ;; SUCCESS, FAILURE, PENDING, SKIPPED
    initiated-by: principal,                  ;; Who initiated the verification
    execution-height: uint,                   ;; Block height of execution
    completion-height: (optional uint),       ;; Block height of completion (if finished)
    target-entity: (optional (string-ascii 128)), ;; What was verified (policy ID, token, etc.)
    detailed-result: (optional (string-ascii 256)), ;; Detailed result message/description
    error-code: (optional uint),              ;; Error code if failed
    mismatch-amount: (optional uint),         ;; Discrepancy amount if applicable
    expected-value: (optional uint),          ;; Expected value in verification
    actual-value: (optional uint)             ;; Actual value found during verification
  }
)

;; Tracks the next verification ID to use
(define-data-var next-verification-id uint u0)

;; Stores verification parameters that can be configured
;; These parameters control thresholds, frequency, and other verification settings
(define-map verification-parameters
  {
    param-name: (string-ascii 64)
  }
  {
    uint-value: (optional uint),              ;; For numeric parameters
    principal-value: (optional principal),    ;; For principal parameters
    string-value: (optional (string-ascii 128)), ;; For string parameters
    bool-value: (optional bool),              ;; For boolean parameters
    description: (string-ascii 256),          ;; Description of the parameter
    last-updated-height: uint,                ;; When parameter was last updated
    updater-principal: principal              ;; Who updated the parameter
  }
)

;; Tracks which verification types are enabled and their required frequency
(define-map verification-type-config
  {
    verification-type: (string-ascii 64)
  }
  {
    is-enabled: bool,                        ;; Whether verification type is enabled
    required-frequency: (optional uint),     ;; How often verification should run (in blocks)
    last-execution-height: (optional uint),  ;; When verification was last run
    last-execution-id: (optional uint),      ;; ID of last verification run
    failure-action: (string-ascii 32)        ;; What to do on failure: LOG, REVERT, CIRCUIT_BREAK
  }
)

;; --- Public Functions ---

;; Set contract owner
(define-public (set-contract-owner (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-UNAUTHORIZED)
    (ok (var-set contract-owner new-owner))
  )
)

;; Set parameters contract principal
(define-public (set-parameters-contract-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-UNAUTHORIZED)
    (ok (var-set parameters-contract-principal (some new-principal)))
  )
)

;; Set policy registry principal
(define-public (set-policy-registry-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-UNAUTHORIZED)
    (ok (var-set policy-registry-principal (some new-principal)))
  )
)

;; Set liquidity pool principal
(define-public (set-liquidity-pool-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-UNAUTHORIZED)
    (ok (var-set liquidity-pool-principal (some new-principal)))
  )
)

;; Set price oracle principal
(define-public (set-price-oracle-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-UNAUTHORIZED)
    (ok (var-set price-oracle-principal (some new-principal)))
  )
)

;; Set math library principal
(define-public (set-math-library-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-UNAUTHORIZED)
    (ok (var-set math-library-principal (some new-principal)))
  )
)

;; --- VC-202: Parameter Management Functions ---

;; Check if the caller has the required role
(define-private (has-role (role (string-ascii 32)))
  (let (
    (parameters-principal-opt (var-get parameters-contract-principal))
  )
    (if (is-some parameters-principal-opt)
      (let (
        (parameters-principal (unwrap-panic parameters-principal-opt))
        (call-result 
          (as-contract 
            (contract-call? parameters-principal has-role tx-sender role)))
      )
        ;; Return true only if call succeeded and returned true
        (default-to false call-result))
      false) ;; Parameters contract not set, no roles
  )
)

;; Set a verification parameter with a uint value
(define-public (set-verification-parameter-uint (param-name (string-ascii 64)) (value uint) (description (string-ascii 256)))
  (begin
    ;; Check that we have a parameters contract set
    (asserts! (is-some (var-get parameters-contract-principal)) ERR-CONTRACT-NOT-SET)
    
    ;; Check that caller has the necessary role
    (asserts! (or 
               (is-eq tx-sender (var-get contract-owner))
               (has-role ROLE-ADMIN) 
               (has-role ROLE-VERIFICATION-MANAGER))
              ERR-UNAUTHORIZED)
    
    ;; Update the parameter map
    (map-set verification-parameters
      { param-name: param-name }
      { 
        uint-value: (some value),
        principal-value: none,
        string-value: none,
        bool-value: none,
        description: description,
        last-updated-height: burn-block-height,
        updater-principal: tx-sender
      }
    )
    
    ;; Emit event for the update
    (print {
      event: "verification-parameter-updated",
      param-name: param-name,
      param-type: "uint",
      uint-value: value,
      description: description,
      block-height: burn-block-height,
      updater: tx-sender
    })
    
    (ok true)
  )
)

;; Set a verification parameter with a principal value
(define-public (set-verification-parameter-principal (param-name (string-ascii 64)) (value principal) (description (string-ascii 256)))
  (begin
    ;; Check that we have a parameters contract set
    (asserts! (is-some (var-get parameters-contract-principal)) ERR-CONTRACT-NOT-SET)
    
    ;; Check that caller has the necessary role
    (asserts! (or 
               (is-eq tx-sender (var-get contract-owner))
               (has-role ROLE-ADMIN) 
               (has-role ROLE-VERIFICATION-MANAGER))
              ERR-UNAUTHORIZED)
    
    ;; Update the parameter map
    (map-set verification-parameters
      { param-name: param-name }
      { 
        uint-value: none,
        principal-value: (some value),
        string-value: none,
        bool-value: none,
        description: description,
        last-updated-height: burn-block-height,
        updater-principal: tx-sender
      }
    )
    
    ;; Emit event for the update
    (print {
      event: "verification-parameter-updated",
      param-name: param-name,
      param-type: "principal",
      principal-value: value,
      description: description,
      block-height: burn-block-height,
      updater: tx-sender
    })
    
    (ok true)
  )
)

;; Set a verification parameter with a string value
(define-public (set-verification-parameter-string (param-name (string-ascii 64)) (value (string-ascii 128)) (description (string-ascii 256)))
  (begin
    ;; Check that we have a parameters contract set
    (asserts! (is-some (var-get parameters-contract-principal)) ERR-CONTRACT-NOT-SET)
    
    ;; Check that caller has the necessary role
    (asserts! (or 
               (is-eq tx-sender (var-get contract-owner))
               (has-role ROLE-ADMIN) 
               (has-role ROLE-VERIFICATION-MANAGER))
              ERR-UNAUTHORIZED)
    
    ;; Update the parameter map
    (map-set verification-parameters
      { param-name: param-name }
      { 
        uint-value: none,
        principal-value: none,
        string-value: (some value),
        bool-value: none,
        description: description,
        last-updated-height: burn-block-height,
        updater-principal: tx-sender
      }
    )
    
    ;; Emit event for the update
    (print {
      event: "verification-parameter-updated",
      param-name: param-name,
      param-type: "string",
      string-value: value,
      description: description,
      block-height: burn-block-height,
      updater: tx-sender
    })
    
    (ok true)
  )
)

;; Set a verification parameter with a boolean value
(define-public (set-verification-parameter-bool (param-name (string-ascii 64)) (value bool) (description (string-ascii 256)))
  (begin
    ;; Check that we have a parameters contract set
    (asserts! (is-some (var-get parameters-contract-principal)) ERR-CONTRACT-NOT-SET)
    
    ;; Check that caller has the necessary role
    (asserts! (or 
               (is-eq tx-sender (var-get contract-owner))
               (has-role ROLE-ADMIN) 
               (has-role ROLE-VERIFICATION-MANAGER))
              ERR-UNAUTHORIZED)
    
    ;; Update the parameter map
    (map-set verification-parameters
      { param-name: param-name }
      { 
        uint-value: none,
        principal-value: none,
        string-value: none,
        bool-value: (some value),
        description: description,
        last-updated-height: burn-block-height,
        updater-principal: tx-sender
      }
    )
    
    ;; Emit event for the update
    (print {
      event: "verification-parameter-updated",
      param-name: param-name,
      param-type: "bool",
      bool-value: value,
      description: description,
      block-height: burn-block-height,
      updater: tx-sender
    })
    
    (ok true)
  )
)

;; Configure a verification type (enable/disable, set frequency, set failure action)
(define-public (configure-verification-type 
  (verification-type (string-ascii 64)) 
  (is-enabled bool) 
  (required-frequency (optional uint)) 
  (failure-action (string-ascii 32)))
  (begin
    ;; Check that we have a parameters contract set
    (asserts! (is-some (var-get parameters-contract-principal)) ERR-CONTRACT-NOT-SET)
    
    ;; Check that caller has the necessary role
    (asserts! (or 
               (is-eq tx-sender (var-get contract-owner))
               (has-role ROLE-ADMIN) 
               (has-role ROLE-VERIFICATION-MANAGER))
              ERR-UNAUTHORIZED)
    
    ;; Validate the failure action is one of the allowed values
    (asserts! (or 
               (is-eq failure-action FAILURE-ACTION-LOG)
               (is-eq failure-action FAILURE-ACTION-REVERT)
               (is-eq failure-action FAILURE-ACTION-CIRCUIT-BREAK))
              ERR-INVALID-VERIFICATION-TYPE)
    
    ;; Get the current configuration if it exists
    (let ((current-config (map-get? verification-type-config { verification-type: verification-type })))
      ;; Preserve existing execution data if available
      (map-set verification-type-config
        { verification-type: verification-type }
        { 
          is-enabled: is-enabled,
          required-frequency: required-frequency,
          last-execution-height: (match current-config 
                                  config (get last-execution-height config)
                                  none),
          last-execution-id: (match current-config 
                              config (get last-execution-id config)
                              none),
          failure-action: failure-action
        }
      )
    )
    
    ;; Emit event for the update
    (print {
      event: "verification-type-configured",
      verification-type: verification-type,
      is-enabled: is-enabled,
      required-frequency: required-frequency,
      failure-action: failure-action,
      block-height: burn-block-height,
      updater: tx-sender
    })
    
    (ok true)
  )
)

;; --- VC-203: Implementation of verify-pool-balance-integrity ---

;; Verifies the integrity of pool balances in the Liquidity Pool contract
;; Checks that LP total token balances match the sum of provider deposits and contract-held premiums
(define-read-only (verify-pool-balance-integrity (token-id (string-ascii 64)))
  (let (
    (lp-principal-opt (var-get liquidity-pool-principal))
  )
    ;; Check if Liquidity Pool principal is set
    (asserts! (is-some lp-principal-opt) ERR-CONTRACT-NOT-SET)
    
    (let (
      (lp-principal (unwrap-panic lp-principal-opt))
    )
      ;; Call Liquidity Pool to get total token balance
      (match (contract-call? lp-principal get-total-token-balance token-id)
        total-balance 
          ;; Call LP to get total provider deposited amounts for this token
          (match (contract-call? lp-principal get-sum-provider-balances token-id)
            provider-sum
              ;; Call LP to get total premium balances for this token
              (match (contract-call? lp-principal get-premium-balances token-id)
                premium-balance
                  (let (
                    ;; Calculate the expected total (sum of provider balances and premiums)
                    (expected-total (+ provider-sum premium-balance))
                  )
                    ;; Compare expected with actual and return result
                    (if (is-eq total-balance expected-total)
                      ;; Success case - balances match
                      (ok {
                        token-id: token-id,
                        status: STATUS-SUCCESS,
                        total-balance: total-balance,
                        provider-sum: provider-sum,
                        premium-balance: premium-balance,
                        mismatch-amount: u0,
                        expected-total: expected-total,
                        actual-total: total-balance
                      })
                      ;; Failure case - balances don't match
                      (let (
                        (mismatch-amount (if (> total-balance expected-total)
                                          (- total-balance expected-total)
                                          (- expected-total total-balance)))
                      )
                        (err {
                          token-id: token-id,
                          status: STATUS-FAILURE,
                          error-code: u2100, ;; ERR-POOL-BALANCE-MISMATCH
                          total-balance: total-balance,
                          provider-sum: provider-sum,
                          premium-balance: premium-balance,
                          mismatch-amount: mismatch-amount,
                          expected-total: expected-total,
                          actual-total: total-balance
                        })
                      )
                    )
                  )
                ;; Error handling for premium balance call
                (err {
                  token-id: token-id,
                  status: STATUS-FAILURE,
                  error-code: u2003, ;; ERR-DATA-NOT-FOUND
                  error-detail: "Failed to retrieve premium balances from Liquidity Pool"
                })
              )
            ;; Error handling for provider sum call
            (err {
              token-id: token-id,
              status: STATUS-FAILURE,
              error-code: u2003, ;; ERR-DATA-NOT-FOUND
              error-detail: "Failed to retrieve sum of provider balances from Liquidity Pool"
            })
          )
        ;; Error handling for total balance call
        (err {
          token-id: token-id,
          status: STATUS-FAILURE,
          error-code: u2003, ;; ERR-DATA-NOT-FOUND
          error-detail: "Failed to retrieve total token balance from Liquidity Pool"
        })
      )
    )
  )
)

;; Public function to record the results of pool balance verification
;; This function should be called after running verify-pool-balance-integrity
(define-public (record-pool-balance-verification-result (token-id (string-ascii 64)) (verification-result (response (tuple (token-id (string-ascii 64)) (status (string-ascii 16)) (total-balance uint) (provider-sum uint) (premium-balance uint) (mismatch-amount uint) (expected-total uint) (actual-total uint)) (tuple (token-id (string-ascii 64)) (status (string-ascii 16)) (error-code uint) (error-detail (string-ascii 256))))))
  (let (
    (verification-id (consume-next-verification-id))
  )
    ;; Create base verification entry
    (match verification-result
      ;; Success case
      success-data
        (let (
          (verification-entry {
            verification-id: verification-id,
            verification-type: VERIFICATION-TYPE-POOL-BALANCE,
            status: (get status success-data),
            initiated-by: tx-sender,
            execution-height: burn-block-height,
            completion-height: (some burn-block-height),
            target-entity: (some token-id),
            detailed-result: (some "Pool balance matches sum of provider deposits and premiums"),
            error-code: none,
            mismatch-amount: (some (get mismatch-amount success-data)),
            expected-value: (some (get expected-total success-data)),
            actual-value: (some (get actual-total success-data))
          })
        )
          ;; Record verification result
          (map-set verification-results
            { verification-id: verification-id, verification-type: VERIFICATION-TYPE-POOL-BALANCE }
            verification-entry
          )
          
          ;; Emit success event
          (emit-verification-event "verification-completed" verification-id VERIFICATION-TYPE-POOL-BALANCE STATUS-SUCCESS none)
          
          (ok verification-id)
        )
      
      ;; Error case
      error-data
        (let (
          (verification-entry {
            verification-id: verification-id,
            verification-type: VERIFICATION-TYPE-POOL-BALANCE,
            status: (get status error-data),
            initiated-by: tx-sender,
            execution-height: burn-block-height,
            completion-height: (some burn-block-height),
            target-entity: (some token-id),
            detailed-result: (some (get error-detail error-data)),
            error-code: (some (get error-code error-data)),
            mismatch-amount: none,
            expected-value: none,
            actual-value: none
          })
        )
          ;; Record verification result
          (map-set verification-results
            { verification-id: verification-id, verification-type: VERIFICATION-TYPE-POOL-BALANCE }
            verification-entry
          )
          
          ;; Emit failure event
          (emit-verification-event "verification-failed" verification-id VERIFICATION-TYPE-POOL-BALANCE STATUS-FAILURE (some (get error-detail error-data)))
          
          (ok verification-id)
        )
    )
  )
)

;; Convenience function that performs verification and records results in one step
(define-public (run-pool-balance-verification (token-id (string-ascii 64)))
  (let (
    (verification-result (verify-pool-balance-integrity token-id))
  )
    (record-pool-balance-verification-result token-id verification-result)
  )
)

;; --- Read-Only Functions ---

;; Get contract owner
(define-read-only (get-contract-owner)
  (var-get contract-owner)
)

;; Get parameters contract principal
(define-read-only (get-parameters-contract-principal)
  (var-get parameters-contract-principal)
)

;; Get policy registry principal
(define-read-only (get-policy-registry-principal)
  (var-get policy-registry-principal)
)

;; Get liquidity pool principal
(define-read-only (get-liquidity-pool-principal)
  (var-get liquidity-pool-principal)
)

;; Get price oracle principal
(define-read-only (get-price-oracle-principal)
  (var-get price-oracle-principal)
)

;; Get math library principal
(define-read-only (get-math-library-principal)
  (var-get math-library-principal)
)

;; Get verification result by ID and type
(define-read-only (get-verification-result (verification-id uint) (verification-type (string-ascii 64)))
  (map-get? verification-results { verification-id: verification-id, verification-type: verification-type })
)

;; Get verification parameter
(define-read-only (get-verification-parameter (param-name (string-ascii 64)))
  (map-get? verification-parameters { param-name: param-name })
)

;; Get verification type configuration
(define-read-only (get-verification-type-config (verification-type (string-ascii 64)))
  (map-get? verification-type-config { verification-type: verification-type })
)

;; Check if verification is enabled
(define-read-only (is-verification-enabled (verification-type (string-ascii 64)))
  (match (map-get? verification-type-config { verification-type: verification-type })
    config (get is-enabled config)
    false
  )
)

;; Helper functions to get specific parameter values by type
(define-read-only (get-verification-parameter-uint (param-name (string-ascii 64)))
  (match (map-get? verification-parameters { param-name: param-name })
    parameter (get uint-value parameter)
    none
  )
)

(define-read-only (get-verification-parameter-principal (param-name (string-ascii 64)))
  (match (map-get? verification-parameters { param-name: param-name })
    parameter (get principal-value parameter)
    none
  )
)

(define-read-only (get-verification-parameter-string (param-name (string-ascii 64)))
  (match (map-get? verification-parameters { param-name: param-name })
    parameter (get string-value parameter)
    none
  )
)

(define-read-only (get-verification-parameter-bool (param-name (string-ascii 64)))
  (match (map-get? verification-parameters { param-name: param-name })
    parameter (get bool-value parameter)
    none
  )
)

;; Get next verification ID and increment
(define-private (consume-next-verification-id)
  (let ((current-id (var-get next-verification-id)))
    (var-set next-verification-id (+ current-id u1))
    current-id
  )
)

;; --- Event Emission ---
;; Standardized event emission for verification events
(define-private (emit-verification-event (event-name (string-ascii 32)) (verification-id uint) (verification-type (string-ascii 64)) (status (string-ascii 16)) (details (optional (string-ascii 256))))
  (print {
    event: event-name,
    verification-id: verification-id,
    verification-type: verification-type,
    status: status,
    block-height: burn-block-height,
    details: details
  })
)

;; Initialize contract with a welcome message
(print { 
  event: "contract-initialized", 
  contract-name: "BitHedgeVerificationContract",
  version: "0.1",
  block-height: burn-block-height,
  description: "Initial setup for verification contract with core data structures for VC-201."
}) 