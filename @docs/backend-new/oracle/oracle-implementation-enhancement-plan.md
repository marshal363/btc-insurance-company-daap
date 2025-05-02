# BitHedge Oracle Implementation Enhancement Plan

## Introduction

This document outlines the enhancement plan for the BitHedge Oracle implementation based on lessons learned from the exploration implementation and analysis. The plan focuses on leveraging the strengths of the Convex platform while addressing identified areas for improvement.

## Task Status Legend

| Status      | Symbol | Description                                   |
| ----------- | ------ | --------------------------------------------- |
| Not Started | ⬜     | Task has not been started yet                 |
| In Progress | 🟡     | Task is actively being worked on              |
| Blocked     | 🔴     | Task is blocked by unresolved dependencies    |
| Testing     | 🟣     | Implementation complete, currently in testing |
| Completed   | 🟢     | Task fully completed and verified             |
| Deferred    | ⚪     | Task postponed to a future development cycle  |

## Overall Progress Dashboard

| Enhancement Area                     | Total Tasks | Not Started | In Progress | Completed | Completion % |
| ------------------------------------ | ----------- | ----------- | ----------- | --------- | ------------ |
| Price Source Expansion & Aggregation | 10          | 3           | 0           | 7         | 70%          |
| Volatility Calculation Enhancement   | 24          | 10          | 1           | 13        | 54%          |
| Data Management & Performance Opt.   | 4           | 3           | 1           | 0         | 0%           |
| Premium Calculation Advancement      | 6           | 2           | 0           | 4         | 67%          |
| Resilience and Error Handling        | 5           | 4           | 1           | 0         | 0%           |
| Monitoring and Alerting System       | 6           | 4           | 2           | 0         | 0%           |
| Real-time Capabilities               | 4           | 4           | 0           | 0         | 0%           |
| **Overall Project**                  | **59**      | **30**      | **5**       | **24**    | **41%**      |

_Note: Task counts and estimates are initial values and may be refined._

## Key Enhancement Areas

### 1. Price Source Expansion and Aggregation

**Current State**: The Convex implementation uses a limited set of price sources with a basic weighted average approach.

**Enhancement Tasks**:

| Task ID | Description                                                              | Est. Hours | Status | Dependencies | Assignee |
| ------- | ------------------------------------------------------------------------ | ---------- | ------ | ------------ | -------- |
| PEA-101 | Implement CoinGecko price feed API client and parser                     | 3          | 🟢     | -            |          |
| PEA-102 | Implement Binance US price feed API client and parser                    | 3          | 🟢     | -            |          |
| PEA-103 | Implement Coinbase price feed API client and parser                      | 3          | 🟢     | -            |          |
| PEA-104 | Implement Kraken price feed API client and parser                        | 3          | 🟢     | -            |          |
| PEA-105 | Implement Bitfinex price feed API client and parser                      | 3          | 🟢     | -            |          |
| PEA-106 | Implement Gemini price feed API client and parser                        | 3          | 🟢     | -            |          |
| PEA-107 | Implement Bitstamp price feed API client and parser                      | 3          | 🟢     | -            |          |
| PEA-108 | Implement advanced statistical filtering and outlier detection mechanism | 6          | 🟢     | PEA-101..107 |          |
| PEA-109 | Develop dynamic source reliability tracking and weight adjustment        | 5          | ⬜     | PEA-108      |          |
| PEA-110 | Implement confidence scoring for aggregated prices                       | 5          | ⬜     | PEA-108      |          |

### 2. Volatility Calculation Enhancement

**Current State**: Basic volatility calculation with limited historical data.

**Enhancement Tasks**:

