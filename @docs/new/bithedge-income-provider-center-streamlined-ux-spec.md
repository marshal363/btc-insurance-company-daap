# The Bitcoin Insurance Company Income Provider Center: Streamlined UX Specification

## Executive Summary

This technical specification outlines a streamlined user interface design for The Bitcoin Insurance Company Income Provider Center. Based on extensive UX research and analysis of Bitcoin providers' mental models, this document proposes a yield-focused approach that maintains clarity and educational value while emphasizing income generation and strategic Bitcoin acquisition opportunities. By crafting key variables into focused individual screens with precise, efficient copy, we aim to create a clean, intuitive experience that guides providers through the income strategy configuration process with minimal cognitive load.

The specification assumes implementation of the **Assisted Counterparty Model** for the MVP, which enables a more directed user flow with guaranteed strategy fulfillment. Under this model, several complex variables are simplified or automated in the UI, while keeping the core experience intact. The design prioritizes Bitcoin-native terminology, yield visualization over text explanation, and progressive disclosure of complexity through a carefully sequenced journey tailored for protection providers.

## 1. User Flow Architecture

### 1.1 Core Flow Structure

The Income Provider Center's core flow is organized as a sequential journey with focused micro-decisions at each step:

```
Entry Point → Connect Wallet → Income Provider Center Home
↓
1. Income Strategy Selection
↓
2A. Risk-Reward Tier Selection
↓
2B. Capital Commitment Selection
↓
3. Income Period Selection
↓
4. Summary and Expected Returns
↓
5. Review & Activation
↓
Success → Strategy Management Dashboard
```

### 1.2 Micro-Decision Architecture

The key innovation in this streamlined approach is the separation of essential variables into individual micro-decisions that are easier to comprehend from the provider perspective:

1. **Risk-Reward Tier** (simplified from strike price) is transformed into:

   - Pre-defined risk tiers (Conservative, Balanced, Aggressive) aligned with provider mental models
   - Visual relationship between risk level and yield/acquisition outcomes
   - Market-aware recommendations based on current conditions

2. **Capital Commitment** focuses on:

   - Efficient allocation of STX/sBTC for yield generation
   - Clear visualization of commitment relative to available balance
   - Dynamic yield calculation based on commitment amount

3. **Income Period** emphasizes:
   - Different duration options with lockup information
   - Visual timeline representation
   - Impact on expected returns

This architecture reduces cognitive load by focusing provider attention on one decision at a time, with streamlined information presentation at each step, while automating complex technical aspects like specific strike prices and option Greeks.

## 2. Global UI Framework

### 2.1 Persistent UI Elements

| Element                      | Description                             | Purpose                                           |
| ---------------------------- | --------------------------------------- | ------------------------------------------------- |
| Header Bar                   | Logo, wallet address, network badge     | Establishes context and trust                     |
| Progress Indicator           | Numbered steps with labels              | Provides journey orientation                      |
| Back/Continue Navigation     | Consistent navigation controls          | Enables fluid movement between steps              |
| Help System                  | Contextual help icon with tooltip/modal | Provides on-demand education                      |
| Yield Impact Display         | Real-time yield calculation             | Shows how each decision affects potential income  |
| Capital Efficiency Indicator | Visualization of capital utilization    | Helps providers optimize their capital allocation |

### 2.2 Typography System

To maintain visual hierarchy while reducing text density:

| Element               | Style                          | Purpose                               |
| --------------------- | ------------------------------ | ------------------------------------- |
| Primary Headers       | 24px, Bold, High Contrast      | Step identification and main concept  |
| Supporting Copy       | 16px, Regular, Medium Contrast | Brief explanation (1-2 sentences max) |
| Strategy Labels       | 18px, Medium, High Contrast    | Option identification                 |
| Strategy Descriptions | 14px, Regular, Medium Contrast | Single line benefit statement         |
| Yield Metrics         | 16px, Medium, Accent Color     | Prominent display of income potential |
| Risk Indicators       | 14px, Regular, Warning Color   | Clear indication of risk levels       |
| Technical Details     | 14px, Regular, Low Contrast    | Secondary information (expandable)    |

