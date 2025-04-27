# The Bitcoin Insurance Company Protection Center: Streamlined UX Specification

## Executive Summary

This technical specification outlines a streamlined user interface design for The Bitcoin Insurance Company Protection Center. Based on extensive UX research and analysis of Bitcoin users' mental models, this document proposes a refined approach that maintains clarity and educational value while significantly reducing text density. By breaking key variables into focused individual screens with precise, efficient copy, we aim to create a clean, intuitive experience that guides users through the protection configuration process with minimal cognitive load.

The specification assumes implementation of the **Assisted Counterparty Model** for the MVP, which enables a more directed user flow with guaranteed protection fulfillment. The design prioritizes Bitcoin-native terminology, visual communication over text explanation, and progressive disclosure of complexity through a carefully sequenced journey.

## 1. User Flow Architecture

### 1.1 Core Flow Structure

The Protection Center's core flow is organized as a sequential journey with focused micro-decisions at each step:

```
Entry Point → Connect Wallet → Protection Center Home
↓
1. Protection Goal Selection
↓
2A. Protected Value Selection
↓
2B. Protection Amount Selection
↓
3. Protection Duration Selection
↓
4. Policy Preview
↓
5. Confirmation & Activation
↓
Success → Home/ Dashboard
```

### 1.2 Micro-Decision Architecture

The key innovation in this streamlined approach is the separation of complex variables into individual micro-decisions that are easier to comprehend:

1. **Step 2** (previously combining Protected Value and Amount) is split into distinct screens:

   - 2A: Select protection level (strike price) via strategy selection
   - 2B: Select protection amount (contract size)

2. **Step 4** (previously showing multiple policies) is transformed into:
   - Single policy preview based on prior selections (enabled by assisted counterparty model)
   - Focus on education and outcome simulation rather than selection

This architecture reduces cognitive load by focusing user attention on one decision at a time, with streamlined information presentation at each step.

## 2. Global UI Framework

### 2.1 Persistent UI Elements

| Element                  | Description                             | Purpose                                                     |
| ------------------------ | --------------------------------------- | ----------------------------------------------------------- |
| Header Bar               | Logo, wallet address, network badge     | Establishes context and trust                               |
| Progress Indicator       | Numbered steps with labels              | Provides journey orientation                                |
| Back/Continue Navigation | Consistent navigation controls          | Enables fluid movement between steps                        |
| Help System              | Contextual help icon with tooltip/modal | Provides on-demand education                                |
| Copy Approach            | Concise headers, brief supporting copy  | Maintains clean interface while providing necessary context |

### 2.2 Typography System

To maintain visual hierarchy while reducing text density:

| Element             | Style                          | Purpose                               |
| ------------------- | ------------------------------ | ------------------------------------- |
| Primary Headers     | 24px, Bold, High Contrast      | Step identification and main concept  |
| Supporting Copy     | 16px, Regular, Medium Contrast | Brief explanation (1-2 sentences max) |
| Selection Labels    | 18px, Medium, High Contrast    | Option identification                 |
| Option Descriptions | 14px, Regular, Medium Contrast | Single line benefit statement         |
| Technical Details   | 14px, Regular, Low Contrast    | Secondary information (expandable)    |

### 2.3 Visual Communication System

To reduce reliance on text:

| Element                | Implementation                                   | Purpose                                 |
| ---------------------- | ------------------------------------------------ | --------------------------------------- |
| Iconography            | Consistent icon set for key concepts             | Visual shorthand for concepts           |
| Color Coding           | Protection levels with consistent colors         | Visual reinforcement of selections      |
| Visualization          | Interactive charts showing protection activation | Visual explanation of concepts          |
| Animations             | Smooth transitions between steps                 | Reinforces relationship between choices |
| Progressive Disclosure | Expandable details sections                      | Hides complexity until needed           |

## 3. Detailed Screen Specifications

### 3.1 Entry & Connection

#### Protection Center Home

**UI Components:**

- Hero section with Bitcoin protection tagline
- "Get Started" primary CTA
- Key benefit cards (3 maximum)

**Copy Approach:**

- Headline: "Protect Your Bitcoin Value" (5 words)
- Subhead: "Simple protection against price drops with no custody risks" (10 words)
- Benefits: One-line value propositions (6-8 words each)

