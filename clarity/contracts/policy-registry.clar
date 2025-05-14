;; BitHedge European-Style Policy Registry Contract
;; Version: 0.1 (Phase 1 Development)

;; --- Constants and Error Codes (SH-101) ---
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-UNAUTHORIZED (err u401))
(define-constant ERR-NOT-FOUND (err u404))
(define-constant ERR-INVALID-POLICY-TYPE (err u1001))
(define-constant ERR-ZERO-PROTECTED-VALUE (err u1002))
(define-constant ERR-ZERO-PROTECTION-AMOUNT (err u1003))
(define-constant ERR-EXPIRATION-IN-PAST (err u1004))
(define-constant ERR-POLICY-LIMIT-REACHED (err u1005))
(define-constant ERR-NOT-YET-EXPIRED (err u1006))
(define-constant ERR-INSUFFICIENT-LIQUIDITY (err u502)) ;; From Liquidity Pool check-liquidity
(define-constant ERR-LOCK-COLLATERAL-FAILED (err u503)) ;; From Liquidity Pool lock-collateral
(define-constant ERR-RECORD-PREMIUM-FAILED (err u504)) ;; From Liquidity Pool record-premium-payment
(define-constant ERR-INVALID-STATUS-TRANSITION (err u1007))
(define-constant ERR-NOT-ACTIVE (err u1008))
(define-constant ERR-INVALID-RISK-TIER (err u1009))
(define-constant ERR-COUNTERPARTY_IS_OWNER (err u1010))
(define-constant ERR-ZERO-PREMIUM (err u1011))
(define-constant ERR-CHECK-LIQUIDITY-FAILED (err u505)) ;; Specific error for check-liquidity call failure
(define-constant ERR-LP_PRINCIPAL_NOT_SET (err u601))

;; Status Constants (SH-101)
(define-constant STATUS-ACTIVE "Active")
(define-constant STATUS-SETTLED "Settled") ;; European style: settled or expired
(define-constant STATUS-EXPIRED "Expired")

;; Policy Type Constants (SH-101)
(define-constant POLICY-TYPE-PUT "PUT")
(define-constant POLICY-TYPE-CALL "CALL") ;; For future use

;; Position Type Constants (SH-101) - based on spec
(define-constant POSITION-LONG-PUT "LONG_PUT")
(define-constant POSITION-SHORT-PUT "SHORT_PUT") ;; Counterparty is LP
(define-constant POSITION-LONG-CALL "LONG_CALL")
(define-constant POSITION-SHORT-CALL "SHORT_CALL") ;; Counterparty is LP

;; Token Constants (SH-101) - for identifying asset types
(define-constant TOKEN-STX "STX")
(define-constant TOKEN-SBTC "sBTC") ;; This is a string identifier, not a principal here
(define-constant ASSET-BTC "BTC")

;; --- Data Structures (PR-101, PR-105) ---

;; Main storage for policy details
(define-map policies
  { id: uint } ;; Unique policy ID
  {
    owner: principal, ;; Policy owner (buyer)
    counterparty: principal, ;; Counterparty (Liquidity Pool Vault contract)
    protected-value: uint, ;; Strike price in base units (e.g., satoshis for BTC)
    protection-amount: uint, ;; Amount being protected in base units
    expiration-height: uint, ;; Block height when policy expires
    premium: uint, ;; Premium amount paid by owner (input to create-policy)
    policy-type: (string-ascii 4), ;; "PUT" or "CALL"
    position-type: (string-ascii 9), ;; e.g., "LONG_PUT" (owner's perspective)
    ;; counterparty-position-type: (string-ascii 9), ;; e.g., "SHORT_PUT" (LP's perspective)
    collateral-token: (string-ascii 4), ;; Token used as collateral (e.g., "STX", "sBTC")
    protected-asset: (string-ascii 4), ;; Asset being protected (e.g., "BTC")
    settlement-token: (string-ascii 4), ;; Token used for settlement if exercised
    status: (string-ascii 10), ;; "Active", "Settled", "Expired"
    creation-height: uint, ;; Block height when policy was created
    risk-tier: (string-ascii 32), ;; Risk tier selected by owner
    ;; Fields to be populated during/after expiration (Phase 2)
    premium-distributed-to-lp: bool, ;; Whether premium has been formally distributed/accounted for by LP (Phase 2)
    settlement-price-at-expiration: (optional uint), ;; Price at expiration if settled (Phase 2)
    settlement-amount-paid: (optional uint), ;; Amount settled if in-the-money (Phase 2)
    is-processed-post-expiration: bool, ;; Flag to ensure one-time processing post-expiration (Phase 2)
  }
)

;; Index of policies by owner
(define-map policies-by-owner
  { owner: principal }
  { policy-ids: (list 50 uint) } ;; Max 50 policies indexed per owner for gas efficiency
)

;; Index of policies by counterparty (which will be the Liquidity Pool Vault contract)
(define-map policies-by-counterparty
  { counterparty: principal }
  { policy-ids: (list 200 uint) } ;; LP can be counterparty to many policies
)

;; Index of policies by expiration height (crucial for European style processing)
(define-map policies-by-expiration-height
  { height: uint }
  { policy-ids: (list 200 uint) } ;; Potentially many policies expiring at the same height
)

;; Stores details of settled policies (populated in Phase 2)
(define-map policy-settlements
  { policy-id: uint }
  {
    settlement-price: uint,
    settlement-amount: uint,
    settlement-height: uint,
    settlement-timestamp: uint, ;; For off-chain reference
  }
)

;; Queue for policies whose premiums are ready for distribution to providers via LP (populated in Phase 2)
(define-map pending-premium-distributions
  { policy-id: uint }
  { ready-for-distribution: bool }
)

;; --- Data Variables (PR-102, PR-107) ---
(define-data-var policy-id-counter uint u0)

(define-data-var backend-authorized-principal principal tx-sender)
;; Oracle principal: For now, price is off-chain. This is for potential future on-chain oracle integration.
(define-data-var oracle-principal principal tx-sender)
(define-data-var liquidity-pool-vault-principal principal tx-sender)

;; --- Administrative Functions (Placeholders for PR-102, PR-107, to be defined in Step 1.4) ---
(define-public (set-backend-authorized-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set backend-authorized-principal new-principal)
    (ok true)
  )
)

(define-public (set-oracle-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set oracle-principal new-principal)
    (ok true)
  )
)

