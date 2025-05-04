# BitHedge Hybrid Architecture Overview (MVP Focus)

**Version:** 1.0
**Date:** 2024-08-21
**Status:** Draft

## 1. Introduction

This document outlines the hybrid architectural approach for the BitHedge MVP, focusing on the interaction between off-chain services (primarily hosted on Convex) and on-chain smart contracts (Clarity on Stacks). The core principle guiding this architecture is **"On-Chain Light / Off-Chain Heavy"** to prioritize efficiency, cost-effectiveness, flexibility, and user experience while leveraging the blockchain for its essential trust and settlement capabilities.

The MVP scope centers around the core policy lifecycle involving the **Oracle**, **Policy Registry**, and **Liquidity Pool** components.

## 2. Architectural Principle: On-Chain Light / Off-Chain Heavy

- **On-Chain (Clarity/Stacks):** Serves as the trust anchor and settlement layer. Responsibilities are minimized to:

  - Storing essential, immutable state (e.g., policy ownership, core terms, vault balances).
  - Executing critical, atomic financial transactions (e.g., final settlement transfers, collateral locking/unlocking triggered by authorized sources).
  - Providing a minimal set of functions callable only by authorized principals (users for specific actions, backend system for others).
  - Emitting events to signal confirmed state changes.
  - _Contracts are designed for simplicity, security, and low gas cost._

- **Off-Chain (Convex):** Handles the bulk of the business logic, computation, data management, and user interaction orchestration. Responsibilities include:
  - Detailed data storage and indexing (policy metadata, provider accounting, historical data).
  - Complex calculations (premium pricing, yield accrual, risk modeling, collateral health checks).
  - User session management and authentication linkage.
  - Workflow orchestration (e.g., preparing transactions, validating inputs, coordinating multi-step processes).
  - Interaction with external services (e.g., Oracle APIs).
  - Serving data efficiently to the frontend UI.
  - Monitoring on-chain events and synchronizing off-chain state.
  - _The Convex backend prioritizes flexibility, scalability, and feature richness._

## 3. Architectural Layers & Flow

```mermaid
graph TD
    subgraph User Interface Layer
        UI[Frontend App (React/Next.js)]
    end

    subgraph Off-Chain Layer (Convex)
        CF[Convex Functions (Queries/Mutations)]
        CA[Convex Actions (Orchestration/Side Effects)]
        CS[Convex Scheduled Jobs (Cron)]
        CD[Convex Database (Tables: Policies, Providers, OracleData, etc.)]
        BL[Blockchain Integration Layer (Conceptual - within CA/Helpers)]
    end

    subgraph Blockchain Layer (Stacks)
        OC[Minimal Oracle Contract (.clar)]
        PR[Minimal Policy Registry Contract (.clar)]
        LP[Minimal Liquidity Pool Vault Contract (.clar)]
        PC[Minimal Parameter Contract (.clar)]
        SA[Stacks API Nodes]
    end

    UI -- Calls --> CF;
    UI -- Triggers --> CA;
    CF -- Reads --> CD;
    CA -- Reads/Writes --> CD;
    CA -- Calls --> BL;
    CA -- Reads/Writes --> CF;
    CS -- Triggers --> CA;
    BL -- Builds/Signs/Broadcasts Tx --> SA;
    BL -- Reads State/Monitors Events --> SA;
    SA -- Executes Tx --> OC;
    SA -- Executes Tx --> PR;
    SA -- Executes Tx --> LP;
    SA -- Executes Tx --> PC;
    OC -- Called by --> BL;
    PR -- Called by --> BL;
    LP -- Called by --> BL;
    PC -- Called by --> BL;
    PR -- Calls --> LP; %% Example interaction for settlement
```

**High-Level Flow:**

