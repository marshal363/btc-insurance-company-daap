# BitHedge Oracle System: Component Interaction Flows

## 1. Introduction

This document details the interaction flows between components in the BitHedge platform related to the Oracle functionality. These flows illustrate how price data is collected, processed, aggregated, and displayed throughout the system, from external data sources through the Convex backend to the UI components and blockchain integration.

The Oracle system is a critical component of the BitHedge platform, providing reliable price data that is used for:

- Policy premium calculation
- Settlement value determination
- Price trend visualization
- Volatility assessment
- Policy exercise eligibility

## 2. Price Data Ingestion Flow

### 2.1 Flow Diagram

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐         ┌─────────────────┐         ┌─────────────┐
│             │         │               │         │              │         │                 │         │             │
│  External   │         │ Convex Backend│         │ Convex       │         │ Blockchain      │         │ Oracle      │
│  Price APIs │         │ (dataIngestion)│        │ Database     │         │ Network         │         │ Contract    │
│             │         │               │         │              │         │                 │         │             │
└──────┬──────┘         └───────┬───────┘         └──────┬───────┘         └────────┬────────┘         └─────┬───────┘
       │                        │                        │                          │                        │
       │                        │                        │                          │                        │
       │  1. Scheduled Job      │                        │                          │                        │
       │     Triggers           │                        │                          │                        │
       │ ◄────────────────────┐ │                        │                          │                        │
       │                        │                        │                          │                        │
       │  2. Fetch Current      │                        │                          │                        │
       │     Prices from APIs   │                        │                          │                        │
       │ ◄─────────────────────┐│                        │                          │                        │
       │                        │                        │                          │                        │
       │  3. Return Price Data  │                        │                          │                        │
       │     from Multiple      │                        │                          │                        │
       │     Sources            │                        │                          │                        │
       │ ─────────────────────► │                        │                          │                        │
       │                        │                        │                          │
       │                        │  4. Apply Validation   │                        │
       │                        │     Rules              │                        │
       │                        │ ◄────────────────────┐ │                          │                        │
       │                        │                        │                          │                        │
       │                        │  5. Remove Outliers    │                        │
       │                        │     & Apply Filters    │                        │
       │                        │ ◄────────────────────┐ │                          │                        │
       │                        │                        │                          │                        │
       │                        │  6. Aggregate Source   │                        │
       │                        │     Data & Calculate   │                        │
       │                        │     Consensus Price    │                        │
       │                        │ ◄────────────────────┐ │                          │                        │
       │                        │                        │                          │                        │
       │                        │  7. Store Individual   │                          │                        │
       │                        │     Source Prices      │                          │                        │
       │                        │ ─────────────────────► │                          │                        │
       │                        │                        │                          │
       │                        │  8. Store Aggregated   │                          │                        │
       │                        │     Price Data         │                          │                        │
       │                        │ ─────────────────────► │                          │                        │
       │                        │                        │                          │
       │                        │  9. Check for          │                          │
       │                        │     Blockchain         │                          │
       │                        │     Submission Criteria│                          │
       │                        │ ◄────────────────────┐ │                          │                        │
       │                        │                        │                          │                        │
       │                        │  10. Prepare Price     │                          │                        │
       │                        │      Submission        │                          │                        │
       │                        │      Transaction       │                          │                        │
       │                        │ ─────────────────────────────────────────────────►│                        │
       │                        │                        │                          │                        │
       │                        │                        │                          │  11. Submit Price to   │
       │                        │                        │                          │      Oracle Contract   │
       │                        │                        │                          │ ─────────────────────► │
       │                        │                        │                          │                        │
       │                        │                        │                          │  12. Validate &        │
       │                        │                        │                          │      Store On-Chain    │
       │                        │                        │                          │ ◄─────────────────────┐│
       │                        │                        │                          │                        │
       │                        │                        │                          │  13. Emit Price        │
       │                        │                        │                          │      Updated Event     │
       │                        │                        │                          │ ◄─────────────────────┐│
       │                        │                        │                          │                        │
       │                        │  14. Process Events    │                          │                        │
       │                        │      & Update Status   │                          │                        │
       │                        │ ◄─────────────────────────────────────────────────┘                        │
       │                        │                        │                          │                        │
       │                        │                        │                          │                        │
