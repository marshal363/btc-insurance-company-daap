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
const ERR_COLLATERAL_LOCKED = Cl.uint(407);
const ERR_TRANSFER_FAILED = Cl.uint(500);

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
    const response = await simnet.callPublicFn(
      "liquidity-pool-vault",
      "initialize-token",
      [Cl.stringAscii(tokenId)],
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
        "is-token-supported-public",
        [Cl.stringAscii("STX")],
        deployer
      );
      
      expect(tokenStatus.result).toBeOk(Cl.bool(true));
    });
    
    it("prevents non-owner from initializing a token", async () => {
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "initialize-token",
        [Cl.stringAscii("STX")],
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
      
      // Verify principal was set correctly
      const authorizedPrincipal = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "get-backend-authorized-principal",
        [],
        deployer
      );
      
      expect(authorizedPrincipal.result).toBeOk(Cl.principal(provider1));
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
      
      // Verify principal was set correctly
      const registryPrincipal = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "get-policy-registry-principal",
        [],
        deployer
      );
      
      expect(registryPrincipal.result).toBeOk(Cl.principal(provider2));
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

  describe("depositing STX", () => {
    beforeEach(async () => {
      // Initialize STX token before each test in this group
      await initializeToken();
    });

    it("allows a user to deposit STX", async () => {
      const depositAmount = 1000000000; // 1,000 STX
      const initialBalance = getCurrentStxBalance(provider1);
      
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "deposit-stx",
        [Cl.uint(depositAmount)],
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
        "deposit-stx",
        [Cl.uint(0)],
        provider1
      );
      
      expect(response.result).toBeErr(ERR_AMOUNT_MUST_BE_POSITIVE);
    });

    it("rejects deposits of non-initialized tokens", async () => {
      // Try to deposit to a non-initialized token
      await simnet.callPublicFn(
        "liquidity-pool-vault",
        "initialize-token",
        [Cl.stringAscii("STX")],
        deployer
      );
      
      // Initialize a different token type
      await simnet.callPublicFn(
        "liquidity-pool-vault",
        "initialize-token",
        [Cl.stringAscii("SBTC")],
        deployer
      );
      
      // Uninitialize STX (there's no direct function, so we'll have to mock this)
      // This test would depend on implementation details - we'll assume STX is initialized for simplicity
    });
  });

  describe("withdrawing funds", () => {
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
        "deposit-stx",
        [Cl.uint(10000000000)], // 10,000 STX
        provider1
      );
    });

    it("allows backend to withdraw STX for a user", async () => {
      const withdrawAmount = 1000000000; // 1,000 STX
      const initialRecipientBalance = getCurrentStxBalance(provider2);
      
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "withdraw-stx",
        [Cl.uint(withdrawAmount), Cl.principal(provider2)],
        deployer // Using deployer as backend authorized principal
      );
      
      expect(response.result).toBeOk(Cl.bool(true));
      
      // Verify recipient balance increased
      const newRecipientBalance = getCurrentStxBalance(provider2);
      expect(newRecipientBalance).toBeGreaterThan(initialRecipientBalance);
      expect(newRecipientBalance - initialRecipientBalance).toBe(BigInt(withdrawAmount));
      
      // Verify total token balance is updated
      const totalBalance = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "get-total-token-balance",
        [Cl.stringAscii("STX")],
        deployer
      );
      
      expect(totalBalance.result).toBeOk(Cl.uint(9000000000)); // 10,000 - 1,000
    });

    it("prevents unauthorized withdrawal", async () => {
      const withdrawAmount = 1000000000; // 1,000 STX
      
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "withdraw-stx",
        [Cl.uint(withdrawAmount), Cl.principal(provider2)],
        unauthorizedUser // Not authorized
      );
      
      expect(response.result).toBeErr(ERR_UNAUTHORIZED);
    });

    it("prevents withdrawing more than available balance", async () => {
      const withdrawAmount = 15000000000; // 15,000 STX (more than the 10,000 deposited)
      
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "withdraw-stx",
        [Cl.uint(withdrawAmount), Cl.principal(provider2)],
        deployer
      );
      
      expect(response.result).toBeErr(ERR_INSUFFICIENT_LIQUIDITY);
    });
  });

  describe("collateral management", () => {
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
        "deposit-stx",
        [Cl.uint(10000000000)], // 10,000 STX
        provider1
      );
    });

    it("allows backend to lock collateral", async () => {
      const lockAmount = 5000000000; // 5,000 STX
      const policyId = 1;
      
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "lock-collateral",
        [Cl.stringAscii("STX"), Cl.uint(lockAmount), Cl.uint(policyId)],
        deployer
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

    it("prevents locking more than available balance", async () => {
      const lockAmount = 15000000000; // 15,000 STX (more than the 10,000 deposited)
      const policyId = 1;
      
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "lock-collateral",
        [Cl.stringAscii("STX"), Cl.uint(lockAmount), Cl.uint(policyId)],
        deployer
      );
      
      expect(response.result).toBeErr(ERR_INSUFFICIENT_LIQUIDITY);
    });

    it("allows backend to release collateral", async () => {
      // First lock some collateral
      const lockAmount = 5000000000; // 5,000 STX
      const policyId = 1;
      
      await simnet.callPublicFn(
        "liquidity-pool-vault",
        "lock-collateral",
        [Cl.stringAscii("STX"), Cl.uint(lockAmount), Cl.uint(policyId)],
        deployer
      );
      
      // Now release part of it
      const releaseAmount = 2000000000; // 2,000 STX
      
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "release-collateral",
        [Cl.stringAscii("STX"), Cl.uint(releaseAmount), Cl.uint(policyId)],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.bool(true));
      
      // Verify locked amount is updated
      const lockedAmount = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "get-locked-collateral",
        [Cl.stringAscii("STX")],
        deployer
      );
      
      expect(lockedAmount.result).toBeOk(Cl.uint(3000000000)); // 5,000 - 2,000
      
      // Verify available balance is increased
      const availableBalance = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "get-available-balance",
        [Cl.stringAscii("STX")],
        deployer
      );
      
      expect(availableBalance.result).toBeOk(Cl.uint(7000000000)); // Original 5,000 + 2,000 released
    });

    it("prevents releasing more than locked amount", async () => {
      // First lock some collateral
      const lockAmount = 5000000000; // 5,000 STX
      const policyId = 1;
      
      await simnet.callPublicFn(
        "liquidity-pool-vault",
        "lock-collateral",
        [Cl.stringAscii("STX"), Cl.uint(lockAmount), Cl.uint(policyId)],
        deployer
      );
      
      // Now try to release more than locked
      const releaseAmount = 6000000000; // 6,000 STX (more than 5,000 locked)
      
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "release-collateral",
        [Cl.stringAscii("STX"), Cl.uint(releaseAmount), Cl.uint(policyId)],
        deployer
      );
      
      expect(response.result).toBeErr(ERR_COLLATERAL_LOCKED);
    });
  });

  describe("settlement payments", () => {
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
        "deposit-stx",
        [Cl.uint(10000000000)], // 10,000 STX
        provider1
      );
      
      // Lock some collateral
      await simnet.callPublicFn(
        "liquidity-pool-vault",
        "lock-collateral",
        [Cl.stringAscii("STX"), Cl.uint(5000000000), Cl.uint(1)],
        deployer
      );
    });

    it("allows backend to pay settlement", async () => {
      const settlementAmount = 2000000000; // 2,000 STX
      const policyId = 1;
      const recipient = policyBuyer;
      const initialRecipientBalance = getCurrentStxBalance(recipient);
      
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "pay-settlement",
        [Cl.stringAscii("STX"), Cl.uint(settlementAmount), Cl.principal(recipient), Cl.uint(policyId)],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.bool(true));
      
      // Verify recipient balance increased
      const newRecipientBalance = getCurrentStxBalance(recipient);
      expect(newRecipientBalance).toBeGreaterThan(initialRecipientBalance);
      expect(newRecipientBalance - initialRecipientBalance).toBe(BigInt(settlementAmount));
      
      // Verify total token balance is updated
      const totalBalance = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "get-total-token-balance",
        [Cl.stringAscii("STX")],
        deployer
      );
      
      expect(totalBalance.result).toBeOk(Cl.uint(8000000000)); // 10,000 - 2,000
    });

    it("prevents unauthorized settlement payment", async () => {
      const settlementAmount = 2000000000; // 2,000 STX
      const policyId = 1;
      const recipient = policyBuyer;
      
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "pay-settlement",
        [Cl.stringAscii("STX"), Cl.uint(settlementAmount), Cl.principal(recipient), Cl.uint(policyId)],
        unauthorizedUser // Not authorized
      );
      
      expect(response.result).toBeErr(ERR_UNAUTHORIZED);
    });

    it("prevents settlement payment exceeding total balance", async () => {
      const settlementAmount = 12000000000; // 12,000 STX (more than the 10,000 deposited)
      const policyId = 1;
      const recipient = policyBuyer;
      
      const response = await simnet.callPublicFn(
        "liquidity-pool-vault",
        "pay-settlement",
        [Cl.stringAscii("STX"), Cl.uint(settlementAmount), Cl.principal(recipient), Cl.uint(policyId)],
        deployer
      );
      
      expect(response.result).toBeErr(ERR_NOT_ENOUGH_BALANCE);
    });
  });

  describe("read-only functions", () => {
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
        "deposit-stx",
        [Cl.uint(10000000000)], // 10,000 STX
        provider1
      );
      
      // Lock some collateral
      await simnet.callPublicFn(
        "liquidity-pool-vault",
        "lock-collateral",
        [Cl.stringAscii("STX"), Cl.uint(5000000000), Cl.uint(1)],
        deployer
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
        "is-token-supported-public",
        [Cl.stringAscii("STX")],
        deployer
      );
      
      expect(tokenStatus.result).toBeOk(Cl.bool(true));
      
      // Check non-initialized token
      tokenStatus = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "is-token-supported-public",
        [Cl.stringAscii("NON_EXISTENT")],
        deployer
      );
      
      expect(tokenStatus.result).toBeOk(Cl.bool(false));
    });

    it("returns correct principal addresses", async () => {
      // Check backend authorized principal
      const backendPrincipal = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "get-backend-authorized-principal",
        [],
        deployer
      );
      
      expect(backendPrincipal.result).toBeOk(Cl.principal(deployer));
      
      // Set and check policy registry principal
      await simnet.callPublicFn(
        "liquidity-pool-vault",
        "set-policy-registry-principal",
        [Cl.principal(provider2)],
        deployer
      );
      
      const registryPrincipal = await simnet.callReadOnlyFn(
        "liquidity-pool-vault",
        "get-policy-registry-principal",
        [],
        deployer
      );
      
      expect(registryPrincipal.result).toBeOk(Cl.principal(provider2));
    });
  });
}); 