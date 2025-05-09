# BitHedge Premium Calculation and Volatility: Component Interaction Flows

## 1. Introduction

This document details the interaction flows between components in the BitHedge platform related to premium calculation and volatility assessment. These flows illustrate how these critical processes integrate with the Oracle system, user interface, and blockchain components to provide accurate and fair policy pricing.

Premium calculation and volatility assessment are foundational to the BitHedge platform's operation, as they:

- Determine the cost of insurance policies
- Reflect current market risk conditions
- Balance user protection with provider yields
- Ensure sustainable risk management for the platform
- Provide transparency into pricing mechanisms

This document should be read in conjunction with the Oracle Component Interaction Flows document, as the premium calculation system relies heavily on the price data provided by the Oracle system.

## 2. Premium Calculation Flow

### 2.1 Flow Diagram

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐         ┌─────────────────┐         ┌─────────────┐
│             │         │               │         │              │         │                 │         │             │
│  Frontend   │         │ Convex Backend│         │ Oracle       │         │ Premium         │         │ Blockchain  │
│  Components │         │ (Quote Svc)   │         │ Service      │         │ Calculator      │         │ Validation  │
│             │         │               │         │              │         │                 │         │             │
└──────┬──────┘         └───────┬───────┘         └──────┬───────┘         └────────┬────────┘         └─────┬───────┘
       │                        │                        │                          │                        │
       │                        │                        │                          │                        │
       │  1. User Inputs        │                        │                          │                        │
       │     Policy Parameters  │                        │                          │                        │
       │ ◄────────────────────┐ │                        │                          │                        │
       │                        │                        │                          │                        │
       │  2. Request Premium    │                        │                          │                        │
       │     Calculation        │                        │                          │                        │
       │ ─────────────────────► │                        │                          │                        │
       │                        │                        │                          │                        │
       │                        │  3. Validate Policy    │                          │                        │
       │                        │     Parameters         │                          │                        │
       │                        │ ◄────────────────────┐ │                          │                        │
       │                        │                        │                          │                        │
       │                        │  4. Normalize Units    │                          │                        │
       │                        │     & Parameters       │                          │                        │
       │                        │ ◄────────────────────┐ │                          │                        │
       │                        │                        │                          │                        │
       │                        │  5. Request Current    │                          │                        │
       │                        │     Bitcoin Price &    │                          │                        │
       │                        │     Volatility         │                          │                        │
       │                        │ ─────────────────────► │                          │                        │
       │                        │                        │                          │                        │
       │                        │  6. Return Price       │                          │                        │
       │                        │     & Volatility Data  │                          │                        │
       │                        │ ◄─────────────────────┐│                          │                        │
       │                        │                        │                          │                        │
       │                        │  7. Calculate Base     │                          │                        │
       │                        │     Premium            │                          │                        │
       │                        │ ─────────────────────────────────────────────────►│                        │
       │                        │                        │                          │                        │
       │                        │                        │                          │  8. Apply Volatility   │
       │                        │                        │                          │     Factor             │
       │                        │                        │                          │ ◄────────────────────┐ │
       │                        │                        │                          │                        │
       │                        │                        │                          │  9. Apply Time-Based   │
       │                        │                        │                          │     Factors            │
       │                        │                        │                          │ ◄────────────────────┐ │
       │                        │                        │                          │                        │
       │                        │                        │                          │  10. Apply Coverage    │
       │                        │                        │                          │      Amount Factor     │
       │                        │                        │                          │ ◄────────────────────┐ │
       │                        │                        │                          │                        │
       │                        │                        │                          │  11. Apply Strike      │
       │                        │                        │                          │      Price Factor      │
       │                        │                        │                          │ ◄────────────────────┐ │
       │                        │                        │                          │                        │
       │                        │                        │                          │  12. Apply Other       │
       │                        │                        │                          │      Adjustment        │
       │                        │                        │                          │      Factors           │
       │                        │                        │                          │ ◄────────────────────┐ │
       │                        │                        │                          │                        │
       │                        │  13. Return Final      │                          │                        │
       │                        │      Premium Amount    │                          │                        │
       │                        │ ◄─────────────────────────────────────────────────│                        │
       │                        │                        │                          │                        │
       │                        │  14. Verify Against    │                          │                        │
       │                        │      Blockchain Rules  │                          │                        │
       │                        │ ─────────────────────────────────────────────────────────────────────────►│
       │                        │                        │                          │                        │
       │                        │  15. Return Validation │                          │                        │
       │                        │      Result            │                          │                        │
       │                        │ ◄─────────────────────────────────────────────────────────────────────────│
       │                        │                        │                          │                        │
       │  16. Return Premium    │                        │                          │                        │
       │      Quote with        │                        │                          │                        │
       │      Breakdown         │                        │                          │                        │
       │ ◄─────────────────────┐│                        │                          │                        │
       │                        │                        │                          │                        │
       │  17. Display Premium   │                        │                          │                        │
       │      in UI             │                        │                          │                        │
       │ ◄────────────────────┐ │                        │                          │                        │
       │                        │                        │                          │                        │
