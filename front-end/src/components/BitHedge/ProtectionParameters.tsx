"use client";

import { useState } from "react";
import {
  Box,
  Flex,
  Text,
  Heading,
  HStack,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Button,
  NumberInput,
  NumberInputField,
  Icon,
  Tooltip,
} from "@chakra-ui/react";
import { IoInformationCircle } from "react-icons/io5";

export default function ProtectionParameters() {
  // Mock data and state
  const [protectedValue, setProtectedValue] = useState(100);
  const [protectionAmount, setProtectionAmount] = useState(0.25);
  
  const currentPrice = 94270.88;
  const protectedValueUSD = (currentPrice * protectedValue) / 100;
  const protectionAmountUSD = protectionAmount * currentPrice;
  
  return (
    <Box>
      <Heading as="h2" fontSize="2xl" fontWeight="bold" mb={4}>
        Protection Parameters
      </Heading>
      <Text mb={6} color="gray.600">
        Customize your Bitcoin protection parameters to fit your needs.
      </Text>
      
      <Box borderWidth="1px" borderColor="gray.200" p={6} borderRadius="lg">
        <Flex 
          direction={{ base: "column", md: "row" }} 
          gap={{ base: 6, md: 8 }}
        >
          {/* Protected Value Section */}
          <Box flex="1">
            <Flex align="center" mb={2}>
              <Heading as="h3" fontSize="lg" fontWeight="bold" mr={1}>
                Protected Value
              </Heading>
              <Tooltip hasArrow label="The percentage of your Bitcoin's current value that will be protected">
                <Box display="inline">
                  <Icon as={IoInformationCircle} color="blue.500" />
                </Box>
              </Tooltip>
            </Flex>
            
            <Heading as="h4" fontSize="2xl" fontWeight="semibold" mb={1}>
              ${protectedValueUSD.toFixed(2)}
            </Heading>
            <Text fontSize="sm" color="gray.500" mb={4}>
              {protectedValue}% of current price
            </Text>
            
            <Slider 
              value={protectedValue}
              onChange={setProtectedValue}
              min={50}
              max={150}
              step={1}
              mb={4}
              colorScheme="blue"
            >
              <SliderTrack bg="blue.100">
                <SliderFilledTrack />
              </SliderTrack>
              <SliderThumb boxSize={6} bg="white" borderWidth="2px" borderColor="blue.500" />
            </Slider>
            
            <Flex justify="space-between" color="gray.600">
              <Text>50%</Text>
              <Text>100%</Text>
              <Text>150%</Text>
            </Flex>
            
            <HStack spacing={2} mt={4}>
              <Button 
                variant={protectedValue === 80 ? "solid" : "outline"} 
                colorScheme="blue" 
                size="sm" 
                onClick={() => setProtectedValue(80)}
                flex="1"
              >
                80%
              </Button>
              <Button 
                variant={protectedValue === 90 ? "solid" : "outline"} 
                colorScheme="blue" 
                size="sm" 
                onClick={() => setProtectedValue(90)}
                flex="1"
              >
                90%
              </Button>
              <Button 
                variant={protectedValue === 100 ? "solid" : "outline"}
                colorScheme="blue" 
                size="sm" 
                onClick={() => setProtectedValue(100)}
                flex="1"
              >
                100%
              </Button>
              <Button 
                variant={protectedValue === 110 ? "solid" : "outline"} 
                colorScheme="blue" 
                size="sm" 
                onClick={() => setProtectedValue(110)}
                flex="1"
              >
                110%
              </Button>
            </HStack>
            
            <Box mt={4} p={3} bg="blue.50" borderRadius="md">
              <Flex gap={2}>
                <Icon as={IoInformationCircle} color="blue.500" mt={0.5} />
                <Text fontSize="sm" color="blue.700">
                  Lower strike prices reduce premium costs but provide less protection.
                </Text>
              </Flex>
            </Box>
          </Box>
          
          {/* Protection Amount Section */}
          <Box flex="1">
            <Flex align="center" mb={2}>
              <Heading as="h3" fontSize="lg" fontWeight="bold" mr={1}>
                Protection Amount
              </Heading>
              <Tooltip hasArrow label="The amount of Bitcoin you want to protect">
                <Box display="inline">
                  <Icon as={IoInformationCircle} color="blue.500" />
                </Box>
              </Tooltip>
            </Flex>
            
            <Heading as="h4" fontSize="2xl" fontWeight="semibold" mb={1}>
              ${protectionAmountUSD.toLocaleString()}
            </Heading>
            <Text fontSize="sm" color="gray.500" mb={4}>
              USD Value
            </Text>
            
            <Flex align="center" mb={4}>
              <Icon boxSize={5} color="orange.500" fontWeight="bold">₿</Icon>
              <NumberInput
                value={protectionAmount}
                onChange={(_, val) => setProtectionAmount(val)}
                min={0.1}
                max={5}
                step={0.01}
                ml={2}
                w="120px"
              >
                <NumberInputField />
              </NumberInput>
              <Text ml={2} fontWeight="medium">BTC</Text>
            </Flex>
            
            <HStack spacing={2} mt={4}>
              <Button 
                variant={protectionAmount === 0.25 ? "solid" : "outline"} 
                colorScheme="blue" 
                size="sm" 
                onClick={() => setProtectionAmount(0.25)}
                flex="1"
              >
                0.25 BTC
              </Button>
              <Button 
                variant={protectionAmount === 0.50 ? "solid" : "outline"} 
                colorScheme="blue" 
                size="sm" 
                onClick={() => setProtectionAmount(0.50)}
                flex="1"
              >
                0.50 BTC
              </Button>
              <Button 
                variant={protectionAmount === 0.75 ? "solid" : "outline"} 
                colorScheme="blue" 
                size="sm" 
                onClick={() => setProtectionAmount(0.75)}
                flex="1"
              >
                0.75 BTC
              </Button>
              <Button 
                variant={protectionAmount === 1.0 ? "solid" : "outline"} 
                colorScheme="blue" 
                size="sm" 
                onClick={() => setProtectionAmount(1.0)}
                flex="1"
              >
                1.00 BTC
              </Button>
            </HStack>
            
            <Box mt={4} p={3} bg="blue.50" borderRadius="md">
              <Flex gap={2}>
                <Icon as={IoInformationCircle} color="blue.500" mt={0.5} />
                <Text fontSize="sm" color="blue.700">
                  For each 0.1 BTC protected, you&apos;ll pay approximately $188.54 in premium.
                </Text>
              </Flex>
            </Box>
          </Box>
        </Flex>
      </Box>
    </Box>
  );
} 