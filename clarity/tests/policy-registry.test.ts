/// <reference path="./types.d.ts" />

import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";
import { initSimnet } from "@hirosystems/clarinet-sdk";

// Initialize simnet using top-level await (ES modules support this)
const simnet = await initSimnet();

// Get accounts for testing
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const policyBuyer = accounts.get("wallet_1")!;
const anotherBuyer = accounts.get("wallet_2")!;
const counterparty = accounts.get("wallet_3")!;
const unauthorizedUser = accounts.get("wallet_4")!;

// Constants from the contract
const STATUS_ACTIVE = "Active";
const STATUS_EXERCISED = "Exercised";
const STATUS_EXPIRED = "Expired";
const POLICY_TYPE_PUT = "PUT";
const POLICY_TYPE_CALL = "CALL";

// Helper to implement custom matchers that handle Clarity responses
expect.extend({
  toBeOk(received: any, expected: any) {
    const pass = received.isOk && this.equals(received.value, expected);
    return {
      pass,
      message: () => `expected ${received} ${pass ? 'not to be' : 'to be'} ok with value ${expected}`,
    };
  },
  toBeErr(received: any, expected: any) {
    const pass = received.isErr && this.equals(received.value, expected);
    return {
      pass,
      message: () => `expected ${received} ${pass ? 'not to be' : 'to be'} err with value ${expected}`,
    };
  },
});

