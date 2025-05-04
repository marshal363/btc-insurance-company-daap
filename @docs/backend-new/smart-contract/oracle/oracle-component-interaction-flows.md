# BitHedge Oracle System: Component & Data Interaction Flows

## Document Overview

This technical document explains the data flows and component interactions within the BitHedge Oracle system. It covers both the current implementation (direct blockchain API calls) and the planned future architecture (Convex-mediated approach).

## System Architecture

The BitHedge Oracle system consists of multiple layers:

1. **UI Layer**: React components for data display and user interactions
2. **Hooks Layer**: React hooks that mediate between UI and data sources
3. **Blockchain Integration Layer**: Logic for communicating with the blockchain
4. **Blockchain Layer**: The on-chain smart contract (`oracle.clar`)

In the future architecture, a Convex backend layer will be inserted between the Hooks and Blockchain Integration layers to provide caching, additional processing, and improved off-chain calculations.

## Current Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────────────┐
│                                 UI LAYER                                   │
│                                                                           │
│  ┌─────────────────────────┐         ┌───────────────────────────┐        │
│  │   BitcoinPriceCard.tsx  │         │   OracleAdminControls.tsx │        │
│  │                         │         │                           │        │
│  │  - Displays BTC price   │         │  - Updates price data     │        │
│  │  - Shows volatility     │         │  - For authorized users   │        │
│  │  - Handles refresh      │         │  - Signs transactions     │        │
│  └─────────┬───────────────┘         └─────────────┬─────────────┘        │
│            │                                       │                      │
└────────────┼───────────────────────────────────────┼──────────────────────┘
             │                                       │
             ▼                                       ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                               HOOKS LAYER                                  │
│                                                                           │
│  ┌─────────────────────────┐         ┌───────────────────────────┐        │
│  │  useLatestOraclePrice   │         │  useIsAuthorizedSubmitter │        │
│  │                         │         │                           │        │
│  │  - Fetches price data   │         │  - Checks if wallet can   │        │
│  │  - Handles formatting   │         │    update oracle data     │        │
│  └─────────┬───────────────┘         └─────────────┬─────────────┘        │
│            │                                       │                      │
└────────────┼───────────────────────────────────────┼──────────────────────┘
             │                                       │
             │                                       │
             │      Direct API Path                  │
             │    ┌───────────────────────┐          │
             └────►  Stacks Blockchain    ├──────────┘
                  │  API Client           │
                  └─────────┬─────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                            BLOCKCHAIN LAYER                                │
│                                                                           │
│  ┌─────────────────────────┐         ┌───────────────────────────┐        │
│  │   Stacks API Endpoint   │         │   oracle.clar Contract    │        │
│  │                         │         │                           │        │
│  │  - Handles API calls    │         │  - Stores price data      │        │
│  │  - Returns CV values    │         │  - Manages authorization  │        │
│  └─────────────────────────┘         └───────────────────────────┘        │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

## Future Planned Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────────────┐
│                                 UI LAYER                                   │
│                                                                           │
│  ┌─────────────────────────┐         ┌───────────────────────────┐        │
│  │   BitcoinPriceCard.tsx  │         │   OracleAdminControls.tsx │        │
│  └─────────┬───────────────┘         └─────────────┬─────────────┘        │
│            │                                       │                      │
└────────────┼───────────────────────────────────────┼──────────────────────┘
             │                                       │
             ▼                                       ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                               HOOKS LAYER                                  │
│                                                                           │
│  ┌─────────────────────────┐         ┌───────────────────────────┐        │
│  │  useLatestOraclePrice   │         │  useIsAuthorizedSubmitter │        │
│  │  (calls Convex)         │         │  (calls Convex)           │        │
│  └─────────┬───────────────┘         └─────────────┬─────────────┘        │
│            │                                       │                      │
└────────────┼───────────────────────────────────────┼──────────────────────┘
             │                                       │
             ▼                                       ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                             CONVEX LAYER                                   │
│                                                                           │
│  ┌─────────────────────────┐         ┌───────────────────────────┐        │
│  │  readLatestOraclePrice  │         │  checkIsAuthorized        │        │
│  │                         │         │                           │        │
│  │  - Communicates with    │         │  - Verifies permissions   │        │
│  │    blockchain           │         │  - Handles auth logic     │        │
│  │  - Does data validation │         │                           │        │
│  │  - Caches results       │         │                           │        │
│  └─────────┬───────────────┘         └─────────────┬─────────────┘        │
│            │                                       │                      │
└────────────┼───────────────────────────────────────┼──────────────────────┘
             │                                       │
             ▼                                       ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                          INTEGRATION LAYER                                 │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │  blockchainIntegration.ts                                   │          │
│  │                                                             │          │
│  │  - Manages blockchain connections                           │          │
│  │  - Handles network selection (mainnet/testnet/devnet)       │          │
│  │  - Error handling & retry logic                             │          │
│  └─────────┬─────────────────────────────────────┬─────────────┘          │
│            │                                     │                        │
└────────────┼─────────────────────────────────────┼────────────────────────┘
             │                                     │
             ▼                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                            BLOCKCHAIN LAYER                                │
│                                                                           │
│  ┌─────────────────────────┐         ┌───────────────────────────┐        │
│  │   Stacks API Endpoint   │         │   oracle.clar Contract    │        │
│  └─────────────────────────┘         └───────────────────────────┘        │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

## Primary Data Flows

### 1. Reading Price Data (Current Implementation)

1. **User Interaction Initiates Flow**:

   - User visits the application or clicks the "Refresh" button in `BitcoinPriceCard.tsx`
   - Component calls `handleRefresh()` which invokes `refetch()` from the `useLatestOraclePrice` hook

