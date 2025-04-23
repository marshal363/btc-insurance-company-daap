/// <reference types="vitest" />

import { ClarityValue } from "@stacks/transactions";

declare module 'vitest' {
  interface Assertion<T = any> {
    toBeOk(expected: ClarityValue): void;
    toBeErr(expected: ClarityValue): void;
  }
}

// Extend the ClarityValue interface to include value property
declare module '@stacks/transactions' {
  interface ClarityValue {
    value: any;
  }
  
  // For each specific Clarity value type
  interface TrueCV extends ClarityValue {
    value: boolean;
  }
  
  interface FalseCV extends ClarityValue {
    value: boolean;
  }
  
  interface IntCV extends ClarityValue {
    value: bigint;
  }
  
  interface UIntCV extends ClarityValue {
    value: bigint;
  }
  
  interface BufferCV extends ClarityValue {
    value: Buffer;
  }
  
  interface StringAsciiCV extends ClarityValue {
    value: string;
  }
  
  interface StringUtf8CV extends ClarityValue {
    value: string;
  }
  
  interface StandardPrincipalCV extends ClarityValue {
    value: string;
  }
  
  interface ContractPrincipalCV extends ClarityValue {
    value: { address: string; contractName: string };
  }
  
  interface TupleCV extends ClarityValue {
    value: { [key: string]: ClarityValue };
  }
} 