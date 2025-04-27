import { BitcoinPriceData, ExchangeSource } from './types';

// Cache for Bitcoin price data
let priceCache: BitcoinPriceData = {
  currentPrice: 0,
  lastUpdated: "",
  dayLow: 0,
  dayHigh: 0,
  priceChange24h: 0,
  priceChangePercentage24h: 0,
  historicalVolatility: 0,
  exchanges: [],
  period: 30
};

// Initialize with default data
let cacheFilled = false;

// List of exchanges to query for price data
const EXCHANGES = [
  { name: "CoinGecko", url: "https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false", weight: 1.0 },
  { name: "Binance US", url: "https://api.binance.us/api/v3/ticker/24hr?symbol=BTCUSD", weight: 0.9 },
  { name: "Coinbase", url: "https://api.coinbase.com/v2/prices/BTC-USD/spot", weight: 0.9 },
  { name: "Kraken", url: "https://api.kraken.com/0/public/Ticker?pair=XBTUSD", weight: 0.8 },
  { name: "Bitfinex", url: "https://api-pub.bitfinex.com/v2/ticker/tBTCUSD", weight: 0.8 },
  { name: "Gemini", url: "https://api.gemini.com/v1/pubticker/btcusd", weight: 0.7 },
  { name: "Bitstamp", url: "https://www.bitstamp.net/api/v2/ticker/btcusd/", weight: 0.7 }
];

/**
 * Parse response from various exchanges into a consistent format
 */
function parseExchangeResponse(exchange: string, data: any): { price: number; low?: number; high?: number } {
  try {
    switch (exchange) {
      case "CoinGecko":
        return {
          price: data.market_data.current_price.usd,
          low: data.market_data.low_24h.usd,
          high: data.market_data.high_24h.usd
        };
      case "Binance US":
        return {
          price: parseFloat(data.lastPrice),
          low: parseFloat(data.lowPrice),
          high: parseFloat(data.highPrice)
        };
      case "Coinbase":
        return {
          price: parseFloat(data.data.amount)
        };
      case "Kraken":
        // Kraken uses XXBTZUSD or XBTUSD as the pair name
        const pair = data.result.XXBTZUSD || data.result.XBTUSD;
        return {
          price: parseFloat(pair.c[0]),
          low: parseFloat(pair.l[1]),
          high: parseFloat(pair.h[1])
        };
      case "Bitfinex":
        // Bitfinex returns an array: [BID, BID_SIZE, ASK, ASK_SIZE, DAILY_CHANGE, ...]
        return {
          price: data[6], // Last traded price
          low: data[9],
          high: data[8]
        };
      case "Gemini":
        return {
          price: parseFloat(data.last)
        };
      case "Bitstamp":
        return {
          price: parseFloat(data.last),
          low: parseFloat(data.low),
          high: parseFloat(data.high)
        };
      default:
        throw new Error(`Unknown exchange: ${exchange}`);
    }
  } catch (error) {
    console.error(`Error parsing ${exchange} response:`, error);
    throw error;
  }
}

/**
 * Fetch Bitcoin price data from multiple exchange APIs
 */
