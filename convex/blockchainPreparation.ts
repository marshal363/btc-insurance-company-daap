import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { 
  BlockchainParams, 
  BuyerBlockchainParams, 
  ProviderBlockchainParams,
  PreparedTransaction
} from './types';

/**
 * Prepare a quote for blockchain integration
 * This transforms the quote data into a format ready for on-chain interaction
 */
export const prepareQuoteForBlockchain = internalQuery({
  args: {
    quoteId: v.id("quotes"),
  },
  handler: async (ctx, args): Promise<BlockchainParams> => {
    const quote = await ctx.db.get(args.quoteId);
    if (!quote) throw new Error("Quote not found");

    // Check quote status
    if (quote.status !== "active" || new Date(quote.expiresAt) < new Date()) {
      throw new Error("Quote is not active or has expired.");
    }

    // Use snapshots stored in the quote
    const marketData = quote.marketDataSnapshot;
    const riskParams = quote.riskParamsSnapshot;

    // Mock blockchain integration - in reality, would get from blockchain
    const BLOCKS_PER_DAY = 144; // Approximately 144 blocks per day (10-minute block time)
    const currentBlockHeight = 800000; // Mock current block height
    let blockchainParamsDTO: BlockchainParams;

    if (quote.quoteType === "buyer" && quote.buyerParamsSnapshot) {
      const params = quote.buyerParamsSnapshot;
      const result = quote.quoteResult;
      const expirationBlocks = Math.floor(
        params.expirationDays * BLOCKS_PER_DAY
      );

      // Convert USD premium to STX microSTX 
      // This is a simplified mock conversion - real implementation would use an oracle
      const premiumMicroStx = BigInt(
        Math.floor(((result.premium || 0) / 0.45) * 1000000)
      );
      const protectedValueMicroStx = BigInt(
        Math.floor(
          ((marketData.btcPrice * params.protectedValuePercentage) /
            100 /
            0.45) *
            1000000
        )
      );

      blockchainParamsDTO = {
        policyType: params.policyType,
        protectedValueMicroStx,
        protectedAmountSats: BigInt(
          Math.floor(params.protectionAmount * 100000000)
        ),
        expirationBlocks: BigInt(expirationBlocks),
        premiumMicroStx,
        currentBlockHeight: BigInt(currentBlockHeight),
        expirationHeight: BigInt(currentBlockHeight + expirationBlocks),
      } as BuyerBlockchainParams;
    } else if (quote.quoteType === "provider" && quote.providerParamsSnapshot) {
      const params = quote.providerParamsSnapshot;
      const durationBlocks = Math.floor(params.selectedPeriod * BLOCKS_PER_DAY);

      // Convert USD commitment to STX microSTX
      // This is a simplified mock conversion - real implementation would use an oracle
      const commitmentMicroStx = BigInt(
        Math.floor((params.commitmentAmountUSD / 0.45) * 1000000)
      );

      blockchainParamsDTO = {
        tierName: params.selectedTier,
        commitmentAmountMicroStx: commitmentMicroStx,
        durationBlocks: BigInt(durationBlocks),
        currentBlockHeight: BigInt(currentBlockHeight),
        expirationHeight: BigInt(currentBlockHeight + durationBlocks),
      } as ProviderBlockchainParams;
    } else {
      throw new Error("Invalid quote type or missing parameter snapshot");
    }

    return blockchainParamsDTO; // Return the prepared DTO
  },
});

/**
 * Public facing query for UI to get blockchain-ready parameters
 */
export const getBlockchainParams = query({
  args: {
    quoteId: v.id("quotes"),
  },
  handler: async (ctx, args): Promise<Record<string, string | number>> => {
    // This will throw if the quote is not found or is invalid
    const blockchainParams: BlockchainParams = await ctx.runQuery(
      internal.blockchainPreparation.prepareQuoteForBlockchain,
      { quoteId: args.quoteId }
    );
    
    // Convert BigInts to strings for JSON serialization
    return JSON.parse(
      JSON.stringify(blockchainParams, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );
  },
});

/**
 * Mock blockchain transaction preparation
 * In a real implementation, this would interact with a wallet or blockchain library
 */
export const prepareMockTransaction = query({
  args: {
    quoteId: v.id("quotes"),
  },
  handler: async (ctx, args): Promise<PreparedTransaction> => {
    // Get the blockchain parameters
    const blockchainParams: BlockchainParams = await ctx.runQuery(
      internal.blockchainPreparation.prepareQuoteForBlockchain,
      { quoteId: args.quoteId }
    );
    
    // Fetch the quote to determine the type
    const quote = await ctx.db.get(args.quoteId);
    if (!quote) throw new Error("Quote not found");
    
    // Generate a mock transaction based on the quote type
    let mockTransaction;
    if (quote.quoteType === "buyer") {
      const buyerParams = blockchainParams as BuyerBlockchainParams;
      // Generate buyer policy transaction
      mockTransaction = {
        contractAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
        contractName: "insurance-policy",
        functionName: "create-policy",
        functionArgs: [
          // Simplified arguments
          buyerParams.protectedValueMicroStx.toString(),
          buyerParams.protectedAmountSats.toString(),
          buyerParams.expirationHeight.toString(),
          buyerParams.premiumMicroStx.toString(),
        ],
        postConditions: [
          // Simplified post conditions
          {
            type: "STX",
            amount: buyerParams.premiumMicroStx.toString(),
            condition: "sending exact amount"
          }
        ],
        nonce: 1,
        fee: "10000" // 0.01 STX fee
      };
    } else {
      const providerParams = blockchainParams as ProviderBlockchainParams;
      // Generate provider liquidity transaction
      mockTransaction = {
        contractAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
        contractName: "liquidity-pool",
        functionName: "commit-liquidity",
        functionArgs: [
          // Simplified arguments
          providerParams.tierName,
          providerParams.commitmentAmountMicroStx.toString(),
          providerParams.durationBlocks.toString(),
        ],
        postConditions: [
          // Simplified post conditions
          {
            type: "STX",
            amount: providerParams.commitmentAmountMicroStx.toString(),
            condition: "sending exact amount"
          }
        ],
        nonce: 1,
        fee: "10000" // 0.01 STX fee
      };
    }
    
    return {
      transaction: mockTransaction,
      blockchainParams: JSON.parse(
        JSON.stringify(blockchainParams, (key, value) =>
          typeof value === "bigint" ? value.toString() : value
        )
      ),
      quoteType: quote.quoteType
    };
  },
}); 