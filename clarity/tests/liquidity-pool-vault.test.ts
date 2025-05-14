/// <reference path="./types.d.ts" />

import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";
import { initSimnet } from "@hirosystems/clarinet-sdk";

// Initialize simnet using top-level await (ES modules support this)
const simnet = await initSimnet();

// Get accounts for testing
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const provider1 = accounts.get("wallet_1")!;
const provider2 = accounts.get("wallet_2")!;
const policyBuyer = accounts.get("wallet_3")!;
const unauthorizedUser = accounts.get("wallet_4")!;

// Helper function to get STX balance
function getCurrentStxBalance(address: string) {
  const assetsMap = simnet.getAssetsMap();
  return assetsMap.get("STX")?.get(address) || BigInt(0);
}

// Create test constants to match contract error codes
const ERR_UNAUTHORIZED = Cl.uint(401);
const ERR_NOT_ENOUGH_BALANCE = Cl.uint(402);
const ERR_INVALID_TOKEN = Cl.uint(403);
const ERR_TOKEN_NOT_INITIALIZED = Cl.uint(404);
const ERR_AMOUNT_MUST_BE_POSITIVE = Cl.uint(405);
const ERR_INSUFFICIENT_LIQUIDITY = Cl.uint(406);
const ERR_POLICY_REGISTRY_ONLY = Cl.uint(407);
const ERR_INVALID_RISK_TIER = Cl.uint(408);
const ERR_TRANSFER_FAILED = Cl.uint(500);

// Constants for risk tiers
const RISK_TIER_CONSERVATIVE = "Conservative";
const RISK_TIER_BALANCED = "Balanced";
const RISK_TIER_AGGRESSIVE = "Aggressive";

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

