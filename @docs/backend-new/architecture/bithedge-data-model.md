# BitHedge DeFi Platform: Comprehensive Data Model

## Overview

This document outlines the complete data model for the BitHedge platform, a Bitcoin-native DeFi application enabling options-based protection mechanisms built on the Stacks blockchain. The data model is designed to support both key user personas:

1. **Protective Peter**: Bitcoin holders seeking downside protection (PUT buyers)
2. **Income Irene**: Capital providers seeking yield opportunities (PUT sellers)

The model encompasses both on-chain (Clarity smart contracts) and off-chain (TypeScript/Convex) components, creating a cohesive system that balances blockchain integrity with user experience.

## System Architecture Context

The BitHedge platform follows a hybrid architecture:

- **On-chain Layer (Clarity)**: Smart contracts deployed on the Stacks blockchain that manage core financial functions, policy states, and capital flows
- **Off-chain Layer (TypeScript/Convex)**: Services and components that enhance user experience, manage complex calculations, and provide additional functionality not suitable for on-chain execution

This dual-layer approach optimizes for both trustlessness and user experience while accommodating the platform's transition from an assisted counterparty model to a peer-to-peer marketplace.

## 1. On-Chain Data Model (Clarity)

The on-chain data model is implemented across several interacting smart contracts, each with their own data structures.

### 1.1. Policy Registry Contract

Manages the creation, lifecycle, and status of all protection policies.

#### 1.1.1. Policy Entity

```clarity
;; Primary policy data structure
(define-map policies
  { policy-id: uint }
  {
    owner: principal,                  ;; Protective Peter (policy buyer)
    protected-value: uint,             ;; Strike price in STX satoshis
    expiration-height: uint,           ;; Block height when policy expires
    protected-amount: uint,            ;; Amount in Bitcoin satoshis
    premium: uint,                     ;; Cost in STX satoshis
    policy-type: (string-ascii 4),     ;; "PUT" or "CALL"
    counterparty: principal,           ;; Income Irene (direct provider) or liquidity pool
    creation-height: uint,             ;; Block height when created
    status: uint,                      ;; 0=active, 1=exercised, 2=expired, 3=canceled
    exercise-price: uint,              ;; Price at exercise if activated (0 if not)
    exercise-height: uint              ;; Block when exercised (0 if not)
  }
)
```

#### 1.1.2. Policy Indexing

```clarity
;; Mapping of policies owned by a user (Protective Peter)
(define-map policies-by-owner
  { owner: principal }
  { policy-ids: (list 250 uint) }
)

;; Mapping of policies provided by a counterparty (Income Irene)
(define-map policies-by-provider
  { provider: principal }
  { policy-ids: (list 250 uint) }
)

;; Mapping of active policies by expiration
(define-map policies-by-expiration
  { expiration-height: uint }
  { policy-ids: (list 250 uint) }
)

;; Track total policy metrics
(define-data-var total-active-policies uint u0)
(define-data-var total-protected-value uint u0)
(define-data-var total-premium-collected uint u0)
```

#### 1.1.3. Policy Events

```clarity
;; Policy lifecycle events
(define-event policy-created (
  policy-id uint,
  owner principal,
  protected-value uint,
  expiration-height uint,
  protected-amount uint,
  premium uint,
  policy-type (string-ascii 4),
  counterparty principal
))

(define-event policy-activated (
  policy-id uint,
  exercise-price uint,
  exercise-height uint,
  payout-amount uint
))

(define-event policy-expired (
  policy-id uint,
  expiration-height uint
))

(define-event policy-canceled (
  policy-id uint,
  cancel-height uint,
  refund-amount uint
))
```

### 1.2. Liquidity Pool Contract

Manages collateral for the assisted counterparty model, acting as a pooled protection provider.

#### 1.2.1. Liquidity Pool Configuration

```clarity
;; Pool configuration and status
(define-data-var pool-initialized bool false)
(define-data-var pool-paused bool false)
(define-data-var pool-version uint u1)

;; Fee structure
(define-data-var platform-fee-percentage uint u10000)  ;; 1% (scaled by 1,000,000)
(define-data-var provider-fee-percentage uint u950000)  ;; 95% (scaled by 1,000,000)
(define-data-var protocol-reserve-percentage uint u40000)  ;; 4% (scaled by 1,000,000)
```

#### 1.2.2. Collateral Management

```clarity
;; Track total pool collateral
(define-data-var total-stx-collateral uint u0)
(define-data-var total-sbtc-collateral uint u0)
(define-data-var stx-locked uint u0)  ;; Amount locked in active policies
(define-data-var sbtc-locked uint u0)  ;; Amount locked in active policies

;; Provider deposits (Income Irene)
(define-map provider-deposits
  { provider: principal }
  {
    stx-amount: uint,
    sbtc-amount: uint,
    stx-locked: uint,     ;; Amount locked in active policies
    sbtc-locked: uint,    ;; Amount locked in active policies
    last-deposit-height: uint,
    deposit-count: uint,
    total-yield-earned: uint,
    current-policies-count: uint
  }
)

;; Provider yield tracking
(define-map provider-yield
  { provider: principal, epoch: uint }
  {
    yield-amount: uint,
    policies-count: uint,
    average-premium-rate: uint,
    distribution-height: uint,
    claimed: bool
  }
)
```

#### 1.2.3. Utilization and Risk Metrics

```clarity
;; Pool utilization metrics for premium calculations
(define-data-var put-utilization-rate uint u0)  ;; scaled by 1,000,000
(define-data-var call-utilization-rate uint u0)  ;; scaled by 1,000,000
(define-data-var overall-utilization-rate uint u0)  ;; scaled by 1,000,000

;; Risk parameters for policy types
(define-map policy-risk-parameters
  { policy-type: (string-ascii 4) }
  {
    base-premium-rate: uint,         ;; scaled by 1,000,000
    utilization-multiplier: uint,    ;; scaled by 1,000,000
    max-utilization: uint,           ;; scaled by 1,000,000
    moneyness-multiplier: uint,      ;; scaled by 1,000,000
    duration-multiplier: uint,       ;; scaled by 1,000,000
    min-collateralization: uint      ;; scaled by 1,000,000
  }
)

;; Risk tier configuration (mapped to UX tiers)
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
```

#### 1.2.4. Pool Events

