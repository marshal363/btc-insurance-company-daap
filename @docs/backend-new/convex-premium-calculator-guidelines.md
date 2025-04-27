# Convex Premium Calculator Guidelines

## Overview

This document outlines the implementation details for the BitHedge Premium Calculator component within the Convex Backend-as-a-Service platform. The Premium Calculator is responsible for computing insurance premiums based on market volatility, historical data, and risk parameters.

## Core Components

### Premium Model Interface

```typescript
// src/premium/models/PremiumModelInterface.ts
export interface PremiumModelInput {
  assetPrice: number;
  volatility: number;
  duration: number; // in days
  coveragePercentage: number; // e.g. 0.95 for 95%
  riskParameters: RiskParameters;
}

export interface RiskParameters {
  baseRate: number;
  volatilityMultiplier: number;
  durationFactor: number;
  coverageFactor: number;
  underwritingCapacity: number;
}

export interface PremiumModelOutput {
  premium: number;
  annualizedRate: number;
  breakdown: {
    baseComponent: number;
    volatilityComponent: number;
    durationComponent: number;
    coverageComponent: number;
    marketAdjustment: number;
  };
}

export interface PremiumModelInterface {
  calculatePremium(input: PremiumModelInput): PremiumModelOutput;
  validateInputs(input: PremiumModelInput): boolean;
  getName(): string;
}
```

### Base Premium Model Implementation

```typescript
// src/premium/models/BasePremiumModel.ts
import {
  PremiumModelInterface,
  PremiumModelInput,
  PremiumModelOutput,
} from "./PremiumModelInterface";

export class BasePremiumModel implements PremiumModelInterface {
  getName(): string {
    return "BasePremiumModel";
  }

  validateInputs(input: PremiumModelInput): boolean {
    if (input.assetPrice <= 0) return false;
    if (input.volatility <= 0) return false;
    if (input.duration <= 0) return false;
    if (input.coveragePercentage <= 0 || input.coveragePercentage >= 1)
      return false;

    return true;
  }

  calculatePremium(input: PremiumModelInput): PremiumModelOutput {
    if (!this.validateInputs(input)) {
      throw new Error("Invalid premium calculation inputs");
    }

    const {
      assetPrice,
      volatility,
      duration,
      coveragePercentage,
      riskParameters,
    } = input;
    const { baseRate, volatilityMultiplier, durationFactor, coverageFactor } =
      riskParameters;

    // Calculate premium components
    const baseComponent = assetPrice * baseRate;
    const volatilityComponent = volatility * volatilityMultiplier;
    const durationComponent = Math.sqrt(duration) * durationFactor;
    const coverageComponent = Math.pow(coveragePercentage, 2) * coverageFactor;

    // Market adjustment based on capacity
    const utilization = this.getCapacityUtilization();
    const marketAdjustment = this.calculateMarketAdjustment(utilization);

    // Calculate final premium
    const premium =
      (baseComponent + volatilityComponent) *
      durationComponent *
      coverageComponent *
      marketAdjustment;

    // Annualized rate
    const annualizedRate =
      (premium / (assetPrice * coveragePercentage)) * (365 / duration);

    return {
      premium,
      annualizedRate,
      breakdown: {
        baseComponent,
        volatilityComponent,
        durationComponent,
        coverageComponent,
        marketAdjustment,
      },
    };
  }

  private getCapacityUtilization(): number {
    // In a real implementation, this would query the current capacity utilization
    // For now, return a mock value
    return 0.7; // 70% utilization
  }

  private calculateMarketAdjustment(utilization: number): number {
    // Exponential curve that increases premium as utilization increases
    return 1 + Math.pow(utilization, 2);
  }
}
```

### BlackScholes Model Implementation

