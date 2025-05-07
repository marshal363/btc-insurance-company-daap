/**
 * Blockchain Integration Layer
 * 
 * This is the main entry point for the blockchain integration layer.
 * It exports all modules for interacting with different blockchain contracts.
 */

// Export common utilities and types
export * from './common';

// Export Oracle module
export { default as Oracle } from './oracle';

// Export other modules as they are implemented
// export { default as PolicyRegistry } from './policyRegistry';
// export { default as LiquidityPool } from './liquidityPool';

// Default export with all modules
export default {
  Oracle: require('./oracle').default,
  // Add other modules as they are implemented
  // PolicyRegistry: require('./policyRegistry').default,
  // LiquidityPool: require('./liquidityPool').default,
}; 