### 2.3 Visual Communication System

To reduce reliance on text and emphasize yield opportunities:

| Element                   | Implementation                                 | Purpose                                    |
| ------------------------- | ---------------------------------------------- | ------------------------------------------ |
| Yield Iconography         | Consistent icon set for income concepts        | Visual shorthand for yield strategies      |
| Risk-Reward Color Coding  | Color system for different risk levels         | Visual reinforcement of risk-yield balance |
| Yield Visualization       | Interactive charts showing income scenarios    | Visual explanation of income potential     |
| Acquisition Visualization | Clear display of potential Bitcoin acquisition | Visualization of acquisition scenarios     |
| Progressive Disclosure    | Expandable details sections                    | Hides complexity until needed              |
| Market Context Indicators | Visual representation of market conditions     | Provides context for strategy decisions    |

## 3. Detailed Screen Specifications

### 3.1 Entry & Connection

#### Income Provider Center Home

**UI Components:**

- Hero section with Bitcoin income generation tagline
- "Start Earning" primary CTA
- Key benefit cards (3 maximum)
- Current market metrics summary

**Copy Approach:**

- Headline: "Generate Income with Your Bitcoin" (5 words)
- Subhead: "Earn yield by providing protection to Bitcoin holders" (8 words)
- Benefits: One-line value propositions (6-8 words each)

**Visual Elements:**

- Bitcoin with income/yield icon
- Simple animated graph showing yield generation concept
- Current Bitcoin price with volatility indicator
- Yield opportunity metrics

### 3.2 Step 1: Income Strategy Selection

**Screen Purpose:** Establish user intent and income direction

**UI Components:**

- Two card options with clear visual differentiation
- Icon, headline, and single-line description for each
- Selection indicator
- Strategy comparison summary

**Copy Approach:**

- Header: "Choose Your Income Strategy" (4 words)
- Card 1: "Generate Income from Bitcoin Stability" (5 words)
- Card 1 Description: "Earn yield by providing downside protection" (6 words)
- Card 2: "Earn Yield Through Upside Potential" (5 words)
- Card 2 Description: "Generate income by offering price ceiling options" (7 words)

**Visual Elements:**

- Downward arrow icon for PUT selling (stability income)
- Upward arrow icon for CALL selling (upside income)
- Yield icons with distinctive colors
- Risk-reward visualization for each strategy
- Optional: Expandable "How It Works" section hidden by default

**Interaction Design:**

- Card selection with clear visual feedback
- Single tap/click to select and advance
- Help icon for additional explanation if needed
- Yield comparison visualization on hover/tap

### 3.3 Step 2A: Risk-Reward Tier Selection

**Screen Purpose:** Select risk-reward profile through simplified tier options

**UI Components:**

- Current Bitcoin price display with timestamp
- Risk tier option cards (3 options: Conservative, Balanced, Aggressive)
- Visual yield/risk indicator for each option
- Tier selection mechanism
- Risk-reward visualization

**Copy Approach:**

- Header: "Select Your Risk-Reward Tier" (4 words)
- Tier Option 1: "Conservative Yield" (2 words)
- Description: "Lower risk with modest income potential" (6 words)
- Metrics: "Est. APY: 3-5% | Acquisition: Low"
- Similar concise format for other tier options

**Visual Elements:**

- Risk-reward spectrum visualization
- Visual indicators for expected yield vs. acquisition likelihood
- Pool composition showing distribution of capital across tiers
- Market context visualization
- Simple risk meter for each option

**Interaction Design:**

- Card selection with immediate update to visualizations
- Single tap/click to select tier
- Simple visualization showing outcomes at different risk levels
- Dynamic yield calculation based on selection

### 3.4 Step 2B: Capital Commitment Selection

**Screen Purpose:** Select contract size (amount of STX/sBTC to commit)

**UI Components:**

