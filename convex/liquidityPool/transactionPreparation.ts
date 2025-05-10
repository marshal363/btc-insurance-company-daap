import { v } from "convex/values";
import { mutation, internalMutation, query, internalQuery, action } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { internal, api } from "../_generated/api";
// import { internal } from "../_generated/api"; // Potentially for internal API calls
// import * as common from "../blockchain/common"; // For shared blockchain utilities/types

// --- Actual Helper Imports ---
import {
  ClarityValue, // Generic ClarityValue type
  uintCV,       // Creates a uint ClarityValue
  contractPrincipalCV as stacksContractPrincipalCV, // Renamed to avoid conflict with any local helper
  cvToHex,      // Example: if needed for any reason (usually not for package prep)
  StacksTransaction, // If we were to build full transactions (usually frontend)
  ChainID, // For network specification
} from "@stacks/transactions";

import {
  getNetworkEnvironment, // Use this to get the NetworkEnvironment enum value
  // getStacksNetwork, // This returns StacksNetwork object, not the enum needed by some helpers
} from "../blockchain/common/network";

import {
  // Assuming a function to get contract details (address, name)
  // The linter suggested getLiquidityPoolContract, let's try that or a generic getContractByName
  getContractByName, // A common pattern
  // For fungible token details, we might need a specific helper or it's part of contract config
} from "../blockchain/common/contracts";

import {
  // btcToSatoshis is available
  btcToSatoshis as convertBtcToSatoshisBase, // Renaming to avoid conflict if we define our own
  // microStxToStx is available, so stxToMicroStx needs to be implemented
  // formatAmountForDisplay needs to be implemented or found
  // parseClarityValue // Available, but more for reading responses
} from "../blockchain/common/utils"; // Corrected path

// It's possible NetworkEnvironment is in types.ts
import { NetworkEnvironment, BlockchainContract } from "../blockchain/common/types";

/**
 * @file convex/liquidityPool/transactionPreparation.ts
 * @description Handles the preparation of transaction packages for interacting
 * with the on-chain liquidity pool contract. This includes functions for
 * preparing capital commitment transactions.
 */

// TODO: Define types for Liquidity Pool transaction packages
// e.g., CapitalCommitmentTransactionPackage, CapitalCommitmentContractCallParams

// TODO: Implement prepareCapitalCommitmentTransaction (mutation or action)
// This function will be responsible for:
// - Fetching relevant quote details (if applicable)
// - Validating parameters
// - Calculating necessary on-chain parameters
// - Constructing the transaction package for the frontend to use for signing

// Example structure for a preparation function (to be refined in TP-105)
/*
export const prepareCapitalCommitmentTransaction = action({
  args: {
    quoteId: v.optional(v.string()), // Or specific parameters for commitment
    amount: v.number(), // Example: amount to commit
    providerAddress: v.string(), // User's address
  },
  handler: async (ctx, args) => {
    // 1. Validate input parameters
    // 2. Fetch necessary data (e.g., from quotes, system parameters)
    // 3. Perform calculations for on-chain values (e.g., unit conversions)
    // 4. Construct the transaction package
    //    - Target contract address and method name
    //    - Method arguments in the format expected by the smart contract
    //    - Any other metadata required by the frontend or for tracking

    // const transactionPackage = {
    //   contractAddress: "ST...", // Liquidity Pool contract address
    //   contractName: "liquidity-pool-vault",
    //   functionName: "commit-capital", // Or appropriate function name
    //   functionArgs: [...], // Array of Clarity values
    //   // Other relevant info: quoteId, human-readable details, etc.
    // };

    // return transactionPackage;
    throw new Error("Not yet implemented");
  },
});
*/

// TODO: Add unit tests for transaction preparation logic (TP-108) 

