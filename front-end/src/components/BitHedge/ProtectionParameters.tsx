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
    <Box bg={neumorphicBg} p={4} borderRadius={neumorphicBorderRadius} boxShadow={neumorphicBoxShadow}>
      <Heading as="h2" fontSize="2xl" fontWeight="bold" mb={4} color="gray.800">
        {isProvider ? 'Income Parameters' : 'Protection Parameters'}
      </Heading>
      <Text mb={6} color="gray.700">
        {isProvider 
          ? 'Configure your parameters for providing liquidity and earning income.'
          : 'Customize your Bitcoin protection parameters to fit your needs.'}
      </Text>
      
      {/* Conditionally render the appropriate context provider and UI component */} 
      {isProvider ? (
        <ProviderProvider>
          <ProviderParametersUI />
        </ProviderProvider>
      ) : (
        <BuyerProvider>
          <BuyerParametersUI />
        </BuyerProvider>
      )}
    </Box>
  );
} 