# BitHedge Liquidity Pool: Component Interaction Flows After CTA Button Clicks

## 1. Introduction

This document details the component interactions that take place within the BitHedge platform after a user clicks either "Activate Protection" or "Commit Capital" buttons. These are the critical Call-To-Action (CTA) buttons that trigger the policy creation and capital commitment processes respectively. This document complements the existing policy-creation-component-interaction-flows.md by focusing specifically on the liquidity pool interactions.

The BitHedge platform operates on a hybrid architecture with a combination of:

- On-chain smart contracts (Liquidity Pool Vault)
- Off-chain data management (Convex backend)
- Frontend user interfaces

Understanding these interactions is essential for developers working on the BitHedge platform to comprehend the complete workflow and dependencies between components.

## 2. "Commit Capital" Flow (Liquidity Provider)

### 2.1 Flow Diagram

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐         ┌─────────────────┐
│             │         │               │         │              │         │                 │
│  Frontend   │         │ Convex Backend│         │ Blockchain   │         │ Liquidity Pool  │
│  (UI)       │         │ (Liquidity Svc)│        │ Network      │         │ Vault Contract  │
│             │         │               │         │              │         │                 │
└──────┬──────┘         └───────┬───────┘         └──────┬───────┘         └────────┬────────┘
       │                        │                        │                          │
       │                        │                        │                          │
       │  1. Click "Commit      │                        │                          │
       │     Capital" button    │                        │                          │
       │                        │                        │                          │
       │  2. Call request       │                        │                          │
       │     CapitalCommitment  │                        │                          │
       │ ─────────────────────► │                        │                          │
       │                        │                        │                          │
       │                        │  3. Validate amount    │                          │
       │                        │     and token type     │                          │
       │                        │                        │                          │
       │                        │  4. Create pending     │                          │
       │                        │     transaction record │                          │
       │                        │                        │                          │
       │                        │  5. Prepare deposit    │                          │
       │                        │     transaction        │                          │
       │                        │                        │                          │
       │  6. Return transaction │                        │                          │
       │     for signing        │                        │                          │
       │ ◄─────────────────────┐│                        │                          │
       │                        │                        │                          │
       │  7. Display wallet     │                        │                          │
       │     confirm UI         │                        │                          │
       │                        │                        │                          │
       │  8. User signs and     │                        │                          │
       │     submits transaction│                        │                          │
       │ ───────────────────────────────────────────────►│                          │
       │                        │                        │                          │
       │                        │                        │  9. Execute contract call│
       │                        │                        │ ─────────────────────────►
       │                        │                        │                          │
       │                        │                        │ 10. Process deposit      │
       │                        │                        │     (transfer token)     │
       │                        │                        │ ◄─────────────────────────
       │                        │                        │                          │
       │                        │                        │ 11. Update on-chain state│
       │                        │                        │     (total balance)      │
       │                        │                        │ ◄─────────────────────────
       │                        │                        │                          │
       │                        │                        │ 12. Emit funds-deposited │
       │                        │                        │     event                │
       │                        │                        │ ◄─────────────────────────
       │                        │ 13. Process event      │                          │
       │                        │ ◄──────────────────────│                          │
       │                        │                        │                          │
       │                        │ 14. Update off-chain   │                          │
       │                        │     provider records   │                          │
       │                        │                        │                          │
       │ 15. Update UI with     │                        │                          │
       │     transaction status │                        │                          │
       │ ◄─────────────────────┐│                        │                          │
       │                        │                        │                          │
       │ 16. Display success UI │                        │                          │
       │     with new balance   │                        │                          │
       │                        │                        │                          │
