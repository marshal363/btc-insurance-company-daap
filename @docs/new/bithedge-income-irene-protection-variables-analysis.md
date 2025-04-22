# The Bitcoin Insurance Company: Bitcoin-Native Protection Provider Variables Analysis

## Executive Summary

As Senior Bitcoin Product Designer for The Bitcoin Insurance Company, I've conducted a comprehensive analysis of how to translate complex options contract variables into Bitcoin-native concepts for protection providers (PUT sellers). While our previous analysis reimagined the buyer experience ("Protective Peter"), this document focuses on creating an equally intuitive experience for protection providers ("Income Irene") who form the essential counterparty in our ecosystem.

Building on the assisted counterparty model recommended for our MVP, this analysis examines key options variables from the provider perspective, proposing Bitcoin-native alternatives that emphasize yield generation, risk management, and strategic Bitcoin acquisition. The approach maintains our core design philosophy of transforming sophisticated financial instruments into intuitive tools for Bitcoin holders, while addressing the unique needs and mental models of protection providers.

## Smart Contract vs. User-Facing Variables: The Provider Translation Layer Under Assisted Counterparty Model

Under the assisted counterparty model, several variables can be simplified or automated in the UI, while keeping the core experience intact. The model significantly simplifies the provider experience by removing the need for granular policy decisions while maintaining their ability to generate yield with different risk-reward profiles.

Here's how the technical variables translate to the user interface in this model:

| Technical Variable (Smart Contract)    | Bitcoin Protection Provider Variable (User Interface) | Implementation in Provider UI Under Assisted Counterparty Model                                                 |
| -------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Strike Price**                       | **Yield Activation Level**                            | Simplified to pre-set risk tiers, individual providers don't need to set specific strike prices for each policy |
| **Option Type (PUT/CALL)**             | **Income Strategy**                                   | Retained - Providers choose which type of protection they want to provide                                       |
| **Expiration Date**                    | **Income Period**                                     | Retained - Providers select commitment duration with potential lockup periods                                   |
| **Contract Size**                      | **Capital Commitment**                                | Retained - Providers specify how much STX/sBTC they want to commit to the pool                                  |
| **Premium**                            | **Yield Income**                                      | Retained - Clear visualization of expected returns based on capital commitment                                  |
| **Moneyness (ITM/ATM/OTM)**            | **Risk-Yield Balance**                                | Simplified to pre-set risk tiers (Conservative/Balanced/Aggressive) that providers can select                   |
| **Exercise Process**                   | **Yield Distribution Process**                        | Simplified - Technical details largely automated with providers only needing to understand the general process  |
| **Option Greeks (Delta, Gamma, etc.)** | Hidden from user interface                            | Entirely automated - The algorithmic system manages these parameters                                            |
| **Settlement Method**                  | **Strategy Outcome**                                  | Simplified - Technical details of settlement largely automated with clear visualization of potential outcomes   |
| **Mark-to-Market Value**               | **Current Strategy Value**                            | Retained - Real-time view of their capital's performance within the pool                                        |
| **Open Interest & Volume**             | **Market Demand**                                     | Simplified - Shown as overall pool statistics rather than individual contracts                                  |

### Key Translation Principles for Protection Providers in Assisted Counterparty Model:

1. **Yield-Focused Framing**: All variables are presented in terms of income generation rather than protection
2. **Risk-Transparent Presentation**: Clear visualization of potential risks alongside yield benefits through simplified risk tiers
3. **Acquisition Strategy Integration**: Framing PUT selling as a Bitcoin acquisition strategy at preferred prices, but without granular strike price selection
4. **Capital Efficiency Focus**: Emphasis on efficient use of STX/sBTC collateral with clear ROI metrics
5. **Bitcoin Market Alignment**: Strategies aligned with Bitcoin market cycles and holder behaviors
6. **Simplified Decision-Making**: Complex variables handled by the algorithmic system, allowing providers to focus on core parameters

### Technical to User-Facing Variable Mapping for Providers:

For each key variable, our system performs a provider-focused translation with simplifications appropriate to the assisted counterparty model:

**Strike Price → Yield Activation Level:**

- Technical implementation: Fixed price point in contract that determines option payoff
- User presentation: Simplified to risk tier selection rather than specific price points
- Backend translation: Risk tier selection converted to appropriate strike prices by the algorithmic system

**Option Type → Income Strategy:**

- Technical implementation: PUT/CALL flag determining contract behavior
- User presentation: Goal-based selection focusing on income source and risk profile
- Backend translation: "Generate income from Bitcoin stability" becomes PUT selling; "Earn yield by lending upside potential" becomes CALL selling

**Expiration Date → Income Period:**

- Technical implementation: Block height or timestamp when contract expires
- User presentation: Duration-based selection with Bitcoin cycle awareness and yield implications
- Backend translation: Selected timeframe converted to exact block height or timestamp for contract

**Contract Size → Capital Commitment:**

- Technical implementation: Specific amount of the underlying collateral in the contract
- User presentation: Amount of STX/sBTC to commit with wallet integration and yield projections
- Backend translation: User-selected amount distributed across multiple contracts by the algorithmic system

By implementing this simplified provider-focused translation layer, we maintain the full technical functionality of options contracts while presenting an intuitive income generation experience that aligns with how Bitcoiners think about yield and strategic Bitcoin acquisition, without overwhelming them with technical complexity.

## The Balancing Act: Finding the Right Terminology for Providers

Our research into Bitcoin-native terminology for protection providers reveals three potential terminology approaches that balance authenticity with clarity:

1. **Bitcoin-Native Maximum**: Terminology deeply embedded in Bitcoin culture ("Stack Builder," "STX Yield Mine")
2. **Balanced Bitcoin-Adjacent**: Terms that hint at Bitcoin knowledge while remaining approachable ("Yield Strategy," "Bitcoin Acquisition Level")
3. **Income-Adjacent**: Familiar financial language with minimal Bitcoin jargon ("Income Threshold," "Yield Timeline")

Each approach has unique strengths and target audiences:

| Approach                  | Best For                                   | Key Strength                                                     | Potential Weakness                   |
| ------------------------- | ------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------ |
| Bitcoin-Native Maximum    | Bitcoin enthusiasts, crypto-native users   | Authentic resonance, cultural belonging                          | May alienate or confuse newcomers    |
| Balanced Bitcoin-Adjacent | Mixed audience, crypto-curious             | Bridges both worlds, accessible introduction to Bitcoin concepts | May not fully satisfy either extreme |
| Income-Adjacent           | Traditional investors, yield-focused users | Immediate comprehension, lower learning curve                    | Lacks Bitcoin distinctiveness        |

**User Testing Recommendation:**
We recommend A/B testing these terminology approaches with different user segments before final implementation, measuring both comprehension and emotional response.

## Options Variables Requiring Bitcoin-Native Transformation for Providers

### 1. Yield Activation Level (Strike Price)

#### Current Challenge:

The concept of "strike price" in options trading is abstract and disconnected from providers' mental models of income generation. Under the assisted counterparty model, individual providers don't need to set specific strike prices for each policy.

#### Bitcoin-Native Approach for Providers Under Assisted Counterparty Model:

Instead of granular strike price selection, providers select risk tiers that align with their goals:

1. **Conservative Yield Tier** - Lower risk with modest income and low acquisition likelihood.

   - _Target Audience_: Yield-focused users who prioritize income over acquisition
   - _Key Advantage_: Simplest approach with most predictable outcomes
   - _When to Use_: For users primarily interested in reliable yield

2. **Balanced Yield Tier** - Moderate risk with standard income and moderate acquisition likelihood.

   - _Target Audience_: Mixed crypto/traditional audiences
   - _Key Advantage_: Good balance between yield and potential acquisition
   - _When to Use_: General platform default tier

3. **Aggressive Yield Tier** - Higher risk with potentially higher returns and higher acquisition likelihood.
   - _Target Audience_: Bitcoin-savvy users focused on strategic accumulation
   - _Key Advantage_: Potential for higher yields or strategic Bitcoin acquisition
   - _When to Use_: For users comfortable with higher risk/reward profiles

