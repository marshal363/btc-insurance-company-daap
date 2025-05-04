# BitHedge Policy Settlement: Risk-Reward Tier Matching System

## 1. Introduction

The BitHedge platform enables Bitcoin holders to protect their assets against market volatility through options-based insurance policies, while also allowing capital providers to earn yield by backing these protection policies. Central to this ecosystem is the policy settlement system, which governs how protection requests from Protective Peter (PUT buyers) are matched with capital allocations from Income Irene (PUT sellers) based on risk-reward tiers.

This document provides a comprehensive explanation of the policy settlement process, focusing on the risk-reward tier system that enables efficient matching between protection buyers and providers. We examine both the conceptual framework and the technical implementation details to give a complete picture of how BitHedge facilitates this critical market function.

## 2. Risk-Reward Tier System Overview

### 2.1 Core Concept

The risk-reward tier system is a structured approach that allows capital providers (Income Irene) to define their risk tolerance and target return profile when providing protection capital. Rather than requiring providers to make granular decisions about specific strike prices, durations, and premium requirements, the tier system abstracts these technical details into intuitive risk-reward profiles that align with common investor mindsets.

### 2.2 The Three-Tier Model

BitHedge implements a three-tier risk-reward model that captures the primary protection provision strategies:

1. **Conservative Tier**
   - **Risk Profile**: Lowest risk of capital utilization
   - **Protected Value Range**: 70-80% of current Bitcoin price
   - **Maximum Duration**: Shorter periods (typically up to 30 days)
   - **Premium Expectations**: Lower but more reliable yield
   - **Capital Utilization**: Less frequent settlement events
   - **Target Provider**: Risk-averse providers prioritizing capital preservation

2. **Balanced Tier**
   - **Risk Profile**: Moderate risk of capital utilization
   - **Protected Value Range**: 80-90% of current Bitcoin price
   - **Maximum Duration**: Medium periods (typically up to 60 days)
   - **Premium Expectations**: Moderate yield with reasonable risk
   - **Capital Utilization**: Occasional settlement events
   - **Target Provider**: Balanced approach seeking reasonable yield with manageable risk

3. **Aggressive Tier**
   - **Risk Profile**: Higher risk of capital utilization
   - **Protected Value Range**: 90-100% of current Bitcoin price
   - **Maximum Duration**: Longer periods (typically up to 90 days)
   - **Premium Expectations**: Higher yield potential
   - **Capital Utilization**: More frequent settlement events
   - **Target Provider**: Yield-focused providers comfortable with higher utilization rates

Each tier effectively represents a different strategy for providing protection capital, allowing Income Irene to align her capital allocation with her risk tolerance and yield objectives without needing to understand the technical details of options pricing and parameters.

## 3. Technical Implementation of Risk-Reward Tiers

### 3.1 Smart Contract Implementation

The risk-reward tier system is implemented in the Liquidity Pool Contract through a structured data mapping:

```typescript
// Income Strategy TypeScript Interface
interface IncomeStrategyService {
  // Translate risk tiers into user-friendly format
  getRiskTierOptions(): RiskTierOption[];
  
  // Create an income strategy with selected risk tier
  createIncomeStrategy(userId: string, strategyParams: {
    strategyType: 'PUT' | 'CALL',
    riskTier: 'conservative' | 'balanced' | 'aggressive',
    capitalCommitment: {
      amount: number,
      token: 'STX' | 'sBTC'
    },
    duration: {
      days: number
    }
  }): Promise<IncomeStrategy>;
  
  // Calculate expected yield based on risk tier and market conditions
  calculateExpectedYield(strategyParams: {
    strategyType: 'PUT' | 'CALL',
    riskTier: 'conservative' | 'balanced' | 'aggressive',
    capitalAmount: number,
    durationDays: number
  }): Promise<YieldProjection>;
  
  // Get performance metrics for each risk tier
  getRiskTierPerformanceMetrics(): Promise<{
    conservative: TierPerformance,
    balanced: TierPerformance,
    aggressive: TierPerformance
  }>;
}

// User-friendly risk tier option
interface RiskTierOption {
  id: string;             // 'conservative', 'balanced', 'aggressive'
  name: string;           // User-friendly name
  description: string;    // Brief explanation
  yieldRange: {           // Expected yield range
    min: number,
    max: number
  };
  riskLevel: number;      // Risk level on scale of 1-5
  recommendedFor: string; // User type recommendation
  acquisitionLikelihood: 'low' | 'medium' | 'high';
  marketConditionFit: string[];  // E.g., 'bull market', 'sideways market'
  protectedValueRange: {  // Protected value range as % of current price
    min: number,
    max: number
  };
}
```