```

### 2.2 Step-by-Step Description

1. **User Clicks "Commit Capital" (Frontend)**

   - User views the Provider Income Summary component and clicks the "Commit Capital" button
   - Button click handler captures commitment parameters (token type, amount, risk tier)

2. **Call requestCapitalCommitment Action (Frontend → Convex)**

   - Frontend calls the Convex action `requestCapitalCommitment` with parameters:
     ```typescript
     const result = await convex.action(
       api.liquidityPool.capitalManagement.requestCapitalCommitment,
       {
         token: selectedToken, // "STX" or "sBTC"
         amount: commitmentAmount,
         tier: selectedRiskTier,
       }
     );
     ```

3. **Parameter Validation (Convex)**

   - Convex validates commitment parameters in `capitalManagement.ts`:
     - Verifies token type is supported
     - Confirms amount meets minimum requirement
     - Checks that user is authenticated

4. **Create Pending Transaction Record (Convex)**

   - Convex creates a pending transaction record in the database via `createPendingPoolTransaction`
   - Sets status to "PENDING"
   - Records token, amount, provider address, timestamp

5. **Prepare Deposit Transaction (Convex)**

   - Calls blockchain integration layer to prepare the transaction:
     ```typescript
     // For STX
     const txResult = await createSTXDepositTransaction(provider, amount);
     // For sBTC
     const txResult = await createSBTCDepositTransaction(provider, amount);
     ```
   - Transaction preparation includes:
     - Building the contract function call (deposit-stx or deposit-sbtc)
     - Setting parameters (amount, provider address)

6. **Return Transaction for Signing (Convex → Frontend)**

   - Convex returns the prepared transaction and pending transaction ID:
     ```typescript
     return {
       pendingTxId, // Reference for status tracking
       txId, // Blockchain transaction ID
       transaction, // Transaction object for signing
       amount,
       token,
     };
     ```

7. **Display Wallet Confirm UI (Frontend)**

   - Frontend shows a confirmation modal with transaction details
   - Formats amount with token symbol
   - Displays estimated gas costs

8. **User Signs and Submits Transaction (Frontend → Blockchain)**

   - Frontend prompts wallet to sign the transaction (via Connect Kit)
   - User approves transaction in their wallet UI
   - Signed transaction is submitted to the blockchain
   - Frontend starts polling for transaction status updates

9. **Execute Contract Call (Blockchain → Contract)**

   - Blockchain network processes the transaction
   - Transaction calls the appropriate function in Liquidity Pool Vault:
     - `deposit-stx` for STX deposits
     - `deposit-sbtc` for sBTC deposits

10. **Process Deposit (Contract)**

    - Contract receives token transfer from user
    - For STX: Uses built-in stacks transfer functionality
    - For sBTC: Uses SIP-010 transfer function

11. **Update On-Chain State (Contract)**

    - Contract updates the total pool balance for the token type
    - Increments the total deposited amount
    - Updates accounting of available balance for allocations

12. **Emit Event (Contract → Blockchain)**

    - Contract emits a "funds-deposited" event with details:
      - Depositor address
      - Token type (STX/sBTC)
      - Amount deposited
      - Timestamp

13. **Process Event (Blockchain → Convex)**

    - Convex event listener detects the "funds-deposited" event
    - `blockchainIntegration.ts` processes the event:
      ```typescript
      async function onFundsDeposited(event) {
        const { depositor, amount, token } = event.data;
        await recordProviderDepositCompletion(depositor, amount, token);
      }
      ```

14. **Update Off-Chain Provider Records (Convex)**

    - `recordProviderDepositCompletion` updates provider balance:
      - Increases provider's balance record
      - Updates pending transaction status to "CONFIRMED"
      - Updates pool capacity and risk metrics
      - Recalculates provider's risk tier assignment

15. **Update UI with Transaction Status (Convex → Frontend)**

    - Frontend polls transaction status using `getTransactionStatus` query
    - When status changes to "CONFIRMED", UI is updated

16. **Display Success UI (Frontend)**
    - Frontend shows success notification
    - Updates provider dashboard with new balance
    - Updates pool statistics and capacity indicators
    - Enables withdrawal options based on new balance

## 3. "Activate Protection" Flow (Liquidity Pool Perspective)

### 3.1 Flow Diagram

```
┌─────────────┐      ┌───────────────┐      ┌─────────────────┐      ┌────────────────┐      ┌─────────────────┐
│             │      │               │      │                 │      │                │      │                 │
│  Frontend   │      │ Convex Backend│      │ Policy Registry │      │ Liquidity Pool │      │ Policy Owner    │
│  (UI)       │      │ (Policy Svc)  │      │ Contract        │      │ Vault Contract │      │ (User Wallet)   │
│             │      │               │      │                 │      │                │      │                 │
└──────┬──────┘      └───────┬───────┘      └────────┬────────┘      └───────┬────────┘      └────────┬────────┘
       │                     │                       │                       │                        │
       │                     │                       │                       │                        │
       │  1. Click "Activate │                       │                       │                        │
       │     Protection"     │                       │                       │                        │
       │                     │                       │                       │                        │
       │  2. Call createPolicy │                       │                       │                        │
       │ ────────────────────►                       │                       │                        │
       │                     │                       │                       │                        │
       │                     │  3. Generate policy   │                       │                        │
       │                     │     parameters        │                       │                        │
       │                     │                       │                       │                        │
       │                     │  4. Allocate capital  │                       │                        │
       │                     │     from providers    │                       │                        │
       │                     │                       │                       │                        │
       │                     │  5. Calculate premium │                       │                        │
       │                     │     distribution      │                       │                        │
       │                     │                       │                       │                        │
       │                     │  6. Prepare policy    │                       │                        │
       │                     │     creation TX       │                       │                        │
       │                     │                       │                       │                        │
       │  7. Return TX for   │                       │                       │                        │
       │     signing         │                       │                       │                        │
       │ ◄────────────────────                       │                       │                        │
       │                     │                       │                       │                        │
       │  8. User signs and  │                       │                       │                        │
       │     submits TX      │                       │                       │                        │
       │ ────────────────────────────────────────────►                       │                        │
       │                     │                       │                       │                        │
       │                     │                       │  9. Create policy     │                       │                        │
       │                     │                       │     on-chain          │                       │                        │
       │                     │                       │                       │                       │                        │
       │                     │                       │ 10. Request collateral│                       │                        │
       │                     │                       │    allocation         │                       │                        │
       │                     │                       │ ──────────────────────►                      │                        │
       │                     │                       │                       │                      │                        │
       │                     │                       │                       │ 11. Lock collateral  │                        │
       │                     │                       │                       │    for policy        │                        │
       │                     │                       │                       │                      │                        │
       │                     │                       │                       │ 12. Record provider  │                        │
       │                     │                       │                       │    allocations       │                        │
       │                     │                       │                       │                      │                        │
       │                     │                       │ 13. Policy creation   │                      │                        │
       │                     │                       │    event emitted      │                      │                        │
       │                     │                       │ ────────────────────── │                      │
       │                     │                       │                       │ 14. Collateral locked│
       │                     │                       │                       │    event emitted     │
       │                     │ 15. Process events    │ ◄───────────────────── │                      │
       │                     │ ◄──────────────────────                       │                      │
       │                     │                       │                       │                      │
       │                     │ 16. Update off-chain  │                       │                      │
       │                     │    allocation records │                       │                      │
       │                     │                       │                       │                      │
       │                     │ 17. Distribute premium│                       │                      │
       │                     │    to providers       │                       │                      │
       │                     │ ──────────────────────────────────────────────►                      │
       │                     │                       │                       │                      │
       │                     │                       │                       │ 18. Record premium   │
       │                     │                       │                       │    distributions     │
       │                     │                       │                       │                      │
       │                     │                       │                       │ 19. Emit premium     │
       │                     │                       │                       │    distribution event│
       │                     │                       │                       │ ◄───────────────────── │
       │                     │ 20. Process premium   │                       │                      │
       │                     │    distribution event │                       │                      │
       │                     │ ◄────────────────────────────────────────────── │                      │
       │                     │                       │                       │                      │
       │                     │ 21. Update provider   │                       │                      │
       │                     │    premium balances   │                       │                      │
       │                     │                       │                       │                      │
       │ 22. Update UI with  │                       │                       │                      │
       │    policy status    │                       │                       │                      │
       │ ◄────────────────────                       │                       │                      │
       │                     │                       │                       │                      │