**Visual Elements:**

- Bitcoin with shield icon
- Simple animated graph showing protection activation concept
- Current Bitcoin price with trend indicator

### 3.2 Step 1: Protection Goal Selection

**Screen Purpose:** Establish user intent and protection direction

**UI Components:**

- Two card options with clear visual differentiation
- Icon, headline, and single-line description for each
- Selection indicator

**Copy Approach:**

- Header: "What Are You Looking to Protect?" (6 words)
- Card 1: "Protect My Bitcoin Value" (4 words)
- Card 1 Description: "Guard against price drops while maintaining upside potential" (9 words)
- Card 2: "Secure My Future Purchase" (4 words)
- Card 2 Description: "Lock in maximum purchase price for future Bitcoin acquisition" (10 words)

**Visual Elements:**

- Downward arrow icon for value protection
- Upward arrow icon for purchase protection
- Shield icons with distinctive colors
- Optional: Expandable "How It Works" section hidden by default

**Interaction Design:**

- Card selection with clear visual feedback
- Single tap/click to select and advance
- Help icon for additional explanation if needed

### 3.3 Step 2A: Protected Value Strategy Selection

**Screen Purpose:** Select strike price through strategy-based interface

**UI Components:**

- Current Bitcoin price display with timestamp
- Strategy option cards (4-5 options)
- Visual protection level indicator
- Strategy selection mechanism

**Copy Approach:**

- Header: "How Much Protection Do You Need?" (6 words)
- Strategy Option 1: "Maximum Protection" (2 words)
- Description: "Lock in 100% of current Bitcoin value" (7 words)
- Premium Indicator: "Premium: ●●●● (Highest)"
- Similar concise format for other strategy options

**Visual Elements:**

- Bitcoin price chart with horizontal lines showing protection levels
- Color-coded protection zones
- Premium indicators using dots rather than text
- Strategy cards with visual iconography

**Interaction Design:**

- Card selection with immediate update to chart visualization
- Single tap/click to select strategy
- Swipe/smooth scroll between options on mobile

### 3.4 Step 2B: Protection Amount Selection

**Screen Purpose:** Select contract size (amount of Bitcoin to protect)

**UI Components:**

- BTC amount input field with USD conversion
- Quick-select amount buttons (25%, 50%, 75%, 100% of holdings)
- Connected wallet balance display (if available)
- Min/max amount indicators

**Copy Approach:**

- Header: "How Much Bitcoin Do You Want to Protect?" (8 words)
- Supporting: "Enter amount or select percentage of your holdings" (8 words)
- Selection Options: "25% | 50% | 75% | 100%" (single words)
- Minimum: "Minimum: 0.01 BTC" (3 words)

**Visual Elements:**

- BTC/USD toggle
- Sats/BTC denomination toggle
- Visual representation of selected amount vs. total holdings
- Numerical keypad for precise input

**Interaction Design:**

- Auto-formatting of numerical input
- Real-time USD conversion as user types
- Quick-select buttons with immediate feedback
- Auto-suggestion based on wallet balance

### 3.5 Step 3: Protection Duration Selection

**Screen Purpose:** Select time period for protection coverage

**UI Components:**

- Duration category tabs (Standard, Extended, Strategic, Custom)
- Duration options within each category
- Timeline visualization showing coverage period
- Selection mechanism

**Copy Approach:**

- Header: "How Long Do You Need Protection?" (6 words)
- Tab 1: "Standard" (1 word)
- Option 1: "30 Days" (2 words)
- Description: "Basic protection, lowest premium" (5 words)
- Similar concise format for other duration options

**Visual Elements:**

- Timeline visualization showing protection period
- Calendar-style representation of coverage
- Bitcoin halving cycles visualization for Strategic tab
- Price volatility indication for different timeframes

**Interaction Design:**

- Tab selection for duration categories
- Option selection within tabs
- Timeline drag for custom duration (Custom tab only)
- Real-time premium update based on selection

### 3.6 Step 4A: Protection Simulator

**Screen Purpose:** Allow users to visualize protection outcomes across different price scenarios

**UI Components:**

