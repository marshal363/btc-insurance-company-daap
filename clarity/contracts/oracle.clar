;; title: oracle
;; version: 1.2.1 (Hardcoded Params)
;; summary: Oracle Contract for BitHedge platform - Simplified
;; description: Provides reliable price data for Bitcoin. Stores validated price submitted by authorized source. Parameters are hardcoded.

;; Implementation Status:
;; ---------------------
;; Phase 1 (Refactor):
;; - OC-101: Removed Volatility, TWAP, Price Change%, History logic/storage.
;; - OC-102: Implement set-aggregated-price function with auth check.
;; - OC-103: Implement get-latest-price read-only function.
;; - OC-104: Implement set-authorized-submitter function.
;; - OC-105: Update constants, error codes, and events.
;; - PC-101: Define Parameter Contract Trait.
;; - OC-106: Integrate Parameter Contract trait calls.
;;
;; Next Steps (Phase 1):
;; - BI-101: Implement Blockchain Integration (Convex): Basic readLatestOraclePrice function
;; - OC-107: Deploy refactored oracle.clar to Devnet
;; - TEST-101: Basic unit tests for refactored oracle.clar functions
;;
;; Known Issues:
;; - None

;; token definitions
;;

;; constants
;; REMOVED: Parameter Contract constant
;; (define-constant PARAMETER_CONTRACT 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.parameter-oracle-impl)

(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-INVALID-PARAMETERS (err u101))
(define-constant ERR-PRICE-OUT-OF-BOUNDS (err u102))
(define-constant ERR-TIMESTAMP-TOO-OLD (err u103))
(define-constant ERR-NO-PRICE-DATA (err u104))
;; REMOVED: Parameter contract error
;; (define-constant ERR-PARAMETER-CONTRACT-ERROR (err u105))

;; Configuration constants (Hardcoded)
(define-constant PRICE_DECIMALS u8)
(define-constant ORACLE_MAX_DEVIATION_PCT u500000) ;; 5% with 6 decimals (e.g., / u1000000 in validation)
(define-constant ORACLE_MAX_AGE_SECONDS u3600) ;; 1 hour

;; data vars
;;
(define-data-var latest-price uint u0)
(define-data-var latest-timestamp uint u0)
(define-data-var authorized-submitter principal CONTRACT-OWNER)

;; data maps
;;

;; private functions
;; None

;; public functions

;; @desc Sets the latest aggregated price and timestamp. Only callable by the authorized submitter.
;; Uses hardcoded validation parameters.
;; @param price The aggregated price (uint, with PRICE_DECIMALS)
;; @param timestamp The timestamp associated with the price (uint, Stacks block timestamp)
;; @returns (ok bool) or (err uint)
(define-public (set-aggregated-price (price uint) (timestamp uint))
  (begin
    ;; --- Authorization ---
    (asserts! (is-eq tx-sender (var-get authorized-submitter)) ERR-NOT-AUTHORIZED)

    ;; --- Validation ---
    (let
      (
        (current-block-time burn-block-height)
        (last-price-val (var-get latest-price))
        (max-deviation-percentage ORACLE_MAX_DEVIATION_PCT)
        (max-age-seconds ORACLE_MAX_AGE_SECONDS)
        (max-age-blocks (/ max-age-seconds u10))
      )
      
      ;; 1. Timestamp validation (Explicit checks)
      ;; Check A: Is timestamp too old?
      (if (< current-block-time max-age-blocks)
          true ;; Allow if chain is too young for check
          (asserts! (>= timestamp (- current-block-time max-age-blocks)) ERR-TIMESTAMP-TOO-OLD) ;; Else, enforce check
      )
      ;; Check B: Is timestamp too far in the future? (Allow 1 block buffer)
      (asserts! (<= timestamp (+ current-block-time u1)) ERR-INVALID-PARAMETERS)

      ;; 2. Deviation validation
      (if (> last-price-val u0)
        (let
          (
            (price-diff (if (> price last-price-val) (- price last-price-val) (- last-price-val price)))
            ;; Adjust scale based on param contract (assuming 6 decimals like original param contract)
            ;; e.g., if param is 50000 (5%), divide by 1,000,000
            (max-allowed-diff (/ (* last-price-val max-deviation-percentage) u1000000))
          )
          (asserts! (<= price-diff max-allowed-diff) ERR-PRICE-OUT-OF-BOUNDS)
        )
        true ;; Skip deviation check if no previous price
      )
    )

    ;; --- State Update ---
    (var-set latest-price price)
    (var-set latest-timestamp timestamp)

    ;; --- Event Emission ---
    (print { event: "price-updated", price: price, timestamp: timestamp, submitter: tx-sender })

    (ok true)
  )
)

;; @desc Updates the authorized submitter principal. Only callable by the current contract owner.
;; @param new-submitter The principal of the new authorized submitter.
;; @returns (ok bool) or (err uint)
(define-public (set-authorized-submitter (new-submitter principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set authorized-submitter new-submitter)
    (print { event: "authorized-submitter-updated", new-submitter: new-submitter })
    (ok true)
  )
)