```

### 2.2 Step-by-Step Description

1. **User Inputs Policy Parameters (User → Frontend)**

   - User interacts with policy creation interface in BuyerParametersUI.tsx or ProviderParametersUI.tsx
   - Sets parameters including:
     - Protected value (strike price)
     - Protection amount (coverage)
     - Policy duration (time period)
     - Policy type (PUT option)
   - Implementation in `front-end/src/components/BitHedge/BuyerParametersUI.tsx`

2. **Request Premium Calculation (Frontend → Convex)**

   - Frontend submits parameters to Convex action `calculatePremium`
   - Request packaged with user parameters
   - Implementation in `front-end/src/components/BitHedge/PolicySummary.tsx`
   - Makes action call to `api.quotes.calculatePremium`

3. **Validate Policy Parameters (Convex)**

   - Backend validates all user inputs against business rules:
     - Strike price within allowed ranges
     - Coverage amount within platform limits
     - Duration within acceptable time periods
     - Valid policy type
   - Implementation in `convex/quotes.ts` and validation helpers

4. **Normalize Units & Parameters (Convex)**

   - Converts all values to consistent units:
     - USD amounts to satoshis where needed
     - Time periods to block heights
     - Percentage values to decimal format
   - Implementation in utility functions in `convex/premium.ts`

5. **Request Current Price & Volatility (Convex → Oracle Service)**

   - Quotes service requests current BTC price and volatility metrics
   - Makes internal query to Oracle service for latest data
   - Implementation in `convex/premium.ts` calling Oracle service APIs

6. **Return Price & Volatility Data (Oracle Service → Convex)**

   - Oracle service returns:
     - Current BTC/USD price
     - Current volatility measurement
     - Data confidence metrics
   - Implementation via internal queries to `convex/services/oracle/priceService.ts`

7. **Calculate Base Premium (Convex → Premium Calculator)**

   - Convex passes normalized parameters to premium calculation engine
   - Implementation in `convex/premium.ts` which contains the core premium calculation logic
   - Prepares context object with all parameters for premium calculation

8. **Apply Volatility Factor (Premium Calculator)**

   - Applies current market volatility as a multiplier to base premium
   - Higher volatility = higher premium
   - Implementation uses volatility curves defined in `convex/premium.ts`
   - Formula typically involves Black-Scholes option pricing model components

9. **Apply Time-Based Factors (Premium Calculator)**

   - Calculates time value component of premium
   - Longer duration = higher premium
   - Uses time decay curves appropriate to option type
   - Implementation in time factor functions in `convex/premium.ts`

10. **Apply Coverage Amount Factor (Premium Calculator)**

    - Adjusts premium based on coverage amount
    - May apply tiered pricing or volume discounts
    - Ensures premium scales appropriately with coverage
    - Implementation in amount factor functions in `convex/premium.ts`

11. **Apply Strike Price Factor (Premium Calculator)**

    - Adjusts premium based on how far the strike price is from current price
    - For PUT options, lower strike price = lower premium
    - Implements "moneyness" factors from option pricing theory
    - Implementation in strike factor functions in `convex/premium.ts`

12. **Apply Other Adjustment Factors (Premium Calculator)**

    - Applies additional adjustments like:
      - Platform fee component
      - Risk tier adjustments
      - Liquidity pool health factor
      - Market demand factor
    - Implementation in various adjustment functions in `convex/premium.ts`

13. **Return Final Premium Amount (Premium Calculator → Convex)**

    - Calculator returns final premium amount
    - Includes breakdown of different premium components
    - Format: `{ premium: number, components: { base: number, volatility: number, time: number, ... } }`
    - Implementation as return value from premium calculation function

14. **Verify Against Blockchain Rules (Convex → Blockchain Validation)**

    - Optional step to validate premium against on-chain rules
    - Ensures premium calculation aligns with smart contract expectations
    - May use read-only contract call to validate premium
    - Implementation in `convex/blockchainIntegration.ts`

15. **Return Validation Result (Blockchain Validation → Convex)**

    - Returns validation status and any adjustments needed
    - Ensures quotes match what contracts will accept
    - Implementation in validation result handler

16. **Return Premium Quote with Breakdown (Convex → Frontend)**

    - Convex returns complete premium quote to frontend
    - Includes total amount and component breakdown
    - May include recommended parameters or alternative quotes
    - Implementation in response handling in `quotes.ts`

17. **Display Premium in UI (Frontend)**

    - Frontend displays premium quote to user
    - Updates PolicySummary.tsx with premium amount
    - Shows premium breakdown if requested
    - Formats currency values appropriately
    - Implementation in `front-end/src/components/BitHedge/PolicySummary.tsx`

## 3. Volatility Assessment Flow

### 3.1 Flow Diagram

```
┌─────────────┐         ┌───────────────┐         ┌────────────────┐         ┌─────────────────┐
│             │         │               │         │                │         │                 │
│  Historical │         │ Convex Backend│         │ Volatility     │         │ Convex          │
│  Price Data │         │ (Oracle Svc)  │         │ Calculator     │         │ Database        │
│             │         │               │         │                │         │                 │
└──────┬──────┘         └───────┬───────┘         └────────┬───────┘         └────────┬────────┘
       │                        │                          │                          │
       │                        │                          │                          │
       │  1. Scheduled          │                          │                          │
       │     Volatility Update  │                          │                          │
       │     Job                │                          │                          │
       │ ◄────────────────────┐ │                          │                          │
       │                        │                          │                          │
       │  2. Fetch Historical   │                          │                          │
       │     Price Data         │                          │                          │
       │ ─────────────────────► │                          │                          │
       │                        │                          │                          │
       │  3. Return Price       │                          │                          │
       │     History            │                          │                          │
       │ ◄─────────────────────┐│                          │                          │
       │                        │                          │                          │
       │                        │  4. Prepare Data Series  │                          │
       │                        │     for Multiple         │                          │
       │                        │     Timeframes           │                          │
       │                        │ ◄────────────────────────┘                          │
       │                        │                          │                          │
       │                        │  5. Calculate Intraday   │                          │
       │                        │     Volatility (24h)     │                          │
       │                        │ ─────────────────────────►                          │
       │                        │                          │                          │
       │                        │  6. Return Short-Term    │                          │
       │                        │     Volatility           │                          │
       │                        │ ◄─────────────────────────                          │
       │                        │                          │                          │
       │                        │  7. Calculate Medium-    │                          │
       │                        │     Term Volatility      │                          │
       │                        │     (7-day)              │                          │
       │                        │ ─────────────────────────►                          │
       │                        │                          │                          │
       │                        │  8. Return Medium-Term   │                          │
       │                        │     Volatility           │                          │
       │                        │ ◄─────────────────────────                          │
       │                        │                          │                          │
       │                        │  9. Calculate Long-Term  │                          │
       │                        │     Volatility (30-day)  │                          │
       │                        │ ─────────────────────────►                          │
       │                        │                          │                          │
       │                        │  10. Return Long-Term    │                          │
       │                        │      Volatility          │                          │
       │                        │ ◄─────────────────────────                          │
       │                        │                          │                          │
       │                        │  11. Calculate Weighted  │                          │
       │                        │      Composite           │                          │
       │                        │      Volatility          │                          │
       │                        │ ◄────────────────────────┘                          │
       │                        │                          │                          │
       │                        │  12. Store Volatility    │                          │
       │                        │      Metrics in Database │                          │
       │                        │ ─────────────────────────────────────────────────► │
       │                        │                          │                          │
       │                        │  13. Update Volatility   │                          │
       │                        │      Trend Indicators    │                          │
       │                        │ ◄───────────────────────┐│                          │
       │                        │                          │                          │
       │                        │  14. Store Volatility    │                          │
       │                        │      Trend Data          │                          │
       │                        │ ─────────────────────────────────────────────────► │
       │                        │                          │                          │
