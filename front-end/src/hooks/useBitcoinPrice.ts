"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useEffect } from "react";

// Enhanced local interface with additional UI-friendly fields
interface BitcoinPrice {
  currentPrice: number;
  timestamp: number;
  volatility: number;
  priceChangePercent24h: number;
  sourceCount: number;
}

/**
 * Hook to fetch the latest Bitcoin price with caching and error handling
 */
export const useBitcoinPrice = () => {
  // Keep local cache of the latest price for better UX during loading/errors
  const [cachedData, setCachedData] = useState<BitcoinPrice | null>(null);
  
  // Fetch the latest price data from the Convex backend
  const priceFetchResult = useQuery(api.prices.getLatestPrice);
  
  // Maintain loading and error states
  const isLoading = priceFetchResult === undefined;
  const hasError = priceFetchResult === null;
  
  // Update cache when we get new data
  useEffect(() => {
    if (priceFetchResult && !hasError) {
      // Transform the data to our local interface format
      const transformedData: BitcoinPrice = {
        currentPrice: priceFetchResult.price,
        timestamp: priceFetchResult.timestamp,
        volatility: priceFetchResult.volatility,
        priceChangePercent24h: priceFetchResult.range24h || 0,
        sourceCount: priceFetchResult.sourceCount || 0,
      };
      setCachedData(transformedData);
    }
  }, [priceFetchResult, hasError]);
  
  // Try to get data from localStorage on initial load
  useEffect(() => {
    if (!cachedData) {
      try {
        const storedData = localStorage.getItem('bitcoinPriceCache');
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          // Check if data is still fresh (less than 5 minutes old)
          const isFresh = Date.now() - parsedData.timestamp < 5 * 60 * 1000;
          if (isFresh) {
            setCachedData(parsedData);
          }
        }
      } catch (error) {
        console.error("Error retrieving cached Bitcoin price:", error);
      }
    }
  }, [cachedData]);
  
  // Save to localStorage when we get new data
  useEffect(() => {
    if (cachedData) {
      try {
        localStorage.setItem('bitcoinPriceCache', JSON.stringify(cachedData));
      } catch (error) {
        console.error("Error caching Bitcoin price:", error);
      }
    }
  }, [cachedData]);
  
  // Return either the live data or cached data, with appropriate states
  return {
    // Data values - prefer live data, fall back to cached
    currentPrice: priceFetchResult?.price ?? cachedData?.currentPrice ?? 0,
    priceChangePercent24h: priceFetchResult?.range24h ?? cachedData?.priceChangePercent24h ?? 0,
    volatility: priceFetchResult?.volatility ?? cachedData?.volatility ?? 0,
    timestamp: priceFetchResult?.timestamp ?? cachedData?.timestamp ?? 0,
    sourceCount: priceFetchResult?.sourceCount ?? cachedData?.sourceCount ?? 0,
    
    // State indicators
    isLoading,
    isStale: isLoading && !!cachedData, // Using cached data while refreshing
    hasError,
    errorMessage: hasError ? "Failed to fetch Bitcoin price data" : null,
    
    // Cache status
    isCached: !priceFetchResult && !!cachedData,
    cacheAge: cachedData ? Date.now() - cachedData.timestamp : 0,
  };
}; 