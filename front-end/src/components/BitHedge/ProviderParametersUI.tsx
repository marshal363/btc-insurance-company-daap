"use client"; // Assuming client component based on usage of hooks

import React, { useEffect } from "react"; // Import React and useEffect
import {
  Box,
  Flex,
  Text,
  Heading,
  Tooltip,
  Icon,
  Input,
  HStack,
  VStack,
  Divider,
  SimpleGrid,
  Button,
  Grid,
  GridItem,
  Spinner,
  Badge, // Import Badge
} from "@chakra-ui/react";
import {
  IoInformationCircle,
  IoShieldOutline,
  IoScaleOutline,
  IoTrendingUpOutline,
  IoWalletOutline,
} from "react-icons/io5";
import { useProviderContext } from "@/contexts/ProviderContext";
import type { ProviderTier } from '@/types';
import { useBitcoinPrice } from "@/hooks/useBitcoinPrice";
import { formatUSD, formatBTC, formatPercent } from "@/utils/formatters";
import { estimateProviderYield } from "@/utils/clientEstimation"; // Import estimation util
import { useProviderQuote } from "@/hooks/useProviderQuote"; // Import quote hook
import { useDebounce } from "@/hooks/useDebounce"; // Import debounce hook

// --- Provider Specific UI Component --- 
const ProviderParametersUI = () => {
  // Use the ProviderContext
  const { 
    inputs, 
    updateProviderInputs, 
    validationErrors,
    estimatedResult, // Add state for estimated result
    setEstimatedResult, // Add setter
    accurateQuote, // Add state for accurate quote
    setAccurateQuote // Add setter
  } = useProviderContext();
  
  // Extract values from inputs
  const { riskRewardTier, capitalCommitment, incomePeriod } = inputs;
  
  // Use Bitcoin price hook
  const { 
    currentPrice,
    volatility,
    isLoading: isPriceLoading,
    hasError: hasPriceError,
    errorMessage: priceErrorMessage,
    isStale: isPriceStale 
  } = useBitcoinPrice();
  
  // Use debounce hook for inputs
  const debouncedInputs = useDebounce(inputs, 500);
  
  // Use the Convex quote hook for accurate yield calculation
  const {
    quote: accurateQuoteData,
    isLoading: isQuoteLoading,
    error: quoteError,
    fetchQuote,
  } = useProviderQuote();
  
  // Mock wallet balance - replace later
  const walletBalanceSTX = 1000;
  
  // Calculate USD values using real BTC price
  const capitalCommitmentUSD = typeof capitalCommitment === 'number' 
    ? capitalCommitment * currentPrice 
    : 0;
  
  const walletBalanceUSD = walletBalanceSTX * currentPrice;

  // --- Client-side Estimation Effect ---
  useEffect(() => {
    if (
      currentPrice > 0 && 
      volatility > 0 && 
      capitalCommitment > 0 && // Use capitalCommitment from context
      incomePeriod > 0 &&
      riskRewardTier &&
      !isPriceLoading
    ) {
      const commitmentUSD = capitalCommitment * currentPrice; // Calculate USD value for estimation
      if (commitmentUSD > 0) {
        const estimationResult = estimateProviderYield({
          commitmentAmountUSD: commitmentUSD,
          selectedTier: riskRewardTier,
          selectedPeriodDays: incomePeriod,
          volatility,
          currentPrice,
        });
        
        if (estimationResult) {
          setEstimatedResult(estimationResult);
        }
      }
    }
  }, [currentPrice, volatility, capitalCommitment, incomePeriod, riskRewardTier, isPriceLoading, setEstimatedResult]);

  // --- Debounced Convex Quote Effect ---
  useEffect(() => {
    const debouncedCommitment = debouncedInputs.capitalCommitment;
    const debouncedTier = debouncedInputs.riskRewardTier;
    const debouncedPeriod = debouncedInputs.incomePeriod;
    
    if (
      currentPrice > 0 && 
      !isPriceLoading && 
      debouncedCommitment > 0 &&
      debouncedTier &&
      debouncedPeriod > 0
    ) {
      const commitmentUSD = debouncedCommitment * currentPrice; // Calculate USD value for quote fetch
      if (commitmentUSD > 0) {
        fetchQuote({
          commitmentAmountUSD: commitmentUSD,
          selectedTier: debouncedTier,
          selectedPeriodDays: debouncedPeriod,
        });
      }
    }
  }, [debouncedInputs, currentPrice, isPriceLoading, fetchQuote]);

  // Update context with accurate quote when it arrives
  useEffect(() => {
    if (accurateQuoteData) {
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

  // Tier data
  const tiers = [
    {
      id: 'conservative',
      name: 'Conservative Yield',
      description: 'Lower risk with modest income potential.',
      metrics: 'Est. APY: 3-5% | Acquisition: Low',
      icon: IoShieldOutline,
    },
    {
      id: 'balanced',
      name: 'Balanced Growth',
      description: 'Moderate risk for balanced income and acquisition.',
      metrics: 'Est. APY: 6-9% | Acquisition: Medium',
      icon: IoScaleOutline,
    },
    {
      id: 'aggressive',
      name: 'Aggressive Acquisition',
      description: 'Higher risk targeting premium income and BTC acquisition.',
      metrics: 'Est. APY: 10%+ | Acquisition: High',
      icon: IoTrendingUpOutline,
    },
  ];

  // Period descriptions
  const getPeriodDescription = (period: number) => {
    switch (period) {
      case 30: return "Short Term";
      case 90: return "Balanced";
      case 180: return "Strategic";
      case 360: return "Long Commitment";
      default: return "";
    }
  };
  
  // Handler functions
  const handleTierSelect = (tier: ProviderTier) => {
    updateProviderInputs({ riskRewardTier: tier });
  };

  const handleCommitmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) { 
      const numericValue = parseFloat(value);
      // Update only the commitment amount in context
      // The USD value is calculated in the render
      updateProviderInputs({ capitalCommitment: isNaN(numericValue) ? 0 : numericValue });
    }
  };

  const handleQuickSelect = (percentage: number) => {
    const amount = walletBalanceSTX * (percentage / 100);
    updateProviderInputs({ capitalCommitment: amount });
  };

  const handlePeriodSelect = (period: number) => {
    updateProviderInputs({ incomePeriod: period });
  };

  // Determine which yield to display
  const displayYield = accurateQuote?.calculated?.estimatedYieldUSD ?? estimatedResult?.estimatedYield ?? 0;
  const displayAPY = accurateQuote?.calculated?.estimatedYieldPercentage ?? estimatedResult?.estimatedAnnualizedYieldPercentage ?? 0;
  const isEstimatedDisplay = !accurateQuote && estimatedResult !== null && estimatedResult.estimatedYield > 0;
  const isCalculating = isPriceLoading || isQuoteLoading;

  return (
    <Box>
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
      
      {/* Stale Data Indicator */}
      {isPriceStale && (
        <Flex justify="center" mb={4} p={2} bg="yellow.50" borderRadius="md">
          <Icon as={IoInformationCircle} color="yellow.500" mr={2} />
          <Text fontSize="sm" color="yellow.700">Using cached price data while refreshing...</Text>
        </Flex>
      )}
      
      {/* Quote Error Message */} 
      {quoteError && (
        <Flex justify="center" mb={4} p={2} bg="red.50" borderRadius="md">
          <Icon as={IoInformationCircle} color="red.500" mr={2} />
          <Text fontSize="sm" color="red.700">{quoteError}</Text>
        </Flex>
      )}
      
      {/* Current Price Display */}
      <Flex justify="center" mb={4} p={2} bg="gray.50" borderRadius="md">
        <Text fontWeight="medium" fontSize="sm" color="gray.700">
          Current BTC Price: {formatUSD(currentPrice)} 
          {volatility > 0 && ` | Volatility: ${formatPercent(volatility * 100)}`}
        </Text>
      </Flex>
      
      {/* NEW: Estimated Yield Display Panel */} 
      <Box mb={6} p={4} bg="green.50" borderRadius="md" boxShadow="md">
        <Flex direction="column" align="center">
          <HStack mb={1}>
            <Text fontWeight="medium" color="green.800">Estimated Annualized Yield (APY):</Text>
            {isCalculating && <Spinner size="xs" color="green.500" />}
          </HStack>
          <Heading color="green.700" size="lg">{formatPercent(displayAPY || 0)}</Heading>
          {isEstimatedDisplay && (
            <Badge colorScheme="yellow" mt={1}>Estimated</Badge>
          )}
          {accurateQuote && (
             <Text fontSize="sm" color="green.600" mt={1}>
              Yield: ~{formatUSD(displayYield || 0)} over {incomePeriod} days
            </Text>
          )}
        </Flex>
      </Box>
      
      {/* Risk-Reward Tier Section */}
      <Box mb={8}>
         <Flex align="center" mb={4}>
            <Heading as="h3" fontSize="lg" fontWeight="bold" mr={1} color="gray.800">
              Select Your Risk-Reward Tier
            </Heading>
            <Tooltip hasArrow label="Choose a tier based on your desired balance between income generation and potential Bitcoin acquisition.">
              <Box display="inline">
                <Icon as={IoInformationCircle} color="blue.500" />
              </Box>
            </Tooltip>
          </Flex>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          {tiers.map((tier) => {
            const isSelected = riskRewardTier === tier.id;
            return (
              <Box
                key={tier.id}
                p={5}
                borderRadius={neumorphicBorderRadius}
                bg={isSelected ? 'blue.600' : neumorphicBg}
                boxShadow={isSelected ? 'md' : neumorphicBoxShadow}
                borderWidth="2px"
                borderColor={isSelected ? 'blue.700' : 'transparent'}
                color={isSelected ? 'white' : 'gray.800'}
                cursor="pointer"
                onClick={() => handleTierSelect(tier.id as ProviderTier)}
                transition="all 0.2s ease-in-out"
                _hover={{
                  boxShadow: isSelected ? 'md' : `${neumorphicShadowLight.replace("10px", "12px").replace("20px", "24px")}, ${neumorphicShadowDark.replace("10px", "12px").replace("20px", "24px")}`,
                  transform: isSelected ? 'none' : 'translateY(-2px)',
                }}
                 _active={{
                   boxShadow: isSelected ? 'md' : neumorphicInnerBoxShadow
                 }}
              >
                <VStack spacing={3} align="start">
                  <Flex align="center" w="full" justify="space-between">
                    <Text fontWeight="bold" fontSize="md">{tier.name}</Text>
                    <Icon as={tier.icon} boxSize={5} color={isSelected ? 'white' : 'blue.500'} />
                  </Flex>
                  <Text fontSize="sm" color={isSelected ? 'blue.100' : 'gray.600'}>
                    {tier.description}
                  </Text>
                  <Divider borderColor={isSelected ? 'blue.500' : 'gray.300'} opacity={isSelected ? 0.5 : 1} />
                  <Text fontSize="xs" fontWeight="medium" color={isSelected ? 'blue.200' : 'gray.500'}>
                    {tier.metrics}
                  </Text>
                </VStack>
              </Box>
            );
          })}
        </SimpleGrid>
      </Box>

      {/* Capital Commitment Section */}
      <Box mb={8}>
         <Flex align="center" mb={4}>
            <Heading as="h3" fontSize="lg" fontWeight="bold" mr={1} color="gray.800">
              How Much Capital Will You Commit?
            </Heading>
            <Tooltip hasArrow label="Enter the amount of BTC you wish to commit to this income strategy.">
              <Box display="inline">
                <Icon as={IoInformationCircle} color="blue.500" />
              </Box>
            </Tooltip>
          </Flex>

        {/* Input and Balance Display */}
        <Flex 
          direction={{ base: "column", md: "row" }} 
          gap={4} 
          align={{ base: "stretch", md: "center" }} 
          mb={4}
        >
          {/* Input Group */}
          <Box 
            flex="2" 
            bg={neumorphicBg} 
            p={3} 
            borderRadius={neumorphicBorderRadius} 
            boxShadow={neumorphicInnerBoxShadow}
            display="flex"
            alignItems="center"
          >
             <Text fontWeight="bold" color="purple.500" mr={2}>BTC</Text> 
             <Input
                variant="unstyled"
                value={capitalCommitment === 0 ? '' : capitalCommitment.toString()}
                onChange={handleCommitmentChange}
                textAlign="right"
                fontWeight="bold"
                fontSize="xl"
                placeholder="0.00"
                color="gray.800"
                _placeholder={{ color: "gray.500" }}
                flex="1"
             />
          </Box>

          {/* USD Value */}
          <Flex 
            flex="1" 
            bg={neumorphicBg} 
            py={2} 
            px={4} 
            borderRadius={neumorphicBorderRadius} 
            boxShadow={neumorphicBoxShadow}
            align="center"
            justify="center"
            minH="60px"
          >
             <VStack>
               <Text color="gray.500" fontSize="xs">Value in USD</Text>
               <Text color="gray.700" fontWeight="bold">
                 {formatUSD(capitalCommitmentUSD)}
               </Text>
             </VStack>
          </Flex>
        </Flex>

        {/* Wallet Balance */}
        <Flex align="center" justify="space-between" mb={4}>
          <Flex align="center">
            <Icon as={IoWalletOutline} color="green.500" mr={1} />
            <Text fontSize="sm" color="gray.600">Available: <Text as="span" fontWeight="bold">{formatBTC(walletBalanceSTX, { includeSuffix: false })} STX</Text></Text>
          </Flex>
          <Text fontSize="sm" color="gray.400">≈ {formatUSD(walletBalanceUSD)}</Text>
        </Flex>

        {/* Quick Percentages */}
        <HStack spacing={2} mb={4}>
          {[25, 50, 75, 100].map(percent => (
            <Button
              key={percent}
              variant="outline"
              size="sm"
              onClick={() => handleQuickSelect(percent)}
              borderRadius="md"
              colorScheme="purple"
              color="purple.500"
              _hover={{ bg: 'purple.50' }}
            >
              {percent}%
            </Button>
          ))}
        </HStack>
        
        {/* Validation error display */}
        {validationErrors.capitalCommitment && (
          <Text color="red.500" fontSize="sm" mt={1}>{validationErrors.capitalCommitment}</Text>
        )}
      </Box>

      {/* Income Period Section */}
      <Box mb={6}>
        <Flex align="center" mb={4}>
          <Heading as="h3" fontSize="lg" fontWeight="bold" mr={1} color="gray.800">
            Select Your Income Period
          </Heading>
          <Tooltip hasArrow label="Choose how long you want to commit your capital. Longer periods may offer different yield profiles.">
            <Box display="inline">
              <Icon as={IoInformationCircle} color="blue.500" />
            </Box>
          </Tooltip>
        </Flex>
          
        <Grid templateColumns="repeat(4, 1fr)" gap={3}>
          {[30, 90, 180, 360].map(period => {
            const isSelected = incomePeriod === period;
            return (
              <GridItem key={period} colSpan={1}>
                <Box
                  p={3}
                  textAlign="center"
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
                  <Text fontWeight="bold" fontSize="lg">{period} Days</Text>
                  <Text fontSize="xs" color={isSelected ? 'green.200' : 'gray.500'}>
                    {getPeriodDescription(period)}
                  </Text>
                </Box>
              </GridItem>
            );
          })}
        </Grid>
        
        {/* Validation error display */}
        {validationErrors.incomePeriod && (
          <Text color="red.500" fontSize="sm" mt={1}>{validationErrors.incomePeriod}</Text>
        )}
      </Box>
    </Box>
  );
};

export default ProviderParametersUI; 