;; allocation-manager-v1.clar
;; Enhanced implementation for LP-303 (prepare-liquidity-for-expirations) and LP-304 (expiration-liquidity-needs)

;; --- Constants ---
;; Add required error codes for LP-303, LP-304
(define-constant ERR-EXPIRATION-NOT-FOUND-LP (err u4432))
(define-constant ERR-ADMIN-ROLE-REQUIRED-LP (err u4433))

;; --- Enhanced Data Structure for LP-304 ---
;; Update the expiration-liquidity-needs map to include risk-tier-distribution
(define-map expiration-liquidity-needs
  uint ;; expiration-height
  {
    total-collateral-required: uint,
    is-liquidity-prepared: bool,
    token-distributions: (map (string-ascii 32) uint), ;; Map of token-id to amount required
    policy-count: uint, ;; Number of policies expiring at this height
    risk-tier-distribution: (map (string-ascii 32) (map (string-ascii 32) uint)) ;; LP-304: token-id -> risk-tier -> amount
  }
)

;; --- LP-303: Prepare Liquidity for Expirations Function ---
(define-public (prepare-liquidity-for-expiration (expiration-height uint))
  (begin
    ;; Validate caller authorization through the registry
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    
    ;; Get parameters contract to check admin role
    (match (var-get parameters-contract-principal)
      params-contract-some
        (let ((params-contract (unwrap-panic params-contract-some)))
          ;; Verify caller has admin role
          (asserts! (contract-call? params-contract has-role tx-sender "admin") ERR-ADMIN-ROLE-REQUIRED-LP)
          
          ;; Get current expiration record if exists
          (match (map-get? expiration-liquidity-needs expiration-height)
            expiration-needs-record-opt
              (let ((expiration-needs-record (unwrap-panic expiration-needs-record-opt)))
                ;; If already prepared, return success (idempotent)
                (if (get is-liquidity-prepared expiration-needs-record)
                  (ok true)
                  (begin
                    ;; Otherwise, set is-liquidity-prepared to true
                    (map-set expiration-liquidity-needs expiration-height
                      (merge expiration-needs-record { is-liquidity-prepared: true })
                    )
                    
                    ;; Emit standardized event for tracking
                    (print {
                      event: "liquidity-prepared-for-expiration",
                      block-height: burn-block-height,
                      expiration-height: expiration-height,
                      status: true
                    })
                    
                    (ok true)
                  )
                )
              )
            ;; No record found for this expiration height
            (err ERR-EXPIRATION-NOT-FOUND-LP)
          )
        )
      (err ERR-PARAMS-PRINCIPAL-NOT-SET)
    )
  )
)

;; --- LP-304: Enhanced lock-collateral and release-collateral Functions ---

;; Update lock-collateral to track risk-tier-distribution
(define-private (update-expiration-tracking-with-risk-tier
    (expiration-height uint) 
    (collateral-amount uint) 
    (token-id (string-ascii 32))
    (risk-tier (string-ascii 32))
  )
  (let ((expiration-needs (default-to {
      total-collateral-required: u0,
      is-liquidity-prepared: false,
      token-distributions: (map),
      policy-count: u0,
      risk-tier-distribution: (map)
    }
    (map-get? expiration-liquidity-needs expiration-height)
  )))
    
    (let (
        (current-token-amount (default-to u0
          (map-get? (get token-distributions expiration-needs) token-id)
        ))
        (updated-token-distributions (merge 
          (get token-distributions expiration-needs) 
          { (token-id): (+ current-token-amount collateral-amount) }
        ))
        
        ;; LP-304: Update risk-tier-distribution
        (token-rtd (default-to (map) 
          (map-get? (get risk-tier-distribution expiration-needs) token-id)
        ))
        (tier-amount (default-to u0 
          (map-get? token-rtd risk-tier)
        ))
        (updated-token-rtd (merge token-rtd 
          { (risk-tier): (+ tier-amount collateral-amount) }
        ))
        (updated-rtd (merge 
          (get risk-tier-distribution expiration-needs) 
          { (token-id): updated-token-rtd }
        ))
      )
      
      (map-set expiration-liquidity-needs expiration-height {
        total-collateral-required: (+ (get total-collateral-required expiration-needs) collateral-amount),
        is-liquidity-prepared: (get is-liquidity-prepared expiration-needs),
        token-distributions: updated-token-distributions,
        policy-count: (+ (get policy-count expiration-needs) u1),
        risk-tier-distribution: updated-rtd
      })
      
      (ok true)
    )
  )
)

;; Update release-collateral to reduce risk-tier-distribution
(define-private (reduce-expiration-tracking-with-risk-tier
    (expiration-height uint) 
    (collateral-amount uint) 
    (token-id (string-ascii 32))
    (risk-tier (string-ascii 32))
  )
  (match (map-get? expiration-liquidity-needs expiration-height)
    expiration-needs
      (let (
          (current-token-amount (default-to u0
            (map-get? (get token-distributions expiration-needs) token-id)
          ))
          (updated-token-distributions (merge 
            (get token-distributions expiration-needs) 
            { (token-id): (if (> current-token-amount collateral-amount)
              (- current-token-amount collateral-amount)
              u0
            )}
          ))
          
          ;; LP-304: Update risk-tier-distribution
          (token-rtd (default-to (map) 
            (map-get? (get risk-tier-distribution expiration-needs) token-id)
          ))
          (tier-amount (default-to u0 
            (map-get? token-rtd risk-tier)
          ))
          (updated-token-rtd (merge token-rtd 
            { (risk-tier): (if (> tier-amount collateral-amount)
              (- tier-amount collateral-amount)
              u0
            )}
          ))
          (updated-rtd (merge 
            (get risk-tier-distribution expiration-needs) 
            { (token-id): updated-token-rtd }
          ))
        )
        
        (map-set expiration-liquidity-needs expiration-height {
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
          risk-tier-distribution: updated-rtd
        })
        
        (ok true)
      )
    (ok true) ;; Nothing to reduce if no record exists
  )
)

;; --- Additional Read-Only Functions for LP-304 ---

;; Get risk tier distribution for a specific expiration height and token
(define-read-only (get-expiration-risk-tier-distribution
    (expiration-height uint)
    (token-id (string-ascii 32))
  )
  (match (map-get? expiration-liquidity-needs expiration-height)
    exp-needs (match (map-get? (get risk-tier-distribution exp-needs) token-id)
      token-rtd
        (ok token-rtd)
      (ok (map)) ;; Default to empty map if no distribution found
    )
    (ok (map)) ;; Default to empty map if no expiration record
  )
)

;; Get collateral required for a specific risk tier at expiration height
(define-read-only (get-expiration-tier-collateral-required
    (expiration-height uint)
    (token-id (string-ascii 32))
    (risk-tier (string-ascii 32))
  )
  (match (get-expiration-risk-tier-distribution expiration-height token-id)
    distribution-ok
      (let ((distribution (unwrap-panic distribution-ok)))
        (ok (default-to u0 (map-get? distribution risk-tier)))
      )
    distribution-err
      distribution-err
  )
)
