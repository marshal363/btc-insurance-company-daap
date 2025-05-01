;; title: Parameter Oracle Implementation
;; version: 1.0.0
;; summary: Minimal implementation of parameter-trait for Oracle integration.
;; description: Stores and provides essential parameters needed by the simplified Oracle contract.

;; Import the trait definition from the separate file
(use-trait parameter-trait .parameter-trait.parameter-trait)

;; --- Trait Definition ---
;; REMOVED: Trait definition moved to traits/parameter-trait.clar
;; ;; Defines the interface expected by other contracts (like the Oracle)
;; ;; to fetch configuration parameters.
;; (define-trait parameter-trait
;;   (
;;     ;; @desc Retrieves the value of a specified parameter.
;;     ;; @param parameter-name: The name of the parameter to retrieve (string-ascii 50)
;;     ;; @returns (ok uint) or (err uint) if parameter not found.
;;     (get-parameter (parameter-name (string-ascii 50)) (response uint uint))
;;   )
;; )

;; Implements the parameter-trait defined in the separate trait file
(impl-trait .parameter-trait.parameter-trait)

;; --- Constants ---
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u200)) ;; Starting errors from u200 to avoid collision with Oracle
(define-constant ERR-PARAM-NOT-FOUND (err u201))

;; --- Data Storage ---
;; Simple map to store uint parameters by name
(define-map parameters
  { name: (string-ascii 50) }
  { value: uint }
)

;; --- Public Functions ---

;; @desc Sets the value for a specific parameter. Only callable by the contract owner.
;; @param name: The name of the parameter (e.g., "oracle-max-age-seconds")
;; @param value: The uint value to set.
;; @returns (ok bool) or (err uint)
(define-public (set-parameter (name (string-ascii 50)) (value uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (map-set parameters { name: name } { value: value })
    (print { event: "parameter-set", name: name, value: value })
    (ok true)
  )
)

;; --- Trait Implementation (Read-Only) ---

;; @desc Retrieves the value of a specified parameter.
;; Implements the get-parameter function required by the parameter-trait.
;; @param parameter-name: The name of the parameter to retrieve.
;; @returns (ok uint) or (err uint) if parameter not found.
(define-read-only (get-parameter (parameter-name (string-ascii 50)))
  (match (map-get? parameters { name: parameter-name })
    param-entry (ok (get value param-entry)) ;; Return (ok value)
    ERR-PARAM-NOT-FOUND ;; Return (err ERR-PARAM-NOT-FOUND)
  )
) 