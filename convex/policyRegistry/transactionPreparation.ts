import { internalMutation, action } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { api, internal } from "../_generated/api"; // Import api and internal
import { stxToMicroStx, btcToSatoshis, usdToCents } from "../blockchain/common/utils"; // Import conversion utils
import { getLiquidityPoolContract, getContractByName } from "../blockchain/common/contracts"; // Import for counterparty and policy registry
import { 
    getStacksNetwork, // Import the function
} from "../blockchain/common/network"; 
import { NetworkEnvironment } from "../blockchain/common/types"; // Corrected import for NetworkEnvironment
import { type StacksNetwork } from "@stacks/network"; // Import type directly
import {
  uintCV,
  stringAsciiCV,
  standardPrincipalCV,
  someCV,
  noneCV,
  ClarityValue,
  AnchorMode,
  PostConditionMode,
  type ContractCallOptions
} from "@stacks/transactions";
// Assuming QB-101, QB-102, QB-103 (quote fetching & locking) are handled elsewhere.
// We will also need a way to get current burn-block-height for expirationHeight calculation.

// Define a new interface for the serializable structure returned to the frontend
interface SerializableFunctionArg {
  cvFunction: string; // e.g., "uintCV", "standardPrincipalCV", "stringAsciiCV"
  rawValue: any;
}

interface SerializableContractCallOptions {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: SerializableFunctionArg[];
  network?: string;
  anchorMode: number; // AnchorMode enum (e.g., AnchorMode.Any which is 3)
  postConditionMode?: number; // PostConditionMode enum (e.g., PostConditionMode.Deny which is 2)
  fee?: any; // Using any for now, can be refined if fee structure is fixed
  // senderAddress is NOT part of what we prepare for the frontend (wallet provides it)
}

// Schema for the serializable contract call options
const serializableContractCallOptionsSchema = v.object({
  contractAddress: v.string(),
  contractName: v.string(),
  functionName: v.string(),
  functionArgs: v.array(v.object({
    cvFunction: v.string(),
    rawValue: v.any(),
  })),
  network: v.optional(v.string()),
  anchorMode: v.number(),
  postConditionMode: v.optional(v.number()),
  fee: v.optional(v.any()),
});

// This type is what the frontend will receive and use.
// The frontend will need to reconstruct ClarityValues from functionArgs.
// export type FrontendContractCallParams = ContractCallOptions; // KEEPING OLD FOR REFERENCE, BUT WE'LL USE SerializableContractCallOptions in the package

// Define the full transaction package returned to the frontend.
const policyCreationTransactionPackageSchema = v.object({ // Renamed for clarity
  newTransactionId: v.id("transactions"), 
  contractCallParameters: serializableContractCallOptionsSchema, // Use the new serializable schema
  quoteId: v.id("quotes"), 
});

export type PolicyCreationTransactionPackage = {
  newTransactionId: Id<"transactions">;
  contractCallParameters: SerializableContractCallOptions; // This is what the frontend gets
  quoteId: Id<"quotes">;
};

const AVG_STACKS_BLOCKS_PER_DAY = 144; // Stacks: ~144 blocks/day (1 block ~10 mins)

