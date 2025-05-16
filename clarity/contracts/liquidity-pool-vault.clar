;; BitHedge European-Style Liquidity Pool Vault Contract
;; Version: 0.1 (Phase 1 Development)

;; --- Traits ---
;; SIP-010 Fungible Token standard trait
(define-trait sip-010-trait (
  (transfer
    (uint principal principal (optional (buff 34)))
    (response bool uint)
  )
  (get-balance
    (principal)
    (response uint uint)
  )
  (get-total-supply
    ()
    (response uint uint)
  )
  (get-name
    ()
    (response (string-ascii 32) uint)
  )
  (get-symbol
    ()
    (response (string-ascii 32) uint)
  )
  (get-decimals
    ()
    (response uint uint)
  )
  (get-token-uri
    ()
    (response (optional (string-utf8 256)) uint)
  )
))

;; --- Constants and Error Codes (SH-101) ---
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-UNAUTHORIZED (err u401))
(define-constant ERR-NOT-ENOUGH-BALANCE (err u402))
(define-constant ERR-INVALID-TOKEN (err u403))
(define-constant ERR-TOKEN-NOT-INITIALIZED (err u404))
(define-constant ERR-AMOUNT-MUST-BE-POSITIVE (err u405))
(define-constant ERR-INSUFFICIENT-LIQUIDITY (err u406))
(define-constant ERR-TRANSFER-FAILED (err u500))
(define-constant ERR-POLICY-REGISTRY-ONLY (err u407)) ;; For functions callable only by policy registry
(define-constant ERR-INVALID-RISK-TIER (err u408))
(define-constant ERR-INSUFFICIENT-TIER-LIQUIDITY (err u409))
(define-constant ERR-EXCESSIVE-EXPIRATION-CONCENTRATION (err u410))
(define-constant ERR-ALREADY-INITIALIZED (err u411))
(define-constant ERR-CALLER_NOT_PROVIDER (err u412))
(define-constant ERR-NO_PROVIDER_FOR_TIER (err u413))
(define-constant ERR-ALLOCATION_LOGIC_ERROR (err u414))

;; Error codes for LP-102
(define-constant ERR-PR-PRINCIPAL-NOT-SET-LP (err u415))
(define-constant ERR-PARAMS-PRINCIPAL-NOT-SET-LP (err u416))
(define-constant ERR-MATH-PRINCIPAL-NOT-SET-LP (err u417))

;; Additional error codes for LP-201
(define-constant ERR-NO-ELIGIBLE-PROVIDERS (err u418))
(define-constant ERR-INVALID-TIER-PARAMETER (err u419))
(define-constant ERR-TIER-NOT-ACTIVE (err u420))

;; Additional error codes for LP-202
(define-constant ERR-POLICY-ALLOCATIONS-NOT-FOUND (err u421))
(define-constant ERR-PREMIUM-ALREADY-RECORDED (err u422))

;; Additional error codes for LP-203
(define-constant ERR-SETTLEMENT-ALREADY-PROCESSED (err u423))
(define-constant ERR-INSUFFICIENT-FUNDS-FOR-SETTLEMENT (err u424))
(define-constant ERR-TRANSFER-TO-POLICY-OWNER-FAILED (err u425))

;; Additional error codes for LP-205
(define-constant ERR-MAX-EXPOSURE-EXCEEDED (err u426))

;; Additional error codes for LP-206
(define-constant ERR-PREMIUM-NOT-RECORDED (err u427))
(define-constant ERR-PREMIUM-ALREADY-DISTRIBUTED (err u428))

;; Additional error codes for LP-207
(define-constant ERR-NO-PREMIUMS-TO-CLAIM (err u429))

;; Additional error codes for LP-208
(define-constant ERR-POLICY-ALREADY-SETTLED (err u430))
(define-constant ERR-NO-ALLOCATIONS-FOUND (err u431))

;; Risk Tier Constants (SH-102) - More may be added as parameters later
;; Updated to canonical lowercase strings to match Convex internal representation
(define-constant RISK-TIER-CONSERVATIVE "conservative")
(define-constant RISK-TIER-BALANCED "balanced")
(define-constant RISK-TIER-AGGRESSIVE "aggressive")

;; Token Identifiers
(define-constant STX-TOKEN-ID "STX")
;; Replace with your actual sBTC contract principal if it's fixed and known at deployment
;; (define-constant SBTC-TOKEN-CONTRACT <sbtc-token-principal-here>)

;; --- Data Structures (LP-101) ---

;; Tracks total, available, and locked balances for each supported token (STX, sBTC)
(define-map token-balances
  { token-id: (string-ascii 32) } ;; "STX" or sBTC contract principal as string
  {
    total-balance: uint,
    available-balance: uint,
    locked-balance: uint,
  }
)

;; Tracks individual provider deposits, allocations, and earnings
(define-map provider-balances
  {
    provider: principal,
    token-id: (string-ascii 32),
  }
  {
    deposited-amount: uint,
    allocated-amount: uint, ;; Amount allocated to active policies
    available-amount: uint, ;; Deposited minus allocated
    earned-premiums: uint, ;; Premiums earned from expired OTM policies, ready to claim
    pending-premiums: uint, ;; Premiums from active policies (not yet claimable)
    expiration-exposure: (map uint uint), ;; map {expiration-height: uint} to {exposure-amount: uint}
  }
)

;; Stores parameters for each risk tier, like collateral ratios.
;; For Phase 1, this structure is defined. Population and full logic in later phases.
(define-map risk-tier-parameters
  { tier-name: (string-ascii 32) } ;; e.g., "Conservative"
  {
    collateral-ratio: uint, ;; e.g., u110 for 110%
    premium-multiplier: uint, ;; e.g., u90 for 90% of base premium
    max-exposure-percentage: uint, ;; e.g., u25 for 25% max of provider's capital to one expiration
  }
)

;; Tracks total premiums collected and distributed for each token type.
(define-map premium-balances
  { token-id: (string-ascii 32) }
  {
    total-premiums-collected: uint,
    total-premiums-distributed-to-providers: uint,
  }
)

;; Stores details of how a provider's capital is allocated to a specific policy.
(define-map provider-allocations
  {
    provider: principal,
    policy-id: uint,
  }
  {
    token-id: (string-ascii 32),
    allocated-to-policy-amount: uint, ;; How much of this provider's capital is for this policy
    risk-tier-at-allocation: (string-ascii 32),
    expiration-height: uint,
  }
)

;; Tracks the total collateral needed for all policies expiring at a specific block height.
;; This is an aggregate view, unlike provider-specific expiration-exposure.
;; Key: expiration-height (uint)
;; Value: {
;;   total-collateral-required: uint, ;; Sum of protection-amount for all policies at this height
;;   is-liquidity-prepared: bool      ;; Flag for Phase 3 (LP-303) to indicate if liquidity is actively managed/reserved
;;   token-distributions: (map (string-ascii 32) uint), ;; Map of token-id to amount required
;;   policy-count: uint, ;; Number of policies expiring at this height
;; }
(define-map expiration-liquidity-needs
  uint ;; expiration-height
  {
    total-collateral-required: uint,
    is-liquidity-prepared: bool,
    token-distributions: (map (string-ascii 32) uint), ;; Map of token-id to amount required
    policy-count: uint, ;; Number of policies expiring at this height
  }
)

