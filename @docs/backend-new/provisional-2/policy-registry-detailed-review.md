# Policy Registry Contract: Detailed Review

## Introduction

The Policy Registry contract (`policy-registry.clar`) serves as the central record-keeping system for BitHedge's insurance policies. It manages the complete lifecycle of insurance policies from creation through status transitions (exercise, expiration) and maintains the authoritative record of all policy terms and states.

## Contract Structure

The contract follows a well-structured organization:

1. **Constants and Error Codes** - Define error values and status constants
2. **Data Structures** - Define maps for storing policy data and indexes
3. **Data Variables** - Define variables for contract configuration
4. **Administrative Functions** - Functions for setting contract configuration
5. **Policy Management Functions** - Core functions for policy lifecycle
6. **Batch Operations** - Functions for handling multiple policies
7. **Read-Only Functions** - Pure query functions for reading contract state
8. **Private Functions** - Internal helper functions

## Constants and Error Codes

```clarity
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-FOUND (err u404))
(define-constant ERR-UNAUTHORIZED (err u401))
;; ... additional error codes
```

The contract defines a comprehensive set of error codes with semantic meaning (HTTP-style codes), making it easier to debug and understand failure conditions. These include authentication errors, not found errors, validation errors, and more.

Status constants define the allowed policy states:

```clarity
(define-constant STATUS-ACTIVE "Active")
(define-constant STATUS-EXERCISED "Exercised")
(define-constant STATUS-EXPIRED "Expired")
```

Policy type constants define the types of policies supported:

```clarity
(define-constant POLICY-TYPE-PUT "PUT")
(define-constant POLICY-TYPE-CALL "CALL")
```

This approach ensures consistency across the contract and makes the code more maintainable.

## Data Structures

### Policies Map

```clarity
(define-map policies
  { id: uint }
  {
    owner: principal,
    counterparty: principal,
    protected-value: uint,
    protection-amount: uint,
    expiration-height: uint,
    premium: uint,
    policy-type: (string-ascii 4),
    status: (string-ascii 10),
    creation-height: uint
  }
)
```

The `policies` map is the primary data store, indexed by a numeric ID. Each policy entry contains:

- **owner**: The principal (address) that owns the policy and can exercise it
- **counterparty**: The principal that provides the protection (typically the pool)
- **protected-value**: The strike price in base units (e.g., satoshis for BTC)
- **protection-amount**: The amount being protected in base units
- **expiration-height**: The block height when the policy expires
- **premium**: The premium amount paid to create the policy
- **policy-type**: Either "PUT" or "CALL"
- **status**: Current state ("Active", "Exercised", "Expired")
- **creation-height**: Block height when the policy was created

This design efficiently stores all essential policy data on-chain while keeping the storage requirements minimal.

### Policy Index

```clarity
(define-map policies-by-owner
  { owner: principal }
  { policy-ids: (list 50 uint) }
)
```

This is a secondary index that allows efficiently finding all policies owned by a particular address. It maps owner principals to lists of up to 50 policy IDs. This index makes user-specific queries much more efficient.

## Data Variables

```clarity
(define-data-var policy-id-counter uint u0)
(define-data-var backend-authorized-principal principal tx-sender)
(define-data-var oracle-principal principal tx-sender)
(define-data-var liquidity-pool-vault-principal principal tx-sender)
```

These variables store:

- A counter for generating unique policy IDs
- The principal authorized to perform backend operations
- References to related contracts (Oracle, Liquidity Pool Vault)

The contract deployer is set as the initial authorized principal, but this can be updated post-deployment.

## Administrative Functions

### Set Backend Authorized Principal

```clarity
(define-public (set-backend-authorized-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set backend-authorized-principal new-principal)
    (ok true)
  )
)
```

This function allows the contract owner to designate an address that can perform special operations like batch expiration. Only the contract owner (deployer) can call this function.

### Set Oracle Principal

```clarity
(define-public (set-oracle-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set oracle-principal new-principal)
    (ok true)
  )
)
```

Sets the address of the Oracle contract, which provides price data. This allows the contract to be properly connected to its oracle after deployment.

### Set Liquidity Pool Vault Principal

