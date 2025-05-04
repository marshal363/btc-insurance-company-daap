# Blockchain Integration Layer Specification (Convex)

**Version:** 1.0
**Date:** 2024-08-21
**Status:** Draft

## 1. Introduction

This document specifies the design and responsibilities of the Blockchain Integration Layer within the BitHedge Convex backend. This layer serves as the crucial bridge between the off-chain business logic residing in Convex actions/functions and the on-chain minimal smart contracts deployed on the Stacks blockchain.

Its primary purpose is to abstract the complexities of blockchain interaction, providing a consistent and reliable interface for other Convex services while handling tasks like transaction construction, signing, broadcasting, monitoring, and event processing.

## 2. Location and Implementation

This layer is not a distinct, separate service but rather a conceptual grouping of functionalities implemented within:

- **Convex Actions:** Actions that require on-chain interaction will invoke helper functions belonging to this layer.
- **Convex Internal Functions (`internal.*`):** Common blockchain interaction logic (e.g., transaction building, monitoring helpers) will be implemented as internal functions reusable across different actions.
- **Convex Scheduled Jobs:** Jobs might trigger actions that use this layer for tasks like monitoring or broadcasting scheduled transactions.

It utilizes standard Stacks libraries (`@stacks/network`, `@stacks/transactions`, `@stacks/connect` for client-side interactions if needed) and interacts with Stacks API nodes.

## 3. Core Responsibilities

1.  **Transaction Building:** Constructing syntactically correct and appropriately encoded Clarity function call transactions based on parameters provided by higher-level Convex services.
2.  **Signing Strategy:** Managing the signing of transactions:
    - **User-Signed Transactions:** Preparing transaction payloads/options suitable for being signed client-side by the user's connected wallet (e.g., via `@stacks/connect` triggered by the frontend based on data returned from a Convex action).
    - **Backend-Signed Transactions:** Securely signing transactions using the designated **Backend Authorized Principal**'s private key for authorized system operations (e.g., settling policies, locking collateral, updating status).
3.  **Broadcasting:** Submitting signed transactions to the configured Stacks network node (Mainnet, Testnet, Devnet).
4.  **Transaction Monitoring:** Tracking the status of broadcast transactions (pending, success, failure) by interacting with Stacks APIs.
5.  **Nonce Management:** Correctly managing the nonce for the Backend Authorized Principal to ensure sequential transaction processing and prevent failures.
6.  **Event Listening/Processing:** (Potentially optional for MVP, depending on complexity vs. polling) Actively listening for specific on-chain contract events (e.g., `funds-deposited`, `policy-status-updated`) or periodically polling for relevant state changes.
7.  **State Reading:** Providing helpers to read data from on-chain contracts via read-only function calls.
8.  **Stacks API Abstraction:** Encapsulating direct interactions with Stacks node APIs (`POST /v2/transactions`, `GET /v2/transactions/...`, `POST /v2/contracts/call-read/...`) to provide a cleaner interface within Convex.

## 4. Conceptual Interface / Functions

These represent the types of functions this layer would expose internally within Convex:

```typescript
// (Conceptual interfaces within Convex helper modules)

interface TxCallOptions {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  network: StacksNetwork;
}

interface UserSignableTxPayload {
  // Data structure suitable for @stacks/connect openContractCall
  // Includes network, contract details, function details, args, etc.
  // Does NOT include sender private key
}

interface BroadcastResult {
  txId: string;
  error?: string;
}

interface TransactionStatus {
  status: "pending" | "success" | "failed";
  receipt?: any; // Stacks API transaction receipt
  error?: string;
}

// --- Transaction Building & Signing ---

/**
 * Prepares transaction options for a user to sign client-side.
 */
async function prepareUserSignedTx(
  options: TxCallOptions,
  senderAddress: string
): Promise<UserSignableTxPayload>;

/**
 * Builds, signs (as backend principal), and broadcasts a transaction.
 * Handles nonce management internally for the backend principal.
 */
async function signAndBroadcastBackendTx(
  options: TxCallOptions
): Promise<BroadcastResult>;

// --- Broadcasting & Monitoring ---

/**
 * Broadcasts a pre-signed transaction (less common for backend use).
 */
async function broadcastRawTx(rawTx: Buffer): Promise<BroadcastResult>;

/**
 * Monitors a transaction until it reaches a terminal state (success/failed).
 * Includes retry logic and timeout.
 */
async function monitorTransaction(txId: string): Promise<TransactionStatus>;

/**
 * Fetches the current status of a transaction.
 */
async function getTransactionStatus(txId: string): Promise<TransactionStatus>;

// --- State Reading ---

/**
 * Calls a read-only function on a contract.
 */
async function callReadOnlyFunction<T>(options: TxCallOptions): Promise<T>;

// --- Event Processing ---

/**
 * (If using event listening) Subscribe to specific contract events.
 */
function subscribeToContractEvent(
  contractId: string,
  eventName: string,
  callback: (eventData: any) => void
): UnsubscribeFunction;

/**
 * Fetch recent events for a contract (if using polling).
 */
async function fetchContractEvents(
  contractId: string,
  sinceBlock?: number,
  limit?: number
): Promise<any[]>;

// --- Nonce Management ---

/**
 * Gets the next valid nonce for the backend principal.
 * Handles concurrent requests carefully.
 */
async function getNextBackendNonce(): Promise<number>;
```

## 5. Security Considerations

- **Backend Private Key Management:** The private key for the Backend Authorized Principal is the most critical secret. It MUST be stored securely using the Convex environment's secret management features and NEVER exposed in code or logs.
- **Authorization:** Functions utilizing the backend principal for signing (`signAndBroadcastBackendTx`) MUST only be callable from authorized Convex actions/internal functions, ensuring that only legitimate system processes can trigger these transactions.
- **Nonce Management:** Incorrect nonce management can lead to failed transactions or security vulnerabilities. Implementation must be robust, potentially using locking mechanisms or atomic updates if handled within Convex state.
- **Input Validation:** Ensure that all parameters passed to build transactions (`TxCallOptions`) are properly validated by the calling service _before_ reaching this layer.

## 6. MVP Implementation Notes

- **Event Listening vs. Polling:** For MVP, relying on polling transaction status (`monitorTransaction`) after broadcasting might be simpler than setting up a robust event listening infrastructure (e.g., via Stacks Chainhooks or similar), unless real-time updates are absolutely critical for core flows.
- **Error Handling:** Focus on clear logging and surfacing errors to the UI/monitoring systems. Complex automated recovery for failed transactions might be deferred post-MVP.
- **Nonce Source:** The initial implementation can likely fetch the nonce directly from the Stacks API for the backend principal before signing, ensuring atomicity within a single Convex action execution.

## 7. Conclusion

The Blockchain Integration Layer is a vital abstraction within the Convex backend. By encapsulating Stacks network interactions, it simplifies the development of higher-level business logic, enhances security through controlled signing processes, and provides mechanisms for reliable transaction monitoring and state synchronization, enabling the effective operation of the hybrid BitHedge architecture.
