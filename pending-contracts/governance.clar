;; title: governance
;; version: 1.0.0
;; summary: Governance Contract for BitHedge platform
;; description: Manages proposals, voting, roles, and timelocks for the BitHedge platform.

;; traits
;;

;; token definitions
;;

;; constants
;;
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-NOT-INITIALIZED (err u101))
(define-constant ERR-INVALID-PARAMETERS (err u102))
(define-constant ERR-PROPOSAL-NOT-FOUND (err u103))
(define-constant ERR-PROPOSAL-ALREADY-EXISTS (err u104))
(define-constant ERR-PROPOSAL-EXPIRED (err u105))
(define-constant ERR-PROPOSAL-NOT-ACTIVE (err u106))
(define-constant ERR-ALREADY-VOTED (err u107))
(define-constant ERR-INSUFFICIENT-VOTING-POWER (err u108))
(define-constant ERR-TIMELOCK-ACTIVE (err u109))
(define-constant ERR-TIMELOCK-NOT-EXPIRED (err u110))
(define-constant ERR-PROPOSAL-NOT-APPROVED (err u111))
(define-constant ERR-INVALID-ROLE (err u112))
(define-constant ERR-EMERGENCY-MODE-ACTIVE (err u113))
(define-constant ERR-EMERGENCY-MODE-NOT-ACTIVE (err u114))

;; Proposal status constants
(define-constant PROPOSAL-STATUS-DRAFT u0)
(define-constant PROPOSAL-STATUS-ACTIVE u1)
(define-constant PROPOSAL-STATUS-CANCELED u2)
(define-constant PROPOSAL-STATUS-APPROVED u3)
(define-constant PROPOSAL-STATUS-REJECTED u4)
(define-constant PROPOSAL-STATUS-QUEUED u5)
(define-constant PROPOSAL-STATUS-EXECUTED u6)
(define-constant PROPOSAL-STATUS-EXPIRED u7)

;; Vote types
(define-constant VOTE-TYPE-FOR u1)
(define-constant VOTE-TYPE-AGAINST u2)
(define-constant VOTE-TYPE-ABSTAIN u3)

;; Role constants
(define-constant ROLE-NONE u0)
(define-constant ROLE-MEMBER u1)
(define-constant ROLE-PROPOSER u2)
(define-constant ROLE-VOTER u4)
(define-constant ROLE-EXECUTOR u8)
(define-constant ROLE-ADMIN u16)
(define-constant ROLE-GUARDIAN u32)
(define-constant ROLE-ALL u63)  ;; All roles combined (bitmask)

;; Timelock constants
(define-constant DEFAULT-TIMELOCK-BLOCKS u144)  ;; ~24 hours at 10 min blocks
(define-constant DEFAULT-VOTING-PERIOD-BLOCKS u720)  ;; ~5 days at 10 min blocks
(define-constant DEFAULT-EXECUTION-GRACE-PERIOD u144)  ;; ~24 hours at 10 min blocks

;; Voting thresholds (scaled by 1,000,000)
(define-constant DEFAULT-APPROVAL-THRESHOLD u500000)  ;; 50%
(define-constant DEFAULT-QUORUM-THRESHOLD u200000)  ;; 20%
(define-constant DEFAULT-EMERGENCY-THRESHOLD u700000)  ;; 70%

;; data vars
;;
;; Governance initialization status
(define-data-var governance-initialized bool false)

;; Emergency mode status
(define-data-var emergency-mode-active bool false)

;; Admin and guardian addresses
(define-data-var admin-address principal tx-sender)
(define-data-var guardian-address principal tx-sender)

;; Proposal counter
(define-data-var proposal-count uint u0)

