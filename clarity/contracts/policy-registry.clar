;; BitHedge Policy Registry Contract
;; Version: 0.1.3 (Adapting to Math Library ML-201 Refactor)
;; Summary: Manages the lifecycle of European-style protection policies.
;; Description: This contract handles policy creation, tracking by owner and expiration,
;;              and stores detailed information for each policy. It serves as the central
;;              registry for all protection policies within the BitHedge ecosystem.

;; --- Traits ---
;; (use-trait math-contract .math-trait.math-trait) ;; Keep for future trait-based calls

;; --- Constants ---
(define-constant CONTRACT-OWNER tx-sender)
(define-constant CONTRACT-VERSION "0.1.3")

;; Maximum number of policy IDs to store in list-based indexes
(define-constant MAX_POLICIES_PER_LISTING u100)

;; Fixed-point precision (8 decimal places) - Assuming this might be used from math-library or defined locally if needed often.
;; For now, we assume values like submitted-premium are already scaled.
;; (define-constant ONE_8 u100000000)

;; PR-301: Added for collateral calculation with risk tier parameters
(define-constant BASIS_POINTS_DENOMINATOR u10000) ;; Denominator for basis points (100.00% = 10000 basis points)

;; Error Codes (Starting from u300 for this contract)
(define-constant ERR-UNAUTHORIZED (err u301))
(define-constant ERR-POLICY-ID-COUNTER-OVERFLOW (err u302))
(define-constant ERR-POLICY-NOT-FOUND (err u303))
(define-constant ERR-OWNER_POLICY_LIST_FULL (err u304))
(define-constant ERR-EXPIRATION_POLICY_LIST_FULL (err u305))
(define-constant ERR-PRINCIPAL-NOT-SET (err u306)) ;; Generic, consider more specific ones
(define-constant ERR-LP-PRINCIPAL-NOT-SET (err u307))
(define-constant ERR-MATH-PRINCIPAL-NOT-SET (err u308))
(define-constant ERR-ORACLE-PRINCIPAL-NOT-SET (err u309))
(define-constant ERR-PARAMS-PRINCIPAL-NOT-SET (err u310))
(define-constant ERR-INVALID-POLICY-TYPE (err u311))
(define-constant ERR-EMPTY-RISK-TIER (err u312))
(define-constant ERR-EMPTY-ASSET-NAME (err u313))
(define-constant ERR-EMPTY-COLLATERAL-TOKEN (err u314))
(define-constant ERR-ZERO-PROTECTED-VALUE (err u315))
(define-constant ERR-ZERO-PROTECTION-AMOUNT (err u316))
(define-constant ERR-ZERO-PREMIUM (err u317))
(define-constant ERR-EXPIRATION-IN-PAST (err u318))
(define-constant ERR-ORACLE-CALL-FAILED-PR (err u319))
(define-constant ERR-PARAMS-CALL-FAILED-PR (err u320))
(define-constant ERR-RISK-TIER-DATA-INVALID-PR (err u321))

;; PR-210: Error for stale oracle price
(define-constant ERR-ORACLE-PRICE-TOO-STALE (err u322))

;; PR-302: Error for exceeding the maximum policy limit
(define-constant ERR-POLICY-LIMIT-EXCEEDED (err u323))

;; Policy Status Constants (PR-104)
(define-constant STATUS-ACTIVE "Active")
(define-constant STATUS-PENDING-SETTLEMENT "PendingSettlement")
(define-constant STATUS-SETTLED-ITM "Settled-ITM")
(define-constant STATUS-EXPIRED-OTM "Expired-OTM")
(define-constant STATUS-CANCELLED "Cancelled") ;; For future use

;; --- Data Vars ---

;; Counter for generating unique policy IDs. Stores the *next* ID to be assigned.
(define-data-var policy-id-counter uint u0)

;; Principals of other core BitHedge contracts
(define-data-var liquidity-pool-principal (optional principal) none)
(define-data-var math-library-principal (optional principal) none)
(define-data-var price-oracle-principal (optional principal) none)
(define-data-var parameters-contract-principal (optional principal) none)

;; --- Data Maps ---

;; Stores the comprehensive details of each protection policy.
;; Key: uint (unique policy ID)
;; Value: A tuple containing all relevant information about the policy.
(define-map policies
  uint
  {
    ;; --- Core Policy Details ---
    policy-owner: principal, ;; The principal who owns/purchased the protection.
    policy-type: (string-ascii 8), ;; Type of policy, e.g., "PUT", "CALL".
    risk-tier: (string-ascii 32), ;; Risk tier selected by the buyer, influencing terms.
    ;; --- Financials & Coverage ---
    protected-asset: (string-ascii 10), ;; e.g., "BTC" (underlying asset being protected)
    collateral-token: (string-ascii 32), ;; Token used for premium and collateral (e.g., "STX", sBTC contract principal string)
    protected-value: uint, ;; Strike price of the option (e.g., for BTC-USD, this is USD value, scaled by ONE_8).
    protection-amount: uint, ;; Notional amount of the protected asset covered by the policy (e.g., amount of BTC, scaled by BTC's precision).
    submitted-premium: uint, ;; Premium paid by the policy owner for this policy (in collateral-token, scaled by ONE_8).
    collateral-locked: uint, ;; Amount of collateral-token locked in the Liquidity Pool for this policy (scaled by ONE_8).
    ;; --- Timing & Status ---
    creation-height: uint, ;; Block height at which the policy was created.
    expiration-height: uint, ;; Block height at which the policy expires.
    settlement-height: (optional uint), ;; Block height at which the policy was settled.
    status: (string-ascii 20), ;; Current status: "Active", "Expired-OTM", "Settled-ITM", "Pending-Settlement", "Cancelled".
    ;; --- Oracle & Settlement Data (populated in later phases) ---
    price-at-expiration: (optional uint), ;; Price of the protected asset at expiration (scaled by ONE_8).
    settlement-amount-paid: (optional uint), ;; Amount paid out if ITM (in collateral-token, scaled by ONE_8).
  }
)

;; Index to retrieve all policies owned by a specific principal.
;; Key: principal (policy owner)
;; Value: { ids: (list MAX_POLICIES_PER_LISTING uint) } (wrapped list in a tuple)
(define-map policies-by-owner
  principal
  { ids: (list 100 uint) }
)

;; Index to retrieve all policies expiring at a specific block height.
;; This is crucial for batch processing of expirations.
;; Key: uint (expiration block height)
;; Value: { ids: (list MAX_POLICIES_PER_LISTING uint) } (wrapped list in a tuple)
(define-map policies-by-expiration-height
  uint
  { ids: (list 100 uint) }
)

;; --- Public Functions ---

;; --- Admin Functions (PR-102) ---

(define-public (set-liquidity-pool-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set liquidity-pool-principal (some new-principal))
    (ok true)
  )
)

