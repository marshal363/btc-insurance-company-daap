;; premium-manager-v1.clar
;; Enhanced implementation for LP-305 (Fair Premium Distribution) and LP-207 (Claim Earned Premiums)

;; --- Additional Error Constants ---
(define-constant ERR-PREMIUM-SHARE-CALCULATION-FAILED (err u6030))
(define-constant ERR-DISTRIBUTION-WEIGHT-CALCULATION-FAILED (err u6031))

;; --- Enhanced LP-207: Claim Earned Premiums Function ---
(define-public (claim-earned-premiums (token-id (string-ascii 32)))
  (let (
      (provider tx-sender)
      (provider-key {
        provider: provider,
        token-id: token-id,
      })
    )
    ;; Get capital manager to verify provider balances
    (match (var-get capital-manager-principal)
      capital-manager-some
        (let ((capital-manager (unwrap-panic capital-manager-some)))
          ;; Get provider balance from capital manager
          (match (contract-call? capital-manager get-provider-balance provider token-id)
            provider-bal-ok
              (let ((provider-bal (unwrap-panic provider-bal-ok)))
                ;; Verify token is initialized
                (asserts! (contract-call? capital-manager is-token-initialized token-id) ERR-TOKEN-NOT-INITIALIZED)
                
                ;; Check if provider has any earned premiums to claim
                (let ((earned-amount (get earned-premiums provider-bal)))
                  (asserts! (> earned-amount u0) ERR-NO-PREMIUMS-TO-CLAIM)
                  
                  ;; Transfer earned premiums to the provider
                  (if (is-eq token-id "STX")
                    ;; For STX token
                    (try! (as-contract (stx-transfer? earned-amount tx-sender provider)))
                    ;; For SIP-010 tokens
                    (match (contract-call? capital-manager get-token-principal token-id)
                      token-principal-ok
                        (let ((token-principal (unwrap-panic token-principal-ok)))
                          (try! (as-contract (contract-call? token-principal
                            transfer earned-amount tx-sender provider none
                          )))
                        )
                      (err ERR-TOKEN-NOT-INITIALIZED)
                    )
                  )
                  
                  ;; Update provider's earned-premiums to 0 via capital manager
                  (try! (contract-call? capital-manager update-provider-earned-premiums 
                    provider token-id (to-int (* -1 earned-amount))
                  ))
                  
                  ;; Emit premium claimed event
                  (print {
                    event: "premiums-claimed",
                    block-height: burn-block-height,
                    provider: provider,
                    token-id: token-id,
                    claimed-amount: earned-amount
                  })
                  
                  (ok earned-amount)
                )
              )
            (err ERR-NOT-ENOUGH-BALANCE)
          )
        )
      (err ERR-CAPITAL-MANAGER-PRINCIPAL-NOT-SET)
    )
  )
)

;; --- LP-305: Fair Premium Distribution Implementation ---

;; Enhanced premium distribution function considering risk tiers and allocation amount
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
              (premium-expiration (get expiration-height premium-record))
            )
            ;; Verify token matches
            (asserts! (is-eq premium-token token-id) ERR-POLICY-NOT-FOUND)
            
            ;; Find providers who contributed to this policy with their allocations
            (match (var-get allocation-manager-principal)
              allocation-manager-some
                (let ((allocation-manager (unwrap-panic allocation-manager-some)))
                  (match (contract-call? allocation-manager get-policy-provider-allocations policy-id)
                    provider-allocations
                      (if (> (len provider-allocations) u0)
                        (begin
                          ;; Get risk parameters for premium distribution weighting
                          (match (var-get parameters-contract-principal)
                            params-contract-some
                              (let ((params-contract (unwrap-panic params-contract-some)))
                                ;; Calculate weighted premium distribution
                                (try! (distribute-premium-weighted 
                                  provider-allocations 
                                  policy-id 
                                  premium-amount 
                                  token-id 
                                  premium-expiration
                                  params-contract
                                ))
                                
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
                                  provider-count: (len provider-allocations),
                                  block-height: burn-block-height
                                })
                                
                                (ok true)
                              )
                            (err ERR-PARAMS-PRINCIPAL-NOT-SET)
                          )
                        )
                        (err ERR-NO-ELIGIBLE-PROVIDERS)
                      )
                    (err ERR-REGISTRY-ERROR)
                  )
                )
              (err ERR-ALLOCATION-MANAGER-PRINCIPAL-NOT-SET)
            )
          )
        )
      (err ERR-POLICY-NOT-FOUND)
    )
  )
)

