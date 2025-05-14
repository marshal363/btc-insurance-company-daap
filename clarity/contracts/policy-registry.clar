;; BitHedge Policy Registry Contract
;; Version: 0.1 (Phase 1 Development - PR-101, PR-102, PR-103, PR-104, PR-106)
;; Summary: Manages the lifecycle of European-style protection policies.
;; Description: This contract handles policy creation, tracking by owner and expiration,
;;              and stores detailed information for each policy. It serves as the central
;;              registry for all protection policies within the BitHedge ecosystem.

;; --- Traits ---
;; (No traits defined in this initial version for PR-101)

;; --- Constants ---
(define-constant CONTRACT-OWNER tx-sender)
(define-constant CONTRACT-VERSION "0.1.2") ;; Updated version

;; Maximum number of policy IDs to store in list-based indexes
;; This helps manage storage and gas costs.
(define-constant MAX_POLICIES_PER_LISTING u100)

;; Fixed-point precision (8 decimal places) - Assuming this might be used from math-library or defined locally if needed often.
;; For now, we assume values like submitted-premium are already scaled.
;; (define-constant ONE_8 u100000000)

;; Error Codes (Starting from u300 for this contract)
(define-constant ERR-UNAUTHORIZED (err u301))
(define-constant ERR-POLICY-ID-COUNTER-OVERFLOW (err u302)) ;; Placeholder, actual check might be complex
(define-constant ERR-POLICY-NOT-FOUND (err u303))
(define-constant ERR-OWNER_POLICY_LIST_FULL (err u304))
(define-constant ERR-EXPIRATION_POLICY_LIST_FULL (err u305))
(define-constant ERR-PRINCIPAL-NOT-SET (err u306))
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
;; Value: (list MAX_POLICIES_PER_LISTING uint) (list of policy IDs owned by the principal)
(define-map policies-by-owner
  principal
  (list MAX_POLICIES_PER_LISTING uint)
)

