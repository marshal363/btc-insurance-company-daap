# BitHedge Technical Architecture - Assisted Counterparty Model (Part 2)

## 4. Off-Chain Components and Infrastructure

The BitHedge protocol combines on-chain smart contracts with off-chain components that enhance performance, improve user experience, and manage system complexity. Together, these elements create a cohesive system that balances decentralization with practical user needs.

### 4.1 System Component Overview

The off-chain architecture consists of the following key components:

1. **Index and Cache Service**: Indexes blockchain data for fast querying
2. **Policy Lifecycle Manager**: Monitors policy status and triggers notifications
3. **Premium Calculator Service**: Performs complex options pricing calculations
4. **User Profile Service**: Manages user preferences and settings
5. **Notification Service**: Delivers timely alerts and updates to users
6. **Analytics Engine**: Tracks protocol metrics and market trends
7. **Oracle Feed Aggregator**: Collects and validates price data from multiple sources
8. **Translation Layer**: Maps technical variables to Bitcoin-native concepts

```
                           +---------------+
                           |  Client Web   |
                           |  Application  |
                           +-------+-------+
                                   |
                                   v
+----------------+       +-------------------+       +----------------+
| Authentication |<----->| API Gateway       |<----->| Rate Limiting  |
|   Service      |       | & GraphQL Server  |       |   Service      |
+----------------+       +--------+----------+       +----------------+
                                  |
                                  |
        +---------------------+---+---+---------------------+
        |                     |       |                     |
        v                     v       v                     v
+-------+-------+    +--------+----+  +--------+----+    +--+------------+
| Index & Cache |    | Policy Life |  | Premium Calc |    | User Profile  |
|   Service     |<-->| cycle Mgr   |  |   Service    |    |   Service     |
+---------------+    +-------------+  +-------------+    +---------------+
        |                   |                |                   |
        |                   |                |                   |
        v                   v                v                   v
+-------+-------+    +------+------+    +----+---------+    +---+----------+
| Analytics     |    | Notification |    | Oracle Feed  |    | Translation  |
|   Engine      |    |   Service    |    |  Aggregator  |    |    Layer     |
+---------------+    +-------------+    +--------------+    +--------------+
        |                   |                 |                    |
        +-------------------+-----------------+--------------------+
                            |
                            v
                    +-------+--------+
                    | Stacks Blockchain |
                    | Smart Contracts   |
                    +-----------------+
```

### 4.2 Index and Cache Service

#### 4.2.1 Purpose and Functions

The Index and Cache Service creates fast, queryable indexes of blockchain data to enable responsive user interfaces without requiring direct blockchain queries for every operation.

Key functions include:

1. Monitoring contract events for new policies, activations, and expirations
2. Building searchable indexes of policy data by owner, type, status, and expiration
3. Caching frequently accessed data like protection offers and price history
4. Supporting complex queries that would be impractical on-chain
5. Enabling fast portfolio views and activity histories

#### 4.2.2 Implementation Requirements

- **Real-time Synchronization**: Maintain near-instant sync with blockchain state
- **Fault Tolerance**: Robust recovery from network or node failures
- **Data Integrity**: Cryptographic verification of indexed data against on-chain state
- **Query Performance**: Sub-second response time for common queries
- **Scale Handling**: Support for millions of policies and related events

#### 4.2.3 Technical Specifications

- **Database**: MongoDB for flexible document storage and indexing
- **Sync Mechanism**: WebSocket subscription to Stacks events with fallback polling
- **Caching Strategy**: Tiered caching with Redis for hot data
- **Consistency Model**: Eventually consistent with versioned documents
- **API Exposure**: GraphQL API with custom query resolvers

### 4.3 Policy Lifecycle Manager

#### 4.3.1 Purpose and Functions

The Policy Lifecycle Manager monitors the status of all protection policies and handles state transitions based on price conditions, time factors, and user actions.

Key functions include:

1. Tracking approaching expiration dates and sending timely reminders
2. Monitoring price conditions for potential protection activation scenarios
3. Providing activation recommendations when policies become valuable
4. Managing the workflow for policy creation, pricing, and settlement
5. Coordinating between blockchain state and user interface

#### 4.3.2 Implementation Requirements

- **Reliable Monitoring**: Zero missed expirations or activation opportunities
- **Efficient Processing**: Handle thousands of active policies with minimal resources
- **Customizable Alerts**: User-configurable notification thresholds and preferences
- **Transaction Handling**: Smooth preparation and submission of blockchain transactions
- **Recovery Mechanism**: Robust handling of failed transactions and network issues

#### 4.3.3 Technical Specifications

- **Event Processing**: Event-driven architecture using message queues (RabbitMQ)
- **Scheduling System**: Distributed task scheduling with failover (Temporal)
- **State Machine**: Clear policy lifecycle states with defined transitions
- **Transaction Management**: Queue-based transaction submission with confirmation tracking
- **Metrics Collection**: Comprehensive monitoring of lifecycle events for analytics

### 4.4 Premium Calculator Service

#### 4.4.1 Purpose and Functions

The Premium Calculator Service performs complex options pricing calculations that would be prohibitively expensive to execute entirely on-chain, while maintaining alignment with on-chain pricing parameters.

Key functions include:

1. Implementing the Bitcoin-adjusted Black-Scholes options pricing model
2. Calculating premiums based on volatility, time value, and moneyness
3. Providing real-time premium quotes for the interface
4. Simulating various pricing scenarios for user education
5. Supporting the algorithmic market making function of the liquidity pool

#### 4.4.2 Implementation Requirements

- **Calculation Speed**: Sub-50ms premium calculations for interface responsiveness
- **Accuracy**: Results within 0.5% of on-chain calculation results
- **Volatility Modeling**: Bitcoin-specific volatility patterns and seasonality
- **Scenario Support**: Fast simulation of different market conditions
- **Parameter Synchronization**: Real-time sync with on-chain risk parameters

#### 4.4.3 Technical Specifications

- **Optimization**: Numerical methods optimized for options calculations
- **Caching**: Strategic caching of intermediate calculation results
- **Volatility Modeling**: Historical volatility analysis with GARCH models
- **Algorithm**: Modified Black-Scholes with Bitcoin-specific adjustments
- **API Design**: Simple interface for quote generation with comprehensive parameters

### 4.5 User Profile Service

#### 4.5.1 Purpose and Functions

The User Profile Service manages user preferences, settings, and personalized experiences while respecting the self-custodial nature of the protocol.

Key functions include:

1. Storing interface preferences and settings
2. Managing notification preferences and contact information
3. Tracking user-selected terminology preferences
4. Maintaining activity history and portfolio views
5. Supporting customizable dashboard configurations

#### 4.5.2 Implementation Requirements

- **Privacy First**: Minimal personal data collection, encryption of sensitive information
- **Optional Usage**: Full protocol functionality without mandatory profile creation
- **Data Portability**: Easy export of all user-specific data
- **Preference Management**: Granular control over all stored preferences
- **Self-Custody Alignment**: No custody of assets or private keys

#### 4.5.3 Technical Specifications

- **Storage**: Encrypted database with user-controlled access keys
- **Authentication**: Integration with Stacks authentication (Connect)
- **Data Model**: Minimal schema focused on preferences and settings
- **Privacy Design**: Zero-knowledge approaches where appropriate
- **Backup System**: Encrypted backups with user-controlled restoration

### 4.6 Notification Service

#### 4.6.1 Purpose and Functions

The Notification Service delivers timely alerts about policy status, market conditions, and important protocol events through multiple channels.

Key functions include:

1. Sending expiration reminders for active policies
2. Alerting users to favorable activation conditions
3. Notifying about significant Bitcoin price movements
4. Communicating protocol updates and governance actions
5. Delivering educational content and usage tips

