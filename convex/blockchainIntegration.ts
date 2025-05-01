import { query } from './_generated/server';
import { ClarityValue, cvToJSON, principalCV, contractPrincipalCV, callReadOnlyFunction } from '@stacks/transactions';
import { StacksMainnet, StacksTestnet, StacksMocknet } from '@stacks/network';

// TODO: Centralize network configuration and client instantiation
// Assuming Devnet/Mocknet for now. Replace with actual network config based on environment.
const network = new StacksMocknet(); // Or StacksTestnet(), StacksMainnet()
const stacksApiUrl = network.coreApiUrl;

// TODO: Get contract details from a shared config or environment variables
// Placeholder structure - replace with actual contract owner address and contract name
const ORACLE_CONTRACT_OWNER = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'; // Example from oracle.clar comments
const ORACLE_CONTRACT_NAME = 'oracle'; // Assuming the contract name is 'oracle'

/**
 * Reads the latest price data from the on-chain oracle contract.
 * This can be called directly from the frontend using the Convex client.
 *
 * @returns {Promise<{ price: string | null, timestamp: string | null, error?: string }>} // Return strings for Convex compatibility
 *          An object containing the price and timestamp as strings if successful,
 *          or null values and an error message if the read fails or returns no data.
 */
export const readLatestOraclePrice = query({
  handler: async (ctx): Promise<{ price: string | null, timestamp: string | null, error?: string }> => {
    console.log(`Reading latest price from ${ORACLE_CONTRACT_OWNER}.${ORACLE_CONTRACT_NAME}`);

    try {
      const options = {
        contractAddress: ORACLE_CONTRACT_OWNER,
        contractName: ORACLE_CONTRACT_NAME,
        functionName: 'get-latest-price',
        functionArgs: [], // No arguments for get-latest-price
        network: network,
        senderAddress: ORACLE_CONTRACT_OWNER, // Sender address doesn't matter for read-only calls, but required
      };

      const resultCV: ClarityValue = await callReadOnlyFunction(options);
      const resultJson = cvToJSON(resultCV);

      if (resultJson.type.startsWith('(ok')) {
        const priceStr = resultJson.value?.value?.price?.value;
        const timestampStr = resultJson.value?.value?.timestamp?.value;

        if (priceStr && timestampStr) {
          console.log(`Successfully read price: ${priceStr}, timestamp: ${timestampStr} from oracle.`);
          return {
            price: priceStr, // Return as string
            timestamp: timestampStr, // Return as string
          };
        } else {
           console.error('Error parsing successful response from get-latest-price:', JSON.stringify(resultJson, null, 2));
           return { price: null, timestamp: null, error: 'Error parsing successful response structure.' };
        }
      } else if (resultJson.type.startsWith('(err')) {
         const errorCode = resultJson.value?.value; // e.g., '104' for ERR-NO-PRICE-DATA
         console.warn(`Oracle contract returned error: ${errorCode}. Price data might not be available yet.`);
         if (errorCode === '104') {
            return { price: null, timestamp: null, error: 'ERR_NO_PRICE_DATA' };
         }
         if (errorCode === '102') {
             console.warn(`Oracle contract returned ERR_TIMESTAMP_TOO_OLD (u102). Data is stale.`);
             return { price: null, timestamp: null, error: 'ERR_TIMESTAMP_TOO_OLD' };
         }
         return { price: null, timestamp: null, error: `Oracle contract error code: ${errorCode}` };
      } else {
         console.error('Unexpected response structure from get-latest-price:', JSON.stringify(resultJson, null, 2));
         return { price: null, timestamp: null, error: 'Unexpected response structure.' };
      }

    } catch (error: any) {
      console.error('Error calling read-only function get-latest-price:', error);
      return {
        price: null,
        timestamp: null,
        error: error.message || 'Failed to read from oracle contract.',
      };
    }
  },
}); 