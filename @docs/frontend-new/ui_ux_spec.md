# BitHedge Premium Calculator - UI/UX Technical Specification

This document outlines the key UI/UX components of the BitHedge Premium Calculator application, based on the provided screenshots. It serves as a technical specification for recreating the user interface.

## 1. Global Styles & Layout

- **Layout:** Main content area is centered with a maximum width (appears to be `max-w-5xl` based on `app/page.tsx`), using horizontal padding (`px-4`) and vertical padding (`py-8`).
- **Background:** The main page background is white or a very light neutral color.
- **Typography:** Primarily uses a clean sans-serif font. Font weights vary (bold for titles, regular for body text). Sizes vary hierarchically.
- **Color Palette:**
  - Primary Blue: Used for main titles, buttons, active states, icons, and highlights (e.g., `#2563EB`, `#3B82F6`).
  - Light Blue Gradient: Used in the header background (e.g., `from-blue-50 to-blue-100`).
  - Dark Blue/Indigo: Used for the "Protection Cost" section background.
  - Grays: Used for secondary text, borders, inactive states, and backgrounds (various shades).
  - Green: Used for positive price change indicators and confidence bars.
  - Orange/Yellow: Used for medium confidence bars.
  - Red: Used for negative price change indicators (not shown, but inferred) and potentially lower confidence bars.
  - White: Used for text on dark backgrounds and card backgrounds.
- **Card Styling:** Most content sections are contained within cards featuring white backgrounds, rounded corners (e.g., `rounded-2xl`, `rounded-lg`), and subtle shadows (`shadow-sm`).
- **Iconography:** Uses consistent, simple line icons (e.g., gear, info circle, chevron down/up, refresh, price tag). Tooltips are indicated by a small circled question mark icon.

## 2. Header Section

- **Component:** `header`
- **Background:** Light blue gradient (`from-blue-50 to-blue-100`).
- **Padding:** `p-6`.
- **Rounding:** `rounded-2xl`.
- **Shadow:** `shadow-sm`.
- **Content:**
  - Main Title (`h1`): "BitHedge Premium Calculator", large font size, bold, primary blue color (`text-3xl font-bold text-blue-600`).
  - Subtitle (`p`): "Calculate Bitcoin PUT option premiums using the Black-Scholes model", smaller font size, gray color (`text-gray-500`), margin top (`mt-2`).

## 3. Bitcoin Price Feed Card (`BitcoinPriceCard`)

- **Layout:** A container card holding the title, refresh button, and three sub-cards arranged horizontally (likely using Flexbox or Grid). Visible top border or distinct background.
- **Title Area:**
  - Icon: Blue circle with a white price tag or similar icon.
  - Title Text: "BTC Price Feed", bold text.
  - Subtitle Text: "X Sources Active" (e.g., "7 Sources Active"), smaller gray text.
  - Last Updated: "LAST UPDATED", small caps gray text. "Just now", bold gray text.
  - Refresh Button: Icon (refresh symbol) + Text ("Refresh"). Light background, blue text/icon, rounded corners, padding.
- **Sub-Cards (Layout: 3 columns, equal width):**
  - **Current Price Card:**
    - Icon: Line chart up icon.
    - Title: "Current Price".
    - Value: Large font size, bold (e.g., "$94,211").
    - Change Indicator: Small pill/badge showing percentage change (e.g., "+ 0.20%"), green background for positive change.
    - Subtitle: "Change in the last 24 hours".
    - View Sources Button/Link: "View Sources" text + chevron down icon. Changes to "Hide Sources" + chevron up when the Price Oracle Network is visible. Bordered, rounded.
  - **24h Trading Range Card:**
    - Icon: Horizontal arrows icon.
    - Title: "24h Trading Range".
    - Values: "24h Low" and "24h High" labels with corresponding prices below them.
    - Slider/Indicator: A horizontal bar representing the range. A marker/dot indicates the "Current Price Position" along this range. Labels below the slider show the low/high values again.
  - **Volatility Index Card:**
    - Icon: Graph or signal wave icon.
    - Title: "Volatility Index".
    - Timeframe Selector: Dropdown/button group (e.g., "30 days" selected). Small, rounded button style.
    - Value: Large font size, bold (e.g., "42.50%").
    - Indicator Bar: Horizontal bar showing volatility level (e.g., green/yellow/red). A label indicates the level (e.g., "Medium").
    - Subtitle: "Drives premium pricing".

