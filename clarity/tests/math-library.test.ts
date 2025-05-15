import { describe, it, expect, beforeEach } from 'vitest';
import { Cl, ClarityType, cvToString, uintCV, intCV } from '@stacks/transactions';
// import { Chain, Account, Tx, types } from '@hirosystems/clarinet-sdk'; // Assuming these are globally available or configured elsewhere

declare var Chain: any; // Assume Chain is globally available
declare var Account: any; // Assume Account is globally available
declare var Tx: any; // Assume Tx is globally available
declare var types: any; // Assume types is globally available

const CONTRACT_NAME = 'math-library';

// Default addresses
let deployer: any;
let wallet1: any;

const MAX_U128 = 18446744073709551615n; // 2**64 - 1, used for testing scaled numbers if they represent u64 under the hood
const SCALE_FACTOR = 1_000_000; // Assuming 10^6, adjust if different

describe('MathLibraryContract: Deployment', () => {
  let chain: any;

  beforeEach(() => {
    chain = new Chain();
    deployer = chain.getAccount('deployer');
    wallet1 = chain.getAccount('wallet_1');
    chain.deployContract(CONTRACT_NAME, CONTRACT_NAME, deployer.address);
  });

  it('should deploy successfully', () => {
    const { contracts } = chain.getDeployment();
    expect(contracts.has(CONTRACT_NAME)).toBe(true);
  });
});

