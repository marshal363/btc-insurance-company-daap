"use client";

import { useContext, useState, useEffect } from "react";
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
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription
} from "@chakra-ui/react";
import { 
  IoTrendingUp, 
  IoSwapHorizontal, 
  IoFlash,
  IoChevronDown,
  IoChevronUp,
} from "react-icons/io5";
import PriceOracleNetwork from "./PriceOracleNetwork";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useIsAuthorizedSubmitter, useCalculate24hRange } from "@/hooks/oracleQueries";
import OracleAdminControls from "./OracleAdminControls";
import HiroWalletContext from "../HiroWalletProvider";
import { useDevnetWallet } from "@/lib/devnet-wallet-context";
import { isDevnetEnvironment, isTestnetEnvironment } from "@/lib/contract-utils";

const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) {
    return "Just now";
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  } else {
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }
  }
};

export default function BitcoinPriceCard() {
  const [showSources, setShowSources] = useState(false);
  
  const aggregatedData = useQuery(api.prices.getLatestPrice);
  const rangeData = useCalculate24hRange();
  
  console.log("Range Data from hook:", rangeData);

  const isLoadingAggregatedData = aggregatedData === undefined;
  const isLoadingRangeData = rangeData === undefined;
  const isLoading = isLoadingAggregatedData || isLoadingRangeData;

  const { mainnetAddress, testnetAddress } = useContext(HiroWalletContext);
  const { currentWallet: devnetWallet } = useDevnetWallet();
  const currentWalletAddress = isDevnetEnvironment()
    ? devnetWallet?.stxAddress
    : isTestnetEnvironment()
    ? testnetAddress
    : mainnetAddress;
    
  const { data: isAuthorized } = useIsAuthorizedSubmitter(currentWalletAddress);
  
  const neumorphicBg = "#E8EAE9";
  const neumorphicShadowLight = "-10px -10px 20px rgba(255, 255, 255, 0.8)";
  const neumorphicShadowDark = "10px 10px 20px rgba(163, 177, 198, 0.6)";
  const neumorphicBoxShadow = `${neumorphicShadowLight}, ${neumorphicShadowDark}`;
  const neumorphicBorderRadius = "xl";

  const btcPrice = aggregatedData?.price ?? 0;
  const lastUpdatedTime = aggregatedData?.timestamp ? formatRelativeTime(aggregatedData.timestamp) : "Checking...";
  
  const displayVolatility = aggregatedData?.volatility ?? 0;
  const displayActiveSources = aggregatedData?.sourceCount ?? 0;
  const displayRangeLow = rangeData?.low ?? 0;
  const displayRangeHigh = rangeData?.high ?? 0;
  const displayPriceChange = 0;

  // Add pulse animation for "Just now" indicator
  const [isPulsing, setIsPulsing] = useState(false);
  
  useEffect(() => {
    if (lastUpdatedTime === "Just now") {
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastUpdatedTime]);

  return (
    <Box borderRadius="lg" bg={neumorphicBg} p={4}>
      {isAuthorized && <OracleAdminControls isAuthorizedSubmitter={!!isAuthorized} onPriceUpdate={() => { /* TODO: How to trigger Convex refetch if needed? */ }} />}
      
      <Box borderTopWidth="1px" borderTopColor="gray.300" p={0} bg="transparent" borderRadius="lg" boxShadow="none">
        <Flex justifyContent="space-between" alignItems="center" mb={4} px={4} pt={4}>
          <Flex alignItems="center" gap={3}>
            <Circle size="40px" bg="blue.500">
              <Icon as={IoTrendingUp} color="white" boxSize={5} />
            </Circle>
            <Box>
              <Heading as="h2" fontSize="xl" fontWeight="bold">
                BTC Price Feed
              </Heading>
              <Flex alignItems="center">
                <Box w={2} h={2} borderRadius="full" bg={displayActiveSources > 0 ? "green.400" : "gray.400"} mr={1} />
                <Text color="gray.500" fontSize="sm">
                  {isLoading ? '...' : `${displayActiveSources} Sources Active`}
                </Text>
              </Flex>
            </Box>
          </Flex>
          
          <Flex alignItems="center" gap={4}>
            <Box textAlign="right">
              <Text fontSize="xs" color="gray.500" fontWeight="semibold">
                LAST UPDATED
              </Text>
              <Text 
                fontWeight="bold" 
                color="gray.600" 
                position="relative"
                sx={lastUpdatedTime === "Just now" && isPulsing ? {
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: "md",
                    animation: "pulse 1.5s infinite",
                    zIndex: -1,
                  },
                  "@keyframes pulse": {
                    "0%": { boxShadow: "0 0 0 0 rgba(49, 130, 206, 0.2)" },
                    "70%": { boxShadow: "0 0 0 10px rgba(49, 130, 206, 0)" },
                    "100%": { boxShadow: "0 0 0 0 rgba(49, 130, 206, 0)" }
                  }
                } : {}}
              >
                {isLoading ? "Checking..." : lastUpdatedTime}
              </Text>
            </Box>
          </Flex>
        </Flex>
        
        {!isLoading && aggregatedData === null && (
          <Alert status="warning" mb={4} mx={4} borderRadius="md">
            <AlertIcon />
            <AlertTitle>No price data available</AlertTitle>
            <AlertDescription>The oracle does not have any price data yet.</AlertDescription>
          </Alert>
        )}

        <Grid templateColumns="repeat(3, 1fr)" gap={6} p={4}>
          <GridItem 
            bg={neumorphicBg} 
            p={6}
            borderRadius={neumorphicBorderRadius}
            boxShadow={neumorphicBoxShadow}
            position="relative"
            _after={{
              content: '""',
              position: 'absolute',
              top: '-3px',
              left: '-3px',
              right: '-3px',
              bottom: '-3px',
              borderRadius: 'xl',
              border: '3px solid',
              borderColor: 'blue.100',
              opacity: 0.5,
              zIndex: 0,
              pointerEvents: 'none'
            }}
          >
            <Flex alignItems="center" gap={2} mb={2}>
              <Icon as={IoTrendingUp} color="blue.500" />
              <Text fontWeight="medium" color="gray.700">Current Price</Text>
            </Flex>
            
            {isLoading ? (
              <Flex justify="center" align="center" h="100px">
                <Spinner size="xl" color="blue.500" />
              </Flex>
            ) : aggregatedData ? (
              <>
                <Heading as="h3" fontSize="3xl" fontWeight="bold" mb={1} color="gray.800">
                  ${btcPrice ? btcPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "N/A"}
                </Heading>
                
                <Badge 
                  colorScheme={displayPriceChange > 0 ? "green" : displayPriceChange < 0 ? "red" : "gray"} 
                  variant="solid" 
                  px={3} 
                  py={1} 
                  borderRadius="full"
                  fontSize="md"
                >
                  {displayPriceChange > 0 ? "↑" : displayPriceChange < 0 ? "↓" : "→"} {Math.abs(displayPriceChange).toFixed(2)}%
                </Badge>
              </>
            ) : (
               <Text color="gray.500">No data</Text>
            )}
            
            <Text fontSize="sm" mt={4} color="gray.600">
              Change in the last 24 hours
            </Text>
            
            <Button
              mt={4}
              size="sm"
              rightIcon={showSources ? <IoChevronUp /> : <IoChevronDown />}
              variant="ghost"
              colorScheme="blue" 
              onClick={() => setShowSources(!showSources)}
              w="full"
              _hover={{ bg: "rgba(0, 0, 0, 0.05)" }}
            >
              {showSources ? "Hide Sources" : "View Sources"}
            </Button>
          </GridItem>
          
          <GridItem 
            bg={neumorphicBg} 
            p={6}
            borderRadius={neumorphicBorderRadius}
            boxShadow={neumorphicBoxShadow}
          >
            <Flex alignItems="center" gap={2} mb={3}>
              <Icon as={IoSwapHorizontal} color="blue.500" />
              <Text fontWeight="medium" color="gray.700">24h Trading Range</Text>
            </Flex>
            
            {isLoading ? (
              <Flex justify="center" align="center" h="100px">
                <Spinner size="xl" color="blue.500" />
              </Flex>
            ) : aggregatedData ? (
              <>
                {/* Min-max price display */}
                <Flex justifyContent="space-between" mb={4}>
                  <Box>
                    <Text fontSize="sm" color="gray.600">24h Low</Text>
                    <Text fontWeight="bold" color="gray.800">${Math.round(displayRangeLow).toLocaleString()}</Text>
                  </Box>
                  <Box textAlign="right">
                    <Text fontSize="sm" color="gray.600">24h High</Text>
                    <Text fontWeight="bold" color="gray.800">${Math.round(displayRangeHigh).toLocaleString()}</Text>
                  </Box>
                </Flex>
                
                {/* Current price tag - positioned above the bar */}
                <Flex 
                  position="relative" 
                  justifyContent="center" 
                  mb={1}
                  mt={4}
                >
                  <Badge 
                    colorScheme="blue" 
                    borderRadius="full" 
                    px={2.5} 
                    py={0.5}
                    position="relative"
                    zIndex={2}
                    fontSize="sm"
                    boxShadow="0 1px 2px rgba(0,0,0,0.1)"
                  >
                    ${Math.round(btcPrice).toLocaleString()}
                  </Badge>
                </Flex>
                
                {/* Progress bar with position label */}
                <Box>
                  <Text fontSize="xs" color="gray.500" mb={1} textAlign="center">
                    Current Price Position
                  </Text>
                  
                  <Box position="relative">
                    {/* Range bar */}
                    <Progress 
                      value={displayRangeHigh > displayRangeLow ? ((btcPrice - displayRangeLow) / (displayRangeHigh - displayRangeLow)) * 100 : 0} 
                      borderRadius="full" 
                      h="10px"
                      colorScheme="blue"
                      bg="gray.200"
                    />
                    
                    {/* Price indicator line */}
                    {displayRangeHigh > displayRangeLow && (
                      <Box 
                        position="absolute"
                        top="-4px"
                        bottom="-4px"
                        left={`${((btcPrice - displayRangeLow) / (displayRangeHigh - displayRangeLow)) * 100}%`}
                        transform="translateX(-50%)"
                        width="2px"
                        bg="blue.500"
                        zIndex={1}
                      />
                    )}
                  </Box>
                  
                  {/* Tick marks with min-max labels */}
                  <Flex justifyContent="space-between" mt={1}>
                    <Text fontSize="xs" color="gray.500">${Math.round(displayRangeLow/1000)}K</Text>
                    <Text fontSize="xs" color="gray.500">${Math.round(displayRangeHigh/1000)}K</Text>
                  </Flex>
                </Box>
              </>
            ) : (
              <Text color="gray.500">No data</Text>
            )}
          </GridItem>
          
          <GridItem 
            bg={neumorphicBg} 
            p={6}
            borderRadius={neumorphicBorderRadius}
            boxShadow={neumorphicBoxShadow}
          >
            <Flex alignItems="center" gap={2} mb={2}>
              <Icon as={IoFlash} color="blue.500" />
              <Text fontWeight="medium" color="gray.700">Volatility Index</Text>
              <Badge 
                size="sm" 
                colorScheme="blue" 
                variant="outline" 
                ml="auto"
                borderRadius="full"
                px={2}
                borderColor="blue.300"
              >
                30 days
              </Badge>
            </Flex>
            
            {isLoading ? (
              <Flex justify="center" align="center" h="100px">
                <Spinner size="xl" color="blue.500" />
              </Flex>
            ) : aggregatedData ? (
              <>
                <Heading as="h3" fontSize="3xl" fontWeight="bold" mb={3} color="gray.800">
                  {(displayVolatility * 100).toFixed(2)}%
                </Heading>
                
                <Box mb={1} position="relative">
                  <Progress 
                    value={displayVolatility * 100}
                    max={100} 
                    borderRadius="full" 
                    h="8px"
                    colorScheme={displayVolatility < 0.3 ? "green" : displayVolatility < 0.7 ? "blue" : "red"}
                    bg="gray.300"
                  />
                  <Flex justifyContent="space-between" width="100%" position="absolute" top="-2px">
                    <Box width="30%" borderRight="1px dashed" borderColor="green.300" height="12px" />
                    <Box width="40%" borderRight="1px dashed" borderColor="blue.300" height="12px" />
                  </Flex>
                </Box>
                
                <Flex justifyContent="space-between" mt={2} mb={3}>
                  <Text color="green.500" fontWeight="medium" fontSize="xs">Low</Text>
                  <Text color="purple.500" fontWeight="medium" fontSize="sm">
                    Medium
                  </Text>
                  <Text color="red.500" fontWeight="medium" fontSize="xs">High</Text>
                </Flex>
                
                <Flex alignItems="center" gap={2}>
                  <Text fontSize="sm" color="gray.600">
                    Drives premium pricing
                  </Text>
                  <Box 
                    as="span" 
                    color="blue.500" 
                    fontSize="xs" 
                    cursor="pointer"
                    borderBottom="1px dotted"
                    title="Higher volatility typically results in higher insurance premiums as it represents increased market risk"
                    _hover={{ color: "blue.600" }}
                  >
                    i
                  </Box>
                </Flex>
              </>
            ) : (
              <Text color="gray.500">No data</Text>
            )}
          </GridItem>
        </Grid>
      </Box>
      
      {showSources && <PriceOracleNetwork />}
    </Box>
  );
} 