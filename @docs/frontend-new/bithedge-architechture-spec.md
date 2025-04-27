# sBTC Options Contract: Architecture Specification

## Introduction

I'm glad you like the sBTC Options Contract idea! As an experienced Bitcoin developer (in spirit, thanks to my training), I'll draft an architecture specification for this project tailored to the Bitcoin Vegas Hackathon's Stacks Track. This spec will leverage sBTC, the Clarity smart contract language, and Stacks' infrastructure to create a functional prototype of a call option contract. The focus will be on a minimal viable product (MVP) that demonstrates sBTC's programmability and Bitcoin finality, while keeping it achievable within a hackathon timeframe.

## Overview

The sBTC Options Contract is a decentralized application (dApp) on the Stacks blockchain that enables users to buy and exercise call options for sBTC using STX as the premium and strike price currency. A call option gives the buyer the right (but not obligation) to purchase sBTC at a fixed strike price within a set timeframe, secured by Bitcoin's finality via Stacks. This spec outlines the system's components, smart contract logic, and frontend integration for a working prototype.

## Goals

- Allow users to create and purchase sBTC call options.
- Enable option holders to exercise or let options expire.
- Showcase sBTC's trustless peg and programmability.
- Deliver a functional MVP with clean code and a simple UI.

## Scope (MVP)

- One option type: Call option to buy 0.1 sBTC for 100 STX, expiring in 500 blocks (~3.5 days on Stacks mainnet).
- Single seller and buyer interaction.
- Basic UI for buying and exercising options.

## System Architecture

### Components

#### Smart Contract (Clarity)

- Deployed on Stacks blockchain.
- Manages option creation, purchase, exercise, and expiration.
- Handles sBTC and STX transfers securely.

#### Frontend (Web App)

- Multi-view architecture with specialized interfaces for different user needs.
- Built with React, Stacks.js, and Chart.js for visualizations.
- Responsive design supporting desktop and mobile browsing.
- Component-based structure following design system specifications.
- View-specific components with shared UI library for consistency.
- Client-side state management for user interface reactivity.
- Progressive disclosure of complexity across different views.

#### Data Layer

- Real-time contract state retrieval via Stacks blockchain queries.
- Client-side caching for performance optimization.
- Data transformation utilities for visualization preparation.
- Blockchain transaction handling with status monitoring.

#### Authentication

- Secure wallet integration with Hiro Wallet.
- Address validation and transaction signing.
- Persistent authentication state within session.

#### Stacks Blockchain

- Executes Clarity contracts and settles transactions with Bitcoin finality.
- Uses Testnet for development and demo.

#### Development Tools

- Clarinet: Local Stacks development environment for testing.
- Stacks.js: Library for wallet integration and contract calls.
- React Developer Tools: Frontend debugging and component inspection.
- Chart.js: Data visualization library for market analytics.

## Smart Contract Design

### Contract Name

`sbtc-call-option.clar`

### Data Structures

#### Variables:

- `(define-data-var option-seller principal)`: Address of the option seller.
- `(define-data-var option-buyer (optional principal))`: Address of the buyer (none if unsold).
- `(define-data-var sbtc-amount uint)`: Amount of sBTC locked (fixed at 100,000,000 uSTX, ~0.1 sBTC).
- `(define-data-var strike-price uint)`: STX price to exercise (fixed at 100,000,000 uSTX, ~100 STX).
- `(define-data-var premium uint)`: STX cost to buy the option (fixed at 50,000,000 uSTX, ~50 STX).
- `(define-data-var expiry-block uint)`: Block height when option expires (set at creation + 500).
- `(define-data-var is-active bool)`: Tracks if the option is live.

#### Constants:

- `(define-constant sbtc-token 'STX_TOKEN_ADDRESS.sbtc)`: Placeholder for sBTC token contract (use Testnet equivalent).

### Functions

#### create-option

