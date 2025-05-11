"use client";

import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel"; // Import Id type

// Define possible transaction statuses
export enum TransactionUiStatus {
  NONE = "NONE", // No active transaction
  PREPARING_BACKEND = "PREPARING_BACKEND", // Waiting for backend to prepare (e.g., finalize quote, prep tx data)
  AWAITING_WALLET_ACTION = "AWAITING_WALLET_ACTION", // Waiting for user to connect/sign in wallet
  SUBMITTING_TO_CHAIN = "SUBMITTING_TO_CHAIN", // Tx sent to blockchain, awaiting mempool acceptance/first confirmation
  PENDING_CONFIRMATION = "PENDING_CONFIRMATION", // Tx in mempool/on chain, waiting for sufficient confirmations
  SUCCESS = "SUCCESS", // Transaction confirmed successfully
  ERROR_BACKEND = "ERROR_BACKEND", // Error during backend preparation
  ERROR_WALLET = "ERROR_WALLET", // Error during wallet interaction (e.g., user rejection, no funds)
  ERROR_CHAIN = "ERROR_CHAIN", // Error from blockchain (e.g., tx reverted)
  ERROR_POLLING = "ERROR_POLLING", // Error while trying to get status update
}

interface TransactionContextState {
  activeConvexId: Id<"transactions"> | null;
  blockchainTxId: string | null;
  uiStatus: TransactionUiStatus;
  errorDetails: string | null; // Store more detailed error messages or objects if needed
}

interface TransactionContextProps extends TransactionContextState {
  setActiveConvexId: (id: Id<"transactions"> | null) => void;
  setBlockchainTxId: (txId: string | null) => void;
  setUiStatus: (status: TransactionUiStatus) => void;
  setErrorDetails: (error: string | null) => void;
  
  // Combined setters for convenience
  initiateTransaction: (convexId: Id<"transactions">) => void;
  handleWalletSubmission: (blockchainTxId: string) => void;
  handleBackendError: (error: string) => void;
  handleWalletError: (error: string) => void;
  handleChainError: (error: string) => void;
  handlePollingError: (error: string) => void;
  handleSuccess: () => void;
  
  resetTransactionState: () => void;
}

const DEFAULT_STATE: TransactionContextState = {
  activeConvexId: null,
  blockchainTxId: null,
  uiStatus: TransactionUiStatus.NONE,
  errorDetails: null,
};

const TransactionContext = createContext<TransactionContextProps | undefined>(undefined);

interface TransactionProviderProps {
  children: ReactNode;
}

