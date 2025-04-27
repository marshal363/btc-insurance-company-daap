# Bitcoin Price Data Flow: Technical Specification

This document outlines the technical implementation for obtaining, processing, and displaying Bitcoin price data within the BitHedge application.

## 1. Overview

The system fetches Bitcoin price data from multiple external exchanges, aggregates it using a weighted average, caches it on the backend, exposes it via a Next.js API route, and makes it available to the frontend client-side components through a custom React hook.

## 2. Data Sources

The primary sources of Bitcoin price data are public APIs from the following cryptocurrency exchanges:

- CoinGecko (Weight: 1.0) - Also used as the primary source for 24h change data.
- Binance US (Weight: 0.9)
- Coinbase (Weight: 0.9)
- Kraken (Weight: 0.8)
- Bitfinex (Weight: 0.8)
- Gemini (Weight: 0.7)
- Bitstamp (Weight: 0.7)

These sources and their weights are defined in `app/lib/bitcoin-api.ts`.

## 3. Backend Implementation

### 3.1. Price Fetching and Aggregation (`app/lib/bitcoin-api.ts`)

- **`fetchPriceFromAPIs()`:**
  - Asynchronously fetches data from all configured exchange APIs in parallel.
  - Uses `fetch` with a custom User-Agent (`BitHedge Premium Calculator/1.0`).
  - Calls `parseExchangeResponse()` to normalize the data structure from each exchange.
  - Calculates a weighted average price based on successful fetches.
  - Attempts to determine the 24-hour low, high, and percentage change, primarily using CoinGecko data. Provides estimates if specific data points are missing.
  - Includes fallback logic using hardcoded values if all API calls fail initially.
- **`parseExchangeResponse()`:**
  - Contains logic specific to each exchange API's response format to extract the price, and where available, 24h low/high.
- **Data Structure (`app/lib/types.ts` -> `BitcoinPriceData`):**
  - `currentPrice`: number (Weighted average)
  - `lastUpdated`: string (ISO timestamp)
  - `dayLow`: number
  - `dayHigh`: number
  - `priceChange24h`: number
  - `priceChangePercentage24h`: number
  - `historicalVolatility`: number (Note: Currently seems to use a default or cached value, calculation logic might be elsewhere or needs review)
  - `exchanges`: Array of `ExchangeSource` objects, each containing name, price, lastUpdated, and confidence (weight \* 100).
  - `period`: number (Default seems to be 30, purpose needs verification - potentially related to volatility calculation)

### 3.2. Caching (`app/lib/bitcoin-api.ts`)

- An in-memory variable `priceCache` stores the latest `BitcoinPriceData`.
- The `getBitcoinPriceData(forceRefresh = false)` function manages cache access:
  - Returns `priceCache` if it exists and `lastUpdated` is within the last 60 seconds.
  - If the cache is older than 60 seconds, it returns the stale cache immediately but triggers `fetchPriceFromAPIs()` in the background to update it asynchronously.
  - If `forceRefresh` is true, it bypasses the cache check and calls `fetchPriceFromAPIs()` directly.

### 3.3. API Endpoint (`app/api/bitcoin/price/route.ts`)

- **`GET /api/bitcoin/price`:**
  - Handles GET requests.
  - Calls `getBitcoinPriceData()` (utilizing the caching logic).
  - Returns the `BitcoinPriceData` object as JSON with a `200 OK` status.
  - Returns a `500 Internal Server Error` with an error message if fetching fails.
- **`POST /api/bitcoin/price`:**
  - Handles POST requests.
  - Calls `getBitcoinPriceData(true)` to force a cache refresh.
  - Returns the newly fetched `BitcoinPriceData` object as JSON.
  - Returns a `500 Internal Server Error` if refreshing fails.

## 4. Frontend Implementation

### 4.1. Data Fetching Hook (`app/hooks/use-bitcoin-price.ts`)

- The `useBitcoinPrice` custom hook utilizes `@tanstack/react-query`'s `useQuery`.
- **`queryKey`:** `['bitcoinPrice']`
- **`queryFn`:** Asynchronously fetches data from the `GET /api/bitcoin/price` endpoint.
- **`refetchInterval`:** 60000 (ms) - Automatically refetches the data every 60 seconds.
- The hook returns the state managed by React Query, including `data` (the `BitcoinPriceData`), `isLoading`, `isError`, `error`, etc.

### 4.2. Component Usage (Example)

```typescript
import { useBitcoinPrice } from "@/app/hooks/use-bitcoin-price";

function PriceDisplayComponent() {
  const { data: priceData, isLoading, isError } = useBitcoinPrice();

  if (isLoading) return <div>Loading price...</div>;
  if (isError) return <div>Error loading price.</div>;

  return (
    <div>
      <h2>Current Bitcoin Price:</h2>
      <p>${priceData?.currentPrice.toFixed(2)}</p>
      <p>Last Updated: {priceData?.lastUpdated}</p>
      {/* Display other price data points as needed */}
    </div>
  );
}
```

## 5. Scalability and Maintainability Analysis

- **Scalability:**
  - The backend relies on multiple external APIs, distributing the load and providing redundancy if one source fails.
  - The 60-second caching significantly reduces the load on both the external APIs and the internal backend endpoint, as clients primarily hit the cache.
  - The background cache refresh prevents blocking user requests while ensuring data doesn't become excessively stale.
  - Potential bottleneck: If the number of concurrent users querying the API becomes very large, the single Next.js serverless function handling `/api/bitcoin/price` might face scaling limits or cold starts, although the cache mitigates this significantly. A dedicated microservice or more robust caching layer (like Redis) could be considered for very high scale.
- **Maintainability:**
  - Code is well-structured, separating API logic (`route.ts`), core fetching/caching logic (`bitcoin-api.ts`), type definitions (`types.ts`), and client-side fetching (`use-bitcoin-price.ts`).
  - Adding/removing exchange sources requires modifying the `EXCHANGES` array and potentially the `parseExchangeResponse` function in `bitcoin-api.ts`.
  - Error handling is present at both the API fetching and endpoint levels.
  - Using React Query simplifies client-side state management, caching, and refetching.

## 6. Potential Improvements / Next Steps

- **External Cache:** For higher scalability and resilience, replace the in-memory cache with an external cache like Redis or Memcached. This would persist the cache across serverless function invocations/restarts.
- **Rate Limiting:** Monitor usage of external APIs; implement rate limiting or exponential backoff if hitting limits becomes an issue.
- **Monitoring & Alerting:** Add monitoring to track the success rate of fetching from each exchange API and alert if multiple sources consistently fail.
- **Volatility Calculation:** Clarify or implement the actual historical volatility calculation if the current default value isn't sufficient. This might involve fetching historical price data.
- **WebSocket:** For real-time price updates, consider implementing a WebSocket connection instead of relying solely on polling via `refetchInterval`. This would push price updates from the server to connected clients instantly.
- **Configuration:** Move the `EXCHANGES` list and potentially weights/cache duration into environment variables or a configuration file for easier management.
