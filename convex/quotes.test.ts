import { convexTest } from "convex-test";
import { expect, test, beforeEach, describe, vi, afterEach } from "vitest";
import { api } from "./_generated/api"; // Removed 'internal' import if not directly used elsewhere due to mocking
import { Id } from "./_generated/dataModel";
import schema from "./schema";

// Define or import your Mock types if not already available globally
type MockQuote = Partial<any>; // Replace 'any' with your actual Quote document type from schema.ts
type MockRiskParameters = Partial<any>; // Replace 'any' with RiskParameters type

const mockRiskParamsBuyer: MockRiskParameters = {
  assetType: "BTC",
  policyType: "PUT_BUYER",
  baseRate: 0.01,
  volatilityMultiplier: 1.5,
  isActive: true,
  durationFactor: 0,
  coverageFactor: 0,
  tierMultipliers: {},
  liquidityAdjustment: 0,
  marketTrendAdjustment: 0,
  version: 1,
  lastUpdated: "2023-01-01T00:00:00Z",
  updatedBy: "test-system",
};

const mockRiskParamsProvider: MockRiskParameters = {
  assetType: "BTC",
  policyType: "ProviderYield",
  tierMultipliers: { conservative: 0.7, balanced: 1.0, aggressive: 1.3 },
  volatilityMultiplier: 0.8,
  isActive: true,
  baseRate: 0.2,
  durationFactor: 90,
  coverageFactor: 0.5,
  // customProviderFactor: 0.5, // Ensure this field exists in your schema or remove
  liquidityAdjustment: 0,
  marketTrendAdjustment: 0,
  version: 1,
  lastUpdated: "2023-01-01T00:00:00Z",
  updatedBy: "test-system",
};

// IMPORTANT: Replace 'convex/premiumInternalQueries' with the actual relative path
// from 'convex/quotes.test.ts' to the file where your getActiveRiskParameters function is defined.
// For example, if getActiveRiskParameters is in 'convex/premium/queries.ts',
// the path would be './premium/queries'.
// If it's directly in e.g. 'convex/premium.ts' and exported as getActiveRiskParameters,
// then the path would be './premium'
const mockGetActiveRiskParametersPath = 'convex/premiumInternalQueries'; // <<< --- ADJUST THIS PATH

vi.mock(mockGetActiveRiskParametersPath, async (importOriginal) => {
  try {
    const originalModule = await importOriginal() as object; // Cast to object
    return {
      ...originalModule,
      // Ensure this is the correct exported name of the function
      getActiveRiskParameters: vi.fn().mockImplementation(async (ctx: any, args: { policyType: string }) => {
        if (args?.policyType === "PUT_BUYER") {
          return { ...mockRiskParamsBuyer }; // Return copies to avoid accidental mutation across tests
        }
        if (args?.policyType === "ProviderYield") {
          return { ...mockRiskParamsProvider }; // Return copies
        }
        return null;
      }),
    };
  } catch (e) {
    console.error(`Failed to mock ${mockGetActiveRiskParametersPath}. Ensure the path is correct and the module is accessible.`, e);
    // Fallback to an empty mock if original module can't be loaded, to prevent test runner from crashing
    return {
        getActiveRiskParameters: vi.fn().mockResolvedValue(null)
    };
  }
});

