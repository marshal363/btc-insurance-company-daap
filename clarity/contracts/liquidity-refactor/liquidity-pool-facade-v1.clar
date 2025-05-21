;; liquidity-pool-facade-v1.clar
;; Provides backward compatibility with original liquidity pool contract

;; Import traits
(use-trait capital-manager-trait .capital-manager-trait.capital-manager-trait)
(use-trait risk-assessor-trait .risk-assessor-trait.risk-assessor-trait)
(use-trait allocation-trait .allocation-trait.allocation-trait)
(use-trait settlement-trait .settlement-trait.settlement-trait)
(use-trait premium-manager-trait .premium-manager-trait.premium-manager-trait)
(use-trait ft-trait .trait-sip-010.sip-010-trait)

;; --- Constants ---

;; Error Codes
(define-constant ERR-UNAUTHORIZED (err u7001))
(define-constant ERR-CONTRACT-NOT-FOUND (err u7002))
(define-constant ERR-REGISTRY-ERROR (err u7003))
(define-constant ERR-AMOUNT-MUST-BE-POSITIVE (err u7004))
(define-constant ERR-TOKEN-NOT-INITIALIZED (err u7005))
(define-constant ERR-INVALID-RISK-TIER (err u7006))
(define-constant ERR-TRANSFER-FAILED (err u7007))
(define-constant ERR-INSUFFICIENT-LIQUIDITY (err u7008))
(define-constant ERR-NOT-ENOUGH-BALANCE (err u7009))
(define-constant ERR-ALREADY-INITIALIZED (err u7010))

;; Risk Tier Constants
(define-constant RISK-TIER-CONSERVATIVE "conservative")
(define-constant RISK-TIER-BALANCED "balanced")
(define-constant RISK-TIER-AGGRESSIVE "aggressive")

;; Token Constants
(define-constant STX-TOKEN-ID "STX")

;; --- Contract References ---
(define-data-var registry-principal (optional principal) none)

;; --- Authentication ---

;; Check authorization from registry
(define-private (is-authorized)
  (match (var-get registry-principal)
    registry-some (contract-call? registry-some is-authorized tx-sender)
    false
  )
)

;; --- Initialization ---

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

;; --- Helper Functions ---

;; Get contract from registry
(define-private (get-contract-from-registry (contract-type (string-ascii 32)))
  (match (var-get registry-principal)
    registry-some 
      (match (contract-call? registry-some get-contract contract-type)
        contract-principal (ok contract-principal)
        (err ERR-CONTRACT-NOT-FOUND)
      )
    (err ERR-REGISTRY-ERROR)
  )
)

;; Get capital manager contract
(define-private (get-capital-manager)
  (get-contract-from-registry "capital-manager")
)

;; Get risk manager contract
(define-private (get-risk-manager)
  (get-contract-from-registry "risk-manager")
)

;; Get allocation manager contract
(define-private (get-allocation-manager)
  (get-contract-from-registry "allocation-manager")
)

;; Get settlement manager contract
(define-private (get-settlement-manager)
  (get-contract-from-registry "settlement-manager")
)

;; Get premium manager contract
(define-private (get-premium-manager)
  (get-contract-from-registry "premium-manager")
)

;; --- Facade Functions ---

;; Initialize a token
(define-public (initialize-token
    (token-id (string-ascii 32))
    (sip010-principal-if-sip010 (optional principal))
  )
  (begin
    (match (get-capital-manager)
      capital-manager-principal
        (contract-call? capital-manager-principal 
          initialize-token token-id sip010-principal-if-sip010
        )
      (err ERR-REGISTRY-ERROR)
    )
  )
)

;; Deposit capital
(define-public (deposit-capital
    (amount uint)
    (token-id (string-ascii 32))
    (risk-tier (string-ascii 32))
  )
  (begin
    (match (get-capital-manager)
      capital-manager-principal
        (contract-call? capital-manager-principal 
          deposit-capital amount token-id risk-tier
        )
      (err ERR-REGISTRY-ERROR)
    )
  )
)

;; Withdraw capital
(define-public (withdraw-capital
    (amount uint)
    (token-id (string-ascii 32))
  )
  (begin
    (match (get-capital-manager)
      capital-manager-principal
        (contract-call? capital-manager-principal 
          withdraw-capital amount token-id
        )
      (err ERR-REGISTRY-ERROR)
    )
  )
)

;; Check liquidity
(define-public (check-liquidity
    (protection-amount-scaled uint)
    (token-id (string-ascii 32))
    (risk-tier (string-ascii 32))
    (expiration-height uint)
  )
  (begin
    (match (get-risk-manager)
      risk-manager-principal
        (contract-call? risk-manager-principal 
          check-liquidity 
          protection-amount-scaled token-id risk-tier expiration-height
        )
      (err ERR-REGISTRY-ERROR)
    )
  )
)

;; Lock collateral for a policy
(define-public (lock-collateral
    (policy-id uint)
    (collateral-amount uint)
    (token-id (string-ascii 32))
    (risk-tier (string-ascii 32))
    (expiration-height uint)
    (policy-owner-principal principal)
  )
  (begin
    (match (get-allocation-manager)
      allocation-manager-principal
        (contract-call? allocation-manager-principal 
          lock-collateral 
          policy-id collateral-amount token-id 
          risk-tier expiration-height policy-owner-principal
        )
      (err ERR-REGISTRY-ERROR)
    )
  )
)