```typescript
// src/premium/models/BlackScholesPremiumModel.ts
import {
  PremiumModelInterface,
  PremiumModelInput,
  PremiumModelOutput,
} from "./PremiumModelInterface";

export class BlackScholesPremiumModel implements PremiumModelInterface {
  getName(): string {
    return "BlackScholesPremiumModel";
  }

  validateInputs(input: PremiumModelInput): boolean {
    if (input.assetPrice <= 0) return false;
    if (input.volatility <= 0) return false;
    if (input.duration <= 0) return false;
    if (input.coveragePercentage <= 0 || input.coveragePercentage >= 1)
      return false;

    return true;
  }

  calculatePremium(input: PremiumModelInput): PremiumModelOutput {
    if (!this.validateInputs(input)) {
      throw new Error("Invalid premium calculation inputs");
    }

    const { assetPrice, volatility, duration, coveragePercentage } = input;

    // Calculate strike price (the price at which insurance pays out)
    const strikePrice = assetPrice * coveragePercentage;

    // Convert duration to years
    const timeToExpiry = duration / 365;

    // Risk-free rate (simplified)
    const riskFreeRate = 0.02; // 2%

    // Calculate d1 and d2 for Black-Scholes
    const d1 =
      (Math.log(assetPrice / strikePrice) +
        (riskFreeRate + Math.pow(volatility, 2) / 2) * timeToExpiry) /
      (volatility * Math.sqrt(timeToExpiry));
    const d2 = d1 - volatility * Math.sqrt(timeToExpiry);

    // Calculate put option price using Black-Scholes formula
    const putPrice =
      strikePrice *
        Math.exp(-riskFreeRate * timeToExpiry) *
        this.normalCDF(-d2) -
      assetPrice * this.normalCDF(-d1);

    // Apply risk adjustment
    const riskAdjusted = putPrice * (1 + input.riskParameters.baseRate);

    // Calculate components for breakdown
    const baseComponent = putPrice;
    const volatilityComponent = putPrice * (volatility / 0.5); // Normalized to "standard" volatility
    const durationComponent = Math.sqrt(timeToExpiry);
    const coverageComponent = coveragePercentage;
    const marketAdjustment = this.calculateMarketAdjustment();

    // Calculate final premium with market adjustment
    const premium = riskAdjusted * marketAdjustment;

    // Annualized rate
    const annualizedRate =
      (premium / (assetPrice * coveragePercentage)) * (1 / timeToExpiry);

    return {
      premium,
      annualizedRate,
      breakdown: {
        baseComponent,
        volatilityComponent,
        durationComponent,
        coverageComponent,
        marketAdjustment,
      },
    };
  }

  private normalCDF(x: number): number {
    // Approximation of the cumulative distribution function
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp((-x * x) / 2);
    let probability =
      d *
      t *
      (0.3193815 +
        t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

    if (x > 0) {
      probability = 1 - probability;
    }

    return probability;
  }

  private calculateMarketAdjustment(): number {
    // In a real implementation, this would factor in market conditions
    // For now, return a mock value
    return 1.2;
  }
}
```

### Premium Calculator Service

```typescript
// src/premium/PremiumCalculatorService.ts
import {
  PremiumModelInterface,
  PremiumModelInput,
  PremiumModelOutput,
} from "./models/PremiumModelInterface";
import { BasePremiumModel } from "./models/BasePremiumModel";
import { BlackScholesPremiumModel } from "./models/BlackScholesPremiumModel";
import { OracleService } from "../oracle/OracleService";
import { mutation } from "../_generated/server";

export class PremiumCalculatorService {
  private models: Map<string, PremiumModelInterface> = new Map();
  private defaultModel: string = "BlackScholesPremiumModel";
  private oracleService: OracleService;

  constructor(oracleService: OracleService) {
    this.oracleService = oracleService;

    // Register available models
    this.registerModel(new BasePremiumModel());
    this.registerModel(new BlackScholesPremiumModel());
  }

  registerModel(model: PremiumModelInterface): void {
    this.models.set(model.getName(), model);
  }

  setDefaultModel(modelName: string): void {
    if (!this.models.has(modelName)) {
      throw new Error(`Unknown model: ${modelName}`);
    }
    this.defaultModel = modelName;
  }

  async calculatePremium(
    asset: string,
    duration: number,
    coveragePercentage: number,
    modelName?: string
  ): Promise<PremiumModelOutput> {
    // Use specified model or default
    const selectedModelName = modelName || this.defaultModel;
    const model = this.models.get(selectedModelName);

    if (!model) {
      throw new Error(`Model not found: ${selectedModelName}`);
    }

    // Get latest asset price and volatility from Oracle
    const assetPrice = await this.oracleService.getLatestPrice(asset);
    const volatility = await this.oracleService.getHistoricalVolatility(
      asset,
      30
    ); // 30-day volatility

    // Get risk parameters
    const riskParameters = await this.getRiskParameters(asset);

    // Create input for model
    const input: PremiumModelInput = {
      assetPrice,
      volatility,
      duration,
      coveragePercentage,
      riskParameters,
    };

    // Calculate premium
    return model.calculatePremium(input);
  }

  private async getRiskParameters(asset: string): Promise<any> {
    // In a real implementation, this would fetch from a database
    // For now, return mock values
    return {
      baseRate: 0.01,
      volatilityMultiplier: 0.5,
      durationFactor: 0.05,
      coverageFactor: 1.5,
      underwritingCapacity: 1000000,
    };
  }
}

// Convex mutation implementation
export const calculatePremium = mutation({
  args: {
    asset: "string",
    duration: "number",
    coveragePercentage: "number",
    modelName: "string?",
  },
  handler: async (ctx, args) => {
    // Ensure user is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const oracleService = new OracleService();
    const premiumService = new PremiumCalculatorService(oracleService);

    const premium = await premiumService.calculatePremium(
      args.asset,
      args.duration,
      args.coveragePercentage,
      args.modelName
    );

    // Log premium calculation for auditing
    await ctx.db.insert("premiumCalculations", {
      userId: identity.subject,
      asset: args.asset,
      duration: args.duration,
      coveragePercentage: args.coveragePercentage,
      premium: premium.premium,
      annualizedRate: premium.annualizedRate,
      timestamp: new Date().toISOString(),
    });

    return premium;
  },
});
```

