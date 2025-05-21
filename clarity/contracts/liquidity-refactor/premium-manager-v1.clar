;; premium-manager-v1.clar
;; Handles premium recording, distribution, and management

(impl-trait .premium-manager-trait.premium-manager-trait)

;; --- Constants ---

;; Error codes
(define-constant ERR-UNAUTHORIZED (err u6001))
(define-constant ERR-POLICY-NOT-FOUND (err u6002))
(define-constant ERR-PREMIUM-ALREADY-RECORDED (err u6003))
(define-constant ERR-PREMIUM-ALREADY-DISTRIBUTED (err u6004))
(define-constant ERR-NOT-OTM-POLICY (err u6005))
(define-constant ERR-REGISTRY-ERROR (err u6006))
(define-constant ERR-NO-ELIGIBLE-PROVIDERS (err u6007))
(define-constant ERR-ALREADY-INITIALIZED (err u6008))

;; --- Data Structures ---

;; Policy premium records
(define-map policy-premium-records
  { policy-id: uint }
  {
    premium-amount: uint,
    token-id: (string-ascii 32),
    expiration-height: uint,
    is-distributed: bool,
    distribution-height: (optional uint),
    premium-recorded-height: uint
  }
)

;; Track total premium stats
(define-map premium-balances
  { token-id: (string-ascii 32) }
  {
    total-premiums-collected: uint,
    total-premiums-distributed-to-providers: uint
  }
)

;; --- Contract References ---
(define-data-var registry-principal (optional principal) none)
(define-data-var allocation-manager-principal (optional principal) none)
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

