;; title: treasury
;; version: 1.0.0
;; summary: Treasury Contract for the BitHedge platform
;; description: Manages fee collection, distribution, and allocation to different parts of the platform.

;; traits
;;

;; token definitions
;;

;; constants
;;
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-NOT-INITIALIZED (err u101))
(define-constant ERR-INVALID-PARAMETERS (err u102))
(define-constant ERR-INSUFFICIENT-FUNDS (err u103))
(define-constant ERR-ALLOCATION-NOT-FOUND (err u104))
(define-constant ERR-FEE-DISTRIBUTOR-NOT-FOUND (err u105))
(define-constant ERR-TRANSFER-FAILED (err u106))
(define-constant ERR-INVALID-DISCOUNT (err u107))
(define-constant ERR-DISCOUNT-NOT-ACTIVE (err u108))

;; data vars
;;
;; Treasury initialization status
(define-data-var treasury-initialized bool false)

;; Treasury balance (STX)
(define-data-var treasury-balance-stx uint u0)

;; Total fees collected (STX)
(define-data-var total-fees-collected uint u0)

;; Total fees distributed (STX)
(define-data-var total-fees-distributed uint u0)

;; Admin address
(define-data-var admin-address principal tx-sender)

;; Contract addresses
(define-data-var policy-registry-address principal tx-sender)
(define-data-var liquidity-pool-address principal tx-sender)
(define-data-var insurance-fund-address principal tx-sender)
(define-data-var governance-address principal tx-sender)

;; Fee allocation counters
(define-data-var allocation-counter uint u0)
(define-data-var fee-distributor-counter uint u0)

;; data maps
;;
;; Fee allocations (allocation ID -> allocation details)
(define-map fee-allocations
  { allocation-id: uint }
  {
    name: (string-utf8 50),
    receiver: principal,
    allocation-percentage: uint,  ;; Scaled by 1,000,000 (1M = 100%)
    active: bool,
    total-received: uint,
    last-distribution: uint
  }
)

;; Fee distributors (distributor ID -> distributor details)
(define-map fee-distributors
  { distributor-id: uint }
  {
    name: (string-utf8 50),
    contract: principal,
    fee-type: (string-utf8 20),
    fee-percentage: uint,  ;; Scaled by 1,000,000 (1M = 100%)
    active: bool,
    total-collected: uint,
    last-collection: uint
  }
)

;; Fee discount programs (user principal -> discount details)
(define-map fee-discounts
  { user: principal }
  {
    discount-percentage: uint,  ;; Scaled by 1,000,000 (1M = 100%)
    expiration-height: uint,
    total-discount-amount: uint,
    active: bool
  }
)

;; Distribution history (batch ID -> distribution details)
(define-map distribution-history
  { batch-id: uint }
  {
    block-height: uint,
    total-amount: uint,
    distributions: (list 10 {
      allocation-id: uint,
      amount: uint
    })
  }
)

;; Distribution batch counter
(define-data-var distribution-batch-counter uint u0)

;; public functions
;;

;; Initialize treasury
(define-public (initialize-treasury)
  (begin
    ;; Check if already initialized
    (asserts! (not (var-get treasury-initialized)) ERR-NOT-AUTHORIZED)
    
    ;; Set admin and initial variables
    (var-set admin-address tx-sender)
    (var-set treasury-initialized true)
    
    ;; Initialize default allocations
    (try! (add-allocation "Platform Development" tx-sender u350000 true))
    (try! (add-allocation "Insurance Fund" tx-sender u200000 true))
    (try! (add-allocation "Governance" tx-sender u150000 true))
    (try! (add-allocation "Community Incentives" tx-sender u300000 true))
    
    ;; Emit initialization event
    (print {
      event: "treasury-initialized",
      admin: tx-sender,
      block-height: block-height
    })
    
    (ok true)
  )
)

