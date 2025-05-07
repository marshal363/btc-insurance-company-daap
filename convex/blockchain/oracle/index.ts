/**
 * Oracle Blockchain Integration Module
 * 
 * This module provides access to the Oracle blockchain functionality.
 * It exports all the individual Oracle modules for easier imports.
 */

// Export types
export * from './types';

// Export reader functionality
export * from './priceReader';

// Export writer functionality 
export * from './priceWriter';

// Export adapter functionality
export * from './adapter';

// Default export for the Oracle module
export default {
  read: {
    getLatestPrice: async () => {
      const { readLatestOraclePrice } = await import('./priceReader');
      return readLatestOraclePrice();
    }
  },
  write: {
    submitPrice: async (priceInSatoshis: number) => {
      const { submitAggregatedPrice } = await import('./priceWriter');
      return submitAggregatedPrice({ priceInSatoshis });
    },
    checkAndSubmitPrice: async (params: { currentPriceUSD: number, currentTimestamp: number, sourceCount: number }) => {
      const { checkAndSubmitOraclePrice } = await import('./priceWriter');
      return checkAndSubmitOraclePrice({
        currentPriceUSD: params.currentPriceUSD,
        currentTimestamp: params.currentTimestamp,
        sourceCount: params.sourceCount || 0
      });
    }
  },
  config: {
    name: 'Oracle',
    supportedNetworks: ['mainnet', 'testnet', 'devnet'],
    constants: {
      getUpdateThresholds: () => {
        const { ORACLE_UPDATE_THRESHOLDS } = require('./priceWriter');
        return ORACLE_UPDATE_THRESHOLDS;
      }
    }
  }
}; 