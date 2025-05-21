;; allocation-manager-v1.clar
;; Handles capital allocation for policies and provider selection

(impl-trait .allocation-trait.allocation-trait)

;; --- Constants ---

;; Error codes
(define-constant ERR-UNAUTHORIZED (err u4001))
(define-constant ERR-POLICY-NOT-FOUND (err u4002))
(define-constant ERR-INSUFFICIENT-LIQUIDITY (err u4003))
(define-constant ERR-NO-ELIGIBLE-PROVIDERS (err u4004))
(define-constant ERR-ALLOCATION-FAILED (err u4005))
(define-constant ERR-PROVIDER-NOT-FOUND (err u4006))
(define-constant ERR-INVALID-TOKEN (err u4007))
(define-constant ERR-REGISTRY-ERROR (err u4008))
(define-constant ERR-MAX-EXPOSURE-EXCEEDED (err u4009))
(define-constant ERR-NO-ALLOCATIONS-FOUND (err u4010))
(define-constant ERR-POLICY-ALREADY-SETTLED (err u4011))
(define-constant ERR-ALREADY-INITIALIZED (err u4012))

;; --- Data Structures ---

;; Stores provider allocations to specific policies
(define-map provider-allocations
  {
    provider: principal,
    policy-id: uint
  }
  {
    token-id: (string-ascii 32),
    allocated-amount: uint,
    risk-tier: (string-ascii 32),
    expiration-height: uint
  }
)

;; Tracks provider exposure at each expiration height
(define-map provider-exposures
  {
    provider: principal,
    token-id: (string-ascii 32),
    expiration-height: uint
  }
  {
    exposure-amount: uint
  }
)

;; Tracks the total collateral needed for all policies at a specific expiration height
(define-map expiration-liquidity-needs
  uint ;; expiration-height
  {
    total-collateral-required: uint,
    is-liquidity-prepared: bool,
    token-distributions: (map (string-ascii 32) uint), ;; Map of token-id to amount required
    policy-count: uint,
    risk-tier-distribution: (map (string-ascii 32) (map (string-ascii 32) uint))
  }
)

;; --- Contract References ---
(define-data-var registry-principal (optional principal) none)
(define-data-var risk-manager-principal (optional principal) none)
(define-data-var capital-manager-principal (optional principal) none)
(define-data-var parameters-contract-principal (optional principal) none)

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

