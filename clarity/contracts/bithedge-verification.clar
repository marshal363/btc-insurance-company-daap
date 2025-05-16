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
        (parameters-c (unwrap-panic parameters-principal-opt))
        ;; Call has-role on the parameters contract.
        ;; default-to false in case the call fails or returns an error,
        ;; ensuring a boolean is always returned.
        (call-result (contract-call? parameters-c has-role tx-sender role))
      )
        (default-to false call-result)
      )
      false ;; Parameters contract not set, so role cannot be present
    )
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

;; Verifies the integrity of pool balances for a token
;; This is a pure read-only function that performs verification based on supplied values
;; It doesn't make any contract calls which might be flagged as writing operations
(define-read-only (verify-pool-balance-values (token-id (string-ascii 64))
                                             (total-balance uint)
                                             (provider-sum uint) 
                                             (premium-balance uint))
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
)

;; Public function to fetch balances from the Liquidity Pool and perform verification
;; This separates the balance fetching (potentially writing operations) from the verification logic
(define-public (run-pool-balance-verification (token-id (string-ascii 64)))
  (let (
    (lp-principal-opt (var-get liquidity-pool-principal))
  )
    ;; Check if Liquidity Pool principal is set
    (asserts! (is-some lp-principal-opt) ERR-CONTRACT-NOT-SET)
    
    (let (
      (lp-principal (unwrap-panic lp-principal-opt))
      (verification-id (consume-next-verification-id))
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
                  ;; Perform verification with the retrieved values
                  (let (
                    (verification-result (verify-pool-balance-values token-id total-balance provider-sum premium-balance))
                  )
                    ;; Record verification result
                    (match verification-result
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
                            detailed-result: (some "Pool balance does not match sum of provider deposits and premiums"),
                            error-code: (some (get error-code error-data)),
                            mismatch-amount: (some (get mismatch-amount error-data)),
                            expected-value: (some (get expected-total error-data)),
                            actual-value: (some (get actual-total error-data))
                          })
                        )
                          ;; Record verification result
                          (map-set verification-results
                            { verification-id: verification-id, verification-type: VERIFICATION-TYPE-POOL-BALANCE }
                            verification-entry
                          )
                          
                          ;; Emit failure event
                          (emit-verification-event "verification-failed" verification-id VERIFICATION-TYPE-POOL-BALANCE STATUS-FAILURE 
                            (some (concat "Mismatch amount: " (to-ascii (get mismatch-amount error-data))))
                          )
                          
                          (ok verification-id)
                        )
                    )
                  )
                ;; Error handling for premium balance call
                (let (
                  (verification-entry {
                    verification-id: verification-id,
                    verification-type: VERIFICATION-TYPE-POOL-BALANCE,
                    status: STATUS-FAILURE,
                    initiated-by: tx-sender,
                    execution-height: burn-block-height,
                    completion-height: (some burn-block-height),
                    target-entity: (some token-id),
                    detailed-result: (some "Failed to retrieve premium balances from Liquidity Pool"),
                    error-code: (some u2003), ;; ERR-DATA-NOT-FOUND
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
                  (emit-verification-event "verification-failed" verification-id VERIFICATION-TYPE-POOL-BALANCE STATUS-FAILURE (some "Failed to retrieve premium balances"))
                  
                  (err ERR-DATA-NOT-FOUND)
                )
              )
            ;; Error handling for provider sum call
            (let (
              (verification-entry {
                verification-id: verification-id,
                verification-type: VERIFICATION-TYPE-POOL-BALANCE,
                status: STATUS-FAILURE,
                initiated-by: tx-sender,
                execution-height: burn-block-height,
                completion-height: (some burn-block-height),
                target-entity: (some token-id),
                detailed-result: (some "Failed to retrieve sum of provider balances from Liquidity Pool"),
                error-code: (some u2003), ;; ERR-DATA-NOT-FOUND
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
              (emit-verification-event "verification-failed" verification-id VERIFICATION-TYPE-POOL-BALANCE STATUS-FAILURE (some "Failed to retrieve provider balances"))
              
              (err ERR-DATA-NOT-FOUND)
            )
          )
        ;; Error handling for total balance call
        (let (
          (verification-entry {
            verification-id: verification-id,
            verification-type: VERIFICATION-TYPE-POOL-BALANCE,
            status: STATUS-FAILURE,
            initiated-by: tx-sender,
            execution-height: burn-block-height,
            completion-height: (some burn-block-height),
            target-entity: (some token-id),
            detailed-result: (some "Failed to retrieve total token balance from Liquidity Pool"),
            error-code: (some u2003), ;; ERR-DATA-NOT-FOUND
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
          (emit-verification-event "verification-failed" verification-id VERIFICATION-TYPE-POOL-BALANCE STATUS-FAILURE (some "Failed to retrieve total balance"))
          
          (err ERR-DATA-NOT-FOUND)
        )
      )
    )
  )
)

;; --- VC-204: Implementation of verify-policy-allocation-integrity ---

;; Verifies the integrity of provider allocations for a policy
;; This is a pure read-only function that performs verification based on supplied values
;; It doesn't make any contract calls which might be flagged as writing operations
(define-read-only (verify-policy-allocation-values 
                    (policy-id uint)
                    (required-collateral uint)
                    (providers-allocation-sum uint))
  (let (
    ;; Check if the total allocations match the required collateral
    (is-balanced (is-eq required-collateral providers-allocation-sum))
  )
    (if is-balanced
      ;; Success case - allocations sum matches required collateral
      (ok {
        policy-id: policy-id,
        status: STATUS-SUCCESS,
        required-collateral: required-collateral,
        providers-allocation-sum: providers-allocation-sum,
        mismatch-amount: u0
      })
      ;; Failure case - allocations don't match required collateral
      (let (
        (mismatch-amount (if (> required-collateral providers-allocation-sum)
                          (- required-collateral providers-allocation-sum)
                          (- providers-allocation-sum required-collateral)))
      )
        (err {
          policy-id: policy-id,
          status: STATUS-FAILURE,
          error-code: u2101, ;; ERR-POLICY-ALLOCATION-MISMATCH
          required-collateral: required-collateral,
          providers-allocation-sum: providers-allocation-sum,
          mismatch-amount: mismatch-amount
        })
      )
    )
  )
)

;; Public function to fetch policy allocation data and perform verification
;; This separates the data fetching (potentially writing operations) from the verification logic
(define-public (run-policy-allocation-verification (policy-id uint))
  (let (
    (pr-principal-opt (var-get policy-registry-principal))
    (lp-principal-opt (var-get liquidity-pool-principal))
  )
    ;; Check if required contract principals are set
    (asserts! (and (is-some pr-principal-opt) (is-some lp-principal-opt)) ERR-CONTRACT-NOT-SET)
    
    (let (
      (pr-principal (unwrap-panic pr-principal-opt))
      (lp-principal (unwrap-panic lp-principal-opt))
      (verification-id (consume-next-verification-id))
    )
      ;; Get policy details from Policy Registry
      (match (contract-call? pr-principal get-policy policy-id)
        policy-data
          (let (
            ;; Use collateral-locked as our required collateral amount
            (required-collateral (get collateral-locked policy-data))
            (policy-token-id (get collateral-token policy-data))
            ;; Find all the providers that allocated to this policy by checking the LP contract
            (providers-with-allocation (contract-call? lp-principal find-providers-for-policy-public policy-id policy-token-id))
          )
            ;; Calculate the total allocation by summing individual provider allocations
            (let (
              (allocation-sum 
                (fold +
                  (map 
                    (lambda (provider-info)
                      (contract-call? lp-principal get-provider-allocation-amount-public 
                        (get provider provider-info) 
                        policy-id
                      )
                    )
                    providers-with-allocation
                  )
                  u0
                )
              )
            )
              ;; Perform verification with the retrieved values
              (let (
                (verification-result (verify-policy-allocation-values policy-id required-collateral allocation-sum))
              )
                ;; Record verification result
                (match verification-result
                  success-data
                    (let (
                      (verification-entry {
                        verification-id: verification-id,
                        verification-type: VERIFICATION-TYPE-POLICY-ALLOCATION,
                        status: (get status success-data),
                        initiated-by: tx-sender,
                        execution-height: burn-block-height,
                        completion-height: (some burn-block-height),
                        target-entity: (some (concat "Policy-" (to-ascii policy-id))),
                        detailed-result: (some "Provider allocations match required collateral"),
                        error-code: none,
                        mismatch-amount: (some (get mismatch-amount success-data)),
                        expected-value: (some required-collateral),
                        actual-value: (some allocation-sum)
                      })
                    )
                      ;; Record verification result
                      (map-set verification-results
                        { verification-id: verification-id, verification-type: VERIFICATION-TYPE-POLICY-ALLOCATION }
                        verification-entry
                      )
                      
                      ;; Emit success event
                      (emit-verification-event "verification-completed" verification-id VERIFICATION-TYPE-POLICY-ALLOCATION STATUS-SUCCESS none)
                      
                      (ok verification-id)
                    )
                  
                  error-data
                    (let (
                      (verification-entry {
                        verification-id: verification-id,
                        verification-type: VERIFICATION-TYPE-POLICY-ALLOCATION,
                        status: (get status error-data),
                        initiated-by: tx-sender,
                        execution-height: burn-block-height,
                        completion-height: (some burn-block-height),
                        target-entity: (some (concat "Policy-" (to-ascii policy-id))),
                        detailed-result: (some "Provider allocations do not match required collateral"),
                        error-code: (some (get error-code error-data)),
                        mismatch-amount: (some (get mismatch-amount error-data)),
                        expected-value: (some required-collateral),
                        actual-value: (some allocation-sum)
                      })
                    )
                      ;; Record verification result
                      (map-set verification-results
                        { verification-id: verification-id, verification-type: VERIFICATION-TYPE-POLICY-ALLOCATION }
                        verification-entry
                      )
                      
                      ;; Emit failure event
                      (emit-verification-event "verification-failed" verification-id VERIFICATION-TYPE-POLICY-ALLOCATION STATUS-FAILURE 
                        (some (concat "Mismatch amount: " (to-ascii (get mismatch-amount error-data))))
                      )
                      
                      (ok verification-id)
                    )
                )
              )
            )
          )
        ;; Error handling for policy data retrieval
        (let (
          (verification-entry {
            verification-id: verification-id,
            verification-type: VERIFICATION-TYPE-POLICY-ALLOCATION,
            status: STATUS-FAILURE,
            initiated-by: tx-sender,
            execution-height: burn-block-height,
            completion-height: (some burn-block-height),
            target-entity: (some (concat "Policy-" (to-ascii policy-id))),
            detailed-result: (some "Failed to retrieve policy data from Policy Registry"),
            error-code: (some u2003), ;; ERR-DATA-NOT-FOUND
            mismatch-amount: none,
            expected-value: none,
            actual-value: none
          })
        )
          ;; Record verification result
          (map-set verification-results
            { verification-id: verification-id, verification-type: VERIFICATION-TYPE-POLICY-ALLOCATION }
            verification-entry
          )
          
          ;; Emit failure event
          (emit-verification-event "verification-failed" verification-id VERIFICATION-TYPE-POLICY-ALLOCATION STATUS-FAILURE (some "Failed to retrieve policy data"))
          
          (err ERR-DATA-NOT-FOUND)
        )
      )
    )
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