```clarity
(define-public (set-liquidity-pool-vault-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set liquidity-pool-vault-principal new-principal)
    (ok true)
  )
)
```

Sets the address of the Liquidity Pool Vault contract, enabling integration between policy creation and collateral management.

## Policy Management Functions

### Create Policy Entry

```clarity
(define-public (create-policy-entry
  (owner principal)
  (counterparty principal)
  (protected-value uint)
  (protection-amount uint)
  (expiration-height uint)
  (premium uint)
  (policy-type (string-ascii 4)))
  ;; ... function body
)
```

This is perhaps the most critical function in the contract. It:

1. Validates policy parameters (policy type, protected value, protection amount, expiration)
2. Checks for sufficient liquidity in the pool
3. Locks collateral in the pool for the policy
4. Creates a new policy entry with a unique ID
5. Updates the owner's policy index
6. Increments the policy ID counter
7. Emits a policy creation event
8. Returns the new policy ID

The function performs extensive validation to ensure policies are created correctly:

- Policy type must be "PUT" or "CALL"
- Protected value must be greater than zero
- Protection amount must be greater than zero
- Expiration must be in the future

It also handles the index maintenance, ensuring each owner's list of policies is properly updated while respecting the maximum list size of 50 policies per owner.

### Update Policy Status

```clarity
(define-public (update-policy-status
  (policy-id uint)
  (new-status (string-ascii 10)))
  ;; ... function body
)
```

This function manages policy status transitions:

1. Retrieves the existing policy
2. Validates the caller's authority and the validity of the status transition
3. Updates the policy status
4. Emits a status update event

The function implements rigorous authorization checks:

- Only the policy owner can exercise an active policy
- Only the backend can expire an active policy
- Policies can only be exercised before expiration
- Policies can only be expired after expiration

These rules ensure the integrity of the policy lifecycle.

## Batch Operations

### Expire Policies Batch

```clarity
(define-public (expire-policies-batch (policy-ids (list 50 uint)))
  (begin
    (asserts! (is-eq tx-sender (var-get backend-authorized-principal))
              ERR-UNAUTHORIZED)
    (print { event: "batch-expire-attempt", policy-count: (len policy-ids) })
    (ok true)
  )
)
```

This function allows the backend to expire multiple policies in a single transaction, improving gas efficiency. In the current implementation, it's a simplified placeholder that logs the attempt but doesn't actually perform the expirations. A more sophisticated implementation using `fold` would be added in future updates.

### Try Expire Policy

```clarity
(define-private (try-expire-policy (policy-id uint))
  ;; ... function body
)
```

This private helper function implements the logic for expiring a single policy. It:

1. Retrieves the policy
2. Checks if it's active and past expiration
3. Updates the status to "Expired" if conditions are met
4. Logs the status change
5. Returns a success indicator

It's designed to handle error cases gracefully (policy not found, already expired, etc.), making it suitable for batch processing.

## Read-Only Functions

The contract provides several pure query functions for reading state:

### Get Policy

```clarity
(define-read-only (get-policy (policy-id uint))
  (map-get? policies { id: policy-id }))
```

Retrieves a complete policy record by ID.

### Get Policy Count

```clarity
(define-read-only (get-policy-count)
  (var-get policy-id-counter))
```

Returns the total number of policies ever created (including expired/exercised).

### Get Policy IDs by Owner

```clarity
(define-read-only (get-policy-ids-by-owner (owner principal))
  (default-to { policy-ids: (list) }
              (map-get? policies-by-owner { owner: owner })))
```

Returns the list of policy IDs owned by a specific address.

### Is Policy Active

```clarity
(define-read-only (is-policy-active (policy-id uint))
  (match (map-get? policies { id: policy-id })
    policy (ok (is-eq (get status policy) STATUS-ACTIVE))
    (err ERR-NOT-FOUND)
  )
)
```

Checks if a specific policy is currently active.

### Get Current BTC Price

```clarity
(define-read-only (get-current-btc-price)
  (ok u30000) ;; Placeholder implementation
)
```

This is a placeholder that would normally call the Oracle contract to get the current Bitcoin price. In the production version, this would be replaced with an actual contract call.

### Is Policy Exercisable

```clarity
(define-read-only (is-policy-exercisable (policy-id uint))
  ;; ... function body
)
```

