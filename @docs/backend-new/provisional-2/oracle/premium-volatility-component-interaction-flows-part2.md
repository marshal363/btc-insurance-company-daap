# BitHedge Premium Sensitivity and UI Integration Flows

## 1. Real-Time Premium Sensitivity Flow

### 1.1 Flow Diagram

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐
│             │         │               │         │              │
│  Frontend   │         │ Convex Backend│         │ Premium      │
│  Components │         │ (Quote Svc)   │         │ Calculator   │
│             │         │               │         │              │
└──────┬──────┘         └───────┬───────┘         └──────┬───────┘
       │                        │                        │
       │                        │                        │
       │  1. User Adjusts       │                        │
       │     Policy Parameter   │                        │
       │ ◄────────────────────┐ │                        │
       │                        │                        │
       │  2. Request Premium    │                        │
       │     Sensitivity Analysis│                       │
       │ ─────────────────────► │                        │
       │                        │                        │
       │                        │  3. Generate Parameter │
       │                        │     Variations         │
       │                        │ ◄────────────────────┐ │
       │                        │                        │
       │                        │  4. Calculate Premium  │
       │                        │     for Each Variation │
       │                        │ ─────────────────────► │
       │                        │                        │
       │                        │  5. Return Multiple    │
       │                        │     Premium Calculations│
       │                        │ ◄─────────────────────┐│
       │                        │                        │
       │                        │  6. Generate           │
       │                        │     Sensitivity Data   │
       │                        │ ◄────────────────────┐ │
       │                        │                        │
       │  7. Return Sensitivity │                        │
       │     Data & Charts      │                        │
       │ ◄─────────────────────┐│                        │
       │                        │                        │
       │  8. Update Sensitivity │                        │
       │     Visualization      │                        │
       │ ◄────────────────────┐ │                        │
       │                        │                        │
```

### 1.2 Step-by-Step Description

1. **User Adjusts Policy Parameter (User → Frontend)**

   - User interacts with policy parameter controls in UI
   - Changes strike price, coverage amount, or duration
   - Implemented in slider components in BuyerParametersUI.tsx or ProviderParametersUI.tsx
   - UI component uses debounce to limit update frequency (implemented in `useDebounce.ts` hook)

2. **Request Premium Sensitivity Analysis (Frontend → Convex)**

   - Frontend calls Convex action to analyze parameter sensitivity
   - Sends current parameters and which one is being adjusted
   - Implementation in parameter change handlers in UI components
   - Example: `api.quotes.calculatePremiumSensitivity({ ...params, sensitivityTarget: 'strikePrice' })`

3. **Generate Parameter Variations (Convex)**

   - Backend generates variations around the current parameters
   - Creates array of test points (e.g., ±10%, ±20%, etc.)
   - Implementation in sensitivity analysis utility in quotes service
   - Generates range based on the parameter being adjusted

4. **Calculate Premium for Each Variation (Convex → Premium Calculator)**

   - Convex calls premium calculator for each parameter variation
   - May use optimized batch calculation for efficiency
   - Implementation in `calculatePremiumSensitivity` function in `convex/premium.ts`
   - Reuses core premium calculation logic with parameter variations

5. **Return Multiple Premium Calculations (Premium Calculator → Convex)**

   - Calculator returns array of premium results for different parameter values
   - Each result includes parameter value and corresponding premium
   - Implementation in batch premium calculation handler
   - Format: `[{ paramValue: number, premium: number }, ...]`

6. **Generate Sensitivity Data (Convex)**

   - Backend processes raw premium variation data
   - Calculates sensitivity metrics (e.g., elasticity)
   - Formats data for visualization
   - Implementation in sensitivity data processor in quotes service
   - Includes calculations like percentage change in premium per unit parameter change

7. **Return Sensitivity Data & Charts (Convex → Frontend)**

   - Backend returns formatted sensitivity data to frontend
   - Includes data points for charts and key metrics
   - Implementation in response handler for sensitivity analysis
   - Returns both raw data points and derived metrics

8. **Update Sensitivity Visualization (Frontend)**

   - Frontend updates visualizations with new sensitivity data
   - Renders price impact charts
   - Shows how premium changes with parameter adjustments
   - Implementation in visualization components like `ProtectionVisualization.tsx`
   - Uses charting libraries to display relationship between parameters and premium

## 2. Premium Calculation UI Integration Flow

### 2.1 Flow Diagram

```
┌─────────────┐         ┌───────────────┐         ┌──────────────┐         ┌─────────────────┐
│             │         │               │         │              │         │                 │
│  PolicySummary│       │ BuyerParameters│        │ Protection   │         │ Premium         │
│  Component  │         │ Component     │         │ Visualization │        │ Calculator      │
│             │         │               │         │              │         │                 │
└──────┬──────┘         └───────┬───────┘         └──────┬───────┘         └────────┬────────┘
       │                        │                        │                          │
       │                        │                        │                          │
       │  1. User Opens Policy  │                        │                          │
       │     Creation Interface │                        │                          │
       │ ◄────────────────────┐ │                        │                          │
       │                        │                        │                          │
       │  2. Initialize Default │                        │                          │
       │     Parameters         │                        │                          │
       │ ─────────────────────► │                        │                          │
       │                        │                        │                          │
       │  3. User Adjusts       │                        │                          │
       │     Parameters         │                        │                          │
       │ ◄────────────────────┐ │                        │                          │
       │                        │                        │                          │
       │  4. Parameter Change   │                        │                          │
       │     Event              │                        │                          │
       │ ◄─────────────────────┐│                        │                          │
       │                        │                        │                          │
       │  5. Update Parameter   │                        │                          │
       │     State              │                        │                          │
       │ ◄────────────────────┐ │                        │                          │
       │                        │                        │                          │
       │  6. Trigger Premium    │                        │                          │
       │     Update             │                        │                          │
       │ ─────────────────────────────────────────────────────────────────────────► │
       │                        │                        │                          │
       │  7. Return Updated     │                        │                          │
       │     Premium            │                        │                          │
       │ ◄─────────────────────────────────────────────────────────────────────────┐│
       │                        │                        │                          │
       │  8. Update Policy      │                        │                          │
       │     Summary Display    │                        │                          │
       │ ◄────────────────────┐ │                        │                          │
       │                        │                        │                          │
       │  9. Trigger            │                        │                          │
       │     Visualization      │                        │                          │
       │     Update             │                        │                          │
       │ ─────────────────────────────────────────────► │                          │
       │                        │                        │                          │
       │                        │  10. Request           │                          │
       │                        │      Sensitivity Data  │                          │
       │                        │ ─────────────────────────────────────────────────►│
       │                        │                        │                          │
       │                        │  11. Return            │                          │
       │                        │      Visualization Data│                          │
       │                        │ ◄─────────────────────────────────────────────────│
       │                        │                        │                          │
       │                        │  12. Update            │                          │
       │                        │      Charts & Visuals  │                          │
       │                        │ ◄────────────────────┐ │                          │
       │                        │                        │                          │