- Expandable/collapsible panel design (similar to existing pnl-simulation.tsx)
- Interactive price chart showing protection value at different price points
- Key metrics summary (maximum benefit, maximum loss, break-even price)
- Protection parameters display
- Optional: Advanced variables adjustment tab

**Copy Approach:**

- Header: "Protection Value Simulator" (3 words)
- Tab 1: "Chart" (1 word)
- Tab 2: "Adjust Variables" (2 words)
- Metrics: Simple label + value format ("Maximum Benefit: $4,850")
- Explainer: "Drag to see protection value at different Bitcoin prices" (9 words)

**Visual Elements:**

- Area chart showing protection value across price range
- Reference lines for current price and protected value
- Color-coded areas (protection zone vs. unprotected zone)
- Visual indicators for key price points (current, protected, break-even)
- Key metrics cards with color indicators

**Interaction Design:**

- Expandable/collapsible side panel for desktop
- Full-screen modal with close button for mobile
- Interactive price point selection (drag or tap)
- Real-time calculation updates as user explores different scenarios
- Optional tab for adjusting simulation parameters

**Component Implementation:**

```
[Simulator Component]
Structure:
- Expandable panel with toggle
- Tabs (Chart / Adjust Variables)
- Chart visualization area
- Key metrics summary grid
- Position details
- Optional disclaimer/info message

Chart Elements:
- Current BTC price reference line
- Protected value reference line
- Protection zone (shaded area below protected value)
- PnL curve showing value at different prices
- Interactive price point selection

Key Metrics:
- Maximum Benefit (green)
- Maximum Loss (red)
- Break-even Price (blue)
- Premium (purple)

Position Information:
- Protected Value: $43,650
- Protection Amount: 0.25 BTC
- Current Position: In/At/Out of the Money
```

**Integration with Main Flow:**

- Accessible from a "Simulate Protection" button on Step 3
- Auto-presented before proceeding to Policy Preview
- Can be recalled from Step 4B via an icon button
- Pre-populated with all previously selected parameters

### 3.7 Step 4B: Policy Preview

**Screen Purpose:** Present final policy details with comprehensive information and disclaimers

**UI Components:**

- Policy card with all selected parameters
- Premium calculation with detailed breakdown
- Policy terms and conditions highlights
- Important disclaimers and notices
- Educational elements

**Copy Approach:**

- Header: "Your Bitcoin Protection Policy" (4 words)
- Parameters: "Protected Value: $43,650" (concise label + value format)
- Premium: "Total Cost: $9.18" (3 words)
- Disclaimers: Brief, clear statements about important conditions
- Terms: Expandable key terms section with concise explanations

**Visual Elements:**

- Policy card with visual summary of selections
- Premium breakdown visualization
- Timeline showing protection period with key dates
- Protection status indicator (shield icon)
- Expandable sections for additional details

**Interaction Design:**

- Expandable sections for detailed information
- "View Simulator" button to return to protection simulator
- Educational tooltips on technical terms
- Clear call-to-action for proceeding to confirmation

**Enhanced Information Elements:**

```
[Policy Information Component]
- Protection Summary
  - Strategy: Standard Protection (90%)
  - Amount: 0.25 BTC ($12,125)
  - Duration: 30 Days (Expires: May 11, 2023)
  - Status: Active upon payment

- Premium Details
  - Base Premium: $9.00
  - Platform Fee: $0.18
  - Total: $9.18
  - Payment Method: STX Wallet

- Key Information
  - Activation: Automatic when price falls below protected value
  - Settlement: Direct to connected wallet
  - Early Termination: Not available

- Important Disclaimers
  - Price Oracle: Protection based on BTC-USD Index Price
  - Counterparty Risk: Fully collateralized by smart contract
  - Market Conditions: Extreme volatility may affect activation
```

### 3.8 Step 5: Confirmation & Activation

**Screen Purpose:** Final review and activation of protection policy

**UI Components:**

- Comprehensive but concise policy summary
- Payment breakdown
- Terms agreement checkbox
- Primary activation button

**Copy Approach:**

- Header: "Activate Your Bitcoin Protection" (4 words)
- Summary: Key parameters in label:value format
- Payment: "Total: $9.18 (Premium: $9.00 + Fee: $0.18)" (concise breakdown)
- Action: "Activate Protection" (2 words)

