"use client";

import React from 'react';
import { Text, Box, Alert, AlertIcon, AlertDescription, Stack } from '@chakra-ui/react';

type ValidationErrorProps = {
  /**
   * The error message to display
   */
  message?: string;
  
  /**
   * Optional object of field-specific error messages
   */
  errors?: Record<string, string>;
  
  /**
   * Whether to show the error as a full alert (true) or just text (false)
   */
  showAsAlert?: boolean;
  
  /**
   * Field to specifically show error for (if errors object is provided)
   */
  field?: string;
};

/**
 * A reusable component for displaying validation errors
 * It can show either a specific field error or a full form error
 */
export const ValidationError: React.FC<ValidationErrorProps> = ({
  message,
  errors,
  showAsAlert = false,
  field,
}) => {
  // If field is provided, only show error for that field
  if (field && errors && errors[field]) {
    // Show field-specific error
    return showAsAlert ? (
      <Alert status="error" variant="subtle" size="sm" borderRadius="md" py={1} mt={1}>
        <AlertIcon />
        <AlertDescription fontSize="sm">{errors[field]}</AlertDescription>
      </Alert>
    ) : (
      <Text color="red.500" fontSize="sm" mt={1}>
        {errors[field]}
      </Text>
    );
  }
  
  // If no field is specified, but we have a message or _form error
  const errorMessage = message || (errors && errors._form);
  if (!errorMessage && (!errors || Object.keys(errors).length === 0)) {
    return null;
  }
  
  // Display either a single error or multiple field errors
  if (errorMessage) {
    return showAsAlert ? (
      <Alert status="error" variant="subtle" size="sm" borderRadius="md" mt={2}>
        <AlertIcon />
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    ) : (
      <Text color="red.500" fontSize="sm" mt={1}>
        {errorMessage}
      </Text>
    );
  }
  
  // Show all field errors
  return (
    <Box mt={2}>
      <Alert status="error" variant="subtle" borderRadius="md">
        <AlertIcon />
        <Stack spacing={1}>
          {errors && Object.entries(errors).map(([key, value]) => (
            <Text key={key} fontSize="sm">
              {key !== '_form' ? `${key}: ${value}` : value}
            </Text>
          ))}
        </Stack>
      </Alert>
    </Box>
  );
};

export default ValidationError; 