;; New function for weighted premium distribution based on provider risk tiers and allocations
(define-private (distribute-premium-weighted
    (provider-allocations (list 20 {
      provider: principal,
      allocation: {
        token-id: (string-ascii 32),
        allocated-amount: uint,
        risk-tier: (string-ascii 32),
        expiration-height: uint
      }
    }))
    (policy-id uint)
    (premium-amount uint)
    (token-id (string-ascii 32))
    (expiration-height uint)
    (params-contract principal)
  )
  (begin
    ;; Calculate distribution weights for all providers
    (let ((distribution-weights (calculate-provider-distribution-weights 
        provider-allocations params-contract
      )))
      
      ;; Verify weights calculation succeeded
      (match distribution-weights
        weights-ok
          (let ((weights (unwrap-panic weights-ok)))
            ;; Calculate total weight
            (let ((total-weight (fold + weights u0)))
              ;; Distribute premium based on weights
              (map
                (lambda (provider-allocation weight-idx)
                  (let (
                      (provider (get provider provider-allocation))
                      (allocation (get allocation provider-allocation))
                      (weight (unwrap-panic (element-at? weights weight-idx)))
                      ;; Calculate premium share proportional to weight
                      (premium-share (if (> total-weight u0)
                        (/ (* premium-amount weight) total-weight)
                        ;; If total weight is 0 (unexpected), distribute equally
                        (/ premium-amount (len provider-allocations))
                      ))
                    )
                    ;; Update provider's earned premiums
                    (match (var-get capital-manager-principal)
                      capital-manager-some
                        (let ((capital-manager (unwrap-panic capital-manager-some)))
                          (try! (contract-call? capital-manager 
                            update-provider-earned-premiums 
                            provider token-id premium-share
                          ))
                          
                          ;; Reduce pending premiums
                          (try! (contract-call? capital-manager 
                            update-provider-pending-premiums 
                            provider token-id (to-int (* -1 premium-share))
                          ))
                          
                          ;; Emit premium distribution event with detailed info
                          (print {
                            event: "premium-distributed-to-provider",
                            block-height: burn-block-height,
                            provider: provider,
                            policy-id: policy-id,
                            token-id: token-id,
                            premium-share: premium-share,
                            allocation-amount: (get allocated-amount allocation),
                            risk-tier: (get risk-tier allocation),
                            distribution-weight: weight,
                            weight-percentage: (if (> total-weight u0)
                              (/ (* weight u10000) total-weight) ;; Basis points (e.g., 2500 = 25%)
                              u0
                            )
                          })
                          
                          premium-share
                        )
                      (err ERR-CAPITAL-MANAGER-PRINCIPAL-NOT-SET)
                    )
                  )
                provider-allocations
                (list u0 u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 u17 u18 u19)
              )
              
              (ok true)
            )
          )
        weights-err
          weights-err
      )
    )
  )
)

;; Calculate distribution weights based on risk tiers and allocation amounts
(define-private (calculate-provider-distribution-weights
    (provider-allocations (list 20 {
      provider: principal,
      allocation: {
        token-id: (string-ascii 32),
        allocated-amount: uint,
        risk-tier: (string-ascii 32),
        expiration-height: uint
      }
    }))
    (params-contract principal)
  )
  (begin
    ;; Map each provider allocation to a weight
    (fold calculate-distribution-weight 
      provider-allocations
      { 
        params-contract: params-contract,
        result: (ok (list)),
        error: (err ERR-DISTRIBUTION-WEIGHT-CALCULATION-FAILED)
      }
    )
  )
)

;; Helper function to calculate individual provider distribution weight
(define-private (calculate-distribution-weight
    (provider-allocation {
      provider: principal,
      allocation: {
        token-id: (string-ascii 32),
        allocated-amount: uint,
        risk-tier: (string-ascii 32),
        expiration-height: uint
      }
    })
    (acc {
      params-contract: principal,
      result: (response (list 20 uint) uint),
      error: (response uint uint)
    })
  )
  (let (
      (result-so-far (get result acc))
      (params-contract (get params-contract acc))
    )
    ;; If we already have an error, pass it through
    (match result-so-far
      result-ok
        (let (
            (provider (get provider provider-allocation))
            (allocation (get allocation provider-allocation))
            (allocated-amount (get allocated-amount allocation))
            (risk-tier (get risk-tier allocation))
          )
          ;; Get risk tier parameters
          (match (contract-call? params-contract get-risk-tier-parameters risk-tier)
            tier-params-opt
              (if (is-some tier-params-opt)
                (let ((tier-params (unwrap-panic tier-params-opt)))
                  ;; Get premium multiplier from tier parameters
                  (let ((premium-multiplier (get premium-adjustment-basis-points tier-params)))
                    ;; Calculate weight as allocation amount * premium multiplier
                    (let ((weight (* allocated-amount premium-multiplier)))
                      ;; Append weight to result list
                      (merge acc { 
                        result: (ok (as-max-len? (append (unwrap-panic result-ok) weight) u20))
                      })
                    )
                  )
                )
                ;; If tier not found, use allocation amount as weight
                (merge acc { 
                  result: (ok (as-max-len? (append (unwrap-panic result-ok) allocated-amount) u20))
                })
              )
            ;; If error from parameters contract, use allocation amount as weight
            (merge acc { 
              result: (ok (as-max-len? (append (unwrap-panic result-ok) allocated-amount) u20))
            })
          )
        )
      ;; If already in error state, pass through
      acc
    )
  )
)

;; --- LP-311: Provider Dropout Handling ---

;; Function to handle provider dropout during premium distribution
(define-public (handle-provider-dropout
    (policy-id uint)
    (dropout-provider principal)
    (token-id (string-ascii 32))
  )
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    
    ;; Get premium record
    (match (map-get? policy-premium-records { policy-id: policy-id })
      premium-record
        (let (
            (is-already-distributed (get is-distributed premium-record))
            (premium-amount (get premium-amount premium-record))
          )
          ;; If premium already distributed, nothing to do
          (if is-already-distributed
            (ok true)
            ;; Otherwise, handle the dropout
            (match (var-get allocation-manager-principal)
              allocation-manager-some
                (let ((allocation-manager (unwrap-panic allocation-manager-some)))
                  ;; Get all providers for this policy
                  (match (contract-call? allocation-manager get-policy-provider-allocations policy-id)
                    provider-allocations
                      (if (> (len provider-allocations) u1) ;; More than just the dropout
                        ;; Redistribute the dropout provider's premium share to remaining providers
                        (try! (redistribute-dropout-premium-share 
                          provider-allocations dropout-provider policy-id premium-amount token-id
                        ))
                        ;; If this was the only provider, we can't redistribute
                        (begin
                          ;; Mark premium as distributed anyway (lost premium)
                          (map-set policy-premium-records { policy-id: policy-id }
                            (merge premium-record {
                              is-distributed: true,
                              distribution-height: (some burn-block-height)
                            })
                          )
                          
                          (print {
                            event: "provider-dropout-unrecoverable",
                            block-height: burn-block-height,
                            policy-id: policy-id,
                            token-id: token-id,
                            dropout-provider: dropout-provider,
                            unrecoverable-premium: premium-amount
                          })
                          
                          (ok true)
                        )
                      )
                    (err ERR-REGISTRY-ERROR)
                  )
                )
              (err ERR-ALLOCATION-MANAGER-PRINCIPAL-NOT-SET)
            )
          )
        )
      (err ERR-POLICY-NOT-FOUND)
    )
  )
)

