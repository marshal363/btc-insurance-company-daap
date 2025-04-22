# The Bitcoin Insurance Company: Product Requirements Document (PRD) - Updated

## Introduction

The Bitcoin Insurance Company is a decentralized application built on the Stacks blockchain that helps everyday Bitcoin users protect the value of their Bitcoin holdings against market volatility. While traditional hedging tools like options contracts exist, they remain inaccessible to regular users due to complex financial jargon and intimidating interfaces. The Bitcoin Insurance Company solves this problem by transforming options contracts into simple, understandable "Bitcoin protection policies" that function like familiar insurance products.

This PRD outlines a complete Bitcoin Protection Center focused on our primary persona "Protective Peter" - an everyday Bitcoin user who wants security against price drops without needing to understand complex trading terminology.

## Document Information

- **Version**: 3.0
- **Date**: November 15, 2024
- **Project**: The Bitcoin Insurance Company – Bitcoin Protection Center
- **Focus**: Making Bitcoin value protection accessible to everyone

## 1. Executive Summary

The Bitcoin Insurance Company is a decentralized application that allows everyday Bitcoin users to protect themselves against price volatility through easy-to-understand protection policies. Using familiar insurance concepts instead of complex financial jargon, our Bitcoin Protection Center guides users through selecting, customizing, and activating protection for their Bitcoin holdings or future purchases. Built on the Stacks blockchain, the platform ensures self-custody and trustlessness while providing peace of mind through guaranteed Bitcoin value protection.

## 2. Vision & Objectives

### Vision

To empower everyday Bitcoin users with simple protection tools that shield them from market volatility, making long-term Bitcoin holding accessible to risk-averse individuals without requiring financial expertise.

### Objectives

- **Primary**: Provide Bitcoin holders with understandable, accessible protection against price volatility
- **Secondary**: Eliminate financial jargon barriers through insurance-based terminology
- **Tertiary**: Create a step-by-step guided experience anyone can follow

## 3. Target Audience

### Primary Persona: "Protective Peter"

- **Profile**: 35-year-old software developer who invested in Bitcoin but worries about market volatility
- **Technical Proficiency**: Comfortable with Bitcoin wallets but has no trading experience
- **Goals**:
  - Protect the value of his Bitcoin during market downturns
  - Maintain ownership of his Bitcoin (self-custody)
  - Avoid complex trading platforms with unfamiliar terminology
- **Pain Points**:
  - Anxiety during market crashes
  - Confusion with financial terminology
  - Fear of making mistakes with complex trading tools
- **Needs**:
  - Simple, clear language without financial jargon
  - Step-by-step guidance through protection setup
  - Visual confirmation of protection coverage
  - Transparent cost structure with no hidden fees

### Secondary Personas

- **"Future Fred"**: Wants to lock in today's Bitcoin price for a future purchase
- **"Income Irene"**: Seeks to earn premiums by providing protection to others
- **"Newbie Nancy"**: First-time Bitcoin buyer looking for beginner-friendly protection

## 4. Key Features & Functionality

### Bitcoin Protection Center

A guided, step-by-step flow that transforms options contracts into approachable protection policies:

#### Step 1: Protection Type Selection

- **Question-Based Approach**: "What are you looking to protect?"
- **Simplified Options**:
  - "Protect my Bitcoin holdings" (downside protection)
  - "Protect my future purchase" (price lock protection)
- **Educational Elements**: How Bitcoin protection works using insurance concepts

#### Step 2: Coverage Details

- **Amount Selection**: Choose how much Bitcoin to protect
- **Protection Level**: Visual slider to select protected value (with real-time feedback)
- **Visualizations**: Clear illustrations of protection activation levels

#### Step 3: Policy Duration

- **Tiered Protection Timeframes**: Four distinct duration categories aligned with Bitcoin market dynamics:
  - **Standard Protection** (30, 60, 90 days): "Affordable short-term coverage for immediate concerns"
  - **Extended Protection** (6 months, 1 year): "Longer-term coverage for hodlers with premium discounts"
  - **Strategic Protection** (until next halving): "Bitcoin-aware protection aligned with market cycles"
  - **Customizable Protection**: "Build your own protection based on specific timeframes or market events"
- **Duration Explanation**: Educational content explaining how Bitcoin's unique market cycles affect protection costs
- **Volatility Visualization**: Interactive tool showing how Bitcoin's volatility increases premium costs over time
- **User-Appropriate Recommendations**: Suggestions based on user profile and protection amount

#### Step 4: Available Policies

- **Policy Comparison**: View available protection options based on selections
- **Plain-Language Descriptions**:
  - "Full Value Protection" (ITM options)
  - "Threshold Coverage" (ATM options)
  - "Precautionary Coverage" (OTM options)
