# BitHedge: Convex Backend Implementation Plan

## Overview

This document outlines the implementation of BitHedge's backend using Convex as a Backend-as-a-Service solution. This approach replaces the previously planned microservices architecture with a more streamlined solution that leverages Convex's real-time database, serverless functions, and built-in React integration. The plan focuses on implementing all necessary backend functionality to support the smart contract system and frontend user experience for the hackathon MVP.

## Convex Implementation Architecture

Instead of building multiple separate services, we'll use Convex's unified platform to implement our backend needs:

```
┌─────────────────────────────────────────┐
│             React Frontend              │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│           Convex React SDK              │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│         Convex Backend Platform         │
├─────────────────┬─────────────────┬─────┴───────────┐
│  Convex Tables  │ Convex Functions│ Convex Actions  │
│ (Data Storage)  │ (Query Logic)   │ (Mutations)     │
└─────────────────┴─────────────────┴─────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│           Stacks Blockchain             │
│         Smart Contract System           │
└─────────────────────────────────────────┘
```

## 1. Convex Project Setup & Configuration

Initial tasks to set up the Convex project and configure its environment.

| Task ID | Description | Est. Hours | Status | Notes |
|---------|-------------|------------|--------|-------|
| CV-01 | Initialize Convex project | 1 | ⬜ | Create project and connect to GitHub repo |
| CV-02 | Configure authentication | 2 | ⬜ | Set up anonymous auth for wallet-based identity |
| CV-03 | Set up development environment | 1 | ⬜ | Local development configuration |
| CV-04 | Create environment variables | 1 | ⬜ | For contract addresses and external APIs |
| CV-05 | Configure deployment pipeline | 1 | ⬜ | Automatic deployment on push |
| CV-06 | Set up TypeScript configuration | 1 | ⬜ | Strong typing for functions and data |
| CV-07 | Create HTTP handler for external integrations | 1 | ⬜ | For price feeds and external APIs |
| CV-08 | Set up file storage configuration (if needed) | 1 | ⬜ | For larger data needs |
| CV-09 | Configure CORS and security settings | 1 | ⬜ | Ensure secure access |
| CV-10 | Document project structure | 1 | ⬜ | Clear organization guidelines |

**Implementation Priorities:**
1. First: CV-01, CV-03, CV-06 (Basic project setup)
2. Second: CV-02, CV-04 (Auth and environment)
3. Third: CV-07, CV-09 (External connections)
4. Last: CV-05, CV-08, CV-10 (Advanced config and docs)

## 2. Convex Data Schema Implementation

Defining the data models and tables for the BitHedge system.

| Task ID | Description | Est. Hours | Status | Notes |
|---------|-------------|------------|--------|-------|
| DS-01 | Define `policies` table schema | 2 | ⬜ | Core policy data structure |
| DS-02 | Create `users` table schema | 1 | ⬜ | User profile and preferences |
| DS-03 | Implement `priceHistory` table | 1 | ⬜ | Track BTC price history |
| DS-04 | Define `parameters` table | 1 | ⬜ | System parameters and config |
| DS-05 | Create `transactions` table | 1 | ⬜ | Track on-chain transaction status |
| DS-06 | Implement `notifications` table | 1 | ⬜ | User alert system |
| DS-07 | Define `activityLogs` table | 1 | ⬜ | System activity tracking |
| DS-08 | Create indexing strategies | 2 | ⬜ | Optimize query performance |
| DS-09 | Define access control rules | 2 | ⬜ | Security permissions system |
| DS-10 | Implement data validation | 2 | ⬜ | Ensure data integrity |

**Implementation Priorities:**
1. First: DS-01, DS-03, DS-05 (Core policy and price data)
2. Second: DS-02, DS-04 (User data and parameters)
3. Third: DS-08, DS-09 (Performance and security)
4. Last: DS-06, DS-07, DS-10 (Advanced features)

**Example Schema Implementation:**

