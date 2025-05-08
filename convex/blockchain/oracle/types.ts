/**
 * Oracle Blockchain Integration Types
 * 
 * This file contains type definitions specific to Oracle blockchain operations.
 */

import { BlockchainReadResponse, BlockchainWriteResponse, TransactionParams, BlockchainError } from "../common/types";

/**
 * Base interface for read operation responses
 */
export interface ReadOperationResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Interface for Oracle price data
 */
export interface OraclePriceData {
  price: string | null;
  timestamp: string | null;
  priceInSatoshis?: number;
  priceInUSD?: number;
  error?: string;
}

/**
 * Response type for price read operations
 */
export interface OraclePriceReadResponse extends ReadOperationResponse {
  data?: OraclePriceData;
  price?: string | number;
  timestamp?: string | number;
}

/**
 * Parameters for Oracle price submission evaluation
 */
export interface OracleSubmissionParams {
  currentPriceUSD: number;
  currentTimestamp: number;
  sourceCount: number;
}

/**
 * Result of Oracle submission evaluation
 */
export interface OracleSubmissionEvaluationResult {
  shouldUpdate: boolean;
  reason: string;
  priceInSatoshis?: number;
  currentTimestamp?: number;
  percentChange?: number | null;
  sourceCount?: number;
}

/**
 * Oracle submission result
 */
export interface OracleSubmissionResult {
  txid: string;
}

/**
 * Oracle submission check result
 */
export interface OracleSubmissionCheckResult {
  updated: boolean;
  txid?: string;
  reason: string;
  priceInSatoshis?: number;
  percentChange?: number | null;
}

/**
 * Oracle update thresholds configuration
 */
export interface OracleUpdateThresholds {
  MIN_PRICE_CHANGE_PERCENT: number;
  MAX_TIME_BETWEEN_UPDATES_MS: number;
  MIN_TIME_BETWEEN_UPDATES_MS: number;
  MIN_SOURCE_COUNT: number;
}

/**
 * Enum for Oracle error codes
 */
export enum OracleErrorCode {
  NO_PRICE_DATA = "ERR_NO_PRICE_DATA",
  TIMESTAMP_TOO_OLD = "ERR_TIMESTAMP_TOO_OLD",
  INVALID_RESPONSE = "ERR_INVALID_RESPONSE",
  READ_FAILURE = "ERR_READ_FAILURE",
  SUBMISSION_FAILURE = "ERR_SUBMISSION_FAILURE",
  INSUFFICIENT_SOURCES = "ERR_INSUFFICIENT_SOURCES",
}

/**
 * Error class specific to Oracle operations
 */
export class OracleError extends BlockchainError {
  constructor(code: OracleErrorCode, message: string, details?: any) {
    super(code, message, details);
    this.name = "OracleError";
  }
}

/**
 * Response from Oracle price reading operations
 */
export type OracleReadResponse = BlockchainReadResponse<OraclePriceData>;

/**
 * Response from Oracle price writing operations
 */
export type OracleWriteResponse = BlockchainWriteResponse;

/**
 * Oracle price operation types
 */
export enum OracleOperationType {
  PRICE_READ = "PRICE_READ",
  PRICE_WRITE = "PRICE_WRITE"
}

/**
 * Oracle contract configuration
 */
export interface OracleContractConfig {
  // Oracle contract name
  name: string;
  // Oracle contract address for current network
  address: string;
  // Function name for reading the latest price
  readPriceFunction: string;
  // Function name for writing a new price
  writePriceFunction: string;
  // Function name for checking if an address is an authorized submitter
  isAuthorizedSubmitterFunction: string;
}

/**
 * Result of checking if an address is an authorized Oracle submitter
 */
export interface AuthorizedSubmitterResponse {
  isAuthorized: boolean;
  address: string;
  error?: string;
} 