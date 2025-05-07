import { v } from "convex/values";
import { internalAction, internalMutation, query, action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import axios from "axios";
import { api } from "./_generated/api";

// Add a public function to trigger initial price feed and historical data load if needed
export const initializePriceFeed = action({
  args: {},
  handler: async (ctx) => {
    console.log("Starting initializePriceFeed action...");
    
    // Fetch initial current prices
    // console.log("Triggering fetchPrices for current prices...");
    await ctx.runAction(internal.prices.fetchPrices, {});
    // console.log("fetchPrices action completed.");
    
    // Check if historical data needs initial loading
    // console.log("Checking for existing historical data...");
    const historicalDataCheck = await ctx.runQuery(internal.prices.checkHistoricalDataExists, {});
    
    if (!historicalDataCheck.exists) {
      console.log(`No historical data found (exists: ${historicalDataCheck.exists}, count: ${historicalDataCheck.count}). Triggering initial 360-day bulk fetch...`);
      await ctx.runAction(internal.prices.fetchHistoricalPrices, {});
      // console.log("fetchHistoricalPrices action completed.");
    } else {
      console.log(`Historical data already exists (exists: ${historicalDataCheck.exists}, count: ${historicalDataCheck.count}). Skipping initial bulk fetch.`);
      // Optional: Trigger a daily fetch immediately if desired on initialization 
      // console.log("Optional: Triggering fetchLatestDailyPrice...");
      // await ctx.runAction(internal.prices.fetchLatestDailyPrice, {});
    }
    
    console.log("initializePriceFeed action finished.");
  },
});

// Helper query to check if historical data exists
export const checkHistoricalDataExists = internalQuery({
  args: {},
  handler: async (ctx) => {
    // console.log("checkHistoricalDataExists query running...");
    // Check for any record in historicalPrices
    const anyRecord = await ctx.db.query("historicalPrices").first();
    // Get count for logging - fetch all (less efficient but works)
    // Note: Consider a more efficient count method if performance becomes an issue
    const allRecords = await ctx.db.query("historicalPrices").collect(); 
    const count = allRecords.length;
    const exists = anyRecord !== null;
    // console.log(`checkHistoricalDataExists result: exists=${exists}, count=${count}`);
    return { exists, count };
  },
});

// Update getLatestPrice to handle no data case better
export const getLatestPrice = query({
  args: {},
  handler: async (ctx) => {
    // console.log("getLatestPrice query running...");
    const latest = await ctx.db.query("aggregatedPrices").order("desc").first();
    
    if (!latest) {
      // console.log("No aggregated price found in DB. Returning null.");
      // We can't directly call actions from queries, but we can return null
      // and let the UI handle triggering the fetch
      return null;
    }
    
    // console.log(`Found latest aggregated price timestamp: ${new Date(latest.timestamp).toISOString()}`);
    return latest;
  },
});

// Internal function to fetch current prices from multiple sources
export const fetchPrices = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("Starting fetchPrices action (current prices)...");
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
        // console.log(`Attempting fetch from ${source.name}...`);
        const response = await axios.get(source.url);
        fetchedCount++; // Count attempt even if parsing fails
        const price = source.parse(response.data);
        // console.log(`Fetched from ${source.name}. Raw parsed value: ${price}`);

        // Validate price before storing and using in aggregation
        if (typeof price === 'number' && !isNaN(price)) {
           // Store individual price feed entry
          await ctx.runMutation(internal.prices.storePriceFeed, {
            source: source.name,
            price, // Pass the validated number
            weight: source.weight,
            timestamp
          });
          // Collect valid prices for aggregation and outlier detection
          fetchedPrices.push({ source: source.name, price, weight: source.weight });
          // console.log(`Valid price from ${source.name}: ${price}. Stored and collected.`);
        } else {
           console.warn(`Parsed invalid price (Value: ${price}, Type: ${typeof price}) from ${source.name}. Skipping storage and collection for this source.`);
           // Do not store invalid entry
        }

      } catch (error: any) {
        console.error(`Failed to fetch or parse from ${source.name}: ${error.message}`);
        // Do not store error entry
      }
    }
    console.log(`Finished fetching current prices. Attempted: ${fetchedCount}, Valid & Stored: ${fetchedPrices.length}`);

    // --- Outlier Filtering using IQR ---
    let pricesToAggregate = [...fetchedPrices]; // Start with all valid fetched prices
    if (pricesToAggregate.length >= 4) { // Need at least 4 data points for meaningful IQR
        // Sort prices to find quartiles
        pricesToAggregate.sort((a, b) => a.price - b.price);

        // Calculate Q1 and Q3
        const q1Index = Math.floor(pricesToAggregate.length / 4);
        const q3Index = Math.floor(pricesToAggregate.length * 3 / 4);
        const q1 = pricesToAggregate[q1Index].price;
        const q3 = pricesToAggregate[q3Index].price;
        const iqr = q3 - q1;

        // Define bounds
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;

        console.log(`IQR Outlier Detection: Count=${pricesToAggregate.length}, Q1=${q1}, Q3=${q3}, IQR=${iqr}, LowerBound=${lowerBound}, UpperBound=${upperBound}`);

        // Filter prices outside the bounds
        const originalCount = pricesToAggregate.length;
        pricesToAggregate = pricesToAggregate.filter(p => p.price >= lowerBound && p.price <= upperBound);
        const removedCount = originalCount - pricesToAggregate.length;
        if (removedCount > 0) {
            console.warn(`Removed ${removedCount} outliers based on IQR.`);
            // Log which ones were removed (optional, could be verbose)
            // const removedSources = fetchedPrices.filter(p => !pricesToAggregate.some(pa => pa.source === p.source)).map(p => p.source);
            // console.log(`Outlier sources removed: ${removedSources.join(', ')}`);
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
      console.log(`Calculated aggregated price: ${aggregatedPrice} (Sum: ${weightedSum}, Weight: ${totalWeight}, Sources: ${pricesToAggregate.length}) after outlier filtering.`);

      // Calculate volatility from historical data
      const fetchedVolatility: number | null = await ctx.runQuery(internal.prices.calculateVolatility, {});
      const volatilityToStore: number = fetchedVolatility ?? 0; // Ensure it's a number

      // Calculate 24h range
      const rangeData = await ctx.runQuery(api.prices.calculate24hRange as any, {});
      const range24hToStore = rangeData ? rangeData.range : undefined; // Pass range or undefined

      // Store aggregated price
      await ctx.runMutation(internal.prices.storeAggregatedPrice, {
        price: aggregatedPrice,
        timestamp,
        volatility: volatilityToStore,
        sourceCount: pricesToAggregate.length,
        range24h: range24hToStore 
      });
      // console.log(`Aggregated price stored.`);
    } else {
      console.warn(`No sources returned valid, weighted data after potential outlier filtering (Valid count: ${pricesToAggregate.length}, Total weight: ${totalWeight}). Could not aggregate price.`);
    }
    console.log("fetchPrices action finished.");
  }
});