describe('MathLibraryContract: Core Math Functions', () => {
  let chain: any;

  beforeEach(() => {
    chain = new Chain();
    deployer = chain.getAccount('deployer');
    wallet1 = chain.getAccount('wallet_1');
    chain.deployContract(CONTRACT_NAME, CONTRACT_NAME, deployer.address);
  });

  // ML-101: power (uint uint) -> uint
  describe('power (ML-101)', () => {
    it('should calculate base to the power of exponent correctly', () => {
      const result = chain.callReadOnlyFn(CONTRACT_NAME, 'power', [uintCV(2), uintCV(3)], deployer.address);
      result.result.expectOk().expectUint(8);

      const result2 = chain.callReadOnlyFn(CONTRACT_NAME, 'power', [uintCV(5), uintCV(0)], deployer.address);
      result2.result.expectOk().expectUint(1);

      const result3 = chain.callReadOnlyFn(CONTRACT_NAME, 'power', [uintCV(10), uintCV(2)], deployer.address);
      result3.result.expectOk().expectUint(100);
    });

    it('should handle power of 0 correctly', () => {
      const result = chain.callReadOnlyFn(CONTRACT_NAME, 'power', [uintCV(0), uintCV(5)], deployer.address);
      result.result.expectOk().expectUint(0);
    });

    it('should handle large numbers within uint limits for power', () => {
      // 2^60 (within u128 limits)
      const result = chain.callReadOnlyFn(CONTRACT_NAME, 'power', [uintCV(2), uintCV(60)], deployer.address);
      result.result.expectOk().expectUint(1152921504606846976n); 
    });
  });

  // ML-102: multiply-decimals (uint uint) -> uint
  describe('multiply-decimals (ML-102)', () => {
    it('should multiply two scaled numbers correctly', () => {
      // (2.5 * 10^6) * (3.0 * 10^6) / 10^6 = 7.5 * 10^6
      const val1 = uintCV(2.5 * SCALE_FACTOR);
      const val2 = uintCV(3 * SCALE_FACTOR);
      const result = chain.callReadOnlyFn(CONTRACT_NAME, 'multiply-decimals', [val1, val2], deployer.address);
      result.result.expectOk().expectUint(7.5 * SCALE_FACTOR);
    });

    it('should handle multiplication resulting in zero', () => {
      const val1 = uintCV(0);
      const val2 = uintCV(3000000);
      const result = chain.callReadOnlyFn(CONTRACT_NAME, 'multiply-decimals', [val1, val2], deployer.address);
      result.result.expectOk().expectUint(0);
    });

    it('should handle small fractional results correctly (truncation)', () => {
       // (0.001 * 10^6) * (0.002 * 10^6) / 10^6 = 0.000002 * 10^6 = 2
      const val1 = uintCV(0.001 * SCALE_FACTOR);
      const val2 = uintCV(0.002 * SCALE_FACTOR);
      const result = chain.callReadOnlyFn(CONTRACT_NAME, 'multiply-decimals', [val1, val2], deployer.address);
      result.result.expectOk().expectUint(2); // (1000 * 2000) / 1000000 = 2
    });
  });

  // ML-103: divide-decimals (uint uint) -> uint
  describe('divide-decimals (ML-103)', () => {
    it('should divide two scaled numbers correctly', () => {
      // (7.5 * 10^6) / (2.5 * 10^6) * 10^6 / 10^6 = 3.0 * 10^6
      const val1 = uintCV(7.5 * SCALE_FACTOR);
      const val2 = uintCV(2.5 * SCALE_FACTOR);
      const result = chain.callReadOnlyFn(CONTRACT_NAME, 'divide-decimals', [val1, val2], deployer.address);
      result.result.expectOk().expectUint(3 * SCALE_FACTOR);
    });

    it('should handle division by a larger number (fractional result)', () => {
      // (2.5 * 10^6) / (5.0 * 10^6) = 0.5 * 10^6
      const val1 = uintCV(2.5 * SCALE_FACTOR);
      const val2 = uintCV(5 * SCALE_FACTOR);
      const result = chain.callReadOnlyFn(CONTRACT_NAME, 'divide-decimals', [val1, val2], deployer.address);
      result.result.expectOk().expectUint(0.5 * SCALE_FACTOR);
    });

    it('should return ERR_DIVISION_BY_ZERO if divisor is zero', () => {
      const val1 = uintCV(2.5 * SCALE_FACTOR);
      const val2 = uintCV(0);
      const result = chain.callReadOnlyFn(CONTRACT_NAME, 'divide-decimals', [val1, val2], deployer.address);
      result.result.expectErr().expectUint(1); // Assuming ERR-DIVISION-BY-ZERO is u1 in math-library
    });
  });

  // ML-104: percentage (uint uint) -> uint
  describe('calculate-percentage (ML-104)', () => {
    it('should calculate percentage of a value correctly', () => {
      // 10% of 200 = 20
      const value = uintCV(200 * SCALE_FACTOR); // 200.000000
      const percentageBasisPoints = uintCV(1000); // 10.00% (1000 / 100)
      const result = chain.callReadOnlyFn(CONTRACT_NAME, 'calculate-percentage', [value, percentageBasisPoints], deployer.address);
      result.result.expectOk().expectUint(20 * SCALE_FACTOR);
    });

    it('should calculate 0% correctly', () => {
      const value = uintCV(200 * SCALE_FACTOR);
      const percentageBasisPoints = uintCV(0); // 0%
      const result = chain.callReadOnlyFn(CONTRACT_NAME, 'calculate-percentage', [value, percentageBasisPoints], deployer.address);
      result.result.expectOk().expectUint(0);
    });

    it('should calculate 100% correctly', () => {
      const value = uintCV(200 * SCALE_FACTOR);
      const percentageBasisPoints = uintCV(10000); // 100.00%
      const result = chain.callReadOnlyFn(CONTRACT_NAME, 'calculate-percentage', [value, percentageBasisPoints], deployer.address);
      result.result.expectOk().expectUint(200 * SCALE_FACTOR);
    });

    it('should handle small percentages and fractional results (truncation)', () => {
      // 0.5% of 123.456789
      // (123456789 * 50) / 1000000 (internal to func) = 6172839.45 / 1000000 = 6172839 (value * percentageBasisPoints / BASIS_POINT_SCALE)
      // then / SCALE_FACTOR if the value itself has scale
      // The function calculate-percentage in math-library.clar does: (value * percentage-basis-points) / u10000
      // So, (123456789 * 50) / 10000 = 6172839450 / 10000 = 617283 (assuming value is scaled)
      const value = uintCV(123456789); // Represents 123.456789
      const percentageBasisPoints = uintCV(50); // 0.50%
      const result = chain.callReadOnlyFn(CONTRACT_NAME, 'calculate-percentage', [value, percentageBasisPoints], deployer.address);
      // Expected: (123456789 * 50) / 10000 = 617283 (integer division)
      result.result.expectOk().expectUint(617283); 
    });
  });
}); 