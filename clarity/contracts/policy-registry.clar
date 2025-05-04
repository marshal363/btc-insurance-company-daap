\
;; BitHedge Policy Registry Contract
;; Version: 1.0
;; Implementation based on: @docs/backend-new/provisional-2/policy-registry-specification-guidelines.md

;; --- Constants and Error Codes ---
(define-constant ERR-NOT-FOUND (err u404))
(define-constant ERR-UNAUTHORIZED (err u401))
(define-constant ERR-ALREADY-EXISTS (err u409))
(define-constant ERR-INVALID-STATUS (err u400))
(define-constant ERR-NOT-ACTIVE (err u403))
(define-constant ERR-EXPIRED (err u410))
(define-constant ERR-POLICY-LIMIT-REACHED (err u1005)) ;; Max policies per owner reached
(define-constant ERR-INVALID-POLICY-TYPE (err u1001))
(define-constant ERR-ZERO-PROTECTED-VALUE (err u1002))
(define-constant ERR-ZERO-PROTECTION-AMOUNT (err u1003))
(define-constant ERR-EXPIRATION-IN-PAST (err u1004))
(define-constant ERR-NOT-YET-EXPIRED (err u1006))

;; Status constants
(define-constant STATUS-ACTIVE "Active")
(define-constant STATUS-EXERCISED "Exercised")
(define-constant STATUS-EXPIRED "Expired")

;; Policy type constants
(define-constant POLICY-TYPE-PUT "PUT")
(define-constant POLICY-TYPE-CALL "CALL")

;; --- Data Structures ---

;; Policy entry - the core data structure
(define-map policies
  { id: uint }                              ;; Key: unique policy ID
  {
    owner: principal,                       ;; Policy owner (buyer)
    counterparty: principal,                ;; Counterparty (typically the pool)
    protected-value: uint,                  ;; Strike price in base units (e.g., satoshis for BTC)
    protection-amount: uint,                ;; Amount being protected in base units
    expiration-height: uint,                ;; Block height when policy expires
    premium: uint,                          ;; Premium amount paid in base units
    policy-type: (string-ascii 4),          ;; "PUT" or "CALL"
    status: (string-ascii 10),              ;; "Active", "Exercised", "Expired"
    creation-height: uint                   ;; Block height when policy was created
  }
)

;; Index of policies by owner
(define-map policies-by-owner
  { owner: principal }
  { policy-ids: (list 50 uint) } ;; Max 50 policies indexed per owner
)

;; --- Data Variables ---

;; Counter for policy IDs
(define-data-var policy-id-counter uint u0)

;; Backend authorized principal - for automated operations
;; Defaults to the contract deployer initially
(define-data-var backend-authorized-principal principal tx-sender)

;; --- Administrative Functions ---

;; Set the backend authorized principal
;; Can only be called by the contract deployer (contract owner)
(define-public (set-backend-authorized-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender contract-deployer) ERR-UNAUTHORIZED) ;; Use contract-deployer
    (var-set backend-authorized-principal new-principal)
    (ok true)
  )
)

;; --- Policy Management Functions ---

;; Create a new policy entry
;; Can be called by any user (typically the policy buyer)
(define-public (create-policy-entry
  (owner principal)
  (counterparty principal)
  (protected-value uint)
  (protection-amount uint)
  (expiration-height uint)
  (premium uint)
  (policy-type (string-ascii 4)))

  (let
    (
      ;; Get next policy ID and increment counter
      (policy-id (var-get policy-id-counter))
      (next-id (+ policy-id u1))
    )
    (begin
      ;; Basic validation
      (asserts! (or (is-eq policy-type POLICY-TYPE-PUT) (is-eq policy-type POLICY-TYPE-CALL))
                ERR-INVALID-POLICY-TYPE)
      (asserts! (> protected-value u0) ERR-ZERO-PROTECTED-VALUE)
      (asserts! (> protection-amount u0) ERR-ZERO-PROTECTION-AMOUNT)
      (asserts! (> expiration-height block-height) ERR-EXPIRATION-IN-PAST)

      ;; Insert the policy entry
      (map-set policies
        { id: policy-id }
        {
          owner: owner,
          counterparty: counterparty,
          protected-value: protected-value,
          protection-amount: protection-amount,
          expiration-height: expiration-height,
          premium: premium,
          policy-type: policy-type,
          status: STATUS-ACTIVE,
          creation-height: block-height
        }
      )

      ;; Update owner index
      (match (map-get? policies-by-owner { owner: owner })
        existing-entry
        (let
          (
            (existing-ids (get policy-ids existing-entry))
            (new-list (append existing-ids policy-id))
            (checked-list (unwrap! (as-max-len? new-list u50) ERR-POLICY-LIMIT-REACHED))
          )
          (map-set policies-by-owner
            { owner: owner }
            { policy-ids: checked-list }
          )
        )
        ;; No existing policies, create new list
        (map-set policies-by-owner
          { owner: owner }
          { policy-ids: (list policy-id) }
        )
      )

      ;; Update counter
      (var-set policy-id-counter next-id)

      ;; Emit event (PR-109 Partial)
      (print {
        event: "policy-created",
        policy-id: policy-id,
        owner: owner,
        counterparty: counterparty,
        expiration-height: expiration-height,
        protected-value: protected-value,
        protection-amount: protection-amount,
        policy-type: policy-type,
        premium: premium
      })

      ;; Return the created policy ID
      (ok policy-id)
    )
  )
)

