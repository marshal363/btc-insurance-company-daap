# Web3 Architecture: Bitcoin Fundraising DApp

## 1. Frontend-Blockchain Communication Architecture

### Overview

This fundraising application demonstrates a modern approach to Web3 development, utilizing Next.js for the frontend and connecting to the Stacks blockchain, which is anchored to Bitcoin for security. The architecture follows a clear pattern of separation between the UI layer and blockchain interaction layer.

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Next.js Frontend                           │
├─────────────┬───────────────────────────────────────┬───────────────┤
│ React       │ Data Management                       │ UI Components │
│ Components  │ (React Query, Context)                │ (Chakra UI)   │
├─────────────┴───────────────┬───────────────────────┴───────────────┤
│                             │                                        │
│      ┌─────────────────────▼────────────────────────┐               │
│      │         Abstraction Layer (Hooks)            │               │
│      │ useTransactionExecuter, campaignQueries      │               │
│      └─────────────────────┬────────────────────────┘               │
│                            │                                         │
│      ┌─────────────────────▼────────────────────────┐               │
│      │         Contract Utilities                   │               │
│      │ contract-utils.ts, stacks-api.ts             │               │
│      └─────────────────────┬────────────────────────┘               │
│                            │                                         │
└────────────────────────────┼─────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Stacks JS SDK                                │
│ (@stacks/connect, @stacks/transactions, @stacks/wallet-sdk)         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Stacks Blockchain API                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                Stacks Blockchain (Mainnet/Testnet/Devnet)           │
│                   (Bitcoin L2 via PoX mechanism)                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Communication Mechanisms

The communication between the frontend and the Stacks blockchain occurs through several key mechanisms:

1. **Read Operations**: Implemented using React Query for data fetching and caching

   ```typescript
   // Example from campaignQueries.ts
   export const useCampaignInfo = (currentPrices) => {
     const api = getApi(getStacksUrl()).smartContractsApi;
     return useQuery({
       queryKey: ["campaignInfo"],
       queryFn: async () => {
         const response = await api.callReadOnlyFunction({
           contractAddress: FUNDRAISING_CONTRACT.address,
           contractName: FUNDRAISING_CONTRACT.name,
           functionName: "get-campaign-info",
           // ...
         });
         // Process and return data
       },
       refetchInterval: 10000, // Regular polling for updates
     });
   };
   ```

2. **Write Operations**: Executed through transactions that require wallet signing

   ```typescript
   // From useTransactionExecuter.tsx
   // Execute a transaction - different paths for Devnet vs Testnet/Mainnet
   if (isDevnetEnvironment()) {
     const { txid } = await executeContractCall(txOptions, devnetWallet);
     doSuccessToast(txid);
   } else {
     // Use @stacks/connect to prompt user's wallet for signing
     await request({}, "stx_callContract", params);
   }
   ```

3. **Middleware Layer**: Custom hooks and utilities abstract the complexities of blockchain operations
   - `useTransactionExecuter.tsx` - Manages transaction execution logic
   - `campaignQueries.ts` - Encapsulates read operations
   - `contract-utils.ts` - Provides utilities for contract interaction

### Transaction Lifecycle

1. **Initiation**: User triggers an action (e.g., making a donation)

   ```tsx
   // From DonationModal.tsx
   const handleSubmit = async () => {
     // Set up transaction options based on user input
     const txOptions = paymentMethod === "sbtc"
       ? getContributeSbtcTx(getStacksNetworkString(), {...})
       : getContributeStxTx(getStacksNetworkString(), {...});

     // Execute the transaction
     if (isDevnetEnvironment()) {
       const { txid } = await executeContractCall(txOptions, devnetWallet);
     } else {
       await openContractCall({
         ...txOptions,
         onFinish: (data) => { doSuccessToast(data.txId); },
         onCancel: () => { /* Handle cancellation */ },
       });
     }
   };
   ```

2. **Signing**: The transaction is signed either directly (in Devnet) or via wallet prompt (Testnet/Mainnet)