```clarity
;; Pool lifecycle events
(define-event collateral-deposited (
  provider principal,
  token-type (string-ascii 4),
  amount uint,
  total-deposited uint
))

(define-event collateral-withdrawn (
  provider principal,
  token-type (string-ascii 4),
  amount uint,
  remaining-deposit uint
))

(define-event yield-distributed (
  epoch uint,
  total-yield uint,
  providers-count uint,
  average-yield-rate uint
))

(define-event pool-utilization-updated (
  put-utilization uint,
  call-utilization uint,
  overall-utilization uint
))
```

### 1.3. Oracle Contract

Provides reliable price feeds for Bitcoin and other assets.

#### 1.3.1. Price Data Management

```clarity
;; Current price information
(define-data-var current-btc-price uint u0)
(define-data-var current-btc-volatility uint u0)  ;; scaled by 1,000,000
(define-data-var last-price-update-height uint u0)
(define-data-var last-price-update-time uint u0)

;; Price history
(define-map btc-price-history
  { block-height: uint }
  { price: uint, timestamp: uint }
)

;; Volatility history
(define-map btc-volatility-history
  { block-height: uint }
  { volatility: uint, period-days: uint }
)
```

#### 1.3.2. Oracle Configuration

```clarity
;; Oracle providers and configuration
(define-map authorized-providers
  { provider: principal }
  {
    status: bool,
    weight: uint,
    last-update-height: uint,
    update-count: uint
  }
)

;; Oracle update constraints
(define-data-var min-update-interval uint u10)  ;; Minimum blocks between updates
(define-data-var max-price-deviation uint u50000)  ;; 5% maximum deviation (scaled by 1,000,000)
(define-data-var required-confirmations uint u3)  ;; Number of providers that must agree
(define-data-var price-dispute-threshold uint u20000)  ;; 2% threshold for disputes (scaled by 1,000,000)
```

#### 1.3.3. Oracle Events

```clarity
;; Oracle update events
(define-event price-updated (
  price uint,
  previous-price uint,
  update-height uint,
  provider principal,
  confirmation-count uint
))

(define-event volatility-updated (
  volatility uint,
  previous-volatility uint,
  update-height uint,
  period-days uint
))

(define-event price-dispute-raised (
  disputed-price uint,
  disputing-provider principal,
  update-height uint
))
```

### 1.4. Parameter Contract

Manages system parameters and configuration.

#### 1.4.1. System Parameters

```clarity
;; System parameters with numeric values
(define-map numeric-parameters
  { name: (string-ascii 50) }
  {
    value: uint,
    min-value: uint,
    max-value: uint,
    description: (string-utf8 200),
    last-updated: uint,
    updated-by: principal
  }
)

;; Feature flags for enabling/disabling functionality
(define-map feature-flags
  { name: (string-ascii 50) }
  {
    enabled: bool,
    description: (string-utf8 200),
    last-updated: uint,
    updated-by: principal
  }
)

;; Parameter update history for transparency
(define-map parameter-history
  {
    name: (string-ascii 50),
    update-height: uint
  }
  {
    old-value: uint,
    new-value: uint,
    changed-by: principal,
    justification: (string-utf8 500)
  }
)
```

#### 1.4.2. Core Parameters

```clarity
;; Initialize with default values
(map-set numeric-parameters
  { name: "min-policy-duration" }
  {
    value: u1008,               ;; 7 days in blocks
    min-value: u144,            ;; 1 day minimum
    max-value: u4320,           ;; 30 days maximum
    description: "Minimum policy duration in blocks",
    last-updated: block-height,
    updated-by: contract-owner
  }
)

(map-set numeric-parameters
  { name: "max-policy-duration" }
  {
    value: u52560,              ;; 365 days in blocks
    min-value: u4320,           ;; 30 days minimum
    max-value: u105120,         ;; 2 years maximum
    description: "Maximum policy duration in blocks",
    last-updated: block-height,
    updated-by: contract-owner
  }
)

;; More parameters would be defined here...
```

### 1.5. Governance Contract

Manages protocol governance and parameter adjustments.

#### 1.5.1. Governance Proposals

```clarity
;; Governance proposals
(define-map proposals
  { proposal-id: uint }
  {
    proposer: principal,
    title: (string-ascii 100),
    description: (string-utf8 1000),
    parameter-name: (string-ascii 50),
    parameter-value: uint,
    proposal-height: uint,
    status: uint,  ;; 0=pending, 1=approved, 2=rejected, 3=executed, 4=expired
    votes-for: uint,
    votes-against: uint,
    quorum-reached: bool,
    execution-height: uint
  }
)

;; Individual votes on proposals
(define-map votes
  {
    proposal-id: uint,
    voter: principal
  }
  {
    approved: bool,
    vote-height: uint,
    vote-weight: uint
  }
)
```

#### 1.5.2. Governance Roles

```clarity
;; Governance committee members
(define-map governance-roles
  { member: principal }
  {
    role: (string-ascii 20),   ;; "parameter", "technical", "emergency"
    status: bool,
    weight: uint,
    join-height: uint
  }
)

;; Role-based access control
(define-map role-permissions
  { role: (string-ascii 20) }
  {
    can-propose: bool,
    can-vote: bool,
    can-execute: bool,
    can-emergency: bool,
    vote-weight: uint
  }
)
```

#### 1.5.3. Emergency Controls

```clarity
;; Emergency action definitions
(define-map emergency-actions
  { action-id: uint }
  {
    name: (string-ascii 50),
    description: (string-utf8 500),
    requires-approval-count: uint,
    max-duration-blocks: uint,
    current-status: bool
  }
)

;; Emergency action activations
(define-map emergency-activations
  { action-id: uint, activation-id: uint }
  {
    initiator: principal,
    justification: (string-utf8 500),
    start-height: uint,
    end-height: uint,
    approvals: (list 5 principal),
    status: uint,  ;; 0=pending, 1=active, 2=expired, 3=deactivated
    deactivation-height: uint,
    deactivation-reason: (string-utf8 500)
  }
)
```

### 1.6. P2P Marketplace Contract

Future component for direct peer-to-peer protection trading.

#### 1.6.1. Protection Offers