// Define test suite for liquidity-pool-vault contract
describe("liquidity-pool-vault contract", () => {
  // Helper to initialize a token
  const initializeToken = async (tokenId = "STX") => {
    // Create a proper none value with a 'value' property
    const noneValue = { type: 9, value: null };
    
    const response = await simnet.callPublicFn(
      "liquidity-pool-vault",
      "initialize-token",
      [Cl.stringAscii(tokenId), noneValue],
      deployer
    );
    return { response };
  };

  describe("administrative functions", () => {
    it("allows contract owner to initialize a token", async () => {
      const { response } = await initializeToken();
      expect(response.result).toBeOk(Cl.bool(true));
      
      // Verify token is initialized
      const tokenStatus = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "is-token-initialized-public",
        [Cl.stringAscii("STX")],
        deployer
      );
      
      expect(tokenStatus.result).toBe(true);
    });
    
    it("prevents non-owner from initializing a token", async () => {
      // Create a proper none value with a 'value' property
      const noneValue = { type: 9, value: null };
      
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "initialize-token",
        [Cl.stringAscii("STX"), noneValue],
        unauthorizedUser
      );
      
      expect(response.result).toBeErr(ERR_UNAUTHORIZED);
    });

    it("allows owner to set backend authorized principal", async () => {
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "set-backend-authorized-principal",
        [Cl.principal(provider1)],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.bool(true));
    });
    
    it("prevents non-owner from setting backend authorized principal", async () => {
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "set-backend-authorized-principal",
        [Cl.principal(provider1)],
        unauthorizedUser
      );
      
      expect(response.result).toBeErr(ERR_UNAUTHORIZED);
    });
    
    it("allows owner to set policy registry principal", async () => {
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "set-policy-registry-principal",
        [Cl.principal(provider2)],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.bool(true));
    });
    
    it("prevents non-owner from setting policy registry principal", async () => {
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "set-policy-registry-principal",
        [Cl.principal(provider2)],
        unauthorizedUser
      );
      
      expect(response.result).toBeErr(ERR_UNAUTHORIZED);
    });
  });

  describe("depositing capital", () => {
    beforeEach(async () => {
      // Initialize STX token before each test in this group
      await initializeToken();
    });

    it("allows a user to deposit STX capital", async () => {
      const depositAmount = 1000000000; // 1,000 STX
      const initialBalance = getCurrentStxBalance(provider1);
      
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "deposit-capital",
        [
          Cl.uint(depositAmount),
          Cl.stringAscii("STX"),
          Cl.stringAscii(RISK_TIER_CONSERVATIVE)
        ],
        provider1
      );
      
      expect(response.result).toBeOk(Cl.bool(true));
      
      // Verify provider balance decreased
      expect(getCurrentStxBalance(provider1)).toBeLessThan(initialBalance);
      
      // Verify total token balance is updated
      const totalBalance = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "get-total-token-balance",
        [Cl.stringAscii("STX")],
        provider1
      );
      
      expect(totalBalance.result).toBeOk(Cl.uint(depositAmount));
    });

    it("rejects STX deposits of zero", async () => {
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "deposit-capital",
        [
          Cl.uint(0),
          Cl.stringAscii("STX"),
          Cl.stringAscii(RISK_TIER_CONSERVATIVE)
        ],
        provider1
      );
      
      expect(response.result).toBeErr(ERR_AMOUNT_MUST_BE_POSITIVE);
    });

    it("rejects deposits with invalid risk tier", async () => {
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "deposit-capital",
        [
          Cl.uint(1000000000),
          Cl.stringAscii("STX"),
          Cl.stringAscii("InvalidTier")
        ],
        provider1
      );
      
      expect(response.result).toBeErr(ERR_INVALID_RISK_TIER);
    });
  });

  describe("withdrawing capital", () => {
    beforeEach(async () => {
      // Initialize STX token and deposit funds before each test
      await initializeToken();
      
      // Deposit some STX as provider1
      await simnet.callPublicFn(
        "liquidity-pool-vault",
        "deposit-capital",
        [
          Cl.uint(10000000000), // 10,000 STX
          Cl.stringAscii("STX"),
          Cl.stringAscii(RISK_TIER_CONSERVATIVE)
        ],
        provider1
      );
    });

    it("allows a provider to withdraw their capital", async () => {
      const withdrawAmount = 1000000000; // 1,000 STX
      const initialBalance = getCurrentStxBalance(provider1);
      
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "withdraw-capital",
        [
          Cl.uint(withdrawAmount),
          Cl.stringAscii("STX")
        ],
        provider1 // The provider withdrawing their own capital
      );
      
      expect(response.result).toBeOk(Cl.bool(true));
      
      // Verify recipient balance increased
      const newBalance = getCurrentStxBalance(provider1);
      expect(newBalance).toBeGreaterThan(initialBalance);
      
      // Verify total token balance is updated
      const totalBalance = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "get-total-token-balance",
        [Cl.stringAscii("STX")],
        provider1
      );
      
      expect(totalBalance.result).toBeOk(Cl.uint(9000000000)); // 10,000 - 1,000
    });

    it("prevents withdrawing more than available balance", async () => {
      const withdrawAmount = 15000000000; // 15,000 STX (more than the 10,000 deposited)
      
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "withdraw-capital",
        [
          Cl.uint(withdrawAmount),
          Cl.stringAscii("STX")
        ],
        provider1
      );
      
      expect(response.result).toBeErr(ERR_NOT_ENOUGH_BALANCE);
    });
  });

  describe("liquidity check", () => {
    beforeEach(async () => {
      // Initialize STX token and deposit funds before each test
      await initializeToken();
      
      // Set backend authorized principal to deployer
      await simnet.callPublicFn(
        "liquidity-pool-vault",
        "set-backend-authorized-principal",
        [Cl.principal(deployer)],
        deployer
      );
      
      // Deposit some STX as provider1
      await simnet.callPublicFn(
        "liquidity-pool-vault",
        "deposit-capital",
        [
          Cl.uint(10000000000), // 10,000 STX
          Cl.stringAscii("STX"),
          Cl.stringAscii(RISK_TIER_CONSERVATIVE)
        ],
        provider1
      );
    });

    it("confirms sufficient liquidity when available", async () => {
      const checkAmount = 5000000000; // 5,000 STX (within the 10,000 deposited)
      const currentBlockHeight = simnet.blockHeight;
      const expirationHeight = currentBlockHeight + 1000;
      
      const response = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "check-liquidity",
        [
          Cl.uint(checkAmount),
          Cl.stringAscii("STX"),
          Cl.stringAscii(RISK_TIER_CONSERVATIVE),
          Cl.uint(expirationHeight)
        ],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.bool(true));
    });

    it("reports insufficient liquidity when unavailable", async () => {
      const checkAmount = 15000000000; // 15,000 STX (more than the 10,000 deposited)
      const currentBlockHeight = simnet.blockHeight;
      const expirationHeight = currentBlockHeight + 1000;
      
      const response = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "check-liquidity",
        [
          Cl.uint(checkAmount),
          Cl.stringAscii("STX"),
          Cl.stringAscii(RISK_TIER_CONSERVATIVE),
          Cl.uint(expirationHeight)
        ],
        deployer
      );
      
      expect(response.result).toBeErr(ERR_INSUFFICIENT_LIQUIDITY);
    });
  });

  describe("collateral management", () => {
    beforeEach(async () => {
      // Initialize STX token and deposit funds before each test
      await initializeToken();
      
      // Set policy registry principal for permission checks
      await simnet.callPublicFn(
        "liquidity-pool-vault",
        "set-policy-registry-principal",
        [Cl.principal(deployer)],
        deployer
      );
      
      // Deposit some STX as provider1
      await simnet.callPublicFn(
        "liquidity-pool-vault",
        "deposit-capital",
        [
          Cl.uint(10000000000), // 10,000 STX
          Cl.stringAscii("STX"),
          Cl.stringAscii(RISK_TIER_CONSERVATIVE)
        ],
        provider1
      );
    });

    it("allows policy registry to lock collateral", async () => {
      const lockAmount = 5000000000; // 5,000 STX
      const policyId = 1;
      const currentBlockHeight = simnet.blockHeight;
      const expirationHeight = currentBlockHeight + 1000;
      
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "lock-collateral",
        [
          Cl.uint(policyId),
          Cl.uint(lockAmount),
          Cl.stringAscii("STX"),
          Cl.stringAscii(RISK_TIER_CONSERVATIVE),
          Cl.uint(expirationHeight),
          Cl.principal(policyBuyer) // The owner of the policy
        ],
        deployer // Acting as policy registry
      );
      
      expect(response.result).toBeOk(Cl.bool(true));
      
      // Verify locked amount is updated
      const lockedAmount = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "get-locked-collateral",
        [Cl.stringAscii("STX")],
        deployer
      );
      
      expect(lockedAmount.result).toBeOk(Cl.uint(lockAmount));
      
      // Verify available balance is reduced
      const availableBalance = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "get-available-balance",
        [Cl.stringAscii("STX")],
        deployer
      );
      
      expect(availableBalance.result).toBeOk(Cl.uint(5000000000)); // 10,000 - 5,000
    });

    it("prevents non-policy-registry from locking collateral", async () => {
      const lockAmount = 5000000000; // 5,000 STX
      const policyId = 1;
      const currentBlockHeight = simnet.blockHeight;
      const expirationHeight = currentBlockHeight + 1000;
      
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "lock-collateral",
        [
          Cl.uint(policyId),
          Cl.uint(lockAmount),
          Cl.stringAscii("STX"),
          Cl.stringAscii(RISK_TIER_CONSERVATIVE),
          Cl.uint(expirationHeight),
          Cl.principal(policyBuyer) // The owner of the policy
        ],
        unauthorizedUser // Not the policy registry
      );
      
      expect(response.result).toBeErr(ERR_POLICY_REGISTRY_ONLY);
    });

    it("records premium payments correctly", async () => {
      const premiumAmount = 500000000; // 500 STX
      const policyId = 1;
      const currentBlockHeight = simnet.blockHeight;
      const expirationHeight = currentBlockHeight + 1000;
      
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "record-premium-payment",
        [
          Cl.uint(policyId),
          Cl.uint(premiumAmount),
          Cl.stringAscii("STX"),
          Cl.uint(expirationHeight),
          Cl.principal(policyBuyer) // The owner of the policy
        ],
        deployer // Acting as policy registry
      );
      
      expect(response.result).toBeOk(Cl.bool(true));
      
      // Verify premium is recorded - this would need access to the premium-balances map
      // which might not be directly accessible through a read-only function
    });
  });

  describe("read-only functions", () => {
    beforeEach(async () => {
      // Initialize STX token and deposit funds before each test
      await initializeToken();
      
      // Set policy registry principal
      await simnet.callPublicFn(
        "liquidity-pool-vault",
        "set-policy-registry-principal",
        [Cl.principal(deployer)],
        deployer
      );
      
      // Deposit some STX as provider1
      await simnet.callPublicFn(
        "liquidity-pool-vault",
        "deposit-capital",
        [
          Cl.uint(10000000000), // 10,000 STX
          Cl.stringAscii("STX"),
          Cl.stringAscii(RISK_TIER_CONSERVATIVE)
        ],
        provider1
      );
      
      // Lock some collateral
      const policyId = 1;
      const currentBlockHeight = simnet.blockHeight;
      const expirationHeight = currentBlockHeight + 1000;
      
      await simnet.callPublicFn(
        "liquidity-pool-vault",
        "lock-collateral",
        [
          Cl.uint(policyId),
          Cl.uint(5000000000), // 5,000 STX
          Cl.stringAscii("STX"),
          Cl.stringAscii(RISK_TIER_CONSERVATIVE),
          Cl.uint(expirationHeight),
          Cl.principal(policyBuyer) // The owner of the policy
        ],
        deployer // Acting as policy registry
      );
    });

    it("returns correct total token balance", async () => {
      const totalBalance = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "get-total-token-balance",
        [Cl.stringAscii("STX")],
        deployer
      );
      
      expect(totalBalance.result).toBeOk(Cl.uint(10000000000)); // 10,000 STX
    });

    it("returns correct locked collateral amount", async () => {
      const lockedAmount = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "get-locked-collateral",
        [Cl.stringAscii("STX")],
        deployer
      );
      
      expect(lockedAmount.result).toBeOk(Cl.uint(5000000000)); // 5,000 STX
    });

    it("returns correct available balance", async () => {
      const availableBalance = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "get-available-balance",
        [Cl.stringAscii("STX")],
        deployer
      );
      
      expect(availableBalance.result).toBeOk(Cl.uint(5000000000)); // 10,000 - 5,000 = 5,000 STX
    });

    it("returns correct token support status", async () => {
      // Check initialized token
      let tokenStatus = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "is-token-initialized-public",
        [Cl.stringAscii("STX")],
        deployer
      );
      
      expect(tokenStatus.result).toBe(true);
      
      // Check non-initialized token
      tokenStatus = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "is-token-initialized-public",
        [Cl.stringAscii("NON_EXISTENT")],
        deployer
      );
      
      expect(tokenStatus.result).toBe(false);
    });

    it("returns provider balance information", async () => {
      const providerBalance = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "get-provider-balance",
        [Cl.principal(provider1), Cl.stringAscii("STX")],
        deployer
      );
      
      expect(providerBalance.result).not.toBeNull();
      
      if (providerBalance.result) {
        // Expected structure from the contract - verify at least the deposited amount
        expect(providerBalance.result.value.deposited_amount ||
               providerBalance.result.value["deposited-amount"]).toBe(BigInt(10000000000));
      }
    });
  });
}); 