import { action } from "./_generated/server";
// api import is not strictly needed here if we don't call other api functions
// import { api } from "./_generated/api"; 
import { getCurrentNetworkConfig } from "./blockchain/common/network"; // Corrected import path

// Define an interface for the expected Stacks node API response structure (partial)
interface StacksNodeInfoResponse {
  stacks_tip_height: number;
  stacks_tip: string;
  stacks_chain_height: number;
  // ... other fields
  burn_block_height: number;
  // ... other fields
}

/**
 * Fetches the current burn_block_height from the configured Stacks node API.
 */
export const getCurrentBurnBlockHeight = action({
  args: {},
  handler: async (ctx) => {
    let apiUrl: string;
    try {
      // Use the existing centralized network configuration to get the API URL
      const networkConfig = getCurrentNetworkConfig();
      apiUrl = networkConfig.apiUrl;
    } catch (error: any) {
      console.error("CRITICAL: Failed to get Stacks network configuration for API URL.", error.message);
      throw new Error("System configuration error: Stacks Node API URL cannot be determined.");
    }

    if (!apiUrl) {
        console.error("CRITICAL: Stacks Node API URL is not configured or could not be determined.");
        throw new Error("System configuration error: Stacks Node API URL is not set.");
    }

    const infoUrl = `${apiUrl}/v2/info`;
    console.log(`[stacksNodeAction] Fetching burn_block_height from: ${infoUrl}`);

    try {
      const response = await fetch(infoUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Failed to fetch Stacks node info from ${infoUrl}: ${response.status} ${response.statusText}`, errorBody);
        throw new Error(`Failed to fetch Stacks node info: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as StacksNodeInfoResponse;
      
      if (typeof data.burn_block_height !== 'number') {
        console.error("Invalid response structure from Stacks node API: burn_block_height missing or not a number", data);
        throw new Error("Invalid response from Stacks node API: burn_block_height not found.");
      }

      console.log(`[stacksNodeAction] Successfully fetched current burn_block_height: ${data.burn_block_height}`);
      return data.burn_block_height;

    } catch (error: any) {
      console.error(`Error fetching current burn block height from ${infoUrl}:`, error.message);
      throw new Error(`Error fetching current burn block height: ${error.message}`);
    }
  },
}); 