(define-public (set-math-library-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set math-library-principal (some new-principal))
    (ok true)
  )
)

(define-public (set-price-oracle-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set price-oracle-principal (some new-principal))
    (ok true)
  )
)

(define-public (set-parameters-contract-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set parameters-contract-principal (some new-principal))
    (ok true)
  )
)

;; --- Policy Creation Function (PR-103, PR-301, PR-302) - PR-304: Gas optimized ---
(define-public (create-protection-policy
    (policy-owner-principal principal) ;; Can be tx-sender or specified if called by another contract on behalf of user
    (policy-type (string-ascii 8)) ;; e.g., "PUT", "CALL"
    (risk-tier (string-ascii 32)) ;; e.g., "Conservative", needs validation against ParametersContract eventually
    (protected-asset-name (string-ascii 10)) ;; e.g., "BTC"
    (collateral-token-name (string-ascii 32)) ;; e.g., "STX", or sBTC contract principal as string for SIP010 tokens
    (protected-value-scaled uint) ;; Strike price, scaled (e.g., by ONE_8 for USD value)
    (protection-amount-scaled uint) ;; Notional amount of asset, scaled (e.g., by asset's own precision like satoshis, or ONE_8 if it's a value equivalent)
    (expiration-height uint) ;; Target block height for expiration
    (submitted-premium-scaled uint) ;; Premium offered by the user for the policy, in collateral-token-name units, scaled
  )
  (begin
    ;; PR-304: Optimized validation - group related validations together and fail fast
    ;; 1. Basic input validation first (most likely to fail)
    (asserts! (not (is-eq policy-owner-principal contract-caller))
      ERR-UNAUTHORIZED
    )
    (asserts! (or (is-eq policy-type "PUT") (is-eq policy-type "CALL"))
      ERR-INVALID-POLICY-TYPE
    )
    (asserts!
      (and
        (> (len risk-tier) u0)
        (> (len protected-asset-name) u0)
        (> (len collateral-token-name) u0)
      )
      ERR-EMPTY-RISK-TIER
    )
    (asserts!
      (and
        (> protected-value-scaled u0)
        (> protection-amount-scaled u0)
        (> submitted-premium-scaled u0)
        (> expiration-height burn-block-height)
      )
      ERR-ZERO-PROTECTED-VALUE
    )
    ;; 2. Retrieve all required contract principals once (PR-304: prevents multiple unwrap! operations)
    (let ((contracts {
        lp: (unwrap! (var-get liquidity-pool-principal) ERR-LP-PRINCIPAL-NOT-SET),
        math: (unwrap! (var-get math-library-principal) ERR-MATH-PRINCIPAL-NOT-SET),
        oracle: (unwrap! (var-get price-oracle-principal) ERR-ORACLE-PRINCIPAL-NOT-SET),
        params: (unwrap! (var-get parameters-contract-principal)
          ERR-PARAMS-PRINCIPAL-NOT-SET
        ),
      }))
      ;; 3. PR-304: Get all parameters in a single scope to reduce nesting and improve readability
      (let ((params-result (get-creation-parameters (get params contracts) risk-tier)))
        (match params-result
          params-map (let (
              (max-price-age-blocks (get max-price-age params-map))
              (risk-tier-params (get risk-tier-params params-map))
              (min-policy-duration (get min-duration params-map))
              (max-policy-duration (get max-duration params-map))
              (min-protection-value (get min-protection params-map))
              (max-protection-value (get max-protection params-map))
              (min-submitted-premium (get min-premium params-map))
              (max-policies-per-user (get max-policies params-map))
              (risk-tier-type (get tier-type risk-tier-params))
              (risk-tier-is-active (get is-active risk-tier-params))
              (risk-tier-premium-adjustment-bp (get premium-adjustment-basis-points risk-tier-params))
              (risk-tier-collateral-ratio-bp (get collateral-ratio-basis-points risk-tier-params))
              (policy-duration (- expiration-height burn-block-height))
              (owner-policies-count (get-owner-policy-count policy-owner-principal))
            )
            ;; 4. PR-304: Combined validation for all parameter-based checks
            (try! (validate-policy-parameters policy-duration min-policy-duration
              max-policy-duration protected-value-scaled min-protection-value
              max-protection-value submitted-premium-scaled
              min-submitted-premium owner-policies-count max-policies-per-user
              risk-tier-type
            ))
            ;; 5. Fetch oracle price and validate freshness
            (let ((oracle-result (contract-call? (get oracle contracts) get-current-bitcoin-price)))
              (match oracle-result
                price-response (let (
                    (current-oracle-price (get price price-response))
                    (oracle-price-timestamp (get timestamp price-response))
                  )
                  ;; PR-210: Oracle Price Freshness Check
                  (asserts!
                    (<= (- burn-block-height oracle-price-timestamp)
                      max-price-age-blocks
                    )
                    ERR-ORACLE-PRICE-TOO-STALE
                  )
                  ;; 6. Premium verification (ML-201)
                  (try! (contract-call? (get math contracts) verify-submitted-premium
                    submitted-premium-scaled protected-value-scaled
                    protection-amount-scaled burn-block-height
                    expiration-height policy-type current-oracle-price
                    risk-tier-is-active risk-tier-premium-adjustment-bp
                  ))
                  ;; 7. PR-304: Calculate required collateral in a single operation
                  (let ((required-collateral-scaled (/ (* protection-amount-scaled risk-tier-collateral-ratio-bp)
                      BASIS_POINTS_DENOMINATOR
                    )))
                    ;; Debug event
                    (print {
                      event: "collateral-calculation",
                      block-height: burn-block-height,
                      protection-amount: protection-amount-scaled,
                      collateral-ratio-bp: risk-tier-collateral-ratio-bp,
                      required-collateral: required-collateral-scaled,
                    })
                    ;; 8. Check liquidity once
                    (try! (contract-call? (get lp contracts) check-liquidity
                      required-collateral-scaled collateral-token-name
                      risk-tier expiration-height
                    ))
                    ;; 9. Get policy ID once
                    (let ((new-policy-id (unwrap! (consume-next-policy-id)
                        ERR-POLICY-ID-COUNTER-OVERFLOW
                      )))
                      ;; 10. Lock collateral and record premium in sequence
                      (try! (contract-call? (get lp contracts) lock-collateral
                        new-policy-id required-collateral-scaled
                        collateral-token-name risk-tier expiration-height
                        policy-owner-principal
                      ))
                      (try! (contract-call? (get lp contracts) record-premium-payment
                        new-policy-id submitted-premium-scaled
                        collateral-token-name expiration-height
                        policy-owner-principal
                      ))
                      ;; 11. PR-304: Create policy record once with all data
                      (store-policy-and-update-indices new-policy-id
                        policy-owner-principal policy-type risk-tier
                        protected-asset-name collateral-token-name
                        protected-value-scaled protection-amount-scaled
                        submitted-premium-scaled required-collateral-scaled
                        burn-block-height expiration-height
                      )
                    )
                  )
                )
                error-val (err ERR-ORACLE-CALL-FAILED-PR)
              )
            )
          )
          error-val
          error-val
        )
      )
    )
  )
)