// Internal function to fetch historical prices - NOW PRIMARY: CryptoCompare (OHLCV)
export const fetchHistoricalPrices = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("Starting fetchHistoricalPrices (primary: CryptoCompare)...");
    try {
      // console.log("Attempting primary fetch: CryptoCompare histoday (360 days)...");
      const response = await axios.get(
        "https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&limit=360"
      );
      
      if (response.data && response.data.Data && response.data.Data.Data) {
        const historicalData = response.data.Data.Data;
        console.log(`Primary fetch success: Retrieved ${historicalData.length} historical price points from CryptoCompare.`);
        
        let storedCount = 0;
        // console.log("Storing primary historical data...");
        for (const dataPoint of historicalData) {
          const timestamp = dataPoint.time * 1000; // Convert to milliseconds
          const dayIndex = Math.floor(timestamp / (24 * 60 * 60 * 1000));
          
          // Store with OHLCV data
          await ctx.runMutation(internal.prices.storeHistoricalPrice, {
            timestamp,
            price: dataPoint.close, // Use 'close' as the main price field
            source: "cryptocompare",
            isDaily: true,
            dayIndex,
            high: dataPoint.high,
            low: dataPoint.low,
            open: dataPoint.open,
            volume: dataPoint.volumeto
          });
          storedCount++;
        }
        console.log(`Finished storing ${storedCount} primary historical price points.`);
        
        // Calculate and store volatility for multiple timeframes
        // console.log("Triggering volatility calculation after primary fetch...");
        await calculateAndStoreAllVolatilities(ctx);
      } else {
        console.warn(`Primary source CryptoCompare did not return expected data structure. Response status: ${response.status}`);
        throw new Error("CryptoCompare fetch failed or returned invalid data"); // Trigger fallback
      }
    } catch (error: any) {
      console.error(`Error during primary fetch (CryptoCompare): ${error.message}. Attempting fallback...`);
      // Try fallback source if primary fails
      await fetchHistoricalPricesFallback(ctx);
    }
    console.log("fetchHistoricalPrices finished.");
  }
});