```typescript
// Example schema for policies table
export default defineSchema({
  policies: defineTable({
    owner: v.string(),
    protectedValue: v.number(),
    protectedAmount: v.number(),
    expirationTime: v.number(),
    premium: v.number(),
    policyType: v.string(),
    status: v.number(), // 0=active, 1=exercised, 2=expired, 3=canceled
    creationTime: v.number(),
    transactionId: v.optional(v.string()),
    contractPolicyId: v.optional(v.number()),
    exercisePrice: v.optional(v.number()),
    exerciseTime: v.optional(v.number()),
  })
    .index("by_owner", ["owner"])
    .index("by_status", ["status"])
    .index("by_expiration", ["expirationTime"]),
  
  priceHistory: defineTable({
    timestamp: v.number(),
    price: v.number(),
    source: v.string(),
  })
    .index("by_timestamp", ["timestamp"]),
  
  // Additional tables would follow similar patterns
});
```

## 3. Blockchain Integration Functions

Functions to interact with Stacks blockchain and smart contracts.

| Task ID | Description | Est. Hours | Status | Notes |
|---------|-------------|------------|--------|-------|
| BI-01 | Implement contract address configuration | 1 | ⬜ | Manage contract addresses |
| BI-02 | Create transaction building helpers | 3 | ⬜ | Generate contract transactions |
| BI-03 | Implement blockchain event monitoring | 4 | ⬜ | Listen for contract events |
| BI-04 | Create policy registration function | 3 | ⬜ | Record policies in Convex |
| BI-05 | Implement transaction status tracking | 3 | ⬜ | Monitor pending transactions |
| BI-06 | Create contract read functions | 2 | ⬜ | Query contract state |
| BI-07 | Implement policy activation helpers | 3 | ⬜ | Exercise protection transactions |
| BI-08 | Create expiration monitoring | 2 | ⬜ | Track approaching expirations |
| BI-09 | Implement policy indexer from blockchain | 4 | ⬜ | Sync contract state to Convex |
| BI-10 | Create scheduled blockchain sync | 3 | ⬜ | Keep Convex data in sync |

**Implementation Priorities:**
1. First: BI-01, BI-02, BI-06 (Basic contract interaction)
2. Second: BI-03, BI-04, BI-05 (Event monitoring and tracking)
3. Third: BI-07, BI-08 (Policy lifecycle)
4. Last: BI-09, BI-10 (Advanced sync)

**Example Implementation:**

```typescript
// Example blockchain integration function
export const getTransactionUrl = (txId: string): string => {
  return `https://explorer.stacks.co/txid/${txId}?chain=testnet`;
};

