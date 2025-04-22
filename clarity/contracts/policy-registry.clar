;; title: policy-registry
;; version: 1.0.0
;; summary: Policy Registry Contract for BitHedge platform
;; description: Manages the lifecycle of all protection policies in the BitHedge platform, including creation, activation, expiration, and querying.

;; traits
;;

;; token definitions
;;

;; constants
;;
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-POLICY-NOT-FOUND (err u101))
(define-constant ERR-INVALID-PARAMETERS (err u102))
(define-constant ERR-INSUFFICIENT-FUNDS (err u103))
(define-constant ERR-INSUFFICIENT-COLLATERAL (err u104))
(define-constant ERR-POLICY-EXPIRED (err u105))
(define-constant ERR-POLICY-ALREADY-ACTIVATED (err u106))
(define-constant ERR-POLICY-INACTIVE (err u107))
(define-constant ERR-ACTIVATION-CONDITION-NOT-MET (err u108))

;; data vars
;;
;; Policy counter for unique IDs
(define-data-var policy-counter uint u0)
(define-data-var total-active-policies uint u0)
(define-data-var total-protected-value uint u0)
(define-data-var total-premium-collected uint u0)

;; data maps
;;
;; Primary policy data structure
(define-map policies
  { policy-id: uint }
  {
    owner: principal,                  ;; Protective Peter (policy buyer)
    protected-value: uint,             ;; Strike price in STX satoshis
    expiration-height: uint,           ;; Block height when policy expires
    protected-amount: uint,            ;; Amount in Bitcoin satoshis
    premium: uint,                     ;; Cost in STX satoshis
    policy-type: (string-ascii 4),     ;; "PUT" or "CALL"
    counterparty: principal,           ;; Income Irene (direct provider) or liquidity pool
    creation-height: uint,             ;; Block height when created
    status: uint,                      ;; 0=active, 1=exercised, 2=expired, 3=canceled
    exercise-price: uint,              ;; Price at exercise if activated (0 if not)
    exercise-height: uint              ;; Block when exercised (0 if not)
  }
)

;; Mapping of policies owned by a user (Protective Peter)
(define-map policies-by-owner
  { owner: principal }
  { policy-ids: (list 250 uint) }
)

;; Mapping of policies provided by a counterparty (Income Irene)
(define-map policies-by-provider
  { provider: principal }
  { policy-ids: (list 250 uint) }
)

;; Mapping of active policies by expiration
(define-map policies-by-expiration
  { expiration-height: uint }
  { policy-ids: (list 250 uint) }
)

;; public functions
;;

;; Create a new protection policy
(define-public (create-policy 
    (protected-value uint) 
    (expiration-height uint)
    (protected-amount uint)
    (premium uint)
    (policy-type (string-ascii 4))
    (counterparty principal))
  (let 
    (
      (new-policy-id (+ (var-get policy-counter) u1))
      (current-height block-height)
    )
    
    ;; Validate parameters
    (asserts! (and 
      (> protected-value u0) 
      (> protected-amount u0)
      (> premium u0)
      (> expiration-height current-height)
      (or (is-eq policy-type "PUT") (is-eq policy-type "CALL"))) 
      ERR-INVALID-PARAMETERS)
    
    ;; TODO: Transfer premium from buyer to provider
    ;; TODO: Ensure proper collateralization (will integrate with Liquidity Pool contract)
    
    ;; Create the new policy
    (map-set policies
      { policy-id: new-policy-id }
      {
        owner: tx-sender,
        protected-value: protected-value,
        expiration-height: expiration-height,
        protected-amount: protected-amount,
        premium: premium,
        policy-type: policy-type,
        counterparty: counterparty,
        creation-height: current-height,
        status: u0, ;; Active
        exercise-price: u0,
        exercise-height: u0
      }
    )
    
    ;; Update policy counter
    (var-set policy-counter new-policy-id)
    
    ;; Update total stats
    (var-set total-active-policies (+ (var-get total-active-policies) u1))
    (var-set total-protected-value (+ (var-get total-protected-value) protected-value))
    (var-set total-premium-collected (+ (var-get total-premium-collected) premium))
    
    ;; Update indexing maps
    (add-policy-to-owner-index tx-sender new-policy-id)
    (add-policy-to-provider-index counterparty new-policy-id)
    (add-policy-to-expiration-index expiration-height new-policy-id)
    
    ;; Emit policy creation event
    (emit-policy-created-event new-policy-id tx-sender protected-value expiration-height protected-amount premium policy-type counterparty current-height)
    
    (ok new-policy-id)
  )
)

