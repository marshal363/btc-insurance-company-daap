"use client";

import { useState } from "react";
import {
  Box,
  Flex,
  Text,
  Icon,
  Tabs,
  TabList,
  Tab,
} from "@chakra-ui/react";
import { IoShieldOutline, IoBusinessOutline } from "react-icons/io5";

export default function PremiumCalculatorTabs() {
  const [tabIndex, setTabIndex] = useState(0);
  
  return (
    <Flex 
      direction="column" 
      p={2} 
      bg="white"
      borderRadius="lg"
      boxShadow="sm"
    >
      <Tabs 
        index={tabIndex} 
        onChange={setTabIndex}
        variant="unstyled" 
        isFitted
      >
        <TabList>
          <Tab 
            py={6}
            bg={tabIndex === 0 ? "white" : "gray.50"}
            borderRadius="lg"
            boxShadow={tabIndex === 0 ? "sm" : "none"}
            _hover={{
              bg: tabIndex === 0 ? "white" : "gray.100"
            }}
          >
            <Flex 
              align="center" 
              justify="center" 
              flexDirection={{ base: "column", md: "row" }}
              gap={{ base: 2, md: 3 }}
            >
              <Flex 
                w="40px" 
                h="40px" 
                bg="blue.50" 
                borderRadius="full" 
                align="center" 
                justify="center"
              >
                <Icon as={IoShieldOutline} color="blue.500" boxSize={5} />
              </Flex>
              <Box textAlign={{ base: "center", md: "left" }}>
                <Text fontWeight="semibold">Protection Buyer</Text>
                <Text fontSize="sm" color="gray.600">Buy insurance for your BTC</Text>
              </Box>
            </Flex>
          </Tab>
          
          <Tab 
            py={6}
            bg={tabIndex === 1 ? "white" : "gray.50"}
            borderRadius="lg"
            boxShadow={tabIndex === 1 ? "sm" : "none"}
            _hover={{
              bg: tabIndex === 1 ? "white" : "gray.100"
            }}
          >
            <Flex 
              align="center" 
              justify="center" 
              flexDirection={{ base: "column", md: "row" }}
              gap={{ base: 2, md: 3 }}
            >
              <Flex 
                w="40px" 
                h="40px" 
                bg="blue.50" 
                borderRadius="full" 
                align="center" 
                justify="center"
              >
                <Icon as={IoBusinessOutline} color="blue.500" boxSize={5} />
              </Flex>
              <Box textAlign={{ base: "center", md: "left" }}>
                <Text fontWeight="semibold">Liquidity Provider</Text>
                <Text fontSize="sm" color="gray.600">Earn income on your BTC</Text>
              </Box>
            </Flex>
          </Tab>
        </TabList>
      </Tabs>
    </Flex>
  );
} 