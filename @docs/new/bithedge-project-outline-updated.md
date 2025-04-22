# BitHedge: Bitcoin Protection Center Project Outline

## Introduction

BitHedge is a decentralized platform that allows everyday Bitcoin users to secure their Bitcoin value against market volatility through easy-to-understand "Bitcoin protection policies." Built on the Stacks blockchain, BitHedge transforms complex financial options contracts into approachable protection products that function like familiar insurance policies, making Bitcoin's risk management tools accessible to everyone.

## Core Idea

BitHedge allows Bitcoin users to protect their Bitcoin value by paying a small one-time premium for guaranteed value protection over a specific time period. For example, a user holding 0.25 BTC (worth ~$12,000) can pay $9 to guarantee their Bitcoin maintains at least 90% of its current value for 30 days. If Bitcoin's price falls below the protected level, the user can claim their protected value; if Bitcoin's price increases or stays stable, they simply keep their Bitcoin and the protection expires (with no additional cost beyond the initial premium).

## Objectives

1. **Accessibility**: Make Bitcoin protection accessible to non-technical users through simplified insurance-based language and intuitive interfaces
2. **Clarity**: Present complex financial mechanisms as familiar protection policies, eliminating jargon barriers
3. **User Experience**: Create a guided, five-step process that anyone can confidently navigate without financial expertise

## Essential Features

### Smart Contract Functionality

- **Protection Policy Creation**: Providers lock sBTC to back protection policies
- **Protection Purchase**: Users pay premiums to acquire protection
- **Protection Claims**: Users redeem their protected value if price falls below threshold
- **Policy Expiration**: Automatic expiry after selected protection period

### Frontend Interface

- **Bitcoin Protection Center**: A step-by-step guided flow for selecting and activating protection
- **Protection Policy Simulator**: Visual tool showing protection outcomes in different price scenarios
- **Portfolio Dashboard**: Overview of active protection policies and their status

### Protection Journey Flow

1. **Protection Type Selection**: Choose between "Protect my Bitcoin holdings" or "Protect my future purchase"
2. **Coverage Details**: Select Bitcoin amount and protection level
3. **Policy Duration**: Choose protection timeframe (30/60/90 days)
4. **Available Policies**: View and select from available protection options
5. **Review & Activate**: Confirm details and activate protection

## Technical Implementation

### Technology Stack

- **Blockchain**: Stacks blockchain with Clarity smart contracts
- **Token**: sBTC (1:1 Bitcoin-backed asset on Stacks)
- **Frontend**: Next.js with Tailwind CSS
- **State Management**: Zustand for predictable state flow
- **Wallet Integration**: Hiro Wallet for Stacks/sBTC transactions

### Component Architecture

- **Global Components**: Header with wallet connection, network indicator, and navigation
- **Flow-Specific Components**: Step-by-step progression through protection setup
- **Visual Components**: Protection simulators and outcome visualizations
- **Educational Components**: Context-aware explainers and tooltips

## User Experience Focus

### Insurance Terminology

- Positions options contracts as "protection policies" or "price guarantees"
- Describes premiums as "protection costs" with transparent pricing
- Presents strike prices as "protected values" or "coverage levels"
- Explains option exercise as "filing a claim" to receive protected value

### Progressive Disclosure

- Presents only necessary information at each step to avoid overwhelming users
- Introduces more advanced concepts gradually as users progress through the flow
- Provides optional "Learn More" sections for those seeking deeper understanding

### Visual Clarity

- Uses intuitive visual cues like shield icons for protection
- Implements consistent color coding for protection status
- Provides real-time feedback on selections

### Peace of Mind

- Emphasizes maximum possible loss (limited to premium paid)
- Highlights upside potential (unlimited) with downside protection
- Reinforces self-custody principles (users maintain control of their Bitcoin)

## Protection Policies (Options Mechanics)

### PUT Protection (Downside Protection)

- **Traditional Term**: PUT option
- **BitHedge Term**: "Bitcoin Value Protection Policy"
- **User Benefit**: Protection against price drops while maintaining upside potential
- **Real Example**: Protect 0.1 BTC at a value of $43,000 for 30 days by paying $7 premium

### CALL Protection (Price Lock)

- **Traditional Term**: CALL option
- **BitHedge Term**: "Bitcoin Price Lock Guarantee"
- **User Benefit**: Lock in today's purchase price for future Bitcoin acquisition
- **Real Example**: Lock in purchase of 0.1 BTC at $48,000 for 30 days by paying $9 premium

## Development Phases

### Phase 1: Core Protection Flow

- Implement 5-step Bitcoin Protection Center
- Create essential visualization components
- Develop underlying smart contracts

### Phase 2: Protection Experience

- Refine insurance terminology throughout
- Add contextual educational elements
- Implement protection simulation tools

### Phase 3: Testing & Refinement

- Conduct user testing with everyday Bitcoin users
- Identify and eliminate remaining jargon
- Optimize the experience for clarity and confidence

## Success Criteria

- **User Comprehension**: 90% of users can correctly explain their protection policy
- **Flow Completion**: 80% of users who begin the protection flow complete it
- **User Confidence**: 85% of users report feeling "confident" or "very confident" in their protection
- **Technical Performance**: 100% accurate execution of protection claims when conditions are met

By reimagining options as protection policies, BitHedge democratizes Bitcoin risk management, making sophisticated financial tools accessible to everyday users through familiar insurance concepts and guided user experiences.