(define-public (set-liquidity-pool-vault-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    ;; Ensure the principal being set is not the deployer of this contract itself if it needs to be distinct
    (asserts! (not (is-eq new-principal CONTRACT-OWNER)) ERR-LP_PRINCIPAL_NOT_SET)
    (var-set liquidity-pool-vault-principal new-principal)
    (ok true)
  )
)

;; --- Policy Management Functions (Placeholders for PR-103, PR-110, to be defined in Step 1.4) ---

;; Private helper to determine collateral and settlement tokens based on policy type.
(define-private (get-collateral-and-settlement-tokens (policy-type (string-ascii 4)))
  (if (is-eq policy-type POLICY-TYPE-PUT)
    {
      collateral: TOKEN-STX,
      settlement: TOKEN-STX,
    }
    ;; Example: PUT backed by STX, pays out in STX
    ;; For CALL, assuming sBTC collateral and sBTC payout. Adjust if different.
    {
      collateral: TOKEN-SBTC,
      settlement: TOKEN-SBTC,
    }
  )
)

;; Private helper to calculate required collateral (simplified for now)
(define-private (calculate-required-collateral
    (policy-type (string-ascii 4))
  (protected-value uint)
  (protection-amount uint)
    (risk-tier (string-ascii 32))
  )
  ;; In a full implementation, this might also query risk-tier-parameters from LP-Vault
  ;; or use a shared parameter contract to adjust collateral based on risk-tier.
  ;; For Phase 1, European options typically collateralize the max potential payout.
  ;; For a PUT, max payout is protection-amount if strike is hit and asset value goes to 0 (simplified).
  ;; For a CALL, collateral would be the asset itself (e.g. sBTC).
  (if (is-eq policy-type POLICY-TYPE-PUT)
    protection-amount ;; Simplification: PUT collateral is full protection amount in the collateral token (e.g. STX)
    protection-amount ;; Simplification: CALL collateral could be the protection_amount of the underlying asset (e.g. sBTC amount)
  )
)

