;; allocation-trait.clar
;; Defines the interface for capital allocation operations

(define-trait allocation-trait
  (
    ;; Find eligible providers for a policy
    (get-eligible-providers 
      ((string-ascii 32) (string-ascii 32) uint uint) 
      (response (list 20 principal) uint)
    )

    ;; Allocate capital from providers to a policy
    (allocate-capital 
      (uint uint (string-ascii 32) (string-ascii 32) uint principal) 
      (response bool uint)
    )

    ;; Release collateral for a policy
    (release-collateral 
      (uint (string-ascii 32) uint) 
      (response uint uint)
    )

    ;; Get a provider's allocation for a policy
    (get-provider-allocation 
      (principal uint) 
      (response {
        token-id: (string-ascii 32),
        allocated-amount: uint,
        risk-tier: (string-ascii 32),
        expiration-height: uint
      } uint)
    )

    ;; Get a provider's exposure at a specific expiration height
    (get-provider-exposure-at-height 
      (principal (string-ascii 32) uint) 
      (response uint uint)
    )

    ;; Get total collateral required for an expiration height
    (get-expiration-collateral-required 
      (uint) 
      (response uint uint)
    )

    ;; Lock collateral for a policy
    (lock-collateral 
      (uint uint (string-ascii 32) (string-ascii 32) uint principal) 
      (response bool uint)
    )
  )
)