// Helper to build contract call for policy creation
export const buildPolicyCreationTx = async (
  { protectedValue, protectedAmount, expirationDays, policyType }: PolicyCreationParams
): Promise<{ 
  txOptions: ContractCallOptions,
  estimatedFee: number 
}> => {
  const CONTRACT_ADDRESS = process.env.POLICY_REGISTRY_ADDRESS;
  const CONTRACT_NAME = 'policy-registry';
  
  // Convert to blockchain units
  const protectedValueMicro = Math.round(protectedValue * 1000000);
  const protectedAmountSats = Math.round(protectedAmount * 100000000);
  const expirationBlocks = daysToBlocks(expirationDays);
  
  // Create transaction options
  const txOptions = {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'create-protection-policy',
    functionArgs: [
      uintCV(protectedValueMicro),
      uintCV(expirationBlocks),
      uintCV(protectedAmountSats),
      stringAsciiCV(policyType),
    ],
    network: new StacksTestnet(),
    // Other options as needed
  };
  
  // Estimate fee (implementation depends on your approach)
  const estimatedFee = await estimateTransactionFee(txOptions);
  
  return { txOptions, estimatedFee };
};
```

## 4. Premium Calculator Implementation

Functions to calculate option premiums and simulate protection outcomes.

| Task ID | Description | Est. Hours | Status | Notes |
|---------|-------------|------------|--------|-------|
| PC-01 | Implement Black-Scholes calculator | 4 | ⬜ | Core options pricing algorithm |
| PC-02 | Create Bitcoin-specific adjustments | 3 | ⬜ | BTC volatility considerations |
| PC-03 | Implement premium estimation query | 2 | ⬜ | Frontend premium calculation |
| PC-04 | Create protection simulation function | 3 | ⬜ | "What-if" scenario generator |
| PC-05 | Implement outcome metrics calculator | 2 | ⬜ | Break-even, max benefit, etc. |
| PC-06 | Create volatility calculation function | 3 | ⬜ | Historical volatility analysis |
| PC-07 | Implement yield calculation for providers | 2 | ⬜ | Income strategy calculations |
| PC-08 | Create premium factors breakdown | 2 | ⬜ | Explain premium components |
| PC-09 | Implement batch calculation for portfolios | 2 | ⬜ | Calculate across multiple policies |
| PC-10 | Create premium change monitoring | 2 | ⬜ | Track premium trends |

**Implementation Priorities:**
1. First: PC-01, PC-03 (Basic premium calculation)
2. Second: PC-02, PC-04, PC-05 (Protection simulation)
3. Third: PC-06, PC-07 (Advanced calculations)
4. Last: PC-08, PC-09, PC-10 (Enhanced features)

**Example Implementation:**

```typescript
// Simplified Black-Scholes implementation for Convex
export const query.calculatePremium = query(
  async ({ 
    db 
  }, {
    protectedValue,
    protectedAmount,
    expirationDays,
    policyType
  }: PremiumParams): Promise<PremiumResult> => {
    
    // Get current BTC price
    const currentPrice = await getCurrentBtcPrice(db);
    
    // Calculate time factor (in years)
    const timeYears = expirationDays / 365;
    
    // Calculate moneyness (how far from current price)
    const moneyness = policyType === "PUT" 
      ? (currentPrice - protectedValue) / currentPrice 
      : (protectedValue - currentPrice) / currentPrice;
    
    // Simplified algorithm for hackathon
    // Real implementation would use full Black-Scholes
    const baseRate = 0.01; // 1% base for 30-day ATM
    const volatilityFactor = await getVolatilityFactor(db);
    const timeFactor = Math.sqrt(timeYears) * 1.5;
    const moneynessFactor = policyType === "PUT"
      ? Math.max(0.5, 1 - moneyness * 2)
      : Math.max(0.5, 1 - moneyness * 2);
    
    // Calculate premium percentage
    const premiumRate = baseRate * volatilityFactor * timeFactor * moneynessFactor;
    
    // Calculate premium amount
    const premiumAmount = protectedAmount * currentPrice * premiumRate;
    
    // Calculate various metrics
    const maxBenefit = policyType === "PUT"
      ? protectedAmount * (protectedValue - 0) // Assuming price could go to 0
      : protectedAmount * (Infinity - protectedValue); // Unlimited upside
    
    const maxLoss = premiumAmount;
    
    const breakEvenPrice = policyType === "PUT"
      ? protectedValue - (premiumAmount / protectedAmount)
      : protectedValue + (premiumAmount / protectedAmount);
    
    return {
      premiumAmount,
      premiumPercentage: premiumRate * 100,
      annualizedYield: premiumRate * (365 / expirationDays) * 100,
      maxBenefit,
      maxLoss,
      breakEvenPrice,
      currentPrice
    };
  }
);
```

## 5. Oracle and Price Feed System

Functions to manage Bitcoin price data for the system.

| Task ID | Description | Est. Hours | Status | Notes |
|---------|-------------|------------|--------|-------|
| OF-01 | Implement price feed API client | 3 | ⬜ | Connect to exchange APIs |
| OF-02 | Create price aggregation function | 3 | ⬜ | Combine multiple sources |
| OF-03 | Implement scheduled price updates | 2 | ⬜ | Regular price collection |
| OF-04 | Create price history query | 1 | ⬜ | Retrieve historical prices |
| OF-05 | Implement price change monitoring | 2 | ⬜ | Track significant moves |
| OF-06 | Create outlier detection | 2 | ⬜ | Filter anomalous prices |
| OF-07 | Implement on-chain oracle updates | 3 | ⬜ | Push prices to contract oracle |
| OF-08 | Create volatility calculation | 2 | ⬜ | Historical volatility metrics |
| OF-09 | Implement price alert triggers | 2 | ⬜ | Notify on threshold crossing |
| OF-10 | Create dashboard data preparation | 2 | ⬜ | Format price data for UI |

**Implementation Priorities:**
1. First: OF-01, OF-03, OF-04 (Basic price feed)
2. Second: OF-02, OF-07 (Aggregation and contract updates)
3. Third: OF-05, OF-08 (Market monitoring)
4. Last: OF-06, OF-09, OF-10 (Enhanced features)

**Example Implementation:**

```typescript
// Schedule a regular price update
export const scheduledPriceUpdate = internalAction(
  async (ctx) => {
    // Get prices from multiple exchanges
    const [binancePrice, coinbasePrice, krakenPrice] = await Promise.all([
      fetchBinancePrice(),
      fetchCoinbasePrice(),
      fetchKrakenPrice()
    ]);
    
    // Process and filter prices
    const prices = [binancePrice, coinbasePrice, krakenPrice].filter(Boolean);
    
    if (prices.length === 0) {
      throw new Error("No valid prices received from exchanges");
    }
    
    // Calculate median price to avoid outliers
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];
    
    // Store in Convex
    await ctx.runMutation(internal.prices.storePriceUpdate, {
      price: medianPrice,
      timestamp: Date.now(),
      sources: ['binance', 'coinbase', 'kraken'].filter((_, i) => Boolean(prices[i]))
    });
    
    // Check if on-chain oracle needs update
    const lastOracleUpdate = await ctx.runQuery(internal.blockchain.getLastOracleUpdate);
    const timeSinceUpdate = Date.now() - lastOracleUpdate.timestamp;
    const priceDifference = Math.abs(medianPrice - lastOracleUpdate.price) / lastOracleUpdate.price;
    
    // Update on-chain oracle if significant change or time passed
    if (timeSinceUpdate > 3600000 || priceDifference > 0.01) {
      await ctx.runAction(internal.blockchain.updateOraclePrice, {
        price: medianPrice
      });
    }
    
    // Schedule next update
    await scheduler.runAfter(5 * 60 * 1000, internal.prices.scheduledPriceUpdate);
  }
);
```

## 6. Policy Lifecycle Management

Functions to manage the lifecycle of protection policies.

| Task ID | Description | Est. Hours | Status | Notes |
|---------|-------------|------------|--------|-------|
| PL-01 | Implement policy query functions | 2 | ⬜ | Get policies with filtering |
| PL-02 | Create policy creation helpers | 3 | ⬜ | Assist with policy creation |
| PL-03 | Implement policy status monitoring | 3 | ⬜ | Track active/expired status |
| PL-04 | Create policy activation helpers | 3 | ⬜ | Support protection activation |
| PL-05 | Implement expiration handling | 2 | ⬜ | Process expired policies |
| PL-06 | Create renewal suggestion function | 2 | ⬜ | Recommend policy renewals |
| PL-07 | Implement notification triggers | 2 | ⬜ | Alert users of policy events |
| PL-08 | Create portfolio analysis function | 3 | ⬜ | Analyze user's policy portfolio |
| PL-09 | Implement policy history tracking | 2 | ⬜ | Record policy state changes |
| PL-10 | Create policy metrics calculation | 2 | ⬜ | Performance statistics |

**Implementation Priorities:**
1. First: PL-01, PL-02, PL-03 (Basic lifecycle management)
2. Second: PL-04, PL-05 (Activation and expiration)
3. Third: PL-07, PL-09 (Notifications and history)
4. Last: PL-06, PL-08, PL-10 (Advanced features)

**Example Implementation:**

```typescript
// Query to get user's policies
export const query.getUserPolicies = query(
  async ({ 
    db, 
    auth 
  }, {
    status,
    limit = 20,
    sortBy = "creationTime",
    sortDirection = "desc"
  }: PolicyQueryParams): Promise<PolicyWithMetrics[]> => {
    // Check authentication
    const identity = await auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }
    
    const owner = identity.tokenIdentifier;
    
    // Build query
    let policyQuery = db
      .query("policies")
      .withIndex("by_owner", (q) => q.eq("owner", owner));
    
    // Add status filter if provided
    if (status !== undefined) {
      policyQuery = policyQuery.filter((q) => q.eq(q.field("status"), status));
    }
    
    // Execute query with sorting
    const policies = await policyQuery
      .order(sortDirection === "asc" ? "asc" : "desc", sortBy)
      .take(limit);
    
    // Enhance with current metrics
    const currentPrice = await getCurrentBtcPrice(db);
    return await Promise.all(policies.map(async policy => {
      const metrics = calculatePolicyMetrics(policy, currentPrice);
      return {
        ...policy,
        ...metrics,
        daysRemaining: Math.max(0, Math.floor((policy.expirationTime - Date.now()) / (24 * 60 * 60 * 1000))),
        inMoney: policy.policyType === "PUT" 
          ? currentPrice < policy.protectedValue 
          : currentPrice > policy.protectedValue
      };
    }));
  }
);
```

## 7. Translation Layer Implementation

Functions to transform technical options concepts into insurance-based terminology.

| Task ID | Description | Est. Hours | Status | Notes |
|---------|-------------|------------|--------|-------|
| TL-01 | Implement terminology mapping system | 2 | ⬜ | Technical → User-friendly terms |
| TL-02 | Create persona-specific translation | 2 | ⬜ | Peter vs Irene terminology |
| TL-03 | Implement explanation generator | 2 | ⬜ | Generate concept explanations |
| TL-04 | Create user preference storage | 1 | ⬜ | Store terminology preferences |
| TL-05 | Implement progressive disclosure logic | 2 | ⬜ | Different detail levels |
| TL-06 | Create UI component suggestions | 2 | ⬜ | Match terms to UI components |
| TL-07 | Implement consistent term formatter | 2 | ⬜ | Format terms across app |
| TL-08 | Create terminology validation | 1 | ⬜ | Ensure consistency |
| TL-09 | Implement term search function | 1 | ⬜ | Find related terms |
| TL-10 | Create migration path for future terms | 1 | ⬜ | Add new terms over time |

**Implementation Priorities:**
1. First: TL-01, TL-02 (Basic translation system)
2. Second: TL-03, TL-07 (Term explanations and formatting)
3. Third: TL-04, TL-05 (User preferences)
4. Last: TL-06, TL-08, TL-09, TL-10 (Advanced features)

**Example Implementation:**

```typescript
// Query to get insurance-friendly terminology
export const query.getTerminology = query(
  async ({ 
    db, 
    auth 
  }, {
    persona = "protection", // "protection" or "income"
    technicalTerm,
    complexity = "standard" // "simple", "standard", "advanced"
  }: TerminologyParams): Promise<TerminologyResult> => {
    // Determine if we have user preferences
    const identity = await auth.getUserIdentity();
    let preferredTerminology = "balanced";
    
    if (identity) {
      const user = await db
        .query("users")
        .withIndex("by_identity", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
        .first();
      
      if (user?.terminologyPreference) {
        preferredTerminology = user.terminologyPreference;
      }
    }
    
    // Get terms mapping based on preferences and persona
    const termsMapping = getTermsMapping(preferredTerminology, persona);
    
    // Find the mapped term
    const mappedTerm = termsMapping[technicalTerm] || technicalTerm;
    
    // Get explanation based on complexity level
    const explanation = getTermExplanation(technicalTerm, complexity);
    
    return {
      originalTerm: technicalTerm,
      mappedTerm,
      explanation,
      relatedTerms: getRelatedTerms(technicalTerm),
      visualComponent: getVisualComponentName(technicalTerm)
    };
  }
);
```

## 8. Frontend Integration Components

Creating the necessary utilities for React frontend integration.

| Task ID | Description | Est. Hours | Status | Notes |
|---------|-------------|------------|--------|-------|
| FI-01 | Set up Convex React provider | 1 | ⬜ | Base integration with React |
| FI-02 | Create auth provider integration | 2 | ⬜ | Connect wallet auth to Convex |
| FI-03 | Implement policy query hooks | 2 | ⬜ | React hooks for policies |
| FI-04 | Create premium calculation hooks | 2 | ⬜ | Premium calculation integration |
| FI-05 | Implement transaction helpers | 3 | ⬜ | Contract transaction helpers |
| FI-06 | Create simulator integration hooks | 2 | ⬜ | Connect protection simulator |
| FI-07 | Implement policy creation flow | 3 | ⬜ | Connect protection center |
| FI-08 | Create dashboard data hooks | 2 | ⬜ | Portfolio visualization data |
| FI-09 | Implement notification hooks | 2 | ⬜ | Real-time alerts in UI |
| FI-10 | Create optimistic UI updates | 2 | ⬜ | Update UI before confirmation |

**Implementation Priorities:**
1. First: FI-01, FI-02, FI-03 (Basic connectivity)
2. Second: FI-04, FI-05 (Core functionality)
3. Third: FI-06, FI-07 (Key user flows)
4. Last: FI-08, FI-09, FI-10 (Enhanced experience)

**Example Implementation:**

```typescript
// Example React hook for policy creation
export function usePolicyCreation() {
  const createPolicyMutation = useMutation(api.policies.preparePolicyCreation);
  const recordPolicyMutation = useMutation(api.policies.recordPendingPolicy);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Function to create a new policy
  const createPolicy = async (params: PolicyCreationParams) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Step 1: Prepare the transaction with Convex
      const { txOptions, estimatedFee, policyId } = await createPolicyMutation({
        protectedValue: params.protectedValue,
        protectedAmount: params.protectedAmount,
        expirationDays: params.expirationDays,
        policyType: params.policyType
      });
      
      // Step 2: Sign and submit with wallet (using your wallet library)
      const txResult = await signAndSubmitTransaction(txOptions);
      
      // Step 3: Record the pending policy in Convex
      await recordPolicyMutation({
        policyId,
        transactionId: txResult.txId,
        status: "pending",
        ...params
      });
      
      return {
        policyId,
        transactionId: txResult.txId,
        txUrl: getTransactionUrl(txResult.txId)
      };
    } catch (err) {
      setError(err.message || "Failed to create policy");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    createPolicy,
    isLoading,
    error
  };
}
```

## Implementation Schedule Using Convex

This section provides a weekly breakdown of implementation tasks assuming full-time development.

### Week 1: Convex Foundation & Core Functions
- **Day 1-2:** CV-01, CV-03, CV-06, DS-01, DS-03 (Project setup & schema)
- **Day 3-4:** BI-01, BI-02, BI-06, PC-01, PC-03 (Contract integration & premium calc)
- **Day 5:** OF-01, OF-03, PL-01, PL-02 (Price feed & policy functions)

### Week 2: User Experience & Integration
- **Day 1-2:** FI-01, FI-02, FI-03, FI-04 (React integration)
- **Day 3-4:** BI-03, BI-04, PC-04, PL-03 (Event monitoring & simulation)
- **Day 5:** TL-01, TL-02, TL-03, CV-04 (Translation layer & environment)

### Week 3: Enhanced Features & Testing
- **Day 1-2:** BI-05, BI-07, PL-04, PL-05 (Transaction tracking & lifecycle)
- **Day 3-4:** FI-05, FI-06, FI-07, OF-02 (Transaction helpers & price aggregation)
- **Day 5:** BI-08, PC-05, FI-08 (Monitoring & metrics)

### Week 4: Refinement & Delivery
- **Day 1-2:** CV-05, CV-09, TL-07, FI-10 (Deployment & UX polish)
- **Day 3-4:** OF-07, PC-08, PL-07 (Oracle updates & notifications)
- **Day 5:** CV-10, BI-10, OF-10 (Documentation & final touches)

## Advantages of Using Convex

1. **Significantly Reduced Infrastructure Complexity**
   - No need to manage multiple microservices
   - Built-in database, caching, and real-time updates
   - Simplified deployment and operations

2. **Developer Productivity**
   - TypeScript support throughout
   - End-to-end type safety from database to frontend
   - Automatic code generation for type-safe queries

3. **Real-Time Capabilities**
   - Built-in real-time data synchronization
   - Live updates for policy status and prices
   - WebSocket-based pub/sub without additional setup

4. **Scalability**
   - Serverless architecture scales automatically
   - No need to manage infrastructure scaling
   - Handles spikes in usage during hackathon demo

5. **Rapid Implementation**
   - Faster development cycle for hackathon timeframe
   - Less boilerplate code compared to custom backend
   - Focus more on unique application logic rather than infrastructure

## Progress Tracking

Use the following format to track implementation progress:

```
[X] Completed
[P] In Progress
[ ] Not Started
```

Update the Status column in each task table as you progress.
