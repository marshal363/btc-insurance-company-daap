import { expect, vi, beforeEach, describe, test } from 'vitest';
import * as writer from "../../blockchain/policyRegistry/writer";
import * as reader from "../../blockchain/policyRegistry/reader";

// Import the functions for reference but access handlers directly in tests
import { createPolicyCreationTransaction, verifyPolicyOnChain } from '../blockchainIntegration';

// Mock the blockchain modules
vi.mock('../../blockchain/policyRegistry/writer', () => ({
  buildPolicyCreationTransaction: vi.fn(),
}));

vi.mock('../../blockchain/policyRegistry/reader', () => ({
  getPolicyById: vi.fn(),
}));

describe('Policy Registry Blockchain Integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('createPolicyCreationTransaction converts parameters correctly', async () => {
    // Setup mock response
    const mockTxResponse = {
      txid: 'mock-txid-12345',
      status: 'pending'
    };
    
    (writer.buildPolicyCreationTransaction as any).mockResolvedValue(mockTxResponse);

    // Create test parameters
    const params = {
      owner: 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5',
      counterparty: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
      protectedValueUSD: 25000,
      protectionAmountBTC: 1.0,
      policyType: 'PUT',
      positionType: 'LONG_PUT',
      durationDays: 30,
      premiumUSD: 1500,
      collateralToken: 'STX',
      settlementToken: 'STX',
      expirationHeight: 100000
    };

    // Create mock context
    const ctx = {} as any;

    // Call the function - access the handler directly
    const result = await (createPolicyCreationTransaction as any).implementation(ctx, { params });

    // Verify the result
    expect(result.txResponse).toEqual(mockTxResponse);
    expect(result.params).toMatchObject({
      policyType: 'PUT',
      positionType: 'LONG_PUT',
      owner: 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5',
      counterparty: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
      strikePrice: 25000,
      amount: 1.0,
      premium: 1500,
      expirationHeight: 100000,
      collateralToken: 'STX',
      settlementToken: 'STX',
      network: 'devnet'
    });

    // Verify the writer function was called correctly
    expect(writer.buildPolicyCreationTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        policyType: 'PUT',
        positionType: 'LONG_PUT',
        owner: 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5',
        network: 'devnet'
      })
    );
  });

  test('verifyPolicyOnChain returns policy status correctly', async () => {
    // Setup mock response
    const mockPolicy = {
      id: 'policy-123',
      owner: 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5',
      status: 'Active'
    };
    
    (reader.getPolicyById as any).mockResolvedValue({
      success: true,
      data: mockPolicy
    });

    // Create mock context
    const ctx = {} as any;

    // Call the function - access the handler directly
    const result = await (verifyPolicyOnChain as any).implementation(ctx, { policyId: 'policy-123' });

    // Verify the result
    expect(result.exists).toBe(true);
    expect(result.policy).toEqual(mockPolicy);
    
    // Verify the reader function was called correctly
    expect(reader.getPolicyById).toHaveBeenCalledWith('policy-123');
  });

  test('verifyPolicyOnChain handles non-existent policies', async () => {
    // Setup mock response for failed lookup
    (reader.getPolicyById as any).mockResolvedValue({
      success: false,
      error: 'Policy not found'
    });

    // Create mock context
    const ctx = {} as any;

    // Call the function - access the handler directly
    const result = await (verifyPolicyOnChain as any).implementation(ctx, { policyId: 'non-existent' });

    // Verify the result
    expect(result.exists).toBe(false);
    expect(result.policy).toBeNull();
    
    // Verify the reader function was called correctly
    expect(reader.getPolicyById).toHaveBeenCalledWith('non-existent');
  });
}); 