;; Update policy status
;; Can be called by the policy owner to activate (exercise)
;; Can be called by the backend authorized principal to expire
(define-public (update-policy-status
  (policy-id uint)
  (new-status (string-ascii 10)))

  (let
    (
      ;; Get the policy entry
      (policy (unwrap! (map-get? policies { id: policy-id }) ERR-NOT-FOUND))
      (previous-status (get status policy))
      (current-owner (get owner policy))
      (expiration (get expiration-height policy))
    )
    (begin
      ;; Validate the status transition and authorization
      (asserts!
        (or
          ;; Owner can activate (exercise) an active policy that is not expired
          (and (is-eq tx-sender current-owner)
               (is-eq previous-status STATUS-ACTIVE)
               (is-eq new-status STATUS-EXERCISED)
               (< block-height expiration))

          ;; Backend can expire an active policy that is past expiration
          (and (is-eq tx-sender (var-get backend-authorized-principal))
               (is-eq previous-status STATUS-ACTIVE)
               (is-eq new-status STATUS-EXPIRED)
               (>= block-height expiration)))
        ERR-UNAUTHORIZED ;; Covers invalid transitions, permissions, or expiry checks
      )

      ;; Update the policy status
      (map-set policies
        { id: policy-id }
        (merge policy { status: new-status })
      )

      ;; Emit event (PR-109 Completion for this function)
      (print {
        event: "policy-status-updated",
        policy-id: policy-id,
        new-status: new-status,
        previous-status: previous-status,
        block-height: block-height
      })

      (ok true)
    )
  )
)

;; --- Batch Operations ---

;; Expire multiple policies in a single transaction
;; Can only be called by the backend authorized principal
(define-public (expire-policies-batch (policy-ids (list 50 uint)))
  (begin
    ;; Verify caller is authorized
    (asserts! (is-eq tx-sender (var-get backend-authorized-principal))
              ERR-UNAUTHORIZED)

    ;; Use fold to process each policy ID
    ;; The initial value (ok true) allows the fold to proceed.
    ;; Errors during individual expirations don't halt the batch, but should be logged off-chain via events.
    (fold expire-policy-fold policy-ids (ok true))
  )
)

;; Helper function for batch expiration fold
(define-private (expire-policy-fold (policy-id uint) (previous-result (response bool uint)))
  (begin
    ;; We ignore the actual value of previous-result here because we want to attempt
    ;; expiring each policy ID regardless of prior failures within the batch.
    ;; Off-chain logic should monitor events to track success/failure of each ID.
    (match (try-expire-policy policy-id)
      success success ;; success here just means the attempt was made, not necessarily that status changed
      error (print {event: "batch-expire-error", policy-id: policy-id, error: error}) ;; Log internal error if try-expire fails unexpectedly
    )
    ;; Always return (ok true) to continue the fold for the remaining IDs.
    (ok true)
  )
)

