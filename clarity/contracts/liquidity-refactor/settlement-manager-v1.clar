;; settlement-manager-v1.clar
;; Handles policy settlements and payment processing

(impl-trait .settlement-trait.settlement-trait)
(use-trait ft-trait .trait-sip-010.sip-010-trait)

;; --- Constants ---

;; Error codes
(define-constant ERR-UNAUTHORIZED (err u5001))
(define-constant ERR-POLICY-NOT-FOUND (err u5002))
(define-constant ERR-POLICY-ALREADY-SETTLED (err u5003))
(define-constant ERR-INSUFFICIENT-FUNDS (err u5004))
(define-constant ERR-TRANSFER-FAILED (err u5005))
(define-constant ERR-NO-ALLOCATIONS-FOUND (err u5006))
(define-constant ERR-REGISTRY-ERROR (err u5007))
(define-constant ERR-INVALID-TOKEN (err u5008))
(define-constant ERR-ALREADY-INITIALIZED (err u5009))

;; --- Data Structures ---

;; Settlement records for policies
(define-map settlement-records
  uint ;; policy-id
  {
    settlement-amount: uint,
    token-id: (string-ascii 32),
    policy-owner: principal,
    settlement-height: uint,
    remaining-collateral: uint
  }
)

;; Settlement impact tracking for providers
(define-map settlement-impacts
  {
    provider: principal,
    policy-id: uint
  }
  {
    token-id: (string-ascii 32),
    settlement-amount-contributed: uint,
    settlement-height: uint
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

;; Process a settlement at policy expiration
(define-public (process-settlement 
    (policy-id uint) 
    (settlement-amount uint) 
    (token-id (string-ascii 32)) 
    (policy-owner principal)
  )
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    (asserts! (is-not-settled policy-id) ERR-POLICY-ALREADY-SETTLED)
    
    ;; Find providers who allocated to this policy
    (match (var-get allocation-manager-principal)
      allocation-manager
        (match (contract-call? allocation-manager find-providers-for-policy policy-id)
          providers-with-allocations
            (if (> (len providers-with-allocations) u0)
              ;; Process settlement impacts on providers
              (match (process-provider-settlement-impacts 
                providers-with-allocations policy-id settlement-amount token-id
              )
                remaining-collateral
                  (begin
                    ;; Transfer settlement amount to policy owner
                    (try! (transfer-settlement-to-owner 
                      settlement-amount token-id policy-owner
                    ))
                    
                    ;; Record settlement
                    (map-set settlement-records policy-id
                      {
                        settlement-amount: settlement-amount,
                        token-id: token-id,
                        policy-owner: policy-owner,
                        settlement-height: burn-block-height,
                        remaining-collateral: remaining-collateral
                      }
                    )
                    
                    (print {
                      event: "policy-settlement-processed",
                      policy-id: policy-id,
                      token-id: token-id,
                      settlement-amount: settlement-amount,
                      policy-owner: policy-owner,
                      block-height: burn-block-height
                    })
                    
                    (ok true)
                  )
                (err ERR-INSUFFICIENT-FUNDS)
              )
              (err ERR-NO-ALLOCATIONS-FOUND)
            )
          (err ERR-REGISTRY-ERROR)
        )
      (err ERR-REGISTRY-ERROR)
    )
  )
)

;; Get settlement record for a policy
(define-public (get-settlement-record (policy-id uint))
  (match (map-get? settlement-records policy-id)
    record (ok record)
    (err ERR-POLICY-NOT-FOUND)
  )
)

;; Record impact of settlement on a provider
(define-public (record-settlement-impact 
    (provider principal) 
    (policy-id uint) 
    (token-id (string-ascii 32)) 
    (settlement-amount uint)
  )
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    
    (map-set settlement-impacts
      { provider: provider, policy-id: policy-id }
      {
        token-id: token-id,
        settlement-amount-contributed: settlement-amount,
        settlement-height: burn-block-height
      }
    )
    
    (print {
      event: "settlement-impact-recorded",
      provider: provider,
      policy-id: policy-id,
      token-id: token-id,
      settlement-amount: settlement-amount,
      block-height: burn-block-height
    })
    
    (ok true)
  )
)

