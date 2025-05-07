import { v } from "convex/values";
import { internalQuery, query, action, internalAction } from "./_generated/server";
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

/**
 * Prepare a STX transfer to the liquidity pool contract
 */
export const prepareStxTransferToLiquidityPool = internalAction({
  args: {
    amount: v.number(),
    sender: v.string(),
  },
  handler: async (ctx, args) => {
    // In a real implementation, this would:
    // 1. Calculate the right contract address based on the environment
    // 2. Format transaction data in the right format for the blockchain
    // 3. Generate any necessary signatures or authentication
    
    // For now, we'll return a placeholder transaction object
    return {
      txOptions: {
        contractAddress: 'ST3QFXBFMB0FBJR71KISEXBWZM5NYTYKPRD74EJM', // Example contract address
        contractName: 'liquidity-pool',
        functionName: 'deposit',
        functionArgs: [
          { type: 'uint', value: args.amount.toString() },
          { type: 'principal', value: args.sender },
        ],
        fee: 1000, // Example fee
        nonce: 0,   // This would be determined dynamically in production
      },
      amount: args.amount,
      sender: args.sender,
      type: 'STX',
    };
  },
});

/**
 * Prepare a sBTC transfer to the liquidity pool contract
 */
export const prepareSbtcTransferToLiquidityPool = internalAction({
  args: {
    amount: v.number(),
    sender: v.string(),
  },
  handler: async (ctx, args) => {
    // In a real implementation, this would:
    // 1. Calculate the right contract addresses based on the environment
    // 2. Format transaction data in the right format for the blockchain
    // 3. Generate any necessary signatures or authentication
    
    // For now, we'll return a placeholder transaction object
    return {
      txOptions: {
        contractAddress: 'ST3QFXBFMB0FBJR71KISEXBWZM5NYTYKPRD74EJM', // Example contract address
        contractName: 'liquidity-pool',
        functionName: 'deposit-sbtc',
        functionArgs: [
          { type: 'uint', value: args.amount.toString() },
          { type: 'principal', value: args.sender },
        ],
        fee: 1000, // Example fee
        nonce: 0,   // This would be determined dynamically in production
      },
      amount: args.amount,
      sender: args.sender,
      type: 'sBTC',
    };
  },
});

/**
 * Prepare a STX withdrawal from the liquidity pool contract
 */
export const prepareStxWithdrawalFromLiquidityPool = internalAction({
  args: {
    amount: v.number(),
    recipient: v.string(),
  },
  handler: async (ctx, args) => {
    // In a real implementation, this would prepare the transaction for the blockchain
    return {
      txOptions: {
        contractAddress: 'ST3QFXBFMB0FBJR71KISEXBWZM5NYTYKPRD74EJM', // Example contract address
        contractName: 'liquidity-pool',
        functionName: 'withdraw',
        functionArgs: [
          { type: 'uint', value: args.amount.toString() },
          { type: 'principal', value: args.recipient },
        ],
        fee: 1000, // Example fee
        nonce: 0,   // This would be determined dynamically in production
      },
      amount: args.amount,
      recipient: args.recipient,
      type: 'STX',
    };
  },
});

/**
 * Prepare a sBTC withdrawal from the liquidity pool contract
 */
export const prepareSbtcWithdrawalFromLiquidityPool = internalAction({
  args: {
    amount: v.number(),
    recipient: v.string(),
  },
  handler: async (ctx, args) => {
    // In a real implementation, this would prepare the transaction for the blockchain
    return {
      txOptions: {
        contractAddress: 'ST3QFXBFMB0FBJR71KISEXBWZM5NYTYKPRD74EJM', // Example contract address
        contractName: 'liquidity-pool',
        functionName: 'withdraw-sbtc',
        functionArgs: [
          { type: 'uint', value: args.amount.toString() },
          { type: 'principal', value: args.recipient },
        ],
        fee: 1000, // Example fee
        nonce: 0,   // This would be determined dynamically in production
      },
      amount: args.amount,
      recipient: args.recipient,
      type: 'sBTC',
    };
  },
});

/**
 * Prepare a STX premium withdrawal from the liquidity pool contract
 */
export const prepareStxPremiumWithdrawalFromLiquidityPool = internalAction({
  args: {
    amount: v.number(),
    recipient: v.string(),
  },
  handler: async (ctx, args) => {
    // In a real implementation, this would prepare the transaction for the blockchain
    return {
      txOptions: {
        contractAddress: 'ST3QFXBFMB0FBJR71KISEXBWZM5NYTYKPRD74EJM', // Example contract address
        contractName: 'liquidity-pool',
        functionName: 'withdraw-premium',
        functionArgs: [
          { type: 'uint', value: args.amount.toString() },
          { type: 'principal', value: args.recipient },
        ],
        fee: 1000, // Example fee
        nonce: 0,   // This would be determined dynamically in production
      },
      amount: args.amount,
      recipient: args.recipient,
      type: 'STX',
    };
  },
});

/**
 * Prepare a sBTC premium withdrawal from the liquidity pool contract
 */
export const prepareSbtcPremiumWithdrawalFromLiquidityPool = internalAction({
  args: {
    amount: v.number(),
    recipient: v.string(),
  },
  handler: async (ctx, args) => {
    // In a real implementation, this would prepare the transaction for the blockchain
    return {
      txOptions: {
        contractAddress: 'ST3QFXBFMB0FBJR71KISEXBWZM5NYTYKPRD74EJM', // Example contract address
        contractName: 'liquidity-pool',
        functionName: 'withdraw-sbtc-premium',
        functionArgs: [
          { type: 'uint', value: args.amount.toString() },
          { type: 'principal', value: args.recipient },
        ],
        fee: 1000, // Example fee
        nonce: 0,   // This would be determined dynamically in production
      },
      amount: args.amount,
      recipient: args.recipient,
      type: 'sBTC',
    };
  },
});

console.log("convex/blockchainPreparation.ts loaded: Defines blockchain transaction preparation functions."); 