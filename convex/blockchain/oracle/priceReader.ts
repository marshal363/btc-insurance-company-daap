import {
  ClarityValue,
  cvToJSON,
  callReadOnlyFunction,
} from '@stacks/transactions';
import { OraclePriceData, OraclePriceReadResponse, OracleError, OracleErrorCode } from './types';
import { getOracleContract } from '../common/contracts';
import { getStacksNetwork } from '../common/network';

/**
 * Reads the latest price data from the on-chain oracle contract.
 *
 * @returns {Promise<OraclePriceReadResponse>} The oracle price data response
 */
export async function readLatestOraclePrice(): Promise<OraclePriceReadResponse> {
  const oracleContract = getOracleContract();
  const network = getStacksNetwork();
  
  console.log(`Reading latest price from ${oracleContract.address}.${oracleContract.name}`);

  try {
    const options = {
      contractAddress: oracleContract.address,
      contractName: oracleContract.name,
      functionName: 'get-latest-price',
      functionArgs: [], // No arguments for get-latest-price
      network,
      senderAddress: oracleContract.address, // Sender address doesn't matter for read-only calls, but required
    };

    const resultCV: ClarityValue = await callReadOnlyFunction(options);
    const resultJson = cvToJSON(resultCV);

    // Check for OK response, considering potential Clarity response wrapper
    if (resultJson.success === true && resultJson.type.includes('(tuple (price uint) (timestamp uint))')) {
      // Safely access nested values
      const priceValue = resultJson.value?.value?.price?.value;
      const timestampValue = resultJson.value?.value?.timestamp?.value;

      if (priceValue && timestampValue) {
        console.log(`Successfully read price: ${priceValue}, timestamp: ${timestampValue} from oracle.`);
        return {
          success: true,
          data: {
            price: priceValue,
            timestamp: timestampValue,
          },
        };
      } else {
        console.error('Error parsing successful response fields from get-latest-price:', JSON.stringify(resultJson, null, 2));
        return {
          success: false,
          error: 'Error parsing successful response fields.',
          data: { price: null, timestamp: null, error: 'Error parsing successful response fields.' },
        };
      }
    } else if (resultJson.success === false && resultJson.type.includes('uint')) {
      // Check for Clarity error response (uint code)
      const errorCode = resultJson.value?.value; // e.g., '104' for ERR-NO-PRICE-DATA

      console.warn(`Oracle contract returned error code: ${errorCode}. Price data might not be available yet.`);
      let errorMessage = `Oracle contract error code: ${errorCode}`;
      let errorType = OracleErrorCode.INVALID_RESPONSE;
      
      if (errorCode === '104') {
        errorMessage = 'No price data available yet.';
        errorType = OracleErrorCode.NO_PRICE_DATA;
      } else if (errorCode === '102') {
        console.warn(`Oracle contract returned ERR_TIMESTAMP_TOO_OLD (u102). Data is stale.`);
        errorMessage = 'Price data is stale.';
        errorType = OracleErrorCode.TIMESTAMP_TOO_OLD;
      }
      
      return {
        success: false,
        error: errorMessage,
        data: { price: null, timestamp: null, error: errorType },
      };
    } else {
      // This case handles genuinely unexpected structures
      console.error('Unexpected response structure from get-latest-price:', JSON.stringify(resultJson, null, 2));
      return {
        success: false,
        error: 'Unexpected response structure from oracle contract.',
        data: { price: null, timestamp: null, error: OracleErrorCode.INVALID_RESPONSE },
      };
    }
  } catch (error: any) {
    console.error('Error calling read-only function get-latest-price:', error);
    return {
      success: false,
      error: error.message || 'Failed to read from oracle contract.',
      data: {
        price: null,
        timestamp: null,
        error: OracleErrorCode.READ_FAILURE,
      },
    };
  }
}

/**
 * Converts the raw price value from satoshis to USD
 * 
 * @param {string} satoshisPrice - The price in satoshis as a string
 * @returns {number} The price in USD
 */
export function convertSatoshisToUsd(satoshisPrice: string): number {
  const priceInSatoshis = parseInt(satoshisPrice, 10);
  if (isNaN(priceInSatoshis)) {
    throw new OracleError(
      OracleErrorCode.INVALID_RESPONSE,
      `Invalid price format: ${satoshisPrice}`,
      { source: satoshisPrice }
    );
  }
  
  return priceInSatoshis / 100000000; // Convert satoshis to BTC
}

/**
 * Reads and formats the latest oracle price data with additional formatting
 * 
 * @returns {Promise<OraclePriceData>} The formatted oracle price data
 */
export async function getFormattedOraclePrice(): Promise<OraclePriceData> {
  const response = await readLatestOraclePrice();
  
  if (!response.success || !response.data || !response.data.price) {
    return {
      price: null,
      timestamp: null,
      error: response.error || 'Unknown error reading oracle price',
    };
  }
  
  try {
    const priceInSatoshis = parseInt(response.data.price, 10);
    const priceInUSD = convertSatoshisToUsd(response.data.price);
    
    return {
      price: response.data.price,
      timestamp: response.data.timestamp,
      priceInSatoshis,
      priceInUSD,
    };
  } catch (error: any) {
    console.error('Error formatting oracle price:', error);
    return {
      price: response.data.price,
      timestamp: response.data.timestamp,
      error: error.message || 'Error formatting price data',
    };
  }
} 