2. **Hook Fetches Blockchain Data**:

   - `useLatestOraclePrice` hook in `oracleQueries.ts` executes its query function
   - Hook creates a Stacks API client instance using `getApi(getStacksUrl()).smartContractsApi`
   - TanStack Query checks its cache - if data is recent, it returns the cached data
   - Otherwise, the hook calls `api.callReadOnlyFunction()` with the contract details to fetch fresh data

3. **Blockchain Contract Interaction**:

   - Stacks API processes the request to call the `get-latest-price` function in `oracle.clar`
   - Contract returns either:
     - `(ok {price: u<number>, timestamp: u<number>})` with price data
     - `(err u104)` if no price data exists (ERR-NO-PRICE-DATA)
     - `(err u102)` if price data is too old (ERR-TIMESTAMP-TOO-OLD)

4. **Response Processing & UI Update**:
   - Hook receives and parses the Clarity Value response
   - Hook extracts price and timestamp values
   - Hook formats the data (converts satoshis to BTC, creates relative time string)
   - TanStack Query caches the result
   - React re-renders `BitcoinPriceCard.tsx` with the new data

### 2. Updating Price Data (Current Implementation)

1. **User Interaction Initiates Flow**:

   - Authorized user enters a price in `OracleAdminControls.tsx` and clicks "Submit Price Update"
   - Component calls `handleUpdatePrice()` function

2. **Transaction Preparation**:

   - Function converts price from USD to satoshis and gets current timestamp
   - Function calls `getSetAggregatedPriceTx()` from `oracle-utils.ts` to create transaction options
   - Function calls `executeTx()` from `useTransactionExecuter` hook

3. **Transaction Signing & Submission**:

   - For Devnet: Transaction is directly signed with the devnet wallet's private key
   - For Testnet/Mainnet: User approves transaction in their Hiro Wallet browser extension
   - Signed transaction is broadcast to the Stacks network

4. **Blockchain Contract Execution**:

   - Stacks node executes the `set-aggregated-price` function in `oracle.clar`
   - Contract validates the caller is authorized
   - Contract validates price deviation and timestamp
   - Contract updates the stored price and timestamp

5. **UI Update**:
   - On successful transaction, the `onPriceUpdate()` callback triggers
   - This triggers a refetch via `useLatestOraclePrice` hook
   - The UI updates with the newly submitted price

### 3. Reading Price Data (Future Convex Implementation)

1. **User Interaction Initiates Flow**:

   - Similar to current, but hook uses `useConvexQuery(api.blockchainIntegration.readLatestOraclePrice)`

2. **Convex Backend Processing**:

   - Convex function executes, potentially checking its own cache first
   - If needed, Convex calls the blockchain using `callReadOnlyFunction()`
   - Convex receives blockchain data, parses and processes it
   - Convex may augment on-chain data with additional off-chain calculations
   - Result is cached in Convex and returned to frontend

3. **UI Update**:
   - Frontend receives data from Convex
   - React renders the updated UI
   - Convex reactivity ensures all connected clients stay synchronized

## Initial Oracle Data Population

The `oracle.clar` contract starts with no price data. Initial data must be provided by either:

1. **Manual Administrator Input**:

   - Contract deployer (initially set as the `authorized-submitter`) uses `OracleAdminControls.tsx`
   - Admin manually enters the Bitcoin price
   - Transaction is sent to blockchain, setting the first price
   - Flow: **Admin Input → UI → Blockchain**

2. **Automated Convex Backend** (planned):
   - Convex backend fetches prices from multiple external APIs
   - Convex aggregates prices to determine a reliable value
   - Convex (configured as `authorized-submitter`) submits price to blockchain
   - Flow: **External APIs → Convex → Blockchain**

## UI Data Source

1. **Current Implementation**:

   - `BitcoinPriceCard.tsx` gets data **directly from blockchain** via `useLatestOraclePrice` hook
   - No intermediary systems between UI and blockchain

2. **Future Implementation**:
   - UI gets data **from Convex**
   - Convex reads core price from blockchain
   - Convex may augment data with additional metrics before sending to UI
   - Convex provides caching, real-time updates, and error handling benefits

## Key Technical Considerations

1. **Authentication & Authorization**:

   - Only the `authorized-submitter` can update price data
   - Contract owner can change the `authorized-submitter`
   - UI components check authorization status before showing admin controls

2. **Data Validation**:

   - Contracts enforce validation rules (price deviation limits, timestamp freshness)
   - Frontend performs basic validation before submission
   - Future Convex layer can add additional validation logic

3. **Error Handling**:

   - Specific error codes from contract are translated to user-friendly messages
   - Loading states handle asynchronous operations
   - Network issues and transaction failures are properly managed

4. **Caching & Performance**:
   - TanStack Query provides frontend caching in current implementation
   - Convex will offer more robust caching and real-time updates in future

## Next Implementation Steps

Based on the Oracle Integration Development Plan:

1. **Complete Phase 1**:

   - Deploy refactored `oracle.clar` to Devnet (OC-107)
   - Finalize testing of the contract functions (TEST-101)

2. **Phase 2 - Convex Backend**:

   - Implement multi-source price fetching (CVX-201)
   - Develop aggregation logic (CVX-202)
   - Implement price history storage and derived metrics

3. **Phase 3 - Blockchain Integration**:
   - Implement secure backend wallet/key management (BI-301)
   - Create robust transaction building and signing (BI-302, BI-303)
   - Develop threshold-based price submission logic (CVX-301)

By following this roadmap, we'll transition from the current direct API approach to the more robust and feature-rich Convex-mediated architecture.