// Fallback function for fetching historical data - NOW FALLBACK: CoinGecko (Price only)
async function fetchHistoricalPricesFallback(ctx: any) {
  console.log("Starting fetchHistoricalPricesFallback (CoinGecko)...");
  try {
    // console.log("Attempting fallback fetch: CoinGecko market_chart (360 days)...");
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=360&interval=daily"
    );

    const prices = response.data.prices;
    if (prices && prices.length > 0) {
      console.log(`Fallback fetch success: Retrieved ${prices.length} historical price points from CoinGecko.`);
      
      let storedCount = 0;
      // console.log("Storing fallback historical data...");
      for (const [timestamp, price] of prices) {
        const dayIndex = Math.floor(timestamp / (24 * 60 * 60 * 1000));
        
        // Store only price data
        await ctx.runMutation(internal.prices.storeHistoricalPrice, {
          timestamp,
          price,
          source: "coingecko-fallback", // Mark as fallback source
          isDaily: true,
          dayIndex
          // No OHLCV data available here
        });
        storedCount++;
      }
      console.log(`Finished storing ${storedCount} fallback historical price points.`);
      
      // Still attempt to calculate volatility based on closing prices
      // console.log("Triggering volatility calculation after fallback fetch...");
      await calculateAndStoreAllVolatilities(ctx);
    } else {
      console.error(`Fallback source CoinGecko also failed or returned no data. Response status: ${response.status}`);
    }
  } catch (error: any) {
    console.error(`Error during fallback fetch (CoinGecko): ${error.message}`);
  }
  console.log("fetchHistoricalPricesFallback finished.");
}

// Function to calculate and store volatility for all required timeframes
async function calculateAndStoreAllVolatilities(ctx: any) {
  console.log("Starting calculateAndStoreAllVolatilities...");
  const timeframes = [30, 60, 90, 180, 360]; // Days
  let calculatedCount = 0;
  
  for (const timeframe of timeframes) {
    try {
      // console.log(`Calculating volatility for ${timeframe}-day timeframe...`);
      const volatilityResult = await ctx.runQuery(internal.prices.calculateVolatilityWithTimeframe, {
        timeframe
      });
      
      if (volatilityResult !== null) {
        // console.log(`Volatility calculation success for ${timeframe} days. Result: ${volatilityResult.volatility}. Storing...`);
        await ctx.runMutation(internal.prices.storeVolatility, {
          period: timeframe * 24 * 60 * 60 * 1000, // timeframe days in milliseconds
          volatility: volatilityResult.volatility,
          timestamp: Date.now(),
          timeframe,
          calculationMethod: "standard", // Assuming standard for now
          dataPoints: volatilityResult.dataPoints,
          startTimestamp: volatilityResult.startTimestamp,
          endTimestamp: volatilityResult.endTimestamp
        });
        calculatedCount++;
        // console.log(`Stored volatility for ${timeframe} days: ${volatilityResult.volatility}`); // Covered by storeVolatility log
      } else {
        console.warn(`Insufficient data returned by calculateVolatilityWithTimeframe for ${timeframe}-day timeframe. Skipping storage.`);
      }
    } catch (error: any) {
      console.error(`Failed to calculate/store volatility for ${timeframe}-day timeframe: ${error.message}`);
    }
  }
  console.log(`Finished calculateAndStoreAllVolatilities. Calculated for ${calculatedCount}/${timeframes.length} timeframes.`);
}

