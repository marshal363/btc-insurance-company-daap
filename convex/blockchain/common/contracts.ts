/**
 * Contracts Module
 *
 * This module handles all contract-related configuration and management.
 * It provides utilities for getting contract addresses, ABI, and other contract details.
 */

import { NetworkEnvironment, BlockchainContract } from './types';
import { getNetworkEnvironment } from './network';

/**
 * Oracle contract configuration
 */
const ORACLE_CONTRACT: BlockchainContract = {
  name: 'btc-oracle',
  address: '',  // This will be populated based on the environment
  addresses: {
    [NetworkEnvironment.MAINNET]: process.env.ORACLE_CONTRACT_ADDRESS_MAINNET || "SP000000000000000000002Q6VF78",
    [NetworkEnvironment.TESTNET]: process.env.ORACLE_CONTRACT_ADDRESS_TESTNET || "ST000000000000000000002AMW42H",
    [NetworkEnvironment.DEVNET]: process.env.ORACLE_CONTRACT_ADDRESS_DEVNET || "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  }
};

/**
 * Policy Registry contract configuration
 */
const POLICY_REGISTRY_CONTRACT: BlockchainContract = {
  name: 'policy-registry',
  address: '',  // This will be populated based on the environment
  addresses: {
    [NetworkEnvironment.MAINNET]: process.env.POLICY_REGISTRY_CONTRACT_ADDRESS_MAINNET || "SP000000000000000000002Q6VF78",
    [NetworkEnvironment.TESTNET]: process.env.POLICY_REGISTRY_CONTRACT_ADDRESS_TESTNET || "ST000000000000000000002AMW42H",
    [NetworkEnvironment.DEVNET]: process.env.POLICY_REGISTRY_CONTRACT_ADDRESS_DEVNET || "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  }
};

/**
 * Liquidity Pool contract configuration
 */
const LIQUIDITY_POOL_CONTRACT: BlockchainContract = {
  name: 'liquidity-pool-vault',
  address: '',  // This will be populated based on the environment
  addresses: {
    [NetworkEnvironment.MAINNET]: process.env.LIQUIDITY_POOL_CONTRACT_ADDRESS_MAINNET || "SP000000000000000000002Q6VF78",
    [NetworkEnvironment.TESTNET]: process.env.LIQUIDITY_POOL_CONTRACT_ADDRESS_TESTNET || "ST000000000000000000002AMW42H",
    [NetworkEnvironment.DEVNET]: process.env.LIQUIDITY_POOL_CONTRACT_ADDRESS_DEVNET || "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  }
};

/**
 * STX Token (Native) - configuration for consistency, address is not a contract
 */
const STX_TOKEN_CONTRACT: BlockchainContract = {
  name: 'STX',
  address: 'STX', // Placeholder for native token
  addresses: { // Not applicable in the same way as deployed contracts
    [NetworkEnvironment.MAINNET]: 'STX',
    [NetworkEnvironment.TESTNET]: 'STX',
    [NetworkEnvironment.DEVNET]: 'STX',
  },
  decimals: 6,
};

/**
 * sBTC Token contract configuration
 */
const SBTC_TOKEN_CONTRACT: BlockchainContract = {
  name: 'sbtc-token', // This name is used for lookup via getContractByName
  address: '', // This will be populated by getSbtcTokenContract based on the environment
  addresses: {
    [NetworkEnvironment.MAINNET]: process.env.SBTC_CONTRACT_ADDRESS_MAINNET || "SP3Y2ZSH8P7D50FF03D63M6Q9T6132G35S5K2M7C.sbtc", // Canonical sBTC on mainnet
    [NetworkEnvironment.TESTNET]: process.env.SBTC_CONTRACT_ADDRESS_TESTNET || "ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token", // Project deployed sbtc-token on Testnet
    [NetworkEnvironment.DEVNET]: process.env.SBTC_CONTRACT_ADDRESS_DEVNET || "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sbtc-token", // Project deployed sbtc-token on Devnet
  },
  decimals: 8,
};

/**
 * Get Oracle contract details
 * @param env Specific environment to get details for (defaults to current environment)
 * @returns Oracle contract details with address for the specified environment
 */
export function getOracleContract(env?: NetworkEnvironment): BlockchainContract {
  const networkEnv = env || getNetworkEnvironment();
  
  // Override from environment variables if available (legacy support)
  const legacyEnvAddress = process.env.ORACLE_CONTRACT_ADDRESS;
  const legacyEnvName = process.env.ORACLE_CONTRACT_NAME;

  // Clone the contract to avoid modifying the original
  const contract = { ...ORACLE_CONTRACT };
  
  // Use environment-specific address or legacy address
  contract.address = legacyEnvAddress || contract.addresses[networkEnv] || '';
  
  // Use legacy name if available
  if (legacyEnvName) {
    contract.name = legacyEnvName;
  }
  
  // Validate
  if (!contract.address) {
    console.error(`Oracle contract address not found for environment: ${networkEnv}`);
    throw new Error(`Oracle contract address not configured for ${networkEnv}`);
  }
  
  return contract;
}

/**
 * Get Policy Registry contract details
 * @param env Specific environment to get details for (defaults to current environment)
 * @returns Policy Registry contract details with address for the specified environment
 */
export function getPolicyRegistryContract(env?: NetworkEnvironment): BlockchainContract {
  const networkEnv = env || getNetworkEnvironment();
  
  // Override from environment variables if available (legacy support)
  const legacyEnvAddress = process.env.POLICY_REGISTRY_CONTRACT_ADDRESS;
  const legacyEnvName = process.env.POLICY_REGISTRY_CONTRACT_NAME;

  // Clone the contract to avoid modifying the original
  const contract = { ...POLICY_REGISTRY_CONTRACT };
  
  // Use environment-specific address or legacy address
  contract.address = legacyEnvAddress || contract.addresses[networkEnv] || '';
  
  // Use legacy name if available
  if (legacyEnvName) {
    contract.name = legacyEnvName;
  }
  
  // Validate
  if (!contract.address) {
    console.error(`Policy Registry contract address not found for environment: ${networkEnv}`);
    throw new Error(`Policy Registry contract address not configured for ${networkEnv}`);
  }
  
  return contract;
}

/**
 * Get Liquidity Pool contract details
 * @param env Specific environment to get details for (defaults to current environment)
 * @returns Liquidity Pool contract details with address for the specified environment
 */
export function getLiquidityPoolContract(env?: NetworkEnvironment): BlockchainContract {
  const networkEnv = env || getNetworkEnvironment();
  
  // Override from environment variables if available (legacy support)
  const legacyEnvAddress = process.env.LIQUIDITY_POOL_CONTRACT_ADDRESS;
  const legacyEnvName = process.env.LIQUIDITY_POOL_CONTRACT_NAME;

  // Clone the contract to avoid modifying the original
  const contract = { ...LIQUIDITY_POOL_CONTRACT };
  
  // Use environment-specific address or legacy address
  contract.address = legacyEnvAddress || contract.addresses[networkEnv] || '';
  
  // Use legacy name if available
  if (legacyEnvName) {
    contract.name = legacyEnvName;
  }
  
  // Validate
  if (!contract.address) {
    console.error(`Liquidity Pool contract address not found for environment: ${networkEnv}`);
    throw new Error(`Liquidity Pool contract address not configured for ${networkEnv}`);
  }
  
  return contract;
}

/**
 * Get STX token details
 * @param env Specific environment to get details for (defaults to current environment)
 * @returns STX token contract details
 */
export function getStxTokenContract(_env?: NetworkEnvironment): BlockchainContract {
  // STX is native, address and decimals are fixed. Environment might be used for future extensions.
  return { ...STX_TOKEN_CONTRACT };
}

/**
 * Get sBTC token contract details
 * @param env Specific environment to get details for (defaults to current environment)
 * @returns sBTC token contract details with address for the specified environment
 */
export function getSbtcTokenContract(env?: NetworkEnvironment): BlockchainContract {
  const networkEnv = env || getNetworkEnvironment();

  // Clone the contract to avoid modifying the original
  const contract = { ...SBTC_TOKEN_CONTRACT };
  
  // Use environment-specific address
  contract.address = contract.addresses[networkEnv] || '';
  
  // Validate
  if (!contract.address) {
    console.error(`sBTC token contract address not found for environment: ${networkEnv}`);
    throw new Error(`sBTC token contract address not configured for ${networkEnv}`);
  }
  // Ensure name is set correctly, as it might be used for principalCV
  if (!contract.name.includes('.')) { // Assuming Clarity contract names include '.'
      const addressParts = contract.address.split('.');
      if (addressParts.length === 2) {
          contract.name = addressParts[1]; // Set name to trait/contract name e.g. "sbtc"
      }
  }
  
  return contract;
}

/**
 * Get contract details by name
 * @param contractName Name of the contract to get details for
 * @param env Specific environment to get details for (defaults to current environment)
 * @returns Contract details with address for the specified environment
 */
export function getContractByName(contractName: string, env?: NetworkEnvironment): BlockchainContract {
  switch (contractName.toLowerCase()) {
    case 'oracle':
    case 'btc-oracle':
      return getOracleContract(env);
    case 'policy-registry':
    case 'policy_registry':
    case 'policyregistry':
      return getPolicyRegistryContract(env);
    case 'liquidity-pool':
    case 'liquidity_pool':
    case 'liquiditypool':
    case 'liquidity-pool-vault':
      return getLiquidityPoolContract(env);
    case 'stx':
      return getStxTokenContract(env);
    case 'sbtc':
    case 'sbtc-token':
      return getSbtcTokenContract(env);
    default:
      throw new Error(`Unknown contract name: ${contractName}`);
  }
}

/**
 * Oracle functions configuration
 */
export const ORACLE_FUNCTIONS = {
  READ_PRICE: 'get-latest-price',
  WRITE_PRICE: 'set-aggregated-price',
  IS_AUTHORIZED_SUBMITTER: 'is-authorized-submitter',
};

/**
 * Policy Registry functions configuration
 */
export const POLICY_REGISTRY_FUNCTIONS = {
  CREATE_POLICY: 'create-policy',
  UPDATE_POLICY_STATUS: 'update-policy-status',
  EXPIRE_POLICIES_BATCH: 'expire-policies-batch',
  GET_POLICY: 'get-policy',
  IS_POLICY_ACTIVE: 'is-policy-active',
  CALCULATE_SETTLEMENT: 'calculate-settlement',
  DISTRIBUTE_PREMIUM: 'distribute-premium',
};

/**
 * Liquidity Pool functions configuration
 */
export const LIQUIDITY_POOL_FUNCTIONS = {
  DEPOSIT_STX: 'deposit-stx',
  DEPOSIT_SBTC: 'deposit-sbtc',
  WITHDRAW_STX: 'withdraw-stx',
  WITHDRAW_SBTC: 'withdraw-sbtc',
  LOCK_COLLATERAL: 'lock-collateral',
  RELEASE_COLLATERAL: 'release-collateral',
  PAY_SETTLEMENT: 'pay-settlement',
  RECORD_PREMIUM: 'record-premium',
  DISTRIBUTE_PREMIUM: 'distribute-premium',
  GET_POOL_BALANCES: 'get-pool-balances',
  GET_PROVIDER_BALANCES: 'get-provider-balances',
}; 