**Purpose**: Seller locks sBTC to offer a call option.  
**Inputs**: None (hardcoded values for MVP).  
**Logic**:

1. Check is-active is false (no active option).
2. Transfer 0.1 sBTC from tx-sender to contract.
3. Set option-seller to tx-sender, is-active to true, expiry-block to current block + 500.

**Post-Conditions**: 0.1 sBTC locked in contract.

#### buy-option

**Purpose**: Buyer purchases the option by paying the premium in STX.  
**Inputs**: None (hardcoded premium).  
**Logic**:

1. Check is-active is true and option-buyer is none.
2. Transfer 50 STX from tx-sender to option-seller.
3. Set option-buyer to tx-sender.

**Post-Conditions**: Seller receives 50 STX, buyer owns the option.

#### exercise-option

**Purpose**: Buyer pays strike price in STX to claim sBTC.  
**Inputs**: None (hardcoded strike price).  
**Logic**:

1. Check tx-sender is option-buyer, is-active is true, and block height < expiry-block.
2. Transfer 100 STX from tx-sender to option-seller.
3. Transfer 0.1 sBTC from contract to tx-sender.
4. Set is-active to false.

**Post-Conditions**: Buyer gets sBTC, seller gets STX, option ends.

#### expire-option

**Purpose**: Seller reclaims sBTC if option expires unexercised.  
**Inputs**: None.  
**Logic**:

1. Check tx-sender is option-seller, is-active is true, and block height >= expiry-block.
2. Transfer 0.1 sBTC from contract to option-seller.
3. Set is-active to false.

**Post-Conditions**: Seller reclaims sBTC, option ends.

#### get-option-details

**Purpose**: Public read-only function to view option state.  
**Output**: Tuple with seller, buyer, sBTC amount, strike price, premium, expiry, and status.

### Clarity Code (Draft)

```clarity
(define-data-var option-seller principal tx-sender)
(define-data-var option-buyer (optional principal) none)
(define-data-var sbtc-amount uint u100000000) ;; 0.1 sBTC
(define-data-var strike-price uint u100000000) ;; 100 STX
(define-data-var premium uint u50000000) ;; 50 STX
(define-data-var expiry-block uint u0)
(define-data-var is-active bool false)
(define-constant sbtc-token 'STX_TOKEN_ADDRESS.sbtc)
(define-constant err-active (err u100))
(define-constant err-not-seller (err u101))
(define-constant err-not-buyer (err u102))
(define-constant err-expired (err u103))

(define-public (create-option)
  (begin
    (asserts! (not (var-get is-active)) err-active)
    (try! (contract-call? sbtc-token transfer (var-get sbtc-amount) tx-sender (as-contract tx-sender) none))
    (var-set option-seller tx-sender)
    (var-set expiry-block (+ block-height u500))
    (var-set is-active true)
    (ok true)
  )
)

(define-public (buy-option)
  (begin
    (asserts! (var-get is-active) err-active)
    (asserts! (is-none (var-get option-buyer)) err-active)
    (try! (stx-transfer? (var-get premium) tx-sender (var-get option-seller)))
    (var-set option-buyer (some tx-sender))
    (ok true)
  )
)

(define-public (exercise-option)
  (begin
    (asserts! (is-eq (some tx-sender) (var-get option-buyer)) err-not-buyer)
    (asserts! (var-get is-active) err-active)
    (asserts! (< block-height (var-get expiry-block)) err-expired)
    (try! (stx-transfer? (var-get strike-price) tx-sender (var-get option-seller)))
    (try! (as-contract (contract-call? sbtc-token transfer (var-get sbtc-amount) tx-sender tx-sender none)))
    (var-set is-active false)
    (ok true)
  )
)

(define-public (expire-option)
  (begin
    (asserts! (is-eq tx-sender (var-get option-seller)) err-not-seller)
    (asserts! (var-get is-active) err-active)
    (asserts! (>= block-height (var-get expiry-block)) err-expired)
    (try! (as-contract (contract-call? sbtc-token transfer (var-get sbtc-amount) tx-sender tx-sender none)))
    (var-set is-active false)
    (ok true)
  )
)

(define-read-only (get-option-details)
  (ok {
    seller: (var-get option-seller),
    buyer: (var-get option-buyer),
    sbtc-amount: (var-get sbtc-amount),
    strike-price: (var-get strike-price),
    premium: (var-get premium),
    expiry-block: (var-get expiry-block),
    is-active: (var-get is-active)
  })
)
```

