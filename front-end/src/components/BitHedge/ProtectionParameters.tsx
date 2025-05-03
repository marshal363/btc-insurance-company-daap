"use client";

import {
  Box,
  Text,
  Heading,
} from "@chakra-ui/react";
import type { UserRole } from '@/types';
import ProviderParametersUI from './ProviderParametersUI';
import BuyerParametersUI from './BuyerParametersUI';
import { BuyerProvider } from '@/contexts/BuyerContext';
import { ProviderProvider } from '@/contexts/ProviderContext';
// Import the summary components
import BuyerPolicySummary from "./PolicySummary"; // Use original filename, assuming rename failed
import ProviderIncomeSummary from "./ProviderIncomeSummary";
// Import the visualization components
import BuyerProtectionVisualization from "./ProtectionVisualization"; // Use original filename, assuming rename failed
import ProviderIncomeVisualization from "./ProviderIncomeVisualization";

// Define props for the main component
interface ProtectionParametersProps {
  currentUserRole: UserRole;
}

// --- Main Component --- 
export default function ProtectionParameters({ currentUserRole }: ProtectionParametersProps) {
  const isProvider = currentUserRole === 'provider';

  // Shared Neumorphic Styles (Could be moved to a constants file)
  const neumorphicBg = "#E8EAE9"; 
  const neumorphicShadowLight = "-10px -10px 20px rgba(255, 255, 255, 0.8)"; 
  const neumorphicShadowDark = "10px 10px 20px rgba(163, 177, 198, 0.6)";
  const neumorphicBoxShadow = `${neumorphicShadowLight}, ${neumorphicShadowDark}`;
  const neumorphicBorderRadius = "xl"; 

  return (
    // Consider if Box should be here or if Buyer/Provider provider should be top-level
    <Box>
      {/* Render Provider context, UI, and Summary */}
      {isProvider ? (
        <ProviderProvider>
          <Box bg={neumorphicBg} p={4} borderRadius={neumorphicBorderRadius} boxShadow={neumorphicBoxShadow} mb={8}> { /* Parameters Box */}
            <Heading as="h2" fontSize="2xl" fontWeight="bold" mb={4} color="gray.800">
              Income Parameters
            </Heading>
            <Text mb={6} color="gray.700">
              Configure your parameters for providing liquidity and earning income.
            </Text>
            <ProviderParametersUI />
          </Box>
          <ProviderIncomeSummary /> { /* Render Summary Inside Context */}
          <Box mt={8}>
            <ProviderIncomeVisualization /> { /* Render Visualization Inside Context */}
          </Box>
        </ProviderProvider>
      ) : (
        /* Render Buyer context, UI, and Summary */
        <BuyerProvider>
          <Box bg={neumorphicBg} p={4} borderRadius={neumorphicBorderRadius} boxShadow={neumorphicBoxShadow} mb={8}> { /* Parameters Box */}
            <Heading as="h2" fontSize="2xl" fontWeight="bold" mb={4} color="gray.800">
              Protection Parameters
            </Heading>
            <Text mb={6} color="gray.700">
             Customize your Bitcoin protection parameters to fit your needs.
            </Text>
            <BuyerParametersUI />
          </Box>
          <BuyerPolicySummary /> { /* Render Summary Inside Context */}
          <Box mt={8}>
            <BuyerProtectionVisualization /> { /* Render Visualization Inside Context */}
          </Box>
        </BuyerProvider>
      )}
    </Box>
  );
} 