- STX/sBTC amount input field with USD conversion
- Quick-select amount buttons (25%, 50%, 75%, 100% of available balance)
- Connected wallet balance display
- Yield projection based on amount
- Capital efficiency visualization

**Copy Approach:**

- Header: "How Much Capital Will You Commit?" (6 words)
- Supporting: "Enter amount or select percentage of your balance" (8 words)
- Selection Options: "25% | 50% | 75% | 100%" (single words)
- Yield Projection: "Estimated Yield: 20 STX (8% APY)" (6 words)

**Visual Elements:**

- STX/sBTC/USD toggle
- Visual representation of committed vs. available capital
- Pool contribution visualization
- Yield projection visualization
- Capital efficiency meter

**Interaction Design:**

- Auto-formatting of numerical input
- Real-time USD conversion as user types
- Dynamic yield projection updates
- Quick-select buttons with immediate feedback
- Auto-suggestion based on wallet balance

### 3.5 Step 3: Income Period Selection

**Screen Purpose:** Select time period for income strategy

**UI Components:**

- Duration category tabs (Short-term, Medium-term, Long-term)
- Duration options within each category
- Timeline visualization showing income period
- Yield impact indicator for different durations
- Selection mechanism

**Copy Approach:**

- Header: "Select Your Income Period" (4 words)
- Tab 1: "Short-term" (1 word)
- Option 1: "30 Days" (2 words)
- Description: "Higher APY, shorter commitment" (4 words)
- Similar concise format for other duration options

**Visual Elements:**

- Timeline visualization showing income period with lockup information
- Yield impact visualization for different durations
- Market volatility indication for different timeframes
- Capital lock-up visualization
- Early exit options and penalties information

**Interaction Design:**

- Tab selection for duration categories
- Option selection within tabs
- Timeline visualization updates based on selection
- Real-time yield projection update based on selection
- Duration impact visualization

### 3.6 Step 4: Summary and Expected Returns

**Screen Purpose:** Provide a comprehensive overview of the strategy with expected outcomes

**UI Components:**

- Strategy configuration recap
- Expected returns visualization
- Outcome scenarios for different market conditions
- Pool statistics
- Strategy parameter summary

**Copy Approach:**

- Header: "Review Your Strategy" (3 words)
- Strategy Recap: Key parameters in label:value format
- Expected Returns: "Projected Yield: 15-20 STX (6-9% APY)" (7 words)
- Outcome Scenarios: "If Bitcoin remains stable: Earn full premium" (7 words)

**Visual Elements:**

- Strategy configuration summary visualization
- Expected returns projection
- Simplified outcome scenarios visualization
- Pool statistics display
- Risk level indicator

**Interaction Design:**

- Expandable sections for detailed information
- Interactive elements to explore different scenarios
- Parameter adjustment options (if needed)
- Clear feedback on expected outcomes

### 3.7 Step 5: Review & Activation

**Screen Purpose:** Final review and activation of income strategy

**UI Components:**

- Comprehensive but concise strategy summary
- Key parameter display
- Risk disclosure
- Pool participation details
- Terms agreement checkbox
- Primary activation button

**Copy Approach:**

- Header: "Activate Your Income Strategy" (4 words)
- Summary: Key parameters in label:value format
- Risk Disclosure: "With Balanced tier, there's a moderate chance of acquiring Bitcoin" (10 words)
- Pool Details: "Your capital will join a pool providing Bitcoin protection" (9 words)
- Action: "Commit Capital" (2 words)

**Visual Elements:**

- Visual summary of strategy configuration
- Risk visualization
- Pool contribution visualization
- Activation button with yield icon
- Success state animation

**Interaction Design:**

- Terms agreement checkbox with expandable full terms
- Clear activation button with loading state
- Success confirmation animation
- Redirect to dashboard after successful activation
- Final parameter adjustment options (if needed)

## 4. Strategy Management Dashboard

After strategy activation, providers need a comprehensive dashboard to monitor and manage their income strategies:

### 4.1 Dashboard Components

**Active Strategies Panel:**

