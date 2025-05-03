"use client";

import React, { createContext, useState, useContext, ReactNode, useMemo, useCallback } from 'react';

// --- Define State Structure ---

// Inputs for the Buyer
export interface BuyerInputs {
  protectedValuePercentage: number; // As a percentage of current BTC price
  protectionAmount: number; // Amount in BTC
  protectionPeriod: number; // In days
}

// Client-side estimated results (for immediate feedback)
export interface BuyerEstimatedResult {
  estimatedPremium: number;
  estimatedPayout?: number;
  estimatedBreakEven?: number;
}

// Full quote results from Convex backend (accurate calculation)
export interface BuyerQuoteResult {
  premium: number;
  potentialPayout: number;
  breakEvenPrice: number;
  inputs: BuyerInputs; // The inputs used for calculation
  priceUsed: number; // BTC price used for calculation
  volatilityUsed: number; // Volatility used
  quoteTimestamp: number;
  factorsBreakdown?: {
    intrinsicValue: number;
    timeValue: number;
    volatilityImpact: number;
  };
  scenarios?: {
    finalPrice: number;
    payout: number;
  }[];
}

// --- Define Context State & Type ---

interface BuyerContextState {
  inputs: BuyerInputs;
  estimatedResult: BuyerEstimatedResult | null;
  accurateQuote: BuyerQuoteResult | null;
  validationErrors: Record<string, string>; // Store validation errors by field
  
  // Setter functions
  updateBuyerInputs: (updates: Partial<BuyerInputs>) => void;
  setEstimatedResult: (result: BuyerEstimatedResult | null) => void;
  setAccurateQuote: (quote: BuyerQuoteResult | null) => void;
  clearValidationErrors: () => void;
  setValidationError: (field: string, error: string) => void;
}

// Create the context with undefined default (forces Provider usage)
const BuyerContext = createContext<BuyerContextState | undefined>(undefined);

// --- Define Provider Component ---

interface BuyerProviderProps {
  children: ReactNode;
  initialInputs?: Partial<BuyerInputs>;
}

export const BuyerProvider: React.FC<BuyerProviderProps> = ({ 
  children, 
  initialInputs = {}
}) => {
  // Initialize state with defaults or provided values
  const [inputs, setInputs] = useState<BuyerInputs>({
    protectedValuePercentage: 100, // Default to 100% of current price
    protectionAmount: 0.1, // Default to 0.1 BTC
    protectionPeriod: 90, // Default to 90 days
    ...initialInputs
  });
  
  const [estimatedResult, setEstimatedResult] = useState<BuyerEstimatedResult | null>(null);
  const [accurateQuote, setAccurateQuote] = useState<BuyerQuoteResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Updater functions
  const updateBuyerInputs = useCallback((updates: Partial<BuyerInputs>) => {
    setInputs(prev => ({ ...prev, ...updates }));
    // When inputs change, clear the accurate quote as it's no longer valid
    // But keep the estimated result as it will be recalculated immediately
    setAccurateQuote(null);
  }, []);

  const clearValidationErrors = useCallback(() => {
    setValidationErrors({});
  }, []);

  const setValidationError = useCallback((field: string, error: string) => {
    setValidationErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    inputs,
    estimatedResult,
    accurateQuote,
    validationErrors,
    updateBuyerInputs,
    setEstimatedResult,
    setAccurateQuote,
    clearValidationErrors,
    setValidationError,
  }), [
    inputs, 
    estimatedResult, 
    accurateQuote, 
    validationErrors, 
    updateBuyerInputs, 
    clearValidationErrors, 
    setValidationError
  ]);

  return (
    <BuyerContext.Provider value={contextValue}>
      {children}
    </BuyerContext.Provider>
  );
};

// --- Define Custom Hook for Consumption ---

export const useBuyerContext = (): BuyerContextState => {
  const context = useContext(BuyerContext);
  if (context === undefined) {
    throw new Error('useBuyerContext must be used within a BuyerProvider');
  }
  return context;
}; 