### 7.2 Translation Layer

The Translation Layer helps bridge the technical risk tier parameters with user-friendly concepts:

```typescript
// Translation Layer Interface
interface RiskTierTranslation {
  // Convert technical tier parameters to user-friendly representations
  translateTierForUI(tierName: string, technicalParams: RiskTierParameters): RiskTierUI;
  
  // Convert user selections to technical parameters
  translateUserSelectionToTier(userSelection: UserTierSelection): TechnicalTierParameters;
  
  // Get appropriate terminology based on user preferences
  getTerminologyForTier(tierName: string, terminologyPreference: string): TierTerminology;
  
  // Get visualization components for risk tier
  getRiskTierVisualization(tierName: string, currentMarketData: MarketData): VisualizationData;
}

// User-friendly tier representation
interface RiskTierUI {
  displayName: string;       // User-friendly tier name
  description: string;       // Explanation of tier in user terms
  yieldVisualization: any;   // Data for yield visualization
  riskIndicator: any;        // Visual risk indicator data
  acquisitionExplanation: string; // Explanation of Bitcoin acquisition likelihood
  marketContextGuidance: string;  // Guidance based on current market
  durationRecommendations: string[]; // Recommended durations
}
```

### 7.3 Market Data Integration

The system incorporates market data to provide context-aware risk tier recommendations:

```typescript
// Market-Aware Risk Tier Service
interface MarketAwareRiskTierService {
  // Get current risk tier recommendations based on market conditions
  getCurrentRecommendations(): Promise<{
    recommendedTier: string,
    reason: string,
    marketAnalysis: {
      trend: string,
      volatility: string,
      cyclePosition: string
    }
  }>;
  
  // Adjust expected yield based on current market conditions
  adjustYieldForMarketConditions(baseYield: number, riskTier: string): number;
  
  // Get historical performance for each tier in similar market conditions
  getHistoricalTierPerformance(marketConditions: MarketConditions): Promise<{
    conservative: HistoricalPerformance,
    balanced: HistoricalPerformance,
    aggressive: HistoricalPerformance
  }>;
}
```

## 8. Protocol Governance and Risk Tier Evolution

The risk-reward tier system is designed to evolve over time through protocol governance, allowing it to adapt to changing market conditions and user needs.

### 8.1 Parameter Adjustment Process

The protocol includes governance mechanisms for adjusting risk tier parameters:

```typescript
// Risk Tier Governance Interface
interface RiskTierGovernance {
  // Propose changes to risk tier parameters
  proposeRiskTierUpdate(tierName: string, updatedParams: Partial<RiskTierParameters>, rationale: string): Promise<ProposalId>;
  
  // Vote on proposed risk tier changes
  voteOnTierProposal(proposalId: string, approve: boolean, voterAddress: string): Promise<VoteResult>;
  
  // Implement approved tier changes
  executeRiskTierUpdate(proposalId: string): Promise<TransactionResult>;
  
  // Get history of tier parameter changes
  getTierParameterHistory(tierName: string): Promise<ParameterChange[]>;
}
```

### 8.2 Market Condition Responsive Adjustments

The protocol can implement automatic adjustments to tier parameters based on market conditions:

```typescript
// Automatic Parameter Adjustment System
interface AutomaticTierAdjustment {
  // Analyze current market conditions for potential tier adjustments
  analyzeMarketForAdjustments(): Promise<AdjustmentRecommendation[]>;
  
  // Apply gradual tier adjustments within pre-approved boundaries
  applyGradualAdjustment(tierName: string, paramName: string, adjustmentFactor: number): Promise<TransactionResult>;
  
  // Trigger emergency tier adjustments in extreme market conditions
  triggerEmergencyAdjustment(marketCondition: 'extreme_volatility' | 'market_crash' | 'rapid_recovery'): Promise<EmergencyAdjustmentResult>;
}
```

### 8.3 User Feedback Integration

The protocol incorporates user feedback to improve the risk tier system:

```typescript
// User Feedback Integration System
interface RiskTierFeedbackSystem {
  // Collect user satisfaction with tier performance
  recordTierSatisfaction(userId: string, tierName: string, satisfactionScore: number, feedback: string): Promise<FeedbackId>;
  
  // Analyze feedback patterns for potential improvements
  analyzeFeedbackPatterns(): Promise<FeedbackAnalysis>;
  
  // Generate tier improvement recommendations based on user feedback
  generateTierImprovements(): Promise<TierImprovementRecommendation[]>;
}
```

