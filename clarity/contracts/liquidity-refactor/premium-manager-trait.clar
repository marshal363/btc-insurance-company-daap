;; premium-manager-trait.clar
;; Defines the interface for premium management operations

(define-trait premium-manager-trait
  (
    ;; Record premium payment for a policy
    (record-premium-payment 
      (uint uint (string-ascii 32) uint principal) 
      (response bool uint)
    )

    ;; Distribute premium to providers
    (distribute-premium 
      (uint (string-ascii 32)) 
      (response bool uint)
    )

    ;; Get premium distribution details
    (get-premium-distribution 
      (uint) 
      (response {
        premium-amount: uint,
        token-id: (string-ascii 32),
        expiration-height: uint,
        is-distributed: bool,
        distribution-height: (optional uint),
        premium-recorded-height: uint
      } uint)
    )

    ;; Get total distributed premiums for a token
    (get-total-distributed-premiums 
      ((string-ascii 32)) 
      (response uint uint)
    )
  )
)
