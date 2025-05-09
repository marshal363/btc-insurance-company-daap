import { useState, useCallback } from "react";
import { useQuery } from "convex/react";
// Update to use path alias from tsconfig.json
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { BuyerPremiumQuoteResult } from "@convex/types";

// Define the expected input structure for the Convex query
// Align this with the args defined in convex/services/oracle/premiumCalculation.ts -> getBuyerPremiumQuote
interface BuyerQuoteParams {
  protectedValuePercentage: number;
  protectionAmount: number;
  expirationDays: number;
  policyType: string; // e.g., "PUT"
  currentPriceOverride?: number; // Matches the new definition
  includeScenarios?: boolean;
}

// Define and EXPORT the structure for the risk parameters snapshot
export interface RiskParamsSnapshot {
  // Use types from Convex's RiskParameters
  assetType: string;
  policyType: string;
  baseRate: number;
  volatilityMultiplier: number;
  durationFactor: number;
  coverageFactor: number;
  tierMultipliers?: {
    conservative: number;
    balanced: number;
    aggressive: number;
  };
  liquidityAdjustment?: number;
  marketTrendAdjustment?: number;
  version?: number;
  lastUpdated?: string;
  updatedBy?: string;
  isActive?: boolean;
  // Add _id and _creationTime if they are part of the table schema
  _id?: Id<"riskParameters">;
  _creationTime?: number;
}

// Removed unused local BuyerQuoteResult interface definition
// The hook now uses BuyerPremiumQuoteResult imported from "@convex/types"

interface UseBuyerQuoteResult {
  quote: BuyerPremiumQuoteResult | null | undefined; // undefined initially/loading, null on error/skip
  isLoading: boolean;
  error: string | null;
  fetchQuote: (params: BuyerQuoteParams) => void;
}

export const useBuyerQuote = (): UseBuyerQuoteResult => {
  const [params, setParams] = useState<BuyerQuoteParams | null>(null);

  // Add debug logging
  console.log("useBuyerQuote: Current params:", params);

  // Use Convex useQuery hook.
  const quoteData = useQuery(
    api.services.oracle.premiumCalculation.getBuyerPremiumQuote,
    params ? params : "skip"
  );

  // Log the results of the query
  console.log("useBuyerQuote: Query result:", quoteData);

  // Determine loading state
  const isLoading = params !== null && quoteData === undefined;

  // Basic error check
  const error = params !== null && quoteData === null ? "Failed to fetch accurate quote." : null;

  // Callback to trigger a new quote fetch by updating the parameters
  const fetchQuote = useCallback((newParams: BuyerQuoteParams) => {
    console.log("useBuyerQuote: Fetching with params:", newParams);
    setParams(newParams);
  }, []);

  return {
    // Ensure we return null if there was an error, otherwise the fetched data (or undefined if loading)
    quote: error ? null : quoteData,
    isLoading,
    error,
    fetchQuote,
  };
}; 