;; title: Parameter Trait
;; version: 1.0.0
;; summary: Defines the interface for fetching configuration parameters.
;; description: Contracts can implement this trait to provide parameters, 
;;              and other contracts can use it to fetch those parameters.

(define-trait parameter-trait
  (
    ;; @desc Retrieves the value of a specified parameter.
    ;; @param parameter-name: The name of the parameter to retrieve (string-ascii 50)
    ;; @returns (ok uint) or (err uint) if parameter not found.
    (get-parameter (parameter-name (string-ascii 50)) (response uint uint))
  )
) 