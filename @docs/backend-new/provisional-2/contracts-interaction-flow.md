# BitHedge Contract Interaction Flow

## Introduction

This document provides a comprehensive analysis of the interaction patterns between the Policy Registry and Liquidity Pool Vault contracts in the BitHedge platform. Understanding these interactions is crucial for developers working on the system, as they form the backbone of the platform's functionality.

The contracts follow a clear separation of concerns:

- **Policy Registry**: Manages policy data and lifecycle
- **Liquidity Pool Vault**: Manages funds, collateral, and settlements

However, these contracts must work together seamlessly to provide a complete insurance solution. This document details how they interact throughout different phases of the policy lifecycle.

## Contract Integration Points

Both contracts maintain references to each other:

```clarity
;; In Policy Registry:
(define-data-var liquidity-pool-vault-principal principal tx-sender)

;; In Liquidity Pool Vault:
(define-data-var policy-registry-principal principal tx-sender)
```

These references allow the contracts to call each other's public functions when necessary. The integration is set up during deployment and initialization with the following calls:

```clarity
;; In Policy Registry deployment:
(contract-call? .policy-registry set-liquidity-pool-vault-principal 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.liquidity-pool-vault)

;; In Liquidity Pool Vault deployment:
(contract-call? .liquidity-pool-vault set-policy-registry-principal 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.policy-registry)
```

## Policy Lifecycle Interactions

The contracts interact during several key phases of the policy lifecycle:

### 1. Policy Creation Phase

When a user creates a new policy, the following interactions occur:

```
┌───────────────┐           ┌───────────────────┐           ┌──────────────────┐
│               │           │                   │           │                  │
│     User      ├──────────►│   Policy Registry ├──────────►│ Liquidity Pool   │
│               │ Creates   │                   │ Checks    │ Vault            │
│               │ Policy    │                   │ Liquidity │                  │
└──────┬────────┘           └─────────┬─────────┘           └─────────┬────────┘
       │                              │                               │
       │                              │                               │
       │                              │   Confirms Available Liquidity│
       │                              │◄──────────────────────────────┘
       │                              │
       │                              │
       │                              │
       │                              ▼
       │                    ┌─────────────────┐
       │                    │                 │
       │                    │  Create Policy  │
       │                    │                 │
       │                    └────────┬────────┘
       │                             │
       │                             │
       │                             ▼
       │                    ┌─────────────────┐           ┌──────────────────┐
       │                    │                 │           │                  │
       │                    │ Event: Policy   ├──────────►│ Lock Collateral  │
       │                    │ Created         │           │                  │
       │                    │                 │           │                  │
       └────────────────────┤ Return Policy ID│           └──────────────────┘
                            │                 │
                            └─────────────────┘
```

#### Sequence of Events:

1. User calls `create-policy-entry` on the Policy Registry
2. Policy Registry calls `check-liquidity-for-policy` on the Liquidity Pool Vault
3. If sufficient liquidity exists, Policy Registry creates the policy
4. Policy Registry calls `lock-policy-collateral` which triggers the Vault to lock funds
5. Policy Registry returns the policy ID to the user

In the current implementation, steps 2 and 4 are placeholder functions that would be replaced with actual contract calls in production.

#### Code Flow:

```clarity
;; 1. User calls Policy Registry
(contract-call? .policy-registry create-policy-entry
  'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB
  'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
  u45000 u50000000 u2500 u1500 "PUT")

;; 2. Inside Policy Registry:
(asserts! (unwrap! (check-liquidity-for-policy protected-value protection-amount policy-type) (err u502))
          ERR-INSUFFICIENT-LIQUIDITY)

;; 3. If successful:
(unwrap! (lock-policy-collateral policy-id protected-value protection-amount policy-type) (err u503))

;; 4. Following the event notification, backend calls Liquidity Pool Vault:
(contract-call? .liquidity-pool-vault lock-collateral "STX" u2500 u0)
```

The authorization flow is crucial here:

- Users can directly create policies in the Policy Registry
- Only the authorized backend principal can lock collateral in the Vault
- The backend reacts to policy creation events to manage collateral

### 2. Policy Exercise Phase

When a policy owner exercises their policy, the following interactions occur:

```
┌───────────────┐           ┌───────────────────┐           ┌──────────────────┐
│               │           │                   │           │                  │
│ Policy Owner  ├──────────►│   Policy Registry ├──────────►│ Update Policy    │
│               │ Exercises │                   │           │ Status           │
│               │ Policy    │                   │           │                  │
└──────┬────────┘           └─────────┬─────────┘           └─────────┬────────┘
       │                              │                               │
       │                              │                               │
       │                              │                               │
       │                              │                               │
       │                              │                               ▼
       │                              │                     ┌─────────────────┐
       │                              │                     │                 │
       │                              │                     │ Event: Status   │
       │                              │                     │ Updated         │
       │                              │                     │                 │
       │                              │                     └────────┬────────┘
       │                              │                              │
       │                              │                              │
       │                              │                              │
       │                              │                              ▼
       │                              │                     ┌──────────────────┐
       │                              │                     │                  │
       │                              │                     │ Backend          │
       │                              │                     │ Recognizes Event │
       │                              │                     │                  │
       │                              │                     └────────┬─────────┘
       │                              │                              │
       │                              │                              ▼
       │                              │                     ┌──────────────────┐
       │                              │                     │                  │
       │                              │                     │ Calculate        │
       │                              │                     │ Settlement       │
       │                              │                     │                  │
       │                              │                     └────────┬─────────┘
       │                              │                              │
       │                              │                              ▼
       │                              │                     ┌──────────────────┐
       │                              │                     │                  │
       │                              │                     │ Pay Settlement   │
       │                              │                     │                  │
       │                              │                     └────────┬─────────┘
       │                              │                              │
       │                              │                              ▼
       │                              │                     ┌──────────────────┐
       │                              │                     │                  │
       │                              │                     │ Release          │
       │                              │                     │ Collateral       │
       │                              │                     │                  │
       └──────────────────────────────┼─────────────────────┴──────────────────┘
                                      │
                                      ▼
                              ┌──────────────────┐
                              │                  │
                              │ Settlement       │
                              │ Complete         │
                              │                  │
                              └──────────────────┘
```

#### Sequence of Events:

1. Policy owner calls `update-policy-status` on the Policy Registry with status "Exercised"
2. Policy Registry validates ownership and policy eligibility
3. Policy Registry updates the status and emits an event
4. The backend (monitoring events) calls `pay-settlement` on the Liquidity Pool Vault
5. The backend then calls `release-collateral` on the Liquidity Pool Vault

#### Code Flow:

```clarity
;; 1. Policy owner calls Policy Registry
(contract-call? .policy-registry update-policy-status u0 "exercised")

;; 2. Inside Policy Registry, validation occurs:
(asserts!
  (and (is-eq tx-sender current-owner)
       (is-eq previous-status STATUS-ACTIVE)
       (is-eq new-status STATUS-EXERCISED)
       (< burn-block-height expiration))
  ERR-UNAUTHORIZED)

;; 3. Following the event notification, backend calls Liquidity Pool Vault:
(contract-call? .liquidity-pool-vault pay-settlement "STX" u12500000 'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB u1)

;; 4. Then backend releases collateral:
(contract-call? .liquidity-pool-vault release-collateral "STX" u25000000 u1)
```

The two-step process (pay settlement and then release collateral) provides an important safety mechanism. It ensures that:

1. Funds are delivered to the policy owner
2. Accounting for locked collateral is updated accurately

### 3. Policy Expiration Phase

When a policy expires, the following interactions occur:

```
┌───────────────┐           ┌───────────────────┐           ┌──────────────────┐
│               │           │                   │           │                  │
│    Backend    ├──────────►│   Policy Registry ├──────────►│ Update Policy    │
│               │ Expires   │                   │           │ Status           │
│               │ Policy    │                   │           │                  │
└───────────────┘           └─────────┬─────────┘           └─────────┬────────┘
                                      │                               │
                                      │                               │
                                      │                               │
                                      │                               │
                                      │                               ▼
                                      │                     ┌─────────────────┐
                                      │                     │                 │
                                      │                     │ Event: Status   │
                                      │                     │ Updated         │
                                      │                     │                 │
                                      │                     └────────┬────────┘
                                      │                              │
                                      │                              │
                                      │                              │
                                      │                              ▼
                                      │                     ┌──────────────────┐
                                      │                     │                  │
                                      │                     │ Backend          │
                                      │                     │ Recognizes Event │
                                      │                     │                  │
                                      │                     └────────┬─────────┘
                                      │                              │
                                      │                              ▼
                                      │                     ┌──────────────────┐
                                      │                     │                  │
                                      │                     │ Release          │
                                      │                     │ Collateral       │
                                      │                     │                  │
                                      │                     └──────────────────┘
```

#### Sequence of Events:

1. Backend calls `update-policy-status` on the Policy Registry with status "Expired"
2. Policy Registry validates the caller and that the policy is past expiration
3. Policy Registry updates the status and emits an event
4. The backend calls `release-collateral` on the Liquidity Pool Vault

#### Code Flow:

