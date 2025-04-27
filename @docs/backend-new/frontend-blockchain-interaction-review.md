# Frontend Blockchain Interaction Review

This document details the architecture and data flow for the frontend application's interaction with the Stacks blockchain, focusing on wallet management, state handling, API communication, and component rendering, particularly within `CampaignDetails.tsx`.

## 1. Wallet Connection Management

Wallet connection logic is handled differently based on the environment (Devnet vs. Testnet/Mainnet).

**Testnet/Mainnet:**

- **`HiroWalletProvider.tsx`**: This context provider manages the connection lifecycle for Hiro Wallet (and potentially other compatible wallets supporting the Stacks Connect standard).
  - Uses `@stacks/connect` library functions (`connect`, `disconnect`, `isConnected`, `getLocalStorage`).
  - `authenticate`: Initiates the connection process, prompting the user via the wallet extension. Updates `isWalletConnected` state upon success.
  - `disconnect`: Clears the connection state.
  - `isWalletConnected`: Boolean state indicating if a wallet is currently connected.
  - `testnetAddress`, `mainnetAddress`: Derived from `getLocalStorage()` when connected, providing the appropriate STX address based on its prefix ('ST' for Testnet, 'SP' for Mainnet). This context makes the user's address available throughout the component tree.

**Devnet:**

- **`DevnetWalletProvider.tsx`**: Manages a set of pre-defined Devnet wallets, likely for testing purposes without needing a real wallet extension.
  - Uses `@/lib/devnet-wallet-context` (which likely defines the `DevnetWallet` type and `devnetWallets` array).
  - Provides `currentWallet`, `wallets`, and `setCurrentWallet` via React Context.
  - The `currentWallet` object contains the necessary details (like mnemonic/private key stored within the `DevnetWallet` type, presumably) to sign transactions directly within the application for Devnet.

**Selection:**

- Components like `CampaignDetails.tsx` use functions like `isDevnetEnvironment()` and `isTestnetEnvironment()` (from `lib/contract-utils.ts`) to determine the current network context.
- They then consume the appropriate context (`HiroWalletContext` or `DevnetWalletContext`) using `useContext` to get the relevant wallet address (`currentWalletAddress`).

## 2. State Management (Wallet Address & Contract Data)

- **Wallet Address:** Primarily managed by the context providers (`HiroWalletProvider`, `DevnetWalletProvider`) and made available via `useContext`. Components access `testnetAddress`, `mainnetAddress`, or `devnetWallet.stxAddress` as needed.
- **Blockchain Data (Campaign Info, Donations, Block Height):**
  - Managed using `@tanstack/react-query` for fetching, caching, and state synchronization.
  - **Hooks (`hooks/campaignQueries.ts`, `hooks/chainQueries.ts`):** Encapsulate the logic for fetching specific data points.
    - `useCampaignInfo`: Fetches overall campaign details (goal, raised amount, status, etc.) by calling the `get-campaign-info` read-only function on the `FUNDRAISING_CONTRACT`. It depends on `currentPrices` (likely fetched elsewhere) to calculate USD values. It refetches periodically (`refetchInterval: 10000`).
    - `useExistingDonation`: Fetches the specific user's donation amounts (STX and sBTC) by calling `get-stx-donation` and `get-sbtc-donation`, taking the user's `address` as input. Enabled only when `address` is available. It refetches periodically.
    - `useCurrentBtcBlock`: Fetches the latest Bitcoin block height relevant to the Stacks chain (burn block height) using the Stacks API's `getBlocks` endpoint. It refetches periodically.
  - **Data Flow:** Components call these hooks. `react-query` handles the background fetching, caching, loading states, and error states, providing the data (or status) directly to the component for rendering.

## 3. Stacks Blockchain API Communication

- **API Client Setup (`lib/stacks-api.ts`):**
  - Centralizes the configuration and instantiation of the `@stacks/blockchain-api-client`.
  - `getStacksUrl()`: Determines the correct Hiro API endpoint URL based on `process.env.NEXT_PUBLIC_STACKS_NETWORK`.
  - `getApi()`: Creates and returns an instance of the API client configured for the determined URL.
  - Provides access to various API modules (`smartContractsApi`, `blocksApi`, etc.).
- **Read-Only Calls:**
  - Hooks like `useCampaignInfo` and `useExistingDonation` utilize `smartContractsApi.callReadOnlyFunction` to query data from the smart contract without requiring a transaction or signature. They construct the necessary arguments, including contract address/name, function name, and sender address (often the contract address itself for read-only calls). Clarity Values (CV) are converted to/from hex format (`cvToHex`, `hexToCV`, `cvToJSON`) for interaction.
