;; risk-manager-v1.clar
;; Handles risk assessment and tier compatibility

(impl-trait .risk-assessor-trait.risk-assessor-trait)

;; --- Constants ---

;; Import constants from base contract
(define-constant ONE_8 u100000000) 
(define-constant BASIS_POINTS_DENOMINATOR u10000) ;; 10000 basis points = 100%

;; Risk Tier Constants
(define-constant RISK-TIER-CONSERVATIVE "conservative")
(define-constant RISK-TIER-BALANCED "balanced")
(define-constant RISK-TIER-AGGRESSIVE "aggressive")

;; Buyer Tier Constants
(define-constant BUYER-TIER-CONSERVATIVE "ProtectivePeter-Conservative")
(define-constant BUYER-TIER-STANDARD "ProtectivePeter-Standard")
(define-constant BUYER-TIER-FLEXIBLE "ProtectivePeter-Flexible")
(define-constant BUYER-TIER-CRASH "ProtectivePeter-CrashInsurance")

;; Provider Tier Constants
(define-constant PROVIDER-TIER-CONSERVATIVE "IncomeIrene-Conservative")
(define-constant PROVIDER-TIER-BALANCED "IncomeIrene-Balanced")
(define-constant PROVIDER-TIER-AGGRESSIVE "IncomeIrene-Aggressive")

;; Error codes
(define-constant ERR-UNAUTHORIZED (err u3001))
(define-constant ERR-INVALID-RISK-TIER (err u3002))
(define-constant ERR-TIER-NOT-ACTIVE (err u3003))
(define-constant ERR-INSUFFICIENT-LIQUIDITY (err u3004))
(define-constant ERR-INVALID-COLLATERAL-RATIO (err u3005))
(define-constant ERR-REGISTRY-ERROR (err u3006))
(define-constant ERR-PARAMS-PRINCIPAL-NOT-SET (err u3007))
(define-constant ERR-ALREADY-INITIALIZED (err u3008))

;; --- Data Structures ---

;; Store tier compatibility rules for efficient lookup
(define-map tier-compatibility
  { buyer-tier: (string-ascii 32), provider-tier: (string-ascii 32) }
  { compatible: bool }
)

;; Cache for tier parameters to reduce external calls
(define-map tier-parameter-cache
  { tier-name: (string-ascii 32) }
  {
    collateral-ratio-bp: uint,
    premium-adjustment-bp: uint,
    max-exposure-percentage: uint,
    is-active: bool,
    last-updated: uint
  }
)

;; --- Contract References ---
(define-data-var registry-principal (optional principal) none)
(define-data-var parameters-contract-principal (optional principal) none)
(define-data-var capital-manager-principal (optional principal) none)

;; --- Authentication ---

;; Check authorization from registry
(define-private (is-authorized)
  (match (var-get registry-principal)
    registry-some (contract-call? registry-some is-authorized tx-sender)
    false
  )
)

;; --- Initialization ---

;; Set the registry principal - can only be done once
(define-public (set-registry (registry principal))
  (begin
    (asserts! (is-none (var-get registry-principal)) ERR-ALREADY-INITIALIZED)
    (var-set registry-principal (some registry))
    (print {
      event: "registry-set",
      registry: registry,
      block-height: burn-block-height
    })
    (ok true)
  )
)

;; Set the parameters contract principal
(define-public (set-parameters-contract (parameters-contract principal))
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    (var-set parameters-contract-principal (some parameters-contract))
    (print {
      event: "parameters-contract-set",
      parameters-contract: parameters-contract,
      block-height: burn-block-height
    })
    (ok true)
  )
)

;; Set the capital manager contract principal
(define-public (set-capital-manager (capital-manager principal))
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    (var-set capital-manager-principal (some capital-manager))
    (print {
      event: "capital-manager-set",
      capital-manager: capital-manager,
      block-height: burn-block-height
    })
    (ok true)
  )
)