```clarity
;; Protection offers (limit orders)
(define-map protection-offers
  { offer-id: uint }
  {
    creator: principal,             ;; Income Irene (offer creator)
    protected-value: uint,          ;; Strike price in STX satoshis
    expiration-height: uint,        ;; Block height when offer expires
    protected-amount: uint,         ;; Amount in Bitcoin satoshis
    premium: uint,                  ;; Requested premium in STX satoshis
    policy-type: (string-ascii 4),  ;; "PUT" or "CALL"
    creation-height: uint,          ;; Block height when created
    status: uint,                   ;; 0=open, 1=filled, 2=canceled, 3=expired
    min-duration: uint,             ;; Minimum policy duration
    max-duration: uint              ;; Maximum policy duration
  }
)
```

#### 1.6.2. Offer Indexing

```clarity
;; Index for efficient querying of open offers
(define-map open-offers-by-type
  { policy-type: (string-ascii 4) }
  { offer-ids: (list 250 uint) }
)

;; Index of offers by creator
(define-map offers-by-creator
  { creator: principal }
  { offer-ids: (list 250 uint) }
)

;; Offer discovery indices
(define-map offers-by-protected-value
  { policy-type: (string-ascii 4), value-bucket: uint }
  { offer-ids: (list 250 uint) }
)
```

#### 1.6.3. Marketplace Events

```clarity
;; Marketplace events
(define-event offer-created (
  offer-id uint,
  creator principal,
  protected-value uint,
  protected-amount uint,
  premium uint,
  policy-type (string-ascii 4)
))

(define-event offer-filled (
  offer-id uint,
  filler principal,
  resulting-policy-id uint
))

(define-event offer-canceled (
  offer-id uint,
  creator principal,
  reason (string-utf8 100)
))
```

## 2. Off-Chain Data Model (TypeScript/Convex)

The off-chain data models enhance the on-chain data and provide additional user experience features.

### 2.1. User Profile Service

Manages user-specific preferences and settings.

#### 2.1.1. User Profile

```typescript
interface UserProfile {
  // Core identification
  walletAddress: string;          // Stacks wallet address (principal)
  profileId: string;              // UUID for off-chain reference
  createdAt: Date;                // Profile creation timestamp
  lastLoginAt: Date;              // Last login timestamp
  
  // Persona configuration
  primaryPersona: 'protection' | 'income' | 'both';
  defaultView: 'protection-center' | 'income-center' | 'dashboard';
  
  // Preferences
  terminologyPreference: 'bitcoin-native' | 'balanced' | 'insurance';
  denominationPreference: 'sats' | 'btc' | 'usd' | 'dual';
  riskPreference: 'conservative' | 'balanced' | 'aggressive';
  colorTheme: 'light' | 'dark' | 'system';
  
  // Notification settings
  notifications: {
    email: boolean;
    push: boolean;
    expirationReminders: boolean;
    priceAlerts: boolean;
    activationOpportunities: boolean;
    emailAddress?: string;
    pushToken?: string;
  };
  
  // Feature flags
  features: {
    advancedMode: boolean;
    betaFeatures: boolean;
    showTechnicalTerms: boolean;
    developerMode: boolean;
  };

  // User education progress
  educationProgress: {
    completedConcepts: string[];    // IDs of completed educational concepts
    lastConceptViewed: string;      // ID of last viewed concept
    expertiseLevel: 'beginner' | 'intermediate' | 'advanced';
    conceptsIntroducedCount: number;
  };
  
  // Analytics and usage (privacy-focused)
  usage: {
    protectionPoliciesCreated: number;
    incomeStrategiesCreated: number;
    totalProtectedValue: number;    // In sats
    totalPremiumPaid: number;       // In STX satoshis
    totalYieldEarned: number;       // In STX satoshis
    lastActivityAt: Date;
  };
}
```

#### 2.1.2. User Alerts

```typescript
interface UserAlert {
  alertId: string;             // UUID
  userId: string;              // Reference to user profile
  alertType: 'price' | 'expiration' | 'activation' | 'system' | 'education';
  severity: 'info' | 'warning' | 'critical';
  title: string;               // Alert title
  message: string;             // Alert message
  createdAt: Date;             // Creation timestamp
  expiresAt: Date;             // Expiration timestamp
  read: boolean;               // Whether alert has been read
  dismissed: boolean;          // Whether alert has been dismissed
  actionRequired: boolean;     // Whether user action is required
  actionLink?: string;         // Optional link for user action
  relatedPolicyId?: string;    // Optional related policy
}
```

#### 2.1.3. User Activity

```typescript
interface UserActivity {
  activityId: string;           // UUID
  userId: string;               // Reference to user profile
  activityType: 'policy-creation' | 'policy-activation' | 'deposit' | 'withdrawal' | 'yield-collection' | 'login' | 'settings-change';
  timestamp: Date;              // Activity timestamp
  description: string;          // Human-readable description
  metadata: {                   // Additional activity details
    policyId?: string;
    amount?: number;
    transactionId?: string;
    previousValue?: any;
    newValue?: any;
  };
  source: 'web' | 'mobile' | 'api' | 'system';
}
```

### 2.2. Policy Management Service

Extends on-chain policy data with additional metadata and user-facing information.

#### 2.2.1. Enhanced Policy

```typescript
interface EnhancedPolicy {
  // Core policy data (from blockchain)
  policyId: string;                // Policy ID from blockchain
  owner: string;                   // Owner's wallet address
  counterparty: string;            // Provider's wallet address or pool contract
  protectedValue: number;          // Strike price in STX satoshis
  protectedAmount: number;         // Amount in Bitcoin satoshis
  premium: number;                 // Cost in STX satoshis
  policyType: 'PUT' | 'CALL';      // Policy type
  status: 'active' | 'exercised' | 'expired' | 'canceled';
  creationHeight: number;          // Block height when created
  expirationHeight: number;        // Block height when policy expires
  exerciseHeight?: number;         // Block height when exercised (if applicable)
  exercisePrice?: number;          // Price at exercise (if applicable)
  
  // Enhanced data (off-chain)
  createdAt: Date;                 // Creation timestamp
  expiresAt: Date;                 // Expiration timestamp
  exercisedAt?: Date;              // Exercise timestamp (if applicable)
  
  // User-friendly translations
  protectedValueUsd: number;       // Protected value in USD
  protectedAmountBtc: number;      // Protected amount in BTC
  premiumUsd: number;              // Premium in USD
  
  // Protection metrics
  currentValue: number;            // Current value of protection
  breakEvenPrice: number;          // Break-even price for protection
  moneyness: 'ITM' | 'ATM' | 'OTM'; // In-the-money status
  moneynessPercentage: number;     // How far ITM/OTM as percentage
  maxPayout: number;               // Maximum possible payout
  
  // User experience enhancements
  userLabel?: string;              // User-defined label for policy
  userNotes?: string;              // User notes about policy
  alertsEnabled: boolean;          // Whether alerts are enabled for policy
  displayStrategy: 'standard' | 'flexible' | 'crash-insurance' | 'hodl-safe';
  remindersSent: number;           // Number of reminders sent
  
  // UX categorization
  riskCategory: 'low' | 'medium' | 'high';
  durationCategory: 'short' | 'medium' | 'long' | 'strategic';
  
  // Historical data
  priceAtCreation: number;         // BTC price at policy creation
  priceHistory: {                  // Snapshot of prices at key points
    creation: number;
    halfway: number;
    current: number;
    percentageChange: number;
  };
}
```

