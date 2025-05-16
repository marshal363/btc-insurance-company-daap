# Oracle Integration Implementation Plan

## Overview

This implementation plan details the tasks required to build an efficient interface between the Convex off-chain oracle system and the on-chain smart contract layer for BitHedge. The goal is to minimize on-chain complexity while ensuring reliable price data availability for the entire contract ecosystem.

### Guiding Principles

1. **Off-Chain Computation**: Convex handles all complex calculations (premium modeling, volatility metrics, aggregation)
2. **Minimal On-Chain Storage**: Oracle.clar stores only essential data (current price, timestamp)
3. **Verification Over Calculation**: Math Library verifies submitted values rather than performing complex calculations
4. **Clear Interface Definition**: Well-defined interfaces between Convex and on-chain contracts
5. **Robust Error Handling**: Graceful failure modes when oracle data is unavailable or stale

## Implementation Phases

### Phase 1: Oracle Contract Refactoring

#### Core Oracle Contract (BitHedgePriceOracleContract)

| Task ID | Description                                                                                                              | Dependencies   | Complexity | Estimated Days | References                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------ | -------------- | ---------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| OC-101  | Define core data structures: `latest-price uint`, `latest-timestamp uint`, `authorized-submitter principal`              | None           | Low        | 0.5            | [@bithedge-oracle-specification-guidelines.md#3.1-Core-State-Variables]                                                                               |
| OC-102  | Define constants: `PRICE_DECIMALS`, error codes (`ERR-UNAUTHORIZED`, `ERR-PRICE-OUT-OF-BOUNDS`, `ERR-TIMESTAMP-TOO-OLD`) | OC-101         | Low        | 0.5            | [@bithedge-oracle-specification-guidelines.md#3.2-Constants]                                                                                          |
| OC-103  | Implement `set-parameters-contract-principal` function to establish connection to parameters contract                    | OC-101         | Low        | 0.5            | [@bithedge-oracle-specification-guidelines.md#3.8-Integration-Points]                                                                                 |
| OC-104  | Define `parameter-oracle-trait` for fetching configuration values from parameters contract                               | OC-103         | Medium     | 1              | [@bithedge-oracle-specification-guidelines.md#3.8-Integration-Points]                                                                                 |
| OC-105  | Implement `set-authorized-submitter` function (protected by CONTRACT-OWNER)                                              | OC-101         | Low        | 0.5            | [@bithedge-oracle-specification-guidelines.md#3.4-Public-Functions]                                                                                   |
| OC-106  | Implement `set-aggregated-price(price uint, timestamp uint)` function with authorization check                           | OC-101, OC-105 | Medium     | 1              | [@bithedge-oracle-specification-guidelines.md#3.4-Public-Functions]                                                                                   |
| OC-107  | Add price validation in `set-aggregated-price` using parameters from parameters contract                                 | OC-104, OC-106 | Medium     | 1.5            | [@bithedge-oracle-specification-guidelines.md#3.4-Public-Functions], [@BitHedge-Advanced-Clarity-Patterns.md#6.-Oracle-Security-and-Decentralization] |
| OC-108  | Implement `get-latest-price()` read-only function with staleness check                                                   | OC-101, OC-104 | Medium     | 1              | [@bithedge-oracle-specification-guidelines.md#3.5-Read-Only-Functions]                                                                                |
| OC-109  | Implement `get-bitcoin-price-at-height(height uint)` read-only function for settlement use cases                         | OC-101         | Medium     | 1              | [@bithedge-oracle-specification-guidelines.md#3.5-Read-Only-Functions]                                                                                |
| OC-110  | Add standardized event emission for price updates and admin changes                                                      | OC-106, OC-105 | Low        | 0.5            | [@BitHedge-Advanced-Clarity-Patterns.md#7.-Event-Emission-and-Off-Chain-Indexing]                                                                     |

#### Oracle Contract Tests

| Task ID | Description                                                 | Dependencies   | Complexity | Estimated Days | References                                                          |
| ------- | ----------------------------------------------------------- | -------------- | ---------- | -------------- | ------------------------------------------------------------------- |
| OCT-101 | Write unit tests for authorization and admin functions      | OC-105         | Low        | 0.5            | [@clarity-best-practices.md#Testing-Strategies#Unit-Testing]        |
| OCT-102 | Write unit tests for price setting with validation          | OC-106, OC-107 | Medium     | 1              | [@clarity-best-practices.md#Testing-Strategies#Unit-Testing]        |
| OCT-103 | Write unit tests for price retrieval with staleness checks  | OC-108, OC-109 | Medium     | 1              | [@clarity-best-practices.md#Testing-Strategies#Unit-Testing]        |
| OCT-104 | Write integration tests for Parameters Contract interaction | OC-104, OC-107 | Medium     | 1              | [@clarity-best-practices.md#Testing-Strategies#Integration-Testing] |

### Phase 2: Math Library Premium Verification Enhancement

#### Math Library Contract (BitHedgeMathLibraryContract)

| Task ID | Description                                                                                     | Dependencies   | Complexity | Estimated Days | References                                                                                |
| ------- | ----------------------------------------------------------------------------------------------- | -------------- | ---------- | -------------- | ----------------------------------------------------------------------------------------- |
| ML-201  | Refactor `verify-submitted-premium` to accept direct inputs: oracle price, risk tier parameters | None           | Medium     | 1.5            | [@bithedge-liquidity-premium-management.md#3.1-Premium-Calculation-Logic]                 |
| ML-202  | Enhance premium verification with bounds checking based on policy parameters                    | ML-201         | Medium     | 2              | [@bithedge-liquidity-premium-management.md#3.1-Premium-Calculation-Logic]                 |
| ML-203  | Implement premium floor and ceiling calculations based on risk tier                             | ML-202         | Medium     | 1.5            | [@bithedge-european-architecture-spec.md#3.1-Policy-Creation-Flow#Premium-recording-data] |
| ML-204  | Improve error handling with detailed error codes for different validation failures              | ML-202         | Low        | 1              | [@clarity-best-practices.md#1.-Standardized-Error-Handling]                               |
| ML-205  | Implement full settlement amount calculation logic for PUT options                              | None           | Medium     | 1.5            | [@bithedge-european-style-implementation.md#4.2-Settlement-Amount-Calculation]            |
| ML-206  | Implement full settlement amount calculation logic for CALL options                             | None           | Medium     | 1.5            | [@bithedge-european-style-implementation.md#4.2-Settlement-Amount-Calculation]            |
| ML-207  | Add validation checks in settlement calculation functions                                       | ML-205, ML-206 | Low        | 1              | [@clarity-best-practices.md#Essential-Best-Practices#4.-Safety-Mechanisms]                |

#### Math Library Tests

| Task ID | Description                                                       | Dependencies           | Complexity | Estimated Days | References                                                              |
| ------- | ----------------------------------------------------------------- | ---------------------- | ---------- | -------------- | ----------------------------------------------------------------------- |
| MLT-201 | Write unit tests for premium verification with various parameters | ML-201, ML-202, ML-203 | Medium     | 1.5            | [@clarity-best-practices.md#Testing-Strategies#Unit-Testing]            |
| MLT-202 | Write unit tests for PUT option settlement calculations           | ML-205                 | Medium     | 1              | [@clarity-best-practices.md#Testing-Strategies#Unit-Testing]            |
| MLT-203 | Write unit tests for CALL option settlement calculations          | ML-206                 | Medium     | 1              | [@clarity-best-practices.md#Testing-Strategies#Unit-Testing]            |
| MLT-204 | Write tests for edge cases (zero values, extreme premium values)  | ML-204                 | Medium     | 1              | [@clarity-best-practices.md#Testing-Strategies#Boundary-Value-Analysis] |

### Phase 3: Policy Registry Integration

#### Policy Registry Contract (BitHedgePolicyRegistryContract)

| Task ID | Description                                                          | Dependencies           | Complexity | Estimated Days | References                                                                                                                        |
| ------- | -------------------------------------------------------------------- | ---------------------- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| PR-201  | Update `create-protection-policy` to fetch current price from Oracle | OC-108                 | Medium     | 1.5            | [@bithedge-european-style-implementation.md#3.2-Policy-Creation]                                                                  |
| PR-202  | Add Oracle price freshness verification in policy creation           | PR-201                 | Medium     | 1              | [@BitHedge-Advanced-Clarity-Patterns.md#6.-Oracle-Security-and-Decentralization#Key-Recommendations]                              |
| PR-203  | Integrate refactored Math Library's `verify-submitted-premium`       | PR-201, ML-201         | Medium     | 1.5            | [@bithedge-european-style-implementation.md#3.2-Policy-Creation]                                                                  |
| PR-204  | Implement `process-single-policy-at-expiration` using Oracle price   | OC-109                 | High       | 2.5            | [@bithedge-european-style-implementation.md#3.5-Policy-Expiration-and-Settlement]                                                 |
| PR-205  | Integrate Math Library's settlement calculation in policy expiration | PR-204, ML-205, ML-206 | Medium     | 1.5            | [@bithedge-european-style-implementation.md#4.2-Settlement-Amount-Calculation]                                                    |
| PR-206  | Implement `process-expiration-batch` with shared Oracle price lookup | PR-204, PR-205         | High       | 2.5            | [@BitHedge-Advanced-Clarity-Patterns.md#1.-Expiration-Focused-Architecture-Implementation#Expiration-batch-processing-capability] |
| PR-207  | Add error handling for Oracle price unavailability                   | PR-201, PR-204         | Medium     | 1              | [@clarity-best-practices.md#Essential-Best-Practices#4.-Safety-Mechanisms]                                                        |
| PR-208  | Implement policy settlement call to LP for ITM policies              | PR-204, PR-205         | Medium     | 1.5            | [@modular-interactions.md#3.-Multi-Step-Process-Coordination]                                                                     |

#### Integration Tests

| Task ID | Description                                                          | Dependencies           | Complexity | Estimated Days | References                                                                     |
| ------- | -------------------------------------------------------------------- | ---------------------- | ---------- | -------------- | ------------------------------------------------------------------------------ |
| INT-101 | Write integration tests for policy creation with Oracle price checks | PR-201, PR-202, PR-203 | Medium     | 1.5            | [@modular-interactions.md#5.-Implementation-Example-Complete-Interaction-Flow] |
| INT-102 | Write integration tests for policy expiration and settlement         | PR-204, PR-205, PR-206 | High       | 2              | [@clarity-best-practices.md#Testing-Strategies#Integration-Testing]            |
| INT-103 | Write integration tests for Oracle price unavailability scenarios    | PR-207                 | Medium     | 1.5            | [@clarity-best-practices.md#Testing-Strategies#Scenario-Based-Testing]         |

### Phase 4: Convex Integration

#### Convex Blockchain Integration

| Task ID | Description                                                                    | Dependencies     | Complexity | Estimated Days | References                                                                     |
| ------- | ------------------------------------------------------------------------------ | ---------------- | ---------- | -------------- | ------------------------------------------------------------------------------ |
| CVX-101 | Update priceWriter.ts to support set-aggregated-price with timestamp parameter | OC-106           | Medium     | 1              | [@bithedge-oracle-specification-guidelines.md#4.3-Key-Functions-Modules]       |
| CVX-102 | Modify blockchainIntegration.ts to pass both price and timestamp data          | CVX-101          | Medium     | 1              | [@convex/blockchain/oracle/priceWriter.ts], [@convex/blockchainIntegration.ts] |
| CVX-103 | Add parameter contract configuration fetching capability in Convex             | OC-104, CVX-101  | Medium     | 1.5            | [@bithedge-oracle-specification-guidelines.md#3.8-Integration-Points]          |
| CVX-104 | Implement error handling for Oracle submission failures                        | CVX-101, CVX-102 | Medium     | 1.5            | [@clarity-best-practices.md#Essential-Best-Practices#4.-Safety-Mechanisms]     |
| CVX-105 | Add configuration for adaptive Oracle update frequency                         | CVX-102          | Medium     | 1              | [@bithedge-oracle-specification-guidelines.md#4.2-Submission-Policy]           |

#### Convex Testing

| Task ID  | Description                                                | Dependencies     | Complexity | Estimated Days | References                                                          |
| -------- | ---------------------------------------------------------- | ---------------- | ---------- | -------------- | ------------------------------------------------------------------- |
| CVXT-101 | Write unit tests for updated priceWriter.ts                | CVX-101          | Medium     | 1              | [@bithedge-oracle-specification-guidelines.md#4.4-Testing-Strategy] |
| CVXT-102 | Create end-to-end test for price submission with timestamp | CVX-101, CVX-102 | Medium     | 1.5            | [@bithedge-oracle-specification-guidelines.md#4.4-Testing-Strategy] |
| CVXT-103 | Test adaptive update frequency configuration               | CVX-105          | Medium     | 1              | [@bithedge-oracle-specification-guidelines.md#4.4-Testing-Strategy] |

## Phase Milestones

### Phase 1 Milestone

- Simplified Oracle contract implemented with essential data structures
- Parameter integration established for configuration
- Price submission and retrieval functions operational with proper validation
- Comprehensive test suite for Oracle contract

### Phase 2 Milestone

- Math Library premium verification logic refactored to work with direct inputs
- Settlement calculation functions implemented for PUT and CALL options
- Math Library test suite complete

### Phase 3 Milestone

- Policy Registry integration with Oracle complete
- Premium verification and settlement calculations properly integrated
- Policy creation and expiration processes use Oracle data with validation
- Integration tests demonstrating end-to-end workflows

### Phase 4 Milestone

- Convex integration updated to support the simplified Oracle interface
- End-to-end data flow from Convex to on-chain contracts established
- Adaptive update frequency implemented for efficient Oracle data submission

## Critical Implementation Details

### Oracle Contract Interface

```clarity
;; Key Public Functions
(define-public (set-aggregated-price (price uint) (timestamp uint))
  ;; Authorization, validation, and price update logic
)

(define-read-only (get-latest-price)
  ;; Return price and timestamp with staleness validation
  ;; Response: {price: uint, timestamp: uint}
)

(define-read-only (get-bitcoin-price-at-height (height uint))
  ;; Return price at or close to the specified height
  ;; Response: {price: uint, timestamp: uint}
)
```

### Math Library Premium Verification

```clarity
;; Premium Verification Function
(define-read-only (verify-submitted-premium
  (submitted-premium uint)
  (protected-value uint)
  (protection-amount uint)
  (current-oracle-price uint)
  (current-block-height uint)
  (expiration-height uint)
  (policy-type (string-ascii 32))
  (risk-tier-is-active bool)
  (risk-tier-premium-adjustment-bp uint))
  ;; Validation logic and bounds checking
)
```

### Oracle Data Flow

```
┌─────────────────────────┐             ┌──────────────────────┐
│    Convex (Off-Chain)   │             │  Oracle.clar (On-Chain) │
│                         │             │                      │
│  1. Collects price data │             │                      │
│  2. Aggregates sources  │   set-      │ 5. Validates price   │
│  3. Validates data      │ aggregated- │ 6. Stores price &    │
│  4. Prepares submission │─price()────▶│    timestamp         │
│                         │             │                      │
└─────────────────────────┘             └──────────────────────┘
                                                │
                                                │ get-latest-price()
                                                ▼
                                        ┌──────────────────────┐
                                        │ Policy Registry &    │
                                        │ Math Library         │
                                        │                      │
                                        │ - Policy creation    │
                                        │ - Premium validation │
                                        │ - Settlement calc    │
                                        └──────────────────────┘
```

## Risk Management

| Risk                                      | Probability | Impact | Mitigation                                                               |
| ----------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------ |
| Oracle price unavailable at critical time | Medium      | High   | Implement graceful failure modes, clear error messages, retry mechanisms |
| Stale price used for settlement           | Medium      | High   | Strict staleness checks, emergency circuit breakers, monitoring          |
| Convex-Oracle interface mismatch          | Medium      | Medium | Thorough testing, explicit interface documentation, version checking     |
| Math Library calculations incorrect       | Low         | High   | Comprehensive test suite, validation against off-chain calculations      |
| Premium verification too restrictive      | Medium      | Medium | Configurable bounds, adjust parameters based on market conditions        |

## Development Timeline

| Phase                                | Duration  | Cumulative |
| ------------------------------------ | --------- | ---------- |
| Phase 1: Oracle Contract Refactoring | 2 weeks   | 2 weeks    |
| Phase 2: Math Library Enhancement    | 2 weeks   | 4 weeks    |
| Phase 3: Policy Registry Integration | 2 weeks   | 6 weeks    |
| Phase 4: Convex Integration          | 1.5 weeks | 7.5 weeks  |

## Conclusion

This implementation plan provides a clear path to developing a minimal yet effective Oracle integration between Convex and the on-chain smart contract layer. By focusing on a streamlined interface with well-defined responsibilities, we ensure that complex calculations remain off-chain while the on-chain components focus on verification, validation, and core financial operations.

The approach minimizes gas costs, reduces on-chain complexity, and creates a more maintainable system. The phased implementation allows for focused development and testing of each component, ensuring a robust and reliable Oracle system for the BitHedge platform.