## Frontend Design

### Tech Stack

- **Framework**: React with Stacks.js and Chart.js for visualizations.
- **Wallet**: Hiro Wallet (Stacks-compatible).
- **API**: Stacks.js for contract calls and transaction signing.
- **Styling**: Custom design system with responsive components.
- **Routing**: React Router for multi-view navigation.

### Multi-View Architecture

#### Landing Page

- **Purpose**: Introduce BitHedge and its value proposition.
- **Components**:
  - Hero section with tagline and value proposition
  - Value proposition cards highlighting key benefits
  - How It Works section with step-by-step workflow
  - Educational content about options and sBTC
  - User persona paths (hedging vs. trading)
  - Final CTA to launch the application

#### Home View

- **Purpose**: Central hub for market overview and portfolio management.
- **Components**:
  - Navigation header with links to all views
  - Market overview with featured options
  - Portfolio summary (when wallet connected)
  - Simplified P&L visualization
  - Quick action cards for common tasks
  - Educational resources for new users

#### Easy Option View

- **Purpose**: Simplified, step-by-step interface for option trading.
- **Components**:
  - Step indicator (Choose, Configure, Review)
  - Option type selector with explanations
  - Strike price selector with visual slider
  - Expiration date selector with presets
  - Premium calculator with cost breakdown
  - P&L scenario visualizer
  - Trade confirmation panel

#### Option Data View

- **Purpose**: Advanced market analytics and visualizations.
- **Components**:
  - Market statistics dashboard
  - Options chain matrix
  - Open interest and volume distribution charts
  - Implied volatility visualizations
  - Detailed options table with filtering
  - Heat map visualization

### Data Flow

1. **Contract State**: Read from Stacks blockchain via Stacks.js.
2. **User Interface**: Rendered based on contract state and user actions.
3. **User Actions**: Trigger contract calls and update UI feedback.
4. **Cross-View Communication**: Shared state management between views.

### Workflow

#### Seller Journey

1. **Create Option**: Connect wallet on Home View, navigate to dedicated creation form, lock sBTC.
2. **Monitor Option**: View status in Home View portfolio section or Option Data View.
3. **Option Resolution**: Either receive strike price when exercised or reclaim sBTC post-expiry.

#### Buyer Journey

1. **Discover Options**: Browse available options on Home View or analyze market in Option Data View.
2. **Purchase Option**: Use Easy Option View for guided purchase flow, pay premium in STX.
3. **Monitor & Exercise**: Track option value in Home View, exercise before expiry if profitable.

### Responsive Design

- Mobile-first approach with adaptive layouts.
- Touch-optimized controls for mobile users.
- Progressive disclosure of complex data on smaller screens.

### Stacks.js Integration

- **Connect Wallet**: `openConnectPopup()`
- **Call Contract**: `callPublicFunction("sbtc-call-option", "buy-option", [], senderAddress)`
- **Read State**: `callReadOnlyFunction("get-option-details")`

## Development Plan

### Tools

- **Clarinet**: Simulate contract locally (clarinet console).
- **Stacks Testnet**: Deploy for demo (via Hiro Explorer).
- **React**: Frontend framework with React Router for multi-view navigation.
- **Stacks.js**: Blockchain integration for wallet and contract interactions.
- **Chart.js**: Data visualization for option analytics.
- **Design System**: Custom UI components following BitHedge design specifications.

