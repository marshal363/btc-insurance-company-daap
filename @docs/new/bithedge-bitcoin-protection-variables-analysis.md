# The Bitcoin Insurance Company: Bitcoin-Native Protection Variables Analysis

## Executive Summary

As Senior Bitcoin Product Designer for The Bitcoin Insurance Company, I've conducted a thorough analysis of how to translate complex options contract variables into Bitcoin-native protection concepts. Building on our success in reimagining expiration dates as a tiered, Bitcoin-aware protection duration system, this document examines other key options variables that need similar transformation to create a truly accessible Bitcoin protection experience.

For each variable, I analyze the challenges, propose Bitcoin-native alternatives, and provide implementation recommendations that emphasize clarity, familiarity, and alignment with Bitcoin principles. This approach extends our core design philosophy: transforming sophisticated financial instruments into intuitive protection tools for everyday Bitcoin holders without compromising on functionality.

## Smart Contract vs. User-Facing Variables: The Translation Layer

To fully understand our approach, it's essential to recognize the parallel systems at work: (1) the technical smart contract implementation of options contracts and (2) the user-facing Bitcoin protection policy interface. The following table maps each technical variable to its Bitcoin-native equivalent and details how our protection center flow handles this translation:

| Technical Variable (Smart Contract)    | Bitcoin Protection Variable (User Interface) | Implementation in Protection Center Flow                                                                                                            |
| -------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Strike Price**                       | **Protected Value**                          | Step 2: Coverage Details screen with visual slider showing protection level as a percentage of current Bitcoin price (e.g., "90% Value Protection") |
| **Option Type (PUT/CALL)**             | **Protection Goal**                          | Step 1: Protection Type Selection with clear goals ("Protect my Bitcoin holdings" vs. "Protect my future purchase")                                 |
| **Expiration Date**                    | **Protection Period**                        | Step 3: Policy Duration with tiered options (Standard, Extended, Strategic, Custom) aligned with Bitcoin market cycles                              |
| **Contract Size**                      | **Protected Portion**                        | Step 2: Coverage Details screen with amount selection showing both BTC/sats and USD values                                                          |
| **Premium**                            | **Protection Cost**                          | Step 4 & 5: Transparent cost presentation with sats-denominated values and cost-to-protection ratio                                                 |
| **Moneyness (ITM/ATM/OTM)**            | **Protection Strategy**                      | Step 4: Available Policies presented as protection strategies (HODL-Safe, Current Value Guard, Crash Insurance)                                     |
| **Exercise Process**                   | **Activation Process**                       | Post-purchase flow with simple "Activate Protection" process when price conditions are met                                                          |
| **Option Greeks (Delta, Gamma, etc.)** | Hidden from user interface                   | Backend calculations affecting premium cost without exposing complex terminology                                                                    |
| **Settlement Method**                  | **Protection Outcome**                       | Review & Activate screen showing exactly what happens when protection is activated                                                                  |
| **Mark-to-Market Value**               | **Current Protection Value**                 | Dashboard showing current value of protection based on market conditions                                                                            |
| **Open Interest & Volume**             | **Protection Availability**                  | Backend factor affecting available policies without exposing technical metrics                                                                      |

### Key Translation Principles:

1. **Selective Abstraction**: Some technical variables (e.g., Greeks) are completely abstracted away from the user interface
2. **Contextual Transformation**: Variables are presented in contexts that match user goals rather than financial mechanics
3. **Staged Disclosure**: Complex relationships are revealed progressively across the 5-step flow
4. **Bitcoin-Native Denominations**: All values expressed in both sats and USD throughout the interface
5. **Outcome-Focused Presentation**: Technical details translated into real-world protection outcomes

### Technical to User-Facing Variable Mapping:

For each key variable, our system performs a complex translation:

**Strike Price → Protected Value:**

- Technical implementation: Fixed price point in contract that determines option payoff
- User presentation: Visual percentage of current Bitcoin price with real-time feedback
- Backend translation: User-selected percentage automatically converted to absolute strike price for contract execution