3. **Broadcasting**: Transaction is sent to the blockchain

   ```typescript
   // From contract-utils.ts
   const response = await broadcastTransaction({
     transaction,
     network: contractCallTxOptions.network,
   });
   ```

4. **Monitoring**: The UI updates to reflect pending state while transaction confirms

   - React Query's `refetchInterval` continually checks for updated campaign data

5. **Confirmation**: UI reflects the confirmed transaction outcome
   - Success/failure notifications via toast messages
   - Campaign data automatically refreshes

## 2. Key Technical Implementation Details

### Authentication and Wallet Connection

The application implements two distinct wallet connection strategies:

1. **Hiro Wallet Integration** (for Testnet/Mainnet):

   ```typescript
   // From HiroWalletProvider.tsx
   export const HiroWalletProvider: FC<ProviderProps> = ({ children }) => {
     const [isWalletConnected, setIsWalletConnected] = useState(false);

     const authenticate = useCallback(async () => {
       try {
         setIsWalletOpen(true);
         await connect(); // From @stacks/connect
         setIsWalletOpen(false);
         setIsWalletConnected(isConnected());
       } catch (error) {
         console.error("Connection failed:", error);
         setIsWalletOpen(false);
       }
     }, []);

     // Context exposes wallet state and methods
     return (
       <HiroWalletContext.Provider value={hiroWalletContext}>
         {children}
       </HiroWalletContext.Provider>
     );
   };
   ```

2. **Devnet Wallet Simulation** (for local development):
   - Simulates wallet functionality using private keys
   - Allows developers to test without real wallets
   - Automatically handles transaction signing

### Blockchain State Management

The application uses React Query for managing blockchain state, providing:

1. **Data Fetching & Caching**:

   ```typescript
   // From campaignQueries.ts
   export const useCampaignInfo = () => {
     return useQuery({
       queryKey: ["campaignInfo"],
       // Implementation details
       refetchInterval: 10000, // Regular polling
       retry: false,
       enabled: !!(currentPrices?.stx && currentPrices?.sbtc),
     });
   };
   ```

2. **Optimistic Updates**: UI updates immediately after transaction submission before blockchain confirmation

3. **Error Handling**: Comprehensive error states for failed queries/transactions

4. **Refetching Strategy**: Regular polling updates data as blockchain state changes

### Handling Asynchronous Operations

The application employs several patterns for handling asynchronous blockchain operations:

1. **Loading States**:

   ```tsx
   // From DonationModal.tsx
   const [isLoading, setIsLoading] = useState(false);

   const handleSubmit = async () => {
     setIsLoading(true);
     try {
       // Transaction logic
     } catch (e) {
       // Error handling
     } finally {
       setIsLoading(false);
     }
   };
   ```

2. **React Query's Built-in States**:

   ```tsx
   const { data, isLoading, isError, error } = useCampaignInfo();
   ```

3. **Callbacks for Transaction Events**:
   ```typescript
   // From DonationModal.tsx
   await openContractCall({
     ...txOptions,
     onFinish: (data) => {
       /* Handle success */
     },
     onCancel: () => {
       /* Handle cancellation */
     },
   });
   ```

### Caching Strategy

The application implements a tiered caching strategy:

1. **React Query Cache**: Primary cache layer for blockchain data

   - Configurable stale time
   - Automatic refetching
   - Cache invalidation on mutations

2. **Environment-based API Clients**:

   ```typescript
   // From stacks-api.ts
   const apiClients = {};

   export const getApi = (baseUrl) => {
     if (!apiClients[baseUrl]) {
       apiClients[baseUrl] = new Configuration({
         basePath: baseUrl,
       });
     }
     return new StacksApi(apiClients[baseUrl]);
   };
   ```

## 3. Developer Experience

### Codebase Structure

The codebase follows a well-organized structure that makes blockchain integration approachable:

```
front-end/
├── src/
│   ├── app/             # Next.js pages and routing
│   ├── components/      # React components
│   ├── constants/       # Config constants and contract addresses
│   ├── hooks/           # Custom React hooks for blockchain
│   └── lib/            # Utility functions for blockchain
│       ├── contract-utils.ts   # Contract interaction utilities
│       ├── stacks-api.ts       # API client setup
│       └── currency-utils.ts   # Currency conversion helpers
clarity/
└── contracts/
    └── fundraising.clar   # Clarity smart contract
```

This structure achieves:

1. **Separation of Concerns**: UI components are decoupled from blockchain logic
2. **Abstraction Layers**: Hooks and utilities abstract complex blockchain operations
3. **Reusability**: Utility functions promote code reuse
4. **Maintainability**: Clear organization makes code easier to understand/modify

### Blockchain Data in React Components

The application uses several patterns for handling blockchain data in components:

1. **Custom Hooks Pattern**:

   - Encapsulates blockchain logic in reusable hooks
   - Components consume hooks without needing to understand blockchain details

   ```tsx
   // In a component
   const { data: campaignInfo } = useCampaignInfo(prices);
   const { data: userDonation } = useExistingDonation(userAddress);
   ```

2. **Context for Wallet State**:

   - Global access to wallet state via React Context

   ```tsx
   // From a component
   const { isWalletConnected, mainnetAddress, testnetAddress } =
     useContext(HiroWalletContext);
   ```

3. **Component-specific Transaction Logic**:

   - Components like `DonationModal` use `useTransactionExecuter` hook

   ```tsx
   const transactionExecuter = useTransactionExecuter();

   const handleDonate = async () => {
     await transactionExecuter(
       txOptions,
       devnetWallet,
       "Thank you for your donation!",
       "Failed to process donation"
     );
   };
   ```

### Error Handling and User Feedback

The application implements a comprehensive approach to error handling:

1. **Toast Notifications**:

   ```tsx
   // From useTransactionExecuter.tsx
   const doSuccessToast = (txid: string) => {
     toast({
       title: successMessage,
       description: (
         <Flex direction="column" gap="4">
           <Box fontSize="xs">
             Transaction ID: <strong>{txid}</strong>
           </Box>
         </Flex>
       ),
       status: "success",
       isClosable: true,
       duration: 30000,
     });
   };
   ```

2. **Error Boundary Pattern**: Components gracefully degrade on errors

3. **Fallback States**: UI provides fallbacks when blockchain data is unavailable

4. **Transaction Lifecycle Feedback**:
   - Pending state while transactions are being processed
   - Success confirmation with transaction ID
   - Detailed error messages for failed transactions

### Environment Configuration

The application uses a flexible approach to environment configuration:

1. **Network Detection**:

   ```typescript
   // From contract-utils.ts
   export const isDevnetEnvironment = () =>
     process.env.NEXT_PUBLIC_STACKS_NETWORK === "devnet";

   export const isTestnetEnvironment = () =>
     process.env.NEXT_PUBLIC_STACKS_NETWORK === "testnet";

   export const isMainnetEnvironment = () =>
     process.env.NEXT_PUBLIC_STACKS_NETWORK === "mainnet";
   ```

2. **API Configuration**:

   - Network-specific API endpoints
   - Automatic client configuration based on environment

3. **Contract Addresses**:

   ```typescript
   // From contracts.ts
   export const FUNDRAISING_CONTRACT = {
     name: "fundraising",
     // Different addresses for different networks
     address: isTestnetEnvironment()
       ? process.env.NEXT_PUBLIC_CONTRACT_DEPLOYER_TESTNET_ADDRESS
       : isMainnetEnvironment()
       ? process.env.NEXT_PUBLIC_CONTRACT_DEPLOYER_MAINNET_ADDRESS
       : "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
   };
   ```

4. **Environment Variables**:
   - `.env` files for different environments
   - Clear documentation on required variables

## 4. Specific Stacks/Bitcoin Integration Points

### Clarity Contract Call Structure

The application implements a structured approach to Clarity contract calls:

1. **Function Argument Preparation**:

   ```typescript
   // From campaign-utils.ts
   export const getContributeStxTx = (network, { address, amount }) => {
     return {
       contractAddress: FUNDRAISING_CONTRACT.address,
       contractName: FUNDRAISING_CONTRACT.name,
       functionName: "donate-stx",
       functionArgs: [uintCV(amount)],
       network: getStacksNetwork(network),
       // Additional options
     };
   };
   ```

2. **Transaction Execution**:

   ```typescript
   // From contract-utils.ts
   export const executeContractCall = async (
     txOptions: ContractCallRegularOptions,
     currentWallet: DevnetWallet | null
   ) => {
     // Prepare wallet and transaction options
     const transaction = await makeContractCall(contractCallTxOptions);
     const response = await broadcastTransaction({
       transaction,
       network: contractCallTxOptions.network,
     });
     // Handle response
   };
   ```

3. **Read-Only Function Calls**:
   ```typescript
   // From campaignQueries.ts
   const response = await api.callReadOnlyFunction({
     contractAddress: FUNDRAISING_CONTRACT.address,
     contractName: FUNDRAISING_CONTRACT.name,
     functionName: "get-campaign-info",
     readOnlyFunctionArgs: {
       sender: FUNDRAISING_CONTRACT.address,
       arguments: [],
     },
   });
   ```

### Bitcoin-Specific Considerations

1. **sBTC Handling**:

   - Support for both STX and sBTC donations
   - Different transaction paths for each currency

   ```typescript
   // From DonationModal.tsx
   const txOptions =
     paymentMethod === "sbtc"
       ? getContributeSbtcTx(getStacksNetworkString(), {
           address: currentWalletAddress,
           amount: Math.round(btcToSats(usdToSbtc(amount, prices?.sbtc))),
         })
       : getContributeStxTx(getStacksNetworkString(), {
           address: currentWalletAddress,
           amount: Math.round(Number(stxToUstx(usdToStx(amount, prices?.stx)))),
         });
   ```

2. **Currency Conversion Utilities**:

   ```typescript
   // From currency-utils.ts
   export const btcToSats = (btc: number) => Math.floor(btc * 100000000);
   export const satsToSbtc = (sats: number) => sats / 100000000;
   export const usdToSbtc = (usd: number, price: number) => usd / price;
   ```

3. **Bitcoin Block Height Tracking**:
   - Campaign duration is tracked in Bitcoin blocks, not Stacks blocks
   ```clarity
   ;; From fundraising.clar
   (define-constant default-duration u4320) ;; Duration in *Bitcoin* blocks
   (asserts! (< burn-block-height (+ (var-get campaign-start) (var-get campaign-duration)))
             err-campaign-ended)
   ```

### Cross-Chain Functionality

The application demonstrates cross-chain functionality through:

1. **sBTC Integration**:

   - sBTC is a wrapped Bitcoin on Stacks
   - The contract handles sBTC token transfers

   ```clarity
   ;; From fundraising.clar
   (try! (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer
     amount
     contract-caller
     (as-contract tx-sender)
     none))
   ```

2. **Bitcoin Anchoring**:

   - Stacks is anchored to Bitcoin via Proof of Transfer (PoX)
   - Transaction finality is ultimately secured by Bitcoin

3. **Multi-asset Support**:
   - UI allows user to choose between STX and sBTC for donations
   - Backend handles different asset types and conversion rates

## Conclusion

This fundraising DApp demonstrates a well-architected approach to Bitcoin and Stacks blockchain integration with a modern web frontend. The architecture provides:

1. **Clear separation of concerns** between UI and blockchain logic
2. **Abstraction layers** that hide complexity from UI components
3. **Flexible environment configuration** for different deployment scenarios
4. **Robust error handling** and user feedback for blockchain operations
5. **Cross-chain functionality** leveraging both Stacks and Bitcoin

The codebase structure and patterns provide an excellent foundation for developers to build Web3 Bitcoin applications with approachable complexity and maintainable code.
