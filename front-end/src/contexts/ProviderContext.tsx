"use client";

import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import type { ProviderTier } from '@/types'; // Assuming a local ProviderTier type exists
import { ProviderYieldQuoteResult } from "@convex/types"; // Import the correct type from Convex

// --- Define State Structure ---

// Inputs for the Provider
export interface ProviderInputs {
  riskRewardTier: ProviderTier | null;
  capitalCommitment: number; // In BTC
  incomePeriod: number; // In days
  // Add other inputs if needed
}

export interface ProviderValidationErrors {
  riskRewardTier?: string;
  capitalCommitment?: string;
  incomePeriod?: string;
  // Add other fields
}

// Client-side estimated results
// Ensure this matches the return type of utils/clientEstimation.ts -> estimateProviderYield
export interface ProviderEstimatedResult {
  estimatedYield: number;
  estimatedAnnualizedYieldPercentage: number;
  // Add other estimated fields if needed
}

// --- Define Context State & Type ---

interface ProviderContextProps {
  inputs: ProviderInputs;
  validationErrors: ProviderValidationErrors;
  estimatedResult: ProviderEstimatedResult | null;
  accurateQuote: ProviderYieldQuoteResult | null; // Use the imported Convex type
  isEstimating: boolean; // Potentially track estimation status

  // Methods to update state
  updateProviderInputs: (updates: Partial<ProviderInputs>) => void;
  setValidationErrors: (errors: ProviderValidationErrors) => void;
  setEstimatedResult: (result: ProviderEstimatedResult | null) => void;
  setAccurateQuote: (quote: ProviderYieldQuoteResult | null) => void; // Use the imported Convex type
  setIsEstimating: (isEstimating: boolean) => void;

  // Utility methods
  resetProviderInputs: () => void;
  validateInputs: () => boolean;
}

// Default values for inputs
const DEFAULT_INPUTS: ProviderInputs = {
  riskRewardTier: 'balanced', // Default tier
  capitalCommitment: 0.1, // Default commitment in BTC
  incomePeriod: 90, // Default period
};

// Create the context
const ProviderContext = createContext<ProviderContextProps | undefined>(undefined);

// --- Define Provider Component ---

interface ProviderProviderProps {
  children: ReactNode;
  initialInputs?: Partial<ProviderInputs>;
}

export const ProviderProvider: React.FC<ProviderProviderProps> = ({ 
  children, 
  initialInputs = {}
}) => {
  // State for inputs and validation
  const [inputs, setInputs] = useState<ProviderInputs>({
    ...DEFAULT_INPUTS,
    ...initialInputs,
  });
  const [validationErrors, setValidationErrors] = useState<ProviderValidationErrors>({});
  
  // State for yield calculations
  const [estimatedResult, setEstimatedResult] = useState<ProviderEstimatedResult | null>(null);
  const [accurateQuote, setAccurateQuote] = useState<ProviderYieldQuoteResult | null>(null); // Use correct type
  const [isEstimating, setIsEstimating] = useState<boolean>(false);

  // Updater functions
  const updateProviderInputs = useCallback((updates: Partial<ProviderInputs>) => {
    setInputs(prev => ({ ...prev, ...updates }));
    // Clear validation errors for updated fields
    if (Object.keys(updates).some(key => validationErrors[key as keyof ProviderValidationErrors])) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        (Object.keys(updates) as Array<keyof ProviderValidationErrors>).forEach(key => {
          delete newErrors[key];
        });
        return newErrors;
      });
    }
  }, [validationErrors]);

  const resetProviderInputs = useCallback(() => {
    setInputs(DEFAULT_INPUTS);
    setValidationErrors({});
    setEstimatedResult(null);
    setAccurateQuote(null);
  }, []);

  // Basic validation logic (can be expanded)
  const validateInputs = useCallback((): boolean => {
    const errors: ProviderValidationErrors = {};
    if (!inputs.riskRewardTier) {
      errors.riskRewardTier = "Please select a risk tier.";
    }
    if (inputs.capitalCommitment <= 0) {
      errors.capitalCommitment = "Commitment amount must be positive.";
    } else if (inputs.capitalCommitment > 100) { // Example upper limit
       errors.capitalCommitment = "Commitment amount seems too large.";
    }
    if (![30, 90, 180, 360].includes(inputs.incomePeriod)) {
      errors.incomePeriod = "Please select a valid income period.";
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [inputs]);

  // Context value
  const contextValue: ProviderContextProps = {
    inputs,
    validationErrors,
    estimatedResult,
    accurateQuote,
    isEstimating,
    updateProviderInputs,
    setValidationErrors,
    setEstimatedResult,
    setAccurateQuote,
    setIsEstimating,
    resetProviderInputs,
    validateInputs,
  };

  return (
    <ProviderContext.Provider value={contextValue}>
      {children}
    </ProviderContext.Provider>
  );
};

// --- Define Custom Hook for Consumption ---

export const useProviderContext = (): ProviderContextProps => {
  const context = useContext(ProviderContext);
  if (context === undefined) {
    throw new Error('useProviderContext must be used within a ProviderProvider');
  }
  return context;
}; 