;; Record premium payment
(define-public (record-premium-payment
    (policy-id uint)
    (premium-amount uint)
    (token-id (string-ascii 32))
    (expiration-height uint)
    (policy-owner-principal principal)
  )
  (begin
    (match (get-premium-manager)
      premium-manager-principal
        (contract-call? premium-manager-principal 
          record-premium-payment 
          policy-id premium-amount token-id 
          expiration-height policy-owner-principal
        )
      (err ERR-REGISTRY-ERROR)
    )
  )
)

;; Process settlement
(define-public (process-settlement-at-expiration
    (policy-id uint)
    (settlement-amount uint)
    (token-id (string-ascii 32))
    (policy-owner principal)
  )
  (begin
    (match (get-settlement-manager)
      settlement-manager-principal
        (contract-call? settlement-manager-principal 
          process-settlement 
          policy-id settlement-amount token-id policy-owner
        )
      (err ERR-REGISTRY-ERROR)
    )
  )
)

;; Distribute premium
(define-public (distribute-premium-to-providers
    (policy-id uint)
    (token-id (string-ascii 32))
  )
  (begin
    (match (get-premium-manager)
      premium-manager-principal
        (contract-call? premium-manager-principal 
          distribute-premium policy-id token-id
        )
      (err ERR-REGISTRY-ERROR)
    )
  )
)

;; Release collateral
(define-public (release-collateral
    (policy-id uint)
    (token-id (string-ascii 32))
    (expiration-height uint)
  )
  (begin
    (match (get-allocation-manager)
      allocation-manager-principal
        (contract-call? allocation-manager-principal 
          release-collateral policy-id token-id expiration-height
        )
      (err ERR-REGISTRY-ERROR)
    )
  )
)

;; Claim earned premiums
(define-public (claim-earned-premiums
    (token-id (string-ascii 32))
  )
  (begin
    (match (get-capital-manager)
      capital-manager-principal
        (contract-call? capital-manager-principal 
          claim-earned-premiums token-id
        )
      (err ERR-REGISTRY-ERROR)
    )
  )
)

;; Prepare liquidity for expiration
(define-public (prepare-liquidity-for-expirations
    (expiration-height uint)
  )
  (begin
    (match (get-allocation-manager)
      allocation-manager-principal
        (contract-call? allocation-manager-principal 
          prepare-liquidity-for-expiration expiration-height
        )
      (err ERR-REGISTRY-ERROR)
    )
  )
)

;; --- Read-Only Functions ---

;; Get total token balance
(define-public (get-total-token-balance
    (token-id (string-ascii 32))
  )
  (begin
    (match (get-capital-manager)
      capital-manager-principal
        (contract-call? capital-manager-principal 
          get-total-token-balance token-id
        )
      (err ERR-REGISTRY-ERROR)
    )
  )
)

;; Get available balance
(define-public (get-available-balance
    (token-id (string-ascii 32))
  )
  (begin
    (match (get-capital-manager)
      capital-manager-principal
        (contract-call? capital-manager-principal 
          get-available-balance token-id
        )
      (err ERR-REGISTRY-ERROR)
    )
  )
)

;; Get provider balance
(define-public (get-provider-balance
    (provider principal)
    (token-id (string-ascii 32))
  )
  (begin
    (match (get-capital-manager)
      capital-manager-principal
        (contract-call? capital-manager-principal 
          get-provider-balance provider token-id
        )
      (err ERR-REGISTRY-ERROR)
    )
  )
)

;; Get provider allocation for policy
(define-public (get-provider-allocation-for-policy
    (provider principal)
    (policy-id uint)
  )
  (begin
    (match (get-allocation-manager)
      allocation-manager-principal
        (contract-call? allocation-manager-principal 
          get-provider-allocation provider policy-id
        )
      (err ERR-REGISTRY-ERROR)
    )
  )
)

;; Get settlement record
(define-public (get-settlement-record
    (policy-id uint)
  )
  (begin
    (match (get-settlement-manager)
      settlement-manager-principal
        (contract-call? settlement-manager-principal 
          get-settlement-record policy-id
        )
      (err ERR-REGISTRY-ERROR)
    )
  )
)

;; Get premium distribution
(define-public (get-premium-distribution
    (policy-id uint)
  )
  (begin
    (match (get-premium-manager)
      premium-manager-principal
        (contract-call? premium-manager-principal 
          get-premium-distribution policy-id
        )
      (err ERR-REGISTRY-ERROR)
    )
  )
)

;; Get expiration collateral required
(define-public (get-expiration-collateral-required
    (expiration-height uint)
  )
  (begin
    (match (get-allocation-manager)
      allocation-manager-principal
        (contract-call? allocation-manager-principal 
          get-expiration-collateral-required expiration-height
        )
      (err ERR-REGISTRY-ERROR)
    )
  )
)

;; Find providers for policy - for debugging/admin use
(define-read-only (find-providers-for-policy-public
    (policy-id uint)
  )
  (match (get-allocation-manager)
    allocation-manager-principal
      (contract-call? allocation-manager-principal 
        find-providers-for-policy policy-id
      )
    (list) ;; Return empty list on error
  )
)

;; Check if token is initialized
(define-read-only (is-token-initialized-public
    (token-id (string-ascii 32))
  )
  (match (get-capital-manager)
    capital-manager-principal
      (contract-call? capital-manager-principal 
        is-token-initialized token-id
      )
    (err ERR-REGISTRY-ERROR)
  )
)
