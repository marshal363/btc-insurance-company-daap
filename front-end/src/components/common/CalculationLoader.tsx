"use client";

import { Box, Spinner, Text, Collapse } from "@chakra-ui/react";

interface CalculationLoaderProps {
  isLoading: boolean;
  text?: string;
  // Add neumorphic style props if needed, or apply them directly
}

const CalculationLoader = ({ isLoading, text = "Calculating..." }: CalculationLoaderProps) => {
  const neumorphicBg = "#E8EAE9"; 
  const neumorphicShadowLight = "-10px -10px 20px rgba(255, 255, 255, 0.8)"; 
  const neumorphicShadowDark = "10px 10px 20px rgba(163, 177, 198, 0.6)";
  const neumorphicBoxShadow = `${neumorphicShadowLight}, ${neumorphicShadowDark}`;
  const neumorphicBorderRadius = "xl"; 

  return (
    <Collapse in={isLoading} animateOpacity>
      <Box 
        p={6} 
        borderRadius={neumorphicBorderRadius} 
        bg={neumorphicBg} 
        boxShadow={neumorphicBoxShadow} 
        textAlign="center"
      >
        <Spinner size="xl" color="blue.500" thickness="4px" speed="0.65s" emptyColor="gray.200" mb={4} />
        {/* Optional Icon */}
        {/* <Icon as={IoHourglassOutline} w={10} h={10} color="blue.500" mb={3} /> */}
        <Text mt={2} color="gray.600" fontWeight="medium">
          {text}
        </Text>
      </Box>
    </Collapse>
  );
};

export default CalculationLoader; 