// Internal mutation to store price feed data
export const storePriceFeed = internalMutation({
  args: {
    source: v.string(),
    price: v.number(), // Reverted: Schema requires a number
    weight: v.number(),
    timestamp: v.number()
  },
  handler: async (ctx, args) => {
    // Price is validated before calling this mutation
    // console.log(`Storing price feed for source: ${args.source}, price: ${args.price}`);
    await ctx.db.insert("priceFeed", args); 
  }
});

// Internal mutation to store historical price
export const storeHistoricalPrice = internalMutation({
  args: {
    timestamp: v.number(),
    price: v.number(),
    source: v.optional(v.string()),
    isDaily: v.optional(v.boolean()),
    dayIndex: v.optional(v.number()),
    high: v.optional(v.number()),
    low: v.optional(v.number()),
    open: v.optional(v.number()),
    volume: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    // console.log(`storeHistoricalPrice called for source: ${args.source}, timestamp: ${new Date(args.timestamp).toISOString()}`);
    
    // Check if we already have data for this timestamp and source
    const existing = await ctx.db
      .query("historicalPrices")
      .withIndex("by_source_and_timestamp", (q) => 
        q.eq("source", args.source ?? "").eq("timestamp", args.timestamp) // Handle potential undefined source
      )
      .first();
    
    if (existing) {
      // Update the existing record instead of inserting duplicates
      // console.log(`Found existing record (_id: ${existing._id}). Patching historical price for ${args.source} at ${new Date(args.timestamp).toISOString()}`);
      await ctx.db.patch(existing._id, args);
    } else {
      // Insert new record
      // console.log(`No existing record found. Inserting new historical price for ${args.source} at ${new Date(args.timestamp).toISOString()}`);
      await ctx.db.insert("historicalPrices", args);
    }
    // console.log(`storeHistoricalPrice finished for source: ${args.source}, timestamp: ${new Date(args.timestamp).toISOString()}`);
  }
});

// Internal mutation to store volatility
export const storeVolatility = internalMutation({
  args: {
    period: v.number(),
    volatility: v.number(),
    timestamp: v.number(),
    timeframe: v.optional(v.number()),
    calculationMethod: v.optional(v.string()),
    dataPoints: v.optional(v.number()),
    startTimestamp: v.optional(v.number()),
    endTimestamp: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    // console.log(`Storing volatility - Timeframe: ${args.timeframe}, Value: ${args.volatility}, Method: ${args.calculationMethod}, Points: ${args.dataPoints}`);
    await ctx.db.insert("historicalVolatility", args);
    // console.log(`Volatility stored successfully.`);
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
    // console.log(`Storing aggregated price: ${args.price}, Volatility: ${args.volatility}, Timestamp: ${new Date(args.timestamp).toISOString()}, SourceCount: ${args.sourceCount}, Range24h: ${args.range24h}`);
    await ctx.db.insert("aggregatedPrices", args);
    // console.log(`Aggregated price stored successfully.`);
  }
});

