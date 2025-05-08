/**
 * Liquidity Pool Blockchain Integration Types
 * 
 * This file contains type definitions specific to Liquidity Pool blockchain operations.
 */

import { BlockchainReadResponse, BlockchainWriteResponse, TransactionParams, BlockchainError } from "../common/types";

/**
 * Supported token types
 */
export enum TokenType {
  STX = "STX",
  SBTC = "SBTC"
}

/**
 * Types of transactions for the Liquidity Pool
 */
export enum LiquidityPoolTransactionType {
  DEPOSIT = "DEPOSIT",
  WITHDRAW = "WITHDRAW",
  LOCK_COLLATERAL = "LOCK_COLLATERAL",
  RELEASE_COLLATERAL = "RELEASE_COLLATERAL",
  PAY_SETTLEMENT = "PAY_SETTLEMENT",
  RECORD_PREMIUM = "RECORD_PREMIUM",
  DISTRIBUTE_PREMIUM = "DISTRIBUTE_PREMIUM"
}

/**
 * Parameters for token deposit
 */
export interface DepositParams extends TransactionParams {
  // Token type (STX or sBTC)
  token: TokenType;
  // Amount to deposit
  amount: number;
  // Provider's principal
  provider: string;
}

/**
 * Parameters for token withdrawal
 */
export interface WithdrawalParams extends TransactionParams {
  // Token type (STX or sBTC)
  token: TokenType;
  // Amount to withdraw
  amount: number;
  // Provider's principal
  provider: string;
}

/**
 * Parameters for locking collateral
 */
export interface LockCollateralParams extends TransactionParams {
  // Token type (STX or sBTC)
  token: TokenType;
  // Amount to lock
  amount: number;
  // Policy ID for which collateral is locked
  policyId: string;
}

/**
 * Parameters for releasing collateral
 */
export interface ReleaseCollateralParams extends TransactionParams {
  // Token type (STX or sBTC)
  token: TokenType;
  // Amount to release
  amount: number;
  // Policy ID for which collateral is released
  policyId: string;
}

/**
 * Parameters for settlement payment
 */
export interface SettlementParams extends TransactionParams {
  // Token type (STX or sBTC)
  token: TokenType;
  // Amount to pay
  amount: number;
  // Policy ID for which settlement is paid
  policyId: string;
  // Recipient's principal
  recipient: string;
}

/**
 * Parameters for premium recording
 */
export interface RecordPremiumParams extends TransactionParams {
  // Token type (STX or sBTC)
  token: TokenType;
  // Premium amount
  amount: number;
  // Policy ID for which premium is recorded
  policyId: string;
}

/**
 * Parameters for premium distribution
 */
export interface DistributePremiumParams extends TransactionParams {
  // Token type (STX or sBTC)
  token: TokenType;
  // Amount to distribute
  amount: number;
  // Policy ID for which premium is distributed
  policyId: string;
  // Provider's principal
  provider: string;
  // Provider's allocation percentage (0-100)
  allocationPercentage: number;
}

/**
 * Pool balance data structure returned from the blockchain
 */
export interface PoolBalanceData {
  // STX balance
  stxBalance: number;
  // sBTC balance
  sbtcBalance: number;
  // Locked STX collateral
  lockedStxCollateral: number;
  // Locked sBTC collateral
  lockedSbtcCollateral: number;
  // STX premium balance
  stxPremiumBalance: number;
  // sBTC premium balance
  sbtcPremiumBalance: number;
}

/**
 * Provider balance data structure returned from the blockchain
 */
export interface ProviderBalanceData {
  // Provider's principal
  provider: string;
  // STX balance
  stxBalance: number;
  // sBTC balance
  sbtcBalance: number;
  // STX premium balance
  stxPremiumBalance: number;
  // sBTC premium balance
  sbtcPremiumBalance: number;
  // Total estimated value in USD
  totalValueUsd?: number;
}

/**
 * Policy allocation data structure returned from the blockchain
 */
export interface PolicyAllocationData {
  // Policy ID
  policyId: string;
  // Provider's principal
  provider: string;
  // Allocation percentage (0-100)
  allocationPercentage: number;
  // Allocation amount
  allocationAmount: number;
  // Token type (STX or sBTC)
  token: TokenType;
}

/**
 * Response from pool balance read operations
 */
export type PoolBalanceResponse = BlockchainReadResponse<PoolBalanceData>;

/**
 * Response from provider balance read operations
 */
export type ProviderBalanceResponse = BlockchainReadResponse<ProviderBalanceData>;

/**
 * Response from liquidity pool write operations
 */
export type LiquidityPoolWriteResponse = BlockchainWriteResponse;

/**
 * Liquidity Pool contract configuration
 */