```

### 2.2 Step-by-Step Description

1. **Scheduled Job Trigger (Convex)**

   - Scheduled job `fetchAndAggregateCurrentPrices` runs at regular intervals (typically every 5-15 minutes)
   - Defined in `convex/crons.ts` using Convex's scheduling system
   - Job triggers the price ingestion process
   - Calls the internal action defined in `dataIngestion.ts`

2. **Fetch External Price Data (Convex → External APIs)**

   - Convex action `fetchAndAggregateCurrentPrices` makes parallel requests to multiple price sources
   - Sources typically include exchanges (Coinbase, Binance, Kraken) and price aggregators (CoinGecko, CryptoCompare)
   - Each request is handled with appropriate rate limiting and error handling
   - Implementation in `convex/dataIngestion.ts` uses axios for API requests

3. **Return Price Data (External APIs → Convex)**

   - Each external API returns current BTC/USD price data
   - Response includes price, timestamp, and source-specific metadata
   - Typical format: `{ price: number, timestamp: number, source: string, metadata?: object }`
   - Raw responses are collected into an array for processing

4. **Apply Validation Rules (Convex)**

   - Each source response is validated against predefined rules:
     - Required fields are present (price, timestamp, source)
     - Price is within reasonable bounds (e.g., within ±30% of last known good price)
     - Timestamp is recent (e.g., not older than 30 minutes)
   - Invalid responses are logged and excluded from further processing
   - Validation logic is defined in helper functions in `convex/dataIngestion.ts`

5. **Remove Outliers & Apply Filters (Convex)**

   - Statistical outlier detection is applied to remaining price points
   - Common method: exclude prices more than 2 standard deviations from the mean
   - Additional filtering based on source reliability scores or historical accuracy
   - Filtering enhances precision of the final consensus price
   - Implemented in utility functions in `convex/dataIngestion.ts`

6. **Aggregate Source Data & Calculate Consensus Price (Convex)**

   - Remaining valid prices are aggregated using weighted average or median
   - Weights may be assigned based on source reliability or volume
   - Additional derived metrics are calculated:
     - Price volatility (based on recent price history)
     - Source consistency (agreement between sources)
     - Confidence score for the consensus price
   - Aggregation algorithms defined in helper functions in `convex/dataIngestion.ts`

7. **Store Individual Source Prices (Convex → Database)**

   - Original validated price points from each source are stored in Convex database
   - Table: `sourcePrices` with fields for source, price, timestamp
   - Historical source data retained for auditing and algorithm improvement
   - Storage performed through Convex database operations in `convex/dataIngestion.ts`

8. **Store Aggregated Price Data (Convex → Database)**

   - Final consensus price with metadata is stored in Convex database
   - Table: `aggregatedPrices` with price, timestamp, volatility, source count
   - Most recent record is used for UI display and pricing calculations
   - Implementation through Convex database operations in `convex/dataIngestion.ts`

9. **Check Blockchain Submission Criteria (Convex)**

   - Determines if the new price should be submitted to the blockchain
   - Criteria typically include:
     - Significant price change (e.g., >1% from last on-chain price)
     - Minimum time elapsed since last submission (e.g., 1 hour)
     - Higher urgency during high volatility periods
   - Special conditions may trigger immediate updates (e.g., rapid price movements)
   - Logic defined in `convex/dataIngestion.ts` and `blockchainIntegration.ts`

10. **Prepare Price Submission Transaction (Convex → Blockchain)**

    - If submission criteria are met, transaction is prepared
    - Backend key is used to sign the transaction (authorized oracle submitter)
    - Gas fees and submission parameters are optimized
    - Transaction contains price data formatted for on-chain storage
    - Implementation in `convex/blockchainIntegration.ts` with Stacks transaction helpers

11. **Submit Price to Oracle Contract (Blockchain Network)**

    - Signed transaction is submitted to blockchain network
    - Transaction targets the Oracle smart contract's update function
    - On Stacks, this is a contract call transaction to the oracle contract
    - Managed through blockchain API in `convex/blockchainIntegration.ts`

12. **Validate & Store On-Chain (Oracle Contract)**

    - Oracle contract validates the submission:
      - Verifies submitter is authorized (principal check)
      - Performs reasonability checks on price data
      - Verifies price is not too different from previous value
    - Valid price is stored in contract data space
    - Previous price history may be retained on-chain for verification
    - Implementation in Clarity smart contract (referenced in `blockchainIntegration.ts`)

13. **Emit Price Updated Event (Oracle Contract → Blockchain)**

    - Contract emits a "price-updated" event with new price details
    - Event includes timestamp, price, and submitter information
    - Event is recorded in the blockchain and available to listeners
    - Defined in Oracle contract event syntax

14. **Process Events & Update Status (Blockchain → Convex)**

    - Convex monitors blockchain for Oracle events
    - When "price-updated" event is detected, confirms submission
    - Updates status of price submission record in database
    - Makes on-chain price available for premium calculations and settlements
    - Implemented in event listener code in `convex/blockchainIntegration.ts`

## 3. UI Oracle Data Display Flow

### 3.1 Flow Diagram

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐         ┌─────────────────┐
│             │         │               │         │              │         │                 │
│  React UI   │         │ Convex        │         │ Convex       │         │ Services        │
│  Components │         │ React Hooks   │         │ Backend      │         │ (Oracle)        │
│             │         │               │         │              │         │                 │
└──────┬──────┘         └───────┬───────┘         └──────┬───────┘         └────────┬────────┘
       │                        │                        │                          │
       │                        │                        │                          │
       │  1. User Opens         │                        │                          │
       │     Dashboard          │                        │                          │
       │ ◄────────────────────┐ │                        │                          │
       │                        │                        │                          │
       │  2. BitcoinPriceCard   │                        │                          │
       │     Component Mounts   │                        │                          │
       │ ───────────────────────►                        │                          │
       │                        │                        │                          │
       │                        │  3. useQuery Hook      │                          │
       │                        │     Calls Oracle       │                          │
       │                        │     Price Service      │                          │
       │                        │ ────────────────────────────────────────────────► │
       │                        │                        │                          │
       │                        │                        │  4. Oracle Price        │
       │                        │                        │     Service Queries     │
       │                        │                        │     Database           │
       │                        │                        │ ◄────────────────────┐ │
       │                        │                        │                        │
       │                        │                        │  5. Process and Format │
       │                        │                        │     Latest Price Data  │
       │                        │                        │ ◄────────────────────┐ │
       │                        │                        │                        │
       │                        │  6. Return Formatted   │                        │
       │                        │     Price Data         │                        │
       │                        │ ◄──────────────────────────────────────────────┐ │
       │                        │                        │                        │
       │  7. Component Receives │                        │                        │
       │     Data & Updates     │                        │                        │
       │ ◄───────────────────── │                        │                        │
       │                        │                        │                        │
       │  8. Initialize 24h     │                        │                        │
       │     Range Hook         │                        │                        │
       │ ───────────────────────►                        │                        │
       │                        │                        │                        │
       │                        │  9. Call Calculate24h  │                        │
       │                        │     Range Hook         │                        │
       │                        │ ────────────────────────────────────────────────►
       │                        │                        │                        │
       │                        │                        │ 10. Query Historical   │
       │                        │                        │     Price Data         │
       │                        │                        │ ◄────────────────────┐ │
       │                        │                        │                        │
       │                        │                        │ 11. Calculate Range    │
       │                        │                        │     High/Low           │
       │                        │                        │ ◄────────────────────┐ │
       │                        │                        │                        │
       │                        │ 12. Return Range Data  │                        │
       │                        │ ◄──────────────────────────────────────────────┐ │
       │                        │                        │                        │
       │ 13. Component Receives │                        │                        │
       │     Range Data &       │                        │                        │
       │     Updates UI         │                        │                        │
       │ ◄───────────────────── │                        │                        │
       │                        │                        │                        │
       │ 14. Set Up Automatic   │                        │                        │
       │     Refresh Interval   │                        │                        │
       │ ◄──────────────────────│                        │                        │
       │                        │                        │                        │
       │ 15. On Interval,       │                        │                        │
       │     Re-request Data    │                        │                        │
       │ ───────────────────────►                        │                        │
       │                        │                        │                        │
```