// Calculate volatility for a specific timeframe
export const calculateVolatilityWithTimeframe = internalQuery({
  args: {
    timeframe: v.number() // Days
  },
  handler: async (ctx, args): Promise<{ volatility: number; dataPoints: number; startTimestamp: number; endTimestamp: number } | null> => {
    const { timeframe } = args;
    // console.log(`calculateVolatilityWithTimeframe query running for ${timeframe} days...`);
    const timeframeMs = timeframe * 24 * 60 * 60 * 1000;
    const endTime = Date.now(); // Use current time as the end point
    const startTime = endTime - timeframeMs;
    
    // console.log(`Querying historicalPrices between ${new Date(startTime).toISOString()} and ${new Date(endTime).toISOString()}`);
    
    // Get historical prices for the specified timeframe
    const prices = await ctx.db
      .query("historicalPrices")
      .withIndex("by_timestamp", (q) => q.gt("timestamp", startTime).lte("timestamp", endTime)) // Ensure we don't include future data if clock is skewed
      .filter((q) => q.eq(q.field("isDaily"), true)) // Only use daily closing prices
      .order("asc") // Order by timestamp ascending for proper returns calculation
      .collect();
      
    // console.log(`Found ${prices.length} daily price points for ${timeframe}-day calculation.`);
    
    if (prices.length < 2) {
      console.warn(`Insufficient data points (${prices.length}) found for ${timeframe}-day calculation. Returning null.`);
      return null;
    }
    
    // Calculate log returns
    // console.log(`Calculating log returns...`);
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i-1].price <= 0 || prices[i].price <= 0) { // Avoid log(0) or division by zero issues
        console.warn(`Skipping return calculation due to non-positive price: P[${i-1}]=${prices[i-1].price} at ${new Date(prices[i-1].timestamp).toISOString()} or P[${i}]=${prices[i].price} at ${new Date(prices[i].timestamp).toISOString()}`);
        continue;
      }
      const dailyReturn = Math.log(prices[i].price / prices[i-1].price);
      returns.push(dailyReturn);
    }
    // console.log(`Calculated ${returns.length} valid log returns.`);
    
    if (returns.length < 1) {
      console.warn(`Not enough valid returns (${returns.length}) to calculate volatility for ${timeframe}-day timeframe. Returning null.`);
      return null;
    }
    
    // Calculate standard deviation of returns
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    // Use population standard deviation (divide by N), common for historical volatility
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length; 
    const stdDev = Math.sqrt(variance);
    // console.log(`Calculated Std Dev: ${stdDev} (Mean: ${mean}, Variance: ${variance})`);
    
    // Annualize volatility (multiply by sqrt of trading days in a year)
    // Using 365 days for simplicity here, though 252 is common in finance. Adjust if needed.
    const annualizationFactor = Math.sqrt(365); 
    const annualizedVolatility = stdDev * annualizationFactor;
    
    // console.log(`Calculated annualized volatility for ${timeframe} days: ${annualizedVolatility} (Annualization Factor: sqrt(365))`);
    
    const result = {
      volatility: annualizedVolatility,
      dataPoints: prices.length,
      startTimestamp: prices[0].timestamp, // Actual start timestamp of data used
      endTimestamp: prices[prices.length - 1].timestamp // Actual end timestamp of data used
    };
    // console.log(`calculateVolatilityWithTimeframe returning result for ${timeframe} days.`);
    return result;
  }
});

// Keep the original function for backward compatibility / quick lookup of 30d vol
export const calculateVolatility = internalQuery({
  args: {},
  handler: async (ctx): Promise<number | null> => {
    // console.log(`calculateVolatility query running (fetching latest stored 30-day)...`);
    // Default to 30-day timeframe
    const result = await ctx.db.query("historicalVolatility")
      .withIndex("by_timeframe_and_timestamp", (q) => q.eq("timeframe", 30))
      .order("desc")
      .first();
    
    if (result) {
      // console.log(`Found stored 30-day volatility: ${result.volatility} (Timestamp: ${new Date(result.timestamp).toISOString()})`);
      return result.volatility;
    } else {
      console.warn(`No stored 30-day volatility found. Relying on scheduled jobs to populate.`);
      // Decide if on-the-fly calculation is needed here or if it should only rely on calculateAndStoreAllVolatilities
      // For now, returning null as calculateAndStoreAllVolatilities is triggered by fetches.
      // const calculationResult = await ctx.runQuery(internal.prices.calculateVolatilityWithTimeframe, { timeframe: 30 });
      // return calculationResult ? calculationResult.volatility : null;
      return null;
    }
  }
});

