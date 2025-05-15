;; BitHedge Math Library Contract
;; Version: 0.3 (Phase 2 Development - ML-201 Refactored)
;; Summary: Provides standardized fixed-point math operations and financial calculations.
;; Description: This contract contains core mathematical constants and functions
;;              for use by other BitHedge contracts, particularly for financial
;;              calculations requiring fixed-point arithmetic, including premium verification.

;; --- Traits ---
;; (No traits defined in this initial version)

;; --- Constants ---

;; Fixed-point precision (8 decimal places)
;; Used for consistent scaling in financial calculations.
(define-constant ONE_8 u100000000)
(define-constant CONTRACT-OWNER tx-sender) ;; Can be made settable if needed

;; Basis Points Denominator (consistent with Parameters contract)
(define-constant BASIS_POINTS_DENOMINATOR u10000)

;; Error Codes
(define-constant ERR-DIVISION-BY-ZERO (err u101)) ;; From ML-101
(define-constant ERR-EXPIRATION-IN-PAST (err u201)) ;; From ML-103 (will be uM08)
(define-constant ERR-INVALID-POLICY-TYPE (err u202)) ;; From ML-104 (will be uM07)

(define-constant ERR-INVALID-PREMIUM (err u301)) ;; M01 - Premium is outside acceptable bounds or invalid
(define-constant ERR-RISK-TIER-NOT-ACTIVE (err u302)) ;; M02
(define-constant ERR-PARAMETERS-CONTRACT-NOT-SET (err u303)) ;; M03
(define-constant ERR-ORACLE-CONTRACT-NOT-SET (err u304)) ;; M04
(define-constant ERR-ORACLE-CALL-FAILED (err u305)) ;; M05
(define-constant ERR-PARAMETERS-CALL-FAILED (err u306)) ;; M06
(define-constant ERR-POLICY-TYPE-INVALID-ML (err u307)) ;; M07 (ML specific version of u202)
(define-constant ERR-EXPIRATION-IN-PAST-ML (err u308)) ;; M08 (ML specific version of u201)
(define-constant ERR-ARITHMETIC (err u309)) ;; M09 - for unwrap failures from math ops
(define-constant ERR-PREMIUM-ZERO-OR-LESS (err u310)) ;; M10
(define-constant ERR-UNAUTHORIZED (err u311)) ;; M11 - For owner-protected setters
(define-constant ERR-EMPTY-PRICE-DATA-ML (err u312)) ;; M12 - For TWAP calculation if no price data provided

;; Maximum number of price points for TWAP calculation list input
(define-constant MAX_TWAP_PRICE_POINTS u50)

;; --- Data Vars ---
(define-data-var math-contract-owner principal CONTRACT-OWNER)

;; --- Data Maps ---
;; (No data maps defined in this initial version)

;; --- Owner-Protected Setter Functions ---
(define-public (set-contract-owner (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get math-contract-owner)) ERR-UNAUTHORIZED)
    (var-set math-contract-owner new-owner)
    (ok true)
  )
)

;; --- Public Getter Functions for Principals ---
(define-read-only (get-math-contract-owner)
  (var-get math-contract-owner)
)

;; --- Public Functions ---
;; (No public functions defined in this initial version that modify state beyond setters)

;; --- Read Only Functions ---

