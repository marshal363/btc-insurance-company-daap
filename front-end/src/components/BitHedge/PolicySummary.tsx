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
  useToast,
  Collapse,
} from "@chakra-ui/react";
import {
  IoLockClosed,
  IoCheckmarkCircle,
  IoInformationCircleOutline,
  IoShieldCheckmark,
  IoCashOutline,
  IoSaveOutline,
  IoWarningOutline,
  IoAlertCircleOutline,
} from "react-icons/io5";
import { useBuyerContext } from "@/contexts/BuyerContext";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";
import { ValidationError } from "@/components/common/ValidationError";
import CalculationLoader from "@/components/common/CalculationLoader";
import { useBuyerQuote } from "@/hooks/useBuyerQuote";
import type { BuyerPremiumQuoteResult } from "@/../../convex/types";

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

export default function BuyerPolicySummary() {
  const { accurateQuote: buyerQuoteResult } = useBuyerContext();
  const { isLoading: isBuyerLoading, error: buyerError } = useBuyerQuote();

  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isLoading = isBuyerLoading;
  const quoteData = buyerQuoteResult;
  const error = buyerError;

  const buyerQuoteData = quoteData as BuyerPremiumQuoteResult | null;

  const premiumUSD = buyerQuoteData?.premium;
  const premiumSTX = premiumUSD ? premiumUSD / 0.45 : undefined;
  const percentRate = buyerQuoteData?.premiumPercentage;
  const apyEquivalent = percentRate && buyerQuoteData?.inputs?.expirationDays
    ? percentRate * (365 / buyerQuoteData.inputs.expirationDays)
    : undefined;
  const protectionAmountBTC = buyerQuoteData?.inputs?.protectionAmount;
  const protectedValueUSD = buyerQuoteData?.inputs?.protectedValueUSD;
  const protectionPeriod = buyerQuoteData?.inputs?.expirationDays;
  const protectionPercentage = buyerQuoteData?.inputs?.protectedValuePercentage;
  const btcAmount = protectionAmountBTC;
  const breakEvenPrice = buyerQuoteData?.breakEvenPrice;
  const marketPriceAtQuote = buyerQuoteData?.marketDataSnapshot?.btcPrice;

  const currentDate = new Date();
  const expiryDate = protectionPeriod ? new Date(currentDate.getTime() + protectionPeriod * 24 * 60 * 60 * 1000) : undefined;

  const neumorphicBg = "#E8EAE9";
  const neumorphicShadowLight = "-10px -10px 20px rgba(255, 255, 255, 0.8)";
  const neumorphicShadowDark = "10px 10px 20px rgba(163, 177, 198, 0.6)";
  const neumorphicBoxShadow = `${neumorphicShadowLight}, ${neumorphicShadowDark}`;
  const neumorphicBorderRadius = "xl";

  const saveQuoteMutation = useMutation(api.quotes.saveQuote);

  const handleSaveQuote = async () => {
    if (!buyerQuoteData) {
      toast({
        title: "Cannot Save Quote",
        description: "No valid buyer quote data available to save.",
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
      const displayName = `BTC Protection ${protectionAmountBTC ?? 'N/A'} BTC / ${protectionPeriod ?? 'N/A'} Days`;

      const result = await saveQuoteMutation({
        quoteType: "buyer",
        asset: "BTC",
        calculationResult: buyerQuoteData,
        metadata: {
          displayName: displayName,
          notes: "",
          tags: ["protection", "btc", `period-${protectionPeriod ?? 'unknown'}`],
        },
      });

      setSavedQuoteId(result.id);
      toast({
        title: "Quote Saved",
        description: `Your protection quote (${displayName}) has been saved.`,
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

  const handleActivateProtection = () => {
    console.log("Activate Protection Clicked", { buyerQuoteData });
    toast({
      title: "Next Step: Blockchain",
      description: "Preparing data for blockchain transaction...",
      status: "info",
      duration: 3000,
      isClosable: true,
    });
  };

  if (isLoading) {
    return <CalculationLoader isLoading={true} text="Fetching latest quote..." />;
  }

  if (error && !quoteData) {
    return (
       <Box p={6} borderRadius={neumorphicBorderRadius} bg={neumorphicBg} boxShadow={neumorphicBoxShadow} textAlign="center">
         <Icon as={IoWarningOutline} w={10} h={10} color="orange.500" mb={3} />
         <Heading as="h3" size="md" color="orange.700" mb={2}>Calculation Error</Heading>
         <Text color="gray.600" mb={4}>Could not fetch the latest quote details.</Text>
         <ValidationError message={error} showAsAlert={true} />
       </Box>
     );
  }

  if (!quoteData && !isLoading && !error) {
     return (
       <Box p={6} borderRadius={neumorphicBorderRadius} bg={neumorphicBg} boxShadow={neumorphicBoxShadow} textAlign="center">
         <Icon as={IoInformationCircleOutline} w={10} h={10} color="blue.500" mb={3} />
         <Heading as="h3" size="md" color="blue.700" mb={2}>Enter Parameters</Heading>
         <Text color="gray.600">Adjust the parameters above to generate a protection quote.</Text>
       </Box>
     );
   }

  return (
    <Box>
      <Heading as="h2" fontSize="2xl" fontWeight="bold" mb={4} color="gray.800">
        Policy Review
      </Heading>
      <Text mb={6} color="gray.700">
        Review your protection policy details before confirmation.
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
          Protection Summary
        </Heading>
        
        <Grid templateColumns={{ base: "1fr", md: "3fr 2fr" }} gap={8}>
          <GridItem>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5} mb={6}>
              <Box p={4} bg="transparent" borderRadius={neumorphicBorderRadius} boxShadow="inner" borderWidth="1px" borderColor="rgba(0,0,0,0.05)">
                <Text color="gray.600" fontSize="sm" mb={1}>Protection Amount</Text>
                <Heading as="h4" size="md" fontWeight="semibold" color="gray.800">
                  {btcAmount ?? '--.--'} BTC
                </Heading>
                <Text fontSize="xs" color="gray.500" mt={1}>
                   {formatCurrency(marketPriceAtQuote ? (btcAmount ?? 0) * marketPriceAtQuote : undefined, '$--.--')} Estimated Value
                 </Text>
              </Box>
              <Box p={4} bg="transparent" borderRadius={neumorphicBorderRadius} boxShadow="inner" borderWidth="1px" borderColor="rgba(0,0,0,0.05)">
                <Text color="gray.600" fontSize="sm" mb={1}>Protected Value (Strike)</Text>
                <Heading as="h4" size="md" fontWeight="semibold" color="gray.800">
                  {formatCurrency(protectedValueUSD)}
                </Heading>
                 <Text fontSize="xs" color="gray.500" mt={1}>
                   ({protectionPercentage ?? '--'}% of market price at quote)
                 </Text>
              </Box>
              <Box p={4} bg="transparent" borderRadius={neumorphicBorderRadius} boxShadow="inner" borderWidth="1px" borderColor="rgba(0,0,0,0.05)">
                <Text color="gray.600" fontSize="sm" mb={1}>Protection Period</Text>
                <Heading as="h4" size="md" fontWeight="semibold" color="gray.800">
                  {protectionPeriod ?? '--'} days
                </Heading>
                 <Text fontSize="xs" color="gray.500" mt={1}>
                   Expires ~{expiryDate ? expiryDate.toLocaleDateString() : 'N/A'}
                 </Text>
              </Box>
              <Box p={4} bg="transparent" borderRadius={neumorphicBorderRadius} boxShadow="inner" borderWidth="1px" borderColor="rgba(0,0,0,0.05)">
                <Text color="gray.600" fontSize="sm" mb={1}>Est. Annualized Rate</Text>
                <Heading as="h4" size="md" fontWeight="semibold" color="gray.800">
                   {formatPercentage(apyEquivalent)}
                </Heading>
                 <Text fontSize="xs" color="gray.500" mt={1}>Based on premium</Text>
              </Box>
            </SimpleGrid>

            <List spacing={3} color="gray.700">
              <ListItem>
                <Flex>
                  <ListIcon as={IoCheckmarkCircle} color="green.500" mt={1} />
                   <Text fontSize="sm">Protection activates if BTC price drops below {formatCurrency(protectedValueUSD)}.</Text>
                </Flex>
              </ListItem>
               <ListItem>
                 <Flex>
                   <ListIcon as={IoInformationCircleOutline} color="blue.500" mt={1} />
                    <Text fontSize="sm">Break-even price: {formatCurrency(breakEvenPrice)} (strike price minus premium).</Text>
                 </Flex>
               </ListItem>
               <ListItem>
                 <Flex>
                   <ListIcon as={IoAlertCircleOutline} color="orange.500" mt={1} />
                   <Text fontSize="sm">This quote is valid for a limited time and based on market data from {buyerQuoteData?.marketDataSnapshot?.timestamp ? new Date(buyerQuoteData.marketDataSnapshot.timestamp).toLocaleTimeString() : 'N/A'}.</Text>
                 </Flex>
               </ListItem>
            </List>
          </GridItem>

          <GridItem>
            <Box
              bg="blue.600"
              bgGradient="linear(to-b, blue.600, blue.700)"
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
                borderColor="blue.500"
                px={4} 
                py={3}
                bg="rgba(0,0,0,0.1)"
              >
                <Flex align="center" gap={2}>
                  <Icon as={IoShieldCheckmark} />
                  <Heading as="h3" size="sm" fontWeight="semibold">
                    Protection Premium
                  </Heading>
                </Flex>
                <Badge colorScheme="whiteAlpha" variant="subtle" px={2} py={0.5} fontSize="xs">
                  Cost
                </Badge>
              </Flex>
              
              <VStack p={4} flex="1" spacing={4} align="stretch">
                <VStack spacing={1} align="center">
                  <HStack justify="center" align="baseline" spacing={2}>
                    <Heading as="h3" size="xl" fontWeight="bold">
                      {formatCurrency(premiumUSD)}
                    </Heading>
                     <Badge
                       bg="yellow.400"
                       color="black"
                       px={3} py={1}
                       borderRadius="full"
                       fontSize="xs"
                       alignSelf="center"
                     >
                       YOU PAY
                     </Badge>
                  </HStack>
                  <Text fontSize="sm" color="blue.200" lineHeight="tight">
                     (~{formatCurrency(premiumSTX, '---.-- STX')}) / {formatPercentage(percentRate)} rate
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
                    Protects {btcAmount ?? '--'} BTC for {protectionPeriod ?? '--'} days
                  </Text>
                </Flex>
                
                <Divider borderColor="blue.500" opacity={0.5} />
                
                <Box textAlign="center">
                   <Text fontSize="xs" color="blue.200">
                     Premium Breakdown (Example)
                   </Text>
                   <Text fontSize="sm" fontStyle="italic" mt={1}>
                      (Breakdown visualization coming soon)
                   </Text>
                 </Box>
              </VStack>
            </Box>
          </GridItem>
        </Grid>
      </Box>

      <Flex justify="space-between" align="center" gap={4} mt={8}>
         <Flex direction="column" align="start">
            <Button
              leftIcon={<Icon as={IoSaveOutline} />}
              onClick={handleSaveQuote}
              isLoading={isSaving}
              isDisabled={!buyerQuoteData || isSaving || !!savedQuoteId}
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

         <Button
           leftIcon={<Icon as={IoLockClosed} />}
           colorScheme="blue"
           size="lg"
           onClick={handleActivateProtection}
           isDisabled={isLoading || !!error || !quoteData}
           minWidth="200px"
         >
           Activate Protection
         </Button>
       </Flex>
    </Box>
  );
} 