```

### 2.2 Step-by-Step Description

1. **User Opens Policy Creation Interface (User → PolicySummary)**

   - User navigates to policy creation page
   - PolicySummary component initializes
   - Implementation in `front-end/src/components/BitHedge/PolicySummary.tsx`
   - Serves as the container for the policy creation workflow

2. **Initialize Default Parameters (PolicySummary → BuyerParameters)**

   - PolicySummary initializes BuyerParameters with default values
   - Sets up initial state for all policy parameters
   - Implementation via props passed to BuyerParametersUI component
   - Establishes starting point for user customization

3. **User Adjusts Parameters (User → BuyerParameters)**

   - User interacts with UI controls to adjust policy parameters
   - Manipulates sliders, inputs, or selects for different options
   - Implementation in event handlers in BuyerParametersUI.tsx
   - Each control updates its specific parameter value

4. **Parameter Change Event (BuyerParameters → PolicySummary)**

   - BuyerParameters component emits change event for updated parameter
   - Event includes new parameter value and parameter type
   - Implementation via callback props or context updates
   - Example: `onParameterChange({ type: 'strikePrice', value: newValue })`

5. **Update Parameter State (PolicySummary)**

   - PolicySummary component updates its internal state with new parameter
   - Maintains comprehensive state of all policy parameters
   - Implementation in state management code in PolicySummary.tsx
   - Uses React's useState or useReducer for state management

6. **Trigger Premium Update (PolicySummary → Premium Calculator)**

   - PolicySummary triggers premium recalculation with updated parameters
   - Calls premiumCalculation function with complete parameter set
   - Implementation using Convex action call to calculate premium
   - May use debouncing to limit calculation frequency

7. **Return Updated Premium (Premium Calculator → PolicySummary)**

   - Calculator returns new premium amount based on updated parameters
   - Includes breakdown of premium components
   - Implementation in premium calculation result handler
   - Updates premium state in PolicySummary component

8. **Update Policy Summary Display (PolicySummary)**

   - PolicySummary updates UI with new premium information
   - Shows total premium and payment details
   - Implementation in premium display section of PolicySummary.tsx
   - Formats currency values and updates relevant UI elements

9. **Trigger Visualization Update (PolicySummary → Protection Visualization)**

   - PolicySummary notifies visualization component of parameter changes
   - Passes updated parameters and premium information
   - Implementation via props or context update to visualization component
   - Ensures visualizations stay in sync with current parameters

10. **Request Sensitivity Data (Protection Visualization → Premium Calculator)**

    - Visualization component requests sensitivity data for charts
    - Specifies which parameter dimensions to analyze
    - Implementation in initialization and update logic of visualization component
    - Makes dedicated calls for sensitivity data needed for visualizations

11. **Return Visualization Data (Premium Calculator → Protection Visualization)**

    - Calculator returns formatted data for visualizations
    - Includes data points for charts and key metrics
    - Implementation in sensitivity data formatting functions
    - Data structured specifically for chart library requirements

12. **Update Charts & Visuals (Protection Visualization)**
    - Visualization component updates all charts and visual elements
    - Renders updated relationship between parameters and premium
    - Shows policy protection visualization with new values
    - Implementation in chart rendering code in ProtectionVisualization.tsx
    - Uses chart libraries and custom rendering logic

## 3. Conclusion

The premium calculation and volatility assessment systems in BitHedge provide the critical pricing foundation for the platform. These component interaction flows illustrate:

1. **Real-Time Pricing**: How user parameter adjustments trigger immediate premium updates with appropriate debouncing and optimization.

2. **Visual Feedback**: How parameter changes are visualized to help users understand the relationship between policy parameters and premium costs.

3. **Volatility Impact**: How market volatility is calculated from historical data and incorporated into premium pricing to reflect current market conditions.

4. **Multiple Timeframes**: How volatility is assessed across different time horizons to provide a comprehensive risk assessment.

5. **User Experience**: How the various frontend components work together to provide a seamless, interactive policy creation experience.

These flows work in conjunction with the Oracle system (described in the Oracle Component Interaction Flows document) to provide accurate, transparent, and responsive pricing for BitHedge insurance policies.