#### 2.2.2. Policy Notification

```typescript
interface PolicyNotification {
  notificationId: string;           // UUID
  policyId: string;                 // Reference to policy
  userId: string;                   // Reference to user profile
  notificationType: 'creation' | 'approaching-expiration' | 'expiration' | 'activation-opportunity' | 'activated' | 'price-alert';
  createdAt: Date;                  // Notification creation timestamp
  scheduledFor: Date;               // When notification should be delivered
  delivered: boolean;               // Whether notification was delivered
  deliveredAt?: Date;               // When notification was delivered
  channels: ('email' | 'push' | 'in-app')[];  // Delivery channels
  title: string;                    // Notification title
  message: string;                  // Notification message
  data: {                           // Additional notification data
    currentPrice?: number;
    protectedValue?: number;
    daysRemaining?: number;
    activationValue?: number;
  };
}
```

### 2.3. Income Strategy Management Service

Manages income generation strategies for providers (Income Irene).

#### 2.3.1. Income Strategy

```typescript
interface IncomeStrategy {
  // Core strategy data
  strategyId: string;              // UUID for strategy
  userId: string;                  // Reference to user profile
  walletAddress: string;           // Provider's wallet address
  
  // Strategy configuration
  strategyType: 'PUT' | 'CALL';    // Underlying policy type
  riskTier: 'conservative' | 'balanced' | 'aggressive';
  yieldActivationLevel: number;    // Strike price percentage of market
  capitalCommitment: {
    amount: number;                // Amount in STX/sBTC satoshis
    token: 'STX' | 'sBTC';         // Collateral token
    percentage: number;            // Percentage of user's available balance
  };
  duration: {
    category: 'short' | 'medium' | 'long' | 'strategic';
    days: number;                  // Duration in days
    blocks: number;                // Duration in blocks
    expiresAt: Date;               // Expiration timestamp
  };
  
  // Performance metrics
  performance: {
    premiumsEarned: number;        // Total premiums earned
    annualizedYield: number;       // Annualized yield percentage
    activePoliciesCount: number;   // Number of active policies
    completedPoliciesCount: number; // Number of completed policies
    acquisitionsCount: number;     // Number of BTC acquisitions (exercised)
    totalBtcAcquired: number;      // Total BTC acquired through exercises
  };
  
  // Status and lifecycle
  status: 'active' | 'paused' | 'completed' | 'canceled';
  createdAt: Date;                 // Creation timestamp
  updatedAt: Date;                 // Last update timestamp
  autoRenew: boolean;              // Whether strategy should auto-renew
  
  // Related policies
  activePolicies: string[];        // IDs of active policies
  completedPolicies: string[];     // IDs of completed policies
  
  // Risk and capital management
  capitalLocked: number;           // Amount of capital currently locked
  capitalAvailable: number;        // Amount of capital available for new policies
  utilizationRate: number;         // Percentage of capital currently utilized
  maxCapitalExposure: number;      // Maximum capital exposed to single policy
}
```

#### 2.3.2. Yield Distribution

```typescript
interface YieldDistribution {
  distributionId: string;          // UUID
  strategyId: string;              // Reference to strategy
  userId: string;                  // Reference to user
  amount: number;                  // Amount in STX satoshis
  distributedAt: Date;             // Distribution timestamp
  source: 'premium' | 'expiration' | 'cancellation';
  sourcePolicyId: string;          // ID of source policy
  transactionId: string;           // Blockchain transaction ID
  annualizedYield: number;         // Annualized yield percentage
  reinvested: boolean;             // Whether yield was reinvested
}
```

### 2.4. Market Data Service

Manages price data, analytics, and market conditions.

#### 2.4.1. Enhanced Price Data

```typescript
interface EnhancedPriceData {
  // Core price data
  priceId: string;                 // UUID
  timestamp: Date;                 // Timestamp of price
  btcPrice: number;                // BTC price in USD
  btcPriceSats: number;            // BTC price in STX satoshis
  blockHeight: number;             // Block height of price record
  
  // Market context
  volatility: {
    daily: number;                 // 24h volatility
    weekly: number;                // 7d volatility
    monthly: number;               // 30d volatility
    annualized: number;            // Annualized volatility
  };
  
  // Trend indicators
  priceChange: {
    hourly: number;                // 1h price change percentage
    daily: number;                 // 24h price change percentage
    weekly: number;                // 7d price change percentage
  };
  
  // Market analysis
  marketCondition: 'bullish' | 'bearish' | 'neutral' | 'volatile';
  trendStrength: 'weak' | 'moderate' | 'strong';
  technicalIndicators: {
    movingAverages: {
      ma7: number;                 // 7-day moving average
      ma30: number;                // 30-day moving average
      ma90: number;                // 90-day moving average
    };
    rsi: number;                   // Relative Strength Index
    bollingerBands: {
      upper: number;
      middle: number;
      lower: number;
      width: number;
    };
  };
  
  // Halving cycle context
  halvingCycleData: {
    daysSinceLastHalving: number;
    daysUntilNextHalving: number;
    cyclePercentageComplete: number;
    cyclePhase: 'early' | 'mid' | 'late' | 'pre-halving';
  };
}
```

#### 2.4.2. Market Analytics

