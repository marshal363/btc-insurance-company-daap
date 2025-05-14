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

;; (define-constant CONTRACT-OWNER tx-sender)
;; (define-constant ERR-NOT-AUTHORIZED (err u100))
;; (define-constant ERR-INVALID-PARAMETERS (err u101))
;; (define-constant ERR-PRICE-OUT-OF-BOUNDS (err u102))
;; (define-constant ERR-TIMESTAMP-TOO-OLD (err u103))
;; (define-constant ERR-NO-PRICE-DATA (err u104))
;;;;  REMOVED: Parameter contract error
;;;;  (define-constant ERR-PARAMETER-CONTRACT-ERROR (err u105))

;;;;  Configuration constants (Hardcoded)
;; (define-constant PRICE_DECIMALS u8)
;; (define-constant ORACLE_MAX_DEVIATION_PCT u500000) ;; 5% with 6 decimals (e.g., / u1000000 in validation)
;; (define-constant ORACLE_MAX_AGE_SECONDS u3600) ;; 1 hour

;;;;  data vars
;;;; 
;; (define-data-var latest-price uint u0)
;; (define-data-var latest-timestamp uint u0)
;; (define-data-var authorized-submitter principal CONTRACT-OWNER)

;;;;  data maps
;;;; 

;;;;  private functions
;;;;  None

;;;;  public functions

;;;;  @desc Sets the latest aggregated price. Only callable by the authorized submitter.
;;;;  Uses hardcoded validation parameters. The timestamp is automatically set to the current burn-block-height.
;;;;  @param price The aggregated price (uint, with PRICE_DECIMALS)
;;;;  @returns (ok bool) or (err uint)
;; (define-public (set-aggregated-price (price uint))
;;   (begin
;;;;      --- Authorization ---
;;     (asserts! (is-eq tx-sender (var-get authorized-submitter)) ERR-NOT-AUTHORIZED)
;;;;      --- Get Current Time ---
;;     (let ((current-timestamp burn-block-height))
;;;;        --- Validation ---
;;       (let (
;;           (last-price-val (var-get latest-price))
;;           (last-timestamp-val (var-get latest-timestamp)) ;; Get last timestamp for deviation check context if needed
;;           (max-deviation-percentage ORACLE_MAX_DEVIATION_PCT)
;;           (max-age-seconds ORACLE_MAX_AGE_SECONDS)
;;           (max-age-blocks (/ max-age-seconds u10)) ;; Recalculate max age in blocks
;;         )
;;;;          REMOVED Timestamp validation checks - using burn-block-height directly
;;;;          1. Deviation validation (Checks if price changed too much since last update)
;;         (if (> last-price-val u0)
;;           (let (
;;               (price-diff (if (> price last-price-val)
;;                 (- price last-price-val)
;;                 (- last-price-val price)
;;               ))
;;;;                Calculate max allowed difference based on the last price
;;               (max-allowed-diff (/ (* last-price-val max-deviation-percentage) u1000000))
;;;;                Also check if the last price is too old according to max_age_seconds
;;               (is-last-price-stale (if (< current-timestamp max-age-blocks) ;; Handle chain genesis case
;;                 false
;;                 (< last-timestamp-val (- current-timestamp max-age-blocks))
;;               ))
;;             )
;;;;              Allow update if last price was stale OR if deviation is within bounds
;;             (asserts! (or is-last-price-stale (<= price-diff max-allowed-diff))
;;               ERR-PRICE-OUT-OF-BOUNDS
;;             )
;;           )
;;           true ;; Skip deviation check if no previous price exists
;;         )
;;       )
;;     )
;;;;      --- State Update ---
;;     (var-set latest-price price)
;;     (var-set latest-timestamp current-timestamp)
;;;;      Use the current block height
;;;;      --- Event Emission ---
;;     (print {
;;       event: "price-updated",
;;       price: price,
;;       timestamp: current-timestamp,
;;       submitter: tx-sender,
;;     })
;;;;      Use current block height
;;     (ok true)
;;   )
;;;;    End outer let for current-timestamp
;; )

