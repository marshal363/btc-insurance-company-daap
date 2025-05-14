;; BitHedge European-Style Parameters Contract
;; Version: 0.1 (Phase 1 Development - PA-101, PA-103, PA-104)
;; Summary: Central repository for system configuration parameters, fee structures, and authorized roles.
;; Description: This contract manages parameters crucial for the operation of the BitHedge platform,
;;              including risk tier configurations, fee settings, system limits, and access control for administrative functions.

;; --- Constants (Includes PA-104 additions) ---
(define-constant CONTRACT-OWNER tx-sender)

;; System-Wide Constants (PA-104)
(define-constant UINT-MAX u340282366920938463463374607431768211455) ;; Maximum value for uint
(define-constant BASIS_POINTS_MULTIPLIER u100) ;; For expressing percentages, e.g., 1% = u100 basis points
(define-constant BASIS_POINTS_DENOMINATOR u10000) ;; Denominator for basis points (100.00% = 10000 basis points)

;; Standard Role Names (PA-104) - to be used with the authorized-roles map
(define-constant ROLE-ADMIN "admin")
(define-constant ROLE-SYSTEM-PARAMETER-MANAGER "param-manager")
(define-constant ROLE-FEE-STRUCTURE-MANAGER "fee-manager")
(define-constant ROLE-ORACLE-DATA-PROVIDER "oracle-provider")
(define-constant ROLE-EMERGENCY-OPERATOR "emergency-operator")
(define-constant ROLE-LIQUIDITY-POOL-ADMIN "lp-admin")
(define-constant ROLE-POLICY-REGISTRY-ADMIN "pr-admin")
(define-constant ROLE-VERIFICATION-CONTRACT-ADMIN "vc-admin")
(define-constant ROLE-MATH-LIB-ADMIN "ml-admin")


;; --- Error Codes (PA-104 is for a more global set, these are specific or common) ---

;; System-Wide Error Codes (PA-104) - Intended for use across all BitHedge contracts
(define-constant ERR-GENERIC (err u100))                      ;; A general catch-all if nothing more specific fits
(define-constant ERR-NOT-YET-IMPLEMENTED (err u101))         ;; For functions or features that are planned but not coded
(define-constant ERR-SYSTEM-PAUSED (err u102))               ;; Global system pause is active, most actions suspended
(define-constant ERR-INVALID-STATE (err u103))               ;; Operation attempted in an incorrect contract or system state
(define-constant ERR-ARITHMETIC-OVERFLOW (err u104))         ;; Calculation resulted in a value greater than UINT_MAX
(define-constant ERR-ARITHMETIC-UNDERFLOW (err u105))        ;; Calculation resulted in a value less than zero (for uints)
(define-constant ERR-DIVISION-BY-ZERO (err u106))            ;; Attempted to divide by zero
(define-constant ERR-AMOUNT-TOO-LOW (err u107))              ;; Provided amount does not meet a minimum requirement
(define-constant ERR-AMOUNT-TOO-HIGH (err u108))             ;; Provided amount exceeds a maximum limit
(define-constant ERR-STALE-ORACLE-PRICE (err u109))          ;; Oracle price data is considered too old to be reliable
(define-constant ERR-INVALID-EXPIRATION-HEIGHT (err u110))   ;; Expiration block height is invalid (e.g., in the past, too far future)
(define-constant ERR-TOKEN-TRANSFER-FAILED (err u111))       ;; An underlying SIP-010 token transfer operation failed
(define-constant ERR-INSUFFICIENT-TOKEN-BALANCE (err u112))  ;; Account has an insufficient balance of a specific token
(define-constant ERR-MAP-ITEM-NOT-FOUND (err u113))          ;; Expected item not found in a map
(define-constant ERR-INVALID-CALLER (err u114))              ;; tx-sender or contract-caller not authorized for a specific inter-contract call
(define-constant ERR-MAXIMUM-LIMIT-REACHED (err u115))       ;; A system or user-specific limit has been reached
(define-constant ERR-MINIMUM-REQUIREMENT-NOT-MET (err u116)) ;; A minimum condition or requirement was not satisfied
(define-constant ERR-INVALID-TOKEN-CONTRACT (err u117))      ;; Provided principal is not a valid/supported token contract
(define-constant ERR-ACTION-FORBIDDEN (err u118))            ;; A general forbidden action not covered by other errors
(define-constant ERR-INVALID-SIGNATURE (err u119))           ;; For future use with signed messages if needed
(define-constant ERR-DATA-MISMATCH (err u120))               ;; Input data or parameters are inconsistent