// Function to fetch only the latest day's closing price (for daily updates) - NOW PRIMARY: CryptoCompare
export const fetchLatestDailyPrice = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("Starting fetchLatestDailyPrice (primary: CryptoCompare)...");
    try {
      // console.log("Attempting primary fetch: CryptoCompare histoday (limit 1)...");
      
      // Fetch from CryptoCompare as primary (limit=1 gets the latest completed day)
      const response = await axios.get(
        "https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&limit=1"
      );
      
      if (response.data && response.data.Data && response.data.Data.Data && response.data.Data.Data.length > 0) {
        const dataPoint = response.data.Data.Data[0]; // Get the most recent day
        const timestamp = dataPoint.time * 1000; // Convert to milliseconds
        const dayIndex = Math.floor(timestamp / (24 * 60 * 60 * 1000));
        
        // console.log(`Primary fetch success: Retrieved latest daily data from CryptoCompare. Price: ${dataPoint.close}`);
        // Store with OHLCV
        await ctx.runMutation(internal.prices.storeHistoricalPrice, {
          timestamp,
          price: dataPoint.close,
          source: "cryptocompare",
          isDaily: true,
          dayIndex,
          high: dataPoint.high,
          low: dataPoint.low,
          open: dataPoint.open,
          volume: dataPoint.volumeto
        });
        // console.log(`Stored latest daily price from CryptoCompare.`); // Replaced by internal mutation log
        
        // Recalculate all volatility timeframes
        // console.log(`Triggering volatility calculation after latest daily primary fetch...`);
        await calculateAndStoreAllVolatilities(ctx);
        
        console.log("fetchLatestDailyPrice finished successfully (primary).");
        return { timestamp, price: dataPoint.close };
      } else {
        console.warn(`No price data returned from CryptoCompare primary for latest daily price. Response status: ${response.status}`);
        throw new Error("No price data returned from primary");
      }
    } catch (error: any) {
      console.error(`Error during primary fetch for latest daily price (CryptoCompare): ${error.message}. Trying fallback...`);
      // Try fallback
      return fetchLatestDailyPriceFallback(ctx);
    }
    // Note: This function implicitly finishes within the try/catch return/throw
  }
});

// Fallback function for fetching latest daily price - NOW FALLBACK: CoinGecko
async function fetchLatestDailyPriceFallback(ctx: any) {
  console.log("Starting fetchLatestDailyPriceFallback (CoinGecko)...");
  try {
    // console.log("Attempting fallback fetch: CoinGecko market_chart (2 days)...");
    // Get just the last 2 days data to ensure we have the latest closing price
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=2&interval=daily"
    );

    // Extract the latest day's closing price (last entry)
    const prices = response.data.prices;
    if (prices && prices.length > 0) {
      const latestPriceData = prices[prices.length - 1]; // Get the most recent price point
      const [timestamp, price] = latestPriceData;
      const dayIndex = Math.floor(timestamp / (24 * 60 * 60 * 1000));
      
      // console.log(`Fallback fetch success: Retrieved latest daily price from CoinGecko: ${price}`);
      // Store in database with daily indicator (price only)
      await ctx.runMutation(internal.prices.storeHistoricalPrice, {
        timestamp,
        price,
        source: "coingecko-fallback", // Mark as fallback
        isDaily: true,
        dayIndex
      });
      // console.log(`Stored latest daily price from CoinGecko (fallback).`); // Replaced by internal mutation log
      
      // Recalculate all volatility timeframes
      // console.log(`Triggering volatility calculation after latest daily fallback fetch...`);
      await calculateAndStoreAllVolatilities(ctx);
      
      console.log("fetchLatestDailyPriceFallback finished successfully.");
      return { timestamp, price };
    } else {
      console.warn(`No price data returned from CoinGecko fallback for latest daily price. Response status: ${response.status}`);
      throw new Error("No price data returned from fallback");
    }
  } catch (error: any) {
    console.error(`Error during fallback fetch for latest daily price (CoinGecko): ${error.message}`);
    console.log("fetchLatestDailyPriceFallback finished with error.");
    return null; // Return null if both primary and fallback fail
  }
}