```typescript
interface MarketAnalytics {
  // Platform metrics
  platformMetrics: {
    totalActivePolicies: number;
    totalProtectedValue: number;   // In BTC satoshis
    totalPremiumsCollected: number; // In STX satoshis
    activationRate: number;        // Percentage of policies activated
    averagePolicySize: number;     // Average protection amount
    averagePremiumRate: number;    // Average premium as percentage
    userGrowth: {
      daily: number;
      weekly: number;
      monthly: number;
    };
  };
  
  // Protection demand metrics
  protectionDemand: {
    putDemand: number;             // Demand for PUT protection (scale 0-100)
    callDemand: number;            // Demand for CALL protection (scale 0-100)
    popularProtectionLevels: {
      put: number[];               // Popular PUT protection levels (% of price)
      call: number[];              // Popular CALL protection levels (% of price)
    };
    averageDuration: number;       // Average protection duration in days
    premiumTrend: 'increasing' | 'decreasing' | 'stable';
  };
  
  // Yield opportunity metrics
  yieldOpportunities: {
    putProviderYield: {
      conservative: number;        // Estimated APY for conservative tier
      balanced: number;            // Estimated APY for balanced tier
      aggressive: number;          // Estimated APY for aggressive tier
    };
    callProviderYield: {
      conservative: number;        // Estimated APY for conservative tier
      balanced: number;            // Estimated APY for balanced tier
      aggressive: number;          // Estimated APY for aggressive tier
    };
    utilization: {
      put: number;                 // PUT pool utilization percentage
      call: number;                // CALL pool utilization percentage
      overall: number;             // Overall pool utilization percentage
    };
  };
  
  // Time-series data
  timeSeriesData: {
    period: 'daily' | 'weekly' | 'monthly';
    startDate: Date;
    endDate: Date;
    intervals: {
      timestamp: Date;
      btcPrice: number;
      activePoliciesCount: number;
      newPoliciesCount: number;
      expiredPoliciesCount: number;
      activatedPoliciesCount: number;
      premiumsCollected: number;
      protectedValue: number;
      putUtilization: number;
      callUtilization: number;
      putYield: number;
      callYield: number;
    }[];
  };
}
```

#### 2.4.3. Market Recommendations

```typescript
interface MarketRecommendation {
  recommendationId: string;        // UUID
  timestamp: Date;                 // Recommendation timestamp
  targetPersona: 'protection' | 'income' | 'both';
  recommendationType: 'protection-level' | 'duration' | 'risk-tier' | 'capital-allocation';
  marketCondition: string;         // Description of current market condition
  recommendation: string;          // Recommendation text
  confidenceLevel: 'low' | 'medium' | 'high';
  
  // Protection buyer (Peter) specific
  protectionRecommendation?: {
    recommendedProtectionLevel: number;
    recommendedDuration: number;
    rationale: string;
    expectedSavings: number;
  };
  
  // Income provider (Irene) specific
  incomeRecommendation?: {
    recommendedRiskTier: 'conservative' | 'balanced' | 'aggressive';
    expectedYield: number;
    acquisitionLikelihood: 'low' | 'medium' | 'high';
    rationale: string;
  };
  
  // Supporting data
  supportingData: {
    currentPrice: number;
    priceVolatility: number;
    marketTrend: string;
    technicalIndicators: Record<string, number>;
    cyclicalFactors: string[];
  };
}
```

### 2.5. Protection Simulation Service

Provides simulation capabilities for protection outcomes.

#### 2.5.1. Protection Simulation Config

```typescript
interface ProtectionSimulationConfig {
  simulationId: string;            // UUID
  userId: string;                  // Reference to user
  timestamp: Date;                 // Simulation timestamp
  
  // Basic parameters
  initialPrice: number;            // Starting BTC price
  protectedValue: number;          // Strike price
  protectedAmount: number;         // Amount to protect
  premium: number;                 // Cost of protection
  duration: number;                // Duration in days
  policyType: 'PUT' | 'CALL';      // Policy type
  
  // Simulation configuration
  simulationParameters: {
    volatilityAssumption: number;  // Volatility assumption
    pricePaths: number;            // Number of price paths to simulate
    confidenceInterval: number;    // Confidence interval for results
    includeFees: boolean;          // Whether to include fees in calculation
    maxPriceDeviation: number;     // Maximum price deviation to consider
    timeSteps: number;             // Number of time steps in simulation
    modelType: 'black-scholes' | 'monte-carlo' | 'historical';
  };
  
  // Advanced parameters
  advancedParameters?: {
    customVolatilitySurface: {x: number, y: number}[];
    seasonalityAdjustment: boolean;
    halvingCycleAdjustment: boolean;
    stressScenarios: {
      scenario: string;
      priceDeviation: number;
    }[];
  };
}
```

#### 2.5.2. Protection Simulation Result

```typescript
interface ProtectionSimulationResult {
  resultId: string;                // UUID
  simulationId: string;            // Reference to simulation config
  timestamp: Date;                 // Result timestamp
  
  // Summary statistics
  summary: {
    expectedValue: number;         // Expected value of protection
    standardDeviation: number;     // Standard deviation of outcomes
    percentileOutcomes: {
      p10: number;                 // 10th percentile outcome
      p25: number;                 // 25th percentile outcome
      p50: number;                 // 50th percentile (median) outcome
      p75: number;                 // 75th percentile outcome
      p90: number;                 // 90th percentile outcome
    };
    activationProbability: number; // Probability of protection activation
    breakEvenProbability: number;  // Probability of breaking even
    expectedPayout: number;        // Expected payout
    returnOnPremium: number;       // Expected return on premium
  };
  
  // Price path data
  pricePaths: {
    pathId: number;                // Path identifier
    finalPrice: number;            // Final price at expiration
    minPrice: number;              // Minimum price during path
    maxPrice: number;              // Maximum price during path
    activated: boolean;            // Whether protection activated
    activationPrice?: number;      // Price at activation (if activated)
    payout: number;                // Payout amount
    timePoints: {
      day: number;                 // Day number
      price: number;               // Price on that day
    }[];
  }[];
  
  // Sensitivity analysis
  sensitivityAnalysis: {
    volatility: {                  // Effect of changing volatility
      values: number[];            // Volatility values
      expectedValues: number[];    // Corresponding expected values
    };
    strike: {                      // Effect of changing strike price
      values: number[];            // Strike price values
      expectedValues: number[];    // Corresponding expected values
    };
    duration: {                    // Effect of changing duration
      values: number[];            // Duration values
      expectedValues: number[];    // Corresponding expected values
    };
  };
  
  // Visual data
  visualData: {
    payoffCurve: {x: number, y: number}[];
    probabilityDistribution: {x: number, y: number}[];
    timeValueDecay: {x: number, y: number}[];
  };
}
```

