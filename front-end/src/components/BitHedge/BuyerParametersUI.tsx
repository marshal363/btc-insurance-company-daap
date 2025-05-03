"use client";

import { useRef, useEffect } from "react";
import {
  Box,
  Flex,
  Text,
  Heading,
  HStack,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Button,
  Icon,
  Tooltip,
  Grid,
  GridItem,
  Input,
  VStack,
  Spinner,
  Badge,
} from "@chakra-ui/react";
import { IoInformationCircle } from "react-icons/io5";
import { useBuyerContext } from "@/contexts/BuyerContext";
import { useBitcoinPrice } from "@/hooks/useBitcoinPrice";
import { formatUSD, formatBTC, formatPercent } from "@/utils/formatters";
import { estimateBuyerPremium } from "@/utils/clientEstimation";
import { useBuyerQuote } from "@/hooks/useBuyerQuote";
import { useDebounce } from "@/hooks/useDebounce";

// --- Buyer Specific UI Component --- 
const BuyerParametersUI = () => {
  // Use BuyerContext
  const { 
    inputs, 
    updateBuyerInputs, 
    validationErrors,
    estimatedResult,
    setEstimatedResult,
    accurateQuote,
    setAccurateQuote
  } = useBuyerContext();
  const { protectedValuePercentage, protectionAmount, protectionPeriod } = inputs;
  
  // Add debugging logs
  console.log("BuyerParametersUI: Current inputs:", inputs);
  console.log("BuyerParametersUI: Estimated result:", estimatedResult);
  console.log("BuyerParametersUI: Accurate quote:", accurateQuote);
  
  // Use Bitcoin price hook
  const { 
    currentPrice,
    volatility,
    isLoading: isPriceLoading,
    hasError: hasPriceError,
    errorMessage: priceErrorMessage,
    isStale: isPriceStale 
  } = useBitcoinPrice();
  
  console.log("BuyerParametersUI: Bitcoin price data:", { 
    currentPrice, 
    volatility, 
    isPriceLoading,
    hasPriceError 
  });
  
  // Use the debounce hook for inputs
  const debouncedInputs = useDebounce(inputs, 500);
  
  // Use the Convex quote hook for accurate premium calculation
  const {
    quote: accurateQuoteData,
    isLoading: isQuoteLoading,
    error: quoteError,
    fetchQuote,
  } = useBuyerQuote();
  
  const protectedValueRef = useRef<HTMLDivElement>(null);
  const protectionAmountRef = useRef<HTMLDivElement>(null);
  
  // Calculate USD values using current BTC price
  const protectedValueUSD = (currentPrice * protectedValuePercentage) / 100;
  const protectionAmountUSD = protectionAmount * currentPrice;

  // --- Client-side Estimation Effect ---
  useEffect(() => {
    console.log("BuyerParametersUI: Estimation effect running with:", {
      currentPrice,
      volatility,
      protectionAmount,
      protectionPeriod,
      isPriceLoading
    });
    
    // Only perform estimation if we have valid inputs and price data
    if (
      currentPrice > 0 && 
      volatility > 0 && 
      protectionAmount > 0 && 
      protectionPeriod > 0 &&
      !isPriceLoading
    ) {
      const estimationResult = estimateBuyerPremium({
        currentPrice,
        volatility,
        protectedValuePercentage,
        protectionAmount,
        protectionPeriod
      });
      
      // Update estimated premium in context
      if (estimationResult) {
        setEstimatedResult(estimationResult);
      }
    }
  }, [currentPrice, volatility, protectedValuePercentage, protectionAmount, protectionPeriod, isPriceLoading, setEstimatedResult]);
  
  // --- Debounced Convex Quote Effect ---
  useEffect(() => {
    console.log("BuyerParametersUI: Debounced effect running with:", debouncedInputs);
    
    // Call Convex only when debounced inputs have settled and we have valid price data
    if (
      currentPrice > 0 && 
      !isPriceLoading && 
      debouncedInputs.protectionAmount > 0 &&
      debouncedInputs.protectionPeriod > 0
    ) {
      fetchQuote({
        protectedValuePercentage: debouncedInputs.protectedValuePercentage,
        protectionAmount: debouncedInputs.protectionAmount,
        expirationDays: debouncedInputs.protectionPeriod,
        policyType: "PUT", // Assuming PUT is the default type
        includeScenarios: true // Optional: Include scenarios for visualization
      });
    }
  }, [debouncedInputs, currentPrice, isPriceLoading, fetchQuote]);
  
  // Update context with accurate quote when it arrives
  useEffect(() => {
    if (accurateQuoteData) {
      console.log("BuyerParametersUI: Received accurate quote data:", accurateQuoteData);
      setAccurateQuote(accurateQuoteData);
    }
  }, [accurateQuoteData, setAccurateQuote]);

  // Neumorphic styles
  const neumorphicBg = "#E8EAE9"; 
  const neumorphicShadowLight = "-10px -10px 20px rgba(255, 255, 255, 0.8)"; 
  const neumorphicShadowDark = "10px 10px 20px rgba(163, 177, 198, 0.6)";
  const neumorphicBoxShadow = `${neumorphicShadowLight}, ${neumorphicShadowDark}`;
  const neumorphicInnerShadowLight = "inset -5px -5px 10px rgba(255, 255, 255, 0.8)";
  const neumorphicInnerShadowDark = "inset 5px 5px 10px rgba(163, 177, 198, 0.6)";
  const neumorphicInnerBoxShadow = `${neumorphicInnerShadowLight}, ${neumorphicInnerShadowDark}`;
  const neumorphicBorderRadius = "xl";

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue)) {
      updateBuyerInputs({ protectionAmount: numericValue });
    } else if (value === "" || value === "." || value.endsWith(".")) {
      // Handle validation or reset to 0 if needed
      // For now, we'll maintain the current value
    }
  };

  const handleAmountSelection = (amount: number) => {
    updateBuyerInputs({ protectionAmount: amount });
  };

  const handleProtectedValueChange = (value: number) => {
    updateBuyerInputs({ protectedValuePercentage: value });
  };

  const handlePeriodSelect = (period: number) => {
    updateBuyerInputs({ protectionPeriod: period });
  };

  const getPeriodDescription = (period: number) => {
    switch (period) {
      case 30: return "Short Term";
      case 90: return "Balanced";
      case 180: return "Strategic";
      case 360: return "Maximum Coverage";
      default: return "";
    }
  };
  
  // Determine which premium to display (accurate or estimated)
  const displayPremium = accurateQuote?.premium ?? estimatedResult?.estimatedPremium ?? 0;
  const isEstimatedDisplay = !accurateQuote?.premium && estimatedResult !== null && estimatedResult.estimatedPremium > 0;
  const isCalculating = isPriceLoading || isQuoteLoading;

  return (
    <Box p={0} borderRadius={neumorphicBorderRadius} > 
      {/* Price Loading Indicator */}
      {isPriceLoading && !isPriceStale && (
        <Flex justify="center" mb={4} p={2} bg="blue.50" borderRadius="md">
          <Spinner size="sm" color="blue.500" mr={2} />
          <Text fontSize="sm" color="blue.700">Loading Bitcoin price data...</Text>
        </Flex>
      )}
      
      {/* Price Error Message */}
      {hasPriceError && (
        <Flex justify="center" mb={4} p={2} bg="red.50" borderRadius="md">
          <Icon as={IoInformationCircle} color="red.500" mr={2} />
          <Text fontSize="sm" color="red.700">{priceErrorMessage || "Error loading price data"}</Text>
        </Flex>
      )}
      
      {/* Quote Error Message */}
      {quoteError && (
        <Flex justify="center" mb={4} p={2} bg="red.50" borderRadius="md">
          <Icon as={IoInformationCircle} color="red.500" mr={2} />
          <Text fontSize="sm" color="red.700">{quoteError}</Text>
        </Flex>
      )}
      
      {/* Stale Data Indicator */}
      {isPriceStale && (
        <Flex justify="center" mb={4} p={2} bg="yellow.50" borderRadius="md">
          <Icon as={IoInformationCircle} color="yellow.500" mr={2} />
          <Text fontSize="sm" color="yellow.700">Using cached price data while refreshing...</Text>
        </Flex>
      )}
      
      {/* Current Price Display */}
      <Flex justify="center" mb={4} p={2} bg="gray.50" borderRadius="md">
        <Text fontWeight="medium" fontSize="sm" color="gray.700">
          Current BTC Price: {formatUSD(currentPrice)} 
          {volatility > 0 && ` | Volatility: ${formatPercent(volatility * 100)}`}
        </Text>
      </Flex>
      
      {/* Premium Display Panel */}
      <Box mb={6} p={4} bg="blue.50" borderRadius="md" boxShadow="md">
        <Flex direction="column" align="center">
          <HStack mb={1}>
            <Text fontWeight="medium" color="blue.800">Estimated Premium:</Text>
            {isCalculating && <Spinner size="xs" color="blue.500" />}
          </HStack>
          <Heading color="blue.700" size="lg">{formatUSD(displayPremium || 0)}</Heading>
          {isEstimatedDisplay && (
            <Badge colorScheme="yellow" mt={1}>Estimated</Badge>
          )}
          {accurateQuote?.premium && (
            <Text fontSize="sm" color="blue.600" mt={1}>
              {`${formatPercent(accurateQuote.premiumPercentage || 0)} of protection value`}
            </Text>
          )}
        </Flex>
      </Box>

      {/* Existing Flex container for Protected Value and Protection Amount */}
      <Flex 
        direction={{ base: "column", md: "row" }} 
        gap={{ base: 6, md: 8 }}
        align="stretch"
      >
        {/* Protected Value Section */}
        <Box flex="1" ref={protectedValueRef} minH="270px">
            <Flex align="center" mb={2}>
              <Heading as="h3" fontSize="lg" fontWeight="bold" mr={1} color="gray.800">
                Protected Value
              </Heading>
              <Tooltip hasArrow label="The percentage of your Bitcoin's current value that will be protected">
                <Box display="inline">
                  <Icon as={IoInformationCircle} color="blue.500" />
                </Box>
              </Tooltip>
            </Flex>
            
            <Heading as="h4" fontSize="2xl" fontWeight="semibold" mb={1} color="gray.800">
              {formatUSD(protectedValueUSD)}
            </Heading>
            <Text fontSize="sm" color="gray.600" mb={4}>
              {protectedValuePercentage}% of current price
            </Text>
            
            <Slider 
              value={protectedValuePercentage}
              onChange={handleProtectedValueChange}
              min={50}
              max={150}
              step={1}
              mb={4}
            >
              <SliderTrack 
                bg="rgba(163, 177, 198, 0.3)"
                borderRadius="full"
                h="8px"
                boxShadow={neumorphicInnerBoxShadow}
              >
                <SliderFilledTrack 
                  bg="blue.500"
                  borderRadius="full"
                />
              </SliderTrack>
              <SliderThumb 
                boxSize={6} 
                bg={neumorphicBg}
                boxShadow={neumorphicBoxShadow}
                borderWidth="2px" 
                borderColor={neumorphicBg}
                _focus={{ boxShadow: neumorphicBoxShadow }}
              />
            </Slider>
            
            <Flex justify="space-between" color="gray.700">
              <Text>50%</Text>
              <Text>100%</Text>
              <Text>150%</Text>
            </Flex>
            
            <HStack spacing={3} mt={4}>
              {[80, 90, 100, 110].map((value) => {
                const isSelected = protectedValuePercentage === value;
                return (
                  <Button 
                    key={value}
                    variant="unstyled"
                    size="sm" 
                    onClick={() => handleProtectedValueChange(value)}
                    flex="1"
                    bg={neumorphicBg}
                    borderRadius="md"
                    boxShadow={isSelected ? neumorphicInnerBoxShadow : neumorphicBoxShadow}
                    color={isSelected ? "blue.600" : "gray.700"}
                    fontWeight={isSelected ? "bold" : "normal"}
                    transition="all 0.1s ease-in-out"
                    _hover={{
                      boxShadow: isSelected ? neumorphicInnerBoxShadow : `${neumorphicShadowLight.replace("10px", "12px").replace("20px", "24px")}, ${neumorphicShadowDark.replace("10px", "12px").replace("20px", "24px")}`
                    }}
                     _active={{
                       boxShadow: neumorphicInnerBoxShadow,
                       transform: "scale(0.98)"
                    }}
                  >
                    {value}%
                  </Button>
                );
              })}
            </HStack>
            
            {/* Validation error display */}
            {validationErrors.protectedValuePercentage && (
              <Text color="red.500" fontSize="sm" mt={2}>{validationErrors.protectedValuePercentage}</Text>
            )}
            
            <Box mt={4} p={3} bg="rgba(255, 255, 255, 0.5)" borderRadius="lg" boxShadow="inner">
              <Flex gap={2}>
                <Icon as={IoInformationCircle} color="blue.500" mt={0.5} />
                <Text fontSize="sm" color="blue.800">
                  Lower strike prices reduce premium costs but provide less protection.
                </Text>
              </Flex>
            </Box>
        </Box>
        
        {/* Protection Amount Section */}
        <Box flex="1" ref={protectionAmountRef} minH="270px" display="flex" flexDirection="column">
            <Flex align="center" mb={2}>
              <Heading as="h3" fontSize="lg" fontWeight="bold" mr={1} color="gray.800">
                Protection Amount
              </Heading>
              <Tooltip hasArrow label="The amount of Bitcoin you want to protect">
                <Box display="inline">
                  <Icon as={IoInformationCircle} color="blue.500" />
                </Box>
              </Tooltip>
            </Flex>
            
            <Heading as="h4" fontSize="2xl" fontWeight="semibold" mb={1} color="gray.800">
              {formatUSD(protectionAmountUSD)}
            </Heading>
            <Text fontSize="sm" color="gray.600" mb={4}>
              USD Value
            </Text>
            
            <Flex 
              align="center" 
              bg={neumorphicBg} 
              p={3} 
              borderRadius={neumorphicBorderRadius} 
              boxShadow={neumorphicInnerBoxShadow}
              mb={4}
            >
              <Box mr={2} fontWeight="bold" color="orange.500">BTC</Box>
              <Input
                variant="unstyled"
                value={protectionAmount === 0 ? '' : protectionAmount.toString()}
                onChange={handleInputChange}
                textAlign="right"
                fontWeight="bold"
                fontSize="xl"
                placeholder="0.00"
                color="gray.800"
                flex="1"
              />
            </Flex>
            
            <HStack spacing={3} mb={2}>
              {[0.1, 0.25, 0.5, 1.0].map((amount) => {
                const isSelected = protectionAmount === amount;
                return (
                  <Button 
                    key={amount}
                    variant="unstyled"
                    size="sm" 
                    onClick={() => handleAmountSelection(amount)}
                    flex="1"
                    bg={neumorphicBg}
                    borderRadius="md"
                    boxShadow={isSelected ? neumorphicInnerBoxShadow : neumorphicBoxShadow}
                    color={isSelected ? "orange.600" : "gray.700"}
                    fontWeight={isSelected ? "bold" : "normal"}
                    transition="all 0.1s ease-in-out"
                    _hover={{
                      boxShadow: isSelected ? neumorphicInnerBoxShadow : `${neumorphicShadowLight.replace("10px", "12px").replace("20px", "24px")}, ${neumorphicShadowDark.replace("10px", "12px").replace("20px", "24px")}`
                    }}
                     _active={{
                       boxShadow: neumorphicInnerBoxShadow,
                       transform: "scale(0.98)"
                    }}
                  >
                    {formatBTC(amount, { minimumFractionDigits: 1, includeSuffix: false })} BTC
                  </Button>
                );
              })}
            </HStack>
            
            {/* Validation error display */}
            {validationErrors.protectionAmount && (
              <Text color="red.500" fontSize="sm" mt={1}>{validationErrors.protectionAmount}</Text>
            )}
            
            <Box mt="auto" p={3} bg="rgba(255, 255, 255, 0.5)" borderRadius="lg" boxShadow="inner">
              <Flex gap={2}>
                <Icon as={IoInformationCircle} color="blue.500" mt={0.5} />
                <Text fontSize="sm" color="blue.800">
                  Your premium cost increases proportionally with the amount protected.
                </Text>
              </Flex>
            </Box>
        </Box>
      </Flex>
      
      {/* Protection Period Section */}
      <Box mt={8}>
         <Flex align="center" mb={4}>
            <Heading as="h3" fontSize="lg" fontWeight="bold" mr={1} color="gray.800">
              Protection Period
            </Heading>
            <Tooltip hasArrow label="The timeframe during which your Bitcoin protection will be active.">
              <Box display="inline">
                <Icon as={IoInformationCircle} color="blue.500" />
              </Box>
            </Tooltip>
          </Flex>
          
          <Grid 
            templateColumns={{ base: "1fr", md: "repeat(4, 1fr)" }} 
            gap={4}
          >
            {[30, 90, 180, 360].map((period) => {
              const isSelected = protectionPeriod === period;
              return (
                <GridItem key={period}>
                  <Box
                    p={4}
                    borderRadius={neumorphicBorderRadius}
                    bg={isSelected ? 'green.600' : neumorphicBg}
                    boxShadow={isSelected ? 'md' : neumorphicBoxShadow}
                    borderWidth="2px"
                    borderColor={isSelected ? 'green.700' : 'transparent'}
                    color={isSelected ? 'white' : 'gray.800'}
                    cursor="pointer"
                    onClick={() => handlePeriodSelect(period)}
                    transition="all 0.2s ease-in-out"
                    _hover={{
                      boxShadow: isSelected ? 'md' : `${neumorphicShadowLight.replace("10px", "12px").replace("20px", "24px")}, ${neumorphicShadowDark.replace("10px", "12px").replace("20px", "24px")}`,
                      transform: isSelected ? 'none' : 'translateY(-2px)',
                    }}
                    _active={{
                      boxShadow: isSelected ? 'md' : neumorphicInnerBoxShadow
                    }}
                  >
                    <VStack spacing={1} align="center">
                      <Text fontSize="xl" fontWeight="bold">{period} Days</Text>
                      <Text fontSize="sm" color={isSelected ? 'green.200' : 'gray.500'}>
                        {getPeriodDescription(period)}
                      </Text>
                    </VStack>
                  </Box>
                </GridItem>
              );
            })}
          </Grid>
          
          {/* Validation error display */}
          {validationErrors.protectionPeriod && (
            <Text color="red.500" fontSize="sm" mt={1}>{validationErrors.protectionPeriod}</Text>
          )}
      </Box>
      
      {/* Break-even Price (display if available from accurate quote) */}
      {accurateQuote?.breakEvenPrice && (
        <Box mt={6} p={4} bg="green.50" borderRadius="md" boxShadow="sm">
          <Flex direction="column" align="center">
            <Text fontWeight="medium" color="green.800">Break-even Price:</Text>
            <Heading color="green.700" size="md">{formatUSD(accurateQuote.breakEvenPrice)}</Heading>
            <Text fontSize="xs" color="green.600" mt={1}>
              Price at which your protection has zero net value
            </Text>
          </Flex>
        </Box>
      )}
    </Box>
  );
};

export default BuyerParametersUI; 