### 3.2 Step-by-Step Description

1. **User Opens Dashboard (User → Frontend)**

   - User navigates to BitHedge dashboard page
   - Dashboard container component mounts and initializes
   - Layout includes BitcoinPriceCard component
   - Entry point is typically dashboard route in `front-end/src/app/`

2. **BitcoinPriceCard Component Mounts (Frontend → Convex React)**

   - BitcoinPriceCard component initializes and renders initial state
   - Defined in `front-end/src/components/BitHedge/BitcoinPriceCard.tsx`
   - Component prepares to fetch price data
   - Uses loading state indicators while data is being retrieved

3. **useQuery Hook Calls Oracle Price Service (Convex React → Oracle Service)**

   - Component uses Convex's `useQuery` hook to request latest price data
   - Targets the specific API endpoint: `api.services.oracle.priceService.getLatestPrice`
   - Hook handles data fetching, caching, and real-time updates
   - Example: `const aggregatedData = useQuery(api.services.oracle.priceService.getLatestPrice);`

4. **Oracle Price Service Queries Database (Oracle Service)**

   - The `getLatestPrice` function in Oracle price service executes
   - Queries Convex database for most recent record in `aggregatedPrices` table
   - Uses Convex's query capabilities with sorting by timestamp
   - Implementation in `convex/services/oracle/priceService.ts`

5. **Process and Format Latest Price Data (Oracle Service)**

   - Service processes the raw database record
   - Formats price data into the expected interface format
   - Adds derived fields like formatted timestamp and price
   - Ensures all required fields are present or provides defaults

6. **Return Formatted Price Data (Oracle Service → Convex React)**

   - Oracle service returns formatted price data to the useQuery hook
   - Data includes price, timestamp, volatility, sourceCount, etc.
   - Format matches the `AggregatedPriceData` interface defined in BitcoinPriceCard
   - Example: `{ price: 65432.10, timestamp: 1618324567890, volatility: 0.12, sourceCount: 5 }`

7. **Component Receives Data & Updates (Convex React → Frontend)**

   - useQuery hook delivers data to the component
   - Component updates its state with the received data
   - Destructures fields from the response: `const btcPrice = aggregatedData?.price ?? 0;`
   - Triggers re-render with the new price information
   - Loading indicators are removed when data is available

8. **Initialize 24h Range Hook (Frontend → Convex React)**

   - Component initializes the 24-hour price range hook
   - Uses custom hook: `useCalculate24hRange()`
   - Hook is defined in `front-end/src/hooks/oracleQueries.ts`
   - Hook is called after or in parallel with the price data request

9. **Call Calculate24h Range Hook (Convex React → Oracle Service)**

   - Range hook makes a separate query to the Oracle service
   - Targets a specialized endpoint for range calculation
   - Typically calls `api.services.oracle.historicalData.getLastDayRange` or similar
   - Query includes parameters for time range (24 hours)

10. **Query Historical Price Data (Oracle Service)**

    - Oracle service executes a query for historical price data
    - Retrieves price points from the last 24 hours
    - Uses Convex database query on `historicalPrices` table
    - Filters by timestamp range: now minus 24 hours to now
    - Implementation in `convex/services/oracle/historicalData.ts`

11. **Calculate Range High/Low (Oracle Service)**

    - Service processes the historical data points
    - Determines the highest and lowest prices in the 24-hour period
    - Calculates the range as a percentage or absolute value
    - Handles edge cases like missing data points

12. **Return Range Data (Oracle Service → Convex React)**

    - Service returns the calculated range data
    - Response includes high, low, and range values
    - Format matches the `RangeData` interface: `{ high: number, low: number, range: number }`
    - Example: `{ high: 67000, low: 64500, range: 2500 }`

13. **Component Receives Range Data & Updates UI (Convex React → Frontend)**

    - Range hook delivers data to the component
    - Component extracts high and low values: `const displayRangeLow = rangeData?.low ?? 0;`
    - Updates UI elements showing the 24-hour trading range
    - Updates the price position indicator within the range
    - Renders the range bar with current price indicator

14. **Set Up Automatic Refresh Interval (Frontend)**

    - Component establishes a refresh interval using `useEffect`
    - Typically refreshes data every 30-60 seconds
    - Ensures price information stays current without manual refreshing
    - Implementation uses React's `useEffect` with cleanup

15. **On Interval, Re-request Data (Frontend → Convex React)**

    - When interval triggers, data requests are repeated
    - Both price and range data are refreshed
    - Component shows visual indicator for new data
    - Uses optimized requests that only transfer changes
    - Convex handles efficient real-time updates behind the scenes

## 4. Historical Price Data Flow

### 4.1 Flow Diagram

