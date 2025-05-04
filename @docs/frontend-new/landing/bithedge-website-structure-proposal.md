# The Bitcoin Insurance Company: Dual-Persona Website Structure Proposal

## Executive Summary

This document outlines a comprehensive website structure proposal for The Bitcoin Insurance Company that effectively supports both key personas: **Protective Peter** (PUT buyers seeking protection) and **Income Irene** (PUT sellers providing protection). Based on our analysis of user needs, mental models, and technical implementation considerations, we propose a persona-aware architecture that provides tailored experiences while maintaining a cohesive platform identity.

The proposal leverages the Assisted Counterparty Model recommended for the MVP phase, creating a foundation that can evolve toward a more peer-to-peer marketplace in later phases. The structure emphasizes clear navigation paths, persona-specific terminology, and seamless transitions between protection and income generation flows.

## Current Structure Analysis

Our review of the current website structure reveals several limitations when considering dual-persona support:

1. **Protection-Centric Navigation**: The current structure is primarily oriented toward protection buyers with the main "easy-option" flow
2. **Limited Provider Support**: The "option-data" section contains some provider-relevant information but lacks a dedicated flow for income strategy creation
3. **Terminology Misalignment**: Current terms are primarily protection-focused, potentially creating confusion for income-focused users
4. **Dashboard Limitations**: The current home dashboard does not effectively segment information by persona

These limitations create potential barriers for Income Irene users trying to engage with the platform for yield generation purposes.

## User Journey Analysis by Persona

To inform our structural recommendations, we've mapped the key journeys for each persona:

### Protective Peter Journey

1. **Discovery**: Learns about Bitcoin protection options
2. **Onboarding**: Connects wallet and explores protection possibilities
3. **Protection Configuration**: Sets up protection parameters through guided flow
4. **Activation**: Completes protection setup and activates policy
5. **Management**: Monitors protection status, receives notifications, and renews as needed

### Income Irene Journey

1. **Discovery**: Explores yield opportunities through Bitcoin protection provision
2. **Onboarding**: Connects wallet and reviews potential income strategies
3. **Strategy Configuration**: Sets up income parameters through guided flow
4. **Activation**: Commits capital and activates income strategy
5. **Management**: Monitors active strategies, collects yield, and adjusts capital allocation

While these journeys share some similarities (wallet connection, parameter configuration, management dashboard), they differ significantly in their goals, terminology, and decision-making priorities.

## Proposed Website Structure

### 1. Core Navigation Architecture

We propose a dual-path navigation structure that supports both personas while maintaining a coherent overall experience:

```
BitHedge Platform
│
├── Home/Dashboard (Persona-Aware)
│   ├── Protection Portfolio View (Peter-focused)
│   ├── Income Strategy View (Irene-focused)
│   └── Market Overview (Universal)
│
├── Protection Center (Peter-focused)
│   ├── Protection Goal Selection
│   ├── Protected Value Selection
│   ├── Protection Amount Selection
│   ├── Protection Period Selection
│   ├── Protection Simulation
│   └── Policy Review & Activation
│
├── Income Center (Irene-focused)
│   ├── Income Strategy Selection
│   ├── Yield Activation Level Selection
│   ├── Capital Commitment Selection
│   ├── Income Period Selection
│   ├── Risk-Yield Balance Selection
│   ├── Strategy Simulation
│   └── Strategy Review & Activation
│
├── Market Data (Universal)
│   ├── Price Information
│   ├── Volatility Metrics
│   ├── Protection Demand
│   ├── Yield Opportunities
│   └── Market Trends
│
├── Learn (Persona-Aware)
│   ├── Protection Basics (Peter-focused)
│   ├── Income Strategy Guides (Irene-focused)
│   ├── Bitcoin Market Cycles (Universal)
│   └── Platform Tutorial (Universal)
│
└── Account (Universal)
    ├── Wallet Management
    ├── Transaction History
    ├── Notification Settings
    └── Preferences
```

### 2. Persona Detection & Switching

To ensure users experience the most relevant interface, we recommend implementing:

1. **Initial Preference Selection**: First-time users select their primary goal (protection or income)
2. **Persistent Preference Toggle**: Easily accessible switch to change between protection and income views
3. **Smart Defaults**: Intelligent defaults based on wallet history and patterns
4. **Contextual Navigation**: Dynamically adjusted navigation based on current activity

The system should remember user preferences while allowing flexible switching between personas as needed.

### 3. Home/Dashboard Redesign

The home screen requires significant redesign to support both personas effectively:

**Before Authentication:**

- Clear value propositions for both protection and income generation
- Dual path CTAs ("Get Protection" and "Start Earning")
- Educational sections relevant to both personas
- Market overview with dual-persona insights

**After Authentication (Persona-Aware Dashboard):**

_Protection-Focused View:_

```
┌─────────────────────────────────────────────┐
│ [Bitcoin Price + Market Stats]      [Toggle]│
├─────────────────────────────────────────────┤
│                                             │
│ Your Protection Portfolio                   │
│ ┌─────────────────────┐ ┌─────────────────┐ │
│ │ Active Protection   │ │  Protection     │ │
│ │ 0.25 BTC Protected  │ │  Value Over Time│ │
│ │ Value: $43,650      │ │  [Chart]        │ │
│ └─────────────────────┘ └─────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Protection Policies                      │ │
│ │ ┌───────────────┐ ┌───────────────────┐ │ │
│ │ │ Standard      │ │ [Get More         │ │ │
│ │ │ Protection    │ │  Protection]      │ │ │
│ │ │ Expires: 24d  │ │                   │ │ │
│ │ └───────────────┘ └───────────────────┘ │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [Protection Simulator] [Manage Protection]  │
└─────────────────────────────────────────────┘
```

_Income-Focused View:_

```
┌─────────────────────────────────────────────┐
│ [Bitcoin Price + Market Stats]      [Toggle]│
├─────────────────────────────────────────────┤
│                                             │
│ Your Income Portfolio                       │
│ ┌─────────────────────┐ ┌─────────────────┐ │
│ │ Active Strategies   │ │  Yield Earned   │ │
│ │ 750 STX Committed   │ │  Over Time      │ │
│ │ Yield: 7.2% APY     │ │  [Chart]        │ │
│ └─────────────────────┘ └─────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Income Strategies                        │ │
│ │ ┌───────────────┐ ┌───────────────────┐ │ │
│ │ │ Bitcoin       │ │ [Create New       │ │ │
│ │ │ Stability     │ │  Strategy]        │ │ │
│ │ │ Income        │ │                   │ │ │
│ │ └───────────────┘ └───────────────────┘ │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [Strategy Simulator] [Manage Capital]       │
└─────────────────────────────────────────────┘
```

A simple toggle allows users to switch between these views as needed.

### 4. Dual Entry Points for Core Flows

From the dashboard, users should have clear entry points to their primary flows:

**Protection Center Entry:**

- Prominent "Get Protection" CTA for new protection
- "Manage Protection" link for existing policies
- Protection-specific education and tools

**Income Center Entry:**

- Prominent "Start Earning" CTA for new strategies
- "Manage Strategies" link for existing income streams
- Income-specific education and yield tools

These entry points should use persona-appropriate terminology and visuals.

### 5. Shared Market Data Section

While the primary flows are persona-specific, market data should be accessible to all users but with persona-aware presentation:

**Universal Market Elements:**

- Bitcoin price and historical charts
- Volatility metrics
- Market trend indicators
- Educational content

**Protection-Focused Elements:**

- Protection cost trends
- Popular protection levels
- Risk assessment tools

**Income-Focused Elements:**

- Current yield opportunities
- Protection demand indicators
- Risk-reward analysis tools

The interface should default to showing the most relevant data based on the user's primary persona while allowing easy access to all information.

## Technical Implementation Considerations

### 1. Routing Structure

The proposed structure requires an updated routing approach:

```javascript
// Current (simplified)
/                   // Landing page
/home               // Dashboard
/easy-option        // Protection flow
/option-data        // Market data view

// Proposed (simplified)
/                   // Landing page
/home               // Persona-aware dashboard
/protection         // Protection center
/income             // Income center
/market             // Market data section
/learn              // Educational resources
/account            // User account management
```

This structure creates clear paths for both personas while maintaining logical organization.

### 2. Component Architecture

To support both personas efficiently, we recommend:

1. **Shared Core Components**: Universal elements like price displays, charts, wallet connection
2. **Persona-Specific Components**: Specialized components for each flow with appropriate terminology
3. **Persona-Aware Containers**: Wrapper components that adapt content based on selected persona
4. **Consistent Visual Language**: Unified design system with persona-specific color coding

This approach balances code reuse with persona-specific customization.

### 3. State Management

The application requires enhanced state management to handle dual personas:

1. **User Preferences Store**: Track and persist persona preferences
2. **Protection Portfolio Store**: Manage protection policies and status
3. **Income Strategy Store**: Track yield strategies and performance
4. **Market Data Store**: Shared market information with persona-specific views

These stores should interconnect where appropriate while maintaining clear boundaries.

### 4. Backend API Requirements

The backend API should support both personas through:

1. **Unified Authentication**: Single authentication flow regardless of persona
2. **Persona-Specific Endpoints**: Clearly separated endpoints for protection vs. income operations
3. **Shared Market Data**: Common endpoints for market information with optional persona-specific parameters
4. **Role-Based Access Control**: Permission structure that adapts based on user activities

This approach maintains backend cohesion while supporting diverse frontend needs.

## Implementation Phasing

To effectively transition to this dual-persona structure, we recommend a phased approach:

### Phase 1: Foundation (Weeks 1-4)

1. Update routing structure to support both paths
2. Implement persona toggle in UI
3. Create persona-aware dashboard with basic functionality
4. Establish shared component architecture
5. Add basic Income Center with core functionality

### Phase 2: Enhancement (Weeks 5-8)

1. Develop full Income Center flow with all steps
2. Enhance Protection Center with latest improvements
3. Implement comprehensive market data section
4. Add persona-specific educational content
5. Enhance portfolio/strategy management tools

### Phase 3: Integration (Weeks 9-12)

1. Implement advanced persona detection
2. Add cross-persona functionality where valuable
3. Enhance data visualization for both personas
4. Implement smart recommendations
5. Optimize performance and mobile experience

## Migration Considerations

Transitioning from the current structure requires careful planning:

1. **URL Structure**: Implement redirects from old paths to new persona-aware paths
2. **User Preferences**: Default existing users to Protection persona initially
3. **Content Migration**: Move relevant content from option-data to appropriate new sections
4. **Analytics Tagging**: Update tracking to capture persona-specific metrics
5. **Documentation**: Update internal and user-facing documentation

## Recommended Component Updates

To support this new structure, several key components require updates or creation:

1. **PersonaToggle**: New component for switching between personas
2. **PersonaAwareNav**: Enhanced navigation with context awareness
3. **HomeDashboard**: Reimagined dashboard with dual views
4. **IncomeCenter**: New component suite for income generation flow
5. **MarketDataHub**: Enhanced market data presentation with persona filters

## Conclusion

The proposed dual-persona website structure creates a cohesive platform that effectively serves both Protective Peter and Income Irene users. By implementing clear navigation paths, persona-aware components, and flexible switching, we can maintain the simplicity of single-persona interfaces while supporting the complexity of dual use cases.

This approach aligns with the Assisted Counterparty Model for the MVP phase while establishing a foundation that can evolve toward a more peer-to-peer marketplace in later phases. The structure emphasizes user goals over technical implementation details, creating an intuitive experience regardless of which persona a user embodies.

## Next Steps

1. Review and approve the proposed structure
2. Create detailed wireframes for key screens
3. Develop component specifications
4. Update routing and navigation implementation
5. Begin Phase 1 implementation

By prioritizing both protection buyers and income providers in our website structure, we create a platform that serves the entire Bitcoin protection ecosystem, facilitating both risk management and yield generation in a seamless, intuitive interface.