**Option Type → Protection Goal:**

- Technical implementation: PUT/CALL flag determining contract behavior
- User presentation: Goal-based selection focusing on protection outcome
- Backend translation: "Protect holdings" becomes PUT option; "Protect future purchase" becomes CALL option

**Expiration Date → Protection Period:**

- Technical implementation: Block height or timestamp when contract expires
- User presentation: Duration-based selection with Bitcoin cycle awareness
- Backend translation: Selected timeframe converted to exact block height or timestamp for contract

**Contract Size → Protected Portion:**

- Technical implementation: Specific amount of the underlying asset in the contract
- User presentation: Amount of Bitcoin to protect with wallet integration
- Backend translation: User-selected BTC amount translated to exact contract parameters

By implementing this translation layer, we maintain the full technical functionality of options contracts while presenting an intuitive Bitcoin protection experience that aligns with how Bitcoiners think about protecting their holdings.

## The Balancing Act: Finding the Right Terminology

Our research into Bitcoin-native terminology has revealed an important consideration: we must balance authentic Bitcoin culture with accessibility for wider audiences. Based on extensive analysis, we've identified three potential terminology approaches:

1. **Bitcoin-Native Maximum**: Terminology deeply embedded in Bitcoin culture ("HODL Floor," "Stack Portion")
2. **Balanced Bitcoin-Adjacent**: Terms that hint at Bitcoin knowledge while remaining approachable ("Value Shield," "Protected Holdings")
3. **Insurance-Adjacent**: Familiar protection language with minimal Bitcoin jargon ("Protection Threshold," "Coverage Timeline")

Each approach has unique strengths and target audiences:

| Approach                  | Best For                                        | Key Strength                                                     | Potential Weakness                   |
| ------------------------- | ----------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------ |
| Bitcoin-Native Maximum    | Bitcoin enthusiasts, crypto-native users        | Authentic resonance, cultural belonging                          | May alienate or confuse newcomers    |
| Balanced Bitcoin-Adjacent | Mixed audience, crypto-curious                  | Bridges both worlds, accessible introduction to Bitcoin concepts | May not fully satisfy either extreme |
| Insurance-Adjacent        | Traditional investors, protection-focused users | Immediate comprehension, lower learning curve                    | Lacks Bitcoin distinctiveness        |

**User Testing Recommendation:**
We recommend A/B testing these terminology approaches with different user segments before final implementation, measuring both comprehension and emotional response.

## Options Variables Requiring Bitcoin-Native Transformation

### 1. Protected Value (Strike Price)

#### Current Challenge:

The concept of "strike price" in options trading is abstract and disconnected from users' mental models of protection. Even our current transformation to "Protected Value" could be enhanced to better align with Bitcoin thinking.

#### Bitcoin-Native Approach Alternatives:

We've identified multiple alternatives with varying degrees of Bitcoin-native terminology:

1. **HODL Floor** - The minimum value level below which your Bitcoin won't fall.

   - _Target Audience_: Bitcoin enthusiasts
   - _Key Advantage_: Leverages iconic "HODL" terminology
   - _When to Use_: Marketing to Bitcoin-native audiences

2. **Value Shield** - The price level at which your Bitcoin's value becomes protected.

   - _Target Audience_: Mixed crypto/traditional audiences
   - _Key Advantage_: Clear protective metaphor that works across knowledge levels
   - _When to Use_: General platform default terminology

3. **Sats Safeguard** - The value level that keeps your satoshis protected.

   - _Target Audience_: Bitcoin-savvy users who think in sats
   - _Key Advantage_: Emphasizes Bitcoin's native unit
   - _When to Use_: When specifically targeting sats stackers

4. **Bitcoin Baseline** - The established value level for your Bitcoin protection.

   - _Target Audience_: More financially sophisticated users
   - _Key Advantage_: Professional, reference-oriented language
   - _When to Use_: For educational materials or detailed protection explanations