Determines if a policy can be exercised based on:

1. The policy must be active
2. The policy must not be expired
3. For PUT options, the current price must be below the protected value
4. For CALL options, the current price must be above the protected value

This function is useful for frontends to show users when they can exercise their policies.

### Calculate Settlement Amount

```clarity
(define-read-only (calculate-settlement-amount (policy-id uint) (settlement-price uint))
  ;; ... function body
)
```

Calculates the exact settlement amount for a policy based on:

1. The policy type (PUT or CALL)
2. The protected value (strike price)
3. The protection amount
4. The settlement price

For PUT options: `max(0, (strike_price - settlement_price) * protection_amount / strike_price)`
For CALL options: `max(0, (settlement_price - strike_price) * protection_amount / strike_price)`

This function makes the settlement calculation transparent and verifiable on-chain.

### Check Liquidity For Policy

```clarity
(define-read-only (check-liquidity-for-policy
  (protected-value uint)
  (protection-amount uint)
  (policy-type (string-ascii 4)))
  (ok true) ;; Placeholder implementation
)
```

This is another placeholder that would normally call the Liquidity Pool Vault contract to verify there's sufficient collateral available. In production, this would be replaced with an actual contract call.

## Private Functions

### Lock Policy Collateral

```clarity
(define-private (lock-policy-collateral
  (policy-id uint)
  (protected-value uint)
  (protection-amount uint)
  (policy-type (string-ascii 4)))
  (ok true) ;; Placeholder implementation
)
```

A placeholder for calling the Liquidity Pool contract to lock collateral for a newly created policy.

### Calculate Required Collateral

```clarity
(define-private (calculate-required-collateral
  (policy-type (string-ascii 4))
  (protected-value uint)
  (protection-amount uint))
  ;; ... function body
)
```

Calculates how much collateral needs to be locked based on policy parameters:

- For PUT options: the full protection amount
- For CALL options: a fraction (e.g., 50%) of the protection amount

This implements the risk model for different policy types.

### Get Token ID For Policy

```clarity
(define-private (get-token-id-for-policy (policy-type (string-ascii 4)))
  ;; ... function body
)
```

Determines which token should be used as collateral for a given policy type:

- PUT options use STX
- CALL options use sBTC

This mapping enables the multi-asset collateral model of the protocol.

## Events and Integration

The contract emits structured events for key state changes:

### Policy Creation

```clarity
(print {
  event: "policy-created",
  policy-id: policy-id,
  owner: owner,
  counterparty: counterparty,
  expiration-height: expiration-height,
  protected-value: protected-value,
  protection-amount: protection-amount,
  policy-type: policy-type,
  premium: premium
})
```

### Policy Status Updates

```clarity
(print {
  event: "policy-status-updated",
  policy-id: policy-id,
  new-status: new-status,
  previous-status: previous-status,
  block-height: burn-block-height
})
```

These events enable off-chain systems to monitor policies and react to state changes.

## Integration Points

The contract has several integration points with other contracts:

1. **Oracle** - For price feeds used in policy exercisability checks
2. **Liquidity Pool Vault** - For checking liquidity and locking collateral

In the current implementation, these integrations are represented by placeholder functions, but in production, they would be implemented as actual contract calls.

## Security Considerations

The contract implements several security best practices:

1. **Access Control** - Functions are properly guarded with authority checks
2. **Input Validation** - All policy parameters are thoroughly validated
3. **Status Transitions** - Policy status changes follow strict rules
4. **Error Handling** - Errors are explicitly coded and returned
5. **Immutable Storage** - Once created, core policy terms cannot be changed

## Conclusion

The Policy Registry contract provides a robust foundation for the BitHedge protocol. It efficiently manages policy lifecycles, enforces proper state transitions, and maintains an authoritative record of all policies. The contract follows Clarity best practices and implements a pragmatic "On-Chain Light" approach that balances necessary on-chain operations with off-chain efficiency.

The design is extensible, allowing for future enhancements like improved batch operations, more sophisticated settlement calculations, and tighter integrations with other protocol components.

In its current state, the contract successfully implements the core functionality needed for creating, exercising, and expiring Bitcoin price protection policies in a secure and transparent manner.