;; Governance parameters
(define-data-var timelock-blocks uint DEFAULT-TIMELOCK-BLOCKS)
(define-data-var voting-period-blocks uint DEFAULT-VOTING-PERIOD-BLOCKS)
(define-data-var execution-grace-period uint DEFAULT-EXECUTION-GRACE-PERIOD)
(define-data-var approval-threshold uint DEFAULT-APPROVAL-THRESHOLD)
(define-data-var quorum-threshold uint DEFAULT-QUORUM-THRESHOLD)
(define-data-var emergency-threshold uint DEFAULT-EMERGENCY-THRESHOLD)

;; Contract addresses
(define-data-var parameter-contract-address principal tx-sender)
(define-data-var token-contract-address principal tx-sender)

;; data maps
;;
;; Proposals
(define-map proposals
  { proposal-id: uint }
  {
    title: (string-utf8 100),
    description: (string-utf8 500),
    proposer: principal,
    status: uint,
    created-at: uint,
    expires-at: uint,
    execution-start-at: uint,
    execution-expires-at: uint,
    for-votes: uint,
    against-votes: uint,
    abstain-votes: uint,
    actions: (list 10 { 
      contract-address: principal, 
      function-name: (string-ascii 50), 
      function-args: (list 10 (string-utf8 100)) 
    }),
    emergency: bool
  }
)

;; Votes
(define-map votes
  { proposal-id: uint, voter: principal }
  {
    vote-type: uint,
    voting-power: uint,
    vote-time: uint
  }
)

;; Member roles
(define-map member-roles
  { member: principal }
  {
    roles: uint,  ;; Bitmask of roles
    voting-power: uint,
    last-updated: uint,
    last-updated-by: principal
  }
)

;; Timelocks
(define-map timelocks
  { proposal-id: uint }
  {
    status: bool,  ;; true = active, false = expired
    start-block: uint,
    end-block: uint
  }
)

;; public functions
;;

;; Initialize the governance contract
(define-public (initialize-governance)
  (begin
    ;; Check if already initialized
    (asserts! (not (var-get governance-initialized)) ERR-NOT-AUTHORIZED)
    
    ;; Set initial admin with all roles
    (map-set member-roles
      { member: tx-sender }
      {
        roles: ROLE-ALL,
        voting-power: u1000000,  ;; Initial voting power
        last-updated: burn-block-height,
        last-updated-by: tx-sender
      }
    )
    
    ;; Set admin and guardian
    (var-set admin-address tx-sender)
    (var-set guardian-address tx-sender)
    
    ;; Mark as initialized
    (var-set governance-initialized true)
    
    ;; Emit initialization event
    (print {
      event: "governance-initialized",
      admin: tx-sender,
      block-height: burn-block-height
    })
    
    (ok true)
  )
)

;; Create a new proposal
(define-public (create-proposal
    (title (string-utf8 100))
    (description (string-utf8 500))
    (actions (list 10 { 
      contract-address: principal, 
      function-name: (string-ascii 50), 
      function-args: (list 10 (string-utf8 100)) 
    }))
    (emergency bool))
  (let
    (
      (proposer tx-sender)
      (proposal-id (+ (var-get proposal-count) u1))
      (current-block burn-block-height)
      (expiration-block (+ current-block (var-get voting-period-blocks)))
      (member-info (unwrap! (map-get? member-roles { member: proposer }) ERR-NOT-AUTHORIZED))
      (proposer-role (get roles member-info))
      (required-role (if emergency ROLE-ADMIN ROLE-PROPOSER))
    )
    
    ;; Check if governance is initialized
    (asserts! (var-get governance-initialized) ERR-NOT-INITIALIZED)
    
    ;; Validate parameters
    (asserts! (> (len title) u0) ERR-INVALID-PARAMETERS)
    (asserts! (> (len description) u0) ERR-INVALID-PARAMETERS)
    (asserts! (> (len actions) u0) ERR-INVALID-PARAMETERS)
    
    ;; Check if proposer has required role
    (asserts! (is-eq (bit-and proposer-role required-role) required-role) ERR-NOT-AUTHORIZED)
    
    ;; If emergency proposal, require higher voting power
    (if emergency
      (asserts! (>= (get voting-power member-info) u5000000) ERR-INSUFFICIENT-VOTING-POWER)
      true
    )
    
    ;; Create the proposal
    (map-set proposals
      { proposal-id: proposal-id }
      {
        title: title,
        description: description,
        proposer: proposer,
        status: PROPOSAL-STATUS-ACTIVE,
        created-at: current-block,
        expires-at: expiration-block,
        execution-start-at: u0,
        execution-expires-at: u0,
        for-votes: u0,
        against-votes: u0,
        abstain-votes: u0,
        actions: actions,
        emergency: emergency
      }
    )
    
    ;; Increment proposal counter
    (var-set proposal-count proposal-id)
    
    ;; Emit proposal creation event
    (print {
      event: "proposal-created",
      proposal-id: proposal-id,
      proposer: proposer,
      emergency: emergency,
      title: title
    })
    
    (ok proposal-id)
  )
)