;; LP-202: Tracks premium allocations to specific policies
(define-map policy-premium-records
  { policy-id: uint }
  {
    premium-amount: uint,
    token-id: (string-ascii 32),
    expiration-height: uint,
    is-distributed: bool,
    distribution-height: (optional uint),
    premium-recorded-height: uint,
  }
)

;; LP-204: Settlement impact tracking for providers
(define-map settlement-impacts
  {
    provider: principal,
    policy-id: uint,
  }
  {
    token-id: (string-ascii 32),
    settlement-amount-contributed: uint,
    settlement-height: uint,
  }
)

;; LP-204: Settlement record map to track processed settlements
(define-map settlement-record-map
  uint ;; policy-id
  {
    settlement-amount: uint,
    token-id: (string-ascii 32),
    policy-owner: principal,
    settlement-height: uint,
    remaining-collateral: uint, ;; Collateral that wasn't used for settlement
  }
)

;; --- Data Variables ---
(define-data-var backend-authorized-principal principal tx-sender)
(define-data-var policy-registry-principal (principal) 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.policy-registry) ;; LP-102: For Policy Registry contract
(define-data-var parameters-contract-principal (principal) 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.bithedge-parameters) ;; LP-102: For Parameters contract
(define-data-var math-library-principal (principal) 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.math-library) ;; LP-102: For Math Library contract

;; Map to track initialized tokens (LP-110)
(define-map supported-tokens
  { token-id: (string-ascii 32) }
  {
    initialized: bool,
    sbtc-contract-principal: (optional principal),
  }
)

;; --- Token Management Functions (LP-110) ---

;; Initialize a supported token (STX or an sBTC contract)
(define-public (initialize-token
    (token-id (string-ascii 32))
    (sbtc-principal-if-sip010 (optional principal))
  )
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (asserts!
      (not (default-to false
        (get initialized (map-get? supported-tokens { token-id: token-id }))
      ))
      ERR-ALREADY-INITIALIZED
    )
    (if (is-eq token-id STX-TOKEN-ID)
      (asserts! (is-none sbtc-principal-if-sip010) ERR-INVALID-TOKEN) ;; STX should not have sbtc principal
      (asserts! (is-some sbtc-principal-if-sip010) ERR-INVALID-TOKEN) ;; SIP010 token must have principal
    )
    (map-set supported-tokens { token-id: token-id } {
      initialized: true,
      sbtc-contract-principal: sbtc-principal-if-sip010,
    })
    (map-set token-balances { token-id: token-id } {
      total-balance: u0,
      available-balance: u0,
      locked-balance: u0,
    })
    (map-set premium-balances { token-id: token-id } {
      total-premiums-collected: u0,
      total-premiums-distributed-to-providers: u0,
    })
    (print {
      event: "token-initialized",
      block-height: burn-block-height,
      token-id: token-id,
      sbtc-contract-principal: sbtc-principal-if-sip010,
    })
    (ok true)
  )
)

;; Private helper to check if a token is supported
(define-private (is-token-supported (token-id (string-ascii 32)))
  (default-to false
    (get initialized (map-get? supported-tokens { token-id: token-id }))
  )
)

;; --- Read-Only Functions (LP-106, LP-108 part 1) ---

(define-read-only (get-total-token-balance (token-id (string-ascii 32)))
  (match (map-get? token-balances { token-id: token-id })
    balance-info (ok (get total-balance balance-info))
    ERR-TOKEN-NOT-INITIALIZED
  )
)

(define-read-only (get-locked-collateral (token-id (string-ascii 32)))
  (match (map-get? token-balances { token-id: token-id })
    balance-info (ok (get locked-balance balance-info))
    ERR-TOKEN-NOT-INITIALIZED
  )
)

(define-read-only (get-available-balance (token-id (string-ascii 32)))
  (match (map-get? token-balances { token-id: token-id })
    balance-info (ok (get available-balance balance-info))
    ERR-TOKEN-NOT-INITIALIZED
  )
)

(define-read-only (is-token-initialized-public (token-id (string-ascii 32)))
  (is-token-supported token-id)
)

(define-read-only (get-provider-balance
    (provider principal)
    (token-id (string-ascii 32))
  )
  (map-get? provider-balances {
    provider: provider,
    token-id: token-id,
  })
)

(define-read-only (get-provider-allocation-for-policy
    (provider principal)
    (policy-id uint)
  )
  (map-get? provider-allocations {
    provider: provider,
    policy-id: policy-id,
  })
)

;; --- Administrative Functions (LP-102) ---

(define-public (set-policy-registry-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set policy-registry-principal (some new-principal))
    (ok true)
  )
)

(define-read-only (get-policy-registry-principal)
  (var-get policy-registry-principal)
)

(define-public (set-parameters-contract-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set parameters-contract-principal (some new-principal))
    (ok true)
  )
)

(define-read-only (get-parameters-contract-principal)
  (var-get parameters-contract-principal)
)

(define-public (set-math-library-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set math-library-principal (some new-principal))
    (ok true)
  )
)

(define-read-only (get-math-library-principal)
  (var-get math-library-principal)
)