**Visual Elements:**

- Visual summary of protection configuration
- Payment visualization
- Activation button with shield icon
- Success state animation

**Interaction Design:**

- Terms agreement checkbox with expandable full terms
- Clear activation button with loading state
- Success confirmation animation
- Redirect to dashboard after successful activation

## 4. Journey Flow Interactions

### 4.1 Navigation Patterns

The streamlined flow employs consistent navigation patterns:

- **Primary Progression**: Large "Continue" button at bottom of each screen
- **Back Navigation**: Less prominent "Back" button in top navigation
- **Skip Options**: Where appropriate, "Skip" option for optional steps
- **Help Access**: Consistent help icon location with contextual information
- **Progress Indication**: Current step highlighted in progress indicator

### 4.2 Progressive Disclosure Strategy

To maintain clean interfaces while providing necessary information:

| Information Level | Presentation               | Access Method              |
| ----------------- | -------------------------- | -------------------------- |
| Essential         | Always visible             | Direct on-screen           |
| Important         | Collapsed by default       | Single tap expand/collapse |
| Supplementary     | Hidden in help system      | Tap help icon or tooltip   |
| Technical         | Available in advanced view | Toggle advanced mode       |

### 4.3 Error Prevention & Recovery

The interface employs several strategies to prevent errors:

- **Real-time Validation**: Input fields validate as user types
- **Guided Selection**: Pre-calculated options minimizing free input
- **Smart Defaults**: Context-aware default selections
- **Confirmation Step**: Final review before committing
- **Recovery Options**: Clear paths to correct mistakes

## 5. Variable-Specific UX Components

### 5.1 Protected Value (Strike Price) Components

The protected value variable uses these specific components:

**Strategy Selection Cards:**

```
[Card Component]
Icon: Shield with percentage indicator
Header: "Standard Protection"
Value: "90% of current BTC price"
Description: "10% buffer before protection activates"
Premium Indicator: ●●● (visual dots)
Selection State: Selected/Unselected
```

**Price Protection Visualization:**

```
[Chart Component]
Elements:
- Current BTC price line ($48,500)
- Protected value line ($43,650)
- Protection zone (shaded area below protected value)
- Unprotected zone (unshaded area between lines)
- Price axis with key values labeled
Interaction: Updates dynamically with strategy selection
```

### 5.2 Protection Amount (Contract Size) Components

**Amount Input Component:**

```
[Input Component]
Elements:
- BTC/Sats toggle
- Numerical input field
- USD value conversion (real-time)
- Quick-select percentage buttons
- Connected wallet balance reference
Validation: Min/max amount enforcement
```

**Amount Visualization:**

```
[Visualization Component]
Elements:
- Visual representation of protected vs unprotected holdings
- Proportion indicator showing percentage of total holdings
- Protection coverage indicator
Interaction: Updates dynamically with amount changes
```

### 5.3 Protection Duration Components

**Duration Tab System:**

```
[Tab Component]
Primary Tabs:
- Standard (30/60/90 days)
- Extended (6 months/1 year)
- Strategic (Until next halving)
- Custom (User-defined)
Secondary Selection: Option cards within each tab
Interaction: Tab selection reveals relevant duration options
```

**Timeline Visualization:**

```
[Timeline Component]
Elements:
- Today marker
- Protection period visualization
- Expiration date indicator
- Market event markers (halving, etc.)
Interaction: Updates with duration selection
```

### 5.4 Protection Simulator Components

**Simulator Panel:**

```
[Sliding Panel Component]
States:
- Expanded: Full simulator visible
- Collapsed: Only toggle button visible
- Mobile: Full screen modal

Toggle Controls:
- Desktop: Side panel toggle with "Simulator" label
- Mobile: Bottom sheet pull handle or modal button

Layout:
- Header with title and close button
- Tab navigation (Chart/Settings)
- Main content area (chart or controls)
- Key metrics summary
- Information footer
```

**Chart Components:**