// Define test suite for policy-registry contract
describe("policy-registry contract", () => {
  // Helper to create a policy for testing
  const createTestPolicy = async (
    owner = policyBuyer,
    policy_type = POLICY_TYPE_PUT,
    protected_value = 50000 * 1e8, // 50,000 satoshis per STX
    protection_amount = 1000 * 1e8, // 1,000 STX
    expiration_blocks_from_now = 1000
  ) => {
    const currentBlockHeight = simnet.blockHeight;
    const expiration_height = currentBlockHeight + expiration_blocks_from_now;
    const premium = Math.floor(protection_amount * 0.05); // Example: 5% premium

    const response = await simnet.callPublicFn(
      "policy-registry",
      "create-policy-entry",
      [
        Cl.principal(owner),
        Cl.principal(counterparty),
        Cl.uint(protected_value),
        Cl.uint(protection_amount),
        Cl.uint(expiration_height),
        Cl.uint(premium),
        Cl.stringAscii(policy_type)
      ],
      owner
    );
    
    return { response, expiration_height };
  };

  // Helper to check if a policy exists and has expected values
  const verifyPolicyExists = async (policyId: number, expectedOwner: string, expectedStatus = STATUS_ACTIVE) => {
    const response = await simnet.callReadOnlyFn(
      "policy-registry",
      "get-policy",
      [Cl.uint(policyId)],
      deployer
    );
    
    expect(response.result).not.toBeNull();
    if (response.result) {
      const policy = response.result.value;
      expect(policy.owner.value).toBe(expectedOwner);
      expect(policy.status.value).toBe(expectedStatus);
    }
  };

  describe("policy creation", () => {
    it("creates a PUT policy successfully", async () => {
      const { response } = await createTestPolicy(policyBuyer, POLICY_TYPE_PUT);
      expect(response.result).toBeOk(Cl.uint(0)); // First policy should have ID 0
      
      await verifyPolicyExists(0, policyBuyer);
    });

    it("creates a CALL policy successfully", async () => {
      const { response } = await createTestPolicy(policyBuyer, POLICY_TYPE_CALL);
      expect(response.result).toBeOk(Cl.uint(0)); // First policy should have ID 0
      
      await verifyPolicyExists(0, policyBuyer);
    });

    it("assigns sequential IDs to policies", async () => {
      // Create first policy
      const { response: response1 } = await createTestPolicy(policyBuyer);
      expect(response1.result).toBeOk(Cl.uint(0));
      
      // Create second policy
      const { response: response2 } = await createTestPolicy(anotherBuyer);
      expect(response2.result).toBeOk(Cl.uint(1));
      
      // Verify both policies exist
      await verifyPolicyExists(0, policyBuyer);
      await verifyPolicyExists(1, anotherBuyer);
    });

    it("rejects policy with invalid policy type", async () => {
      const currentBlockHeight = simnet.blockHeight;
      const expiration_height = currentBlockHeight + 1000;
      const protected_value = 50000 * 1e8;
      const protection_amount = 1000 * 1e8;
      const premium = Math.floor(protection_amount * 0.05);

      const response = await simnet.callPublicFn(
        "policy-registry",
        "create-policy-entry",
        [
          Cl.principal(policyBuyer),
          Cl.principal(counterparty),
          Cl.uint(protected_value),
          Cl.uint(protection_amount),
          Cl.uint(expiration_height),
          Cl.uint(premium),
          Cl.stringAscii("INVALID") // Invalid policy type
        ],
        policyBuyer
      );
      
      expect(response.result).toBeErr(Cl.uint(1001)); // ERR-INVALID-POLICY-TYPE
    });

    it("rejects policy with zero protected value", async () => {
      const currentBlockHeight = simnet.blockHeight;
      const expiration_height = currentBlockHeight + 1000;
      const protection_amount = 1000 * 1e8;
      const premium = Math.floor(protection_amount * 0.05);

      const response = await simnet.callPublicFn(
        "policy-registry",
        "create-policy-entry",
        [
          Cl.principal(policyBuyer),
          Cl.principal(counterparty),
          Cl.uint(0), // Zero protected value
          Cl.uint(protection_amount),
          Cl.uint(expiration_height),
          Cl.uint(premium),
          Cl.stringAscii(POLICY_TYPE_PUT)
        ],
        policyBuyer
      );
      
      expect(response.result).toBeErr(Cl.uint(1002)); // ERR-ZERO-PROTECTED-VALUE
    });

    it("rejects policy with zero protection amount", async () => {
      const currentBlockHeight = simnet.blockHeight;
      const expiration_height = currentBlockHeight + 1000;
      const protected_value = 50000 * 1e8;
      const premium = 1000000; // Some premium value

      const response = await simnet.callPublicFn(
        "policy-registry",
        "create-policy-entry",
        [
          Cl.principal(policyBuyer),
          Cl.principal(counterparty),
          Cl.uint(protected_value),
          Cl.uint(0), // Zero protection amount
          Cl.uint(expiration_height),
          Cl.uint(premium),
          Cl.stringAscii(POLICY_TYPE_PUT)
        ],
        policyBuyer
      );
      
      expect(response.result).toBeErr(Cl.uint(1003)); // ERR-ZERO-PROTECTION-AMOUNT
    });

    it("rejects policy with expiration in the past", async () => {
      const currentBlockHeight = simnet.blockHeight;
      const expiration_height = currentBlockHeight - 1; // Past expiration
      const protected_value = 50000 * 1e8;
      const protection_amount = 1000 * 1e8;
      const premium = Math.floor(protection_amount * 0.05);

      const response = await simnet.callPublicFn(
        "policy-registry",
        "create-policy-entry",
        [
          Cl.principal(policyBuyer),
          Cl.principal(counterparty),
          Cl.uint(protected_value),
          Cl.uint(protection_amount),
          Cl.uint(expiration_height),
          Cl.uint(premium),
          Cl.stringAscii(POLICY_TYPE_PUT)
        ],
        policyBuyer
      );
      
      expect(response.result).toBeErr(Cl.uint(1004)); // ERR-EXPIRATION-IN-PAST
    });
  });

  describe("policy status updates", () => {
    beforeEach(async () => {
      // Create a policy before each test in this group
      await createTestPolicy(policyBuyer);
    });

    it("allows policy owner to exercise an active policy", async () => {
      const response = await simnet.callPublicFn(
        "policy-registry",
        "update-policy-status",
        [Cl.uint(0), Cl.stringAscii(STATUS_EXERCISED)],
        policyBuyer // Policy owner
      );
      
      expect(response.result).toBeOk(Cl.bool(true));
      
      // Verify policy status is updated
      await verifyPolicyExists(0, policyBuyer, STATUS_EXERCISED);
    });

    it("prevents non-owner from exercising a policy", async () => {
      const response = await simnet.callPublicFn(
        "policy-registry",
        "update-policy-status",
        [Cl.uint(0), Cl.stringAscii(STATUS_EXERCISED)],
        unauthorizedUser // Not the owner
      );
      
      expect(response.result).toBeErr(Cl.uint(401)); // ERR-UNAUTHORIZED
      
      // Verify policy status is still active
      await verifyPolicyExists(0, policyBuyer, STATUS_ACTIVE);
    });

    it("allows backend authorized principal to expire a policy", async () => {
      // First, advance blocks to simulate policy expiration
      const { expiration_height } = await createTestPolicy(policyBuyer);
      const blocksToMine = (expiration_height - simnet.blockHeight) + 1;
      simnet.mineEmptyBlocks(blocksToMine);
      
      const response = await simnet.callPublicFn(
        "policy-registry",
        "update-policy-status",
        [Cl.uint(0), Cl.stringAscii(STATUS_EXPIRED)],
        deployer // Contract deployer is the default backend authorized principal
      );
      
      expect(response.result).toBeOk(Cl.bool(true));
      
      // Verify policy status is updated
      await verifyPolicyExists(0, policyBuyer, STATUS_EXPIRED);
    });

    it("prevents backend from expiring a policy before expiration", async () => {
      // Policy is not yet expired
      const response = await simnet.callPublicFn(
        "policy-registry",
        "update-policy-status",
        [Cl.uint(0), Cl.stringAscii(STATUS_EXPIRED)],
        deployer // Contract deployer is the default backend authorized principal
      );
      
      expect(response.result).toBeErr(Cl.uint(401)); // ERR-UNAUTHORIZED
      
      // Verify policy status is still active
      await verifyPolicyExists(0, policyBuyer, STATUS_ACTIVE);
    });

    it("allows changing the backend authorized principal", async () => {
      // Set a new backend authorized principal
      const setResponse = await simnet.callPublicFn(
        "policy-registry",
        "set-backend-authorized-principal",
        [Cl.principal(unauthorizedUser)],
        deployer // Contract owner
      );
      
      expect(setResponse.result).toBeOk(Cl.bool(true));
      
      // Advance blocks to simulate policy expiration
      const { expiration_height } = await createTestPolicy(policyBuyer);
      const blocksToMine = (expiration_height - simnet.blockHeight) + 1;
      simnet.mineEmptyBlocks(blocksToMine);
      
      // Now the new principal should be able to expire the policy
      const expireResponse = await simnet.callPublicFn(
        "policy-registry",
        "update-policy-status",
        [Cl.uint(0), Cl.stringAscii(STATUS_EXPIRED)],
        unauthorizedUser // New backend authorized principal
      );
      
      expect(expireResponse.result).toBeOk(Cl.bool(true));
      
      // Verify policy status is updated
      await verifyPolicyExists(0, policyBuyer, STATUS_EXPIRED);
    });
  });

  describe("policy lookup functions", () => {
    beforeEach(async () => {
      // Create policies before each test in this group
      await createTestPolicy(policyBuyer, POLICY_TYPE_PUT);
      await createTestPolicy(policyBuyer, POLICY_TYPE_CALL);
      await createTestPolicy(anotherBuyer, POLICY_TYPE_PUT);
    });

    it("returns correct policy information by ID", async () => {
      const response = await simnet.callReadOnlyFn(
        "policy-registry",
        "get-policy",
        [Cl.uint(0)],
        deployer
      );
      
      const policy = response.result.value;
      expect(policy.owner.value).toBe(policyBuyer);
      expect(policy['policy-type'].value).toBe(POLICY_TYPE_PUT);
      expect(policy.status.value).toBe(STATUS_ACTIVE);
    });

    it("returns policy IDs for a specific owner", async () => {
      const response = await simnet.callReadOnlyFn(
        "policy-registry",
        "get-policy-ids-by-owner",
        [Cl.principal(policyBuyer)],
        deployer
      );
      
      const result = response.result.value;
      const policyIds = result['policy-ids'];
      
      // Should have 2 policies for policyBuyer
      expect(policyIds.length).toBe(2);
      expect(policyIds[0].value).toBe(BigInt(0));
      expect(policyIds[1].value).toBe(BigInt(1));
    });

    it("returns correct active status for policies", async () => {
      // Check active policy
      let response = await simnet.callReadOnlyFn(
        "policy-registry",
        "is-policy-active",
        [Cl.uint(0)],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.bool(true));
      
      // Exercise policy 0
      await simnet.callPublicFn(
        "policy-registry",
        "update-policy-status",
        [Cl.uint(0), Cl.stringAscii(STATUS_EXERCISED)],
        policyBuyer
      );
      
      // Check exercised policy
      response = await simnet.callReadOnlyFn(
        "policy-registry",
        "is-policy-active",
        [Cl.uint(0)],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.bool(false));
    });

    it("correctly identifies exercisable policies based on current price", async () => {
      // For a PUT policy, it's exercisable if current price < protected value
      const putPolicy = 0; // Policy ID 0 is a PUT
      const putProtectedValue = 50000 * 1e8; // From the test policy creation
      
      // Price below protected value - should be exercisable
      let response = await simnet.callReadOnlyFn(
        "policy-registry",
        "is-policy-exercisable",
        [Cl.uint(putPolicy), Cl.uint(putProtectedValue - 5000 * 1e8)],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.bool(true));
      
      // Price above protected value - should not be exercisable
      response = await simnet.callReadOnlyFn(
        "policy-registry",
        "is-policy-exercisable",
        [Cl.uint(putPolicy), Cl.uint(putProtectedValue + 5000 * 1e8)],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.bool(false));
      
      // For a CALL policy, it's exercisable if current price > protected value
      const callPolicy = 1; // Policy ID 1 is a CALL
      const callProtectedValue = 50000 * 1e8; // From the test policy creation
      
      // Price above protected value - should be exercisable
      response = await simnet.callReadOnlyFn(
        "policy-registry",
        "is-policy-exercisable",
        [Cl.uint(callPolicy), Cl.uint(callProtectedValue + 5000 * 1e8)],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.bool(true));
      
      // Price below protected value - should not be exercisable
      response = await simnet.callReadOnlyFn(
        "policy-registry",
        "is-policy-exercisable",
        [Cl.uint(callPolicy), Cl.uint(callProtectedValue - 5000 * 1e8)],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.bool(false));
    });

    it("calculates correct settlement amount for PUT policies", async () => {
      const putPolicy = 0; // Policy ID 0 is a PUT
      const putProtectedValue = 50000 * 1e8; // From the test policy creation
      const protectionAmount = 1000 * 1e8; // From the test policy creation
      
      // Current price is 20% below protected value
      const currentPrice = putProtectedValue * 0.8;
      
      // Expected settlement: (Strike - Current) * ProtectionAmount / Strike
      // = (50000 - 40000) * 1000 / 50000 = 10000 * 1000 / 50000 = 200 STX
      const expectedSettlement = Math.floor((putProtectedValue - currentPrice) * protectionAmount / putProtectedValue);
      
      const response = await simnet.callReadOnlyFn(
        "policy-registry",
        "calculate-settlement-amount",
        [Cl.uint(putPolicy), Cl.uint(currentPrice)],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.uint(expectedSettlement));
    });

    it("calculates correct settlement amount for CALL policies", async () => {
      const callPolicy = 1; // Policy ID 1 is a CALL
      const callProtectedValue = 50000 * 1e8; // From the test policy creation
      const protectionAmount = 1000 * 1e8; // From the test policy creation
      
      // Current price is 20% above protected value
      const currentPrice = callProtectedValue * 1.2;
      
      // Expected settlement: (Current - Strike) * ProtectionAmount / Strike
      // = (60000 - 50000) * 1000 / 50000 = 10000 * 1000 / 50000 = 200 STX
      const expectedSettlement = Math.floor((currentPrice - callProtectedValue) * protectionAmount / callProtectedValue);
      
      const response = await simnet.callReadOnlyFn(
        "policy-registry",
        "calculate-settlement-amount",
        [Cl.uint(callPolicy), Cl.uint(currentPrice)],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.uint(expectedSettlement));
    });

    it("returns 0 settlement for put policies when price above strike", async () => {
      const putPolicy = 0; // Policy ID 0 is a PUT
      const putProtectedValue = 50000 * 1e8; // From the test policy creation
      
      // Current price is above protected value - should return 0 settlement
      const currentPrice = putProtectedValue * 1.2;
      
      const response = await simnet.callReadOnlyFn(
        "policy-registry",
        "calculate-settlement-amount",
        [Cl.uint(putPolicy), Cl.uint(currentPrice)],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.uint(0));
    });

    it("returns 0 settlement for call policies when price below strike", async () => {
      const callPolicy = 1; // Policy ID 1 is a CALL
      const callProtectedValue = 50000 * 1e8; // From the test policy creation
      
      // Current price is below protected value - should return 0 settlement
      const currentPrice = callProtectedValue * 0.8;
      
      const response = await simnet.callReadOnlyFn(
        "policy-registry",
        "calculate-settlement-amount",
        [Cl.uint(callPolicy), Cl.uint(currentPrice)],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.uint(0));
    });
  });

  describe("batch operations", () => {
    it("allows backend to call batch expire function", async () => {
      // Create a policy
      await createTestPolicy(policyBuyer);
      
      // Use a simple approach that should work at runtime even if linter complains
      const response = await simnet.callPublicFn(
        "policy-registry",
        "expire-policies-batch",
        [Cl.list([Cl.uint(0)])], // Simple list with one policy ID
        deployer // Contract deployer is the default backend authorized principal
      );
      
      expect(response.result).toBeOk(Cl.bool(true));
    });

    it("prevents unauthorized principal from calling batch expire", async () => {
      const response = await simnet.callPublicFn(
        "policy-registry",
        "expire-policies-batch",
        [Cl.list([Cl.uint(0)])], // Simple list with one policy ID
        unauthorizedUser // Not authorized
      );
      
      expect(response.result).toBeErr(Cl.uint(401)); // ERR-UNAUTHORIZED
    });
  });
}); 