;; title: Math Library Trait
;; version: 1.0.0
;; summary: Defines the interface for the BitHedge Math Library Contract.
;; description: This trait defines the mathematical operations used by other BitHedge contracts,
;;              particularly for premium verification and settlement calculations.

(define-trait math-trait
  (
    ;; Verifies a submitted premium against basic policy parameters.
    (verify-submitted-premium (uint uint uint uint uint (string-ascii 8) (string-ascii 32)) (response bool uint))
    
    ;; Calculates the settlement amount for a policy at expiration.
    (calculate-settlement-amount (uint uint uint (string-ascii 8)) (response uint uint))
  )
) 