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
  Spinner,
  Tooltip,
} from "@chakra-ui/react";
import { 
  IoLockClosed, 
  IoCheckmarkCircle, 
  IoInformationCircleOutline,
  IoShieldCheckmark,
  IoWallet,
  IoTrendingUpOutline,
  IoCashOutline,
} from "react-icons/io5";
import { usePremiumData } from '@/contexts/PremiumDataContext';

const formatCurrency = (value: number | null | undefined, placeholder: string = '$--.--') => {
  if (value === null || value === undefined) {
    return placeholder;
  }
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function PolicySummary() {
  const {
    currentUserRole,
  } = usePremiumData();
  const isProvider = currentUserRole === 'provider';

  const premiumSTX = 942.75;
  const premiumUSD = 440.54;
  const percentRate = 4.67;
  const apyEquivalent = 56.78;
  const protectionAmount = 23565.00;
  const protectedValue = 94270.88;
  const protectionPeriod = 30;
  const protectionPercentage = 100;
  const btcAmount = 0.25;
  const currentDate = new Date();
  const expiryDate = new Date(currentDate.setDate(currentDate.getDate() + protectionPeriod));

  const mockProviderPotentialYield = 0.085;
  const mockProviderPotentialIncomeSTX = 250.75;
  const mockProviderPotentialIncomeUSD = 115.35;
  const mockProviderCapitalCommittedSTX = 3000;
  const mockProviderCapitalCommittedUSD = 1380;
  const mockProviderRiskTier = 'Balanced';
  const mockProviderPeriod = 60;
  const mockProviderCapitalEfficiency = 1.15;
  const mockProviderStrikePrice = 90000;
  const mockProviderBreakEven = 89500;

  const neumorphicBg = "#E8EAE9"; 
  const neumorphicShadowLight = "-10px -10px 20px rgba(255, 255, 255, 0.8)"; 
  const neumorphicShadowDark = "10px 10px 20px rgba(163, 177, 198, 0.6)";
  const neumorphicBoxShadow = `${neumorphicShadowLight}, ${neumorphicShadowDark}`;
  const neumorphicBorderRadius = "xl"; 

  const handleActivateProtection = () => {
    console.log("Activate Protection Clicked", { premiumSTX, premiumUSD });
  };

  const handleCommitCapital = () => {
    console.log("Commit Capital Clicked", { mockProviderCapitalCommittedSTX });
  };

  const isLoading = false;

  if (isLoading) {
    return (
      <Box p={6} borderRadius={neumorphicBorderRadius} bg={neumorphicBg} boxShadow={neumorphicBoxShadow} textAlign="center">
        <Spinner size="xl" color="blue.500" />
        <Text mt={4} color="gray.600">Calculating...</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Heading as="h2" fontSize="2xl" fontWeight="bold" mb={4} color="gray.800">
        {isProvider ? 'Income Strategy Review' : 'Policy Review'}
      </Heading>
      <Text mb={6} color="gray.700">
        {isProvider
          ? 'Review your income strategy details before committing capital.'
          : 'Review your protection policy details before confirmation.'}
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
          {isProvider ? 'Strategy Summary' : 'Protection Summary'}
        </Heading>
        
        {isProvider ? (
          <Grid templateColumns={{ base: "1fr", md: "3fr 2fr" }} gap={8}>
            <GridItem>
              <SimpleGrid columns={{ base: 2, md: 2 }} spacing={5} mb={6}>
                 <Box p={4} bg="transparent" borderRadius={neumorphicBorderRadius} boxShadow="inner" borderWidth="1px" borderColor="rgba(0,0,0,0.05)">
                    <Text color="gray.600" fontSize="sm" mb={1}>Risk Tier</Text>
                    <Heading as="h4" size="md" fontWeight="semibold" color="gray.800">{mockProviderRiskTier}</Heading>
                    <Text fontSize="xs" color="gray.500" mt={1}>Selected Strategy</Text>
                  </Box>
                  <Box p={4} bg="transparent" borderRadius={neumorphicBorderRadius} boxShadow="inner" borderWidth="1px" borderColor="rgba(0,0,0,0.05)">
                    <Text color="gray.600" fontSize="sm" mb={1}>Income Period</Text>
                    <Heading as="h4" size="md" fontWeight="semibold" color="gray.800">{mockProviderPeriod} days</Heading>
                    <Text fontSize="xs" color="gray.500" mt={1}>Strategy Duration</Text>
                  </Box>
                  <Box p={4} bg="transparent" borderRadius={neumorphicBorderRadius} boxShadow="inner" borderWidth="1px" borderColor="rgba(0,0,0,0.05)">
                    <Text color="gray.600" fontSize="sm" mb={1}>Capital Committed</Text>
                    <Heading as="h4" size="md" fontWeight="semibold" color="gray.800">{mockProviderCapitalCommittedSTX} STX</Heading>
                    <Text fontSize="xs" color="gray.500" mt={1}>{formatCurrency(mockProviderCapitalCommittedUSD)}</Text>
                  </Box>
                  <Box p={4} bg="transparent" borderRadius={neumorphicBorderRadius} boxShadow="inner" borderWidth="1px" borderColor="rgba(0,0,0,0.05)">
                    <Text color="gray.600" fontSize="sm" mb={1}>Strike Provided</Text>
                    <Heading as="h4" size="md" fontWeight="semibold" color="gray.800">{formatCurrency(mockProviderStrikePrice)}</Heading>
                    <Text fontSize="xs" color="gray.500" mt={1}>Price for Payout</Text>
                  </Box>
              </SimpleGrid>
              <List spacing={3} color="gray.700">
                  <ListItem>
                    <Flex>
                      <ListIcon as={IoInformationCircleOutline} color="green.500" mt={1} />
                      <Text fontSize="sm">Income generated if BTC stays above {formatCurrency(mockProviderStrikePrice)}.</Text>
                    </Flex>
                  </ListItem>
                  <ListItem>
                    <Flex>
                      <ListIcon as={IoInformationCircleOutline} color="green.500" mt={1} />
                      <Text fontSize="sm">Potential to acquire BTC if price falls below {formatCurrency(mockProviderBreakEven)} (break-even).</Text>
                    </Flex>
                  </ListItem>
                </List>
            </GridItem>

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
                        {mockProviderPotentialIncomeSTX} STX 
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
                      {formatCurrency(mockProviderPotentialIncomeUSD)} (~{(mockProviderPotentialYield * 100).toFixed(1)}% APY)
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
                       Based on {mockProviderCapitalCommittedSTX} STX commitment
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
                        <Text fontWeight="bold" fontSize="sm">{(mockProviderPotentialYield * 100).toFixed(1)}%</Text>
                        <Text color="green.200">(Annualized)</Text>
                      </Box>
                       <Box textAlign="center">
                        <Text color="green.200" fontSize="2xs" textTransform="uppercase">Capital Efficiency</Text>
                        <Text fontWeight="bold" fontSize="sm">{(mockProviderCapitalEfficiency * 100).toFixed(0)}%</Text> 
                        <Tooltip label="Ratio of potential income to capital at risk">
                          <Text color="green.200" cursor="help">(What's this?)</Text>
                        </Tooltip>
                      </Box>
                    </SimpleGrid>
                  </Box>
                </VStack>

                <Button 
                  variant="solid"
                  size="lg"
                  bg="white" 
                  color="green.700" 
                  _hover={{ bg: "gray.100" }}
                  _active={{ bg: "gray.200" }}
                  width="full"
                  mt="auto"
                  onClick={handleCommitCapital}
                >
                  Commit Capital
                </Button>
              </Box>
            </GridItem>
          </Grid>
        ) : (
          <Grid templateColumns={{ base: "1fr", md: "3fr 2fr" }} gap={8}>
            <GridItem>
              <SimpleGrid columns={{ base: 2, md: 2 }} spacing={5} mb={6}>
                <Box 
                  p={4} 
                  bg="transparent"
                  borderRadius={neumorphicBorderRadius}
                  boxShadow="inner"
                  borderWidth="1px"
                  borderColor="rgba(0,0,0,0.05)"
                >
                  <Text color="gray.600" fontSize="sm" mb={1}>Protected Value</Text>
                  <Flex align="center">
                    <Heading as="h4" size="md" fontWeight="semibold" color="gray.800">{formatCurrency(protectedValue)}</Heading>
                    <Badge ml={2} colorScheme="blue" variant="outline">{protectionPercentage}%</Badge>
                  </Flex>
                  <Text fontSize="xs" color="gray.500" mt={1}>Strike Price</Text>
                </Box>
                
                <Box 
                  p={4} 
                  bg="transparent" 
                  borderRadius={neumorphicBorderRadius}
                  boxShadow="inner" 
                  borderWidth="1px"
                  borderColor="rgba(0,0,0,0.05)" 
                >
                  <Text color="gray.600" fontSize="sm" mb={1}>Protection Amount</Text>
                  <Heading as="h4" size="md" fontWeight="semibold" color="gray.800">{btcAmount} BTC</Heading>
                  <Text fontSize="xs" color="gray.500" mt={1}>{formatCurrency(protectionAmount)}</Text>
                </Box>
                
                <Box 
                  p={4} 
                  bg="transparent" 
                  borderRadius={neumorphicBorderRadius}
                  boxShadow="inner" 
                  borderWidth="1px"
                  borderColor="rgba(0,0,0,0.05)" 
                >
                  <Text color="gray.600" fontSize="sm" mb={1}>Protection Period</Text>
                  <Heading as="h4" size="md" fontWeight="semibold" color="gray.800">{protectionPeriod} days</Heading>
                  <Text fontSize="xs" color="gray.500" mt={1}>Short Term</Text>
                </Box>
                
                <Box 
                  p={4} 
                  bg="transparent" 
                  borderRadius={neumorphicBorderRadius}
                  boxShadow="inner" 
                  borderWidth="1px"
                  borderColor="rgba(0,0,0,0.05)" 
                >
                  <Text color="gray.600" fontSize="sm" mb={1}>Premium Rate</Text>
                  <Heading as="h4" size="md" fontWeight="semibold" color="gray.800">{percentRate}%</Heading>
                  <Text fontSize="xs" color="gray.500" mt={1}>APY: {apyEquivalent}%</Text>
                </Box>
              </SimpleGrid>
              
              <List spacing={3} color="gray.700">
                <ListItem>
                  <Flex>
                    <ListIcon as={IoCheckmarkCircle} color="blue.500" mt={1} />
                    <Text fontSize="sm">Protection activates if BTC price falls below {formatCurrency(protectedValue)}</Text>
                  </Flex>
                </ListItem>
                <ListItem>
                  <Flex>
                    <ListIcon as={IoCheckmarkCircle} color="blue.500" mt={1} />
                    <Text fontSize="sm">Maximum recovery of {formatCurrency(protectionAmount)} for {btcAmount} BTC</Text>
                  </Flex>
                </ListItem>
                <ListItem>
                  <Flex>
                    <ListIcon as={IoCheckmarkCircle} color="blue.500" mt={1} />
                    <Text fontSize="sm">Policy expires in {protectionPeriod} days ({expiryDate.toLocaleDateString()})</Text>
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
                    <Icon as={IoLockClosed} />
                    <Heading as="h3" size="sm" fontWeight="semibold">
                      Protection Cost
                    </Heading>
                  </Flex>
                  <Badge colorScheme="whiteAlpha" variant="subtle" px={2} py={0.5} fontSize="xs">
                    Premium
                  </Badge>
                </Flex>
                
                <VStack p={4} flex="1" spacing={4} align="stretch">
                  <VStack spacing={1} align="center">
                    <HStack justify="center" align="baseline" spacing={2}>
                      <Heading as="h3" size="xl" fontWeight="bold">
                        {premiumSTX} STX
                      </Heading>
                      <Badge 
                        bg="purple.500" 
                        color="white" 
                        px={3} py={1} 
                        borderRadius="full" 
                        fontSize="xs"
                        alignSelf="center"
                      >
                        YOU PAY
                      </Badge>
                    </HStack>
                    <Text fontSize="sm" color="blue.200" lineHeight="tight">
                      {formatCurrency(premiumUSD)} ({percentRate}% of protected value)
                    </Text>
                  </VStack>
                  
                  <Flex 
                    align="center" 
                    justify="center" 
                    py={2} px={3} 
                    bg="rgba(0,0,0,0.1)" 
                    borderRadius="lg"
                  >
                    <Icon as={IoShieldCheckmark} mr={2} />
                    <Text fontSize="xs" fontWeight="medium">
                      Secures {formatCurrency(protectionAmount)} of protection
                    </Text>
                  </Flex>
                  
                  <Divider borderColor="blue.500" opacity={0.5} />
                  
                  <Box>
                    <Flex align="center" mb={2}>
                      <Icon as={IoWallet} mr={2} />
                      <Text fontSize="sm" fontWeight="bold" textTransform="uppercase">
                        Fee Breakdown
                      </Text>
                    </Flex>
                    
                    <SimpleGrid columns={3} spacing={4} fontSize="xs">
                      <Box textAlign="center">
                        <Text color="blue.200" fontSize="2xs" textTransform="uppercase">Provider</Text>
                        <Text fontWeight="bold" fontSize="sm">{(premiumSTX * 0.85).toFixed(2)} STX</Text>
                        <Text color="blue.200">(85%)</Text>
                      </Box>
                      <Box textAlign="center">
                        <Text color="blue.200" fontSize="2xs" textTransform="uppercase">Protocol</Text>
                        <Text fontWeight="bold" fontSize="sm">{(premiumSTX * 0.10).toFixed(2)} STX</Text>
                        <Text color="blue.200">(10%)</Text>
                      </Box>
                      <Box textAlign="center">
                        <Text color="blue.200" fontSize="2xs" textTransform="uppercase">Network</Text>
                        <Text fontWeight="bold" fontSize="sm">{(premiumSTX * 0.05).toFixed(2)} STX</Text>
                        <Text color="blue.200">(5%)</Text>
                      </Box>
                    </SimpleGrid>
                  </Box>
                </VStack>
                
                <Button 
                  variant="solid"
                  size="lg"
                  bg="white" 
                  color="blue.700" 
                  _hover={{ bg: "gray.100" }}
                  _active={{ bg: "gray.200" }}
                  width="full"
                  mt="auto"
                  onClick={handleActivateProtection}
                >
                  Get Bitcoin Protection
                </Button>
              </Box>
            </GridItem>
          </Grid>
        )}
      </Box>
    </Box>
  );
} 