1.  **UI Interaction:** User interacts with the frontend.
2.  **Convex Queries/Actions:** UI fetches data via Convex queries and triggers business logic via Convex actions.
3.  **Off-Chain Logic:** Convex actions/functions perform calculations, validate data, update the Convex database, and interact with the Oracle.
4.  **Blockchain Integration:** For on-chain operations, Convex actions utilize the Blockchain Integration Layer.
5.  **Transaction Preparation:** The Integration Layer prepares the minimal Clarity transaction (payload).
6.  **Signing:**
    - **User Actions (Deposit, Withdraw, Buy Policy):** The payload/parameters are passed back to the UI, which prompts the user to sign via their connected wallet.
    - **System Actions (Settle, Expire, Lock Collateral):** The Integration Layer signs the transaction using the secure Backend Authorized Principal key.
7.  **Broadcast & Monitor:** The signed transaction is broadcast to the Stacks network via the Integration Layer, which then monitors for confirmation.
8.  **On-Chain Execution:** The Stacks network executes the transaction on the minimal smart contracts.
9.  **Event Emission:** Smart contracts emit events upon successful state change.
10. **State Synchronization:** The Integration Layer (potentially via event listeners or polling) detects confirmed events/state changes and triggers Convex actions/mutations to update the off-chain database, ensuring eventual consistency.

## 4. Core Component Responsibilities (MVP Hybrid Model)

- **Oracle:**

  - **Off-Chain (Convex):** Fetches data from multiple external APIs, performs aggregation/validation, calculates volatility, stores historical data, serves processed data to UI and other Convex services. Triggers on-chain updates based on threshold logic.
  - **On-Chain (`oracle.clar`):** Stores the latest validated _aggregated_ price and timestamp submitted by the authorized backend principal. Provides a simple `get-latest-price` function. Emits `PriceUpdated` event. (As detailed in `@docs/backend-new/smart-contract/oracle/oracle-integration-review-and-advisory.md`).

- **Policy Registry:**

  - **Off-Chain (Convex):** Manages full policy lifecycle state, metadata, indexing, premium calculation interface, activation condition checks (using Oracle data), expiration detection. Orchestrates on-chain interactions.
  - **On-Chain (`policy-registry.clar`):** Minimal state: policy ID, owner, counterparty (Pool Vault address), core immutable terms, essential status (Active, Settled, Expired). Restricted functions (`create-policy-entry`, `update-status`) callable by user (for creation via prepared Tx) or backend principal (for status updates). Emits core status change events.

- **Liquidity Pool:**

  - **Off-Chain (Convex):** Manages all provider accounting (balances per token/tier, deposits, withdrawals), risk tier logic, yield calculation/accrual, collateral health monitoring, policy backing allocation (virtual), preparation of deposit/withdrawal transactions. Calculates aggregate collateral requirements. Orchestrates on-chain interactions.
  - **On-Chain (`liquidity-pool.clar`):** Minimal Vault: Holds pooled STX and sBTC. Restricted functions (`deposit-to-pool`, `withdraw-from-pool`, `lock-collateral-aggregate`, `release-collateral-aggregate`, `settle-policy`) callable by user (for deposit/withdraw via prepared Tx) or backend principal (for lock/release/settle). Tracks only _total_ balances per token. Emits fund movement events.

- **Parameter Contract:**
  - **Off-Chain (Convex):** Reads parameters from the on-chain contract to use in its logic (e.g., collateral buffer checks, fee calculations).
  - **On-Chain (`parameter.clar`):** Stores essential, relatively static MVP parameters. Restricted `set-parameter` function for admin updates. Public `get-parameter` functions.

## 5. Conclusion

This hybrid architecture aims to provide a pragmatic balance for the BitHedge MVP. It minimizes expensive and complex on-chain operations while leveraging Convex for the heavy lifting of computation, data management, and orchestration. This approach facilitates faster development, lower operational costs, greater flexibility, and a better user experience, while still relying on the Stacks blockchain for core trust and settlement guarantees. Subsequent documentation will detail the specifics of each component within this framework.
