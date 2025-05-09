/**
 * Data Ingestion Service
 * 
 * Handles fetching data from external sources and storing it.
 */
import { v } from "convex/values";
import { internalAction, internalMutation, query } from "./_generated/server";
import { internal, api } from "./_generated/api"; // Import api for calling public queries
import axios from "axios";

// --- Action to Fetch and Aggregate Current Prices ---

export const fetchAndAggregateCurrentPrices = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("Starting fetchAndAggregateCurrentPrices action...");
    const sources = [
      {
        name: "coingecko",
        url: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
        weight: 0.2,
        parse: (data: any) => data.bitcoin.usd
      },
      {
        name: "binance",
        url: "https://api.binance.us/api/v3/ticker/24hr?symbol=BTCUSD",
        weight: 0.15,
        parse: (data: any) => parseFloat(data.lastPrice)
      },
      {
        name: "kraken",
        url: "https://api.kraken.com/0/public/Ticker?pair=XBTUSD",
        weight: 0.15,
        parse: (data: any) => parseFloat(data.result.XXBTZUSD.c[0])
      },
      {
        name: "coinbase",
        url: "https://api.coinbase.com/v2/prices/BTC-USD/spot",
        weight: 0.15,
        parse: (data: any) => parseFloat(data.data.amount)
      },
      {
        name: "bitstamp",
        url: "https://www.bitstamp.net/api/v2/ticker/btcusd",
        weight: 0.1,
        parse: (data: any) => parseFloat(data.last)
      },
      {
        name: "gemini",
        url: "https://api.gemini.com/v1/pubticker/btcusd",
        weight: 0.05,
        parse: (data: any) => parseFloat(data.last)
      },
      {
        name: "huobi",
        url: "https://api.huobi.pro/market/detail/merged?symbol=btcusdt",
        weight: 0.05,
        parse: (data: any) => data.tick.close
      },
      {
        name: "bitfinex",
        url: "https://api-pub.bitfinex.com/v2/ticker/tBTCUSD",
        weight: 0.1,
        parse: (data: any) => parseFloat(data[6])
      }
    ];

    const timestamp = Date.now();
    const fetchedPrices: { source: string; price: number; weight: number }[] = [];
    let fetchedCount = 0;

    console.log(`Fetching from ${sources.length} current price sources...`);
    for (const source of sources) {
      try {
        const response = await axios.get(source.url);
        fetchedCount++;
        const price = source.parse(response.data);

        if (typeof price === 'number' && !isNaN(price)) {
          await ctx.runMutation(internal.dataIngestion.storePriceFeed, { 
            source: source.name,
            price,
            weight: source.weight,
            timestamp
          });
          fetchedPrices.push({ source: source.name, price, weight: source.weight });
        } else {
           console.warn(`Parsed invalid price (Value: ${price}, Type: ${typeof price}) from ${source.name}. Skipping.`);
        }
      } catch (error: any) {
        console.error(`Failed to fetch or parse from ${source.name}: ${error.message}`);
      }
    }
    console.log(`Finished fetching current prices. Attempted: ${fetchedCount}, Valid & Stored: ${fetchedPrices.length}`);

    // --- Outlier Filtering using IQR ---
    let pricesToAggregate = [...fetchedPrices];
    if (pricesToAggregate.length >= 4) {
        pricesToAggregate.sort((a, b) => a.price - b.price);
        const q1Index = Math.floor(pricesToAggregate.length / 4);
        const q3Index = Math.floor(pricesToAggregate.length * 3 / 4);
        const q1 = pricesToAggregate[q1Index].price;
        const q3 = pricesToAggregate[q3Index].price;
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        console.log(`IQR Outlier Detection: Count=${pricesToAggregate.length}, Q1=${q1}, Q3=${q3}, IQR=${iqr}, LowerBound=${lowerBound}, UpperBound=${upperBound}`);
        const originalCount = pricesToAggregate.length;
        pricesToAggregate = pricesToAggregate.filter(p => p.price >= lowerBound && p.price <= upperBound);
        const removedCount = originalCount - pricesToAggregate.length;
        if (removedCount > 0) {
            console.warn(`Removed ${removedCount} outliers based on IQR.`);
        }
    } else {
        console.log(`Skipping IQR outlier detection: Not enough valid prices (${pricesToAggregate.length} < 4).`);
    }
    // --- End Outlier Filtering ---

    // Calculate weighted average using filtered prices
    let weightedSum = 0;
    let totalWeight = 0;
    for (const item of pricesToAggregate) {
        weightedSum += item.price * item.weight;
        totalWeight += item.weight;
    }

    if (totalWeight > 0 && pricesToAggregate.length > 0) {
      const aggregatedPrice = weightedSum / totalWeight;
      console.log(`Calculated aggregated price: ${aggregatedPrice} (Sources: ${pricesToAggregate.length}) after outlier filtering.`);

      // Calculate volatility from historical data - Path needs update after volatility migration
      // For now, assume it's still in prices.ts or moved to analytics
      // Let's assume it's moved to analytics/volatilityService.ts for planning
      const fetchedVolatility: number | null = await ctx.runQuery(internal.services.oracle.volatilityService.getStandardVolatility, { periodDays: 30 }); 
      // If calculateVolatility is still in prices.ts:
      // const fetchedVolatility: number | null = await ctx.runQuery(internal.prices.calculateVolatility, {}); 
      const volatilityToStore: number = fetchedVolatility ?? 0; 

      // Calculate 24h range - Use the public query from priceService
      const rangeData = await ctx.runQuery(api.services.oracle.priceService.calculate24hRange, {});
      const range24hToStore = rangeData ? rangeData.range : undefined;

      // Store aggregated price using internal mutation from *this* file
      await ctx.runMutation(internal.dataIngestion.storeAggregatedPrice, { 
        price: aggregatedPrice,
        timestamp,
        volatility: volatilityToStore,
        sourceCount: pricesToAggregate.length,
        range24h: range24hToStore 
      });
    } else {
      console.warn(`No sources returned valid data after filtering. Could not aggregate price.`);
    }
    console.log("fetchAndAggregateCurrentPrices action finished.");
  }
});