- **Historical Price Data Requirements**:

  | Task ID | Description                                                                    | Est. Hours | Status | Dependencies | Assignee |
  | ------- | ------------------------------------------------------------------------------ | ---------- | ------ | ------------ | -------- |
  | VCE-201 | Define schema for historical daily closing prices (min. 360 days)              | 2          | 🟢     | -            |          |
  | VCE-202 | Implement one-time bulk fetch of 360+ days historical data (CoinGecko primary) | 8          | 🟢     | VCE-201      |          |
  | VCE-203 | Implement fallback historical data fetch (CryptoCompare)                       | 4          | 🟢     | VCE-201      |          |
  | VCE-204 | Implement fallback historical data fetch (CCXT)                                | 6          | ⬜     | VCE-201      |          |
  | VCE-205 | Implement daily scheduled job for fetching latest daily closing price          | 4          | 🟢     | VCE-201      |          |
  | VCE-206 | Implement error handling and fallback logic for daily price fetch              | 3          | 🟢     | VCE-205      |          |

- **Volatility Calculation for Multiple Time Windows**:

  | Task ID | Description                                                                          | Est. Hours | Status | Dependencies     | Assignee |
  | ------- | ------------------------------------------------------------------------------------ | ---------- | ------ | ---------------- | -------- |
  | VCE-210 | Define schema for storing volatility metrics (30, 60, 90, 180, 360 days)             | 2          | 🟢     | -                |          |
  | VCE-211 | Implement core volatility calculation function (std dev of log returns)              | 5          | 🟢     | VCE-201          |          |
  | VCE-212 | Integrate function to calculate and store volatility for all required timeframes     | 4          | 🟢     | VCE-210, VCE-211 |          |
  | VCE-213 | Trigger volatility recalculation after daily price fetch                             | 2          | 🟢     | VCE-205, VCE-212 |          |
  | VCE-214 | Implement weight-based volatility model logic based on option duration (placeholder) | 3          | 🟢     | VCE-212          |          |

  _Implementation Notes (VCE-214):_

  - Implemented as `internal.prices.getVolatilityForDuration` query.
  - Uses closest standard timeframe (30, 60, 90, 180, 360) with fallback.
  - **Next Steps:** Integrate this query into premium calculation (PCA-401/402).
  - **Future:** Update to handle multiple calculation methods per VCE-232 strategy.
  - **Future:** Ensure consuming functions handle potential `null` return robustly.

- **Numerical Computation Libraries Integration**:

  | Task ID | Description                                                                             | Est. Hours | Status | Dependencies | Assignee |
  | ------- | --------------------------------------------------------------------------------------- | ---------- | ------ | ------------ | -------- |
  | VCE-220 | Integrate Danfo.js for time series manipulation in volatility calculation               | 6          | ⬜     | VCE-211      |          |
  | VCE-221 | Integrate NumJs for efficient array operations (if needed beyond Danfo.js)              | 4          | ⬜     | VCE-211      |          |
  | VCE-222 | Integrate math.js for advanced mathematical functions (if needed beyond Danfo.js/NumJs) | 3          | 🟢     | VCE-211      |          |

  _Note: Code snippets for libraries like Danfo.js, CCXT, etc., demonstrate concepts. Actual implementation will use Convex actions/mutations and adapt syntax._

  ```typescript
  // Example Danfo.js usage concept (adapt for Convex)
  // import { Series } from "danfojs";
  // function calculateHistoricalVolatility(...) { ... }
  ```

- **Multiple Volatility Calculation Methodologies**:

  | Task ID | Description                                                                       | Est. Hours | Status | Dependencies      | Assignee |
  | ------- | --------------------------------------------------------------------------------- | ---------- | ------ | ----------------- | -------- |
  | VCE-230 | Implement Parkinson's volatility calculation method (using high/low if available) | 5          | ⬜     | VCE-201           |          |
  | VCE-231 | Implement EWMA volatility calculation method                                      | 5          | 🟡     | VCE-201           |          |
  | VCE-232 | Design strategy for selecting/combining volatility methods based on context       | 3          | ⬜     | VCE-211, 230, 231 |          |

- **Enhanced Historical Data Fetching (Example Snippets)**:

  _Note: These snippets illustrate external library usage. Integration requires Convex actions._

  ```typescript
  // CCXT Example Concept (Adapt for Convex Action)
  // import ccxt from "ccxt";
  // async function fetchHistoricalPrices(...) { ... }
  ```

  ```typescript
  // CryptoCompare API Example Concept (Adapt for Convex Action)
  // async function fetchHistoricalPrices(...) { ... }
  ```

  ```typescript
  // Daily Update Function Concept (Adapt for Convex Scheduled Action)
  // async function fetchLatestDailyPrice() { ... }
  // async function calculateAndStoreAllVolatilities() { ... } // Likely a separate internal mutation/query
  ```

