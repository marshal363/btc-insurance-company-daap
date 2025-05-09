/**
 * Oracle Services Index
 * 
 * This file exports all Oracle service modules for easier imports.
 */

// Export price service
export * from './priceService';

// Export premium calculation service
export * from './premiumCalculation';

// Export historical data service
export * from './historicalData';

// Export volatility service
export * from './volatilityService';

// Default export for the Oracle service module
export default {
  price: {
    // Price service functions
    getLatestOnChainPrice: async () => {
      const { getLatestOnChainPrice } = await import('./priceService');
      return getLatestOnChainPrice;
    },
    calculate24hRange: async () => {
      const { calculate24hRange } = await import('./priceService');
      return calculate24hRange;
    },
    getLatestPrice: async () => {
      const { getLatestPrice } = await import('./priceService');
      return getLatestPrice;
    },
    checkAndSubmitPrice: async () => {
      const { checkAndSubmitPrice } = await import('./priceService');
      return checkAndSubmitPrice;
    }
  },
  premium: {
    // Premium calculation functions
    calculatePremium: async () => {
      const { calculatePremium } = await import('./premiumCalculation');
      return calculatePremium;
    },
    getBuyerPremiumQuote: async () => {
      const { getBuyerPremiumQuote } = await import('./premiumCalculation');
      return getBuyerPremiumQuote;
    },
    getProviderYieldQuote: async () => {
      const { getProviderYieldQuote } = await import('./premiumCalculation');
      return getProviderYieldQuote;
    }
  }
}; 