;; Add fee collector
(define-public (add-fee-distributor 
    (name (string-utf8 50))
    (contract principal)
    (fee-type (string-utf8 20))
    (fee-percentage uint)
    (active bool))
  (let
    (
      (caller tx-sender)
      (distributor-id (+ (var-get fee-distributor-counter) u1))
    )
    
    ;; Check if treasury is initialized
    (asserts! (var-get treasury-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Validate parameters
    (asserts! (and 
                (<= fee-percentage u1000000)
                (> (len name) u0)
                (> (len fee-type) u0))
             ERR-INVALID-PARAMETERS)
    
    ;; Create fee distributor
    (map-set fee-distributors
      { distributor-id: distributor-id }
      {
        name: name,
        contract: contract,
        fee-type: fee-type,
        fee-percentage: fee-percentage,
        active: active,
        total-collected: u0,
        last-collection: u0
      }
    )
    
    ;; Update counter
    (var-set fee-distributor-counter distributor-id)
    
    ;; Emit event
    (print {
      event: "fee-distributor-added",
      distributor-id: distributor-id,
      name: name,
      contract: contract,
      fee-type: fee-type,
      fee-percentage: fee-percentage,
      active: active
    })
    
    (ok distributor-id)
  )
)

;; Add allocation
(define-public (add-allocation
    (name (string-utf8 50))
    (receiver principal)
    (allocation-percentage uint)
    (active bool))
  (let
    (
      (caller tx-sender)
      (allocation-id (+ (var-get allocation-counter) u1))
    )
    
    ;; Check if treasury is initialized
    (asserts! (var-get treasury-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Validate parameters
    (asserts! (and 
                (<= allocation-percentage u1000000)
                (> (len name) u0))
             ERR-INVALID-PARAMETERS)
    
    ;; Create allocation
    (map-set fee-allocations
      { allocation-id: allocation-id }
      {
        name: name,
        receiver: receiver,
        allocation-percentage: allocation-percentage,
        active: active,
        total-received: u0,
        last-distribution: u0
      }
    )
    
    ;; Update counter
    (var-set allocation-counter allocation-id)
    
    ;; Emit event
    (print {
      event: "allocation-added",
      allocation-id: allocation-id,
      name: name,
      receiver: receiver,
      allocation-percentage: allocation-percentage,
      active: active
    })
    
    (ok allocation-id)
  )
)

;; Update allocation
(define-public (update-allocation
    (allocation-id uint)
    (new-receiver (optional principal))
    (new-percentage (optional uint))
    (new-active (optional bool)))
  (let
    (
      (caller tx-sender)
      (allocation (unwrap! (map-get? fee-allocations { allocation-id: allocation-id }) ERR-ALLOCATION-NOT-FOUND))
      (updated-receiver (default-to (get receiver allocation) new-receiver))
      (updated-percentage (default-to (get allocation-percentage allocation) new-percentage))
      (updated-active (default-to (get active allocation) new-active))
    )
    
    ;; Check if treasury is initialized
    (asserts! (var-get treasury-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Validate parameters
    (asserts! (<= updated-percentage u1000000) ERR-INVALID-PARAMETERS)
    
    ;; Update allocation
    (map-set fee-allocations
      { allocation-id: allocation-id }
      (merge allocation {
        receiver: updated-receiver,
        allocation-percentage: updated-percentage,
        active: updated-active
      })
    )
    
    ;; Emit event
    (print {
      event: "allocation-updated",
      allocation-id: allocation-id,
      receiver: updated-receiver,
      allocation-percentage: updated-percentage,
      active: updated-active
    })
    
    (ok true)
  )
)

;; Collect fees from a contract
(define-public (collect-fees
    (amount uint)
    (fee-type (string-utf8 20)))
  (let
    (
      (caller tx-sender)
      (current-block block-height)
      (distributor-id (find-distributor-by-contract caller))
    )
    
    ;; Check if treasury is initialized
    (asserts! (var-get treasury-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if the caller is a registered fee collector
    (asserts! (> distributor-id u0) ERR-FEE-DISTRIBUTOR-NOT-FOUND)
    
    ;; Transfer STX from caller to treasury
    (try! (stx-transfer? amount caller (as-contract tx-sender)))
    
    ;; Update treasury balance
    (var-set treasury-balance-stx (+ (var-get treasury-balance-stx) amount))
    
    ;; Update total fees collected
    (var-set total-fees-collected (+ (var-get total-fees-collected) amount))
    
    ;; Update distributor stats
    (match (map-get? fee-distributors { distributor-id: distributor-id })
      distributor-data 
        (map-set fee-distributors
          { distributor-id: distributor-id }
          (merge distributor-data {
            total-collected: (+ (get total-collected distributor-data) amount),
            last-collection: current-block
          }))
      ERR-FEE-DISTRIBUTOR-NOT-FOUND
    )
    
    ;; Emit event
    (print {
      event: "fees-collected",
      distributor: caller,
      amount: amount,
      fee-type: fee-type,
      block-height: current-block
    })
    
    (ok true)
  )
)

;; Distribute fees according to allocations
(define-public (distribute-fees)
  (let
    (
      (caller tx-sender)
      (current-block block-height)
      (available-balance (var-get treasury-balance-stx))
      (batch-id (+ (var-get distribution-batch-counter) u1))
      (distributions (list))
    )
    
    ;; Check if treasury is initialized
    (asserts! (var-get treasury-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Check if there are funds to distribute
    (asserts! (> available-balance u0) ERR-INSUFFICIENT-FUNDS)
    
    ;; Process allocations
    (let
      (
        (result (execute-distribution available-balance batch-id))
        (distributed-amount (get amount result))
        (updated-distributions (get distributions result))
      )
      
      ;; Update treasury balance
      (var-set treasury-balance-stx (- available-balance distributed-amount))
      
      ;; Update total fees distributed
      (var-set total-fees-distributed (+ (var-get total-fees-distributed) distributed-amount))
      
      ;; Update distribution counter
      (var-set distribution-batch-counter batch-id)
      
      ;; Emit event
      (print {
        event: "fees-distributed",
        batch-id: batch-id,
        amount: distributed-amount,
        block-height: current-block
      })
      
      (ok { batch-id: batch-id, amount: distributed-amount })
    )
  )
)

;; Set fee discount for a user
(define-public (set-fee-discount
    (user principal)
    (discount-percentage uint)
    (expiration-blocks uint))
  (let
    (
      (caller tx-sender)
      (current-block block-height)
      (expiration-height (+ current-block expiration-blocks))
    )
    
    ;; Check if treasury is initialized
    (asserts! (var-get treasury-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Validate parameters
    (asserts! (and 
                (<= discount-percentage u1000000)
                (> expiration-blocks u0))
             ERR-INVALID-PARAMETERS)
    
    ;; Set or update discount
    (map-set fee-discounts
      { user: user }
      {
        discount-percentage: discount-percentage,
        expiration-height: expiration-height,
        total-discount-amount: u0,
        active: true
      }
    )
    
    ;; Emit event
    (print {
      event: "fee-discount-set",
      user: user,
      discount-percentage: discount-percentage,
      expiration-height: expiration-height
    })
    
    (ok true)
  )
)

;; Apply fee discount for a user
(define-public (apply-fee-discount
    (user principal)
    (original-fee uint))
  (let
    (
      (caller tx-sender)
      (current-block block-height)
      (discount-data (unwrap! (map-get? fee-discounts { user: user }) (ok original-fee)))
      (is-active (and 
                   (get active discount-data)
                   (<= current-block (get expiration-height discount-data))))
    )
    
    ;; Check if treasury is initialized
    (asserts! (var-get treasury-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is an authorized contract
    (asserts! (or 
                (is-eq caller (var-get policy-registry-address))
                (is-eq caller (var-get liquidity-pool-address)))
             ERR-NOT-AUTHORIZED)
    
    ;; If discount not active, return original fee
    (if (not is-active)
      (ok original-fee)
      (let
        (
          (discount-percentage (get discount-percentage discount-data))
          (discount-amount (/ (* original-fee discount-percentage) u1000000))
          (discounted-fee (- original-fee discount-amount))
          (total-discount (+ (get total-discount-amount discount-data) discount-amount))
        )
        
        ;; Update discount total
        (map-set fee-discounts
          { user: user }
          (merge discount-data {
            total-discount-amount: total-discount
          })
        )
        
        ;; Emit event
        (print {
          event: "fee-discount-applied",
          user: user,
          original-fee: original-fee,
          discount-amount: discount-amount,
          discounted-fee: discounted-fee
        })
        
        (ok discounted-fee)
      ))
  )
)

;; Update contract addresses
(define-public (set-contract-addresses
    (policy-registry principal)
    (liquidity-pool principal)
    (insurance-fund principal)
    (governance principal))
  (let
    (
      (caller tx-sender)
    )
    
    ;; Check if treasury is initialized
    (asserts! (var-get treasury-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Update contract addresses
    (var-set policy-registry-address policy-registry)
    (var-set liquidity-pool-address liquidity-pool)
    (var-set insurance-fund-address insurance-fund)
    (var-set governance-address governance)
    
    ;; Emit address update event
    (print {
      event: "contract-addresses-updated",
      policy-registry: policy-registry,
      liquidity-pool: liquidity-pool,
      insurance-fund: insurance-fund,
      governance: governance,
      updater: caller
    })
    
    (ok true)
  )
)

;; Transfer admin role
(define-public (transfer-admin
    (new-admin principal))
  (let
    (
      (current-admin tx-sender)
    )
    
    ;; Check if treasury is initialized
    (asserts! (var-get treasury-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is current admin
    (asserts! (is-eq current-admin (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Update admin
    (var-set admin-address new-admin)
    
    ;; Emit admin transfer event
    (print {
      event: "admin-transferred",
      previous-admin: current-admin,
      new-admin: new-admin
    })
    
    (ok true)
  )
)

;; read only functions
;;

;; Get treasury info
(define-read-only (get-treasury-info)
  {
    treasury-balance: (var-get treasury-balance-stx),
    total-fees-collected: (var-get total-fees-collected),
    total-fees-distributed: (var-get total-fees-distributed),
    allocations-count: (var-get allocation-counter),
    fee-distributors-count: (var-get fee-distributor-counter)
  }
)

;; Get allocation details
(define-read-only (get-allocation-details (allocation-id uint))
  (map-get? fee-allocations { allocation-id: allocation-id })
)

;; Get distributor details
(define-read-only (get-distributor-details (distributor-id uint))
  (map-get? fee-distributors { distributor-id: distributor-id })
)

;; Get fee discount details
(define-read-only (get-fee-discount (user principal))
  (map-get? fee-discounts { user: user })
)

;; Get distribution history
(define-read-only (get-distribution-details (batch-id uint))
  (map-get? distribution-history { batch-id: batch-id })
)

;; Get all active allocations
(define-read-only (get-active-allocations)
  (let
    (
      (allocation-ids (get-allocation-ids))
      (active-allocations (filter is-allocation-active allocation-ids))
    )
    active-allocations
  )
)

;; private functions
;;

;; Find distributor by contract address
(define-private (find-distributor-by-contract (contract-address principal))
  (let
    (
      (distributor-count (var-get fee-distributor-counter))
      (matching-id (find-distributor contract-address u1 distributor-count))
    )
    matching-id
  )
)

;; Helper function to find distributor recursively
(define-private (find-distributor (contract-address principal) (current-id uint) (max-id uint))
  (if (> current-id max-id)
    u0  ;; Not found
    (match (map-get? fee-distributors { distributor-id: current-id })
      distributor-data
        (if (and 
              (is-eq (get contract distributor-data) contract-address)
              (get active distributor-data))
          current-id
          (find-distributor contract-address (+ current-id u1) max-id))
      u0  ;; distributor-data is none
    )
  )
)

;; Execute fee distribution
(define-private (execute-distribution (total-amount uint) (batch-id uint))
  (let
    (
      (active-allocations (get-active-allocations))
      (total-active-percentage (fold + u0 (map get-allocation-percentage active-allocations)))
      (distributions (list))
      (distributed-amount u0)
    )
    
    (if (or (is-eq total-active-percentage u0) (is-eq (len active-allocations) u0))
      ;; No active allocations, return with no distribution
      { amount: u0, distributions: (list) }
      ;; Execute distribution to each allocation
      (let
        (
          (result (process-allocations active-allocations total-amount total-active-percentage batch-id))
        )
        result
      )
    )
  )
)

;; Process allocations and distribute fees
(define-private (process-allocations 
    (allocations (list 255 uint)) 
    (total-amount uint) 
    (total-percentage uint)
    (batch-id uint))
  (let
    (
      (distributions (list))
      (distributed-amount u0)
      (current-block block-height)
    )
    
    (fold process-allocation 
          { amount: u0, distributions: (list) } 
          allocations)
  )
)

;; Process a single allocation
(define-private (process-allocation 
    (allocation-id uint) 
    (result { amount: uint, distributions: (list 10 { allocation-id: uint, amount: uint }) }))
  (match (map-get? fee-allocations { allocation-id: allocation-id })
    allocation-data 
      (let
        (
          (current-block block-height)
          (total-amount (var-get treasury-balance-stx))
          (allocation-percentage (get allocation-percentage allocation-data))
          (allocation-amount (/ (* total-amount allocation-percentage) u1000000))
          (receiver (get receiver allocation-data))
          (total-received (+ (get total-received allocation-data) allocation-amount))
          (distributions (get distributions result))
          (total-distributed (+ (get amount result) allocation-amount))
          (updated-distributions (unwrap-panic 
                                  (as-max-len? 
                                    (append distributions { allocation-id: allocation-id, amount: allocation-amount })
                                    u10)))
        )
        
        ;; Transfer funds to allocation receiver
        (try! (as-contract (stx-transfer? allocation-amount tx-sender receiver)))
        
        ;; Update allocation stats
        (map-set fee-allocations
          { allocation-id: allocation-id }
          (merge allocation-data {
            total-received: total-received,
            last-distribution: current-block
          })
        )
        
        ;; Emit allocation distribution event
        (print {
          event: "allocation-distribution",
          allocation-id: allocation-id,
          receiver: receiver,
          amount: allocation-amount,
          block-height: current-block
        })
        
        ;; Return updated result
        { amount: total-distributed, distributions: updated-distributions }
      )
    ;; If allocation not found, return unchanged result
    result
  )
)

;; Get allocation percentage
(define-private (get-allocation-percentage (allocation-id uint))
  (default-to u0 
    (get allocation-percentage 
      (default-to 
        { allocation-percentage: u0 } 
        (map-get? fee-allocations { allocation-id: allocation-id }))))
)

;; Check if allocation is active
(define-private (is-allocation-active (allocation-id uint))
  (default-to false
    (get active
      (default-to
        { active: false }
        (map-get? fee-allocations { allocation-id: allocation-id }))))
)

;; Get all allocation IDs
(define-private (get-allocation-ids)
  (list-allocation-ids u1 (var-get allocation-counter) (list))
)

;; Helper function to list allocation IDs recursively
(define-private (list-allocation-ids (current-id uint) (max-id uint) (result (list 255 uint)))
  (if (> current-id max-id)
    result
    (list-allocation-ids 
      (+ current-id u1)
      max-id
      (unwrap-panic (as-max-len? (append result current-id) u255)))
  )
) 