**Implementation Recommendations:**

- **Visual Representation**: Risk tier selection with clear implications for both yield and potential acquisition
- **Default Approach**: "Balanced Yield Tier" offers the best starting point for most users
- **Backend System**: Algorithmic management of actual strike prices based on risk tier selection
- **User Interface Elements**: Simple tier selection with transparent risk/reward visualization

### 2. Income Period (Expiration Date)

#### Current Challenge:

Options "expiration dates" feel technical and don't align with how Bitcoin protection providers think about yield generation timeframes.

#### Bitcoin-Native Approach for Providers Under Assisted Counterparty Model:

1. **Income Timeline** - The specific timeframe when your capital is generating yield.

   - _Target Audience_: General audience with some financial product familiarity
   - _Key Advantage_: Clear timeframe metaphor without requiring specialized knowledge
   - _When to Use_: General platform default terminology

2. **Yield Duration** - The time period for your Bitcoin income strategy.
   - _Target Audience_: Traditional finance/investment customers
   - _Key Advantage_: Familiar financial concept requiring no specialized knowledge
   - _When to Use_: For educational materials or onboarding traditional users

**Implementation Recommendations:**

- **Tiered Presentation**: Present standard timeframes (7 days, 30 days, 90 days, etc.)
- **Default Approach**: "Income Timeline" offers the best balance of clarity and Bitcoin relevance
- **Bitcoin-Cycle Integration**: Connect duration options to Bitcoin market cycles
- **Lockup Period Clarity**: Clear explanation of capital lockup implications

### 3. Capital Commitment (Contract Size)

#### Current Challenge:

Options "contract size" is abstract financial jargon disconnected from how Bitcoiners think about committing capital to generate yield.

#### Bitcoin-Native Approach for Providers Under Assisted Counterparty Model:

1. **Strategy Allocation** - The amount of capital allocated to this income strategy.

   - _Target Audience_: General audience
   - _Key Advantage_: Clear, straightforward, works for all experience levels
   - _When to Use_: General platform default terminology

2. **Yield Capital** - The amount of STX/sBTC you're using to generate income.
   - _Target Audience_: Bitcoin-savvy users focused on yield generation
   - _Key Advantage_: Clear focus on capital allocation for yield
   - _When to Use_: When highlighting the yield generation focus

**Implementation Recommendations:**

- **Wallet Integration**: Direct wallet balance display with clear commitment interface
- **Default Approach**: "Strategy Allocation" offers the best balance of clarity and relevance
- **Percentage Selection**: Enable committing specific percentages of total holdings
- **Pool Visualization**: Show how capital contributes to the overall protection pool

### 4. Yield Income (Premium)

#### Current Challenge:

Options "premiums" are abstract financial payments that don't communicate income potential to providers.

#### Bitcoin-Native Approach for Providers Under Assisted Counterparty Model:

1. **Strategy Income** - What you earn for implementing this Bitcoin yield strategy.

   - _Target Audience_: Investment-minded users
   - _Key Advantage_: Frames income as result of strategic decision
   - _When to Use_: When emphasizing the strategic aspects

2. **Yield Return** - The annualized return on your committed capital.
   - _Target Audience_: Traditional finance users
   - _Key Advantage_: Standard financial metric that's easily comparable
   - _When to Use_: When emphasizing the investment return aspect

**Implementation Recommendations:**

- **Sats Denomination**: Display all income in sats with USD equivalents
- **Annualized Yield Display**: Show percentage yield on committed capital
- **Default Approach**: "Strategy Income" offers the best balance of Bitcoin relevance and clarity
- **Expected Return Visualization**: Clear projection of expected returns based on selected parameters

### 5. Risk-Yield Balance (Moneyness)

#### Current Challenge:

Options concepts like "in-the-money" (ITM), "at-the-money" (ATM), and "out-of-the-money" (OTM) are highly abstract for protection providers.

#### Bitcoin-Native Approach for Providers Under Assisted Counterparty Model:

1. **Risk-Reward Tiers** - Categorized levels of yield potential and risk.

   - _Conservative Yield_ (Lowest risk): Lower risk of Bitcoin acquisition with modest income
   - _Balanced Return_ (Moderate risk): Moderate risk with standard yield
   - _Opportunity Seeker_ (Higher risk): Higher likelihood of Bitcoin acquisition with potential for higher returns
   - _Target Audience_: General audience familiar with risk-reward tradeoffs
   - _When to Use_: As primary categorization system

**Implementation Recommendations:**

- **Visual Strategy Cards**: Clearly labeled risk-reward tiers with transparent outcomes
- **Default Approach**: "Risk-Reward Tiers" offers the best balance of clarity and Bitcoin relevance
- **Strategy Simulator**: Include a visual simulator for each tier
- **Simplified Selection**: Focus on tier selection rather than technical details

### 6. Yield Distribution Process (Exercise)

#### Current Challenge:

Options "exercise" is technical financial jargon disconnected from how providers view income distribution.

#### Bitcoin-Native Approach for Providers Under Assisted Counterparty Model:

1. **Strategy Resolution** - The completion of your yield strategy with either income or Bitcoin acquisition.

   - _Target Audience_: Strategy-oriented investors
   - _Key Advantage_: Emphasis on strategy completion
   - _When to Use_: For users focused on strategic outcomes

2. **Yield Outcome** - The final result of your income strategy.
   - _Target Audience_: General audience
   - _Key Advantage_: Clear focus on the strategic outcome
   - _When to Use_: General platform default terminology

**Implementation Recommendations:**

- **Simplified Outcome Process**: Automated resolution with clear notifications
- **Default Approach**: "Strategy Resolution" offers the best balance of clarity and Bitcoin relevance
- **Outcome Transparency**: Clear explanation of how outcomes are determined without technical complexity
- **Notification System**: Proactive alerts about resolution status

## Implementation Strategy

### Creating a Cohesive System for Protection Providers Under Assisted Counterparty Model

Based on our analysis, we recommend implementing a streamlined terminology system for protection providers:

**Balanced Bitcoin-Adjacent System for Assisted Counterparty Model:**

- Risk-Reward Tier (Strike Price - simplified to tiers)
- Income Timeline (Expiration)
- Strategy Allocation (Contract Size)
- Strategy Income (Premium)
- Strategy Resolution (Exercise Process)

This system balances Bitcoin-native language with clarity and simplicity appropriate for the assisted counterparty model.

### Progressive Implementation Plan

We recommend a progressive approach to implementation:

1. **Phase 1: MVP Launch** (4 weeks)

   - Deploy simplified assisted counterparty interface
   - Focus on core variables (Risk-Reward Tier, Income Timeline, Strategy Allocation)
   - Measure comprehension and completion rates

2. **Phase 2: Enhanced Experience** (8 weeks)

   - Add performance dashboards and analytics
   - Implement strategy simulators and educational tools
   - Collect feedback on comprehension and satisfaction

3. **Phase 3: Advanced Features** (12 weeks)
   - Introduce more detailed analytics for advanced users
   - Implement portfolio optimization tools
   - Maintain simplified core experience with optional advanced views

### Design System Updates

Our design system should incorporate these Bitcoin-native variables for protection providers through:

1. **Bitcoin-First Yield Guide**: Comprehensive terminology mapping
2. **Sats-Denominated Yield Components**: UI components designed to display sats values by default
3. **Income Visualization Library**: Bitcoin-specific yield and acquisition visualizations
4. **Provider-Focused Iconography**: Custom icon set representing yield generation concepts
5. **Risk Tier Visualization**: Clear visual system for representing different risk-reward profiles

### Educational Integration

Each reimagined variable should include embedded educational elements:

1. **Contextual Tooltips**: Brief explanations available on-demand
2. **Provider Basics Guide**: Comprehensive explanation of income generation mechanics
3. **Visual Tutorials**: Interactive demonstrations of how yield strategies work
4. **Bitcoin-Native Comparisons**: Familiar analogies from the Bitcoin ecosystem