```clarity
;; 1. Backend calls Policy Registry
(contract-call? .policy-registry update-policy-status u2 "expired")

;; 2. Inside Policy Registry, validation occurs:
(asserts!
  (and (is-eq tx-sender (var-get backend-authorized-principal))
       (is-eq previous-status STATUS-ACTIVE)
       (is-eq new-status STATUS-EXPIRED)
       (>= burn-block-height expiration))
  ERR-UNAUTHORIZED)

;; 3. Following the event notification, backend calls Liquidity Pool Vault:
(contract-call? .liquidity-pool-vault release-collateral "SBTC" u50000 u2)
```

The Policy Registry contract also supports batch expiration with the `expire-policies-batch` function, which would be followed by individual collateral release operations.

## Read-Only Interactions

In addition to the state-changing interactions described above, there are several read-only interactions between the contracts:

### Liquidity Check for Policy Creation

```clarity
;; In Policy Registry:
(define-read-only (check-liquidity-for-policy
  (protected-value uint)
  (protection-amount uint)
  (policy-type (string-ascii 4)))
  ;; This would call the Liquidity Pool Vault in production
  (ok true)
)

;; In Liquidity Pool Vault:
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
```

This interaction ensures that policies are only created when there's sufficient liquidity available in the pool to back them.

### Policy Verification for Settlement

```clarity
;; In Liquidity Pool Vault:
(define-private (verify-policy-active (policy-id uint))
  ;; This would call the Policy Registry in production
  (ok true)
)

;; In Policy Registry:
(define-read-only (is-policy-active (policy-id uint))
  (match (map-get? policies { id: policy-id })
    policy (ok (is-eq (get status policy) STATUS-ACTIVE))
    (err ERR-NOT-FOUND)
  )
)
```

This interaction verifies that policies are in the correct state before operations like settlement are performed.

## Authorization Model

A critical aspect of the contract interactions is the authorization model:

1. Only the policy owner can exercise a policy
2. Only the backend authorized principal can expire policies
3. Only the backend authorized principal can lock/release collateral
4. Only the backend authorized principal can process settlements

This model ensures that:

- Users maintain control over their policies
- The backend can automate operations like expiration and settlement
- Funds in the Liquidity Pool are protected from unauthorized access

Both contracts use the same pattern for setting the authorized principal:

```clarity
(define-data-var backend-authorized-principal principal tx-sender)

(define-public (set-backend-authorized-principal (new-principal principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set backend-authorized-principal new-principal)
    (ok true)
  )
)
```

This ensures that only the contract owner can designate who has backend privileges.

## Event-Driven Communication

The contracts use events (via the `print` function) to facilitate communication with off-chain systems. Key events include:

### Policy Registry Events:

```clarity
;; Policy Creation
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

;; Status Update
(print {
  event: "policy-status-updated",
  policy-id: policy-id,
  new-status: new-status,
  previous-status: previous-status,
  block-height: burn-block-height
})
```

### Liquidity Pool Vault Events:

```clarity
;; Collateral Locked
(print { event: "collateral-locked", policy-id: policy-id, amount-locked: amount, token: token-id })

;; Collateral Released
(print { event: "collateral-released", policy-id: policy-id, amount-released: amount, token: token-id })

;; Settlement Paid
(print { event: "settlement-paid", policy-id: policy-id, buyer: recipient, settlement-amount: settlement-amount, token: token-id })
```

The Convex backend monitors these events and orchestrates follow-up actions, forming a bridge between the two contracts and providing the full functionality of the system.

## Implementation Considerations

The current implementation uses placeholder functions for some cross-contract calls to avoid circular dependencies during development. In a production implementation:

1. The placeholder functions would be replaced with actual contract calls
2. All relevant error handling would be implemented
3. The contracts would be deployed in a specific order
4. Integration tests would verify the complete flow

## Security and Trust Model

The interaction between the contracts follows several security principles:

1. **Minimal Trust** - The contracts don't blindly trust each other; they validate inputs
2. **Defense in Depth** - Multiple checks ensure operations occur in the correct order
3. **Explicit Authorization** - All sensitive operations require verification of caller identity
4. **Clear State Transitions** - Policy lifecycle states follow a strict sequence
5. **Segregation of Duties** - Policy status and fund management are separated

These principles ensure that even if one contract is compromised, the damage is limited.

## Conclusion

The interaction between the Policy Registry and Liquidity Pool Vault contracts forms the backbone of the BitHedge platform. Through a combination of direct contract calls, event monitoring, and backend orchestration, the system provides a secure and efficient implementation of cryptocurrency price protection.

The "On-Chain Light" approach strikes a balance between security and efficiency:

- Essential data and state transitions are stored/executed on-chain
- Complex orchestration and metadata are managed off-chain
- Events bridge the gap between on-chain and off-chain components

This architecture ensures that the critical financial operations are secured by the blockchain while minimizing gas costs and maximizing flexibility.
