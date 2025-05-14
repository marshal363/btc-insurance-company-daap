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
    const poolMetrics: Doc<"pool_metrics"> | null = await ctx.runQuery(api.liquidityPool.poolState.getPoolMetrics, { token: collateralTokenString });

    if (!poolMetrics) {
        console.warn(`[TransactionPreparationInternal] Pool metrics not found for token: ${collateralTokenString}. Assuming insufficient collateral.`);
        throw new Error(`Insufficient Liquidity Pool collateral (metrics unavailable for ${collateralTokenString}).`);
    }

    const requiredCollateralSatoshis = btcToSatoshis(amountBTC); // Assuming protectionAmount is in BTC
    // Ensure poolMetrics.available_liquidity is defined and is a number
    if (typeof poolMetrics.available_liquidity !== 'number') {
        console.error(`[TransactionPreparationInternal] available_liquidity for ${collateralTokenString} is not a number or is undefined. Metrics:`, poolMetrics);
        throw new Error(`Invalid Liquidity Pool metrics for ${collateralTokenString}. Cannot verify collateral.`);
    }
    
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
    // TODO: Determine positionType, collateralToken, settlementToken based on conventions or quote data
    // For now, using placeholders or typical values for a BTC PUT option buyer.
    const positionTypeString = "LONG_PUT"; // Example for buyer
    const settlementTokenString = "STX";  // Example, premium paid in STX, settlement could be STX or sBTC based on policy.

    // Get Contract Details
    const policyRegistryContract = getContractByName("policy-registry");
    const contractAddress = policyRegistryContract.address;
    const contractName = policyRegistryContract.name;
    const functionName = "create-policy-entry"; // From policyRegistry/writer.ts

    // Construct SERIALIZABLE functionArgs
    const serializableFunctionArgs: SerializableFunctionArg[] = [
      { cvFunction: "standardPrincipalCV", rawValue: ownerAddress },
      { cvFunction: "standardPrincipalCV", rawValue: counterpartyAddress },
      { cvFunction: "uintCV", rawValue: usdToCents(strikePriceUSD) },
      { cvFunction: "uintCV", rawValue: btcToSatoshis(amountBTC) },
      { cvFunction: "uintCV", rawValue: currentBurnBlockHeight + (expirationDays * AVG_STACKS_BLOCKS_PER_DAY) },
      { cvFunction: "uintCV", rawValue: stxToMicroStx(premiumSTX) },
      { cvFunction: "stringAsciiCV", rawValue: policyTypeString },
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
      counterparty: counterpartyAddress,
      protectedValue: usdToCents(strikePriceUSD), 
      protectionAmount: btcToSatoshis(amountBTC), 
      expirationHeight: currentBurnBlockHeight + (expirationDays * AVG_STACKS_BLOCKS_PER_DAY),
      premium: stxToMicroStx(premiumSTX), // Storing in microSTX for consistency
      policyType: policyTypeString,
      // Add other semantic fields if needed for backend records
      positionType: positionTypeString,
      collateralToken: collateralTokenString,
      settlementToken: settlementTokenString,
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