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
  
  // Neumorphic styles
  const neumorphicBg = "#E8EAE9"; 
  const neumorphicShadowLight = "-10px -10px 20px rgba(255, 255, 255, 0.8)"; 
  const neumorphicShadowDark = "10px 10px 20px rgba(163, 177, 198, 0.6)";
  const neumorphicBoxShadow = `${neumorphicShadowLight}, ${neumorphicShadowDark}`;
  // const neumorphicInnerShadowLight = "inset -5px -5px 10px rgba(255, 255, 255, 0.8)"; // Keep if needed elsewhere, remove if truly unused
  // const neumorphicInnerShadowDark = "inset 5px 5px 10px rgba(163, 177, 198, 0.6)";
  // const neumorphicInnerBoxShadow = `${neumorphicInnerShadowLight}, ${neumorphicInnerShadowDark}`; // Removed as it's unused
  const neumorphicBorderRadius = "xl"; 

  return (
    <Flex 
      direction="column" 
      p={4} // Added padding
      bg={neumorphicBg} // Apply neumorphic background
      borderRadius={neumorphicBorderRadius} // Apply neumorphic radius
      boxShadow={neumorphicBoxShadow} // Apply neumorphic shadow
    >
      <Tabs 
        index={tabIndex} 
        onChange={setTabIndex}
        variant="unstyled" 
        isFitted
        mt={2} // Add some margin top
      >
        <TabList gap={4}> {/* Added gap between tabs */} 
          <Tab 
            py={4} 
            // Apply blue gradient if selected, transparent if not
            bg={tabIndex === 0 ? 'transparent' : 'transparent'} // Keep base transparent
            bgGradient={tabIndex === 0 ? 'linear(to-b, blue.600, blue.700)' : undefined}
            borderRadius={neumorphicBorderRadius} 
            // Use standard shadow for selected blue tab, none for unselected
            boxShadow={tabIndex === 0 ? 'md' : 'none'} 
            // Text color white for selected, gray for unselected
            color={tabIndex === 0 ? 'white' : 'gray.600'} 
            _hover={{
              // Hover for unselected
              bg: tabIndex !== 0 ? "rgba(255, 255, 255, 0.3)" : undefined, 
              color: tabIndex !== 0 ? "blue.600": "white", // Change unselected text to blue on hover
              // Subtle gradient shift for selected tab on hover
              bgGradient: tabIndex === 0 ? 'linear(to-b, blue.700, blue.800)' : undefined,
            }}
            transition="all 0.2s ease-in-out"
          >
            <Flex 
              align="center" 
              justify="center" 
              flexDirection={{ base: "column", md: "row" }}
              gap={{ base: 2, md: 3 }}
            >
              {/* Icon Background Styling */}
              <Flex 
                w="40px" 
                h="40px" 
                // Darker translucent bg for selected tab icon, subtle bg for unselected
                bg={tabIndex === 0 ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.4)"} 
                borderRadius="full" 
                align="center" 
                justify="center"
                // No shadow for selected icon container, inner for unselected
                boxShadow={tabIndex === 0 ? 'none' : "inner"} 
              >
                <Icon 
                  as={IoShieldOutline} 
                  // Icon color white for selected, blue for unselected
                  color={tabIndex === 0 ? "white" : "blue.500"} 
                  boxSize={5} 
                />
              </Flex>
              <Box textAlign={{ base: "center", md: "left" }}>
                {/* Text colors adjust based on selection */}
                <Text fontWeight="semibold" color={tabIndex === 0 ? 'white' : 'gray.700'}>Protection Buyer</Text>
                <Text fontSize="sm" color={tabIndex === 0 ? 'blue.100' : 'gray.500'}>Buy insurance for your BTC</Text>
              </Box>
            </Flex>
          </Tab>
          
          <Tab 
            py={4} 
            // Apply blue gradient if selected, transparent if not
            bg={tabIndex === 1 ? 'transparent' : 'transparent'} // Keep base transparent
            bgGradient={tabIndex === 1 ? 'linear(to-b, blue.600, blue.700)' : undefined}
            borderRadius={neumorphicBorderRadius} 
            // Use standard shadow for selected blue tab, none for unselected
            boxShadow={tabIndex === 1 ? 'md' : 'none'} 
            // Text color white for selected, gray for unselected
            color={tabIndex === 1 ? 'white' : 'gray.600'} 
             _hover={{
              // Hover for unselected
              bg: tabIndex !== 1 ? "rgba(255, 255, 255, 0.3)" : undefined, 
              color: tabIndex !== 1 ? "blue.600": "white", // Change unselected text to blue on hover
              // Subtle gradient shift for selected tab on hover
              bgGradient: tabIndex === 1 ? 'linear(to-b, blue.700, blue.800)' : undefined,
            }}
            transition="all 0.2s ease-in-out"
          >
            <Flex 
              align="center" 
              justify="center" 
              flexDirection={{ base: "column", md: "row" }}
              gap={{ base: 2, md: 3 }}
            >
              {/* Icon Background Styling */}
              <Flex 
                w="40px" 
                h="40px" 
                // Darker translucent bg for selected tab icon, subtle bg for unselected
                bg={tabIndex === 1 ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.4)"} 
                borderRadius="full" 
                align="center" 
                justify="center"
                // No shadow for selected icon container, inner for unselected
                boxShadow={tabIndex === 1 ? 'none' : "inner"} 
              >
                <Icon 
                  as={IoBusinessOutline} 
                  // Icon color white for selected, blue for unselected
                  color={tabIndex === 1 ? "white" : "blue.500"} 
                  boxSize={5} 
                />
              </Flex>
              <Box textAlign={{ base: "center", md: "left" }}>
                 {/* Text colors adjust based on selection */}
                <Text fontWeight="semibold" color={tabIndex === 1 ? 'white' : 'gray.700'}>Liquidity Provider</Text>
                <Text fontSize="sm" color={tabIndex === 1 ? 'blue.100' : 'gray.500'}>Earn income on your BTC</Text>
              </Box>
            </Flex>
          </Tab>
        </TabList>
        {/* TabPanels would go here if they existed */}
      </Tabs>
    </Flex>
  );
} 