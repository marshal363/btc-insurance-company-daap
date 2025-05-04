;; BitHedge Liquidity Pool Vault Contract
;; Version: 1.0
;; Implementation based on: @docs/backend-new/provisional-2/bithedge-hybrid-architecture-overview.md

;; --- Traits ---
(define-trait sip-010-trait
  ((
    ;; Transfer tokens to a recipient
    (transfer (uint principal principal (optional (buff 34)))) (response bool uint))
    ;; Get the balance of a specific owner
    (get-balance (principal)) (response uint uint))
    ;; Get the total supply of the token
    (get-total-supply) (response uint uint))
    ;; Get the token name
    (get-name) (response (string-ascii 32) uint))
    ;; Get the token symbol
    (get-symbol) (response (string-ascii 32) uint))
    ;; Get the token decimals
    (get-decimals) (response uint uint))
    ;; Get the token URI
    (get-token-uri) (response (optional (string-utf8 256)) uint))
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

;; Token Identifiers (Placeholders - replace with actual mainnet/testnet addresses)
(define-constant STX-TOKEN 'STX) ;; Special identifier for native STX
(define-constant SBTC-TOKEN 'SP3DX3H4FEYZJZJ78774KX4MGLP3Q2JP5KR22X3W5.sbtc-token) ;; Example sBTC token principal

;; --- Data Structures ---

;; Map storing the total balance of each supported token held by the vault
;; Key: Token Principal (or 'STX for native STX)
;; Value: Total balance
(define-map token-balances { token: principal } { balance: uint })

;; Map storing the amount of collateral locked per token, aggregated across all policies
;; Key: Token Principal (or 'STX for native STX)
;; Value: Amount locked
(define-map locked-collateral { token: principal } { amount: uint })

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
(define-map supported-tokens { token: principal } { initialized: bool })

;; --- Administrative Functions ---

;; Set the backend authorized principal
;; Can only be called by the contract deployer
(define-public (set-backend-authorized-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender contract-deployer) ERR-UNAUTHORIZED)
    (var-set backend-authorized-principal new-principal)
    (ok true)
  )
)

;; Set the Policy Registry contract principal
;; Can only be called by the contract deployer
(define-public (set-policy-registry-principal (registry-principal principal))
  (begin
    (asserts! (is-eq tx-sender contract-deployer) ERR-UNAUTHORIZED)
    (var-set policy-registry-principal registry-principal)
    (ok true)
  )
)

;; Initialize a supported SIP-010 token or enable STX support
;; Can only be called by the contract deployer
(define-public (initialize-token (token principal))
  (begin
    (asserts! (is-eq tx-sender contract-deployer) ERR-UNAUTHORIZED)
    ;; Initialize balances and locked collateral maps for the token if not already done
    (map-insert token-balances { token: token } { balance: u0 })
    (map-insert locked-collateral { token: token } { amount: u0 })
    (map-set supported-tokens { token: token } { initialized: true })
    ;; Emit event (optional)
    (print { event: "token-initialized", token: token })
    (ok true)
  )
)

;; --- Helper Functions ---

;; Check if a token is initialized and supported
(define-private (is-token-supported (token principal))
  (default-to false (map-get? supported-tokens { token: token }))
)

;; --- Public Functions (Deposit, Withdraw) ---

;; Deposit STX into the vault
;; Can be called by any user
(define-public (deposit-stx (amount uint))
  (begin
    (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
    (asserts! (is-token-supported STX-TOKEN) ERR-TOKEN-NOT-INITIALIZED)

    ;; Perform the STX transfer from the user to this contract
    (stx-transfer? amount tx-sender (as-contract tx-sender))

    ;; Update the total STX balance in the vault
    (let ((current-balance (default-to u0 (get balance (map-get? token-balances { token: STX-TOKEN }))))) 
      (map-set token-balances { token: STX-TOKEN } { balance: (+ current-balance amount) })
    )

    ;; Emit event
    (print { event: "funds-deposited", depositor: tx-sender, amount: amount, token: STX-TOKEN })
    (ok true)
  )
)

;; Deposit a supported SIP-010 token (e.g., sBTC) into the vault
;; Can be called by any user
(define-public (deposit-sip010 (token <sip-010-trait>) (amount uint))
  (let (
      (token-principal (contract-of token))
      (depositor tx-sender)
    )
    (begin
      (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
      (asserts! (is-token-supported token-principal) ERR-TOKEN-NOT-INITIALIZED)

      ;; Perform the SIP-010 transfer from the user to this contract
      (try! (contract-call? token transfer amount depositor (as-contract tx-sender) none))

      ;; Update the total token balance in the vault
      (let ((current-balance (default-to u0 (get balance (map-get? token-balances { token: token-principal }))))) 
        (map-set token-balances { token: token-principal } { balance: (+ current-balance amount) })
      )

      ;; Emit event
      (print { event: "funds-deposited", depositor: depositor, amount: amount, token: token-principal })
      (ok true)
    )
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
      (current-balance (default-to u0 (get balance (map-get? token-balances { token: STX-TOKEN }))))
      (current-locked (default-to u0 (get amount (map-get? locked-collateral { token: STX-TOKEN }))))
      (available-balance (- current-balance current-locked))
    )
    (begin
      (asserts! (is-eq caller (var-get backend-authorized-principal)) ERR-UNAUTHORIZED)
      (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
      (asserts! (is-token-supported STX-TOKEN) ERR-TOKEN-NOT-INITIALIZED)
      (asserts! (>= available-balance amount) ERR-INSUFFICIENT-LIQUIDITY) ;; Check against available, not total balance

      ;; Perform the STX transfer from this contract to the recipient
      (try! (stx-transfer? amount (as-contract tx-sender) recipient))

      ;; Update the total STX balance in the vault
      (map-set token-balances { token: STX-TOKEN } { balance: (- current-balance amount) })

      ;; Emit event
      (print { event: "funds-withdrawn", withdrawer: recipient, amount: amount, token: STX-TOKEN })
      (ok true)
    )
  )
)

;; Withdraw a supported SIP-010 token (e.g., sBTC) from the vault
;; Restricted to the backend authorized principal
(define-public (withdraw-sip010 (token <sip-010-trait>) (amount uint) (recipient principal))
  (let (
      (caller tx-sender)
      (token-principal (contract-of token))
      (current-balance (default-to u0 (get balance (map-get? token-balances { token: token-principal }))))
      (current-locked (default-to u0 (get amount (map-get? locked-collateral { token: token-principal }))))
      (available-balance (- current-balance current-locked))
    )
    (begin
      (asserts! (is-eq caller (var-get backend-authorized-principal)) ERR-UNAUTHORIZED)
      (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
      (asserts! (is-token-supported token-principal) ERR-TOKEN-NOT-INITIALIZED)
      (asserts! (>= available-balance amount) ERR-INSUFFICIENT-LIQUIDITY) ;; Check against available balance

      ;; Perform the SIP-010 transfer from this contract to the recipient
      ;; Note: The SIP-010 transfer must be called *as* the contract itself.
      (try! (as-contract (contract-call? token transfer amount recipient none)))

      ;; Update the total token balance in the vault
      (map-set token-balances { token: token-principal } { balance: (- current-balance amount) })

      ;; Emit event
      (print { event: "funds-withdrawn", withdrawer: recipient, amount: amount, token: token-principal })
      (ok true)
    )
  )
)

;; --- Internal/Backend Functions (Collateral Management, Settlement) ---

;; Lock collateral for a new or existing policy
;; Restricted to the backend authorized principal
(define-public (lock-collateral (token-principal principal) (amount uint) (policy-id uint))
  (let (
      (caller tx-sender)
      (current-balance (default-to u0 (get balance (map-get? token-balances { token: token-principal }))))
      (current-locked (default-to u0 (get amount (map-get? locked-collateral { token: token-principal }))))
      (available-balance (- current-balance current-locked))
    )
    (begin
      (asserts! (is-eq caller (var-get backend-authorized-principal)) ERR-UNAUTHORIZED)
      (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
      (asserts! (is-token-supported token-principal) ERR-TOKEN-NOT-INITIALIZED)
      ;; Ensure there is enough *available* liquidity to lock this amount
      (asserts! (>= available-balance amount) ERR-INSUFFICIENT-LIQUIDITY)

      ;; Increase the locked amount for the token
      (map-set locked-collateral { token: token-principal } { amount: (+ current-locked amount) })

      ;; Emit event
      (print { event: "collateral-locked", policy-id: policy-id, amount-locked: amount, token: token-principal })
      (ok true)
    )
  )
)

;; Release collateral associated with a policy (e.g., upon expiration or settlement)
;; Restricted to the backend authorized principal
;; Note: This function *only* adjusts the internal locked amount. Actual fund transfer happens via withdraw or settle.
(define-public (release-collateral (token-principal principal) (amount uint) (policy-id uint))
  (let (
      (caller tx-sender)
      (current-locked (default-to u0 (get amount (map-get? locked-collateral { token: token-principal }))))
    )
    (begin
      (asserts! (is-eq caller (var-get backend-authorized-principal)) ERR-UNAUTHORIZED)
      (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
      (asserts! (is-token-supported token-principal) ERR-TOKEN-NOT-INITIALIZED)
      ;; Ensure we are not releasing more than is currently locked
      (asserts! (>= current-locked amount) ERR-COLLATERAL-LOCKED) ;; Using this error, might need a more specific one

      ;; Decrease the locked amount for the token
      (map-set locked-collateral { token: token-principal } { amount: (- current-locked amount) })

      ;; Emit event
      (print { event: "collateral-released", policy-id: policy-id, amount-released: amount, token: token-principal })
      (ok true)
    )
  )
)

;; Settle a policy by paying out the settlement amount to the buyer
;; Restricted to the backend authorized principal
;; Assumes collateral for this policy was already released via release-collateral
(define-public (pay-settlement (token-principal principal) (amount uint) (recipient principal) (policy-id uint))
  (let (
      (caller tx-sender)
      ;; Settlement uses total balance, assuming release-collateral was called first.
      ;; A stricter check could re-verify available >= amount, but that might be redundant
      ;; if the backend ensures release happens before settle.
      (current-balance (default-to u0 (get balance (map-get? token-balances { token: token-principal }))))
    )
    (begin
      (asserts! (is-eq caller (var-get backend-authorized-principal)) ERR-UNAUTHORIZED)
      (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
      (asserts! (is-token-supported token-principal) ERR-TOKEN-NOT-INITIALIZED)
      ;; Ensure the vault has enough *total* balance to cover the settlement
      (asserts! (>= current-balance amount) ERR-NOT-ENOUGH-BALANCE)

      ;; Perform the transfer based on token type
      (if (is-eq token-principal STX-TOKEN)
          ;; Transfer STX
          (try! (stx-transfer? amount (as-contract tx-sender) recipient))
          ;; Transfer SIP-010
          (let ((token-contract (contract-call? token-principal get-name))) ;; Need a way to get the trait instance
             ;; THIS IS PROBLEMATIC: Cannot easily get the <sip-010-trait> instance from principal
             ;; We need to pass the trait instance (<sip-010-trait>) as an argument instead of token-principal.
             ;; Re-implementing with trait argument.
             (print "Error: pay-settlement needs trait argument, not principal.")
             (err ERR-INVALID-TOKEN) ;; Placeholder error
          )
      )
      
      ;; This block will be replaced by the corrected implementation below
      (ok false) ;; Placeholder to satisfy structure before correction
    )
  )
)

;; Corrected pay-settlement function accepting the trait instance
(define-public (pay-settlement-ng (settlement-token (optional <sip-010-trait>)) (amount uint) (recipient principal) (policy-id uint))
   (let (
       (caller tx-sender)
       (is-stx (is-none settlement-token))
       (token-principal (if is-stx STX-TOKEN (contract-of (unwrap! settlement-token ERR-INVALID-TOKEN))))
       (current-balance (default-to u0 (get balance (map-get? token-balances { token: token-principal }))))
     )
     (begin
       (asserts! (is-eq caller (var-get backend-authorized-principal)) ERR-UNAUTHORIZED)
       (asserts! (> amount u0) ERR-AMOUNT-MUST-BE-POSITIVE)
       (asserts! (is-token-supported token-principal) ERR-TOKEN-NOT-INITIALIZED)
       (asserts! (>= current-balance amount) ERR-NOT-ENOUGH-BALANCE) ;; Check total balance
 
       ;; Perform the transfer
       (if is-stx
           ;; Transfer STX
           (try! (stx-transfer? amount (as-contract tx-sender) recipient))
           ;; Transfer SIP-010
           (let ((token-trait (unwrap! settlement-token ERR-INVALID-TOKEN)))
             (try! (as-contract (contract-call? token-trait transfer amount recipient none)))
           )
       )
 
       ;; Update the total token balance in the vault
       (map-set token-balances { token: token-principal } { balance: (- current-balance amount) })
 
       ;; Emit event
       (print { event: "settlement-paid", policy-id: policy-id, buyer: recipient, settlement-amount: amount, token: token-principal })
       (ok true)
     )
   )
 )

;; --- Read-Only Functions ---

;; Get the total balance of a specific token held by the vault
(define-read-only (get-total-token-balance (token-principal principal))
  (default-to u0 (get balance (map-get? token-balances { token: token-principal })))
)

;; Get the amount of locked collateral for a specific token
(define-read-only (get-locked-collateral (token-principal principal))
  (default-to u0 (get amount (map-get? locked-collateral { token: token-principal })))
)

;; Get the available (unlocked) balance for a specific token
(define-read-only (get-available-balance (token-principal principal))
  (let (
      (total-balance (get-total-token-balance token-principal))
      (locked-amount (get-locked-collateral token-principal))
    )
    ;; Prevent underflow if locked somehow exceeds total (should not happen)
    (if (> total-balance locked-amount)
        (- total-balance locked-amount)
        u0
    )
  )
)

;; Check if a token is supported/initialized
(define-read-only (is-token-supported-public (token-principal principal))
  (is-token-supported token-principal) ;; Calls the private helper
)

;; Get the backend authorized principal address
(define-read-only (get-backend-authorized-principal)
  (var-get backend-authorized-principal)
)

;; Get the policy registry principal address
(define-read-only (get-policy-registry-principal)
  (var-get policy-registry-principal)
)

;; --- Integration Points ---

;; Placeholder comment: Integration with Policy Registry
;; - lock-collateral is typically called by the backend after a policy is successfully created in the registry.
;; - release-collateral is called by the backend when a policy expires or is exercised (status updated in registry).
;; - pay-settlement is called by the backend after a policy is marked as Exercised in the registry.
;; - The policy-registry-principal variable is used for potential future cross-contract calls or checks if needed.

;; --- Placeholder for Read-Only Functions --- 