# BitHedge Oracle Implementation Enhancement Plan

## Introduction

This document outlines the enhancement plan for the BitHedge Oracle implementation based on lessons learned from the exploration implementation and analysis. The plan focuses on leveraging the strengths of the Convex platform while addressing identified areas for improvement.

## Key Enhancement Areas

### 1. Price Source Expansion and Aggregation

**Current State**: The Convex implementation uses a limited set of price sources with a basic weighted average approach.

**Enhancement Plan**:

- Expand price sources to include all 7 from the exploration implementation:
  - CoinGecko (Weight: 1.0)
    - Endpoint: `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd`
    - Parser: `data.bitcoin.usd`
  - Binance US (Weight: 0.9)
    - Endpoint: `https://api.binance.us/api/v3/ticker/24hr?symbol=BTCUSD`
    - Parser: `parseFloat(data.price)`
  - Coinbase (Weight: 0.9)
    - Endpoint: `https://api.coinbase.com/v2/prices/BTC-USD/spot`
    - Parser: `parseFloat(data.data.amount)`
  - Kraken (Weight: 0.8)
    - Endpoint: `https://api.kraken.com/0/public/Ticker?pair=XBTUSD`
    - Parser: `parseFloat(data.result.XXBTZUSD.c[0])`
  - Bitfinex (Weight: 0.8)
    - Endpoint: `https://api-pub.bitfinex.com/v2/ticker/tBTCUSD`
    - Parser: `data[6]` (mid price)
  - Gemini (Weight: 0.7)
    - Endpoint: `https://api.gemini.com/v1/pubticker/btcusd`
    - Parser: `parseFloat(data.last)`
  - Bitstamp (Weight: 0.7)
    - Endpoint: `https://www.bitstamp.net/api/v2/ticker/btcusd`
    - Parser: `parseFloat(data.last)`
- Implement advanced statistical filtering and outlier detection
- Develop dynamic source reliability tracking to adjust weights based on historical performance
- Add confidence scoring for aggregated prices

### 2. Volatility Calculation Enhancement

**Current State**: Basic volatility calculation with limited historical data.

**Enhancement Plan**:

- **Historical Price Data Requirements**:

  - **Time Horizon**: Expand historical data to cover at least **360 days** (preferably more if API limits allow)
  - **Data Granularity**: Switch from hourly to **daily closing prices** (standard for financial volatility calculations)
  - **Initial Setup**: Perform a one-time bulk fetch of at least 360 days of historical daily closing prices
  - **Ongoing Updates**: Implement a scheduled daily job to fetch only the most recent daily closing price
  - **Data Sources**: Use multiple reliable sources to ensure data accuracy and availability:
    - Primary: CoinGecko (with appropriate API tier for historical data access)
    - Secondary: CryptoCompare
    - Fallback: CCXT library with exchange-specific historical data endpoints

- **Volatility Calculation for Multiple Time Windows**:

  - Calculate and store volatility for all timeframes needed for premium calculations:
    - 30-day volatility (short-term market conditions)
    - 60-day volatility (medium-term)
    - 90-day volatility (quarterly)
    - 180-day volatility (semi-annual)
    - 360-day volatility (annual, most critical for long-term options)
  - Implement a weight-based volatility model that considers different timeframes based on the option duration
  - Store all volatility metrics in the database with timestamps for tracking trends

- Integrate numerical computation libraries for robust volatility calculations:

  - **Danfo.js**: For time series manipulation and statistical analysis

    ```typescript
    import { Series } from "danfojs";

    function calculateHistoricalVolatility(
      prices: number[],
      window: number = 30
    ): number {
      // Create series of log returns
      const priceSeries = new Series(prices);
      const returns = priceSeries.shift(1).div(priceSeries).log().dropNa();

      // Calculate standard deviation of returns
      const stdDev = returns.rolling(window).std().mean();

      // Annualize volatility (assuming daily data)
      return stdDev * Math.sqrt(252);
    }
    ```

  - **NumJs**: For efficient array operations
  - **math.js**: For advanced mathematical functions

- Implement multiple volatility calculation methodologies:

  - Standard deviation of log returns (annualized)
  - Parkinson's volatility (using high-low price ranges)
  - EWMA (Exponentially Weighted Moving Average) for more recent price sensitivity