```

### 3.2 Step-by-Step Description

1. **Scheduled Volatility Update Job (Scheduler → Oracle Service)**

   - Scheduled job `calculateVolatilityMetrics` runs at regular intervals (e.g., hourly)
   - Defined in `convex/crons.ts` using Convex's scheduling system
   - Triggers the volatility calculation process
   - Implementation in volatility calculation job handler

2. **Fetch Historical Price Data (Oracle Service → Historical Data)**

   - Service queries for historical price data across multiple timeframes
   - Typically requests:
     - 24-hour data at minute intervals
     - 7-day data at hourly intervals
     - 30-day data at daily intervals
   - Implementation in `convex/services/oracle/historicalData.ts`

3. **Return Price History (Historical Data → Oracle Service)**

   - Returns historical price arrays for each timeframe
   - Data is cleaned and normalized (no gaps, consistent intervals)
   - Implementation in historical data retrieval functions

4. **Prepare Data Series for Multiple Timeframes (Oracle Service)**

   - Service processes raw price data into standardized time series
   - Handles missing data points through interpolation if needed
   - Ensures data quality and consistency
   - Implementation in data preparation utilities in Oracle service

5. **Calculate Intraday Volatility (Oracle Service → Volatility Calculator)**

   - Passes 24-hour price data to volatility calculator
   - Requests calculation of short-term volatility
   - Implementation in `calculateVolatility` function with timeframe parameter

6. **Return Short-Term Volatility (Volatility Calculator → Oracle Service)**

   - Calculator returns 24-hour volatility measurement
   - Typically uses standard deviation of log returns
   - Implementation in volatility calculation algorithm

7. **Calculate Medium-Term Volatility (Oracle Service → Volatility Calculator)**

   - Passes 7-day price data to volatility calculator
   - Uses same algorithm but with longer timeframe
   - Implementation in `calculateVolatility` function with 7-day parameter

8. **Return Medium-Term Volatility (Volatility Calculator → Oracle Service)**

   - Calculator returns 7-day volatility measurement
   - May be annualized for standardization
   - Implementation in volatility calculation result processor

9. **Calculate Long-Term Volatility (Oracle Service → Volatility Calculator)**

   - Passes 30-day price data to volatility calculator
   - Uses same algorithm with longest timeframe
   - Implementation in `calculateVolatility` function with 30-day parameter

10. **Return Long-Term Volatility (Volatility Calculator → Oracle Service)**

    - Calculator returns 30-day volatility measurement
    - Typically used as the primary volatility indicator
    - Implementation in volatility calculation result processor

11. **Calculate Weighted Composite Volatility (Oracle Service)**

    - Service combines multiple volatility measurements into single metric
    - Uses weighted average based on relevance to premium calculation
    - May apply additional smoothing or adjustment factors
    - Implementation in composite volatility calculation function

12. **Store Volatility Metrics in Database (Oracle Service → Database)**

    - Service stores all volatility metrics in database:
      - Individual timeframe measurements
      - Composite volatility value
      - Timestamp and calculation metadata
    - Implementation in database operations in Oracle service

13. **Update Volatility Trend Indicators (Oracle Service)**

    - Service calculates trend information from historical volatility data
    - Determines if volatility is increasing, decreasing, or stable
    - Sets volatility regime indicators (low/medium/high)
    - Implementation in trend analysis functions

14. **Store Volatility Trend Data (Oracle Service → Database)**

    - Service stores trend indicators and volatility regime
    - Updates time series for volatility tracking
    - Implementation in database operations for trend data

## 4. Real-Time Premium Sensitivity Flow

### 4.1 Flow Diagram

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐
│             │         │               │         │              │
│  Frontend   │         │ Convex Backend│         │ Premium      │
│  Components │         │ (Quote Svc)   │         │ Calculator   │
│             │         │               │         │              │
└──────┬──────┘         └───────┬───────┘         └──────┬───────┘
       │                        │                        │
       │                        │                        │
       │  1. User Adjusts       │                        │
       │     Policy Parameter   │                        │
       │ ◄────────────────────┐ │                        │
       │                        │                        │
       │  2. Request Premium    │                        │
       │     Sensitivity Analysis│                       │
       │ ─────────────────────► │                        │
       │                        │                        │
       │                        │  3. Generate Parameter │
       │                        │     Variations         │
       │                        │ ◄────────────────────┐ │
       │                        │                        │
       │                        │  4. Calculate Premium  │
       │                        │     for Each Variation │
       │                        │ ─────────────────────► │
       │                        │                        │
       │                        │  5. Return Multiple    │
       │                        │     Premium Calculations│
       │                        │ ◄─────────────────────┐│
       │                        │                        │
       │                        │  6. Generate           │
       │                        │     Sensitivity Data   │
       │                        │ ◄────────────────────┐ │
       │                        │                        │
       │  7. Return Sensitivity │                        │
       │     Data & Charts      │                        │
       │ ◄─────────────────────┐│                        │
       │                        │                        │
       │  8. Update Sensitivity │                        │
       │     Visualization      │                        │
       │ ◄────────────────────┐ │                        │
       │                        │                        │
```