- **Transaction Execution (`hooks/useTransactionExecuter.tsx`, `lib/contract-utils.ts`):**
  - `useTransactionExecuter`: A custom hook providing a unified function to execute contract calls (transactions).
  - **Devnet:** Calls `executeContractCall` (from `lib/contract-utils.ts`).
    - `executeContractCall`: Uses `@stacks/transactions` (`makeContractCall`, `broadcastTransaction`) and `@stacks/wallet-sdk` (`generateWallet`) to construct, sign (using the devnet wallet's private key), and broadcast the transaction directly from the frontend's server-side context (or potentially client-side if keys are exposed, which is less secure but possible in Devnet).
  - **Testnet/Mainnet:** Uses `@stacks/connect`'s `request` function with the `'stx_callContract'` method.
    - This delegates the signing and broadcasting to the user's connected wallet extension (e.g., Hiro Wallet). It constructs the parameters needed by Stacks Connect based on the `ContractCallRegularOptions`.
  - Handles success/error feedback using `useToast`.

## 4. Data Flow in `CampaignDetails.tsx`

1.  **Environment Check:** Determines the network (Devnet/Testnet/Mainnet) using `isDevnetEnvironment`, `isTestnetEnvironment`.
2.  **Wallet Context:** Uses `useContext` to get either `HiroWalletContext` or `DevnetWalletContext`. Extracts the `currentWalletAddress`.
3.  **Fetch Data:** Calls custom hooks:
    - `useCurrentPrices()` (implementation not shown, but assumed to fetch STX/sBTC prices).
    - `useCampaignInfo(currentPrices)`: Fetches campaign state using `react-query`.
    - `useCurrentBtcBlock()`: Fetches the latest BTC block height.
    - `useExistingDonation(currentWalletAddress)`: Fetches the user's past donation data if an address is available.
4.  **State Derivation:** Calculates derived values based on fetched data:
    - `campaignIsUninitialized`, `campaignIsExpired`, `campaignIsCancelled`.
    - `progress` (percentage of goal raised).
    - `blocksLeft`, `secondsLeft` (time remaining).
    - `hasMadePreviousDonation`.
5.  **Rendering:**
    - Displays campaign images, title, subtitle, and markdown content.
    - Conditionally renders loading spinners (`Spinner`), error messages (`Alert`), or campaign stats (`Stat`, `Progress`) based on the state of `react-query` hooks (`campaignInfo`, `currentBlock`, etc.).
    - Displays fetched data like USD value raised, donation count, time left.
    - Conditionally shows admin controls (`CampaignAdminControls`) if the connected wallet is the contract owner.
    - Conditionally shows contribution/refund buttons based on campaign status (`campaignIsExpired`, `campaignIsCancelled`) and whether the user has donated (`hasMadePreviousDonation`).
6.  **Actions:**
    - **Contribute:** Opens the `DonationModal` (modal implementation not shown, but it would likely use `useTransactionExecuter` to initiate the `donate` transaction).
    - **Refund:** Calls `handleRefund`, which constructs the transaction options using `getRefundTx` (from `lib/campaign-utils.ts`, not shown) and executes it using `useTransactionExecuter`.

## 5. Architecture Analysis & Observations

- **Clear Separation:** The frontend effectively separates concerns:
  - UI components (`components/`).
  - State management & data fetching logic (`hooks/`, context providers).
  - Blockchain interaction utilities (`lib/`).
  - Constants (`constants/`).
- **Environment Handling:** Good practice in distinguishing between Devnet and Testnet/Mainnet interactions, especially for transaction signing.
- **State Management:** `react-query` is well-suited for managing server state (blockchain data), handling caching, background updates, and loading/error states efficiently. React Context is appropriately used for global state like wallet connection status and address.
- **Modularity:** Hooks (`useCampaignInfo`, `useExistingDonation`, `useTransactionExecuter`) promote reusability and encapsulate complex logic.
- **Stacks Interaction:** Leverages standard Stacks libraries (`@stacks/connect`, `@stacks/transactions`, `@stacks/blockchain-api-client`) effectively.
- **Potential Improvements:**
  - **Error Handling:** While `react-query` handles fetch errors, more specific error handling within components (e.g., differentiating network errors from contract errors) could enhance user feedback.
  - **Devnet Security:** Ensure Devnet private keys/mnemonics used in `executeContractCall` are handled securely and are not exposed in the client-side bundle if unintended. Usually, Devnet testing involves less stringent security, but it's worth noting.
  - **Type Safety:** Continued diligence with TypeScript types, especially around API responses and Clarity Value conversions, is crucial.

This architecture provides a solid foundation for interacting with the Stacks blockchain from a Next.js frontend.