## Risk Parameter Management

### Risk Parameter Schema

```typescript
// src/premium/RiskParameterSchema.ts
import { defineSchema, defineTable } from "convex/schema";

export default defineSchema({
  riskParameters: defineTable({
    asset: "string",
    baseRate: "number",
    volatilityMultiplier: "number",
    durationFactor: "number",
    coverageFactor: "number",
    underwritingCapacity: "number",
    lastUpdated: "string",
    updatedBy: "string",
  }).index("by_asset", ["asset"]),

  riskParameterHistory: defineTable({
    asset: "string",
    parameters: "object",
    updatedAt: "string",
    updatedBy: "string",
    reason: "string",
  }).index("by_asset_and_date", ["asset", "updatedAt"]),
});
```

### Risk Parameter Service

```typescript
// src/premium/RiskParameterService.ts
import { mutation, query } from "../_generated/server";

// Query to get risk parameters for an asset
export const getRiskParameters = query({
  args: { asset: "string" },
  handler: async (ctx, args) => {
    const parameters = await ctx.db
      .query("riskParameters")
      .withIndex("by_asset", (q) => q.eq("asset", args.asset))
      .first();

    if (!parameters) {
      throw new Error(`No risk parameters found for asset: ${args.asset}`);
    }

    return parameters;
  },
});

// Mutation to update risk parameters
export const updateRiskParameters = mutation({
  args: {
    asset: "string",
    baseRate: "number",
    volatilityMultiplier: "number",
    durationFactor: "number",
    coverageFactor: "number",
    underwritingCapacity: "number",
    reason: "string",
  },
  handler: async (ctx, args) => {
    // Ensure user is authenticated and authorized
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.tokenIdentifier.includes("admin")) {
      throw new Error("Unauthorized");
    }

    const existingParams = await ctx.db
      .query("riskParameters")
      .withIndex("by_asset", (q) => q.eq("asset", args.asset))
      .first();

    const now = new Date().toISOString();

    if (existingParams) {
      // Update existing parameters
      await ctx.db.patch(existingParams._id, {
        baseRate: args.baseRate,
        volatilityMultiplier: args.volatilityMultiplier,
        durationFactor: args.durationFactor,
        coverageFactor: args.coverageFactor,
        underwritingCapacity: args.underwritingCapacity,
        lastUpdated: now,
        updatedBy: identity.subject,
      });
    } else {
      // Create new parameters
      await ctx.db.insert("riskParameters", {
        asset: args.asset,
        baseRate: args.baseRate,
        volatilityMultiplier: args.volatilityMultiplier,
        durationFactor: args.durationFactor,
        coverageFactor: args.coverageFactor,
        underwritingCapacity: args.underwritingCapacity,
        lastUpdated: now,
        updatedBy: identity.subject,
      });
    }

    // Record history
    await ctx.db.insert("riskParameterHistory", {
      asset: args.asset,
      parameters: {
        baseRate: args.baseRate,
        volatilityMultiplier: args.volatilityMultiplier,
        durationFactor: args.durationFactor,
        coverageFactor: args.coverageFactor,
        underwritingCapacity: args.underwritingCapacity,
      },
      updatedAt: now,
      updatedBy: identity.subject,
      reason: args.reason,
    });

    return {
      success: true,
      asset: args.asset,
      timestamp: now,
    };
  },
});
```

