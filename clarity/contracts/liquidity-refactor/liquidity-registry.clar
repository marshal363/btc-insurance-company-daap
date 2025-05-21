;; liquidity-registry.clar
;; Central registry for all liquidity pool system contracts

;; --- Error Constants ---
(define-constant ERR-UNAUTHORIZED (err u1001))
(define-constant ERR-CONTRACT-NOT-FOUND (err u1002))
(define-constant ERR-CONTRACT-INACTIVE (err u1003))
(define-constant ERR-INVALID-CONTRACT-TYPE (err u1004))

;; --- Contract Types ---
(define-constant CONTRACT-TYPE-CAPITAL "capital-manager")
(define-constant CONTRACT-TYPE-RISK "risk-manager")
(define-constant CONTRACT-TYPE-ALLOCATION "allocation-manager")
(define-constant CONTRACT-TYPE-SETTLEMENT "settlement-manager")
(define-constant CONTRACT-TYPE-PREMIUM "premium-manager")
(define-constant CONTRACT-TYPE-FACADE "liquidity-facade")

;; --- Data Structures ---

;; Contract registry to manage component contracts
(define-map contract-registry
  { contract-type: (string-ascii 32) }
  { 
    contract-principal: principal,
    version: (string-ascii 10),
    active: bool,
    last-updated: uint 
  }
)

;; Authorized contracts map
(define-map authorized-contracts
  { principal: principal }
  { authorized: bool }
)

;; --- Admin Management ---
(define-data-var registry-admin principal tx-sender)

;; --- Authorization Helper Functions ---

;; Check admin authorization
(define-private (is-admin)
  (is-eq tx-sender (var-get registry-admin))
)

;; Check if contract is authorized
(define-private (is-authorized-contract (caller principal))
  (default-to false (get authorized (map-get? authorized-contracts { principal: caller })))
)

;; --- Public Functions ---

;; Register a component contract
(define-public (register-contract 
    (contract-type (string-ascii 32))
    (contract-principal principal)
    (version (string-ascii 10))
  )
  (begin
    (asserts! (is-admin) ERR-UNAUTHORIZED)
    (asserts! (is-valid-contract-type contract-type) ERR-INVALID-CONTRACT-TYPE)
    
    ;; Update contract registry
    (map-set contract-registry
      { contract-type: contract-type }
      { 
        contract-principal: contract-principal,
        version: version,
        active: true,
        last-updated: burn-block-height 
      }
    )
    
    ;; Authorize the contract
    (map-set authorized-contracts
      { principal: contract-principal }
      { authorized: true }
    )
    
    (print {
      event: "contract-registered",
      contract-type: contract-type,
      principal: contract-principal,
      version: version
    })
    
    (ok true)
  )
)

;; Deactivate a component contract
(define-public (deactivate-contract (contract-type (string-ascii 32)))
  (begin
    (asserts! (is-admin) ERR-UNAUTHORIZED)
    
    (match (map-get? contract-registry { contract-type: contract-type })
      contract-data
        (begin
          ;; Deactivate in registry
          (map-set contract-registry
            { contract-type: contract-type }
            (merge contract-data { 
              active: false,
              last-updated: burn-block-height 
            })
          )
          
          ;; Remove authorization
          (map-set authorized-contracts
            { principal: (get contract-principal contract-data) }
            { authorized: false }
          )
          
          (print {
            event: "contract-deactivated",
            contract-type: contract-type,
            principal: (get contract-principal contract-data)
          })
          
          (ok true)
        )
      (err ERR-CONTRACT-NOT-FOUND)
    )
  )
)

;; Update registry admin
(define-public (set-registry-admin (new-admin principal))
  (begin
    (asserts! (is-admin) ERR-UNAUTHORIZED)
    (ok (var-set registry-admin new-admin))
  )
)

;; --- Read-Only Functions ---

;; Get a registered contract
(define-read-only (get-contract (contract-type (string-ascii 32)))
  (match (map-get? contract-registry { contract-type: contract-type })
    contract-data 
      (if (get active contract-data)
        (ok (get contract-principal contract-data))
        (err ERR-CONTRACT-INACTIVE))
    (err ERR-CONTRACT-NOT-FOUND)
  )
)

;; Check if a contract is registered and active
(define-read-only (is-contract-active (contract-type (string-ascii 32)))
  (match (map-get? contract-registry { contract-type: contract-type })
    contract-data (ok (get active contract-data))
    (err ERR-CONTRACT-NOT-FOUND)
  )
)

;; Get contract version
(define-read-only (get-contract-version (contract-type (string-ascii 32)))
  (match (map-get? contract-registry { contract-type: contract-type })
    contract-data (ok (get version contract-data))
    (err ERR-CONTRACT-NOT-FOUND)
  )
)

;; Check if a principal is an authorized contract
(define-read-only (is-authorized (principal-to-check principal))
  (default-to false (get authorized (map-get? authorized-contracts { principal: principal-to-check })))
)

;; Get registry admin
(define-read-only (get-registry-admin)
  (var-get registry-admin)
)

;; --- Private Helper Functions ---

;; Validate contract type
(define-private (is-valid-contract-type (contract-type (string-ascii 32)))
  (or
    (is-eq contract-type CONTRACT-TYPE-CAPITAL)
    (is-eq contract-type CONTRACT-TYPE-RISK)
    (is-eq contract-type CONTRACT-TYPE-ALLOCATION)
    (is-eq contract-type CONTRACT-TYPE-SETTLEMENT)
    (is-eq contract-type CONTRACT-TYPE-PREMIUM)
    (is-eq contract-type CONTRACT-TYPE-FACADE)
  )
)