## Bitcoin-Native Approach Benefits for Protection Providers

This Bitcoin-first approach to protection provider variables delivers several key advantages:

1. **Cognitive Alignment**: Matches how Bitcoiners already think about generating yield
2. **Value Transparency**: Clearly demonstrates the yield value proposition
3. **Reduced Learning Curve**: Leverages familiar Bitcoin concepts and terminology while hiding technical complexity
4. **Self-Custody Emphasis**: Reinforces Bitcoin's core principles throughout the experience
5. **Sats Standard**: Normalizes sats denomination for all yield calculations
6. **Simplified Decision-Making**: Focuses on key decisions while automating technical aspects

## Key Provider Mental Models to Address

Our research has identified four distinct mental models that protection providers (PUT sellers) typically exhibit:

### 1. "Stack More Sats" Mental Model

**User Characteristics:**

- Bitcoin accumulators focused on increasing their holdings
- Users who see yield as a way to accelerate Bitcoin acquisition
- Those willing to provide short-term protection to gain more sats

**Natural Language:**

- "I want to earn more sats without selling my Bitcoin"
- "Using my STX/sBTC to stack more sats makes sense"
- "I'm looking for Bitcoin-denominated yield"

**UX Solution:** Strategy Income terminology with prominent sats-denominated returns, simplified risk tier selection

### 2. "Strategic Bitcoin Buyer" Mental Model

**User Characteristics:**

- Sophisticated Bitcoin investors looking to acquire at specific price levels
- Users who see PUT selling as a Bitcoin acquisition strategy
- Those with clear price targets for increasing their Bitcoin holdings

**Natural Language:**

- "I'd buy more Bitcoin at $40K anyway, so I might as well get paid to wait for it"
- "If the price drops to my target, I get Bitcoin at a discount plus the premium"
- "This lets me set limit orders and earn income while I wait"

**UX Solution:** Aggressive Risk-Reward Tier with clear acquisition likelihood visualization

### 3. "Yield Hunter" Mental Model

**User Characteristics:**

- Income-focused users looking for return on their capital
- Users comparing yield opportunities across different platforms
- Those primarily motivated by annualized returns rather than Bitcoin acquisition

**Natural Language:**

- "I want to maximize my yield on STX/sBTC holdings"
- "What's the APY compared to other platforms?"
- "I need to see clear ROI metrics"

**UX Solution:** Conservative Risk-Reward Tier with prominent APY calculations and comparison tools

### 4. "Market Volatility Harvester" Mental Model

**User Characteristics:**

- Sophisticated users who understand Bitcoin's volatility patterns
- Those looking to profit from price movement expectations
- Users who adjust strategies based on market conditions

**Natural Language:**

- "Bitcoin's volatility is high right now, great time to sell premium"
- "I adjust my strategy based on where we are in the market cycle"
- "I'm looking to capitalize on market inefficiencies"

**UX Solution:** Balanced Risk-Reward Tier with market volatility indicators and cycle positioning information

## Conclusion

The transformation of abstract options contract variables into simplified Bitcoin-native income generation concepts under the assisted counterparty model represents a fundamental reimagining of how financial yield tools should function in the Bitcoin ecosystem. By focusing on the core variables that providers need to interact with (Capital Commitment, Income Period, Income Strategy, Risk-Reward Tier) while automating more complex aspects, we create an intuitive, accessible experience that maintains the essence of options-based yield generation.

This approach reinforces The Bitcoin Insurance Company's core mission: democratizing sophisticated financial tools for everyday Bitcoin users by speaking their language and respecting their values, while maintaining sufficient approachability for those new to Bitcoin yield generation.

## Next Steps

1. Develop detailed wireframes for the Protection Provider Center based on this simplified variable analysis
2. Create interactive prototypes for user testing with protection providers
3. Conduct validation sessions with diverse Bitcoin holder segments
4. Iterate based on feedback, emphasizing Bitcoin-native clarity and simplicity
5. Develop implementation plan for integrating across the provider interface