```
[Active Strategies Panel]
- Summary metrics:
  - Total committed capital: 750 STX
  - Current strategy value: 762.5 STX
  - Earned yield to date: 12.5 STX
  - Weighted average APY: 7.2%
- Strategy cards (for each active strategy):
  - Strategy type: Bitcoin Stability Income
  - Risk-Reward Tier: Balanced
  - Committed capital: 250 STX
  - Remaining period: 24 days
  - Current status: Active (In yield zone)
  - Action buttons: Manage / Close
```

**Market Context Panel:**

```
[Market Context Panel]
- Current Bitcoin price: $48,500
- Price change (24h): +2.5%
- Volatility index: Moderate
- Current trend: Bullish
- Pool statistics:
  - Total pool size: 25,000 STX
  - Number of providers: 120
  - Current utilization rate: 85%
- Market opportunities alert:
  - "High protection demand - Consider adding more capital"
```

**Strategy Distribution Panel:**

```
[Strategy Distribution Panel]
- Visual breakdown of capital across risk tiers:
  - Conservative: 250 STX (33%)
  - Balanced: 375 STX (50%)
  - Aggressive: 125 STX (17%)
- Time to expiration summary:
  - Expiring this week: 0 STX
  - Expiring this month: 250 STX
  - Expiring next month: 500 STX
- Income strategy distribution:
  - Bitcoin Stability (PUT): 600 STX (80%)
  - Upside Potential (CALL): 150 STX (20%)
```

**Quick Actions Panel:**

```
[Quick Actions Panel]
- Add more capital
- Renew expiring strategies
- Adjust risk profile
- View transaction history
```

### 4.2 Strategy Detail View

When providers select a specific active strategy, they need a detailed view with comprehensive information:

```
[Strategy Detail View]
- Strategy identification:
  - Creation date: April 11, 2023
  - Strategy ID: STRAT-12345
  - Strategy type: Bitcoin Stability Income (PUT selling)
- Key parameters:
  - Risk-Reward Tier: Balanced
  - Committed capital: 250 STX (≈$500)
  - Income period: 30 days (24 days remaining)
- Current status:
  - Market price: $48,500
  - Current value: 250 STX + 8.3 STX accrued yield
  - Current risk level: Low
- Performance metrics:
  - Yield to date: 8.3 STX (3.3% actual, 8.0% annualized)
  - Capital efficiency: 98%
- Strategy management options:
  - Close position early (if supported)
  - Add more capital (if supported)
  - Set up automatic renewal
  - Export strategy details
```

## 5. Journey Flow Interactions

### 5.1 Navigation Patterns

The streamlined flow employs consistent navigation patterns optimized for income providers:

- **Primary Progression**: Large "Continue" button at bottom of each screen
- **Back Navigation**: Less prominent "Back" button in top navigation
- **Skip Options**: Where appropriate, "Skip" option for optional steps
- **Help Access**: Consistent help icon location with contextual information
- **Progress Indication**: Current step highlighted in progress indicator
- **Yield Impact**: Persistent display showing how each decision affects potential yield

### 5.2 Progressive Disclosure Strategy

To maintain clean interfaces while providing necessary information for providers:

| Information Level    | Presentation               | Access Method              |
| -------------------- | -------------------------- | -------------------------- |
| Essential Yield Info | Always visible             | Direct on-screen           |
| Risk Assessment      | Collapsed by default       | Single tap expand/collapse |
| Market Context       | Hidden in context panel    | Tap market context icon    |
| Technical Details    | Available in advanced view | Toggle advanced mode       |
| Educational Content  | Hidden in help system      | Tap help icon or tooltip   |

### 5.3 Error Prevention & Recovery

The interface employs several strategies to prevent errors for providers:

- **Real-time Validation**: Input fields validate as user types
- **Guided Selection**: Pre-calculated strategies minimizing free input
- **Smart Defaults**: Context-aware default selections based on market conditions
- **Risk Warnings**: Clear indications when selecting higher-risk strategies
- **Confirmation Step**: Final review before committing capital
- **Recovery Options**: Clear paths to adjust strategies after creation

