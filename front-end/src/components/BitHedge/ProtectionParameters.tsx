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

// Define user roles if not already globally defined
type UserRole = 'buyer' | 'provider';

// Update props interface
interface ProtectionParametersProps {
  currentUserRole: UserRole;
}

export default function ProtectionParameters({ currentUserRole }: ProtectionParametersProps) {
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
  
  // Neumorphic styles
  const neumorphicBg = "#E8EAE9"; 
  const neumorphicShadowLight = "-10px -10px 20px rgba(255, 255, 255, 0.8)"; 
  const neumorphicShadowDark = "10px 10px 20px rgba(163, 177, 198, 0.6)";
  const neumorphicBoxShadow = `${neumorphicShadowLight}, ${neumorphicShadowDark}`;
  const neumorphicInnerShadowLight = "inset -5px -5px 10px rgba(255, 255, 255, 0.8)";
  const neumorphicInnerShadowDark = "inset 5px 5px 10px rgba(163, 177, 198, 0.6)";
  const neumorphicInnerBoxShadow = `${neumorphicInnerShadowLight}, ${neumorphicInnerShadowDark}`;
  const neumorphicBorderRadius = "xl"; 
  
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
    <Box bg={neumorphicBg} p={4} borderRadius={neumorphicBorderRadius} boxShadow={neumorphicBoxShadow}>
      <Heading as="h2" fontSize="2xl" fontWeight="bold" mb={4} color="gray.800">
        Protection Parameters
      </Heading>
      <Text mb={6} color="gray.700">
        Customize your Bitcoin protection parameters to fit your needs.
      </Text>
      
      <Box p={0} borderRadius={neumorphicBorderRadius} >
        <Flex 
          direction={{ base: "column", md: "row" }} 
          gap={{ base: 6, md: 8 }}
          align="stretch"
        >
          {/* Protected Value Section */}
          <Box flex="1" ref={protectedValueRef} minH="270px">
            <Flex align="center" mb={2}>
              <Heading as="h3" fontSize="lg" fontWeight="bold" mr={1} color="gray.800">
                Protected Value
              </Heading>
              <Tooltip hasArrow label="The percentage of your Bitcoin's current value that will be protected">
                <Box display="inline">
                  <Icon as={IoInformationCircle} color="blue.500" />
                </Box>
              </Tooltip>
            </Flex>
            
            <Heading as="h4" fontSize="2xl" fontWeight="semibold" mb={1} color="gray.800">
              ${protectedValueUSD.toFixed(2)}
            </Heading>
            <Text fontSize="sm" color="gray.600" mb={4}>
              {protectedValue}% of current price
            </Text>
            
            <Slider 
              value={protectedValue}
              onChange={setProtectedValue}
              min={50}
              max={150}
              step={1}
              mb={4}
            >
              <SliderTrack 
                bg="rgba(163, 177, 198, 0.3)"
                borderRadius="full"
                h="8px"
                boxShadow={neumorphicInnerBoxShadow}
              >
                <SliderFilledTrack 
                  bg="blue.500"
                  borderRadius="full"
                />
              </SliderTrack>
              <SliderThumb 
                boxSize={6} 
                bg={neumorphicBg}
                boxShadow={neumorphicBoxShadow}
                borderWidth="2px" 
                borderColor={neumorphicBg}
                _focus={{ boxShadow: neumorphicBoxShadow }}
              />
            </Slider>
            
            <Flex justify="space-between" color="gray.700">
              <Text>50%</Text>
              <Text>100%</Text>
              <Text>150%</Text>
            </Flex>
            
            <HStack spacing={3} mt={4}>
              {[80, 90, 100, 110].map((value) => {
                const isSelected = protectedValue === value;
                return (
                  <Button 
                    key={value}
                    variant="unstyled"
                    size="sm" 
                    onClick={() => setProtectedValue(value)}
                    flex="1"
                    bg={neumorphicBg}
                    borderRadius="md"
                    boxShadow={isSelected ? neumorphicInnerBoxShadow : neumorphicBoxShadow}
                    color={isSelected ? "blue.600" : "gray.700"}
                    fontWeight={isSelected ? "bold" : "normal"}
                    transition="all 0.1s ease-in-out"
                    _hover={{
                      boxShadow: isSelected ? neumorphicInnerBoxShadow : `${neumorphicShadowLight.replace("10px", "12px").replace("20px", "24px")}, ${neumorphicShadowDark.replace("10px", "12px").replace("20px", "24px")}`
                    }}
                     _active={{
                       boxShadow: neumorphicInnerBoxShadow,
                       transform: "scale(0.98)"
                    }}
                  >
                    {value}%
                  </Button>
                );
              })}
            </HStack>
            
            <Box mt={4} p={3} bg="rgba(255, 255, 255, 0.5)" borderRadius="lg" boxShadow="inner">
              <Flex gap={2}>
                <Icon as={IoInformationCircle} color="blue.500" mt={0.5} />
                <Text fontSize="sm" color="blue.800">
                  Lower strike prices reduce premium costs but provide less protection.
                </Text>
              </Flex>
            </Box>
          </Box>
          
          {/* Protection Amount Section */}
          <Box flex="1" ref={protectionAmountRef} minH="270px" display="flex" flexDirection="column">
            <Flex align="center" mb={2}>
              <Heading as="h3" fontSize="lg" fontWeight="bold" mr={1} color="gray.800">
                Protection Amount
              </Heading>
              <Tooltip hasArrow label="The amount of Bitcoin you want to protect">
                <Box display="inline">
                  <Icon as={IoInformationCircle} color="blue.500" />
                </Box>
              </Tooltip>
            </Flex>
            
            <Heading as="h4" fontSize="2xl" fontWeight="semibold" mb={1} color="gray.800">
              ${protectionAmountUSD.toLocaleString()}
            </Heading>
            <Text fontSize="sm" color="gray.600" mb={4}>
              USD Value
            </Text>
            
            <Flex 
              align="center" 
              justify="center"
              mb={6}
              mt={2}
              bg={neumorphicBg}
              p={2}
              borderRadius="md"
              boxShadow={neumorphicInnerBoxShadow}
            >
              <Text fontSize="2xl" fontWeight="bold" color="orange.500" mr={2}>₿</Text>
              <Input
                variant="unstyled"
                value={inputValue}
                onChange={handleInputChange}
                textAlign="center"
                fontWeight="bold"
                fontSize="2xl"
                w="100px"
                p={0}
                placeholder="0.00"
                color="gray.800"
                _placeholder={{ color: "gray.500" }}
              />
              <Text ml={2} fontWeight="bold" fontSize="2xl" color="gray.800">BTC</Text>
            </Flex>
            
            <HStack spacing={3} mt="auto" mb={1}>
              {[0.25, 0.50, 0.75, 1.00].map((amount) => {
                 const isSelected = protectionAmount === amount;
                 return (
                   <Button 
                     key={amount}
                     variant="unstyled"
                     size="sm" 
                     onClick={() => handleAmountSelection(amount)}
                     flex="1"
                     bg={neumorphicBg}
                     borderRadius="md"
                     boxShadow={isSelected ? neumorphicInnerBoxShadow : neumorphicBoxShadow}
                     color={isSelected ? "blue.600" : "gray.700"}
                     fontWeight={isSelected ? "bold" : "normal"}
                     transition="all 0.1s ease-in-out"
                     _hover={{
                       boxShadow: isSelected ? neumorphicInnerBoxShadow : `${neumorphicShadowLight.replace("10px", "12px").replace("20px", "24px")}, ${neumorphicShadowDark.replace("10px", "12px").replace("20px", "24px")}`
                     }}
                     _active={{
                       boxShadow: neumorphicInnerBoxShadow,
                       transform: "scale(0.98)"
                     }}
                   >
                     {amount.toFixed(2)} BTC
                   </Button>
                 );
              })}
            </HStack>
            
            <Box mt={4} p={3} bg="rgba(255, 255, 255, 0.5)" borderRadius="lg" boxShadow="inner">
              <Flex gap={2}>
                <Icon as={IoInformationCircle} color="blue.500" mt={0.5} />
                <Text fontSize="sm" color="blue.800">
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
              <Heading as="h3" fontSize="lg" fontWeight="bold" mr={1} color="gray.800">
                Protection Period
              </Heading>
              <Tooltip hasArrow label="The duration for which your Bitcoin will be protected">
                <Box display="inline">
                  <Icon as={IoInformationCircle} color="blue.500" />
                </Box>
              </Tooltip>
            </Flex>
            <Box>
              <Heading as="h4" fontSize="xl" fontWeight="semibold" textAlign="right" color="gray.800">
                {protectionPeriod} days
              </Heading>
              <Text fontSize="sm" color="gray.600" textAlign="right">
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
                    bg={isSelected ? "blue.600" : "rgba(255, 255, 255, 0.5)"}
                    bgGradient={isSelected ? "linear(to-b, blue.600, blue.700)" : undefined}
                    color={isSelected ? "white" : "gray.800"}
                    borderColor={isSelected ? "blue.600" : "gray.300"}
                    shadow={isSelected ? "md" : "inner"}
                    _hover={{
                      shadow: "md",
                      borderColor: isSelected ? "blue.700" : "gray.400",
                      bg: isSelected ? undefined : "rgba(255, 255, 255, 0.7)",
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
                        color={isSelected ? "blue.100" : "gray.600"}
                      >
                        days
                      </Text>
                      <Divider 
                        my={2} 
                        borderColor={isSelected ? "blue.500" : "gray.300"}
                        opacity={isSelected ? 0.5 : 1}
                      />
                      <Text 
                        fontSize="sm" 
                        fontWeight="medium"
                        color={isSelected ? "blue.100" : "gray.700"}
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
          
          <Box mt={4} p={3} bg="rgba(255, 255, 255, 0.5)" borderRadius="lg" boxShadow="inner">
            <Flex gap={2}>
              <Icon as={IoInformationCircle} color="blue.500" mt={0.5} />
              <Text fontSize="sm" color="blue.800">
                Longer protection periods usually cost more but provide extended downside coverage.
              </Text>
            </Flex>
          </Box>
        </Box>
      </Box>
    </Box>
  );
} 