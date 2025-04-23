;; title: incentives
;; version: 1.0.0
;; summary: Incentives Contract for the BitHedge platform
;; description: Manages reward programs, activity tracking, and distribution mechanisms for platform incentives.

;; traits
;;

;; token definitions
;;

;; constants
;;
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-NOT-INITIALIZED (err u101))
(define-constant ERR-INVALID-PARAMETERS (err u102))
(define-constant ERR-PROGRAM-NOT-FOUND (err u103))
(define-constant ERR-PROGRAM-INACTIVE (err u104))
(define-constant ERR-ACTIVITY-NOT-FOUND (err u105))
(define-constant ERR-REWARD-NOT-FOUND (err u106))
(define-constant ERR-ALREADY-CLAIMED (err u107))
(define-constant ERR-INSUFFICIENT-REWARDS (err u108))
(define-constant ERR-REWARDS-LOCKED (err u109))
(define-constant ERR-FUNDING-FAILED (err u110))
(define-constant ERR-TRANSFER-FAILED (err u111))
(define-constant ERR-PROGRAM-ALREADY-EXISTS (err u112))
(define-constant ERR-MILESTONE-NOT-REACHED (err u113))
(define-constant ERR-SYSTEM-PAUSED (err u114))

;; data vars
;;

;; Contract initialization status
(define-data-var contract-initialized bool false)

;; Admin address
(define-data-var admin-address principal tx-sender)

;; Pause status
(define-data-var is-paused bool false)

;; Contract addresses
(define-data-var treasury-address principal 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.temp-treasury)
(define-data-var policy-registry-address principal tx-sender)
(define-data-var liquidity-pool-address principal tx-sender)

;; Program counters
(define-data-var program-counter uint u0)
(define-data-var activity-type-counter uint u0)
(define-data-var reward-counter uint u0)
(define-data-var reward-epoch uint u0)

;; data maps
;;

;; Incentive programs
(define-map incentive-programs
  { program-id: uint }
  {
    name: (string-utf8 50),
    description: (string-utf8 200),
    start-height: uint,
    end-height: uint,
    budget: uint,
    allocated: uint,
    distributed: uint,
    active: bool,
    reward-token: (string-utf8 20), ;; "STX" or fungible token contract ID
    program-type: (string-utf8 20),  ;; "provider", "user", "referral", etc.
    vesting-period: uint,
    last-distribution: uint
  }
)

;; Activity types
(define-map activity-types
  { activity-type-id: uint }
  {
    name: (string-utf8 50),
    description: (string-utf8 200),
    reward-formula: (string-utf8 100), ;; description of how rewards are calculated
    points: uint,  ;; base points value of this activity
    active: bool,
    programs: (list 10 uint) ;; associated program IDs
  }
)

;; User activity tracking
(define-map user-activities
  { user: principal, activity-type-id: uint }
  {
    count: uint,
    last-activity: uint,
    total-points: uint, 
    milestone-reached: uint ;; highest milestone achieved
  }
)

;; Activity milestones
(define-map activity-milestones
  { activity-type-id: uint, milestone: uint }
  {
    threshold: uint,  ;; activity count needed to reach milestone
    bonus-points: uint,  ;; additional points awarded for reaching milestone
    description: (string-utf8 100)
  }
)

;; Reward history
(define-map reward-history
  { reward-id: uint }
  {
    user: principal,
    program-id: uint,
    activity-type-id: uint,
    amount: uint,
    block-height: uint,
    claimed: bool,
    claimable-after: uint,
    claim-transaction: (optional (string-utf8 66))
  }
)

;; User reward summary
(define-map user-rewards
  { user: principal, program-id: uint }
  {
    total-activities: uint,
    total-points: uint,
    total-rewards: uint,
    claimed-rewards: uint,
    pending-rewards: uint,
    last-activity: uint,
    rank: uint
  }
)

;; Epoch data for periodic distributions
(define-map reward-epochs
  { epoch-id: uint }
  {
    start-height: uint,
    end-height: uint, 
    total-points: uint,
    total-rewards: uint,
    user-count: uint,
    status: (string-utf8 20) ;; "active", "processing", "completed"
  }
)

;; public functions
;;