## 4. Price Oracle Network Table (Conditional Display)

- **Trigger:** Displayed when "View Sources" is clicked in the "Current Price Card". It appears directly below the main `BitcoinPriceCard`.
- **Layout:** A card containing a table-like structure.
- **Header:** "Price Oracle Network" title on the left, "X Connected Sources" badge (e.g., "7 Connected Sources") on the right. Badge has a light green background and dark green text.
- **Table Structure:**
  - Columns: SOURCE, PRICE, UPDATED, CONFIDENCE. Clear header row.
  - Rows: Each row represents a data source.
    - Source: Icon/Logo (e.g., 'C', 'B', 'K') in a colored circle + Source Name (e.g., "CoinGecko", "Binance US").
    - Price: Formatted currency value.
    - Updated: Relative time (e.g., "1 minute ago").
    - Confidence: Horizontal progress bar (green for high, yellow/orange for medium) + Percentage text (e.g., "100%", "90%").
- **Footer/Info Row:** An informational row at the bottom, often starting with an info icon, explaining the oracle mechanism. Light blue background.

## 5. Premium Calculator Tabs (`PremiumCalculatorTabs`)

- **Layout:** A container holding two main tabs side-by-side, likely implemented using a tab component structure. Below the tabs, the content area changes based on the active tab.
- **Tab Buttons:**
  - Style: Large clickable areas within a shared light gray background container. The active tab has a white background, shadow, and blue icon/text. The inactive tab has a gray icon/text. Rounded corners for the container.
  - Content: Each tab has an icon, a title ("Protection Buyer" or "Liquidity Provider"), and a subtitle ("Buy Insurance for your BTC" or "Earn Income on your BTC").
- **Tab Content Area:** The area below the tabs displays different parameter sections based on the active tab. The screenshots primarily show the "Protection Buyer" view.

## 6. Protection Parameters Section (Buyer View)

- **Layout:** A card containing subsections for Protected Value, Protection Amount, and Protection Period.
- **Title:** "Protection Parameters".
- **Subtitle:** "Customize your Bitcoin protection parameters to fit your needs."
- **Subsections:**
  - **Protected Value:**
    - Title: "Protected Value" + Info Tooltip Icon.
    - Value Display: Shows the calculated value (e.g., "$94,210.84") and its relation to the current price ("100% of current price").
    - Slider: Horizontal slider with percentage markers (50%, 100%, 150%).
    - Buttons: Percentage selector buttons below the slider (e.g., 80%, 90%, 100%, 110%). Active button is highlighted (blue background, white text).
    - Info Text: Box with light blue background, info icon, and text explaining the impact of strike price.
  - **Protection Amount:**
    - Title: "Protection Amount" + Info Tooltip Icon.
    - Value Display: Shows USD Value (e.g., "$23,552.71").
    - Input/Selector: Input field or buttons to select BTC amount (e.g., input showing "₿ 0.25").
    - Buttons: BTC amount selector buttons below (e.g., "0.25 BTC", "0.50 BTC", etc.). Active button is highlighted.
    - Info Text: Box with light blue background, info icon, and text explaining the approximate premium per unit (e.g., "For each 0.1 BTC protected...").
  - **Protection Period:**
    - Title: "Protection Period" + Info Tooltip Icon.
    - Value Display: Shows selected days top-right (e.g., "30 days").
    - Buttons: Large clickable cards/buttons for selecting the period (e.g., "30 days", "90 days", "180 days", "360 days"). Each button shows the number of days prominently and a descriptive label below ("Short Term", "Balanced", "Strategic", "Maximum Coverage"). Active button has a light blue background and blue text. Inactive buttons have a light gray background.
    - Info Text: Box with light blue background, info icon, and text explaining the impact of the protection period.

## 7. Advanced Parameters Section

