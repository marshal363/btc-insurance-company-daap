;; settlement-trait.clar
;; Defines the interface for settlement operations

(define-trait settlement-trait
  (
    ;; Process a settlement at policy expiration
    (process-settlement 
      (uint uint (string-ascii 32) principal) 
      (response bool uint)
    )

    ;; Get settlement record for a policy
    (get-settlement-record 
      (uint) 
      (response {
        settlement-amount: uint,
        token-id: (string-ascii 32),
        policy-owner: principal,
        settlement-height: uint,
        remaining-collateral: uint
      } uint)
    )

    ;; Record impact of settlement on a provider
    (record-settlement-impact 
      (principal uint (string-ascii 32) uint) 
      (response bool uint)
    )

    ;; Check if a policy has been settled
    (is-policy-settled 
      (uint) 
      (response bool uint)
    )
  )
)
