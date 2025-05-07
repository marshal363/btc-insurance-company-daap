/**
 * Services Layer Index
 * 
 * This file serves as the main entry point for the services layer,
 * exporting all service modules for easy access throughout the application.
 */

// Export Oracle services
export { default as Oracle } from './oracle';

// Export other service modules as they are implemented
// export { default as PolicyRegistry } from './policyRegistry';
// export { default as LiquidityPool } from './liquidityPool';

// Default export with all services
export default {
  Oracle: require('./oracle').default,
  // Add other services as they are implemented
  // PolicyRegistry: require('./policyRegistry').default,
  // LiquidityPool: require('./liquidityPool').default,
}; 