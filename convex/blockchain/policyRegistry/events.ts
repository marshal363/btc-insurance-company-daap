/**
 * Policy Registry Blockchain Integration: Event Handling
 * 
 * This file contains functions for subscribing to and processing policy-related blockchain events.
 */

import { getContractByName } from "../common/contracts";
import { 
  fetchEvents, 
  subscribeToEvents, 
  EventSubscription,
  EventSubscriptionOptions 
} from "../common/eventListener";
import { PolicyEventType, PolicyStatus } from "./types";
import { NetworkEnvironment } from "../common/types";
import { mapNumberToStatus, mapStatusToEventType } from "./utils";

// Default network environment to use if not specified
const DEFAULT_NETWORK_ENV = NetworkEnvironment.DEVNET;

// Event name constants
const POLICY_CREATED_EVENT = "policy-created";
const POLICY_STATUS_UPDATED_EVENT = "policy-status-updated";
const PREMIUM_DISTRIBUTED_EVENT = "premium-distributed";

// Define types for event data
interface EventOptions {
  fromBlock?: number;
  untilBlock?: number;
  networkEnv?: NetworkEnvironment;
}

interface PolicyCreatedEvent {
  policyId: string;
  owner: string;
  counterparty: string;
  policyType: string;
  positionType: string;
  blockHeight: number;
  premium: number;
  strikePrice: number;
  protectionAmount: number;
  expirationHeight: number;
  collateralToken: string;
  settlementToken: string;
  txid?: string;
  timestamp?: Date;
}

interface PolicyStatusUpdatedEvent {
  policyId: string;
  previousStatus: string;
  newStatus: string;
  blockHeight: number;
  txid?: string;
  timestamp?: Date;
  settlement?: any;
}

interface PremiumDistributionEvent {
  policyId: string;
  amount: number;
  recipient: string;
  token: string;
  blockHeight: number;
  txid?: string;
  timestamp?: Date;
}

/**
 * Subscribe to policy created events
 * 
 * @param callback - Function to call when an event is received
 * @param options - Additional subscription options
 * @returns Subscription ID to use for unsubscribing
 */
export function subscribeToPolicyCreatedEvents(
  callback: (event: PolicyCreatedEvent) => void,
  options: { 
    fromBlock?: number; 
    untilBlock?: number;
    networkEnv?: NetworkEnvironment;
  } = {}
): EventSubscription {
  const policyContract = getContractByName("policy-registry");
  
  const subscriptionOptions: EventSubscriptionOptions = {
    contractAddress: policyContract.address,
    contractName: policyContract.name,
    eventName: POLICY_CREATED_EVENT,
    networkEnv: options.networkEnv || DEFAULT_NETWORK_ENV,
    startBlock: options.fromBlock,
    onEvent: (event) => {
      // Process the event data before passing to callback
      const processedEvent = processPolicyCreatedEvent(event);
      callback(processedEvent);
    }
  };
  
  return subscribeToEvents(subscriptionOptions);
}

/**
 * Subscribe to policy status update events
 * 
 * @param callback - Function to call when an event is received
 * @param options - Additional subscription options
 * @returns Subscription ID to use for unsubscribing
 */
export function subscribeToPolicyStatusUpdatedEvents(
  callback: (event: PolicyStatusUpdatedEvent) => void,
  options: { 
    fromBlock?: number; 
    untilBlock?: number; 
    policyId?: string;
    networkEnv?: NetworkEnvironment;
  } = {}
): EventSubscription {
  const policyContract = getContractByName("policy-registry");
  
  const subscriptionOptions: EventSubscriptionOptions = {
    contractAddress: policyContract.address,
    contractName: policyContract.name,
    eventName: POLICY_STATUS_UPDATED_EVENT,
    networkEnv: options.networkEnv || DEFAULT_NETWORK_ENV,
    startBlock: options.fromBlock,
    onEvent: (event) => {
      // Process the event data before passing to callback
      const processedEvent = processPolicyStatusUpdatedEvent(event);
      
      // Filter by policy ID if specified
      if (options.policyId && processedEvent.policyId !== options.policyId) {
        return; // Skip this event
      }
      
      callback(processedEvent);
    }
  };
  
  return subscribeToEvents(subscriptionOptions);
}

/**
 * Subscribe to premium distribution events
 * 
 * @param callback - Function to call when an event is received
 * @param options - Additional subscription options
 * @returns Subscription ID to use for unsubscribing
 */
export function subscribeToPremiumDistributionEvents(
  callback: (event: PremiumDistributionEvent) => void,
  options: { 
    fromBlock?: number; 
    untilBlock?: number; 
    policyId?: string;
    networkEnv?: NetworkEnvironment;
  } = {}
): EventSubscription {
  const policyContract = getContractByName("policy-registry");
  
  const subscriptionOptions: EventSubscriptionOptions = {
    contractAddress: policyContract.address,
    contractName: policyContract.name,
    eventName: PREMIUM_DISTRIBUTED_EVENT,
    networkEnv: options.networkEnv || DEFAULT_NETWORK_ENV,
    startBlock: options.fromBlock,
    onEvent: (event) => {
      // Process the event data before passing to callback
      const processedEvent = processPremiumDistributionEvent(event);
      
      // Filter by policy ID if specified
      if (options.policyId && processedEvent.policyId !== options.policyId) {
        return; // Skip this event
      }
      
      callback(processedEvent);
    }
  };
  
  return subscribeToEvents(subscriptionOptions);
}

/**
 * Fetch policy created events (one-time, not subscription)
 * 
 * @param options - Query options
 * @returns Array of processed event objects
 */