5. **Protection Threshold** - The price point that activates your Bitcoin protection.
   - _Target Audience_: Traditional finance users, insurance-familiar customers
   - _Key Advantage_: Immediately clear function without Bitcoin knowledge
   - _When to Use_: For onboarding new users from traditional finance backgrounds

**Implementation Recommendations:**

- **Visual Representation**: A protection level slider will work effectively for all terminology options
- **Default Approach**: "Value Shield" offers the best balance of clarity and Bitcoin relevance
- **Personalization Possibility**: Allow users to select terminology in settings for personalized experience
- **A/B Testing Focus**: Test comprehension speed across different user segments

**User Interface Elements:**

- Protection level slider with clear visual feedback
- Percentage representation (e.g., "90% Value Protection")
- Dual-denomination display (sats and USD)
- Real-time value updates as Bitcoin price changes

### 2. Coverage Duration (Expiration Date)

#### Current Challenge:

Options "expiration dates" feel technical and don't align with how Bitcoiners think about market cycles and holding periods.

#### Bitcoin-Native Approach Alternatives:

1. **HODL Horizon** - The timeframe during which your Bitcoin value protection remains active.

   - _Target Audience_: Bitcoin enthusiasts
   - _Key Advantage_: Connects protection to holding strategy
   - _When to Use_: Marketing to Bitcoin-native audiences

2. **Cycle Shield** - Protection that aligns with Bitcoin's natural market cycles.

   - _Target Audience_: Bitcoin-savvy investors familiar with halving cycles
   - _Key Advantage_: Connects protection directly to Bitcoin's fundamental cycles
   - _When to Use_: For strategic, halving-aligned protection options

3. **Protection Window** - The specific timeframe when your Bitcoin is protected.

   - _Target Audience_: General audience with some protection product familiarity
   - _Key Advantage_: Clear timeframe metaphor without requiring specialized knowledge
   - _When to Use_: General platform default terminology

4. **Diamond Hands Period** - The time you can hold with confidence knowing your value is protected.

   - _Target Audience_: Crypto-native users familiar with meme culture
   - _Key Advantage_: Cultural resonance, emphasizes holding through volatility
   - _When to Use_: For marketing to younger crypto audiences

5. **Coverage Timeline** - The duration of your Bitcoin value protection.
   - _Target Audience_: Traditional finance/insurance customers
   - _Key Advantage_: Familiar insurance concept requiring no specialized knowledge
   - _When to Use_: For educational materials or onboarding traditional users

**Implementation Recommendations:**

- **Tiered Presentation**: All terminology options work with our tiered protection system (Standard/Extended/Strategic/Custom)
- **Default Approach**: "Protection Window" offers the best balance of clarity and Bitcoin relevance
- **Bitcoin-Cycle Integration**: Regardless of terminology, connect duration options to Bitcoin market cycles
- **A/B Testing Focus**: Measure which terms lead to most appropriate duration selections

### 3. Protected Portion (Contract Size)

#### Current Challenge:

Options "contract size" is abstract financial jargon disconnected from how Bitcoiners think about their holdings.

#### Bitcoin-Native Approach Alternatives:

1. **Stack Portion** - The specific portion of your Bitcoin stack you want to protect.

   - _Target Audience_: Bitcoin enthusiasts who "stack sats"
   - _Key Advantage_: Uses common Bitcoin vocabulary
   - _When to Use_: Marketing to Bitcoin-native audiences

2. **Secured Sats** - The amount of your Bitcoin holdings protected by this policy.

   - _Target Audience_: Bitcoin-savvy users who think in sats
   - _Key Advantage_: Alliteration makes it memorable, focuses on Bitcoin unit
   - _When to Use_: When highlighting the protection of smaller Bitcoin amounts

3. **Protected Holdings** - The amount of Bitcoin covered by your protection plan.

   - _Target Audience_: General audience
   - _Key Advantage_: Clear, straightforward, works for all experience levels
   - _When to Use_: General platform default terminology

