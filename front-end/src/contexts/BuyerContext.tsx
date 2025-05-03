"use client";

import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { BuyerPremiumQuoteResult } from "@convex/types";

// --- Define State Structure ---

// Inputs for the Buyer
export interface BuyerInputs {
  protectedValuePercentage: number; // Percentage of current BTC price
  protectionAmount: number; // Amount of Bitcoin to protect
  protectionPeriod: number; // Days of protection
  // Add any other inputs needed
}

export interface BuyerValidationErrors {
  protectedValuePercentage?: string;
  protectionAmount?: string;
  protectionPeriod?: string;
  // Add any other validation error fields
}

// Client-side estimated results (for immediate feedback)
export interface BuyerEstimatedResult {
  estimatedPremium: number;
  estimatedPayout?: number;
  estimatedBreakEven?: number;
  // Add other estimated fields if needed
}

// Type definition for risk parameters snapshot
export interface RiskParamsSnapshot {
  baseRate: number;
  volatilityMultiplier: number;
  durationFactor: number;
  coverageFactor: number;
  // Add other risk parameters as needed
  tierMultipliers?: {
    conservative: number;
    balanced: number;
    aggressive: number;
  };
  liquidityAdjustment?: number;
  marketTrendAdjustment?: number;
}

// Full quote results from Convex backend (accurate calculation)
export interface BuyerQuoteResult {
  premium: number;
  premiumPercentage: number;
  annualizedPremium: number;
  breakEvenPrice: number;
  // Market data snapshot
  marketDataSnapshot?: {
    btcPrice: number;
    volatility: number;
    timestamp: string;
  };
  // Risk params and scenarios (if included)
  riskParamsSnapshot?: RiskParamsSnapshot;
  scenarios?: Array<{
    price: number;
    protectionValue: number;
    netValue: number;
  }>;
  // Any other fields from Convex
}

// --- Define Context State & Type ---

interface BuyerContextProps {
  inputs: BuyerInputs;
  validationErrors: BuyerValidationErrors;
  estimatedResult: BuyerEstimatedResult | null;
  accurateQuote: BuyerPremiumQuoteResult | null;
  isEstimating: boolean;
  
  // Methods to update state
  updateBuyerInputs: (updates: Partial<BuyerInputs>) => void;
  setValidationErrors: (errors: BuyerValidationErrors) => void;
  setEstimatedResult: (result: BuyerEstimatedResult | null) => void;
  setAccurateQuote: (quote: BuyerPremiumQuoteResult | null) => void;
  setIsEstimating: (isEstimating: boolean) => void;
  
  // Utility methods
  resetBuyerInputs: () => void;
  validateInputs: () => boolean;
}

// Default values for inputs
const DEFAULT_INPUTS: BuyerInputs = {
  protectedValuePercentage: 100, // 100% of current price by default
  protectionAmount: 0.1, // Start with a small amount of BTC
  protectionPeriod: 90, // 90 days by default
};

// Create the context with undefined initial value
const BuyerContext = createContext<BuyerContextProps | undefined>(undefined);

// --- Define Provider Component ---

interface BuyerProviderProps {
  children: ReactNode;
  initialInputs?: Partial<BuyerInputs>;
}

export const BuyerProvider: React.FC<BuyerProviderProps> = ({ 
  children, 
  initialInputs = {}
}) => {
  // State for inputs and validation
  const [inputs, setInputs] = useState<BuyerInputs>({
    protectedValuePercentage: 100, // Default to 100% of current price
    protectionAmount: 0.1, // Default to 0.1 BTC
    protectionPeriod: 90, // Default to 90 days
    ...initialInputs
  });
  
  const [validationErrors, setValidationErrors] = useState<BuyerValidationErrors>({});
  
  // State for premium calculations
  const [estimatedResult, setEstimatedResult] = useState<BuyerEstimatedResult | null>(null);
  const [accurateQuote, setAccurateQuote] = useState<BuyerPremiumQuoteResult | null>(null);
  const [isEstimating, setIsEstimating] = useState<boolean>(false);

  // Updater functions
  const updateBuyerInputs = useCallback((updates: Partial<BuyerInputs>) => {
    console.log("BuyerContext: Updating inputs with", updates);
    setInputs(prev => ({ ...prev, ...updates }));
    
    // Clear specific validation errors when fields are updated
    if (Object.keys(updates).some(key => validationErrors[key as keyof BuyerValidationErrors])) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        (Object.keys(updates) as Array<keyof BuyerValidationErrors>).forEach(key => {
          delete newErrors[key];
        });
        return newErrors;
      });
    }
  }, [validationErrors]);

  const resetBuyerInputs = useCallback(() => {
    console.log("BuyerContext: Resetting inputs to defaults");
    setInputs(DEFAULT_INPUTS);
    setValidationErrors({});
    setEstimatedResult(null);
    setAccurateQuote(null);
  }, []);

  const validateInputs = useCallback((): boolean => {
    console.log("BuyerContext: Validating inputs", inputs);
    const errors: BuyerValidationErrors = {};
    
    // Validate protected value percentage
    if (inputs.protectedValuePercentage < 50 || inputs.protectedValuePercentage > 150) {
      errors.protectedValuePercentage = "Protected value must be between 50% and 150% of current price";
    }
    
    // Validate protection amount
    if (!inputs.protectionAmount || inputs.protectionAmount <= 0) {
      errors.protectionAmount = "Protection amount must be greater than 0";
    } else if (inputs.protectionAmount > 100) { // Arbitrary upper limit
      errors.protectionAmount = "Protection amount is too large";
    }
    
    // Validate protection period
    if (![30, 90, 180, 360].includes(inputs.protectionPeriod)) {
      errors.protectionPeriod = "Please select a valid protection period";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [inputs]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue: BuyerContextProps = {
    inputs,
    validationErrors,
    estimatedResult,
    accurateQuote,
    isEstimating,
    updateBuyerInputs,
    setValidationErrors,
    setEstimatedResult,
    setAccurateQuote,
    setIsEstimating,
    resetBuyerInputs,
    validateInputs,
  };

  return (
    <BuyerContext.Provider value={contextValue}>
      {children}
    </BuyerContext.Provider>
  );
};

// --- Define Custom Hook for Consumption ---

export const useBuyerContext = (): BuyerContextProps => {
  const context = useContext(BuyerContext);
  if (context === undefined) {
    throw new Error('useBuyerContext must be used within a BuyerProvider');
  }
  return context;
}; 