```

### 3.2 Step-by-Step Description

1. **User Clicks "Activate Protection" (Frontend)**

   - User views the Policy Summary component and clicks the "Activate Protection" button
   - Button click handler captures policy parameters (amount, premium, duration, etc.)

2. **Call createPolicy Action (Frontend → Convex)**

   - Frontend calls Convex `createPolicy` action with parameters:
     ```typescript
     const result = await convex.action(api.policyRegistry.createPolicy, {
       quoteId: selectedQuote.id,
       token: selectedToken,
       // Additional policy parameters
     });
     ```

3. **Generate Policy Parameters (Convex)**

   - Policy service generates policy parameters based on quote
   - Includes premium amount, protection amount, duration, etc.

4. **Allocate Capital from Providers (Convex)**

   - Policy service calls Liquidity Pool's `allocateCapitalForPolicy` action:
     ```typescript
     const allocation = await ctx.runAction(
       internal.liquidityPool.policyLifecycle.allocateCapitalForPolicy,
       {
         policyId: policyId,
         amount: requiredCollateral,
         token: policyToken,
         insuredAmount: protectionAmount,
         premiumAmount: premiumAmount,
       }
     );
     ```
   - `allocateCapitalForPolicy` performs the following:
     - Determines eligible providers with available balance
     - Calculates allocation strategy across providers
     - Creates allocation records in the database
     - Updates provider balance records (reducing available balance)

5. **Calculate Premium Distribution (Convex)**

   - Calculates premium shares based on allocation percentages
   - Records premium distribution plan for providers

6. **Prepare Policy Creation Transaction (Convex)**

   - Prepares blockchain transaction to create policy on-chain
   - Returns transaction for signing

7. **Return Transaction for Signing (Convex → Frontend)**

   - Convex returns the prepared transaction and tracking information

8. **User Signs and Submits Transaction (Frontend → Blockchain)**

   - Frontend prompts wallet to sign the transaction
   - Signed transaction is submitted to the blockchain

9. **Create Policy On-Chain (Policy Registry Contract)**

   - Policy Registry contract creates the policy record on-chain
   - Records buyer, premium, protection details

10. **Request Collateral Allocation (Policy Registry → Liquidity Pool)**

    - Policy Registry contract calls Liquidity Pool Vault's `lock-collateral` function
    - Provides policy ID, token type, and required collateral amount

11. **Lock Collateral (Liquidity Pool)**

    - Contract verifies policy registry authorization
    - Updates locked collateral tracking
    - Associates locked collateral with policy ID

12. **Record Provider Allocations (Liquidity Pool)**

    - Liquidity Pool Vault records provider allocations on-chain if needed
    - Note: Detailed provider-specific tracking is primarily in Convex

13. **Policy Creation Event Emitted (Policy Registry → Blockchain)**

    - Policy Registry emits "policy-created" event with details

14. **Collateral Locked Event Emitted (Liquidity Pool → Blockchain)**

    - Liquidity Pool Vault emits "collateral-locked" event
    - Includes policy ID, token type, amount

15. **Process Events (Blockchain → Convex)**

    - Convex detects both policy creation and collateral lock events
    - Links these events to pending transaction records

16. **Update Off-Chain Allocation Records (Convex)**

    - Updates allocation status to "CONFIRMED"
    - Finalizes provider balance records with locked amounts
    - Updates pool metrics and capacity

17. **Distribute Premium to Providers (Convex → Liquidity Pool)**

    - After policy activation, premium is distributed to providers
    - Convex calls `distributePolicyPremium` action:
      ```typescript
      const distributionResult = await ctx.runAction(
        internal.liquidityPool.premiumOperations.distributePolicyPremium,
        {
          policyId: policyId,
          amount: premiumAmount,
          token: policyToken,
        }
      );
      ```
    - For immediate premiums, this happens right after policy creation
    - For periodic premiums, occurs on scheduled intervals

18. **Record Premium Distributions (Liquidity Pool)**

    - Liquidity Pool Vault records premium distributions
    - Updates on-chain premium tracking

19. **Emit Premium Distribution Event (Liquidity Pool → Blockchain)**

    - Contract emits "premium-distributed" event
    - Includes policy ID, total premium, and distribution timestamp

20. **Process Premium Distribution Event (Blockchain → Convex)**

    - Convex detects "premium-distributed" event
    - Processes premium distribution information

21. **Update Provider Premium Balances (Convex)**

    - Updates provider premium balances in database
    - Records premium earned from specific policy
    - Updates yield calculations and analytics

22. **Update UI with Policy Status (Convex → Frontend)**
    - Frontend polls for policy status updates
    - Shows success notification and policy details
    - Updates dashboard with active policy information

## 4. Cross-Component Coordination Details

### 4.1 Provider Selection During Allocation

When a policy is created, the liquidity pool must select which providers will back it with their capital. This is a critical process that requires coordination between several components:

1. **Eligible Provider Identification**

   - `policyLifecycle.ts` identifies eligible providers based on:
     - Available balance sufficient for allocation
     - Provider preferences matching policy needs
     - Risk tier compatibility

2. **Allocation Strategy Algorithm**

   - The `determineAllocationStrategy` function uses a proportional allocation approach:

     ```typescript
     async function determineAllocationStrategy(
       eligibleProviders: EligibleProvider[],
       totalRequiredAmount: number,
       token: string
     ): Promise<AllocationToMake[]> {
       // Sort providers by available balance (descending)
       const sortedProviders = [...eligibleProviders].sort(
         (a, b) => b.availableBalance - a.availableBalance
       );

       // Initial proportional allocation
       const allocations: AllocationToMake[] = [];
       let remainingAmount = totalRequiredAmount;
       const totalAvailable = sortedProviders.reduce(
         (sum, p) => sum + p.availableBalance,
         0
       );

       // First pass: allocate proportionally based on available balance
       for (const provider of sortedProviders) {
         const proportion = provider.availableBalance / totalAvailable;
         let allocationAmount = Math.floor(totalRequiredAmount * proportion);
         allocationAmount = Math.min(
           allocationAmount,
           provider.availableBalance,
           remainingAmount
         );

         if (allocationAmount > 0) {
           allocations.push({
             provider: provider.provider,
             amount: allocationAmount,
           });
           remainingAmount -= allocationAmount;
         }
       }

       // Second pass: distribute any remaining amount
       if (remainingAmount > 0) {
         // Additional logic to distribute remaining amount...
       }

       return allocations;
     }
     ```

3. **Allocation Record Creation**
   - Creates allocation records for each selected provider
   - Updates provider balances to reflect committed capital
   - Logs allocation transactions for tracking

### 4.2 Premium Distribution

Premium distribution is another critical cross-component process that occurs after policy creation:

1. **Premium Distribution Calculation**

   - Premium is distributed proportionally to providers based on their allocation percentage:
     ```typescript
     const distributionsToCreate = allocations.map((allocation) => ({
       provider: allocation.provider,
       token: args.token,
       allocationId: allocation._id,
       premiumAmount: (args.amount * allocation.allocation_percentage) / 100,
       allocationPercentage: allocation.allocation_percentage,
     }));
     ```

2. **Provider Premium Updates**

   - Updates each provider's premium balance
   - Records premium distribution for historical tracking
   - Updates yield metrics for provider dashboard

3. **Blockchain Synchronization**
   - For some premium distributions, blockchain transactions may be created
   - Events are emitted and tracked to ensure state consistency

### 4.3 Settlement Flow

When a policy is exercised, the settlement flow involves coordination between several components:

1. **Settlement Request**

   - Policy Registry initiates settlement process
   - Convex processes the claim and determines settlement amount

2. **Provider Impact Calculation**

   - Each provider's loss is calculated based on their allocation percentage
   - Settlement impact is recorded against each provider's balance

3. **Settlement Payment**
   - Liquidity Pool Vault processes payment to policy owner
   - Updates provider balances to reflect settlement

## 5. Error Handling and Recovery

The liquidity pool implements robust error handling and recovery mechanisms:

1. **Transaction Failure Handling**

   - If blockchain transactions fail, pending transactions are marked as FAILED
   - Error details are recorded for troubleshooting
   - Recovery options are presented to users where applicable

2. **Asynchronous Processing**

   - Long-running operations use asynchronous processing
   - Transaction status tracking allows for monitoring and recovery
   - Background jobs handle reconciliation and state verification

3. **State Consistency**
   - Regular reconciliation jobs ensure on-chain and off-chain state consistency
   - Automatic correction of detected discrepancies when possible
   - Alert system for manual intervention when needed

## 6. Transaction Tracking

Both CTA buttons ("Activate Protection" and "Commit Capital") initiate transactions that need to be tracked:

1. **Transaction Creation**

   - Pending transaction record is created in the database
   - Initial status is set to "PENDING"
   - All transaction details are recorded for reference

2. **Status Tracking**

   - Transaction status is updated as it progresses:
     - PENDING: Initial state
     - SUBMITTED: Transaction sent to blockchain
     - CONFIRMED: Blockchain confirmed transaction
     - FAILED: Transaction failed on blockchain
   - Status checks occur via background jobs and event monitoring

3. **Frontend Integration**
   - Frontend polls transaction status for UI updates
   - Displays appropriate feedback based on status changes
   - Handles error recovery options when failures occur

## 7. Conclusion

The liquidity pool component plays a crucial role in both the "Activate Protection" and "Commit Capital" flows in the BitHedge platform. It manages:

1. **Capital Management**: Tracking provider deposits, allocations, and withdrawals
2. **Allocation Strategy**: Determining how to distribute policy risk across providers
3. **Premium Distribution**: Handling the fair distribution of premiums to providers
4. **Settlement Processing**: Managing the impact of policy settlements on providers

These processes are implemented through a hybrid architecture where:

- On-chain contracts handle secure funds custody and core financial operations
- Convex backend provides rich provider-specific accounting and business logic
- Frontend components deliver a responsive and informative user experience

The coordination between these components is primarily event-driven, with blockchain events triggering off-chain state updates, ensuring a consistent and reliable system state.
