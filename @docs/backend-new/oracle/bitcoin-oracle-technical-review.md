# Bitcoin Oracle Technical Review

## Overview

This document provides a technical review of the Bitcoin Oracle implementation built using Convex, detailing the architecture, data flow, and relationships between entities. The oracle serves as a critical infrastructure component for obtaining reliable Bitcoin price data to power the insurance protocol.

## Architecture Components

The Bitcoin Oracle implementation consists of several key components:

1. **Multi-Source Price Aggregation** (`prices.ts`)
2. **Data Schema and Storage** (`schema.ts`)
3. **Insurance Contract Management** (`options.ts`)
4. **User Management** (`users.ts`)
5. **Scheduled Jobs** (`crons.ts`)

## Data Model

The data model defined in `schema.ts` includes the following tables:

- **priceFeed**: Individual price data points from different sources
- **historicalPrices**: Historical Bitcoin price data points
- **historicalVolatility**: Calculated volatility metrics
- **aggregatedPrices**: Weighted average price from multiple sources
- **contracts**: Insurance contracts with associated parameters
- **users**: Basic user profile information

## Data Flow

The Bitcoin Oracle operates with the following data flow:

1. **Price Ingestion**:

   - Cron jobs trigger price fetching at regular intervals (every minute)
   - Multiple price sources are queried in parallel (Binance, Kraken, Coinbase, etc.)
   - Individual price feeds are stored in the `priceFeed` table

2. **Price Aggregation**:

   - Individual prices are weighted based on source reliability
   - Aggregated price is calculated and stored in `aggregatedPrices` table

3. **Volatility Calculation**:

   - Historical prices are fetched hourly from CoinGecko
   - Standard deviation of returns is calculated
   - Annualized volatility is derived and stored

4. **Insurance Contract Flow**:
   - Latest price and volatility are used to calculate premiums
   - Contracts are created and stored with expiration dates
   - Users can query available contracts for trading

## Key Implementation Details

### Price Oracle (`prices.ts`)

The price oracle demonstrates several sophisticated design patterns:

```typescript
// Multi-source price aggregation with weighted average calculation
export const fetchPrices = internalAction({
  args: {},
  handler: async (ctx) => {
    const sources = [
      {
        name: "coingecko",
        url: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
        weight: 0.2,
        parse: (data: any) => data.bitcoin.usd,
      },
      // Additional sources...
    ];

    // Weighted price calculation logic...
  },
});
```

The implementation fetches data from seven different sources with varying weights to ensure price accuracy and resilience against single-source failures.

### Volatility Calculation

The system calculates annualized volatility using the standard deviation of log returns:

```typescript
export const calculateVolatility = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Fetch historical price data
    // Calculate daily returns using logarithmic method
    // Compute standard deviation and annualize
  },
});
```

This volatility measurement is critical for premium pricing in the insurance contracts.

### Premium Calculation

The options system implements a simplified Black-Scholes inspired model:

```typescript
function calculatePremium({
  currentPrice,
  strikePrice,
  volatility,
  duration,
  amount,
}) {
  const daysToExpiry = duration / (24 * 60 * 60);
  const premium =
    currentPrice * volatility * Math.sqrt(daysToExpiry / 365) * amount;
  return Math.round(premium * 100) / 100;
}
```

## Entity Relationships

The system contains the following entity relationships:

1. **Price Data Relationships**:
   - `priceFeed` → aggregated into → `aggregatedPrices`
   - `historicalPrices` → used to calculate → `historicalVolatility`
2. **Insurance Contract Relationships**:
   - `aggregatedPrices` → used to price → `contracts`
   - `users` → create/fill → `contracts`

## Scheduled Jobs

The system uses Convex's cron functionality to maintain data freshness:

```typescript
// Fetch prices every minute
crons.interval(
  "fetch-prices",
  { seconds: 60 },
  internal.prices.fetchPrices,
  {}
);

// Fetch historical data every hour
crons.interval(
  "fetch-historical",
  { hours: 1 },
  internal.prices.fetchHistoricalPrices,
  {}
);
```

## Technical Analysis and Recommendations

### Strengths

1. **Robust Price Aggregation**: The multi-source approach with weighted averages helps mitigate manipulation risks and single-point failures.

2. **Volatility Integration**: The system calculates and stores volatility metrics, which are essential for accurate insurance premium pricing.

3. **Clean Architecture**: The codebase separates concerns well between price fetching, data storage, and contract management.

### Areas for Improvement

1. **Error Handling**: The implementation attempts to handle API errors by catching exceptions, but could benefit from more robust retry mechanisms and circuit breakers.

2. **Premium Calculation**: The current premium calculation is simplified and noted as a TODO for full Black-Scholes implementation.

3. **Authentication**: The user system currently uses a placeholder "system" user, indicating authentication needs to be properly integrated.

4. **Rate Limiting**: There's no explicit handling of API rate limits from the price sources, which could cause issues during high-frequency updates.

5. **Data Pruning**: No mechanism exists to prune old price data, which could lead to database growth issues over time.

## Conclusion

The Bitcoin Oracle implementation in Convex provides a solid foundation for a price feed system that powers the insurance protocol. The multi-source approach and volatility calculations are particularly well-designed. With some enhancements to error handling, authentication, and premium calculations, the system would be well-positioned to serve as a reliable oracle for production use.

The architecture demonstrates good separation of concerns and leverages Convex's built-in features like cron jobs and database indexing effectively. Future development should focus on completing the premium calculation model and enhancing the reliability mechanisms.