4. **HODL Amount** - The quantity of Bitcoin you're protecting while you continue to hold.

   - _Target Audience_: Bitcoin enthusiasts
   - _Key Advantage_: Incorporates iconic Bitcoin terminology
   - _When to Use_: For marketing to Bitcoin-centric audiences

5. **Coverage Quantity** - The specific amount of Bitcoin protected by your policy.
   - _Target Audience_: Traditional finance/insurance customers
   - _Key Advantage_: Familiar insurance concept
   - _When to Use_: For educational materials or onboarding traditional users

**Implementation Recommendations:**

- **Wallet Integration**: All terminology options benefit from direct wallet balance display
- **Default Approach**: "Protected Holdings" offers the best balance of clarity and relevance
- **Percentage Selection**: Enable protecting specific percentages of total holdings
- **A/B Testing Focus**: Measure which terms lead to most appropriate amount selections

### 4. Protection Cost (Premium)

#### Current Challenge:

Options "premiums" are abstract financial costs that don't communicate value or investment.

#### Bitcoin-Native Approach Alternatives:

1. **HODL Fee** - The one-time cost to secure your Bitcoin's value while continuing to hold.

   - _Target Audience_: Bitcoin enthusiasts
   - _Key Advantage_: Bitcoin-native terminology, implies one-time payment
   - _When to Use_: Marketing to Bitcoin-native audiences

2. **Protection Sats** - The satoshis you spend to protect your Bitcoin value.

   - _Target Audience_: Bitcoin-savvy users who think in sats
   - _Key Advantage_: Denominated in Bitcoin's own unit
   - _When to Use_: When emphasizing the relatively small cost in sats terms

3. **Security Investment** - What you pay to secure your Bitcoin's value.

   - _Target Audience_: Investment-minded users
   - _Key Advantage_: Frames cost as positive investment rather than expense
   - _When to Use_: When emphasizing the value proposition of protection

4. **Stack Insurance** - The cost to insure your Bitcoin stack against price drops.

   - _Target Audience_: Bitcoin users familiar with traditional insurance
   - _Key Advantage_: Bridges Bitcoin and insurance concepts
   - _When to Use_: For users who understand both worlds

5. **Volatility Shield** - The cost of protection against Bitcoin price swings.
   - _Target Audience_: Users concerned about Bitcoin volatility
   - _Key Advantage_: Directly addresses primary user concern (volatility)
   - _When to Use_: When emphasizing the specific protection against volatility

**Implementation Recommendations:**

- **Sats Denomination**: Display all costs in sats with USD equivalents
- **Value Ratio Display**: Show protection-to-premium ratio regardless of terminology
- **Default Approach**: "Protection Sats" offers the best balance of Bitcoin relevance and clarity
- **A/B Testing Focus**: Measure perception of value across different terminologies

### 5. Protection Strategy (Moneyness)

#### Current Challenge:

Options concepts like "in-the-money" (ITM), "at-the-money" (ATM), and "out-of-the-money" (OTM) are highly abstract.

#### Bitcoin-Native Approach Alternatives:

1. **Bitcoin Shield Types** - Different levels of protection based on your risk tolerance.

   - _HODL-Safe_ (ITM): Maximum protection that begins immediately
   - _Current Value Guard_ (ATM): Protection at today's exact price
   - _Crash Insurance_ (OTM): Low-cost protection for major market drops
   - _Target Audience_: Bitcoin enthusiasts seeking different protection strategies
   - _When to Use_: As primary categorization system

2. **Protection Tiers** - Categorized levels of Bitcoin value protection.

   - _Premium Protection_ (ITM): Immediate value security
   - _Standard Protection_ (ATM): Current price protection
   - _Basic Protection_ (OTM): Major drop protection
   - _Target Audience_: General audience familiar with tiered product offerings
   - _When to Use_: For users familiar with good/better/best product tiers

