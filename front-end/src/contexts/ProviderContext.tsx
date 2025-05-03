"use client";

import React, { createContext, useState, useContext, ReactNode, useMemo, useCallback } from 'react';
import { type ProviderTier } from '@/types'; // Assuming ProviderTier is defined in types

// --- Define State Structure ---

// Inputs for the Provider
export interface ProviderInputs {
  riskRewardTier: ProviderTier | null; // The selected tier (Conservative, Balanced, Aggressive)
  capitalCommitment: number; // Amount in BTC
  incomePeriod: number; // In days
}

// Client-side estimated results (for immediate feedback)
export interface ProviderEstimatedResult {
  estimatedYield: number; // Annual percentage yield
  estimatedYieldAmount?: number; // Yield amount in USD
  estimatedMaxLoss?: number; // Maximum potential loss
}

// Full quote results from Convex backend (accurate calculation)
export interface ProviderQuoteResult {
  annualYield: number; // Annual percentage yield 
  totalYield: number; // Total yield for the commitment period
  yieldAmountUSD: number; // Yield amount in USD
  maxPotentialLoss: number; // Maximum potential loss in USD
  inputs: ProviderInputs; // The inputs used for calculation
  priceUsed: number; // BTC price used for calculation
  volatilityUsed: number; // Volatility value used
  quoteTimestamp: number;
  factorsBreakdown?: {
    riskPremium: number;
    marketRate: number;
    additionalFactors: Record<string, number>;
  };
  scenarios?: {
    marketCondition: string;
    expectedReturn: number;
    probability: number;
  }[];
}

// --- Define Context State & Type ---

interface ProviderContextState {
  inputs: ProviderInputs;
  estimatedResult: ProviderEstimatedResult | null;
  accurateQuote: ProviderQuoteResult | null;
  validationErrors: Record<string, string>; // Store validation errors by field
  
  // Setter functions
  updateProviderInputs: (updates: Partial<ProviderInputs>) => void;
  setEstimatedResult: (result: ProviderEstimatedResult | null) => void;
  setAccurateQuote: (quote: ProviderQuoteResult | null) => void;
  clearValidationErrors: () => void;
  setValidationError: (field: string, error: string) => void;
}

// Create the context with undefined default (forces Provider usage)
const ProviderContext = createContext<ProviderContextState | undefined>(undefined);

// --- Define Provider Component ---

interface ProviderContextProviderProps {
  children: ReactNode;
  initialInputs?: Partial<ProviderInputs>;
}

export const ProviderProvider: React.FC<ProviderContextProviderProps> = ({ 
  children, 
  initialInputs = {}
}) => {
  // Initialize state with defaults or provided values
  const [inputs, setInputs] = useState<ProviderInputs>({
    riskRewardTier: 'balanced' as ProviderTier, // Default to balanced tier
    capitalCommitment: 0.5, // Default to 0.5 BTC
    incomePeriod: 90, // Default to 90 days
    ...initialInputs
  });
  
  const [estimatedResult, setEstimatedResult] = useState<ProviderEstimatedResult | null>(null);
  const [accurateQuote, setAccurateQuote] = useState<ProviderQuoteResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Updater functions
  const updateProviderInputs = useCallback((updates: Partial<ProviderInputs>) => {
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
    updateProviderInputs,
    setEstimatedResult,
    setAccurateQuote,
    clearValidationErrors,
    setValidationError,
  }), [
    inputs, 
    estimatedResult, 
    accurateQuote, 
    validationErrors, 
    updateProviderInputs, 
    clearValidationErrors, 
    setValidationError
  ]);

  return (
    <ProviderContext.Provider value={contextValue}>
      {children}
    </ProviderContext.Provider>
  );
};

// --- Define Custom Hook for Consumption ---

export const useProviderContext = (): ProviderContextState => {
  const context = useContext(ProviderContext);
  if (context === undefined) {
    throw new Error('useProviderContext must be used within a ProviderProvider');
  }
  return context;
}; 