- **Storing Historical Volatility**:

  | Task ID | Description                                                          | Est. Hours | Status | Dependencies | Assignee |
  | ------- | -------------------------------------------------------------------- | ---------- | ------ | ------------ | -------- |
  | VCE-240 | Ensure historical volatility metrics are stored with timestamps      | 2          | 🟢     | VCE-210      |          |
  | VCE-241 | Implement query to retrieve volatility for specific timeframes/dates | 3          | 🟢     | VCE-210      |          |

### 3. Data Management and Performance Optimization

**Current State**: Basic storage in Convex tables without explicit data pruning or advanced caching.

**Enhancement Tasks**:

| Task ID | Description                                                       | Est. Hours | Status | Dependencies     | Assignee |
| ------- | ----------------------------------------------------------------- | ---------- | ------ | ---------------- | -------- |
| DMP-301 | Design and implement tiered data storage strategy (if applicable) | 5          | ⬜     | -                |          |
| DMP-302 | Develop intelligent caching strategies for price/volatility data  | 6          | 🟡     | PEA-110, VCE-241 |          |
| DMP-303 | Implement data pruning/archiving mechanisms for historical data   | 5          | ⬜     | VCE-201          |          |
| DMP-304 | Add performance monitoring hooks and optimize critical queries    | 4          | ⬜     | -                |          |

### 4. Premium Calculation Advancement

**Current State**: Simplified model with TODO note for full Black-Scholes implementation.

**Enhancement Tasks**:

| Task ID | Description                                                                       | Est. Hours | Status | Dependencies     | Assignee |
| ------- | --------------------------------------------------------------------------------- | ---------- | ------ | ---------------- | -------- |
| PCA-401 | Implement full Black-Scholes model using math.js within a Convex function         | 8          | 🟢     | math.js integ.   |          |
| PCA-402 | Integrate dynamic volatility (based on option duration/VCE-214) into B-S call     | 4          | 🟢     | PCA-401, VCE-214 |          |
| PCA-403 | Integrate other risk factors (Liquidity, Network Health, Macro - placeholders)    | 6          | ⬜     | PCA-401          |          |
| PCA-404 | Design structure for scenario simulation engine (inputs, outputs)                 | 5          | ⬜     | PCA-401          |          |
| PCA-405 | Implement basic scenario simulation capability                                    | 7          | 🟢     | PCA-404          |          |
| PCA-406 | Create backtesting framework to validate premium calculations against historicals | 8          | 🟢     | VCE-201, PCA-401 |          |

_Note: The Black-Scholes snippet illustrates the formula. Implementation needs to be within a Convex function._

```typescript
// Black-Scholes Example Concept (Adapt for Convex Function)
// import * as math from "mathjs";
// function blackScholes(...) { ... } // Needs Convex query/mutation wrapper
```

### 5. Resilience and Error Handling

**Current State**: Basic error catching with limited fallback mechanisms.

**Enhancement Tasks**:

| Task ID | Description                                                             | Est. Hours | Status | Dependencies | Assignee |
| ------- | ----------------------------------------------------------------------- | ---------- | ------ | ------------ | -------- |
| REH-501 | Implement circuit breakers for external price/data API calls            | 6          | ⬜     | PEA-101..107 |          |
| REH-502 | Develop sophisticated fallback strategies (e.g., use last known, cache) | 5          | ⬜     | REH-501      |          |
| REH-503 | Implement rate limit handling specific to each API source               | 4          | ⬜     | PEA-101..107 |          |
| REH-504 | Create a health check system/function for external dependencies         | 4          | 🟡     | PEA-101..107 |          |
| REH-505 | Implement automatic recovery procedures for common failures (optional)  | 5          | ⬜     | REH-501      |          |