## 9. Conclusion

The BitHedge risk-reward tier matching system provides a sophisticated yet user-friendly approach to connecting protection buyers (Protective Peter) with capital providers (Income Irene). By abstracting complex options parameters into intuitive risk-reward profiles, the system makes it easy for capital providers to align their risk tolerance and yield objectives without requiring deep technical knowledge of options mechanics.

The three-tier model (Conservative, Balanced, and Aggressive) captures the primary strategies for providing protection capital, with each tier offering a different balance of risk and reward. This approach democratizes access to options-based yield generation by making it accessible to a wider range of users who might otherwise be intimidated by the complexity of traditional options platforms.

From a technical perspective, the system is implemented through a combination of on-chain smart contracts and off-chain services that work together to provide a seamless user experience. The smart contracts handle the core financial operations including capital allocation, matching, premium distribution, and settlement, while the off-chain services provide the user interface, market data integration, and educational content that make the system accessible to everyday users.

The risk-reward tier system is designed to evolve over time through protocol governance, allowing it to adapt to changing market conditions and user needs. This flexibility ensures that the system will remain effective and sustainable over the long term, providing a valuable service to the Bitcoin ecosystem by facilitating protection against volatility and creating new yield opportunities for capital providers.

By bridging the gap between sophisticated financial mechanics and intuitive user experiences, the BitHedge risk-reward tier system represents a significant step forward in making options-based protection and yield generation accessible to the broader Bitcoin community.
clarity
;; Risk tier configuration in the Liquidity Pool Contract
(define-map risk-tiers
  { tier-name: (string-ascii 20) }
  {
    min-protected-value-percentage: uint,  ;; minimum strike as % of current price
    max-protected-value-percentage: uint,  ;; maximum strike as % of current price
    premium-multiplier: uint,              ;; premium adjustment for tier
    max-duration-days: uint,               ;; maximum allowed duration in days
    status: bool                           ;; whether tier is active
  }
)

;; Initialize with default values for each tier
(map-set risk-tiers
  { tier-name: "conservative" }
  {
    min-protected-value-percentage: u700000,  ;; 70% (scaled by 1,000,000)
    max-protected-value-percentage: u800000,  ;; 80%
    premium-multiplier: u800000,              ;; 0.8x standard premium
    max-duration-days: u30,                   ;; 30 days maximum
    status: true
  }
)

(map-set risk-tiers
  { tier-name: "balanced" }
  {
    min-protected-value-percentage: u800000,  ;; 80%
    max-protected-value-percentage: u900000,  ;; 90%
    premium-multiplier: u1000000,             ;; 1.0x standard premium
    max-duration-days: u60,                   ;; 60 days maximum
    status: true
  }
)

(map-set risk-tiers
  { tier-name: "aggressive" }
  {
    min-protected-value-percentage: u900000,  ;; 90%
    max-protected-value-percentage: u1000000, ;; 100%
    premium-multiplier: u1200000,             ;; 1.2x standard premium
    max-duration-days: u90,                   ;; 90 days maximum
    status: true
  }
)
```

Each tier defines the parameters that will govern what kinds of protection policies the capital in that tier can support. These parameters form the ruleset for the matching algorithm.

### 3.2 Provider Capital Allocation

When a capital provider like Income Irene decides to commit capital to the pool, her deposit is tracked along with her selected risk tier:

```clarity
;; Provider deposit tracking with risk tier
(define-map provider-deposits
  { provider: principal }
  {
    stx-amount: uint,
    sbtx-amount: uint,
    stx-locked: uint,
    sbtx-locked: uint,
    last-deposit-height: uint,
    deposit-count: uint,
    risk-tier: (string-ascii 20),  ;; Selected risk tier
    yield-to-date: uint
  }
)