;; Index to retrieve all policies expiring at a specific block height.
;; This is crucial for batch processing of expirations.
;; Key: uint (expiration block height)
;; Value: (list MAX_POLICIES_PER_LISTING uint) (list of policy IDs expiring at that height)
(define-map policies-by-expiration-height
  uint
  (list MAX_POLICIES_PER_LISTING uint)
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
    (policy-type (string-ascii 8))   ;; e.g., "PUT", "CALL"
    (risk-tier (string-ascii 32))    ;; e.g., "Conservative", needs validation against ParametersContract eventually
    (protected-asset-name (string-ascii 10)) ;; e.g., "BTC"
    (collateral-token-name (string-ascii 32)) ;; e.g., "STX", or sBTC contract principal as string for SIP010 tokens
    (protected-value-scaled uint)  ;; Strike price, scaled (e.g., by ONE_8 for USD value)
    (protection-amount-scaled uint) ;; Notional amount of asset, scaled (e.g., by asset's own precision like satoshis, or ONE_8 if it's a value equivalent)
    (expiration-height uint)         ;; Target block height for expiration
    (submitted-premium-scaled uint) ;; Premium offered by the user for the policy, in collateral-token-name units, scaled
  )
  (begin
    ;; 1. Retrieve Contract Principals (PR-102 dependency)
    (let ((lp-principal (unwrap! (var-get liquidity-pool-principal) ERR-LP-PRINCIPAL-NOT-SET)))
      (let ((math-lib-principal (unwrap! (var-get math-library-principal) ERR-MATH-PRINCIPAL-NOT-SET)))
        ;; (let ((params-principal (unwrap! (var-get parameters-contract-principal) ERR-PARAMS-PRINCIPAL-NOT-SET))))
          ;; TODO: Uncomment and use params-principal when calls to ParametersContract are needed (e.g., for risk tier validation from PA-105)

          ;; 2. Parameter Validation (PR-108)
          (asserts! (not (is-eq policy-owner-principal contract-caller)) ERR-UNAUTHORIZED) ;; Basic check: owner shouldn't be this contract itself
          (asserts! (or (is-eq policy-type "PUT") (is-eq policy-type "CALL")) ERR-INVALID-POLICY-TYPE) ;; ERR-INVALID-POLICY-TYPE
          ;; TODO: Add more robust risk-tier validation, possibly by calling ParametersContract (PA-105)
          (asserts! (> (len risk-tier) u0) ERR-EMPTY-RISK-TIER) ;; ERR-EMPTY-RISK-TIER
          (asserts! (> (len protected-asset-name) u0) ERR-EMPTY-ASSET-NAME) ;; ERR-EMPTY-ASSET-NAME
          (asserts! (> (len collateral-token-name) u0) ERR-EMPTY-COLLATERAL-TOKEN) ;; ERR-EMPTY-COLLATERAL-TOKEN
          (asserts! (> protected-value-scaled u0) ERR-ZERO-PROTECTED-VALUE) ;; ERR-ZERO-PROTECTED-VALUE
          (asserts! (> protection-amount-scaled u0) ERR-ZERO-PROTECTION-AMOUNT) ;; ERR-ZERO-PROTECTION-AMOUNT
          (asserts! (> submitted-premium-scaled u0) ERR-ZERO-PREMIUM) ;; ERR-ZERO-PREMIUM
          (asserts! (> expiration-height burn-block-height) ERR-EXPIRATION-IN-PAST) ;; ERR-EXPIRATION-IN-PAST

          ;; 3. Premium Verification (Call ML-103)
          (try! (contract-call? math-lib-principal verify-submitted-premium
            submitted-premium-scaled protected-value-scaled protection-amount-scaled
            burn-block-height expiration-height policy-type risk-tier
          ))

          ;; 4. Calculate Required Collateral (Simplified for Phase 1 PR-103)
          ;; For a European PUT, collateral is typically the full protection amount.
          ;; For a CALL, it would be the underlying asset. This is a simplification.
          ;; More advanced logic might use collateral-ratio from ParametersContract (PA-105)
          (let ((required-collateral-scaled protection-amount-scaled))
            ;; TODO: If policy-type is CALL, collateral logic differs (e.g., might be specific amount of protected-asset-name)
            ;; This assumes protection-amount-scaled is in units of collateral-token-name for PUTs.

            ;; 5. Liquidity Check (Call LP-109)
            (try! (contract-call? lp-principal check-liquidity
              required-collateral-scaled collateral-token-name risk-tier expiration-height
            ))

            ;; 6. Consume Policy ID (PR-102)
            (let ((new-policy-id (unwrap! (consume-next-policy-id) ERR-POLICY-ID-COUNTER-OVERFLOW)))

              ;; 7. Lock Collateral (Call LP-105)
              (try! (contract-call? lp-principal lock-collateral
                new-policy-id required-collateral-scaled collateral-token-name risk-tier expiration-height policy-owner-principal
              ))

              ;; 8. Record Premium Payment (Call LP function - assuming LP-202 or similar exists and is callable by PR)
              (try! (contract-call? lp-principal record-premium-payment
                new-policy-id submitted-premium-scaled collateral-token-name expiration-height policy-owner-principal
              ))

              ;; 9. Store Policy Details
              (let ((current-block-height burn-block-height))
                (map-set policies new-policy-id
                  {
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
                    settlement-amount-paid: none
                  }
                )

                ;; 10. Update Indices (PR-105)
                (let ((owner-policies (default-to (list) (map-get? policies-by-owner policy-owner-principal))))
                  (map-set policies-by-owner policy-owner-principal
                    (unwrap! (as-max-len? (append owner-policies new-policy-id) MAX_POLICIES_PER_LISTING) ERR-OWNER_POLICY_LIST_FULL)
                  )
                )

                (let ((exp-height-policies (default-to (list) (map-get? policies-by-expiration-height expiration-height))))
                  (map-set policies-by-expiration-height expiration-height
                    (unwrap! (as-max-len? (append exp-height-policies new-policy-id) MAX_POLICIES_PER_LISTING) ERR-EXPIRATION_POLICY_LIST_FULL)
                  )
                )

                ;; 11. Emit Event (SH-101)
                (print {
                  event: "policy-created",
                  policy_id: new-policy-id,
                  owner: policy-owner-principal,
                  policy_type: policy-type,
                  risk_tier: risk-tier,
                  protected_asset: protected-asset-name,
                  collateral_token: collateral-token-name,
                  protected_value_scaled: protected-value-scaled,
                  protection_amount_scaled: protection-amount-scaled,
                  submitted_premium_scaled: submitted-premium-scaled,
                  required_collateral_scaled: required-collateral-scaled,
                  expiration_height: expiration-height,
                  creation_height: current-block-height
                })

                ;; 12. Return Success
                (ok new-policy-id)
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
  (ok (default-to (list) (map-get? policies-by-owner owner)))
)

;; Retrieves the list of policy IDs expiring at a given block height.
(define-read-only (get-policies-by-expiration-height (height uint))
  (ok (default-to (list) (map-get? policies-by-expiration-height height)))
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
(define-private (update-policy-status (policy-id uint) (new-status (string-ascii 20)))
  (let ((existing-policy-optional (map-get? policies policy-id)))
    (asserts! (is-some existing-policy-optional) ERR-POLICY-NOT-FOUND)
    (let ((existing-policy (unwrap-panic existing-policy-optional)))
      ;; TODO: Implement robust status transition validation here in later phases.
      ;; For now, any valid new status string can be set.
      (map-set policies policy-id (merge existing-policy {status: new-status}))
      (print {event: "policy-status-updated", policy_id: policy-id, old_status: (get status existing-policy), new_status: new-status})
      (ok true)
    )
  )
)

(print { message: "BitHedgePolicyRegistryContract updated for PR-102, PR-103, PR-104, and PR-106." })
