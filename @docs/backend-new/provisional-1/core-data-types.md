# Core Data Types and Conventions

**Version:** 1.0
**Date:** 2024-08-21
**Status:** Draft

## 1. Introduction

This document defines critical shared data structures (Data Transfer Objects - DTOs) and data representation conventions used across the BitHedge platform layers (UI, Convex Backend, On-Chain Contracts). Adhering to these definitions is essential for ensuring consistency, preventing errors, and facilitating communication between different parts of the system.

## 2. Decimal Conventions (CRITICAL)

Clarity smart contracts operate on unsigned integers (`uint`). To represent fractional values like token amounts or percentages, a fixed-decimal convention **MUST** be strictly followed across all layers.

- **STX (Stacks Token):**

  - **Base Unit:** micro-STX (ustx)
  - **Decimals:** 6
  - **Representation:** All `uint` values representing STX amounts in Clarity contracts, Convex internal logic, database storage, and API payloads **MUST** be in micro-STX.
  - **UI:** The frontend is responsible for converting ustx to/from user-friendly STX representations using functions like `ustxToStx` and `stxToUstx` (ref: `currency-utils.ts`).

- **sBTC (Stacks Bitcoin - SIP-010):**

  - **Base Unit:** satoshis (sats)
  - **Decimals:** 8
  - **Representation:** All `uint` values representing sBTC amounts in Clarity contracts, Convex internal logic, database storage, and API payloads **MUST** be in satoshis.
  - **UI:** The frontend is responsible for converting sats to/from user-friendly sBTC representations using functions like `satsToSbtc` and `btcToSats` (ref: `currency-utils.ts`).

- **USD (United States Dollar - Off-Chain Representation):**

  - **Base Unit:** Cents or higher precision (e.g., 1/10000th of a dollar) for internal calculations if needed, but **on-chain contracts should generally avoid direct USD representation**.
  - **Decimals:** For internal Convex calculations requiring high precision (e.g., intermediate premium calculation steps), use standard number types or consider a fixed-point library. For storing USD _estimates_ in Convex DB or transferring informational USD values via API, define a consistent precision (e.g., **use 8 decimals** to match BTC - store value as `usdValue * 10^8`).
  - **Representation:** Clarity contracts **SHOULD NOT** store primary financial values in USD due to its off-chain nature. Use STX or sBTC equivalents based on Oracle prices at the time of transaction.
  - **UI:** The frontend uses standard currency formatters (`usdFormatter`) for display.

- **Percentages:**
  - **Representation:** When representing percentages as `uint` (e.g., in Clarity parameters or specific Convex storage), use a fixed scaling factor. **Recommend using 6 decimals**, meaning 1% = `u10000`, 100% = `u1000000`. Clearly document the scaling factor wherever used.
  - **Convex/UI:** Standard number representations (e.g., 0.01 for 1%) are preferred in TypeScript code. Convert to/from the `uint` scaled representation only when interacting with or storing data meant for Clarity.

**Consistency is paramount. All developers MUST adhere to these base unit conventions.**

## 3. Core Data Transfer Objects (DTOs)

These are conceptual structures representing data passed between layers. Specific implementations (e.g., TypeScript interfaces, Convex schema types) should align with these definitions.

**3.1. Policy Parameters (UI -> Convex Action `requestPolicyCreation`)**

```typescript
interface PolicyParametersInput {
  policyType: "PUT"; // MVP focus
  protectionBuyerPrincipal: string; // Stacks address (implicitly from ctx.auth)
  protectedAmountSats: bigint; // Amount of BTC to protect in Satoshis
  protectedValueUSD_8Decimals: bigint; // Strike price in USD (scaled by 10^8)
  durationDays: number; // Requested duration in days
  // Premium calculation will happen in Convex based on these inputs & market data
}
```

**3.2. Provider Contribution (UI -> Convex Action `requestCommitCapital`)**

