"use client";

import React, { createContext, useState, useContext, ReactNode, useMemo } from 'react';
import type { UserRole, ProviderTier } from '@/types'; // Assuming these types exist

// --- Define State Structure ---

// Inputs specific to the Buyer
interface BuyerInputs {
  protectedValue: number | null;
  protectionAmount: number | null;
  protectionPeriod: number | null; // e.g., days
  // Add other relevant buyer inputs as needed
}

// Inputs specific to the Provider
interface ProviderInputs {
  selectedTier: ProviderTier | null;
  commitmentAmount: string; // Keep as string for input field
  commitmentAmountUSD: number;
  selectedPeriod: number | null; // e.g., days
  // Add other relevant provider inputs as needed
}

// Calculated results (can be expanded)
interface CalculationResults {
  // Buyer specific results
  calculatedPremium?: number | null;
  potentialPayout?: number | null;
  // Provider specific results
  calculatedYield?: number | null; // e.g., APY
  maxPotentialLoss?: number | null;
  // Shared results (if any)
  breakEvenPrice?: number | null;
}

// --- Define Context State & Type ---

interface PremiumDataContextState {
  currentUserRole: UserRole;
  buyerInputs: BuyerInputs;
  providerInputs: ProviderInputs;
  calculationResults: CalculationResults;
  // Add setter functions or dispatch for updates
  setCurrentUserRole: (role: UserRole) => void;
  updateBuyerInputs: (inputs: Partial<BuyerInputs>) => void;
  updateProviderInputs: (inputs: Partial<ProviderInputs>) => void;
  setCalculationResults: (results: Partial<CalculationResults>) => void;
}

// Create the context with a default value (can be null or a default state)
const PremiumDataContext = createContext<PremiumDataContextState | null>(null);

// --- Define Provider Component ---

interface PremiumDataProviderProps {
  children: ReactNode;
}

export const PremiumDataProvider: React.FC<PremiumDataProviderProps> = ({ children }) => {
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('buyer'); // Default role
  const [buyerInputs, setBuyerInputs] = useState<BuyerInputs>({
    protectedValue: null,
    protectionAmount: null,
    protectionPeriod: 90, // Default example
  });
  const [providerInputs, setProviderInputs] = useState<ProviderInputs>({
    selectedTier: null,
    commitmentAmount: "",
    commitmentAmountUSD: 0,
    selectedPeriod: 90, // Default example
  });
  const [calculationResults, setCalculationResults] = useState<CalculationResults>({});

  // Updater functions
  const updateBuyerInputs = (newInputs: Partial<BuyerInputs>) => {
    setBuyerInputs(prev => ({ ...prev, ...newInputs }));
  };

  const updateProviderInputs = (newInputs: Partial<ProviderInputs>) => {
    setProviderInputs(prev => ({ ...prev, ...newInputs }));
  };

  const updateCalculationResults = (newResults: Partial<CalculationResults>) => {
    setCalculationResults(prev => ({ ...prev, ...newResults }));
  };


  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    currentUserRole,
    buyerInputs,
    providerInputs,
    calculationResults,
    setCurrentUserRole,
    updateBuyerInputs,
    updateProviderInputs,
    setCalculationResults: updateCalculationResults,
  }), [currentUserRole, buyerInputs, providerInputs, calculationResults]);

  return (
    <PremiumDataContext.Provider value={contextValue}>
      {children}
    </PremiumDataContext.Provider>
  );
};

// --- Define Custom Hook for Consumption ---

export const usePremiumData = (): PremiumDataContextState => {
  const context = useContext(PremiumDataContext);
  if (context === null) {
    throw new Error('usePremiumData must be used within a PremiumDataProvider');
  }
  return context;
}; 