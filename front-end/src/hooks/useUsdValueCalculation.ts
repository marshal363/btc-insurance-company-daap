import { useMemo } from 'react';
import { useBitcoinPrice } from './useBitcoinPrice';
import { btcToUsd, usdToBtc } from '../utils/formatters';

type UsdValueCalculationResult = {
  /**
   * Convert a BTC value to USD
   */
  calculateUsdValue: (btcAmount: number) => number;
  
  /**
   * Convert a USD value to BTC
   */
  calculateBtcValue: (usdAmount: number) => number;
  
  /**
   * Current Bitcoin price in USD
   */
  bitcoinPrice: number | null;
  
  /**
   * Whether the Bitcoin price is currently loading
   */
  isLoading: boolean;
  
  /**
   * Any error that occurred while fetching the Bitcoin price
   */
  hasError: boolean;
  errorMessage: string | null;
};

/**
 * Hook to perform dynamic USD value calculations for Bitcoin amounts
 * Uses the useBitcoinPrice hook to get the current price
 * 
 * @returns Calculation functions and Bitcoin price information
 */
export function useUsdValueCalculation(): UsdValueCalculationResult {
  const { 
    currentPrice,
    isLoading, 
    hasError,
    errorMessage 
  } = useBitcoinPrice();
  
  // Create memoized calculation functions
  const calculators = useMemo(() => {
    // Default handlers when price isn't available
    const defaultCalculateUsd = () => 0;
    const defaultCalculateBtc = () => 0;
    
    if (!currentPrice) {
      return {
        calculateUsdValue: defaultCalculateUsd,
        calculateBtcValue: defaultCalculateBtc,
      };
    }
    
    return {
      calculateUsdValue: (btcAmount: number) => btcToUsd(btcAmount, currentPrice),
      calculateBtcValue: (usdAmount: number) => usdToBtc(usdAmount, currentPrice),
    };
  }, [currentPrice]);
  
  return {
    ...calculators,
    bitcoinPrice: currentPrice || null,
    isLoading,
    hasError,
    errorMessage,
  };
} 