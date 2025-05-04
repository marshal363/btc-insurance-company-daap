The user is asking for guidance on how to design the parameters for options contracts (specifically PUTs, framed as "protection policies") in our MVP, considering the limited 4-week timeline, the "Assisted Counterparty Model" (Liquidity Pool), and the "Risk Tier System" described in the provided documents (@docs/backend-new/bithedge-policy-settlement.md and @docs/frontend-new/bithedge-ecosystem-sustainability-analysis.md).
The core questions are about:
Timeframes/Durations: Should we allow fully custom durations (e.g., 37 days from now) or enforce standardized expiration dates (e.g., end of March, end of June)?
Strike Prices: Should we allow fully custom strike prices (e.g., $92,345) or enforce standardized strike prices (e.g., increments of $500 like $90,000, $90,500)?
Overall Approach: What's the most practical and effective approach for the MVP given the constraints and the chosen architecture (Assisted Counterparty / Liquidity Pool with Risk Tiers)?
Let's break down the implications of each choice in the context of the MVP:
Context Recap:
MVP Timeline: 4 weeks (very tight).
Model: Assisted Counterparty Model (Liquidity Pool provides protection, not direct P2P matching yet). Pricing and fulfillment are algorithmic.
Risk Tiers: Capital providers (Income Irene) deposit into Conservative, Balanced, or Aggressive tiers. The pool uses this capital to back policies.
Matching: The system classifies a protection request (based on strike % and duration) into a tier and checks if that tier has capital.
Goal: Simplify for MVP while laying groundwork for future P2P.
Analysis of Standardization vs. Customization:

1. Timeframes/Durations:
   Standardized Expirations (e.g., Mar 30, Jun 30):
   Pros:
   Concentrates liquidity (more relevant for future P2P/secondary market, but less critical for pool model MVP).
   Simpler for algorithmic pricing if models are built around fixed dates.
   Potentially easier for users to understand (like traditional options).
   Might align better with certain provider strategies if they think in terms of calendar cycles.
   Cons:
   Less flexible for buyers ("Protective Peter") who might want protection for a specific duration (e.g., "for the next 45 days").
   The pool model doesn't strictly need liquidity concentration like P2P.
   Implementation might be slightly more complex to manage fixed dates vs. relative durations.
   Mapping custom user needs (e.g., "protect me for 6 weeks") to fixed dates adds friction.
   Custom Durations (e.g., X days from now):
   Pros:
   More user-friendly for buyers seeking protection for specific periods.
   Simpler to implement in the pool model – just calculate expiresAt = now + durationSeconds.
   Aligns well with the Risk Tier duration limits (e.g., <30d, <60d, <90d) which are relative, not fixed date based.
   Easier for the pool's algorithm to price based on duration (time to expiry) directly.
   Cons:
   Doesn't build the user habit for standardized expiries if we plan to move heavily to P2P later.
   Could theoretically lead to a vast number of unique expiry times, making pool risk management slightly more complex to analyze in aggregate (though manageable).
   Hybrid (Standardized Durations, e.g., 7d, 14d, 30d, 60d, 90d):
   Pros: Offers structure without fixed dates. Simplifies choices for users. Easier for the pool algorithm to price consistently. Aligns with the tier duration max limits.
   Cons: Still less flexible than fully custom.
   Recommendation for Timeframes (MVP):
   Given the 4-week timeline, the Assisted Counterparty model, and the Risk Tier system (which uses max duration limits like 30d, 60d, 90d), standardized relative durations (e.g., 7d, 14d, 30d, 60d, 90d) seem like the best approach.
   Why: It's a good compromise. It's simple for the user ("Protect me for 30 days"), easy for the pool algorithm to price (duration is a direct input), aligns perfectly with the existing risk tier max-duration-days logic, and is straightforward to implement (expiresAt = now + selected_duration_seconds). It avoids the complexity of managing fixed calendar dates while still providing structure.