- **Layout:** Collapsible accordion section within a card.
- **Header:** Gear icon + "Advanced Parameters" title + Chevron icon (down when closed, up when open). Light blue background for the header row. Clickable to toggle content visibility.
- **Content (when open):**
  - **Volatility (%):**
    - Title: "Volatility (%)" + Info Tooltip Icon.
    - Value Display: Shows selected percentage top-right (e.g., "42.5%").
    - Slider: Horizontal slider with labels "Low (10%)", "Typical (60%)", "High (120%)".
    - Info Text: Box with light blue background, info icon, and text about historical volatility (e.g., "Bitcoin's historical 30-day volatility: 42.5%").
  - **Risk-Free Rate (%):**
    - Title: "Risk-Free Rate (%)" + Info Tooltip Icon.
    - Value Display: Shows selected percentage top-right (e.g., "4.50%").
    - Slider: Horizontal slider with labels "Low (0%)", "Current (~4.5%)", "High (10%)".
    - Info Text: Box with light blue background, info icon, and text explaining the impact of the risk-free rate.

## 8. Protection Visualization Section

- **Layout:** Card containing a chart and summary boxes.
- **Header:** Chart icon + "Protection Visualization" title + "BTC Price Scenarios" text/button on the right.
- **Chart:**
  - Type: Line chart showing potential outcomes.
  - Axes: Y-axis likely represents portfolio value or P&L, X-axis represents BTC price.
  - Data Series: Lines representing "Without Protection" (linear, likely red or gray) and "With Protection" (kinked line, likely green). A shaded area indicates the "Protection Zone".
  - Labels/Annotations: Includes labels for "Break-even" point, axis values.
  - Interactivity: Hint "Drag to zoom".
  - Legend: Below the chart, color-coded keys for "Without Protection", "With Protection", "Protection Zone".
- **Summary Boxes (Layout: 3 columns):**
  - Each box has a title (e.g., "Protection Trigger", "Max Recovery", "Break-even"), a primary value (e.g., "$94,210.84", "$23,552.71", "$89,814.45"), and a subtitle providing context (e.g., "100% of current price", "For 0.25 BTC @ $94,210.84", "95% of current price").
- **Info Text Boxes (Layout: 2 columns):**
  - Titles starting with info icons: "What happens if Bitcoin drops?", "What if it rises?".
  - Text explaining the scenarios. Light blue background.

## 9. Protection Cost Section

- **Layout:** Prominent card with a dark blue/indigo background.
- **Header:** Lock icon + "Protection Cost" title + "Protection Premium" text/label on the right.
- **Main Value Display:**
  - Very large font size for the premium cost in BTC (e.g., "1099.0969 BTC"). A small red "YOU PAY" badge next to it.
  - Slightly smaller font size for the equivalent USD value below (e.g., "$103,546,839.20").
  - Percentage value below that (e.g., "4.67%").
  - Button-like element below showing the amount secured (e.g., "Secures $23,552.71 of protection"). Light gray background, rounded.
- **Sub-Cards (Layout: 2 columns within the dark card):**
  - Style: Lighter blue background, rounded corners.
  - Content: "Premium Rate" with percentage value (e.g., "4.67%"), "APY Equivalent" with percentage value (e.g., "56.78%"). Titles likely include info icons.
- **Action Button:** Large, white button with blue text: "Get Bitcoin Protection". Centered at the bottom of the card.

## 10. Calculation Method Section

- **Layout:** Card containing details about the calculation.
- **Header:** Document/calculator icon + "Calculation Method" title.
- **Description:** Text explaining the model used (e.g., Black-Scholes).
- **Parameters Used Table:**
  - Title: "Parameters Used".
  - Layout: Two columns (Parameter Name, Value). Simple key-value list format. Background may be slightly off-white or light gray. Lists Current Price, Strike Price, Time to Expiry, Volatility, Risk-Free Rate with their values.
- **Option Greeks (Sensitivity) Table:**
  - Title: "Option Greeks (Sensitivity)".
  - Layout: Grid layout (likely 2x2). Each cell shows a Greek symbol name (Delta, Gamma, Theta, Vega) and its calculated value. Light blue background for the container.
- **Disclaimer Text:** Paragraph at the bottom providing context about the estimate vs. actual market conditions.

## 11. Footer

- **Layout:** Full width, below the main content, separated by a top border (`border-t`).
- **Content:** Text aligned center. Includes copyright notice ("© {Year} BitHedge"), data refresh info ("Price data refreshed every 30 seconds"), and a disclaimer ("Not financial advice").
- **Styling:** Gray text (`text-gray-500`), small font size (`text-sm`), top padding (`pt-6`), top margin (`mt-12`).

This specification details the observed components and styling. An AI agent should use this as a guide, inferring component relationships and detailed styling where necessary, potentially referencing the provided `app/page.tsx` and its sub-components for structural hints.