;; Initialize contract
(define-public (initialize-contract 
    (treasury principal)
    (policy-registry principal)
    (liquidity-pool principal))
  (begin
    ;; Check if already initialized
    (asserts! (not (var-get contract-initialized)) ERR-NOT-AUTHORIZED)
    
    ;; Set admin and initial variables
    (var-set admin-address tx-sender)
    (var-set contract-initialized true)
    
    ;; Set contract addresses
    (var-set treasury-address treasury)
    (var-set policy-registry-address policy-registry)
    (var-set liquidity-pool-address liquidity-pool)
    
    ;; Initialize default activity types
    (try! (add-activity-type "Policy Creation" "Created a protection policy" "flat-rate" u100 true))
    (try! (add-activity-type "Deposit" "Added liquidity to a pool" "percentage-of-amount" u50 true))
    (try! (add-activity-type "Referral" "Referred a new user" "flat-rate-with-bonus" u200 true))
    
    ;; Emit initialization event
    (print {
      event: "contract-initialized",
      admin: tx-sender,
      treasury: treasury,
      policy-registry: policy-registry,
      liquidity-pool: liquidity-pool,
      block-height: block-height
    })
    
    (ok true)
  )
)

;; Add incentive program
(define-public (add-incentive-program
    (name (string-utf8 50))
    (description (string-utf8 200))
    (start-height uint)
    (end-height uint)
    (budget uint)
    (reward-token (string-utf8 20))
    (program-type (string-utf8 20))
    (vesting-period uint))
  (let
    (
      (caller tx-sender)
      (program-id (+ (var-get program-counter) u1))
      (current-height block-height)
    )
    
    ;; Check if contract is initialized and not paused
    (asserts! (var-get contract-initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-SYSTEM-PAUSED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Validate parameters
    (asserts! (and
                (> (len name) u0)
                (> (len description) u0)
                (>= start-height current-height)
                (> end-height start-height)
                (> budget u0))
             ERR-INVALID-PARAMETERS)
    
    ;; Add program
    (map-set incentive-programs
      { program-id: program-id }
      {
        name: name,
        description: description,
        start-height: start-height,
        end-height: end-height,
        budget: budget,
        allocated: u0,
        distributed: u0,
        active: true,
        reward-token: reward-token,
        program-type: program-type,
        vesting-period: vesting-period,
        last-distribution: current-height
      }
    )
    
    ;; Update counter
    (var-set program-counter program-id)
    
    ;; Emit event
    (print {
      event: "incentive-program-added",
      program-id: program-id,
      name: name,
      start-height: start-height,
      end-height: end-height,
      budget: budget,
      block-height: current-height
    })
    
    (ok program-id)
  )
)

;; Update incentive program
(define-public (update-incentive-program
    (program-id uint)
    (new-end-height (optional uint))
    (new-budget (optional uint))
    (new-active (optional bool)))
  (let
    (
      (caller tx-sender)
      (program (unwrap! (map-get? incentive-programs { program-id: program-id }) ERR-PROGRAM-NOT-FOUND))
      (current-height block-height)
      (updated-end-height (default-to (get end-height program) new-end-height))
      (updated-budget (default-to (get budget program) new-budget))
      (updated-active (default-to (get active program) new-active))
    )
    
    ;; Check if contract is initialized and not paused
    (asserts! (var-get contract-initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-SYSTEM-PAUSED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Validate parameters
    (asserts! (and
                (>= updated-end-height current-height)
                (>= updated-budget (get allocated program)))
             ERR-INVALID-PARAMETERS)
    
    ;; Update program
    (map-set incentive-programs
      { program-id: program-id }
      (merge program {
        end-height: updated-end-height,
        budget: updated-budget,
        active: updated-active
      })
    )
    
    ;; Emit event
    (print {
      event: "incentive-program-updated",
      program-id: program-id,
      end-height: updated-end-height,
      budget: updated-budget,
      active: updated-active,
      block-height: current-height
    })
    
    (ok true)
  )
)

;; Add activity type
(define-public (add-activity-type
    (name (string-utf8 50))
    (description (string-utf8 200))
    (reward-formula (string-utf8 100))
    (points uint)
    (active bool))
  (let
    (
      (caller tx-sender)
      (activity-type-id (+ (var-get activity-type-counter) u1))
      (current-height block-height)
    )
    
    ;; Check if contract is initialized and not paused
    (asserts! (var-get contract-initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-SYSTEM-PAUSED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Validate parameters
    (asserts! (and
                (> (len name) u0)
                (> (len description) u0)
                (> (len reward-formula) u0)
                (> points u0))
             ERR-INVALID-PARAMETERS)
    
    ;; Add activity type
    (map-set activity-types
      { activity-type-id: activity-type-id }
      {
        name: name,
        description: description,
        reward-formula: reward-formula,
        points: points,
        active: active,
        programs: (list)
      }
    )
    
    ;; Update counter
    (var-set activity-type-counter activity-type-id)
    
    ;; Emit event
    (print {
      event: "activity-type-added",
      activity-type-id: activity-type-id,
      name: name,
      points: points,
      active: active,
      block-height: current-height
    })
    
    (ok activity-type-id)
  )
)

;; Link activity type to program
(define-public (link-activity-to-program
    (activity-type-id uint)
    (program-id uint))
  (let
    (
      (caller tx-sender)
      (activity-type (unwrap! (map-get? activity-types { activity-type-id: activity-type-id }) ERR-ACTIVITY-NOT-FOUND))
      (program (unwrap! (map-get? incentive-programs { program-id: program-id }) ERR-PROGRAM-NOT-FOUND))
      (current-programs (get programs activity-type))
    )
    
    ;; Check if contract is initialized and not paused
    (asserts! (var-get contract-initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-SYSTEM-PAUSED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Check if program is already linked
    (asserts! (is-none (index-of current-programs program-id)) ERR-PROGRAM-ALREADY-EXISTS)
    
    ;; Check if both program and activity type are active
    (asserts! (and (get active program) (get active activity-type)) ERR-PROGRAM-INACTIVE)
    
    ;; Update activity type with program
    (let
      (
        (updated-programs (unwrap-panic (as-max-len? (append current-programs program-id) u10)))
      )
      
      (map-set activity-types
        { activity-type-id: activity-type-id }
        (merge activity-type {
          programs: updated-programs
        })
      )
      
      ;; Emit event
      (print {
        event: "activity-program-linked",
        activity-type-id: activity-type-id,
        program-id: program-id,
        block-height: block-height
      })
      
      (ok true)
    )
  )
)

;; Add activity milestone
(define-public (add-activity-milestone
    (activity-type-id uint)
    (milestone uint)
    (threshold uint)
    (bonus-points uint)
    (description (string-utf8 100)))
  (let
    (
      (caller tx-sender)
      (activity-type (unwrap! (map-get? activity-types { activity-type-id: activity-type-id }) ERR-ACTIVITY-NOT-FOUND))
    )
    
    ;; Check if contract is initialized and not paused
    (asserts! (var-get contract-initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-SYSTEM-PAUSED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Validate parameters
    (asserts! (and
                (> threshold u0)
                (> (len description) u0))
             ERR-INVALID-PARAMETERS)
    
    ;; Add milestone
    (map-set activity-milestones
      { activity-type-id: activity-type-id, milestone: milestone }
      {
        threshold: threshold,
        bonus-points: bonus-points,
        description: description
      }
    )
    
    ;; Emit event
    (print {
      event: "activity-milestone-added",
      activity-type-id: activity-type-id,
      milestone: milestone,
      threshold: threshold,
      bonus-points: bonus-points,
      block-height: block-height
    })
    
    (ok true)
  )
)

;; Record user activity
(define-public (record-activity
    (user principal)
    (activity-type-id uint)
    (amount uint))
  (let
    (
      (caller tx-sender)
      (current-height block-height)
      (activity-type (unwrap! (map-get? activity-types { activity-type-id: activity-type-id }) ERR-ACTIVITY-NOT-FOUND))
      (base-points (get points activity-type))
      (activity-points (calculate-activity-points activity-type-id amount base-points))
      (programs (get programs activity-type))
    )
    
    ;; Check if contract is initialized and not paused
    (asserts! (var-get contract-initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-SYSTEM-PAUSED)
    
    ;; Check if caller is authorized
    (asserts! (or
                (is-eq caller (var-get admin-address))
                (is-eq caller (var-get policy-registry-address))
                (is-eq caller (var-get liquidity-pool-address)))
             ERR-NOT-AUTHORIZED)
    
    ;; Check if activity type is active
    (asserts! (get active activity-type) ERR-ACTIVITY-NOT-FOUND)
    
    ;; Update or create user activity record
    (let
      (
        (existing-activity (default-to 
                            { count: u0, last-activity: u0, total-points: u0, milestone-reached: u0 } 
                            (map-get? user-activities { user: user, activity-type-id: activity-type-id })))
        (new-count (+ (get count existing-activity) u1))
        (new-total-points (+ (get total-points existing-activity) activity-points))
        (milestone-result (check-and-award-milestone activity-type-id new-count (get milestone-reached existing-activity)))
        (final-points (+ new-total-points (get bonus-points milestone-result)))
        (final-milestone (get milestone milestone-result))
      )
      
      ;; Update user activity
      (map-set user-activities
        { user: user, activity-type-id: activity-type-id }
        {
          count: new-count,
          last-activity: current-height,
          total-points: final-points,
          milestone-reached: final-milestone
        }
      )
      
      ;; Emit activity event
      (print {
        event: "activity-recorded",
        user: user,
        activity-type-id: activity-type-id,
        count: new-count,
        points: activity-points,
        milestone-reached: final-milestone,
        block-height: current-height
      })
      
      ;; Process rewards for each linked program
      (map process-activity-reward (filter is-program-active programs) user activity-type-id activity-points current-height)
      
      (ok final-points)
    )
  )
)

;; Start new reward epoch
(define-public (start-reward-epoch (duration uint))
  (let
    (
      (caller tx-sender)
      (current-height block-height)
      (new-epoch-id (+ (var-get reward-epoch) u1))
      (end-height (+ current-height duration))
    )
    
    ;; Check if contract is initialized and not paused
    (asserts! (var-get contract-initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-SYSTEM-PAUSED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Validate parameters
    (asserts! (> duration u0) ERR-INVALID-PARAMETERS)
    
    ;; Create new epoch
    (map-set reward-epochs
      { epoch-id: new-epoch-id }
      {
        start-height: current-height,
        end-height: end-height,
        total-points: u0,
        total-rewards: u0,
        user-count: u0,
        status: "active"
      }
    )
    
    ;; Update epoch counter
    (var-set reward-epoch new-epoch-id)
    
    ;; Emit event
    (print {
      event: "reward-epoch-started",
      epoch-id: new-epoch-id,
      start-height: current-height,
      end-height: end-height,
      block-height: current-height
    })
    
    (ok new-epoch-id)
  )
)

;; Distribute rewards for an epoch
(define-public (distribute-epoch-rewards (epoch-id uint))
  (let
    (
      (caller tx-sender)
      (current-height block-height)
      (epoch (unwrap! (map-get? reward-epochs { epoch-id: epoch-id }) ERR-REWARD-NOT-FOUND))
    )
    
    ;; Check if contract is initialized and not paused
    (asserts! (var-get contract-initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-SYSTEM-PAUSED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Check if epoch is ended
    (asserts! (>= current-height (get end-height epoch)) ERR-INVALID-PARAMETERS)
    
    ;; Check if epoch is not already processed
    (asserts! (is-eq (get status epoch) "active") ERR-ALREADY-CLAIMED)
    
    ;; Mark epoch as processing
    (map-set reward-epochs
      { epoch-id: epoch-id }
      (merge epoch {
        status: "processing"
      })
    )
    
    ;; Emit processing event
    (print {
      event: "epoch-rewards-processing",
      epoch-id: epoch-id,
      total-points: (get total-points epoch),
      user-count: (get user-count epoch),
      block-height: current-height
    })
    
    ;; TODO: Process rewards for all users in the epoch
    ;; This would typically loop through users and distribute rewards
    ;; For now, just mark the epoch as completed
    
    (map-set reward-epochs
      { epoch-id: epoch-id }
      (merge epoch {
        status: "completed"
      })
    )
    
    ;; Emit completion event
    (print {
      event: "epoch-rewards-distributed",
      epoch-id: epoch-id,
      total-rewards: (get total-rewards epoch),
      block-height: current-height
    })
    
    (ok (get total-rewards epoch))
  )
)

;; Claim rewards
(define-public (claim-rewards (program-id uint))
  (let
    (
      (user tx-sender)
      (current-height block-height)
      (program (unwrap! (map-get? incentive-programs { program-id: program-id }) ERR-PROGRAM-NOT-FOUND))
      (user-reward (default-to 
                   { total-activities: u0, total-points: u0, total-rewards: u0, claimed-rewards: u0, pending-rewards: u0, last-activity: u0, rank: u0 } 
                   (map-get? user-rewards { user: user, program-id: program-id })))
      (pending-amount (get pending-rewards user-reward))
    )
    
    ;; Check if contract is initialized and not paused
    (asserts! (var-get contract-initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-SYSTEM-PAUSED)
    
    ;; Check if program is active
    (asserts! (get active program) ERR-PROGRAM-INACTIVE)
    
    ;; Check if there are rewards to claim
    (asserts! (> pending-amount u0) ERR-INSUFFICIENT-REWARDS)
    
    ;; Transfer rewards to user
    (try! (transfer-rewards user program-id pending-amount (get reward-token program)))
    
    ;; Update user reward record
    (map-set user-rewards
      { user: user, program-id: program-id }
      (merge user-reward {
        claimed-rewards: (+ (get claimed-rewards user-reward) pending-amount),
        pending-rewards: u0
      })
    )
    
    ;; Update program distributed amount
    (map-set incentive-programs
      { program-id: program-id }
      (merge program {
        distributed: (+ (get distributed program) pending-amount)
      })
    )
    
    ;; Emit claim event
    (print {
      event: "rewards-claimed",
      user: user,
      program-id: program-id,
      amount: pending-amount,
      block-height: current-height
    })
    
    (ok pending-amount)
  )
)

;; Pause/unpause contract
(define-public (set-pause-status (new-status bool))
  (let
    (
      (caller tx-sender)
    )
    
    ;; Check if contract is initialized
    (asserts! (var-get contract-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Set pause status
    (var-set is-paused new-status)
    
    ;; Emit event
    (print {
      event: (if new-status "contract-paused" "contract-unpaused"),
      admin: caller,
      block-height: block-height
    })
    
    (ok true)
  )
)

;; Update contract addresses
(define-public (set-contract-addresses
    (treasury (optional principal))
    (policy-registry (optional principal))
    (liquidity-pool (optional principal)))
  (let
    (
      (caller tx-sender)
      (updated-treasury (default-to (var-get treasury-address) treasury))
      (updated-policy-registry (default-to (var-get policy-registry-address) policy-registry))
      (updated-liquidity-pool (default-to (var-get liquidity-pool-address) liquidity-pool))
    )
    
    ;; Check if contract is initialized
    (asserts! (var-get contract-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is admin
    (asserts! (is-eq caller (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Update contract addresses
    (var-set treasury-address updated-treasury)
    (var-set policy-registry-address updated-policy-registry)
    (var-set liquidity-pool-address updated-liquidity-pool)
    
    ;; Emit event
    (print {
      event: "contract-addresses-updated",
      treasury: updated-treasury,
      policy-registry: updated-policy-registry,
      liquidity-pool: updated-liquidity-pool,
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
    
    ;; Check if contract is initialized
    (asserts! (var-get contract-initialized) ERR-NOT-INITIALIZED)
    
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

;; Get contract info
(define-read-only (get-contract-info)
  {
    initialized: (var-get contract-initialized),
    paused: (var-get is-paused),
    admin: (var-get admin-address),
    program-count: (var-get program-counter),
    activity-type-count: (var-get activity-type-counter),
    reward-count: (var-get reward-counter),
    current-epoch: (var-get reward-epoch)
  }
)

;; Get program details
(define-read-only (get-program-details (program-id uint))
  (map-get? incentive-programs { program-id: program-id })
)

;; Get activity type details
(define-read-only (get-activity-type-details (activity-type-id uint))
  (map-get? activity-types { activity-type-id: activity-type-id })
)

;; Get user activity details
(define-read-only (get-user-activity (user principal) (activity-type-id uint))
  (map-get? user-activities { user: user, activity-type-id: activity-type-id })
)

;; Get user rewards
(define-read-only (get-user-rewards (user principal) (program-id uint))
  (map-get? user-rewards { user: user, program-id: program-id })
)

;; Get activity milestone
(define-read-only (get-activity-milestone (activity-type-id uint) (milestone uint))
  (map-get? activity-milestones { activity-type-id: activity-type-id, milestone: milestone })
)

;; Get epoch details
(define-read-only (get-epoch-details (epoch-id uint))
  (map-get? reward-epochs { epoch-id: epoch-id })
)

;; Get reward details
(define-read-only (get-reward-details (reward-id uint))
  (map-get? reward-history { reward-id: reward-id })
)

;; private functions
;;

;; Check if program is active
(define-private (is-program-active (program-id uint))
  (match (map-get? incentive-programs { program-id: program-id })
    program (get active program)
    false
  )
)

;; Process activity reward for a program
(define-private (process-activity-reward (program-id uint) (user principal) (activity-type-id uint) (points uint) (block-height uint))
  (match (map-get? incentive-programs { program-id: program-id })
    program
      (let
        (
          (current-height block-height)
          (reward-id (+ (var-get reward-counter) u1))
          (user-reward (default-to 
                         { total-activities: u0, total-points: u0, total-rewards: u0, claimed-rewards: u0, pending-rewards: u0, last-activity: u0, rank: u0 } 
                         (map-get? user-rewards { user: user, program-id: program-id })))
          (reward-amount (calculate-reward program-id activity-type-id points))
          (vesting-period (get vesting-period program))
          (claimable-after (+ current-height vesting-period))
        )
        
        ;; Check if program is active and within date range
        (if (and
              (get active program)
              (<= (get start-height program) current-height)
              (>= (get end-height program) current-height))
          (begin
            ;; Create reward record
            (map-set reward-history
              { reward-id: reward-id }
              {
                user: user,
                program-id: program-id,
                activity-type-id: activity-type-id,
                amount: reward-amount,
                block-height: current-height,
                claimed: false,
                claimable-after: claimable-after,
                claim-transaction: none
              }
            )
            
            ;; Update reward counter
            (var-set reward-counter reward-id)
            
            ;; Update user rewards
            (map-set user-rewards
              { user: user, program-id: program-id }
              {
                total-activities: (+ (get total-activities user-reward) u1),
                total-points: (+ (get total-points user-reward) points),
                total-rewards: (+ (get total-rewards user-reward) reward-amount),
                claimed-rewards: (get claimed-rewards user-reward),
                pending-rewards: (+ (get pending-rewards user-reward) reward-amount),
                last-activity: current-height,
                rank: u0  ;; Placeholder, would be updated in batch processing
              }
            )
            
            ;; Update program allocated amount
            (map-set incentive-programs
              { program-id: program-id }
              (merge program {
                allocated: (+ (get allocated program) reward-amount),
                last-distribution: current-height
              })
            )
            
            ;; Emit reward event
            (print {
              event: "reward-created",
              reward-id: reward-id,
              user: user,
              program-id: program-id,
              activity-type-id: activity-type-id,
              amount: reward-amount,
              claimable-after: claimable-after,
              block-height: current-height
            })
            
            (ok reward-id)
          )
          
          ;; Program inactive or out of date range
          (ok u0)
        )
      )
    
    ;; Program not found
    (ok u0)
  )
)

;; Calculate activity points
(define-private (calculate-activity-points (activity-type-id uint) (amount uint) (base-points uint))
  ;; TODO: Implement more complex calculation based on activity type and amount
  ;; For now, just use base points
  base-points
)

;; Calculate reward amount from points
(define-private (calculate-reward (program-id uint) (activity-type-id uint) (points uint))
  ;; TODO: Implement more complex calculation based on program settings
  ;; For now, use simple conversion (1 point = 1 micro-STX)
  points
)

;; Check and award milestone bonuses
(define-private (check-and-award-milestone (activity-type-id uint) (activity-count uint) (current-milestone uint))
  (let
    (
      (next-milestone (+ current-milestone u1))
      (milestone-data (map-get? activity-milestones { activity-type-id: activity-type-id, milestone: next-milestone }))
    )
    
    (match milestone-data
      milestone
        ;; If threshold reached, award bonus and update milestone
        (if (>= activity-count (get threshold milestone))
          {
            milestone: next-milestone,
            bonus-points: (get bonus-points milestone)
          }
          ;; Otherwise, no change
          {
            milestone: current-milestone,
            bonus-points: u0
          }
        )
      
      ;; No next milestone found
      {
        milestone: current-milestone,
        bonus-points: u0
      }
    )
  )
)

;; Transfer rewards to user
(define-private (transfer-rewards (user principal) (program-id uint) (amount uint) (token-type (string-utf8 20)))
  ;; Add logging here
  (print { level: "debug", msg: "Attempting reward transfer", user: user, amount: amount, token-type: token-type, treasury-address: (var-get treasury-address) })

  ;; For STX transfers
  (if (is-eq token-type "STX")
    ;; Try! the contract call to handle potential errors from treasury
    (try! (contract-call? (var-get treasury-address) distribute-incentive-rewards user amount))

    ;; For other token types, would need to implement token-specific transfer logic
    ;; This is a placeholder for future token support
    (err ERR-INVALID-PARAMETERS)
  )
) 