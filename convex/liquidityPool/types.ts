import { Id } from "../_generated/dataModel";

// --- Enums ---
export enum TransactionType {
  DEPOSIT = "DEPOSIT",
  WITHDRAWAL = "WITHDRAWAL",
  PREMIUM = "PREMIUM",
  ALLOCATION = "ALLOCATION",
  COLLATERAL_RELEASE = "COLLATERAL_RELEASE",
  PREMIUM_BATCH = "PREMIUM_BATCH",
  SETTLEMENT = "SETTLEMENT",
  PREMIUM_DISTRIBUTION = "PREMIUM_DISTRIBUTION",
  PREMIUM_WITHDRAWAL = "PREMIUM_WITHDRAWAL",
}

export enum TransactionStatus {
  PENDING = "PENDING",
  SUBMITTED = "SUBMITTED",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED",
  REVERTED = "REVERTED",
  PENDING_CONFIRMATION = "pending_confirmation", // For external txs awaiting blockchain confirmation
}

export enum AllocationStatus {
  ACTIVE = "ACTIVE",
  EXPIRED = "EXPIRED",
  EXERCISED = "EXERCISED",
  CANCELLED = "CANCELLED",
}

export enum PremiumDistributionStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export interface ProcessClaimSettlementResult {
  success: boolean;
  message: string;
  loggedPoolTransactionId: Id<"pool_transactions">;
}

// You can add other shared types and enums here as needed. 