2. Strike Prices:
   Standardized Strikes (e.g., $500 increments):
   Pros:
   Crucial for concentrating liquidity in P2P/secondary markets (less critical for pool MVP, but good habit).
   Simplifies the UI for selection.
   Easier for the pool's pricing algorithm if it pre-calculates for standard strikes.
   Makes risk tier classification (classify-protection-request) potentially cleaner if tiers align with strike bands.
   Cons:
   Less precise for buyers who might want protection at a very specific level.
   The pool could technically price any strike.
   Custom Strikes (e.g., $92,345):
   Pros:
   Maximum flexibility for the user.
   The pool's algorithm can handle custom strikes (just needs current price and strike as inputs).
   Cons:
   Can lead to "option chain explosion" if we move to P2P later.
   More complex UI (slider? text input? validation?).
   Risk tier classification based on % of current price handles custom strikes fine, but might feel less intuitive than fixed bands.
   Pricing algorithm needs to be robust enough for any input, increasing testing scope.
   Hybrid (Tier-Based Strike Ranges): The current @docs/backend-new/bithedge-policy-settlement.md already implies this with tiers defined by % of current price (e.g., Balanced = 80-90%). The user doesn't pick a raw strike, maybe they pick a tier or a protection level?
   Let's re-read the classification logic: classify-protection-request takes protected-value (strike) and current-price to calculate protected-value-percentage. This implies the user provides the strike price, and the system classifies it.
   However, the "Assisted Counterparty Model" description mentions "System-defined protection parameters available at launch" and "Simplified User Experience." This suggests maybe the system offers protection options rather than the user fully defining them.
   Recommendation for Strike Prices (MVP):
   Given the Assisted Counterparty model, the Risk Tiers based on percentages, and the tight timeline, offer protection based on pre-defined percentage levels relative to the current price, which implicitly map to the risk tiers.
   Why: This dramatically simplifies the user experience for "Protective Peter" during the MVP. Instead of entering a strike price like "$41,225", they might select:
   "Protect 90% of my Bitcoin value" (maps to Aggressive tier range)
   "Protect 85% of my Bitcoin value" (maps to Balanced tier range)
   "Protect 75% of my Bitcoin value" (maps to Conservative tier range)
   The system calculates the actual strike price based on the current oracle price and the selected percentage.
   This directly aligns with how the risk tiers are defined (min/max-protected-value-percentage).
   It simplifies the UI immensely (just a few choices).
   It simplifies the algorithmic pricing for the pool (fewer, predictable scenarios).
   It fits the "Assisted Counterparty" model where the pool offers specific protection products.
   It's fast to implement. We avoid building complex strike selection UI and validation.
   For "Income Irene" depositing into the pool, she just selects the tier (Conservative, Balanced, Aggressive) which aligns with the risk she's willing to back.
   Overall Approach Summary for MVP:
   Timeframes: Offer a fixed set of standardized relative durations (e.g., 7, 14, 30, 60, 90 days). The user selects one. This is simple, aligns with tiers, and is easy for the pool to price.
   Strike Prices: Offer protection based on a fixed set of protection percentages relative to the current price (e.g., Protect 90%, 85%, 75%). The system calculates the strike price. This aligns perfectly with the risk tier definitions, simplifies the UI, and fits the assisted counterparty model.
   Matching:
   User (Peter): Selects desired protection percentage and duration.
   System: Calculates the strike price. Determines the corresponding risk tier based on the percentage and duration (using logic similar to classify-protection-request). Checks if the designated tier has sufficient capital in the pool. Calculates the premium using the algorithmic pricing model (considering strike, duration, current price, volatility, and the tier's premium multiplier).
   Provider (Irene): Simply deposits capital into a chosen tier (Conservative, Balanced, Aggressive).
   This approach maximizes simplicity and speed for the MVP, directly leverages the existing Risk Tier structure, and provides a smooth user experience under the Assisted Counterparty model. It deliberately avoids the complexities of fully custom inputs and P2P matching, which can be added in later phases as outlined in the "Hybrid Model" transition plan.
   That's an excellent and critical question, especially given the tight 4-week MVP timeline and the choice of the Assisted Counterparty Model powered by the Risk Tier System. You've hit on a core design tension between user flexibility and system simplicity/feasibility.
   Let's analyze the options for Timeframes and Strike Prices based on the context provided in @docs/backend-new/bithedge-policy-settlement.md and @docs/frontend-new/bithedge-ecosystem-sustainability-analysis.md.
   Analysis & Recommendations for MVP:
   Timeframes/Durations:
   The Challenge: Fully custom durations (e.g., 37 days) offer maximum user flexibility but complicate pricing consistency and might not align well with how providers think about risk periods. Standardized calendar dates (Mar 30, Jun 30) concentrate liquidity (good for P2P, less critical for the pool model) but add implementation complexity (managing dates vs. durations) and reduce flexibility for users needing specific coverage periods.
   Alignment with MVP Model: The "Assisted Counterparty Model" with algorithmic pricing works best with predictable inputs. The Risk Tiers themselves are defined with max-duration-days (30, 60, 90), which are relative durations, not fixed dates.
   Recommendation (MVP): Standardized Relative Durations.
   Offer a fixed list of durations like 7 days, 14 days, 30 days, 60 days, 90 days.
   Why:
   Simplicity: Easy for the user (Protective Peter) to select ("Protect me for 30 days").
   Implementation Speed: Very easy to implement (expiresAt = now + selected_duration_seconds).
   Tier Alignment: Directly matches the max-duration-days logic in the risk tiers. The system can easily check if the selected duration is valid for the implied tier.
   Algorithmic Pricing: Provides clean, standardized inputs (duration) for the pool's pricing algorithm.
   Avoids Complexity: Sidesteps managing calendar dates and timezones for the MVP.
   Strike Prices:
   The Challenge: Fully custom strikes (e.g., $92,345) offer precision but create UI complexity, potential for overwhelming choices if P2P is added later, and require a robust algorithm capable of pricing anything. Standardized strikes ($90,000, $90,500) simplify UI and concentrate liquidity but are less flexible.
   Alignment with MVP Model: The "Assisted Counterparty Model" aims for a "Simplified User Experience" with potentially "System-defined protection parameters." The Risk Tiers are fundamentally defined by percentage ranges of the current price (e.g., Balanced = 80-90%). The classify-protection-request function uses this percentage.
   Recommendation (MVP): Standardized Protection Percentages.
   Offer protection based on a fixed set of percentages relative to the current Bitcoin price, implicitly mapping to the risk tiers. For example:
   Aggressive: Protect 95% / 90% of current value.
   Balanced: Protect 85% / 80% of current value.
   Conservative: Protect 75% / 70% of current value.
   Why:
   UI Simplicity: Protective Peter selects a protection level (e.g., "85%") instead of calculating and typing a specific strike price. This is much faster and intuitive for the target user.
   Direct Tier Mapping: Selection directly relates to the min/max-protected-value-percentage defined in the risk-tiers map. The system instantly knows the target tier.
   Implementation Speed: Avoids building complex strike input UI, validation, and potential "chain" displays. The system calculates the actual strike (current_price _ percentage / 100).
   Algorithmic Pricing: The pool prices based on the well-defined percentage level and selected duration.
   Fits Assisted Model: The pool offers specific, defined protection products rather than trying to match arbitrary user requests.
   Provider Alignment: Income Irene deposits into a tier (Conservative, Balanced, Aggressive), directly corresponding to the risk levels (protection percentages) the pool will offer.
   How it Works in the MVP Flow:
   Protective Peter (Buyer):
   Selects a Protection Percentage (e.g., "Protect 85%").
   Selects a Duration (e.g., "30 Days").
   Specifies the amount of BTC to protect.
   System (Algorithmic Pool):
   Reads the current Oracle price (e.g., $50,000).
   Calculates the Strike Price ($50,000 _ 85% = $42,500).
   Determines the Risk Tier based on the 85% level and 30-day duration (likely "Balanced").
   Checks available capital in the "Balanced" tier pool.
   Calculates the Premium using its algorithm (inputs: $42,500 strike, 30-day duration, $50,000 current price, current volatility data, "Balanced" tier premium multiplier).
   Presents the premium to Peter. If accepted, locks capital from the Balanced tier and issues the policy.
   Income Irene (Seller/Provider):
   Simply chooses a Risk Tier (e.g., "Balanced") when depositing capital into the pool. She accepts that her capital will back policies matching that tier's parameters (80-90% protection, <=60 days duration).
   Conclusion & Approach:
   For a 4-week MVP using the Assisted Counterparty and Risk Tier model, prioritize simplicity and direct alignment with the existing tier structure.
   Use Standardized Relative Durations (7d, 14d, 30d, 60d, 90d).
   Use Standardized Protection Percentages (e.g., 95%, 90%, 85%, 80%, 75%, 70%) that map clearly to the risk tiers.
   This approach delivers a functional, user-friendly MVP quickly by leveraging the defined tiers, simplifying the user interface, streamlining the algorithmic pricing, and ensuring providers understand the risk profile of the capital they are pooling. It defers the complexity of full customization and P2P matching to later phases, as planned in the hybrid rollout strategy.
