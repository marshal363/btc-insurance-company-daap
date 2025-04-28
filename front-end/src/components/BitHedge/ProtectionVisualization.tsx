"use client";

import {
  Box,
  Flex,
  Text,
  Heading,
  Badge,
  Icon,
  SimpleGrid,
} from "@chakra-ui/react";
import { 
  IoStatsChart, 
  IoCaretDown, 
  IoCaretUp,
  IoInformationCircle,
} from "react-icons/io5";

export default function ProtectionVisualization() {
  // Mock data
  const triggerPrice = 94270.88;
  const maxRecovery = 23567.72;
  const breakEven = 89871.69;
  const btcAmount = 0.25;
  
  return (
    <Box>
      <Flex justify="space-between" align="center" mb={4}>
        <Flex align="center">
          <Icon as={IoStatsChart} color="blue.500" mr={2} />
          <Heading as="h2" fontSize="xl" fontWeight="bold">
            Protection Visualization
          </Heading>
        </Flex>
        
        <Badge 
          colorScheme="blue" 
          variant="outline"
          fontSize="sm"
          px={3}
          py={1}
          borderRadius="md"
        >
          BTC Price Scenarios
        </Badge>
      </Flex>
      
      {/* Graph Placeholder - In a real implementation, this would be a real chart */}
      <Box 
        height="200px" 
        bg="gray.50" 
        borderRadius="md" 
        position="relative" 
        mb={8}
      >
        {/* This is a simple placeholder for the graph, a real app would use a charting library */}
        <Box 
          position="absolute" 
          bottom="0" 
          left="0" 
          right="0" 
          height="80%" 
          bgGradient="linear(to-tr, green.100, blue.50)"
          opacity={0.8}
          borderTopLeftRadius="md"
          borderTopRightRadius="md"
        />
        
        <Box 
          position="absolute" 
          bottom="0" 
          left="20%" 
          width="60%" 
          height="70%" 
          bg="green.100"
          opacity={0.6}
          borderTopLeftRadius="md"
          borderTopRightRadius="md"
        />
        
        {/* Break-even Line */}
        <Box
          position="absolute"
          top="40%"
          left="0"
          right="0"
          borderTopWidth="2px"
          borderTopStyle="dashed"
          borderTopColor="blue.400"
          zIndex={2}
        >
          <Text
            position="absolute"
            top="-25px"
            right="0"
            fontSize="xs"
            fontWeight="medium"
            color="blue.500"
            bg="white"
            px={2}
            py={0.5}
            borderRadius="md"
            boxShadow="sm"
          >
            Break-even
          </Text>
        </Box>
        
        <Text 
          position="absolute" 
          top="15px" 
          left="10px" 
          fontSize="sm" 
          fontWeight="semibold" 
          color="gray.600"
        >
          Drag to zoom
        </Text>
      </Box>
      
      {/* Key Metrics */}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={8}>
        {/* Protection Trigger */}
        <Box 
          p={4} 
          borderRadius="md" 
          borderWidth="1px" 
          borderColor="gray.200"
          bg="blue.50"
        >
          <Flex align="center" mb={1}>
            <Icon as={IoCaretDown} color="blue.500" />
            <Text fontWeight="semibold" fontSize="sm" ml={1}>
              Protection Trigger
            </Text>
          </Flex>
          
          <Heading as="h3" fontSize="xl" fontWeight="bold" color="blue.700">
            ${triggerPrice.toLocaleString()}
          </Heading>
          
          <Text fontSize="xs" color="gray.500">
            100% of current price
          </Text>
        </Box>
        
        {/* Max Recovery */}
        <Box 
          p={4} 
          borderRadius="md" 
          borderWidth="1px" 
          borderColor="gray.200"
          bg="blue.50"
        >
          <Flex align="center" mb={1}>
            <Icon as={IoCaretDown} color="green.500" />
            <Text fontWeight="semibold" fontSize="sm" ml={1}>
              Max Recovery
            </Text>
          </Flex>
          
          <Heading as="h3" fontSize="xl" fontWeight="bold" color="blue.700">
            ${maxRecovery.toLocaleString()}
          </Heading>
          
          <Text fontSize="xs" color="gray.500">
            For {btcAmount} BTC @ ${triggerPrice.toLocaleString()}
          </Text>
        </Box>
        
        {/* Break-even */}
        <Box 
          p={4} 
          borderRadius="md" 
          borderWidth="1px" 
          borderColor="gray.200"
          bg="blue.50"
        >
          <Flex align="center" mb={1}>
            <Icon as={IoCaretUp} color="blue.500" />
            <Text fontWeight="semibold" fontSize="sm" ml={1}>
              Break-even
            </Text>
          </Flex>
          
          <Heading as="h3" fontSize="xl" fontWeight="bold" color="blue.700">
            ${breakEven.toLocaleString()}
          </Heading>
          
          <Text fontSize="xs" color="gray.500">
            95% of current price
          </Text>
        </Box>
      </SimpleGrid>
      
      {/* Explanation Boxes */}
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <Box p={4} borderRadius="md" bg="blue.50">
          <Flex gap={2}>
            <Icon as={IoInformationCircle} color="blue.500" mt={0.5} />
            <Box>
              <Text fontSize="sm" fontWeight="medium" color="blue.700" mb={1}>
                What happens if Bitcoin drops?
              </Text>
              <Text fontSize="sm" color="blue.600">
                If Bitcoin drops below your protection level, you&apos;ll be compensated for the difference, offsetting your losses.
              </Text>
            </Box>
          </Flex>
        </Box>
        
        <Box p={4} borderRadius="md" bg="blue.50">
          <Flex gap={2}>
            <Icon as={IoInformationCircle} color="blue.500" mt={0.5} />
            <Box>
              <Text fontSize="sm" fontWeight="medium" color="blue.700" mb={1}>
                What if it rises?
              </Text>
              <Text fontSize="sm" color="blue.600">
                If Bitcoin rises, you&apos;ll benefit from the upside while having paid a small premium for peace of mind.
              </Text>
            </Box>
          </Flex>
        </Box>
      </SimpleGrid>
    </Box>
  );
} 