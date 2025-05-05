;; BitHedge Liquidity Pool Vault Contract
;; Version: 1.0
;; Implementation based on: @docs/backend-new/provisional-2/bithedge-hybrid-architecture-overview.md

;; --- Traits ---
;; SIP-010 Fungible Token standard trait
(define-trait sip-010-trait
  (
    ;; Transfer tokens to a recipient
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    ;; Get token balance
    (get-balance (principal) (response uint uint))
    ;; Get token supply
    (get-total-supply () (response uint uint))
    ;; Get token name
    (get-name () (response (string-ascii 32) uint))
    ;; Get token symbol
    (get-symbol () (response (string-ascii 32) uint))
    ;; Get token decimals
    (get-decimals () (response uint uint))
    ;; Get token URI
    (get-token-uri () (response (optional (string-utf8 256)) uint))
  )
)

;; --- Constants and Error Codes ---
(define-constant ERR-UNAUTHORIZED (err u401))
(define-constant ERR-NOT-ENOUGH-BALANCE (err u402))
(define-constant ERR-INVALID-TOKEN (err u403))
(define-constant ERR-TOKEN-NOT-INITIALIZED (err u404))
(define-constant ERR-AMOUNT-MUST-BE-POSITIVE (err u405))
(define-constant ERR-INSUFFICIENT-LIQUIDITY (err u406))
(define-constant ERR-COLLATERAL-LOCKED (err u407))
(define-constant ERR-TRANSFER-FAILED (err u500))
(define-constant CONTRACT-OWNER tx-sender)

;; Token Identifiers (Placeholders - replace with actual mainnet/testnet addresses)
;; We use a constant for sBTC example, but for STX we handle it differently
(define-constant SBTC-TOKEN 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token) ;; Example sBTC token principal

;; --- Data Structures ---

;; Map storing the total balance of each supported token held by the vault
;; Key: Token Principal (or "STX" for native STX)
;; Value: Total balance
(define-map token-balances { token: (string-ascii 32) } { balance: uint })

;; Map storing the amount of collateral locked per token, aggregated across all policies
;; Key: Token Principal (or "STX" for native STX)
;; Value: Amount locked
(define-map locked-collateral { token: (string-ascii 32) } { amount: uint })

;; Map storing balances per liquidity provider (Off-chain responsibility in "On-Chain Light")
;; (define-map provider-balances { provider: principal, token: principal } { balance: uint })
;; Note: Individual provider balances are managed off-chain by Convex in this model.
;; This contract only tracks the *total* pooled amount per token.

;; --- Data Variables ---

;; Principal authorized to perform backend operations (e.g., lock/release collateral, initiate settlement)
;; Defaults to the contract deployer initially
(define-data-var backend-authorized-principal principal tx-sender)

;; Principal of the Policy Registry contract (needed for validating calls like release-collateral)
;; Must be set after deployment
(define-data-var policy-registry-principal principal tx-sender)

;; Set of initialized/supported tokens
(define-map supported-tokens { token: (string-ascii 32) } { initialized: bool })

;; --- Administrative Functions ---

;; Set the backend authorized principal
;; Can only be called by the contract deployer
(define-public (set-backend-authorized-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set backend-authorized-principal new-principal)
    (ok true)
  )
)

;; Set the Policy Registry contract principal
;; Can only be called by the contract deployer
(define-public (set-policy-registry-principal (registry-principal principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set policy-registry-principal registry-principal)
    (ok true)
  )
)

;; Initialize a supported SIP-010 token or enable STX support
;; Can only be called by the contract deployer
(define-public (initialize-token (token-id (string-ascii 32)))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    ;; Initialize balances and locked collateral maps for the token if not already done
    (map-insert token-balances { token: token-id } { balance: u0 })
    (map-insert locked-collateral { token: token-id } { amount: u0 })
    (map-set supported-tokens { token: token-id } { initialized: true })
    ;; Emit event (optional)
    (print { event: "token-initialized", token: token-id })
    (ok true)
  )
)

;; --- Helper Functions ---

;; Check if a token is initialized and supported
(define-private (is-token-supported (token-id (string-ascii 32)))
  (default-to false (get initialized (map-get? supported-tokens { token: token-id })))
)

;; Check if a policy exists and is active via Policy Registry (LP-110)
;; Currently implemented as a placeholder to avoid circular dependency
(define-private (verify-policy-active (policy-id uint))
  ;; This is a placeholder implementation to avoid circular dependency.
  ;; In production, this would call the policy-registry contract.
  ;; During deployment, the actual contract call will be configured after both contracts are deployed.
  (ok true) ;; Always return active during development/testing
)

