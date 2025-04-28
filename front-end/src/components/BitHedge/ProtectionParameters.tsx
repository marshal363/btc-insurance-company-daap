"use client";

import { useState, useRef } from "react";
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
  Icon,
  Tooltip,
  Grid,
  GridItem,
  Input,
  VStack,
  Divider,
} from "@chakra-ui/react";
import { IoInformationCircle } from "react-icons/io5";

export default function ProtectionParameters() {
  // Mock data and state
  const [protectedValue, setProtectedValue] = useState(100);
  const [protectionAmount, setProtectionAmount] = useState(0.25);
  const [protectionPeriod, setProtectionPeriod] = useState(90);
  const [inputValue, setInputValue] = useState("0.25");
  
  const protectedValueRef = useRef<HTMLDivElement>(null);
  const protectionAmountRef = useRef<HTMLDivElement>(null);
  
  const currentPrice = 94270.88;
  const protectedValueUSD = (currentPrice * protectedValue) / 100;
  const protectionAmountUSD = parseFloat(inputValue || "0") * currentPrice;
  
  // Handle manual input changes with type
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow any input including empty string, dots, and partial numbers
    const value = e.target.value;
    setInputValue(value);
    
    // Only update actual amount if it's a valid number
    // Handle case where input is just '.' or ends with '.'
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue)) {
      setProtectionAmount(numericValue);
    } else if (value === "" || value === "." || value.endsWith(".")) {
      // Keep input value as is, but maybe reset protectionAmount if needed or handle validation elsewhere
      // For now, do nothing with protectionAmount if not a valid number
    }
  };
  
  // Handle button click for preset values with type
  const handleAmountSelection = (amount: number) => {
    setProtectionAmount(amount);
    setInputValue(amount.toString());
  };
  
  // Helper function to get period description
  const getPeriodDescription = (period: number) => {
    switch (period) {
      case 30: return "Short Term";
      case 90: return "Balanced";
      case 180: return "Strategic";
      case 360: return "Maximum Coverage";
      default: return "";
    }
  };
  
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
          align="stretch"
        >
          {/* Protected Value Section */}
          <Box flex="1" ref={protectedValueRef} minH="270px">
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
              <SliderTrack bg="gray.200">
                <SliderFilledTrack bg="blue.500" />
              </SliderTrack>
              <SliderThumb 
                boxSize={6} 
                bg="blue.600"
                borderWidth="2px" 
                borderColor="white"
                _focus={{ boxShadow: "outline" }}
              />
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
                _active={{
                  bg: protectedValue === 80 ? "blue.700" : undefined
                }}
              >
                80%
              </Button>
              <Button 
                variant={protectedValue === 90 ? "solid" : "outline"} 
                colorScheme="blue" 
                size="sm" 
                onClick={() => setProtectedValue(90)}
                flex="1"
                _active={{
                  bg: protectedValue === 90 ? "blue.700" : undefined
                }}
              >
                90%
              </Button>
              <Button 
                variant={protectedValue === 100 ? "solid" : "outline"}
                colorScheme="blue" 
                size="sm" 
                onClick={() => setProtectedValue(100)}
                flex="1"
                _active={{
                  bg: protectedValue === 100 ? "blue.700" : undefined
                }}
              >
                100%
              </Button>
              <Button 
                variant={protectedValue === 110 ? "solid" : "outline"} 
                colorScheme="blue" 
                size="sm" 
                onClick={() => setProtectedValue(110)}
                flex="1"
                _active={{
                  bg: protectedValue === 110 ? "blue.700" : undefined
                }}
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
          <Box flex="1" ref={protectionAmountRef} minH="270px" display="flex" flexDirection="column">
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
            
            <Flex 
              align="center" 
              justify="center"
              mb={6}
              mt={2}
            >
              <Text fontSize="2xl" fontWeight="bold" color="orange.500" mr={2}>₿</Text>
              <Input
                value={inputValue}
                onChange={handleInputChange}
                textAlign="center"
                fontWeight="bold"
                fontSize="2xl"
                border="none"
                _focus={{
                  boxShadow: "none",
                }}
                w="100px"
                p={0}
                placeholder="0.00"
              />
              <Text ml={2} fontWeight="bold" fontSize="2xl">BTC</Text>
            </Flex>
            
            <HStack spacing={2} mt="auto" mb={1}>
              {/* Amount buttons */}
              {[0.25, 0.50, 0.75, 1.00].map((amount) => (
                <Button 
                  key={amount}
                  variant={protectionAmount === amount ? "solid" : "outline"} 
                  colorScheme="blue" 
                  size="sm" 
                  onClick={() => handleAmountSelection(amount)}
                  flex="1"
                  _active={{
                    bg: protectionAmount === amount ? "blue.700" : undefined
                  }}
                >
                  {amount.toFixed(2)} BTC
                </Button>
              ))}
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
        
        {/* Protection Period Section */}
        <Box mt={8}>
          <Flex align="center" justify="space-between" mb={4}>
            <Flex align="center">
              <Heading as="h3" fontSize="lg" fontWeight="bold" mr={1}>
                Protection Period
              </Heading>
              <Tooltip hasArrow label="The duration for which your Bitcoin will be protected">
                <Box display="inline">
                  <Icon as={IoInformationCircle} color="blue.500" />
                </Box>
              </Tooltip>
            </Flex>
            <Box>
              <Heading as="h4" fontSize="xl" fontWeight="semibold" textAlign="right">
                {protectionPeriod} days
              </Heading>
              <Text fontSize="sm" color="gray.500" textAlign="right">
                {protectionPeriod} Days
              </Text>
            </Box>
          </Flex>
          
          <Grid 
            templateColumns={{ base: "1fr", md: "repeat(4, 1fr)" }} 
            gap={4}
            mt={4}
          >
            {[30, 90, 180, 360].map((period) => {
              const isSelected = protectionPeriod === period;
              return (
                <GridItem key={period} h="100%">
                  <Box
                    h="100%"
                    p={4}
                    borderWidth="1px"
                    borderRadius="lg"
                    cursor="pointer"
                    onClick={() => setProtectionPeriod(period)}
                    transition="all 0.2s ease-in-out"
                    bg={isSelected ? "blue.600" : "white"}
                    bgGradient={isSelected ? "linear(to-b, blue.600, blue.700)" : undefined}
                    color={isSelected ? "white" : "gray.700"}
                    borderColor={isSelected ? "blue.600" : "gray.200"}
                    shadow={isSelected ? "md" : "xs"}
                    _hover={{
                      shadow: "md",
                      borderColor: isSelected ? "blue.700" : "gray.300",
                      bg: isSelected ? undefined : "gray.50",
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
                        color={isSelected ? "blue.100" : "gray.500"}
                      >
                        days
                      </Text>
                      <Divider 
                        my={2} 
                        borderColor={isSelected ? "blue.500" : "gray.200"} 
                        opacity={isSelected ? 0.5 : 1}
                      />
                      <Text 
                        fontSize="sm" 
                        fontWeight="medium"
                        color={isSelected ? "blue.100" : "gray.600"}
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
          
          <Box mt={4} p={3} bg="blue.50" borderRadius="md">
            <Flex gap={2}>
              <Icon as={IoInformationCircle} color="blue.500" mt={0.5} />
              <Text fontSize="sm" color="blue.700">
                Longer protection periods usually cost more but provide extended downside coverage.
              </Text>
            </Flex>
          </Box>
        </Box>
      </Box>
    </Box>
  );
} 