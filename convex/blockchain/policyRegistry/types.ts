/**
 * Policy Registry Blockchain Integration Types
 * 
 * This file contains type definitions specific to Policy Registry blockchain operations.
 */

import { BlockchainReadResponse, BlockchainWriteResponse, TransactionParams, BlockchainError, BlockchainErrorCode, NetworkEnvironment } from "../common/types";

// Re-export the common types used across the Policy Registry module
export { BlockchainError, BlockchainErrorCode, NetworkEnvironment };

/**
 * Policy status types corresponding to on-chain status
 */
export enum PolicyStatus {
  ACTIVE = "Active",
  EXERCISED = "Exercised",
  EXPIRED = "Expired",
  SETTLED = "Settled"
}

/**
 * Policy types corresponding to on-chain policy types
 */
export enum PolicyType {
  PUT = "PUT",
  CALL = "CALL"
}

/**
 * Position types for policies
 */
export enum PositionType {
  LONG_PUT = "LONG_PUT", // Buyer/Protected position (Protective Peter)
  SHORT_PUT = "SHORT_PUT" // Seller/Income position (Income Irene)
}

/**
 * Policy event types for on-chain events
 */
export enum PolicyEventType {
  CREATED = "CREATED",
  EXERCISED = "EXERCISED",
  EXPIRED = "EXPIRED",
  SETTLED = "SETTLED",
  PREMIUM_DISTRIBUTED = "PREMIUM_DISTRIBUTED"
}

/**
 * Types of transactions for the Policy Registry
 */
export enum PolicyTransactionType {
  CREATE = "CREATE",
  EXERCISE = "EXERCISE",
  EXPIRE = "EXPIRE",
  SETTLE = "SETTLE",
  DISTRIBUTE_PREMIUM = "DISTRIBUTE_PREMIUM"
}

/**
 * Parameters for policy creation
 */
export interface PolicyCreationParams extends TransactionParams {
  // Policy type (PUT or CALL)
  policyType: PolicyType;
  // Position type (LONG_PUT or SHORT_PUT)
  positionType: PositionType;
  // Owner's principal
  owner: string;
  // Counterparty's principal (if specified)
  counterparty?: string;
  // Strike price in USD
  strikePrice: number;
  // Amount of BTC covered
  amount: number;
  // Premium amount in USD
  premium: number;
  // Expiration block height
  expirationHeight: number;
  // Token used for collateral (STX/sBTC)
  collateralToken: string;
  // Token used for settlement (STX/sBTC)
  settlementToken: string;
}

/**
 * Parameters for updating policy status
 */
export interface UpdatePolicyStatusParams extends TransactionParams {
  // On-chain policy ID
  policyId: string;
  // New status to set
  newStatus: PolicyStatus;
  // Optional settlement amount (required for EXERCISED)
  settlementAmount?: number;
  // Optional settlement price (BTC price at time of exercise)
  settlementPrice?: number;
}

/**
 * Parameters for batch policy expiration
 */
export interface ExpirePoliciesBatchParams extends TransactionParams {
  // List of on-chain policy IDs to expire
  policyIds: string[];
  // Current block height (for verification)
  currentBlockHeight: number;
}

/**
 * Parameters for premium distribution
 */
export interface PremiumDistributionParams extends TransactionParams {
  // On-chain policy ID
  policyId: string;
  // Amount of premium to distribute
  amount: number;
  // Token in which premium is distributed
  token: string;
  // Recipient principal
  recipient: string;
}

/**
 * Policy data structure as returned from the blockchain
 */
export interface PolicyData {
  // On-chain policy ID
  id: string;
  // Policy type (PUT or CALL)
  policyType: PolicyType;
  // Position type (LONG_PUT or SHORT_PUT)
  positionType: PositionType;
  // Owner's principal
  owner: string;
  // Counterparty's principal
  counterparty: string;
  // Strike price in USD
  strikePrice: number;
  // Amount of BTC covered
  amount: number;
  // Premium amount
  premium: number;
  // Current status
  status: PolicyStatus;
  // Creation block height
  creationHeight: number;
  // Expiration block height
  expirationHeight: number;
  // Settlement details (if exercised)
  settlement?: {
    amount: number;
    price: number;
    blockHeight: number;
  };
  // Premium distribution status
  premiumDistributed: boolean;
  // Collateral token
  collateralToken: string;
  // Settlement token
  settlementToken: string;
}

/**
 * Response from policy read operations
 */
export type PolicyReadResponse = BlockchainReadResponse<PolicyData>;

/**
 * Response from policy write operations
 */
export type PolicyWriteResponse = BlockchainWriteResponse;

/**
 * Result of checking policy exercisability
 */
export interface PolicyExercisabilityResult {
  isExercisable: boolean;
  policyId: string;
  currentPrice?: number;
  strikePrice: number;
  reason?: string;
}

/**
 * Policy Registry contract configuration
 */
export interface PolicyRegistryContractConfig {
  // Contract name
  name: string;
  // Contract address for current network
  address: string;
  // Function names for various operations
  functions: {
    createPolicy: string;
    updatePolicyStatus: string;
    expirePoliciesBatch: string;
    getPolicy: string;
    isPolicyActive: string;
    calculateSettlement: string;
    distributePremium: string;
  };
} 