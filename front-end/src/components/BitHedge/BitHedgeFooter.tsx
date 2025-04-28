"use client";

import { Box, Flex, Text, Divider } from "@chakra-ui/react";

export default function BitHedgeFooter() {
  return (
    <Box as="footer" mt={12} mb={6}>
      <Divider mb={6} />
      
      <Flex 
        direction={{ base: "column", md: "row" }}
        justify="space-between"
        align={{ base: "center", md: "flex-start" }}
        gap={4}
        textAlign={{ base: "center", md: "left" }}
      >
        <Box>
          <Text fontWeight="bold" mb={1}>BitHedge</Text>
          <Text fontSize="sm" color="gray.500">
            Bitcoin price protection through decentralized put options.
          </Text>
        </Box>
        
        <Box>
          <Text fontSize="sm" color="gray.500">
            © 2023 BitHedge. All rights reserved.
          </Text>
          <Text fontSize="xs" color="gray.400" mt={1}>
            Powered by Stacks and Bitcoin
          </Text>
        </Box>
      </Flex>
    </Box>
  );
} 