;; Set the risk manager contract principal
(define-public (set-risk-manager (risk-manager principal))
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    (var-set risk-manager-principal (some risk-manager))
    (print {
      event: "risk-manager-set",
      risk-manager: risk-manager,
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

;; --- Public Functions ---

;; Find eligible providers for a policy
(define-public (get-eligible-providers 
    (token-id (string-ascii 32)) 
    (risk-tier (string-ascii 32)) 
    (required-amount uint) 
    (expiration-height uint)
  )
  ;; Simplified implementation - in a real contract, this would query
  ;; provider data and apply complex filtering logic
  (ok (list tx-sender 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM))
)

;; Allocate capital from providers to a policy
(define-public (allocate-capital 
    (policy-id uint) 
    (required-collateral uint) 
    (token-id (string-ascii 32)) 
    (risk-tier (string-ascii 32)) 
    (expiration-height uint) 
    (policy-owner principal)
  )
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    
    ;; Find eligible providers
    (match (get-eligible-providers token-id risk-tier required-collateral expiration-height)
      eligible-providers
        (if (> (len eligible-providers) u0)
          ;; Allocate capital from providers
          (match (allocate-from-providers 
            policy-id eligible-providers required-collateral 
            token-id risk-tier expiration-height
          )
            allocation-result
              (begin
                ;; Update expiration tracking
                (try! (update-expiration-tracking 
                  expiration-height required-collateral token-id risk-tier
                ))
                
                ;; Update total locked balances in the capital manager
                (match (var-get capital-manager-principal)
                  capital-manager
                    (try! (contract-call? capital-manager 
                      update-token-allocation token-id required-collateral
                    ))
                  (err ERR-REGISTRY-ERROR)
                )
                
                (print {
                  event: "capital-allocated",
                  policy-id: policy-id,
                  required-collateral: required-collateral,
                  token-id: token-id,
                  expiration-height: expiration-height,
                  providers-count: (len eligible-providers),
                  block-height: burn-block-height
                })
                
                (ok true)
              )
            (err ERR-ALLOCATION-FAILED)
          )
          (err ERR-NO-ELIGIBLE-PROVIDERS)
        )
      (err ERR-REGISTRY-ERROR)
    )
  )
)

;; Lock collateral for a policy (called by the facade/policy registry)
(define-public (lock-collateral 
    (policy-id uint) 
    (collateral-amount uint) 
    (token-id (string-ascii 32)) 
    (risk-tier (string-ascii 32)) 
    (expiration-height uint) 
    (policy-owner-principal principal)
  )
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    
    ;; Allocate capital for the policy
    (try! (allocate-capital 
      policy-id collateral-amount token-id risk-tier 
      expiration-height policy-owner-principal
    ))
    
    (print {
      event: "collateral-locked",
      policy-id: policy-id,
      amount: collateral-amount,
      token-id: token-id,
      risk-tier: risk-tier,
      expiration-height: expiration-height,
      policy-owner: policy-owner-principal,
      block-height: burn-block-height
    })
    
    (ok true)
  )
)

;; Release collateral for a policy
(define-public (release-collateral 
    (policy-id uint) 
    (token-id (string-ascii 32)) 
    (expiration-height uint)
  )
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    
    ;; Ensure this policy hasn't already been settled
    ;; In a real implementation, we'd check against a settlement record
    
    ;; Find providers who allocated to this policy
    (let ((providers-with-allocations (find-providers-for-policy policy-id)))
      ;; Ensure we found at least one provider with an allocation
      (asserts! (> (len providers-with-allocations) u0) ERR-NO-ALLOCATIONS-FOUND)
      
      ;; Calculate total allocated amount
      (let ((total-allocated-amount (calculate-total-allocation-for-policy 
          providers-with-allocations policy-id
        )))
        
        ;; Process release for each provider
        (let ((released-amount (release-collateral-for-providers 
            providers-with-allocations policy-id token-id expiration-height
          )))
          
          ;; Update tracking data
          (try! (reduce-expiration-tracking 
            expiration-height released-amount token-id
          ))
          
          ;; Update capital manager balances
          (match (var-get capital-manager-principal)
            capital-manager
              (try! (contract-call? capital-manager 
                update-token-allocation token-id (to-int (* -1 released-amount))
              ))
            (err ERR-REGISTRY-ERROR)
          )
          
          (print {
            event: "collateral-released",
            policy-id: policy-id,
            token-id: token-id,
            released-amount: released-amount,
            expiration-height: expiration-height,
            provider-count: (len providers-with-allocations),
            block-height: burn-block-height
          })
          
          (ok released-amount)
        )
      )
    )
  )
)

;; Get provider allocation for a policy
(define-public (get-provider-allocation 
    (provider principal) 
    (policy-id uint)
  )
  (match (map-get? provider-allocations { provider: provider, policy-id: policy-id })
    allocation (ok allocation)
    (err ERR-PROVIDER-NOT-FOUND)
  )
)

;; Get provider exposure at a specific expiration height
(define-public (get-provider-exposure-at-height 
    (provider principal) 
    (token-id (string-ascii 32)) 
    (expiration-height uint)
  )
  (match (map-get? provider-exposures 
    { provider: provider, token-id: token-id, expiration-height: expiration-height }
  )
    exposure (ok (get exposure-amount exposure))
    (ok u0) ;; Default to 0 if no exposure record found
  )
)

;; Get total collateral required at an expiration height
(define-public (get-expiration-collateral-required (expiration-height uint))
  (match (map-get? expiration-liquidity-needs expiration-height)
    needs (ok (get total-collateral-required needs))
    (ok u0) ;; Default to 0 if no record found
  )
)

;; --- Private Helper Functions ---

;; Allocate from a list of providers
(define-private (allocate-from-providers 
    (policy-id uint) 
    (providers (list 20 principal)) 
    (total-required uint) 
    (token-id (string-ascii 32)) 
    (risk-tier (string-ascii 32)) 
    (expiration-height uint)
  )
  ;; For simplicity, allocate evenly among providers
  (let ((provider-count (len providers))
        (allocation-per-provider (/ total-required provider-count)))
    
    (ok (map 
      (lambda (provider)
        (try! (allocate-to-provider 
          provider policy-id allocation-per-provider 
          token-id risk-tier expiration-height
        ))
        allocation-per-provider
      )
      providers
    ))
  )
)