;; Function to deposit capital with specified risk tier
(define-public (deposit-collateral
  (amount uint)
  (token-contract principal)
  (risk-tier (string-ascii 20))
)
  (let (
    (provider tx-sender)
    (current-deposit (default-to
                       { stx-amount: u0, sbtx-amount: u0, stx-locked: u0, sbtx-locked: u0,
                         last-deposit-height: u0, deposit-count: u0,
                         risk-tier: "balanced", yield-to-date: u0 }
                       (map-get? provider-deposits { provider: provider })))
    ;; Verify risk tier is valid
    (valid-tier (is-valid-risk-tier risk-tier))
  )
    ;; Ensure the risk tier is valid
    (asserts! valid-tier (err u403))
    
    ;; Update provider deposit record with new amount and selected risk tier
    (map-set provider-deposits
      { provider: provider }
      (merge current-deposit {
        stx-amount: (+ (get stx-amount current-deposit) (if (is-eq token-contract stx-token) amount u0)),
        sbtx-amount: (+ (get sbtx-amount current-deposit) (if (is-eq token-contract sbtx-token) amount u0)),
        last-deposit-height: block-height,
        deposit-count: (+ (get deposit-count current-deposit) u1),
        risk-tier: risk-tier
      })
    )
    
    ;; Transfer tokens to pool
    (try! (contract-call? token-contract transfer amount tx-sender (as-contract tx-sender) none))
    
    ;; Emit deposit event
    (print { event: "collateral-deposited", provider: provider, amount: amount, token: token-contract, risk-tier: risk-tier })
    
    (ok true))
)
```

This allows the system to track not just how much capital each provider has committed, but also what risk parameters they've specified for their capital utilization.

### 3.3 Tier-Based Pool Management

The liquidity pool maintains internal accounting of how much capital is allocated to each risk tier:

```clarity
;; Track capital allocation by tier
(define-map tier-capital-allocation
  { tier-name: (string-ascii 20) }
  {
    total-stx: uint,
    total-sbtx: uint,
    locked-stx: uint,
    locked-sbtx: uint,
    active-policies-count: uint,
    utilization-rate: uint  ;; scaled by 1,000,000
  }
)