- **Protection Simulator**: Visualization tool showing outcomes in different scenarios

#### Step 5: Review & Activate

- **Protection Summary**: Clear overview of all selected parameters
- **Cost Breakdown**: Transparent presentation of premium and fees
- **Activation Confirmation**: Explanation of what happens after activation

### Technical Underpinnings

The Bitcoin Protection Center is powered by Clarity smart contracts on the Stacks blockchain that implement options contracts with these core functions:

- **Create Protection Policy**: Protection provider locks sBTC to offer coverage
- **Purchase Protection**: User pays premium to acquire protection
- **Exercise Protection**: User claims protected value when Bitcoin price falls below protection level
- **Policy Expiration**: Protection expires after the selected time period if not exercised

### Wallet Integration

- Seamless connection with Hiro Wallet for Stacks/sBTC transactions
- Clear transaction confirmation and status updates
- Non-custodial protection (users maintain control of their assets)

## 5. User Journeys

### Primary User Journey: Protecting Bitcoin Holdings

#### 1. Discovery & Education

- User arrives at The Bitcoin Insurance Company landing page
- Learns about Bitcoin protection through simple explanations
- Clicks "Get Protected" to begin

#### 2. Protection Setup

- Connects wallet to The Bitcoin Insurance Company
- Selects "Protect my Bitcoin holdings"
- Specifies amount to protect (e.g., 0.25 BTC)
- Selects protection level (e.g., 10% below current price)
- Chooses 30-day protection period
- Reviews available policies and selects Threshold Coverage

#### 3. Activation & Monitoring

- Reviews protection summary showing:
  - Protected amount: 0.25 BTC ($12,125)
  - Protected value: $43,650 (10% below current price)
  - Protection period: 30 days
  - Premium cost: $9.18 total
- Confirms and activates protection
- Receives confirmation of active protection policy

#### 4. Protection Outcome Scenarios

- **Scenario A**: If Bitcoin stays above $43,650, protection remains dormant
- **Scenario B**: If Bitcoin drops below $43,650, user can exercise protection to maintain value
- **Scenario C**: After 30 days, protection expires if not exercised

### Secondary User Journey: Protecting Future Purchase

- User selects "Protect my future purchase"
- Configures purchase amount, price level, and timeframe
- Activates price lock protection
- Can purchase Bitcoin at guaranteed price if market rises

## 6. Interface Requirements

### Global Elements

- **Header**: The Bitcoin Insurance Company logo, wallet connection status, network indicator
- **Progress Indicator**: 5-step visual tracker showing current position in process
- **Navigation**: Back/Continue buttons for moving between steps

### Step-Specific Elements

#### Protection Type Selection Screen

- Two clear options with descriptive cards
- Shield icons with appropriate colors
- Clear benefit statements and use cases
- "How Bitcoin Protection Works" explainer section

#### Coverage Details Screen

- Current BTC price display
- Protection level selector with visual slider
- Amount input with real-time USD conversion
- Minimum amount requirements information

#### Policy Duration Screen

- Duration options with clear categorization
- Premium estimation based on selections
- Coverage summary showing selected parameters
- Educational content about duration impact

#### Available Policies Screen

- Policy cards with different protection strategies
- Clear premium costs and duration information
- Select buttons for choosing preferred policy
- "Show Protection Value Simulator" option

#### Review & Activate Screen

- Protection summary with policy type indication
- Detailed breakdown of protection parameters
- Payment details with premium breakdown
- "Activate Protection" button with terms acknowledgment

### Visual Design Principles

- **Clarity**: Simple cards, concise text, consistent color coding
- **Reassurance**: Shield icons, protection-focused imagery
- **Accessibility**: High contrast, readable typography, responsive design
- **Education**: Contextual explanations at point of relevance

## 7. Technical Requirements

### Blockchain Integration

- **Platform**: Stacks blockchain for Bitcoin-secured finality
- **Token**: sBTC (1:1 Bitcoin-backed asset)
- **Smart Contracts**: Clarity smart contracts implementing options mechanics
- **Transaction Handling**: Proper post-conditions for safe transfers

### Frontend Implementation

- **Framework**: Next.js with App Router
- **Component Library**: shadcn/ui with Tailwind CSS
- **State Management**: Zustand for predictable state flow
- **Form Handling**: React Hook Form with Zod validation
- **Visualization**: Recharts/D3.js for protection simulations

### Data Requirements

- **Bitcoin Price Data**: Current BTC/USD price (via API or oracle)
- **Protection Parameters**: Strike prices, premiums, durations
- **User Data**: Connected wallet, protection policies, transaction history
- **Contract Data**: Available protection policies, exercise status

## 8. Success Metrics

### User-Centric Metrics