;; Verifies a submitted premium against basic policy parameters.
;; ML-201: Full premium verification logic.
;; Inputs:
;; - submitted-premium: The premium amount submitted by the user.
;; - protected-value: The strike price or value being protected.
;; - protection-amount: The amount being protected.
;; - current-block-height: The current block height, to calculate time to expiry.
;; - expiration-height: The block height at which the policy expires.
;; - policy-type: (string-ascii 8) e.g., "PUT", "CALL".
;; - current-oracle-price: uint - Current price of the underlying asset from the oracle.
;; - risk-tier-is-active: bool - Whether the specified risk tier is active.
;; - risk-tier-premium-adjustment-bp: uint - Premium adjustment basis points for the risk tier.
(define-read-only (verify-submitted-premium
    (submitted-premium uint)
    (protected-value uint) ;; strike price / value being protected
    (protection-amount uint)
    (current-block-height uint) ;; effectively burn-block-height passed by caller
    (expiration-height uint)
    (policy-type (string-ascii 8))
    (current-oracle-price uint) ;; New Parameter
    (risk-tier-is-active bool) ;; New Parameter
    (risk-tier-premium-adjustment-bp uint) ;; New Parameter
  )
  (begin
    ;; Initial Basic Validations
    (asserts! (> expiration-height current-block-height) ERR-EXPIRATION-IN-PAST-ML)
    (asserts! (> submitted-premium u0) ERR-PREMIUM-ZERO-OR-LESS)
    (asserts! (or (is-eq policy-type "PUT") (is-eq policy-type "CALL")) ERR-POLICY-TYPE-INVALID-ML)

    ;; Use passed-in risk tier parameters
    (asserts! risk-tier-is-active ERR-RISK-TIER-NOT-ACTIVE)
              
    ;; current-oracle-price is passed in, can be used for more complex premium logic if needed.
    ;; For now, the premium bounds are based on protection_amount and risk tier adjustment.
    (let (
        (premium-adj-bp risk-tier-premium-adjustment-bp)
        (min-base-premium-factor u1) ;; Example: 0.01% base min premium factor (1/10000)
        (max-premium-factor u5000) ;; Example: 50% max premium factor (5000/10000)

        ;; min_base_premium = protection_amount * (min_base_premium_factor / 10000)
        (min-base-premium (mul-down protection-amount min-base-premium-factor))
        (min-base-premium-scaled (unwrap! (div-down min-base-premium BASIS_POINTS_DENOMINATOR) ERR-ARITHMETIC))

        ;; adjusted_min_premium = min_base_premium_scaled * (1 + premium_adj_bp / 10000)
        ;; Assuming premium_adj_bp is an additive adjustment on top of a base.
        ;; If premium_adj_bp is, for example, 100 (1%), new factor is (1 + 0.01) = 1.01
        ;; Or, if it's a direct multiplier for the scaled base: min_base_premium_scaled * (premium_adj_bp / 10000)
        ;; The current logic seems to treat premium_adj_bp as a multiplier for min_base_premium_scaled.
        ;; Let's assume it means the final premium should be: base_premium * (1 + adj_bp/DENOMINATOR)
        ;; Or if adj_bp is itself the *total* adjustment factor, then base_premium * (adj_bp/DENOMINATOR)
        ;; The original code: (mul-down min-base-premium-scaled premium-adj-bp) then (div-down ... BASIS_POINTS_DENOMINATOR)
        ;; This implies premium-adj-bp is a factor that also needs scaling by BASIS_POINTS_DENOMINATOR.
        ;; Let's clarify the intended math for premium_adj_bp.
        ;; If premium_adj_bp = u500 (i.e. 5%), does it mean final_premium = base * 0.05 or base * 1.05?
        ;; The variable name "premium-adjustment-basis-points" suggests it's an adjustment.
        ;; If positive, increases premium; if negative (not possible with uint), decreases.
        ;; Let's assume it's an additive percentage on top of the base.
        ;; So, effective_factor = BASIS_POINTS_DENOMINATOR + premium_adj_bp
        (effective-premium-factor (+ BASIS_POINTS_DENOMINATOR premium-adj-bp))
        (adjusted-min-premium (mul-down min-base-premium-scaled effective-premium-factor))
        (adjusted-min-premium-final (unwrap! (div-down adjusted-min-premium BASIS_POINTS_DENOMINATOR) ERR-ARITHMETIC))
        
        ;; max_premium = protection_amount * (max_premium_factor / 10000)
        (max-premium-calc (mul-down protection-amount max-premium-factor))
        (max-premium-final (unwrap! (div-down max-premium-calc BASIS_POINTS_DENOMINATOR) ERR-ARITHMETIC))
      )
      
      (asserts! (>= submitted-premium adjusted-min-premium-final) ERR-INVALID-PREMIUM)
      (asserts! (<= submitted-premium max-premium-final) ERR-INVALID-PREMIUM)

      (ok true) ;; All checks passed
    )
  )
)