;; Get settlement details for a policy from Policy Registry (LP-110)
;; Currently implemented as a placeholder to avoid circular dependency
(define-private (get-policy-settlement-details (policy-id uint) (settlement-price uint))
  ;; This is a placeholder implementation to avoid circular dependency.
  ;; In production, this would call the policy-registry contract.
  ;; During deployment, the actual contract call will be configured after both contracts are deployed.
  (ok u1000) ;; Return a fixed test amount during development
)

;; Calculate required collateral amount based on policy parameters (copied from policy-registry)
(define-private (calculate-required-collateral 
  (policy-type (string-ascii 4)) 
  (protected-value uint) 
  (protection-amount uint))
  ;; Simplified: Assume PUT requires full protection amount in collateral token
  ;; Assume CALL requires a fraction (e.g., 50%) - adjust based on risk model
  (if (is-eq policy-type "PUT")
    protection-amount
    (/ protection-amount u2) ;; Example: 50% for CALL
  )
)

;; Determine the required token ID based on policy type (placeholder, copied from policy-registry)
(define-private (get-token-id-for-policy (policy-type (string-ascii 4)))
  ;; Placeholder: Assume STX is used for PUT, sBTC for CALL - adjust as needed
  (if (is-eq policy-type "PUT")
    "STX"
    "SBTC"
  )
)

;; --- Public Functions (Deposit, Withdraw) ---

;; Deposit STX into the vault
;; Can be called by any user
(define-public (deposit-stx (amount uint))
  (begin
    (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
    ;; Check STX support by attempting to access its map entry or assuming supported
    (asserts! (is-token-supported "STX") ERR-TOKEN-NOT-INITIALIZED)

    ;; Perform the STX transfer from the user to this contract
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))

    ;; Update the total STX balance in the vault
    (let ((current-balance (default-to u0 (get balance (map-get? token-balances { token: "STX" }))))) 
      (map-set token-balances { token: "STX" } { balance: (+ current-balance amount) })
    )

    ;; Emit event
    (print { event: "funds-deposited", depositor: tx-sender, amount: amount, token: "STX" })
    (ok true)
  )
)

