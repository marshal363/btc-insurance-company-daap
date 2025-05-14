;; BitHedge Policy Registry Contract
;; Version: 1.0
;; Implementation based on: @docs/backend-new/provisional-2/policy-registry-specification-guidelines.md

;; --- Constants and Error Codes ---
(define-constant CONTRACT-OWNER tx-sender)
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
(define-constant ERR-INSUFFICIENT-LIQUIDITY (err u502))
(define-constant ERR-PREMIUM-ALREADY-DISTRIBUTED (err u1007))

;; Status constants
(define-constant STATUS-ACTIVE "Active")
(define-constant STATUS-EXERCISED "Exercised")
(define-constant STATUS-EXPIRED "Expired")

;; Policy type constants
(define-constant POLICY-TYPE-PUT "PUT")
(define-constant POLICY-TYPE-CALL "CALL")

;; Position type constants
(define-constant POSITION-LONG-PUT "LONG_PUT")
(define-constant POSITION-SHORT-PUT "SHORT_PUT")
(define-constant POSITION-LONG-CALL "LONG_CALL")
(define-constant POSITION-SHORT-CALL "SHORT_CALL")

;; Token constants (PR-116: Add token constants)
(define-constant TOKEN-STX "STX")
(define-constant TOKEN-SBTC "sBTC")
(define-constant ASSET-BTC "BTC")

;; --- Data Structures ---

;; Policy entry - the core data structure
(define-map policies
  { id: uint }                              ;; Key: unique policy ID
  {
    owner: principal,                       ;; Policy owner (buyer) - Protective Peter for LONG_PUT
    counterparty: principal,                ;; Counterparty (typically the pool) - Income Irene for SHORT_PUT
    protected-value: uint,                  ;; Strike price in base units (e.g., satoshis for BTC)
    protection-amount: uint,                ;; Amount being protected in base units
    expiration-height: uint,                ;; Block height when policy expires
    premium: uint,                          ;; Premium amount paid in base units
    policy-type: (string-ascii 4),          ;; "PUT" or "CALL"
    position-type: (string-ascii 9),        ;; "LONG_PUT", "SHORT_PUT", "LONG_CALL", or "SHORT_CALL"
    collateral-token: (string-ascii 4),     ;; PR-116: Token used as collateral ("STX" or "sBTC")
    protected-asset: (string-ascii 4),      ;; PR-116: Asset being protected ("BTC")
    settlement-token: (string-ascii 4),     ;; PR-116: Token used for settlement if exercised
    status: (string-ascii 10),              ;; "Active", "Exercised", "Expired"
    creation-height: uint,                  ;; Block height when policy was created
    premium-distributed: bool               ;; Whether premium has been distributed to counterparty
  }
)

;; Index of policies by owner
(define-map policies-by-owner
  { owner: principal }
  { policy-ids: (list 50 uint) } ;; Max 50 policies indexed per owner
)

;; Index of policies by counterparty
(define-map policies-by-counterparty
  { counterparty: principal }
  { policy-ids: (list 50 uint) } ;; Max 50 policies indexed per counterparty
)

;; --- Data Variables ---

;; Counter for policy IDs
(define-data-var policy-id-counter uint u0)

;; Backend authorized principal - for automated operations
;; Defaults to the contract deployer initially
(define-data-var backend-authorized-principal principal tx-sender)

;; Principal of the Oracle contract (must be set after deployment)
(define-data-var oracle-principal principal tx-sender) ;; Placeholder, set via set-oracle-principal

;; Principal of the Liquidity Pool Vault contract (must be set after deployment)
(define-data-var liquidity-pool-vault-principal principal tx-sender) ;; Placeholder

;; --- Administrative Functions ---

;; Set the backend authorized principal
;; Can only be called by the contract deployer (contract owner)
(define-public (set-backend-authorized-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED) ;; Use CONTRACT-OWNER instead of contract-deployer
    (var-set backend-authorized-principal new-principal)
    (ok true)
  )
)

;; Set the Oracle contract principal
;; Can only be called by the contract deployer (contract owner)
(define-public (set-oracle-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set oracle-principal new-principal)
    (ok true)
  )
)

