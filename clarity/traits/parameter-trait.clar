;; title: Parameter Trait
;; version: 2.0.0
;; summary: Defines the interface for fetching configuration parameters.
;; description: Contracts can implement this trait to provide parameters, 
;;              and other contracts can use it to fetch those parameters.

(define-trait parameter-trait
  (
    ;; @desc Retrieves the value of a specified parameter.
    ;; @param parameter-name: The name of the parameter to retrieve (string-ascii 50)
    ;; @returns (ok uint) or (err uint) if parameter not found.
    (get-parameter (parameter-name (string-ascii 50)) (response uint uint))
    
    ;; @desc Retrieves a system parameter as uint.
    ;; @param parameter-name: The name of the parameter to retrieve (string-ascii 64)
    ;; @returns (optional uint) - The parameter value or none if not found/wrong type
    (get-system-parameter-uint (parameter-name (string-ascii 64)) (response (optional uint) uint))
    
    ;; @desc Retrieves risk tier parameters for a specific tier.
    ;; @param tier-name: The name of the risk tier (string-ascii 32)
    ;; @returns (response risk-tier-parameters uint) - The risk tier parameters or error if not found
    (get-risk-tier-parameters (tier-name (string-ascii 32)) (response
      {
        tier-type: (string-ascii 16),
        collateral-ratio-basis-points: uint, 
        premium-adjustment-basis-points: uint,
        max-exposure-per-policy-basis-points: uint,
        max-exposure-per-expiration-basis-points: uint,
        is-active: bool,
        description: (string-ascii 256),
        last-updated-height: uint,
        updater-principal: principal
      } 
      uint))
    
    ;; @desc Checks if a user has a specific role.
    ;; @param user: The principal to check
    ;; @param role-name: The name of the role to check for (string-ascii 32)
    ;; @returns (bool) - True if user has the role, false otherwise
    (has-role (user principal) (role-name (string-ascii 32)) (response bool uint))
  )
) 