;; Try to expire a single policy - internal helper for batch operation
;; Returns (ok true) if successful or skipped, error only on unexpected issues.
(define-private (try-expire-policy (policy-id uint))
  (match (map-get? policies { id: policy-id })
    ;; Policy found
    policy-entry
    (let
      (
        (current-status (get status policy-entry))
        (expiration (get expiration-height policy-entry))
      )
      ;; Only expire if active and past expiration height
      (if (and (is-eq current-status STATUS-ACTIVE)
               (>= block-height expiration))
          (begin
            ;; Update the policy status
            (map-set policies
              { id: policy-id }
              (merge policy-entry { status: STATUS-EXPIRED })
            )
            ;; Emit event
            (print {
              event: "policy-status-updated",
              policy-id: policy-id,
              new-status: STATUS-EXPIRED,
              previous-status: current-status,
              block-height: block-height
            })
            (ok true) ;; Indicate successful update
          )
          (ok true) ;; Skip if already non-active or not yet expired, still considered 'success' for the fold
      )
    )
    ;; Policy not found, skip it
    (ok true)
  )
)

;; --- Read-Only Functions (PR-107 Completion for basic reads) ---

;; Get a policy by ID
(define-read-only (get-policy (policy-id uint))
  (map-get? policies { id: policy-id }))

;; Get the total number of policies
(define-read-only (get-policy-count)
  (var-get policy-id-counter))

;; Get policy IDs for an owner
(define-read-only (get-policy-ids-by-owner (owner principal))
  (default-to { policy-ids: (list) }
              (map-get? policies-by-owner { owner: owner })))

;; Check if a policy is active
(define-read-only (is-policy-active (policy-id uint))
  (match (map-get? policies { id: policy-id })
    policy (is-eq (get status policy) STATUS-ACTIVE)
    false))

;; --- Advanced Read-Only Functions ---

;; Check if a policy is exercisable given the current price
(define-read-only (is-policy-exercisable (policy-id uint) (current-price uint))
  (match (map-get? policies { id: policy-id })
    policy
    (let (
        (p-status (get status policy))
        (p-expiration (get expiration-height policy))
        (p-type (get policy-type policy))
        (p-protected-value (get protected-value policy))
      )
      (and
        ;; Must be active
        (is-eq p-status STATUS-ACTIVE)
        ;; Not expired
        (< block-height p-expiration)
        ;; Price conditions depending on policy type
        (if (is-eq p-type POLICY-TYPE-PUT)
            ;; For PUT: current price must be below protected value (strike)
            (< current-price p-protected-value)
            ;; For CALL: current price must be above protected value (strike)
            (> current-price p-protected-value)
        )
      )
    )
    ;; Policy not found
    false
  )
)

;; Calculate settlement amount for a policy if exercised at the given current price
;; Returns u0 if the policy is not found or conditions are not met for settlement at that price.
(define-read-only (calculate-settlement-amount (policy-id uint) (current-price uint))
  (match (map-get? policies { id: policy-id })
    policy
    (let
      (
        (protected-value (get protected-value policy))
        (protection-amount (get protection-amount policy))
        (policy-type (get policy-type policy))
      )
      (if (is-eq policy-type POLICY-TYPE-PUT)
          ;; For PUT: Settlement = (Strike - Current) * ProtectionAmount / Strike
          ;; Check if current price is below strike before calculating
          (if (< current-price protected-value)
              ;; Use max(0, ...) implicitly via uint subtraction rules
              (/ (* (- protected-value current-price) protection-amount) protected-value)
              u0 ;; No payout if current price >= strike
          )
          ;; For CALL: Settlement = (Current - Strike) * ProtectionAmount / Strike
          ;; Check if current price is above strike before calculating
          (if (> current-price protected-value)
              ;; Use max(0, ...) implicitly via uint subtraction rules
              (/ (* (- current-price protected-value) protection-amount) protected-value)
              u0 ;; No payout if current price <= strike
          )
      )
    )
    ;; Policy not found
    u0
  )
)

;; --- Integration Points ---

;; Placeholder comment: Integration with Liquidity Pool
;; - Premium payments associated with create-policy-entry would likely involve
;;   a call *to* the Liquidity Pool contract from the user or backend
;;   before calling create-policy-entry here, or handled via composed transactions.
;; - Settlement payments triggered by update-policy-status (Exercised) would involve
;;   a call *from* this contract (or backend reacting to the event) *to* the Liquidity Pool
;;   to release funds.

;; Placeholder comment: Integration with Oracle
;; - The is-policy-exercisable function requires the current price as an argument.
;;   The caller (likely Convex backend) would fetch this from the Oracle contract
;;   before calling this read-only function.
;; - Direct calls *from* this contract *to* the Oracle might be added later
;;   if on-chain validation during state transitions (e.g., exercise) is required,
;;   but this is avoided in the current "On-Chain Light" design. 