;; Set the Liquidity Pool Vault contract principal
;; Can only be called by the contract deployer (contract owner)
(define-public (set-liquidity-pool-vault-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set liquidity-pool-vault-principal new-principal)
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
      ;; PR-121: Determine position types based on policy type
      (owner-position-type (if (is-eq policy-type POLICY-TYPE-PUT) 
                              POSITION-LONG-PUT 
                              POSITION-LONG-CALL))
      (counterparty-position-type (if (is-eq policy-type POLICY-TYPE-PUT) 
                                    POSITION-SHORT-PUT 
                                    POSITION-SHORT-CALL))
      ;; PR-116: Determine collateral and settlement tokens based on policy type
      (collateral-token (if (is-eq policy-type POLICY-TYPE-PUT) TOKEN-STX TOKEN-SBTC))
      (settlement-token (if (is-eq policy-type POLICY-TYPE-PUT) TOKEN-STX TOKEN-SBTC))
      (protected-asset ASSET-BTC)
    )
    (begin
      ;; Basic validation
      (asserts! (or (is-eq policy-type POLICY-TYPE-PUT) (is-eq policy-type POLICY-TYPE-CALL))
                ERR-INVALID-POLICY-TYPE)
      (asserts! (> protected-value u0) ERR-ZERO-PROTECTED-VALUE)
      (asserts! (> protection-amount u0) ERR-ZERO-PROTECTION-AMOUNT)
      (asserts! (> expiration-height burn-block-height) ERR-EXPIRATION-IN-PAST)

      ;; Ensure sufficient liquidity in the pool (PR-111)
      (asserts! (unwrap! (check-liquidity-for-policy protected-value protection-amount policy-type) (err u502)) ;; Error u502 for liquidity check failure
                ERR-INSUFFICIENT-LIQUIDITY)
      
      ;; Lock collateral in the pool (PR-111)
      (unwrap! (lock-policy-collateral policy-id protected-value protection-amount policy-type) (err u503)) ;; Error u503 for lock failure

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
          position-type: owner-position-type,  ;; Set position type for the owner (buyer)
          collateral-token: collateral-token,  ;; PR-116: Add collateral token tracking
          protected-asset: protected-asset,    ;; PR-116: Add protected asset tracking
          settlement-token: settlement-token,  ;; PR-116: Add settlement token tracking
          status: STATUS-ACTIVE,
          creation-height: burn-block-height,
          premium-distributed: false
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

      ;; Update counterparty index
      (match (map-get? policies-by-counterparty { counterparty: counterparty })
        existing-entry
        (let
          (
            (existing-ids (get policy-ids existing-entry))
            (new-list (append existing-ids policy-id))
            (checked-list (unwrap! (as-max-len? new-list u50) ERR-POLICY-LIMIT-REACHED))
          )
          (map-set policies-by-counterparty
            { counterparty: counterparty }
            { policy-ids: checked-list }
          )
        )
        ;; No existing policies, create new list
        (map-set policies-by-counterparty
          { counterparty: counterparty }
          { policy-ids: (list policy-id) }
        )
      )

      ;; Update counter
      (var-set policy-id-counter next-id)

      ;; Enhanced event for policy creation (PR-119 partial: improve event data)
      (print {
        event: "policy-created",
        policy-id: policy-id,
        owner: owner,
        counterparty: counterparty,
        expiration-height: expiration-height,
        protected-value: protected-value,
        protection-amount: protection-amount,
        policy-type: policy-type,
        position-type: owner-position-type,
        counterparty-position-type: counterparty-position-type, ;; PR-121: Include counterparty position
        collateral-token: collateral-token,    ;; PR-116: Include in event
        settlement-token: settlement-token,    ;; PR-116: Include in event
        protected-asset: protected-asset,      ;; PR-116: Include in event
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
               (< burn-block-height expiration))

          ;; Backend can expire an active policy that is past expiration
          (and (is-eq tx-sender (var-get backend-authorized-principal))
               (is-eq previous-status STATUS-ACTIVE)
               (is-eq new-status STATUS-EXPIRED)
               (>= burn-block-height expiration)))
        ERR-UNAUTHORIZED ;; Covers invalid transitions, permissions, or expiry checks
      )

      ;; Update the policy status
      (map-set policies
        { id: policy-id }
        (merge policy { status: new-status })
      )

      ;; Enhanced event emission (PR-119 partial: improve event data)
      (print {
        event: "policy-status-updated",
        policy-id: policy-id,
        new-status: new-status,
        previous-status: previous-status,
        block-height: burn-block-height,
        owner: (get owner policy),
        counterparty: (get counterparty policy),
        policy-type: (get policy-type policy),
        position-type: (get position-type policy),
        collateral-token: (get collateral-token policy),    ;; PR-116: Include in event
        settlement-token: (get settlement-token policy),    ;; PR-116: Include in event
        protected-asset: (get protected-asset policy)       ;; PR-116: Include in event
      })

      (ok true)
    )
  )
)

