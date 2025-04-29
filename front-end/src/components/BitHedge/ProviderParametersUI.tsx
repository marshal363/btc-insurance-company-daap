"use client"; // Assuming client component based on usage of hooks

import React from "react"; // Import React
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
} from "@chakra-ui/react";
import {
  IoInformationCircle,
  IoShieldOutline,
  IoScaleOutline,
  IoTrendingUpOutline,
  IoWalletOutline,
} from "react-icons/io5";

// Define Types needed within this component
type ProviderTier = 'conservative' | 'balanced' | 'aggressive';

// Define Props for the component
interface ProviderParametersUIProps {
  selectedTier: ProviderTier;
  commitmentAmount: string;
  commitmentAmountUSD: number;
  selectedPeriod: number;
  walletBalanceSTX: number;
  handleTierSelect: (tier: ProviderTier) => void;
  handleCommitmentChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleQuickSelect: (percentage: number) => void;
  handlePeriodSelect: (period: number) => void;
}

// --- Provider Specific UI Component --- 
const ProviderParametersUI = ({ 
  selectedTier,
  commitmentAmount,
  commitmentAmountUSD,
  selectedPeriod,
  walletBalanceSTX,
  handleTierSelect,
  handleCommitmentChange,
  handleQuickSelect,
  handlePeriodSelect,
}: ProviderParametersUIProps) => {
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

  return (
    <Box>
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
            const isSelected = selectedTier === tier.id;
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
            <Tooltip hasArrow label="Enter the amount of STX you wish to commit to this income strategy.">
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
             <Text fontWeight="bold" color="purple.500" mr={2}>STX</Text> 
             <Input
                variant="unstyled"
                value={commitmentAmount}
                onChange={handleCommitmentChange}
                textAlign="right"
                fontWeight="bold"
                fontSize="xl"
                placeholder="0.00"
                color="gray.800"
                _placeholder={{ color: "gray.500" }}
                flex="1"
                mr={2}
              />
              {/* USD Value Display */}
              <Text fontSize="sm" color="gray.600" whiteSpace="nowrap">
                 ≈ ${commitmentAmountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
          </Box>
          
          {/* Wallet Balance */}
          <Box 
            flex="1" 
            p={3} 
            bg="rgba(255, 255, 255, 0.5)"
            borderRadius={neumorphicBorderRadius} 
            boxShadow="inner" 
            textAlign="center"
          >
            <Text fontSize="xs" color="gray.600" mb={1}>Available Balance</Text>
            <Text fontWeight="bold" color="gray.800">{walletBalanceSTX.toLocaleString()} STX</Text>
          </Box>
        </Flex>

        {/* Quick Select Buttons */}
        <HStack spacing={3}>
          {[25, 50, 75, 100].map((percentage) => {
            const amountForButton = walletBalanceSTX * (percentage / 100);
            const isSelected = parseFloat(commitmentAmount) === amountForButton && commitmentAmount !== "";
            return (
              <Button
                key={percentage}
                variant="outline"
                size="sm"
                flex="1"
                onClick={() => handleQuickSelect(percentage)}
                isDisabled={amountForButton > walletBalanceSTX}
                bg={isSelected ? "blue.100" : neumorphicBg}
                borderColor={isSelected ? "blue.400" : "gray.300"}
                color={isSelected ? "blue.700" : "gray.700"}
                fontWeight={isSelected ? "bold" : "normal"}
                boxShadow={neumorphicBoxShadow}
                _hover={{
                  bg: isSelected ? "blue.100" : "gray.100",
                  borderColor: isSelected ? "blue.400" : "gray.400",
                  boxShadow: `${neumorphicShadowLight.replace("10px", "12px").replace("20px", "24px")}, ${neumorphicShadowDark.replace("10px", "12px").replace("20px", "24px")}`,
                }}
                _active={{
                  bg: isSelected ? "blue.200" : "gray.200",
                  boxShadow: neumorphicInnerBoxShadow
                }}
              >
                {percentage}%
              </Button>
            );
          })}
        </HStack>
        
        {/* Yield Projection Placeholder */}
        <Box mt={4} p={3} bg="rgba(255, 255, 255, 0.5)" borderRadius="lg" boxShadow="inner">
          <Flex gap={2} justify="center" align="center">
            <Icon as={IoWalletOutline} color="blue.600" />
            <Text fontSize="sm" color="blue.800">
              Estimated Yield: <Text as="span" fontWeight="bold">(Placeholder - Connect to Calculation)</Text>
            </Text>
          </Flex>
        </Box>
      </Box>
      
      {/* Income Period Section */}
       <Box mt={8}>
          <Flex align="center" justify="space-between" mb={4}>
            <Flex align="center">
              <Heading as="h3" fontSize="lg" fontWeight="bold" mr={1} color="gray.800">
                Select Your Income Period
              </Heading>
              <Tooltip hasArrow label="The duration for which your capital will be committed to generate income.">
                <Box display="inline">
                  <Icon as={IoInformationCircle} color="blue.500" />
                </Box>
              </Tooltip>
            </Flex>
            <Box>
              <Heading as="h4" fontSize="xl" fontWeight="semibold" textAlign="right" color="gray.800">
                {selectedPeriod} days
              </Heading>
              <Text fontSize="sm" color="gray.600" textAlign="right">
                 {getPeriodDescription(selectedPeriod)}
              </Text>
            </Box>
          </Flex>
          
          <Grid 
            templateColumns={{ base: "1fr", md: "repeat(4, 1fr)" }} 
            gap={4}
            mt={4}
          >
            {[30, 90, 180, 360].map((period) => {
              const isSelected = selectedPeriod === period;
              return (
                <GridItem key={period} h="100%">
                  <Box
                    h="100%"
                    p={4}
                    borderWidth="1px"
                    borderRadius="lg"
                    cursor="pointer"
                    onClick={() => handlePeriodSelect(period)}
                    transition="all 0.2s ease-in-out"
                    bg={isSelected ? "blue.600" : "rgba(255, 255, 255, 0.5)"}
                    bgGradient={isSelected ? "linear(to-b, blue.600, blue.700)" : undefined}
                    color={isSelected ? "white" : "gray.800"}
                    borderColor={isSelected ? "blue.600" : "gray.300"}
                    shadow={isSelected ? "md" : "inner"}
                    _hover={{
                      shadow: "md",
                      borderColor: isSelected ? "blue.700" : "gray.400",
                      bg: isSelected ? undefined : "rgba(255, 255, 255, 0.7)",
                      bgGradient: isSelected ? "linear(to-b, blue.700, blue.800)" : undefined,
                    }}
                  >
                    <VStack spacing={2} align="center" h="100%" justify="center"> 
                      <Heading 
                        as="h4" 
                        fontSize="3xl" 
                        fontWeight="bold" 
                        mb={0}
                        color={isSelected ? "white" : "blue.600"}
                      >
                        {period}
                      </Heading>
                      <Text 
                        fontSize="md" 
                        color={isSelected ? "blue.100" : "gray.600"}
                      >
                        days
                      </Text>
                      <Divider 
                        my={2} 
                        borderColor={isSelected ? "blue.500" : "gray.300"}
                        opacity={isSelected ? 0.5 : 1}
                      />
                      <Text 
                        fontSize="sm" 
                        fontWeight="medium"
                        color={isSelected ? "blue.100" : "gray.700"}
                        textAlign="center"
                      >
                        {getPeriodDescription(period)}
                      </Text>
                    </VStack>
                  </Box>
                </GridItem>
              );
            })}
          </Grid>
          
          {/* Provider Specific Info Box */}
          <Box mt={4} p={3} bg="rgba(255, 255, 255, 0.5)" borderRadius="lg" boxShadow="inner">
            <Flex gap={2}>
              <Icon as={IoInformationCircle} color="blue.500" mt={0.5} />
              <Text fontSize="sm" color="blue.800">
                Longer commitment periods may offer higher yields but involve longer capital lock-up.
              </Text>
            </Flex>
          </Box>
      </Box>
    </Box>
  );
};

export default ProviderParametersUI; // Export the component 