### 6. Monitoring and Alerting System

**Current State**: Limited monitoring capabilities.

**Enhancement Tasks**:

| Task ID | Description                                                               | Est. Hours | Status | Dependencies | Assignee |
| ------- | ------------------------------------------------------------------------- | ---------- | ------ | ------------ | -------- |
| MAS-601 | Implement comprehensive logging across all critical functions/actions     | 4          | 🟡     | -            |          |
| MAS-602 | Implement metrics collection (API performance, price variance, calc perf) | 6          | 🟡     | -            |          |
| MAS-603 | Develop alerting system for price anomalies                               | 5          | ⬜     | PEA-108      |          |
| MAS-604 | Develop alerting system for API failures / high error rates               | 4          | ⬜     | REH-504      |          |
| MAS-605 | Develop alerting system for calculation errors/inconsistencies            | 4          | ⬜     | PCA-401      |          |
| MAS-606 | Build basic monitoring dashboard data endpoints in Convex                 | 6          | ⬜     | MAS-602      |          |

### 7. Real-time Capabilities

**Current State**: Uses scheduled jobs with fixed intervals.

**Enhancement Tasks**:

| Task ID | Description                                                                      | Est. Hours | Status | Dependencies | Assignee |
| ------- | -------------------------------------------------------------------------------- | ---------- | ------ | ------------ | -------- |
| RTC-701 | Implement WebSocket connections for supported exchanges (Binance, Coinbase, etc) | 8          | ⬜     | -            |          |
| RTC-702 | Develop adaptive scheduling logic based on market volatility/conditions          | 6          | ⬜     | VCE-211      |          |
| RTC-703 | Create real-time notification system (e.g., push updates via Convex)             | 5          | ⬜     | -            |          |
| RTC-704 | Optimize real-time data flow from Convex to potential frontend components        | 4          | ⬜     | RTC-703      |          |

## Implementation Strategy (Phased Rollout)

The implementation will follow a phased approach, aligning roughly with the sections above but allowing for parallel work. Task dependencies should guide the exact sequencing.

1.  **Phase 1: Core Data & Calculation Foundations**

    - Focus: PEA-101..107, VCE-201, VCE-210, VCE-211, PCA-401, MAS-601.
    - Goal: Establish basic multi-source price fetching, historical data storage schema, core volatility calculation, basic Black-Scholes, and initial logging.

2.  **Phase 2: Enhance Aggregation & Volatility**

    - Focus: PEA-108..110, VCE-202..206, VCE-212, VCE-213, VCE-240, VCE-241, REH-503, REH-504.
    - Goal: Implement robust aggregation, fetch historical data, calculate multiple volatility timeframes, handle API limits/health.

3.  **Phase 3: Advanced Calculations & Resilience**

    - Focus: VCE-214, VCE-220..232, PCA-402..406, REH-501, REH-502, MAS-602..605.
    - Goal: Integrate advanced libraries, refine premium calculation with risk factors, build resilience (circuit breakers, fallbacks), implement core monitoring/alerting.

4.  **Phase 4: Optimization, Real-time & Monitoring UI**
    - Focus: DMP-301..304, RTC-701..704, MAS-606.
    - Goal: Optimize data handling, implement real-time capabilities (WebSockets, adaptive scheduling), build monitoring dashboard endpoints.

_This phased strategy is a suggestion; the specific task order will depend on team capacity and evolving priorities._

## Library Dependencies

To implement these enhancements, the following library dependencies might be required within Convex actions/functions (ensure they are compatible with the Convex environment):

```json
{
  "dependencies": {
    "axios": "^1.4.0", // For HTTP requests in actions
    "ccxt": "^3.0.0", // If used within an action for historical data
    "danfojs-node": "^1.1.2", // If used within an action/function
    "mathjs": "^11.8.0", // For calculations within functions/mutations
    "numjs": "^0.16.1" // If used within an action/function
    // Note: Check Convex documentation for supported libraries and patterns
  }
}
```

## Conclusion