### 4.2 Step-by-Step Description

1. **User Adjusts Policy Parameter (User → Frontend)**

   - User interacts with policy parameter controls in UI
   - Changes strike price, coverage amount, or duration
   - Implemented in slider components in BuyerParametersUI.tsx or ProviderParametersUI.tsx
   - UI component uses debounce to limit update frequency

2. **Request Premium Sensitivity Analysis (Frontend → Convex)**

   - Frontend calls Convex action to analyze parameter sensitivity
   - Sends current parameters and which one is being adjusted
   - Implementation in parameter change handlers in UI components

3. **Generate Parameter Variations (Convex)**

   - Backend generates variations around the current parameters
   - Creates array of test points (e.g., ±10%, ±20%, etc.)
   - Implementation in sensitivity analysis utility in quotes service

4. **Calculate Premium for Each Variation (Convex → Premium Calculator)**

   - Convex calls premium calculator for each parameter variation
   - May use optimized batch calculation for efficiency
   - Implementation in `calculatePremiumSensitivity` function

5. **Return Multiple Premium Calculations (Premium Calculator → Convex)**

   - Calculator returns array of premium results for different parameter values
   - Each result includes parameter value and corresponding premium
   - Implementation in batch premium calculation handler

6. **Generate Sensitivity Data (Convex)**

   - Backend processes raw premium variation data
   - Calculates sensitivity metrics (e.g., elasticity)
   - Formats data for visualization
   - Implementation in sensitivity data processor in quotes service

7. **Return Sensitivity Data & Charts (Convex → Frontend)**

   - Backend returns formatted sensitivity data to frontend
   - Includes data points for charts and key metrics
   - Implementation in response handler for sensitivity analysis

8. **Update Sensitivity Visualization (Frontend)**

   - Frontend updates visualizations with new sensitivity data
   - Renders price impact charts
   - Shows how premium changes with parameter adjustments
   - Implementation in visualization components like ProtectionVisualization.tsx
