// Placeholder for client-side estimation logic

// --- Types (Define or import from a shared types file later) ---
interface BuyerEstimationParams {
  currentPrice: number;
  volatility: number;
  protectedValuePercentage: number;
  protectionAmount: number;
  protectionPeriod: number; // Assuming period is in days
}

interface BuyerEstimatedResult {
  estimatedPremium: number;
  // Add other estimated fields if needed (e.g., break-even price estimate)
}

interface ProviderEstimationParams {
  commitmentAmountUSD: number;
  selectedTier: string; // e.g., "conservative", "balanced", "aggressive"
  selectedPeriodDays: number; // Renamed for consistency with backend
  volatility: number;
  currentPrice: number; // Needed for potential BTC acquisition price estimation
}

interface ProviderEstimatedResult {
  estimatedYield: number;
  estimatedAnnualizedYieldPercentage: number;
  // Add other estimated fields
}

// --- Buyer Estimation --- 

export const estimateBuyerPremium = (
  params: BuyerEstimationParams
): BuyerEstimatedResult | null => {
  // Basic validation
  if (
    !params.currentPrice ||
    params.currentPrice <= 0 ||
    !params.volatility ||
    params.volatility <= 0 ||
    !params.protectionAmount ||
    params.protectionAmount <= 0 ||
    !params.protectionPeriod ||
    params.protectionPeriod <= 0 ||
    !params.protectedValuePercentage
  ) {
    return null; // Invalid inputs for estimation
  }

  // VERY simplified Black-Scholes/heuristic - Replace with a slightly better model if needed
  // This is just for quick UI feedback, accuracy comes from Convex
  const timeFactor = Math.sqrt(params.protectionPeriod / 365); // Annualize time

  // Extremely basic approximation - not Black-Scholes
  // A slightly better heuristic might involve comparing strike vs current price
  let estimatedPremium = 
    params.protectionAmount * // Amount of BTC
    params.currentPrice *      // Current price per BTC
    params.volatility *        // Volatility factor
    timeFactor *              // Time factor
    0.5; // Arbitrary scaling/adjustment factor - TUNE THIS
  
  // Ensure premium is not negative and potentially add a small minimum
  estimatedPremium = Math.max(0.01, estimatedPremium); // Ensure minimum premium

  return {
    estimatedPremium: estimatedPremium, 
  };
};

// --- Provider Estimation --- 

export const estimateProviderYield = (
  params: ProviderEstimationParams
): ProviderEstimatedResult | null => {
  if (
    !params.commitmentAmountUSD ||
    params.commitmentAmountUSD <= 0 ||
    !params.selectedTier ||
    !params.selectedPeriodDays ||
    params.selectedPeriodDays <= 0 ||
    !params.volatility ||
    !params.currentPrice
  ) {
    return null; 
  }

  // Placeholder for provider yield estimation - Needs a model!
  // This will depend heavily on how provider tiers and periods affect yield
  // Example: Base yield + adjustments for tier/duration/volatility
  const baseYieldRate = 0.05; // 5% base annualized
  let tierMultiplier = 1.0;
  if (params.selectedTier === 'balanced') tierMultiplier = 1.2;
  if (params.selectedTier === 'aggressive') tierMultiplier = 1.5;

  const durationMultiplier = 1 + (params.selectedPeriodDays / 365) * 0.1; // Small bonus for longer duration
  const volatilityFactor = 1 + params.volatility * 2; // Higher yield for higher volatility

  const estimatedAnnualizedYieldPercentage = baseYieldRate * tierMultiplier * durationMultiplier * volatilityFactor;
  const estimatedYield = params.commitmentAmountUSD * (estimatedAnnualizedYieldPercentage * (params.selectedPeriodDays / 365));

  return {
    estimatedYield: Math.max(0.01, estimatedYield),
    estimatedAnnualizedYieldPercentage: estimatedAnnualizedYieldPercentage * 100, // Return as percentage
  };
}; 