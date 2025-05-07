/**
 * Dependency Analyzer Tool
 * 
 * This tool helps analyze function calls across the codebase and identify
 * potential breakage points during refactoring.
 */

import { query, mutation, action } from "../../_generated/server";
import { v } from "convex/values";

/**
 * Interface for dependency records
 */
interface DependencyRecord {
  sourceFile: string;
  sourceFunction: string;
  targetFile: string;
  targetFunction: string;
  callCount: number;
  lastCalled: string;
}

/**
 * A registry of functions we want to track
 */
const TRACKED_FUNCTIONS = [
  // Blockchain Integration
  "getOraclePrice",
  "submitAggregatedPrice",
  "checkAndSubmitOraclePrice",
  "prepareOracleSubmission",
  "readLatestOraclePrice",
  "getStacksNetwork",
  "getBackendSignerKey",
  "signSetPriceTransaction",
  "broadcastSignedTransaction",
  "fetchAccountNonce",
  // Premium Calculation
  "calculateBlackScholesPremium",
  "getCurrentMarketData",
  "getActiveRiskParameters",
  // Mock Functions
  "mockGetTransactionStatus",
  "mockGetLatestBlockHeight",
  "mockGetCurrentBTCPrice",
  "mockCheckPoolLiquidity",
  "mockNotifyLiquidityPoolOfPremiumDistribution",
  "getBlockchainStatus"
];

/**
 * HOC function to wrap original functions and track dependencies
 * 
 * @param originalFn The original function to wrap
 * @param metadata Metadata about the function
 * @returns Wrapped function that logs dependencies
 */
export function trackDependency<T extends (...args: any[]) => any>(
  originalFn: T,
  metadata: {
    sourceFile: string;
    sourceFunction: string;
    targetFile: string;
    targetFunction: string;
  }
): T {
  // Only track functions we care about
  if (!TRACKED_FUNCTIONS.includes(metadata.targetFunction)) {
    return originalFn;
  }

  const wrappedFn = async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      // Log the dependency
      console.log(
        `[DEP_ANALYZER] ${metadata.sourceFile}.${metadata.sourceFunction} -> ${metadata.targetFile}.${metadata.targetFunction}`
      );

      // Record the dependency in the database (this will be implemented later)
      // await recordDependency(metadata);

      // Call the original function
      return await originalFn(...args);
    } catch (error) {
      console.error(
        `[DEP_ANALYZER] Error in ${metadata.targetFile}.${metadata.targetFunction}:`,
        error
      );
      throw error;
    }
  };

  return wrappedFn as T;
}

/**
 * Record a dependency in the database
 * This will be enabled once we have the appropriate schema
 */
/*
export const recordDependency = internalMutation({
  args: {
    sourceFile: v.string(),
    sourceFunction: v.string(),
    targetFile: v.string(),
    targetFunction: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if this dependency has been recorded before
    const existingRecord = await ctx.db
      .query("dependencies")
      .withIndex("by_source_target", (q) =>
        q
          .eq("sourceFile", args.sourceFile)
          .eq("sourceFunction", args.sourceFunction)
          .eq("targetFile", args.targetFile)
          .eq("targetFunction", args.targetFunction)
      )
      .first();

    if (existingRecord) {
      // Update the record
      await ctx.db.patch(existingRecord._id, {
        callCount: existingRecord.callCount + 1,
        lastCalled: new Date().toISOString(),
      });
    } else {
      // Create a new record
      await ctx.db.insert("dependencies", {
        sourceFile: args.sourceFile,
        sourceFunction: args.sourceFunction,
        targetFile: args.targetFile,
        targetFunction: args.targetFunction,
        callCount: 1,
        lastCalled: new Date().toISOString(),
      });
    }
  },
});
*/

/**
 * Get a list of all dependencies (to be implemented)
 */
/*
export const getDependencies = query({
  args: {
    sourceFile: v.optional(v.string()),
    targetFile: v.optional(v.string()),
    targetFunction: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let dbQuery = ctx.db.query("dependencies");

    if (args.sourceFile) {
      dbQuery = dbQuery.filter((q) =>
        q.eq(q.field("sourceFile"), args.sourceFile)
      );
    }

    if (args.targetFile) {
      dbQuery = dbQuery.filter((q) =>
        q.eq(q.field("targetFile"), args.targetFile)
      );
    }

    if (args.targetFunction) {
      dbQuery = dbQuery.filter((q) =>
        q.eq(q.field("targetFunction"), args.targetFunction)
      );
    }

    return await dbQuery.collect();
  },
});
*/

/**
 * Generate a dependency report (to be implemented)
 */
/*
export const generateDependencyReport = action({
  args: {},
  handler: async (ctx) => {
    const dependencies = await ctx.runQuery(getDependencies, {});
    
    // Group by target file and function
    const dependencyMap = new Map<string, DependencyRecord[]>();
    
    for (const dep of dependencies) {
      const key = `${dep.targetFile}.${dep.targetFunction}`;
      if (!dependencyMap.has(key)) {
        dependencyMap.set(key, []);
      }
      dependencyMap.get(key)!.push(dep);
    }
    
    // Generate report
    const report = {
      totalDependencies: dependencies.length,
      uniqueTargetFunctions: dependencyMap.size,
      mostCalledFunctions: [...dependencyMap.entries()]
        .map(([key, deps]) => ({
          function: key,
          callCount: deps.reduce((sum, dep) => sum + dep.callCount, 0),
          callers: deps.length,
        }))
        .sort((a, b) => b.callCount - a.callCount)
        .slice(0, 10),
      functionsByCallers: [...dependencyMap.entries()]
        .map(([key, deps]) => ({
          function: key,
          callers: deps.length,
          callCount: deps.reduce((sum, dep) => sum + dep.callCount, 0),
        }))
        .sort((a, b) => b.callers - a.callers)
        .slice(0, 10),
    };
    
    return report;
  },
});
*/

// Export the tracking function
export default trackDependency; 