# BitHedge Hybrid Architecture Overview

## 1. Introduction

This document outlines the hybrid architecture for the BitHedge platform, with a specific focus on the "On-Chain Light" approach for the Policy Registry and Liquidity Pool components. This architecture leverages the strengths of both on-chain (Clarity smart contracts on Stacks) and off-chain (Convex backend) systems to create a scalable, gas-efficient, and maintainable platform.

## 2. Architectural Principles

The BitHedge hybrid architecture follows these core principles:

1. **On-Chain Light**: Maintain minimal, essential state on-chain while moving complex logic, indexing, and derived calculations off-chain.
2. **Trust Boundaries**: On-chain contracts serve as the ultimate source of truth for ownership, core terms, and financial transactions.
3. **Computation Efficiency**: Complex computations (risk calculations, yield distribution, query indexing) happen off-chain in Convex.
4. **Cross-Layer Synchronization**: Convex serves as the coordination layer, maintaining off-chain state and orchestrating on-chain transactions.
5. **Non-Custodial Operations**: User funds move directly between user wallets and on-chain contracts, with users signing all transactions involving their funds.

## 3. System Components Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                            UI LAYER                                  │
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │ PolicySummary   │    │ BitcoinPriceCard│    │ ProviderIncome  │  │
│  │ (Buyer UI)      │    │ (Oracle UI)     │    │ Summary         │  │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘  │
│           │                      │                      │           │
└───────────┼──────────────────────┼──────────────────────┼───────────┘
            │                      │                      │
            ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        CONVEX LAYER (Off-Chain)                      │
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │ Policy Registry │    │ Oracle Service  │    │ Liquidity Pool  │  │
│  │ Service         │    │                 │    │ Service         │  │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘  │
│           │                      │                      │           │
│  ┌────────┴────────┐    ┌────────┴────────┐    ┌────────┴────────┐  │
│  │ Policy DB       │    │ Price History DB│    │ Provider DB     │  │
│  │ - Full metadata │    │ - Price data    │    │ - Balances      │  │
│  │ - Indices       │    │ - Volatility    │    │ - Risk tiers    │  │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘  │
│           │                      │                      │           │
│           └──────────────────────┼──────────────────────┘           │
│                                  │                                  │
│  ┌───────────────────────────────┴───────────────────────────────┐  │
│  │               Blockchain Integration Layer                     │  │
│  │ - Transaction preparation                                      │  │
│  │ - Signing (user-prompted or backend)                          │  │
│  │ - Transaction monitoring                                       │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
│                              │                                      │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        BLOCKCHAIN LAYER (On-Chain)                   │
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │ Policy Registry │    │ Oracle          │    │ Liquidity Pool  │  │
│  │ Contract        │    │ Contract        │    │ Vault Contract  │  │
│  │ - Core terms    │    │ - Price data    │    │ - Pooled funds  │  │
│  │ - Ownership     │    │ - Authority     │    │ - Auth functions│  │
│  │ - Status        │    │                 │    │                 │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    Parameter Contract                           ││
│  │ - System configuration values                                   ││
│  │ - Admin-controlled updates                                      ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

## 4. Component Responsibilities

### 4.1 Policy Registry

#### On-Chain (Minimal):

- Store core policy data: policy ID, owner, counterparty, terms (strike, expiry, amount, type)
- Track essential policy status (Active, Exercised, Expired)
- Validate ownership for user-triggered actions
- Expose restricted functions for authorized system actions
- Emit events for off-chain synchronization

#### Off-Chain (Convex):

- Store detailed policy metadata and history
- Maintain indices for efficient querying (by owner, expiry, status)
- Calculate derived metrics (e.g., potential settlement value)
- Orchestrate policy creation, activation, and expiration flows
- Prepare on-chain transactions for user signature or backend execution
- Monitor and reconcile on-chain and off-chain state

### 4.2 Liquidity Pool

#### On-Chain (Minimal Vault):

- Store pooled funds (STX, sBTC)
- Track total balance per token type
- Accept deposits directly from users
- Process withdrawals to authorized recipients
- Lock/release aggregate collateral for policies
- Execute settlements to policy owners upon activation
- Restrict sensitive functions to authorized callers

#### Off-Chain (Convex):