;; Redistribute a dropout provider's premium share to remaining providers
(define-private (redistribute-dropout-premium-share
    (provider-allocations (list 20 {
      provider: principal,
      allocation: {
        token-id: (string-ascii 32),
        allocated-amount: uint,
        risk-tier: (string-ascii 32),
        expiration-height: uint
      }
    }))
    (dropout-provider principal)
    (policy-id uint)
    (premium-amount uint)
    (token-id (string-ascii 32))
  )
  ;; Filter out the dropout provider and redistribute their share
  (let (
      (valid-providers (filter 
        (lambda (provider-allocation) 
          (not (is-eq (get provider provider-allocation) dropout-provider))
        )
        provider-allocations
      ))
      ;; Calculate total allocation of valid providers
      (valid-total-allocation (fold 
        (lambda (provider-allocation acc)
          (+ acc (get allocated-amount (get allocation provider-allocation)))
        )
        valid-providers
        u0
      ))
    )
    ;; Get parameters contract for premium adjustment
    (match (var-get parameters-contract-principal)
      params-contract-some
        (let ((params-contract (unwrap-panic params-contract-some)))
          ;; Redistribute using weighted distribution algorithm
          (distribute-premium-weighted 
            valid-providers
            policy-id
            premium-amount
            token-id
            u0  ;; Expiration height not needed for redistribution
            params-contract
          )
        )
      (err ERR-PARAMS-PRINCIPAL-NOT-SET)
    )
  )
)

