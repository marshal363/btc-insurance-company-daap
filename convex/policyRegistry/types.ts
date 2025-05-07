import { Id } from "../_generated/dataModel";

/**
 * Enum for policy status
 */
export enum PolicyStatus {
  DRAFT = "DRAFT",        // Policy is created but not yet on-chain
  ACTIVE = "ACTIVE",      // Policy is active and can be exercised
  EXERCISED = "EXERCISED", // Policy has been exercised
  SETTLED = "SETTLED",     // Policy has been exercised and settlement has been processed
  EXPIRED = "EXPIRED",     // Policy has expired without being exercised
}

/**
 * Enum for policy types
 */
export enum PolicyType {
  PUT = "PUT",
  CALL = "CALL",
}

/**
 * Enum for position type
 */
export enum PositionType {
  LONG_PUT = "LONG_PUT",     // Buyer of a PUT option (protected against price decrease)
  SHORT_PUT = "SHORT_PUT",    // Seller of a PUT option
  LONG_CALL = "LONG_CALL",    // Buyer of a CALL option (protected against price increase)
  SHORT_CALL = "SHORT_CALL",   // Seller of a CALL option
}

/**
 * Enum for token type
 */
export enum TokenType {
  STX = "STX",
  SBTC = "sBTC",
}

/**
 * Enum for transaction status
 */
export enum TransactionStatus {
  PENDING = "Pending",       // Transaction is waiting to be submitted
  SUBMITTED = "Submitted",   // Transaction has been submitted to the blockchain
  CONFIRMED = "Confirmed",   // Transaction has been confirmed on the blockchain
  FAILED = "Failed",         // Transaction failed to be processed
  EXPIRED = "Expired",       // Transaction expired without being processed
  REPLACED = "Replaced",     // Transaction was replaced by another one
}

/**
 * Enum for policy event types
 */
export enum PolicyEventType {
  CREATED = "Created",
  STATUS_UPDATE = "StatusUpdate",
  ONCHAIN_CONFIRMED = "OnChainConfirmed",
  ACTIVATED = "Activated",
  SETTLED = "Settled",
  EXPIRED = "Expired",
  SETTLEMENT_REQUESTED = "SettlementRequested",
  PREMIUM_DISTRIBUTED = "PremiumDistributed",
  ERROR = "Error",
}

/**
 * Type for network environment
 */
export type NetworkEnvironment = "mainnet" | "testnet" | "devnet";

/**
 * Interface for policy creation parameters
 */
export interface PolicyCreationParams {
  owner: string;
  counterparty?: string;
  protectedValueUSD: number;
  protectionAmountBTC: number;
  policyType: PolicyType;
  durationDays: number;
  premiumUSD?: number;
  collateralToken?: TokenType;
  settlementToken?: TokenType;
  displayName?: string;
  description?: string;
  tags?: string[];
}

/**
 * Interface for premium calculation parameters
 */
export interface CalculatePremiumForCreationParams {
  policyType: PolicyType;
  strikePriceUSD: number;
  durationDays: number;
  protectionAmount: number;
}

export interface PolicyActivationEligibilityResult {
  eligible: boolean;
  reason?: string;
  settlementAmount?: number;
} 