import { UserRole } from '@/types'; // Assuming UserRole is defined in types/index.ts

// Define the shape of chart data points (can be refined)
export type ChartDataPoint = {
  btcPrice: number;
  unprotectedValue?: number; // Buyer: Portfolio value without protection
  protectedValue?: number;   // Buyer: Portfolio value with protection
  providerPnl?: number;      // Provider: Profit/Loss for the provider
};

// Define the input parameters required for chart generation
// TODO: Replace mock data usage with these parameters passed from context/component
type GenerateChartDataParams = {
  role: UserRole;
  // Buyer params (example)
  triggerPrice?: number; 
  breakEvenBuyer?: number; 
  btcAmount?: number; 
  // Provider params (example)
  strikePrice?: number;
  premiumReceivedPerBtc?: number; // Premium received per BTC of commitment
  commitmentAmountBtc?: number; // Total BTC commitment
};

// TODO: Refine calculations and use actual parameters from context instead of mocks
// MOCK DATA - REMOVE WHEN CONTEXT IS INTEGRATED
const mockBuyerParams = {
  triggerPrice: 94270.88,
  breakEvenBuyer: 89871.69,
  btcAmount: 0.25,
};

const mockProviderParams = {
  strikePrice: 90000,
  premiumReceivedPerBtc: 500, // Example premium
  commitmentAmountBtc: 1, // Example commitment
};
// END MOCK DATA

/**
 * Generates data points for the visualization chart based on user role.
 * 
 * @param params - Object containing role and role-specific parameters.
 * @returns An array of ChartDataPoint objects.
 */
export const generateChartData = (params: GenerateChartDataParams): ChartDataPoint[] => {
  const { role } = params;
  const data: ChartDataPoint[] = [];
  
  // Determine parameters based on role - USE MOCK FOR NOW
  const buyerParams = { ...mockBuyerParams, ...params }; // Merge potential overrides
  const providerParams = { ...mockProviderParams, ...params };

  // Define chart range based on a relevant price point (trigger/strike)
  const centralPrice = role === 'provider' 
    ? providerParams.strikePrice || 90000 // Use provider strike or default
    : buyerParams.triggerPrice || 94270; // Use buyer trigger or default
    
  const rangeMultiplier = 0.5; // How far above/below the central price to show
  const lowerBound = centralPrice * (1 - rangeMultiplier);
  const upperBound = centralPrice * (1 + rangeMultiplier);
  const steps = 40; // Number of data points

  for (let i = 0; i <= steps; i++) {
    const btcPrice = lowerBound + (upperBound - lowerBound) * (i / steps);
    let point: ChartDataPoint = { btcPrice };

    if (role === 'buyer') {
      const { triggerPrice, breakEvenBuyer, btcAmount } = buyerParams;
      // Ensure required buyer parameters are available (use defaults if necessary)
      const currentTrigger = triggerPrice ?? 0;
      const currentBreakEven = breakEvenBuyer ?? 0;
      const currentBtcAmount = btcAmount ?? 0;
      const totalPremium = (currentTrigger - currentBreakEven) * currentBtcAmount;
      const protectedValueAtTrigger = currentTrigger * currentBtcAmount;

      const unprotectedValue = btcPrice * currentBtcAmount;
      let protectedValue;
      if (btcPrice >= currentTrigger) {
        protectedValue = unprotectedValue - totalPremium;
      } else {
        protectedValue = protectedValueAtTrigger - totalPremium;
      }
      point = {
        ...point,
        unprotectedValue: unprotectedValue,
        protectedValue: protectedValue,
      };
    } else if (role === 'provider') {
      const { strikePrice, premiumReceivedPerBtc, commitmentAmountBtc } = providerParams;
      // Ensure required provider parameters are available (use defaults if necessary)
      const currentStrike = strikePrice ?? 0;
      const currentPremium = premiumReceivedPerBtc ?? 0;
      const currentCommitment = commitmentAmountBtc ?? 0;
      
      const totalPremiumReceived = currentPremium * currentCommitment;
      let pnl: number;

      if (btcPrice >= currentStrike) {
        // Price is above strike, provider keeps the premium
        pnl = totalPremiumReceived;
      } else {
        // Price is below strike, provider pays out the difference, offset by premium
        // Payout = (Strike - BTC Price) * Commitment
        // PnL = Premium Received - Payout
        const payout = (currentStrike - btcPrice) * currentCommitment;
        pnl = totalPremiumReceived - payout;
      }
      
      point = {
        ...point,
        providerPnl: pnl,
      };
    }
    data.push(point);
  }
  return data;
};

// Helper function to calculate provider break-even price
export const calculateProviderBreakEven = (strikePrice?: number, premiumReceivedPerBtc?: number): number | null => {
  if (strikePrice === undefined || premiumReceivedPerBtc === undefined) return null;
  return strikePrice - premiumReceivedPerBtc;
} 