## 6. Variable-Specific UX Components

### 6.1 Risk-Reward Tier Components

The risk-reward tier variable uses these specific components for providers:

**Tier Selection Cards:**

```
[Card Component]
Icon: Risk-yield icon with tier indicator
Header: "Balanced Yield"
Description: "Moderate risk with standard yield"
Metrics: "Est. APY: 6-9% | Acquisition: ●●○○ (Moderate)"
Selection State: Selected/Unselected
```

**Risk-Reward Visualization:**

```
[Visualization Component]
Elements:
- Risk-reward spectrum visualization
- Visual indicators for expected yield vs. acquisition likelihood
- Pool composition showing distribution of capital across tiers
- Current selection highlighted on spectrum
Interaction: Updates dynamically with tier selection
```

### 6.2 Capital Commitment (Contract Size) Components

**Commitment Input Component:**

```
[Input Component]
Elements:
- STX/sBTC toggle
- Numerical input field
- USD value conversion (real-time)
- Quick-select percentage buttons
- Connected wallet balance reference
- Yield projection based on amount and selected risk tier
Validation: Min/max amount enforcement
```

**Pool Contribution Visualization:**

```
[Visualization Component]
Elements:
- Visual representation of committed vs. available capital
- Pool contribution visualization
- Yield potential indicator based on commitment
- Capital efficiency meter
Interaction: Updates dynamically with amount changes
```

### 6.3 Income Period (Expiration) Components

**Income Period Tab System:**

```
[Tab Component]
Primary Tabs:
- Short-term (7/14 days)
- Medium-term (30/60 days)
- Long-term (90/180 days)
Secondary Selection: Option cards within each tab
Interaction: Tab selection reveals relevant duration options
```

**Income Timeline Visualization:**

```
[Timeline Component]
Elements:
- Today marker
- Income period visualization with lockup information
- Expiration date indicator
- Yield accrual projection
- Early exit options and penalties visualization
Interaction: Updates with duration selection
```

### 6.4 Expected Returns Components

**Expected Returns Summary:**

```
[Summary Component]
Elements:
- Projected yield amount (STX/sBTC)
- Annualized yield percentage (APY)
- Yield range based on market conditions
- Acquisition likelihood indicator
- Risk level visualization
Interaction: Dynamically reflects all previous selections
```

**Outcome Scenarios Visualization:**

```
[Visualization Component]
Elements:
- Simplified scenario comparison:
  - Yield outcome (if Bitcoin remains stable)
  - Acquisition outcome (if Bitcoin falls significantly)
- Probability indicators based on selected risk tier
- Pool performance context
Interaction: Expandable for more detailed scenarios
```

### 6.5 Strategy Management Components

**Strategy Card Component:**

```
[Strategy Card Component]
Elements:
- Strategy type indicator
- Risk-reward tier badge
- Key parameters summary
- Current status visualization
- Yield earned to date
- Remaining duration indicator
- Quick action buttons
Interaction:
- Tap to expand for more details
- Quick actions for common management tasks
- Visual status indicator
```

**Strategy Distribution Visualization:**

```
[Distribution Component]
Elements:
- Visual breakdown of capital across risk tiers
- Time to expiration summary
- Income strategy distribution (PUT/CALL)
- Portfolio allocation visualization
Interaction:
- Interactive filters for different views
- Expandable sections for details
```

## 7. Implementation Requirements

### 7.1 Technical Dependencies

The streamlined UX for income providers requires these technical components:

- **Real-time Price Data**: Sub-minute Bitcoin price updates
- **Yield Calculation Engine**: Dynamic income projections based on parameters
- **Risk Assessment System**: Probabilistic models for outcome likelihood
- **Capital Management System**: Tracking of committed vs. available capital
- **Smart Contract Integration**: Automated strategy creation and management
- **Wallet Connection**: Secure wallet integration for transactions
- **Pool Management System**: Tracking of capital across provider risk tiers

