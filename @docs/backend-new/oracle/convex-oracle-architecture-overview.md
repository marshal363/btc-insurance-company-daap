# BitHedge Hybrid Oracle & Premium Calculator: Architecture Overview

## 1. Introduction

This document defines the architectural guidelines for implementing the BitHedge Bitcoin Oracle and Premium Calculator using a hybrid approach that leverages Convex as the primary computation platform with minimal on-chain components. This architecture optimizes for performance, cost-efficiency, security, and maintainability while ensuring the system remains trustless for critical settlement operations.

## 2. System Philosophy

The BitHedge Oracle and Premium Calculator follow these core design principles:

1. **Computational Efficiency**: Perform complex, resource-intensive calculations off-chain using Convex
2. **Minimal On-Chain Footprint**: Keep on-chain contracts focused, simple, and gas-efficient
3. **Trust Minimization**: Ensure critical protocol decisions remain verifiable and transparent
4. **Rapid Iteration**: Enable quick improvements to off-chain components without requiring contract upgrades
5. **Data Availability**: Maintain comprehensive historical data off-chain for analytics and verification
6. **Security By Design**: Implement multiple validation layers across both off-chain and on-chain components

## 3. High-Level Architecture

The hybrid architecture consists of the following major components:

```
┌─────────────────────────────────────────────────────────┐
│                    CONVEX PLATFORM                       │
│                                                          │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐    │
│  │   Price     │   │ Aggregation │   │ Premium     │    │
│  │   Feeds     │──>│    Engine   │──>│ Calculator  │    │
│  └─────────────┘   └─────────────┘   └─────────────┘    │
│         │                 │                │            │
│         │                 │                │            │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐    │
│  │ Historical  │   │ Blockchain  │   │ Simulation  │    │
│  │ Data Store  │<──│ Integration │   │   Engine    │    │
│  └─────────────┘   └─────────────┘   └─────────────┘    │
│                          │                              │
└──────────────────────────┼──────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│               STACKS BLOCKCHAIN LAYER                     │
│                                                           │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐     │
│  │   Oracle    │   │  Parameter  │   │   Policy    │     │
│  │  Contract   │──>│  Contract   │──>│  Registry   │     │
│  └─────────────┘   └─────────────┘   └─────────────┘     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 3.1 Convex Components

1. **Price Feeds Interface**: Collects price data from multiple external exchanges and APIs
2. **Aggregation Engine**: Processes and validates price data using statistical methods
3. **Premium Calculator**: Implements financial models for option pricing
4. **Historical Data Store**: Maintains comprehensive price history and calculated metrics
5. **Blockchain Integration**: Handles communication with on-chain contracts
6. **Simulation Engine**: Models various market scenarios for premium calculation and risk assessment

### 3.2 On-Chain Components

1. **Oracle Contract**: Stores verified price data from Convex with minimal validation logic
2. **Parameter Contract**: Maintains system parameters accessible to all contracts
3. **Policy Registry**: Manages policy lifecycle and integrates with the Oracle

## 4. Data Flow Overview

The system operates with the following primary data flows:

### 4.1 Oracle Data Flow

1. **Price Collection (Convex)**

   - Multiple price feeds fetch BTC price from external sources (e.g., Binance, Coinbase, Kraken)
   - Price data is normalized and stored in the Convex data store

2. **Price Aggregation (Convex)**

   - Statistical methods filter outliers and aggregate valid prices
   - Confidence scores are calculated based on source agreement
   - Volatility metrics are computed using historical data
   - Results are stored in Convex with full history

3. **On-Chain Oracle Updates (Convex → Blockchain)**

   - Aggregated prices meeting quality thresholds trigger on-chain updates
   - Convex builds and submits transactions to the Oracle Contract
   - Updates include price, timestamp, confidence score, and source count

4. **Price Verification (Blockchain)**
   - Oracle Contract performs basic validation (e.g., deviation limits)
   - Verified prices become available to other on-chain contracts
   - Events are emitted for tracking and monitoring

### 4.2 Premium Calculation Flow

1. **Premium Request (User → Convex)**

   - User requests premium calculation via frontend
   - Request parameters include protected value, expiration, amount, and policy type

2. **Premium Calculation (Convex)**

   - Latest price data is retrieved from Convex data store
   - Volatility and other market metrics are calculated or retrieved
   - Financial models (e.g., Black-Scholes) compute base premium
   - Bitcoin-specific adjustments are applied
   - Results are returned with detailed factor breakdown

3. **Policy Creation (User → Blockchain)**
   - User initiates policy creation with premium information
   - Oracle Contract provides price data for on-chain verification
   - Policy Registry Contract validates and stores policy details

## 5. System Boundaries & Integration Points

### 5.1 Internal Integration Points

1. **Convex to Oracle Contract**

   - Regularly scheduled price updates
   - Event monitoring for synchronization

2. **Oracle Contract to Policy Registry**

   - Price data for policy creation validation
   - Price data for policy activation/settlement

3. **Convex to Frontend**
   - Real-time price feeds
   - Premium calculation results
   - Historical data and analytics

### 5.2 External Integration Points

1. **Price Feed APIs**

   - Multiple exchange REST APIs
   - WebSocket feeds for real-time updates
   - Market data providers

2. **Market Data Services**
   - Historical volatility data
   - Bitcoin network statistics
   - Macro market indicators

## 6. Trust Assumptions & Security Boundaries

The system is designed with the following trust model:

1. **Trustless Components**

   - On-chain settlement logic
   - Final price verification
   - Policy activation conditions

2. **Trust-Minimized Components**

   - Price aggregation algorithm
   - Multi-source consensus mechanism
   - Premium calculation formula
   - Circuit breaker mechanisms

3. **Required Trust Components**
   - External price feed accuracy
   - Convex backend operational security
   - Proper key management for on-chain updates

## 7. Related Documents

For detailed implementation guidelines, refer to:

1. [Convex Oracle Implementation Guidelines](convex-oracle-implementation-guidelines.md)
2. [Convex Premium Calculator Guidelines](convex-premium-calculator-guidelines.md)
3. [Convex-to-Blockchain Integration Patterns](convex-blockchain-integration-guidelines.md)
4. [Oracle Contract Specification](oracle-contract-specification.md)

## 8. Conclusion

This hybrid architecture maximizes the strengths of both Convex and blockchain environments, achieving:

1. **Performance**: Offloading computation-heavy operations to Convex
2. **Cost Efficiency**: Minimizing on-chain transactions and storage
3. **Flexibility**: Enabling rapid iteration on pricing models and algorithms
4. **Security**: Maintaining trustless verification of critical data points
5. **Data Richness**: Preserving comprehensive historical data off-chain

By following these architectural guidelines, BitHedge can deliver a robust, efficient oracle and premium calculation system that balances performance, cost, and security needs for the platform.
