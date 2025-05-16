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

;; Constants for verify-submitted-premium (PCIA-105)
(define-constant MIN_PREMIUM_STX_FLOOR u1000) ;; Minimum premium floor: 0.001 STX (in microSTX)
(define-constant MAX_PREMIUM_STX_CAP u500000000000) ;; Max premium cap: 500,000 STX (in microSTX) - very loose cap

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

;; Verifies a submitted premium against basic policy parameters for MVP.
;; PCIA-101: This function implements a bare-minimum model for MVP premium verification.
;;           Detailed premium bound calculations based on risk models are deferred to PCIA-105.
;; PCIA-105: This version incorporates refined bounds logic.
(define-read-only (verify-submitted-premium
    (submitted-premium uint) ;; Expected to be in microSTX (collateral token's smallest unit, e.g. STX)
    (protected-value uint) ;; Strike price, expected in USD cents
    (protection-amount uint) ;; Notional amount of the protected asset, expected in its smallest unit (e.g., Satoshis for BTC)
    (current-block-height uint) ;; Current burn-block-height, passed by the caller
    (expiration-height uint)
    (policy-type (string-ascii 8)) ;; e.g., "PUT" or "CALL"
    (current-oracle-price uint) ;; Current oracle price of the protected asset (e.g., BTC in USD cents).
    (risk-tier-is-active bool) ;; Boolean indicating if the policy's selected risk tier is active.
    (risk-tier-premium-adjustment-bp uint) ;; Basis points for premium adjustment (e.g., u100 for 1% increase to min premium).
  )
  (begin
    ;; Doc: verify-submitted-premium (PCIA-105 Refinement)
    ;; Purpose: Performs refined checks on the submitted policy premium based on defined bounds.
    ;;          Ensures basic validity and applies STX-based min/max bounds.
    ;; Inputs:
    ;;   - submitted-premium: Scaled premium amount (e.g., in microSTX if collateral is STX).
    ;;   - protected-value: Scaled strike price (e.g., in USD cents for a BTC/USD policy).
    ;;   - protection-amount: Scaled notional amount of the protected asset (e.g., in Satoshis for BTC).
    ;;   - current-block-height: Current burn chain height.
    ;;   - expiration-height: Policy expiration block height.
    ;;   - policy-type: "PUT" or "CALL" (must be string-ascii 8).
    ;;   - current-oracle-price: Scaled current price of the protected asset (used for intrinsic value calculation for context).
    ;;   - risk-tier-is-active: Boolean from ParametersContract indicating if the risk tier is active.
    ;;   - risk-tier-premium-adjustment-bp: Basis points from ParametersContract used to increase the min acceptable premium.
    ;; Returns: (ok true) if verification passes, otherwise an error code.
    ;; 1. Basic Input Validations (from MVP)
    (asserts! (> expiration-height current-block-height)
      ERR-EXPIRATION-IN-PAST-ML
    )
    (asserts! (> submitted-premium u0) ERR-PREMIUM-ZERO-OR-LESS)
    (asserts! (or (is-eq policy-type "PUT") (is-eq policy-type "CALL"))
      ERR-POLICY-TYPE-INVALID-ML
    )
    (asserts! risk-tier-is-active ERR-RISK-TIER-NOT-ACTIVE)
    ;; 2. Refined Premium Bound Checks (PCIA-105)
    ;; Lower Bound Calculation:
    ;; The minimum premium is a base STX floor, adjusted upwards by the risk tier's basis points.
    ;; Assumes risk-tier-premium-adjustment-bp is an additive percentage increase to the floor.
    ;; E.g., if floor is 1000 microSTX and adjustment is 50bp (0.5%),
    ;; adjustment_value = (1000 * 50) / 10000 = 50 microSTX.
    ;; min_acceptable_premium = 1000 + 50 = 1050 microSTX.
    (let ((base-premium-adjustment (unwrap!
        (div-down
          (mul-down MIN_PREMIUM_STX_FLOOR risk-tier-premium-adjustment-bp)
          BASIS_POINTS_DENOMINATOR
        )
        ERR-ARITHMETIC
      )))
      (let ((min-acceptable-premium (+ MIN_PREMIUM_STX_FLOOR base-premium-adjustment)))
        ;; Ensures submitted premium is not below the calculated minimum acceptable STX premium.
        (asserts! (>= submitted-premium min-acceptable-premium)
          ERR-INVALID-PREMIUM
        )
      )
    )
    ;; Upper Bound Calculation:
    ;; A simple capability check against a hardcoded maximum STX premium.
    ;; More sophisticated dynamic upper bounds (e.g., percentage of STX value of notional) would require
    ;; STX/USD or STX/BTC oracle price access, which is beyond this function's current direct scope.
    (asserts! (<= submitted-premium MAX_PREMIUM_STX_CAP) ERR-INVALID-PREMIUM)
    ;; Intrinsic Value Calculation (for context/logging - does NOT enforce a bound on STX premium directly here):
    ;; This calculation uses USD-based figures. The off-chain service is expected to calculate an STX premium
    ;; whose value is greater than or equal to the USD intrinsic value (when converted at a fair STX/USD rate).
    (let ((intrinsic-value-usd-cents (if (is-eq policy-type "PUT")
        (if (> protected-value current-oracle-price)
          (- protected-value current-oracle-price)
          u0
        )
        ;; max(0, strike - spot)
        (if (> current-oracle-price protected-value)
          (- current-oracle-price protected-value)
          u0
        )
        ;; max(0, spot - strike) for CALL
      )))
      (print {
        note: "Intrinsic value (USD cents) calculated for context only.",
        policy-type: policy-type,
        strike-usd-cents: protected-value,
        spot-usd-cents: current-oracle-price,
        intrinsic-usd-cents: intrinsic-value-usd-cents,
      })
    )
    (ok true) ;; All checks passed.
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
    (protected-value uint) ;; Scaled strike price (e.g., USD value * ONE_8)
    (protection-amount uint) ;; Scaled notional amount of asset (e.g., BTC quantity * asset_precision, assumed asset_precision == ONE_8)
    (expiration-price uint) ;; Scaled price of underlying at expiration (same scale as protected-value)
    (policy-type (string-ascii 8)) ;; "PUT" or "CALL"
  )
  (begin
    ;; Doc: calculate-settlement-amount (PCIA-104 Implementation)
    ;; Purpose: Calculates the settlement amount for a protection policy at expiration.
    ;;          The settlement amount is returned scaled by ONE_8.
    ;; Assumptions for Scaling:
    ;;   - protected-value (strike price) is scaled by ONE_8.
    ;;   - expiration-price (spot price at expiry) is scaled by ONE_8.
    ;;   - protection-amount (notional quantity of the asset) is scaled by a factor equal to ONE_8
    ;;     (e.g., if asset is BTC with 8 decimal places, protection-amount is in satoshis, and ONE_8 = u100000000).
    ;; Formula Derivation (e.g., for PUT):
    ;;   Raw Payout = MAX(0, Strike_USD - Spot_USD) * Notional_Asset_Units
    ;;   Scaled Payout = (MAX(0, (protected-value/ONE_8) - (expiration-price/ONE_8)) * (protection-amount/ONE_8)) * ONE_8
    ;;                 = MAX(0, protected-value - expiration-price) * protection-amount / ONE_8
    ;;                 = mul-down(MAX(0, protected-value - expiration-price), protection-amount)
    ;; Warning: The private `mul-down` function `(/ (* a b) ONE_8)` can panic on overflow if `(* a b)` is too large.
    (asserts! (or (is-eq policy-type "PUT") (is-eq policy-type "CALL"))
      ERR-POLICY-TYPE-INVALID-ML
    )
    (if (is-eq policy-type "PUT")
      ;; PUT Option: Settlement if Strike > Expiration Price
      (if (> protected-value expiration-price)
        ;; Policy is In-The-Money (ITM)
        (let ((price-difference (- protected-value expiration-price)))
          (ok (mul-down price-difference protection-amount))
        )
        (ok u0) ;; Policy is Out-of-The-Money (OTM) or At-The-Money (ATM)
      )
      ;; ELSE (must be CALL Option due to asserts! above)
      ;; CALL Option: Settlement if Expiration Price > Strike
      (if (> expiration-price protected-value)
        ;; Policy is In-The-Money (ITM)
        (let ((price-difference (- expiration-price protected-value)))
          (ok (mul-down price-difference protection-amount))
        )
        (ok u0) ;; Policy is Out-of-The-Money (OTM) or At-The-Money (ATM)
      )
    )
  )
)

;; ML-203: Utility function stub for Time-Weighted Average Price (TWAP) calculation.
;; The actual complex TWAP logic will be refined in conjunction with Oracle contract capabilities (PO-205).
;; This stub takes a list of price observations. For now, it calculates a simple average of prices.
;; Inputs:
;; - price-observations: A list of tuples, each containing a price and its duration/weight.
;;                       (list MAX_TWAP_PRICE_POINTS (tuple (price uint) (block-duration uint)))
;; Output: (response uint uint) - The calculated TWAP or an error.
(define-read-only (calculate-twap-simple (price-observations (list MAX_TWAP_PRICE_POINTS {
  price: uint,
  block-duration: uint,
})))
  (begin
    (asserts! (> (len price-observations) u0) ERR-EMPTY-PRICE-DATA-ML)
    ;; Stub logic: Calculate simple average of prices, ignore block-duration for now.
    ;; Using fold to iterate and sum directly to try and bypass potential linter issue with map in let.
    (let (
        (summation-result (fold sum-price-observation price-observations {
          total-price: u0,
          count: u0,
        }))
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
(define-private (get-price-from-observation (observation {
  price: uint,
  block-duration: uint,
}))
  (get price observation)
)

;; Private helper for ML-203 using fold to sum prices and count observations
(define-private (sum-price-observation
    (observation {
      price: uint,
      block-duration: uint,
    })
    (accumulator {
      total-price: uint,
      count: uint,
    })
  )
  {
    total-price: (+ (get total-price accumulator) (get price observation)),
    count: (+ (get count accumulator) u1),
  }
)

;; Adds two fixed-point numbers (assuming same precision)
(define-private (add
    (a uint)
    (b uint)
  )
  (+ a b)
)

;; Subtracts second fixed-point number from the first (assuming same precision)
;; Panics on underflow if b > a.
(define-private (sub
    (a uint)
    (b uint)
  )
  (- a b)
)

;; Multiplies two fixed-point numbers, scaling down the result.
;; (a * ONE_8) * (b * ONE_8) / ONE_8 = a * b * ONE_8
;; So, if a and b are already scaled by ONE_8, the operation is:
;; a_scaled * b_scaled / ONE_8
(define-private (mul-down
    (a uint)
    (b uint)
  )
  (/ (* a b) ONE_8)
)

;; Divides the first fixed-point number by the second.
;; (a * ONE_8) / (b * ONE_8) * ONE_8 = a / b * ONE_8
;; So, if a and b are already scaled by ONE_8, the operation is:
;; (a_scaled * ONE_8) / b_scaled
(define-private (div-down
    (a uint)
    (b uint)
  )
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