;; PR-304: Helper function to get all parameters needed for policy creation
(define-private (get-creation-parameters
    (params-principal principal)
    (risk-tier-name (string-ascii 32))
  )
  (let (
      (max-price-age-result (contract-call? params-principal get-system-parameter-uint
        "config.oracle.max-price-age-blocks"
      ))
      (risk-tier-result (contract-call? params-principal get-risk-tier-parameters risk-tier-name))
      (min-duration-result (contract-call? params-principal get-system-parameter-uint
        "config.policy.min-duration-blocks"
      ))
      (max-duration-result (contract-call? params-principal get-system-parameter-uint
        "config.policy.max-duration-blocks"
      ))
      (min-protection-result (contract-call? params-principal get-system-parameter-uint
        "config.policy.min-protection-value-usd"
      ))
      (max-protection-result (contract-call? params-principal get-system-parameter-uint
        "config.policy.max-protection-value-usd"
      ))
      (min-premium-result (contract-call? params-principal get-system-parameter-uint
        "config.policy.min-submitted-premium-usd"
      ))
      (max-policies-result (contract-call? params-principal get-system-parameter-uint
        "limits.user.max-policies"
      ))
    )
    (match risk-tier-result
      risk-tier-params (ok {
        max-price-age: (default-to u100
          (match max-price-age-result
            value
            value
            none
          )),
        risk-tier-params: risk-tier-params,
        min-duration: (default-to u100
          (match min-duration-result
            value
            value
            none
          )),
        max-duration: (default-to u10000
          (match max-duration-result
            value
            value
            none
          )),
        min-protection: (default-to u1000000
          (match min-protection-result
            value
            value
            none
          )),
        max-protection: (default-to u10000000000
          (match max-protection-result
            value
            value
            none
          )),
        min-premium: (default-to u10000
          (match min-premium-result
            value
            value
            none
          )),
        max-policies: (default-to u10
          (match max-policies-result
            value
            value
            none
          )),
      })
      error-val (err ERR-PARAMS-CALL-FAILED-PR)
    )
  )
)

;; PR-304: Helper function to validate all policy parameters in one place
(define-private (validate-policy-parameters
    (policy-duration uint)
    (min-policy-duration uint)
    (max-policy-duration uint)
    (protected-value-scaled uint)
    (min-protection-value uint)
    (max-protection-value uint)
    (submitted-premium-scaled uint)
    (min-submitted-premium uint)
    (owner-policies-count uint)
    (max-policies-per-user uint)
    (risk-tier-type (string-ascii 16))
  )
  (begin
    ;; PR-301: Verify risk tier is of type "BUYER"
    (asserts! (is-eq risk-tier-type "BUYER") (err ERR-RISK-TIER-DATA-INVALID-PR))
    ;; Validate policy duration within limits
    (asserts! (>= policy-duration min-policy-duration)
      (err ERR-MINIMUM-REQUIREMENT-NOT-MET)
    )
    (asserts! (<= policy-duration max-policy-duration)
      (err ERR-MAXIMUM-LIMIT-REACHED)
    )
    ;; Validate protection value within limits
    (asserts! (>= protected-value-scaled min-protection-value)
      (err ERR-AMOUNT-TOO-LOW)
    )
    (asserts! (<= protected-value-scaled max-protection-value)
      (err ERR-AMOUNT-TOO-HIGH)
    )
    ;; Validate minimum submitted premium
    (asserts! (>= submitted-premium-scaled min-submitted-premium)
      (err ERR-AMOUNT-TOO-LOW)
    )
    ;; PR-302: Verify user hasn't exceeded their policy limit
    (asserts! (< owner-policies-count max-policies-per-user)
      (err ERR-POLICY-LIMIT-EXCEEDED)
    )
    (ok true)
  )
)

