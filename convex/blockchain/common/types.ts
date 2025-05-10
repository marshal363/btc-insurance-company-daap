/**
 * Common Blockchain Integration Types
 * 
 * This file contains shared type definitions for blockchain operations across all components.
 */

/**
 * Network environment types
 */
export enum NetworkEnvironment {
  MAINNET = "mainnet",
  TESTNET = "testnet",
  DEVNET = "devnet"
}

/**
 * Transaction status types
 */
export enum TransactionStatus {
  PENDING = "pending",
  SUBMITTED = "submitted",
  CONFIRMED = "confirmed",
  FAILED = "failed",
  EXPIRED = "expired",
  REPLACED = "replaced"
}

/**
 * Interface for blockchain contract definitions
 */
export interface BlockchainContract {
  name: string;
  address: string;
  // Map of network environments to contract addresses
  addresses: Record<NetworkEnvironment, string | null>;
  // Contract interfaces may be defined here or imported from contract-specific type files
  abi?: Record<string, any>;
  // Optional: Number of decimals for fungible tokens
  decimals?: number;
  // Contract deployment height for determining history starting point
  deploymentHeight?: Record<NetworkEnvironment, number>;
}

/**
 * Base transaction parameters interface
 */
export interface TransactionParams {
  // The network to use for the transaction
  network: NetworkEnvironment;
  // Function name to call in the contract
  function?: string;
  // Function arguments
  args?: any[];
  // Transaction options
  options?: {
    // Number of confirmations to wait for
    confirmations?: number;
    // Maximum gas to spend
    maxFee?: number;
    // Nonce for the transaction
    nonce?: number;
    // Signer for the transaction (defaults to backend signer)
    signer?: any;
    // Post-conditions for the transaction
    postConditions?: any[];
    // Whether to wait for confirmation
    waitForConfirmation?: boolean;
    // Timeout in milliseconds for waiting for confirmation
    confirmationTimeout?: number;
  };
}

/**
 * Response from a blockchain read operation
 */
export interface BlockchainReadResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  blockHeight?: number;
  timestamp?: number;
  source?: string;
}

/**
 * Response from a blockchain write operation
 */
export interface BlockchainWriteResponse {
  success: boolean;
  txId?: string;
  error?: string; // General error message
  data?: any;
  confirmationData?: {
    blockHeight?: number;
    timestamp?: number;
    gasUsed?: number;
  };
  errorType?: string; // Specific error type, e.g., 'BadNonce'
  expectedNonce?: number; // For BadNonce errors, the nonce the network expected
}

/**
 * Generic blockchain error with typed error codes
 */
export class BlockchainError extends Error {
  code: string;
  details?: Record<string, any>;

  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message);
    this.name = "BlockchainError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Error codes for blockchain operations
 */
export enum BlockchainErrorCode {
  NETWORK_ERROR = "NETWORK_ERROR",
  TRANSACTION_REJECTED = "TRANSACTION_REJECTED",
  CONTRACT_ERROR = "CONTRACT_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  INVALID_PARAMS = "INVALID_PARAMS",
  TIMEOUT = "TIMEOUT",
  UNKNOWN_ERROR = "UNKNOWN_ERROR"
}

/**
 * Configuration for blockchain retry/backoff strategy
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  factor: number;
}

/**
 * Blockchain operation types
 */
export enum BlockchainOperationType {
  READ = "READ",
  WRITE = "WRITE",
  EVENT_LISTEN = "EVENT_LISTEN"
}

/**
 * Expected format for exporting a blockchain module interface
 */
export interface BlockchainModuleInterface {
  // Read operations
  read: Record<string, (...args: any[]) => Promise<BlockchainReadResponse>>;
  // Write operations
  write: Record<string, (...args: any[]) => Promise<BlockchainWriteResponse>>;
  // Event listeners
  events?: Record<string, (...args: any[]) => Promise<any>>;
  // Module configuration
  config: {
    name: string;
    supportedNetworks: NetworkEnvironment[];
    contracts: Record<string, BlockchainContract>;
  };
} 