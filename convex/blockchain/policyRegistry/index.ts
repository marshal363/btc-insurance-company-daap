/**
 * Policy Registry Blockchain Integration
 * 
 * This file exports all functionality for interacting with the Policy Registry contract.
 */

// Export types
export * from "./types";

// Export read operations
export { 
  getPolicyById,
  getPolicyStatus,
  checkPolicyExercisability,
} from "./reader";

// Export write operations
export {
  buildPolicyCreationTransaction,
  buildUpdatePolicyStatusTransaction,
  buildExpirePoliciesBatchTransaction,
  buildPremiumDistributionTransaction,
} from "./writer";

// Export event handling
export {
  subscribeToPolicyCreatedEvents,
  subscribeToPolicyStatusUpdatedEvents,
  subscribeToPremiumDistributionEvents,
  fetchPolicyCreatedEvents,
  fetchPolicyStatusUpdatedEvents,
  fetchPremiumDistributionEvents,
} from "./events";

// Export default with all functionality grouped
import reader from "./reader";
import writer from "./writer";
import events from "./events";

export default {
  ...reader,
  ...writer,
  ...events,
}; 