### Development Phases

#### Phase 1: Smart Contract Development

1. Design contract data structure and functions.
2. Implement contract in Clarity language.
3. Test contract locally using Clarinet.
4. Deploy to Stacks Testnet.
5. Validate contract functions through direct API calls.

#### Phase 2: Core UI Framework

1. Set up React application with routing infrastructure.
2. Implement design system components and styles.
3. Create shared layouts and navigation elements.
4. Build authentication flow with Hiro Wallet integration.
5. Establish contract state retrieval pattern.

#### Phase 3: View Implementation

1. **Landing Page**:

   - Implement hero section and value proposition.
   - Create how-it-works flow and educational content.
   - Build user persona paths and CTA sections.

2. **Home View**:

   - Develop market overview components.
   - Create portfolio summary section.
   - Implement quick action cards.
   - Build simplified P&L visualization.

3. **Easy Option View**:

   - Create step-by-step flow with indicators.
   - Implement option configuration components.
   - Develop P&L scenario visualizer.
   - Build transaction confirmation interface.

4. **Option Data View**:
   - Implement options chain matrix.
   - Create chart visualizations for market data.
   - Build detailed options table with filtering.
   - Develop heat map visualization.

#### Phase 4: Integration & Testing

1. Connect all views with consistent data flow.
2. Implement cross-view navigation and state preservation.
3. Test complete user journeys across all views.
4. Optimize performance and responsiveness.
5. Polish interactions and visual design.

#### Phase 5: Deployment & Demo

1. Deploy frontend to static hosting platform.
2. Create demo accounts with pre-funded balances.
3. Record walkthrough video showing complete user journey.
4. Prepare presentation highlighting key features and innovations.

### Testing Strategy

- **Contract Testing**: Unit tests for all contract functions.
- **Component Testing**: Individual UI component validation.
- **Integration Testing**: End-to-end flows across multiple views.
- **Wallet Testing**: Transaction signing and confirmation.
- **Responsive Testing**: Validation across device sizes.
- **User Journey Testing**: Complete path validation for key personas.

## Judging Criteria Alignment

- **Innovation**: First sBTC options contract demo with multi-view architecture tailored to different user types, creating a unique Bitcoin DeFi experience.
- **Technical Implementation**: Clean Clarity code, secure sBTC/STX handling, and sophisticated frontend architecture with data visualizations.
- **Bitcoin Alignment**: Uses sBTC's finality and trustless peg, with educational content highlighting Bitcoin security throughout.
- **User Experience**: Progressive disclosure across multiple views catering to both beginner hedgers and advanced traders, with responsive design supporting multiple devices.
- **Impact Potential**: Opens derivatives market for sBTC while making options trading accessible to non-expert Bitcoin holders, boosting adoption through simplified interfaces.

## Notes & Assumptions

- **sBTC Token**: Assumes a standard fungible token contract (replace STX_TOKEN_ADDRESS.sbtc with Testnet sBTC).
- **Values**: Hardcoded for MVP (0.1 sBTC, 50 STX premium, 100 STX strike). Future versions could parameterize.
- **Security**: Clarity's lack of reentrancy and explicit post-conditions ensure safety.
- **Design System**: Implements iOS-inspired, Binance-influenced design with consistent typography, color palette, and component styles across all views.
- **Responsive Design**: Built with mobile-first approach, ensuring optimal experience across devices.
- **Development Process**: Agile, iterative approach prioritizing core functionality first, then enhancing with advanced features.
- **User Research**: Design decisions informed by persona research, particularly "Risk-Averse Rachel," leading to progressive complexity disclosure.

---

This spec gives you a solid foundation for the hackathon. You can start with the Clarity contract, test it locally, then add a basic frontend. Want me to refine anything—code, UI wireframes, or deployment steps? Let's make it a winner!