;; Deposit a supported SIP-010 token (e.g., sBTC) into the vault
;; Can be called by any user
(define-public (deposit-sip010 (token <sip-010-trait>) (amount uint))
  (let (
      (token-principal (contract-of token))
      (token-id (unwrap-panic (contract-call? token get-symbol)))
      (depositor tx-sender)
    )
    (begin
      (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
      (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)

      ;; Perform the SIP-010 transfer from the user to this contract
      (try! (contract-call? token transfer amount depositor (as-contract tx-sender) none))

      ;; Update the total token balance in the vault
      (let ((current-balance (default-to u0 (get balance (map-get? token-balances { token: token-id }))))) 
        (map-set token-balances { token: token-id } { balance: (+ current-balance amount) })
      )

      ;; Emit event
      (print { event: "funds-deposited", depositor: depositor, amount: amount, token: token-id })
      (ok true)
    )
  )
)

;; ADD THIS TEMPORARY FUNCTION FOR DEBUGGING
(define-public (deposit-sbtc-direct (amount uint))
  (begin
    (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
    ;; Ensure SBTC is initialized first! This check is crucial.
    (asserts! (is-token-supported "SBTC") ERR-TOKEN-NOT-INITIALIZED)
    (print {event: "deposit-sbtc-direct called", amount: amount, sender: tx-sender})

    ;; Direct call to the known sBTC contract principal
    (try! (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer
      amount tx-sender (as-contract tx-sender) none))

    (print {event: "sbtc-transfer successful"})

    ;; Update the total sBTC balance in the vault (same logic as deposit-sip010)
    (let ((current-balance (default-to u0 (get balance (map-get? token-balances { token: "SBTC" })))))
      (map-set token-balances { token: "SBTC" } { balance: (+ current-balance amount) })
    )
    (print {event: "sbtc balance updated"})
    (ok true)
  )
)

;; --- Withdraw Functions ---
;; In the "On-Chain Light" model, withdrawals are typically initiated by the backend
;; based on off-chain provider requests and available (unlocked) liquidity checks.
;; The recipient is specified in the call.

;; Withdraw STX from the vault
;; Restricted to the backend authorized principal
(define-public (withdraw-stx (amount uint) (recipient principal))
  (let (
      (caller tx-sender)
      (current-balance (default-to u0 (get balance (map-get? token-balances { token: "STX" }))))
      (current-locked (default-to u0 (get amount (map-get? locked-collateral { token: "STX" }))))
      (available-balance (- current-balance current-locked))
    )
    (begin
      (asserts! (is-eq caller (var-get backend-authorized-principal)) ERR-UNAUTHORIZED)
      (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
      (asserts! (is-token-supported "STX") ERR-TOKEN-NOT-INITIALIZED)
      (asserts! (>= available-balance amount) ERR-INSUFFICIENT-LIQUIDITY) ;; Check against available, not total balance

      ;; Perform the STX transfer from this contract to the recipient
      (try! (as-contract (stx-transfer? amount tx-sender recipient)))

      ;; Update the total STX balance in the vault
      (map-set token-balances { token: "STX" } { balance: (- current-balance amount) })

      ;; Emit event
      (print { event: "funds-withdrawn", withdrawer: recipient, amount: amount, token: "STX" })
      (ok true)
    )
  )
)

;; Withdraw a supported SIP-010 token (e.g., sBTC) from the vault
;; Restricted to the backend authorized principal
(define-public (withdraw-sip010 (token <sip-010-trait>) (amount uint) (recipient principal))
  (let (
      (caller tx-sender)
      (token-id (unwrap-panic (contract-call? token get-symbol)))
      (current-balance (default-to u0 (get balance (map-get? token-balances { token: token-id }))))
      (current-locked (default-to u0 (get amount (map-get? locked-collateral { token: token-id }))))
      (available-balance (- current-balance current-locked))
    )
    (begin
      (asserts! (is-eq caller (var-get backend-authorized-principal)) ERR-UNAUTHORIZED)
      (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
      (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)
      (asserts! (>= available-balance amount) ERR-INSUFFICIENT-LIQUIDITY) ;; Check against available balance

      ;; Perform the SIP-010 transfer from this contract to the recipient
      ;; Note: The SIP-010 transfer must be called *as* the contract itself.
      (try! (as-contract (contract-call? token transfer amount tx-sender recipient none)))

      ;; Update the total token balance in the vault
      (map-set token-balances { token: token-id } { balance: (- current-balance amount) })

      ;; Emit event
      (print { event: "funds-withdrawn", withdrawer: recipient, amount: amount, token: token-id })
      (ok true)
    )
  )
)

;; --- Internal/Backend Functions (Collateral Management, Settlement) ---

;; Lock collateral for a new or existing policy
;; Restricted to the backend authorized principal
(define-public (lock-collateral (token-id (string-ascii 32)) (amount uint) (policy-id uint))
  (let (
      (caller tx-sender)
      (current-balance (default-to u0 (get balance (map-get? token-balances { token: token-id }))))
      (current-locked (default-to u0 (get amount (map-get? locked-collateral { token: token-id }))))
      (available-balance (- current-balance current-locked))
    )
    (begin
      (asserts! (is-eq caller (var-get backend-authorized-principal)) ERR-UNAUTHORIZED)
      (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
      (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)
      ;; Ensure there is enough *available* liquidity to lock this amount
      (asserts! (>= available-balance amount) ERR-INSUFFICIENT-LIQUIDITY)

      ;; Increase the locked amount for the token
      (map-set locked-collateral { token: token-id } { amount: (+ current-locked amount) })

      ;; Emit event
      (print { event: "collateral-locked", policy-id: policy-id, amount-locked: amount, token: token-id })
      (ok true)
    )
  )
)

;; Release collateral associated with a policy (e.g., upon expiration or settlement)
;; Restricted to the backend authorized principal
;; Note: This function *only* adjusts the internal locked amount. Actual fund transfer happens via withdraw or settle.
(define-public (release-collateral (token-id (string-ascii 32)) (amount uint) (policy-id uint))
  (let (
      (caller tx-sender)
      (current-locked (default-to u0 (get amount (map-get? locked-collateral { token: token-id }))))
    )
    (begin
      (asserts! (is-eq caller (var-get backend-authorized-principal)) ERR-UNAUTHORIZED)
      (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
      (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)
      ;; Ensure we are not releasing more than is currently locked
      (asserts! (>= current-locked amount) ERR-COLLATERAL-LOCKED) ;; Using this error, might need a more specific one

      ;; Decrease the locked amount for the token
      (map-set locked-collateral { token: token-id } { amount: (- current-locked amount) })

      ;; Emit event
      (print { event: "collateral-released", policy-id: policy-id, amount-released: amount, token: token-id })
      (ok true)
    )
  )
)

;; Pay settlement for an exercised policy
;; Restricted to the backend authorized principal
;; NOTE: This function ONLY handles the transfer of settlement funds.
;; The corresponding collateral release MUST be handled by a separate call
;; to `release-collateral` by the backend after confirming this payment.
(define-public (pay-settlement (token-id (string-ascii 32)) (settlement-amount uint) (recipient principal) (policy-id uint))
  (let (
      (caller tx-sender)
      (current-balance (default-to u0 (get balance (map-get? token-balances { token: token-id }))))
      (current-locked (default-to u0 (get amount (map-get? locked-collateral { token: token-id }))))
    )
    (begin
      (asserts! (is-eq caller (var-get backend-authorized-principal)) ERR-UNAUTHORIZED)
      (asserts! (> settlement-amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
      (asserts! (is-token-supported token-id) ERR-TOKEN-NOT-INITIALIZED)
      (asserts! (>= current-balance settlement-amount) ERR-NOT-ENOUGH-BALANCE) ;; Ensure total balance covers settlement

      ;; Verify the policy status with the registry (LP-110) - Placeholder check
      ;; TODO: Uncomment and refine this check based on Policy Registry capabilities
      ;; (asserts! (unwrap! (verify-policy-active policy-id) (err u404)) (err u403))

      ;; Perform the transfer based on token type
      (if (is-eq token-id "STX")
          ;; STX Settlement
          (try! (as-contract (stx-transfer? settlement-amount tx-sender recipient)))
          ;; For now, we only support STX and SBTC, so we directly use SBTC-TOKEN
          ;; In a production version, this would need to be more flexible
          (try! (as-contract (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer 
                                             settlement-amount tx-sender recipient none)))
      )

      ;; Update total token balance
      (map-set token-balances { token: token-id } { balance: (- current-balance settlement-amount) })

      ;; Collateral Release is handled separately by the backend calling `release-collateral`.
      ;; This ensures separation of concerns and keeps this function focused on payment.

      ;; Emit event
      (print { event: "settlement-paid", policy-id: policy-id, buyer: recipient, settlement-amount: settlement-amount, token: token-id })
      (ok true)
    )
  )
)

;; --- Read-Only Functions ---

;; Get the total balance of a specific token held by the vault
(define-read-only (get-total-token-balance (token-id (string-ascii 32)))
  (default-to u0 (get balance (map-get? token-balances { token: token-id })))
)

;; Get the amount of locked collateral for a specific token
(define-read-only (get-locked-collateral (token-id (string-ascii 32)))
  (default-to u0 (get amount (map-get? locked-collateral { token: token-id })))
)

;; Get the available (unlocked) balance for a specific token
(define-read-only (get-available-balance (token-id (string-ascii 32)))
  (let (
      (total-balance (get-total-token-balance token-id))
      (locked-amount (get-locked-collateral token-id))
    )
    ;; Prevent underflow if locked somehow exceeds total (should not happen)
    (if (> total-balance locked-amount)
        (- total-balance locked-amount)
        u0
    )
  )
)

;; Check if a token is supported/initialized
(define-read-only (is-token-supported-public (token-id (string-ascii 32)))
  (is-token-supported token-id) ;; Calls the private helper
)

;; Get the backend authorized principal address
(define-read-only (get-backend-authorized-principal)
  (var-get backend-authorized-principal)
)

;; Get the policy registry principal address
(define-read-only (get-policy-registry-principal)
  (var-get policy-registry-principal)
)

;; Check if the vault has sufficient available balance to cover the required collateral for a potential policy
;; Called by policy-registry contract during policy creation check (PR-111)
(define-read-only (has-sufficient-collateral
  (protected-value uint)
  (protection-amount uint)
  (policy-type (string-ascii 4)))
  (let (
      (token-id (get-token-id-for-policy policy-type))
      (required-collateral (calculate-required-collateral policy-type protected-value protection-amount))
      (available (get-available-balance token-id))
    )
    (ok (>= available required-collateral))
  )
)

;; --- Integration Points ---

;; Placeholder comment: Integration with Policy Registry
;; - lock-collateral is typically called by the backend after a policy is successfully created in the registry.
;; - release-collateral is called by the backend when a policy expires or is exercised (status updated in registry).
;; - pay-settlement is called by the backend after a policy is marked as Exercised in the registry.
;; - The policy-registry-principal variable is used for potential future cross-contract calls or checks if needed. 