describe("finalizeQuote Mutation Tests", () => {
  let t: ReturnType<typeof convexTest>;
  let initialBuyerQuoteId: Id<"quotes">;
  let initialProviderQuoteId: Id<"quotes">;

  const mockBuyerParams = {
    protectedValuePercentage: 90,
    protectionAmount: 1, // 1 BTC
    expirationDays: 30,
    policyType: "PUT_BUYER",
  };

  const mockProviderParams = {
    commitmentAmountUSD: 10000,
    selectedTier: "balanced",
    selectedPeriod: 60, // days
    commitmentAmount: 1, // Added based on testUtils schema
  };

  const initialMarketData = {
    btcPrice: 50000,
    volatility: 0.6, // 60%
    timestamp: new Date("2023-10-01T10:00:00Z").toISOString(),
  };

  const newMarketData = {
    btcPrice: 52000,
    volatility: 0.65, // 65%
  };

  beforeEach(async () => {
    t = convexTest(schema);
    // vi.resetModules(); // Resetting modules here might be too early if mock setup is complex
    // vi.clearAllMocks(); // Clear mocks before each test if needed, or in afterEach

    const seedResult = await t.mutation(api.testUtils.seedData, {
      initialMarketData,
      newMarketData,
      mockBuyerParams,
      mockProviderParams,
      initialRiskParamsBuyer: mockRiskParamsBuyer, // Pass the actual mock objects
      initialRiskParamsProvider: mockRiskParamsProvider, // Pass the actual mock objects
    });

    if (!seedResult || !seedResult.initialBuyerQuoteId || !seedResult.initialProviderQuoteId) {
      throw new Error("Seed data mutation failed or did not return expected IDs");
    }
    initialBuyerQuoteId = seedResult.initialBuyerQuoteId;
    initialProviderQuoteId = seedResult.initialProviderQuoteId;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules(); // Ensures mocks are reset for the next test file or describe block.
  });

  describe("Buyer Quote Finalization", () => {
    test("should recalculate premium, update snapshots, and NOT lock if lockForTransaction is false", async () => {
      const finalizedQuote = await t.mutation(api.quotes.finalizeQuote, {
        quoteId: initialBuyerQuoteId,
        lockForTransaction: false,
      });

      expect(finalizedQuote).toBeDefined();
      expect(finalizedQuote.marketDataSnapshot.btcPrice).toBe(newMarketData.btcPrice);
      expect(finalizedQuote.marketDataSnapshot.volatility).toBe(newMarketData.volatility);
      expect(finalizedQuote.riskParamsSnapshot?.policyType).toBe(mockRiskParamsBuyer.policyType);
      expect(finalizedQuote.quoteResult.premium).not.toBe(500);
      expect(finalizedQuote.quoteResult.premium).toBeGreaterThan(0);
      expect(finalizedQuote.isLocked).toBe(false);
      expect(finalizedQuote.lockedAt).toBeUndefined();
      expect(finalizedQuote.lockExpiresAt).toBeUndefined();
    });

    test("should recalculate premium, update snapshots, AND lock if lockForTransaction is true", async () => {
      const finalizedQuote = await t.mutation(api.quotes.finalizeQuote, {
        quoteId: initialBuyerQuoteId,
        lockForTransaction: true,
      });

      expect(finalizedQuote).toBeDefined();
      expect(finalizedQuote.marketDataSnapshot.btcPrice).toBe(newMarketData.btcPrice);
      expect(finalizedQuote.riskParamsSnapshot?.policyType).toBe(mockRiskParamsBuyer.policyType);
      expect(finalizedQuote.quoteResult.premium).not.toBe(500);
      expect(finalizedQuote.quoteResult.premium).toBeGreaterThan(0);
      expect(finalizedQuote.isLocked).toBe(true);
      expect(finalizedQuote.lockedAt).toBeGreaterThan(Date.now() - 5000);
      expect(finalizedQuote.lockExpiresAt).toBeGreaterThan(finalizedQuote.lockedAt ?? 0);
    });
  });

  describe("Provider Quote Finalization", () => {
    test("should recalculate yield, update snapshots, and NOT lock if lockForTransaction is false", async () => {
      const finalizedQuote = await t.mutation(api.quotes.finalizeQuote, {
        quoteId: initialProviderQuoteId,
        lockForTransaction: false,
      });
      
      expect(finalizedQuote).toBeDefined();
      expect(finalizedQuote.marketDataSnapshot.btcPrice).toBe(newMarketData.btcPrice);
      expect(finalizedQuote.riskParamsSnapshot?.policyType).toBe(mockRiskParamsProvider.policyType);
      expect(finalizedQuote.quoteResult.estimatedYield).not.toBe(100);
      expect(finalizedQuote.quoteResult.annualizedYieldPercentage).toBeGreaterThan(0);
      expect(finalizedQuote.isLocked).toBe(false);
    });

    test("should recalculate yield, update snapshots, AND lock if lockForTransaction is true", async () => {
       const finalizedQuote = await t.mutation(api.quotes.finalizeQuote, {
        quoteId: initialProviderQuoteId,
        lockForTransaction: true,
      });
      
      expect(finalizedQuote).toBeDefined();
      expect(finalizedQuote.marketDataSnapshot.btcPrice).toBe(newMarketData.btcPrice);
      expect(finalizedQuote.riskParamsSnapshot?.policyType).toBe(mockRiskParamsProvider.policyType);
      expect(finalizedQuote.quoteResult.estimatedYield).not.toBe(100);
      expect(finalizedQuote.quoteResult.annualizedYieldPercentage).toBeGreaterThan(0);
      expect(finalizedQuote.isLocked).toBe(true);
      expect(finalizedQuote.lockedAt).toBeDefined();
      expect(finalizedQuote.lockExpiresAt).toBeDefined();
    });
    
    test("should use existing/fallback risk params if active ProviderYield params are not found", async () => {
      // This test needs its own mock setup for getActiveRiskParameters to simulate 'not found'
      // We re-mock the specific function for this test case.
      const mockModule = await vi.importActual(mockGetActiveRiskParametersPath) as object;
      vi.spyOn(mockModule as any, 'getActiveRiskParameters').mockImplementationOnce(async (ctx: any, args: { policyType: string }) => {
        if (args?.policyType === "PUT_BUYER") return { ...mockRiskParamsBuyer }; 
        if (args?.policyType === "ProviderYield") return null; // Simulate not found for provider
        return null;
      });
      
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const finalizedQuote = await t.mutation(api.quotes.finalizeQuote, {
        quoteId: initialProviderQuoteId,
        lockForTransaction: false,
      });

      expect(finalizedQuote).toBeDefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Active risk parameters for ProviderYield not found"));
      
      const originalQuote = await t.query(api.quotes.getQuoteById, { id: initialProviderQuoteId });
      expect(finalizedQuote.riskParamsSnapshot).toEqual(originalQuote?.riskParamsSnapshot);
      expect(finalizedQuote.quoteResult.annualizedYieldPercentage).toBeDefined();

      consoleWarnSpy.mockRestore();
    });
  });

  describe("General Error Handling and Edge Cases", () => {
    test("should throw error if quoteId does not exist", async () => {
      await expect(
        t.mutation(api.quotes.finalizeQuote, {
          quoteId: "nonExistentId" as Id<"quotes">,
          lockForTransaction: false,
        })
      ).rejects.toThrow("Quote not found");
    });

    test("should throw error if quote is already locked and unexpired", async () => {
      // First, lock the quote by calling the mutation that does so
      await t.mutation(api.quotes.finalizeQuote, {
        quoteId: initialBuyerQuoteId,
        lockForTransaction: true,
      });

      // Then, attempt to finalize again
      await expect(
        t.mutation(api.quotes.finalizeQuote, {
          quoteId: initialBuyerQuoteId,
          lockForTransaction: false,
        })
      ).rejects.toThrow(/Quote is already locked/);
    });
    
    test("should throw error if market data (aggregatedPrices) is missing", async () => {
      const newTest = convexTest(schema);
      let quoteIdForResult: Id<"quotes">;

      const minimalQuoteData: MockQuote = {
        userId: "testUserErrorCase",
        quoteType: "buyer",
        asset: "BTC",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        status: "active",
        isLocked: false,
        buyerParamsSnapshot: { ...mockBuyerParams },
        quoteResult: { premium: 100 },
        marketDataSnapshot: { btcPrice: 0, volatility: 0, timestamp: new Date().toISOString() },
        // Ensure riskParamsSnapshot is a complete object matching your schema or the type expected by createMinimalQuote
        riskParamsSnapshot: { ...mockRiskParamsBuyer, policyType: "PUT_BUYER" }, 
      };

      const result = await newTest.mutation(api.testUtils.createMinimalQuote, {
         minimalQuoteParams: minimalQuoteData as any, // Cast if type is too complex here
      });
      
      if (!result || !result.quoteId) { // Check if result and result.quoteId are defined
        throw new Error("Failed to create minimal quote for test or quoteId is missing");
      }
      quoteIdForResult = result.quoteId; // Assign here

      await expect(
        newTest.mutation(api.quotes.finalizeQuote, {
          quoteId: quoteIdForResult, // Use the assigned ID
          lockForTransaction: false,
        })
      ).rejects.toThrow("Could not fetch latest market data");
    });
  });
}); 