### 7.2 Performance Requirements

To ensure a responsive experience for providers:

- **Render Time**: Each screen must render within 300ms
- **Calculation Speed**: Yield updates must complete within 200ms
- **Animation Smoothness**: Transitions maintain 60fps
- **Data Freshness**: Price data no more than 60 seconds old
- **Reliable Connectivity**: Graceful handling of connectivity issues
- **Capital Safety**: Clear indication of transaction status and capital security

### 7.3 Responsive Design Requirements

The interface must adapt across device types:

- **Mobile-First**: Primary design for mobile experience
- **Desktop Enhancements**: Additional visualization capabilities on larger screens
- **Tablet Optimization**: Hybrid approach leveraging additional screen space
- **Consistent Components**: Core components maintain consistency across breakpoints
- **Adaptive Layout**: Repositioning of elements based on screen size
- **Dashboard Optimization**: Enhanced dashboard views on larger screens

## 8. Testing Approach

### 8.1 Provider Usability Testing Protocol

Key areas for focused usability testing with income providers:

- **Task Completion Rate**: Measure successful completion of strategy setup
- **Yield Comprehension**: Validate understanding of income potential
- **Risk Assessment**: Verify accurate perception of risk levels
- **Time-on-Task**: Evaluate efficiency of streamlined flow
- **Error Rate**: Identify confusion points or input errors
- **Mental Model Alignment**: Confirm interface matches provider thinking
- **Dashboard Usability**: Evaluate effectiveness of portfolio management

### 8.2 Technical Testing Requirements

Technical validation should focus on:

- **Cross-device Compatibility**: Functioning across device types
- **Performance Benchmarking**: Meeting specified render/response times
- **Yield Calculation Accuracy**: Correct income projections and APY calculations
- **Contract Integration**: Accurate translation of UI selections to contract parameters
- **Wallet Interaction**: Reliable connectivity and transaction submission
- **Data Accuracy**: Correct calculations and conversions throughout
- **Capital Security**: Verification of proper collateralization and fund safety

## 9. Development Phasing

### 9.1 MVP Essential Components

Phase 1 implementation priorities for income providers:

1. **Core Flow Structure**: Step-by-step journey with individual variable screens
2. **Simplified Risk-Reward Tiers**: Pre-defined risk profiles aligned with provider mental models
3. **Basic Yield Visualization**: Simple visual explanation of income concepts
4. **Wallet Integration**: Secure connection and transaction capabilities
5. **Assisted Counterparty Backend**: Direct fulfillment of income strategies through risk pools

### 9.2 Post-MVP Enhancements

Planned enhancements after initial launch:

1. **Advanced Portfolio Analytics**: More sophisticated performance tracking tools
2. **Enhanced Risk Management**: More detailed risk assessment and recommendations
3. **Market Context Integration**: Detailed market data to inform strategy decisions
4. **Enhanced Yield Analytics**: More detailed performance metrics and comparisons
5. **P2P Marketplace View**: Optional view of peer marketplace (dual-mode interface)

## 10. Mobile-First Screen Mockups

### Income Strategy Selection

```
┌─────────────────────────────┐
│ ⬅ The Bitcoin Insurance Company      [1]─2─3─4─5 │
├─────────────────────────────┤
│                             │
│ Choose Your Income          │
│ Strategy                    │
│                             │
│ ┌─────────────────────────┐ │
│ │ 📊                      │ │
│ │ Generate Income from    │ │
│ │ Bitcoin Stability       │ │
│ │                         │ │
│ │ Earn yield by providing │ │
│ │ downside protection     │ │
│ │                         │ │
│ │ Est. APY: 5-15%         │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ 📈                      │ │
│ │ Earn Yield Through      │ │
│ │ Upside Potential        │ │
│ │                         │ │
│ │ Generate income by      │ │
│ │ offering price ceiling  │ │
│ │                         │ │
│ │ Est. APY: 3-10%         │ │
│ └─────────────────────────┘ │
│                             │
│         [ Continue ▶ ]      │
└─────────────────────────────┘
```