// --- Storage Mutations ---

// Internal mutation to store price feed data
export const storePriceFeed = internalMutation({
  args: {
    source: v.string(),
    price: v.number(),
    weight: v.number(),
    timestamp: v.number()
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("priceFeed", args); 
  }
});

// Internal mutation to store aggregated price
export const storeAggregatedPrice = internalMutation({
  args: {
    price: v.number(),
    timestamp: v.number(),
    volatility: v.number(),
    sourceCount: v.optional(v.number()),
    range24h: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aggregatedPrices", args);
  }
});

// --- Diagnostic Queries ---

// Get the latest price reported by each individual source from the priceFeed table
export const getLatestSourcePrices = query({
  args: {},
  handler: async (ctx) => {
    console.log("getLatestSourcePrices query running...");
    
    // REVIEW: Should source list/weights be centralized?
    const sources = [
      { name: "coingecko", weight: 0.2 },
      { name: "binance", weight: 0.15 },
      { name: "kraken", weight: 0.15 },
      { name: "coinbase", weight: 0.15 },
      { name: "bitstamp", weight: 0.1 },
      { name: "gemini", weight: 0.05 },
      { name: "huobi", weight: 0.05 },
      { name: "bitfinex", weight: 0.1 },
    ];

    const latestSourceData: { 
      name: string;
      price: number;
      timestamp: number;
      weight: number;
    }[] = [];

    for (const source of sources) {
      const latestEntry = await ctx.db
        .query("priceFeed")
        .withIndex("by_timestamp") 
        .filter((q) => q.eq(q.field("source"), source.name))
        .order("desc")
        .first();

      if (latestEntry) {
        latestSourceData.push({
          name: latestEntry.source,
          price: latestEntry.price,
          timestamp: latestEntry.timestamp,
          weight: source.weight 
        });
      }
    }
    return latestSourceData;
  },
}); 