## Premium Caching and Optimization

### Premium Cache Service

```typescript
// src/premium/PremiumCacheService.ts
import { mutation, query } from "../_generated/server";

// Cache premium calculations to avoid recalculating similar values
export const cachePremiumCalculation = mutation({
  args: {
    asset: "string",
    assetPrice: "number",
    volatility: "number",
    duration: "number",
    coveragePercentage: "number",
    modelName: "string",
    premium: "number",
    annualizedRate: "number",
    breakdown: "object",
  },
  handler: async (ctx, args) => {
    // Create a cache key
    const cacheKey = `${args.asset}:${args.modelName}:${args.duration}:${args.coveragePercentage}`;

    await ctx.db.insert("premiumCache", {
      cacheKey,
      asset: args.asset,
      assetPrice: args.assetPrice,
      volatility: args.volatility,
      duration: args.duration,
      coveragePercentage: args.coveragePercentage,
      modelName: args.modelName,
      premium: args.premium,
      annualizedRate: args.annualizedRate,
      breakdown: args.breakdown,
      calculatedAt: new Date().toISOString(),
      ttl: new Date(Date.now() + 1000 * 60 * 15).toISOString(), // 15 minute TTL
    });

    return { success: true };
  },
});

// Query cached premium calculation
export const getCachedPremium = query({
  args: {
    asset: "string",
    duration: "number",
    coveragePercentage: "number",
    modelName: "string",
  },
  handler: async (ctx, args) => {
    const cacheKey = `${args.asset}:${args.modelName}:${args.duration}:${args.coveragePercentage}`;

    const cachedResult = await ctx.db
      .query("premiumCache")
      .filter((q) => q.eq(q.field("cacheKey"), cacheKey))
      .order("desc")
      .first();

    if (!cachedResult) {
      return null;
    }

    // Check if cache is still valid
    if (new Date(cachedResult.ttl) < new Date()) {
      return null;
    }

    return {
      premium: cachedResult.premium,
      annualizedRate: cachedResult.annualizedRate,
      breakdown: cachedResult.breakdown,
      cachedAt: cachedResult.calculatedAt,
    };
  },
});
```

## Testing and Validation

### Unit Tests for Premium Models