// Renamed to internal mutation, takes currentBurnBlockHeight as arg
export const internalPreparePolicyCreationTransaction = internalMutation({
  args: {
    quoteId: v.id("quotes"), 
    userStxAddress: v.string(), 
    currentBurnBlockHeight: v.number(),
    networkUsed: v.string(), // e.g., "devnet", "testnet", "mainnet"
  },
  handler: async (ctx, args): Promise<PolicyCreationTransactionPackage> => {
    const { quoteId, userStxAddress, currentBurnBlockHeight, networkUsed } = args;
    console.log(`[TransactionPreparationInternal] Preparing policy creation for quoteId: ${quoteId}, BurnHeight: ${currentBurnBlockHeight}`);

    const quote: Doc<"quotes"> | null = await ctx.db.get(quoteId);

    if (!quote) {
      throw new Error(`Quote ${quoteId} not found.`);
    }

    if (!quote.isLocked) {
      throw new Error(`Quote ${quoteId} is not locked. Please lock the quote before proceeding.`);
    }
    if (!quote.lockExpiresAt || quote.lockExpiresAt < Date.now()) {
      throw new Error(`Quote ${quoteId} lock has expired. Please re-finalize the quote.`);
    }
    const terminalOrProcessedStatuses = ["expired", "purchased", "committed", "declined"];
    if (terminalOrProcessedStatuses.includes(quote.status)) {
      throw new Error(`Quote ${quoteId} is in a terminal or already processed state: ${quote.status}.`);
    }
    
    console.log(`[TransactionPreparationInternal] Fetched and validated quote: ${quote._id}`);

    if (!quote.buyerParamsSnapshot) {
      throw new Error(`Quote ${quoteId} is missing buyerParamsSnapshot.`);
    }
    if (!quote.marketDataSnapshot) {
      throw new Error(`Quote ${quoteId} is missing marketDataSnapshot.`);
    }
    if (!quote.quoteResult || typeof quote.quoteResult.premium !== 'number') {
      throw new Error(`Quote ${quoteId} is missing quoteResult or premium.`);
    }
    if (!quote.buyerParamsSnapshot.policyType || (quote.buyerParamsSnapshot.policyType !== "PUT" && quote.buyerParamsSnapshot.policyType !== "CALL")) {
      throw new Error("Invalid policy type in quote.");
    }
    if (typeof quote.buyerParamsSnapshot.protectionAmount !== 'number') {
        throw new Error("Missing protectionAmount in quote.buyerParamsSnapshot");
    }
    if (typeof quote.buyerParamsSnapshot.expirationDays !== 'number') {
        throw new Error("Missing expirationDays in quote.buyerParamsSnapshot");
    }
    if (typeof quote.marketDataSnapshot.btcPrice !== 'number') {
        throw new Error("Missing btcPrice in quote.marketDataSnapshot");
    }
    if (typeof quote.buyerParamsSnapshot.protectedValuePercentage !== 'number') {
        throw new Error("Missing protectedValuePercentage in quote.buyerParamsSnapshot");
    }
    if (typeof quote.buyerParamsSnapshot.riskTier !== 'string') {
        throw new Error("Missing riskTier in quote.buyerParamsSnapshot");
    }
    if (typeof quote.buyerParamsSnapshot.protectedAssetName !== 'string') {
        throw new Error("Missing protectedAssetName in quote.buyerParamsSnapshot");
    }
    if (typeof quote.buyerParamsSnapshot.collateralTokenName !== 'string') {
        throw new Error("Missing collateralTokenName in quote.buyerParamsSnapshot");
    }

    const ownerAddress = userStxAddress;
    
    // Get counterparty address from centralized contract config
    const liquidityPoolContract = getLiquidityPoolContract(); // Uses current env by default
    const counterpartyAddress = liquidityPoolContract.address;

    if (!counterpartyAddress) {
      console.error("CRITICAL: Liquidity Pool (Counterparty) STX_ADDRESS could not be determined.");
      throw new Error("System configuration error: Counterparty address is not configured correctly.");
    }
    
    const amountBTC = quote.buyerParamsSnapshot.protectionAmount;
    // TODO: Determine positionType, collateralToken, settlementToken based on conventions or quote data
    // For now, using placeholders or typical values for a BTC PUT option buyer.
    const collateralTokenString = "BTC";    // Example: This should align with what the LP holds as collateral for this policy type
    
    // LPI-101: Collateral Check
    console.log(`[TransactionPreparationInternal] Performing collateral check for token: ${collateralTokenString}`);
    const poolMetricsRaw = await ctx.runQuery(api.liquidityPool.poolState.getPoolMetrics, { token: collateralTokenString });

    // Check if poolMetricsRaw is null, or if it's not the expected Doc<"pool_metrics"> structure
    // by verifying the presence of essential fields like '_id' and 'available_liquidity'.
    if (!poolMetricsRaw || !('_id' in poolMetricsRaw && typeof (poolMetricsRaw as any).available_liquidity === 'number')) {
        console.warn(`[TransactionPreparationInternal] Pool metrics not found or in unexpected format for token: ${collateralTokenString}. Response:`, poolMetricsRaw);
        throw new Error(`Insufficient Liquidity Pool collateral (metrics unavailable or in wrong format for ${collateralTokenString}).`);
    }
    // At this point, poolMetricsRaw has been validated to be shaped like Doc<"pool_metrics">.
    const poolMetrics: Doc<"pool_metrics"> = poolMetricsRaw as Doc<"pool_metrics">;

    const requiredCollateralSatoshis = btcToSatoshis(amountBTC); // Assuming protectionAmount is in BTC
    
    console.log(`[TransactionPreparationInternal] Required collateral (Satoshis): ${requiredCollateralSatoshis}, Available in LP (Satoshis): ${poolMetrics.available_liquidity}`);

    if (poolMetrics.available_liquidity < requiredCollateralSatoshis) {
        console.warn(`[TransactionPreparationInternal] Insufficient collateral. Required: ${requiredCollateralSatoshis}, Available: ${poolMetrics.available_liquidity}`);
        throw new Error(`Insufficient Liquidity Pool collateral to back this policy. Required: ${requiredCollateralSatoshis} ${collateralTokenString} (Satoshis), Available: ${poolMetrics.available_liquidity} ${collateralTokenString} (Satoshis).`);
    }
    console.log("[TransactionPreparationInternal] Collateral check passed.");
    // End LPI-101

    const strikePriceUSD = (quote.marketDataSnapshot.btcPrice * quote.buyerParamsSnapshot.protectedValuePercentage) / 100;
    const premiumSTX = quote.quoteResult.premium; // Premium is in STX
    const expirationDays = quote.buyerParamsSnapshot.expirationDays;
    const policyTypeString = quote.buyerParamsSnapshot.policyType; // "PUT" or "CALL"
    
    // PCIA-203: Source riskTier and protectedAssetName from the quote document
    const riskTierString = quote.buyerParamsSnapshot.riskTier;
    const protectedAssetString = quote.buyerParamsSnapshot.protectedAssetName;
    
    console.log(`[TransactionPreparationInternal] Using risk tier from quote: ${riskTierString}`);
    console.log(`[TransactionPreparationInternal] Using protected asset from quote: ${protectedAssetString}`);

    // PCIA-205: Source collateralTokenNameString from quote
    const collateralTokenNameString = quote.buyerParamsSnapshot.collateralTokenName;
    console.log(`[TransactionPreparationInternal] Using collateral token name from quote: ${collateralTokenNameString}`);

    // const positionTypeString = "LONG_PUT"; // Not a direct contract param, remove
    // const counterpartyAddress = liquidityPoolContract.address; // Not a direct contract param, remove

    // PCIA-203: Removed riskTier calculation logic as it's now sourced from the quote.
    
    // Get Contract Details
    const policyRegistryContract = getContractByName("policy-registry");
    const contractAddress = policyRegistryContract.address;
    const contractName = policyRegistryContract.name;
    const functionName = "create-protection-policy";

    // Construct SERIALIZABLE functionArgs according to policy-registry.clar::create-protection-policy
    // (policy-owner-principal principal)
    // (policy-type (string-ascii 8))
    // (risk-tier (string-ascii 32))
    // (protected-asset-name (string-ascii 10))
    // (collateral-token-name (string-ascii 32))
    // (protected-value-scaled uint)       ; USD Cents
    // (protection-amount-scaled uint)     ; Satoshis
    // (expiration-height uint)
    // (submitted-premium-scaled uint)     ; microSTX
    const serializableFunctionArgs: SerializableFunctionArg[] = [
      { cvFunction: "standardPrincipalCV", rawValue: ownerAddress },
      { cvFunction: "stringAsciiCV", rawValue: policyTypeString }, // e.g., "PUT" (len 3 <= 8)
      { cvFunction: "stringAsciiCV", rawValue: riskTierString },   // e.g., "conservative" (len 12 <= 32)
      { cvFunction: "stringAsciiCV", rawValue: protectedAssetString }, // "BTC" (len 3 <= 10)
      { cvFunction: "stringAsciiCV", rawValue: collateralTokenNameString }, // "STX" (len 3 <= 32)
      { cvFunction: "uintCV", rawValue: usdToCents(strikePriceUSD) },
      { cvFunction: "uintCV", rawValue: btcToSatoshis(amountBTC) },
      { cvFunction: "uintCV", rawValue: currentBurnBlockHeight + (expirationDays * AVG_STACKS_BLOCKS_PER_DAY) }, // expirationHeight
      { cvFunction: "uintCV", rawValue: stxToMicroStx(premiumSTX) } // submitted-premium-scaled (microSTX)
      // positionTypeString, counterpartyAddress, settlementTokenString removed as they are not direct contract params.
    ];

    // Assemble ContractCallOptions for the frontend
    // This now uses the SerializableContractCallOptions structure
    const serializableContractCallParams: SerializableContractCallOptions = {
      contractAddress,
      contractName,
      functionName,
      functionArgs: serializableFunctionArgs,
      network: networkUsed, // This is the string like "devnet", "testnet"
      anchorMode: AnchorMode.Any, // This is an enum, typically a number
      postConditionMode: PostConditionMode.Deny, // This is an enum, typically a number
      // fee can be omitted to use wallet defaults
    };

    // Store semantic parameters for backend use (unchanged from previous logic)
    const storedParameters = {
      owner: ownerAddress,
      // counterparty: counterpartyAddress, // Removed from direct contract call
      protectedValue: usdToCents(strikePriceUSD), 
      protectionAmount: btcToSatoshis(amountBTC), 
      expirationHeight: currentBurnBlockHeight + (expirationDays * AVG_STACKS_BLOCKS_PER_DAY),
      premium: stxToMicroStx(premiumSTX), 
      policyType: policyTypeString,
      // positionType: positionTypeString, // Removed from direct contract call
      collateralToken: collateralTokenNameString, // Storing the effective collateral token name
      // settlementToken: settlementTokenString, // Removed from direct contract call
      riskTier: riskTierString,
      protectedAsset: protectedAssetString, // Added for completeness
    };

    const userIdForTransaction = userStxAddress; 
    const newTransactionId = await ctx.runMutation(api.transactions.createTransaction, {
      quoteId: quoteId,
      type: "POLICY_CREATION", 
      network: networkUsed, 
      parameters: storedParameters, // Store the semantic parameters
      userId: userIdForTransaction, 
    });

    if (!newTransactionId) {
        throw new Error("Failed to create a transaction record in the backend.");
    }

    const transactionPackage: PolicyCreationTransactionPackage = {
      newTransactionId: newTransactionId,
      contractCallParameters: serializableContractCallParams, // Return the serializable options
      quoteId: quoteId,
    };
    console.log("[TransactionPreparationInternal] Prepared transaction package with new Tx ID:", transactionPackage.newTransactionId);

    return transactionPackage;
  },
});

