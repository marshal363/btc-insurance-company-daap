export enum PolicyStatus {
  PENDING = "Pending",
  ACTIVE = "Active",
  SETTLED = "Settled",
  EXPIRED = "Expired",
  CANCELLED = "Cancelled",
  PENDING_COUNTERPARTY_ACCEPTANCE = "PendingCounterpartyAcceptance",
  PENDING_COUNTERPARTY_SIGNATURE = "PendingCounterpartySignature",
  SETTLEMENT_IN_PROGRESS = "SettlementInProgress",
}

export enum PolicyType {
  PUT = "PUT",
  CALL = "CALL",
}

export enum PositionType {
  LONG_PUT = "LONG_PUT",
  SHORT_PUT = "SHORT_PUT",
  LONG_CALL = "LONG_CALL",
  SHORT_CALL = "SHORT_CALL",
}

export enum TokenType {
  STX = "STX",
  SBTC = "sBTC",
  BTC = "BTC",
}

export enum PolicyEventType {
  CREATED = "Created",
  ONCHAIN_SUBMITTED = "OnChainSubmitted",
  ONCHAIN_CONFIRMED = "OnChainConfirmed",
  ACTIVE = "Active",
  SETTLED = "Settled",
  CANCELLED = "Cancelled",
  PREMIUM_PAID = "PremiumPaid",
  PREMIUM_DISTRIBUTION_REQUESTED = "PremiumDistributionRequested",
  PREMIUM_DISTRIBUTED = "PremiumDistributed",
  SETTLEMENT_REQUESTED = "SettlementRequested",
  SETTLEMENT_CONFIRMED = "SettlementConfirmed",
  STATUS_UPDATE = "StatusUpdate",
  ERROR = "Error",
  RECONCILIATION_UPDATE = "ReconciliationUpdate",
}

export enum TransactionStatus {
  PENDING = "Pending",
  SUBMITTED = "Submitted",
  CONFIRMED = "Confirmed",
  FAILED = "Failed",
  EXPIRED = "Expired",
  REPLACED = "Replaced",
}

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