```typescript
interface ProviderContributionInput {
  providerPrincipal: string; // Stacks address (implicitly from ctx.auth)
  amountBaseUnits: bigint; // Amount in ustx or sats
  token: "STX" | "sBTC"; // The token being deposited
  riskTier: "Conservative" | "Balanced" | "Aggressive"; // Selected risk tier
}
```

**3.3. Minimal On-Chain Policy Data (Stored in `policy-registry.clar`)**

```typescript
// Conceptual representation of map-set structure
{
  policyId: uint,
  owner: principal, // Protective Peter
  counterparty: principal, // Liquidity Pool Vault Address
  protectedValuePriceFeedUnits: uint, // Strike price in Oracle's price feed units (e.g., USD with 8 decimals)
  protectedAmountSats: uint, // Amount in Satoshis
  expirationHeight: uint, // Block height
  policyType: (string-ascii 4), // "PUT"
  status: uint // 0=Active, 1=Settled, 2=Expired
}
```

**3.4. Minimal On-Chain Vault State (Stored in `liquidity-pool.clar`)**

```typescript
// Conceptual representation of data-vars
{
  totalUstxBalance: uint,
  totalSatsBalance: uint,
  // Optional: Consider total locked amounts if needed for simple checks
  // totalUstxLocked: uint,
  // totalSatsLocked: uint,
}
```

_Note: Individual provider balances, locked amounts, and tier data are NOT stored on-chain._

## 4. Key On-Chain Event Payloads

These structures define the data emitted via `(print ...)` in the minimal Clarity contracts, consumed by the off-chain Blockchain Integration Layer.

**4.1. Vault Events (`liquidity-pool.clar`)**

```typescript
// Funds Deposited
{
  event: "funds-deposited",
  depositor: principal,
  amountBaseUnits: uint, // ustx or sats
  tokenContract: principal // STX token principal or sBTC SIP-010 contract principal
}

// Funds Withdrawn
{
  event: "funds-withdrawn",
  withdrawer: principal,
  amountBaseUnits: uint, // ustx or sats
  tokenContract: principal
}

// Aggregate Collateral Locked (Triggered by backend)
{
  event: "collateral-locked",
  policyIds: (list MAX_BATCH_SIZE uint), // IDs of policies collateral was locked for (off-chain use)
  amountLockedBaseUnits: uint, // Total ustx or sats locked in this tx
  tokenContract: principal
}

// Aggregate Collateral Released (Triggered by backend)
{
  event: "collateral-released",
  policyIds: (list MAX_BATCH_SIZE uint), // IDs of policies collateral was released for (off-chain use)
  amountReleasedBaseUnits: uint, // Total ustx or sats released
  tokenContract: principal
}

// Settlement Paid (Triggered by backend)
{
  event: "settlement-paid",
  policyId: uint,
  buyer: principal,
  settlementAmountBaseUnits: uint, // ustx or sats paid
  tokenContract: principal
}
```

**4.2. Policy Registry Events (`policy-registry.clar`)**

```typescript
// Policy Created
{
  event: "policy-created",
  policyId: uint,
  owner: principal,
  counterparty: principal, // Pool Vault Address
  expirationHeight: uint,
  protectedValuePriceFeedUnits: uint,
  protectedAmountSats: uint,
  policyType: (string-ascii 4)
  // Note: Premium is handled off-chain / via the deposit tx
}

// Policy Status Updated (Triggered by backend)
{
  event: "policy-status-updated",
  policyId: uint,
  newStatus: uint, // 1=Settled, 2=Expired
  previousStatus: uint, // Should always be 0 (Active)
  blockHeight: uint
}
```

## 5. Conclusion

Standardizing data types, decimal conventions, DTOs, and event payloads is fundamental for the successful integration of the different layers in the BitHedge hybrid architecture. Strict adherence to these definitions will minimize errors, simplify development, and improve the overall maintainability and clarity of the system.
