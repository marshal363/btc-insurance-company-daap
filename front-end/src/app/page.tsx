"use client";

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

export default function Home() {
  return (
    <Box as="main" bg="white" py={8}>
      <Container maxWidth="5xl" px={4}>
        <BitHedgeHeader />
        
        <Box mt={8}>
          <BitcoinPriceCard />
        </Box>
        
        <Box mt={8}>
          <PremiumCalculatorTabs />
        </Box>
        
        <Box mt={8}>
          <ProtectionParameters />
        </Box>
        
        <Box mt={8}>
          <AdvancedParameters />
        </Box>
        
        <Box mt={8}>
          <ProtectionVisualization />
        </Box>
        
        <Box mt={8}>
          <ProtectionCost />
        </Box>
        
        <Box mt={8}>
          <CalculationMethod />
        </Box>
        
        <BitHedgeFooter />
      </Container>
    </Box>
  );
}