export interface LiquidityPoolContractConfig {
  // Contract name
  name: string;
  // Contract address for current network
  address: string;
  // Function names for various operations
  functions: {
    depositStx: string;
    depositSbtc: string;
    withdrawStx: string;
    withdrawSbtc: string;
    lockCollateral: string;
    releaseCollateral: string;
    paySettlement: string;
    recordPremium: string;
    distributePremium: string;
    getPoolBalances: string;
    getProviderBalances: string;
  };
}

// Error codes specific to Liquidity Pool operations
export enum LiquidityPoolErrorCode {
  INSUFFICIENT_LIQUIDITY = "406",
  COLLATERAL_LOCKED = "407",
  UNAUTHORIZED_ACCESS = "401",
  TOKEN_NOT_INITIALIZED = "404",
  TRANSFER_FAILED = "500",
  INVALID_AMOUNT = "405",
  PREMIUM_ALREADY_DISTRIBUTED = "409",
  PREMIUM_NOT_RECORDED = "410",
  INVALID_PREMIUM_SHARE = "411",
  POLICY_NOT_FOUND = "408",
  NETWORK_ERROR = "503",
  UNKNOWN_ERROR = "999"
}

// Specific error class for Liquidity Pool operations
export class LiquidityPoolError extends BlockchainError {
  constructor(code: LiquidityPoolErrorCode, message: string, details?: any) {
    super(code, message, details);
    this.name = 'LiquidityPoolError';
  }
}

// Parameter interfaces for transactions
export interface DepositParams {
  token: TokenType;
  amount: number;
  depositor: string;
}

export interface WithdrawalParams {
  token: TokenType;
  amount: number;
  recipient: string;
  includePremium?: boolean;
}

export interface CollateralParams {
  token: TokenType;
  amount: number;
  policyId: string;
}

export interface SettlementParams {
  token: TokenType;
  amount: number;
  recipient: string;
  policyId: string;
}

export interface PremiumDistributionParams {
  token: TokenType;
  amount: number;
  recipient: string;
  policyId: string;
}

export interface ProviderAllocationParams {
  provider: string;
  policyId: string;
  token: TokenType;
  allocatedAmount: number;
  premiumShare: number; // Percentage (0-100)
}

// Response interfaces for read operations
export interface PoolBalancesResponse {
  total: number;
  locked: number;
  available: number;
}

export interface PremiumBalancesResponse {
  total: number;
  distributed: number;
  available: number;
}

export interface ProviderAllocationResponse {
  token: TokenType;
  allocatedAmount: number;
  premiumShare: number;
  premiumDistributed: boolean;
}

// Event interfaces
export interface FundsDepositedEvent {
  eventType: 'funds-deposited';
  depositor: string;
  amount: number;
  token: TokenType;
  txId: string;
}

export interface FundsWithdrawnEvent {
  eventType: 'funds-withdrawn';
  withdrawer: string;
  amount: number;
  token: TokenType;
  txId: string;
}

export interface CollateralLockedEvent {
  eventType: 'collateral-locked';
  policyId: string;
  amountLocked: number;
  token: TokenType;
  txId: string;
}

export interface CollateralReleasedEvent {
  eventType: 'collateral-released';
  policyId: string;
  amountReleased: number;
  token: TokenType;
  txId: string;
}

export interface SettlementPaidEvent {
  eventType: 'settlement-paid';
  policyId: string;
  buyer: string;
  settlementAmount: number;
  token: TokenType;
  txId: string;
}

export interface PremiumRecordedEvent {
  eventType: 'premium-recorded';
  policyId: string;
  counterparty: string;
  premiumAmount: number;
  token: TokenType;
  txId: string;
}

export interface PremiumDistributedEvent {
  eventType: 'premium-distributed';
  policyId: string;
  counterparty: string;
  premiumAmount: number;
  token: TokenType;
  txId: string;
}

export interface ProviderAllocationEvent {
  eventType: 'provider-allocation-recorded';
  provider: string;
  policyId: string;
  allocatedAmount: number;
  premiumShare: number;
  token: TokenType;
  txId: string;
}

export interface ProviderPremiumDistributedEvent {
  eventType: 'provider-premium-distributed';
  provider: string;
  policyId: string;
  premiumAmount: number;
  token: TokenType;
  txId: string;
}

// Union type for all Liquidity Pool events
export type LiquidityPoolEvent = 
  | FundsDepositedEvent
  | FundsWithdrawnEvent
  | CollateralLockedEvent
  | CollateralReleasedEvent
  | SettlementPaidEvent
  | PremiumRecordedEvent
  | PremiumDistributedEvent
  | ProviderAllocationEvent
  | ProviderPremiumDistributedEvent;

// Transaction response interfaces
export interface TransactionResponse {
  txId: string;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
} 