### Risk-Reward Tier Selection

```
┌─────────────────────────────┐
│ ⬅ The Bitcoin Insurance Company      1─[2]─3─4─5 │
├─────────────────────────────┤
│                             │
│ Select Your Risk-Reward     │
│ Tier                        │
│                             │
│ Current BTC: $48,500        │
│                             │
│ ┌─────────────────────────┐ │
│ │ Conservative Yield      │ │
│ │ Lower risk, lower yield │ │
│ │ Est. APY: 3-5%          │ │
│ │ Acquisition: ●○○○ (Low) │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ Balanced Yield       ✓  │ │
│ │ Moderate risk/reward    │ │
│ │ Est. APY: 6-9%          │ │
│ │ Acquisition: ●●○○ (Mod) │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ Aggressive Yield        │ │
│ │ Higher risk/reward      │ │
│ │ Est. APY: 8-15%         │ │
│ │ Acquisition: ●●●● (High)│ │
│ └─────────────────────────┘ │
│                             │
│ [Risk-reward spectrum       │
│  visualization]             │
│                             │
│         [ Continue ▶ ]      │
└─────────────────────────────┘
```

### Capital Commitment Selection

```
┌─────────────────────────────┐
│ ⬅ The Bitcoin Insurance Company      1─[2]─3─4─5 │
├─────────────────────────────┤
│                             │
│ How Much Capital Will       │
│ You Commit?                 │
│                             │
│ ┌─────────────────────────┐ │
│ │  250 STX  ≈  $500       │ │
│ │    [STX ⟷ USD]          │ │
│ └─────────────────────────┘ │
│                             │
│ Select amount to commit:    │
│ [ 25% ][ 50% ][ 75% ][100%] │
│                             │
│ Available: 1,000 STX        │
│                             │
│ [Visual showing commitment  │
│  as 25% of available funds] │
│                             │
│ Estimated Yield: 15-20 STX  │
│ Annualized: 6-9% APY        │
│                             │
│         [ Continue ▶ ]      │
└─────────────────────────────┘
```

### Income Period Selection

```
┌─────────────────────────────┐
│ ⬅ The Bitcoin Insurance Company      1─2─[3]─4─5 │
├─────────────────────────────┤
│                             │
│ Select Your Income          │
│ Period                      │
│                             │
│ [Short][Medium][Long]       │
│                             │
│ ┌─────────────────────────┐ │
│ │ 30 Days               ✓ │ │
│ │ Higher APY, shorter    │ │
│ │ commitment             │ │
│ │ Est. APY: 6-9%         │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ 60 Days                 │ │
│ │ Balanced commitment     │ │
│ │ Est. APY: 5-8%          │ │
│ └─────────────────────────┘ │
│                             │
│ [Timeline visualization     │
│  showing income period      │
│  with Apr 11 - May 11       │
│  and lockup information]    │
│                             │
│         [ Continue ▶ ]      │
└─────────────────────────────┘
```

### Summary and Expected Returns

```
┌─────────────────────────────┐
│ ⬅ The Bitcoin Insurance Company      1─2─3─[4]─5 │
├─────────────────────────────┤
│                             │
│ Review Your Strategy        │
│                             │
│ Strategy Configuration:     │
│ • Income type: Bitcoin      │
│   Stability Income          │
│ • Risk-Reward Tier: Balanced│
│ • Capital: 250 STX ($500)   │
│ • Period: 30 Days           │
│                             │
│ Expected Returns:           │
│ • Projected yield: 15-20 STX│
│ • Annualized: 6-9% APY      │
│ • Acquisition likelihood:   │
│   Moderate (●●○○)          │
│                             │
│ Outcome Scenarios:          │
│ • If Bitcoin remains stable:│
│   Earn full premium (6-9%)  │
│ • If Bitcoin falls signif.: │
│   May acquire Bitcoin at    │
│   predetermined prices      │
│                             │
│ Pool Statistics:            │
│ • Total pool: 25,000 STX    │
│ • Providers: 120            │
│ • Utilization: 85%          │
│                             │
│         [ Continue ▶ ]      │
└─────────────────────────────┘
```