;; Set the allocation manager contract principal
(define-public (set-allocation-manager (allocation-manager principal))
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    (var-set allocation-manager-principal (some allocation-manager))
    (print {
      event: "allocation-manager-set",
      allocation-manager: allocation-manager,
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

;; --- Public Functions ---

;; Record premium payment for a policy
(define-public (record-premium-payment 
    (policy-id uint) 
    (premium-amount uint) 
    (token-id (string-ascii 32)) 
    (expiration-height uint) 
    (policy-owner principal)
  )
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    
    ;; Check if premium is already recorded for this policy
    (asserts!
      (is-none (map-get? policy-premium-records { policy-id: policy-id }))
      ERR-PREMIUM-ALREADY-RECORDED
    )
    
    ;; Update global premium balances
    (let ((prem-bal (default-to 
        {
          total-premiums-collected: u0,
          total-premiums-distributed-to-providers: u0
        }
        (map-get? premium-balances { token-id: token-id })
      )))
      
      (map-set premium-balances { token-id: token-id }
        {
          total-premiums-collected: (+ (get total-premiums-collected prem-bal) premium-amount),
          total-premiums-distributed-to-providers: (get total-premiums-distributed-to-providers prem-bal)
        }
      )
    )
    
    ;; Record premium details for this policy
    (map-set policy-premium-records { policy-id: policy-id } 
      {
        premium-amount: premium-amount,
        token-id: token-id,
        expiration-height: expiration-height,
        is-distributed: false,
        distribution-height: none,
        premium-recorded-height: burn-block-height
      }
    )
    
    ;; Distribute pending premium shares to providers
    (try! (allocate-premium-to-providers policy-id premium-amount token-id))
    
    (print {
      event: "premium-recorded-for-policy",
      policy-id: policy-id,
      policy-owner: policy-owner,
      amount: premium-amount,
      token-id: token-id,
      expiration-height: expiration-height,
      block-height: burn-block-height
    })
    
    (ok true)
  )
)

;; Distribute premium to providers for an OTM policy
(define-public (distribute-premium 
    (policy-id uint) 
    (token-id (string-ascii 32))
  )
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    
    ;; Verify policy premium was recorded
    (match (map-get? policy-premium-records { policy-id: policy-id })
      premium-record
        (begin
          ;; Verify premium wasn't already distributed
          (asserts! (not (get is-distributed premium-record))
            ERR-PREMIUM-ALREADY-DISTRIBUTED
          )
          
          (let (
              (premium-amount (get premium-amount premium-record))
              (premium-token (get token-id premium-record))
            )
            ;; Verify token matches
            (asserts! (is-eq premium-token token-id) ERR-POLICY-NOT-FOUND)
            
            ;; Find providers who contributed to this policy
            (match (var-get allocation-manager-principal)
              allocation-manager
                (match (contract-call? allocation-manager find-providers-for-policy policy-id)
                  provider-list
                    (if (> (len provider-list) u0)
                      (begin
                        ;; Convert pending premiums to earned premiums for each provider
                        (try! (convert-pending-to-earned provider-list policy-id token-id))
                        
                        ;; Update premium record to mark as distributed
                        (map-set policy-premium-records { policy-id: policy-id }
                          (merge premium-record {
                            is-distributed: true,
                            distribution-height: (some burn-block-height)
                          })
                        )
                        
                        ;; Update premium-balances map
                        (let ((prem-bal (unwrap-panic (map-get? premium-balances { token-id: token-id }))))
                          (map-set premium-balances { token-id: token-id }
                            {
                              total-premiums-collected: (get total-premiums-collected prem-bal),
                              total-premiums-distributed-to-providers: (+ (get total-premiums-distributed-to-providers prem-bal)
                                premium-amount
                              )
                            }
                          )
                        )
                        
                        (print {
                          event: "premium-distribution-completed",
                          policy-id: policy-id,
                          token-id: token-id,
                          premium-amount: premium-amount,
                          provider-count: (len provider-list),
                          block-height: burn-block-height
                        })
                        
                        (ok true)
                      )
                      (err ERR-NO-ELIGIBLE-PROVIDERS)
                    )
                  (err ERR-REGISTRY-ERROR)
                )
              (err ERR-REGISTRY-ERROR)
            )
          )
        )
      (err ERR-POLICY-NOT-FOUND)
    )
  )
)

;; Get premium distribution details
(define-public (get-premium-distribution (policy-id uint))
  (match (map-get? policy-premium-records { policy-id: policy-id })
    record (ok record)
    (err ERR-POLICY-NOT-FOUND)
  )
)

;; Get total distributed premiums for a token
(define-public (get-total-distributed-premiums (token-id (string-ascii 32)))
  (match (map-get? premium-balances { token-id: token-id })
    prem-bal (ok (get total-premiums-distributed-to-providers prem-bal))
    (ok u0)
  )
)

;; --- Private Helper Functions ---

;; Allocate premium to providers who contributed to a policy
(define-private (allocate-premium-to-providers 
    (policy-id uint) 
    (premium-amount uint) 
    (token-id (string-ascii 32))
  )
  (match (var-get allocation-manager-principal)
    allocation-manager
      (match (contract-call? allocation-manager find-providers-for-policy policy-id)
        provider-list
          (if (> (len provider-list) u0)
            ;; Get providers' allocation data to calculate premium shares
            (let ((provider-allocations (get-provider-allocations 
                provider-list policy-id allocation-manager
              )))
              
              ;; Calculate total allocation to determine proportional distribution
              (let ((total-allocated (calculate-total-allocation provider-allocations)))
                (if (> total-allocated u0)
                  ;; Distribute premium shares based on allocation ratio
                  (let ((distribution-result (distribute-premium-shares 
                      provider-list provider-allocations policy-id
                      premium-amount token-id total-allocated
                    )))
                    (ok true)
                  )
                  (err ERR-NO-ELIGIBLE-PROVIDERS)
                )
              )
            )
            (err ERR-NO-ELIGIBLE-PROVIDERS)
          )
        (err ERR-REGISTRY-ERROR)
      )
    (err ERR-REGISTRY-ERROR)
  )
)

;; Get allocations for a list of providers
(define-private (get-provider-allocations 
    (providers (list 20 principal)) 
    (policy-id uint) 
    (allocation-manager principal)
  )
  ;; Simplified implementation - in a real contract, this would
  ;; collect all providers' allocation data
  (list 
    {
      provider: (unwrap-panic (element-at? providers u0)),
      allocated-amount: u500,
      token-id: "STX"
    }
    {
      provider: (unwrap-panic (element-at? providers u1)),
      allocated-amount: u500,
      token-id: "STX"
    }
  )
)

;; Calculate total allocation for a policy
(define-private (calculate-total-allocation 
    (provider-allocations (list 20 {
      provider: principal,
      allocated-amount: uint,
      token-id: (string-ascii 32)
    }))
  )
  (fold +
    (map
      (lambda (alloc)
        (get allocated-amount alloc)
      )
      provider-allocations
    )
    u0
  )
)

;; Distribute premium shares to providers based on allocation ratio
(define-private (distribute-premium-shares 
    (providers (list 20 principal)) 
    (provider-allocations (list 20 {
      provider: principal,
      allocated-amount: uint,
      token-id: (string-ascii 32)
    }))
    (policy-id uint)
    (premium-amount uint)
    (token-id (string-ascii 32))
    (total-allocated uint)
  )
  (map
    (lambda (allocation)
      (let (
          (provider (get provider allocation))
          (provider-allocated (get allocated-amount allocation))
          (premium-share (/ (* provider-allocated premium-amount) total-allocated))
        )
        ;; Update provider's pending premium
        (match (var-get capital-manager-principal)
          capital-manager
            (try! (contract-call? capital-manager 
              update-provider-pending-premiums 
              provider token-id premium-share
            ))
          (err ERR-REGISTRY-ERROR)
        )
        
        (print {
          event: "premium-allocated-to-provider",
          provider: provider,
          policy-id: policy-id,
          premium-share: premium-share,
          token-id: token-id,
          block-height: burn-block-height
        })
        
        premium-share
      )
    )
    provider-allocations
  )
)

;; Convert pending premiums to earned premiums for providers
(define-private (convert-pending-to-earned 
    (providers (list 20 principal)) 
    (policy-id uint) 
    (token-id (string-ascii 32))
  )
  (match (var-get capital-manager-principal)
    capital-manager
      ;; Simplified implementation - in a real contract, this would
      ;; calculate each provider's share and update their balances
      (begin
        (map
          (lambda (provider)
            ;; Get provider's pending premium for this policy
            ;; In a real implementation, this would be based on allocation ratio
            (let ((pending-premium u50))
              ;; Update provider's earned premiums
              (try! (contract-call? capital-manager 
                update-provider-earned-premiums 
                provider token-id pending-premium
              ))
              
              (print {
                event: "premium-converted-to-earned",
                provider: provider,
                policy-id: policy-id,
                token-id: token-id,
                amount: pending-premium,
                block-height: burn-block-height
              })
            )
          )
          providers
        )
        
        (ok true)
      )
    (err ERR-REGISTRY-ERROR)
  )
)

;; --- Admin Functions ---

;; Force mark a premium as distributed
(define-public (force-mark-premium-distributed (policy-id uint))
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    
    (match (map-get? policy-premium-records { policy-id: policy-id })
      premium-record
        (if (not (get is-distributed premium-record))
          (begin
            (map-set policy-premium-records { policy-id: policy-id }
              (merge premium-record {
                is-distributed: true,
                distribution-height: (some burn-block-height)
              })
            )
            
            (print {
              event: "premium-force-marked-as-distributed",
              policy-id: policy-id,
              token-id: (get token-id premium-record),
              block-height: burn-block-height
            })
            
            (ok true)
          )
          (ok true) ;; Already marked as distributed
        )
      (err ERR-POLICY-NOT-FOUND)
    )
  )
)