This enhancement plan, now structured with trackable tasks, leverages the lessons learned from exploration while building on the Convex implementation. Addressing each key area systematically will create a more robust, accurate, and resilient oracle system for BitHedge. The focus remains on accuracy, reliability, performance, and scalability, implemented incrementally.

## Implementation Timeline for Historical Data Requirements (Revised as Tasks)

This section is now integrated into the task tables under **Volatility Calculation Enhancement (VCE-\*)**. Key tasks related to the original timeline points:

1.  **Data Source Setup and Initial Fetch**: VCE-201, VCE-202, VCE-203, VCE-204
2.  **Volatility Calculation Framework**: VCE-210, VCE-211, VCE-212, VCE-240, VCE-241
3.  **Daily Update Mechanism**: VCE-205, VCE-206, VCE-213
4.  **Integration with Premium Calculation**: PCA-402, VCE-214
5.  **Testing and Optimization**: Integrated into specific tasks (e.g., PCA-406, DMP-304) and requires a separate QA plan.

This task-based approach allows for clearer tracking of progress on these critical components.

_End of Document Notes (Added [Current Date]):_

- Completed PCA-401 (Black-Scholes) & PCA-402 (Dynamic Vol Integration) using VCE-222 (math.js).
- **Next Steps Recommendation:** Focus on implementing alternative volatility methods (VCE-230 Parkinson's, VCE-231 EWMA) OR continue with Premium Calculation advancements (PCA-403 Risk Factors, PCA-404/405 Scenario Simulation).

## MVP Scope Analysis and Final Task Recommendations ([Current Date])

**Objective:** Define the minimum viable set of tasks required to ship a simple but well-structured oracle, volatility, and premium calculation system, given the current progress and limited MVP timeline.

**Current MVP-Ready Core Functionality:**

Based on completed tasks (`🟢`), the following core pipeline is functional:

1.  **Price Fetching & Basic Aggregation:** Implemented (`PEA-101` to `PEA-107`, basic aggregation in `convex/prices.ts`).
2.  **Historical Data:** Fetching, fallback, and daily updates are implemented (`VCE-201`, `VCE-202`, `VCE-203`, `VCE-205`, `VCE-206`).
3.  **Standard Volatility:** Calculation and storage for standard timeframes (`VCE-210`, `VCE-211`, `VCE-212`, `VCE-213`, `VCE-240`, `VCE-241`).
4.  **Dynamic Volatility Selection:** Implemented (`VCE-214`).
5.  **Core Premium Calculation:** Black-Scholes implemented (`PCA-401`), using `math.js` (`VCE-222`) and dynamic volatility (`PCA-402`).

**Final MVP Task Prioritization:**

1.  **Required for MVP Launch:**

    - **`MAS-601`: Implement comprehensive logging (`🟡` -> `🟢`).** Essential for debugging and visibility of the core pipeline.

2.  **Highly Recommended for MVP Stability (Prioritize if time permits):**

    - **`REH-501`: Implement circuit breakers (`⬜`).** Protects against external API failures.
    - **`REH-503`: Implement rate limit handling (`⬜`).** Prevents API blocking.
    - **`REH-504`: Create a health check system/function (`⬜`).** Monitors external dependencies.
    - **`MAS-602`: Implement metrics collection (`⬜`).** Provides basic operational insight.

3.  **Deferrable Post-MVP Tasks:**
    - Advanced Price Aggregation (`PEA-108` to `PEA-110`)
    - Alternative Volatility Methods (`VCE-230`, `VCE-231`, `VCE-232`)
    - Advanced Libraries (`VCE-220`, `VCE-221`)
    - Data Management/Optimization (`DMP-301` to `DMP-304`)
    - Advanced Premium Features (`PCA-403` to `PCA-406`)
    - Advanced Resilience (`REH-502`, `REH-505`)
    - Advanced Monitoring/Alerting (`MAS-603` to `MAS-606`)
    - Real-time Capabilities (`RTC-701` to `RTC-704`)

**Conclusion:** Completing `MAS-601` delivers the absolute minimum functional MVP. Adding the highly recommended `REH` and `MAS` tasks will significantly improve the robustness and observability of the initial release.
