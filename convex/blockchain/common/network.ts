/**
 * Network Configuration Module
 *
 * This module handles all network configuration and connection details for blockchain operations.
 * It provides utilities for getting network objects, API URLs, and environment-specific configurations.
 */

import { StacksMainnet, StacksTestnet, StacksMocknet, StacksNetwork } from '@stacks/network';
import { NetworkEnvironment } from './types';

/**
 * API URL overrides from environment variables - centralized for easier management
 */
const API_URL_OVERRIDES = {
  MAINNET_API_URL: process.env.STACKS_MAINNET_API_URL,
  TESTNET_API_URL: process.env.STACKS_TESTNET_API_URL,
  DEVNET_API_URL: process.env.STACKS_DEVNET_API_URL,
};

/**
 * Default API URLs for each network environment
 */
const DEFAULT_API_URLS = {
  [NetworkEnvironment.MAINNET]: 'https://stacks-node-api.mainnet.stacks.co',
  [NetworkEnvironment.TESTNET]: 'https://stacks-node-api.testnet.stacks.co',
  [NetworkEnvironment.DEVNET]: 'http://localhost:3999',
};

/**
 * Get the current network environment from environment variables
 * @returns {NetworkEnvironment} The current network environment
 * @throws {Error} If the network environment is not configured or invalid
 */
export function getNetworkEnvironment(): NetworkEnvironment {
  const networkEnv = process.env.STACKS_NETWORK?.toLowerCase();
  
  if (!networkEnv) {
    console.error("CRITICAL: STACKS_NETWORK environment variable is not set in Convex dashboard.");
    throw new Error("Stacks network is not configured. Set STACKS_NETWORK environment variable (e.g., 'devnet', 'testnet', 'mainnet').");
  }

  // Map input to enum values with validation
  switch (networkEnv) {
    case 'mainnet':
      return NetworkEnvironment.MAINNET;
    case 'testnet':
      return NetworkEnvironment.TESTNET;
    case 'devnet':
    case 'mocknet': // For backward compatibility
      return NetworkEnvironment.DEVNET;
    default:
      console.error(`CRITICAL: Invalid STACKS_NETWORK environment variable value: "${networkEnv}".`);
      throw new Error(`Invalid STACKS_NETWORK. Use 'devnet', 'testnet', or 'mainnet'. Found: ${networkEnv}`);
  }
}

/**
 * Get the API URL for a specific network environment, with environment variable override support
 * @param env The network environment
 * @returns The API URL for the specified environment
 */
export function getApiUrl(env: NetworkEnvironment): string {
  // Check for environment variable overrides first
  switch (env) {
    case NetworkEnvironment.MAINNET:
      return API_URL_OVERRIDES.MAINNET_API_URL || DEFAULT_API_URLS[NetworkEnvironment.MAINNET];
    case NetworkEnvironment.TESTNET:
      return API_URL_OVERRIDES.TESTNET_API_URL || DEFAULT_API_URLS[NetworkEnvironment.TESTNET];
    case NetworkEnvironment.DEVNET:
      return API_URL_OVERRIDES.DEVNET_API_URL || DEFAULT_API_URLS[NetworkEnvironment.DEVNET];
    default:
      return DEFAULT_API_URLS[env];
  }
}

/**
 * Get the Stacks network object for a specific environment
 * @param env The network environment (defaults to current environment if not specified)
 * @returns The Stacks network object
 */
export function getStacksNetwork(env?: NetworkEnvironment): StacksNetwork {
  // Use specified environment or get from environment variables
  const networkEnv = env || getNetworkEnvironment();
  const apiUrl = getApiUrl(networkEnv);

  // Create and return the appropriate network object
  switch (networkEnv) {
    case NetworkEnvironment.MAINNET:
      return new StacksMainnet({ url: apiUrl });
    case NetworkEnvironment.TESTNET:
      return new StacksTestnet({ url: apiUrl });
    case NetworkEnvironment.DEVNET:
      return new StacksMocknet({ url: apiUrl });
    default:
      // This should never happen due to validation in getNetworkEnvironment
      throw new Error(`Unsupported network environment: ${networkEnv}`);
  }
}

/**
 * Get the current Stacks network configuration based on environment variables
 * @returns Current network configuration object with additional metadata
 */
export function getCurrentNetworkConfig() {
  const env = getNetworkEnvironment();
  const network = getStacksNetwork(env);
  
  return {
    environment: env,
    apiUrl: network.coreApiUrl,
    network,
    chainId: env === NetworkEnvironment.MAINNET ? 1 : 
             env === NetworkEnvironment.TESTNET ? 2147483648 : 
             2147483649, // DEVNET
    isMainnet: env === NetworkEnvironment.MAINNET,
    isTestnet: env === NetworkEnvironment.TESTNET,
    isDevnet: env === NetworkEnvironment.DEVNET,
  };
}

/**
 * Fetch the account nonce from the Stacks blockchain
 * @param address The Stacks address
 * @returns The current nonce for the address
 * @throws {Error} If fetching the nonce fails
 */
export async function fetchAccountNonce(address: string): Promise<number> {
  const { apiUrl } = getCurrentNetworkConfig();
  console.log(`Fetching nonce for address ${address} from ${apiUrl}`);
  
  try {
    const response = await fetch(`${apiUrl}/v2/accounts/${address}?proof=0`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch account info: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    const nonce = data.nonce || 0;
    console.log(`Current nonce for ${address}: ${nonce}`);
    return nonce;
  } catch (error: any) {
    console.error(`Error fetching nonce for ${address}:`, error);
    throw new Error(`Failed to fetch nonce: ${error.message}`);
  }
} 