```
[Chart Component]
Elements:
- Interactive area chart with price on x-axis, value on y-axis
- Current price reference line (vertical)
- Protected value reference line (vertical)
- Break-even price reference line (optional)
- Protection zone shading (below protected value for PUT)
- Custom tooltip showing price and protection value
- Price selection indicator (draggable/tappable)

Interaction:
- Drag to select different price points
- Tap/click on chart to view value at that price
- Visual feedback when crossing protected value threshold
- Automatic recalculation as price selection changes
```

**Metrics Display:**

```
[Metrics Grid Component]
Layout: 2×2 or 1×4 grid of key metrics
Items:
- Maximum Benefit: Value with green indicator
- Maximum Loss: Value with red indicator
- Break-even Price: Value with blue indicator
- Premium Cost: Value with purple indicator

Each metric includes:
- Label: Concise description
- Value: Calculated amount
- Visual indicator: Color dot or mini icon
- Optional tooltip: Further explanation
```

**Variables Controls:**

```
[Variables Tab Component]
Controls:
- Protected Value: Slider with numerical input
- Protection Amount: Input field with BTC/USD toggle
- Optional Override: Manual premium adjustment

Layout:
- Each variable in separate section
- Label + control + current value
- Reset button to return to original values
- Apply button to update simulation
```

### 5.5 Policy Preview Components

**Protection Outcome Simulator:**

```
[Simulator Component]
Elements:
- Interactive price slider
- Outcome calculation based on selected price
- Visual representation of protection activation
- Protection value calculation display
Scenarios:
- No activation (price above protected value)
- Partial activation (price slightly below protected value)
- Full activation (price significantly below protected value)
```

**Premium Breakdown:**

```
[Premium Component]
Elements:
- Total premium amount with prominent display
- Fee breakdown (premium + platform fee)
- Premium factors (collapsible)
- Value comparison (protection value vs premium cost)
```

## 6. Implementation Requirements

### 6.1 Technical Dependencies

The streamlined UX requires these technical components:

- **Real-time Price Data**: Sub-minute Bitcoin price updates
- **Protection Engine**: Backend for strategy-to-contract parameter conversion
- **Premium Calculator**: Dynamic pricing based on user selections
- **Smart Contract Integration**: Automated policy creation and management
- **Wallet Connection**: Secure wallet integration for transactions
- **Simulation Engine**: Protection outcome visualization tools

### 6.2 Performance Requirements

To ensure a responsive experience:

- **Render Time**: Each screen must render within 300ms
- **Calculation Speed**: Premium updates must complete within 200ms
- **Animation Smoothness**: Transitions maintain 60fps
- **Data Freshness**: Price data no more than 60 seconds old
- **Reliable Connectivity**: Graceful handling of connectivity issues

### 6.3 Responsive Design Requirements

The interface must adapt across device types:

- **Mobile-First**: Primary design for mobile experience
- **Desktop Enhancements**: Additional visualization capabilities on larger screens
- **Tablet Optimization**: Hybrid approach leveraging additional screen space
- **Consistent Components**: Core components maintain consistency across breakpoints
- **Adaptive Layout**: Repositioning of elements based on screen size

### 6.4 Simulation Engine Requirements

To power the Protection Simulator:

- **Real-time Calculation**: Calculate protection values across price range in <100ms
- **Interactive Visualization**: Render and update chart with <16ms frame budget (60fps)
- **Parameter Validation**: Validate and constrain parameter adjustments
- **Data Generation**: Generate appropriate data points across price range
- **Memory Optimization**: Efficient data structures for mobile performance
- **Offline Support**: Basic simulation capability without real-time price data

## 7. Testing Approach

### 7.1 Usability Testing Protocol

Key areas for focused usability testing:

- **Task Completion Rate**: Measure successful completion of protection setup
- **Time-on-Task**: Evaluate efficiency of streamlined flow
- **Error Rate**: Identify confusion points or input errors
- **Comprehension Testing**: Verify understanding of key protection concepts
- **Satisfaction Metrics**: Measure perceived usability and clarity

### 7.2 Technical Testing Requirements

Technical validation should focus on:

- **Cross-device Compatibility**: Functioning across device types
- **Performance Benchmarking**: Meeting specified render/response times
- **Contract Integration**: Accurate translation of UI selections to contract parameters
- **Wallet Interaction**: Reliable connectivity and transaction submission
- **Data Accuracy**: Correct calculations and conversions throughout