#### 4.6.2 Implementation Requirements

- **Multi-Channel Support**: Email, push notifications, and in-app alerts
- **Delivery Reliability**: Guaranteed delivery with retry mechanisms
- **User Control**: Fine-grained control over notification types and frequency
- **Relevance Filtering**: Smart filtering to prevent notification fatigue
- **Compliance**: Adherence to relevant messaging regulations

#### 4.6.3 Technical Specifications

- **Architecture**: Event-driven notification dispatcher
- **Delivery Services**: Integration with multiple messaging providers for redundancy
- **Templating System**: Localized, personalized notification templates
- **Tracking**: Delivery and engagement metrics for system optimization
- **Channel Management**: User-defined priority channels for different notification types

### 4.7 Analytics Engine

#### 4.7.1 Purpose and Functions

The Analytics Engine collects and analyzes protocol metrics to provide valuable insights for both users and governance, while maintaining privacy and avoiding centralized data accumulation.

Key functions include:

1. Tracking aggregate protocol usage and growth metrics
2. Analyzing market trends and protection patterns
3. Monitoring system health and performance indicators
4. Supporting governance decisions with data-driven insights
5. Providing anonymized benchmarks for user portfolios

#### 4.7.2 Implementation Requirements

- **Privacy Preservation**: Aggregate data without individual identification
- **Real-time Processing**: Current metrics available with minimal delay
- **Comprehensive Coverage**: Track all relevant protocol activities
- **Visualization**: Clear data presentation for different stakeholders
- **Governance Support**: Specific analytics for parameter optimization

#### 4.7.3 Technical Specifications

- **Data Pipeline**: Streaming analytics pipeline with aggregation stages
- **Storage Strategy**: Time-series database for historical analysis
- **Computation Model**: Mix of real-time and batch processing
- **Anonymization**: Robust techniques to prevent re-identification
- **API Access**: Tiered access to different levels of analytical data

### 4.8 Oracle Feed Aggregator

#### 4.8.1 Purpose and Functions

The Oracle Feed Aggregator collects, validates, and processes price data from multiple sources before submitting it to the on-chain Oracle Contract, ensuring reliable and manipulation-resistant price feeds.

Key functions include:

1. Gathering price data from multiple exchanges and data providers
2. Applying statistical filters to remove outliers and detect manipulation
3. Computing aggregate price values with confidence intervals
4. Preparing signed price updates for on-chain submission
5. Monitoring oracle performance and reliability metrics

#### 4.8.2 Implementation Requirements

- **Data Diversity**: At least 5 independent price sources for core assets
- **Manipulation Resistance**: Statistical techniques to identify anomalies
- **Update Frequency**: Price updates at least every 5 minutes
- **Fail-Safe Operation**: Graceful handling of source outages
- **Transparency**: Clear methodology for price determination

#### 4.8.3 Technical Specifications

- **Source Management**: Weighted aggregation of price sources
- **Anomaly Detection**: Volatility-aware outlier detection algorithms
- **Update Protocol**: Threshold-signed updates with multiple validators
- **Fallback System**: Secondary price determination methods
- **Monitoring**: Real-time feed quality and availability metrics

## 5. UI/UX Translation Layer

### 5.1 Options to Insurance Translation System

The translation layer is the critical bridge between traditional options mechanics and the Bitcoin-native insurance concept, transforming complex financial variables into intuitive protection language without compromising underlying functionality.

#### 5.1.1 Translation Principles

1. **Consistent Metaphor**: Maintain insurance framing throughout the experience
2. **Mental Model Alignment**: Match existing understanding of protection concepts
3. **Bitcoin-Native Terminology**: Incorporate familiar Bitcoin cultural elements
4. **Progressive Disclosure**: Reveal complexity gradually as user sophistication increases
5. **Dual Presentation**: Support both technical and simplified views for different users

#### 5.1.2 Core Variable Translations

