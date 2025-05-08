/**
 * Liquidity Pool Blockchain Integration: Event Handling
 * 
 * This file contains functions for handling events from the Liquidity Pool contract.
 */

import { getContractByName } from "../common/contracts";
import { subscribeToEvents, fetchEvents } from "../common/eventListener";
import { 
  LiquidityPoolEvent, 
  FundsDepositedEvent,
  FundsWithdrawnEvent,
  CollateralLockedEvent,
  CollateralReleasedEvent,
  SettlementPaidEvent,
  PremiumRecordedEvent,
  PremiumDistributedEvent,
  ProviderAllocationEvent,
  ProviderPremiumDistributedEvent,
  TokenType
} from "./types";

/**
 * Subscribe to funds-deposited events from the Liquidity Pool contract
 * @param callback Callback function to handle the events
 * @param options Subscription options (from block, to block)
 * @returns Subscription ID
 */
export async function subscribeToFundsDepositedEvents(
  callback: (event: FundsDepositedEvent) => void,
  options?: { fromBlock?: number; toBlock?: number }
): Promise<string> {
  const contract = getContractByName("liquidityPool");
  
  return subscribeToEvents({
    contractAddress: contract.address,
    contractName: contract.name,
    eventName: "funds-deposited",
    callback: (rawEvent) => {
      // Map raw event data to typed event
      const typedEvent: FundsDepositedEvent = {
        eventType: "funds-deposited",
        depositor: rawEvent.depositor,
        amount: parseInt(rawEvent.amount),
        token: rawEvent.token as TokenType,
        txId: rawEvent.tx_id
      };
      
      callback(typedEvent);
    },
    options
  });
}

/**
 * Subscribe to funds-withdrawn events from the Liquidity Pool contract
 * @param callback Callback function to handle the events
 * @param options Subscription options (from block, to block)
 * @returns Subscription ID
 */
export async function subscribeToFundsWithdrawnEvents(
  callback: (event: FundsWithdrawnEvent) => void,
  options?: { fromBlock?: number; toBlock?: number }
): Promise<string> {
  const contract = getContractByName("liquidityPool");
  
  return subscribeToEvents({
    contractAddress: contract.address,
    contractName: contract.name,
    eventName: "funds-withdrawn",
    callback: (rawEvent) => {
      // Map raw event data to typed event
      const typedEvent: FundsWithdrawnEvent = {
        eventType: "funds-withdrawn",
        withdrawer: rawEvent.withdrawer,
        amount: parseInt(rawEvent.amount),
        token: rawEvent.token as TokenType,
        txId: rawEvent.tx_id
      };
      
      callback(typedEvent);
    },
    options
  });
}

/**
 * Subscribe to collateral-locked events from the Liquidity Pool contract
 * @param callback Callback function to handle the events
 * @param options Subscription options (from block, to block)
 * @returns Subscription ID
 */
export async function subscribeToCollateralLockedEvents(
  callback: (event: CollateralLockedEvent) => void,
  options?: { fromBlock?: number; toBlock?: number }
): Promise<string> {
  const contract = getContractByName("liquidityPool");
  
  return subscribeToEvents({
    contractAddress: contract.address,
    contractName: contract.name,
    eventName: "collateral-locked",
    callback: (rawEvent) => {
      // Map raw event data to typed event
      const typedEvent: CollateralLockedEvent = {
        eventType: "collateral-locked",
        policyId: rawEvent.policy_id.toString(),
        amountLocked: parseInt(rawEvent.amount_locked),
        token: rawEvent.token as TokenType,
        txId: rawEvent.tx_id
      };
      
      callback(typedEvent);
    },
    options
  });
}

/**
 * Subscribe to collateral-released events from the Liquidity Pool contract
 * @param callback Callback function to handle the events
 * @param options Subscription options (from block, to block)
 * @returns Subscription ID
 */
