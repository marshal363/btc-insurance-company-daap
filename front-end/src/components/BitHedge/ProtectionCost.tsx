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
} from "@chakra-ui/react";
import { 
  IoLockClosed, 
  IoCheckmarkCircle, 
  IoInformationCircleOutline,
  IoShieldCheckmark,
  IoWallet
} from "react-icons/io5";

export default function ProtectionCost() {
  // Mock data
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
  
  return (
    <Box>
      <Heading as="h2" fontSize="2xl" fontWeight="bold" mb={4}>
        Policy Review
      </Heading>
      <Text mb={6} color="gray.600">
        Review your protection policy details before confirmation.
      </Text>
      
      {/* Policy Summary Card */}
      <Box 
        borderWidth="1px" 
        borderColor="gray.200" 
        borderRadius="lg" 
        overflow="hidden"
        mb={6}
      >
        <Box bg="gray.50" px={6} py={4} borderBottomWidth="1px" borderColor="gray.200">
          <Heading as="h3" fontSize="lg" fontWeight="bold">
            Protection Summary
          </Heading>
        </Box>
        
        <Box p={6}>
          {/* Main content grid with 2 columns - Summary on left, Cost on right */}
          <Grid templateColumns={{ base: "1fr", md: "3fr 2fr" }} gap={6}>
            {/* Left column - Protection parameters and checklist */}
            <GridItem>
              {/* Info Blocks in a Grid */}
              <SimpleGrid columns={{ base: 2, md: 2 }} spacing={4} mb={6}>
                <Box p={4} bg="gray.50" borderRadius="md">
                  <Text color="gray.500" fontSize="sm" mb={1}>Protected Value</Text>
                  <Flex align="center">
                    <Heading as="h4" size="md" fontWeight="semibold">${protectedValue.toLocaleString()}</Heading>
                    <Badge ml={2} colorScheme="blue">{protectionPercentage}%</Badge>
                  </Flex>
                  <Text fontSize="xs" color="gray.400" mt={1}>Strike Price</Text>
                </Box>
                
                <Box p={4} bg="gray.50" borderRadius="md">
                  <Text color="gray.500" fontSize="sm" mb={1}>Protection Amount</Text>
                  <Heading as="h4" size="md" fontWeight="semibold">{btcAmount} BTC</Heading>
                  <Text fontSize="xs" color="gray.400" mt={1}>${protectionAmount.toLocaleString()}</Text>
                </Box>
                
                <Box p={4} bg="gray.50" borderRadius="md">
                  <Text color="gray.500" fontSize="sm" mb={1}>Protection Period</Text>
                  <Heading as="h4" size="md" fontWeight="semibold">{protectionPeriod} days</Heading>
                  <Text fontSize="xs" color="gray.400" mt={1}>Short Term</Text>
                </Box>
                
                <Box p={4} bg="gray.50" borderRadius="md">
                  <Text color="gray.500" fontSize="sm" mb={1}>Premium Rate</Text>
                  <Heading as="h4" size="md" fontWeight="semibold">{percentRate}%</Heading>
                  <Text fontSize="xs" color="gray.400" mt={1}>APY: {apyEquivalent}%</Text>
                </Box>
              </SimpleGrid>
              
              <List spacing={3}>
                <ListItem>
                  <Flex>
                    <ListIcon as={IoCheckmarkCircle} color="blue.500" mt={1} />
                    <Text fontSize="sm">Protection activates if BTC price falls below ${protectedValue.toLocaleString()}</Text>
                  </Flex>
                </ListItem>
                <ListItem>
                  <Flex>
                    <ListIcon as={IoCheckmarkCircle} color="blue.500" mt={1} />
                    <Text fontSize="sm">Maximum recovery of ${protectionAmount.toLocaleString()} for {btcAmount} BTC</Text>
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
            
            {/* Right column - Protection Cost */}
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
                {/* Card Header */}
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
                    Protection Premium
                  </Badge>
                </Flex>
                
                {/* Card Body */}
                <VStack p={4} flex="1" spacing={4} align="stretch">
                  {/* Price Stack */}
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
                      ${premiumUSD.toLocaleString()} ({percentRate}% of protected value)
                    </Text>
                  </VStack>
                  
                  {/* Secures Info */}
                  <Flex 
                    align="center" 
                    justify="center" 
                    py={2} px={3} 
                    bg="rgba(0,0,0,0.1)" 
                    borderRadius="md"
                  >
                    <Icon as={IoShieldCheckmark} mr={2} />
                    <Text fontSize="xs" fontWeight="medium">
                      Secures ${protectionAmount.toLocaleString()} of protection
                    </Text>
                  </Flex>
                  
                  <Divider borderColor="blue.500" opacity={0.5} />
                  
                  {/* Fee Breakdown */}
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
                        <Text fontWeight="bold" fontSize="sm">{(premiumSTX * 0.12).toFixed(2)} STX</Text>
                        <Text color="blue.200">(12%)</Text>
                      </Box>
                      
                      <Box textAlign="center">
                        <Text color="blue.200" fontSize="2xs" textTransform="uppercase">Network</Text>
                        <Text fontWeight="bold" fontSize="sm">{(premiumSTX * 0.03).toFixed(2)} STX</Text>
                        <Text color="blue.200">(3%)</Text>
                      </Box>
                    </SimpleGrid>
                  </Box>
                </VStack>
              </Box>
            </GridItem>
          </Grid>
          
          {/* CTA Button - Full width */}
          <Box mt={6}>
            <Button 
              leftIcon={<IoLockClosed />}
              bgGradient="linear(to-r, blue.600, blue.700)"
              color="white"
              _hover={{
                bgGradient: "linear(to-r, blue.700, blue.800)",
                shadow: "md"
              }}
              _active={{
                bgGradient: "linear(to-r, blue.800, blue.900)",
              }}
              variant="solid"
              size="lg"
              width="full"
              fontWeight="bold"
              height="56px"
              fontSize="lg"
              shadow="base"
            >
              Get Bitcoin Protection
            </Button>
            <HStack justify="center" mt={2} spacing={1} fontSize="xs" color="gray.500">
              <Icon as={IoInformationCircleOutline} />
              <Text>Payments processed in STX on Stacks blockchain</Text>
            </HStack>
          </Box>
        </Box>
      </Box>
    </Box>
  );
} 