- **Comprehension Rate**: 90% of users can correctly explain their protection policy
- **Completion Rate**: 80% of users who begin the protection flow complete it
- **Confidence Score**: 85% of users report feeling "confident" or "very confident" in their protection
- **Protection Activation**: Users successfully exercise protection when appropriate

### Business Metrics

- **Protection Volume**: Total value of Bitcoin protected through the platform
- **Active Policies**: Number of active protection policies
- **Renewal Rate**: Percentage of users who renew protection after expiry
- **User Growth**: Month-over-month increase in unique users

## 9. Limitations & Constraints

- **Education Required**: Even with simplified language, some basic explanation is needed
- **Price Data Dependency**: Accurate and timely Bitcoin price data is essential
- **Block Confirmation Times**: Stacks block times affect transaction confirmation speed
- **Initial Liquidity**: Early platform adoption requires sufficient protection providers

## 10. Implementation Plan

### Phase 1: Core Protection Flow

- Implement the 5-step protection journey
- Build key protection components
- Integrate with Stacks blockchain
- Deploy smart contracts

### Phase 2: Protection Experience

- Refine insurance terminology throughout
- Add contextual educational elements
- Implement protection simulation tools
- Optimize visual feedback

### Phase 3: Testing & Refinement

- Conduct user testing with everyday Bitcoin users
- Identify and eliminate remaining jargon
- Optimize the experience for clarity and confidence
- Prepare for launch

## 11. Future Enhancements

- Mobile app version of Bitcoin Protection Center
- Advanced protection strategies (laddered, rolling)
- Portfolio view of active protection policies
- **Enhanced Duration Options**: Implementation of Strategic and Customizable Protection timeframes
- **Cycle-Based Protection Bundles**: Pre-configured protection packages aligned with Bitcoin market cycles
- **Dynamic Premium Pricing**: Time-based discounts for longer protection commitments
- **Milestone-Based Protection**: Protection triggered by specific Bitcoin events rather than calendar dates
- Protection bundle packages

## 12. Appendix

### A. Insurance Terminology Mapping

| Traditional Term | Insurance-Based Term (PUT)    | Insurance-Based Term (CALL) |
| ---------------- | ----------------------------- | --------------------------- |
| Options contract | Bitcoin protection policy     | Bitcoin price lock policy   |
| Premium          | Insurance premium             | Lock-in fee                 |
| Strike price     | Protected value               | Guaranteed purchase price   |
| Expiration       | Policy period/Coverage period | Price guarantee period      |
| Exercise         | File a claim                  | Redeem price guarantee      |
| Moneyness (ITM)  | Active coverage               | Valuable guarantee          |
| Moneyness (ATM)  | Threshold coverage            | At-market guarantee         |
| Moneyness (OTM)  | Precautionary coverage        | Future-value guarantee      |

### B. Protection Scenarios Visualization

For a PUT protection policy with:

- Protected amount: 0.25 BTC
- Current price: $48,500
- Protected value: $43,650 (10% below current)
- Premium: $9.00 + $0.18 fee

**Scenario 1**: BTC falls to $38,000

- Without protection: 0.25 BTC valued at $9,500 (loss of $2,625)
- With protection: Can sell at $43,650 (saving $1,412.50 minus premium)

**Scenario 2**: BTC rises to $55,000

- Value increases to $13,750
- Protection not needed (only cost is premium paid)

### C. Educational Content Examples

**How Bitcoin Protection Works**

- Bitcoin protection policies give you financial security against adverse price movements
- Pay a small premium for guaranteed price protection
- Choose your protection amount and duration
- Exercise your protection only if market conditions are unfavorable
- Maintain full upside potential with limited downside risk

**Understanding Bitcoin Protection Durations**

- **Standard Protection (30-90 days)**: Ideal for short-term concerns and immediate price volatility
- **Extended Protection (6 months-1 year)**: Provides longer coverage with premium discounts for hodlers
- **Strategic Protection (until next halving)**: Aligns with Bitcoin's natural 4-year market cycles
- **Customizable Protection**: Creates personalized coverage based on your specific needs and market outlook

**How Bitcoin Cycles Affect Protection Costs**

- Bitcoin's 4-year halving cycles create predictable volatility patterns
- Protection costs increase with duration due to increased uncertainty
- Strategic timeframes can optimize protection costs relative to historical cycle patterns
- Longer durations provide greater peace of mind but at incrementally higher premium costs

## Conclusion

The Bitcoin Insurance Company Protection Center represents a fundamental reimagining of how Bitcoin users can protect themselves against market volatility. By transforming complex options mechanisms into familiar insurance concepts, we make sophisticated financial protection accessible to everyday users without requiring specialized knowledge. This approach democratizes risk management tools, enabling broader Bitcoin adoption by addressing the volatility concerns that prevent many potential users from holding Bitcoin long-term.