export async function fetchPolicyCreatedEvents(
  options: { 
    fromBlock?: number; 
    untilBlock?: number;
    networkEnv?: NetworkEnvironment;
  } = {}
): Promise<PolicyCreatedEvent[]> {
  const policyContract = getContractByName("policy-registry");
  
  const events = await fetchEvents({
    contractAddress: policyContract.address,
    contractName: policyContract.name,
    eventName: POLICY_CREATED_EVENT,
    networkEnv: options.networkEnv || DEFAULT_NETWORK_ENV,
    startBlock: options.fromBlock,
  });
  
  return events.map(processPolicyCreatedEvent);
}

/**
 * Fetch policy status updated events (one-time, not subscription)
 * 
 * @param options - Query options
 * @returns Array of processed event objects
 */
export async function fetchPolicyStatusUpdatedEvents(
  options: { 
    fromBlock?: number; 
    untilBlock?: number; 
    policyId?: string;
    networkEnv?: NetworkEnvironment;
  } = {}
): Promise<PolicyStatusUpdatedEvent[]> {
  const policyContract = getContractByName("policy-registry");
  
  const events = await fetchEvents({
    contractAddress: policyContract.address,
    contractName: policyContract.name,
    eventName: POLICY_STATUS_UPDATED_EVENT,
    networkEnv: options.networkEnv || DEFAULT_NETWORK_ENV,
    startBlock: options.fromBlock,
  });
  
  const processedEvents = events.map(processPolicyStatusUpdatedEvent);
  
  // Filter by policy ID if specified
  if (options.policyId) {
    return processedEvents.filter(event => event.policyId === options.policyId);
  }
  
  return processedEvents;
}

/**
 * Fetch premium distribution events (one-time, not subscription)
 * 
 * @param options - Query options
 * @returns Array of processed event objects
 */
export async function fetchPremiumDistributionEvents(
  options: { 
    fromBlock?: number; 
    untilBlock?: number; 
    policyId?: string;
    networkEnv?: NetworkEnvironment;
  } = {}
): Promise<PremiumDistributionEvent[]> {
  const policyContract = getContractByName("policy-registry");
  
  const events = await fetchEvents({
    contractAddress: policyContract.address,
    contractName: policyContract.name,
    eventName: PREMIUM_DISTRIBUTED_EVENT,
    networkEnv: options.networkEnv || DEFAULT_NETWORK_ENV,
    startBlock: options.fromBlock,
  });
  
  const processedEvents = events.map(processPremiumDistributionEvent);
  
  // Filter by policy ID if specified
  if (options.policyId) {
    return processedEvents.filter(event => event.policyId === options.policyId);
  }
  
  return processedEvents;
}

/**
 * Process a policy created event
 * 
 * @param event - Raw blockchain event data
 * @returns Processed event object with typed data
 */
function processPolicyCreatedEvent(event: any): PolicyCreatedEvent {
  // Extract data from event
  const { value } = event;
  
  // Parse out the policy data from the event value
  return {
    policyId: value.policy_id.value.toString(),
    owner: value.owner.value,
    counterparty: value.counterparty.value,
    policyType: value.policy_type.value,
    positionType: value.position_type.value,
    strikePrice: value.protected_value.value,
    premium: value.premium.value,
    expirationHeight: value.expiration_height.value,
    blockHeight: event.block_height,
    txid: event.tx_id,
    timestamp: new Date(event.timestamp * 1000), // Convert to JS Date
    protectionAmount: value.protection_amount.value,
    collateralToken: value.collateral_token.value,
    settlementToken: value.settlement_token.value
  };
}

/**
 * Process a policy status updated event
 * 
 * @param event - Raw blockchain event data
 * @returns Processed event object with typed data
 */
function processPolicyStatusUpdatedEvent(event: any): PolicyStatusUpdatedEvent {
  // Extract data from event
  const { value } = event;
  
  // Parse out the policy data from the event value
  const processedEvent: PolicyStatusUpdatedEvent = {
    policyId: value.policy_id.value.toString(),
    previousStatus: mapNumberToStatus(value.previous_status.value),
    newStatus: mapNumberToStatus(value.new_status.value),
    blockHeight: event.block_height,
    txid: event.tx_id,
    timestamp: new Date(event.timestamp * 1000) // Convert to JS Date
  };
  
  // Add settlement data if present
  if (value.settlement && value.settlement.value) {
    processedEvent.settlement = {
      amount: value.settlement.value.amount?.value,
      price: value.settlement.value.price?.value
    };
  }
  
  return processedEvent;
}

/**
 * Process a premium distribution event
 * 
 * @param event - Raw blockchain event data
 * @returns Processed event object with typed data
 */
function processPremiumDistributionEvent(event: any): PremiumDistributionEvent {
  // Extract data from event
  const { value } = event;
  
  // Parse out the policy data from the event value
  return {
    policyId: value.policy_id.value.toString(),
    amount: value.amount.value / 100, // Convert from micro-units if needed
    recipient: value.recipient.value,
    token: value.token.value,
    blockHeight: event.block_height,
    txid: event.tx_id,
    timestamp: new Date(event.timestamp * 1000) // Convert to JS Date
  };
}

/**
 * Export the main functions
 */
export default {
  subscribeToPolicyCreatedEvents,
  subscribeToPolicyStatusUpdatedEvents,
  subscribeToPremiumDistributionEvents,
  fetchPolicyCreatedEvents,
  fetchPolicyStatusUpdatedEvents,
  fetchPremiumDistributionEvents
}; 