```
┌────────────┐         ┌────────────────┐         ┌───────────────┐         ┌─────────────┐
│            │         │                │         │               │         │             │
│  Scheduled │         │ Historical Data│         │ External      │         │ Convex      │
│  Tasks     │         │ Service        │         │ Price APIs    │         │ Database    │
│            │         │                │         │               │         │             │
└─────┬──────┘         └────────┬───────┘         └───────┬───────┘         └──────┬──────┘
      │                         │                         │                        │
      │                         │                         │                        │
      │  1. Daily Historical    │                         │                        │
      │     Data Update Job     │                         │                        │
      │ ─────────────────────► │                         │                        │
      │                         │                         │                        │
      │                         │  2. Check Last          │                        │
      │                         │     Historical Entry    │                        │
      │                         │ ────────────────────────────────────────────────►│
      │                         │                         │                        │
      │                         │  3. Return Last         │                        │
      │                         │     Entry Timestamp     │                        │
      │                         │ ◄────────────────────────────────────────────────│
      │                         │                         │                        │
      │                         │  4. Calculate Missing   │                        │
      │                         │     Time Range          │                        │
      │                         │ ◄────────────────────┐  │                        │
      │                         │                         │                        │
      │                         │  5. Request Historical  │                        │
      │                         │     Data from APIs      │                        │
      │                         │ ────────────────────────►                        │
      │                         │                         │                        │
      │                         │  6. Return Historical   │                        │
      │                         │     Price Points        │                        │
      │                         │ ◄────────────────────────                        │
      │                         │                         │                        │
      │                         │  7. Process & Filter    │                        │
      │                         │     Data Points         │                        │
      │                         │ ◄────────────────────┐  │                        │
      │                         │                         │                        │
      │                         │  8. Add Source          │                        │
      │                         │     Attribution &       │                        │
      │                         │     Metadata           │                        │
      │                         │ ◄────────────────────┐  │                        │
      │                         │                         │                        │
      │                         │  9. Store Historical    │                        │
      │                         │     Data Points in Batch│                        │
      │                         │ ────────────────────────────────────────────────►│
      │                         │                         │                        │
      │                         │ 10. Calculate Daily     │                        │
      │                         │     Aggregates          │                        │
      │                         │ ◄────────────────────┐  │                        │
      │                         │                         │                        │
      │                         │ 11. Store Daily         │                        │
      │                         │     Aggregate Records   │                        │
      │                         │ ────────────────────────────────────────────────►│
      │                         │                         │                        │
      │                         │ 12. Update Data         │                        │
      │                         │     Completeness Metrics│                        │
      │                         │ ────────────────────────────────────────────────►│
      │                         │                         │                        │
      │ 13. Report Completion   │                         │                        │
      │ ◄─────────────────────┐ │                         │                        │
      │                         │                         │                        │
```

### 4.2 Step-by-Step Description

1. **Daily Historical Data Update Job (Scheduler → Historical Data Service)**

   - Scheduled job `fetchHistoricalPrices` runs daily (typically during low-traffic hours)
   - Job is defined in `convex/crons.ts` and configured in system setup
   - Triggers the historical data fetch process to maintain complete price history
   - Calls the service in `convex/services/oracle/historicalData.ts`

2. **Check Last Historical Entry (Historical Data Service → Database)**

   - Service queries the database for the most recent historical price record
   - Determines the last timestamp for which historical data exists
   - Uses Convex query on `historicalPrices` table ordered by timestamp
   - Query executed in `getLastHistoricalEntryTimestamp` function

3. **Return Last Entry Timestamp (Database → Historical Data Service)**

   - Database returns the most recent historical entry's timestamp
   - If no records exist, returns system initialization timestamp or null
   - Used to determine the starting point for new data fetching

4. **Calculate Missing Time Range (Historical Data Service)**

   - Service calculates the time range for which data is missing
   - Range: last timestamp to current timestamp minus buffer period
   - Buffer period (e.g., 1 hour) ensures overlap for continuity
   - Handles edge cases like first-time initialization
   - Logic implemented in `calculateMissingTimeRange` function

5. **Request Historical Data from APIs (Historical Data Service → External APIs)**

   - Service makes API requests to fetch historical price data
   - Targets reliable sources with historical data APIs (e.g., CryptoCompare, CoinGecko)
   - Requests include time range parameters
   - Uses appropriate rate limiting and pagination
   - Implementation in `fetchHistoricalDataForRange` function

6. **Return Historical Price Points (External APIs → Historical Data Service)**

   - APIs return historical price data for the requested period
   - Typically includes hourly or daily price points
   - Format varies by source but normalized by service
   - Common fields: timestamp, open, high, low, close, volume

7. **Process & Filter Data Points (Historical Data Service)**

   - Service processes raw API responses
   - Converts timestamps to consistent format
   - Normalizes values (e.g., ensuring USD denomination)
   - Filters out invalid or suspicious data points
   - Implementation in `processHistoricalDataPoints` function

8. **Add Source Attribution & Metadata (Historical Data Service)**

   - Service enhances data points with source information
   - Adds metadata like confidence scores or data quality metrics
   - Ensures each point has all required fields with appropriate types
   - Prepares records for database storage
   - Functions in `prepareHistoricalDataForStorage`

9. **Store Historical Data Points in Batch (Historical Data Service → Database)**

   - Service stores processed historical data points in database
   - Uses batch operations for efficient storage of many records
   - Table: `historicalPrices` with timestamp indexing
   - Handles potential duplicates with upsert logic
   - Implementation in `storeHistoricalDataBatch` function

10. **Calculate Daily Aggregates (Historical Data Service)**

    - Service creates daily aggregate records from the raw historical data
    - Calculates open, high, low, close values for each day
    - Computes additional metrics like volatility and trading ranges
    - Reduces storage requirements while preserving key information
    - Implementation in `calculateDailyAggregates` function