export const TransactionProvider: React.FC<TransactionProviderProps> = ({ children }) => {
  const [activeConvexId, setActiveConvexIdState] = useState<Id<"transactions"> | null>(DEFAULT_STATE.activeConvexId);
  const [blockchainTxId, setBlockchainTxIdState] = useState<string | null>(DEFAULT_STATE.blockchainTxId);
  const [uiStatus, setUiStatusState] = useState<TransactionUiStatus>(DEFAULT_STATE.uiStatus);
  const [errorDetails, setErrorDetailsState] = useState<string | null>(DEFAULT_STATE.errorDetails);

  // --- BF-105: Polling Logic Setup ---
  // const POLLING_INTERVAL_MS = 5000; // Poll every 5 seconds - Removed as useQuery handles refetching
  const POLLING_INTERVAL_MS = 5000; // Re-add for clarity and use with refetchInterval

  // This query will be fully implemented later in convex/transactions.ts
  // For now, we define its expected behavior for the frontend.
  const polledTxData = useQuery(
    api.transactions.pollTransactionStatus,
    activeConvexId ? { transactionId: activeConvexId } : "skip", // Removed `as any` cast
    {
      // Enable polling only when in specific statuses
      enabled: uiStatus === TransactionUiStatus.SUBMITTING_TO_CHAIN || uiStatus === TransactionUiStatus.PENDING_CONFIRMATION,
      refetchInterval: POLLING_INTERVAL_MS, // Add refetchInterval
      refetchIntervalInBackground: true, // Optional: continue polling even if tab is not active
    }
  );

  useEffect(() => {
    const elunpollableStatuses = [
      TransactionUiStatus.NONE,
      TransactionUiStatus.PREPARING_BACKEND,
      TransactionUiStatus.AWAITING_WALLET_ACTION,
      TransactionUiStatus.SUCCESS,
      TransactionUiStatus.ERROR_BACKEND,
      TransactionUiStatus.ERROR_WALLET,
      TransactionUiStatus.ERROR_CHAIN,
      TransactionUiStatus.ERROR_POLLING,
    ];

    if (!activeConvexId || elunpollableStatuses.includes(uiStatus)) {
      return;
    }

    console.log(`TransactionContext Polling: activeConvexId=${activeConvexId}, currentUiStatus=${uiStatus}, polledData:`, polledTxData);

    if (polledTxData) {
      // --- Real Backend Status Mapping --- 
      const backendStatus = polledTxData.status; // e.g., "PENDING", "SUBMITTED", "CONFIRMED", "FAILED"
      const backendError = polledTxData.errorDetails;

      switch (backendStatus) {
        case "CONFIRMED":
          setUiStatusState(TransactionUiStatus.SUCCESS);
          setErrorDetailsState(null);
          console.log(`Transaction ${activeConvexId} CONFIRMED.`);
          break;
        case "FAILED":
          setUiStatusState(TransactionUiStatus.ERROR_CHAIN);
          setErrorDetailsState(backendError || "Transaction failed on-chain. No specific error details provided.");
          console.error(`Transaction ${activeConvexId} FAILED: ${backendError}`);
          break;
        case "SUBMITTED":
          // If backend says SUBMITTED, frontend could be SUBMITTING_TO_CHAIN or PENDING_CONFIRMATION
          // If already PENDING_CONFIRMATION, keep it. Otherwise, move to SUBMITTING_TO_CHAIN.
          if (uiStatus !== TransactionUiStatus.PENDING_CONFIRMATION) {
            setUiStatusState(TransactionUiStatus.SUBMITTING_TO_CHAIN);
          }
          console.log(`Transaction ${activeConvexId} is SUBMITTED. Polling continues.`);
          break;
        case "PENDING": 
          // If backend says PENDING (e.g. after creation but before blockchain tx hash is known by backend),
          // or if it's a more granular pending state from backend.
          // Frontend usually moves from AWAITING_WALLET_ACTION -> SUBMITTING_TO_CHAIN (after wallet submission) -> PENDING_CONFIRMATION.
          // If we are polling and backend says PENDING, and we are not already in a final state,
          // PENDING_CONFIRMATION is a reasonable catch-all if no more specific UI state matches.
          if (uiStatus !== TransactionUiStatus.SUCCESS && 
              uiStatus !== TransactionUiStatus.ERROR_CHAIN && 
              uiStatus !== TransactionUiStatus.PENDING_CONFIRMATION) {
            setUiStatusState(TransactionUiStatus.PENDING_CONFIRMATION);
          }
          console.log(`Transaction ${activeConvexId} is PENDING. Polling continues.`);
          break;
        case "REPLACED":
        case "EXPIRED":
          // These are terminal states. For UI purposes, they might be treated as a form of failure or a specific non-success state.
          // For now, let's map them to ERROR_CHAIN with a descriptive message.
          setUiStatusState(TransactionUiStatus.ERROR_CHAIN);
          setErrorDetailsState(`Transaction ${backendStatus.toLowerCase()}: ${backendError || "No further details."}`);
          console.warn(`Transaction ${activeConvexId} ${backendStatus}.`);
          break;
        default:
          // Unknown status from backend or initial load of useQuery without specific status yet
          // If we are in a polling state (e.g. SUBMITTING_TO_CHAIN), and we get an unknown status,
          // it might be an issue, or just a transient state. For now, log it.
          console.log(`Transaction ${activeConvexId}: received polled data with unhandled backend status '${backendStatus}'. Waiting for definitive status.`);
          // Avoid changing UI status if backend status is unclear, unless current UI status is clearly wrong.
          break;
      }
      // --- End Real Backend Status Mapping --- 
    } else if (polledTxData === null && activeConvexId && 
               (uiStatus === TransactionUiStatus.SUBMITTING_TO_CHAIN || uiStatus === TransactionUiStatus.PENDING_CONFIRMATION)) {
      // If we expect a transaction (because we are polling for it) and get null,
      // this could mean the transaction was not found by the poll query. This is an error condition.
      console.error(`TransactionContext Polling Error: Received null for polledTxData (txId: ${activeConvexId}) when expecting data. Setting to ERROR_POLLING.`);
      setUiStatusState(TransactionUiStatus.ERROR_POLLING);
      setErrorDetailsState(`Failed to fetch transaction status for ${activeConvexId}. The transaction may not exist or there was a network issue.`);
    }

  }, [polledTxData, activeConvexId, uiStatus, setUiStatusState, setErrorDetailsState]);
  // --- End BF-105 Polling Logic ---

  const setActiveConvexId = useCallback((id: Id<"transactions"> | null) => setActiveConvexIdState(id), []);
  const setBlockchainTxId = useCallback((txId: string | null) => setBlockchainTxIdState(txId), []);
  const setUiStatus = useCallback((status: TransactionUiStatus) => setUiStatusState(status), []);
  const setErrorDetails = useCallback((error: string | null) => {
    setErrorDetailsState(error);
    if (error && (
        uiStatus !== TransactionUiStatus.ERROR_BACKEND &&
        uiStatus !== TransactionUiStatus.ERROR_WALLET &&
        uiStatus !== TransactionUiStatus.ERROR_CHAIN &&
        uiStatus !== TransactionUiStatus.ERROR_POLLING
        )) {
        // If a new error comes in and we are not already in a specific error state,
        // set a generic error status or let the specific handlers do it.
        // For now, specific handlers will set the correct error UI status.
    }
  }, [uiStatus]);

  const resetTransactionState = useCallback(() => {
    setActiveConvexIdState(DEFAULT_STATE.activeConvexId);
    setBlockchainTxIdState(DEFAULT_STATE.blockchainTxId);
    setUiStatusState(DEFAULT_STATE.uiStatus);
    setErrorDetailsState(DEFAULT_STATE.errorDetails);
  }, []);

  // Convenience handlers
  const initiateTransaction = useCallback((convexId: Id<"transactions">) => {
    resetTransactionState(); // Reset before starting a new one
    setActiveConvexIdState(convexId);
    setUiStatusState(TransactionUiStatus.PREPARING_BACKEND);
  }, [resetTransactionState]);

  const handleWalletSubmission = useCallback((newBlockchainTxId: string) => {
    setBlockchainTxIdState(newBlockchainTxId);
    setUiStatusState(TransactionUiStatus.SUBMITTING_TO_CHAIN);
    setErrorDetailsState(null); // Clear previous errors
  }, []);

  const handleBackendError = useCallback((error: string) => {
    setErrorDetailsState(error);
    setUiStatusState(TransactionUiStatus.ERROR_BACKEND);
  }, []);
  
  const handleWalletError = useCallback((error: string) => {
    setErrorDetailsState(error);
    setUiStatusState(TransactionUiStatus.ERROR_WALLET);
  }, []);

  const handleChainError = useCallback((error: string) => {
    setErrorDetailsState(error);
    setUiStatusState(TransactionUiStatus.ERROR_CHAIN);
  }, []);

  const handlePollingError = useCallback((error: string) => {
    setErrorDetailsState(error);
    setUiStatusState(TransactionUiStatus.ERROR_POLLING);
  }, []);

  const handleSuccess = useCallback(() => {
    setUiStatusState(TransactionUiStatus.SUCCESS);
    setErrorDetailsState(null); // Clear any previous non-fatal errors
    // blockchainTxId and activeConvexId remain for record until reset manually or new tx
  }, []);


  const contextValue: TransactionContextProps = {
    activeConvexId,
    blockchainTxId,
    uiStatus,
    errorDetails,
    setActiveConvexId,
    setBlockchainTxId,
    setUiStatus,
    setErrorDetails,
    initiateTransaction,
    handleWalletSubmission,
    handleBackendError,
    handleWalletError,
    handleChainError,
    handlePollingError,
    handleSuccess,
    resetTransactionState,
  };

  return (
    <TransactionContext.Provider value={contextValue}>
      {children}
    </TransactionContext.Provider>
  );
};

export const useTransactionContext = (): TransactionContextProps => {
  const context = useContext(TransactionContext);
  if (context === undefined) {
    throw new Error('useTransactionContext must be used within a TransactionProvider');
  }
  return context;
}; 