The following table summarizes the key variable translations implemented in the BitHedge interface:

| Technical Variable      | Protection Buyer (Peter) Translation | Protection Provider (Irene) Translation               |
| ----------------------- | ------------------------------------ | ----------------------------------------------------- |
| Strike Price            | Protected Value / Value Shield       | Yield Activation Level / Target Entry Price           |
| Option Type (PUT/CALL)  | Protection Goal                      | Income Strategy                                       |
| Expiration Date         | Protection Period / HODL Horizon     | Income Period / Yield Timeline                        |
| Contract Size           | Protected Portion / Stack Portion    | Capital Commitment / Yield Capital                    |
| Premium                 | Protection Cost / HODL Fee           | Yield Income / Strategy Income                        |
| Moneyness (ITM/ATM/OTM) | Protection Strategy / Risk Level     | Risk-Yield Balance / Income Profiles                  |
| Exercise Process        | Activation Process / Value Lock-In   | Yield Distribution Process / Stack Builder Settlement |
| Option Greeks           | [Hidden from interface]              | [Hidden from interface]                               |
| Settlement Method       | Protection Outcome                   | Strategy Outcome                                      |
| Mark-to-Market Value    | Current Protection Value             | Current Strategy Value                                |

#### 5.1.3 Implementation Architecture

The translation layer operates at multiple levels of the stack:

```
+------------------+       +------------------+       +------------------+
| Technical Smart  |       | Translation      |       | User Interface   |
| Contract Layer   |<----->| Middleware       |<----->| Layer            |
+------------------+       +------------------+       +------------------+
  ^                          |          ^               |            ^
  |                          v          |               v            |
+------------------+       +------------------+       +------------------+
| Blockchain       |       | Application      |       | User Mental      |
| State            |       | Business Logic   |       | Models           |
+------------------+       +------------------+       +------------------+
```

Key architectural elements include:

1. **Bidirectional Mapping**: Each technical term has equivalent user-facing terms
2. **Context-Aware Translation**: Different translations based on user persona
3. **Persistence Layer**: Maintains selected terminology preferences
4. **Visualization Components**: Custom UI elements supporting the insurance metaphor
5. **Educational Elements**: Integrated explanation of protection concepts

#### 5.1.4 Technical Implementation

The translation layer is implemented as:

1. **Term Dictionary**: Comprehensive mapping of technical to user-friendly terms
2. **Input Processors**: Transform user-specified values into contract parameters
3. **Output Formatters**: Convert blockchain results into comprehensible information
4. **UI Component Library**: Insurance-themed interface elements
5. **Scenario Generators**: Predefined examples illustrating protection outcomes

### 5.2 Protective Peter Interface Implementation

The Protective Peter interface focuses on Bitcoin holders seeking downside protection, implementing the insurance metaphor with Bitcoin-native terminology.

#### 5.2.1 User Flow and Screens

The protection purchase flow consists of 5 key steps:

1. **Protection Goal Selection**:

   - "What are you looking to protect against?"
   - Options: "Protect against Bitcoin price drops" or "Lock in future purchase price"
   - Implementation: Simple binary selection with clear icons and descriptions

2. **Coverage Configuration**:

   - Protected Value selection via slider or manual entry
   - Protected Portion selection with wallet integration
   - Implementation: Visual slider showing protection level as percentage of current price

3. **Protection Period Selection**:

   - Tiered duration system aligned with Bitcoin market cycles
   - Implementation: Card-based duration options with clear implications

   ```
   +-------------------+  +-------------------+  +-------------------+
   | Standard          |  | Extended          |  | Strategic         |
   | Protection        |  | Protection        |  | Protection        |
   |                   |  |                   |  |                   |
   | • 30 Days         |  | • 6 Months        |  | • Until Next      |
   | • 60 Days         |  | • 1 Year          |  |   Halving         |
   | • 90 Days         |  |                   |  | • Custom Cycle    |
   +-------------------+  +-------------------+  +-------------------+
   ```