## 8. Development Phasing

### 8.1 MVP Essential Components

Phase 1 implementation priorities:

1. **Core Flow Structure**: Step-by-step journey with individual variable screens
2. **Strategy-Based Protection Selection**: Mental model-aligned selection interface
3. **Basic Visualization**: Simple visual explanation of protection concepts
4. **Wallet Integration**: Secure connection and transaction capabilities
5. **Assisted Counterparty Backend**: Direct fulfillment of protection requests

### 8.2 Post-MVP Enhancements

Planned enhancements after initial launch:

1. **Advanced Simulator**: More sophisticated outcome visualization tools
2. **Market Insights**: Contextual market data to inform decisions
3. **Portfolio Integration**: Multiple policy management
4. **Enhanced Visuals**: More detailed charts and visualizations
5. **P2P Marketplace View**: Optional view of peer marketplace (dual-mode interface)

## 9. Mobile-First Screen Mockups

### Protection Goal Selection

```
┌─────────────────────────────┐
│ ⬅ The Bitcoin Insurance Company      [1]─2─3─4─5 │
├─────────────────────────────┤
│                             │
│ What Are You Looking        │
│ to Protect?                 │
│                             │
│ ┌─────────────────────────┐ │
│ │ 🛡️                      │ │
│ │ Protect My Bitcoin Value│ │
│ │                         │ │
│ │ Guard against price     │ │
│ │ drops while maintaining │ │
│ │ upside potential        │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ 🔒                      │ │
│ │ Secure My Future        │ │
│ │ Purchase                │ │
│ │                         │ │
│ │ Lock in maximum purchase│ │
│ │ price for future Bitcoin│ │
│ └─────────────────────────┘ │
│                             │
│         [ Continue ▶ ]      │
└─────────────────────────────┘
```

### Protected Value Strategy Selection

```
┌─────────────────────────────┐
│ ⬅ The Bitcoin Insurance Company      1─[2]─3─4─5 │
├─────────────────────────────┤
│                             │
│ How Much Protection         │
│ Do You Need?                │
│                             │
│ Current BTC: $48,500        │
│                             │
│ ┌─────────────────────────┐ │
│ │ 🛡️🛡️🛡️🛡️              │ │
│ │ Maximum Protection      │ │
│ │ 100% of current value   │ │
│ │ Premium: ●●●● (Highest) │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ 🛡️🛡️🛡️                 │ │
│ │ Standard Protection  ✓  │ │
│ │ 90% of current value    │ │
│ │ Premium: ●●● (Standard) │ │
│ └─────────────────────────┘ │
│                             │
│ [Protection chart showing   │
│  levels with $43,650 line]  │
│                             │
│         [ Continue ▶ ]      │
└─────────────────────────────┘
```

### Protection Amount Selection

```
┌─────────────────────────────┐
│ ⬅ The Bitcoin Insurance Company      1─[2]─3─4─5 │
├─────────────────────────────┤
│                             │
│ How Much Bitcoin Do You     │
│ Want to Protect?            │
│                             │
│ ┌─────────────────────────┐ │
│ │  0.25 BTC  ≈  $12,125   │ │
│ │    [BTC ⟷ SATS]         │ │
│ └─────────────────────────┘ │
│                             │
│ Select portion of holdings: │
│ [ 25% ][ 50% ][ 75% ][100%] │
│                             │
│ Your wallet: 1.25 BTC       │
│                             │
│ [Visual showing 20% of      │
│  holdings being protected]  │
│                             │
│ Minimum: 0.01 BTC           │
│                             │
│         [ Continue ▶ ]      │
└─────────────────────────────┘
```

### Protection Duration Selection

```
┌─────────────────────────────┐
│ ⬅ The Bitcoin Insurance Company      1─2─[3]─4─5 │
├─────────────────────────────┤
│                             │
│ How Long Do You Need        │
│ Protection?                 │
│                             │
│ [Standard][Extended][Strategic] │
│                             │
│ ┌─────────────────────────┐ │
│ │ 30 Days               ✓ │ │
│ │ Basic protection        │ │
│ │ Premium: ●● (Low)       │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ 60 Days                 │ │
│ │ Extended coverage       │ │
│ │ Premium: ●●● (Medium)   │ │
│ └─────────────────────────┘ │
│                             │
│ [Timeline visualization     │
│  showing coverage period]   │
│                             │
│         [ Continue ▶ ]      │
└─────────────────────────────┘
```

