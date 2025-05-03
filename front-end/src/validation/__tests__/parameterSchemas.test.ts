import '@testing-library/jest-dom';
import { 
  buyerParametersSchema, 
  providerParametersSchema,
  validateBuyerParameters,
  validateProviderParameters
} from '../parameterSchemas';

describe('Parameter Validation Schemas', () => {
  describe('buyerParametersSchema', () => {
    it('should validate valid buyer parameters', () => {
      const validParams = {
        coverageAmount: 1.5,
        strikePrice: 50000,
        premium: 0.05,
        durationDays: 30,
        bitcoinPrice: 60000
      };
      
      expect(() => buyerParametersSchema.parse(validParams)).not.toThrow();
    });
    
    it('should reject negative coverage amount', () => {
      const invalidParams = {
        coverageAmount: -1,
        strikePrice: 50000,
        premium: 0.05,
        durationDays: 30,
        bitcoinPrice: 60000
      };
      
      expect(() => buyerParametersSchema.parse(invalidParams)).toThrow();
    });
    
    it('should reject coverage amount exceeding limit', () => {
      const invalidParams = {
        coverageAmount: 150, // Exceeds 100 BTC limit
        strikePrice: 50000,
        premium: 0.05,
        durationDays: 30,
        bitcoinPrice: 60000
      };
      
      expect(() => buyerParametersSchema.parse(invalidParams)).toThrow();
    });
    
    it('should reject non-positive strike price', () => {
      const invalidParams = {
        coverageAmount: 1.5,
        strikePrice: 0,
        premium: 0.05,
        durationDays: 30,
        bitcoinPrice: 60000
      };
      
      expect(() => buyerParametersSchema.parse(invalidParams)).toThrow();
    });
    
    it('should reject non-integer duration days', () => {
      const invalidParams = {
        coverageAmount: 1.5,
        strikePrice: 50000,
        premium: 0.05,
        durationDays: 30.5,
        bitcoinPrice: 60000
      };
      
      expect(() => buyerParametersSchema.parse(invalidParams)).toThrow();
    });
    
    it('should reject duration exceeding 365 days', () => {
      const invalidParams = {
        coverageAmount: 1.5,
        strikePrice: 50000,
        premium: 0.05,
        durationDays: 366,
        bitcoinPrice: 60000
      };
      
      expect(() => buyerParametersSchema.parse(invalidParams)).toThrow();
    });
  });
  
  describe('providerParametersSchema', () => {
    it('should validate valid provider parameters', () => {
      const validParams = {
        liquidityAmount: 10,
        riskTolerance: 0.5,
        expectedYield: 0.1,
        lockPeriodDays: 90,
        bitcoinPrice: 60000
      };
      
      expect(() => providerParametersSchema.parse(validParams)).not.toThrow();
    });
    
    it('should reject negative liquidity amount', () => {
      const invalidParams = {
        liquidityAmount: -5,
        riskTolerance: 0.5,
        expectedYield: 0.1,
        lockPeriodDays: 90,
        bitcoinPrice: 60000
      };
      
      expect(() => providerParametersSchema.parse(invalidParams)).toThrow();
    });
    
    it('should reject liquidity amount exceeding limit', () => {
      const invalidParams = {
        liquidityAmount: 1500, // Exceeds 1000 BTC limit
        riskTolerance: 0.5,
        expectedYield: 0.1,
        lockPeriodDays: 90,
        bitcoinPrice: 60000
      };
      
      expect(() => providerParametersSchema.parse(invalidParams)).toThrow();
    });
    
    it('should reject risk tolerance outside valid range', () => {
      const negativeRisk = {
        liquidityAmount: 10,
        riskTolerance: -0.1,
        expectedYield: 0.1,
        lockPeriodDays: 90,
        bitcoinPrice: 60000
      };
      
      const excessiveRisk = {
        liquidityAmount: 10,
        riskTolerance: 1.1,
        expectedYield: 0.1,
        lockPeriodDays: 90,
        bitcoinPrice: 60000
      };
      
      expect(() => providerParametersSchema.parse(negativeRisk)).toThrow();
      expect(() => providerParametersSchema.parse(excessiveRisk)).toThrow();
    });
    
    it('should reject non-integer lock period days', () => {
      const invalidParams = {
        liquidityAmount: 10,
        riskTolerance: 0.5,
        expectedYield: 0.1,
        lockPeriodDays: 90.5,
        bitcoinPrice: 60000
      };
      
      expect(() => providerParametersSchema.parse(invalidParams)).toThrow();
    });
    
    it('should reject lock period exceeding 365 days', () => {
      const invalidParams = {
        liquidityAmount: 10,
        riskTolerance: 0.5,
        expectedYield: 0.1,
        lockPeriodDays: 400,
        bitcoinPrice: 60000
      };
      
      expect(() => providerParametersSchema.parse(invalidParams)).toThrow();
    });
  });
  
  describe('validateBuyerParameters', () => {
    it('should return success for valid parameters', () => {
      const validParams = {
        coverageAmount: 1.5,
        strikePrice: 50000,
        premium: 0.05,
        durationDays: 30,
        bitcoinPrice: 60000
      };
      
      const result = validateBuyerParameters(validParams);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validParams);
      expect(result.errors).toBeNull();
    });
    
    it('should return formatted errors for invalid parameters', () => {
      const invalidParams = {
        coverageAmount: -1,
        strikePrice: 0,
        premium: 0.05,
        durationDays: 400,
        bitcoinPrice: 60000
      };
      
      const result = validateBuyerParameters(invalidParams);
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.errors).toBeTruthy();
      expect(Object.keys(result.errors || {})).toContain('coverageAmount');
    });
  });
  
  describe('validateProviderParameters', () => {
    it('should return success for valid parameters', () => {
      const validParams = {
        liquidityAmount: 10,
        riskTolerance: 0.5,
        expectedYield: 0.1,
        lockPeriodDays: 90,
        bitcoinPrice: 60000
      };
      
      const result = validateProviderParameters(validParams);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validParams);
      expect(result.errors).toBeNull();
    });
    
    it('should return formatted errors for invalid parameters', () => {
      const invalidParams = {
        liquidityAmount: -5,
        riskTolerance: 1.5,
        expectedYield: 0.1,
        lockPeriodDays: 400,
        bitcoinPrice: 60000
      };
      
      const result = validateProviderParameters(invalidParams);
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.errors).toBeTruthy();
      expect(Object.keys(result.errors || {})).toContain('liquidityAmount');
      expect(Object.keys(result.errors || {})).toContain('riskTolerance');
    });
  });
}); 