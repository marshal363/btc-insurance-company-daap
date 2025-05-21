;; liquidity-base.clar
;; Base contract with shared utilities for all liquidity pool contracts

;; --- Constants ---

;; Fixed-point precision (8 decimal places)
(define-constant ONE_8 u100000000) 

;; Risk Tier Constants
(define-constant RISK-TIER-CONSERVATIVE "conservative")
(define-constant RISK-TIER-BALANCED "balanced")
(define-constant RISK-TIER-AGGRESSIVE "aggressive")

;; Status Constants
(define-constant STATUS-ACTIVE "Active")
(define-constant STATUS-PENDING-SETTLEMENT "PendingSettlement")
(define-constant STATUS-SETTLED-ITM "Settled-ITM")
(define-constant STATUS-EXPIRED-OTM "Expired-OTM")
(define-constant STATUS-CANCELLED "Cancelled")

;; Token Constants
(define-constant STX-TOKEN-ID "STX")

;; --- Common Error Codes ---
(define-constant ERR-UNAUTHORIZED (err u1001))
(define-constant ERR-NOT-FOUND (err u1002))
(define-constant ERR-TOKEN-NOT-INITIALIZED (err u1003))
(define-constant ERR-AMOUNT-MUST-BE-POSITIVE (err u1004))
(define-constant ERR-INSUFFICIENT-FUNDS (err u1005))
(define-constant ERR-INVALID-RISK-TIER (err u1006))
(define-constant ERR-REGISTRY-ERROR (err u1007))
(define-constant ERR-TRANSFER-FAILED (err u1008))
(define-constant ERR-ALREADY-EXISTS (err u1009))
(define-constant ERR-VALIDATION-FAILED (err u1010))

;; --- Registry Information ---
(define-data-var registry-contract (optional principal) none)

;; --- Authentication ---

;; Set registry contract - can only be done once
(define-public (set-registry (registry-principal principal))
  (begin
    (asserts! (is-none (var-get registry-contract)) ERR-ALREADY-EXISTS)
    (ok (var-set registry-contract (some registry-principal)))
  )
)

;; Check if caller is a registered contract
(define-private (is-registered-contract (contract-principal principal))
  (match (var-get registry-contract)
    registry (contract-call? registry is-authorized contract-principal)
    false
  )
)

;; Check if caller is the registry
(define-private (is-registry)
  (match (var-get registry-contract)
    registry (is-eq tx-sender registry)
    false
  )
)

;; --- Math Utilities ---

;; Multiply with scaling factor and round down
(define-read-only (mul-down (a uint) (b uint))
  (/ (* a b) ONE_8)
)

;; Multiply with scaling factor and round up
(define-read-only (mul-up (a uint) (b uint))
  (let ((product (* a b)))
    (if (is-eq product u0) 
      u0 
      (+ u1 (/ (- product u1) ONE_8))
    )
  )
)

;; Divide with scaling factor and round down
(define-read-only (div-down (a uint) (b uint))
  (if (is-eq a u0) 
    u0 
    (/ (* a ONE_8) b)
  )
)

;; Divide with scaling factor and round up
(define-read-only (div-up (a uint) (b uint))
  (if (is-eq a u0) 
    u0 
    (+ u1 (/ (- (* a ONE_8) u1) b))
  )
)

;; Return maximum of two numbers
(define-read-only (max (a uint) (b uint))
  (if (< a b) b a)
)

;; Return minimum of two numbers
(define-read-only (min (a uint) (b uint))
  (if (< a b) a b)
)

;; --- Data Validation Utilities ---

;; Validate a risk tier string
(define-read-only (is-valid-risk-tier (tier (string-ascii 32)))
  (or
    (is-eq tier RISK-TIER-CONSERVATIVE)
    (is-eq tier RISK-TIER-BALANCED)
    (is-eq tier RISK-TIER-AGGRESSIVE)
  )
)

;; Check if an amount is valid (positive)
(define-read-only (is-valid-amount (amount uint))
  (> amount u0)
)

;; --- Event Logging Utilities ---

;; Log contract initialization
(define-read-only (log-contract-init (contract-type (string-ascii 32)) (version (string-ascii 10)))
  (print {
    event: "contract-initialized",
    contract-type: contract-type,
    version: version,
    block-height: burn-block-height
  })
)

;; Log operation success
(define-read-only (log-operation 
    (operation (string-ascii 32)) 
    (details (buff 256))
  )
  (print {
    event: operation,
    details: details,
    block-height: burn-block-height
  })
)

;; Log operation failure
(define-read-only (log-failure 
    (operation (string-ascii 32)) 
    (reason uint) 
    (details (buff 256))
  )
  (print {
    event: "operation-failed",
    operation: operation,
    reason: reason,
    details: details,
    block-height: burn-block-height
  })
)