;; Activate (exercise) a policy
(define-public (activate-policy 
    (policy-id uint)
    (exercise-price uint))
  (let 
    (
      (policy (unwrap! (map-get? policies { policy-id: policy-id }) ERR-POLICY-NOT-FOUND))
      (current-height block-height)
    )
    
    ;; Check policy ownership
    (asserts! (is-eq tx-sender (get owner policy)) ERR-NOT-AUTHORIZED)
    
    ;; Check if policy is still active
    (asserts! (is-eq (get status policy) u0) ERR-POLICY-INACTIVE)
    
    ;; Check if policy is not expired
    (asserts! (<= current-height (get expiration-height policy)) ERR-POLICY-EXPIRED)
    
    ;; Validate activation condition: for PUT, current price must be below protected value
    ;; For CALL, current price must be above protected value
    (asserts! 
      (if (is-eq (get policy-type policy) "PUT")
        (< exercise-price (get protected-value policy))
        (> exercise-price (get protected-value policy))
      )
      ERR-ACTIVATION-CONDITION-NOT-MET)
    
    ;; TODO: Calculate settlement amount
    ;; TODO: Coordinate with liquidity pool for settlement
    
    ;; Update policy status to exercised
    (map-set policies
      { policy-id: policy-id }
      (merge policy {
        status: u1, ;; Exercised
        exercise-price: exercise-price,
        exercise-height: current-height
      })
    )
    
    ;; Update total stats
    (var-set total-active-policies (- (var-get total-active-policies) u1))
    
    ;; Emit policy activation event
    (print {
      event: "policy-activated",
      policy-id: policy-id,
      exercise-price: exercise-price,
      exercise-height: current-height,
      owner: (get owner policy)
    })
    
    (ok true)
  )
)

;; Handle policy expiration
(define-public (expire-policy (policy-id uint))
  (let 
    (
      (policy (unwrap! (map-get? policies { policy-id: policy-id }) ERR-POLICY-NOT-FOUND))
      (current-height block-height)
    )
    
    ;; Check if policy is active
    (asserts! (is-eq (get status policy) u0) ERR-POLICY-INACTIVE)
    
    ;; Check if policy has actually expired
    (asserts! (> current-height (get expiration-height policy)) ERR-INVALID-PARAMETERS)
    
    ;; TODO: Release collateral back to providers
    
    ;; Update policy status to expired
    (map-set policies
      { policy-id: policy-id }
      (merge policy {
        status: u2 ;; Expired
      })
    )
    
    ;; Update total stats
    (var-set total-active-policies (- (var-get total-active-policies) u1))
    
    ;; Emit policy expiration event
    (print {
      event: "policy-expired",
      policy-id: policy-id,
      expiration-height: (get expiration-height policy)
    })
    
    (ok true)
  )
)

;; Cancel policy (early termination)
(define-public (cancel-policy (policy-id uint))
  (let 
    (
      (policy (unwrap! (map-get? policies { policy-id: policy-id }) ERR-POLICY-NOT-FOUND))
      (current-height block-height)
    )
    
    ;; Check authorization - only owner or counterparty can cancel
    (asserts! (or 
      (is-eq tx-sender (get owner policy))
      (is-eq tx-sender (get counterparty policy))
    ) ERR-NOT-AUTHORIZED)
    
    ;; Check if policy is still active
    (asserts! (is-eq (get status policy) u0) ERR-POLICY-INACTIVE)
    
    ;; TODO: Calculate refund amounts (if applicable)
    ;; TODO: Release collateral
    
    ;; Update policy status to canceled
    (map-set policies
      { policy-id: policy-id }
      (merge policy {
        status: u3 ;; Canceled
      })
    )
    
    ;; Update total stats
    (var-set total-active-policies (- (var-get total-active-policies) u1))
    
    ;; Emit policy cancellation event
    (print {
      event: "policy-canceled",
      policy-id: policy-id,
      cancel-height: current-height
    })
    
    (ok true)
  )
)

;; Batch expire policies at a specific expiration height
(define-public (batch-expire-policies (expiration-height uint) (max-batch-size uint))
  (let
    (
      (expired-policies (default-to { policy-ids: (list) } (map-get? policies-by-expiration { expiration-height: expiration-height })))
      (current-height block-height)
    )
    
    ;; Check if height has actually passed
    (asserts! (> current-height expiration-height) ERR-INVALID-PARAMETERS)
    
    ;; Limit batch size to avoid excessive gas
    (asserts! (<= max-batch-size u100) ERR-INVALID-PARAMETERS)
    
    ;; Process up to max-batch-size policies
    (batch-expire-policy-list (get policy-ids expired-policies) max-batch-size current-height)
  )
)

;; read only functions
;;

;; Get policy details by ID
(define-read-only (get-policy (policy-id uint))
  (map-get? policies { policy-id: policy-id })
)

;; Get policies owned by a specific user
(define-read-only (get-policies-by-owner (owner principal))
  (map-get? policies-by-owner { owner: owner })
)

