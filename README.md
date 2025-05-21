# BitHedge: The Bitcoin Insurance Company

![BitHedge Protection Platform](./screenshot.png)

## Overview

BitHedge is a decentralized application built on the Stacks blockchain that helps everyday Bitcoin users protect the value of their Bitcoin holdings against market volatility. While traditional hedging tools like options contracts exist, they remain inaccessible to regular users due to complex financial jargon and intimidating interfaces. BitHedge solves this problem by transforming options contracts into simple, understandable "Bitcoin protection policies" that function like familiar insurance products.

## Key Features

### Bitcoin Protection Center

BitHedge provides a guided, step-by-step flow that transforms options contracts into approachable protection policies:

- **Protection Type Selection**: Choose between protecting your Bitcoin holdings or locking in a price for future purchases
- **Coverage Details**: Select protection amount and level with real-time visualization
- **Policy Duration**: Choose from tiered timeframes (30 days to 1 year+) aligned with Bitcoin market dynamics
- **Policy Comparison**: Compare available protection options with plain-language descriptions
- **Review & Activate**: Simple activation with transparent cost breakdown

### Technical Foundation

BitHedge is powered by Clarity smart contracts on the Stacks blockchain with these core functions:

- **Create Protection Policy**: Protection provider locks sBTC to offer coverage
- **Purchase Protection**: User pays premium to acquire protection
- **Exercise Protection**: User claims protected value when Bitcoin price falls below protection level
- **Policy Expiration**: Protection expires after the selected time period if not exercised

## Development

To run this application with a Stacks Devnet (private development blockchain environment), follow these steps:

### 1. Start Devnet in Hiro Platform

- Log into the [Hiro Platform](https://platform.hiro.so)
- Navigate to your project and start Devnet
- Copy your API key from either:
  - The Devnet Stacks API URL: `https://api.platform.hiro.so/v1/ext/<YOUR-API-KEY>/stacks-blockchain-api`
  - Or from https://platform.hiro.so/settings/api-keys

### 2. Configure Local Environment

Install dependencies:

```bash
npm install
```

Create an `.env` file using the existing `.env.example` file:

```bash
cp front-end/.env.example front-end/.env
```

Add your Hiro Platform API key to the renamed `front-end/.env` file:

```bash
NEXT_PUBLIC_PLATFORM_HIRO_API_KEY=your-api-key-here
```

### 3. Start the Frontend Application

Start the Next.js application from the front-end directory:

```bash
cd front-end
npm run dev
```

Visit `http://localhost:3000` in your browser to view and interact with the application. If Devnet is running, your test wallets will already be funded and connected for testing.

## Architecture

BitHedge implements a hybrid architecture with:

- **Frontend**: Next.js with App Router, shadcn/ui with Tailwind CSS
- **Smart Contracts**: Clarity smart contracts for Policy Registry, Liquidity Pool, and Oracle
- **Backend Services**: Convex for off-chain processing and orchestration

The system follows an "On-Chain Light" philosophy with minimal but essential data stored on-chain, with Convex handling complex business logic, accounting, and orchestration.

## Testing with Devnet

### 1. Start Devnet and Deploy Contracts

1. Open your project in the Hiro Platform
2. Click "Start Devnet" to initialize your testing environment
3. Contracts will be deployed automatically per your deployment plan

### 2. Testing Smart Contract Functions

1. Select the Devnet tab to confirm contracts are deployed and Devnet is running
2. Click "Interact with Devnet" and then "Call functions"
3. Select your contract and function from the dropdown menus
4. Use pre-funded devnet wallets for testing
5. Execute and verify contract functions

### 3. Integration Testing

With Devnet running, test your frontend functionality:

1. Confirm Devnet is running and the frontend is started
2. Navigate to http://localhost:3000
3. Test the protection purchase flow, provider capital commitment, and policy lifecycle using pre-funded wallets

## Next Steps

Once testing is complete in Devnet, you can proceed to Testnet and eventually Mainnet:

### Moving to Testnet

1. Use the [Stacks Testnet Faucet](https://explorer.hiro.so/sandbox/faucet?chain=testnet) to get test STX tokens
2. Update the environment variables in your `.env` file
3. Deploy your contracts to Testnet using your deployment plan
4. Test your application with real network conditions

### Launching on Mainnet

1. Ensure you have real STX tokens for deployment and transaction costs
2. Update your deployment configuration to target Mainnet
3. Deploy your contracts through the Platform dashboard
4. Update your frontend environment variables to point to Mainnet

## Disclaimer

This example app is intended for educational purposes only. The provided smart contracts have not been audited for security vulnerabilities. Use at your own risk.
