"use client";

import { Box, Heading, Text } from "@chakra-ui/react";

export default function BitHedgeHeader() {
  return (
    <Box 
      as="header"
      bgGradient="linear(to-r, blue.600, blue.700)"
      p={6}
      borderRadius="lg"
      boxShadow="md"
    >
      <Heading 
        as="h1" 
        fontSize="3xl" 
        fontWeight="bold" 
        color="white"
      >
        BitHedge Premium Calculator
      </Heading>
      <Text 
        mt={2} 
        color="blue.100"
      >
        Calculate Bitcoin PUT option premiums using the Black-Scholes model
      </Text>
    </Box>
  );
} 