### Protection Simulator

```
┌─────────────────────────────┐
│ ⬅ The Bitcoin Insurance Company   Protection Sim │
├─────────────────────────────┤
│                             │
│ [Chart][Adjust Variables]   │
│                             │
│ [Protection Value Chart     │
│  showing area graph with    │
│  current price ($48,500)    │
│  and protected value        │
│  ($43,650) reference lines] │
│                             │
│ If BTC drops to: $38,800    │
│ Your protection: $4,850     │
│                             │
│ ┌─────────┐    ┌─────────┐  │
│ │ Max     │    │ Max     │  │
│ │ Benefit │    │ Loss    │  │
│ │ $4,850  │    │ $9.18   │  │
│ └─────────┘    └─────────┘  │
│ ┌─────────┐    ┌─────────┐  │
│ │ Break   │    │ Premium │  │
│ │ Even    │    │ Cost    │  │
│ │ $42,732 │    │ $9.18   │  │
│ └─────────┘    └─────────┘  │
│                             │
│    [ Continue to Review ]   │
└─────────────────────────────┘
```

### Policy Preview

```
┌─────────────────────────────┐
│ ⬅ The Bitcoin Insurance Company      1─2─3─[4]─5 │
├─────────────────────────────┤
│                             │
│ Your Bitcoin                │
│ Protection Policy           │
│                             │
│ ┌─────────────────────────┐ │
│ │ Standard Protection     │ │
│ │ Protected Value: $43,650│ │
│ │ Amount: 0.25 BTC        │ │
│ │ Duration: 30 Days       │ │
│ │ Expires: May 11, 2023   │ │
│ └─────────────────────────┘ │
│                             │
│ Premium Details:            │
│ Base Premium:     $9.00     │
│ Platform Fee:     $0.18     │
│ Total Cost:       $9.18     │
│                             │
│ Important Information:      │
│ • Automatic activation when │
│   price falls below $43,650 │
│ • Settlement directly to    │
│   your connected wallet     │
│                             │
│ [View Simulator] [Continue] │
└─────────────────────────────┘
```

### Confirmation & Activation

```
┌─────────────────────────────┐
│ ⬅ The Bitcoin Insurance Company      1─2─3─4─[5] │
├─────────────────────────────┤
│                             │
│ Activate Your Bitcoin       │
│ Protection                  │
│                             │
│ Protection Summary:         │
│ • Protected Value: $43,650  │
│ • Amount: 0.25 BTC          │
│ • Duration: 30 Days         │
│ • Expires: May 11, 2023     │
│                             │
│ Payment:                    │
│ Premium: $9.00              │
│ Platform Fee: $0.18         │
│ Total: $9.18                │
│                             │
│ [✓] I agree to the Terms    │
│                             │
│ [ Activate Protection ]     │
│                             │
└─────────────────────────────┘
```

## 10. Conclusion: Benefits of Streamlined Approach

The proposed streamlined UX specification offers several key benefits:

1. **Reduced Cognitive Load**: Breaking complex variables into focused micro-decisions
2. **Enhanced Comprehension**: Clear, concise copy with visual reinforcement
3. **Improved Conversion**: More intuitive journey with less friction
4. **Better Mobile Experience**: Clean interface optimized for smaller screens
5. **Faster Implementation**: Clearer specification for development team
6. **Future Scalability**: Modular approach allows for component evolution

By focusing on one key variable per screen with minimal but precise text, we create a Bitcoin protection experience that feels intuitive and accessible while maintaining the sophistication needed for effective risk management.

## 11. Next Steps

1. **Design Prototype Development**: Create interactive prototype of streamlined flow
2. **Usability Testing**: Validate approach with target Bitcoin users
3. **Visual Design Refinement**: Develop full visual language based on mockups
4. **Component Development**: Build reusable UI components for implementation
5. **Integration Planning**: Coordinate with backend teams on API requirements

This specification provides the foundation for developing a truly Bitcoin-native protection experience that balances simplicity with sophistication.