;; PR-304: Helper function to get a user's policy count
(define-private (get-owner-policy-count (owner principal))
  (let (
      (owner-policy-map-entry (default-to { ids: (list) } (map-get? policies-by-owner owner)))
      (owner-policies-list (get ids owner-policy-map-entry))
    )
    (len owner-policies-list)
  )
)

;; PR-304: Helper function to store policy and update indexes
(define-private (store-policy-and-update-indices
    (policy-id uint)
    (policy-owner-principal principal)
    (policy-type (string-ascii 8))
    (risk-tier (string-ascii 32))
    (protected-asset-name (string-ascii 10))
    (collateral-token-name (string-ascii 32))
    (protected-value-scaled uint)
    (protection-amount-scaled uint)
    (submitted-premium-scaled uint)
    (required-collateral-scaled uint)
    (current-block-height uint)
    (expiration-height uint)
  )
  (begin
    ;; Store policy record
    (map-set policies policy-id {
      policy-owner: policy-owner-principal,
      policy-type: policy-type,
      risk-tier: risk-tier,
      protected-asset: protected-asset-name,
      collateral-token: collateral-token-name,
      protected-value: protected-value-scaled,
      protection-amount: protection-amount-scaled,
      submitted-premium: submitted-premium-scaled,
      collateral-locked: required-collateral-scaled,
      creation-height: current-block-height,
      expiration-height: expiration-height,
      settlement-height: none,
      status: STATUS-ACTIVE,
      price-at-expiration: none,
      settlement-amount-paid: none,
    })
    ;; Update owner index
    (let (
        (owner-policy-map-entry (default-to { ids: (list) }
          (map-get? policies-by-owner policy-owner-principal)
        ))
        (owner-policies-list (get ids owner-policy-map-entry))
      )
      ;; Check if adding a new item would exceed the maximum allowed
      (if (>= (len owner-policies-list) MAX_POLICIES_PER_LISTING)
        (err ERR-OWNER_POLICY_LIST_FULL)
        (map-set policies-by-owner policy-owner-principal { ids: (unwrap-panic (as-max-len? (append owner-policies-list policy-id)
          MAX_POLICIES_PER_LISTING
        )) }
        )
      )
    )
    ;; Update expiration index
    (let (
        (exp-height-policy-map-entry (default-to { ids: (list) }
          (map-get? policies-by-expiration-height expiration-height)
        ))
        (exp-height-policies-list (get ids exp-height-policy-map-entry))
      )
      ;; Check if adding a new item would exceed the maximum allowed
      (if (>= (len exp-height-policies-list) MAX_POLICIES_PER_LISTING)
        (err ERR-EXPIRATION_POLICY_LIST_FULL)
        (map-set policies-by-expiration-height expiration-height { ids: (unwrap-panic (as-max-len? (append exp-height-policies-list policy-id)
          MAX_POLICIES_PER_LISTING
        )) }
        )
      )
    )
    ;; Emit creation event
    (print {
      event: "policy-created",
      block-height: current-block-height,
      policy-id: policy-id,
      owner-principal: policy-owner-principal,
      policy-type: policy-type,
      risk-tier: risk-tier,
      protected-asset: protected-asset-name,
      collateral-token: collateral-token-name,
      protected-value-scaled: protected-value-scaled,
      protection-amount-scaled: protection-amount-scaled,
      submitted-premium-scaled: submitted-premium-scaled,
      required-collateral-scaled: required-collateral-scaled,
      expiration-height: expiration-height,
      status: STATUS-ACTIVE,
    })
    (ok policy-id)
  )
)

;; --- Read Only Functions ---

;; --- Admin Getters (PR-102) ---
(define-read-only (get-liquidity-pool-principal)
  (var-get liquidity-pool-principal)
)

(define-read-only (get-math-library-principal)
  (var-get math-library-principal)
)

(define-read-only (get-price-oracle-principal)
  (var-get price-oracle-principal)
)

(define-read-only (get-parameters-contract-principal)
  (var-get parameters-contract-principal)
)

;; --- Policy ID Counter Getter (PR-102) ---
(define-read-only (get-next-policy-id-debug)
  ;; Returns the next policy ID that will be assigned.
  (ok (var-get policy-id-counter))
)

;; --- Policy Data Getters (PR-106) ---

;; Retrieves the full policy data structure for a given policy ID.
(define-read-only (get-policy (policy-id uint))
  (match (map-get? policies policy-id)
    policy-tuple (ok policy-tuple)
    (err ERR-POLICY-NOT-FOUND)
  )
)

;; Retrieves the current status of a given policy ID.
(define-read-only (get-policy-status (policy-id uint))
  (match (map-get? policies policy-id)
    policy-tuple (ok (get status policy-tuple))
    (err ERR-POLICY-NOT-FOUND)
  )
)

;; Retrieves the list of policy IDs associated with a given owner.
(define-read-only (get-policies-by-owner (owner principal))
  (ok (get ids (default-to { ids: (list) } (map-get? policies-by-owner owner))))
)

;; Retrieves the list of policy IDs expiring at a given block height.
(define-read-only (get-policies-by-expiration-height (height uint))
  (ok (get ids
    (default-to { ids: (list) } (map-get? policies-by-expiration-height height))
  ))
)

;; Retrieves the total number of policies created (value of the next ID to be assigned).
(define-read-only (get-total-policies-created)
  (ok (var-get policy-id-counter))
)

;; --- Private Functions ---