export async function subscribeToCollateralReleasedEvents(
  callback: (event: CollateralReleasedEvent) => void,
  options?: { fromBlock?: number; toBlock?: number }
): Promise<string> {
  const contract = getContractByName("liquidityPool");
  
  return subscribeToEvents({
    contractAddress: contract.address,
    contractName: contract.name,
    eventName: "collateral-released",
    callback: (rawEvent) => {
      // Map raw event data to typed event
      const typedEvent: CollateralReleasedEvent = {
        eventType: "collateral-released",
        policyId: rawEvent.policy_id.toString(),
        amountReleased: parseInt(rawEvent.amount_released),
        token: rawEvent.token as TokenType,
        txId: rawEvent.tx_id
      };
      
      callback(typedEvent);
    },
    options
  });
}

/**
 * Subscribe to settlement-paid events from the Liquidity Pool contract
 * @param callback Callback function to handle the events
 * @param options Subscription options (from block, to block)
 * @returns Subscription ID
 */
export async function subscribeToSettlementPaidEvents(
  callback: (event: SettlementPaidEvent) => void,
  options?: { fromBlock?: number; toBlock?: number }
): Promise<string> {
  const contract = getContractByName("liquidityPool");
  
  return subscribeToEvents({
    contractAddress: contract.address,
    contractName: contract.name,
    eventName: "settlement-paid",
    callback: (rawEvent) => {
      // Map raw event data to typed event
      const typedEvent: SettlementPaidEvent = {
        eventType: "settlement-paid",
        policyId: rawEvent.policy_id.toString(),
        buyer: rawEvent.buyer,
        settlementAmount: parseInt(rawEvent.settlement_amount),
        token: rawEvent.token as TokenType,
        txId: rawEvent.tx_id
      };
      
      callback(typedEvent);
    },
    options
  });
}

/**
 * Subscribe to premium-recorded events from the Liquidity Pool contract
 * @param callback Callback function to handle the events
 * @param options Subscription options (from block, to block)
 * @returns Subscription ID
 */
export async function subscribeToPremiumRecordedEvents(
  callback: (event: PremiumRecordedEvent) => void,
  options?: { fromBlock?: number; toBlock?: number }
): Promise<string> {
  const contract = getContractByName("liquidityPool");
  
  return subscribeToEvents({
    contractAddress: contract.address,
    contractName: contract.name,
    eventName: "premium-recorded",
    callback: (rawEvent) => {
      // Map raw event data to typed event
      const typedEvent: PremiumRecordedEvent = {
        eventType: "premium-recorded",
        policyId: rawEvent.policy_id.toString(),
        counterparty: rawEvent.counterparty,
        premiumAmount: parseInt(rawEvent.premium_amount),
        token: rawEvent.token as TokenType,
        txId: rawEvent.tx_id
      };
      
      callback(typedEvent);
    },
    options
  });
}

/**
 * Subscribe to premium-distributed events from the Liquidity Pool contract
 * @param callback Callback function to handle the events
 * @param options Subscription options (from block, to block)
 * @returns Subscription ID
 */
export async function subscribeToPremiumDistributedEvents(
  callback: (event: PremiumDistributedEvent) => void,
  options?: { fromBlock?: number; toBlock?: number }
): Promise<string> {
  const contract = getContractByName("liquidityPool");
  
  return subscribeToEvents({
    contractAddress: contract.address,
    contractName: contract.name,
    eventName: "premium-distributed",
    callback: (rawEvent) => {
      // Map raw event data to typed event
      const typedEvent: PremiumDistributedEvent = {
        eventType: "premium-distributed",
        policyId: rawEvent.policy_id.toString(),
        counterparty: rawEvent.counterparty,
        premiumAmount: parseInt(rawEvent.premium_amount),
        token: rawEvent.token as TokenType,
        txId: rawEvent.tx_id
      };
      
      callback(typedEvent);
    },
    options
  });
}

/**
 * Subscribe to provider-allocation-recorded events from the Liquidity Pool contract
 * @param callback Callback function to handle the events
 * @param options Subscription options (from block, to block)
 * @returns Subscription ID
 */