11. **Store Daily Aggregate Records (Historical Data Service → Database)**

    - Service stores daily aggregate records in database
    - Table: `dailyPriceAggregates` with date-based indexing
    - Records used for chart displays and trend analysis
    - Optimized for fast retrieval of time-series data
    - Implementation in `storeDailyAggregates` function

12. **Update Data Completeness Metrics (Historical Data Service → Database)**

    - Service updates metrics tracking historical data completeness
    - Records the time ranges for which complete data exists
    - Used for system health monitoring and reporting
    - Helps identify gaps that need backfilling in future runs
    - Implementation in `updateDataCompletenessMetrics` function

13. **Report Completion (Historical Data Service → Scheduler)**

    - Service reports successful completion to the scheduler
    - Includes statistics on records processed and stored
    - Records any errors or gaps encountered
    - Used for monitoring and alerting
    - Implementation in completion handlers

## 5. Authorized Oracle Submitter Flow

### 5.1 Flow Diagram

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐         ┌─────────────────┐         ┌─────────────┐
│             │         │               │         │              │         │                 │         │             │
│  Frontend   │         │ Convex Backend│         │ Blockchain   │         │ Oracle          │         │ UI          │
│  (Admin)    │         │ (Oracle Svc)  │         │ Network      │         │ Contract        │         │ Components  │
│             │         │               │         │              │         │                 │         │             │
└──────┬──────┘         └───────┬───────┘         └──────┬───────┘         └────────┬────────┘         └─────┬───────┘
       │                        │                        │                          │                        │
       │                        │                        │                          │                        │
       │  1. Check If User      │                        │                          │                        │
       │     Is Authorized      │                        │                          │                        │
       │     Submitter          │                        │                          │                        │
       │ ─────────────────────► │                        │                          │                        │
       │                        │                        │                          │                        │
       │                        │  2. Query Authorized   │                          │                        │
       │                        │     Submitters List    │                          │                        │
       │                        │ ─────────────────────────────────────────────────►│                        │
       │                        │                        │                          │                        │
       │                        │  3. Return Submitter   │                          │                        │
       │                        │     List               │                          │                        │
       │                        │ ◄─────────────────────────────────────────────────│                        │
       │                        │                        │                          │                        │
       │                        │  4. Check If User      │                          │                        │
       │                        │     Address Is In List │                          │                        │
       │                        │ ◄────────────────────┐ │                          │                        │
       │                        │                        │                          │                        │
       │  5. Return             │                        │                          │                        │
       │     Authorization      │                        │                          │                        │
       │     Status             │                        │                          │                        │
       │ ◄─────────────────────┐│                        │                          │                        │
       │                        │                        │                          │                        │
       │  6. Render Admin       │                        │                          │                        │
       │     Controls If        │                        │                          │                        │
       │     Authorized         │                        │                          │                        │
       │ ─────────────────────────────────────────────────────────────────────────────────────────────────► │
       │                        │                        │                          │                        │
       │  7. Admin Requests     │                        │                          │                        │
       │     Manual Price       │                        │                          │                        │
       │     Submission         │                        │                          │                        │
       │ ◄─────────────────────────────────────────────────────────────────────────────────────────────────┐│
       │                        │                        │                          │                        │
       │  8. Call Submit Price  │                        │                          │                        │
       │     Action             │                        │                          │                        │
       │ ─────────────────────► │                        │                          │                        │
       │                        │                        │                          │                        │
       │                        │  9. Fetch Latest       │                          │                        │
       │                        │     Market Price       │                          │                        │
       │                        │ ◄────────────────────┐ │                          │                        │
       │                        │                        │                          │                        │
       │                        │ 10. Prepare Transaction│                          │                        │
       │                        │     with Price Data    │                          │                        │
       │                        │ ◄────────────────────┐ │                          │                        │
       │                        │                        │                          │                        │
       │ 11. Return Transaction │                        │                          │                        │
       │     for Signing        │                        │                          │                        │
       │ ◄─────────────────────┐│                        │                          │                        │
       │                        │                        │                          │                        │
       │ 12. Admin Signs        │                        │                          │                        │
       │     Transaction        │                        │                          │                        │
       │ ◄────────────────────┐ │                        │                          │                        │
       │                        │                        │                          │                        │
       │ 13. Submit Signed      │                        │                          │                        │
       │     Transaction        │                        │                          │                        │
       │ ─────────────────────────────────────────────────►                          │
       │                        │                        │                          │
       │                        │                        │ 14. Execute Transaction  │
       │                        │                        │ ─────────────────────────►
       │                        │                        │                          │
       │                        │                        │ 15. Verify Submitter     │
       │                        │                        │     Authorization        │
       │                        │                        │ ◄────────────────────────│
       │                        │                        │                          │
       │                        │                        │ 16. Update On-Chain      │
       │                        │                        │     Price                │
       │                        │                        │ ◄────────────────────────│
       │                        │                        │                          │
       │                        │                        │ 17. Emit Price Updated   │
       │                        │                        │     Event                │
       │                        │                        │ ◄────────────────────────│
       │                        │                        │                          │
       │ 18. Transaction        │                        │                          │
       │     Confirmation       │                        │                          │
       │ ◄─────────────────────────────────────────────────┘                          │
       │                        │                        │                          │