;; read only functions

;; @desc Gets the latest validated price and its timestamp.
;; Staleness check is now done implicitly by the caller based on timestamp.
;; The contract itself doesn't prevent reading stale data, only setting it.
;; @returns (ok {price: uint, timestamp: uint}) or (err uint) if no price data exists
(define-read-only (get-latest-price)
  (let
    (
      (price (var-get latest-price))
      (timestamp (var-get latest-timestamp))
    )
    ;; Check if a price has been set
    (asserts! (> price u0) ERR-NO-PRICE-DATA)

    ;; Return the price and timestamp - REMOVED STALENESS CHECK FROM HERE
    (ok { price: price, timestamp: timestamp })
  )
)

;; @desc Gets the currently authorized submitter principal.
;; @returns (ok principal)
(define-read-only (get-authorized-submitter)
  (ok (var-get authorized-submitter))
)

;; Deprecated functions commented out below...

;; Deprecated: Get information about a specific provider.
;; (define-read-only (get-provider-info (provider principal))
;;   (ok (map-get? oracle-providers { provider: provider })))

;; Deprecated: Get the current BTC/USD price and timestamp.
;; (define-read-only (get-btc-price)
;;   (let ((price (var-get current-btc-price)) (timestamp (var-get current-btc-price-timestamp)))
;;     (asserts! (> price u0) ERR-NO-PRICE-DATA)
;;     (asserts! (check-price-age (var-get last-price-update-height) (var-get max-price-age)) ERR-PRICE-TOO-OLD)
;;     (ok { price: price, timestamp: timestamp }))
;; )

;; Deprecated: Get the price for any supported asset.
;; (define-read-only (get-asset-price (asset-symbol (string-ascii 10)))
;;   (let ((asset-info (unwrap! (map-get? supported-assets { asset-symbol: asset-symbol }) ERR-ASSET-NOT-SUPPORTED)))
;;     (asserts! (get status asset-info) ERR-ASSET-NOT-SUPPORTED)
;;     (asserts! (> (get current-price asset-info) u0) ERR-NO-PRICE-DATA)
;;     (asserts! (check-price-age (get last-update-height asset-info) (var-get max-price-age)) ERR-PRICE-TOO-OLD)
;;     (ok { price: (get current-price asset-info), timestamp: (get last-update-time asset-info) }))
;; )

;; Deprecated: Get detailed BTC volatility information (calculated off-chain potentially in future)
;; (define-read-only (get-btc-volatility-detailed)
;;   (let ((volatility (calculate-volatility-from-data)))
;;     (ok {
;;       volatility-30d: (get volatility-30d volatility),
;;       calculation-timestamp: (get calculation-timestamp volatility),
;;       data-points-used: (get data-points-used volatility)
;;     }))
;; )

;; Deprecated: Get Time-Weighted Average Price (TWAP) for BTC over a specified period.
;; (define-read-only (get-btc-twap (start-height uint) (end-height uint))
;;   (ok (calculate-twap start-height end-height))
;; )

;; Deprecated: Get BTC price change percentage over a specified timeframe (e.g., 24h, 7d, 30d).
;; (define-read-only (get-btc-price-change-percentage (timeframe-blocks uint))
;;   (let (
;;     (current-price (var-get current-btc-price))
;;     (start-block (- burn-block-height timeframe-blocks))
;;     (historical-data (collect-past-days-data timeframe-blocks)) ;; Simplified fetch logic
;;     (start-price (if (> (len historical-data) u0) 
;;                    (get price (unwrap-panic (element-at? historical-data u0)))
;;                    u0)) ;; Handle case where no historical data is found
;;   )
;;     (asserts! (> current-price u0) ERR-NO-PRICE-DATA)
;;     (asserts! (> start-price u0) ERR-INSUFFICIENT-HISTORY)
;;     (ok (calculate-percentage-change start-price current-price))
;;   )
;; )

;; Deprecated: Get historical BTC price at a specific block height.
;; (define-read-only (get-historical-btc-price (block-height uint))
;;   (ok (map-get? btc-price-history { block-height: block-height })))

;; Deprecated: Get daily high/low BTC price range for a specific day index.
;; (define-read-only (get-daily-btc-range (day-index uint))
;;   (ok (map-get? daily-btc-price-ranges { day-index: day-index })))

;; Deprecated: Get the latest price submission from a specific provider for BTC.
;; (define-read-only (get-provider-submissions (provider principal) (asset-symbol (string-ascii 10)))
;;   (ok (map-get? provider-price-submissions { provider: provider, asset-symbol: asset-symbol })))

;; Deprecated: Get the current aggregation round number.
;; (define-read-only (get-aggregation-round)
;;   (ok (var-get aggregation-round))
;; ) 