```typescript
// src/premium/models/__tests__/BlackScholesPremiumModel.test.ts
import { BlackScholesPremiumModel } from "../BlackScholesPremiumModel";
import { PremiumModelInput } from "../PremiumModelInterface";

describe("BlackScholesPremiumModel", () => {
  const model = new BlackScholesPremiumModel();

  test("validates inputs correctly", () => {
    // Valid inputs
    const validInput: PremiumModelInput = {
      assetPrice: 50000,
      volatility: 0.5,
      duration: 30,
      coveragePercentage: 0.9,
      riskParameters: {
        baseRate: 0.01,
        volatilityMultiplier: 0.5,
        durationFactor: 0.05,
        coverageFactor: 1.5,
        underwritingCapacity: 1000000,
      },
    };
    expect(model.validateInputs(validInput)).toBe(true);

    // Invalid price
    const invalidPrice = { ...validInput, assetPrice: -100 };
    expect(model.validateInputs(invalidPrice)).toBe(false);

    // Invalid volatility
    const invalidVol = { ...validInput, volatility: -0.1 };
    expect(model.validateInputs(invalidVol)).toBe(false);

    // Invalid duration
    const invalidDur = { ...validInput, duration: 0 };
    expect(model.validateInputs(invalidDur)).toBe(false);

    // Invalid coverage
    const invalidCov = { ...validInput, coveragePercentage: 1.1 };
    expect(model.validateInputs(invalidCov)).toBe(false);
  });

  test("calculates premium correctly", () => {
    const input: PremiumModelInput = {
      assetPrice: 50000,
      volatility: 0.5,
      duration: 30,
      coveragePercentage: 0.9,
      riskParameters: {
        baseRate: 0.01,
        volatilityMultiplier: 0.5,
        durationFactor: 0.05,
        coverageFactor: 1.5,
        underwritingCapacity: 1000000,
      },
    };

    const result = model.calculatePremium(input);

    // Basic assertions
    expect(result.premium).toBeGreaterThan(0);
    expect(result.annualizedRate).toBeGreaterThan(0);
    expect(result.breakdown).toBeDefined();

    // More precise assertions would depend on expected values
    // ...
  });

  test("throws error for invalid inputs", () => {
    const invalidInput: PremiumModelInput = {
      assetPrice: -50000,
      volatility: 0.5,
      duration: 30,
      coveragePercentage: 0.9,
      riskParameters: {
        baseRate: 0.01,
        volatilityMultiplier: 0.5,
        durationFactor: 0.05,
        coverageFactor: 1.5,
        underwritingCapacity: 1000000,
      },
    };

    expect(() => model.calculatePremium(invalidInput)).toThrow(
      "Invalid premium calculation inputs"
    );
  });
});
```

## Integration with Oracle

### Oracle Data Provider Interface

```typescript
// src/premium/OracleDataProvider.ts
import { OracleService } from "../oracle/OracleService";

export interface OracleDataProvider {
  getAssetPrice(asset: string): Promise<number>;
  getVolatility(asset: string, period: number): Promise<number>;
  getMarketSentiment(asset: string): Promise<number>; // -1 to 1 scale
}

export class ConvexOracleProvider implements OracleDataProvider {
  private oracleService: OracleService;

  constructor(oracleService: OracleService) {
    this.oracleService = oracleService;
  }

  async getAssetPrice(asset: string): Promise<number> {
    return this.oracleService.getLatestPrice(asset);
  }

  async getVolatility(asset: string, period: number): Promise<number> {
    return this.oracleService.getHistoricalVolatility(asset, period);
  }

  async getMarketSentiment(asset: string): Promise<number> {
    return this.oracleService.getMarketSentiment(asset);
  }
}
```

## Usage Examples

### Example: Calculate Premium from Client

```typescript
// Example: calculating premium from a client
import { calculatePremium } from "./_generated/api";

async function getPremiumQuote(asset, duration, coveragePercentage) {
  try {
    const premium = await calculatePremium({
      asset,
      duration,
      coveragePercentage,
      modelName: "BlackScholesPremiumModel",
    });

    console.log(`Premium: ${premium.premium}`);
    console.log(`Annual Rate: ${premium.annualizedRate * 100}%`);
    console.log("Breakdown:", premium.breakdown);

    return premium;
  } catch (error) {
    console.error("Error calculating premium:", error);
    throw error;
  }
}

// Example usage
getPremiumQuote("BTC", 30, 0.9)
  .then((premium) => {
    // Use premium data
  })
  .catch((error) => {
    // Handle error
  });
```

## Security Considerations

### Input Validation

Always validate inputs before performing calculations. Invalid inputs can lead to incorrect premiums or system failures.

### Rate Limiting

Implement rate limiting on premium calculation endpoints to prevent abuse and denial of service attacks.

### Audit Logging

Log all premium calculations and parameter changes for audit purposes.

### Access Control

Restrict access to premium calculation parameters to authorized administrators only.

## Deployment Guidelines

### Environment Variables

```
ORACLE_API_KEY=your_api_key
RISK_PARAMETER_UPDATE_KEY=your_secret_key
MODEL_DEFAULT=BlackScholesPremiumModel
```

### Monitoring

Monitor premium calculation service for errors, performance issues, and unexpected premium values.

## Related Documents

- [Convex Oracle Implementation Guidelines](./convex-oracle-implementation-guidelines.md)
- [Convex-to-Blockchain Integration Patterns](./convex-blockchain-integration-guidelines.md)
- [Oracle Contract Specification](./oracle-contract-specification.md)
