"use client";

import {
  Box,
  Flex,
  Text,
  Icon,
  Button,
  Collapse,
  useDisclosure,
} from "@chakra-ui/react";
import { IoSettingsOutline, IoChevronDown, IoChevronUp } from "react-icons/io5";

// Define user roles if not already globally defined
type UserRole = 'buyer' | 'provider';

// Update props interface
interface AdvancedParametersProps {
  currentUserRole: UserRole;
}

export default function AdvancedParameters({ currentUserRole }: AdvancedParametersProps) {
  const { isOpen, onToggle } = useDisclosure();
  
  return (
    <Box 
      borderWidth="1px" 
      borderColor="gray.200" 
      borderRadius="lg"
      overflow="hidden"
    >
      <Button
        variant="unstyled"
        onClick={onToggle}
        display="flex"
        alignItems="center"
        justifyContent="flex-start"
        width="full"
        p={4}
        color="blue.600"
        bg="blue.50"
        _hover={{ bg: "blue.100" }}
        fontWeight="medium"
      >
        <Flex align="center" width="full">
          <Icon as={IoSettingsOutline} mr={3} />
          <Text fontWeight="semibold">Advanced Parameters</Text>
          <Icon 
            as={isOpen ? IoChevronUp : IoChevronDown} 
            ml="auto" 
          />
        </Flex>
      </Button>
      
      <Collapse in={isOpen} animateOpacity>
        <Box p={6}>
          <Text color="gray.600">
            Advanced parameters will be available in a future update. This will include customization options for volatility assumptions, risk-free rate adjustments, and custom expiry dates.
          </Text>
        </Box>
      </Collapse>
    </Box>
  );
} 