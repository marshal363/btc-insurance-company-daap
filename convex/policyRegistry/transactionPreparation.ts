import { internalMutation, action } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { api, internal } from "../_generated/api"; // Import api and internal
import { stxToMicroStx, btcToSatoshis, usdToCents } from "../blockchain/common/utils"; // Import conversion utils
import { getLiquidityPoolContract } from "../blockchain/common/contracts"; // Import for counterparty address
// Assuming QB-101, QB-102, QB-103 (quote fetching & locking) are handled elsewhere.
// We will also need a way to get current burn-block-height for expirationHeight calculation.

// TP-103 (Refined): Define the parameters for the policy-registry.create-policy-entry smart contract call.
const policyCreationContractCallParams = v.object({
  owner: v.string(), // Stacks principal of the policyholder
  counterparty: v.string(), // Stacks principal of the counterparty (e.g., liquidity pool)
  protectedValue: v.number(), // strike price in cents
  protectionAmount: v.number(), // protection amount in satoshis
  expirationHeight: v.number(), // Target Stacks block height for expiration
  premium: v.number(), // premium in microSTX
  policyType: v.union(v.literal("PUT"), v.literal("CALL")), // "PUT" or "CALL" (string-ascii 4 in contract)
});

export type PolicyCreationContractCallParams = typeof policyCreationContractCallParams.type;

// Define the full transaction package returned to the frontend.
// This includes the contract call params and any other relevant info like quoteId.
const policyCreationTransactionPackage = v.object({
  newTransactionId: v.id("transactions"), // Added: ID of the created transaction record
  contractCallParameters: policyCreationContractCallParams, // Renamed from contractCallParams for clarity
  quoteId: v.id("quotes"), 
});

export type PolicyCreationTransactionPackage = typeof policyCreationTransactionPackage.type;

const AVG_STACKS_BLOCKS_PER_DAY = 144; // Stacks: ~144 blocks/day (1 block ~10 mins)

// Renamed to internal mutation, takes currentBurnBlockHeight as arg
export const internalPreparePolicyCreationTransaction = internalMutation({
  args: {
    quoteId: v.id("quotes"), 
    userStxAddress: v.string(), 
    currentBurnBlockHeight: v.number(),
    networkUsed: v.string(), // Added: To store the network info in the transaction record
  },
  // Explicitly typing the handler's return type
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

    const owner = userStxAddress;
    
    // Get counterparty address from centralized contract config
    const liquidityPoolContract = getLiquidityPoolContract(); // Uses current env by default
    const counterparty = liquidityPoolContract.address;

    if (!counterparty) {
      console.error("CRITICAL: Liquidity Pool (Counterparty) STX_ADDRESS could not be determined from contract configuration.");
      throw new Error("System configuration error: Counterparty address is not configured correctly.");
    }

    const calculatedStrikePriceUSD = (quote.marketDataSnapshot.btcPrice * quote.buyerParamsSnapshot.protectedValuePercentage) / 100;
    // Use imported conversion functions
    const protectedValue = usdToCents(calculatedStrikePriceUSD); 
    const protectionAmount = btcToSatoshis(quote.buyerParamsSnapshot.protectionAmount); 
    const premium = stxToMicroStx(quote.quoteResult.premium); 

    const expirationHeight = currentBurnBlockHeight + (quote.buyerParamsSnapshot.expirationDays * AVG_STACKS_BLOCKS_PER_DAY);
    const policyType = quote.buyerParamsSnapshot.policyType as "PUT" | "CALL";

    const contractCallParams: PolicyCreationContractCallParams = {
      owner,
      counterparty,
      protectedValue,
      protectionAmount,
      expirationHeight,
      premium,
      policyType,
    };

    // Assuming userStxAddress can be used as or mapped to a userId for the transactions table.
    // If your system uses a separate Convex userId (e.g., from ctx.auth), that should be used.
    const userIdForTransaction = userStxAddress; // Placeholder - VERIFY THIS LOGIC

    const newTransactionId = await ctx.runMutation(api.transactions.createTransaction, {
      quoteId: quoteId,
      type: "POLICY_CREATION", 
      // 'status' is not passed as createTransaction defaults it to PENDING.
      network: networkUsed, 
      parameters: JSON.stringify(contractCallParams), 
      userId: userIdForTransaction, 
    });

    if (!newTransactionId) {
        throw new Error("Failed to create a transaction record in the backend.");
    }

    const transactionPackage: PolicyCreationTransactionPackage = {
      newTransactionId: newTransactionId as Id<"transactions">, // Cast if createTransaction returns string
      contractCallParameters: contractCallParams, // Use the locally built contractCallParams
      quoteId: quoteId,
    };
    console.log("[TransactionPreparationInternal] Prepared transaction package with new Tx ID:", transactionPackage);

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