async function fetchPriceFromAPIs(): Promise<BitcoinPriceData> {
  const exchangeResults: ExchangeSource[] = [];
  let successfulFetches = 0;
  let aggregatedPrice = 0;
  let lowestPrice = Infinity;
  let highestPrice = 0;
  let priceChange24h = 0;
  let priceChangePercentage24h = 0;
  
  const timestamp = new Date().toISOString();
  
  // Fetch data from all exchanges in parallel
  const fetchPromises = EXCHANGES.map(async (exchange) => {
    try {
      const response = await fetch(exchange.url, {
        headers: { 'User-Agent': 'BitHedge Premium Calculator/1.0' }
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      const parsedData = parseExchangeResponse(exchange.name, data);
      
      // Store the exchange result
      exchangeResults.push({
        name: exchange.name,
        price: parsedData.price,
        lastUpdated: timestamp,
        confidence: exchange.weight * 100
      });
      
      // Update aggregate values
      aggregatedPrice += parsedData.price * exchange.weight;
      successfulFetches += exchange.weight;
      
      // Update low and high values
      if (parsedData.low && parsedData.low < lowestPrice) {
        lowestPrice = parsedData.low;
      }
      
      if (parsedData.high && parsedData.high > highestPrice) {
        highestPrice = parsedData.high;
      }
      
      // Get 24h change from CoinGecko as most reliable source
      if (exchange.name === "CoinGecko") {
        const coinGeckoData = data as {
          market_data: {
            price_change_24h: number;
            price_change_percentage_24h: number;
          }
        };
        priceChange24h = coinGeckoData.market_data.price_change_24h;
        priceChangePercentage24h = coinGeckoData.market_data.price_change_percentage_24h;
      }
      
      return true;
    } catch (error) {
      console.error(`Error fetching from ${exchange.name}:`, error);
      return false;
    }
  });
  
  // Wait for all fetches to complete
  await Promise.all(fetchPromises);
  
  // Calculate weighted average price from all successful sources
  const finalPrice = successfulFetches > 0 ? aggregatedPrice / successfulFetches : 0;
  
  // If we couldn't get low/high from any source, estimate them
  if (lowestPrice === Infinity) {
    lowestPrice = finalPrice * 0.98; // Estimate 2% lower
  }
  
  if (highestPrice === 0) {
    highestPrice = finalPrice * 1.02; // Estimate 2% higher
  }
  
  // If we couldn't get price change data, use conservative estimates
  if (priceChange24h === 0 && finalPrice > 0 && cacheFilled) {
    priceChange24h = finalPrice - priceCache.currentPrice;
    priceChangePercentage24h = (priceChange24h / priceCache.currentPrice) * 100;
  }
  
  // Estimate volatility if not already in cache
  const historicalVolatility = priceCache.historicalVolatility || 42.5; // Default value if not yet calculated
  
  const priceData: BitcoinPriceData = {
    currentPrice: finalPrice,
    lastUpdated: timestamp,
    dayLow: lowestPrice,
    dayHigh: highestPrice,
    priceChange24h,
    priceChangePercentage24h,
    historicalVolatility,
    exchanges: exchangeResults.sort((a, b) => b.confidence - a.confidence),
    period: priceCache.period || 30
  };
  
  // If we have valid data, update cache
  if (finalPrice > 0) {
    priceCache = priceData;
    cacheFilled = true;
    return priceData;
  }
  
  // If all APIs failed and we have cached data, return that
  if (cacheFilled) {
    return {
      ...priceCache,
      lastUpdated: timestamp
    };
  }
  
  // Fall back to hardcoded data if everything fails and no cache
  return {
    currentPrice: 95010.28,
    lastUpdated: timestamp,
    dayLow: 93500.75,
    dayHigh: 96125.90,
    priceChange24h: 1245.65,
    priceChangePercentage24h: 1.32,
    historicalVolatility: 42.5,
    period: 30,
    exchanges: [{
      name: "Fallback",
      price: 95010.28,
      lastUpdated: timestamp,
      confidence: 50
    }]
  };
}

/**
 * Get Bitcoin price data, using cache if available
 * This function is used by Next.js API routes
 */
export async function getBitcoinPriceData(forceRefresh = false): Promise<BitcoinPriceData> {
  if (!cacheFilled || forceRefresh) {
    return await fetchPriceFromAPIs();
  }
  
  // Check if cache is stale (older than 1 minute)
  const lastUpdated = new Date(priceCache.lastUpdated);
  const now = new Date();
  const diffMs = now.getTime() - lastUpdated.getTime();
  const diffSecs = diffMs / 1000;
  
  if (diffSecs > 60) {
    // Refresh cache in background, but return current cache immediately
    fetchPriceFromAPIs().catch(err => console.error("Error refreshing price cache:", err));
  }
  
  return priceCache;
}

/**
 * Force refresh of Bitcoin price data from all sources
 */
export async function refreshBitcoinPrice(): Promise<BitcoinPriceData> {
  return await fetchPriceFromAPIs();
}