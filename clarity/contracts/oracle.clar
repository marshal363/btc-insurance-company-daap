;; title: oracle
;; version: 2.0.8
;; summary: Oracle Contract for BitHedge platform - MVP Implementation
;; description: Provides reliable price data for Bitcoin. Stores validated price submitted by authorized source.
;;              Integrates with Parameters Contract for validation thresholds. Staleness check is responsibility of the caller.

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

;; @desc Sets the latest aggregated price. Only callable by authorized submitters.
;; @param price The aggregated price (uint)
;; @returns (ok bool) or (err uint)
(define-public (set-aggregated-price (price uint))
  (begin
    ;; --- Authorization ---
    (asserts! (is-authorized-submitter) ERR-NOT-AUTHORIZED)
    ;; --- Validation ---
    (let (
        (current-timestamp burn-block-height)
        (last-price-val (var-get latest-price))
        (last-timestamp-val (var-get latest-timestamp))
      )
      (if (> last-price-val u0) ;; Perform validation only if a previous price exists
        (match (var-get parameters-contract-principal)
          params-principal-some
          (try! (validate-price-update price last-price-val last-timestamp-val
            current-timestamp params-principal-some
          ))
          none ;; Parameters contract not set, skip detailed validation
          (ok true)
        )
        (ok true) ;; Skip validation if no previous price
      )
    )
    ;; --- State Update (occurs if validation above didn't abort) ---
    (var-set latest-price price)
    (var-set latest-timestamp burn-block-height)
    ;; --- Event Emission ---
    (print {
      event: "price-updated",
      block-height: burn-block-height,
      price: price,
      timestamp: burn-block-height,
      submitter: tx-sender,
    })
    (ok true)
  )
)

;; @desc Adds a new authorized submitter. Only callable by the contract admin.
;; @param submitter The principal to authorize for price updates
;; @returns (ok bool) or (err uint)
(define-public (add-authorized-submitter (submitter principal))
  (begin
    (asserts! (is-admin) ERR-NOT-AUTHORIZED)
    (map-set authorized-submitters submitter true)
    (print {
      event: "added-authorized-submitter",
      block-height: burn-block-height,
      submitter-principal: submitter,
    })
    (ok true)
  )
)

;; @desc Removes an authorized submitter. Only callable by the contract admin.
;; @param submitter The principal to remove from authorized submitters
;; @returns (ok bool) or (err uint)
(define-public (remove-authorized-submitter (submitter principal))
  (begin
    (asserts! (is-admin) ERR-NOT-AUTHORIZED)
    (map-set authorized-submitters submitter false)
    (print {
      event: "removed-authorized-submitter",
      block-height: burn-block-height,
      submitter-principal: submitter,
    })
    (ok true)
  )
)

;; @desc Updates the contract admin. Only callable by the current admin.
;; @param new-admin The principal to set as the new contract admin
;; @returns (ok bool) or (err uint)
(define-public (set-contract-admin (new-admin principal))
  (begin
    (asserts! (is-admin) ERR-NOT-AUTHORIZED)
    (var-set contract-admin new-admin)
    (print {
      event: "set-contract-admin",
      block-height: burn-block-height,
      new-admin-principal: new-admin,
    })
    (ok true)
  )
)

;; @desc Sets the Parameters Contract principal. Only callable by the contract admin.
;; @param params-principal The principal of the Parameters Contract that implements parameter-trait
;; @returns (ok bool) or (err uint)
(define-public (set-parameters-contract-principal (params-principal principal))
  (begin
    (asserts! (is-admin) ERR-NOT-AUTHORIZED)
    (var-set parameters-contract-principal (some params-principal))
    (print {
      event: "parameters-contract-set",
      block-height: burn-block-height,
      params-principal: params-principal,
    })
    (ok true)
  )
)

;; --- Read-Only Functions ---

;; @desc Gets the latest validated price and its timestamp. Caller is responsible for staleness check.
;; @returns (ok {price: uint, timestamp: uint}) or (err ERR-NO-PRICE-DATA)
(define-read-only (get-current-bitcoin-price)
  (let (
      (price (var-get latest-price))
      (timestamp (var-get latest-timestamp))
    )
    (asserts! (> price u0) ERR-NO-PRICE-DATA)
    ;; Ensure a price has been set
    (ok {
      price: price,
      timestamp: timestamp,
    })
  )
)

;; @desc Gets the Bitcoin price at a specific height (for settlements).
;; For MVP, this function returns the latest price. Caller responsible for staleness.
;; @param height The block height at which to get the price (currently ignored for MVP)
;; @returns (ok {price: uint, timestamp: uint}) or (err ERR-NO-PRICE-DATA)
(define-read-only (get-bitcoin-price-at-height (height uint))
  (get-current-bitcoin-price)
)

;; @desc Checks if a principal is an authorized submitter
;; @param principal The principal to check
;; @returns (bool) True if authorized, false otherwise
(define-read-only (is-authorized-submitter-public (principal principal))
  (default-to false (map-get? authorized-submitters principal))
)

;; @desc Gets the current contract admin
;; @returns (principal) The contract admin
(define-read-only (get-contract-admin)
  (var-get contract-admin)
)

;; @desc Gets the current parameters contract principal if set
;; @returns (optional principal) The parameters contract principal or none
(define-read-only (get-parameters-contract-principal)
  (var-get parameters-contract-principal)
)

;; --- Helper Functions ---

;; @desc Fetches a uint parameter from the specified Parameters Contract.
;;       Assumes the parameter contract implements `get-system-parameter-uint` from `parameter-trait`.
;;       The trait function `get-system-parameter-uint` returns `(response (optional uint) uint)`.
;; @param params-principal The principal of the Parameters Contract.
;; @param param-name The name of the parameter to fetch (e.g., "oracle-max-age-blocks").
;; @returns (response uint uint) - (ok value) if successful, or (err ERR-PARAMETER-CONTRACT-ERROR) if the call fails or parameter not found/wrong type.
(define-private (get-parameter-from-contract
    (params-principal principal)
    (param-name (string-ascii 64))
  )
  (match (contract-call? params-principal get-system-parameter-uint param-name)
    ;; Case 1: contract-call? succeeded. Result is (response (optional uint) uint) from trait.
    ok-outer-response ;; This is the (response (optional uint) uint) from the trait method
    (match ok-outer-response
      ;; Case 1a: Trait method returned (ok (optional uint))
      ok-inner-optional-uint ;; This is (optional uint)
      (match ok-inner-optional-uint
        ;; Case 1a-i: The (optional uint) is (some val)
        (some val)
        (ok val)
        ;; Case 1a-ii: The (optional uint) is none (parameter not found or not uint)
        none
        (err ERR-PARAMETER-CONTRACT-ERROR)
      )
      ;; Case 1b: Trait method returned (err ...)
      err-inner-response
      (err ERR-PARAMETER-CONTRACT-ERROR) ;; Error from trait implementation
    )
    ;; Case 2: contract-call? itself failed (e.g., no such contract, or contract panicked during call)
    err-outer-response
    (err ERR-PARAMETER-CONTRACT-ERROR)
  )
)

;; --- Private Helper for Validation ---
(define-private (validate-price-update
    (price uint)
    (last-price-val uint)
    (last-timestamp-val uint)
    (current-timestamp uint)
    (params-principal principal)
  )
  (let (
      (max-deviation-pct-val (unwrap!
        (get-parameter-from-contract params-principal "oracle-max-deviation-pct")
        ERR-PARAMETER-CONTRACT-ERROR
      ))
      (max-age-blocks-val (unwrap!
        (get-parameter-from-contract params-principal "oracle-max-age-blocks")
        ERR-PARAMETER-CONTRACT-ERROR
      ))
      (price-diff (if (> price last-price-val)
        (- price last-price-val)
        (- last-price-val price)
      ))
      (max-allowed-diff (/ (* last-price-val max-deviation-pct-val) u1000000))
      (is-last-price-stale (if (< current-timestamp max-age-blocks-val)
        false
        (< last-timestamp-val (- current-timestamp max-age-blocks-val))
      ))
    )
    (asserts! (or is-last-price-stale (<= price-diff max-allowed-diff))
      ERR-PRICE-OUT-OF-BOUNDS
    )
    (ok true)
  )
)

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

(define-private (is-authorized-submitter)
  (default-to false (map-get? authorized-submitters tx-sender))
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

;; PO-201: Implement update-bitcoin-price - stub for future implementation
;; TODO: Add functions for TWAP, price source registry, etc., in later phases.