// NEW FUNCTION: Get the most relevant volatility based on option duration
export const getVolatilityForDuration = internalQuery({
  args: {
    durationSeconds: v.number(),
  },
  // TODO (VCE-214 Integration): This function needs to be called by the premium calculation logic (PCA-401/402).
  // TODO (VCE-230/231/232): Update logic/filters based on strategy for handling multiple calculation methods (Parkinson's, EWMA) when implemented.
  handler: async (ctx, args): Promise<number | null> => {
    const { durationSeconds } = args;
    const durationDays = Math.round(durationSeconds / (60 * 60 * 24));
    console.log(`getVolatilityForDuration called for duration: ${durationDays} days (${durationSeconds} seconds)`);

    const standardTimeframes = [30, 60, 90, 180, 360]; // Available calculated timeframes (in days)

    // Find the ideal timeframe (closest match)
    let idealTimeframe = standardTimeframes[0];
    let minDiff = Math.abs(durationDays - idealTimeframe);

    for (let i = 1; i < standardTimeframes.length; i++) {
      const diff = Math.abs(durationDays - standardTimeframes[i]);
      if (diff < minDiff) {
        minDiff = diff;
        idealTimeframe = standardTimeframes[i];
      }
    }
    console.log(`Ideal volatility timeframe determined: ${idealTimeframe} days`);

    // Attempt to fetch the latest volatility for the ideal timeframe
    // Assuming "standard" calculation method for now
    let latestVolatilityRecord = await ctx.db
      .query("historicalVolatility")
      .withIndex("by_timeframe_and_timestamp", (q) => q.eq("timeframe", idealTimeframe))
      .order("desc")
      .first();

    if (latestVolatilityRecord) {
      console.log(`Found volatility for ideal timeframe ${idealTimeframe}: ${latestVolatilityRecord.volatility}`);
      return latestVolatilityRecord.volatility;
    }

    // Fallback: If ideal timeframe data is missing, find the next closest available
    console.warn(`Volatility data not found for ideal timeframe ${idealTimeframe}. Searching for fallbacks...`);

    const fallbackTimeframes = standardTimeframes
      .filter(tf => tf !== idealTimeframe) // Exclude the ideal one
      .map(tf => ({ timeframe: tf, diff: Math.abs(durationDays - tf) }))
      .sort((a, b) => a.diff - b.diff); // Sort by closeness

    for (const fallback of fallbackTimeframes) {
      console.log(`Attempting fallback timeframe: ${fallback.timeframe} days (Difference: ${fallback.diff})`);
      latestVolatilityRecord = await ctx.db
        .query("historicalVolatility")
        .withIndex("by_timeframe_and_timestamp", (q) => q.eq("timeframe", fallback.timeframe))
        .order("desc")
        .first();

      if (latestVolatilityRecord) {
        console.warn(`Using fallback volatility from timeframe ${fallback.timeframe}: ${latestVolatilityRecord.volatility}`);
        return latestVolatilityRecord.volatility;
      }
    }

    // If no data found for any timeframe
    console.error(`CRITICAL: No historical volatility data found for any standard timeframe. Cannot determine volatility for duration ${durationDays} days.`);
    // TODO (VCE-214 Error Handling): Ensure the consuming function handles this null return gracefully.
    return null;
  }
});