(define-public (create-protection-policy
    (owner-principal principal) ;; The buyer of the policy
    (protected-value-asset uint) ;; Strike price, e.g., BTC price in USD * 10^8
    (protection-amount-asset uint) ;; Amount of asset being protected, e.g., BTC amount in satoshis
  (expiration-height uint)
    (policy-type (string-ascii 4)) ;; "PUT" or "CALL"
    (input-premium uint) ;; Premium paid by the user for this policy
    (risk-tier (string-ascii 32))
  )
  (let (
      (policy-id (var-get policy-id-counter))
      (next-id (+ policy-id u1))
      (lp-principal (var-get liquidity-pool-vault-principal))
      (token-details (get-collateral-and-settlement-tokens policy-type))
      (collateral-token-id (get collateral token-details))
      (settlement-token-id (get settlement token-details))
      (current-block-height burn-block-height)
      (owner-pos-type (if (is-eq policy-type POLICY-TYPE-PUT)
                              POSITION-LONG-PUT 
        POSITION-LONG-CALL
      ))
      ;; (lp-pos-type (if (is-eq policy-type POLICY-TYPE-PUT) POSITION-SHORT-PUT POSITION-SHORT-CALL))
      ;; PR-110: Basic parameter validation
      (required-collateral (calculate-required-collateral policy-type protected-value-asset
        protection-amount-asset risk-tier
      ))
    )
    (asserts! (not (is-eq lp-principal tx-sender)) ERR-LP_PRINCIPAL_NOT_SET)
    ;; Ensure LP principal is set and not default
    (asserts! (not (is-eq owner-principal lp-principal))
      ERR-COUNTERPARTY_IS_OWNER
    )
    (asserts! (is-valid-policy-type policy-type) ERR-INVALID-POLICY-TYPE)
    (asserts! (> protected-value-asset u0) ERR-ZERO-PROTECTED-VALUE)
    (asserts! (> protection-amount-asset u0) ERR-ZERO-PROTECTION-AMOUNT)
    (asserts! (> input-premium u0) ERR-ZERO-PREMIUM)
    (asserts! (> expiration-height current-block-height) ERR-EXPIRATION-IN-PAST)
    (asserts! (is-valid-risk-tier risk-tier) ERR-INVALID-RISK-TIER)
    ;; Interaction with Liquidity Pool Vault
    (unwrap!
      (contract-call? lp-principal check-liquidity required-collateral
        collateral-token-id risk-tier expiration-height
      )
      ERR-CHECK-LIQUIDITY-FAILED
    )
    (unwrap!
      (contract-call? lp-principal lock-collateral policy-id required-collateral
        collateral-token-id risk-tier expiration-height owner-principal
      )
      ERR-LOCK-COLLATERAL-FAILED
    )
    (unwrap!
      (contract-call? lp-principal record-premium-payment policy-id input-premium
        collateral-token-id expiration-height owner-principal
      )
      ERR-RECORD-PREMIUM-FAILED
    )
    ;; Store policy
    (map-set policies { id: policy-id } {
      owner: owner-principal,
      counterparty: lp-principal,
      protected-value: protected-value-asset,
      protection-amount: protection-amount-asset,
      expiration-height: expiration-height,
      premium: input-premium,
      policy-type: policy-type,
      position-type: owner-pos-type,
      collateral-token: collateral-token-id,
      protected-asset: ASSET-BTC, ;; Assuming BTC for now
      settlement-token: settlement-token-id,
      status: STATUS-ACTIVE,
      creation-height: current-block-height,
      risk-tier: risk-tier,
      premium-distributed-to-lp: false,
      settlement-price-at-expiration: none,
      settlement-amount-paid: none,
      is-processed-post-expiration: false,
    })
    ;; Update indices
    (let ((owner-policies (default-to { policy-ids: (list) }
        (map-get? policies-by-owner { owner: owner-principal })
      )))
      (map-set policies-by-owner { owner: owner-principal } { policy-ids: (unwrap!
        (as-max-len? (append (get policy-ids owner-policies) policy-id) u50)
        ERR-POLICY-LIMIT-REACHED
      ) }
      )
    )
    (let ((lp-policies (default-to { policy-ids: (list) }
        (map-get? policies-by-counterparty { counterparty: lp-principal })
      )))
      (map-set policies-by-counterparty { counterparty: lp-principal } { policy-ids: (unwrap! (as-max-len? (append (get policy-ids lp-policies) policy-id) u200)
        ERR-POLICY-LIMIT-REACHED
      ) }
      )
    )
    (let ((exp-policies (default-to { policy-ids: (list) }
        (map-get? policies-by-expiration-height { height: expiration-height })
      )))
      (map-set policies-by-expiration-height { height: expiration-height } { policy-ids: (unwrap!
        (as-max-len? (append (get policy-ids exp-policies) policy-id) u200)
        ERR-POLICY-LIMIT-REACHED
      ) }
      )
    )
    (var-set policy-id-counter next-id)
    (print {
      event: "policy-created",
      policy-id: policy-id,
      owner: owner-principal,
      counterparty: lp-principal,
      policy_type: policy-type,
      risk_tier: risk-tier,
      premium: input-premium,
      expiration_height: expiration-height,
      protected_value: protected-value-asset,
      protection_amount: protection-amount-asset,
      collateral_token: collateral-token-id,
      required_collateral: required-collateral,
    })
    (ok policy-id)
  )
)

;; --- Read-Only Functions (Placeholders for PR-106, to be defined in Step 1.4) ---
(define-read-only (get-policy (id uint))
  (map-get? policies { id: id })
)

(define-read-only (get-policy-count)
  (ok (var-get policy-id-counter))
)

(define-read-only (get-policy-ids-by-owner (owner principal))
  (map-get? policies-by-owner { owner: owner })
)

(define-read-only (get-policy-ids-by-counterparty (counterparty principal))
  (map-get? policies-by-counterparty { counterparty: counterparty })
)

(define-read-only (get-policies-by-expiration-height (height uint))
  (map-get? policies-by-expiration-height { height: height })
)

(define-read-only (get-liquidity-pool-vault-principal)
  (ok (var-get liquidity-pool-vault-principal))
)

;; --- Utility Functions (SH-103) ---
(define-private (is-valid-policy-type (p-type (string-ascii 4)))
  (or (is-eq p-type POLICY-TYPE-PUT) (is-eq p-type POLICY-TYPE-CALL))
)

(define-private (is-valid-risk-tier (tier (string-ascii 32)))
  ;; In Phase 1, we just check against defined constants. Later, this might query LP vault or a shared contract.
  (or
    (is-eq tier RISK-TIER-CONSERVATIVE)
    (is-eq tier RISK-TIER-BALANCED)
    (is-eq tier RISK-TIER-AGGRESSIVE)
  )
)

(print { message: "European-Policy-Registry.clar updated for Phase 1, Step 1.4" })
