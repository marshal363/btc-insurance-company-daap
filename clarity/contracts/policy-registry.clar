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

;; --- Policy Creation Function (PR-103) ---
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
    ;; 1. Retrieve Contract Principals (PR-102 dependency)
    (let ((lp-principal (unwrap! (var-get liquidity-pool-principal) ERR-LP-PRINCIPAL-NOT-SET)))
      (let ((math-contract (unwrap! (var-get math-library-principal) ERR-MATH-PRINCIPAL-NOT-SET)))
        (let ((oracle-contract (unwrap! (var-get price-oracle-principal) ERR-ORACLE-PRINCIPAL-NOT-SET)))
          (let ((params-contract (unwrap! (var-get parameters-contract-principal)
              ERR-PARAMS-PRINCIPAL-NOT-SET
            )))
            ;; 2. Parameter Validation (PR-108)
            (asserts! (not (is-eq policy-owner-principal contract-caller))
              ERR-UNAUTHORIZED
            )
            (asserts! (or (is-eq policy-type "PUT") (is-eq policy-type "CALL"))
              ERR-INVALID-POLICY-TYPE
            )
            (asserts! (> (len risk-tier) u0) ERR-EMPTY-RISK-TIER)
            (asserts! (> (len protected-asset-name) u0) ERR-EMPTY-ASSET-NAME)
            (asserts! (> (len collateral-token-name) u0)
              ERR-EMPTY-COLLATERAL-TOKEN
            )
            (asserts! (> protected-value-scaled u0) ERR-ZERO-PROTECTED-VALUE)
            (asserts! (> protection-amount-scaled u0) ERR-ZERO-PROTECTION-AMOUNT)
            (asserts! (> submitted-premium-scaled u0) ERR-ZERO-PREMIUM)
            (asserts! (> expiration-height burn-block-height)
              ERR-EXPIRATION-IN-PAST
            )
            ;; 3. Fetch data for Premium Verification & Freshness Check
            (let (
                  ;; Fetch max oracle price age from Parameters contract
                  (max-price-age-blocks (unwrap! (contract-call? params-contract get-system-parameter-uint "max-oracle-price-age-blocks")
                                          (err ERR-PARAMS-CALL-FAILED-PR))) ;; Assuming specific error for this fetch or reuse general one
                  ;; Fetch current price and its timestamp from Oracle
                  (oracle-price-response (unwrap! (contract-call? oracle-contract get-current-bitcoin-price) ERR-ORACLE-CALL-FAILED-PR))
                  (current-oracle-price (get price oracle-price-response)) ;; Assuming {price: uint, timestamp: uint}
                  (oracle-price-timestamp (get timestamp oracle-price-response))
                  ;; Risk Tier parameters
                  (risk-tier-params (unwrap! (contract-call? params-contract get-risk-tier-parameters risk-tier) ERR-PARAMS-CALL-FAILED-PR))
                 )

              ;; PR-210: Oracle Price Freshness Check
              (asserts! (<= (- burn-block-height oracle-price-timestamp) max-price-age-blocks) ERR-ORACLE-PRICE-TOO-STALE)

              ;; This 'let' block uses the risk-tier-params defined above
              (let (
                  (risk-tier-is-active (get is-active risk-tier-params))
                  (risk-tier-premium-adjustment-bp (get premium-adjustment-basis-points risk-tier-params))
                  )
                  ;; Ensure fetched params are not none if they are optional in the parameters contract's response
                  ;; Assuming get-risk-tier-parameters returns a tuple where these fields are direct values, not optional.
                  ;; If they can be optional, further unwrap! or default-to logic is needed here.
                  ;; For now, assuming direct access as per current math-lib expectation.
                  ;; 4. Premium Verification (Call ML-201 - refactored math-library function)
                  (try! (contract-call? math-contract verify-submitted-premium
                    submitted-premium-scaled protected-value-scaled
                    protection-amount-scaled burn-block-height
                    expiration-height policy-type current-oracle-price
                    risk-tier-is-active risk-tier-premium-adjustment-bp
                  ))
                  ;; 5. Calculate Required Collateral (Simplified for Phase 1 PR-103)
                  (let ((required-collateral-scaled protection-amount-scaled))
                    ;; 6. Liquidity Check (Call LP-109) - REMAINS COMMENTED FOR NOW
                    ;; (try! (contract-call? lp-principal check-liquidity required-collateral-scaled
                    ;; collateral-token-name risk-tier expiration-height
                    ;; ))
                    ;; 7. Consume Policy ID (PR-102)
                    (let ((new-policy-id (unwrap! (consume-next-policy-id)
                        ERR-POLICY-ID-COUNTER-OVERFLOW
                      )))
                      ;; 8. Lock Collateral (Call LP-105) - REMAINS COMMENTED FOR NOW
                      ;; (try! (contract-call? lp-principal lock-collateral new-policy-id
                      ;; required-collateral-scaled collateral-token-name risk-tier
                      ;; expiration-height policy-owner-principal
                      ;; ))
                      ;; 9. Record Premium Payment (Call LP function) - REMAINS COMMENTED FOR NOW
                      ;; (try! (contract-call? lp-principal record-premium-payment new-policy-id
                      ;; submitted-premium-scaled collateral-token-name expiration-height
                      ;; policy-owner-principal
                      ;; ))
                      ;; 10. Store Policy Details
                      (let ((current-block-height burn-block-height))
                        (map-set policies new-policy-id {
                          policy-owner: policy-owner-principal,
                          policy-type: policy-type,
                          risk-tier: risk-tier,
                          protected-asset: protected-asset-name,
                          collateral-token: collateral-token-name,
                          protected-value: protected-value-scaled,
                          protection-amount: protection-amount-scaled,
                          submitted-premium: submitted-premium-scaled,
                          collateral-locked: required-collateral-scaled, ;; Storing the calculated/locked collateral
                          creation-height: current-block-height,
                          expiration-height: expiration-height,
                          settlement-height: none, ;; Not settled at creation
                          status: STATUS-ACTIVE, ;; Initial status
                          price-at-expiration: none,
                          settlement-amount-paid: none,
                        })
                        ;; 11. Update Indices (PR-105) - Adjusted for tuple structure
                        (let (
                            (owner-policy-map-entry (default-to { ids: (list) }
                              (map-get? policies-by-owner policy-owner-principal)
                            ))
                            (owner-policies-list (get ids owner-policy-map-entry))
                          )
                          ;; Check if adding a new item would exceed the maximum allowed
                          (if (>= (len owner-policies-list)
                              MAX_POLICIES_PER_LISTING
                            )
                            ERR-OWNER_POLICY_LIST_FULL
                            (map-set policies-by-owner policy-owner-principal { ids: (unwrap-panic (as-max-len?
                              (append owner-policies-list new-policy-id)
                              MAX_POLICIES_PER_LISTING
                            )) }
                            )
                          )
                        )
                        (let (
                            (exp-height-policy-map-entry (default-to { ids: (list) }
                              (map-get? policies-by-expiration-height
                                expiration-height
                              )))
                            (exp-height-policies-list (get ids exp-height-policy-map-entry))
                          )
                          ;; Check if adding a new item would exceed the maximum allowed
                          (if (>= (len exp-height-policies-list)
                              MAX_POLICIES_PER_LISTING
                            )
                            ERR-EXPIRATION_POLICY_LIST_FULL
                            (map-set policies-by-expiration-height
                              expiration-height { ids: (unwrap-panic (as-max-len?
                              (append exp-height-policies-list new-policy-id)
                              MAX_POLICIES_PER_LISTING
                            )) }
                            )
                          )
                        )
                        ;; 12. Emit Event (SH-101)
                        (print {
                          event: "policy-created",
                          block-height: current-block-height,
                          policy-id: new-policy-id,
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
                        ;; 13. Return Success
                        (ok new-policy-id)
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
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
(define-constant ERR-POLICY-ALREADY-PROCESSED (err u205)) ;; If status is already settled or expired

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
(define-private (priv-process-one-policy-at-expiration (policy-id uint) (price-for-settlement uint))
  (let
    (
      (policy (unwrap! (map-get? policies policy-id) ERR-POLICY-NOT-FOUND))
      (policy-owner (get owner policy))
      (policy-protected-value (get protected-value policy))
      (policy-protection-amount (get protection-amount policy))
      (policy-expiration-height (get expiration-height policy))
      (policy-type (get policy-type policy))
      (policy-status (get status policy))
      (policy-collateral-token (get collateral-token policy))
      (current-height burn-block-height) ;; settlement_processing_height is when this runs
      (math-principal (unwrap! (var-get math-library-principal) ERR-MATH-PRINCIPAL-NOT-SET))
      (lp-principal (unwrap! (var-get liquidity-pool-principal) ERR-LP-PRINCIPAL-NOT-SET))
    )

    ;; Validations for policy status and if it has already expired by its own height vs current block height
    ;; These are already in the public wrapper, but good for direct calls too if this were public.
    ;; For a private helper called by a trusted function that already did these, they might be omitted for gas.
    ;; For now, keeping them for robustness.
    (asserts! (<= policy-expiration-height current-height) ERR-POLICY-NOT-YET-EXPIRED) ;; Ensures policy is due
    (asserts! (is-eq policy-status STATUS-ACTIVE) ERR-POLICY-INVALID-STATE-FOR-EXPIRATION)

    ;; 3. Calculating Settlement Amount (ML-202 dependency)
    (let
      ((settlement-amount-scaled (unwrap! (contract-call? math-principal calculate-settlement-amount
                                          policy-protected-value
                                          policy-protection-amount
                                          price-for-settlement ;; Use provided price
                                          policy-type
                                        ) ERR-MATH-CALL-FAILED)))
      (if (> settlement-amount-scaled u0)
        ;; Policy is In-The-Money (ITM)
        (begin
          (try! (update-policy-status policy-id STATUS-PENDING-SETTLEMENT))
          (map-set policy-settlements policy-id
            {
              expiration-price-scaled: price-for-settlement,
              settlement-amount-scaled: settlement-amount-scaled,
              settlement-processing-height: current-height,
              settled-by: tx-sender
            }
          )
          (match (contract-call? lp-principal process-settlement-at-expiration
                   policy-id
                   settlement-amount-scaled
                   policy-collateral-token
                   policy-owner)
            success-lp-settlement
            (begin
              (try! (update-policy-status policy-id STATUS-SETTLED-ITM))
              (print {
                event: "policy-expiration-processed-itm",
                block-height: current-height,
                policy-id: policy-id,
                status: STATUS-SETTLED-ITM,
                expiration-price-scaled: price-for-settlement,
                settlement-amount-scaled: settlement-amount-scaled
              })
              (ok true) ;; Indicate ITM success
            )
            error-lp-settlement
            (begin
              (print {
                event: "policy-expiration-lp-settlement-failed",
                block-height: current-height,
                policy-id: policy-id,
                status: STATUS-PENDING-SETTLEMENT,
                error: error-lp-settlement
              })
              (err ERR-LP-SETTLEMENT-CALL-FAILED)
            )
          )
        )
        ;; Policy is Out-of-The-Money (OTM)
        (begin
          (try! (update-policy-status policy-id STATUS-EXPIRED-OTM))
          (map-set policy-settlements policy-id
            {
              expiration-price-scaled: price-for-settlement,
              settlement-amount-scaled: u0,
              settlement-processing-height: current-height,
              settled-by: tx-sender
            }
          )
          (map-set pending-premium-distributions policy-id true)
          (print {
            event: "policy-expiration-processed-otm",
            block-height: current-height,
            policy-id: policy-id,
            status: STATUS-EXPIRED-OTM,
            expiration-price-scaled: price-for-settlement
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
    (asserts! (not (is-eq policy-status STATUS-SETTLED)) ERR-POLICY-ALREADY-PROCESSED)
    (asserts! (not (is-eq policy-status STATUS-EXPIRED-OTM)) ERR-POLICY-ALREADY-PROCESSED)
    (asserts! (>= current-height policy-expiration-height) ERR-POLICY-NOT-YET-EXPIRED)
    (asserts! (is-eq policy-status STATUS-ACTIVE) ERR-POLICY-INVALID-STATE-FOR-EXPIRATION)

    ;; Step 1: Fetch the actual expiration price from the oracle for this specific policy's expiration.
    (let ((oracle-principal (unwrap! (var-get price-oracle-principal) ERR-ORACLE-PRINCIPAL-NOT-SET)))
      (let ((expiration-price-response (contract-call? oracle-principal get-bitcoin-price-at-height policy-expiration-height)))
        (match expiration-price-response
          price-tuple
            (let ((expiration-price-scaled (get price price-tuple))) ;; Assuming the tuple is {price: uint, ...}
              ;; Now call the internal processing function with the fetched price
              (priv-process-one-policy-at-expiration policy-id expiration-price-scaled)
            )
          error-val
            (begin
              (print {event: "single-policy-expiration-oracle-error", message: "Failed to get price from oracle for policy expiration.", policy-id: policy-id, error: error-val})
              (err ERR-ORACLE-CALL-FAILED)
            )
        )
      )
    )
  )
)

;; PR-206: Implement process-expiration-batch
(define-public (process-expiration-batch (expiration-height-to-process uint))
  (let (
      (oracle-principal (unwrap! (var-get price-oracle-principal) ERR-ORACLE-PRINCIPAL-NOT-SET))
      (policy-ids-list-optional (map-get? policies-by-expiration-height expiration-height-to-process))
    )
    (if (is-none policy-ids-list-optional)
      ;; No policies for this expiration height
      (begin
        (print {event: "batch-expiration-processed-info", message: "No policies found for this expiration height", height: expiration-height-to-process})
        (ok {processed-count: u0, itm-count: u0, otm-count: u0, error-count: u0})
      )
      (let (
          (policy-ids (get ids (unwrap-panic policy-ids-list-optional)))
          ;; Simplification: uses current price for whole batch. For more accuracy, would need oracle call per policy or batched price for the specific expiration-height-to-process
          (batch-price-response (contract-call? oracle-principal get-bitcoin-price-at-height expiration-height-to-process))
          (current-block-height burn-block-height) ;; For event logging
        )
        (match batch-price-response
          price-tuple
            (let ((batch-price-scaled (get price price-tuple)))
                (fold process-one-policy-in-batch
                  policy-ids
                  {processed-count: u0, itm-count: u0, otm-count: u0, error-count: u0, batch-price: batch-price-scaled, event-block-height: current-block-height}
                )
            )
          error-val
            (begin
                (print {event: "batch-expiration-oracle-error", message: "Failed to get batch price from oracle.", height: expiration-height-to-process, error: error-val})
                ;; Decide how to handle: fail all, or mark all as error? For now, returning an overall error.
                (err ERR-ORACLE-CALL-FAILED)
            )
        )
      )
    )
  )
)

;; Private helper for the fold operation in process-expiration-batch
;; Takes a policy-id and the current accumulator state.
(define-private (process-one-policy-in-batch (policy-id uint) (accumulator {processed-count: uint, itm-count: uint, otm-count: uint, error-count: uint, batch-price: uint, event-block-height: uint}))
  (let (
      (batch-price-for-policy (get batch-price accumulator))
      (event-height (get event-block-height accumulator))
      (policy-result (priv-process-one-policy-at-expiration policy-id batch-price-for-policy)) ;; Call the renamed private function
    )
    (if (is-ok policy-result)
      (let ((is-itm (unwrap-panic policy-result))) ;; priv-process-one-policy-at-expiration returns (ok bool) where true is ITM
        (if is-itm
          ;; ITM case
          (merge accumulator {processed-count: (+ u1 (get processed-count accumulator)), itm-count: (+ u1 (get itm-count accumulator))})
          ;; OTM case
          (merge accumulator {processed-count: (+ u1 (get processed-count accumulator)), otm-count: (+ u1 (get otm-count accumulator))})
        )
      )
      ;; Error case
      (begin
        (print {
          event: "batch-expiration-policy-error",
          block-height: event-height,
          policy-id: policy-id,
          error: (err-get policy-result) ;; Get the error value from the (err ...) response
        })
        (merge accumulator {processed-count: (+ u1 (get processed-count accumulator)), error-count: (+ u1 (get error-count accumulator))})
      )
    )
  )
)

;; PR-207: Implement distribute-premium for a single OTM policy
(define-public (distribute-premium (policy-id uint))
  (let (
      (policy (unwrap! (map-get? policies policy-id) ERR-POLICY-NOT-FOUND))
      (policy-status (get status policy))
      (is-pending-distribution (unwrap! (map-get? pending-premium-distributions policy-id) ERR-POLICY-NOT-PENDING-PREMIUM-DISTRIBUTION))
      (lp-principal (unwrap! (var-get liquidity-pool-principal) ERR-LP-PRINCIPAL-NOT-SET))
      (submitted-premium (get submitted-premium policy))
      (collateral-token (get collateral-token policy))
    )

    ;; 1. Validate policy status and pending distribution flag
    (asserts! (is-eq policy-status STATUS-EXPIRED-OTM) ERR-POLICY-NOT-OTM)
    (asserts! is-pending-distribution ERR-POLICY-NOT-PENDING-PREMIUM-DISTRIBUTION) ;; ensure it's true

    ;; 2. Call Liquidity Pool to distribute premiums
    (match (contract-call? lp-principal distribute-premium-to-providers policy-id submitted-premium collateral-token)
      success-lp-distribution
      (begin
        ;; 3. Update pending distribution status
        (map-set pending-premium-distributions policy-id false) ;; Mark as processed

        ;; 4. Emit event
        (print {
          event: "policy-premium-distributed",
          block-height: burn-block-height,
          policy-id: policy-id,
          premium-amount-distributed: submitted-premium,
          token-id: collateral-token
        })
        (ok true)
      )
      error-lp-distribution
      (begin
        (print {
          event: "policy-premium-distribution-failed",
          block-height: burn-block-height,
          policy-id: policy-id,
          error: error-lp-distribution
        })
        (err ERR-LP-PREMIUM-DISTRIBUTION-FAILED)
      )
    )
  )
)

(print { message: "BitHedgePolicyRegistryContract updated for PR-102, PR-103, PR-104, and PR-106." })
