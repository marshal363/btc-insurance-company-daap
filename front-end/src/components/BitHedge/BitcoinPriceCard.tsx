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
  
  // Neumorphic styles
  const neumorphicBg = "#E8EAE9"; // Use the color from the image
  const neumorphicShadowLight = "-10px -10px 20px rgba(255, 255, 255, 0.8)"; // Adjusted light shadow
  const neumorphicShadowDark = "10px 10px 20px rgba(163, 177, 198, 0.6)"; // Adjusted dark shadow based on common neumorphic examples for a similar bg
  const neumorphicBoxShadow = `${neumorphicShadowLight}, ${neumorphicShadowDark}`;
  const neumorphicBorderRadius = "xl"; // Consistent rounded corners

  return (
    <Box borderRadius="lg" bg={neumorphicBg} p={4}> {/* Set base background color and padding */}
      {/* Main Card Container - remove default white bg and shadow, adjust padding */}
      <Box borderTopWidth="1px" borderTopColor="gray.300" p={0} bg="transparent" borderRadius="lg" boxShadow="none">
        {/* Header Section */}
        <Flex justifyContent="space-between" alignItems="center" mb={4} px={4} pt={4}> {/* Add padding back to header */}
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
        <Grid templateColumns="repeat(3, 1fr)" gap={6} p={4}> {/* Increased gap and added padding */}
          {/* Current Price Card - Apply Neumorphic Style */}
          <GridItem 
            bg={neumorphicBg} 
            p={6} // Increased padding
            borderRadius={neumorphicBorderRadius}
            boxShadow={neumorphicBoxShadow}
          >
            <Flex alignItems="center" gap={2} mb={2}>
              <Icon as={IoTrendingUp} color="blue.500" />
              <Text fontWeight="medium" color="gray.700">Current Price</Text> {/* Adjusted text color */}
            </Flex>
            
            <Heading as="h3" fontSize="3xl" fontWeight="bold" mb={1} color="gray.800"> {/* Adjusted text color */}
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
            
            <Text fontSize="sm" mt={4} color="gray.600"> {/* Adjusted text color */}
              Change in the last 24 hours
            </Text>
            
            <Button
              mt={4}
              size="sm"
              rightIcon={showSources ? <IoChevronUp /> : <IoChevronDown />}
              variant="ghost" // Changed variant for better neumorphic fit
              colorScheme="blue" 
              onClick={() => setShowSources(!showSources)}
              w="full"
              _hover={{ bg: "rgba(0, 0, 0, 0.05)" }} // Subtle hover
            >
              {showSources ? "Hide Sources" : "View Sources"}
            </Button>
          </GridItem>
          
          {/* 24h Trading Range Card - Apply Neumorphic Style */}
          <GridItem 
            bg={neumorphicBg} 
            p={6} // Increased padding
            borderRadius={neumorphicBorderRadius}
            boxShadow={neumorphicBoxShadow}
          >
            <Flex alignItems="center" gap={2} mb={2}>
              <Icon as={IoSwapHorizontal} color="blue.500" />
              <Text fontWeight="medium" color="gray.700">24h Trading Range</Text> {/* Adjusted text color */}
            </Flex>
            
            <Flex justifyContent="space-between" mb={4}>
              <Box>
                <Text fontSize="sm" color="gray.600">24h Low</Text> {/* Adjusted text color */}
                <Text fontWeight="bold" color="gray.800">${rangeLow.toLocaleString()}</Text> {/* Adjusted text color */}
              </Box>
              <Box textAlign="right"> {/* Ensure high value aligns right */}
                <Text fontSize="sm" color="gray.600">24h High</Text> {/* Adjusted text color */}
                <Text fontWeight="bold" color="gray.800">${rangeHigh.toLocaleString()}</Text> {/* Adjusted text color */}
              </Box>
            </Flex>
            
            <Text fontSize="sm" color="gray.600" mb={1}> {/* Adjusted text color */}
              Current Price Position
            </Text>
            
            <Box position="relative" h="24px" mt={2}> {/* Added margin top */}
              <Progress 
                value={((btcPrice - rangeLow) / (rangeHigh - rangeLow)) * 100} 
                borderRadius="full" 
                h="8px"
                colorScheme="blue"
                bg="gray.300" // Adjusted progress background
              />
              {/* Removed the absolute positioned price labels below progress bar for cleaner look */}
            </Box>
             <Flex 
                position="relative" // Changed from absolute for simplicity below progress
                justifyContent="space-between" 
                mt={1}
              >
                <Text fontSize="xs" color="gray.500">${rangeLow.toLocaleString()}</Text>
                {/* Removed middle price label */}
                <Text fontSize="xs" color="gray.500">${rangeHigh.toLocaleString()}</Text>
              </Flex>
          </GridItem>
          
          {/* Volatility Index Card - Apply Neumorphic Style */}
           <GridItem 
            bg={neumorphicBg} 
            p={6} // Increased padding
            borderRadius={neumorphicBorderRadius}
            boxShadow={neumorphicBoxShadow}
          >
            <Flex alignItems="center" gap={2} mb={2}>
              <Icon as={IoFlash} color="blue.500" />
              <Text fontWeight="medium" color="gray.700">Volatility Index</Text> {/* Adjusted text color */}
              <Badge 
                size="sm" 
                colorScheme="blue" 
                variant="outline" 
                ml="auto"
                borderRadius="full"
                px={2}
                borderColor="blue.300" // Slightly adjust border
              >
                30 days
              </Badge>
            </Flex>
            
            <Heading as="h3" fontSize="3xl" fontWeight="bold" mb={3} color="gray.800"> {/* Adjusted text color */}
              {volatility}%
            </Heading>
            
            <Box mb={1} position="relative"> {/* Added position relative */}
              <Progress 
                value={volatility} 
                max={100} 
                borderRadius="full" 
                h="8px"
                colorScheme="blue"
                bg="gray.300" // Adjusted progress background
              />
              {/* Removed the absolute positioned dot on progress bar */}
            </Box>
            
            <Flex justifyContent="flex-end" mt={2} mb={3}> {/* Added margin top */}
              <Text color="purple.500" fontWeight="medium" fontSize="sm">
                Medium {/* Consider how to visually represent this better */}
              </Text>
            </Flex>
            
            <Text fontSize="sm" color="gray.600"> {/* Adjusted text color */}
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