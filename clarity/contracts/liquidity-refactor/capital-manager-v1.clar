;; capital-manager-v1.clar
;; Handles capital deposits, withdrawals, and token management

(impl-trait .capital-manager-trait.capital-manager-trait)
(use-trait ft-trait .trait-sip-010.sip-010-trait)

;; --- Constants ---

;; Import constants from base contract
(define-constant ONE_8 u100000000) 
(define-constant STX-TOKEN-ID "STX")

;; Error codes
(define-constant ERR-UNAUTHORIZED (err u2001))
(define-constant ERR-TOKEN-NOT-INITIALIZED (err u2002))
(define-constant ERR-AMOUNT-MUST-BE-POSITIVE (err u2003))
(define-constant ERR-NOT-ENOUGH-BALANCE (err u2004))
(define-constant ERR-TRANSFER-FAILED (err u2005))
(define-constant ERR-ALREADY-INITIALIZED (err u2006))
(define-constant ERR-INVALID-TOKEN (err u2007))
(define-constant ERR-NO-PREMIUMS-TO-CLAIM (err u2008))
(define-constant ERR-REGISTRY-ERROR (err u2009))

;; --- Data Structures ---

;; Tracks total, available, and locked balances for each supported token
(define-map token-balances
  { token-id: (string-ascii 32) }
  {
    total-balance: uint,
    available-balance: uint,
    locked-balance: uint
  }
)

;; Tracks individual provider deposits, allocations, and earnings
(define-map provider-balances
  {
    provider: principal,
    token-id: (string-ascii 32)
  }
  {
    deposited-amount: uint,
    allocated-amount: uint,
    available-amount: uint,
    earned-premiums: uint,
    pending-premiums: uint
  }
)

;; Map to track initialized tokens
(define-map supported-tokens
  { token-id: (string-ascii 32) }
  {
    initialized: bool,
    sip010-contract-principal: (optional principal)
  }
)

;; Track total premium stats
(define-map premium-balances
  { token-id: (string-ascii 32) }
  {
    total-premiums-collected: uint,
    total-premiums-distributed-to-providers: uint
  }
)

;; --- Registry Connection ---
(define-data-var registry-principal (optional principal) none)

;; --- Private Helper Functions ---

;; Check if a token is supported
(define-private (is-token-supported (token-id (string-ascii 32)))
  (default-to false
    (get initialized (map-get? supported-tokens { token-id: token-id }))
  )
)

;; Check authorization from registry
(define-private (is-authorized)
  (match (var-get registry-principal)
    registry-some (contract-call? registry-some is-authorized tx-sender)
    false
  )
)

;; --- Public Functions ---

;; Set the registry principal - can only be done once
(define-public (set-registry (registry principal))
  (begin
    (asserts! (is-none (var-get registry-principal)) ERR-ALREADY-INITIALIZED)
    (var-set registry-principal (some registry))
    (print {
      event: "registry-set",
      registry: registry,
      block-height: burn-block-height
    })
    (ok true)
  )
)

;; Initialize a supported token (STX or an sBTC contract)
(define-public (initialize-token
    (token-id (string-ascii 32))
    (sip010-principal-if-sip010 (optional principal))
  )
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    (asserts!
      (not (default-to false
        (get initialized (map-get? supported-tokens { token-id: token-id }))
      ))
      ERR-ALREADY-INITIALIZED
    )
    
    ;; Validate token type
    (if (is-eq token-id STX-TOKEN-ID)
      (asserts! (is-none sip010-principal-if-sip010) ERR-INVALID-TOKEN) 
      (asserts! (is-some sip010-principal-if-sip010) ERR-INVALID-TOKEN)
    )
    
    ;; Initialize token maps
    (map-set supported-tokens { token-id: token-id } 
      {
        initialized: true,
        sip010-contract-principal: sip010-principal-if-sip010
      }
    )
    
    (map-set token-balances { token-id: token-id } 
      {
        total-balance: u0,
        available-balance: u0,
        locked-balance: u0
      }
    )
    
    (map-set premium-balances { token-id: token-id } 
      {
        total-premiums-collected: u0,
        total-premiums-distributed-to-providers: u0
      }
    )
    
    (print {
      event: "token-initialized",
      token-id: token-id,
      sip010-contract-principal: sip010-principal-if-sip010,
      block-height: burn-block-height
    })
    
    (ok true)
  )
)

