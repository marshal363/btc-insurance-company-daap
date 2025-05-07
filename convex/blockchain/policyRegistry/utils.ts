import { PolicyStatus, PolicyEventType } from "./types";

/**
 * Map numeric status from contract to PolicyStatus enum
 * 
 * @param statusNumber - Numeric status value from contract
 * @returns Corresponding PolicyStatus enum value
 */
export function mapNumberToStatus(statusNumber: number): PolicyStatus {
  switch (statusNumber) {
    case 0:
      return PolicyStatus.ACTIVE;
    case 1:
      return PolicyStatus.EXERCISED;
    case 2:
      return PolicyStatus.EXPIRED;
    case 3:
      return PolicyStatus.SETTLED;
    default:
      return PolicyStatus.ACTIVE; // Default case
  }
}

/**
 * Map numeric status to corresponding event type
 * 
 * @param statusNumber - Numeric status value from contract
 * @returns Corresponding PolicyEventType
 */
export function mapStatusToEventType(statusNumber: number): PolicyEventType {
  switch (statusNumber) {
    case 1:
      return PolicyEventType.SETTLED;
    case 2:
      return PolicyEventType.EXPIRED;
    case 3:
      return PolicyEventType.SETTLED;
    default:
      return PolicyEventType.CREATED; // Default case, should not happen
  }
}

/**
 * Format a blockchain amount to a human-readable format
 * 
 * @param amount - Amount in blockchain units (e.g., microstx)
 * @param decimals - Number of decimals to convert
 * @returns Formatted amount
 */
export function formatAmount(amount: number, decimals: number = 6): number {
  return amount / Math.pow(10, decimals);
}

/**
 * Format a BTC amount from satoshis to BTC
 * 
 * @param satoshis - Amount in satoshis
 * @returns Amount in BTC
 */
export function satoshisToBTC(satoshis: number): number {
  return satoshis / 100000000;
}

/**
 * Format a USD amount from micro-units to dollars
 * 
 * @param microUSD - Amount in micro-USD
 * @returns Amount in USD
 */
export function microUSDToUSD(microUSD: number): number {
  return microUSD / 100;
} 