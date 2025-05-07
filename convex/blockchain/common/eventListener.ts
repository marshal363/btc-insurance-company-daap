/**
 * Event Listener Module
 *
 * This module handles all blockchain event listening functionality,
 * providing utilities for subscribing to contract events and processing them.
 */

import { NetworkEnvironment } from './types';
import { getStacksNetwork } from './network';

/**
 * Event subscription options
 */
export interface EventSubscriptionOptions {
  contractAddress: string;
  contractName: string;
  eventName?: string; // If not provided, listen to all events from the contract
  startBlock?: number;
  networkEnv: NetworkEnvironment;
  includeUnanchored?: boolean;
  limit?: number; // Number of events to fetch per page
  onEvent: (event: any) => Promise<void> | void;
  onError?: (error: Error) => void;
}

/**
 * Subscription handle returned from subscribeToEvents
 */
export interface EventSubscription {
  id: string;
  stop: () => void;
  isActive: boolean;
}

// Map to keep track of active subscriptions
const activeSubscriptions = new Map<string, {
  options: EventSubscriptionOptions;
  interval: NodeJS.Timeout;
  lastBlock: number;
  isActive: boolean;
}>();

/**
 * Subscribe to blockchain events from a contract
 * @param options Event subscription options
 * @returns Subscription handle with methods to manage the subscription
 */
export function subscribeToEvents(options: EventSubscriptionOptions): EventSubscription {
  // Generate a unique ID for this subscription
  const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  // Get API URL for the specified network
  const network = getStacksNetwork(options.networkEnv);
  const apiUrl = network.coreApiUrl;
  
  // Initialize with the starting block
  let lastProcessedBlock = options.startBlock || 0;
  
  console.log(`Creating event subscription ${subscriptionId} for ${options.contractAddress}.${options.contractName} events starting from block ${lastProcessedBlock}`);
  
  // Set up polling interval (e.g., every 30 seconds)
  // In a production system, this would be replaced with WebSocket connectivity if available
  const pollingInterval = setInterval(async () => {
    if (!activeSubscriptions.get(subscriptionId)?.isActive) {
      return; // Skip if subscription is no longer active
    }
    
    try {
      // Build the API URL for fetching events
      let url = `${apiUrl}/extended/v1/address/${options.contractAddress}.${options.contractName}/events`;
      url += `?limit=${options.limit || 50}`;
      url += `&offset=${lastProcessedBlock}`;
      
      if (options.eventName) {
        url += `&event_name=${options.eventName}`;
      }
      
      if (options.includeUnanchored) {
        url += '&unanchored=true';
      }
      
      // Fetch events from the API
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch events: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      const events = data.results || [];
      
      // Process each event
      for (const event of events) {
        // Call the event handler
        try {
          await options.onEvent(event);
        } catch (error: any) {
          console.error(`Error processing event in subscription ${subscriptionId}:`, error);
          if (options.onError) {
            options.onError(error);
          }
        }
        
        // Update the last processed block
        if (event.block_height > lastProcessedBlock) {
          lastProcessedBlock = event.block_height;
        }
      }
      
      // Update the subscription's last block
      const subscription = activeSubscriptions.get(subscriptionId);
      if (subscription) {
        subscription.lastBlock = lastProcessedBlock;
      }
      
    } catch (error: any) {
      console.error(`Error fetching events for subscription ${subscriptionId}:`, error);
      if (options.onError) {
        options.onError(error);
      }
    }
  }, 30000); // 30 seconds
  
  // Store the subscription
  activeSubscriptions.set(subscriptionId, {
    options,
    interval: pollingInterval,
    lastBlock: lastProcessedBlock,
    isActive: true,
  });
  
  // Return the subscription handle
  return {
    id: subscriptionId,
    stop: () => {
      const subscription = activeSubscriptions.get(subscriptionId);
      if (subscription) {
        clearInterval(subscription.interval);
        subscription.isActive = false;
        console.log(`Stopped event subscription ${subscriptionId}`);
      }
    },
    isActive: true,
  };
}

/**
 * Fetch historical events from a contract (one-time fetch, not a subscription)
 * @param options Event fetch options
 * @returns Promise resolving to an array of events
 */
export async function fetchEvents(options: Omit<EventSubscriptionOptions, 'onEvent' | 'onError'>): Promise<any[]> {
  // Get API URL for the specified network
  const network = getStacksNetwork(options.networkEnv);
  const apiUrl = network.coreApiUrl;
  
  try {
    // Build the API URL for fetching events
    let url = `${apiUrl}/extended/v1/address/${options.contractAddress}.${options.contractName}/events`;
    url += `?limit=${options.limit || 50}`;
    
    if (options.startBlock) {
      url += `&offset=${options.startBlock}`;
    }
    
    if (options.eventName) {
      url += `&event_name=${options.eventName}`;
    }
    
    if (options.includeUnanchored) {
      url += '&unanchored=true';
    }
    
    // Fetch events from the API
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch events: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    return data.results || [];
  } catch (error: any) {
    console.error('Error fetching events:', error);
    throw error;
  }
}

/**
 * Get details of all active event subscriptions
 * @returns Array of active subscription details
 */
export function getActiveSubscriptions(): { id: string; contract: string; eventName?: string; lastBlock: number }[] {
  return Array.from(activeSubscriptions.entries())
    .filter(([_, sub]) => sub.isActive)
    .map(([id, sub]) => ({
      id,
      contract: `${sub.options.contractAddress}.${sub.options.contractName}`,
      eventName: sub.options.eventName,
      lastBlock: sub.lastBlock,
    }));
}

/**
 * Stop all active event subscriptions
 */
export function stopAllSubscriptions(): void {
  for (const [id, subscription] of activeSubscriptions.entries()) {
    if (subscription.isActive) {
      clearInterval(subscription.interval);
      subscription.isActive = false;
      console.log(`Stopped event subscription ${id}`);
    }
  }
} 