;; Initialize tier compatibility map - called during contract deployment/setup
(define-public (initialize-tier-compatibility)
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    
    ;; Conservative buyer can only work with conservative providers
    (map-set tier-compatibility 
      { buyer-tier: BUYER-TIER-CONSERVATIVE, provider-tier: PROVIDER-TIER-CONSERVATIVE }
      { compatible: true }
    )
    (map-set tier-compatibility 
      { buyer-tier: BUYER-TIER-CONSERVATIVE, provider-tier: PROVIDER-TIER-BALANCED }
      { compatible: false }
    )
    (map-set tier-compatibility 
      { buyer-tier: BUYER-TIER-CONSERVATIVE, provider-tier: PROVIDER-TIER-AGGRESSIVE }
      { compatible: false }
    )
    
    ;; Standard buyer can work with conservative and balanced providers
    (map-set tier-compatibility 
      { buyer-tier: BUYER-TIER-STANDARD, provider-tier: PROVIDER-TIER-CONSERVATIVE }
      { compatible: true }
    )
    (map-set tier-compatibility 
      { buyer-tier: BUYER-TIER-STANDARD, provider-tier: PROVIDER-TIER-BALANCED }
      { compatible: true }
    )
    (map-set tier-compatibility 
      { buyer-tier: BUYER-TIER-STANDARD, provider-tier: PROVIDER-TIER-AGGRESSIVE }
      { compatible: false }
    )
    
    ;; Flexible buyer can work with balanced and aggressive providers
    (map-set tier-compatibility 
      { buyer-tier: BUYER-TIER-FLEXIBLE, provider-tier: PROVIDER-TIER-CONSERVATIVE }
      { compatible: false }
    )
    (map-set tier-compatibility 
      { buyer-tier: BUYER-TIER-FLEXIBLE, provider-tier: PROVIDER-TIER-BALANCED }
      { compatible: true }
    )
    (map-set tier-compatibility 
      { buyer-tier: BUYER-TIER-FLEXIBLE, provider-tier: PROVIDER-TIER-AGGRESSIVE }
      { compatible: true }
    )
    
    ;; Crash Insurance buyer can work with any provider
    (map-set tier-compatibility 
      { buyer-tier: BUYER-TIER-CRASH, provider-tier: PROVIDER-TIER-CONSERVATIVE }
      { compatible: true }
    )
    (map-set tier-compatibility 
      { buyer-tier: BUYER-TIER-CRASH, provider-tier: PROVIDER-TIER-BALANCED }
      { compatible: true }
    )
    (map-set tier-compatibility 
      { buyer-tier: BUYER-TIER-CRASH, provider-tier: PROVIDER-TIER-AGGRESSIVE }
      { compatible: true }
    )
    
    (print {
      event: "tier-compatibility-initialized",
      block-height: burn-block-height
    })
    
    (ok true)
  )
)

;; --- Public Functions ---

;; Check if a provider tier is compatible with a buyer tier
(define-public (is-tier-compatible (buyer-tier (string-ascii 32)) (provider-tier (string-ascii 32)))
  (match (map-get? tier-compatibility { buyer-tier: buyer-tier, provider-tier: provider-tier })
    compatibility-data (ok (get compatible compatibility-data))
    (ok false) ;; Default to incompatible if no explicit rule is found
  )
)

;; Get collateral ratio for a risk tier
(define-public (get-tier-collateral-ratio (tier-name (string-ascii 32)))
  (let ((tier-data (get-tier-parameters-from-cache tier-name)))
    (match tier-data
      tier-some (ok (get collateral-ratio-bp (unwrap-panic tier-some)))
      (err ERR-INVALID-RISK-TIER)
    )
  )
)

;; Check if a risk tier is active
(define-public (is-tier-active (tier-name (string-ascii 32)))
  (let ((tier-data (get-tier-parameters-from-cache tier-name)))
    (match tier-data
      tier-some (ok (get is-active (unwrap-panic tier-some)))
      (err ERR-INVALID-RISK-TIER)
    )
  )
)

;; Get maximum exposure percentage for a provider
(define-public (get-max-exposure-percentage (tier-name (string-ascii 32)))
  (let ((tier-data (get-tier-parameters-from-cache tier-name)))
    (match tier-data
      tier-some (ok (get max-exposure-percentage (unwrap-panic tier-some)))
      (err ERR-INVALID-RISK-TIER)
    )
  )
)

;; Calculate required collateral for a protection amount
(define-public (calculate-required-collateral 
    (protection-amount uint) 
    (token-id (string-ascii 32)) 
    (risk-tier (string-ascii 32))
  )
  (let ((tier-data (get-tier-parameters-from-cache risk-tier)))
    (match tier-data
      tier-some 
        (let ((tier-params (unwrap-panic tier-some)))
          (if (get is-active tier-params)
            (let ((collateral-ratio-bp (get collateral-ratio-bp tier-params)))
              (if (> collateral-ratio-bp u0)
                (ok (/ (* protection-amount collateral-ratio-bp) BASIS_POINTS_DENOMINATOR))
                (err ERR-INVALID-COLLATERAL-RATIO)
              )
            )
            (err ERR-TIER-NOT-ACTIVE)
          )
        )
      (err ERR-INVALID-RISK-TIER)
    )
  )
)