;;;;  @desc Updates the authorized submitter principal. Only callable by the current contract owner.
;;;;  @param new-submitter The principal of the new authorized submitter.
;;;;  @returns (ok bool) or (err uint)
;; (define-public (set-authorized-submitter (new-submitter principal))
;;   (begin
;;     (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
;;     (var-set authorized-submitter new-submitter)
;;     (print {
;;       event: "authorized-submitter-updated",
;;       new-submitter: new-submitter,
;;     })
;;     (ok true)
;;   )
;; )

;;;;  read only functions

;;;;  @desc Gets the latest validated price and its timestamp.
;;;;  Staleness check is now done implicitly by the caller based on timestamp.
;;;;  The contract itself doesn't prevent reading stale data, only setting it.
;;;;  @returns (ok {price: uint, timestamp: uint}) or (err uint) if no price data exists
;; (define-read-only (get-latest-price)
;;   (let (
;;       (price (var-get latest-price))
;;       (timestamp (var-get latest-timestamp))
;;     )
;;;;      Check if a price has been set
;;     (asserts! (> price u0) ERR-NO-PRICE-DATA)
;;;;      Return the price and timestamp - REMOVED STALENESS CHECK FROM HERE
;;     (ok {
;;       price: price,
;;       timestamp: timestamp,
;;     })
;;   )
;; )

;;;;  @desc Gets the currently authorized submitter principal.
;;;;  @returns (ok principal)
;; (define-read-only (get-authorized-submitter)
;;   (ok (var-get authorized-submitter))
;; )

;; BitHedgePriceOracleContract
;; Responsible for providing reliable Bitcoin price data for various system operations.

;; --- Data Maps ---
;; PO-101: Price data map stub
;; Stores price data for assets.
;; Key: (string-ascii 32) - Asset identifier (e.g., "BTC-USD")
;; Value: (tuple (price uint) (last-updated-height uint))
(define-map prices
  (string-ascii 32)
  {
    price: uint,
    last-updated-height: uint,
  }
)

;; PO-101: Price sources map stub
;; Manages principals authorized to submit price data.
;; Key: principal - The Stacks address of the submitter
;; Value: bool - True if authorized, false otherwise
(define-map authorized-submitters
  principal
  bool
)

;; --- Variables ---
;; PO-104: Admin of this contract
(define-data-var contract-admin principal tx-sender)

;; --- Constants ---
;; --- Errors ---
(define-constant ERR-PRICE-NOT-FOUND (err u300))
(define-constant ERR-UNAUTHORIZED-SUBMITTER (err u301))
(define-constant ERR-SUBMITTER-ALREADY-AUTHORIZED (err u302))
(define-constant ERR-SUBMITTER-NOT-AUTHORIZED (err u303))
(define-constant ERR-INVALID-ASSET-ID (err u304))
(define-constant ERR-NOT-ADMIN (err u305))

;; --- Authorization Checks ---
(define-private (is-admin)
  (is-eq tx-sender (var-get contract-admin))
)

;; --- Public Functions ---
;; PO-102: Stub for get-current-bitcoin-price
;; Phase 1: Returns a constant for testing.
;; Phase 2: Will fetch the latest price from the 'prices' map with staleness checks.
(define-read-only (get-current-bitcoin-price)
  (ok u20000000000)
)

;; PO-103: Stub for get-bitcoin-price-at-height
;; Phase 1: Returns a constant for testing. Ignores 'height' parameter for now.
;; Phase 2: Will look up historical prices if stored, or handle requests appropriately.
(define-read-only (get-bitcoin-price-at-height (height uint))
  (ok u19000000000)
)

;; PO-104: Admin functions for managing authorized updaters
(define-public (add-authorized-submitter (submitter principal))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (match (map-get? authorized-submitters submitter)
      found-value
      (if found-value
        (ok false) ;; Changed from (err ERR-SUBMITTER-ALREADY-AUTHORIZED) to (ok false) to maintain consistent return type
        (begin
          ;; Was false (inactive) or not present, now setting to true
          (map-set authorized-submitters submitter true)
          (print {
            event: "added-authorized-submitter",
            submitter: submitter,
          })
          (ok true)
        )
      )
      ;; Not found in map, so add as true
      (begin
        (map-set authorized-submitters submitter true)
        (print {
          event: "added-authorized-submitter",
          submitter: submitter,
        })
        (ok true)
      )
    )
  )
)

(define-public (remove-authorized-submitter (submitter principal))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (match (map-get? authorized-submitters submitter)
      found-value
      (if found-value
        (begin
          ;; Was true (active), now setting to false
          (map-set authorized-submitters submitter false)
          (print {
            event: "removed-authorized-submitter",
            submitter: submitter,
          })
          (ok true)
        )
        (ok false) ;; Changed from (err ERR-SUBMITTER-NOT-AUTHORIZED) to (ok false) to maintain consistent return type
      )
      ;; Not found in map, so not authorized
      (ok false) ;; Changed from (err ERR-SUBMITTER-NOT-AUTHORIZED) to (ok false) to maintain consistent return type
    )
  )
)

(define-public (set-contract-admin (new-admin principal))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (var-set contract-admin new-admin)
    (print {
      event: "set-contract-admin",
      new-admin: new-admin,
    })
    (ok true)
  )
)

;; PO-201: Implement update-bitcoin-price - stub for future implementation
;; TODO: Add functions for TWAP, price source registry, etc., in later phases.