4. **Protection Strategy Selection**:

   - Preconfigured strategies based on risk level and cost
   - Implementation: Strategy cards with clear visualizations of risk-reward

   ```
   +-------------------+  +-------------------+  +-------------------+
   | HODL-Safe         |  | Current Value     |  | Crash Insurance   |
   | Strategy          |  | Guard             |  |                   |
   |                   |  |                   |  |                   |
   | • Maximum         |  | • Protection at   |  | • Cost-effective  |
   |   security        |  |   today's price   |  |   coverage        |
   | • Higher cost     |  | • Balanced cost   |  | • Major drops only|
   +-------------------+  +-------------------+  +-------------------+
   ```

5. **Review and Activate**:
   - Clear summary of protection parameters
   - Cost overview with sats denomination
   - Protection scenario visualization
   - Implementation: Interactive scenario slider showing different price outcomes

#### 5.2.2 Technical Components

Specific UI components designed for the Protective Peter experience:

1. **Protection Level Slider**:

   ```typescript
   interface ProtectionLevelSliderProps {
     currentPrice: number; // Current BTC price in USD
     onValueChange: (value: number) => void; // Callback with selected value
     defaultProtectionPercentage: number; // Default protection level (e.g., 90%)
     minProtectionPercentage: number; // Minimum allowed (e.g., 50%)
     maxProtectionPercentage: number; // Maximum allowed (e.g., 120%)
     formatValue?: (value: number) => string; // Optional custom formatter
   }
   ```

2. **Protection Period Selector**:

   ```typescript
   interface ProtectionPeriodOption {
     id: string;
     name: string;
     description: string;
     durationBlocks: number;
     durationDays: number;
     category: "standard" | "extended" | "strategic" | "custom";
     premium: number; // Relative premium factor
   }

   interface ProtectionPeriodSelectorProps {
     options: ProtectionPeriodOption[];
     onSelect: (option: ProtectionPeriodOption) => void;
     defaultSelected?: string; // Option ID
   }
   ```

3. **Protection Scenario Visualizer**:

   ```typescript
   interface ScenarioPoint {
     price: number;
     protectionValue: number;
     netPosition: number;
   }

   interface ProtectionScenarioVisualizerProps {
     currentPrice: number;
     protectedValue: number;
     premium: number;
     scenarios: ScenarioPoint[];
     onScenarioSelect?: (scenario: ScenarioPoint) => void;
   }
   ```

4. **Protection Cost Calculator**:
   ```typescript
   interface ProtectionCostCalculatorProps {
     protectedValue: number;
     protectedAmount: number;
     duration: number;
     policyType: "PUT" | "CALL";
     showInSats: boolean;
     premiumInSats: number;
     premiumInUsd: number;
     costToProtectionRatio: number; // Premium as percentage of protected value
     annualizedCost: number; // Annualized cost percentage
   }
   ```

### 5.3 Income Irene Interface Implementation

The Income Irene interface focuses on yield generation for protection providers, using different but complementary terminology that emphasizes income rather than protection.

#### 5.3.1 User Flow and Screens

The yield strategy flow consists of 5 key steps:

1. **Income Strategy Selection**:

   - "How do you want to generate income with your Bitcoin?"
   - Options: "Generate income from Bitcoin stability" or "Earn yield by lending upside potential"
   - Implementation: Goal-based selection emphasizing yield generation

2. **Income Configuration**:

   - Yield Activation Level selection via slider
   - Capital Commitment selection with wallet integration
   - Implementation: Visual slider showing potential yield rates at different levels

3. **Income Period Selection**:

   - Tiered duration system aligned with Bitcoin market cycles
   - Implementation: Card-based duration options with yield implications

   ```
   +-------------------+  +-------------------+  +-------------------+
   | Short-Term        |  | Extended          |  | Strategic         |
   | Income            |  | Income            |  | Income            |
   |                   |  |                   |  |                   |
   | • 30 Days         |  | • 6 Months        |  | • Until Next      |
   | • 60 Days         |  | • 1 Year          |  |   Halving         |
   | • 90 Days         |  |                   |  | • Custom Cycle    |
   +-------------------+  +-------------------+  +-------------------+
   ```