;; Check if a policy has been settled
(define-public (is-policy-settled (policy-id uint))
  (ok (is-some (map-get? settlement-records policy-id)))
)

;; --- Private Helper Functions ---

;; Check if a policy has not been settled
(define-private (is-not-settled (policy-id uint))
  (is-none (map-get? settlement-records policy-id))
)

;; Process settlement impacts for all providers
(define-private (process-provider-settlement-impacts 
    (providers (list 20 principal)) 
    (policy-id uint) 
    (settlement-amount uint) 
    (token-id (string-ascii 32))
  )
  ;; Simplified implementation - in a real contract, this would:
  ;; 1. Calculate each provider's share of the settlement
  ;; 2. Update their balances
  ;; 3. Return the remaining collateral
  
  ;; For simplicity, we'll assume settlement amount is paid proportionally
  ;; and return a fixed remaining collateral
  
  ;; Record impact for each provider
  (map 
    (lambda (provider)
      (let ((provider-settlement-share (/ settlement-amount (len providers))))
        (try! (record-settlement-impact 
          provider policy-id token-id provider-settlement-share
        ))
        
        ;; Update provider's capital in capital manager
        (match (var-get capital-manager-principal)
          capital-manager
            (try! (contract-call? capital-manager 
              update-provider-allocation 
              provider token-id (to-int (* -1 provider-settlement-share))
            ))
          (err ERR-REGISTRY-ERROR)
        )
      )
    )
    providers
  )
  
  ;; Return a calculated remaining collateral amount
  ;; In a real implementation, this would be the actual remainder
  (ok u100)
)

;; Transfer settlement amount to policy owner
(define-private (transfer-settlement-to-owner 
    (amount uint) 
    (token-id (string-ascii 32)) 
    (policy-owner principal)
  )
  (begin
    ;; Transfer tokens to the policy owner
    (match (var-get capital-manager-principal)
      capital-manager
        (if (is-eq token-id "STX")
          (try! (as-contract (stx-transfer? amount tx-sender policy-owner)))
          (begin
            ;; Get token principal from capital manager
            ;; Simplified - in real implementation, get actual token principal
            ;; Try (contract-call? capital-manager get-token-principal token-id)
            (let ((token-principal 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-token))
              ;; Transfer SIP-010 token
              (try! (as-contract (contract-call? token-principal 
                transfer amount tx-sender policy-owner none
              )))
            )
          )
        )
      (err ERR-REGISTRY-ERROR)
    )
    
    (print {
      event: "settlement-transferred-to-owner",
      policy-owner: policy-owner,
      amount: amount,
      token-id: token-id,
      block-height: burn-block-height
    })
    
    (ok true)
  )
)

;; --- Read-Only Functions ---

;; Get provider's contribution to a settlement
(define-read-only (get-provider-settlement-contribution 
    (provider principal) 
    (policy-id uint)
  )
  (match (map-get? settlement-impacts { provider: provider, policy-id: policy-id })
    impact (some impact)
    none
  )
)

;; Count total settlements processed
(define-read-only (get-settlement-count)
  ;; In a real implementation, maintain a counter
  u0
)

;; --- Admin Functions ---

;; Manually record a settlement (for emergency use)
(define-public (manual-record-settlement 
    (policy-id uint) 
    (settlement-amount uint) 
    (token-id (string-ascii 32)) 
    (policy-owner principal) 
    (remaining-collateral uint)
  )
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    (asserts! (is-not-settled policy-id) ERR-POLICY-ALREADY-SETTLED)
    
    (map-set settlement-records policy-id
      {
        settlement-amount: settlement-amount,
        token-id: token-id,
        policy-owner: policy-owner,
        settlement-height: burn-block-height,
        remaining-collateral: remaining-collateral
      }
    )
    
    (print {
      event: "settlement-manually-recorded",
      policy-id: policy-id,
      token-id: token-id,
      settlement-amount: settlement-amount,
      policy-owner: policy-owner,
      block-height: burn-block-height
    })
    
    (ok true)
  )
)
