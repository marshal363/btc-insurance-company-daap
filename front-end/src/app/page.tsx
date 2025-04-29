"use client";

import { useState } from 'react';
import { Box, Container } from "@chakra-ui/react";
import BitHedgeHeader from "@/components/BitHedge/BitHedgeHeader";
import BitcoinPriceCard from "@/components/BitHedge/BitcoinPriceCard";
import PremiumCalculatorTabs from "@/components/BitHedge/PremiumCalculatorTabs";
import ProtectionParameters from "@/components/BitHedge/ProtectionParameters";
import AdvancedParameters from "@/components/BitHedge/AdvancedParameters";
import ProtectionVisualization from "@/components/BitHedge/ProtectionVisualization";
import ProtectionCost from "@/components/BitHedge/ProtectionCost";
import CalculationMethod from "@/components/BitHedge/CalculationMethod";
import BitHedgeFooter from "@/components/BitHedge/BitHedgeFooter";

// Define user roles
type UserRole = 'buyer' | 'provider';

export default function Home() {
  // State for the selected tab index
  const [tabIndex, setTabIndex] = useState(0);

  // Determine the current user role based on the tab index
  const currentUserRole: UserRole = tabIndex === 0 ? 'buyer' : 'provider';

  // Handler for tab changes
  const handleTabChange = (index: number) => {
    setTabIndex(index);
  };

  return (
    <Box as="main" bg="white" py={8} borderRadius="lg">
      <Container maxWidth="5xl" px={4} borderRadius="lg">
        <BitHedgeHeader />
        
        <Box mt={8}>
          <BitcoinPriceCard />
        </Box>
        
        <Box mt={8}>
          <PremiumCalculatorTabs tabIndex={tabIndex} onTabChange={handleTabChange} />
        </Box>
        
        <Box mt={8}>
          <ProtectionParameters currentUserRole={currentUserRole} />
        </Box>
        
        <Box mt={8}>
          <AdvancedParameters currentUserRole={currentUserRole} />
        </Box>
        
        <Box mt={8}>
          <ProtectionVisualization currentUserRole={currentUserRole} />
        </Box>
        
        <Box mt={8}>
          <ProtectionCost currentUserRole={currentUserRole} />
        </Box>
        
        <Box mt={8}>
          <CalculationMethod />
        </Box>
        
        <BitHedgeFooter />
      </Container>
    </Box>
  );
}
