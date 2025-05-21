;; risk-manager-v1.clar
;; Enhanced implementation for LP-301 (Full Risk Tier Parameter Usage)

;; --- Additional Error Constants ---
(define-constant ERR-TIER-NOT-ACTIVE (err u3003))
(define-constant ERR-INVALID-COLLATERAL-RATIO (err u3005))
(define-constant ERR-TIER-PARAMS-FETCH-FAILED (err u3010))

;; --- Enhanced check-liquidity Implementation (LP-301) ---
(define-public (check-liquidity 
    (protection-amount-scaled uint)
    (token-id (string-ascii 32))
    (buyer-risk-tier (string-ascii 32))
    (expiration-height uint) 
  )
  (let (
      ;; Get parameters contract
      (params-contract (var-get parameters-contract-principal))
      ;; Get capital manager contract
      (capital-manager (var-get capital-manager-principal))
    )
    (asserts! (is-some params-contract) ERR-PARAMS-PRINCIPAL-NOT-SET)
    (asserts! (is-some capital-manager) ERR-CAPITAL-MANAGER-PRINCIPAL-NOT-SET)
    
    ;; First, map buyer tier to appropriate provider tier
    (match (get-provider-tier-for-buyer-tier buyer-risk-tier)
      mapped-provider-tier-ok
        (let ((provider-tier-name (unwrap-panic mapped-provider-tier-ok)))
          ;; Get provider tier parameters from Parameters Contract
          (match (contract-call? (unwrap-panic params-contract) get-risk-tier-parameters
            provider-tier-name
          )
            provider-tier-params-optional
              (if (is-some provider-tier-params-optional)
                (let ((provider-tier-params (unwrap-panic provider-tier-params-optional)))
                  ;; Check if tier is active
                  (if (get is-active provider-tier-params)
                    (let ((provider-collateral-ratio-bp (get collateral-ratio-basis-points provider-tier-params)))
                      ;; Check if collateral ratio is valid
                      (if (> provider-collateral-ratio-bp u0)
                        ;; Calculate required collateral based on tier-specific collateral ratio
                        (let ((estimated-collateral-needed (/
                            (* protection-amount-scaled provider-collateral-ratio-bp)
                            u10000
                          )))
                          ;; Check available liquidity from capital manager
                          (match (contract-call? (unwrap-panic capital-manager) get-available-balance token-id)
                            available-balance-ok
                              (let ((available-balance (unwrap-panic available-balance-ok)))
                                (if (>= available-balance estimated-collateral-needed)
                                  (ok true)
                                  (err ERR-INSUFFICIENT-LIQUIDITY)
                                )
                              )
                            available-balance-err
                              (err ERR-CAPITAL-MANAGER-ERROR)
                          )
                        )
                        (err ERR-INVALID-COLLATERAL-RATIO)
                      )
                    )
                    (err ERR-TIER-NOT-ACTIVE)
                  )
                )
                (err ERR-INVALID-RISK-TIER)
              )
            params-call-error
              (err ERR-PARAMS-PRINCIPAL-NOT-SET)
          )
        )
      mapping-error
        (err ERR-INVALID-RISK-TIER)
    )
  )
)

;; --- Enhanced tier compatibility check (LP-301) ---
(define-public (is-tier-compatible 
    (buyer-tier (string-ascii 32)) 
    (provider-tier (string-ascii 32))
  )
  (match (map-get? tier-compatibility { buyer-tier: buyer-tier, provider-tier: provider-tier })
    compatibility-data 
      ;; Check cached compatibility result
      (ok (get compatible compatibility-data))
    ;; If no explicit rule, compute compatibility dynamically
    (compute-tier-compatibility buyer-tier provider-tier)
  )
)