### 2.6. Premium Calculator Service

Performs off-chain premium calculations and value simulations.

#### 2.6.1. Premium Calculation Request

```typescript
interface PremiumCalculationRequest {
  requestId: string;               // UUID
  timestamp: Date;                 // Request timestamp
  
  // Core parameters
  policyType: 'PUT' | 'CALL';      // Policy type
  protectedValue: number;          // Strike price
  currentPrice: number;            // Current BTC price
  protectedAmount: number;         // Amount to protect
  durationDays: number;            // Duration in days
  
  // User context
  userId?: string;                 // Optional user reference
  userRiskTier?: 'conservative' | 'balanced' | 'aggressive';
  preferredDisplay?: 'STX' | 'USD' | 'BTC' | 'percentage';
  
  // Model parameters
  modelParameters?: {
    volatilityOverride?: number;   // Override default volatility
    riskFreeRate?: number;         // Risk-free rate
    dividendYield?: number;        // Dividend yield (typically 0 for BTC)
    skewAdjustment?: number;       // Adjustment for volatility skew
    customParameters?: Record<string, number>;
  };
}
```

#### 2.6.2. Premium Calculation Result

```typescript
interface PremiumCalculationResult {
  resultId: string;                // UUID
  requestId: string;               // Reference to request
  timestamp: Date;                 // Result timestamp
  
  // Basic premium results
  premium: {
    stx: number;                   // Premium in STX satoshis
    usd: number;                   // Premium in USD
    btc: number;                   // Premium in BTC satoshis
    percentage: number;            // Premium as percentage of protected value
  };
  
  // Fee breakdown
  fees: {
    base: number;                  // Base premium
    platformFee: number;           // Platform fee
    networkFee: number;            // Network fee
    total: number;                 // Total cost
  };
  
  // Calculation factors
  calculationFactors: {
    impliedVolatility: number;     // Implied volatility used
    timeValue: number;             // Time value component
    intrinsicValue: number;        // Intrinsic value component
    durationFactor: number;        // Effect of duration
    moneynessFactor: number;       // Effect of moneyness
    utilizationFactor: number;     // Effect of pool utilization
  };
  
  // Comparative metrics
  comparativeMetrics: {
    annualizedCost: number;        // Annualized cost percentage
    costPerProtectionUnit: number; // Cost per BTC
    marketComparisonPercentage: number; // Comparison to theoretical market rate
  };
  
  // Risk metrics
  riskMetrics: {
    delta: number;                 // Option delta
    gamma: number;                 // Option gamma
    theta: number;                 // Option theta
    vega: number;                  // Option vega
    rho: number;                   // Option rho
  };
}
```

### 2.7. Educational Content Service

Manages educational content and user learning progression.

#### 2.7.1. Educational Concept

```typescript
interface EducationalConcept {
  conceptId: string;               // UUID
  title: string;                   // Concept title
  slug: string;                    // URL-friendly identifier
  category: 'basics' | 'protection' | 'income' | 'market' | 'technical';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];                  // Content tags
  
  // Content variants for different terminology preferences
  content: {
    bitcoinNative: string;         // Bitcoin-native terminology version
    balanced: string;              // Balanced terminology version
    insurance: string;             // Insurance-adjacent terminology version
  };
  
  // Visual elements
  visualElements: {
    elementType: 'image' | 'chart' | 'diagram' | 'animation';
    title: string;
    description: string;
    path: string;                  // Path to visual resource
  }[];
  
  // References
  relatedConcepts: string[];       // IDs of related concepts
  prerequisites: string[];         // IDs of prerequisite concepts
  nextConcepts: string[];          // IDs of recommended next concepts
  
  // Engagement tracking
  engagementMetrics: {
    viewCount: number;
    averageTimeSpent: number;      // In seconds
    completionRate: number;        // Percentage of users completing
    helpfulnessRating: number;     // Average user rating
  };
}
```

#### 2.7.2. User Learning Progress

```typescript
interface UserLearningProgress {
  progressId: string;              // UUID
  userId: string;                  // Reference to user
  conceptId: string;               // Reference to concept
  
  // Progress tracking
  status: 'not-started' | 'in-progress' | 'completed';
  firstViewedAt?: Date;            // When first viewed
  completedAt?: Date;              // When completed
  viewCount: number;               // Number of views
  totalTimeSpent: number;          // Total time spent (seconds)
  lastViewedAt?: Date;             // When last viewed
  
  // User feedback
  userRating?: number;             // User rating (1-5)
  userFeedback?: string;           // User feedback text
  helpfulnessRating?: number;      // User helpfulness rating (1-5)
  
  // Quizzes and verification
  quizAttempts?: {
    attemptId: string;
    timestamp: Date;
    score: number;
    maxScore: number;
    passThreshold: number;
    passed: boolean;
    answerHistory: {
      questionId: string;
      correctAnswer: boolean;
      timeSpent: number;
    }[];
  }[];
}
```

### 2.8. Notification Service

Manages notifications across multiple channels.

#### 2.8.1. Notification Template

```typescript
interface NotificationTemplate {
  templateId: string;              // UUID
  templateKey: string;             // Unique key for template
  notificationType: 'policy' | 'market' | 'account' | 'system' | 'educational';
  channels: ('email' | 'push' | 'in-app')[];
  
  // Content variants for different channels
  content: {
    email: {
      subject: string;
      preheader: string;
      bodyHtml: string;
      bodyText: string;
    };
    push: {
      title: string;
      body: string;
      actionText?: string;
    };
    inApp: {
      title: string;
      message: string;
      icon: string;
      action?: {
        text: string;
        url: string;
      };
    };
  };
  
  // Personalization placeholders
  placeholders: string[];          // List of valid placeholders
  
  // Schedule settings
  scheduleSettings: {
    throttling: boolean;           // Whether to throttle similar notifications
    throttleWindow: number;        // Window for throttling in minutes
    priority: 'low' | 'normal' | 'high' | 'urgent';
    timeOfDayRestriction: boolean;
    allowedHoursStart?: number;
    allowedHoursEnd?: number;
  };
}
```

#### 2.8.2. Notification Delivery Record