export async function subscribeToProviderAllocationEvents(
  callback: (event: ProviderAllocationEvent) => void,
  options?: { fromBlock?: number; toBlock?: number }
): Promise<string> {
  const contract = getContractByName("liquidityPool");
  
  return subscribeToEvents({
    contractAddress: contract.address,
    contractName: contract.name,
    eventName: "provider-allocation-recorded",
    callback: (rawEvent) => {
      // Map raw event data to typed event
      const typedEvent: ProviderAllocationEvent = {
        eventType: "provider-allocation-recorded",
        provider: rawEvent.provider,
        policyId: rawEvent.policy_id.toString(),
        allocatedAmount: parseInt(rawEvent.allocated_amount),
        premiumShare: parseInt(rawEvent.premium_share),
        token: rawEvent.token as TokenType,
        txId: rawEvent.tx_id
      };
      
      callback(typedEvent);
    },
    options
  });
}

/**
 * Subscribe to provider-premium-distributed events from the Liquidity Pool contract
 * @param callback Callback function to handle the events
 * @param options Subscription options (from block, to block)
 * @returns Subscription ID
 */
export async function subscribeToProviderPremiumDistributedEvents(
  callback: (event: ProviderPremiumDistributedEvent) => void,
  options?: { fromBlock?: number; toBlock?: number }
): Promise<string> {
  const contract = getContractByName("liquidityPool");
  
  return subscribeToEvents({
    contractAddress: contract.address,
    contractName: contract.name,
    eventName: "provider-premium-distributed",
    callback: (rawEvent) => {
      // Map raw event data to typed event
      const typedEvent: ProviderPremiumDistributedEvent = {
        eventType: "provider-premium-distributed",
        provider: rawEvent.provider,
        policyId: rawEvent.policy_id.toString(),
        premiumAmount: parseInt(rawEvent.premium_amount),
        token: rawEvent.token as TokenType,
        txId: rawEvent.tx_id
      };
      
      callback(typedEvent);
    },
    options
  });
}

/**
 * Fetch historical funds-deposited events within a block range
 * @param options Query options (from block, to block)
 * @returns Array of funds-deposited events
 */
export async function fetchFundsDepositedEvents(
  options?: { fromBlock?: number; toBlock?: number }
): Promise<FundsDepositedEvent[]> {
  const contract = getContractByName("liquidityPool");
  
  const rawEvents = await fetchEvents({
    contractAddress: contract.address,
    contractName: contract.name,
    eventName: "funds-deposited",
    options
  });
  
  // Map raw events to typed events
  return rawEvents.map((rawEvent) => ({
    eventType: "funds-deposited",
    depositor: rawEvent.depositor,
    amount: parseInt(rawEvent.amount),
    token: rawEvent.token as TokenType,
    txId: rawEvent.tx_id
  }));
}

/**
 * Fetch historical premium distribution events for a provider
 * @param provider The provider address to query for
 * @param options Query options (from block, to block)
 * @returns Array of provider premium distribution events
 */
export async function fetchProviderPremiumDistributionEvents(
  provider: string,
  options?: { fromBlock?: number; toBlock?: number }
): Promise<ProviderPremiumDistributedEvent[]> {
  const contract = getContractByName("liquidityPool");
  
  const rawEvents = await fetchEvents({
    contractAddress: contract.address,
    contractName: contract.name,
    eventName: "provider-premium-distributed",
    options
  });
  
  // Filter and map raw events to typed events
  return rawEvents
    .filter(event => event.provider === provider)
    .map((rawEvent) => ({
      eventType: "provider-premium-distributed",
      provider: rawEvent.provider,
      policyId: rawEvent.policy_id.toString(),
      premiumAmount: parseInt(rawEvent.premium_amount),
      token: rawEvent.token as TokenType,
      txId: rawEvent.tx_id
    }));
}

/**
 * Fetch all events for a specific policy
 * @param policyId The policy ID to query for
 * @returns Object containing arrays of policy-related events
 */