- Track individual provider balances and metadata
- Manage risk tier assignment and virtual allocation
- Calculate yield distribution from premiums
- Monitor collateral health and enforce withdrawal limits
- Orchestrate deposit, withdrawal, and settlement flows
- Prepare on-chain transactions
- Maintain comprehensive activity history

### 4.3 Blockchain Integration Layer

This layer, internal to Convex, is responsible for:

- Building properly formatted transactions for Stacks blockchain
- Managing the Backend Authorized Principal's private key
- Monitoring transaction status and confirmation
- Listening for relevant contract events
- Handling network-specific concerns (nonce management, fee estimation)

## 5. Critical Data Flows

### 5.1 Policy Creation Flow

1. User (Buyer) initiates policy creation via UI
2. UI calls Convex action (actions.policies.requestPolicyCreation)
3. Convex:
   - Validates parameters against Oracle data and Parameter contract
   - Calculates premium and required collateral
   - Verifies sufficient pool liquidity
   - Prepares on-chain transaction (premium payment + policy registration)
   - Returns transaction details to UI
4. UI prompts user to sign transaction
5. User signs; transaction is submitted to blockchain
6. On-chain contracts:
   - Premium transferred to Liquidity Pool Vault
   - Policy registered in Policy Registry
   - Events emitted
7. Convex detects events, updates off-chain state
8. UI receives confirmation, updates display

### 5.2 Capital Commitment Flow

1. User (Provider) initiates capital commitment via UI
2. UI calls Convex action (actions.liquidity.requestCommitCapital)
3. Convex:
   - Validates commitment amount and risk tier
   - Prepares on-chain deposit transaction
   - Returns transaction details to UI
4. UI prompts user to sign transaction
5. User signs; transaction is submitted to blockchain
6. On-chain Vault:
   - Accepts deposit
   - Emits deposit event
7. Convex detects event, updates provider's off-chain balance
8. UI receives confirmation, updates display

### 5.3 Policy Activation Flow

1. User (Buyer) initiates policy activation via UI
2. UI calls Convex action (actions.policies.requestActivation)
3. Convex:
   - Verifies policy ownership and status
   - Checks activation conditions vs. Oracle price
   - Calculates settlement amount
   - Prepares on-chain transaction
   - Returns transaction details to UI
4. UI prompts user to sign transaction
5. User signs; transaction is submitted to blockchain
6. On-chain contracts:
   - Policy Registry updates status
   - Liquidity Pool Vault transfers settlement
   - Events emitted
7. Convex detects events, updates off-chain state
8. UI receives confirmation, updates display

### 5.4 Policy Expiration Flow (Automated)

1. Convex scheduled job identifies expired policies
2. Convex action prepares on-chain transaction
3. Blockchain Integration Layer signs transaction using Backend Authorized Principal
4. Transaction is submitted to blockchain
5. On-chain contracts:
   - Policy Registry updates status
   - Liquidity Pool Vault releases collateral
   - Events emitted
6. Convex detects events, updates off-chain state
7. UI reflects updated policy status on next view

## 6. Security Considerations

### 6.1 Trust Model

- User funds always move directly between user wallets and on-chain contracts
- Users must sign any transaction involving their funds
- Backend Authorized Principal has limited capabilities:
  - Cannot withdraw user funds
  - Cannot transfer policy ownership
  - Limited to status updates and aggregate collateral management

### 6.2 Backend Authorized Principal

- Highly privileged identity for system operations
- Key stored securely in Convex environment
- Used only for specific restricted functions:
  - Policy status updates upon expiration
  - Settlement confirmation
  - Aggregate collateral management

### 6.3 State Synchronization

- Off-chain state depends on reliably processing on-chain events
- Critical operations have clear transaction status monitoring
- Error handling for failed transactions prevents silent inconsistencies

## 7. Protocol Parameter Management

The Parameter Contract serves as a centralized configuration store for the system:

- Minimal parameters stored on-chain (e.g., collateral ratios, duration limits)
- Only updatable by admin (contract deployer) in MVP
- Accessed by both on-chain contracts and off-chain Convex logic
- Provides consistency across the system

## 8. Future Extensibility

This hybrid architecture is designed to support future extensions:

- **Enhanced Governance**: Parameter updates can transition from admin-only to governed
- **P2P Marketplace**: Can be added as a new on-chain contract and corresponding Convex service
- **Advanced Risk Models**: Can be implemented primarily in Convex with minimal on-chain changes

## 9. Development Guidelines

