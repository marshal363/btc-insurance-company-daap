import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { getApi, getStacksUrl } from "@/lib/stacks-api";
import { ORACLE_CONTRACT } from "@/constants/contracts";
import { cvToJSON, hexToCV } from "@stacks/transactions";

// Define the OraclePrice interface based on contract's get-latest-price response
interface OraclePrice {
  price: bigint;   // BTC price in base units (satoshis)
  timestamp: number; // Timestamp of when the price was reported
  formattedPrice: number; // Converted to a human-readable format
  lastUpdatedTime: string; // Human readable format
}

/**
 * Hook to fetch the latest oracle price data from the blockchain.
 * Note: In a full implementation, this would call a Convex backend function
 * that reads from the blockchain, but for now we're calling the Stacks API directly.
 */
export const useLatestOraclePrice = (): UseQueryResult<OraclePrice, Error> => {
  const api = getApi(getStacksUrl()).smartContractsApi;

  return useQuery<OraclePrice, Error>({
    queryKey: ["latestOraclePrice"],
    queryFn: async () => {
      const response = await api.callReadOnlyFunction({
        contractAddress: ORACLE_CONTRACT.address || "",
        contractName: ORACLE_CONTRACT.name,
        functionName: "get-latest-price",
        readOnlyFunctionArgs: {
          sender: ORACLE_CONTRACT.address || "",
          arguments: [],
        },
      });

      if (response?.okay && response?.result) {
        const result = cvToJSON(hexToCV(response?.result || ""));
        
        // Check if the result is successful (ok) and contains price data
        if (result?.success) {
          // Extract price and timestamp from the tuple result
          const price = BigInt(result?.value?.value?.price?.value);
          const timestamp = parseInt(result?.value?.value?.timestamp?.value, 10);

          // Format the BTC price (convert from satoshis to BTC - division by 10^8)
          const formattedPrice = Number(price) / 100000000;
          
          // Format the timestamp to a readable date/time - CHANGED
          // const lastUpdatedDate = new Date(timestamp * 1000); // OLD: Assumed Unix time
          // const now = new Date();
          
          // Format relative time (e.g., "2 minutes ago") - CHANGED
          // Simply display the block height now
          const lastUpdatedTime = `Block #${timestamp}`;
          /* OLD Time calculation logic
          let lastUpdatedTime = "";
          const diffMs = now.getTime() - lastUpdatedDate.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          
          if (diffMins < 1) {
            lastUpdatedTime = "Just now";
          } else if (diffMins < 60) {
            lastUpdatedTime = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
          } else {
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) {
              lastUpdatedTime = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            } else {
              const diffDays = Math.floor(diffHours / 24);
              lastUpdatedTime = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            }
          }
          */

          return {
            price,
            timestamp, // Still returning the block height number
            formattedPrice,
            lastUpdatedTime // Now contains "Block #X"
          };
        } else {
          // If result is an error (contract returns (err ...) instead of (ok ...))
          const errorCode = result?.value?.value;
          if (errorCode === 104) {
            throw new Error("No price data available yet");
          } else if (errorCode === 102) {
            throw new Error("Price data is too old");
          } else {
            throw new Error(`Oracle contract returned error: ${errorCode}`);
          }
        }
      } else {
        throw new Error(
          response?.cause || "Error fetching latest price from oracle"
        );
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: false,
  });
};

/**
 * Hook to check if the provided wallet address is the authorized submitter for the oracle.
 */
export const useIsAuthorizedSubmitter = (
  address?: string | null
): UseQueryResult<boolean, Error> => {
  const api = getApi(getStacksUrl()).smartContractsApi;

  return useQuery<boolean, Error>({
    queryKey: ["isAuthorizedSubmitter", address],
    queryFn: async () => {
      if (!address) return false;

      const response = await api.callReadOnlyFunction({
        contractAddress: ORACLE_CONTRACT.address || "",
        contractName: ORACLE_CONTRACT.name,
        functionName: "get-authorized-submitter",
        readOnlyFunctionArgs: {
          sender: ORACLE_CONTRACT.address || "",
          arguments: [],
        },
      });

      if (response?.okay && response?.result) {
        const result = cvToJSON(hexToCV(response?.result || ""));
        
        if (result?.success) {
          const authorizedSubmitter = result?.value?.value;
          return address === authorizedSubmitter;
        } else {
          // If the read-only call succeeds but parsing the CV fails or returns an error CV
          console.warn("Failed to parse authorized submitter response:", result);
          return false; // Treat as not authorized if response isn't as expected
        }
      } else {
        // If the API call itself fails
        throw new Error(
          response?.cause || "Error checking authorized submitter"
        );
      }
    },
    refetchInterval: 60000, // Refetch every minute
    retry: false,
    enabled: !!address, // Only run query if address is provided
  });
};

// ADD Convex Imports for new hooks
import { useQuery as useConvexQuery } from "convex/react";
import { api } from "../../../convex/_generated/api"; // Adjust path

// Define type for the 24h range data
interface RangeData {
  high: number;
  low: number;
  range: number;
}

/**
 * Hook to fetch the calculated 24h range data from the Convex backend.
 */
export const useCalculate24hRange = (): RangeData | null | undefined => {
  // Returns the data directly, or null if no data, or undefined if loading
  return useConvexQuery(api.services.oracle.priceService.calculate24hRange);
}; 