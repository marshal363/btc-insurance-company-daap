import { Id } from "./_generated/dataModel";

// Market Data Types
export interface MarketData {
  price: number;
  volatility: number;
  timestamp: number;
}

// Risk Parameter Types
export interface TierMultipliers {
  conservative: number;
  balanced: number;
  aggressive: number;
}

export interface RiskParameters {
  assetType: string;
  policyType: string;
  baseRate: number;
  volatilityMultiplier: number;
  durationFactor: number;
  coverageFactor: number;
  tierMultipliers: TierMultipliers;
  liquidityAdjustment: number;
  marketTrendAdjustment: number;
  version: number;
  lastUpdated: string;
  updatedBy: string;
  isActive: boolean;
}

// Premium Calculation Types
export interface PremiumComponents {
  premium: number;
  intrinsicValue: number;
  timeValue: number;
  volatilityImpact: number;
}

export interface PriceScenario {
  price: number;
  protectionValue: number;
  netValue: number;
}

export interface BuyerCalculationInputs {
  protectedValuePercentage: number;
  protectionAmount: number;
  expirationDays: number;
  policyType: string;
  protectedValueUSD: number;
}

export interface MarketDataSnapshot {
  btcPrice: number;
  volatility: number;
  timestamp: string;
}

export interface BuyerPremiumQuoteResult {
  inputs: BuyerCalculationInputs;
  premium: number;
  premiumPercentage: number;
  annualizedPremium: number;
  breakEvenPrice: number;
  factorsBreakdown: {
    intrinsicValue: number;
    timeValue: number;
    volatilityImpact: number;
  };
  scenarios: PriceScenario[];
  marketDataSnapshot: MarketDataSnapshot;
  riskParamsSnapshot: RiskParameters;
}

// Provider Yield Types
export interface ProviderCalculationInputs {
  commitmentAmount: number;
  commitmentAmountUSD: number;
  selectedTier: string;
  selectedPeriod: number;
}

export interface ProviderYieldComponents {
  estimatedYield: number;
  annualizedYieldPercentage: number;
  estimatedBTCAcquisitionPrice?: number;
  riskLevel: number;
  baseYield: number;
  tierAdjustment: number;
  durationAdjustment: number;
  marketConditionAdjustment: number;
  capitalEfficiency?: number;
}

export interface ProviderYieldQuoteResult extends ProviderYieldComponents {
  inputs: ProviderCalculationInputs;
  marketDataSnapshot: MarketDataSnapshot;
  riskParamsSnapshot: RiskParameters;
}

// Blockchain Types
export interface BuyerBlockchainParams {
  policyType: string;
  protectedValueMicroStx: bigint;
  protectedAmountSats: bigint;
  expirationBlocks: bigint;
  premiumMicroStx: bigint;
  currentBlockHeight: bigint;
  expirationHeight: bigint;
}

export interface ProviderBlockchainParams {
  tierName: string;
  commitmentAmountMicroStx: bigint;
  durationBlocks: bigint;
  currentBlockHeight: bigint;
  expirationHeight: bigint;
}

export type BlockchainParams = BuyerBlockchainParams | ProviderBlockchainParams;

export interface MockTransaction {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: string[];
  postConditions: Array<{
    type: string;
    amount: string;
    condition: string;
  }>;
  nonce: number;
  fee: string;
}

export interface PreparedTransaction {
  transaction: MockTransaction;
  blockchainParams: Record<string, string | number>;
  quoteType: string;
} 