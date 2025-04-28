"use client";

import {
  Box,
  Flex,
  Text,
  Heading,
  Grid,
  GridItem,
  Icon,
} from "@chakra-ui/react";
import { IoCalculatorOutline } from "react-icons/io5";

export default function CalculationMethod() {
  // Mock data
  const currentPrice = 94260.01;
  const strikePrice = 94260.01;
  const timeToExpiry = 30;
  const volatility = 42.50;
  const riskFreeRate = 4.50;
  
  const greeks = {
    delta: -0.5364,
    gamma: 0.000035,
    theta: -81.9769,
    vega: 107.3600,
  };
  
  return (
    <Box mt={8} borderWidth="1px" borderColor="gray.200" borderRadius="lg" p={6}>
      <Flex align="center" mb={4}>
        <Icon as={IoCalculatorOutline} boxSize={5} color="blue.500" mr={2} />
        <Heading as="h2" fontSize="xl" fontWeight="bold">
          Calculation Method
        </Heading>
      </Flex>
      
      <Text mb={4} color="gray.700">
        The premium is calculated using the Black-Scholes option pricing model, which is widely used in the financial industry to determine fair prices for options.
      </Text>
      
      <Box mb={6}>
        <Heading as="h3" fontSize="md" fontWeight="bold" mb={3}>
          Parameters Used
        </Heading>
        
        <Grid templateColumns="1fr auto" gap={2}>
          <GridItem>
            <Text color="gray.600">Current Price:</Text>
          </GridItem>
          <GridItem textAlign="right">
            <Text fontWeight="medium">${currentPrice.toLocaleString()}</Text>
          </GridItem>
          
          <GridItem>
            <Text color="gray.600">Strike Price:</Text>
          </GridItem>
          <GridItem textAlign="right">
            <Text fontWeight="medium">${strikePrice.toLocaleString()}</Text>
          </GridItem>
          
          <GridItem>
            <Text color="gray.600">Time to Expiry:</Text>
          </GridItem>
          <GridItem textAlign="right">
            <Text fontWeight="medium">{timeToExpiry} days</Text>
          </GridItem>
          
          <GridItem>
            <Text color="gray.600">Volatility:</Text>
          </GridItem>
          <GridItem textAlign="right">
            <Text fontWeight="medium">{volatility}%</Text>
          </GridItem>
          
          <GridItem>
            <Text color="gray.600">Risk-Free Rate:</Text>
          </GridItem>
          <GridItem textAlign="right">
            <Text fontWeight="medium">{riskFreeRate}%</Text>
          </GridItem>
        </Grid>
      </Box>
      
      <Box bg="blue.50" p={5} borderRadius="md" mb={4}>
        <Heading as="h3" fontSize="md" fontWeight="bold" mb={3}>
          Option Greeks (Sensitivity)
        </Heading>
        
        <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
          <Box bg="white" p={3} borderRadius="md">
            <Heading as="h4" fontSize="sm" fontWeight="semibold" color="blue.600" mb={1}>
              Delta
            </Heading>
            <Text fontWeight="bold" fontFamily="monospace">
              {greeks.delta.toFixed(4)}
            </Text>
          </Box>
          
          <Box bg="white" p={3} borderRadius="md">
            <Heading as="h4" fontSize="sm" fontWeight="semibold" color="blue.600" mb={1}>
              Gamma
            </Heading>
            <Text fontWeight="bold" fontFamily="monospace">
              {greeks.gamma.toFixed(6)}
            </Text>
          </Box>
          
          <Box bg="white" p={3} borderRadius="md">
            <Heading as="h4" fontSize="sm" fontWeight="semibold" color="blue.600" mb={1}>
              Theta
            </Heading>
            <Text fontWeight="bold" fontFamily="monospace">
              {greeks.theta.toFixed(4)}
            </Text>
          </Box>
          
          <Box bg="white" p={3} borderRadius="md">
            <Heading as="h4" fontSize="sm" fontWeight="semibold" color="blue.600" mb={1}>
              Vega
            </Heading>
            <Text fontWeight="bold" fontFamily="monospace">
              {greeks.vega.toFixed(4)}
            </Text>
          </Box>
        </Grid>
      </Box>
      
      <Text fontSize="sm" color="gray.500">
        This calculator provides an estimate based on standard market models. Actual premium rates may vary in real trading environments due to market conditions, liquidity, and other factors.
      </Text>
    </Box>
  );
} 