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
} from "@chakra-ui/react";
import { IoLockClosed, IoTrendingUp, IoTimeOutline } from "react-icons/io5";

export default function ProtectionCost() {
  // Mock data
  const premiumBTC = 0.00467;
  const premiumUSD = 440.54;
  const percentRate = 4.67;
  const apyEquivalent = 56.78;
  const protectionAmount = 23565.00;
  
  return (
    <Box
      bg="blue.600"
      color="white"
      borderRadius="lg"
      overflow="hidden"
    >
      <Box px={6} py={4}>
        <Flex align="center" gap={2} mb={1}>
          <Icon as={IoLockClosed} />
          <Heading as="h2" fontSize="xl" fontWeight="semibold">
            Protection Cost
          </Heading>
          <Badge ml="auto" colorScheme="blue" variant="solid" bg="blue.500" px={2}>
            Protection Premium
          </Badge>
        </Flex>
      </Box>
      
      <Box 
        p={6} 
        bg="blue.500" 
        position="relative"
        _before={{
          content: '""',
          position: "absolute",
          top: "-10px",
          right: "30%",
          borderLeft: "10px solid transparent",
          borderRight: "10px solid transparent",
          borderBottom: "10px solid",
          borderBottomColor: "blue.500",
        }}
      >
        <Flex 
          direction={{ base: "column", md: "row" }} 
          align="center" 
          justify="space-between"
          gap={4}
        >
          <Box textAlign="center">
            <Heading as="h3" fontSize={{ base: "4xl", md: "5xl" }} fontWeight="bold">
              {premiumBTC} BTC
            </Heading>
            <Badge bg="purple.500" color="white" px={3} py={1} borderRadius="full" mt={1}>
              YOU PAY
            </Badge>
            <Text mt={2} fontSize="xl">
              ${premiumUSD.toLocaleString()}
            </Text>
            <Text fontSize="sm" color="blue.200">
              {percentRate}%
            </Text>
          </Box>
          
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mt={{ base: 4, md: 0 }}>
            <Flex 
              direction="column" 
              p={4} 
              bg="blue.400" 
              borderRadius="lg"
              align="center"
              justify="center"
              height="100%"
            >
              <Flex align="center" mb={2}>
                <Icon as={IoTrendingUp} mr={2} />
                <Text fontSize="sm" fontWeight="semibold">Premium Rate</Text>
              </Flex>
              <Heading as="h4" fontSize="3xl" fontWeight="bold">
                {percentRate}%
              </Heading>
            </Flex>
            
            <Flex 
              direction="column" 
              p={4} 
              bg="blue.400" 
              borderRadius="lg"
              align="center"
              justify="center"
              height="100%"
            >
              <Flex align="center" mb={2}>
                <Icon as={IoTimeOutline} mr={2} />
                <Text fontSize="sm" fontWeight="semibold">APY Equivalent</Text>
              </Flex>
              <Heading as="h4" fontSize="3xl" fontWeight="bold">
                {apyEquivalent}%
              </Heading>
            </Flex>
          </SimpleGrid>
        </Flex>
        
        <Flex justify="center" mt={6}>
          <Box 
            px={4} 
            py={2} 
            bg="rgba(255, 255, 255, 0.1)" 
            color="white" 
            borderRadius="full"
          >
            <Text fontSize="sm" textAlign="center">
              Secures ${protectionAmount.toLocaleString()} of protection
            </Text>
          </Box>
        </Flex>
        
        <Box mt={8}>
          <Button 
            leftIcon={<IoLockClosed />}
            colorScheme="white" 
            variant="solid"
            size="lg"
            width="full"
            bg="white"
            color="blue.600"
            _hover={{ bg: "gray.100" }}
            fontWeight="bold"
            height="50px"
            fontSize="md"
          >
            Get Bitcoin Protection
          </Button>
        </Box>
      </Box>
    </Box>
  );
} 