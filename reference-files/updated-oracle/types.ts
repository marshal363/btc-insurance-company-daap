export interface ExchangeSource {
  name: string;
  price: number;
  lastUpdated: string;
  confidence: number;
}

export interface BitcoinPriceData {
  currentPrice: number;
  lastUpdated: string;
  dayLow: number;
  dayHigh: number;
  historicalVolatility: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  exchanges?: ExchangeSource[];
  period?: number;
}

export interface OptionParameters {
  currentPrice: number;
  strikePrice: number;
  timeToExpiry: number; // in years
  volatility: number; // percentage
  riskFreeRate: number; // percentage
  amount: number; // in BTC
}

export interface PremiumCalculationResult {
  premium: number; // in BTC
  premiumUsd: number; // in USD
  premiumRate: number; // percentage of BTC value
  apyEquivalent: number; // annualized premium rate
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  breakEvenPrice: number;
}

export interface SimulationPoint {
  price: number;
  unprotectedValue: number;
  protectedValue: number;
}

export type CalculatorTab = "buyer" | "seller";

export interface TimePeriodOption {
  id: string;
  label: string;
  days: number;
}

export interface StrikePriceOption {
  percentage: number;
  label: string;
}