;; Calculates the settlement amount for a policy at expiration.
;; For ML-104, this is a basic stub. Full logic in ML-202.
;; Inputs:
;; - protected-value: The strike price of the option.
;; - protection-amount: The notional amount being protected/covered by the option.
;; - expiration-price: The price of the underlying asset at expiration.
;; - policy-type: (string-ascii 8) e.g., "PUT", "CALL".
(define-read-only (calculate-settlement-amount
    (protected-value uint)
    (protection-amount uint) 
    (expiration-price uint)
    (policy-type (string-ascii 8))
  )
  (begin
    (asserts! (or (is-eq policy-type "PUT") (is-eq policy-type "CALL")) ERR-POLICY-TYPE-INVALID-ML)
    ;; For now, just return 0 as a placeholder.
    ;; Actual settlement calculation (e.g., max(0, strike - spot) for PUT)
    ;; will be implemented in ML-202.
    (ok u0) 
  )
)

;; ML-203: Utility function stub for Time-Weighted Average Price (TWAP) calculation.
;; The actual complex TWAP logic will be refined in conjunction with Oracle contract capabilities (PO-205).
;; This stub takes a list of price observations. For now, it calculates a simple average of prices.
;; Inputs:
;; - price-observations: A list of tuples, each containing a price and its duration/weight.
;;                       (list MAX_TWAP_PRICE_POINTS {price: uint, block-duration: uint})
;; Output: (response uint uint) - The calculated TWAP or an error.
(define-read-only (calculate-twap-simple (price-observations (list MAX_TWAP_PRICE_POINTS {price: uint, block-duration: uint})))
  (begin
    (asserts! (> (len price-observations) u0) ERR-EMPTY-PRICE-DATA-ML)

    ;; Stub logic: Calculate simple average of prices, ignore block-duration for now.
    ;; Using fold to iterate and sum directly to try and bypass potential linter issue with map in let.
    (let (
        (summation-result (fold sum-price-observation price-observations {total-price: u0, count: u0}))
        (total-price (get total-price summation-result))
        (num-observations (get count summation-result))
      )
      ;; num-observations should be > u0 due to the asserts! above.
      ;; The check (is-eq num-observations u0) is mostly a defensive safeguard here.
      (if (is-eq num-observations u0) 
        ERR-EMPTY-PRICE-DATA-ML
        (ok (/ total-price num-observations)) ;; Simple average
      )
    )
  )
)

;; --- Private Functions ---

;; Private helper for ML-203 to extract price from a price observation tuple
(define-private (get-price-from-observation (observation {price: uint, block-duration: uint}))
  (get price observation)
)

;; Private helper for ML-203 using fold to sum prices and count observations
(define-private (sum-price-observation (observation {price: uint, block-duration: uint}) (accumulator {total-price: uint, count: uint}))
  {
    total-price: (+ (get total-price accumulator) (get price observation)),
    count: (+ (get count accumulator) u1)
  }
)

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
    ERR-DIVISION-BY-ZERO ;; Return error for division by zero
    (if (is-eq a u0)
      (ok u0) ;; Return ok with 0 when numerator is 0
      (ok (/ (* a ONE_8) b)) ;; Return ok with calculation result
    )
  )
)

(print { message: "BitHedgeMathLibraryContract refactored for ML-201: verify-submitted-premium now takes direct oracle/param data." })
(print { message: "BitHedgeMathLibraryContract updated for ML-203: Refactored TWAP stub to use fold directly, attempting to fix syntax binding error." }) 