;; Deposit capital into the liquidity pool
(define-public (deposit-capital
    (amount uint)
    (token-id (string-ascii 32))
    (risk-tier (string-ascii 32))
  )
  (begin
    (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
    (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)
    
    ;; Transfer tokens from tx-sender to contract
    (if (is-eq token-id STX-TOKEN-ID)
      ;; For STX token
      (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
      ;; For SIP-010 tokens
      (let ((token-info (unwrap! (map-get? supported-tokens { token-id: token-id })
          ERR-TOKEN-NOT-INITIALIZED
        )))
        (try! (contract-call? (unwrap-panic (get sip010-contract-principal token-info))
          transfer amount tx-sender (as-contract tx-sender) none
        ))
      )
    )
    
    ;; Update global token balance
    (let ((current-global-balance (unwrap! (map-get? token-balances { token-id: token-id })
        ERR-TOKEN-NOT-INITIALIZED
      )))
      (map-set token-balances { token-id: token-id } 
        {
          total-balance: (+ (get total-balance current-global-balance) amount),
          available-balance: (+ (get available-balance current-global-balance) amount),
          locked-balance: (get locked-balance current-global-balance)
        }
      )
    )
    
    ;; Update provider's balance
    (let ((provider-key {
        provider: tx-sender,
        token-id: token-id
      }))
      (let ((current-provider-balance (default-to 
          {
            deposited-amount: u0,
            allocated-amount: u0,
            available-amount: u0,
            earned-premiums: u0,
            pending-premiums: u0
          }
          (map-get? provider-balances provider-key)
        )))
        (map-set provider-balances provider-key 
          {
            deposited-amount: (+ (get deposited-amount current-provider-balance) amount),
            allocated-amount: (get allocated-amount current-provider-balance),
            available-amount: (+ (get available-amount current-provider-balance) amount),
            earned-premiums: (get earned-premiums current-provider-balance),
            pending-premiums: (get pending-premiums current-provider-balance)
          }
        )
      )
    )
    
    ;; Emit event
    (print {
      event: "capital-deposited",
      provider: tx-sender,
      amount: amount,
      token-id: token-id,
      risk-tier: risk-tier,
      block-height: burn-block-height
    })
    
    (ok true)
  )
)

;; Withdraw capital from the liquidity pool
(define-public (withdraw-capital
    (amount uint)
    (token-id (string-ascii 32))
  )
  (let (
      (provider tx-sender)
      (provider-key {
        provider: provider,
        token-id: token-id
      })
      (provider-bal (unwrap! (map-get? provider-balances provider-key) 
        ERR-NOT-ENOUGH-BALANCE
      ))
      (available-to-withdraw (get available-amount provider-bal))
      (global-bal (unwrap! (map-get? token-balances { token-id: token-id })
        ERR-TOKEN-NOT-INITIALIZED
      ))
    )
    (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)
    (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
    (asserts! (>= available-to-withdraw amount) ERR-NOT-ENOUGH-BALANCE)
    
    ;; Transfer tokens to provider
    (if (is-eq token-id STX-TOKEN-ID)
      (try! (as-contract (stx-transfer? amount tx-sender provider)))
      (let ((token-info (unwrap! (map-get? supported-tokens { token-id: token-id })
          ERR-TOKEN-NOT-INITIALIZED
        )))
        (try! (as-contract (contract-call? (unwrap-panic (get sip010-contract-principal token-info))
          transfer amount tx-sender provider none
        )))
      )
    )
    
    ;; Update provider balance
    (map-set provider-balances provider-key
      {
        deposited-amount: (- (get deposited-amount provider-bal) amount),
        allocated-amount: (get allocated-amount provider-bal),
        available-amount: (- available-to-withdraw amount),
        earned-premiums: (get earned-premiums provider-bal),
        pending-premiums: (get pending-premiums provider-bal)
      }
    )
    
    ;; Update global balance
    (map-set token-balances { token-id: token-id }
      {
        total-balance: (- (get total-balance global-bal) amount),
        available-balance: (- (get available-balance global-bal) amount),
        locked-balance: (get locked-balance global-bal)
      }
    )
    
    ;; Emit event
    (print {
      event: "capital-withdrawn",
      provider: provider,
      amount: amount,
      token-id: token-id,
      block-height: burn-block-height
    })
    
    (ok true)
  )
)

;; Claim earned premiums
(define-public (claim-earned-premiums (token-id (string-ascii 32)))
  (let (
      (provider tx-sender)
      (provider-key {
        provider: provider,
        token-id: token-id
      })
      (provider-bal (unwrap! (map-get? provider-balances provider-key) 
        ERR-NOT-ENOUGH-BALANCE
      ))
      (earned-amount (get earned-premiums provider-bal))
    )
    ;; Verify token is initialized
    (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)
    ;; Check if provider has any earned premiums to claim
    (asserts! (> earned-amount u0) ERR-NO-PREMIUMS-TO-CLAIM)
    
    ;; Transfer earned premiums to the provider
    (if (is-eq token-id STX-TOKEN-ID)
      ;; For STX token
      (try! (as-contract (stx-transfer? earned-amount tx-sender provider)))
      ;; For SIP-010 tokens
      (let ((token-info (unwrap! (map-get? supported-tokens { token-id: token-id })
          ERR-TOKEN-NOT-INITIALIZED
        )))
        (try! (as-contract (contract-call? (unwrap-panic (get sip010-contract-principal token-info))
          transfer earned-amount tx-sender provider none
        )))
      )
    )
    
    ;; Update provider's balance - set earned-premiums to 0
    (map-set provider-balances provider-key
      (merge provider-bal { earned-premiums: u0 })
    )
    
    ;; Emit premium claimed event
    (print {
      event: "premiums-claimed",
      provider: provider,
      token-id: token-id,
      claimed-amount: earned-amount,
      block-height: burn-block-height
    })
    
    (ok earned-amount)
  )
)

;; --- Read-Only Functions ---

;; Check if a token is initialized
(define-read-only (is-token-initialized (token-id (string-ascii 32)))
  (ok (is-token-supported token-id))
)

;; Get the total balance for a token
(define-read-only (get-total-token-balance (token-id (string-ascii 32)))
  (match (map-get? token-balances { token-id: token-id })
    balance-info (ok (get total-balance balance-info))
    (err ERR-TOKEN-NOT-INITIALIZED)
  )
)

;; Get the available balance for a token
(define-read-only (get-available-balance (token-id (string-ascii 32)))
  (match (map-get? token-balances { token-id: token-id })
    balance-info (ok (get available-balance balance-info))
    (err ERR-TOKEN-NOT-INITIALIZED)
  )
)

;; Get a provider's balance information
(define-read-only (get-provider-balance (provider principal) (token-id (string-ascii 32)))
  (match (map-get? provider-balances { provider: provider, token-id: token-id })
    balance-info (ok balance-info)
    (err ERR-NOT-ENOUGH-BALANCE)
  )
)

;; --- Admin Functions ---

;; Update a provider's earned premiums (called by Premium Manager)
(define-public (update-provider-earned-premiums 
    (provider principal) 
    (token-id (string-ascii 32)) 
    (premium-amount uint)
  )
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    (let ((provider-key { 
        provider: provider, 
        token-id: token-id 
      }))
      (match (map-get? provider-balances provider-key)
        provider-bal 
          (map-set provider-balances provider-key
            (merge provider-bal { 
              earned-premiums: (+ (get earned-premiums provider-bal) premium-amount),
              pending-premiums: (- (get pending-premiums provider-bal) premium-amount)
            })
          )
        ;; If no balance found, create a new entry
        (map-set provider-balances provider-key {
          deposited-amount: u0,
          allocated-amount: u0,
          available-amount: u0,
          earned-premiums: premium-amount,
          pending-premiums: u0
        })
      )
      (ok true)
    )
  )
)

;; Update a provider's pending premiums (called by Premium Manager)
(define-public (update-provider-pending-premiums 
    (provider principal) 
    (token-id (string-ascii 32)) 
    (premium-amount uint)
  )
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    (let ((provider-key { 
        provider: provider, 
        token-id: token-id 
      }))
      (match (map-get? provider-balances provider-key)
        provider-bal 
          (map-set provider-balances provider-key
            (merge provider-bal { 
              pending-premiums: (+ (get pending-premiums provider-bal) premium-amount)
            })
          )
        ;; If no balance found, create a new entry
        (map-set provider-balances provider-key {
          deposited-amount: u0,
          allocated-amount: u0,
          available-amount: u0,
          earned-premiums: u0,
          pending-premiums: premium-amount
        })
      )
      (ok true)
    )
  )
)

;; Update allocated amount (called by Allocation Manager)
(define-public (update-provider-allocation 
    (provider principal) 
    (token-id (string-ascii 32)) 
    (allocation-delta-amount int) 
  )
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    (let ((provider-key { 
        provider: provider, 
        token-id: token-id 
      }))
      (match (map-get? provider-balances provider-key)
        provider-bal 
          (let (
              (current-allocated (get allocated-amount provider-bal))
              (current-available (get available-amount provider-bal))
              (new-allocated (if (> allocation-delta-amount 0)
                (+ current-allocated (to-uint allocation-delta-amount))
                (- current-allocated (to-uint (abs allocation-delta-amount)))
              ))
              (new-available (if (> allocation-delta-amount 0)
                (- current-available (to-uint allocation-delta-amount))
                (+ current-available (to-uint (abs allocation-delta-amount)))
              ))
            )
            (map-set provider-balances provider-key {
              deposited-amount: (get deposited-amount provider-bal),
              allocated-amount: new-allocated,
              available-amount: new-available,
              earned-premiums: (get earned-premiums provider-bal),
              pending-premiums: (get pending-premiums provider-bal)
            })
            (ok true)
          )
        (err ERR-NOT-ENOUGH-BALANCE)
      )
    )
  )
)

;; Update global token balances (called by Allocation Manager)
(define-public (update-token-allocation 
    (token-id (string-ascii 32)) 
    (allocation-delta-amount int)
  )
  (begin
    (asserts! (is-authorized) ERR-UNAUTHORIZED)
    (match (map-get? token-balances { token-id: token-id })
      token-bal
        (let (
            (current-available (get available-balance token-bal))
            (current-locked (get locked-balance token-bal))
            (new-available (if (> allocation-delta-amount 0)
              (- current-available (to-uint allocation-delta-amount))
              (+ current-available (to-uint (abs allocation-delta-amount)))
            ))
            (new-locked (if (> allocation-delta-amount 0)
              (+ current-locked (to-uint allocation-delta-amount))
              (- current-locked (to-uint (abs allocation-delta-amount)))
            ))
          )
          (map-set token-balances { token-id: token-id } {
            total-balance: (get total-balance token-bal),
            available-balance: new-available,
            locked-balance: new-locked
          })
          (ok true)
        )
      (err ERR-TOKEN-NOT-INITIALIZED)
    )
  )
)
