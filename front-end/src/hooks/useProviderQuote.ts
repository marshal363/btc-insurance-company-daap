import { useState, useCallback } from "react";
import { useQuery } from "convex/react";
// Update import path to use path alias from tsconfig.json
import { api } from "@convex/_generated/api";
// Removed unused Id and RiskParamsSnapshot imports
import { ProviderYieldQuoteResult } from "@convex/types";

// Define the expected input structure for the Convex query
// Align this with the args defined in convex/premium.ts -> getProviderYieldQuote
interface ProviderQuoteParams {
  commitmentAmountUSD: number; // Ensure USD value is passed for calculation
  selectedTier: string; // e.g., "conservative"
  selectedPeriodDays: number; // days - renamed from selectedPeriod to match backend
  // Add other optional params if needed
}

// Removed unused local ProviderQuoteResult interface definition
// The hook now uses ProviderYieldQuoteResult imported from "@convex/types"

interface UseProviderQuoteResult {
  quote: ProviderYieldQuoteResult | null | undefined;
  isLoading: boolean;
  error: string | null;
  fetchQuote: (params: ProviderQuoteParams) => void;
}

export const useProviderQuote = (): UseProviderQuoteResult => {
  const [params, setParams] = useState<ProviderQuoteParams | null>(null);

  // Add debug logging
  console.log("useProviderQuote: Current params:", params);

  // Use Convex useQuery hook for getProviderYieldQuote
  const quoteData = useQuery(
    api.premium.getProviderYieldQuote,
    params ? params : "skip"
  );
  
  // Log the results of the query
  console.log("useProviderQuote: Query result:", quoteData);

  const isLoading = params !== null && quoteData === undefined;
  const error = params !== null && quoteData === null ? "Failed to fetch accurate yield quote." : null;

  const fetchQuote = useCallback((newParams: ProviderQuoteParams) => {
    console.log("useProviderQuote: Fetching with params:", newParams);
    setParams(newParams);
  }, []);

  return {
    quote: error ? null : quoteData,
    isLoading,
    error,
    fetchQuote,
  };
}; 