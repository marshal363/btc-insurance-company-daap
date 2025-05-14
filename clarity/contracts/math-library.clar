;; BitHedge Math Library Contract
;; Version: 0.1 (Phase 1 Development)
;; Summary: Provides standardized fixed-point math operations and financial calculations.
;; Description: This contract contains core mathematical constants and functions
;;              for use by other BitHedge contracts, particularly for financial
;;              calculations requiring fixed-point arithmetic.

;; --- Traits ---
;; (No traits defined in this initial version)

;; --- Constants ---

;; Fixed-point precision (8 decimal places)
;; Used for consistent scaling in financial calculations.
(define-constant ONE_8 u100000000)

;; Error Codes
(define-constant ERR-DIVISION-BY-ZERO (err u101)) ;; Example error code

;; --- Data Vars ---
;; (No data vars defined in this initial version)

;; --- Data Maps ---
;; (No data maps defined in this initial version)

;; --- Public Functions ---
;; (No public functions defined in this initial version)

;; --- Read Only Functions ---

;; Verifies a submitted premium against basic policy parameters.
;; For ML-103, this is a basic stub. Full logic in ML-201.
;; Inputs:
;; - submitted-premium: The premium amount submitted by the user.
;; - protected-value: The strike price of the option.
;; - protection-amount: The amount being protected.
;; - current-block-height: The current block height, to calculate time to expiry.
;; - expiration-height: The block height at which the policy expires.
;; - policy-type: (string-ascii 8) e.g., \"PUT\", \"CALL\".
;; - risk-tier: (string-ascii 32) e.g., \"Conservative\".
(define-read-only (verify-submitted-premium
    (submitted-premium uint)
    (protected-value uint)
    (protection-amount uint)
    (current-block-height uint)
    (expiration-height uint)
    (policy-type (string-ascii 8))
    (risk-tier (string-ascii 32))
  )
  (begin
    ;; Phase 1 (ML-103) stub: Basic check, e.g., premium must be positive.
    ;; More complex logic involving actual calculation/bounds checking will be in ML-201.
    (asserts! (> expiration-height current-block-height) (err u201)) ;; ERR-EXPIRATION-IN-PAST (example)
    (ok (> submitted-premium u0))
  )
)

;; Calculates the settlement amount for a policy at expiration.
;; For ML-104, this is a basic stub. Full logic in ML-202.
;; Inputs:
;; - protected-value: The strike price of the option.
;; - protection-amount: The notional amount being protected/covered by the option.
;; - expiration-price: The price of the underlying asset at expiration.
;; - policy-type: (string-ascii 8) e.g., \"PUT\", \"CALL\".
(define-read-only (calculate-settlement-amount
    (protected-value uint)
    (protection-amount uint) 
    (expiration-price uint)
    (policy-type (string-ascii 8))
  )
  (begin
    ;; Phase 1 (ML-104) stub: Basic check and placeholder return.
    ;; Actual settlement calculation (e.g., max(0, strike - spot) for PUT)
    ;; will be implemented in ML-202.
    (asserts! (or (is-eq policy-type "PUT") (is-eq policy-type "CALL")) (err u202)) ;; ERR-INVALID-POLICY-TYPE (example)
    ;; For now, just return 0 as a placeholder.
    (ok u0) 
  )
)

;; --- Private Functions ---

;; Adds two fixed-point numbers (assuming same precision)
(define-private (add (a uint) (b uint))
  (+ a b)
)

;; Subtracts second fixed-point number from the first (assuming same precision)
;; Panics on underflow if b > a.
(define-private (sub (a uint) (b uint))
  (- a b)
)

;; Multiplies two fixed-point numbers, scaling down the result.
;; (a * ONE_8) * (b * ONE_8) / ONE_8 = a * b * ONE_8
;; So, if a and b are already scaled by ONE_8, the operation is:
;; a_scaled * b_scaled / ONE_8
(define-private (mul-down (a uint) (b uint))
  (/ (* a b) ONE_8)
)

;; Divides the first fixed-point number by the second.
;; (a * ONE_8) / (b * ONE_8) * ONE_8 = a / b * ONE_8
;; So, if a and b are already scaled by ONE_8, the operation is:
;; (a_scaled * ONE_8) / b_scaled
(define-private (div-down (a uint) (b uint))
  (if (is-eq b u0)
    (panic ERR-DIVISION-BY-ZERO) ;; Explicit panic for division by zero
    (if (is-eq a u0)
      u0
      (/ (* a ONE_8) b)
    )
  )
)

(print { message: "BitHedgeMathLibraryContract created and ML-101 (core constants) implemented." }) 