;; --- Capital Management Functions (LP-103) ---
(define-public (deposit-capital
    (amount uint)
    (token-id (string-ascii 32))
    (risk-tier (string-ascii 32))
  )
  (begin
    (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
    (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)
    (asserts! (is-valid-risk-tier risk-tier) ERR-INVALID-RISK-TIER)
    ;; Perform token transfer from tx-sender to this contract
    (if (is-eq token-id STX-TOKEN-ID)
      (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
      (try! (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
        transfer amount tx-sender (as-contract tx-sender) none
      ))
    )
    ;; Update global token balance
    (let ((current-global-balance (unwrap! (map-get? token-balances { token-id: token-id })
        ERR-TOKEN-NOT-INITIALIZED
      )))
      (map-set token-balances { token-id: token-id } {
        total-balance: (+ (get total-balance current-global-balance) amount),
        available-balance: (+ (get available-balance current-global-balance) amount),
        locked-balance: (get locked-balance current-global-balance),
      })
    )
    ;; Update provider's balance
    (let ((provider-key {
        provider: tx-sender,
        token-id: token-id,
      }))
      (let ((current-provider-balance (default-to {
          deposited-amount: u0,
          allocated-amount: u0,
          available-amount: u0,
          earned-premiums: u0,
          pending-premiums: u0,
          expiration-exposure: (map),
        }
          (map-get? provider-balances provider-key)
        )))
        (map-set provider-balances provider-key {
          deposited-amount: (+ (get deposited-amount current-provider-balance) amount),
          allocated-amount: (get allocated-amount current-provider-balance),
          available-amount: (+ (get available-amount current-provider-balance) amount),
          earned-premiums: (get earned-premiums current-provider-balance),
          pending-premiums: (get pending-premiums current-provider-balance),
          expiration-exposure: (get expiration-exposure current-provider-balance),
        })
      )
    )
    (print {
      event: "capital-deposited",
      block-height: burn-block-height,
      provider-principal: tx-sender,
      amount: amount,
      token-id: token-id,
      risk-tier: risk-tier,
    })
    (ok true)
  )
)

(define-public (withdraw-capital
    (amount uint)
    (token-id (string-ascii 32))
  )
  (let (
      (provider tx-sender)
      (provider-key {
        provider: provider,
        token-id: token-id,
      })
      (provider-bal (unwrap! (map-get? provider-balances provider-key) ERR-NOT-ENOUGH-BALANCE)) ;; Ensure provider exists
      (available-to-withdraw (get available-amount provider-bal))
      (global-bal (unwrap! (map-get? token-balances { token-id: token-id })
        ERR-TOKEN-NOT-INITIALIZED
      ))
    )
    (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)
    (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
    (asserts! (>= available-to-withdraw amount) ERR-NOT-ENOUGH-BALANCE)
    (if (is-eq token-id STX-TOKEN-ID)
      (try! (as-contract (stx-transfer? amount tx-sender provider)))
      (let ((token-info (unwrap! (map-get? supported-tokens { token-id: token-id })
          ERR-TOKEN-NOT-INITIALIZED
        )))
        (try! (as-contract (contract-call? (unwrap-panic (get sbtc-contract-principal token-info))
          transfer amount tx-sender provider none
        )))
      )
    )
    (map-set provider-balances provider-key
      (merge provider-bal {
        deposited-amount: (- (get deposited-amount provider-bal) amount), ;; Assuming withdrawal reduces total deposit first
        available-amount: (- available-to-withdraw amount),
      })
    )
    (map-set token-balances { token-id: token-id }
      (merge global-bal {
        total-balance: (- (get total-balance global-bal) amount),
        available-balance: (- (get available-balance global-bal) amount),
      })
    )
    (print {
      event: "capital-withdrawn",
      block-height: burn-block-height,
      provider-principal: provider,
      amount: amount,
      token-id: token-id,
    })
    (ok true)
  )
)

;; --- Liquidity and Collateral Functions (LP-109, LP-105, LP-201) ---
(define-read-only (check-liquidity
    (required-collateral uint)
    (token-id (string-ascii 32))
    (risk-tier (string-ascii 32))
    (expiration-height uint)
  )
  (begin
    (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)
    (let ((global-balance (unwrap! (map-get? token-balances { token-id: token-id })
        ERR-TOKEN-NOT-INITIALIZED
      )))
      ;; Phase 2: Enhanced check that considers risk tiers
      ;; First, check overall available balance as baseline
      (asserts! (>= (get available-balance global-balance) required-collateral)
        ERR-INSUFFICIENT-LIQUIDITY
      )
      ;; Then, verify there are eligible providers with sufficient capacity in the requested risk tier
      ;; This doesn't allocate yet, just verifies availability
      (let ((eligible-providers-result (get-eligible-providers-for-allocation token-id risk-tier
          required-collateral expiration-height
        )))
        (if (is-ok eligible-providers-result)
          (ok true)
          eligible-providers-result
        )
        ;; Propagate the error
      )
    )
  )
)

;; policy-owner-principal is passed by policy-registry, it's the buyer of the policy
(define-public (lock-collateral
    (policy-id uint)
    (collateral-amount uint)
    (token-id (string-ascii 32))
    (risk-tier (string-ascii 32))
    (expiration-height uint)
    (policy-owner-principal principal)
  )
  (begin
    (asserts! (is-eq tx-sender (var-get policy-registry-principal))
      ERR-POLICY-REGISTRY-ONLY
    )
    (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)
    (asserts! (> collateral-amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
    (asserts! (is-valid-risk-tier risk-tier) ERR-INVALID-RISK-TIER)
    (let ((global-bal (unwrap! (map-get? token-balances { token-id: token-id })
        ERR-TOKEN-NOT-INITIALIZED
      )))
      (asserts! (>= (get available-balance global-bal) collateral-amount)
        ERR-INSUFFICIENT-LIQUIDITY
      )
      ;; LP-201: Enhanced provider allocation logic
      ;; 1. Select eligible providers for this risk tier with sufficient available capital
      (match (get-eligible-providers-for-allocation token-id risk-tier collateral-amount
        expiration-height
      )
        eligible-providers-list (let ((allocation-result (allocate-capital-to-providers policy-id collateral-amount token-id
            risk-tier expiration-height eligible-providers-list
          )))
          ;; Update global token balance
          (map-set token-balances { token-id: token-id }
            (merge global-bal {
              available-balance: (- (get available-balance global-bal) collateral-amount),
              locked-balance: (+ (get locked-balance global-bal) collateral-amount),
            })
          )
          ;; Update expiration liquidity needs tracking
          (let ((expiration-needs (default-to {
              total-collateral-required: u0,
              is-liquidity-prepared: false,
              token-distributions: (map),
              policy-count: u0,
            }
              (map-get? expiration-liquidity-needs expiration-height)
            )))
            (let (
                (current-token-amount (default-to u0
                  (map-get? (get token-distributions expiration-needs) token-id)
                ))
                (updated-token-distributions (merge (get token-distributions expiration-needs) { (token-id): (+ current-token-amount collateral-amount) }))
              )
              (map-set expiration-liquidity-needs expiration-height {
                total-collateral-required: (+ (get total-collateral-required expiration-needs)
                  collateral-amount
                ),
                is-liquidity-prepared: (get is-liquidity-prepared expiration-needs),
                token-distributions: updated-token-distributions,
                policy-count: (+ (get policy-count expiration-needs) u1),
              })
            )
          )
          ;; Emit the allocation event
          (print {
            event: "collateral-locked",
            block-height: burn-block-height,
            policy-id: policy-id,
            total-collateral-amount: collateral-amount,
            token-id: token-id,
            risk-tier: risk-tier,
            expiration-height: expiration-height,
            policy-owner-principal: policy-owner-principal,
            provider-count: (len allocation-result),
          })
          (ok true)
        )
        err-response (begin
          (print {
            event: "collateral-allocation-failed",
            block-height: burn-block-height,
            policy-id: policy-id,
            token-id: token-id,
            risk-tier: risk-tier,
            error: err-response,
          })
          err-response
        )
      )
    )
  )
)

;; policy-owner-principal is passed by policy-registry
(define-public (record-premium-payment
    (policy-id uint)
    (premium-amount uint)
    (token-id (string-ascii 32))
    (expiration-height uint)
    (policy-owner-principal principal)
  )
  (begin
    (asserts! (is-eq tx-sender (var-get policy-registry-principal))
      ERR-POLICY-REGISTRY-ONLY
    )
    (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)
    (asserts! (> premium-amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
    ;; LP-202: Check if premium is already recorded for this policy
    (asserts!
      (is-none (map-get? policy-premium-records { policy-id: policy-id }))
      ERR-PREMIUM-ALREADY-RECORDED
    )
    ;; Update global premium balances
    (let ((prem-bal (unwrap! (map-get? premium-balances { token-id: token-id })
        ERR-TOKEN-NOT-INITIALIZED
      )))
      (map-set premium-balances { token-id: token-id }
        (merge prem-bal { total-premiums-collected: (+ (get total-premiums-collected prem-bal) premium-amount) })
      )
    )
    ;; LP-202: Record premium details for this policy
    (map-set policy-premium-records { policy-id: policy-id } {
      premium-amount: premium-amount,
      token-id: token-id,
      expiration-height: expiration-height,
      is-distributed: false,
      distribution-height: none,
      premium-recorded-height: burn-block-height,
    })
    ;; LP-202: Distribute premium shares to providers who allocated collateral for this policy
    ;; This involves:
    ;; 1. Find all providers who contributed to this policy
    ;; 2. Calculate their share of the premium (proportional to their allocation)
    ;; 3. Update their pending-premiums balance
    ;; Get all allocations for this policy
    (let ((provider-allocation-info (find-providers-for-policy policy-id token-id)))
      (if (> (len provider-allocation-info) u0)
        ;; Calculate premium shares and update provider records
        (distribute-pending-premium-shares policy-id premium-amount token-id
          provider-allocation-info
        )
        ;; If no providers found (unexpected case), set contract owner as fallback
        (update-provider-pending-premium CONTRACT-OWNER premium-amount token-id)
      )
    )
    (print {
      event: "premium-recorded-for-policy",
      block-height: burn-block-height,
      policy-id: policy-id,
      policy-owner-principal: policy-owner-principal,
      amount: premium-amount,
      token-id: token-id,
      expiration-height: expiration-height,
    })
    (ok true)
  )
)

;; --- Utility Functions (SH-103) ---
(define-private (is-valid-risk-tier (tier (string-ascii 32)))
  (or
    (is-eq tier RISK-TIER-CONSERVATIVE)
    (is-eq tier RISK-TIER-BALANCED)
    (is-eq tier RISK-TIER-AGGRESSIVE)
  )
)

;; --- LP-201: Provider Selection and Allocation Helpers ---

;; Get eligible providers for a specific token, risk tier, and required amount
(define-read-only (get-eligible-providers-for-allocation
    (token-id (string-ascii 32))
    (risk-tier (string-ascii 32))
    (required-amount uint)
    (expiration-height uint)
  )
  (let ((params-principal (var-get parameters-contract-principal)))
    (match (as-contract (contract-call? params-principal get-risk-tier-parameters risk-tier))
      tier-params-ok (let ((tier-params (unwrap-panic tier-params-ok)))
        ;; Verify tier is active
        (asserts! (get is-active tier-params) ERR-TIER-NOT-ACTIVE)
        ;; For simplicity in Phase 2, use a small set of test providers
        (let ((test-providers (list CONTRACT-OWNER 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)))
          ;; Filter and keep only eligible providers
          (ok (filter-eligible-providers test-providers token-id risk-tier
            required-amount expiration-height tier-params
          ))
        )
      )
      err-response (begin
        (print {
          event: "get-tier-parameters-failed",
          block-height: burn-block-height,
          risk-tier: risk-tier,
          error: err-response,
        })
        (err ERR-INVALID-TIER-PARAMETER)
      )
    )
  )
)

;; Filter eligible providers based on risk tier matching and available capital
(define-private (filter-eligible-providers
    (providers (list 10 principal))
    (token-id (string-ascii 32))
    (risk-tier (string-ascii 32))
    (required-amount uint)
    (expiration-height uint)
    (tier-params {
      tier-type: (string-ascii 16),
      collateral-ratio-basis-points: uint,
      premium-adjustment-basis-points: uint,
      max-exposure-per-policy-basis-points: uint,
      max-exposure-per-expiration-basis-points: uint,
      is-active: bool,
      description: (string-ascii 256),
      last-updated-height: uint,
      updater-principal: principal,
    })
  )
  (filter is-provider-eligible-for-allocation
    (map
      (lambda (provider) {
        provider: provider,
        token-id: token-id,
        risk-tier: risk-tier,
        required-amount: required-amount,
        expiration-height: expiration-height,
        tier-params: tier-params,
      })
      providers
    ))
)

;; Check if a specific provider is eligible for allocation
(define-private (is-provider-eligible-for-allocation (provider-details {
  provider: principal,
  token-id: (string-ascii 32),
  risk-tier: (string-ascii 32),
  required-amount: uint,
  expiration-height: uint,
  tier-params: {
    tier-type: (string-ascii 16),
    collateral-ratio-basis-points: uint,
    premium-adjustment-basis-points: uint,
    max-exposure-per-policy-basis-points: uint,
    max-exposure-per-expiration-basis-points: uint,
    is-active: bool,
    description: (string-ascii 256),
    last-updated-height: uint,
    updater-principal: principal,
  },
}))
  (let (
      (provider (get provider provider-details))
      (token-id (get token-id provider-details))
      (provider-key {
        provider: provider,
        token-id: token-id,
      })
      (required-amount (get required-amount provider-details))
      (expiration-height (get expiration-height provider-details))
      (provider-balance (map-get? provider-balances provider-key))
    )
    (and
      ;; Provider must exist and have balance
      (is-some provider-balance)
      ;; Provider must have sufficient available balance
      (>= (get available-amount (unwrap-panic provider-balance)) required-amount)
      ;; Additional risk tier checks could be added here
      ;; For Phase 2, we're going with simplistic checks
      true
    )
  )
)

;; Allocate capital to eligible providers for a policy
(define-private (allocate-capital-to-providers
    (policy-id uint)
    (total-amount uint)
    (token-id (string-ascii 32))
    (risk-tier (string-ascii 32))
    (expiration-height uint)
    (eligible-providers (list 10 principal))
  )
  (begin
    ;; Check we have any eligible providers
    (asserts! (> (len eligible-providers) u0) ERR-NO-ELIGIBLE-PROVIDERS)
    ;; For Phase 2, we'll use a simple proportional allocation based on available capital
    ;; Calculate total available capital from all eligible providers
    (let ((total-available (fold +
        (map get-provider-available-balance
          (map
            (lambda (provider) {
              provider: provider,
              token-id: token-id,
            })
            eligible-providers
          ))
        u0
      )))
      ;; Allocate proportionally to all providers
      (map
        (lambda (provider)
          (allocate-to-single-provider provider
            (calculate-provider-allocation provider token-id total-amount
              total-available
            )
            policy-id token-id risk-tier expiration-height
          ))
        eligible-providers
      )
    )
  )
)

;; Get provider's available balance for a token
(define-private (get-provider-available-balance (provider-token {
  provider: principal,
  token-id: (string-ascii 32),
}))
  (default-to u0
    (get available-amount
      (default-to {
        deposited-amount: u0,
        allocated-amount: u0,
        available-amount: u0,
        earned-premiums: u0,
        pending-premiums: u0,
        expiration-exposure: (map),
      }
        (map-get? provider-balances provider-token)
      ))
  )
)

;; Calculate a single provider's proportional allocation amount
(define-private (calculate-provider-allocation
    (provider principal)
    (token-id (string-ascii 32))
    (total-required uint)
    (total-available uint)
  )
  (let (
      (provider-available (get-provider-available-balance {
        provider: provider,
        token-id: token-id,
      }))
      (provider-share (/ (* provider-available total-required) total-available))
    )
    ;; Ensure we're allocating at least 1 unit, if the provider has any available balance
    (if (and (> provider-available u0) (is-eq provider-share u0))
      u1
      provider-share
    )
  )
)

;; Allocate to a single provider and update their records
(define-private (allocate-to-single-provider
    (provider principal)
    (allocation-amount uint)
    (policy-id uint)
    (token-id (string-ascii 32))
    (risk-tier (string-ascii 32))
    (expiration-height uint)
  )
  (begin
    (let (
        (provider-key {
          provider: provider,
          token-id: token-id,
        })
        (provider-bal (unwrap-panic (map-get? provider-balances provider-key)))
      )
      ;; Record the allocation in provider-allocations
      (map-set provider-allocations {
        provider: provider,
        policy-id: policy-id,
      } {
        token-id: token-id,
        allocated-to-policy-amount: allocation-amount,
        risk-tier-at-allocation: risk-tier,
        expiration-height: expiration-height,
      })
      ;; Update provider balance
      (map-set provider-balances provider-key
        (merge provider-bal {
          allocated-amount: (+ (get allocated-amount provider-bal) allocation-amount),
          available-amount: (- (get available-amount provider-bal) allocation-amount),
        })
      )
      ;; LP-205: Update provider exposure for this expiration height
      (try! (add-provider-exposure provider token-id expiration-height
        allocation-amount
      ))
      ;; Emit provider allocation event
      (print {
        event: "provider-allocation",
        block-height: burn-block-height,
        provider: provider,
        policy-id: policy-id,
        allocation-amount: allocation-amount,
        risk-tier: risk-tier,
        expiration-height: expiration-height,
      })
      ;; Return allocation amount (needed for accumulation in fold)
      allocation-amount
    )
  )
)

;; --- LP-202: Premium Management Helpers ---

;; Find all providers who allocated capital to a policy
(define-private (find-providers-for-policy
    (policy-id uint)
    (token-id (string-ascii 32))
  )
  ;; For Phase 2, we use a simplified approach to find providers
  ;; We need a test list of principals who might have allocations for the policy
  (let ((potential-providers (list CONTRACT-OWNER 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)))
    ;; Filter providers who actually have allocations for this policy
    (filter has-allocation-for-policy
      (map
        (lambda (provider) {
          provider: provider,
          policy-id: policy-id,
        })
        potential-providers
      ))
  )
)

;; Check if a provider has an allocation for a given policy
(define-private (has-allocation-for-policy (provider-policy {
  provider: principal,
  policy-id: uint,
}))
  (is-some (map-get? provider-allocations {
    provider: (get provider provider-policy),
    policy-id: (get policy-id provider-policy),
  }))
)

;; Distribute premium shares to all providers proportionally to their allocations
(define-private (distribute-pending-premium-shares
    (policy-id uint)
    (total-premium uint)
    (token-id (string-ascii 32))
    (providers (list 10 {
      provider: principal,
      policy-id: uint,
    }))
  )
  (let (
      ;; Calculate total allocation amount for this policy across all providers
      (total-allocation (fold calculate-total-policy-allocation providers u0))
    )
    (map
      (lambda (provider-info)
        (let (
            (provider (get provider provider-info))
            (allocation (get-provider-allocation-amount provider policy-id))
            ;; Calculate premium share proportional to allocation
            (premium-share (if (> total-allocated u0)
              (/ (* allocation total-premium) total-allocated)
              ;; If total allocation is 0 (unexpected), distribute equally
              (/ total-premium (len providers))
            ))
          )
          ;; Update provider's pending premium
          (update-provider-pending-premium provider premium-share token-id)
        ))
      providers
    )
  )
)

;; Helper to sum up the total allocation for a policy
(define-private (calculate-total-policy-allocation
    (provider-info {
      provider: principal,
      policy-id: uint,
    })
    (acc uint)
  )
  (let ((allocation (get-provider-allocation-amount (get provider provider-info)
      (get policy-id provider-info)
    )))
    (+ acc allocation)
  )
)

;; Get a provider's allocation amount for a specific policy
(define-private (get-provider-allocation-amount
    (provider principal)
    (policy-id uint)
  )
  (match (map-get? provider-allocations {
    provider: provider,
    policy-id: policy-id,
  })
    allocation
    (get allocated-to-policy-amount allocation)
    u0 ;; Default to 0 if no allocation found
  )
)

;; Update a provider's pending premium balance
(define-private (update-provider-pending-premium
    (provider principal)
    (premium-amount uint)
    (token-id (string-ascii 32))
  )
  (let (
      (provider-key {
        provider: provider,
        token-id: token-id,
      })
      (current-provider-balance (default-to {
        deposited-amount: u0,
        allocated-amount: u0,
        available-amount: u0,
        earned-premiums: u0,
        pending-premiums: u0,
        expiration-exposure: (map),
      }
        (map-get? provider-balances provider-key)
      ))
    )
    (map-set provider-balances provider-key
      (merge current-provider-balance { pending-premiums: (+ (get pending-premiums current-provider-balance) premium-amount) })
    )
    ;; Emit event for premium allocation to provider
    (print {
      event: "premium-allocated-to-provider",
      block-height: burn-block-height,
      provider: provider,
      token-id: token-id,
      premium-amount: premium-amount,
      new-pending-total: (+ (get pending-premiums current-provider-balance) premium-amount),
    })
    premium-amount
  )
)

;; --- Process Settlement Function (LP-203) ---

;; Called by Policy Registry when a policy is determined to be ITM at expiration
(define-public (process-settlement-at-expiration
    (policy-id uint)
    (settlement-amount uint)
    (token-id (string-ascii 32))
    (policy-owner principal)
  )
  (begin
    ;; 1. Verify caller is the policy registry
    (asserts! (is-eq tx-sender (var-get policy-registry-principal))
      ERR-POLICY-REGISTRY-ONLY
    )
    ;; 2. Check valid inputs
    (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)
    (asserts! (> settlement-amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
    ;; 3. Ensure this settlement hasn't been processed before
    (let ((settlement-record (map-get? settlement-record-map policy-id)))
      (asserts! (is-none settlement-record) ERR-SETTLEMENT-ALREADY-PROCESSED)
      ;; 4. Get global token balance to check if we have enough for settlement
      (let ((global-bal (unwrap! (map-get? token-balances { token-id: token-id })
          ERR-TOKEN-NOT-INITIALIZED
        )))
        ;; 5. Ensure we have enough locked balance to cover settlement
        (asserts! (>= (get locked-balance global-bal) settlement-amount)
          ERR-INSUFFICIENT-FUNDS-FOR-SETTLEMENT
        )
        ;; 6. Find providers who allocated to this policy
        (let ((providers-with-allocations (find-providers-for-policy policy-id token-id)))
          (asserts! (> (len providers-with-allocations) u0)
            ERR-POLICY-ALLOCATIONS-NOT-FOUND
          )
          ;; 7. Process settlement impacts on providers
          (let (
              (total-allocated (calculate-total-allocation-for-policy providers-with-allocations
                policy-id
              ))
              (remaining-collateral (process-provider-settlement-impacts providers-with-allocations
                policy-id settlement-amount token-id total-allocated
              ))
            )
            ;; 8. Transfer settlement amount to policy owner
            (if (is-eq token-id STX-TOKEN-ID)
              (match (as-contract (stx-transfer? settlement-amount tx-sender policy-owner))
                success-result
                ;; Continue processing
                true
                error-result
                (begin
                  (print {
                    event: "settlement-transfer-failed",
                    block-height: burn-block-height,
                    policy-id: policy-id,
                    token-id: token-id,
                    amount: settlement-amount,
                    error: error-result,
                  })
                  (asserts! false ERR-TRANSFER-TO-POLICY-OWNER-FAILED)
                )
              )
              ;; Handle SIP-010 token transfers
              (let ((token-info (unwrap! (map-get? supported-tokens { token-id: token-id })
                  ERR-TOKEN-NOT-INITIALIZED
                )))
                (match (as-contract (contract-call?
                  (unwrap-panic (get sbtc-contract-principal token-info))
                  transfer settlement-amount tx-sender policy-owner none
                ))
                  success-result
                  ;; Continue processing
                  true
                  error-result
                  (begin
                    (print {
                      event: "settlement-transfer-failed",
                      block-height: burn-block-height,
                      policy-id: policy-id,
                      token-id: token-id,
                      amount: settlement-amount,
                      error: error-result,
                    })
                    (asserts! false ERR-TRANSFER-TO-POLICY-OWNER-FAILED)
                  )
                )
              )
            )
            ;; 9. Update global token balances
            (map-set token-balances { token-id: token-id }
              (merge global-bal {
                locked-balance: (- (get locked-balance global-bal) settlement-amount),
                ;; No need to update total-balance as the payout reduces both locked balance and total
                total-balance: (- (get total-balance global-bal) settlement-amount),
              })
            )
            ;; 10. Record settlement
            (map-set settlement-record-map policy-id {
              settlement-amount: settlement-amount,
              token-id: token-id,
              policy-owner: policy-owner,
              settlement-height: burn-block-height,
              remaining-collateral: remaining-collateral,
            })
            ;; 11. Emit event
            (print {
              event: "policy-settlement-processed",
              block-height: burn-block-height,
              policy-id: policy-id,
              token-id: token-id,
              settlement-amount: settlement-amount,
              policy-owner: policy-owner,
              provider-count: (len providers-with-allocations),
            })
            ;; 12. Return success
            (ok true)
          )
        )
      )
    )
  )
)

;; --- LP-203 & LP-204: Helper Functions ---

;; Calculate total allocation for a policy across all providers
(define-private (calculate-total-allocation-for-policy
    (providers (list 10 {
      provider: principal,
      policy-id: uint,
    }))
    (policy-id uint)
  )
  (fold +
    (map
      (lambda (provider-info)
        (get-provider-allocation-amount (get provider provider-info) policy-id)
      )
      providers
    )
    u0
  )
)

;; Process settlement impacts for each provider
(define-private (process-provider-settlement-impacts
    (providers (list 10 {
      provider: principal,
      policy-id: uint,
    }))
    (policy-id uint)
    (settlement-amount uint)
    (token-id (string-ascii 32))
    (total-allocated uint)
  )
  (let ((remaining-collateral u0))
    ;; For each provider, calculate their share of the settlement impact
    (fold process-single-provider-settlement providers {
      settlement-amount: settlement-amount,
      total-allocated: total-allocated,
      token-id: token-id,
      policy-id: policy-id,
      remaining-collateral: u0,
    })
  )
)

;; Process settlement impact for a single provider
(define-private (process-single-provider-settlement
    (provider-info {
      provider: principal,
      policy-id: uint,
    })
    (acc {
      settlement-amount: uint,
      total-allocated: uint,
      token-id: (string-ascii 32),
      policy-id: uint,
      remaining-collateral: uint,
    })
  )
  (let (
      (provider (get provider provider-info))
      (policy-id (get policy-id provider-info))
      (token-id (get token-id acc))
      (total-settlement (get settlement-amount acc))
      (total-allocated (get total-allocated acc))
      (allocation (get-provider-allocation-amount provider policy-id))
      ;; Calculate this provider's proportional share of the settlement amount
      (provider-settlement-share (if (> total-allocated u0)
        (/ (* allocation total-settlement) total-allocated)
        u0
      ))
      (provider-key {
        provider: provider,
        token-id: token-id,
      })
      (provider-allocation-key {
        provider: provider,
        policy-id: policy-id,
      })
    )
    ;; Update settlement-impacts map
    (map-set settlement-impacts {
      provider: provider,
      policy-id: policy-id,
    } {
      token-id: token-id,
      settlement-amount-contributed: provider-settlement-share,
      settlement-height: burn-block-height,
    })
    ;; Update provider balances
    (let (
        (provider-bal (unwrap-panic (map-get? provider-balances provider-key)))
        (provider-allocation (unwrap-panic (map-get? provider-allocations provider-allocation-key)))
        (remaining-for-provider (- allocation provider-settlement-share))
        (expiration-height (get expiration-height provider-allocation))
      )
      ;; Update allocated and available amounts
      (map-set provider-balances provider-key
        (merge provider-bal {
          allocated-amount: (- (get allocated-amount provider-bal) allocation),
          ;; If there's remaining collateral, it becomes available again
          available-amount: (+ (get available-amount provider-bal) remaining-for-provider),
        })
      )
      ;; LP-205: Reduce provider exposure for this expiration height
      (try! (reduce-provider-exposure provider token-id expiration-height allocation))
      ;; Emit provider-specific settlement event
      (print {
        event: "provider-settlement-impact",
        block-height: burn-block-height,
        provider: provider,
        policy-id: policy-id,
        token-id: token-id,
        allocated-amount: allocation,
        settlement-share: provider-settlement-share,
        remaining-collateral: remaining-for-provider,
      })
      ;; Update accumulator with remaining collateral
      (merge acc { remaining-collateral: (+ (get remaining-collateral acc) remaining-for-provider) })
    )
  )
)

;; --- LP-205: Exposure Management Functions ---

;; Get a provider's exposure for a specific expiration height
(define-read-only (get-provider-exposure-at-height
    (provider principal)
    (token-id (string-ascii 32))
    (expiration-height uint)
  )
  (let (
      (provider-key {
        provider: provider,
        token-id: token-id,
      })
      (provider-bal (map-get? provider-balances provider-key))
    )
    (if (is-some provider-bal)
      (get-exposure-from-map
        (get expiration-exposure (unwrap-panic provider-bal))
        expiration-height
      )
      u0
    )
  )
)

;; Get a provider's total exposure across all expiration heights
(define-read-only (get-provider-total-exposure
    (provider principal)
    (token-id (string-ascii 32))
  )
  (let (
      (provider-key {
        provider: provider,
        token-id: token-id,
      })
      (provider-bal (map-get? provider-balances provider-key))
    )
    (if (is-some provider-bal)
      (fold + (map-values (get expiration-exposure (unwrap-panic provider-bal)))
        u0
      )
      u0
    )
  )
)

;; Get exposure from a map at a specific height (helper function)
(define-private (get-exposure-from-map
    (exposure-map (map uint uint))
    (height uint)
  )
  (match (map-get? exposure-map height)
    exposure-value
    exposure-value
    u0
  )
)

;; Add exposure to a provider at a specific expiration height
(define-private (add-provider-exposure
    (provider principal)
    (token-id (string-ascii 32))
    (expiration-height uint)
    (amount uint)
  )
  (let (
      (provider-key {
        provider: provider,
        token-id: token-id,
      })
      (provider-bal (unwrap-panic (map-get? provider-balances provider-key)))
      (current-exposure-map (get expiration-exposure provider-bal))
      (current-exposure (get-exposure-from-map current-exposure-map expiration-height))
      (new-exposure (+ current-exposure amount))
      (tier-principal (var-get parameters-contract-principal))
    )
    ;; Get risk tier parameters to check for max exposure limit
    (match (as-contract (contract-call? tier-principal
      get-risk-tier-max-exposure-per-expiration-basis-points
    ))
      max-exposure-ok (let (
          (max-exposure-bp (unwrap-panic max-exposure-ok))
          (deposited (get deposited-amount provider-bal))
          ;; Calculate max allowed exposure (deposited * max-exposure-bp / 10000)
          (max-allowed-exposure (/ (* deposited max-exposure-bp) u10000))
        )
        ;; Verify this allocation doesn't exceed the maximum allowed exposure per expiration
        (asserts! (<= new-exposure max-allowed-exposure)
          ERR-MAX-EXPOSURE-EXCEEDED
        )
        ;; Update the exposure map
        (map-set provider-balances provider-key
          (merge provider-bal { expiration-exposure: (merge current-exposure-map { (expiration-height): new-exposure }) })
        )
        ;; Emit exposure update event
        (print {
          event: "provider-exposure-updated",
          block-height: burn-block-height,
          provider: provider,
          token-id: token-id,
          expiration-height: expiration-height,
          previous-exposure: current-exposure,
          new-exposure: new-exposure,
          action: "add",
        })
        (ok true)
      )
      error-response (err error-response)
    )
  )
)

;; Reduce exposure for a provider at a specific expiration height
(define-private (reduce-provider-exposure
    (provider principal)
    (token-id (string-ascii 32))
    (expiration-height uint)
    (amount uint)
  )
  (let (
      (provider-key {
        provider: provider,
        token-id: token-id,
      })
      (provider-bal (unwrap-panic (map-get? provider-balances provider-key)))
      (current-exposure-map (get expiration-exposure provider-bal))
      (current-exposure (get-exposure-from-map current-exposure-map expiration-height))
      (new-exposure (if (> current-exposure amount)
        (- current-exposure amount)
        u0 ;; Prevent underflow
      ))
    )
    ;; Update the exposure map
    (map-set provider-balances provider-key
      (merge provider-bal { expiration-exposure: (merge current-exposure-map { (expiration-height): new-exposure }) })
    )
    ;; Emit exposure update event
    (print {
      event: "provider-exposure-updated",
      block-height: burn-block-height,
      provider: provider,
      token-id: token-id,
      expiration-height: expiration-height,
      previous-exposure: current-exposure,
      new-exposure: new-exposure,
      action: "reduce",
    })
    (ok true)
  )
)

;; --- LP-206: Premium Distribution Functions ---

;; Distribute premiums to providers for an OTM policy
;; Called by Policy Registry after policy expiration
(define-public (distribute-premium-to-providers
    (policy-id uint)
    (token-id (string-ascii 32))
  )
  (let (
      (caller-principal tx-sender)
      (policy-registry (var-get policy-registry-principal))
    )
    ;; Only Policy Registry can call this function
    (asserts! (is-eq (some caller-principal) policy-registry)
      ERR-POLICY-REGISTRY-ONLY
    )
    ;; Verify policy premium was recorded
    (match (map-get? policy-premium-records { policy-id: policy-id })
      premium-record
      (begin
        ;; Verify premium wasn't already distributed
        (asserts! (not (get is-distributed premium-record))
          ERR-PREMIUM-ALREADY-DISTRIBUTED
        )
        (let (
            (premium-amount (get premium-amount premium-record))
            (premium-token (get token-id premium-record))
            ;; Find all providers who contributed to this policy
            (provider-allocation-info (find-providers-for-policy policy-id token-id))
            (provider-count (len provider-allocation-info))
          )
          (asserts! (is-eq premium-token token-id) ERR-INVALID-TOKEN)
          (asserts! (> provider-count u0) ERR-NO-ELIGIBLE-PROVIDERS)
          ;; Calculate total allocation to determine proportional distribution
          (let ((total-allocated (fold calculate-total-policy-allocation provider-allocation-info u0)))
            ;; Convert pending premiums to earned premiums for each provider
            (map
              (lambda (provider-info)
                (let (
                    (provider (get provider provider-info))
                    (provider-key {
                      provider: provider,
                      token-id: token-id,
                    })
                    (provider-allocation (get-provider-allocation-amount provider policy-id))
                    ;; Calculate this provider's share based on their allocation percentage
                    (provider-premium-share (if (> total-allocated u0)
                      (/ (* provider-allocation premium-amount) total-allocated)
                      u0
                    ))
                    (provider-bal (unwrap-panic (map-get? provider-balances provider-key)))
                  )
                  ;; Update provider's earned and pending premiums
                  (map-set provider-balances provider-key
                    (merge provider-bal {
                      earned-premiums: (+ (get earned-premiums provider-bal)
                        provider-premium-share
                      ),
                      pending-premiums: (- (get pending-premiums provider-bal)
                        provider-premium-share
                      ),
                    })
                  )
                  ;; Emit premium distribution event
                  (print {
                    event: "premium-distributed-to-provider",
                    block-height: burn-block-height,
                    provider: provider,
                    policy-id: policy-id,
                    token-id: token-id,
                    premium-share: provider-premium-share,
                    allocation-amount: provider-allocation,
                    allocation-percentage: (if (> total-allocated u0)
                      (/ (* provider-allocation u10000) total-allocated) ;; Basis points (e.g., 2500 = 25%)
                      u0
                    ),
                  })
                  provider-premium-share
                ))
              provider-allocation-info
            )
            ;; Update premium record to mark as distributed
            (map-set policy-premium-records { policy-id: policy-id }
              (merge premium-record {
                is-distributed: true,
                distribution-height: (some burn-block-height),
              })
            )
            ;; Update premium-balances map
            (match (map-get? premium-balances { token-id: token-id })
              prem-bal
              (map-set premium-balances { token-id: token-id }
                (merge prem-bal { total-premiums-distributed-to-providers: (+ (get total-premiums-distributed-to-providers prem-bal)
                  premium-amount
                ) }
                ))
              ;; If token not found in premium balances (unlikely, but handle it)
              (map-set premium-balances { token-id: token-id } {
                total-premiums-collected: u0,
                total-premiums-distributed-to-providers: premium-amount,
              })
            )
            ;; Emit premium distribution completed event
            (print {
              event: "premium-distribution-completed",
              block-height: burn-block-height,
              policy-id: policy-id,
              token-id: token-id,
              premium-amount: premium-amount,
              provider-count: provider-count,
            })
            (ok true)
          )
        )
      )
      ;; No premium record found
      (err ERR-PREMIUM-NOT-RECORDED)
    )
  )
)

;; Get premium distribution details for a policy
(define-read-only (get-premium-distribution (policy-id uint))
  (map-get? policy-premium-records { policy-id: policy-id })
)

;; Get total distributed premiums for a token
(define-read-only (get-total-distributed-premiums (token-id (string-ascii 32)))
  (match (map-get? premium-balances { token-id: token-id })
    prem-bal (get total-premiums-distributed-to-providers prem-bal)
    u0
  )
)

;; --- LP-207: Claim Earned Premiums Function ---

;; Allows providers to withdraw their earned premiums
(define-public (claim-earned-premiums (token-id (string-ascii 32)))
  (let (
      (provider tx-sender)
      (provider-key {
        provider: provider,
        token-id: token-id,
      })
      (provider-bal (unwrap! (map-get? provider-balances provider-key) ERR-NOT-ENOUGH-BALANCE))
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
        (try! (as-contract (contract-call? (unwrap-panic (get sbtc-contract-principal token-info))
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
      block-height: burn-block-height,
      provider: provider,
      token-id: token-id,
      claimed-amount: earned-amount,
    })
    (ok earned-amount)
  )
)

;; --- LP-208: Release Collateral Function ---

;; Release collateral for Out-of-The-Money (OTM) policies at expiration
;; Called by Policy Registry after determining a policy is OTM or after settlement is processed
(define-public (release-collateral
    (policy-id uint)
    (token-id (string-ascii 32))
    (expiration-height uint)
  )
  (begin
    ;; 1. Verify caller is the policy registry
    (asserts! (is-eq tx-sender (var-get policy-registry-principal))
      ERR-POLICY-REGISTRY-ONLY
    )
    ;; 2. Check valid inputs
    (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)
    ;; 3. Ensure this policy hasn't already been settled
    (asserts! (is-none (map-get? settlement-record-map policy-id))
      ERR-POLICY-ALREADY-SETTLED
    )
    ;; 4. Find providers who allocated to this policy
    (let ((providers-with-allocations (find-providers-for-policy policy-id token-id)))
      ;; 5. Ensure we found at least one provider with an allocation
      (asserts! (> (len providers-with-allocations) u0) ERR-NO-ALLOCATIONS-FOUND)
      ;; 6. Calculate total allocated amount by summing up all provider allocations
      (let ((total-allocated-amount (calculate-total-allocation-for-policy providers-with-allocations
          policy-id
        )))
        ;; 7. Process release for each provider
        (let ((released-amount (release-collateral-for-providers providers-with-allocations policy-id
            token-id expiration-height
          )))
          ;; 8. Update global token balances
          (let ((global-bal (unwrap! (map-get? token-balances { token-id: token-id })
              ERR-TOKEN-NOT-INITIALIZED
            )))
            (map-set token-balances { token-id: token-id }
              (merge global-bal {
                locked-balance: (- (get locked-balance global-bal) released-amount),
                available-balance: (+ (get available-balance global-bal) released-amount),
                ;; No change to total-balance since we're just moving funds from locked to available
              })
            )
            ;; 9. Update expiration liquidity needs
            (match (map-get? expiration-liquidity-needs expiration-height)
              expiration-needs
              (let (
                  (current-token-amount (default-to u0
                    (map-get? (get token-distributions expiration-needs) token-id)
                  ))
                  (updated-token-distributions (merge (get token-distributions expiration-needs) { (token-id): (if (> current-token-amount released-amount)
                    (- current-token-amount released-amount)
                    u0
                  ) }
                  ))
                  (new-policy-count (if (> (get policy-count expiration-needs) u0)
                    (- (get policy-count expiration-needs) u1)
                    u0
                  ))
                )
                (map-set expiration-liquidity-needs expiration-height
                  (merge expiration-needs {
                    total-collateral-required: (- (get total-collateral-required expiration-needs)
                      released-amount
                    ),
                    token-distributions: updated-token-distributions,
                    policy-count: new-policy-count,
                    ;; Keep is-liquidity-prepared status unchanged
                  })
                )
              )
              ;; If no record exists (unlikely), create a new one with zero required collateral
              (map-set expiration-liquidity-needs expiration-height {
                total-collateral-required: u0,
                is-liquidity-prepared: false,
                token-distributions: (map),
                policy-count: u0,
              })
            )
            ;; 10. Emit collateral released event
            (print {
              event: "collateral-released",
              block-height: burn-block-height,
              policy-id: policy-id,
              token-id: token-id,
              total-released-amount: released-amount,
              expiration-height: expiration-height,
              provider-count: (len providers-with-allocations),
            })
            (ok released-amount)
          )
        )
      )
    )
  )
)

;; Helper function to release collateral for all providers of a policy
(define-private (release-collateral-for-providers
    (providers (list 10 {
      provider: principal,
      policy-id: uint,
    }))
    (policy-id uint)
    (token-id (string-ascii 32))
    (expiration-height uint)
  )
  (fold +
    (map
      (lambda (provider-info)
        (release-provider-collateral (get provider provider-info) policy-id
          token-id expiration-height
        ))
      providers
    )
    u0
  )
)

;; Helper function to release a single provider's allocation for a policy
(define-private (release-provider-collateral
    (provider principal)
    (policy-id uint)
    (token-id (string-ascii 32))
    (expiration-height uint)
  )
  (let (
      (provider-key {
        provider: provider,
        token-id: token-id,
      })
      (provider-allocation-key {
        provider: provider,
        policy-id: policy-id,
      })
      (allocation (unwrap! (map-get? provider-allocations provider-allocation-key) u0))
      (allocated-amount (get allocated-to-policy-amount allocation))
    )
    ;; Skip if no allocation found or amount is zero
    (if (> allocated-amount u0)
      (let (
          ;; In reality, this should never be none if there's an allocation
          (provider-bal-opt (map-get? provider-balances provider-key))
        )
        (if (is-some provider-bal-opt)
          (let ((provider-bal (unwrap-panic provider-bal-opt)))
            ;; Update provider balance
            (map-set provider-balances provider-key
              (merge provider-bal {
                allocated-amount: (- (get allocated-amount provider-bal) allocated-amount),
                available-amount: (+ (get available-amount provider-bal) allocated-amount),
              })
            )
            ;; Reduce provider exposure for this expiration height
            (try! (reduce-provider-exposure provider token-id expiration-height
              allocated-amount
            ))
            ;; Delete the allocation record to clean up
            (map-delete provider-allocations provider-allocation-key)
            ;; Emit provider-specific allocation release event
            (print {
              event: "provider-allocation-released",
              block-height: burn-block-height,
              provider: provider,
              policy-id: policy-id,
              token-id: token-id,
              released-amount: allocated-amount,
              expiration-height: expiration-height,
            })
            allocated-amount
          )
          ;; If no provider balance found (unlikely), return 0
          u0
        )
      )
      ;; If no allocation or zero allocation, return 0
      u0
    )
  )
)

;; --- LP-209: Expiration Liquidity Needs Functions ---

;; Get total collateral required for a specific expiration height
(define-read-only (get-expiration-collateral-required (expiration-height uint))
  (match (map-get? expiration-liquidity-needs expiration-height)
    exp-needs (get total-collateral-required exp-needs)
    u0
  )
)

;; Get is-liquidity-prepared flag for a specific expiration height
(define-read-only (get-expiration-liquidity-prepared (expiration-height uint))
  (match (map-get? expiration-liquidity-needs expiration-height)
    exp-needs (get is-liquidity-prepared exp-needs)
    false
  )
)

;; Get policy count for a specific expiration height
(define-read-only (get-expiration-policy-count (expiration-height uint))
  (match (map-get? expiration-liquidity-needs expiration-height)
    exp-needs (get policy-count exp-needs)
    u0
  )
)

;; Get total collateral required for a specific token at a specific expiration height
(define-read-only (get-expiration-token-required
    (expiration-height uint)
    (token-id (string-ascii 32))
  )
  (match (map-get? expiration-liquidity-needs expiration-height)
    exp-needs (match (map-get? (get token-distributions exp-needs) token-id)
      token-amount
      token-amount
      u0
    )
    u0
  )
)

;; Check if an expiration height has any policies
(define-read-only (has-policies-at-expiration (expiration-height uint))
  (>= (get-expiration-policy-count expiration-height) u1)
)

;; Public version of find-providers-for-policy for verification contract
(define-read-only (find-providers-for-policy-public
    (policy-id uint)
    (token-id (string-ascii 32))
  )
  (find-providers-for-policy policy-id token-id)
)

;; Public version of get-provider-allocation-amount for verification contract
(define-read-only (get-provider-allocation-amount-public
    (provider principal)
    (policy-id uint)
  )
  (get-provider-allocation-amount provider policy-id)
)

(print { message: "European-Liquidity-Pool-Vault.clar updated for Phase 2, Steps LP-201, LP-202, LP-203, LP-204, LP-205, LP-206, LP-207, LP-208, and LP-209" })