3. **HODL Strategies** - Different approaches to protecting your Bitcoin holdings.

   - _Iron HODL_ (ITM): Maximum security for committed holders
   - _Smart HODL_ (ATM): Balanced protection at current value
   - _Savvy HODL_ (OTM): Cost-effective protection for major crashes
   - _Target Audience_: Bitcoin enthusiasts who identify as HODLers
   - _When to Use_: Marketing to Bitcoin-centric audiences

4. **Value Defense Plans** - Protection plans based on when they activate.

   - _Immediate Defense_ (ITM): Protection active right away
   - _Current Value Defense_ (ATM): Activates at today's price
   - _Drop Defense_ (OTM): Activates during significant price falls
   - _Target Audience_: Security-minded users
   - _When to Use_: When emphasizing the security/defense aspect

5. **Stack Protection Modes** - Different modes of protecting your Bitcoin stack.
   - _Preemptive Mode_ (ITM): Protection before any drop occurs
   - _Market-Match Mode_ (ATM): Protection matching current market price
   - _Deep-Drop Mode_ (OTM): Protection against severe market downturns
   - _Target Audience_: Technically-minded users
   - _When to Use_: For users who appreciate technical precision

**Implementation Recommendations:**

- **Visual Strategy Cards**: All terminology options work with our existing card-based selection
- **Default Approach**: "Protection Tiers" offers the best balance of clarity and Bitcoin relevance
- **Strategy Simulator**: Include a visual simulator regardless of terminology
- **A/B Testing Focus**: Measure proper strategy selection across different terminologies

### 6. Activation Process (Exercise)

#### Current Challenge:

Options "exercise" is technical financial jargon disconnected from protection thinking.

#### Bitcoin-Native Approach Alternatives:

1. **HODL Rescue** - The process of rescuing your Bitcoin's value during market downturns.

   - _Target Audience_: Bitcoin enthusiasts
   - _Key Advantage_: Emotionally resonant, communicates value preservation
   - _When to Use_: Marketing to Bitcoin-native audiences

2. **Value Capture** - Securing your protected Bitcoin value when prices drop.

   - _Target Audience_: Value-oriented investors
   - _Key Advantage_: Positive framing emphasizing capturing value
   - _When to Use_: For users focused on preserving capital value

3. **Protection Claim** - The process of claiming your protected Bitcoin value.

   - _Target Audience_: Users familiar with insurance claims
   - _Key Advantage_: Familiar insurance terminology
   - _When to Use_: For users with traditional insurance background

4. **Diamond Hands Activation** - Maintain your hold while activating your value protection.

   - _Target Audience_: Crypto-native users familiar with meme culture
   - _Key Advantage_: Emphasizes holding through volatility
   - _When to Use_: For marketing to younger crypto audiences

5. **Value Lock-In** - The process of locking in your protected Bitcoin value.
   - _Target Audience_: General audience
   - _Key Advantage_: Clear metaphor of securing value
   - _When to Use_: General platform default terminology

**Implementation Recommendations:**

- **Simple Activation Process**: All terminology options work with a streamlined activation flow
- **Default Approach**: "Value Lock-In" offers the best balance of clarity and Bitcoin relevance
- **Proactive Notifications**: Include price alerts regardless of terminology
- **A/B Testing Focus**: Measure activation completion rates across different terminologies

## Implementation Strategy

### Creating a Cohesive System

Based on our analysis, we recommend implementing three cohesive terminology systems for testing:

1. **Bitcoin-Native Maximum System**: For Bitcoin enthusiasts and crypto-native users

   - HODL Floor (Strike Price)
   - HODL Horizon (Expiration)
   - Stack Portion (Contract Size)
   - HODL Fee (Premium)
   - Bitcoin Shield Types (Moneyness)
   - HODL Rescue (Exercise Process)

2. **Balanced Bitcoin-Adjacent System**: For broader audience with some Bitcoin familiarity

   - Value Shield (Strike Price)
   - Protection Window (Expiration)
   - Protected Holdings (Contract Size)
   - Protection Sats (Premium)
   - Protection Tiers (Moneyness)
   - Value Capture (Exercise Process)