;; Update tier allocation when capital is added
(define-private (update-tier-allocation
  (tier-name (string-ascii 20))
  (stx-amount uint)
  (sbtx-amount uint)
)
  (let (
    (current-allocation (default-to
                          { total-stx: u0, total-sbtx: u0, locked-stx: u0, locked-sbtx: u0,
                            active-policies-count: u0, utilization-rate: u0 }
                          (map-get? tier-capital-allocation { tier-name: tier-name })))
  )
    (map-set tier-capital-allocation
      { tier-name: tier-name }
      (merge current-allocation {
        total-stx: (+ (get total-stx current-allocation) stx-amount),
        total-sbtx: (+ (get total-sbtx current-allocation) sbtx-amount)
      })
    )
  )
)
```

This tier-based accounting provides the foundation for the matching algorithm, allowing the system to determine how much capital is available in each tier to back new protection policies.

## 4. The Policy Settlement Process

### 4.1 Protection Request Classification

When Protective Peter submits a protection request, the system first analyzes the parameters to determine which risk tier it falls into:

```clarity
;; Determine which risk tier a protection request belongs to
(define-private (classify-protection-request
  (protected-value uint)  ;; Strike price
  (duration uint)         ;; Duration in days
  (current-price uint)    ;; Current BTC price
)
  (let (
    ;; Calculate protected value as percentage of current price (scaled by 1,000,000)
    (protected-value-percentage (/ (* protected-value u1000000) current-price))
    
    ;; Get tier parameters
    (conservative-tier (unwrap-panic (map-get? risk-tiers { tier-name: "conservative" })))
    (balanced-tier (unwrap-panic (map-get? risk-tiers { tier-name: "balanced" })))
    (aggressive-tier (unwrap-panic (map-get? risk-tiers { tier-name: "aggressive" })))
    
    ;; Check which tier the request falls into based on protected value percentage and duration
    (is-conservative (and
                       (>= protected-value-percentage (get min-protected-value-percentage conservative-tier))
                       (<= protected-value-percentage (get max-protected-value-percentage conservative-tier))
                       (<= duration (get max-duration-days conservative-tier))))
    
    (is-balanced (and
                   (>= protected-value-percentage (get min-protected-value-percentage balanced-tier))
                   (<= protected-value-percentage (get max-protected-value-percentage balanced-tier))
                   (<= duration (get max-duration-days balanced-tier))))
    
    (is-aggressive (and
                     (>= protected-value-percentage (get min-protected-value-percentage aggressive-tier))
                     (<= protected-value-percentage (get max-protected-value-percentage aggressive-tier))
                     (<= duration (get max-duration-days aggressive-tier))))
  )
    (cond
      (is-conservative "conservative")
      (is-balanced "balanced")
      (is-aggressive "aggressive")
      (true "none")  ;; No matching tier found
    )
  )
)
```

This classification is crucial for determining which pool of provider capital the protection request can draw from.

### 4.2 Matching Algorithm

Once the protection request has been classified into a risk tier, the matching algorithm determines if there is sufficient capital available in that tier to back the policy:

```clarity
;; Match a protection request with available capital
(define-public (create-pool-protection-policy
  (owner principal)
  (protected-value uint)
  (duration-days uint)
  (protected-amount uint)
  (policy-type (string-ascii 4))
)
  (let (
    ;; Get current BTC price from oracle
    (current-price (unwrap-panic (contract-call? .oracle-contract get-current-btc-price)))
    
    ;; Calculate expiration height (current + days * blocks per day)
    (expiration-height (+ block-height (* duration-days blocks-per-day)))
    
    ;; Classify the request into a risk tier
    (request-tier (classify-protection-request protected-value duration-days current-price))
    
    ;; Check if there's a matching tier
    (tier-match (not (is-eq request-tier "none")))
    
    ;; Calculate required collateral
    (required-collateral (calculate-required-collateral protected-value protected-amount policy-type current-price))
    
    ;; Check if sufficient capital is available in the matching tier
    (tier-allocation (default-to
                       { total-stx: u0, total-sbtx: u0, locked-stx: u0, locked-sbtx: u0,
                         active-policies-count: u0, utilization-rate: u0 }
                       (map-get? tier-capital-allocation { tier-name: request-tier })))
    
    (available-collateral (- (get total-stx tier-allocation) (get locked-stx tier-allocation)))
    (sufficient-capital (>= available-collateral required-collateral))
    
    ;; Calculate premium based on tier-specific multiplier
    (base-premium (calculate-base-premium protected-value protected-amount duration-days policy-type current-price))
    (tier-info (unwrap! (map-get? risk-tiers { tier-name: request-tier }) (err u404)))
    (adjusted-premium (/ (* base-premium (get premium-multiplier tier-info)) u1000000))
  )
    ;; Ensure request matches a valid tier
    (asserts! tier-match (err u400))
    
    ;; Ensure sufficient capital is available
    (asserts! sufficient-capital (err u401))
    
    ;; If all checks pass, create the policy
    (let (
      ;; Create the protection policy
      (policy-id (try! (contract-call? .policy-registry-contract create-protection-policy
                          owner
                          protected-value
                          expiration-height
                          protected-amount
                          adjusted-premium
                          policy-type
                          (as-contract tx-sender))))  ;; Pool contract as counterparty
      
      ;; Lock collateral from the tier's allocation
      (updated-locked (+ (get locked-stx tier-allocation) required-collateral))
      (updated-count (+ (get active-policies-count tier-allocation) u1))
      (updated-utilization (if (> (get total-stx tier-allocation) u0)
                             (/ (* updated-locked u1000000) (get total-stx tier-allocation))
                             u0))
    )
      ;; Update tier allocation with locked collateral
      (map-set tier-capital-allocation
        { tier-name: request-tier }
        (merge tier-allocation {
          locked-stx: updated-locked,
          active-policies-count: updated-count,
          utilization-rate: updated-utilization
        })
      )
      
      ;; Emit policy creation event
      (print {
        event: "pool-policy-created",
        policy-id: policy-id,
        tier: request-tier,
        collateral-locked: required-collateral,
        premium: adjusted-premium
      })
      
      (ok policy-id))
  )
)
```

This function encapsulates the core matching logic that connects protection requests with the appropriate risk tier capital pool.

### 4.3 Premium Collection and Distribution

When a protection policy is created, the premium is collected from the protection buyer and distributed to the capital providers based on their contribution to the matching tier:

```clarity
;; Process premium payment and distribution
(define-public (process-premium-payment
  (policy-id uint)
  (premium-amount uint)
)
  (let (
    ;; Get policy details
    (policy (unwrap-panic (contract-call? .policy-registry-contract get-policy-details policy-id)))
    (policy-tier (get-policy-tier policy))
    
    ;; Calculate fee distribution
    (platform-fee-percentage (var-get platform-fee-percentage))  ;; e.g., 10% (100,000)
    (provider-fee-percentage (- u1000000 platform-fee-percentage))  ;; e.g., 90% (900,000)
    
    (platform-fee (/ (* premium-amount platform-fee-percentage) u1000000))
    (provider-portion (/ (* premium-amount provider-fee-percentage) u1000000))
    
    ;; Get tier allocation to determine provider distribution
    (tier-allocation (unwrap-panic (map-get? tier-capital-allocation { tier-name: policy-tier })))
    (total-tier-capital (get total-stx tier-allocation))
  )
    ;; Transfer premium to contract
    (try! (contract-call? .stx-token transfer premium-amount tx-sender (as-contract tx-sender) none))
    
    ;; Transfer platform fee to protocol treasury
    (try! (as-contract (contract-call? .stx-token transfer platform-fee (as-contract tx-sender) protocol-treasury none)))
    
    ;; Distribute provider portion proportionally to providers in this tier
    (distribute-provider-premiums policy-tier provider-portion total-tier-capital)
    
    ;; Emit premium payment event
    (print {
      event: "premium-processed",
      policy-id: policy-id,
      premium-amount: premium-amount,
      platform-fee: platform-fee,
      provider-portion: provider-portion
    })
    
    (ok true))
)