```typescript
interface NotificationDeliveryRecord {
  deliveryId: string;              // UUID
  notificationId: string;          // Reference to notification
  userId: string;                  // Reference to user
  channel: 'email' | 'push' | 'in-app';
  
  // Delivery status
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  scheduledFor: Date;              // When scheduled for delivery
  sentAt?: Date;                   // When sent
  deliveredAt?: Date;              // When delivered (if tracked)
  failedAt?: Date;                 // When failed (if applicable)
  failureReason?: string;          // Reason for failure
  
  // Engagement tracking
  opened: boolean;                 // Whether opened/read
  openedAt?: Date;                 // When opened
  clicked: boolean;                // Whether any link was clicked
  clickedAt?: Date;                // When clicked
  actionTaken: boolean;            // Whether action was taken
  actionType?: string;             // Type of action taken
}
```

### 2.9. API Gateway & Authentication

Manages API access and authentication.

#### 2.9.1. API Key

```typescript
interface ApiKey {
  keyId: string;                   // UUID
  userId: string;                  // Reference to user
  apiKey: string;                  // Hashed API key
  name: string;                    // User-defined name
  createdAt: Date;                 // Creation timestamp
  lastUsedAt?: Date;               // Last usage timestamp
  
  // Usage controls
  permissions: {
    read: boolean;
    write: boolean;
    data: boolean;
    admin: boolean;
  };
  
  // Security settings
  securitySettings: {
    ipRestrictions: string[];      // Allowed IP addresses/ranges
    rateLimit: number;             // Requests per minute
    expirationDate?: Date;         // Optional expiration date
    requireSignatures: boolean;    // Whether request signing is required
  };
  
  // Usage metrics
  usageMetrics: {
    totalRequests: number;
    lastHourRequests: number;
    lastDayRequests: number;
    errors: number;
    lastErrorAt?: Date;
  };
}
```

#### 2.9.2. Authentication Session

```typescript
interface AuthSession {
  sessionId: string;               // UUID
  userId: string;                  // Reference to user
  wallet: {
    address: string;               // Wallet address
    publicKey: string;             // Public key used for signing
  };
  
  // Session data
  createdAt: Date;                 // Session creation timestamp
  expiresAt: Date;                 // Session expiration timestamp
  lastActivityAt: Date;            // Last activity timestamp
  ipAddress: string;               // IP address used
  userAgent: string;               // User agent string
  
  // Security
  challenge: string;               // Challenge used for signature verification
  signature: string;               // Signature of challenge
  jwtToken: string;                // Encrypted JWT token
  
  // Status
  status: 'active' | 'expired' | 'revoked';
  revokedAt?: Date;                // When revoked (if applicable)
  revocationReason?: string;       // Reason for revocation
}
```

### 2.10. Analytics Engine

Collects and processes platform analytics while respecting privacy.

#### 2.10.1. Aggregate Usage Metrics

```typescript
interface AggregateUsageMetrics {
  metricId: string;                // UUID
  metricKey: string;               // Unique metric identifier
  timestamp: Date;                 // Metric timestamp
  timeframe: 'hourly' | 'daily' | 'weekly' | 'monthly';
  
  // User metrics
  userMetrics: {
    activeUsers: number;           // Active users in period
    newUsers: number;              // New users in period
    returningUsers: number;        // Returning users in period
    protectionUsers: number;       // Users using protection
    incomeUsers: number;           // Users providing income
    dualPersonaUsers: number;      // Users doing both
  };
  
  // Transaction metrics
  transactionMetrics: {
    totalTransactions: number;     // All on-chain transactions
    policiesCreated: number;       // New policies created
    policiesActivated: number;     // Policies activated
    policiesExpired: number;       // Policies expired
    depositsMade: number;          // Deposits made
    withdrawalsMade: number;       // Withdrawals made
    averageGasUsed: number;        // Average gas used per transaction
  };
  
  // Financial metrics
  financialMetrics: {
    totalProtectedValue: number;   // Total value protected
    totalPremiumsCollected: number; // Total premiums collected
    totalYieldDistributed: number; // Total yield distributed
    platformRevenueGenerated: number; // Platform revenue generated
    averagePolicySize: number;     // Average policy size
    averagePremiumRate: number;    // Average premium as percentage
  };
  
  // Performance metrics
  performanceMetrics: {
    averageResponseTime: number;   // API response time
    p95ResponseTime: number;       // 95th percentile response time
    errorRate: number;             // Error rate percentage
    successfulTransactions: number; // Successful transactions
    failedTransactions: number;    // Failed transactions
  };
}
```

#### 2.10.2. Anonymized User Flow

```typescript
interface AnonymizedUserFlow {
  flowId: string;                  // UUID
  anonymizedUserId: string;        // Hashed user identifier
  sessionId: string;               // Session identifier
  startedAt: Date;                 // Flow start timestamp
  completedAt: Date;               // Flow completion timestamp
  
  // Flow definition
  flowType: 'protection-creation' | 'income-setup' | 'policy-activation' | 'deposit' | 'withdrawal' | 'education';
  startingPoint: string;           // Entry point to flow
  outcome: 'completed' | 'abandoned' | 'error';
  
  // Steps data (anonymized)
  steps: {
    stepNumber: number;
    stepId: string;                // Step identifier
    startedAt: Date;               // Step start timestamp
    completedAt?: Date;            // Step completion timestamp
    timeSpent: number;             // Time spent in seconds
    interactions: number;          // Number of interactions
    hasError: boolean;             // Whether step had errors
    retries: number;               // Number of retries
    outcome: 'completed' | 'abandoned' | 'back' | 'skip' | 'error';
  }[];
  
  // Contextual factors (anonymized)
  contextualFactors: {
    deviceType: 'mobile' | 'tablet' | 'desktop';
    browserCategory: string;
    countryCode: string;
    connectionType: 'wifi' | 'cellular' | 'unknown';
    dayOfWeek: number;             // 0-6 (Sunday-Saturday)
    hourOfDay: number;             // 0-23
    marketCondition: string;       // Market condition during flow
  };
}
```

## 3. Data Relationships and Entity Interactions

### 3.1. Protection Center Data Flow

The Protection Center (serving Protective Peter) interacts with data entities as follows:

```
User Profile -> Authentication -> Protection Configuration
     |               |                      |
     v               v                      v
User Preferences   Sessions         Enhanced Policy Entity
     |               |                      |
     v               v                      v
Notification     Log/Analytics      On-chain Policy Data
 Settings           Data                    |
                                           v
                                   Premium Calculation
                                           |
                                           v
                                  Protection Simulation
```

