"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

// Constants for caching
const CACHE_KEY = "bitcoin_price_data";
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

// Type for the cached price data structure
interface CachedPriceData {
  price: number;
  volatility: number;
  timestamp: number; // Unix timestamp in milliseconds
}

// Return type for the hook
interface UseBitcoinPriceResult {
  currentPrice: number;
  volatility: number;
  lastUpdated: number; // Unix timestamp in milliseconds
  isLoading: boolean;
  isStale: boolean; // Data is older than the stale threshold
  hasError: boolean;
  errorMessage: string | null;
  refreshPrice: () => void; // Function to force a refresh
}

export const useBitcoinPrice = (): UseBitcoinPriceResult => {
  // State for storing the current price data
  const [priceData, setPriceData] = useState<CachedPriceData>({
    price: 0,
    volatility: 0,
    timestamp: 0,
  });
  const [isStale, setIsStale] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use Convex query to fetch the latest price
  const latestPriceDataFromService = useQuery(api.services.oracle.priceService.getLatestPrice);
  
  // Add debug logging
  console.log("useBitcoinPrice: Latest price data from Convex service:", latestPriceDataFromService);

  // Function to check if cache is valid
  const isCacheValid = (cachedData: CachedPriceData | null): boolean => {
    if (!cachedData) return false;
    const now = Date.now();
    return now - cachedData.timestamp < CACHE_EXPIRY_MS;
  };

  // Function to check if data is stale
  const isDataStale = (timestamp: number): boolean => {
    const now = Date.now();
    return now - timestamp > STALE_THRESHOLD_MS;
  };

  // Function to read from cache
  const readFromCache = (): CachedPriceData | null => {
    if (typeof window !== 'undefined') {
      try {
        const cachedJson = localStorage.getItem(CACHE_KEY);
        if (!cachedJson) return null;
        return JSON.parse(cachedJson) as CachedPriceData;
      } catch (err) {
        console.error("Error reading price data from cache:", err);
        return null;
      }
    } else {
      return null; // Cannot access localStorage on server
    }
  };

  // Function to write to cache
  const writeToCache = (data: CachedPriceData): void => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      } catch (err) {
        console.error("Error writing price data to cache:", err);
      }
    }
  };

  // Function to refresh price data
  const refreshPrice = useCallback(() => {
    // Convex queries automatically refresh when needed
    // This is a no-op for now, but could be used to force a refresh
    // if we add that functionality to the Convex query
  }, []);

  // Update price data when the Convex query returns
  useEffect(() => {
    console.log("useBitcoinPrice: Effect running with latestPriceDataFromService:", latestPriceDataFromService);
    
    // Try to read from cache first
    const cachedData = readFromCache();
    console.log("useBitcoinPrice: Cache data:", cachedData);
    
    if (latestPriceDataFromService === undefined) {
      // Still loading from Convex, use cache if valid
      if (isCacheValid(cachedData)) {
        setPriceData(cachedData!);
        setIsStale(isDataStale(cachedData!.timestamp));
        setHasError(false);
        setErrorMessage(null);
      }
      // Otherwise, stay in loading state (priceData remains with default values)
      return;
    } 
    
    if (latestPriceDataFromService === null) {
      // Error fetching from Convex, use cache if available (even if expired)
      if (cachedData) {
        setPriceData(cachedData);
        setIsStale(true); // Always stale if we failed to fetch new data
        setHasError(true);
        setErrorMessage("Failed to fetch latest price data. Using cached data.");
      } else {
        // No cache and Convex failed, complete error state
        setHasError(true);
        setErrorMessage("Failed to fetch Bitcoin price data.");
      }
      return;
    }
    
    // Happy path - we have price data from Convex
    const newPriceData: CachedPriceData = {
      price: latestPriceDataFromService.price,
      volatility: latestPriceDataFromService.volatility || 0.01, // Default to 1% if not provided
      timestamp: Date.now(), // Use current timestamp for cache, or latestPriceDataFromService.timestamp if it represents data freshness
    };
    
    setPriceData(newPriceData);
    setIsStale(false);
    setHasError(false);
    setErrorMessage(null);
    
    // Write the new data to cache
    writeToCache(newPriceData);
  }, [latestPriceDataFromService]);

  // Check for staleness periodically
  useEffect(() => {
    const checkStaleInterval = setInterval(() => {
      if (priceData.timestamp > 0) {
        setIsStale(isDataStale(priceData.timestamp));
      }
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(checkStaleInterval);
  }, [priceData.timestamp]);

  return {
    currentPrice: priceData.price,
    volatility: priceData.volatility,
    lastUpdated: priceData.timestamp,
    isLoading: latestPriceDataFromService === undefined && !isCacheValid(readFromCache()),
    isStale,
    hasError,
    errorMessage,
    refreshPrice,
  };
}; 