;; Error codes more specific to BitHedgeParametersContract (or commonly managed here)
(define-constant ERR-UNAUTHORIZED (err u1000))              ;; tx-sender is not authorized for this action (e.g. not CONTRACT_OWNER or role holder)
(define-constant ERR-ROLE-NOT-FOUND (err u1001))            ;; Specified role does not exist for the user or is not defined
(define-constant ERR-PARAMETER-NOT-FOUND (err u1002))       ;; System parameter ID not found
(define-constant ERR-FEE-TYPE-NOT-FOUND (err u1003))        ;; Fee type ID not found
(define-constant ERR-ALREADY-INITIALIZED (err u1004))       ;; Attempt to initialize something that is already initialized
(define-constant ERR-INVALID-PARAMETER-VALUE (err u1005))   ;; Value provided for a parameter is out of bounds or invalid type
(define-constant ERR-RISK-TIER-NOT-FOUND (err u1006))       ;; (Placeholder for PA-105) Risk tier definition not found
(define-constant ERR-ROLE-ALREADY-GRANTED (err u1007))      ;; Attempt to grant a role that is already active for the user
(define-constant ERR-CANNOT-REVOKE-OWN-ROLE (err u1008))    ;; For safety, if specific roles should not be self-revoked by certain principals

;; --- Data Structures (PA-101) ---

;; System parameters
;; Stores various system-wide numerical or flag-like parameters.
;; parameter-id: A unique string identifier for the parameter (e.g., "max-policy-duration", "oracle-staleness-threshold").
;; value: The numerical value of the parameter.
;; description: A human-readable description of what the parameter controls.
;; last-updated: The block height at which the parameter was last updated.
;; updater: The principal that last updated the parameter.
(define-map system-parameters
  { parameter-id: (string-ascii 64) } ;; Increased length for descriptive IDs
  {
    value-uint: (optional uint),         ;; For parameters that are unsigned integers
    value-bool: (optional bool),         ;; For parameters that are booleans
    value-principal: (optional principal), ;; For parameters that are principals
    value-string: (optional (string-ascii 64)), ;; For parameters that are strings
    description: (string-ascii 256),
    last-updated-height: uint,
    updater-principal: principal
  }
)

;; Fee structure stubs
;; Defines different types of fees within the system.
;; fee-type: A unique string identifier for the fee (e.g., "policy-creation-fee", "settlement-fee").
;; percentage: The fee percentage (e.g., u1000 for 1%).
;; min-amount: The minimum absolute fee amount.
;; max-amount: The maximum absolute fee amount.
;; recipient: The principal that receives this fee.
(define-map fee-structure
  { fee-type: (string-ascii 32) }
  {
    percentage-basis-points: uint, ;; e.g., 100 = 1% (100 / 10000)
    flat-min-amount: uint,
    flat-max-amount: uint,
    recipient-principal: principal,
    is-active: bool,
    description: (string-ascii 128),
    last-updated-height: uint,
    updater-principal: principal
  }
)

;; Authorized roles
;; Manages roles for different principals, granting them specific permissions.
;; principal: The address of the user or contract.
;; role: A string identifier for the role (e.g., "admin", "oracle-updater", "param-manager").
;; enabled: A boolean indicating if the role is active for the principal.
;; expiration: Optional block height at which the role expires for the principal.
(define-map authorized-roles
  { user-principal: principal, role-name: (string-ascii 32) }
  {
    is-enabled: bool,
    expiration-height: (optional uint), ;; Role can be permanent if none
    set-by-principal: principal,
    last-updated-height: uint
  }
)

;; (PA-105) Risk Tier Parameters
;; Defines parameters for different risk tiers, applicable to both buyers and liquidity providers.
;; tier-name: A unique string identifier for the risk tier (e.g., "CONSERVATIVE-PROVIDER", "STANDARD-BUYER").
;; tier-type: Indicates if the tier is for "BUYER" or "PROVIDER".
;; collateral-ratio-basis-points: For provider tiers, the collateral they must lock relative to protection amount (e.g., u11000 for 110%).
;; premium-adjustment-basis-points: Adjustment to the base premium based on the tier (e.g., u9500 for -5% premium, u10500 for +5%).
;; max-exposure-per-policy-basis-points: For provider tiers, the maximum percentage of their total capital that can be allocated to a single policy.
;; max-exposure-per-expiration-basis-points: For provider tiers, the maximum percentage of their total capital exposed to a single expiration height.
(define-map risk-tier-parameters
  { tier-name: (string-ascii 32) } ;; e.g., "CONSERVATIVE-P", "AGGRESSIVE-P", "STANDARD-B"
  {
    tier-type: (string-ascii 16), ;; "BUYER" or "PROVIDER"
    collateral-ratio-basis-points: uint, ;; e.g., u10000 for 100%. Primarily for PROVIDER tiers.
    premium-adjustment-basis-points: uint, ;; e.g., u10000 for no change. Can be for BUYER or PROVIDER.
    max-exposure-per-policy-basis-points: uint, ;; Primarily for PROVIDER tiers.
    max-exposure-per-expiration-basis-points: uint, ;; Primarily for PROVIDER tiers.
    is-active: bool,
    description: (string-ascii 256),
    last-updated-height: uint,
    updater-principal: principal
  }
)

