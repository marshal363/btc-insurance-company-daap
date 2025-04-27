# sBTC Options Contract: Project Outline

## Introduction

Below is a structured project outline for the sBTC Options Contract dApp, tailored for the Bitcoin Vegas Hackathon's Stacks Track. This outline defines the core idea, essential features, and app flow (pages, navigation, and user actions) to guide development of a functional MVP using sBTC and Clarity on the Stacks blockchain. It's designed to be concise yet actionable, focusing on a working prototype that showcases sBTC's potential.

## Core Idea

The sBTC Options Contract is a decentralized application that enables users to create, buy, and exercise call options for sBTC on the Stacks blockchain. A seller locks 0.1 sBTC into a Clarity smart contract, offering buyers the right to purchase it for 100 STX within 500 blocks (~3.5 days) by paying a 50 STX premium upfront. The app leverages sBTC's Bitcoin finality and trustless peg to bring options trading—a DeFi primitive—to Bitcoin, demonstrating its programmability and security.

## Objectives

- Provide a simple, secure way to trade sBTC call options.
- Highlight sBTC's unique properties (Bitcoin-backed, decentralized).
- Deliver a hackathon-ready MVP with a working contract and basic UI.

## Essential Features

These are the must-have components for the MVP, keeping scope tight and aligned with hackathon goals.

### Smart Contract Functionality (Clarity)

- **Create Option**: Seller locks 0.1 sBTC to offer a call option.
- **Buy Option**: Buyer pays 50 STX premium to acquire the option.
- **Exercise Option**: Buyer pays 100 STX strike price to claim sBTC (before expiry).
- **Expire Option**: Seller reclaims sBTC if unexercised after 500 blocks.
- **View Option State**: Read-only function to display contract details.

### Frontend Interface (Web App)

- **Wallet Connection**: Integrate with Hiro Wallet for Stacks authentication.
- **Option Dashboard**: Show option details (seller, premium, strike price, expiry, status).
- **Action Buttons**: "Create Option," "Buy Option," "Exercise Option," "Expire Option."
- **Transaction Feedback**: Display success/failure messages post-action.

### Blockchain Integration

- Deploy contract to Stacks Testnet.
- Use Stacks.js to call contract functions and handle sBTC/STX transfers.
- Settle transactions with Bitcoin finality via Stacks.

### Demo Readiness

- Functional prototype testable on Testnet.
- 3-5 minute video showing the full flow (create → buy → exercise or expire).

## App Flow: Pages, Navigation, and User Actions

### Pages

The app is a single-page application (SPA) with a dashboard-style layout, minimizing navigation complexity for the MVP. It includes two main views and dynamic feedback:

#### Main Dashboard

**Purpose**: Central hub to view option state and perform actions.

**Components**:

- Option Details Panel: Displays seller address, premium (50 STX), strike price (100 STX), sBTC amount (0.1), expiry block, and status (active/inactive).
- Action Buttons: Context-sensitive buttons based on user role and option state.
- Wallet Status: Shows connected wallet address or "Connect Wallet" prompt.
- Visuals: Simple table or card layout, updated in real-time via contract reads.

#### Transaction Confirmation Modal

**Purpose**: Pop-up feedback after user actions.

**Components**:

- Message: e.g., "Option Created Successfully!" or "Transaction Failed."
- Details: Transaction ID (Testnet link), block height.
- Close Button: Returns to dashboard.

### Navigation

- **Single-Page Flow**: No multi-page routing; all actions occur on the dashboard.
- **Modal Overlay**: Confirmation messages appear as pop-ups, closing to refresh the dashboard.
- **Wallet Prompt**: External Hiro Wallet pop-up triggered by "Connect Wallet" or actions requiring signing.

### User Actions & Flow

The app supports two primary user roles—Seller and Buyer—with a linear workflow. Here's how users interact:

#### 1. Initial State (No Option Active)

**User**: Seller (not connected yet).  
**Page**: Main Dashboard.  
**Actions**:

- Connect Wallet: Click "Connect Wallet" → Hiro Wallet pop-up → Authenticate.
- View State: Dashboard shows "No Active Option" (via get-option-details).
- Create Option: Click "Create Option" → Sign sBTC transfer (0.1 sBTC locked) → Modal: "Option Created!" → Dashboard updates (status: active, seller: user's address, expiry: current block + 500).

#### 2. Option Available (Active, Unsold)

**User**: Buyer (not connected yet).  
**Page**: Main Dashboard.  
**Actions**:

- Connect Wallet: Click "Connect Wallet" → Authenticate.
- View State: Dashboard shows option details (premium: 50 STX, strike: 100 STX, expiry block).
- Buy Option: Click "Buy Option" → Sign STX transfer (50 STX to seller) → Modal: "Option Bought!" → Dashboard updates (buyer: user's address).

#### 3. Option Owned (Active, Pre-Expiry)

**User**: Buyer (connected).  
**Page**: Main Dashboard.  
**Actions**:

- View State: Dashboard shows "You own this option" (expiry countdown via block height).
- Exercise Option: Click "Exercise Option" → Sign STX transfer (100 STX to seller) → Modal: "Option Exercised!" → Dashboard updates (status: inactive, sBTC transferred to buyer).
- Condition: Block height < expiry block.

#### 4. Option Expired (Active, Post-Expiry)

**User**: Seller (connected).  
**Page**: Main Dashboard.  
**Actions**:

- View State: Dashboard shows "Option Expired" (block height >= expiry).
- Expire Option: Click "Expire Option" → Sign sBTC reclaim → Modal: "sBTC Reclaimed!" → Dashboard updates (status: inactive, sBTC back to seller).
- Condition: Block height >= expiry block, unexercised.

### Edge Cases

- **Disconnected User**: Dashboard shows read-only state, prompts "Connect Wallet" for actions.
- **Wrong User**: Buttons disabled if tx-sender doesn't match seller/buyer (e.g., non-buyer can't exercise).
- **Transaction Failure**: Modal shows error (e.g., "Insufficient STX"), dashboard unchanged.

## Flow Diagram

```
[Start: No Option]
   ↓ (Seller Connects)
[Create Option] → Locks 0.1 sBTC → [Option Active]
   ↓ (Buyer Connects)
[Buy Option] → Pays 50 STX → [Option Owned]
   ↓ (Before Expiry)
[Exercise Option] → Pays 100 STX → [sBTC to Buyer, End]
   OR
   ↓ (After Expiry)
[Expire Option] → Seller Reclaims sBTC → [End]
```

## Implementation Notes

- **Smart Contract**: Use the Clarity draft from the architecture spec (previous response). Deploy via Clarinet or Hiro Explorer on Testnet.
- **Frontend**: Build with React + Stacks.js. Poll get-option-details every 10 seconds for real-time updates.
- **Testing**: Simulate flow in Clarinet (local blocks), then Testnet (real blocks ~10s apart).
- **Demo**: Record video: Seller creates → Buyer buys → Buyer exercises (or Seller expires), showing wallet balances.

---

This outline keeps the project focused: one contract, one page, four actions. It's lean enough for a hackathon yet showcases sBTC's power. Want me to draft UI mockups, expand the flow, or provide a starter codebase? Let me know how to push it forward!
