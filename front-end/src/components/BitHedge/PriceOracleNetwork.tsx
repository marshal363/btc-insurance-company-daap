"use client";

import {
  Box,
  Flex,
  Text,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Circle,
  Progress,
  Icon,
  Badge,
} from "@chakra-ui/react";
import { IoInformationCircle } from "react-icons/io5";

export default function PriceOracleNetwork() {
  // Mock data
  const priceSources = [
    {
      id: 1,
      name: "CoinGecko",
      icon: "C",
      iconColor: "blue.100",
      price: 94176,
      updated: "2 minutes ago",
      confidence: 100,
    },
    {
      id: 2,
      name: "Coinbase",
      icon: "C",
      iconColor: "blue.100",
      price: 94246,
      updated: "2 minutes ago",
      confidence: 90,
    },
    {
      id: 3,
      name: "Binance US",
      icon: "B",
      iconColor: "yellow.100",
      price: 94235,
      updated: "1 minute ago",
      confidence: 95,
    },
    {
      id: 4,
      name: "Kraken",
      icon: "K",
      iconColor: "purple.100",
      price: 94250,
      updated: "3 minutes ago",
      confidence: 88,
    },
    {
      id: 5,
      name: "Gemini",
      icon: "G",
      iconColor: "teal.100",
      price: 94220,
      updated: "5 minutes ago",
      confidence: 85,
    },
  ];
  
  const connectedSources = priceSources.length;
  
  return (
    <Box mt={4} bg="white" p={4} borderRadius="lg" boxShadow="sm">
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center" mb={4}>
        <Flex alignItems="center" gap={3}>
          <Circle size="40px" bg="blue.100">
            <Icon as={IoInformationCircle} color="blue.500" boxSize={5} />
          </Circle>
          <Heading as="h2" fontSize="xl" fontWeight="bold">
            Price Oracle Network
          </Heading>
        </Flex>
        
        <Badge colorScheme="green" px={2} py={1} borderRadius="full">
          <Flex alignItems="center">
            <Box w={2} h={2} borderRadius="full" bg="green.400" mr={1} />
            <Text>{connectedSources} Connected Sources</Text>
          </Flex>
        </Badge>
      </Flex>
      
      {/* Table */}
      <Table variant="simple" size="md">
        <Thead>
          <Tr>
            <Th color="gray.500" fontWeight="medium">SOURCE</Th>
            <Th color="gray.500" fontWeight="medium">PRICE</Th>
            <Th color="gray.500" fontWeight="medium">UPDATED</Th>
            <Th color="gray.500" fontWeight="medium">CONFIDENCE</Th>
          </Tr>
        </Thead>
        <Tbody>
          {priceSources.map((source) => (
            <Tr key={source.id}>
              <Td>
                <Flex alignItems="center" gap={3}>
                  <Circle size="30px" bg={source.iconColor}>
                    <Text color="blue.500" fontWeight="bold">{source.icon}</Text>
                  </Circle>
                  <Text fontWeight="medium">{source.name}</Text>
                </Flex>
              </Td>
              <Td fontWeight="semibold">${source.price.toLocaleString()}</Td>
              <Td color="gray.500">{source.updated}</Td>
              <Td>
                <Flex alignItems="center" gap={3}>
                  <Box flex="1" maxW="140px">
                    <Progress 
                      value={source.confidence} 
                      size="sm" 
                      borderRadius="full"
                      colorScheme={source.confidence >= 90 ? "green" : "orange"}
                    />
                  </Box>
                  <Text>{source.confidence}%</Text>
                </Flex>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      
      {/* Info Footer */}
      <Box mt={4} p={3} bg="blue.50" borderRadius="md">
        <Flex alignItems="center" gap={2}>
          <Icon as={IoInformationCircle} color="blue.500" />
          <Text fontSize="sm" color="gray.600">
            Pricing is calculated as a weighted average from trusted exchanges, weighted by confidence scores.
          </Text>
        </Flex>
      </Box>
    </Box>
  );
} 