// New public action to orchestrate the process
export const preparePolicyCreationPackage = action({
    args: {
        quoteId: v.id("quotes"), 
        userStxAddress: v.string(), 
        networkUsed: v.string(), // Added: Frontend should pass this based on current wallet network
    },
    // Update return type promise for the action as well
    handler: async (ctx, args): Promise<PolicyCreationTransactionPackage> => {
        console.log(`[PolicyCreationAction] Initiating policy creation package for quoteId: ${args.quoteId}`);

        // Step 1: Fetch current burn block height
        const currentBurnBlockHeight = await ctx.runAction(api.stacksNode.getCurrentBurnBlockHeight, {});
        if (typeof currentBurnBlockHeight !== 'number') {
            console.error("[PolicyCreationAction] Failed to fetch a valid currentBurnBlockHeight.");
            throw new Error("System error: Could not determine current block height for policy creation.");
        }

        console.log(`[PolicyCreationAction] Current burn block height: ${currentBurnBlockHeight}`);

        // Step 2: Call the internal mutation with all required arguments
        const transactionPackage = await ctx.runMutation(internal.policyRegistry.transactionPreparation.internalPreparePolicyCreationTransaction, {
            quoteId: args.quoteId,
            userStxAddress: args.userStxAddress,
            currentBurnBlockHeight: currentBurnBlockHeight,
            networkUsed: args.networkUsed, // Pass networkUsed down
        });
        
        console.log(`[PolicyCreationAction] Successfully prepared transaction package for quoteId: ${args.quoteId}`);
        return transactionPackage;
    },
});

// Placeholder for prepareCapitalCommitmentTransaction (TP-105)
// const capitalCommitmentParams = v.object({ /* ... */ });
// export type CapitalCommitmentTransactionPackage = typeof capitalCommitmentParams.type;
// export const prepareCapitalCommitmentTransaction = mutation({ /* ... */ });

// Placeholder for blockchain parameter conversion helpers (TP-107)
// These might eventually move to a common utility file as per blockchain-integration-layer-refactoring-plan.md
// e.g., convex/blockchain/common/utils.ts
// const convertUsdToCents = (usdAmount: number): number => Math.round(usdAmount * 100);
// const convertBtcToSatoshis = (btcAmount: number): number => Math.round(btcAmount * 100000000);
// const convertStxToMicroStx = (stxAmount: number): number => Math.round(stxAmount * 1000000);
// const estimateExpirationHeight = (currentBurnHeight: number, daysOut: number): number => {
//   const AVG_BLOCKS_PER_DAY_STACKS = 144; // ~10 min per block
//   return currentBurnHeight + (daysOut * AVG_BLOCKS_PER_DAY_STACKS);
// }; 