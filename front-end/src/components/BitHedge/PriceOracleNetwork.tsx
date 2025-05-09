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
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

// Define the type for an individual source data entry
interface SourceDataEntry {
  _id: string; // Assuming there's an ID from Convex
  name: string;
  price: number;
  timestamp: number;
  weight: number;
  // Add any other fields that might be present
}

// Define the type for aggregated data if not already globally defined
interface AggregatedPriceInfo {
  sourceCount?: number;
  // Add other fields from aggregatedData if used beyond sourceCount
}

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

export default function PriceOracleNetwork() {
  const latestSourceData = useQuery<SourceDataEntry[] | null>(api.prices.getLatestSourcePrices);
  const aggregatedData = useQuery<AggregatedPriceInfo | null>(api.prices.getLatestPrice);
  
  const sources: SourceDataEntry[] = latestSourceData ?? [];
  const connectedSourcesCount = aggregatedData?.sourceCount ?? 0;
  const isLoadingSources = latestSourceData === undefined;
  const isLoadingAggregated = aggregatedData === undefined;
  
  const getConfidence = (weight: number): number => {
    return Math.min(Math.round(weight * 500), 100);
  };

  return (
    <Box mt={4} bg="white" p={4} borderRadius="lg" boxShadow="sm">
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
            <Box w={2} h={2} borderRadius="full" bg={connectedSourcesCount > 0 ? "green.400" : "gray.400"} mr={1} />
            <Text>{isLoadingAggregated ? '...' : `${connectedSourcesCount} Sources Active`}</Text>
          </Flex>
        </Badge>
      </Flex>
      
      <Table variant="simple" size="md">
        <Thead>
          <Tr>
            <Th color="gray.500" fontWeight="medium">SOURCE</Th>
            <Th color="gray.500" fontWeight="medium" isNumeric>PRICE</Th>
            <Th color="gray.500" fontWeight="medium">UPDATED</Th>
            <Th color="gray.500" fontWeight="medium">CONFIDENCE (WEIGHT)</Th>
          </Tr>
        </Thead>
        <Tbody>
          {isLoadingSources ? (
            <Tr><Td colSpan={4} textAlign="center">Loading sources...</Td></Tr>
          ) : sources.length === 0 ? (
             <Tr><Td colSpan={4} textAlign="center">No source data available.</Td></Tr>
          ) : (
            sources.map((source: SourceDataEntry) => (
              <Tr key={source._id}>
                <Td>
                  <Flex alignItems="center" gap={3}>
                    <Circle size="30px" bg="gray.100">
                      <Text color="gray.600" fontWeight="bold">{source.name.charAt(0).toUpperCase()}</Text>
                    </Circle>
                    <Text fontWeight="medium">{source.name}</Text>
                  </Flex>
                </Td>
                <Td fontWeight="semibold" isNumeric>
                  ${source.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Td>
                <Td color="gray.500">
                  {formatRelativeTime(source.timestamp)}
                </Td>
                <Td>
                  <Flex alignItems="center" gap={3}>
                    <Box flex="1" maxW="140px">
                      <Progress 
                        value={getConfidence(source.weight)} 
                        size="sm" 
                        borderRadius="full"
                        colorScheme={getConfidence(source.weight) >= 90 ? "green" : "orange"}
                      />
                    </Box>
                    <Text>{getConfidence(source.weight)}% ({(source.weight * 100).toFixed(1)}%)</Text>
                  </Flex>
                </Td>
              </Tr>
            ))
          )}
        </Tbody>
      </Table>
      
      <Box mt={4} p={3} bg="blue.50" borderRadius="md">
        <Flex alignItems="center" gap={2}>
          <Icon as={IoInformationCircle} color="blue.500" />
          <Text fontSize="sm" color="gray.600">
            Pricing is calculated as a weighted average from trusted exchanges, weighted by confidence scores.
            {connectedSourcesCount > 0 && ` Currently ${connectedSourcesCount} out of ${sources.length} sources are active and contributing to the price calculation.`}
          </Text>
        </Flex>
      </Box>
    </Box>
  );
} 