import { devnetWallets } from "@/lib/devnet-wallet-context";

// TODO: Review if 'fundraising' is the correct name or if it should vary
const FUNDRAISING_CONTRACT_NAME = "fundraising"; 
// Define the actual contract names used in Clarity
const ORACLE_CONTRACT_NAME = "oracle";
const LIQUIDITY_POOL_CONTRACT_NAME = "liquidity-pool"; // Assuming this name, adjust if needed
const POLICY_REGISTRY_CONTRACT_NAME = "policy-registry"; // Assuming this name, adjust if needed

const DEPLOYER_ADDRESS =
  process.env.NEXT_PUBLIC_STACKS_NETWORK === "devnet"
    ? devnetWallets[0].stxAddress
    : process.env.NEXT_PUBLIC_STACKS_NETWORK === "testnet"
    ? process.env.NEXT_PUBLIC_CONTRACT_DEPLOYER_TESTNET_ADDRESS
    : process.env.NEXT_PUBLIC_CONTRACT_DEPLOYER_MAINNET_ADDRESS;

// Create a contract interface to share between all contracts
interface StacksContract {
  address: string | undefined;
  name: string;
}

export const FUNDRAISING_CONTRACT: StacksContract = {
  address: DEPLOYER_ADDRESS,
  name: FUNDRAISING_CONTRACT_NAME,
};

export const ORACLE_CONTRACT: StacksContract = {
  address: DEPLOYER_ADDRESS,
  name: ORACLE_CONTRACT_NAME,
};

export const LIQUIDITY_POOL_CONTRACT: StacksContract = {
  address: DEPLOYER_ADDRESS,
  name: LIQUIDITY_POOL_CONTRACT_NAME,
};

export const POLICY_REGISTRY_CONTRACT: StacksContract = {
  address: DEPLOYER_ADDRESS,
  name: POLICY_REGISTRY_CONTRACT_NAME,
};

const sbtcMainnetAddress = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";

export const SBTC_CONTRACT: StacksContract = {
  address:
    process.env.NEXT_PUBLIC_STACKS_NETWORK === "mainnet"
      ? sbtcMainnetAddress
      : DEPLOYER_ADDRESS,
  name: "sbtc-token",
};

export const getContractIdentifier = (contract: StacksContract = FUNDRAISING_CONTRACT) => {
  return `${contract.address}.${contract.name}`;
};

export const getOracleContractIdentifier = () => {
  return getContractIdentifier(ORACLE_CONTRACT);
};

export const getLiquidityPoolContractIdentifier = () => {
  return getContractIdentifier(LIQUIDITY_POOL_CONTRACT);
};

export const getPolicyRegistryContractIdentifier = () => {
  return getContractIdentifier(POLICY_REGISTRY_CONTRACT);
};