// --- Assumed Helper Imports (Actual paths and names might vary) ---
// import { ClarityValueJSON, contractPrincipalCV, uintCV } from "../blockchain/clarityUtils";
// import { StacksNetworkName } from "../blockchain/common/networks";
// import {
//   getLiquidityPoolContractDetails,
//   getFungibleTokenDetails,
//   getStacksNetwork,
// } from "../blockchain/common/contracts";
// import {
//   stxToMicroStx,
//   btcToSatoshis,
//   formatAmountForDisplay,
// } from "../blockchain/common/utils";

// --- Placeholder types until actual helpers are confirmed ---
type ClarityValueJSON = any; 
type StacksNetworkName = NetworkEnvironment;

// Type alias for clarity
type StacksNetworkEnv = NetworkEnvironment;

// Helper to create a contract principal CV when you only have the address string
const principalCVFromString = (principal: string): ClarityValue => {
  if (!principal.includes('.')) {
    return stacksContractPrincipalCV(principal, ''); // Name can be empty for standard principals
  }
  const [address, name] = principal.split('.');
  return stacksContractPrincipalCV(address, name);
};

const stxToMicroStx = (amount: number): bigint => BigInt(Math.floor(amount * 1_000_000));

const convertToBaseUnits = (amount: number, decimals: number): bigint => {
  if (decimals < 0 || !Number.isInteger(decimals)) {
    throw new Error("Decimals must be a non-negative integer.");
  }
  // Using Math.pow might lead to precision issues for large numbers if not careful.
  // For financial calculations, consider using a BigNumber library if precision becomes critical.
  // However, for simple multiplication by powers of 10, this should be okay for typical decimal places.
  return BigInt(Math.floor(amount * (10 ** decimals)));
};

const formatAmountForDisplay = (amountInBaseUnits: bigint, symbol: string, decimals: number): string => {
  if (decimals < 0 || !Number.isInteger(decimals)) {
    throw new Error("Decimals must be a non-negative integer for formatting.");
  }
  const factor = BigInt(10 ** decimals);
  const integerPart = amountInBaseUnits / factor;
  const fractionalPart = amountInBaseUnits % factor;

  if (fractionalPart === BigInt(0)) {
    return `${integerPart.toString()} ${symbol}`;
  }

  const fractionalString = fractionalPart.toString().padStart(decimals, '0');
  // Trim trailing zeros from the fractional part for cleaner display, but ensure at least one digit if not all zeros
  let trimmedFractional = fractionalString.replace(/0+$/, '');
  if (trimmedFractional === '') trimmedFractional = '0'; // if it was like .500 -> .5, .000 -> .0

  // If original fractional part was all zeros (e.g. 0.00), but we want to show ".0" or similar fixed point
  // For now, this simplified version will just show the integer if fractional is all zeros.
  // A more advanced version might take desired fixed decimal places as an argument.
  
  // Correction: The previous trim logic was a bit off.
  // Let's ensure the full decimal places are shown, padded with leading zeros.
  // The consumer can decide if they want to trim trailing zeros.
  // For example, 0.5 with 8 decimals should be 0.50000000
  return `${integerPart.toString()}.${fractionalString} ${symbol}`;
};
// --- End Placeholder ---


// --- Type Definitions ---

// Describes the on-chain call parameters
export type CapitalCommitmentContractCallParams = {
  contractAddress: string;
  contractName: string;
  functionName: "deposit-stx" | "deposit-sip010";
  functionArgs: ClarityValue[]; // Changed from ClarityValueJSON to ClarityValue
};

// The full package returned to the frontend
export type CapitalCommitmentTransactionPackage = {
  stxAddress: string;
  network: StacksNetworkEnv; // Use the imported NetworkEnvironment type alias
  contractCall: CapitalCommitmentContractCallParams;
  humanReadable: {
    commitmentAmount: string;
    providerAddress: string;
    tokenSymbol: "STX" | "sBTC";
  };
  quoteId?: Id<"quotes">;
};

const commitmentFromQuoteSchema = v.object({
  type: v.literal("quote"),
  quoteId: v.id("quotes"),
});