;; --- Policy ID Counter Logic (PR-102) ---
(define-private (consume-next-policy-id)
  (let ((current-id (var-get policy-id-counter)))
    ;; Basic overflow check - uint max is large, but good practice to consider.
    ;; For now, simple increment. A more robust check could involve `UINT-MAX` from a param contract.
    (asserts! (< current-id u4294967295) ERR-POLICY-ID-COUNTER-OVERFLOW)
    (var-set policy-id-counter (+ current-id u1))
    (ok current-id)
  )
)

;; --- Policy Status Update Logic (PR-104) ---
(define-private (update-policy-status
    (policy-id uint)
    (new-status (string-ascii 20))
  )
  (let ((existing-policy-optional (map-get? policies policy-id)))
    (asserts! (is-some existing-policy-optional) ERR-POLICY-NOT-FOUND)
    (let ((existing-policy (unwrap-panic existing-policy-optional)))
      ;; TODO: Implement robust status transition validation here in later phases.
      ;; For now, any valid new status string can be set.
      (map-set policies policy-id (merge existing-policy { status: new-status }))
      (print {
        event: "policy-status-updated",
        block-height: burn-block-height,
        policy-id: policy-id,
        old-status: (get status existing-policy),
        new-status: new-status,
      })
      (ok true)
    )
  )
)

;; --- Errors for PR-201 and related flows ---
(define-constant ERR-POLICY-NOT-YET-EXPIRED (err u200))
(define-constant ERR-POLICY-INVALID-STATE-FOR-EXPIRATION (err u201))
(define-constant ERR-ORACLE-CALL-FAILED (err u202))
(define-constant ERR-MATH-CALL-FAILED (err u203))
(define-constant ERR-LP-SETTLEMENT-CALL-FAILED (err u204))

;; Errors for PR-207: distribute-premium
(define-constant ERR-POLICY-NOT-OTM (err u206))
(define-constant ERR-POLICY-NOT-PENDING-PREMIUM-DISTRIBUTION (err u207))
(define-constant ERR-LP-PREMIUM-DISTRIBUTION-FAILED (err u208))

;; PR-204: policy-settlements map
;; Stores detailed settlement records for policies.
(define-map policy-settlements
  uint
  {
    expiration-price-scaled: uint, ;; Price from oracle at expiration
    settlement-amount-scaled: uint, ;; Calculated settlement amount
    settlement-processing-height: uint, ;; Block height when this record was made
    settled-by: principal, ;; tx-sender who initiated this processing
  }
)

;; PR-205: pending-premium-distributions map
;; Tracks policies that are OTM and awaiting premium distribution.
(define-map pending-premium-distributions
  uint
  bool
)

;; policy-id -> true if pending

;; Private helper for processing a single policy given an explicit expiration price
(define-private (priv-process-one-policy-at-expiration
    (policy-id uint)
    (price-for-settlement uint)
  )
  (let (
      (policy (unwrap! (map-get? policies policy-id) ERR-POLICY-NOT-FOUND))
      (policy-owner (get policy-owner policy))
      (policy-protected-value (get protected-value policy))
      (policy-protection-amount (get protection-amount policy))
      (policy-expiration-height (get expiration-height policy))
      (policy-type (get policy-type policy))
      (policy-status (get status policy))
      (policy-collateral-token (get collateral-token policy))
      (current-height burn-block-height)
      ;; For contract calls below
      (actual-math-principal (unwrap! (var-get math-library-principal) ERR-MATH-PRINCIPAL-NOT-SET))
      (actual-lp-principal (unwrap! (var-get liquidity-pool-principal) ERR-LP-PRINCIPAL-NOT-SET))
    )
    ;; Validations for policy status and if it has already expired by its own height vs current block height
    (asserts! (<= policy-expiration-height current-height)
      ERR-POLICY-NOT-YET-EXPIRED
    )
    ;; Ensures policy is due
    (asserts! (is-eq policy-status STATUS-ACTIVE)
      ERR-POLICY-INVALID-STATE-FOR-EXPIRATION
    )
    ;; 3. Calculating Settlement Amount (ML-202 dependency)
    (let ((settlement-amount-scaled (unwrap!
        (contract-call? actual-math-principal calculate-settlement-amount
          policy-protected-value policy-protection-amount price-for-settlement
          ;; Use provided price policy-type
        )
        ERR-MATH-CALL-FAILED
      )))
      (if (> settlement-amount-scaled u0)
        ;; Policy is In-The-Money (ITM)
        (begin
          (try! (update-policy-status policy-id STATUS-PENDING-SETTLEMENT))
          (map-set policy-settlements policy-id {
            expiration-price-scaled: price-for-settlement,
            settlement-amount-scaled: settlement-amount-scaled,
            settlement-processing-height: current-height,
            settled-by: tx-sender,
          })
          (match (contract-call? actual-lp-principal process-settlement-at-expiration
            policy-id settlement-amount-scaled policy-collateral-token
            policy-owner
          )
            success-lp-settlement (begin
              (try! (update-policy-status policy-id STATUS-SETTLED-ITM))
              (print {
                event: "policy-expiration-processed-itm",
                block-height: current-height,
                policy-id: policy-id,
                status: STATUS-SETTLED-ITM,
                expiration-price-scaled: price-for-settlement,
                settlement-amount-scaled: settlement-amount-scaled,
              })
              (ok true) ;; Indicate ITM success
            )
            error-lp-settlement (begin
              (print {
                event: "policy-expiration-lp-settlement-failed",
                block-height: current-height,
                policy-id: policy-id,
                status: STATUS-PENDING-SETTLEMENT,
                error: error-lp-settlement,
              })
              (err ERR-LP-SETTLEMENT-CALL-FAILED)
            )
          )
        )
        ;; Policy is Out-of-The-Money (OTM)
        (begin
          (try! (update-policy-status policy-id STATUS-EXPIRED-OTM))
          (map-set policy-settlements policy-id {
            expiration-price-scaled: price-for-settlement,
            settlement-amount-scaled: u0,
            settlement-processing-height: current-height,
            settled-by: tx-sender,
          })
          (map-set pending-premium-distributions policy-id true)
          (print {
            event: "policy-expiration-processed-otm",
            block-height: current-height,
            policy-id: policy-id,
            status: STATUS-EXPIRED-OTM,
            expiration-price-scaled: price-for-settlement,
          })
          (ok false) ;; Indicate OTM success (boolean to differentiate from ITM for fold accumulator)
        )
      )
    )
  )
)

