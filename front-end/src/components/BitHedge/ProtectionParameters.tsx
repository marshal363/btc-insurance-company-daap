"use client";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useState, useEffect } from "react";
import {
  Box,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Flex,
  Text,
  Heading,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  HStack,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Slider,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  SliderTrack,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  SliderFilledTrack,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  SliderThumb,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Button,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Icon,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Tooltip,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Grid,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  GridItem,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Input,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  VStack,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Divider,
} from "@chakra-ui/react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { IoInformationCircle } from "react-icons/io5";
import type { UserRole, ProviderTier } from '@/types';
import ProviderParametersUI from './ProviderParametersUI';
import BuyerParametersUI from './BuyerParametersUI';
import { usePremiumData } from '@/contexts/PremiumDataContext';

// Define props for the main component
interface ProtectionParametersProps {
  currentUserRole: UserRole;
}

// Define props shared by internal UI components (if needed, e.g., state setters)
// interface SharedUIProps { ... }

// --- Main Component --- 
export default function ProtectionParameters({ currentUserRole }: ProtectionParametersProps) {
  const isProvider = currentUserRole === 'provider';

  // --- Context Hook ---
  // Destructure needed functions
  const { 
    // providerInputs: contextProviderInputs, // Removed unused variable for now
    updateProviderInputs, 
    setCurrentUserRole: setContextUserRole 
  } = usePremiumData(); 

  // --- State Hooks --- 
  // Local state initialized with defaults or potentially context values
  // Let's use defaults for now, matching previous implementation
  const [selectedTier, setSelectedTier] = useState<ProviderTier>('balanced'); 
  const [commitmentAmount, setCommitmentAmount] = useState<string>("");
  const [commitmentAmountUSD, setCommitmentAmountUSD] = useState<number>(0);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(90);

  // Sync incoming role prop with context state
  useEffect(() => {
    setContextUserRole(currentUserRole);
  }, [currentUserRole, setContextUserRole]);

  // Effect to potentially initialize local state from context OR update context with initial defaults
  useEffect(() => {
    // When the component mounts or role switches to provider, 
    // ensure the context reflects the initial default local state.
    if (isProvider) {
        // Update context only if different from current local defaults
        // This prevents unnecessary updates if context already has these values.
        // Note: This logic might need refinement based on desired persistence behavior.
        updateProviderInputs({
            selectedTier: selectedTier,
            commitmentAmount: commitmentAmount,
            commitmentAmountUSD: commitmentAmountUSD,
            selectedPeriod: selectedPeriod,
        });
    }
    // Add dependencies for local state defaults if they could change
  }, [isProvider, updateProviderInputs, selectedTier, commitmentAmount, commitmentAmountUSD, selectedPeriod]);

  // Mock Wallet Balance & Price (Replace later)
  const walletBalanceSTX = 1000;
  const currentSTXPriceUSD = 0.45;

  // --- Handlers --- 
  // Buyer Handlers (remain in BuyerParametersUI for now)
  
  // Provider Handlers (Update local state AND context state)
  const handleTierSelect = (tier: ProviderTier) => {
    setSelectedTier(tier); // Update local
    updateProviderInputs({ selectedTier: tier }); // Update context
  };

  const handleCommitmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) { 
      const numericValue = parseFloat(value);
      const usdValue = !isNaN(numericValue) ? numericValue * currentSTXPriceUSD : 0;
      setCommitmentAmount(value); // Update local 
      setCommitmentAmountUSD(usdValue); // Update local
      updateProviderInputs({ commitmentAmount: value, commitmentAmountUSD: usdValue }); // Update context
    } else if (value === "") { 
      setCommitmentAmount("");
      setCommitmentAmountUSD(0);
      updateProviderInputs({ commitmentAmount: "", commitmentAmountUSD: 0 });
    }
  };

  const handleQuickSelect = (percentage: number) => {
    const amount = walletBalanceSTX * (percentage / 100);
    const amountStr = amount.toString();
    const usdValue = amount * currentSTXPriceUSD;
    setCommitmentAmount(amountStr); // Update local
    setCommitmentAmountUSD(usdValue); // Update local
    updateProviderInputs({ commitmentAmount: amountStr, commitmentAmountUSD: usdValue }); // Update context
  };

  const handlePeriodSelect = (period: number) => {
    setSelectedPeriod(period); // Update local
    updateProviderInputs({ selectedPeriod: period }); // Update context
  };

  // Shared Neumorphic Styles (Could be moved to a constants file)
  const neumorphicBg = "#E8EAE9"; 
  const neumorphicShadowLight = "-10px -10px 20px rgba(255, 255, 255, 0.8)"; 
  const neumorphicShadowDark = "10px 10px 20px rgba(163, 177, 198, 0.6)";
  const neumorphicBoxShadow = `${neumorphicShadowLight}, ${neumorphicShadowDark}`;
  const neumorphicBorderRadius = "xl"; 

  return (
    <Box bg={neumorphicBg} p={4} borderRadius={neumorphicBorderRadius} boxShadow={neumorphicBoxShadow}>
      <Heading as="h2" fontSize="2xl" fontWeight="bold" mb={4} color="gray.800">
        {isProvider ? 'Income Parameters' : 'Protection Parameters'}
      </Heading>
      <Text mb={6} color="gray.700">
        {isProvider 
          ? 'Configure your parameters for providing liquidity and earning income.'
          : 'Customize your Bitcoin protection parameters to fit your needs.'}
      </Text>
      
      {/* Conditionally render the appropriate UI component, passing props */} 
      {isProvider ? (
        <ProviderParametersUI 
          selectedTier={selectedTier}
          commitmentAmount={commitmentAmount}
          commitmentAmountUSD={commitmentAmountUSD}
          selectedPeriod={selectedPeriod}
          walletBalanceSTX={walletBalanceSTX}
          handleTierSelect={handleTierSelect}
          handleCommitmentChange={handleCommitmentChange}
          handleQuickSelect={handleQuickSelect}
          handlePeriodSelect={handlePeriodSelect}
        />
      ) : (
        <BuyerParametersUI />
      )}
    </Box>
  );
} 