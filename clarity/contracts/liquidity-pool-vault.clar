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

;; Risk Tier Constants (SH-102) - More may be added as parameters later
(define-constant RISK-TIER-CONSERVATIVE "Conservative")
(define-constant RISK-TIER-BALANCED "Balanced")
(define-constant RISK-TIER-AGGRESSIVE "Aggressive")

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
;; }
(define-map expiration-liquidity-needs
  uint ;; expiration-height
  {
    total-collateral-required: uint,
    is-liquidity-prepared: bool,
  }
)

;; --- Data Variables ---
(define-data-var backend-authorized-principal principal tx-sender)
(define-data-var policy-registry-principal (optional principal) none) ;; LP-102: For Policy Registry contract
(define-data-var parameters-contract-principal (optional principal) none) ;; LP-102: For Parameters contract
(define-data-var math-library-principal (optional principal) none) ;; LP-102: For Math Library contract

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
      (provider-bal (unwrap! (map-get? provider-balances provider-key) ERR-NOT_ENOUGH_BALANCE)) ;; Ensure provider exists
      (available-to-withdraw (get available-amount provider-bal))
      (global-bal (unwrap! (map-get? token-balances { token-id: token-id })
        ERR-TOKEN-NOT_INITIALIZED
      ))
    )
    (asserts! (is-token-supported token-id) ERR-TOKEN-NOT_INITIALIZED)
    (asserts! (> amount u0) ERR-AMOUNT-MUST-BE_POSITIVE)
    (asserts! (>= available-to-withdraw amount) ERR-NOT_ENOUGH_BALANCE)
    (if (is-eq token-id STX-TOKEN-ID)
      (try! (as-contract (stx-transfer? amount tx-sender provider)))
      (let ((token-info (unwrap! (map-get? supported-tokens { token-id: token-id })
          ERR-TOKEN-NOT_INITIALIZED
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

;; --- Liquidity and Collateral Functions (LP-109, LP-105) ---
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
      ;; Phase 1: Basic check of overall available balance for the token.
      ;; More sophisticated checks (tier-specific liquidity, concentration) will be in later phases.
      (if (>= (get available-balance global-balance) required-collateral)
        (ok true)
        (err ERR-INSUFFICIENT-LIQUIDITY)
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
      ;; Phase 1 Simplification: Assume a single provider (this contract itself or a designated capital pool)
      ;; or the first provider found with enough capacity in the given risk tier.
      ;; For now, we will just use the contract's overall available balance for this logic.
      ;; This will be significantly enhanced in LP-305 (Provider selection algorithm).
      ;; We need at least one provider to associate the allocation with.
      ;; For now, let's assume the CONTRACT-OWNER is the default provider if no specific provider logic.
      ;; This is a major simplification for Phase 1.
      (let ((provider-principal CONTRACT-OWNER))
        ;; Simplified: Using contract owner as default provider for allocation tracking
        (let (
            (provider-key {
              provider: provider-principal,
              token-id: token-id,
            })
            (prov-bal (unwrap! (map-get? provider-balances provider-key)
              ERR-NO_PROVIDER_FOR_TIER
            ))
          )
          (asserts! (>= (get available-amount prov-bal) collateral-amount)
            ERR-INSUFFICIENT-TIER-LIQUIDITY
          )
          ;; Check specific provider
          (map-set token-balances { token-id: token-id }
            (merge global-bal {
              available-balance: (- (get available-balance global-bal) collateral-amount),
              locked-balance: (+ (get locked-balance global-bal) collateral-amount),
            })
          )
          (map-set provider-balances provider-key
            (merge prov-bal {
              allocated-amount: (+ (get allocated-amount prov-bal) collateral-amount),
              available-amount: (- (get available-amount prov-bal) collateral-amount),
              expiration-exposure: (map-set (get expiration-exposure prov-bal) expiration-height
                (+
                  (default-to u0
                    (map-get? (get expiration-exposure prov-bal)
                      expiration-height
                    ))
                  collateral-amount
                )),
            })
          )
          (map-set provider-allocations {
            provider: provider-principal,
            policy-id: policy-id,
          } {
            token-id: token-id,
            allocated-to-policy-amount: collateral-amount,
            risk-tier-at-allocation: risk-tier,
            expiration-height: expiration-height,
          })
          (print {
            event: "collateral-locked",
            block-height: burn-block-height,
            policy-id: policy-id,
            allocated-provider-principal: provider-principal,
            collateral-amount: collateral-amount,
            token-id: token-id,
            risk-tier: risk-tier,
            expiration-height: expiration-height,
            policy-owner-principal: policy-owner-principal,
          })
          (ok true)
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
    ;; The premium is technically paid by the policy-owner-principal to the Policy Registry, which then informs LP.
    ;; The LP needs to account for this premium as collected. For European options, premiums typically pool and are distributed later.
    (let ((prem-bal (unwrap! (map-get? premium-balances { token-id: token-id })
        ERR-TOKEN-NOT-INITIALIZED
      )))
      (map-set premium-balances { token-id: token-id }
        (merge prem-bal { total-premiums-collected: (+ (get total-premiums-collected prem-bal) premium-amount) })
      )
    )
    ;; Note: The actual STX/sBTC for the premium should have been transferred to the Policy Registry or a holding address.
    ;; This function in LP just records that a premium was paid for a policy it backs.
    ;; In Phase 1, we assume the premium amount is just recorded. Actual fund flow to providers is Phase 2.
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

(print { message: "European-Liquidity-Pool-Vault.clar updated for Phase 1, Step 1.5" })