;; --- Data Variables ---
;; (Potentially add a data-var to indicate if initial setup of crucial parameters is done)
(define-data-var contract-initialized-flag bool false)


;; --- Public Functions ---
;; (To be implemented in PA-102, PA-103)

;; PA-103: Role management functions
(define-public (grant-role (user principal) (role (string-ascii 32)) (expires-at (optional uint)))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (map-set authorized-roles
      { user-principal: user, role-name: role }
      {
        is-enabled: true,
        expiration-height: expires-at,
        set-by-principal: tx-sender,
        last-updated-height: burn-block-height
      }
    )
    (print {event: "role-granted", user: user, role: role, expires-at: expires-at})
    (ok true)
  )
)

(define-public (revoke-role (user principal) (role (string-ascii 32)))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (match (map-get? authorized-roles { user-principal: user, role-name: role })
      role-entry
        (if (get is-enabled role-entry)
          (begin
            (map-set authorized-roles
              { user-principal: user, role-name: role }
              (merge role-entry {
                is-enabled: false,
                last-updated-height: burn-block-height,
                set-by-principal: tx-sender ;; The one revoking it
              })
            )
            (print {event: "role-revoked", user: user, role: role})
            (ok true)
          )
          (ok true) ;; Already not enabled, consider it a successful no-op or return specific error/event
        )
      ;; No existing role entry, return error that matches the success return type
      (ok false) ;; Changed from (err ERR-ROLE-NOT-FOUND) to (ok false) to maintain consistent return type
    )
  )
)

;; PA-102: Set system parameters (protected access)
(define-public (set-system-parameter-uint (id (string-ascii 64)) (val uint) (desc (string-ascii 256)))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (map-set system-parameters { parameter-id: id }
      {
        value-uint: (some val),
        value-bool: none,
        value-principal: none,
        value-string: none,
        description: desc,
        last-updated-height: burn-block-height,
        updater-principal: tx-sender
      }
    )
    (ok true)
  )
)

(define-public (set-system-parameter-bool (id (string-ascii 64)) (val bool) (desc (string-ascii 256)))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (map-set system-parameters { parameter-id: id }
      {
        value-uint: none,
        value-bool: (some val),
        value-principal: none,
        value-string: none,
        description: desc,
        last-updated-height: burn-block-height,
        updater-principal: tx-sender
      }
    )
    (ok true)
  )
)

(define-public (set-system-parameter-principal (id (string-ascii 64)) (val principal) (desc (string-ascii 256)))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (map-set system-parameters { parameter-id: id }
      {
        value-uint: none,
        value-bool: none,
        value-principal: (some val),
        value-string: none,
        description: desc,
        last-updated-height: burn-block-height,
        updater-principal: tx-sender
      }
    )
    (ok true)
  )
)

(define-public (set-system-parameter-string (id (string-ascii 64)) (val (string-ascii 64)) (desc (string-ascii 256)))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (map-set system-parameters { parameter-id: id }
      {
        value-uint: none,
        value-bool: none,
        value-principal: none,
        value-string: (some val),
        description: desc,
        last-updated-height: burn-block-height,
        updater-principal: tx-sender
      }
    )
    (ok true)
  )
)


;; --- Read-Only Functions ---
;; (To be implemented in PA-102, PA-103)

;; PA-102: Get system parameters
(define-read-only (get-system-parameter (id (string-ascii 64)))
  (map-get? system-parameters { parameter-id: id })
)

(define-read-only (get-system-parameter-uint (id (string-ascii 64)))
  (match (map-get? system-parameters { parameter-id: id })
    param-entry (get value-uint param-entry)
    none ;; Parameter not found or not of this type implicitly
  )
)

(define-read-only (get-system-parameter-bool (id (string-ascii 64)))
  (match (map-get? system-parameters { parameter-id: id })
    param-entry (get value-bool param-entry)
    none
  )
)

(define-read-only (get-system-parameter-principal (id (string-ascii 64)))
  (match (map-get? system-parameters { parameter-id: id })
    param-entry (get value-principal param-entry)
    none
  )
)

(define-read-only (get-system-parameter-string (id (string-ascii 64)))
  (match (map-get? system-parameters { parameter-id: id })
    param-entry (get value-string param-entry)
    none
  )
)

;; PA-103: Role checking function
(define-read-only (has-role (user principal) (role (string-ascii 32)))
  (match (map-get? authorized-roles { user-principal: user, role-name: role })
    role-entry
    (if (get is-enabled role-entry)
      (match (get expiration-height role-entry)
        expiry
        (if (>= expiry burn-block-height) true false) ;; Role active if expiration is in the future or current block
        true ;; Role active if no expiration height is set (permanent until revoked)
      )
      false ;; Role is not enabled
    )
    false ;; Role not found for the user
  )
)

;; --- Private Functions ---


(print { message: "BitHedgeParametersContract.clar Phase 1: PA-101 - Core data structures defined." }) 