4. **Risk-Yield Balance Selection**:

   - Preconfigured strategies based on risk-reward profile
   - Implementation: Strategy cards with clear yield and risk implications

   ```
   +-------------------+  +-------------------+  +-------------------+
   | Conservative      |  | Balanced          |  | Aggressive        |
   | Yield             |  | Return            |  | Yield             |
   |                   |  |                   |  |                   |
   | • Lower risk      |  | • Moderate risk   |  | • Higher risk     |
   | • Modest yield    |  | • Standard yield  |  | • Premium yield   |
   | • Lower chance of |  | • Balanced risk   |  | • Higher chance   |
   |   acquisition     |  |   of acquisition  |  |   of acquisition  |
   +-------------------+  +-------------------+  +-------------------+
   ```

5. **Review and Activate**:
   - Clear summary of income strategy parameters
   - Yield overview with annualized percentage
   - Strategy outcome visualization
   - Implementation: Interactive scenario slider showing different price outcomes

#### 5.3.2 Technical Components

Specific UI components designed for the Income Irene experience:

1. **Yield Activation Slider**:

   ```typescript
   interface YieldActivationSliderProps {
     currentPrice: number; // Current BTC price in USD
     onValueChange: (value: number) => void; // Callback with selected value
     defaultActivationPercentage: number; // Default level (e.g., 90%)
     minActivationPercentage: number; // Minimum allowed (e.g., 50%)
     maxActivationPercentage: number; // Maximum allowed (e.g., 120%)
     formatValue?: (value: number) => string; // Optional custom formatter
     showYieldRate?: boolean; // Whether to show projected yield
     projectedYield?: (value: number) => number; // Calculate yield at this level
   }
   ```

2. **Capital Commitment Selector**:

   ```typescript
   interface CapitalCommitmentSelectorProps {
     availableBalance: number; // Available balance in STX/sBTC
     onAmountChange: (amount: number) => void;
     minAmount: number;
     maxAmount: number;
     showAsPercentage?: boolean; // Show selection as percentage of total
     estimatedYield?: (amount: number) => number; // Calculate yield for this amount
     showEquivalentValue?: boolean; // Show USD equivalent
   }
   ```

3. **Income Scenario Visualizer**:

   ```typescript
   interface IncomeScenario {
     price: number;
     outcome: "income" | "acquisition";
     yieldAmount: number;
     acquisitionAmount?: number;
   }

   interface IncomeScenarioVisualizerProps {
     currentPrice: number;
     activationLevel: number;
     premium: number;
     capital: number;
     annualizedYield: number;
     scenarios: IncomeScenario[];
     onScenarioSelect?: (scenario: IncomeScenario) => void;
   }
   ```

4. **Yield Calculator**:
   ```typescript
   interface YieldCalculatorProps {
     activationLevel: number;
     capitalAmount: number;
     duration: number;
     strategyType: "PUT" | "CALL";
     showInSats: boolean;
     incomeInSats: number;
     incomeInUsd: number;
     yieldPercentage: number; // Yield as percentage of capital
     annualizedYield: number; // Annualized yield percentage
     acquisitionChance: number; // Estimated probability of acquisition
   }
   ```

### 5.4 Terminology Personalization System

To accommodate different user preferences and experience levels, the system includes a terminology personalization framework that allows for customized language throughout the interface.

#### 5.4.1 User Preference Management

Users can select from three terminology systems:

1. **Bitcoin-Native Maximum**: Terminology deeply embedded in Bitcoin culture
2. **Balanced Bitcoin-Adjacent**: Terms that hint at Bitcoin knowledge while remaining approachable
3. **Insurance-Adjacent**: Familiar protection language with minimal Bitcoin jargon