Key relationships:
1. User Profile dictates terminology preferences used throughout the Protection Center
2. Authentication session governs wallet connections and transaction signing
3. Protection Configuration steps build Policy entity progressively
4. Premium calculation depends on policy parameters, market data, and pool state
5. On-chain Policy data is created through transactions to the Policy Registry Contract
6. Enhanced Policy entity extends on-chain data with additional metadata and visualizations

### 3.2. Income Center Data Flow

The Income Center (serving Income Irene) interacts with data entities as follows:

```
User Profile -> Authentication -> Income Strategy Setup
     |               |                      |
     v               v                      v
User Preferences   Sessions         Strategy Entity
     |               |                      |
     v               v                      |
Notification     Log/Analytics      Risk Tier Selection
 Settings           Data                    |
                                           v
                                    Capital Commitment
                                           |
                                           v
                                   Yield Calculation
                                           |
                                           v
                                  On-chain Pool Deposit
```

Key relationships:
1. User Profile governs display preferences for yield information
2. Income Strategy setup creates Strategy entity in off-chain layer
3. Strategy connects to on-chain deposits in Liquidity Pool Contract
4. Risk Tier selection maps to specific collateralization parameters
5. Yield Calculation depends on risk tier, market conditions, and utilization
6. Capital Commitment tracks relationship between deposited funds and active policies

### 3.3. Cross-Layer Data Synchronization

Communication between on-chain and off-chain data layers:

```
On-Chain               |           Off-Chain
---------------------- | -----------------------
Policy Registry        | Enhanced Policy Service
     |                 |            |
     v                 |            v
Event Emission         |       Event Indexing
     |                 |            |
     v                 |            v
Blockchain State       |    Cache & Database
     |                 |            |
     v                 |            v
Transaction Submission |    Transaction Preparation
```

Synchronization mechanisms:
1. Events emitted by on-chain contracts are captured by off-chain indexers
2. Off-chain caches maintain synchronized state of on-chain data
3. Off-chain services prepare transactions that modify on-chain state
4. Wallet connections bridge authentication between layers
5. Price oracle data flows from off-chain aggregators to on-chain contracts

## 4. Data Migration and Versioning Strategy

### 4.1. On-Chain Data Versioning

The Clarity smart contracts implement a versioning strategy for contract upgrades:

```clarity
;; Contract version tracking
(define-data-var contract-version uint u1)

;; Data migration flag
(define-data-var migration-active bool false)

;; Migration tracking
(define-map migration-status
  { version: uint }
  {
    started-at: uint,
    completed-at: uint,
    migrated-records: uint,
    status: (string-ascii 20)
  }
)
```

Migration process:
1. New contract version is deployed alongside existing version
2. Migration function transfers data to new contract structure
3. Registry pointers are updated to reference new contract version
4. Old contract data is archived but remains accessible

### 4.2. Off-Chain Database Schemas

The off-chain TypeScript/Convex implementation uses schema versioning:

```typescript
interface SchemaVersion {
  schemaId: string;              // UUID for schema
  entityType: string;            // Entity type name
  version: number;               // Schema version number
  createdAt: Date;               // When schema was created
  activatedAt: Date;             // When schema became active
  deprecatedAt?: Date;           // When schema was deprecated
  
  // Schema definition
  jsonSchema: object;            // JSON Schema definition
  
  // Migration
  migrationScript?: string;      // Migration script reference
  rollbackScript?: string;       // Rollback script reference
  validationRules: string[];     // Validation rules
}
```

Migration strategies:
1. Schema versioning uses explicit version numbers
2. Data migration scripts handle schema evolution
3. Multi-version support during transition periods
4. Backward compatibility for critical fields
5. Forward migration of existing records on access

## 5. Implementation Considerations

### 5.1. Convex Specific Optimizations

For the TypeScript/Convex off-chain layer:

1. **Indexing Strategy**:
   - Create custom indexes for frequent query patterns
   - Implement materialized views for complex aggregations
   - Use time-series optimized collections for price and metric data

2. **Query Optimization**:
   - Design efficient document structures to minimize joins
   - Implement appropriate pagination for large data sets
   - Use projection queries to fetch only needed fields

3. **Performance Considerations**:
   - Implement caching for frequently accessed data
   - Use bulk operations for batch processing
   - Implement optimistic concurrency control for updates

### 5.2. Clarity Specific Optimizations

For the Clarity on-chain layer:

1. **Storage Efficiency**:
   - Minimize on-chain data storage to reduce costs
   - Use uint scaling for decimal values (e.g., 1,000,000 scaling)
   - Implement efficient data structures with minimal redundancy

2. **Gas Optimization**:
   - Optimize transaction costs through efficient data structures
   - Minimize loop iterations and recursive calls
   - Implement batched operations where appropriate

3. **Contract Security**:
   - Implement access control patterns consistently
   - Use explicit assertions for all state-changing operations
   - Maintain clear separation of concerns between contracts

## 6. Privacy and Security Considerations

### 6.1. Data Security Model

1. **Authentication**:
   - Multi-factor wallet-based authentication
   - Challenge-response authentication for API access
   - Session timeout and automatic logout mechanisms

2. **Authorization**:
   - Role-based access control with principle of least privilege
   - Time-bound access tokens with limited scope
   - Explicit permission model for all sensitive operations

3. **Data Protection**:
   - Encryption of sensitive off-chain data
   - Anonymization of analytics and usage data
   - Secure key management for API credentials

### 6.2. Privacy-Preserving Analytics

1. **Data Minimization**:
   - Collect only essential data for platform operation
   - Implement data retention policies with regular purging
   - Use differential privacy techniques for aggregate analytics

2. **User Control**:
   - Opt-in model for non-essential data collection
   - Transparency about data usage and storage
   - User-accessible data export and deletion mechanisms

3. **Security Mechanisms**:
   - Regular security audits of data handling processes
   - Clear incident response procedures
   - Data breach notification protocols

## Conclusion

This comprehensive data model provides a complete blueprint for building the BitHedge platform, supporting both the Protection Center for Protective Peter and the Income Center for Income Irene. The model balances on-chain integrity with off-chain flexibility, creating a system that is both trustless and user-friendly.

The dual-layer architecture enables a progressive transition from an assisted counterparty model to a peer-to-peer marketplace while maintaining a consistent user experience. By implementing this data model, the BitHedge platform can achieve its goal of democratizing options-based protection for Bitcoin holders through an intuitive, Bitcoin-native interface.