```

### 5.2 Step-by-Step Description

1. **Check If User Is Authorized Submitter (Frontend → Convex)**

   - The BitcoinPriceCard component calls the `useIsAuthorizedSubmitter` hook
   - Passes the current user's wallet address: `useIsAuthorizedSubmitter(currentWalletAddress)`
   - Hook is defined in `front-end/src/hooks/oracleQueries.ts`
   - This query determines whether to show admin controls in the UI

2. **Query Authorized Submitters List (Convex → Oracle Contract)**

   - Convex makes a read-only call to the Oracle smart contract
   - Calls the function that returns the list of authorized submitters
   - Implementation in `convex/blockchain/oracle/queries.ts`
   - Uses Stacks blockchain API to make the contract call without modifying state

3. **Return Submitter List (Oracle Contract → Convex)**

   - Oracle contract returns the list of authorized submitter principals
   - List is maintained by the contract administrator
   - Typically includes backend service address and select admin addresses
   - Format is an array of Stacks principal strings

4. **Check If User Address Is In List (Convex)**

   - Convex compares the provided wallet address to the authorized list
   - Normalizes address formats for comparison if needed
   - Implements proper principal comparison logic for the blockchain platform
   - Returns a boolean result indicating authorization status

5. **Return Authorization Status (Convex → Frontend)**

   - The `useIsAuthorizedSubmitter` hook returns the authorization status
   - Example: `{ data: true, isLoading: false, error: null }`
   - Status is used by the component to conditionally render admin controls
   - Implementation handles loading and error states appropriately

6. **Render Admin Controls If Authorized (Frontend → UI Components)**

   - If user is authorized, BitcoinPriceCard renders the OracleAdminControls component
   - Implementation in BitcoinPriceCard.tsx: `{isAuthorized && <OracleAdminControls ... />}`
   - Admin controls include options for manual price submission and other administrative functions
   - Component is defined in `front-end/src/components/BitHedge/OracleAdminControls.tsx`

7. **Admin Requests Manual Price Submission (UI Components → Frontend)**

   - Admin user clicks "Submit Current Price" button in admin controls
   - Button triggers the submission function
   - Event handler in OracleAdminControls component prepares for submission
   - May include confirmation dialog or additional verification

8. **Call Submit Price Action (Frontend → Convex)**

   - Frontend calls the Convex action for manual price submission
   - Action: `submitOraclePrice` or similar in Oracle service
   - Passes any relevant parameters (e.g., override price if provided)
   - Implementation creates an authorized transaction for signing

9. **Fetch Latest Market Price (Convex)**

   - Convex fetches the latest aggregated price from the database
   - Uses the same price that is displayed in the UI
   - Ensures the submitted price is current and accurate
   - Implementation in the action handler in Oracle service

10. **Prepare Transaction with Price Data (Convex)**

    - Convex creates a transaction to call the Oracle contract with the price data
    - Formats price data according to contract requirements (e.g., satoshis)
    - Sets appropriate gas fees and transaction parameters
    - Creates a transaction object for the user to sign
    - Implementation in `convex/blockchain/oracle/transactions.ts`

11. **Return Transaction for Signing (Convex → Frontend)**

    - Convex returns the prepared transaction to the frontend
    - Includes transaction object and any metadata needed for signing
    - Frontend receives transaction and prepares wallet interaction
    - Implementation in Convex action return value

12. **Admin Signs Transaction (Frontend)**

    - Frontend requests wallet signature for the transaction
    - Uses appropriate wallet API based on environment (Hiro, DevNet, etc.)
    - Handles wallet interaction and user confirmation
    - Implementation in OracleAdminControls component's submission handler

13. **Submit Signed Transaction (Frontend → Blockchain)**

    - Frontend submits the signed transaction to the blockchain
    - Uses blockchain API appropriate to the network (Stacks testnet/mainnet)
    - Records transaction ID for status tracking
    - Implementation in OracleAdminControls component after signature

14. **Execute Transaction (Blockchain → Oracle Contract)**

    - Blockchain processes the signed transaction
    - Routes call to the Oracle contract's price update function
    - Passes signed price data and submitter information
    - Transaction executes in the context of the signing user

15. **Verify Submitter Authorization (Oracle Contract)**

    - Contract checks if the transaction sender is an authorized submitter
    - Compares the tx-sender principal to the authorized list
    - Rejects transaction if unauthorized
    - Implementation in Clarity contract authorization check

16. **Update On-Chain Price (Oracle Contract)**

    - If authorized, contract updates the stored price data
    - Saves new price, timestamp, and submitter information
    - May apply additional validation or rate-limiting rules
    - Updates internal contract state for price history

17. **Emit Price Updated Event (Oracle Contract)**

    - Contract emits an event indicating the price has been updated
    - Event includes new price, timestamp, and submitter
    - Event is recorded on-chain and available to listeners
    - Format follows contract event structure

18. **Transaction Confirmation (Blockchain → Frontend)**

    - Blockchain returns transaction result to frontend
    - Includes success status and any events emitted
    - Frontend updates UI to show submission was successful
    - OracleAdminControls component shows confirmation message
    - Implementation handles both success and failure cases

## 6. Error Handling and Recovery Flows

### 6.1 Price Data Acquisition Failure Flow

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐         ┌─────────────────┐
│             │         │               │         │              │         │                 │
│  External   │         │ Convex Backend│         │ Convex       │         │ Monitoring      │
│  Price APIs │         │ (Data Service)│         │ Database     │         │ Services        │
│             │         │               │         │              │         │                 │
└──────┬──────┘         └───────┬───────┘         └──────┬───────┘         └────────┬────────┘
       │                        │                        │                          │
       │                        │                        │                          │
       │  1. Scheduled Price    │                        │                          │
       │     Fetch Job Runs     │                        │                          │
       │ ◄────────────────────┐ │                        │                          │
       │                        │                        │                          │
       │  2. Request Price Data │                        │                          │
       │     from Multiple      │                        │                          │
       │     Sources            │                        │                          │
       │ ◄─────────────────────┐│                        │                          │
       │                        │                        │                          │
       │  3. Some Sources       │                        │                          │
       │     Return Errors      │                        │                          │
       │ ─────────────────────► │                        │                          │
       │                        │                        │                          │
       │  4. Some Sources       │                        │                          │
       │     Return Valid Data  │                        │                          │
       │ ─────────────────────► │                        │                          │
       │                        │                        │                          │
       │                        │  5. Log Source         │                          │
       │                        │     Errors             │                          │
       │                        │ ────────────────────────────────────────────────► │
       │                        │                        │                          │
       │                        │  6. Record Error       │                          │
       │                        │     Metrics            │                          │
       │                        │ ─────────────────────► │                          │
       │                        │                        │                          │
       │                        │  7. Check If Minimum   │                          │
       │                        │     Valid Sources      │                          │
       │                        │     Threshold Met      │                          │
       │                        │ ◄────────────────────┐ │                          │
       │                        │                        │                          │
       │                        │  8A. If Threshold Met: │                          │
       │                        │      Proceed with      │                          │
       │                        │      Available Data    │                          │
       │                        │ ◄────────────────────┐ │                          │
       │                        │                        │                          │
       │                        │  9A. Calculate        │                          │
       │                        │      Consensus with    │                          │
       │                        │      Available Sources │                          │
       │                        │ ◄────────────────────┐ │                          │
       │                        │                        │                          │
       │                        │  10A. Store Aggregated │                          │
       │                        │       Price with       │                          │
       │                        │       Reduced          │                          │
       │                        │       Confidence Score │                          │
       │                        │ ─────────────────────► │                          │
       │                        │                        │                          │
       │                        │  8B. If Threshold Not  │                          │
       │                        │      Met: Initiate     │                          │
       │                        │      Fallback Procedure│                          │
       │                        │ ◄────────────────────┐ │                          │
       │                        │                        │                          │
       │                        │  9B. Retrieve Last     │                          │
       │                        │      Valid Price       │                          │
       │                        │ ─────────────────────► │                          │
       │                        │                        │                          │
       │                        │  10B. Return Last      │                          │
       │                        │       Valid Price      │                          │
       │                        │ ◄─────────────────────┐│                          │
       │                        │                        │                          │
       │                        │  11B. Store Fallback   │                          │
       │                        │       Status with      │                          │
       │                        │       Warning Flag     │                          │
       │                        │ ─────────────────────► │                          │
       │                        │                        │                          │
       │                        │  12. Trigger Alert if  │                          │
       │                        │      Multiple Failures │                          │
       │                        │      or Threshold Not  │                          │
       │                        │      Met               │                          │
       │                        │ ────────────────────────────────────────────────► │
       │                        │                        │                          │
```