- Implement enhanced historical data fetching with multiple sources:

  - **CCXT** (CryptoCurrency eXchange Trading Library)

    ```typescript
    import ccxt from "ccxt";

    async function fetchHistoricalPrices(timeframe = "1d", days = 360) {
      const exchange = new ccxt.binance();
      const symbol = "BTC/USDT";
      const since = Date.now() - days * 24 * 60 * 60 * 1000;
      const limit = days;

      const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, since, limit);
      return ohlcv;
    }
    ```

  - **CryptoCompare API**

    ```typescript
    async function fetchHistoricalPrices(days = 360) {
      const response = await axios.get(
        `https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&limit=${days}`
      );

      return response.data.Data.Data;
    }
    ```

  - **Daily Update Function**

    ```typescript
    // Function to fetch only the latest day's closing price
    async function fetchLatestDailyPrice() {
      try {
        const response = await axios.get(
          "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1&interval=daily"
        );

        // Extract the latest day's closing price
        const latestPrice =
          response.data.prices[response.data.prices.length - 1];
        const [timestamp, price] = latestPrice;

        // Store in database
        await storeHistoricalPrice({
          timestamp,
          price,
          source: "coingecko",
        });

        // Recalculate all volatility timeframes
        await calculateAndStoreAllVolatilities();

        return { timestamp, price };
      } catch (error) {
        console.error("Failed to fetch latest daily price:", error);
        // Implement fallback mechanisms
      }
    }

    // Function to calculate volatilities for all timeframes
    async function calculateAndStoreAllVolatilities() {
      const timeframes = [30, 60, 90, 180, 360];

      for (const days of timeframes) {
        const volatility = await calculateVolatility(days);
        if (volatility !== null) {
          await storeVolatility({
            period: days * 24 * 60 * 60 * 1000, // days in milliseconds
            volatility,
            timestamp: Date.now(),
            timeframe: days,
          });
        }
      }
    }
    ```

- Calculate volatility across multiple timeframes (7-day, 30-day, 60-day, 90-day, 180-day, 360-day)
- Store historical volatility metrics to inform premium calculations and trend analysis

### 3. Data Management and Performance Optimization

**Current State**: Basic storage in Convex tables without explicit data pruning or advanced caching.

**Enhancement Plan**:

- Implement tiered data storage strategy:
  - Recent data (< 7 days): High availability, frequent access
  - Medium-term data (7-90 days): Regular access
  - Long-term data (> 90 days): Archived, reduced frequency access
- Develop intelligent caching strategies for frequently accessed data
- Implement data pruning and archiving mechanisms
- Add performance monitoring and optimization for database queries

### 4. Premium Calculation Advancement

**Current State**: Simplified model with TODO note for full Black-Scholes implementation.

**Enhancement Plan**:

- Complete the implementation of the Black-Scholes model with Bitcoin-specific adjustments using math.js:

  ```typescript
  import * as math from "mathjs";

  function blackScholes(
    type: "call" | "put",
    S: number, // Current price
    K: number, // Strike price
    T: number, // Time to expiry in years
    r: number, // Risk-free rate
    v: number // Volatility
  ): number {
    // Calculate d1 and d2 parameters
    const d1 = math.divide(
      math.add(
        math.log(math.divide(S, K)),
        math.multiply(math.add(r, math.divide(math.pow(v, 2), 2)), T)
      ),
      math.multiply(v, math.sqrt(T))
    );

    const d2 = math.subtract(d1, math.multiply(v, math.sqrt(T)));

    // Calculate option price based on type
    if (type === "call") {
      return math.subtract(
        math.multiply(S, math.cdf(d1)),
        math.multiply(K, math.exp(math.multiply(-r, T)), math.cdf(d2))
      );
    } else {
      return math.subtract(
        math.multiply(
          K,
          math.exp(math.multiply(-r, T)),
          math.cdf(math.multiply(-1, d2))
        ),
        math.multiply(S, math.cdf(math.multiply(-1, d1)))
      );
    }
  }
  ```

- Integrate the following risk factors into premium calculations:
  - Historical volatility (both short and long term)
  - Market liquidity indicators
  - Network health metrics (hash rate, difficulty)
  - Macro market correlation factors
- Develop a scenario simulation engine for price movement modeling
- Create a backtesting framework to validate premium calculation accuracy

### 5. Resilience and Error Handling

**Current State**: Basic error catching with limited fallback mechanisms.

**Enhancement Plan**:

- Implement circuit breakers for API calls to prevent cascading failures
- Develop sophisticated fallback strategies when multiple sources fail
- Add rate limit handling for each API source
- Create a health check system for all external dependencies
- Implement automatic recovery procedures for common failure scenarios