;; PR-201: Implement process-single-policy-at-expiration (Refactored)
(define-public (process-single-policy-at-expiration (policy-id uint))
  (let (
      (policy (unwrap! (map-get? policies policy-id) ERR-POLICY-NOT-FOUND))
      (policy-status (get status policy))
      (policy-expiration-height (get expiration-height policy))
      (current-height burn-block-height)
    )
    (asserts! (not (is-eq policy-status STATUS-SETTLED))
      ERR-POLICY-ALREADY-PROCESSED
    )
    (asserts! (not (is-eq policy-status STATUS-EXPIRED-OTM))
      ERR-POLICY-ALREADY-PROCESSED
    )
    (asserts! (>= current-height policy-expiration-height)
      ERR-POLICY-NOT-YET-EXPIRED
    )
    (asserts! (is-eq policy-status STATUS-ACTIVE)
      ERR-POLICY-INVALID-STATE-FOR-EXPIRATION
    )
    ;; Step 1: Fetch the actual expiration price from the oracle for this specific policy's expiration.
    (let ((actual-oracle-principal (unwrap! (var-get price-oracle-principal) ERR-ORACLE-PRINCIPAL-NOT-SET)))
      (let ((expiration-price-response (contract-call? actual-oracle-principal get-bitcoin-price-at-height
          policy-expiration-height
        )))
        (match expiration-price-response
          price-tuple (let ((expiration-price-scaled (get price price-tuple)))
            ;; Assuming the tuple is {price: uint, ...}
            ;; Now call the internal processing function with the fetched price
            (priv-process-one-policy-at-expiration policy-id
              expiration-price-scaled
            )
          )
          error-val (begin
            (print {
              event: "single-policy-expiration-oracle-error",
              message: "Failed to get price from oracle for policy expiration.",
              policy-id: policy-id,
              error: error-val,
            })
            (err ERR-ORACLE-CALL-FAILED)
          )
        )
      )
    )
  )
)

;; PR-304: Optimized batch processing of expiration in chunks with improved gas efficiency
(define-public (process-expiration-batch
    (expiration-height-to-process uint)
    (start-index uint) ;; PR-303: Start index for continuing a large batch
  )
  (let (
      ;; PR-304: Get principals only once and use a structured object
      (contracts {
        oracle: (unwrap! (var-get price-oracle-principal) ERR-ORACLE-PRINCIPAL-NOT-SET),
        params: (unwrap! (var-get parameters-contract-principal)
          ERR-PARAMS-PRINCIPAL-NOT-SET
        ),
      })
      ;; Get policies for this expiration
      (policy-ids-list-optional (map-get? policies-by-expiration-height expiration-height-to-process))
      ;; PR-304: Get batch size parameter once
      (batch-size-param-result (contract-call? (get params contracts) get-system-parameter-uint
        "config.batch.size-expiration"
      ))
      (batch-size (default-to u10
        (match batch-size-param-result
          value
          value
          none
        )))
    )
    ;; Handle case where no policies exist for this expiration
    (if (is-none policy-ids-list-optional)
      (begin
        (print {
          event: "batch-expiration-processed-info",
          message: "No policies found for this expiration height",
          height: expiration-height-to-process,
        })
        (ok {
          processed-count: u0,
          itm-count: u0,
          otm-count: u0,
          error-count: u0,
          more-to-process: false,
          next-index: u0,
        })
      )
      ;; Policies exist, process a batch
      (let (
          (policy-ids (get ids (unwrap-panic policy-ids-list-optional)))
          (total-policies (len policy-ids))
          (current-block-height burn-block-height)
        )
        ;; Validate start index
        (asserts! (<= start-index total-policies)
          (err ERR-BATCH-START-INDEX-INVALID)
        )
        ;; PR-304: Fetch price ONCE for the entire batch
        (let ((batch-price-response (contract-call? (get oracle contracts) get-bitcoin-price-at-height
            expiration-height-to-process
          )))
          (match batch-price-response
            price-tuple (let (
                ;; Calculate batch boundaries
                (end-index (if (> (+ start-index batch-size) total-policies)
                  total-policies
                  (+ start-index batch-size)
                ))
                (more-to-process (< end-index total-policies))
                ;; Extract the batch price once
                (batch-price-scaled (get price price-tuple))
                ;; PR-304: Get the batch slice of policies to process
                (batch-policy-ids (slice? policy-ids start-index end-index))
              )
              ;; PR-304: Create initial accumulator with all necessary data
              (let ((result (process-batch-with-fixed-price
                  (default-to (list) batch-policy-ids) batch-price-scaled
                  current-block-height {
                  processed-count: u0,
                  itm-count: u0,
                  otm-count: u0,
                  error-count: u0,
                })))
                ;; Return results with continuation data
                (ok (merge result {
                  more-to-process: more-to-process,
                  next-index: end-index,
                }))
              )
            )
            error-val (begin
              (print {
                event: "batch-expiration-oracle-error",
                message: "Failed to get batch price from oracle.",
                height: expiration-height-to-process,
                error: error-val,
              })
              (err ERR-ORACLE-CALL-FAILED)
            )
          )
        )
      )
    )
  )
)