;; --- LP-312: Unclaimed Premium Management ---

;; Function to handle unclaimed premiums after a specified period
(define-public (process-unclaimed-premiums
    (token-id (string-ascii 32))
    (older-than-blocks uint)
  )
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    
    ;; Get the list of providers with unclaimed premiums
    (match (var-get capital-manager-principal)
      capital-manager-some
        (let ((capital-manager (unwrap-panic capital-manager-some)))
          (match (contract-call? capital-manager get-providers-with-earned-premiums token-id older-than-blocks)
            provider-list
              (if (> (len provider-list) u0)
                (begin
                  ;; Get parameters for handling unclaimed premiums
                  (match (var-get parameters-contract-principal)
                    params-contract-some
                      (let ((params-contract (unwrap-panic params-contract-some)))
                        ;; Get the unclaimed premium policy (redistribute or send to treasury)
                        (match (contract-call? params-contract get-system-parameter-string "config.premiums.unclaimed-policy")
                          policy-opt
                            (let ((policy (unwrap! policy-opt ERR-PARAMS-PRINCIPAL-NOT-SET)))
                              (if (is-eq policy "redistribute")
                                ;; Redistribute to active providers
                                (try! (redistribute-unclaimed-premiums provider-list token-id))
                                ;; Send to treasury
                                (try! (send-unclaimed-premiums-to-treasury provider-list token-id))
                              )
                            )
                          (err ERR-PARAMS-PRINCIPAL-NOT-SET)
                        )
                      )
                    (err ERR-PARAMS-PRINCIPAL-NOT-SET)
                  )
                )
                ;; No unclaimed premiums to process
                (ok u0)
              )
            (err ERR-CAPITAL-MANAGER-ERROR)
          )
        )
      (err ERR-CAPITAL-MANAGER-PRINCIPAL-NOT-SET)
    )
  )
)

;; Redistribute unclaimed premiums to active providers
(define-private (redistribute-unclaimed-premiums
    (providers-with-premiums (list 50 {
      provider: principal,
      earned-amount: uint,
      last-updated: uint
    }))
    (token-id (string-ascii 32))
  )
  ;; Implementation would go here - similar to redistribute-dropout-premium-share
  ;; For brevity, returning stub that takes total amount and marks as processed
  (ok u0)
)

;; Send unclaimed premiums to treasury
(define-private (send-unclaimed-premiums-to-treasury
    (providers-with-premiums (list 50 {
      provider: principal,
      earned-amount: uint,
      last-updated: uint
    }))
    (token-id (string-ascii 32))
  )
  ;; Implementation would go here - collect total and send to treasury address
  ;; For brevity, returning stub that takes total amount and marks as processed
  (ok u0)
)