;; Get policies backed by a specific provider
(define-read-only (get-policies-by-provider (provider principal))
  (map-get? policies-by-provider { provider: provider })
)

;; Get policies that expire at a specific block height
(define-read-only (get-policies-by-expiration (expiration-height uint))
  (map-get? policies-by-expiration { expiration-height: expiration-height })
)

;; Get total active policies
(define-read-only (get-total-active-policies)
  (var-get total-active-policies)
)

;; Get total protected value
(define-read-only (get-total-protected-value)
  (var-get total-protected-value)
)

;; Get total premium collected
(define-read-only (get-total-premium-collected)
  (var-get total-premium-collected)
)

;; Get policies by status
(define-read-only (get-policies-by-status (owner principal) (status uint))
  (let
    (
      (all-policy-ids (default-to { policy-ids: (list) } (map-get? policies-by-owner { owner: owner })))
      (filtered-ids (filter-policies-by-status (get policy-ids all-policy-ids) status))
    )
    { policy-ids: filtered-ids }
  )
)

;; private functions
;;

;; Add policy to owner index
(define-private (add-policy-to-owner-index (owner principal) (policy-id uint))
  (let 
    (
      (owner-policies (default-to { policy-ids: (list) } (map-get? policies-by-owner { owner: owner })))
      (updated-policies (unwrap! (as-max-len? (append (get policy-ids owner-policies) policy-id) u250) ERR-INVALID-PARAMETERS))
    )
    (map-set policies-by-owner
      { owner: owner }
      { policy-ids: updated-policies }
    )
  )
)

;; Add policy to provider index
(define-private (add-policy-to-provider-index (provider principal) (policy-id uint))
  (let 
    (
      (provider-policies (default-to { policy-ids: (list) } (map-get? policies-by-provider { provider: provider })))
      (updated-policies (unwrap! (as-max-len? (append (get policy-ids provider-policies) policy-id) u250) ERR-INVALID-PARAMETERS))
    )
    (map-set policies-by-provider
      { provider: provider }
      { policy-ids: updated-policies }
    )
  )
)

;; Add policy to expiration index
(define-private (add-policy-to-expiration-index (expiration-height uint) (policy-id uint))
  (let 
    (
      (expiration-policies (default-to { policy-ids: (list) } (map-get? policies-by-expiration { expiration-height: expiration-height })))
      (updated-policies (unwrap! (as-max-len? (append (get policy-ids expiration-policies) policy-id) u250) ERR-INVALID-PARAMETERS))
    )
    (map-set policies-by-expiration
      { expiration-height: expiration-height }
      { policy-ids: updated-policies }
    )
  )
)

;; Filter policies by status
(define-private (filter-policies-by-status (policy-ids (list 250 uint)) (status uint))
  (filter filter-by-status policy-ids)
)

;; Helper for policy status filtering
(define-private (filter-by-status (policy-id uint))
  (let
    (
      (policy (map-get? policies { policy-id: policy-id }))
    )
    (match policy
      policy-map (is-eq (get status policy-map) status)
      false
    )
  )
)

;; Update the policy creation event to include more information
(define-private (emit-policy-created-event (policy-id uint) (owner principal) (protected-value uint) 
                                          (expiration-height uint) (protected-amount uint) 
                                          (premium uint) (policy-type (string-ascii 4)) 
                                          (counterparty principal) (creation-height uint))
  (print {
    event: "policy-created",
    policy-id: policy-id,
    owner: owner,
    protected-value: protected-value,
    expiration-height: expiration-height,
    protected-amount: protected-amount,
    premium: premium,
    policy-type: policy-type,
    counterparty: counterparty,
    creation-height: creation-height
  })
)

;; Process a list of policies to expire
(define-private (batch-expire-policy-list (policy-ids (list 250 uint)) (max-count uint) (current-height uint))
  (let
    (
      (batch-size (min max-count (len policy-ids)))
    )
    (map expire-policy-internal (take batch-size policy-ids))
    
    (ok { processed: batch-size })
  )
)

;; Internal function to expire a policy
(define-private (expire-policy-internal (policy-id uint))
  (let 
    (
      (policy (map-get? policies { policy-id: policy-id }))
    )
    (match policy
      policy-map 
        (if (and 
              (is-eq (get status policy-map) u0) 
              (< (get expiration-height policy-map) block-height)
            )
          (begin
            ;; Update policy status to expired
            (map-set policies
              { policy-id: policy-id }
              (merge policy-map {
                status: u2 ;; Expired
              })
            )
            
            ;; Update total stats
            (var-set total-active-policies (- (var-get total-active-policies) u1))
            
            ;; Emit policy expiration event
            (print {
              event: "policy-expired",
              policy-id: policy-id,
              expiration-height: (get expiration-height policy-map)
            })
            
            true
          )
          false
        )
      false
    )
  )
) 