;; PR-304: Optimized batch processing helper that uses a fixed price for all policies
(define-private (process-batch-with-fixed-price
    (policy-ids (list 100 uint))
    (batch-price-scaled uint)
    (event-height uint)
    (accumulator {
      processed-count: uint,
      itm-count: uint,
      otm-count: uint,
      error-count: uint,
    })
  )
  ;; Using fold for more efficient iteration
  (fold process-policy-with-price policy-ids accumulator batch-price-scaled
    event-height
  )
)

;; PR-304: Lower-level helper that processes a single policy with the provided price
(define-private (process-policy-with-price
    (policy-id uint)
    (accumulator {
      processed-count: uint,
      itm-count: uint,
      otm-count: uint,
      error-count: uint,
    })
    (batch-price uint)
    (event-height uint)
  )
  (match (priv-process-one-policy-at-expiration policy-id batch-price)
    success-result (let ((is-itm (unwrap-panic success-result)))
      (if is-itm
        ;; ITM case
        (merge accumulator {
          processed-count: (+ u1 (get processed-count accumulator)),
          itm-count: (+ u1 (get itm-count accumulator)),
        })
        ;; OTM case
        (merge accumulator {
          processed-count: (+ u1 (get processed-count accumulator)),
          otm-count: (+ u1 (get otm-count accumulator)),
        })
      )
    )
    error-val (begin
      (print {
        event: "batch-expiration-policy-error",
        block-height: event-height,
        policy-id: policy-id,
        error: (err-get error-val),
      })
      (merge accumulator {
        processed-count: (+ u1 (get processed-count accumulator)),
        error-count: (+ u1 (get error-count accumulator)),
      })
    )
  )
)

;; PR-207: Implement distribute-premium for a single OTM policy
(define-public (distribute-premium (policy-id uint))
  (let (
      (policy (unwrap! (map-get? policies policy-id) ERR-POLICY-NOT-FOUND))
      (policy-status (get status policy))
      (is-pending-distribution (unwrap! (map-get? pending-premium-distributions policy-id)
        ERR-POLICY-NOT-PENDING-PREMIUM-DISTRIBUTION
      ))
      (actual-lp-principal (unwrap! (var-get liquidity-pool-principal) ERR-LP-PRINCIPAL-NOT-SET))
      (submitted-premium (get submitted-premium policy))
      (collateral-token (get collateral-token policy))
    )
    ;; 1. Validate policy status and pending distribution flag
    (asserts! (is-eq policy-status STATUS-EXPIRED-OTM) ERR-POLICY-NOT-OTM)
    (asserts! is-pending-distribution ERR-POLICY-NOT-PENDING-PREMIUM-DISTRIBUTION)
    ;; ensure it's true
    ;; 2. Call Liquidity Pool to distribute premiums
    (match (contract-call? actual-lp-principal distribute-premium-to-providers policy-id
      submitted-premium collateral-token
    )
      success-lp-distribution (begin
        ;; 3. Update pending distribution status
        (map-set pending-premium-distributions policy-id false) ;; Mark as processed
        ;; 4. Emit event
        (print {
          event: "policy-premium-distributed",
          block-height: burn-block-height,
          policy-id: policy-id,
          premium-amount-distributed: submitted-premium,
          token-id: collateral-token,
        })
        (ok true)
      )
      error-lp-distribution (begin
        (print {
          event: "policy-premium-distribution-failed",
          block-height: burn-block-height,
          policy-id: policy-id,
          error: error-lp-distribution,
        })
        (err ERR-LP-PREMIUM-DISTRIBUTION-FAILED)
      )
    )
  )
)

;; PR-305: Enhanced batch premium distribution with PR-304 gas optimizations
(define-public (distribute-premium-batch
    (start-index uint)
    (max-count uint)
  )
  (let (
      ;; PR-304: Get contract principals once using a map structure
      (contracts {
        params: (unwrap! (var-get parameters-contract-principal)
          ERR-PARAMS-PRINCIPAL-NOT-SET
        ),
        lp: (unwrap! (var-get liquidity-pool-principal) ERR-LP-PRINCIPAL-NOT-SET),
      })
      ;; PR-304: Fetch batch size parameter once
      (batch-size-param-result (contract-call? (get params contracts) get-system-parameter-uint
        "config.batch.size-premium-dist"
      ))
      (batch-size (default-to u10
        (match batch-size-param-result
          value
          value
          none
        )))
      ;; PR-304: Determine effective batch size once
      (effective-batch-size (if (> max-count u0)
        (if (< max-count batch-size)
          max-count
          batch-size
        )
        batch-size
      ))
      ;; PR-304: Get total pending premiums once
      (policies-count (get-pending-premium-distribution-count))
    )
    ;; Process a batch of premiums
    (if (> policies-count u0)
      (process-premium-batch-with-contracts contracts start-index
        effective-batch-size policies-count
      )
      (begin
        (print {
          event: "premium-batch-distribution-info",
          message: "No pending premium distributions found",
          block-height: burn-block-height,
        })
        (ok {
          processed-count: u0,
          success-count: u0,
          error-count: u0,
          more-to-process: false,
          next-index: u0,
        })
      )
    )
  )
)

;; PR-304: Helper to process a batch of premiums with contract references
(define-private (process-premium-batch-with-contracts
    (contracts {
      params: principal,
      lp: principal,
    })
    (start-index uint)
    (batch-size uint)
    (total-policies uint)
  )
  ;; Validate start index
  (asserts! (<= start-index total-policies) (err ERR-BATCH-START-INDEX-INVALID))
  ;; PR-304: Calculate batch boundaries once
  (let (
      (end-index (if (> (+ start-index batch-size) total-policies)
        total-policies
        (+ start-index batch-size)
      ))
      (more-to-process (< end-index total-policies))
    )
    ;; Process all premiums in the batch
    (let ((result (process-pending-premium-batch start-index end-index total-policies
        (get lp contracts)
      )))
      ;; Return results with continuation data
      (match result
        success-map (ok (merge success-map {
          more-to-process: more-to-process,
          next-index: end-index,
        }))
        error-val
        error-val
      )
    )
  )
)