;; Distribute premium proportionally to providers in a tier
(define-private (distribute-provider-premiums
  (tier-name (string-ascii 20))
  (provider-portion uint)
  (total-tier-capital uint)
)
  ;; Implementation would iterate through providers in this tier
  ;; and allocate premium based on their proportion of the tier's capital
  
  ;; For MVP, we might use a simpler approach of tracking total premiums
  ;; per tier and distribute to providers when they withdraw based on their
  ;; contribution percentage
  
  ;; Tracking premium allocation to the tier
  (let (
    (current-tier-premiums (default-to u0 (map-get? tier-premiums { tier-name: tier-name })))
  )
    (map-set tier-premiums
      { tier-name: tier-name }
      (+ current-tier-premiums provider-portion))
  )
)
```

This premium distribution mechanism ensures that capital providers like Income Irene receive their share of premiums based on their contribution to the specific risk tier that matched with the protection request.

### 4.4 Policy Settlement Upon Activation

When market conditions trigger a policy activation (i.e., the Bitcoin price falls below the protected value), the settlement process transfers capital from the appropriate tier to the protection buyer:

```clarity
;; Process protection policy activation (claim settlement)
(define-public (process-protection-activation
  (policy-id uint)
)
  (let (
    ;; Get policy details
    (policy (unwrap-panic (contract-call? .policy-registry-contract get-policy-details policy-id)))
    
    ;; Ensure policy is eligible for activation (checked by Policy Registry)
    ;; and this function is called by the Policy Registry contract
    (is-authorized (is-eq contract-caller .policy-registry-contract))
    
    ;; Get current BTC price for settlement
    (current-price (unwrap-panic (contract-call? .oracle-contract get-current-btc-price)))
    
    ;; Calculate settlement amount (difference between protected value and current price)
    (protected-value (get protected-value policy))
    (protected-amount (get protected-amount policy))
    (settlement-diff (if (< current-price protected-value) (- protected-value current-price) u0))
    (settlement-amount (/ (* settlement-diff protected-amount) current-price))
    
    ;; Get policy tier
    (policy-tier (get-policy-tier policy))
    
    ;; Update tier allocation
    (tier-allocation (unwrap-panic (map-get? tier-capital-allocation { tier-name: policy-tier })))
  )
    ;; Ensure caller is authorized
    (asserts! is-authorized (err u403))
    
    ;; Transfer settlement amount to the policy owner
    (try! (as-contract (contract-call? .stx-token transfer settlement-amount (as-contract tx-sender) (get owner policy) none)))
    
    ;; Update tier allocation
    (map-set tier-capital-allocation
      { tier-name: policy-tier }
      (merge tier-allocation {
        locked-stx: (- (get locked-stx tier-allocation) (get-policy-collateral policy)),
        active-policies-count: (- (get active-policies-count tier-allocation) u1)
      })
    )
    
    ;; Update provider records (would be implemented to track which providers
    ;; contributed to this policy based on their tier participation)
    (update-provider-records-after-settlement policy-tier settlement-amount)
    
    ;; Emit settlement event
    (print {
      event: "policy-settled",
      policy-id: policy-id,
      settlement-amount: settlement-amount,
      policy-tier: policy-tier
    })
    
    (ok settlement-amount))
)
```

The settlement process ensures that capital is correctly transferred from the appropriate risk tier to fulfill the protection obligation. When this happens, it affects the capital providers who contributed to that tier, including Income Irene.

## 5. Risk Tier Impact Analysis

### 5.1 Provider Performance by Tier

The choice of risk tier significantly impacts Income Irene's performance as a capital provider:

#### Conservative Tier
- **Premium Rates**: Typically 3-5% annualized yield during normal market conditions
- **Capital Utilization**: Very low, usually under 5% of capital is utilized for settlements
- **Income Stability**: Most consistent income with minimal variance
- **Bitcoin Acquisition**: Least likely to acquire Bitcoin through settlements
- **Ideal Conditions**: Sideways or steadily rising markets with low volatility

#### Balanced Tier
- **Premium Rates**: Typically 6-9% annualized yield during normal market conditions
- **Capital Utilization**: Moderate, usually 5-15% of capital utilized for settlements
- **Income Stability**: Moderate income consistency with some variance
- **Bitcoin Acquisition**: Occasional Bitcoin acquisition through settlements
- **Ideal Conditions**: Mildly volatile markets with gradual trends

#### Aggressive Tier
- **Premium Rates**: Typically 8-15% annualized yield during normal market conditions
- **Capital Utilization**: Higher, usually 15-30% of capital utilized for settlements
- **Income Stability**: Least consistent income with higher variance
- **Bitcoin Acquisition**: More frequent Bitcoin acquisition through settlements
- **Ideal Conditions**: Pre-market-bottom accumulation or strong belief in imminent uptrends

### 5.2 Market Conditions and Tier Performance

The performance of each risk tier varies dramatically based on market conditions:

| Market Condition     | Conservative Tier        | Balanced Tier             | Aggressive Tier           |
|----------------------|--------------------------|---------------------------|---------------------------|
| Bull Market          | Consistent small yield   | Solid yield, rare settlements | Highest yield, few settlements |
| Sideways Market      | Ideal conditions         | Good yield, occasional settlements | Higher yield, moderate settlements |
| Bear Market          | Lower yield, rare settlements | Moderate yield, frequent settlements | High initial yield, many settlements |
| High Volatility      | Most capital preserved   | Some capital utilized     | Significant capital utilized |
| Post-Halving Period  | Safer but lower returns  | Good risk-adjusted returns | Higher returns, higher risk |

### 5.3 Dynamic Tier Adjustments

To optimize the risk-reward tier system for changing market conditions, the BitHedge protocol includes governance mechanisms for parameter adjustments:

```clarity
;; Governance function to update risk tier parameters
(define-public (update-risk-tier-parameters
  (tier-name (string-ascii 20))
  (min-protected-value-percentage uint)
  (max-protected-value-percentage uint)
  (premium-multiplier uint)
  (max-duration-days uint)
)
  (begin
    ;; Only governance can adjust tier parameters
    (asserts! (is-gov-or-admin tx-sender) (err u403))
    
    ;; Ensure parameters are within reasonable bounds
    (asserts! (and (>= min-protected-value-percentage u500000)  ;; Min 50%
                  (<= max-protected-value-percentage u1200000)  ;; Max 120%
                  (< min-protected-value-percentage max-protected-value-percentage)
                  (>= premium-multiplier u500000)  ;; Min 0.5x
                  (<= premium-multiplier u2000000)  ;; Max 2.0x
                  (>= max-duration-days u7)  ;; Min 7 days
                  (<= max-duration-days u365))  ;; Max 365 days
            (err u400))
    
    ;; Update the risk tier parameters
    (map-set risk-tiers
      { tier-name: tier-name }
      {
        min-protected-value-percentage: min-protected-value-percentage,
        max-protected-value-percentage: max-protected-value-percentage,
        premium-multiplier: premium-multiplier,
        max-duration-days: max-duration-days,
        status: true
      }
    )
    
    ;; Emit update event
    (print {
      event: "risk-tier-updated",
      tier-name: tier-name,
      min-protected-value-percentage: min-protected-value-percentage,
      max-protected-value-percentage: max-protected-value-percentage,
      premium-multiplier: premium-multiplier,
      max-duration-days: max-duration-days
    })
    
    (ok true))
)
```

This governance mechanism allows the protocol to adapt the risk-reward tier system to changing market conditions, ensuring that the system remains effective and sustainable over time.

## 6. Real-World Example: End-to-End Settlement Flow

To illustrate how the risk-reward tier system works in practice, let's follow a complete settlement flow example:

### 6.1 Setup Phase

1. **Income Irene's Initial Commitment**:
   - Irene selects the "Balanced" risk tier
   - She deposits 1,000 STX as capital
   - The system records her deposit with the "balanced" tier tag
   - The tier-capital-allocation for "balanced" increases by 1,000 STX

2. **Other Providers**:
   - Provider A deposits 500 STX in "conservative" tier
   - Provider B deposits 2,000 STX in "balanced" tier
   - Provider C deposits 1,500 STX in "aggressive" tier
   - Total "balanced" tier capital is now 3,000 STX (1,000 from Irene + 2,000 from Provider B)

### 6.2 Protection Creation Phase

3. **Protective Peter's Request**:
   - Current Bitcoin price is $48,500
   - Peter requests protection for 0.1 BTC
   - He selects protected value of $41,225 (85% of current price)
   - He chooses a 30-day protection period
   - This classifies as a "balanced" tier request (between 80-90% of current price)

4. **Matching Process**:
   - The system identifies this as a "balanced" tier request
   - Required collateral calculation: ~258 STX
   - Available in balanced tier: 3,000 STX (not yet locked)
   - There is sufficient capital, so the match is successful
   - The tier-capital-allocation for "balanced" is updated:
     - locked-stx increases by 258 STX
     - active-policies-count increases by 1

5. **Premium Calculation and Collection**:
   - Base premium calculated: 10 STX
   - Tier premium multiplier (balanced): 1.0x
   - Final premium: 10 STX
   - Peter pays 10 STX premium

6. **Premium Distribution**:
   - Platform fee (10%): 1 STX to treasury
   - Provider portion (90%): 9 STX to balanced tier providers
   - Irene's share calculation: (1,000 STX / 3,000 STX) * 9 STX = 3 STX
   - Provider B's share: (2,000 STX / 3,000 STX) * 9 STX = 6 STX
   - Provider yield records are updated accordingly

### 6.3 Settlement Phase

7. **Market Condition Change**:
   - Two weeks later, Bitcoin price drops to $39,000
   - This is below Peter's protected value of $41,225
   - The policy becomes eligible for activation

8. **Activation Process**:
   - Peter activates his protection
   - Policy Registry calls the process-protection-activation function
   - Settlement calculation:
     - Price difference: $41,225 - $39,000 = $2,225
     - For 0.1 BTC, this equals approximately 57 STX at current rates
   
9. **Settlement Execution**:
   - 57 STX is transferred from the pool to Peter
   - The balanced tier's statistics are updated:
     - locked-stx decreases by 258 STX
     - active-policies-count decreases by 1
   
10. **Provider Impact**:
    - Each provider in the balanced tier is affected proportionally
    - Irene's impact: (1,000 STX / 3,000 STX) * 57 STX = 19 STX utilized
    - Provider B's impact: (2,000 STX / 3,000 STX) * 57 STX = 38 STX utilized
    - Provider records are updated to reflect this capital utilization

11. **Final Outcome**:
    - Irene's new balance: 1,000 STX - 19 STX + 3 STX = 984 STX
    - Plus she has earned 3 STX in premium
    - Net position: 984 STX (slight decrease due to settlement)
    - But if she views this as Bitcoin acquisition, she now effectively purchased 0.0067 BTC at $41,225 per BTC (19 STX worth), which could be viewed as a strategic acquisition if she believes Bitcoin's long-term value will increase

### 6.4 Risk Tier Performance Analysis

After multiple protection policies and potential settlements, each tier's performance becomes clear:

- **Conservative Tier** (Provider A):
  - Yield earned: 12 STX (2.4% over period)
  - Capital utilized: 5 STX (1% of deposit)
  - Net position: 507 STX (500 + 12 - 5)
  - Effective APY: ~8% with minimal capital utilization

- **Balanced Tier** (Irene and Provider B):
  - Yield earned: 45 STX (1.5% over period)
  - Capital utilized: 90 STX (3% of deposit)
  - Net position: 2,955 STX (3,000 + 45 - 90)
  - Effective APY: ~6% with moderate capital utilization

- **Aggressive Tier** (Provider C):
  - Yield earned: 65 STX (4.3% over period)
  - Capital utilized: 175 STX (11.7% of deposit)
  - Net position: 1,390 STX (1,500 + 65 - 175)
  - Effective APY: ~15% but with significant capital utilization

This illustrates how different risk tiers lead to different performance outcomes, allowing providers to choose strategies that align with their risk tolerance and yield objectives.

## 7. Off-Chain Implementation

The risk-reward tier system is supported by several off-chain components that enhance the user experience:

### 7.1 Income Strategy Service

The Income Strategy Service translates technical risk tier parameters into user-friendly concepts for Income Irene:

```