#### 6.1.1 Step-by-Step Description

1. **Scheduled Price Fetch Job (Scheduler → Data Service)**

   - Regular price fetch job executes as scheduled
   - No difference from normal flow in initial triggering
   - Implementation in `convex/crons.ts` scheduled job

2. **Request Price Data (Data Service → External APIs)**

   - Service requests price data from multiple configured sources
   - Uses parallelized requests with appropriate timeouts
   - Implementation in `fetchPriceFromSources` function in `dataIngestion.ts`

3. **Some Sources Return Errors (External APIs → Data Service)**

   - Some API sources return errors or timeout
   - Errors may include rate limiting, service unavailability, or malformed responses
   - Error responses are captured for logging and analysis

4. **Some Sources Return Valid Data (External APIs → Data Service)**

   - Other sources successfully return price data
   - Valid responses continue through the normal processing flow
   - Data Service now has a mix of successful and failed responses

5. **Log Source Errors (Data Service → Monitoring)**

   - Service logs detailed information about source failures
   - Includes error type, source name, and timestamp
   - Logs directed to appropriate monitoring systems
   - Implementation in error handling blocks of fetch functions

6. **Record Error Metrics (Data Service → Database)**

   - Service updates error metrics in the database
   - Records source reliability statistics
   - Updates source failure counts and timestamps
   - Used for source quality tracking and potential blacklisting
   - Implementation in `recordSourceErrorMetrics` function

7. **Check Minimum Valid Sources Threshold (Data Service)**

   - Service checks if enough valid sources remain
   - Compares count of successful responses against minimum threshold
   - Typical threshold: 3 valid sources required for consensus
   - Implementation in validation function with configurable threshold

8. **Decision Path Based on Threshold (Data Service)**

   - Service follows one of two paths based on threshold check
   - 8A: If threshold met - proceed with available data
   - 8B: If threshold not met - initiate fallback procedure
   - Implementation uses conditional logic in main data processing function

9A. **Calculate Consensus with Available Sources (Data Service)**

- Service calculates consensus price from available valid sources
- May adjust aggregation algorithm for fewer sources
- Implements more conservative outlier detection
- Implementation in modified aggregation function

10A. **Store Aggregated Price with Reduced Confidence (Data Service → Database)**

- Service stores the calculated consensus price
- Includes metadata indicating reduced confidence
- Flags the record as operating with fewer sources
- May adjust volatility estimates to be more conservative
- Implementation in database storage function with additional metadata

9B. **Retrieve Last Valid Price (Data Service → Database)**

- In fallback mode, service queries for most recent valid price
- Looks for prices within acceptable age threshold (e.g., < 60 minutes old)
- Implementation in `getLastValidPrice` function

10B. **Return Last Valid Price (Database → Data Service)**

- Database returns the most recent valid price record
- Includes original timestamp and confidence score
- Service prepares to use this as a fallback value

11B. **Store Fallback Status with Warning (Data Service → Database)**

- Service stores a record indicating fallback mode is active
- Sets appropriate warning flags in system status
- Records timestamp and duration of fallback mode
- Implementation in status tracking functions

12. **Trigger Alert for Multiple Failures (Data Service → Monitoring)**

- Service sends alerts if failures persist across multiple cycles
- Escalates alert severity based on duration of issue
- Includes details on which sources are failing
- Implementation in monitoring integration code

