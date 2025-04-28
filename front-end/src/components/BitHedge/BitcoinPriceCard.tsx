"use client";

import { useState } from "react";
import {
  Box,
  Flex,
  Text,
  Heading,
  Button,
  Icon,
  Badge,
  Progress,
  Grid,
  GridItem,
  Circle,
} from "@chakra-ui/react";
import { 
  IoRefresh, 
  IoTrendingUp, 
  IoSwapHorizontal, 
  IoFlash,
  IoChevronDown,
  IoChevronUp,
} from "react-icons/io5";
import PriceOracleNetwork from "./PriceOracleNetwork";

export default function BitcoinPriceCard() {
  const [showSources, setShowSources] = useState(false);
  
  // Mock data
  const btcPrice = 94238;
  const priceChange = 0.24;
  const rangeLow = 92846;
  const rangeHigh = 94566;
  const volatility = 42.50;
  const lastUpdated = "2 minutes ago";
  const activeSources = 7;
  
  return (
    <Box>
      {/* Main Card */}
      <Box borderTopWidth="1px" borderTopColor="gray.200" p={4} bg="white" borderRadius="lg" boxShadow="sm">
        {/* Header Section */}
        <Flex justifyContent="space-between" alignItems="center" mb={4}>
          <Flex alignItems="center" gap={3}>
            <Circle size="40px" bg="blue.500">
              <Icon as={IoTrendingUp} color="white" boxSize={5} />
            </Circle>
            <Box>
              <Heading as="h2" fontSize="xl" fontWeight="bold">
                BTC Price Feed
              </Heading>
              <Flex alignItems="center">
                <Box w={2} h={2} borderRadius="full" bg="green.400" mr={1} />
                <Text color="gray.500" fontSize="sm">
                  {activeSources} Sources Active
                </Text>
              </Flex>
            </Box>
          </Flex>
          
          <Flex alignItems="center" gap={4}>
            <Box textAlign="right">
              <Text fontSize="xs" color="gray.500" fontWeight="semibold">
                LAST UPDATED
              </Text>
              <Text fontWeight="bold" color="gray.600">
                {lastUpdated}
              </Text>
            </Box>
            
            <Button 
              leftIcon={<IoRefresh />} 
              size="sm" 
              variant="outline" 
              colorScheme="blue"
            >
              Refresh
            </Button>
          </Flex>
        </Flex>
        
        {/* Price Cards Grid */}
        <Grid templateColumns="repeat(3, 1fr)" gap={4}>
          {/* Current Price Card */}
          <GridItem bg="gray.50" p={4} borderRadius="md">
            <Flex alignItems="center" gap={2} mb={2}>
              <Icon as={IoTrendingUp} color="blue.500" />
              <Text fontWeight="medium">Current Price</Text>
            </Flex>
            
            <Heading as="h3" fontSize="3xl" fontWeight="bold" mb={1}>
              ${btcPrice.toLocaleString()}
            </Heading>
            
            <Badge 
              colorScheme="green" 
              variant="subtle" 
              px={2} 
              py={0.5} 
              borderRadius="full"
            >
              ↑ {priceChange}%
            </Badge>
            
            <Text fontSize="sm" mt={4} color="gray.500">
              Change in the last 24 hours
            </Text>
            
            <Button
              mt={4}
              size="sm"
              rightIcon={showSources ? <IoChevronUp /> : <IoChevronDown />}
              variant="outline"
              onClick={() => setShowSources(!showSources)}
              w="full"
            >
              {showSources ? "Hide Sources" : "View Sources"}
            </Button>
          </GridItem>
          
          {/* 24h Trading Range Card */}
          <GridItem bg="gray.50" p={4} borderRadius="md">
            <Flex alignItems="center" gap={2} mb={2}>
              <Icon as={IoSwapHorizontal} color="blue.500" />
              <Text fontWeight="medium">24h Trading Range</Text>
            </Flex>
            
            <Flex justifyContent="space-between" mb={4}>
              <Box>
                <Text fontSize="sm" color="gray.500">24h Low</Text>
                <Text fontWeight="bold">${rangeLow.toLocaleString()}</Text>
              </Box>
              <Box>
                <Text fontSize="sm" color="gray.500">24h High</Text>
                <Text fontWeight="bold">${rangeHigh.toLocaleString()}</Text>
              </Box>
            </Flex>
            
            <Text fontSize="sm" color="gray.500" mb={1}>
              Current Price Position
            </Text>
            
            <Box position="relative" h="24px">
              <Progress 
                value={((btcPrice - rangeLow) / (rangeHigh - rangeLow)) * 100} 
                borderRadius="full" 
                h="8px"
                colorScheme="blue"
                bg="gray.200"
              />
              <Flex 
                position="absolute" 
                top="100%" 
                left="0" 
                right="0" 
                justifyContent="space-between" 
                mt={1}
              >
                <Text fontSize="xs" color="gray.500">${rangeLow.toLocaleString()}</Text>
                <Text 
                  position="absolute" 
                  top="0" 
                  left={`${((btcPrice - rangeLow) / (rangeHigh - rangeLow)) * 100}%`} 
                  transform="translateX(-50%)"
                  fontSize="xs" 
                  fontWeight="bold"
                  color="blue.500"
                >
                  ${btcPrice.toLocaleString()}
                </Text>
                <Text fontSize="xs" color="gray.500">${rangeHigh.toLocaleString()}</Text>
              </Flex>
            </Box>
          </GridItem>
          
          {/* Volatility Index Card */}
          <GridItem bg="gray.50" p={4} borderRadius="md">
            <Flex alignItems="center" gap={2} mb={2}>
              <Icon as={IoFlash} color="blue.500" />
              <Text fontWeight="medium">Volatility Index</Text>
              <Badge 
                size="sm" 
                colorScheme="blue" 
                variant="outline" 
                ml="auto"
                borderRadius="full"
                px={2}
              >
                30 days
              </Badge>
            </Flex>
            
            <Heading as="h3" fontSize="3xl" fontWeight="bold" mb={3}>
              {volatility}%
            </Heading>
            
            <Box mb={1}>
              <Progress 
                value={volatility} 
                max={100} 
                borderRadius="full" 
                h="8px"
                colorScheme="blue"
                bg="gray.200"
              />
              <Box
                position="absolute"
                top="-4px"
                left={`${volatility}%`}
                transform="translateX(-50%)"
                w="16px"
                h="16px"
                bg="blue.600"
                borderRadius="full"
                border="2px solid white"
                boxShadow="sm"
              />
            </Box>
            
            <Flex justifyContent="flex-end" mb={3}>
              <Text color="purple.500" fontWeight="medium" fontSize="sm">
                Medium
              </Text>
            </Flex>
            
            <Text fontSize="sm" color="gray.500">
              Drives premium pricing
            </Text>
          </GridItem>
        </Grid>
      </Box>
      
      {/* Oracle Network (conditional rendering) */}
      {showSources && <PriceOracleNetwork />}
    </Box>
  );
} 