// NEW FUNCTION: Calculate 24h High/Low/Range from historical data
// CHANGED: Made public query for frontend use
export const calculate24hRange = query({
  args: {},
  handler: async (ctx): Promise<{ high: number; low: number; range: number } | null> => {
    console.log("calculate24hRange query running...");
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Fetch records from the last 24 hours that potentially have high/low data
    const recentPrices = await ctx.db
      .query("historicalPrices")
      .withIndex("by_timestamp", (q) => q.gt("timestamp", twentyFourHoursAgo))
      // .filter((q) => q.neq(q.field("high"), null).neq(q.field("low"), null)) // Optimization: Filter for non-null high/low if needed, but might exclude valid points if source mix changes
      .collect();

    console.log(`Found ${recentPrices.length} records in the last 24 hours for range calculation.`);

    if (recentPrices.length === 0) {
      console.warn("No historical price data found in the last 24 hours to calculate range.");
      return null;
    }

    let maxHigh = -Infinity;
    let minLow = Infinity;
    let validPoints = 0;

    for (const price of recentPrices) {
      // Use high/low if available and valid numbers, otherwise fallback to price if needed (though less accurate for true range)
      const highValue = typeof price.high === 'number' ? price.high : price.price; 
      const lowValue = typeof price.low === 'number' ? price.low : price.price;

      if (typeof highValue === 'number' && typeof lowValue === 'number') {
        if (highValue > maxHigh) {
          maxHigh = highValue;
        }
        if (lowValue < minLow) {
          minLow = lowValue;
        }
        validPoints++;
      }
    }

    if (validPoints === 0 || maxHigh === -Infinity || minLow === Infinity) {
      console.warn("Could not determine valid high/low points from recent data to calculate range.");
      return null;
    }

    const range = maxHigh - minLow;
    console.log(`Calculated 24h Range: High=${maxHigh}, Low=${minLow}, Range=${range}`);
    return { high: maxHigh, low: minLow, range };
  }
});

// NEW QUERY: Get the latest price reported by each individual source
export const getLatestSourcePrices = query({
  args: {},
  handler: async (ctx) => {
    console.log("getLatestSourcePrices query running...");
    
    // Reuse the source definitions from fetchPrices for consistency
    // In a real app, this might come from a shared config
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
      // Find the most recent entry for this specific source
      const latestEntry = await ctx.db
        .query("priceFeed")
        .withIndex("by_timestamp") // Use index for efficiency if source-specific index isn't available
        .filter((q) => q.eq(q.field("source"), source.name))
        .order("desc")
        .first();

      if (latestEntry) {
        console.log(`Found latest for ${source.name}: Price=${latestEntry.price}, TS=${latestEntry.timestamp}`);
        latestSourceData.push({
          name: latestEntry.source,
          price: latestEntry.price,
          timestamp: latestEntry.timestamp,
          weight: source.weight // Use the predefined weight
        });
      } else {
         console.log(`No recent data found for source: ${source.name}`);
      }
    }

    console.log(`Returning latest data for ${latestSourceData.length} sources.`);
    return latestSourceData;
  },
});

// NEW QUERY: Get historical price closest to a target timestamp
export const getHistoricalPrice = query({
  args: { targetTimestamp: v.number() },
  handler: async (ctx, args): Promise<{ price: number; timestamp: number } | null> => {
    console.log(`getHistoricalPrice query running for target timestamp: ${new Date(args.targetTimestamp).toISOString()} (${args.targetTimestamp})`);
    
    // Find the first daily price point at or before the target timestamp
    const historicalRecord = await ctx.db
      .query("historicalPrices")
      .withIndex("by_timestamp") // Use timestamp index
      .filter((q) => q.lte(q.field("timestamp"), args.targetTimestamp)) // Filter for records <= target
      .filter((q) => q.eq(q.field("isDaily"), true)) // Ensure we only consider daily records
      .order("desc") // Order descending to get the closest one first
      .first(); // Get the most recent record matching the criteria
      
    if (historicalRecord) {
      console.log(`Found historical price: ${historicalRecord.price} at ${new Date(historicalRecord.timestamp).toISOString()}`);
      return {
        price: historicalRecord.price,
        timestamp: historicalRecord.timestamp
      };
    } else {
      console.warn(`No historical daily price found at or before ${new Date(args.targetTimestamp).toISOString()}`);
      // Optional: Could add logic here to search forward if no prior record exists, 
      // but for 24h change, finding the prior day is usually sufficient.
      return null;
    }
  },
});