### 6.2 Oracle State Reconciliation Flow

```
┌───────────────┐         ┌──────────────┐         ┌─────────────────┐
│               │         │              │         │                 │
│ Convex Backend│         │ Blockchain   │         │ Oracle          │
│ (Oracle Svc)  │         │ Network      │         │ Contract        │
│               │         │              │         │                 │
└───────┬───────┘         └──────┬───────┘         └────────┬────────┘
        │                        │                          │
        │                        │                          │
        │ 1. Scheduled           │                          │
        │    Reconciliation Job  │                          │
        │ ◄──────────────────────│                          │
        │                        │                          │
        │ 2. Fetch Latest Off-   │                          │
        │    Chain Oracle State  │                          │
        │ ◄──────────────────────│                          │
        │                        │                          │
        │ 3. Query On-Chain      │                          │
        │    Oracle State        │                          │
        │ ───────────────────────────────────────────────────►
        │                        │                          │
        │                        │ 4. Return Current        │
        │                        │    On-Chain State        │
        │                        │ ◄─────────────────────────
        │                        │                          │
        │ 5. Compare Off-Chain vs│                          │
        │    On-Chain State      │                          │
        │ ◄──────────────────────│                          │
        │                        │                          │
        │ 6. If Mismatch:        │                          │
        │    Update Off-Chain    │                          │
        │    State               │                          │
        │ ◄──────────────────────│                          │
        │                        │                          │
        │ 7. If Mismatch         │                          │
        │    Requires On-Chain   │                          │
        │    Update:             │                          │
        │ ◄──────────────────────│                          │
        │                        │                          │
        │ 8. Prepare & Submit    │                          │
        │    Transaction         │                          │
        │ ───────────────────────────────────────────────────►
        │                        │                          │
        │                        │ 9. Update On-Chain       │
        │                        │    State If Needed       │
        │                        │ ◄─────────────────────────
        │                        │                          │
        │ 10. Log Reconciliation │                          │
        │     Results            │                          │
        │ ◄──────────────────────│                          │
        │                        │                          │
```

#### 6.2.1 Step-by-Step Description

1. **Scheduled Reconciliation (Oracle Service)**

   - Scheduled job `reconcileOracleState` runs periodically (e.g., hourly)
   - Job is responsible for ensuring off-chain and on-chain oracle data is consistent
   - Implementation in `convex/crons.ts` or a dedicated reconciliation module

2. **Fetch Off-Chain Oracle State (Oracle Service)**

   - Service queries the latest off-chain oracle state from Convex database
   - Includes price, timestamp, and metadata
   - Implementation in oracle service query functions

3. **Query On-Chain Oracle State (Oracle Service → Oracle Contract)**

   - Service makes a read-only call to the Oracle contract
   - Retrieves current on-chain price and metadata
   - Uses blockchain API to query contract without transaction
   - Implementation in blockchain integration functions

4. **Return On-Chain State (Oracle Contract → Oracle Service)**

   - Contract returns current on-chain oracle state
   - Includes price, timestamp, and last submitter
   - Format follows contract data structure

5. **Compare States (Oracle Service)**

   - Service compares off-chain and on-chain state
   - Focuses on price value and timestamp
   - Calculates if difference exceeds acceptable threshold
   - Implementation in reconciliation function with configurable thresholds

6. **Update Off-Chain State if Needed (Oracle Service)**

   - If mismatch detected and on-chain is source of truth, updates off-chain state
   - Records reconciliation action in logs
   - Updates database with corrected values
   - Implementation in database update functions

7. **Check if On-Chain Update Needed (Oracle Service)**

   - If mismatch detected and off-chain is source of truth, prepares on-chain update
   - Applies business rules to determine if update is warranted
   - Considers recency of data and magnitude of discrepancy
   - Implementation in reconciliation decision function

8. **Prepare & Submit Transaction if Needed (Oracle Service → Blockchain)**

   - If on-chain update is needed, prepares a transaction
   - Signs with authorized backend principal
   - Submits to blockchain with appropriate parameters
   - Implementation in blockchain submission functions

9. **Update On-Chain State (Blockchain → Oracle Contract)**

   - Contract processes the update transaction
   - Verifies submitter authorization
   - Updates on-chain price data
   - Emits appropriate events
   - Implementation in contract functions

10. **Log Reconciliation Results (Oracle Service)**
    - Service logs results of reconciliation process
    - Records any actions taken and their outcomes
    - Updates system health metrics
    - Implementation in logging and monitoring integration

## 7. Conclusion

The Oracle component interaction flows documented above illustrate the comprehensive data pipeline that powers BitHedge's price oracle system. This system is designed with several key principles:

1. **Data Reliability**: By fetching from multiple sources, validating inputs, and implementing appropriate fallback mechanisms, the system ensures reliable price data even when individual sources fail.

2. **Real-Time Updates**: Regular scheduled jobs and efficient processing ensure that price data remains current and is promptly reflected in the UI.

3. **On-Chain/Off-Chain Coordination**: The hybrid architecture balances the efficiency of off-chain processing with the security and transparency of on-chain data storage.

4. **Historical Data Management**: Comprehensive historical data collection enables trend analysis, volatility calculation, and range determination that enhance the platform's risk assessment capabilities.

5. **Authorization Controls**: The authorized submitter system ensures that only trusted entities can update the on-chain oracle, while still allowing administrative interventions when needed.

6. **Error Resilience**: Robust error handling and reconciliation processes maintain system integrity even when components fail or states diverge.

The Oracle system serves as a critical foundation for the BitHedge platform, providing the reliable price data necessary for fair policy pricing, accurate risk assessment, and transparent settlement processes. The interaction flows detailed in this document ensure that all components work together seamlessly to provide users with the most accurate and timely information possible.