const directCommitmentSchema = v.object({
  type: v.literal("direct"),
  amount: v.number(),
  tokenSymbol: v.union(v.literal("STX"), v.literal("sBTC")),
});

// --- Internal Mutation for Locking Quote ---
const DEFAULT_PROVIDER_QUOTE_LOCK_DURATION_MINUTES = 5;

export const internalLockQuoteForCommitment = internalMutation({
  args: {
    quoteId: v.id("quotes"),
    lockDurationMinutes: v.number(),
  },
  handler: async (ctx, { quoteId, lockDurationMinutes }) => {
    const quote = await ctx.db.get(quoteId);
    if (!quote) {
      throw new Error(`Quote ${quoteId} not found.`);
    }
    if (quote.quoteType !== "provider") {
      throw new Error(`Quote ${quoteId} is not a provider quote.`);
    }
    // Ensure quote.status is a string before comparison
    const currentStatus = String(quote.status);
    if (currentStatus !== "active" && currentStatus !== "pending_commitment") {
      throw new Error(
        `Quote ${quoteId} has status ${currentStatus} and cannot be locked for commitment.`
      );
    }

    const now = Date.now();
    // Ensure quote.isLocked and quote.lockExpiresAt are treated correctly, potentially undefined
    const isCurrentlyLocked = !!quote.isLocked;
    const currentLockExpiresAt = typeof quote.lockExpiresAt === 'number' ? quote.lockExpiresAt : 0;

    if (isCurrentlyLocked && currentLockExpiresAt > now && currentStatus === "pending_commitment") {
      console.log(`Provider quote ${quoteId} is already locked for commitment and unexpired. Re-affirming lock or extending.`);
    } else if (isCurrentlyLocked && currentLockExpiresAt > now) {
       throw new Error(
        `Provider quote ${quoteId} is already locked (expires ${new Date(currentLockExpiresAt).toISOString()}) and not for commitment. Current status: ${currentStatus}.`
      );
    }

    const lockExpiresAt = now + lockDurationMinutes * 60 * 1000;
    await ctx.db.patch(quoteId, {
      isLocked: true,
      lockedAt: now,
      lockExpiresAt: lockExpiresAt,
      status: "pending_commitment",
    });

    console.log(
      `Provider quote ${quoteId} locked for commitment until ${new Date(
        lockExpiresAt
      ).toISOString()}`
    );
    return { success: true, lockExpiresAt, newStatus: "pending_commitment" };
  },
});