;; Allocate capital from a single provider
(define-private (allocate-to-provider 
    (provider principal) 
    (policy-id uint) 
    (allocation-amount uint) 
    (token-id (string-ascii 32)) 
    (risk-tier (string-ascii 32)) 
    (expiration-height uint)
  )
  (begin
    ;; Record the allocation in provider-allocations
    (map-set provider-allocations 
      { provider: provider, policy-id: policy-id }
      {
        token-id: token-id,
        allocated-amount: allocation-amount,
        risk-tier: risk-tier,
        expiration-height: expiration-height
      }
    )
    
    ;; Update provider's exposure for this expiration height
    (try! (add-provider-exposure 
      provider token-id expiration-height allocation-amount
    ))
    
    ;; Update provider balances in capital manager
    (match (var-get capital-manager-principal)
      capital-manager
        (try! (contract-call? capital-manager 
          update-provider-allocation provider token-id allocation-amount
        ))
      (err ERR-REGISTRY-ERROR)
    )
    
    (print {
      event: "provider-allocation",
      provider: provider,
      policy-id: policy-id,
      allocation-amount: allocation-amount,
      token-id: token-id,
      risk-tier: risk-tier,
      expiration-height: expiration-height,
      block-height: burn-block-height
    })
    
    (ok allocation-amount)
  )
)

;; Add exposure to a provider at a specific expiration height
(define-private (add-provider-exposure 
    (provider principal) 
    (token-id (string-ascii 32)) 
    (expiration-height uint) 
    (amount uint)
  )
  (let ((exposure-key 
      { provider: provider, token-id: token-id, expiration-height: expiration-height }
    ))
    (let ((current-exposure (default-to 
        { exposure-amount: u0 }
        (map-get? provider-exposures exposure-key)
      )))
      
      (let ((new-exposure (+ (get exposure-amount current-exposure) amount)))
        ;; In a real implementation, check exposure limits here
        ;; For simplicity, always allow
        
        ;; Update exposure
        (map-set provider-exposures exposure-key
          { exposure-amount: new-exposure }
        )
        
        (print {
          event: "provider-exposure-added",
          provider: provider,
          token-id: token-id,
          expiration-height: expiration-height,
          amount: amount,
          new-total: new-exposure,
          block-height: burn-block-height
        })
        
        (ok true)
      )
    )
  )
)

;; Reduce exposure for a provider at a specific expiration height
(define-private (reduce-provider-exposure 
    (provider principal) 
    (token-id (string-ascii 32)) 
    (expiration-height uint) 
    (amount uint)
  )
  (let ((exposure-key 
      { provider: provider, token-id: token-id, expiration-height: expiration-height }
    ))
    (let ((current-exposure (default-to 
        { exposure-amount: u0 }
        (map-get? provider-exposures exposure-key)
      )))
      
      (let ((new-exposure (if (> (get exposure-amount current-exposure) amount)
        (- (get exposure-amount current-exposure) amount)
        u0 ;; Prevent underflow
      )))
        ;; Update exposure
        (map-set provider-exposures exposure-key
          { exposure-amount: new-exposure }
        )
        
        (print {
          event: "provider-exposure-reduced",
          provider: provider,
          token-id: token-id,
          expiration-height: expiration-height,
          amount: amount,
          new-total: new-exposure,
          block-height: burn-block-height
        })
        
        (ok true)
      )
    )
  )
)

;; Update expiration tracking data
(define-private (update-expiration-tracking 
    (expiration-height uint) 
    (collateral-amount uint) 
    (token-id (string-ascii 32))
    (risk-tier (string-ascii 32))
  )
  (let ((expiration-needs (default-to 
      {
        total-collateral-required: u0,
        is-liquidity-prepared: false,
        token-distributions: (map),
        policy-count: u0,
        risk-tier-distribution: (map)
      }
      (map-get? expiration-liquidity-needs expiration-height)
    )))
    
    (let ((current-token-amount (default-to u0
        (map-get? (get token-distributions expiration-needs) token-id)
      )))
      
      (let ((updated-token-distributions (merge 
          (get token-distributions expiration-needs) 
          { (token-id): (+ current-token-amount collateral-amount) }
        )))
        
        ;; Update risk tier distribution
        (let ((risk-tier-map (default-to (map)
            (map-get? (get risk-tier-distribution expiration-needs) token-id)
          )))
          
          (let ((tier-amount (default-to u0
              (map-get? risk-tier-map risk-tier)
            )))
            
            (let ((updated-tier-map (merge 
                risk-tier-map 
                { (risk-tier): (+ tier-amount collateral-amount) }
              )))
              
              (let ((updated-risk-tier-distribution (merge 
                  (get risk-tier-distribution expiration-needs) 
                  { (token-id): updated-tier-map }
                )))
                
                (map-set expiration-liquidity-needs expiration-height
                  {
                    total-collateral-required: (+ (get total-collateral-required expiration-needs) 
                      collateral-amount
                    ),
                    is-liquidity-prepared: (get is-liquidity-prepared expiration-needs),
                    token-distributions: updated-token-distributions,
                    policy-count: (+ (get policy-count expiration-needs) u1),
                    risk-tier-distribution: updated-risk-tier-distribution
                  }
                )
                
                (ok true)
              )
            )
          )
        )
      )
    )
  )
)