Implementation details:

```typescript
enum TerminologySystem {
  BITCOIN_NATIVE,
  BALANCED,
  INSURANCE,
}

interface TerminologyPreferences {
  system: TerminologySystem;
  customOverrides?: {
    [key: string]: string; // Allow custom term overrides for specific variables
  };
  showTechnicalTerms?: boolean; // Whether to show technical terms alongside simplified ones
}

interface UserPreferences {
  terminology: TerminologyPreferences;
  denominationPreference: "SATS" | "BTC" | "USD" | "DUAL";
  notificationSettings: NotificationPreferences;
  // Other user preferences
}
```

#### 5.4.2 Adaptive Terminology Service

The application implements a service to consistently apply terminology preferences:

```typescript
interface TerminologyService {
  // Get the appropriate term based on user preferences and context
  getTerm(technicalTerm: string, context?: UserContext): string;

  // Get complete explanation for a term
  getTermExplanation(term: string): string;

  // Get visualization component appropriate for the term
  getVisualizationComponent(term: string): React.ComponentType<any>;

  // Update user terminology preferences
  updatePreferences(preferences: TerminologyPreferences): void;

  // Get term mapping for current preferences
  getCurrentTermMapping(): Record<string, string>;
}
```

#### 5.4.3 Progressive Disclosure System

The interface implements progressive disclosure of complexity based on user interactions:

```typescript
interface ProgressiveDisclosure {
  // User's current expertise level
  expertiseLevel: "beginner" | "intermediate" | "advanced";

  // Track concepts the user has been introduced to
  introducedConcepts: Set<string>;

  // Calculate appropriate detail level for explanation
  getExplanationDetail(concept: string): "basic" | "detailed" | "technical";

  // Record that user has viewed an explanation
  markConceptIntroduced(concept: string): void;

  // Check if a technical feature should be shown
  shouldShowTechnicalFeature(feature: string): boolean;
}
```

### 5.5 Educational Integration

Education is deeply integrated into the user experience through contextual tooltips, guided tours, and scenario simulations.

#### 5.5.1 Contextual Learning Elements

Each key concept includes in-context educational elements:

1. **Term Tooltips**: Brief explanations available on hover
2. **Concept Cards**: Expandable explainers for core concepts
3. **Visual Tutorials**: Interactive demonstrations
4. **Protection Basics Guide**: Comprehensive reference material

Implementation:

```typescript
interface EducationalElement {
  type: "tooltip" | "card" | "tutorial" | "guide";
  conceptId: string;
  title: string;
  shortDescription: string;
  fullDescription?: string;
  visualComponent?: React.ComponentType<any>;
  examples?: Example[];
  relatedConcepts?: string[];
}

interface EducationalRegistry {
  // Get educational element for a concept
  getElement(conceptId: string): EducationalElement;

  // Get related concepts
  getRelatedConcepts(conceptId: string): string[];

  // Track which elements user has viewed
  trackElementView(conceptId: string): void;

  // Recommend next concept to learn
  getRecommendedNextConcepts(): string[];
}
```

#### 5.5.2 Interactive Scenario Simulator

The system includes an interactive simulator that allows users to explore different market scenarios and their impact on protection policies:

```typescript
interface ScenarioSimulator {
  // Define parameters for simulation
  setSimulationParameters(params: SimulationParameters): void;

  // Run simulation across multiple price paths
  runSimulation(): SimulationResults;

  // Get visual component for displaying results
  getVisualizationComponent(): React.ComponentType<SimulationVisualizationProps>;

  // Export simulation results
  exportResults(format: "csv" | "json"): string;
}

interface SimulationParameters {
  initialPrice: number;
  protectedValue: number;
  protectedAmount: number;
  premium: number;
  duration: number;
  policyType: "PUT" | "CALL";
  volatilityAssumption: number;
  pricePathCount: number;
}
```