// --- Main Action for Preparing Transaction ---
export const prepareCapitalCommitmentTransaction = action({
  args: {
    providerAddress: v.string(),
    commitmentDetails: v.union(commitmentFromQuoteSchema, directCommitmentSchema),
    lockDurationMinutes: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { providerAddress, commitmentDetails, lockDurationMinutes }
  ): Promise<CapitalCommitmentTransactionPackage> => {
    let actualAmount: number;
    let actualTokenSymbol: "STX" | "sBTC";
    let quoteIdOptional: Id<"quotes"> | undefined = undefined;

    const currentNetworkEnv = getNetworkEnvironment();

    const liquidityPoolContractDetails = getContractByName("liquidity-pool-vault", currentNetworkEnv);
    if (!liquidityPoolContractDetails || !liquidityPoolContractDetails.address) {
        throw new Error("Liquidity pool contract details not found or address is missing for current network.");
    }

    if (commitmentDetails.type === "quote") {
      quoteIdOptional = commitmentDetails.quoteId;
      // Corrected path to api.quotes.getQuoteById
      const quote = await ctx.runQuery(api.quotes.getQuoteById, { id: commitmentDetails.quoteId as Id<"quotes"> });

      if (!quote) {
        throw new Error(`Quote ${quoteIdOptional} not found.`);
      }
      if (quote.quoteType !== "provider") {
        throw new Error(`Quote ${quoteIdOptional} is not for a provider.`);
      }
      const currentQuoteStatus = String(quote.status);
      if (currentQuoteStatus !== "active" && currentQuoteStatus !== "pending_commitment") {
        throw new Error(
          `Quote ${quoteIdOptional} has status ${currentQuoteStatus} and cannot be used for commitment.`
        );
      }
      if (!quote.providerParamsSnapshot || !quote.quoteResult) {
        throw new Error(`Quote ${quoteIdOptional} is missing provider parameters or results.`);
      }

      actualAmount = quote.providerParamsSnapshot.commitmentAmount;
      const assetUpper = String(quote.asset).toUpperCase();
      if (assetUpper === "BTC" || assetUpper === "SBTC") {
        actualTokenSymbol = "sBTC";
      } else if (assetUpper === "STX") {
        actualTokenSymbol = "STX";
      } else {
        throw new Error(`Unsupported asset ${String(quote.asset)} in quote ${quoteIdOptional}`);
      }
      
      const lockDuration = lockDurationMinutes ?? DEFAULT_PROVIDER_QUOTE_LOCK_DURATION_MINUTES;
      // Correct path to internal mutation if 'internal' is from '../_generated/api'
      // and transactionPreparation is a file within liquidityPool module.
      await ctx.runMutation(internal.liquidityPool.transactionPreparation.internalLockQuoteForCommitment, {
        quoteId: quoteIdOptional,
        lockDurationMinutes: lockDuration,
      });

    } else {
      actualAmount = commitmentDetails.amount;
      actualTokenSymbol = commitmentDetails.tokenSymbol;
    }

    if (actualAmount <= 0) {
      throw new Error("Commitment amount must be positive.");
    }

    let functionName: "deposit-stx" | "deposit-sip010";
    let functionArgs: ClarityValue[]; // Use ClarityValue from @stacks/transactions
    let amountInBaseUnits: bigint;
    
    let tokenDecimals: number;
    let sbtcContractPrincipalCV: ClarityValue | undefined = undefined;

    if (actualTokenSymbol === "STX") {
      functionName = "deposit-stx";
      tokenDecimals = 6; // STX has 6 decimals
      amountInBaseUnits = stxToMicroStx(actualAmount);
      functionArgs = [uintCV(amountInBaseUnits)];
    } else if (actualTokenSymbol === "sBTC") {
      functionName = "deposit-sip010";
      // Fetch sBTC contract details
      const sbtcContractInfo = getContractByName("sbtc-token", currentNetworkEnv); // Assuming "sbtc-token" is its configured name
      if (!sbtcContractInfo || !sbtcContractInfo.address) {
        throw new Error("sBTC contract details not found or address is missing.");
      }
      // Access decimals, ensuring it exists with a fallback, though now it should be on the type
      tokenDecimals = sbtcContractInfo.decimals ?? 8; 
      amountInBaseUnits = convertToBaseUnits(actualAmount, tokenDecimals);
      sbtcContractPrincipalCV = principalCVFromString(sbtcContractInfo.address); // Use helper for principal from string
      functionArgs = [
        sbtcContractPrincipalCV,
        uintCV(amountInBaseUnits),
      ];
    } else {
      const _exhaustiveCheck: never = actualTokenSymbol;
      throw new Error(`Unsupported token symbol: ${actualTokenSymbol}`);
    }

    const humanReadableAmount = formatAmountForDisplay(amountInBaseUnits, actualTokenSymbol, tokenDecimals);

    return {
      stxAddress: providerAddress,
      network: currentNetworkEnv,
      contractCall: {
        contractAddress: liquidityPoolContractDetails.address,
        contractName: liquidityPoolContractDetails.name,
        functionName: functionName,
        functionArgs: functionArgs,
      },
      humanReadable: {
        commitmentAmount: humanReadableAmount,
        providerAddress: providerAddress,
        tokenSymbol: actualTokenSymbol,
      },
      quoteId: quoteIdOptional,
    };
  },
});

// TODO: Add unit tests for transaction preparation logic (TP-108) 