;; PR-304: Optimized helper to process pending premiums in a range
(define-private (process-pending-premium-batch
    (start-index uint)
    (end-index uint)
    (total-policies uint)
    (lp-principal principal)
  )
  ;; Initialize accumulator
  (let ((initial-acc {
      processed-count: u0,
      success-count: u0,
      error-count: u0,
    }))
    ;; Find all pending policies and process those in our range
    (let ((policies (get-pending-premium-policies)))
      (if (is-some policies)
        ;; Process policies in our range
        (let ((policy-ids (unwrap-panic policies)))
          (if (>= start-index (len policy-ids))
            (ok initial-acc) ;; No policies to process in this range
            ;; Get the slice of policy IDs for this batch
            (let ((batch-policy-ids (slice? policy-ids start-index end-index)))
              (fold process-single-premium (default-to (list) batch-policy-ids)
                initial-acc lp-principal
              )
            )
          )
        )
        (ok initial-acc) ;; No pending policies
      )
    )
  )
)

;; PR-304: Helper to process a single premium
(define-private (process-single-premium
    (policy-id uint)
    (acc {
      processed-count: uint,
      success-count: uint,
      error-count: uint,
    })
    (lp-principal principal)
  )
  (begin
    ;; Check if policy is marked for premium distribution
    (match (get-pending-premium-distribution policy-id)
      is-pending
      (if is-pending
        ;; Try to distribute the premium
        (match (distribute-premium policy-id lp-principal)
          success-value (merge acc {
            processed-count: (+ u1 (get processed-count acc)),
            success-count: (+ u1 (get success-count acc)),
          })
          error-val (begin
            (print {
              event: "premium-distribution-error",
              block-height: burn-block-height,
              policy-id: policy-id,
              error: error-val,
            })
            (merge acc {
              processed-count: (+ u1 (get processed-count acc)),
              error-count: (+ u1 (get error-count acc)),
            })
          )
        )
        ;; Not marked for premium distribution
        acc
      )
      none
      ;; Policy not found
      acc
    )
  )
)

;; PR-304: Helper to check if a policy is marked for premium distribution
(define-private (get-pending-premium-distribution (policy-id uint))
  (map-get? pending-premium-distributions policy-id)
)

;; PR-304: Helper to get all pending premium policy IDs
(define-private (get-pending-premium-policies)
  ;; This is a placeholder - in a real implementation, you would have a list of policy IDs
  ;; to iterate over. This is a high-gas operation and would need further optimization.
  (map-keys pending-premium-distributions)
)

;; PR-304: Helper to get total number of pending premium distributions
(define-private (get-pending-premium-distribution-count)
  (match (get-pending-premium-policies)
    policies (len policies)
    u0
  )
)

;; PR-304: Helper to distribute a single premium 
(define-private (distribute-premium
    (policy-id uint)
    (lp-principal principal)
  )
  ;; Call the original distribute-premium function
  (let ((result (distribute-premium-internal policy-id)))
    ;; If successful, mark the policy as processed in our tracking
    (if (is-ok result)
      (begin
        (map-set pending-premium-distributions policy-id false)
        result
      )
      result
    )
  )
)

;; PR-304: Internal function to encapsulate the existing distribute-premium logic
(define-private (distribute-premium-internal (policy-id uint))
  (let (
      (actual-lp-principal (unwrap! (var-get liquidity-pool-principal) ERR-LP-PRINCIPAL-NOT-SET))
      (policy-option (map-get? policies policy-id))
    )
    (match policy-option
      policy-map (let (
          (policy-status (get status policy-map))
          (policy-type (get policy-type policy-map))
          ;; No need to use protected-value or oracle call for OTM premium distribution
          (policy-premium (get submitted-premium policy-map))
          (policy-owner (get policy-owner policy-map))
          (collateral-token (get collateral-token policy-map))
        )
        ;; Verify policy is OTM and pendingPremiumDistribution
        (asserts! (is-eq policy-status STATUS-EXPIRED-OTM) ERR-POLICY-NOT-OTM)
        (asserts!
          (default-to false (map-get? pending-premium-distributions policy-id))
          ERR-POLICY-NOT-PENDING-PREMIUM-DISTRIBUTION
        )
        ;; Call LP contract to distribute the premium
        (match (contract-call? actual-lp-principal distribute-premium-to-providers
          policy-id policy-premium collateral-token
        )
          success-value (begin
            ;; Update tracking map
            (map-set pending-premium-distributions policy-id false)
            ;; Emit event
            (print {
              event: "premium-distributed",
              block-height: burn-block-height,
              policy-id: policy-id,
              premium-amount: policy-premium,
              token-id: collateral-token,
            })
            (ok true)
          )
          error-val (err ERR-LP-PREMIUM-DISTRIBUTION-FAILED)
        )
      )
      (err ERR-POLICY-NOT-FOUND)
    )
  )
)

;; PR-305: Helper function for simplified batch distribution (starts from beginning)
(define-public (distribute-premium-batch-simple (max-count uint))
  (distribute-premium-batch u0 max-count)
)

;; PR-303: Helper function for simplified batch processing (backward compatibility)
(define-public (process-expiration-batch-simple (expiration-height-to-process uint))
  (process-expiration-batch expiration-height-to-process u0)
)

(print { message: "BitHedgePolicyRegistryContract updated for PR-102, PR-103, PR-104, PR-106, PR-301, PR-302, PR-303, PR-304, and PR-305." })
