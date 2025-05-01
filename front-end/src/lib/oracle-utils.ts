import { ORACLE_CONTRACT } from "@/constants/contracts";
import { ContractCallRegularOptions } from "@stacks/connect";
import { Network } from "./contract-utils";
import {
  AnchorMode,
  Pc,
  PostConditionMode,
  uintCV,
  principalCV
} from "@stacks/transactions";

/**
 * Generates transaction options for calling set-aggregated-price on the Oracle contract
 * This will be used by admins/authorized submitters to update price data
 * The contract automatically uses the current burn-block-height as the timestamp.
 */
export const getSetAggregatedPriceTx = (
  network: Network,
  address: string,
  price: number // Price scaled according to PRICE_DECIMALS (e.g., 10^8)
): ContractCallRegularOptions => {
  return {
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    contractAddress: ORACLE_CONTRACT.address || "",
    contractName: ORACLE_CONTRACT.name,
    network,
    functionName: "set-aggregated-price",
    functionArgs: [uintCV(price)], // Only price is needed now
    postConditions: [Pc.principal(address).willSendEq(0).ustx()], // No STX being transferred
  };
};

/**
 * Generates transaction options for setting a new authorized submitter for the Oracle
 * This can only be called by the contract owner
 */
export const getSetAuthorizedSubmitterTx = (
  network: Network,
  address: string,
  submitterAddress: string
): ContractCallRegularOptions => {
  return {
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    contractAddress: ORACLE_CONTRACT.address || "",
    contractName: ORACLE_CONTRACT.name,
    network,
    functionName: "set-authorized-submitter",
    functionArgs: [principalCV(submitterAddress)], // Principal for the new authorized submitter
    postConditions: [Pc.principal(address).willSendEq(0).ustx()], // No STX being transferred
  };
}; 