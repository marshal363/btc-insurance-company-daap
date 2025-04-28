"use client";

import { useState, useRef, useEffect } from "react";
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
} from "@chakra-ui/react";
import { IoInformationCircle } from "react-icons/io5";

export default function ProtectionParameters() {
  // Mock data and state
  const [protectedValue, setProtectedValue] = useState(100);
  const [protectionAmount, setProtectionAmount] = useState(0.25);
  const [protectionPeriod, setProtectionPeriod] = useState(30);
  const [inputValue, setInputValue] = useState("0.25");
  
  const protectedValueRef = useRef(null);
  const protectionAmountRef = useRef(null);
  
  const currentPrice = 94270.88;
  const protectedValueUSD = (currentPrice * protectedValue) / 100;
  const protectionAmountUSD = parseFloat(inputValue || "0") * currentPrice;
  
  // Handle manual input changes
  const handleInputChange = (e) => {
    // Allow any input including empty string, dots, and partial numbers
    const value = e.target.value;
    setInputValue(value);
    
    // Only update actual amount if it's a valid number
    if (!isNaN(parseFloat(value))) {
      setProtectionAmount(parseFloat(value));
    }
  };
  
  // Handle button click for preset values
  const handleAmountSelection = (amount) => {
    setProtectionAmount(amount);
    setInputValue(amount.toString());
  };
  
  // Effect to match heights (for debugging)
  useEffect(() => {
    if (protectedValueRef.current && protectionAmountRef.current) {
      const height1 = protectedValueRef.current.offsetHeight;
      const height2 = protectionAmountRef.current.offsetHeight;
      console.log('Protected Value height:', height1);
      console.log('Protection Amount height:', height2);
    }
  }, []);
  
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
              <Button 
                variant={protectionAmount === 0.25 ? "solid" : "outline"} 
                colorScheme="blue" 
                size="sm" 
                onClick={() => handleAmountSelection(0.25)}
                flex="1"
              >
                0.25 BTC
              </Button>
              <Button 
                variant={protectionAmount === 0.50 ? "solid" : "outline"} 
                colorScheme="blue" 
                size="sm" 
                onClick={() => handleAmountSelection(0.50)}
                flex="1"
              >
                0.50 BTC
              </Button>
              <Button 
                variant={protectionAmount === 0.75 ? "solid" : "outline"} 
                colorScheme="blue" 
                size="sm" 
                onClick={() => handleAmountSelection(0.75)}
                flex="1"
              >
                0.75 BTC
              </Button>
              <Button 
                variant={protectionAmount === 1.0 ? "solid" : "outline"} 
                colorScheme="blue" 
                size="sm" 
                onClick={() => handleAmountSelection(1.0)}
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
            <GridItem>
              <Button
                h="auto"
                py={6}
                width="100%"
                display="flex"
                flexDirection="column"
                alignItems="center"
                variant={protectionPeriod === 30 ? "solid" : "outline"}
                bg={protectionPeriod === 30 ? "blue.50" : "white"}
                color={protectionPeriod === 30 ? "blue.600" : "gray.600"}
                borderColor={protectionPeriod === 30 ? "blue.200" : "gray.200"}
                _hover={{ bg: protectionPeriod === 30 ? "blue.50" : "gray.50" }}
                onClick={() => setProtectionPeriod(30)}
              >
                <Heading as="h4" fontSize="3xl" fontWeight="bold" mb={1}>
                  30
                </Heading>
                <Text>days</Text>
                <Text fontSize="sm" mt={2} fontWeight="normal">
                  Short Term
                </Text>
              </Button>
            </GridItem>
            <GridItem>
              <Button
                h="auto"
                py={6}
                width="100%"
                display="flex"
                flexDirection="column"
                alignItems="center"
                variant={protectionPeriod === 90 ? "solid" : "outline"}
                bg={protectionPeriod === 90 ? "blue.50" : "white"}
                color={protectionPeriod === 90 ? "blue.600" : "gray.600"}
                borderColor={protectionPeriod === 90 ? "blue.200" : "gray.200"}
                _hover={{ bg: protectionPeriod === 90 ? "blue.50" : "gray.50" }}
                onClick={() => setProtectionPeriod(90)}
              >
                <Heading as="h4" fontSize="3xl" fontWeight="bold" mb={1}>
                  90
                </Heading>
                <Text>days</Text>
                <Text fontSize="sm" mt={2} fontWeight="normal">
                  Balanced
                </Text>
              </Button>
            </GridItem>
            <GridItem>
              <Button
                h="auto"
                py={6}
                width="100%"
                display="flex"
                flexDirection="column"
                alignItems="center"
                variant={protectionPeriod === 180 ? "solid" : "outline"}
                bg={protectionPeriod === 180 ? "blue.50" : "white"}
                color={protectionPeriod === 180 ? "blue.600" : "gray.600"}
                borderColor={protectionPeriod === 180 ? "blue.200" : "gray.200"}
                _hover={{ bg: protectionPeriod === 180 ? "blue.50" : "gray.50" }}
                onClick={() => setProtectionPeriod(180)}
              >
                <Heading as="h4" fontSize="3xl" fontWeight="bold" mb={1}>
                  180
                </Heading>
                <Text>days</Text>
                <Text fontSize="sm" mt={2} fontWeight="normal">
                  Strategic
                </Text>
              </Button>
            </GridItem>
            <GridItem>
              <Button
                h="auto"
                py={6}
                width="100%"
                display="flex"
                flexDirection="column"
                alignItems="center"
                variant={protectionPeriod === 360 ? "solid" : "outline"}
                bg={protectionPeriod === 360 ? "blue.50" : "white"}
                color={protectionPeriod === 360 ? "blue.600" : "gray.600"}
                borderColor={protectionPeriod === 360 ? "blue.200" : "gray.200"}
                _hover={{ bg: protectionPeriod === 360 ? "blue.50" : "gray.50" }}
                onClick={() => setProtectionPeriod(360)}
              >
                <Heading as="h4" fontSize="3xl" fontWeight="bold" mb={1}>
                  360
                </Heading>
                <Text>days</Text>
                <Text fontSize="sm" mt={2} fontWeight="normal">
                  Maximum Coverage
                </Text>
              </Button>
            </GridItem>
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