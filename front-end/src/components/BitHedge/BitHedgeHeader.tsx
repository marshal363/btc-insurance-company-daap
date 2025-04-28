"use client";

import { Box, Heading, Text } from "@chakra-ui/react";

export default function BitHedgeHeader() {
  return (
    <Box 
      as="header"
      bgGradient="linear(to-r, blue.50, blue.100)"
      p={6}
      borderRadius="2xl"
      boxShadow="sm"
    >
      <Heading 
        as="h1" 
        fontSize="3xl" 
        fontWeight="bold" 
        color="blue.600"
      >
        BitHedge Premium Calculator
      </Heading>
      <Text 
        mt={2} 
        color="gray.500"
      >
        Calculate Bitcoin PUT option premiums using the Black-Scholes model
      </Text>
    </Box>
  );
} 