import { v } from "convex/values";
import { internalAction, internalMutation, query, action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import axios from "axios";

// Add a public function to trigger initial price fetch
export const initializePriceFeed = action({
  args: {},
  handler: async (ctx) => {
    // Fetch initial prices
    await ctx.runAction(internal.prices.fetchPrices, {});
    // Fetch historical data
    await ctx.runAction(internal.prices.fetchHistoricalPrices, {});
  },
});

// Update getLatestPrice to handle no data case better
export const getLatestPrice = query({
  args: {},
  handler: async (ctx) => {
    const latest = await ctx.db.query("aggregatedPrices").order("desc").first();
    
    // If no price exists yet, trigger a fetch
    if (!latest) {
      // We can't directly call actions from queries, but we can return null
      // and let the UI handle triggering the fetch
      return null;
    }
    
    return latest;
  },
});

// Internal function to fetch current prices from multiple sources
export const fetchPrices = internalAction({
  args: {},
  handler: async (ctx) => {
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
        parse: (data: any) => parseFloat(data.price)
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
        weight: 0.15,
        parse: (data: any) => parseFloat(data.last)
      },
      {
        name: "gemini",
        url: "https://api.gemini.com/v1/pubticker/btcusd",
        weight: 0.1,
        parse: (data: any) => parseFloat(data.last)
      },
      {
        name: "huobi",
        url: "https://api.huobi.pro/market/detail/merged?symbol=btcusdt",
        weight: 0.1,
        parse: (data: any) => data.tick.close
      }
    ];

    const timestamp = Date.now();
    let totalWeight = 0;
    let weightedSum = 0;

    for (const source of sources) {
      try {
        const response = await axios.get(source.url);
        const price = source.parse(response.data);
        
        // Store individual price
        await ctx.runMutation(internal.prices.storePriceFeed, {
          source: source.name,
          price,
          weight: source.weight,
          timestamp
        });

        weightedSum += price * source.weight;
        totalWeight += source.weight;
      } catch (error) {
        console.error(`Failed to fetch from ${source.name}:`, error);
      }
    }

    if (totalWeight > 0) {
      const aggregatedPrice = weightedSum / totalWeight;
      
      // Calculate volatility from historical data
      const volatility = await ctx.runQuery(internal.prices.calculateVolatility, {});
      
      // Store aggregated price
      await ctx.runMutation(internal.prices.storeAggregatedPrice, {
        price: aggregatedPrice,
        timestamp,
        volatility: volatility || 0
      });
    }
  }
});

// Internal function to fetch historical prices
export const fetchHistoricalPrices = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      // Fetch historical data from CoinGecko (30 days)
      const response = await axios.get(
        "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30&interval=hourly"
      );

      const prices = response.data.prices;
      
      // Store historical prices
      for (const [timestamp, price] of prices) {
        await ctx.runMutation(internal.prices.storeHistoricalPrice, {
          timestamp,
          price
        });
      }
      
      // Calculate and store volatility
      const volatility = await ctx.runQuery(internal.prices.calculateVolatility, {});
      if (volatility !== null) {
        await ctx.runMutation(internal.prices.storeVolatility, {
          period: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
          volatility,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error("Failed to fetch historical prices:", error);
    }
  }
});

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

// Internal mutation to store historical price
export const storeHistoricalPrice = internalMutation({
  args: {
    timestamp: v.number(),
    price: v.number()
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("historicalPrices", args);
  }
});

// Internal mutation to store volatility
export const storeVolatility = internalMutation({
  args: {
    period: v.number(),
    volatility: v.number(),
    timestamp: v.number()
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("historicalVolatility", args);
  }
});

// Internal mutation to store aggregated price
export const storeAggregatedPrice = internalMutation({
  args: {
    price: v.number(),
    timestamp: v.number(),
    volatility: v.number()
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aggregatedPrices", args);
  }
});

// Internal query to calculate volatility
export const calculateVolatility = internalQuery({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    // Get historical prices for the last 30 days
    const prices = await ctx.db
      .query("historicalPrices")
      .withIndex("by_timestamp", (q) => q.gt("timestamp", thirtyDaysAgo))
      .collect();
    
    if (prices.length < 2) return null;
    
    // Calculate daily returns
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      const dailyReturn = Math.log(prices[i].price / prices[i-1].price);
      returns.push(dailyReturn);
    }
    
    // Calculate standard deviation of returns
    const mean = returns.reduce((a, b) => a + b) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    // Annualize volatility (multiply by sqrt of number of trading periods in a year)
    // Assuming daily prices, multiply by sqrt(365)
    return stdDev * Math.sqrt(365);
  }
});