;; Compute tier compatibility dynamically based on tier parameters
(define-private (compute-tier-compatibility 
    (buyer-tier (string-ascii 32)) 
    (provider-tier (string-ascii 32))
  )
  (let ((params-contract (var-get parameters-contract-principal)))
    (match params-contract 
      params-contract-some
        (begin
          ;; Get buyer tier parameters
          (match (contract-call? params-contract-some get-risk-tier-parameters buyer-tier)
            buyer-tier-params-opt
              (if (is-some buyer-tier-params-opt)
                (let ((buyer-tier-params (unwrap-panic buyer-tier-params-opt)))
                  ;; Get provider tier parameters
                  (match (contract-call? params-contract-some get-risk-tier-parameters provider-tier)
                    provider-tier-params-opt
                      (if (is-some provider-tier-params-opt)
                        (let ((provider-tier-params (unwrap-panic provider-tier-params-opt)))
                          ;; Check if both tiers are active
                          (if (and (get is-active buyer-tier-params) (get is-active provider-tier-params))
                            ;; Verify tier type - buyer should be "BUYER" and provider should be "PROVIDER"
                            (if (and (is-eq (get tier-type buyer-tier-params) "BUYER")
                                    (is-eq (get tier-type provider-tier-params) "PROVIDER"))
                              ;; Determine compatibility based on tier requirements
                              (let ((buyer-tier-protection-level (get protection-level-basis-points buyer-tier-params))
                                    (provider-tier-risk-tolerance (get risk-tolerance-basis-points provider-tier-params)))
                                ;; Provider risk tolerance must be >= buyer protection level for compatibility
                                (let ((compatible (>= provider-tier-risk-tolerance buyer-tier-protection-level)))
                                  ;; Cache compatibility result
                                  (map-set tier-compatibility 
                                    { buyer-tier: buyer-tier, provider-tier: provider-tier }
                                    { compatible: compatible }
                                  )
                                  (ok compatible)
                                )
                              )
                              (ok false) ;; Incompatible tier types
                            )
                            (ok false) ;; One or both tiers inactive
                          )
                        )
                        (ok false) ;; Provider tier not found
                      )
                    (err ERR-TIER-PARAMS-FETCH-FAILED)
                  )
                )
                (ok false) ;; Buyer tier not found
              )
            (err ERR-TIER-PARAMS-FETCH-FAILED)
          )
        )
      (err ERR-PARAMS-PRINCIPAL-NOT-SET)
    )
  )
)

;; --- Enhanced get-provider-tier-for-buyer-tier (LP-301) ---
(define-public (get-provider-tier-for-buyer-tier 
    (buyer-tier (string-ascii 32))
  )
  ;; Check parameters contract for tier mapping
  (let ((params-contract (var-get parameters-contract-principal)))
    (match params-contract
      params-contract-some
        ;; Try to get tier mapping from parameters
        (match (contract-call? params-contract-some get-buyer-to-provider-tier-mapping buyer-tier)
          mapping-result-ok
            mapping-result-ok ;; Return the mapping
          ;; If no mapping found, use hardcoded fallback rules
          (fallback-get-provider-tier-for-buyer-tier buyer-tier)
        )
      ;; If no parameters contract, use hardcoded fallback rules
      (fallback-get-provider-tier-for-buyer-tier buyer-tier)
    )
  )
)

;; Fallback mapping in case parameters contract is unavailable or doesn't have the mapping
(define-private (fallback-get-provider-tier-for-buyer-tier 
    (buyer-tier (string-ascii 32))
  )
  (cond
    ((is-eq buyer-tier "ProtectivePeter-Conservative") (ok "IncomeIrene-Conservative"))
    ((is-eq buyer-tier "ProtectivePeter-Standard") (ok "IncomeIrene-Balanced"))
    ((is-eq buyer-tier "ProtectivePeter-Flexible") (ok "IncomeIrene-Aggressive"))
    ((is-eq buyer-tier "ProtectivePeter-CrashInsurance") (ok "IncomeIrene-Balanced"))
    (else (err ERR-INVALID-RISK-TIER))
  )
)

;; --- Verification Integration (LP-309) ---
(define-public (verify-risk-tier-compatibility
    (buyer-tier (string-ascii 32))
    (provider-tier (string-ascii 32))
  )
  (match (var-get verification-contract-principal)
    verification-contract
      (contract-call? verification-contract run-risk-tier-compatibility-verification 
        buyer-tier provider-tier
      )
    (err ERR-VERIFICATION-CONTRACT-NOT-SET)
  )
)
