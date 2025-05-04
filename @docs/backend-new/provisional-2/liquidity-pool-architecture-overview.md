# BitHedge Liquidity Pool: Architecture Overview

## 1. Introduction

This document provides a high-level overview of the Liquidity Pool architecture in the BitHedge platform. Following the "On-Chain Light" approach described in the hybrid architecture overview, the Liquidity Pool manages capital from providers, allocates collateral to policies, processes settlements, and distributes yield.

## 2. Architecture Principles

The Liquidity Pool follows these key architectural principles:

1. **Capital Security**: User funds are always held in on-chain contracts, never in off-chain custody
2. **Minimal On-Chain State**: Only essential financial data and authorization information stored on-chain
3. **Off-Chain Risk Management**: Complex risk calculations and provider allocation tracking managed off-chain
4. **Verifiable Operations**: All fund movements fully auditable and authorized
5. **Economic Efficiency**: Optimized gas usage through batched operations and minimal on-chain computation

## 3. Component Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                           UI LAYER                                │
│                                                                   │
│  ┌────────────────────┐                 ┌─────────────────────┐   │
│  │  ProviderIncome    │                 │  PolicySummary      │   │
│  │  Summary           │                 │  (Buyer UI)         │   │
│  │  (Provider UI)     │                 │                     │   │
│  └──────────┬─────────┘                 └─────────┬───────────┘   │
│             │                                     │               │
└─────────────┼─────────────────────────────────────┼───────────────┘
              │                                     │
              ▼                                     ▼
┌───────────────────────────────────────────────────────────────────┐
│                         CONVEX LAYER                              │
│                                                                   │
│  ┌────────────────────┐                 ┌─────────────────────┐   │
│  │  Liquidity Pool    │                 │  Policy Registry    │   │
│  │  Service           │◄────────────────►  Service            │   │
│  │                    │                 │                     │   │
│  └──────────┬─────────┘                 └─────────────────────┘   │
│             │                                                     │
│  ┌──────────┴─────────┐                 ┌─────────────────────┐   │
│  │  Provider DB       │                 │  Oracle Service     │   │
│  │  - Balances        │                 │                     │   │
│  │  - Risk tiers      │◄────────────────►                     │   │
│  │  - Yield tracking  │                 │                     │   │
│  └──────────┬─────────┘                 └─────────────────────┘   │
│             │                                                     │
│  ┌──────────┴─────────┐                                           │
│  │  Blockchain        │                                           │
│  │  Integration Layer │                                           │
│  │                    │                                           │
│  └──────────┬─────────┘                                           │
│             │                                                     │
└─────────────┼─────────────────────────────────────────────────────┘
              │
              ▼
┌───────────────────────────────────────────────────────────────────┐
│                      BLOCKCHAIN LAYER                             │
│                                                                   │
│  ┌────────────────────┐                 ┌─────────────────────┐   │
│  │  Liquidity Pool    │                 │  Policy Registry    │   │
│  │  Vault Contract    │◄────────────────►  Contract           │   │
│  │  - Pooled funds    │                 │                     │   │
│  │  - Auth functions  │                 │                     │   │
│  └────────────────────┘                 └─────────────────────┘   │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## 4. Component Responsibilities

### 4.1 On-Chain (Minimal Vault Contract)

The on-chain Liquidity Pool Vault is deliberately minimal, focused on:

1. **Fund Custody**: Securely holds deposited STX and sBTC tokens
2. **Deposit/Withdrawal**: Processes token movements in/out of the pool
3. **Collateral Management**: Locks/releases aggregate collateral for policies
4. **Settlement Execution**: Transfers funds to policy owners upon activation
5. **Authorization Control**: Limits sensitive operations to authorized callers

### 4.2 Off-Chain (Convex Service)

The Convex Liquidity Pool Service manages the complex business logic:

1. **Provider Tracking**: Maintains detailed records of individual provider balances
2. **Risk Management**: Assigns risk tiers and virtual allocation to policies
3. **Yield Calculation**: Computes provider earnings from premium payments
4. **Transaction Orchestration**: Prepares and monitors on-chain transactions
5. **Analytics and Reporting**: Provides performance metrics and exposure data

## 5. Key Data Flows

### 5.1 Capital Commitment Flow

1. Provider initiates capital commitment via UI
2. Convex prepares deposit transaction
3. User signs transaction to transfer funds to Vault
4. Convex records provider's contribution in off-chain database
5. Convex updates risk capacity and available collateral metrics

### 5.2 Capital Withdrawal Flow

1. Provider requests withdrawal via UI
2. Convex calculates available balance (considering locked collateral)
3. Convex prepares withdrawal transaction
4. User signs transaction to withdraw funds from Vault
5. Convex updates provider's balance and overall pool capacity

### 5.3 Settlement Flow

1. Policy activation triggers settlement request
2. Vault transfers settlement amount to policy owner
3. Convex records settlement against affected providers
4. Convex updates collateral allocations and yield calculations

## 6. Hybrid Architecture Benefits

The hybrid approach provides significant advantages for the Liquidity Pool:

1. **Security**: Funds always on-chain, secured by blockchain consensus
2. **Flexibility**: Complex allocation rules can be updated without contract migrations
3. **Cost Efficiency**: Minimized on-chain operations reduce gas costs
4. **User Experience**: Rich analytics and reporting without blockchain constraints
5. **Scalability**: Pool can support many providers without excessive on-chain storage

## 7. Next Steps

This overview will be supplemented by detailed specifications for:

1. **Convex Liquidity Pool Service Architecture**: Detailed off-chain implementation
2. **Liquidity Pool Vault Contract Specification**: On-chain minimal implementation
3. **Liquidity Pool Component Interaction Flows**: Detailed interaction diagrams
4. **Liquidity Pool Risk Model**: Allocation and risk tier management
