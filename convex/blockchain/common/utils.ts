/**
 * Blockchain Utilities Module
 * 
 * This module provides shared utility functions for blockchain operations.
 */

import { NetworkEnvironment, BlockchainError, BlockchainErrorCode } from './types';
import { cvToJSON, ClarityValue } from '@stacks/transactions';
import { getStacksNetwork } from './network';

/**
 * Convert from uSTX (micro-STX) to STX
 * @param microStx Amount in micro-STX (1 STX = 1,000,000 uSTX)
 * @returns Amount in STX
 */
export function microStxToStx(microStx: number): number {
  return microStx / 1_000_000;
}

/**
 * Convert from STX to uSTX (micro-STX)
 * @param stx Amount in STX
 * @returns Amount in micro-STX (1 STX = 1,000,000 uSTX)
 */
export function stxToMicroStx(stx: number): number {
  return stx * 1_000_000;
}

/**
 * Convert from satoshis to BTC
 * @param satoshis Amount in satoshis (1 BTC = 100,000,000 satoshis)
 * @returns Amount in BTC
 */
export function satoshisToBtc(satoshis: number): number {
  return satoshis / 100_000_000;
}

/**
 * Convert from BTC to satoshis
 * @param btc Amount in BTC
 * @returns Amount in satoshis (1 BTC = 100,000,000 satoshis)
 */
export function btcToSatoshis(btc: number): number {
  return btc * 100_000_000;
}

/**
 * Check if a string is a valid Stacks address
 * @param address The address to check
 * @returns True if the address is valid
 */
export function isValidStacksAddress(address: string): boolean {
  // Basic validation - a more robust implementation would use a proper library
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  // Stacks addresses start with 'SP' (mainnet) or 'ST' (testnet)
  if (!address.startsWith('SP') && !address.startsWith('ST')) {
    return false;
  }
  
  // Length validation (standard Stacks addresses are 42 characters long)
  if (address.length !== 42) {
    return false;
  }
  
  // Character validation (Stacks addresses use base58 characters without the following characters: 0, O, I, and l)
  const invalidChars = /[0OIl]/;
  if (invalidChars.test(address.substring(2))) {
    return false;
  }
  
  return true;
}

/**
 * Parse Clarity value result from contract call
 * @param cv The Clarity value to parse
 * @param expectType Optional expected type for validation
 * @returns Parsed JavaScript value
 */
export function parseClarityValue(cv: ClarityValue, expectType?: string): any {
  // Convert to JSON representation
  const jsonValue = cvToJSON(cv);
  
  // Validate type if specified
  if (expectType && !jsonValue.type.includes(expectType)) {
    throw new BlockchainError(
      `Expected Clarity type ${expectType}, got ${jsonValue.type}`,
      BlockchainErrorCode.INVALID_PARAMS
    );
  }
  
  // Handle different Clarity types
  switch (jsonValue.type) {
    case 'uint':
      return parseInt(jsonValue.value, 10);
    case 'int':
      return parseInt(jsonValue.value, 10);
    case 'bool':
      return jsonValue.value === 'true';
    case 'string-ascii':
    case 'string-utf8':
      return jsonValue.value;
    case 'none':
      return null;
    case 'some':
      return parseClarityValue(jsonValue.value);
    case 'tuple':
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(jsonValue.value)) {
        result[key] = parseClarityValue(value as ClarityValue);
      }
      return result;
    case 'list':
      return jsonValue.value.map((item: ClarityValue) => parseClarityValue(item));
    default:
      // For other types, return the raw value
      return jsonValue.value;
  }
}

/**
 * Format an error from a contract call into a standardized error
 * @param error The error from the contract call
 * @returns Standardized BlockchainError
 */
export function formatContractError(error: any): BlockchainError {
  // Extract error message and code
  let message = 'Contract call failed';
  let code = BlockchainErrorCode.CONTRACT_ERROR;
  let details: Record<string, any> | undefined = undefined;
  
  if (error instanceof Error) {
    message = error.message;
    
    // Check if it's a network error
    if (message.includes('fetch') || message.includes('network') || message.includes('ECONNREFUSED')) {
      code = BlockchainErrorCode.NETWORK_ERROR;
    }
    
    // Check if it's an unauthorized error
    if (message.includes('unauthorized') || message.includes('permission') || message.includes('not allowed')) {
      code = BlockchainErrorCode.UNAUTHORIZED;
    }
    
    // Check if it's a timeout
    if (message.includes('timeout') || message.includes('timed out')) {
      code = BlockchainErrorCode.TIMEOUT;
    }
  } else if (typeof error === 'object' && error !== null) {
    // If it's an object, try to extract structured information
    if ('message' in error) {
      message = String(error.message);
    }
    
    // Initialize details as an empty object
    details = {};
    
    if ('code' in error) {
      // If it has a code field, use it for details
      details.errorCode = error.code;
    }
    
    // Store the raw error object in details
    details.raw = error;
  }
  
  return new BlockchainError(message, code, details);
}

/**
 * Get the latest block height from the Stacks blockchain
 * @param networkEnv The network environment
 * @returns Promise resolving to the latest block height
 * @throws BlockchainError if fetching fails
 */
export async function getLatestBlockHeight(networkEnv: NetworkEnvironment): Promise<number> {
  const network = getStacksNetwork(networkEnv);
  const apiUrl = network.coreApiUrl;
  
  try {
    const response = await fetch(`${apiUrl}/v2/info`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch blockchain info: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    
    // The stacks_tip_height field contains the latest block height
    if (data && typeof data.stacks_tip_height === 'number') {
      return data.stacks_tip_height;
    }
    
    throw new Error('Block height information not found in response');
  } catch (error: any) {
    console.error('Error fetching latest block height:', error);
    throw new BlockchainError(
      `Failed to get latest block height: ${error.message}`,
      BlockchainErrorCode.NETWORK_ERROR
    );
  }
}

/**
 * Retry a function with exponential backoff
 * @param fn The function to retry
 * @param options Retry options
 * @returns Promise resolving to the function result
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    onRetry = (error, attempt) => {
      console.warn(`Retry attempt ${attempt} after error: ${error.message}`);
    },
  } = options;
  
  let attempt = 0;
  let lastError: Error | null = null;
  
  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempt++;
      
      if (attempt > maxRetries) {
        break;
      }
      
      // Call the onRetry callback
      onRetry(lastError, attempt);
      
      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(factor, attempt - 1), maxDelay);
      
      // Add jitter to avoid thundering herd problem
      const jitteredDelay = delay * (0.5 + Math.random() * 0.5);
      
      // Wait before the next attempt
      await new Promise(resolve => setTimeout(resolve, jitteredDelay));
    }
  }
  
  throw lastError || new Error('Max retries exceeded with no error captured');
}

/**
 * Convert USD to cents.
 * @param usdAmount Amount in USD
 * @returns Amount in cents
 */
export function usdToCents(usdAmount: number): number {
  if (typeof usdAmount !== 'number' || isNaN(usdAmount)) {
    // Or throw an error, depending on desired strictness
    console.warn(`[usdToCents] Invalid input: ${usdAmount}. Returning 0.`);
    return 0; 
  }
  return Math.round(usdAmount * 100);
} 