When implementing this hybrid architecture:

1. Always start by clearly defining the on-chain/off-chain responsibility split for any new feature
2. Minimize on-chain state and computation to reduce gas costs
3. Ensure all on-chain events needed by off-chain logic are well-defined
4. Implement proper error handling for failed transactions
5. Maintain consistent decimal handling across all layers

## 10. Token Handling and Standards

### 10.1 Token Standards

- STX: Native token handling via `stx-transfer?` functions
- sBTC: Implemented as SIP-010 Fungible Token standard
  - Requires proper `ft-transfer?` calls and trait conformance
  - Pool contract must handle both token types appropriately

### 10.2 Decimal Conventions

- **STX**: 6 decimal places (micro-STX, μSTX)
- **sBTC**: 8 decimal places (satoshis, sats)
- **USD**: 8 decimal places for internal calculations

All on-chain storage, Convex calculations, and cross-layer communication MUST use these base units for consistency. UI components are responsible for appropriate conversion to human-readable formats.

## 11. Event Emission Standards

### 11.1 Policy Registry Events

```clarity
;; Policy Creation
(print {
  event: "policy-created",
  policy-id: uint,
  owner: principal,
  counterparty: principal,
  expiration-height: uint,
  protected-value: uint,
  protected-amount: uint,
  policy-type: (string-ascii 4),
  premium: uint
})

;; Status Updates
(print {
  event: "policy-status-updated",
  policy-id: uint,
  new-status: uint,  ;; 0=Active, 1=Exercised, 2=Expired
  previous-status: uint,
  block-height: uint
})
```

### 11.2 Liquidity Pool Vault Events

```clarity
;; Deposit
(print {
  event: "funds-deposited",
  depositor: principal,
  amount: uint,
  token: principal  ;; Contract address for sBTC, 'STX' for native STX
})

;; Withdrawal
(print {
  event: "funds-withdrawn",
  withdrawer: principal,
  amount: uint,
  token: principal
})

;; Collateral Management
(print {
  event: "collateral-locked",
  policy-id: uint,
  amount-locked: uint,
  token: principal
})

(print {
  event: "collateral-released",
  policy-id: uint,
  amount-released: uint,
  token: principal
})

;; Settlement
(print {
  event: "settlement-paid",
  policy-id: uint,
  buyer: principal,
  settlement-amount: uint,
  token: principal
})
```

## 12. Deployment and Initialization

The deployment process for the minimal contracts follows this sequence:

1. Deploy Parameter Contract

   - Initialize with default parameters for the system
   - Set admin principal (contract deployer)

2. Deploy Oracle Contract

   - Already exists, but may need updates for integration
   - Set authorized price submitters

3. Deploy Policy Registry Contract

   - Initialize with Backend Authorized Principal
   - Link to Parameter Contract address

4. Deploy Liquidity Pool Vault Contract

   - Initialize with Backend Authorized Principal
   - Link to Parameter Contract address
   - Configure supported tokens (STX, sBTC)

5. Fund Backend Authorized Principal
   - Provide sufficient STX for gas to perform system operations
   - Document funding requirements and monitoring approach

## 13. Operational Considerations

### 13.1 Monitoring and Alerting

- Monitor Backend Authorized Principal's STX balance for gas
- Track failed transactions and reconciliation needs
- Monitor policy lifecycle events for operational anomalies

### 13.2 Performance Optimization

- Batch processing for expirations where possible
- Efficient event monitoring with appropriate indexing
- Caching of frequently accessed on-chain data in Convex

### 13.3 Backup and Recovery

- Document procedure for reconciling off-chain state with on-chain truth
- Regular backups of Convex database
- Clear process for handling missed events

## 14. Conclusion

The "On-Chain Light" hybrid architecture balances blockchain security and trust with off-chain flexibility and efficiency. By placing minimal state on-chain and leveraging Convex for complex logic and orchestration, BitHedge can deliver a scalable, cost-effective platform while maintaining the non-custodial principles essential for DeFi applications.

This approach directly addresses the concerns regarding gas costs and complexity identified in the existing Clarity contract implementations, while providing a clear path for the MVP focused on Oracle, Policy Registry, and Liquidity Pool functionalities.

The architecture enables a modular, progressive development approach where each component can be built and tested incrementally, while maintaining a coherent system design that separates concerns appropriately between on-chain and off-chain responsibilities.