### 6. Monitoring and Alerting System

**Current State**: Limited monitoring capabilities.

**Enhancement Plan**:

- Create a comprehensive logging system for all components
- Implement metrics collection for:
  - API call performance and reliability
  - Price variation between sources
  - Calculation performance
  - System health indicators
- Develop an alerting system for:
  - Anomalous price movements
  - API failures beyond threshold
  - Calculation errors or inconsistencies
  - System performance degradation
- Build a monitoring dashboard for real-time visibility

### 7. Real-time Capabilities

**Current State**: Uses scheduled jobs with fixed intervals.

**Enhancement Plan**:

- Implement WebSocket connections for exchanges that support them:
  - Binance: `wss://stream.binance.us:9443/ws/btcusd@ticker`
  - Coinbase: `wss://ws-feed.pro.coinbase.com`
  - Kraken: `wss://ws.kraken.com`
- Develop adaptive scheduling based on market conditions
  - Increase frequency during high volatility periods
  - Reduce frequency during stable periods
- Create real-time notification systems for significant events
- Optimize the real-time data flow from Convex to frontend components

## Implementation Strategy

The implementation will follow a phased approach:

1. **Phase 1: Source Expansion and Basic Improvements**

   - Expand price sources to include all 7 exchanges
   - Implement basic statistical filtering
   - Set up comprehensive logging
   - Integrate NumJs and math.js for improved calculations
   - **Critical**: Implement one-time bulk fetch of 360+ days of historical daily price data

2. **Phase 2: Volatility and Premium Calculation**

   - Integrate Danfo.js for time series manipulation
   - Implement CCXT for enhanced historical data fetching
   - Implement enhanced volatility calculation methods for all required timeframes (30, 60, 90, 180, 360 days)
   - Set up daily scheduled job to update historical price data incrementally
   - Complete the Black-Scholes model implementation with math.js
   - Implement weight-based volatility model for different option durations

3. **Phase 3: Advanced Features and Monitoring**

   - Develop the scenario simulation engine
   - Implement the comprehensive monitoring system
   - Create the alerting framework
   - Implement multiple timeframe volatility tracking

4. **Phase 4: Optimization and Real-time Capabilities**
   - Implement WebSocket connections
   - Develop adaptive scheduling
   - Optimize performance and caching
   - Implement data archiving and pruning

## Library Dependencies

To implement these enhancements, the following library dependencies will be required:

```json
{
  "dependencies": {
    "axios": "^1.4.0",
    "ccxt": "^3.0.0",
    "danfojs-node": "^1.1.2",
    "mathjs": "^11.8.0",
    "numjs": "^0.16.1"
  }
}
```

## Conclusion

This enhancement plan leverages the lessons learned from the exploration implementation while building on the solid foundation of the current Convex implementation. By addressing each of the key areas, we will create a more robust, accurate, and resilient oracle system that can reliably serve the needs of the BitHedge platform.

The enhancements prioritize accuracy and reliability while also considering performance and scalability. The phased approach ensures that improvements can be implemented incrementally while maintaining system stability.

## Implementation Timeline for Historical Data Requirements

1. **Week 1: Data Source Setup and Initial Fetch (Priority: HIGH)**

   - Select and configure primary and backup data sources for historical data
   - Implement the one-time bulk fetch of at least 360 days of daily BTC price data
   - Create schema for storing historical prices with proper indexing

2. **Week 1-2: Volatility Calculation Framework (Priority: HIGH)**

   - Implement the enhanced volatility calculation function with configurable timeframes
   - Create data models for storing volatility calculations across all required timeframes
   - Develop initial testing framework to validate volatility calculations

3. **Week 2: Daily Update Mechanism (Priority: HIGH)**

   - Implement the daily scheduled job to fetch the latest daily closing price
   - Create monitoring alerts for failed fetches
   - Add fallback mechanisms for data source failures

4. **Week 3: Integration with Premium Calculation (Priority: MEDIUM)**

   - Connect volatility calculations with the Black-Scholes implementation
   - Implement the weight-based volatility model for different option durations
   - Create validation framework to ensure premium calculations use appropriate volatility metrics

5. **Week 3-4: Testing and Optimization (Priority: MEDIUM)**
   - Perform backtesting with historical data to validate volatility calculations
   - Optimize database queries for historical data retrieval
   - Implement data pruning strategy to manage database size

This accelerated timeline prioritizes the critical components needed for accurate option pricing while ensuring proper historical data management.
