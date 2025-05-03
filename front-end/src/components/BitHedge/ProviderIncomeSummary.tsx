"use client";

import {
  Box,
  Flex,
  Text,
  Heading,
  Button,
  Badge,
  Icon,
  SimpleGrid,
  HStack,
  List,
  ListItem,
  ListIcon,
  Divider,
  Grid,
  GridItem,
  VStack,
  Tooltip,
  useToast,
  Collapse,
  Spinner,
} from "@chakra-ui/react";
import {
  IoWallet,
  IoTrendingUpOutline,
  IoCashOutline,
  IoSaveOutline,
  IoWarningOutline,
  IoInformationCircleOutline,
} from "react-icons/io5";
import { useProviderContext } from "@/contexts/ProviderContext";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";
import { ValidationError } from "@/components/common/ValidationError";
import { useProviderQuote } from "@/hooks/useProviderQuote";
import type { ProviderYieldQuoteResult } from "@/../../convex/types";

// Reusing formatters (could be moved to a shared utils file)
const formatCurrency = (value: number | null | undefined, placeholder: string = '$--.--') => {
  if (value === null || value === undefined || isNaN(value)) {
    return placeholder;
  }
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercentage = (value: number | null | undefined, placeholder: string = '--.--%') => {
  if (value === null || value === undefined || isNaN(value)) {
    return placeholder;
  }
  return `${(value * 100).toFixed(2)}%`;
};

// TODO: Add STX formatting utility
const formatSTX = (value: number | null | undefined, placeholder: string = '---.-- STX') => {
    if (value === null || value === undefined || isNaN(value)) {
      return placeholder;
    }
    // Basic formatting, can be improved
    return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} STX`;
  };

// Create a simple CalculationLoader component
const CalculationLoader = ({ isLoading, text = "Calculating..." }: { isLoading: boolean; text?: string }) => {
  if (!isLoading) return null;
  return (
    <Flex justify="center" p={6} textAlign="center">
      <Spinner size="md" color="blue.500" mr={3} />
      <Text color="blue.700">{text}</Text>
    </Flex>
  );
};

export default function ProviderIncomeSummary() {
  const { accurateQuote: providerQuoteResult } = useProviderContext();
  const { isLoading: isProviderLoading, error: providerError } = useProviderQuote();

  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isLoading = isProviderLoading;
  const quoteData = providerQuoteResult;
  const error = providerError;

  const providerQuoteData = quoteData as ProviderYieldQuoteResult | null;

  // --- Extract Provider Data ---
  const potentialYield = providerQuoteData?.calculated?.estimatedYieldPercentage;
  const potentialIncomeSTX = providerQuoteData?.calculated?.estimatedYieldUSD; // Assuming yield is in STX, needs confirmation
  const potentialIncomeUSD = potentialIncomeSTX ? potentialIncomeSTX * 0.45 : undefined; // Example conversion
  const capitalCommittedSTX = providerQuoteData?.parameters?.commitmentAmountUSD ? (providerQuoteData?.parameters?.commitmentAmountUSD / (providerQuoteData?.marketData?.price || 1)) : undefined; // Derive BTC amount
  const capitalCommittedUSD = providerQuoteData?.parameters?.commitmentAmountUSD;
  const riskTier = providerQuoteData?.parameters?.selectedTier;
  const incomePeriod = providerQuoteData?.parameters?.selectedPeriodDays;
  const capitalEfficiency = providerQuoteData?.calculated?.yieldComponents?.capitalEfficiency;
  // Need to get strike price and break-even from provider calculation if available
  const strikePriceProvided = providerQuoteData?.calculated?.yieldComponents?.estimatedBTCAcquisitionPrice; // Or similar field?
  const breakEvenAcquisitionPrice = providerQuoteData?.calculated?.breakEvenPriceUSD; // Use the calculated break-even price
  const marketPriceAtQuote = providerQuoteData?.marketData?.price;

  // Neumorphic Styles
  const neumorphicBg = "#E8EAE9";
  const neumorphicShadowLight = "-10px -10px 20px rgba(255, 255, 255, 0.8)";
  const neumorphicShadowDark = "10px 10px 20px rgba(163, 177, 198, 0.6)";
  const neumorphicBoxShadow = `${neumorphicShadowLight}, ${neumorphicShadowDark}`;
  const neumorphicBorderRadius = "xl";

  // Save Quote Mutation
  const saveQuoteMutation = useMutation(api.quotes.saveQuote);

  const handleSaveQuote = async () => {
    if (!providerQuoteData) {
      toast({
        title: "Cannot Save Quote",
        description: "No valid provider quote data available to save.",
        status: "warning",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSavedQuoteId(null);

    try {
      const displayName = `BTC Income ${riskTier} / ${incomePeriod} Days`;

      const result = await saveQuoteMutation({
        quoteType: "provider",
        asset: "BTC",
        calculationResult: providerQuoteData,
        metadata: {
          displayName: displayName,
          notes: "",
          tags: ["provider", "income", "btc", `tier-${riskTier}`, `period-${incomePeriod}`],
        },
      });

      setSavedQuoteId(result.id);
      toast({
        title: "Quote Saved",
        description: `Your income strategy quote (${displayName}) has been saved.`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (err) {
      console.error("Error saving quote:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to save quote. Please try again.";
      setSaveError(errorMessage);
      toast({
        title: "Save Failed",
        description: errorMessage,
        status: "error",
        duration: 7000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Commit Capital Handler
  const handleCommitCapital = () => {
    console.log("Commit Capital Clicked", { providerQuoteData });
    toast({
      title: "Next Step: Blockchain",
      description: "Preparing data for blockchain transaction...",
      status: "info",
      duration: 3000,
      isClosable: true,
    });
  };

  // Loading State
  if (isLoading) {
    return <CalculationLoader isLoading={true} text="Fetching latest income quote..." />;
  }

  // Error State
  if (error && !quoteData) {
    return (
       <Box p={6} borderRadius={neumorphicBorderRadius} bg={neumorphicBg} boxShadow={neumorphicBoxShadow} textAlign="center">
         <Icon as={IoWarningOutline} w={10} h={10} color="orange.500" mb={3} />
         <Heading as="h3" size="md" color="orange.700" mb={2}>Calculation Error</Heading>
         <Text color="gray.600" mb={4}>Could not fetch the latest income quote details.</Text>
         <ValidationError message={error} showAsAlert={true} />
       </Box>
     );
  }

  // Initial State
  if (!quoteData && !isLoading && !error) {
     return (
       <Box p={6} borderRadius={neumorphicBorderRadius} bg={neumorphicBg} boxShadow={neumorphicBoxShadow} textAlign="center">
         <Icon as={IoInformationCircleOutline} w={10} h={10} color="blue.500" mb={3} />
         <Heading as="h3" size="md" color="blue.700" mb={2}>Enter Parameters</Heading>
         <Text color="gray.600">Adjust the parameters above to generate an income quote.</Text>
       </Box>
     );
   }

  // Main Component Rendering
  return (
    <Box>
      <Heading as="h2" fontSize="2xl" fontWeight="bold" mb={4} color="gray.800">
        Income Strategy Review
      </Heading>
      <Text mb={6} color="gray.700">
        Review your income strategy details before committing capital.
      </Text>

      <Box
        bg={neumorphicBg}
        borderRadius={neumorphicBorderRadius}
        boxShadow={neumorphicBoxShadow}
        overflow="hidden"
        mb={6}
        p={6}
      >
        <Heading as="h3" fontSize="lg" fontWeight="bold" mb={6} color="gray.800">
          Strategy Summary
        </Heading>

        <Grid templateColumns={{ base: "1fr", md: "3fr 2fr" }} gap={8}>
          {/* Provider GridItem 1 (Data section) */}
          <GridItem>
            <SimpleGrid columns={{ base: 2, md: 2 }} spacing={5} mb={6}>
               <Box p={4} bg="transparent" borderRadius={neumorphicBorderRadius} boxShadow="inner" borderWidth="1px" borderColor="rgba(0,0,0,0.05)">
                  <Text color="gray.600" fontSize="sm" mb={1}>Risk Tier</Text>
                  <Heading as="h4" size="md" fontWeight="semibold" color="gray.800">{riskTier ?? 'N/A'}</Heading>
                  <Text fontSize="xs" color="gray.500" mt={1}>Selected Strategy</Text>
                </Box>
                <Box p={4} bg="transparent" borderRadius={neumorphicBorderRadius} boxShadow="inner" borderWidth="1px" borderColor="rgba(0,0,0,0.05)">
                  <Text color="gray.600" fontSize="sm" mb={1}>Income Period</Text>
                  <Heading as="h4" size="md" fontWeight="semibold" color="gray.800">{incomePeriod ?? '--'} days</Heading>
                  <Text fontSize="xs" color="gray.500" mt={1}>Strategy Duration</Text>
                </Box>
                <Box p={4} bg="transparent" borderRadius={neumorphicBorderRadius} boxShadow="inner" borderWidth="1px" borderColor="rgba(0,0,0,0.05)">
                  <Text color="gray.600" fontSize="sm" mb={1}>Capital Committed</Text>
                  <Heading as="h4" size="md" fontWeight="semibold" color="gray.800">{formatSTX(capitalCommittedSTX)}</Heading>
                  <Text fontSize="xs" color="gray.500" mt={1}>{formatCurrency(capitalCommittedUSD)}</Text>
                </Box>
                <Box p={4} bg="transparent" borderRadius={neumorphicBorderRadius} boxShadow="inner" borderWidth="1px" borderColor="rgba(0,0,0,0.05)">
                  <Text color="gray.600" fontSize="sm" mb={1}>Potential Acq. Price</Text>
                  <Heading as="h4" size="md" fontWeight="semibold" color="gray.800">{formatCurrency(strikePriceProvided)}</Heading>
                  <Text fontSize="xs" color="gray.500" mt={1}>If Assigned BTC</Text>
                </Box>
            </SimpleGrid>
            <List spacing={3} color="gray.700">
                <ListItem>
                  <Flex>
                    <ListIcon as={IoInformationCircleOutline} color="green.500" mt={1} />
                    <Text fontSize="sm">Income generated if BTC market price at expiry {formatCurrency(marketPriceAtQuote)} stays above strike {formatCurrency(strikePriceProvided)}.</Text>
                  </Flex>
                </ListItem>
                <ListItem>
                  <Flex>
                    <ListIcon as={IoInformationCircleOutline} color="green.500" mt={1} />
                    <Text fontSize="sm">Potential to acquire BTC near {formatCurrency(breakEvenAcquisitionPrice)} if price falls below strike.</Text>
                  </Flex>
                </ListItem>
              </List>
          </GridItem>

          {/* Provider GridItem 2 (Income section) */}
          <GridItem>
            <Box
              bg="green.600"
              bgGradient="linear(to-b, green.600, green.700)"
              color="white"
              borderRadius="lg"
              overflow="hidden"
              h="100%"
              display="flex"
              flexDirection="column"
              shadow="md"
            >
              <Flex
                align="center"
                justify="space-between"
                borderBottomWidth="1px"
                borderColor="green.500"
                px={4}
                py={3}
                bg="rgba(0,0,0,0.1)"
              >
                <Flex align="center" gap={2}>
                  <Icon as={IoTrendingUpOutline} />
                  <Heading as="h3" size="sm" fontWeight="semibold">
                    Potential Income
                  </Heading>
                </Flex>
                <Badge colorScheme="whiteAlpha" variant="subtle" px={2} py={0.5} fontSize="xs">
                  Yield
                </Badge>
              </Flex>

              <VStack p={4} flex="1" spacing={4} align="stretch">
                <VStack spacing={1} align="center">
                  <HStack justify="center" align="baseline" spacing={2}>
                    <Heading as="h3" size="xl" fontWeight="bold">
                      {formatSTX(potentialIncomeSTX)}
                    </Heading>
                    <Badge
                      bg="yellow.400"
                      color="black"
                      px={3} py={1}
                      borderRadius="full"
                      fontSize="xs"
                      alignSelf="center"
                    >
                      YOU EARN
                    </Badge>
                  </HStack>
                  <Text fontSize="sm" color="green.200" lineHeight="tight">
                    {formatCurrency(potentialIncomeUSD)} (~{formatPercentage(potentialYield)})
                  </Text>
                </VStack>

                <Flex
                  align="center"
                  justify="center"
                  py={2} px={3}
                  bg="rgba(0,0,0,0.1)"
                  borderRadius="lg"
                >
                  <Icon as={IoCashOutline} mr={2} />
                  <Text fontSize="xs" fontWeight="medium">
                     Based on {formatSTX(capitalCommittedSTX)} commitment
                  </Text>
                </Flex>

                <Divider borderColor="green.500" opacity={0.5} />

                <Box>
                  <Flex align="center" mb={2}>
                    <Icon as={IoWallet} mr={2} />
                    <Text fontSize="sm" fontWeight="bold" textTransform="uppercase">
                      Efficiency Metrics
                    </Text>
                  </Flex>

                  <SimpleGrid columns={2} spacing={4} fontSize="xs">
                    <Box textAlign="center">
                      <Text color="green.200" fontSize="2xs" textTransform="uppercase">Est. APY</Text>
                      <Text fontWeight="bold" fontSize="sm">{formatPercentage(potentialYield)}</Text>
                      <Text color="green.200">(Annualized)</Text>
                    </Box>
                     <Box textAlign="center">
                      <Text color="green.200" fontSize="2xs" textTransform="uppercase">Capital Efficiency</Text>
                      <Text fontWeight="bold" fontSize="sm">{formatPercentage(capitalEfficiency)}</Text>
                      <Tooltip label="Ratio of potential income to capital at risk (higher is better)">
                        <Text color="green.200" cursor="help">(What&apos;s this?)</Text>
                      </Tooltip>
                    </Box>
                  </SimpleGrid>
                </Box>
              </VStack>
            </Box>
          </GridItem>
        </Grid>
      </Box>

      {/* Action Buttons */}
       <Flex justify="space-between" align="center" gap={4} mt={8}>
         {/* Save Quote Button */}
          <Flex direction="column" align="start">
            <Button
              leftIcon={<Icon as={IoSaveOutline} />}
              onClick={handleSaveQuote}
              isLoading={isSaving}
              isDisabled={!providerQuoteData || isSaving || !!savedQuoteId}
              colorScheme="gray"
              variant="outline"
              size="sm"
            >
               {savedQuoteId ? "Quote Saved" : "Save Quote"}
             </Button>
             <Collapse in={!!saveError} animateOpacity>
               <Text fontSize="xs" color="red.500" mt={1}>{saveError}</Text>
             </Collapse>
              <Collapse in={!!savedQuoteId} animateOpacity>
               <Text fontSize="xs" color="green.600" mt={1}>Saved ID: {savedQuoteId?.substring(0, 8)}...</Text>
             </Collapse>
          </Flex>

         {/* Main Action Button */}
         <Button
           leftIcon={<Icon as={IoWallet} />}
           colorScheme="green"
           size="lg"
           onClick={handleCommitCapital}
           isDisabled={isLoading || !!error || !quoteData}
           minWidth="200px"
         >
           Commit Capital
         </Button>
       </Flex>
    </Box>
  );
} 