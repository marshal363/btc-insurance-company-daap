import { z } from 'zod';

/**
 * Validation schema for protection buyer parameters
 */
export const buyerParametersSchema = z.object({
  // Coverage amount in BTC - must be positive, with reasonable limits
  coverageAmount: z
    .number()
    .positive('Coverage amount must be greater than zero')
    .max(100, 'Coverage amount cannot exceed 100 BTC')
    .refine((val) => !isNaN(val), 'Coverage amount must be a valid number'),

  // Strike price in USD - must be positive
  strikePrice: z
    .number()
    .positive('Strike price must be greater than zero')
    .refine((val) => !isNaN(val), 'Strike price must be a valid number'),

  // Premium in BTC - calculated, not user input but validated for display
  premium: z
    .number()
    .nonnegative('Premium cannot be negative')
    .optional(),

  // Duration in days - must be positive, with some reasonable constraints
  durationDays: z
    .number()
    .int('Duration must be a whole number of days')
    .positive('Duration must be greater than zero')
    .max(365, 'Duration cannot exceed 365 days')
    .refine((val) => !isNaN(val), 'Duration must be a valid number'),

  // Optional Bitcoin price - if provided, must be positive
  bitcoinPrice: z
    .number()
    .positive('Bitcoin price must be greater than zero')
    .optional(),
});

/**
 * Type for protection buyer parameters
 */
export type BuyerParameters = z.infer<typeof buyerParametersSchema>;

/**
 * Validation schema for liquidity provider parameters
 */
export const providerParametersSchema = z.object({
  // Liquidity amount in BTC - must be positive with reasonable limits
  liquidityAmount: z
    .number()
    .positive('Liquidity amount must be greater than zero')
    .max(1000, 'Liquidity amount cannot exceed 1000 BTC')
    .refine((val) => !isNaN(val), 'Liquidity amount must be a valid number'),

  // Risk tolerance - between 0 and 1 (0% to 100%)
  riskTolerance: z
    .number()
    .min(0, 'Risk tolerance cannot be negative')
    .max(1, 'Risk tolerance cannot exceed 100%')
    .refine((val) => !isNaN(val), 'Risk tolerance must be a valid number'),

  // Expected yield - calculated, not user input but validated for display
  expectedYield: z
    .number()
    .nonnegative('Expected yield cannot be negative')
    .optional(),

  // Lock period in days - must be positive with reasonable constraints
  lockPeriodDays: z
    .number()
    .int('Lock period must be a whole number of days')
    .positive('Lock period must be greater than zero')
    .max(365, 'Lock period cannot exceed 365 days')
    .refine((val) => !isNaN(val), 'Lock period must be a valid number'),

  // Optional Bitcoin price - if provided, must be positive
  bitcoinPrice: z
    .number()
    .positive('Bitcoin price must be greater than zero')
    .optional(),
});

/**
 * Type for liquidity provider parameters
 */
export type ProviderParameters = z.infer<typeof providerParametersSchema>;

/**
 * Validation helper to parse and validate buyer parameters
 * @param data Raw input data
 * @returns Parsed and validated buyer parameters or validation errors
 */
export function validateBuyerParameters(data: unknown) {
  try {
    return { 
      success: true, 
      data: buyerParametersSchema.parse(data),
      errors: null
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format errors into a more usable object
      const fieldErrors = error.errors.reduce((acc, curr) => {
        const path = curr.path.join('.');
        return { ...acc, [path]: curr.message };
      }, {});
      
      return {
        success: false,
        data: null,
        errors: fieldErrors
      };
    }
    
    // Unexpected error
    return {
      success: false,
      data: null,
      errors: { _form: 'An unexpected error occurred' }
    };
  }
}

/**
 * Validation helper to parse and validate provider parameters
 * @param data Raw input data
 * @returns Parsed and validated provider parameters or validation errors
 */
export function validateProviderParameters(data: unknown) {
  try {
    return { 
      success: true, 
      data: providerParametersSchema.parse(data),
      errors: null
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format errors into a more usable object
      const fieldErrors = error.errors.reduce((acc, curr) => {
        const path = curr.path.join('.');
        return { ...acc, [path]: curr.message };
      }, {});
      
      return {
        success: false,
        data: null,
        errors: fieldErrors
      };
    }
    
    // Unexpected error
    return {
      success: false,
      data: null,
      errors: { _form: 'An unexpected error occurred' }
    };
  }
} 