;; Check exposure limits for a provider
(define-public (check-exposure-limits 
    (provider principal) 
    (token-id (string-ascii 32)) 
    (allocation-amount uint) 
    (expiration-height uint)
  )
  (ok true) ;; Simplified implementation
)

;; Map buyer tier to provider tier
(define-public (get-provider-tier-for-buyer-tier (buyer-tier (string-ascii 32)))
  (cond
    ((is-eq buyer-tier BUYER-TIER-CONSERVATIVE) (ok PROVIDER-TIER-CONSERVATIVE))
    ((is-eq buyer-tier BUYER-TIER-STANDARD) (ok PROVIDER-TIER-BALANCED))
    ((is-eq buyer-tier BUYER-TIER-FLEXIBLE) (ok PROVIDER-TIER-AGGRESSIVE))
    ((is-eq buyer-tier BUYER-TIER-CRASH) (ok PROVIDER-TIER-BALANCED))
    (else (err ERR-INVALID-RISK-TIER))
  )
)

;; Check if there's enough liquidity for a policy
(define-public (check-liquidity 
    (protection-amount uint) 
    (token-id (string-ascii 32)) 
    (buyer-risk-tier (string-ascii 32)) 
    (expiration-height uint)
  )
  (match (var-get capital-manager-principal)
    capital-manager
      (match (calculate-required-collateral protection-amount token-id buyer-risk-tier)
        required-collateral
          (match (contract-call? capital-manager get-available-balance token-id)
            available-balance
              (if (>= available-balance required-collateral)
                (ok true)
                (err ERR-INSUFFICIENT-LIQUIDITY)
              )
            (err ERR-REGISTRY-ERROR)
          )
        (err ERR-INVALID-RISK-TIER)
      )
    (err ERR-REGISTRY-ERROR)
  )
)

;; --- Private Helper Functions ---

;; Get tier parameters from cache or parameters contract
(define-private (get-tier-parameters-from-cache (tier-name (string-ascii 32)))
  (let ((cache-entry (map-get? tier-parameter-cache { tier-name: tier-name })))
    (if (is-some cache-entry)
      cache-entry
      (refresh-tier-parameters-cache tier-name)
    )
  )
)

;; Refresh the tier parameters cache from the parameters contract
(define-private (refresh-tier-parameters-cache (tier-name (string-ascii 32)))
  (match (var-get parameters-contract-principal)
    params-principal
      (match (contract-call? params-principal get-risk-tier-parameters tier-name)
        params-data
          (let ((tier-data (unwrap-panic params-data)))
            (map-set tier-parameter-cache { tier-name: tier-name }
              {
                collateral-ratio-bp: (get collateral-ratio-basis-points tier-data),
                premium-adjustment-bp: (get premium-adjustment-basis-points tier-data),
                max-exposure-percentage: (get max-exposure-per-expiration-basis-points tier-data),
                is-active: (get is-active tier-data),
                last-updated: burn-block-height
              }
            )
            (some {
              collateral-ratio-bp: (get collateral-ratio-basis-points tier-data),
              premium-adjustment-bp: (get premium-adjustment-basis-points tier-data),
              max-exposure-percentage: (get max-exposure-per-expiration-basis-points tier-data),
              is-active: (get is-active tier-data),
              last-updated: burn-block-height
            })
          )
        none
      )
    none
  )
)

;; --- Admin Functions ---

;; Update tier compatibility rules
(define-public (update-tier-compatibility 
    (buyer-tier (string-ascii 32)) 
    (provider-tier (string-ascii 32)) 
    (is-compatible bool)
  )
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    (map-set tier-compatibility 
      { buyer-tier: buyer-tier, provider-tier: provider-tier }
      { compatible: is-compatible }
    )
    (print {
      event: "tier-compatibility-updated",
      buyer-tier: buyer-tier,
      provider-tier: provider-tier,
      compatible: is-compatible,
      block-height: burn-block-height
    })
    (ok true)
  )
)

;; Force refresh of tier parameters cache
(define-public (force-refresh-tier-parameters (tier-name (string-ascii 32)))
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    (match (refresh-tier-parameters-cache tier-name)
      refreshed-some (ok true)
      (err ERR-PARAMS-PRINCIPAL-NOT-SET)
    )
  )
)