;; Vote on a proposal
(define-public (vote-on-proposal
    (proposal-id uint)
    (vote-type uint))
  (let
    (
      (voter tx-sender)
      (proposal (unwrap! (map-get? proposals { proposal-id: proposal-id }) ERR-PROPOSAL-NOT-FOUND))
      (current-block burn-block-height)
      (member-info (unwrap! (map-get? member-roles { member: voter }) ERR-NOT-AUTHORIZED))
      (voter-role (get roles member-info))
      (voting-power (get voting-power member-info))
    )
    
    ;; Check if governance is initialized
    (asserts! (var-get governance-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if voter has voting role
    (asserts! (is-eq (bit-and voter-role ROLE-VOTER) ROLE-VOTER) ERR-NOT-AUTHORIZED)
    
    ;; Check if proposal is active
    (asserts! (is-eq (get status proposal) PROPOSAL-STATUS-ACTIVE) ERR-PROPOSAL-NOT-ACTIVE)
    
    ;; Check if proposal has not expired
    (asserts! (<= current-block (get expires-at proposal)) ERR-PROPOSAL-EXPIRED)
    
    ;; Check if voter has not already voted
    (asserts! (is-none (map-get? votes { proposal-id: proposal-id, voter: voter })) ERR-ALREADY-VOTED)
    
    ;; Check if vote-type is valid
    (asserts! (or 
                (is-eq vote-type VOTE-TYPE-FOR) 
                (is-eq vote-type VOTE-TYPE-AGAINST) 
                (is-eq vote-type VOTE-TYPE-ABSTAIN))
             ERR-INVALID-PARAMETERS)
    
    ;; Record the vote
    (map-set votes
      { proposal-id: proposal-id, voter: voter }
      {
        vote-type: vote-type,
        voting-power: voting-power,
        vote-time: current-block
      }
    )
    
    ;; Update proposal vote tallies
    (if (is-eq vote-type VOTE-TYPE-FOR)
      (map-set proposals
        { proposal-id: proposal-id }
        (merge proposal { for-votes: (+ (get for-votes proposal) voting-power) }))
      (if (is-eq vote-type VOTE-TYPE-AGAINST)
        (map-set proposals
          { proposal-id: proposal-id }
          (merge proposal { against-votes: (+ (get against-votes proposal) voting-power) }))
        ;; Must be VOTE-TYPE-ABSTAIN due to our earlier validation
        (map-set proposals
          { proposal-id: proposal-id }
          (merge proposal { abstain-votes: (+ (get abstain-votes proposal) voting-power) }))))
    
    ;; Emit vote event
    (print {
      event: "vote-cast",
      proposal-id: proposal-id,
      voter: voter,
      vote-type: vote-type,
      voting-power: voting-power
    })
    
    (ok true)
  )
)

;; Cancel a proposal
(define-public (cancel-proposal
    (proposal-id uint))
  (let
    (
      (sender tx-sender)
      (proposal (unwrap! (map-get? proposals { proposal-id: proposal-id }) ERR-PROPOSAL-NOT-FOUND))
      (current-block burn-block-height)
      (proposer (get proposer proposal))
      (member-info (unwrap! (map-get? member-roles { member: sender }) ERR-NOT-AUTHORIZED))
      (sender-role (get roles member-info))
    )
    
    ;; Check if governance is initialized
    (asserts! (var-get governance-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if proposal is active
    (asserts! (is-eq (get status proposal) PROPOSAL-STATUS-ACTIVE) ERR-PROPOSAL-NOT-ACTIVE)
    
    ;; Check if sender is the proposer or has admin role
    (asserts! 
      (or 
        (is-eq sender proposer)
        (is-eq (bit-and sender-role ROLE-ADMIN) ROLE-ADMIN)) 
      ERR-NOT-AUTHORIZED)
    
    ;; Cancel the proposal
    (map-set proposals
      { proposal-id: proposal-id }
      (merge proposal { status: PROPOSAL-STATUS-CANCELED })
    )
    
    ;; Emit cancellation event
    (print {
      event: "proposal-canceled",
      proposal-id: proposal-id,
      canceler: sender,
      block-height: burn-block-height
    })
    
    (ok true)
  )
)

;; End voting phase and determine proposal outcome
(define-public (finalize-proposal
    (proposal-id uint))
  (let
    (
      (proposal (unwrap! (map-get? proposals { proposal-id: proposal-id }) ERR-PROPOSAL-NOT-FOUND))
      (current-block burn-block-height)
      (for-votes (get for-votes proposal))
      (against-votes (get against-votes proposal))
      (abstain-votes (get abstain-votes proposal))
      (total-votes (+ (+ for-votes against-votes) abstain-votes))
      (approval-ratio (if (> total-votes u0) (/ (* for-votes u1000000) total-votes) u0))
      (quorum-reached (>= total-votes (var-get quorum-threshold)))
      (approved (>= approval-ratio (if (get emergency proposal) 
                                     (var-get emergency-threshold) 
                                     (var-get approval-threshold))))
    )
    
    ;; Check if governance is initialized
    (asserts! (var-get governance-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if proposal is active
    (asserts! (is-eq (get status proposal) PROPOSAL-STATUS-ACTIVE) ERR-PROPOSAL-NOT-ACTIVE)
    
    ;; Check if voting period has ended or emergency proposal with enough support
    (asserts! 
      (or 
        (>= current-block (get expires-at proposal))
        (and (get emergency proposal) (>= approval-ratio (var-get emergency-threshold))))
      ERR-TIMELOCK-NOT-EXPIRED)
    
    ;; Determine proposal outcome
    (if (and quorum-reached approved)
      (begin
        ;; Update proposal to approved and create timelock (unless emergency)
        (if (get emergency proposal)
          (map-set proposals
            { proposal-id: proposal-id }
            (merge proposal { 
              status: PROPOSAL-STATUS-APPROVED,
              execution-start-at: current-block,
              execution-expires-at: (+ current-block (var-get execution-grace-period))
            }))
          (begin
            ;; Set up timelock for standard proposal
            (map-set timelocks
              { proposal-id: proposal-id }
              {
                status: true,
                start-block: current-block,
                end-block: (+ current-block (var-get timelock-blocks))
              }
            )
            ;; Update proposal status to queued
            (map-set proposals
              { proposal-id: proposal-id }
              (merge proposal { 
                status: PROPOSAL-STATUS-QUEUED
              }))
          )
        )
      )
      ;; Mark proposal as rejected
      (map-set proposals
        { proposal-id: proposal-id }
        (merge proposal { status: PROPOSAL-STATUS-REJECTED }))
    )
    
    ;; Emit finalization event
    (print {
      event: "proposal-finalized",
      proposal-id: proposal-id,
      approved: (and quorum-reached approved),
      for-votes: for-votes,
      against-votes: against-votes,
      abstain-votes: abstain-votes,
      approval-ratio: approval-ratio,
      quorum-reached: quorum-reached
    })
    
    (ok (and quorum-reached approved))
  )
)

;; Check if timelock has expired and mark proposal as ready for execution
(define-public (process-timelock
    (proposal-id uint))
  (let
    (
      (proposal (unwrap! (map-get? proposals { proposal-id: proposal-id }) ERR-PROPOSAL-NOT-FOUND))
      (timelock (unwrap! (map-get? timelocks { proposal-id: proposal-id }) ERR-PROPOSAL-NOT-FOUND))
      (current-block burn-block-height)
    )
    
    ;; Check if governance is initialized
    (asserts! (var-get governance-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if proposal is queued
    (asserts! (is-eq (get status proposal) PROPOSAL-STATUS-QUEUED) ERR-PROPOSAL-NOT-ACTIVE)
    
    ;; Check if timelock is active
    (asserts! (get status timelock) ERR-TIMELOCK-ACTIVE)
    
    ;; Check if timelock has expired
    (asserts! (>= current-block (get end-block timelock)) ERR-TIMELOCK-NOT-EXPIRED)
    
    ;; Expire the timelock
    (map-set timelocks
      { proposal-id: proposal-id }
      (merge timelock { status: false })
    )
    
    ;; Update proposal status to approved
    (map-set proposals
      { proposal-id: proposal-id }
      (merge proposal { 
        status: PROPOSAL-STATUS-APPROVED,
        execution-start-at: current-block,
        execution-expires-at: (+ current-block (var-get execution-grace-period))
      })
    )
    
    ;; Emit timelock expired event
    (print {
      event: "timelock-expired",
      proposal-id: proposal-id,
      block-height: burn-block-height
    })
    
    (ok true)
  )
)

;; Execute approved proposal
(define-public (execute-proposal
    (proposal-id uint))
  (let
    (
      (executor tx-sender)
      (proposal (unwrap! (map-get? proposals { proposal-id: proposal-id }) ERR-PROPOSAL-NOT-FOUND))
      (current-block burn-block-height)
      (member-info (unwrap! (map-get? member-roles { member: executor }) ERR-NOT-AUTHORIZED))
      (executor-role (get roles member-info))
    )
    
    ;; Check if governance is initialized
    (asserts! (var-get governance-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if proposal is approved
    (asserts! (is-eq (get status proposal) PROPOSAL-STATUS-APPROVED) ERR-PROPOSAL-NOT-APPROVED)
    
    ;; Check if execution window is valid
    (asserts! 
      (and 
        (>= current-block (get execution-start-at proposal))
        (<= current-block (get execution-expires-at proposal)))
      ERR-PROPOSAL-EXPIRED)
    
    ;; Check if executor has executor role
    (asserts! (is-eq (bit-and executor-role ROLE-EXECUTOR) ROLE-EXECUTOR) ERR-NOT-AUTHORIZED)
    
    ;; Mark proposal as executed
    (map-set proposals
      { proposal-id: proposal-id }
      (merge proposal { status: PROPOSAL-STATUS-EXECUTED })
    )
    
    ;; Emit execution event
    (print {
      event: "proposal-executed",
      proposal-id: proposal-id,
      executor: executor,
      block-height: burn-block-height
    })
    
    ;; Note: Actual execution of actions would require integration with other contracts
    ;; In a production system, this would loop through actions and call each function
    
    (ok true)
  )
)

;; Set member roles
(define-public (set-member-role
    (member principal)
    (roles uint)
    (voting-power uint))
  (let
    (
      (admin tx-sender)
      (current-block burn-block-height)
      (admin-info (unwrap! (map-get? member-roles { member: admin }) ERR-NOT-AUTHORIZED))
    )
    
    ;; Check if governance is initialized
    (asserts! (var-get governance-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if admin has admin role
    (asserts! (is-eq (bit-and (get roles admin-info) ROLE-ADMIN) ROLE-ADMIN) ERR-NOT-AUTHORIZED)
    
    ;; Validate roles (must be within valid range)
    (asserts! (<= roles ROLE-ALL) ERR-INVALID-ROLE)
    
    ;; Update or create member roles
    (map-set member-roles
      { member: member }
      {
        roles: roles,
        voting-power: voting-power,
        last-updated: current-block,
        last-updated-by: admin
      }
    )
    
    ;; Emit role update event
    (print {
      event: "member-role-updated",
      member: member,
      roles: roles,
      voting-power: voting-power,
      admin: admin
    })
    
    (ok true)
  )
)

;; Update governance parameters
(define-public (update-governance-parameters
    (new-timelock-blocks uint)
    (new-voting-period-blocks uint)
    (new-execution-grace-period uint)
    (new-approval-threshold uint)
    (new-quorum-threshold uint)
    (new-emergency-threshold uint))
  (let
    (
      (admin tx-sender)
      (admin-info (unwrap! (map-get? member-roles { member: admin }) ERR-NOT-AUTHORIZED))
    )
    
    ;; Check if governance is initialized
    (asserts! (var-get governance-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if admin has admin role
    (asserts! (is-eq (bit-and (get roles admin-info) ROLE-ADMIN) ROLE-ADMIN) ERR-NOT-AUTHORIZED)
    
    ;; Validate parameters
    (asserts! (and
               (> new-timelock-blocks u0)
               (> new-voting-period-blocks u0)
               (> new-execution-grace-period u0)
               (> new-approval-threshold u0)
               (> new-quorum-threshold u0)
               (> new-emergency-threshold u0))
             ERR-INVALID-PARAMETERS)
    
    ;; Update parameters
    (var-set timelock-blocks new-timelock-blocks)
    (var-set voting-period-blocks new-voting-period-blocks)
    (var-set execution-grace-period new-execution-grace-period)
    (var-set approval-threshold new-approval-threshold)
    (var-set quorum-threshold new-quorum-threshold)
    (var-set emergency-threshold new-emergency-threshold)
    
    ;; Emit parameters update event
    (print {
      event: "governance-parameters-updated",
      timelock-blocks: new-timelock-blocks,
      voting-period-blocks: new-voting-period-blocks,
      execution-grace-period: new-execution-grace-period,
      approval-threshold: new-approval-threshold,
      quorum-threshold: new-quorum-threshold,
      emergency-threshold: new-emergency-threshold,
      admin: admin
    })
    
    (ok true)
  )
)

;; Activate emergency mode
(define-public (activate-emergency-mode)
  (let
    (
      (guardian tx-sender)
    )
    
    ;; Check if governance is initialized
    (asserts! (var-get governance-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is guardian
    (asserts! (is-eq guardian (var-get guardian-address)) ERR-NOT-AUTHORIZED)
    
    ;; Check if emergency mode not already active
    (asserts! (not (var-get emergency-mode-active)) ERR-EMERGENCY-MODE-ACTIVE)
    
    ;; Activate emergency mode
    (var-set emergency-mode-active true)
    
    ;; Emit emergency mode activation event
    (print {
      event: "emergency-mode-activated",
      guardian: guardian,
      block-height: burn-block-height
    })
    
    (ok true)
  )
)

;; Deactivate emergency mode
(define-public (deactivate-emergency-mode)
  (let
    (
      (admin tx-sender)
      (admin-info (unwrap! (map-get? member-roles { member: admin }) ERR-NOT-AUTHORIZED))
    )
    
    ;; Check if governance is initialized
    (asserts! (var-get governance-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if admin has admin role
    (asserts! (is-eq (bit-and (get roles admin-info) ROLE-ADMIN) ROLE-ADMIN) ERR-NOT-AUTHORIZED)
    
    ;; Check if emergency mode is active
    (asserts! (var-get emergency-mode-active) ERR-EMERGENCY-MODE-NOT-ACTIVE)
    
    ;; Deactivate emergency mode
    (var-set emergency-mode-active false)
    
    ;; Emit emergency mode deactivation event
    (print {
      event: "emergency-mode-deactivated",
      admin: admin,
      block-height: burn-block-height
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
    
    ;; Check if governance is initialized
    (asserts! (var-get governance-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is current admin
    (asserts! (is-eq current-admin (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Update admin
    (var-set admin-address new-admin)

    ;; Give new admin all roles and default voting power
    (try! (set-member-role new-admin ROLE-ALL u1000000))

    ;; Emit admin transfer event
    (print {
      event: "admin-transferred",
      previous-admin: current-admin,
      new-admin: new-admin,
      block-height: burn-block-height
    })
    
    (ok true)
  )
)

;; Transfer guardian role
(define-public (transfer-guardian
    (new-guardian principal))
  (let
    (
      (current-admin tx-sender)
    )
    
    ;; Check if governance is initialized
    (asserts! (var-get governance-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is admin
    (asserts! (is-eq current-admin (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Update guardian
    (var-set guardian-address new-guardian)
    
    ;; Give guardian role and default voting power (if not already a member)
    (try! (if (is-none (map-get? member-roles { member: new-guardian }))
      ;; If new guardian is not already a member, set their role and voting power
      (set-member-role new-guardian ROLE-GUARDIAN u1000000) ;; Return response directly
      ;; Else, return success (guardian might already exist with roles)
      (ok true)
    ))
    
    ;; Emit guardian transfer event
    (print {
      event: "guardian-transferred",
      previous-guardian: (var-get guardian-address),
      new-guardian: new-guardian,
      admin: current-admin,
      block-height: burn-block-height
    })
    
    (ok true)
  )
)

;; Set contract addresses
(define-public (set-contract-addresses
    (parameter-address principal)
    (token-address principal))
  (let
    (
      (admin tx-sender)
    )
    
    ;; Check if governance is initialized
    (asserts! (var-get governance-initialized) ERR-NOT-INITIALIZED)
    
    ;; Check if caller is admin
    (asserts! (is-eq admin (var-get admin-address)) ERR-NOT-AUTHORIZED)
    
    ;; Update addresses
    (var-set parameter-contract-address parameter-address)
    (var-set token-contract-address token-address)
    
    ;; Emit contract address update event
    (print {
      event: "contract-addresses-updated",
      parameter-address: parameter-address,
      token-address: token-address,
      admin: admin,
      block-height: burn-block-height
    })
    
    (ok true)
  )
)

;; read only functions
;;

;; Get proposal details
(define-read-only (get-proposal-details (proposal-id uint))
  (map-get? proposals { proposal-id: proposal-id })
)

;; Get vote details
(define-read-only (get-vote-details (proposal-id uint) (voter principal))
  (map-get? votes { proposal-id: proposal-id, voter: voter })
)

;; Get member roles
(define-read-only (get-member-roles (member principal))
  (map-get? member-roles { member: member })
)

;; Get timelock details
(define-read-only (get-timelock-details (proposal-id uint))
  (map-get? timelocks { proposal-id: proposal-id })
)

;; Check if address has a specific role
(define-read-only (has-role (member principal) (role uint))
  (match (map-get? member-roles { member: member })
    member-info (is-eq (bit-and (get roles member-info) role) role)
    false)
)

;; Get governance parameters
(define-read-only (get-governance-parameters)
  {
    timelock-blocks: (var-get timelock-blocks),
    voting-period-blocks: (var-get voting-period-blocks),
    execution-grace-period: (var-get execution-grace-period),
    approval-threshold: (var-get approval-threshold),
    quorum-threshold: (var-get quorum-threshold),
    emergency-threshold: (var-get emergency-threshold),
    admin-address: (var-get admin-address),
    guardian-address: (var-get guardian-address),
    emergency-mode-active: (var-get emergency-mode-active)
  }
) 