export async function fetchPolicyEvents(
  policyId: string
): Promise<{
  collateralLocked: CollateralLockedEvent[];
  collateralReleased: CollateralReleasedEvent[];
  settlementPaid: SettlementPaidEvent[];
  premiumRecorded: PremiumRecordedEvent[];
  premiumDistributed: PremiumDistributedEvent[];
  providerAllocations: ProviderAllocationEvent[];
}> {
  const contract = getContractByName("liquidityPool");
  
  // Fetch events in parallel
  const [
    collateralLockedRaw,
    collateralReleasedRaw,
    settlementPaidRaw,
    premiumRecordedRaw,
    premiumDistributedRaw,
    providerAllocationsRaw
  ] = await Promise.all([
    fetchEvents({
      contractAddress: contract.address,
      contractName: contract.name,
      eventName: "collateral-locked",
      options: {}
    }),
    fetchEvents({
      contractAddress: contract.address,
      contractName: contract.name,
      eventName: "collateral-released",
      options: {}
    }),
    fetchEvents({
      contractAddress: contract.address,
      contractName: contract.name,
      eventName: "settlement-paid",
      options: {}
    }),
    fetchEvents({
      contractAddress: contract.address,
      contractName: contract.name,
      eventName: "premium-recorded",
      options: {}
    }),
    fetchEvents({
      contractAddress: contract.address,
      contractName: contract.name,
      eventName: "premium-distributed",
      options: {}
    }),
    fetchEvents({
      contractAddress: contract.address,
      contractName: contract.name,
      eventName: "provider-allocation-recorded",
      options: {}
    })
  ]);
  
  // Filter all events for the specific policy ID and map to typed events
  return {
    collateralLocked: collateralLockedRaw
      .filter(event => event.policy_id.toString() === policyId)
      .map(rawEvent => ({
        eventType: "collateral-locked",
        policyId: rawEvent.policy_id.toString(),
        amountLocked: parseInt(rawEvent.amount_locked),
        token: rawEvent.token as TokenType,
        txId: rawEvent.tx_id
      })),
    collateralReleased: collateralReleasedRaw
      .filter(event => event.policy_id.toString() === policyId)
      .map(rawEvent => ({
        eventType: "collateral-released",
        policyId: rawEvent.policy_id.toString(),
        amountReleased: parseInt(rawEvent.amount_released),
        token: rawEvent.token as TokenType,
        txId: rawEvent.tx_id
      })),
    settlementPaid: settlementPaidRaw
      .filter(event => event.policy_id.toString() === policyId)
      .map(rawEvent => ({
        eventType: "settlement-paid",
        policyId: rawEvent.policy_id.toString(),
        buyer: rawEvent.buyer,
        settlementAmount: parseInt(rawEvent.settlement_amount),
        token: rawEvent.token as TokenType,
        txId: rawEvent.tx_id
      })),
    premiumRecorded: premiumRecordedRaw
      .filter(event => event.policy_id.toString() === policyId)
      .map(rawEvent => ({
        eventType: "premium-recorded",
        policyId: rawEvent.policy_id.toString(),
        counterparty: rawEvent.counterparty,
        premiumAmount: parseInt(rawEvent.premium_amount),
        token: rawEvent.token as TokenType,
        txId: rawEvent.tx_id
      })),
    premiumDistributed: premiumDistributedRaw
      .filter(event => event.policy_id.toString() === policyId)
      .map(rawEvent => ({
        eventType: "premium-distributed",
        policyId: rawEvent.policy_id.toString(),
        counterparty: rawEvent.counterparty,
        premiumAmount: parseInt(rawEvent.premium_amount),
        token: rawEvent.token as TokenType,
        txId: rawEvent.tx_id
      })),
    providerAllocations: providerAllocationsRaw
      .filter(event => event.policy_id.toString() === policyId)
      .map(rawEvent => ({
        eventType: "provider-allocation-recorded",
        provider: rawEvent.provider,
        policyId: rawEvent.policy_id.toString(),
        allocatedAmount: parseInt(rawEvent.allocated_amount),
        premiumShare: parseInt(rawEvent.premium_share),
        token: rawEvent.token as TokenType,
        txId: rawEvent.tx_id
      })),
  };
} 