;; Process premium distribution for an expired policy
;; Can be called by the backend authorized principal or the counterparty
(define-public (process-expired-policy-premium (policy-id uint))
  (let
    (
      ;; Get the policy entry
      (policy (unwrap! (map-get? policies { id: policy-id }) ERR-NOT-FOUND))
      (policy-status (get status policy))
      (counterparty-principal (get counterparty policy))
      (premium-already-distributed (get premium-distributed policy))
    )
    (begin
      ;; Verify caller authorization
      (asserts! (or (is-eq tx-sender (var-get backend-authorized-principal))
                   (is-eq tx-sender counterparty-principal))
                ERR-UNAUTHORIZED)
      
      ;; Verify policy is expired and premium not yet distributed
      (asserts! (is-eq policy-status STATUS-EXPIRED) ERR-NOT-ACTIVE)
      (asserts! (not premium-already-distributed) ERR-PREMIUM-ALREADY-DISTRIBUTED)
      
      ;; Mark premium as distributed
      (map-set policies
        { id: policy-id }
        (merge policy { premium-distributed: true })
      )
      
      ;; PR-119: Enhanced premium distribution event emission
      (print {
        event: "premium-distribution-initiated",
        policy-id: policy-id,
        owner: (get owner policy),
        counterparty: counterparty-principal,
        premium-amount: (get premium policy),
        policy-type: (get policy-type policy),
        position-type: (get position-type policy),
        collateral-token: (get collateral-token policy),
        settlement-token: (get settlement-token policy),
        protected-asset: (get protected-asset policy),
        expiration-height: (get expiration-height policy),
        creation-height: (get creation-height policy)
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

    ;; For now, we're implementing a simplified version that just returns success
    ;; A more complex implementation with fold will be added in a future update
    (print { event: "batch-expire-attempt", policy-count: (len policy-ids) })
    (ok true)
  )
)

;; Try to expire a single policy - internal helper for batch operation
;; Returns (ok true) if successful or skipped, error only on unexpected issues.
(define-private (try-expire-policy (policy-id uint))
  (match (map-get? policies { id: policy-id })
    ;; Policy found
    policy 
    (let
      (
        (current-status (get status policy))
        (expiration (get expiration-height policy))
      )
      ;; Only expire if active and past expiration height
      (if (and (is-eq current-status STATUS-ACTIVE)
                (>= burn-block-height expiration))
          (begin
            ;; Update the policy status
            (map-set policies
              { id: policy-id }
              (merge policy { status: STATUS-EXPIRED })
            )
            ;; Log the status change with enhanced event (PR-119 partial)
            (print {
              event: "policy-status-updated",
              policy-id: policy-id,
              new-status: STATUS-EXPIRED,
              previous-status: current-status,
              block-height: burn-block-height,
              owner: (get owner policy),
              counterparty: (get counterparty policy),
              policy-type: (get policy-type policy),
              position-type: (get position-type policy),
              collateral-token: (get collateral-token policy),
              settlement-token: (get settlement-token policy),
              protected-asset: (get protected-asset policy)
            })
            (ok true) ;; Indicate successful update
          )
          ;; No update needed (already non-active or not expired)
          (ok false)
      )
    )
    ;; Policy not found - this is considered a normal case in batch expiration
    (ok false)
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

;; Get policy IDs for a counterparty (Income Irene)
(define-read-only (get-policy-ids-by-counterparty (counterparty principal))
  (default-to { policy-ids: (list) }
              (map-get? policies-by-counterparty { counterparty: counterparty })))

;; Check if a policy is active
(define-read-only (is-policy-active (policy-id uint))
  (match (map-get? policies { id: policy-id })
    policy (ok (is-eq (get status policy) STATUS-ACTIVE))
    (err ERR-NOT-FOUND) ;; Returns (err u404) if not found
  )
)

;; PR-116: Get the collateral token for a policy
(define-read-only (get-collateral-token (policy-id uint))
  (match (map-get? policies { id: policy-id })
    policy (ok (get collateral-token policy))
    (err ERR-NOT-FOUND)
  )
)

;; PR-116: Get the settlement token for a policy
(define-read-only (get-settlement-token (policy-id uint))
  (match (map-get? policies { id: policy-id })
    policy (ok (get settlement-token policy))
    (err ERR-NOT-FOUND)
  )
)

;; PR-116: Get the protected asset for a policy
(define-read-only (get-protected-asset (policy-id uint))
  (match (map-get? policies { id: policy-id })
    policy (ok (get protected-asset policy))
    (err ERR-NOT-FOUND)
  )
)

;; PR-116: Check if premium has been distributed for a policy
(define-read-only (is-premium-distributed (policy-id uint))
  (match (map-get? policies { id: policy-id })
    policy (ok (get premium-distributed policy))
    (err ERR-NOT-FOUND)
  )
)

;; --- Advanced Read-Only Functions ---

;; Get the current BTC price from the Oracle contract
;; Currently implemented as a placeholder to avoid dependency issues
(define-read-only (get-current-btc-price)
  ;; This is a placeholder implementation to avoid dependency issues.
  ;; In production, this would call the oracle contract.
  ;; During deployment, the actual contract call will be configured after all contracts are deployed.
  (ok u30000) ;; Return a fixed test price during development
)

;; Check if a policy is exercisable based on the current Oracle price
(define-read-only (is-policy-exercisable (policy-id uint))
  (let (
      (policy (unwrap! (map-get? policies { id: policy-id }) ERR-NOT-FOUND))
      ;; Since get-current-btc-price now returns (ok uint) instead of using match,
      ;; we need to handle it differently
      (current-price (unwrap! (get-current-btc-price) (err u501))) ;; Error u501 for Oracle price fetch error
    )
    ;; Check if the policy is active first
    (asserts! (is-eq (get status policy) STATUS-ACTIVE) ERR-NOT-ACTIVE)
    ;; Check if it's expired
    (asserts! (< burn-block-height (get expiration-height policy)) ERR-EXPIRED)

    (if (is-eq (get policy-type policy) POLICY-TYPE-PUT)
      ;; PUT: Exercisable if current price < protected value
      (ok (< current-price (get protected-value policy)))
      ;; CALL: Exercisable if current price > protected value
      (ok (> current-price (get protected-value policy)))
    )
  )
)

;; Calculate the settlement amount for a policy based on a given price
;; Note: This uses a provided price, not necessarily the live Oracle price
(define-read-only (calculate-settlement-amount (policy-id uint) (settlement-price uint))
  (let ((policy (unwrap! (map-get? policies { id: policy-id }) ERR-NOT-FOUND)))
    (ok 
      (if (is-eq (get policy-type policy) POLICY-TYPE-PUT)
        ;; PUT: max(0, strike - settlement_price) * amount / strike
        (if (>= settlement-price (get protected-value policy))
          u0
          (/ (* (- (get protected-value policy) settlement-price) (get protection-amount policy)) (get protected-value policy)))
        ;; CALL: max(0, settlement_price - strike) * amount / strike
        (if (<= settlement-price (get protected-value policy))
          u0
          (/ (* (- settlement-price (get protected-value policy)) (get protection-amount policy)) (get protected-value policy)))
      )
    )
  )
)

;; Check if the Liquidity Pool has sufficient collateral for a potential policy (PR-111)
;; Currently implemented as a placeholder to avoid circular dependency
(define-read-only (check-liquidity-for-policy
  (protected-value uint)
  (protection-amount uint)
  (policy-type (string-ascii 4)))
  ;; This is a placeholder implementation to avoid circular dependency.
  ;; In production, this would call the liquidity-pool-vault contract.
  ;; During deployment, the actual contract call will be configured after both contracts are deployed.
  (ok true) ;; Always return success during development/testing
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

;; --- Private Functions ---

;; Request collateral lock from the Liquidity Pool contract (PR-111)
;; Currently implemented as a placeholder to avoid circular dependency
(define-private (lock-policy-collateral
  (policy-id uint)
  (protected-value uint)
  (protection-amount uint)
  (policy-type (string-ascii 4)))
  ;; This is a placeholder implementation to avoid circular dependency.
  ;; In production, this would call the liquidity-pool-vault contract.
  ;; During deployment, the actual contract call will be configured after both contracts are deployed.
  (ok true) ;; Always return success during development/testing
)

;; Calculate required collateral amount based on policy parameters
(define-private (calculate-required-collateral
  (policy-type (string-ascii 4)) 
  (protected-value uint) 
  (protection-amount uint))
  ;; Simplified: Assume PUT requires full protection amount in collateral token
  ;; Assume CALL requires a fraction (e.g., 50%) - adjust based on risk model
  (if (is-eq policy-type POLICY-TYPE-PUT)
    protection-amount
    (/ protection-amount u2) ;; Example: 50% for CALL
  )
)

;; PR-116: Determine the required token ID based on policy type
(define-private (get-token-id-for-policy (policy-type (string-ascii 4)))
  ;; For PUT options, collateral is STX (to pay out if BTC price drops)
  ;; For CALL options, collateral is sBTC (to deliver if BTC price rises)
  (if (is-eq policy-type POLICY-TYPE-PUT)
    TOKEN-STX
    TOKEN-SBTC
  )
) 