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

// Define test suite for liquidity-pool contract
describe("liquidity-pool contract", () => {
  // Helper to initialize the pool
  const initPool = async () => {
    const response = await simnet.callPublicFn(
      "liquidity-pool",
      "initialize-pool",
      [],
      deployer
    );
    return { response };
  };

  it("initializes the pool successfully", async () => {
    const { response } = await initPool();
    expect(response.result).toBeOk(Cl.bool(true));
  });

  describe("pool initialization", () => {
    it("prevents non-owner from initializing the pool", async () => {
      const response = await simnet.callPublicFn(
        "liquidity-pool",
        "initialize-pool",
        [],
        unauthorizedUser
      );
      expect(response.result).toBeErr(Cl.uint(100)); // ERR-NOT-AUTHORIZED
    });

    it("prevents initializing the pool twice", async () => {
      await initPool();
      const response = await simnet.callPublicFn(
        "liquidity-pool",
        "initialize-pool",
        [],
        deployer
      );
      expect(response.result).toBeErr(Cl.uint(100)); // ERR-NOT-AUTHORIZED
    });
  });

  describe("depositing funds", () => {
    beforeEach(async () => {
      // Initialize pool before each test in this group
      await initPool();
    });

    it("allows a provider to deposit STX to conservative tier", async () => {
      const depositAmount = 10000000000; // 10,000 STX
      const initialBalance = getCurrentStxBalance(provider1);
      
      const response = await simnet.callPublicFn(
        "liquidity-pool",
        "deposit-stx",
        [Cl.uint(depositAmount), Cl.stringAscii("Conservative")],
        provider1
      );
      
      expect(response.result).toBeOk(Cl.uint(depositAmount));
      
      // Verify provider balance decreased
      expect(getCurrentStxBalance(provider1)).toBeLessThan(initialBalance);
      
      // Verify provider deposit info is correct
      const providerDataResponse = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-provider-deposits", 
        [Cl.principal(provider1), Cl.stringAscii("Conservative")],
        provider1
      );
      
      const providerData = providerDataResponse.result.value;
      expect(providerData['stx-amount'].value).toBe(BigInt(depositAmount));
      expect(providerData['stx-locked'].value).toBe(BigInt(0));
    });

    it("allows a provider to deposit STX to moderate tier", async () => {
      const depositAmount = 20000000000; // 20,000 STX
      
      const response = await simnet.callPublicFn(
        "liquidity-pool",
        "deposit-stx",
        [Cl.uint(depositAmount), Cl.stringAscii("Moderate")],
        provider1
      );
      
      expect(response.result).toBeOk(Cl.uint(depositAmount));
      
      // Verify provider deposit info is correct
      const providerDataResponse = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-provider-deposits", 
        [Cl.principal(provider1), Cl.stringAscii("Moderate")],
        provider1
      );
      
      const providerData = providerDataResponse.result.value;
      expect(providerData['stx-amount'].value).toBe(BigInt(depositAmount));
    });

    it("allows multiple deposits to the same tier", async () => {
      // First deposit
      const firstDepositAmount = 10000000000; // 10,000 STX
      await simnet.callPublicFn(
        "liquidity-pool",
        "deposit-stx",
        [Cl.uint(firstDepositAmount), Cl.stringAscii("Conservative")],
        provider1
      );
      
      // Second deposit
      const secondDepositAmount = 5000000000; // 5,000 STX
      const response = await simnet.callPublicFn(
        "liquidity-pool",
        "deposit-stx",
        [Cl.uint(secondDepositAmount), Cl.stringAscii("Conservative")],
        provider1
      );
      
      expect(response.result).toBeOk(Cl.uint(secondDepositAmount));
      
      // Verify provider deposit info is correct
      const providerDataResponse = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-provider-deposits", 
        [Cl.principal(provider1), Cl.stringAscii("Conservative")],
        provider1
      );
      
      const providerData = providerDataResponse.result.value;
      expect(providerData['stx-amount'].value).toBe(BigInt(firstDepositAmount + secondDepositAmount));
      expect(providerData['deposit-count'].value).toBe(BigInt(2));
    });

    it("rejects deposits to invalid tiers", async () => {
      const depositAmount = 10000000000; // 10,000 STX
      
      const response = await simnet.callPublicFn(
        "liquidity-pool",
        "deposit-stx",
        [Cl.uint(depositAmount), Cl.stringAscii("NonExistentTier")],
        provider1
      );
      
      expect(response.result).toBeErr(Cl.uint(115)); // ERR-INVALID-TIER
    });

    it("updates pool collateral after deposit", async () => {
      const depositAmount = 10000000000; // 10,000 STX
      
      await simnet.callPublicFn(
        "liquidity-pool",
        "deposit-stx",
        [Cl.uint(depositAmount), Cl.stringAscii("Conservative")],
        provider1
      );
      
      const poolCollateralResponse = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-pool-collateral",
        [],
        provider1
      );
      
      const poolCollateral = poolCollateralResponse.result.value;
      expect(poolCollateral['total-stx-collateral'].value).toBe(BigInt(depositAmount));
      expect(poolCollateral['stx-locked'].value).toBe(BigInt(0));
      expect(poolCollateral['stx-available'].value).toBe(BigInt(depositAmount));
    });

    it("updates tier capital after deposit", async () => {
      const depositAmount = 10000000000; // 10,000 STX
      
      await simnet.callPublicFn(
        "liquidity-pool",
        "deposit-stx",
        [Cl.uint(depositAmount), Cl.stringAscii("Conservative")],
        provider1
      );
      
      const tierCapitalResponse = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-tier-capital",
        [Cl.stringAscii("Conservative")],
        provider1
      );
      
      const tierCapital = tierCapitalResponse.result.value;
      expect(tierCapital['total-stx-deposited'].value).toBe(BigInt(depositAmount));
      expect(tierCapital['provider-count'].value).toBe(BigInt(1));
    });
  });

  describe("withdrawing funds", () => {
    beforeEach(async () => {
      // Initialize pool before each test in this group
      await initPool();
      
      // Make a deposit first
      const depositAmount = 20000000000; // 20,000 STX
      await simnet.callPublicFn(
        "liquidity-pool",
        "deposit-stx",
        [Cl.uint(depositAmount), Cl.stringAscii("Conservative")],
        provider1
      );
    });

    it("allows a provider to withdraw STX", async () => {
      const withdrawAmount = 5000000000; // 5,000 STX
      const initialBalance = getCurrentStxBalance(provider1);
      
      const response = await simnet.callPublicFn(
        "liquidity-pool",
        "withdraw-stx",
        [Cl.uint(withdrawAmount), Cl.stringAscii("Conservative")],
        provider1
      );
      
      expect(response.result).toBeOk(Cl.uint(withdrawAmount));
      
      // Verify provider balance increased
      expect(getCurrentStxBalance(provider1)).toBeGreaterThan(initialBalance);
      
      // Verify provider deposit info is updated
      const providerDataResponse = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-provider-deposits", 
        [Cl.principal(provider1), Cl.stringAscii("Conservative")],
        provider1
      );
      
      const providerData = providerDataResponse.result.value;
      expect(providerData['stx-amount'].value).toBe(BigInt(15000000000)); // 20,000 - 5,000
    });

    it("prevents withdrawing more than available balance", async () => {
      const withdrawAmount = 30000000000; // 30,000 STX (more than deposited)
      
      const response = await simnet.callPublicFn(
        "liquidity-pool",
        "withdraw-stx",
        [Cl.uint(withdrawAmount), Cl.stringAscii("Conservative")],
        provider1
      );
      
      expect(response.result).toBeErr(Cl.uint(107)); // ERR-WITHDRAWAL-LIMIT-EXCEEDED
    });

    it("prevents withdrawing from a tier with no deposits", async () => {
      const withdrawAmount = 5000000000; // 5,000 STX
      
      const response = await simnet.callPublicFn(
        "liquidity-pool",
        "withdraw-stx",
        [Cl.uint(withdrawAmount), Cl.stringAscii("Moderate")], // No deposits in Moderate tier
        provider1
      );
      
      expect(response.result).toBeErr(Cl.uint(109)); // ERR-PROVIDER-NOT-FOUND
    });

    it("updates pool collateral and tier capital after withdrawal", async () => {
      const withdrawAmount = 5000000000; // 5,000 STX
      
      await simnet.callPublicFn(
        "liquidity-pool",
        "withdraw-stx",
        [Cl.uint(withdrawAmount), Cl.stringAscii("Conservative")],
        provider1
      );
      
      // Check pool collateral
      const poolCollateralResponse = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-pool-collateral",
        [],
        provider1
      );
      
      const poolCollateral = poolCollateralResponse.result.value;
      expect(poolCollateral['total-stx-collateral'].value).toBe(BigInt(15000000000)); // 20,000 - 5,000
      
      // Check tier capital
      const tierCapitalResponse = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-tier-capital",
        [Cl.stringAscii("Conservative")],
        provider1
      );
      
      const tierCapital = tierCapitalResponse.result.value;
      expect(tierCapital['total-stx-deposited'].value).toBe(BigInt(15000000000)); // 20,000 - 5,000
      expect(tierCapital['provider-count'].value).toBe(BigInt(1)); // Still 1 provider
    });

    it("decrements provider count when provider fully withdraws from a tier", async () => {
      // Withdraw everything
      const withdrawAmount = 20000000000; // 20,000 STX (full amount)
      
      await simnet.callPublicFn(
        "liquidity-pool",
        "withdraw-stx",
        [Cl.uint(withdrawAmount), Cl.stringAscii("Conservative")],
        provider1
      );
      
      // Check tier capital
      const tierCapitalResponse = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-tier-capital",
        [Cl.stringAscii("Conservative")],
        provider1
      );
      
      const tierCapital = tierCapitalResponse.result.value;
      expect(tierCapital['total-stx-deposited'].value).toBe(BigInt(0));
      expect(tierCapital['provider-count'].value).toBe(BigInt(0)); // No providers left
    });
  });

  describe("policy risk parameters", () => {
    beforeEach(async () => {
      await initPool();
    });

    it("reads default policy risk parameters", async () => {
      const putParamsResponse = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-policy-risk-parameters",
        [Cl.stringAscii("PUT")],
        deployer
      );
      
      const putParams = putParamsResponse.result.value;
      expect(putParams['base-premium-rate'].value).toBe(BigInt(50000)); // 5%
      expect(putParams['min-collateralization'].value).toBe(BigInt(1100000)); // 110%
      
      const callParamsResponse = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-policy-risk-parameters",
        [Cl.stringAscii("CALL")],
        deployer
      );
      
      const callParams = callParamsResponse.result.value;
      expect(callParams['base-premium-rate'].value).toBe(BigInt(60000)); // 6%
      expect(callParams['min-collateralization'].value).toBe(BigInt(1200000)); // 120%
    });

    it("allows contract owner to update policy risk parameters", async () => {
      const response = await simnet.callPublicFn(
        "liquidity-pool",
        "update-policy-risk-parameters",
        [
          Cl.stringAscii("PUT"),
          Cl.uint(100000), // 10% base rate
          Cl.uint(2500000), // 2.5x multiplier
          Cl.uint(900000), // 90% max utilization
          Cl.uint(1800000), // 1.8x moneyness multiplier
          Cl.uint(150000), // 15% duration multiplier
          Cl.uint(1150000) // 115% min collateralization
        ],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.bool(true));
      
      // Verify parameters were updated
      const paramsResponse = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-policy-risk-parameters",
        [Cl.stringAscii("PUT")],
        deployer
      );
      
      const params = paramsResponse.result.value;
      expect(params['base-premium-rate'].value).toBe(BigInt(100000));
      expect(params['min-collateralization'].value).toBe(BigInt(1150000));
    });

    it("prevents unauthorized users from updating policy parameters", async () => {
      const response = await simnet.callPublicFn(
        "liquidity-pool",
        "update-policy-risk-parameters",
        [
          Cl.stringAscii("PUT"),
          Cl.uint(100000),
          Cl.uint(2500000),
          Cl.uint(900000),
          Cl.uint(1800000),
          Cl.uint(150000),
          Cl.uint(1150000)
        ],
        unauthorizedUser
      );
      
      expect(response.result).toBeErr(Cl.uint(111)); // ERR-UNAUTHORIZED
    });
  });

  describe("risk tiers", () => {
    beforeEach(async () => {
      await initPool();
    });

    it("reads default risk tier configurations", async () => {
      const conservativeTierResponse = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-risk-tier",
        [Cl.stringAscii("Conservative")],
        deployer
      );
      
      const conservativeTier = conservativeTierResponse.result.value;
      expect(conservativeTier['min-protected-value-percentage'].value).toBe(BigInt(800000)); // 80%
      expect(conservativeTier['premium-multiplier'].value).toBe(BigInt(800000)); // 80%
      expect(conservativeTier['status'].value).toBe(true);
      
      const moderateTierResponse = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-risk-tier",
        [Cl.stringAscii("Moderate")],
        deployer
      );
      
      const moderateTier = moderateTierResponse.result.value;
      expect(moderateTier['min-protected-value-percentage'].value).toBe(BigInt(700000)); // 70%
      expect(moderateTier['premium-multiplier'].value).toBe(BigInt(1000000)); // 100%
      expect(moderateTier['status'].value).toBe(true);
    });

    it("allows contract owner to update a risk tier", async () => {
      const response = await simnet.callPublicFn(
        "liquidity-pool",
        "update-risk-tier",
        [
          Cl.stringAscii("Aggressive"),
          Cl.uint(450000), // 45% min protected value
          Cl.uint(750000), // 75% max protected value
          Cl.uint(1500000), // 150% premium multiplier
          Cl.uint(120), // 120 days max duration
          Cl.bool(true) // active
        ],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.bool(true));
      
      // Verify tier was updated
      const tierResponse = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-risk-tier",
        [Cl.stringAscii("Aggressive")],
        deployer
      );
      
      const tier = tierResponse.result.value;
      expect(tier['min-protected-value-percentage'].value).toBe(BigInt(450000));
      expect(tier['premium-multiplier'].value).toBe(BigInt(1500000));
      expect(tier['max-duration-days'].value).toBe(BigInt(120));
    });

    it("allows creating a new risk tier", async () => {
      const response = await simnet.callPublicFn(
        "liquidity-pool",
        "update-risk-tier",
        [
          Cl.stringAscii("VeryAggressive"),
          Cl.uint(300000), // 30% min protected value
          Cl.uint(600000), // 60% max protected value
          Cl.uint(2000000), // 200% premium multiplier
          Cl.uint(180), // 180 days max duration
          Cl.bool(true) // active
        ],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.bool(true));
      
      // Verify new tier was created
      const tierResponse = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-risk-tier",
        [Cl.stringAscii("VeryAggressive")],
        deployer
      );
      
      const tier = tierResponse.result.value;
      expect(tier['min-protected-value-percentage'].value).toBe(BigInt(300000));
      expect(tier['premium-multiplier'].value).toBe(BigInt(2000000));
    });

    it("prevents unauthorized users from updating risk tiers", async () => {
      const response = await simnet.callPublicFn(
        "liquidity-pool",
        "update-risk-tier",
        [
          Cl.stringAscii("Conservative"),
          Cl.uint(850000),
          Cl.uint(950000),
          Cl.uint(750000),
          Cl.uint(20),
          Cl.bool(true)
        ],
        unauthorizedUser
      );
      
      expect(response.result).toBeErr(Cl.uint(111)); // ERR-UNAUTHORIZED
    });
  });

  describe("premium calculation", () => {
    beforeEach(async () => {
      await initPool();
    });

    it("calculates premiums correctly for PUT options", async () => {
      const response = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "calculate-premium",
        [
          Cl.stringAscii("PUT"),
          Cl.uint(100000000000), // 100,000 STX protected value
          Cl.uint(100000000000), // 100,000 STX protected amount
          Cl.uint(1440), // 10 days (144 blocks per day)
          Cl.stringAscii("Conservative")
        ],
        deployer
      );
      
      // The premium should reflect base rate * tier multiplier * other factors
      expect(response.result).toBeOk(Cl.uint(expect.any(Number)));
    });

    it("calculates premiums correctly for CALL options", async () => {
      const response = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "calculate-premium",
        [
          Cl.stringAscii("CALL"),
          Cl.uint(100000000000), // 100,000 STX protected value
          Cl.uint(100000000000), // 100,000 STX protected amount
          Cl.uint(2880), // 20 days (144 blocks per day)
          Cl.stringAscii("Moderate")
        ],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.uint(expect.any(Number)));
    });

    it("rejects premium calculations for invalid tiers", async () => {
      const response = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "calculate-premium",
        [
          Cl.stringAscii("PUT"),
          Cl.uint(100000000000),
          Cl.uint(100000000000),
          Cl.uint(1440),
          Cl.stringAscii("NonExistentTier")
        ],
        deployer
      );
      
      expect(response.result).toBeErr(Cl.uint(115)); // ERR-INVALID-TIER
    });
  });

  describe("admin functions", () => {
    beforeEach(async () => {
      await initPool();
    });

    it("allows owner to pause and unpause the pool", async () => {
      // Pause the pool
      const pauseResponse = await simnet.callPublicFn(
        "liquidity-pool",
        "pause-pool",
        [],
        deployer
      );
      
      expect(pauseResponse.result).toBeOk(Cl.bool(true));
      
      // Try to deposit while paused
      const depositResponse = await simnet.callPublicFn(
        "liquidity-pool",
        "deposit-stx",
        [Cl.uint(10000000000), Cl.stringAscii("Conservative")],
        provider1
      );
      
      expect(depositResponse.result).toBeErr(Cl.uint(102)); // ERR-POOL-PAUSED
      
      // Unpause the pool
      const unpauseResponse = await simnet.callPublicFn(
        "liquidity-pool",
        "unpause-pool",
        [],
        deployer
      );
      
      expect(unpauseResponse.result).toBeOk(Cl.bool(true));
      
      // Try to deposit again
      const depositAfterUnpause = await simnet.callPublicFn(
        "liquidity-pool",
        "deposit-stx",
        [Cl.uint(10000000000), Cl.stringAscii("Conservative")],
        provider1
      );
      
      expect(depositAfterUnpause.result).toBeOk(Cl.uint(10000000000));
    });

    it("allows owner to update fee structure", async () => {
      const response = await simnet.callPublicFn(
        "liquidity-pool",
        "update-fee-structure",
        [
          Cl.uint(50000), // 5% platform fee
          Cl.uint(900000), // 90% provider fee
          Cl.uint(50000) // 5% protocol reserve
        ],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.bool(true));
    });

    it("prevents users from calling admin functions", async () => {
      const pauseResponse = await simnet.callPublicFn(
        "liquidity-pool",
        "pause-pool",
        [],
        unauthorizedUser
      );
      
      expect(pauseResponse.result).toBeErr(Cl.uint(111)); // ERR-UNAUTHORIZED
      
      const updateFeeResponse = await simnet.callPublicFn(
        "liquidity-pool",
        "update-fee-structure",
        [
          Cl.uint(50000),
          Cl.uint(900000),
          Cl.uint(50000)
        ],
        unauthorizedUser
      );
      
      expect(updateFeeResponse.result).toBeErr(Cl.uint(111)); // ERR-UNAUTHORIZED
    });

    it("validates fee structure sums to 100%", async () => {
      const response = await simnet.callPublicFn(
        "liquidity-pool",
        "update-fee-structure",
        [
          Cl.uint(200000), // 20%
          Cl.uint(700000), // 70%
          Cl.uint(50000) // 5% (total 95%, should fail)
        ],
        deployer
      );
      
      expect(response.result).toBeErr(Cl.uint(103)); // ERR-INVALID-PARAMETERS
    });
  });

  describe("yield management", () => {
    beforeEach(async () => {
      await initPool();
    });

    it("allows starting a new epoch", async () => {
      // Check initial epoch
      const initialEpochResponse = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-current-epoch",
        [],
        deployer
      );
      
      const initialEpoch = initialEpochResponse.result.value;
      
      // Start new epoch
      const response = await simnet.callPublicFn(
        "liquidity-pool",
        "start-new-epoch",
        [],
        deployer
      );
      
      expect(response.result).toBeOk(Cl.uint(1)); // New epoch should be 1
      
      // Verify epoch increased
      const newEpochResponse = await simnet.callReadOnlyFn(
        "liquidity-pool",
        "get-current-epoch",
        [],
        deployer
      );
      
      const newEpoch = newEpochResponse.result.value;
      expect(Number(newEpoch)).toBe(Number(initialEpoch) + 1);
    });

    it("prevents unauthorized users from starting a new epoch", async () => {
      const response = await simnet.callPublicFn(
        "liquidity-pool",
        "start-new-epoch",
        [],
        unauthorizedUser
      );
      
      expect(response.result).toBeErr(Cl.uint(111)); // ERR-UNAUTHORIZED
    });
  });
}); 