;; Reduce expiration tracking data
(define-private (reduce-expiration-tracking 
    (expiration-height uint) 
    (collateral-amount uint) 
    (token-id (string-ascii 32))
  )
  (match (map-get? expiration-liquidity-needs expiration-height)
    expiration-needs
      (let ((current-token-amount (default-to u0
          (map-get? (get token-distributions expiration-needs) token-id)
        )))
        
        (let ((updated-token-distributions (merge 
            (get token-distributions expiration-needs) 
            { (token-id): (if (> current-token-amount collateral-amount)
              (- current-token-amount collateral-amount)
              u0
            )}
          )))
          
          (map-set expiration-liquidity-needs expiration-height
            {
              total-collateral-required: (if (> (get total-collateral-required expiration-needs) 
                collateral-amount)
                (- (get total-collateral-required expiration-needs) collateral-amount)
                u0
              ),
              is-liquidity-prepared: (get is-liquidity-prepared expiration-needs),
              token-distributions: updated-token-distributions,
              policy-count: (if (> (get policy-count expiration-needs) u0)
                (- (get policy-count expiration-needs) u1)
                u0
              ),
              risk-tier-distribution: (get risk-tier-distribution expiration-needs)
            }
          )
          
          (ok true)
        )
      )
    (ok true) ;; Nothing to reduce if no record exists
  )
)

;; Find providers who allocated to a policy
(define-private (find-providers-for-policy (policy-id uint))
  ;; Simplified implementation - in a real contract, this would query
  ;; provider-allocations to find all providers for a policy
  (list tx-sender 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)
)

;; Calculate total allocation for a policy
(define-private (calculate-total-allocation-for-policy 
    (providers (list 20 principal)) 
    (policy-id uint)
  )
  ;; Simplified implementation
  u1000
)

;; Release collateral for all providers of a policy
(define-private (release-collateral-for-providers 
    (providers (list 20 principal)) 
    (policy-id uint) 
    (token-id (string-ascii 32)) 
    (expiration-height uint)
  )
  ;; Simplified implementation
  (let ((total-released u0))
    (fold + 
      (map 
        (lambda (provider)
          (match (release-provider-collateral 
            provider policy-id token-id expiration-height
          )
            released-amount released-amount
            u0
          )
        )
        providers
      )
      u0
    )
  )
)

;; Release a single provider's allocation
(define-private (release-provider-collateral 
    (provider principal) 
    (policy-id uint) 
    (token-id (string-ascii 32)) 
    (expiration-height uint)
  )
  (match (map-get? provider-allocations 
    { provider: provider, policy-id: policy-id }
  )
    allocation
      (let ((allocated-amount (get allocated-amount allocation)))
        ;; Update provider exposure
        (try! (reduce-provider-exposure 
          provider token-id expiration-height allocated-amount
        ))
        
        ;; Update provider balance in capital manager
        (match (var-get capital-manager-principal)
          capital-manager
            (try! (contract-call? capital-manager 
              update-provider-allocation 
              provider token-id (to-int (* -1 allocated-amount))
            ))
          (err ERR-REGISTRY-ERROR)
        )
        
        ;; Delete the allocation record
        (map-delete provider-allocations 
          { provider: provider, policy-id: policy-id }
        )
        
        (print {
          event: "provider-allocation-released",
          provider: provider,
          policy-id: policy-id,
          released-amount: allocated-amount,
          token-id: token-id,
          expiration-height: expiration-height,
          block-height: burn-block-height
        })
        
        (ok allocated-amount)
      )
    (ok u0) ;; No allocation found
  )
)

;; --- Admin Functions ---

;; Prepare liquidity for upcoming expirations
(define-public (prepare-liquidity-for-expiration (expiration-height uint))
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    
    (match (map-get? expiration-liquidity-needs expiration-height)
      expiration-needs
        (begin
          (map-set expiration-liquidity-needs expiration-height
            (merge expiration-needs { is-liquidity-prepared: true })
          )
          
          (print {
            event: "liquidity-prepared-for-expiration",
            expiration-height: expiration-height,
            block-height: burn-block-height
          })
          
          (ok true)
        )
      ;; If no record exists, create one with prepared flag
      (begin
        (map-set expiration-liquidity-needs expiration-height
          {
            total-collateral-required: u0,
            is-liquidity-prepared: true,
            token-distributions: (map),
            policy-count: u0,
            risk-tier-distribution: (map)
          }
        )
        
        (print {
          event: "liquidity-prepared-for-expiration-empty",
          expiration-height: expiration-height,
          block-height: burn-block-height
        })
        
        (ok true)
      )
    )
  )
)