### Review & Activation

```
┌─────────────────────────────┐
│ ⬅ The Bitcoin Insurance Company      1─2─3─4─[5] │
├─────────────────────────────┤
│                             │
│ Activate Your Income        │
│ Strategy                    │
│                             │
│ Strategy Summary:           │
│ • Income type: Bitcoin      │
│   Stability Income          │
│ • Risk-Reward Tier: Balanced│
│ • Capital: 250 STX ($500)   │
│ • Period: 30 Days           │
│ • Expires: May 11, 2023     │
│                             │
│ Risk Disclosure:            │
│ • With Balanced tier, there's│
│   a moderate chance of      │
│   acquiring Bitcoin if      │
│   prices fall significantly │
│ • Capital is locked for the │
│   selected period with      │
│   early exit fee of 5%      │
│                             │
│ Pool Participation:         │
│ • Your capital will join a  │
│   pool of 25,000 STX        │
│   providing protection      │
│                             │
│ [✓] I agree to the Terms    │
│                             │
│ [ Commit Capital ]          │
│                             │
└─────────────────────────────┘
```

### Strategy Management Dashboard

```
┌─────────────────────────────┐
│  The Bitcoin Insurance Company       Dashboard   │
├─────────────────────────────┤
│                             │
│ Active Strategies           │
│                             │
│ Total Committed: 750 STX    │
│ Current Value: 762.5 STX    │
│ Earned to Date: 12.5 STX    │
│ Weighted Avg APY: 7.2%      │
│                             │
│ ┌─────────────────────────┐ │
│ │ Bitcoin Stability Income│ │
│ │ Balanced Tier           │ │
│ │ 250 STX                 │ │
│ │ 24 days remaining       │ │
│ │ Status: Active (Low risk)│ │
│ │ [Manage]      [Close]   │ │
│ └─────────────────────────┘ │
│                             │
│ Market Context:             │
│ BTC: $48,500 (+2.5%)        │
│ Volatility: Moderate 📊     │
│ Trend: Bullish 📈           │
│                             │
│ Strategy Distribution:      │
│ [Bar chart showing          │
│  allocation across tiers]   │
│                             │
│ [Add Capital]               │
│ [Renew Expiring]            │
│                             │
└─────────────────────────────┘
```

## 11. Conclusion: Benefits of Streamlined Provider Approach

The proposed streamlined UX specification for income providers under the assisted counterparty model offers several key benefits:

1. **Simplified Decision-Making**: Pre-defined risk tiers eliminate complex strike price decisions
2. **Income-Focused Framing**: Positions options contract creation as yield generation rather than abstract derivatives
3. **Strategic Acquisition Integration**: Frames PUT selling as a strategic Bitcoin acquisition strategy with premium bonus
4. **Reduced Cognitive Load**: Breaking complex variables into focused micro-decisions with clear yield impact
5. **Enhanced Yield Visibility**: Clear, consistent representation of income potential across all screens
6. **Risk Transparency**: Visual representation of risk alongside yield potential
7. **Automated Complexity**: Technical details handled by the algorithmic system, allowing providers to focus on core parameters

By focusing on one key variable per screen with minimal but precise text and automating complex technical aspects, we create a Bitcoin income generation experience that feels intuitive and accessible while maintaining the sophistication needed for effective yield strategies.

## 12. Next Steps

1. **Design Prototype Development**: Create interactive prototype of streamlined income provider flow
2. **Provider User Testing**: Validate approach with target Bitcoin income providers
3. **Visual Design Refinement**: Develop full visual language based on mockups
4. **Component Development**: Build reusable UI components for implementation
5. **Integration Planning**: Coordinate with backend teams on API requirements

This specification provides the foundation for developing a truly Bitcoin-native income generation experience that balances yield opportunity with risk transparency while significantly simplifying the provider experience.