3. **Insurance-Adjacent System**: For traditional finance users seeking protection
   - Protection Threshold (Strike Price)
   - Coverage Timeline (Expiration)
   - Coverage Quantity (Contract Size)
   - Security Investment (Premium)
   - Defense Plans (Moneyness)
   - Protection Claim (Exercise Process)

We recommend testing these comprehensive systems rather than individual terms to ensure the language works together cohesively.

### User Testing Matrix

For comprehensive testing, we should evaluate each system across four user segments:

| User Segment              | Testing Focus                       | Success Metrics                                                            |
| ------------------------- | ----------------------------------- | -------------------------------------------------------------------------- |
| Bitcoin Maximalists       | System 1: Bitcoin-Native Maximum    | Authenticity ratings, emotional response, NPS                              |
| Crypto-Curious Investors  | System 2: Balanced Bitcoin-Adjacent | Comprehension speed, perceived value, likelihood to purchase               |
| Traditional Finance Users | System 3: Insurance-Adjacent        | Comfort level, trust indicators, perceived credibility                     |
| Bitcoin Newcomers         | All three systems                   | Comprehension accuracy, confidence in selections, perceived learning curve |

### Progressive Implementation Plan

Rather than immediately implementing a single system, we recommend a progressive approach:

1. **Phase 1: A/B Testing** (4 weeks)

   - Deploy all three systems to different user segments
   - Measure comprehension, completion rates, and satisfaction
   - Identify winning terminology for each user segment

2. **Phase 2: Personalized Defaults** (8 weeks)

   - Implement user segmentation based on onboarding
   - Present default terminology based on user background
   - Allow user customization of terminology preferences

3. **Phase 3: Converged System** (12 weeks)
   - Based on testing data, create a single optimized system
   - Incorporate the most successful elements from each approach
   - Maintain consistent terminology across all touchpoints

### Design System Updates

Our design system should incorporate these Bitcoin-native variables through:

1. **Bitcoin-First Language Guide**: Comprehensive terminology mapping
2. **Sats-Denominated Components**: UI components designed to display sats values by default
3. **Visualization Library**: Bitcoin-specific charts and simulators
4. **Protection-Focused Iconography**: Custom icon set representing Bitcoin protection concepts

### Educational Integration

Each reimagined variable should include embedded educational elements:

1. **Contextual Tooltips**: Brief explanations available on-demand
2. **Protection Basics Guide**: Comprehensive explanation of protection mechanics
3. **Visual Tutorials**: Interactive demonstrations of how protection works
4. **Bitcoin-Native Comparisons**: Familiar analogies from the Bitcoin ecosystem

## Bitcoin-Native Approach Benefits

This Bitcoin-first approach to protection variables delivers several key advantages:

1. **Cognitive Alignment**: Matches how Bitcoiners already think about their holdings
2. **Value Transparency**: Clearly demonstrates the protection value proposition
3. **Reduced Learning Curve**: Leverages familiar Bitcoin concepts and terminology
4. **Self-Custody Emphasis**: Reinforces Bitcoin's core principles throughout the experience
5. **Sats Standard**: Normalizes sats denomination for all protection calculations

## Next Steps

1. Implement A/B testing framework for terminology systems
2. Develop wireframes implementing these Bitcoin-native variable transformations
3. Create interactive prototypes for user testing
4. Conduct validation sessions with diverse Bitcoin holder segments
5. Iterate based on feedback, emphasizing Bitcoin-native clarity
6. Develop implementation plan for integrating across the protection center

## Conclusion

The transformation of abstract options contract variables into Bitcoin-native protection concepts represents a fundamental reimagining of how financial protection tools should function in the Bitcoin ecosystem. By exploring multiple terminology systems and testing with different user segments, we can find the perfect balance between Bitcoin authenticity and broader accessibility.

This approach reinforces The Bitcoin Insurance Company's core mission: democratizing sophisticated financial tools for everyday Bitcoin users by speaking their language and respecting their values, while maintaining sufficient approachability for those new to Bitcoin protection.
