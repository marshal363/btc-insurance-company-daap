import { describe, it, expect, beforeEach } from 'vitest';
import {
  Cl,
  ClarityType,
  cvToString,
  uintCV,
  principalCV,
  stringAsciiCV,
  optionalCVOf,
  boolCV,
  listCV,
  tupleCV,
} from '@stacks/transactions';
// import { Chain, Account, Tx, types } from '@hirosystems/clarinet-sdk'; // Assuming these are globally available or configured elsewhere

declare var Chain: any; // Assume Chain is globally available
declare var Account: any; // Assume Account is globally available
declare var Tx: any; // Assume Tx is globally available
declare var types: any; // Assume types is globally available

const CONTRACT_NAME = 'bithedge-parameters';

// Default addresses
let deployer: any;
let wallet1: any;
let wallet2: any;

// Define constants from contract for cleaner tests
const ERR_UNAUTHORIZED = uintCV(1000);
const ERR_ROLE_NOT_FOUND_CONTRACT = uintCV(1001); // This is actually (ok false) in revoke-role for not found
const ROLE_ADMIN = stringAsciiCV("admin");
const ROLE_SYSTEM_PARAMETER_MANAGER = stringAsciiCV("param-manager");
const ROLE_FEE_STRUCTURE_MANAGER = stringAsciiCV("fee-manager");
const ROLE_ORACLE_DATA_PROVIDER = stringAsciiCV("oracle-provider")
const ROLE_EMERGENCY_OPERATOR = stringAsciiCV("emergency-operator");


describe('BitHedgeParametersContract: Deployment and Sanity Checks', () => {
  beforeEach(() => {
    const chain = new Chain();
    deployer = chain.getAccount('deployer');
    wallet1 = chain.getAccount('wallet_1');
    wallet2 = chain.getAccount('wallet_2');
    chain.deployContract(CONTRACT_NAME, CONTRACT_NAME, deployer.address);
  });

  it('should have a valid contract owner', () => {
    const chain = Chain.active();
    const contractOwner = chain.getContractData(CONTRACT_NAME, 'CONTRACT-OWNER').expectPrincipal();
    expect(cvToString(contractOwner)).toBe(deployer.address);
  });
});

describe('BitHedgeParametersContract: Role Management (PA-103)', () => {
  let chain: any;

  beforeEach(() => {
    chain = new Chain();
    deployer = chain.getAccount('deployer');
    wallet1 = chain.getAccount('wallet_1');
    wallet2 = chain.getAccount('wallet_2');
    chain.deployContract(CONTRACT_NAME, CONTRACT_NAME, deployer.address);
  });

  // grant-role tests
  it('should allow CONTRACT_OWNER to grant a role without expiration', () => {
    const block = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'grant-role', [
        principalCV(wallet1.address),
        ROLE_SYSTEM_PARAMETER_MANAGER,
        Cl.none()
      ], deployer.address)
    ]);
    block[0].result.expectOk().expectBool(true);
    block[0].events.expectPrintEvent(
      `${deployer.address}.${CONTRACT_NAME}`,
      {
        event: stringAsciiCV("role-granted"),
        'block-height': uintCV(chain.blockHeight -1), // Event emitted in previous block
        'user-principal': principalCV(wallet1.address),
        'role-name': ROLE_SYSTEM_PARAMETER_MANAGER,
        'expiration-height': Cl.none(),
        'granted-by': principalCV(deployer.address)
      }
    );

    const hasRole = chain.callReadOnlyFn(CONTRACT_NAME, 'has-role', [principalCV(wallet1.address), ROLE_SYSTEM_PARAMETER_MANAGER], deployer.address);
    hasRole.result.expectOk().expectBool(true);
  });

  it('should allow CONTRACT_OWNER to grant a role with future expiration', () => {
    const futureHeight = chain.blockHeight + 100;
    const block = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'grant-role', [
        principalCV(wallet1.address),
        ROLE_FEE_STRUCTURE_MANAGER,
        optionalCVOf(uintCV(futureHeight))
      ], deployer.address)
    ]);
    block[0].result.expectOk().expectBool(true);
    block[0].events.expectPrintEvent(
      `${deployer.address}.${CONTRACT_NAME}`,
      {
        event: stringAsciiCV("role-granted"),
        'block-height': uintCV(chain.blockHeight -1),
        'user-principal': principalCV(wallet1.address),
        'role-name': ROLE_FEE_STRUCTURE_MANAGER,
        'expiration-height': optionalCVOf(uintCV(futureHeight)),
        'granted-by': principalCV(deployer.address)
      }
    );
    const hasRole = chain.callReadOnlyFn(CONTRACT_NAME, 'has-role', [principalCV(wallet1.address), ROLE_FEE_STRUCTURE_MANAGER], deployer.address);
    hasRole.result.expectOk().expectBool(true);
  });

  it('should fail to grant a role if caller is not CONTRACT_OWNER', () => {
    const block = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'grant-role', [
        principalCV(wallet1.address),
        ROLE_ADMIN,
        Cl.none()
      ], wallet1.address)
    ]);
    block[0].result.expectErr().expectUint(ERR_UNAUTHORIZED.value);
  });

  it('should overwrite an existing role when granting again', () => {
    chain.mineBlock([ // Grant first time
      Tx.contractCall(CONTRACT_NAME, 'grant-role', [
        principalCV(wallet1.address),
        ROLE_ORACLE_DATA_PROVIDER,
        Cl.none()
      ], deployer.address)
    ]);
    const futureHeight = chain.blockHeight + 200;
    const block = chain.mineBlock([ // Grant second time with different expiration
      Tx.contractCall(CONTRACT_NAME, 'grant-role', [
        principalCV(wallet1.address),
        ROLE_ORACLE_DATA_PROVIDER,
        optionalCVOf(uintCV(futureHeight))
      ], deployer.address)
    ]);
    block[0].result.expectOk().expectBool(true);
    block[0].events.expectPrintEvent(
      `${deployer.address}.${CONTRACT_NAME}`,
      {
        event: stringAsciiCV("role-granted"),
        'block-height': uintCV(chain.blockHeight -1),
        'user-principal': principalCV(wallet1.address),
        'role-name': ROLE_ORACLE_DATA_PROVIDER,
        'expiration-height': optionalCVOf(uintCV(futureHeight)),
        'granted-by': principalCV(deployer.address)
      }
    );
  });

  // revoke-role tests
  it('should allow CONTRACT_OWNER to revoke an active role', () => {
    chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'grant-role', [principalCV(wallet1.address), ROLE_EMERGENCY_OPERATOR, Cl.none()], deployer.address)
    ]);
    const block = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'revoke-role', [principalCV(wallet1.address), ROLE_EMERGENCY_OPERATOR], deployer.address)
    ]);
    block[0].result.expectOk().expectBool(true);
    block[0].events.expectPrintEvent(
      `${deployer.address}.${CONTRACT_NAME}`,
      {
        event: stringAsciiCV("role-revoked"),
        'block-height': uintCV(chain.blockHeight -1),
        'user-principal': principalCV(wallet1.address),
        'role-name': ROLE_EMERGENCY_OPERATOR,
        'revoked-by': principalCV(deployer.address)
      }
    );
    const hasRole = chain.callReadOnlyFn(CONTRACT_NAME, 'has-role', [principalCV(wallet1.address), ROLE_EMERGENCY_OPERATOR], deployer.address);
    hasRole.result.expectOk().expectBool(false);
  });

  it('should return (ok true) when revoking an already disabled role', () => {
    chain.mineBlock([ // Grant
      Tx.contractCall(CONTRACT_NAME, 'grant-role', [principalCV(wallet1.address), ROLE_ADMIN, Cl.none()], deployer.address)
    ]);
    chain.mineBlock([ // Revoke
      Tx.contractCall(CONTRACT_NAME, 'revoke-role', [principalCV(wallet1.address), ROLE_ADMIN], deployer.address)
    ]);
    const block = chain.mineBlock([ // Revoke again
      Tx.contractCall(CONTRACT_NAME, 'revoke-role', [principalCV(wallet1.address), ROLE_ADMIN], deployer.address)
    ]);
    block[0].result.expectOk().expectBool(true);
    // No new event should be emitted if status doesn't change (contract specific, this one might still emit)
    // The current contract implementation *does* emit an event even if revoking an already disabled role, as long as the entry exists.
     block[0].events.expectPrintEvent( // It re-sets is-enabled: false and updates last-updated-height
      `${deployer.address}.${CONTRACT_NAME}`,
      {
        event: stringAsciiCV("role-revoked"),
        'block-height': uintCV(chain.blockHeight -1),
        'user-principal': principalCV(wallet1.address),
        'role-name': ROLE_ADMIN,
        'revoked-by': principalCV(deployer.address)
      }
    );
  });

  it('should return (ok false) when revoking a non-existent role for a user', () => {
    const block = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'revoke-role', [principalCV(wallet1.address), stringAsciiCV("non-existent-role")], deployer.address)
    ]);
    block[0].result.expectOk().expectBool(false); // Contract returns (ok false)
  });

  it('should fail to revoke a role if caller is not CONTRACT_OWNER', () => {
    chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'grant-role', [principalCV(wallet1.address), ROLE_ADMIN, Cl.none()], deployer.address)
    ]);
    const block = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'revoke-role', [principalCV(wallet1.address), ROLE_ADMIN], wallet1.address)
    ]);
    block[0].result.expectErr().expectUint(ERR_UNAUTHORIZED.value);
  });

  // has-role tests
  it('has-role: should return false for a non-existent role', () => {
    const hasRole = chain.callReadOnlyFn(CONTRACT_NAME, 'has-role', [principalCV(wallet1.address), stringAsciiCV("unknown-role")], deployer.address);
    hasRole.result.expectOk().expectBool(false);
  });

  it('has-role: should return false for an active role that has expired', () => {
    const expiryHeight = chain.blockHeight + 5; // Current block height before grant
    chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'grant-role', [
        principalCV(wallet1.address),
        ROLE_ADMIN,
        optionalCVOf(uintCV(expiryHeight))
      ], deployer.address)
    ]);

    let hasRole = chain.callReadOnlyFn(CONTRACT_NAME, 'has-role', [principalCV(wallet1.address), ROLE_ADMIN], deployer.address);
    hasRole.result.expectOk().expectBool(true); // Should be true before expiration

    chain.mineEmptyBlockUntil(expiryHeight + 1);

    hasRole = chain.callReadOnlyFn(CONTRACT_NAME, 'has-role', [principalCV(wallet1.address), ROLE_ADMIN], deployer.address);
    hasRole.result.expectOk().expectBool(false); // Should be false after expiration
  });
});


describe('BitHedgeParametersContract: System Parameter Management (PA-102)', () => {
  let chain: any;

  beforeEach(() => {
    chain = new Chain();
    deployer = chain.getAccount('deployer');
    wallet1 = chain.getAccount('wallet_1');
    chain.deployContract(CONTRACT_NAME, CONTRACT_NAME, deployer.address);
  });

  // Test set-system-parameter-uint
  it('set-system-parameter-uint: should allow CONTRACT_OWNER to set a uint parameter', () => {
    const paramId = stringAsciiCV("max-duration");
    const paramVal = uintCV(3600);
    const paramDesc = stringAsciiCV("Max policy duration in seconds");

    const block = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'set-system-parameter-uint', [paramId, paramVal, paramDesc], deployer.address)
    ]);
    block[0].result.expectOk().expectBool(true);
    block[0].events.expectPrintEvent(
      `${deployer.address}.${CONTRACT_NAME}`,
      {
        event: stringAsciiCV("system-parameter-updated"),
        'block-height': uintCV(chain.blockHeight -1),
        'parameter-id': paramId,
        'parameter-type': stringAsciiCV("uint"),
        'new-value-uint': paramVal,
        description: paramDesc,
        'updated-by': principalCV(deployer.address)
      }
    );

    const readParam = chain.callReadOnlyFn(CONTRACT_NAME, 'get-system-parameter', [paramId], deployer.address);
    const paramData = readParam.result.expectOk().expectSome().expectTuple();
    expect(paramData['value-uint'].type).toBe(ClarityType.OptionalSome);
    expect(paramData['value-uint'].value).toEqual(paramVal);
    expect(paramData['value-bool'].type).toBe(ClarityType.OptionalNone);
    expect(cvToString(paramData.description)).toBe(cvToString(paramDesc));

    const readSpecific = chain.callReadOnlyFn(CONTRACT_NAME, 'get-system-parameter-uint', [paramId], deployer.address);
    readSpecific.result.expectOk().expectSome().expectUint(paramVal.value);
  });

  it('set-system-parameter-uint: should fail if caller is not CONTRACT_OWNER', () => {
    const block = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'set-system-parameter-uint', [stringAsciiCV("id"), uintCV(1), stringAsciiCV("desc")], wallet1.address)
    ]);
    block[0].result.expectErr().expectUint(ERR_UNAUTHORIZED.value);
  });

  // Test set-system-parameter-bool
  it('set-system-parameter-bool: should allow CONTRACT_OWNER to set a bool parameter', () => {
    const paramId = stringAsciiCV("is-paused");
    const paramVal = boolCV(true);
    const paramDesc = stringAsciiCV("System pause flag");

    const block = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'set-system-parameter-bool', [paramId, paramVal, paramDesc], deployer.address)
    ]);
    block[0].result.expectOk().expectBool(true);
    block[0].events.expectPrintEvent(
      `${deployer.address}.${CONTRACT_NAME}`,
      {
        event: stringAsciiCV("system-parameter-updated"),
        'block-height': uintCV(chain.blockHeight -1),
        'parameter-id': paramId,
        'parameter-type': stringAsciiCV("bool"),
        'new-value-bool': paramVal,
        description: paramDesc,
        'updated-by': principalCV(deployer.address)
      }
    );
    const readSpecific = chain.callReadOnlyFn(CONTRACT_NAME, 'get-system-parameter-bool', [paramId], deployer.address);
    readSpecific.result.expectOk().expectSome().expectBool(paramVal.value);
  });

  // Test set-system-parameter-principal
  it('set-system-parameter-principal: should allow CONTRACT_OWNER to set a principal parameter', () => {
    const paramId = stringAsciiCV("treasury-address");
    const paramVal = principalCV(wallet2.address);
    const paramDesc = stringAsciiCV("Treasury wallet");

    const block = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'set-system-parameter-principal', [paramId, paramVal, paramDesc], deployer.address)
    ]);
    block[0].result.expectOk().expectBool(true);
    block[0].events.expectPrintEvent(
      `${deployer.address}.${CONTRACT_NAME}`,
      {
        event: stringAsciiCV("system-parameter-updated"),
        'block-height': uintCV(chain.blockHeight -1),
        'parameter-id': paramId,
        'parameter-type': stringAsciiCV("principal"),
        'new-value-principal': paramVal,
        description: paramDesc,
        'updated-by': principalCV(deployer.address)
      }
    );
    const readSpecific = chain.callReadOnlyFn(CONTRACT_NAME, 'get-system-parameter-principal', [paramId], deployer.address);
    readSpecific.result.expectOk().expectSome().expectPrincipal(cvToString(paramVal));
  });

  // Test set-system-parameter-string
  it('set-system-parameter-string: should allow CONTRACT_OWNER to set a string parameter', () => {
    const paramId = stringAsciiCV("system-version");
    const paramVal = stringAsciiCV("v0.1.0");
    const paramDesc = stringAsciiCV("Current system version");

    const block = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'set-system-parameter-string', [paramId, paramVal, paramDesc], deployer.address)
    ]);
    block[0].result.expectOk().expectBool(true);
    block[0].events.expectPrintEvent(
      `${deployer.address}.${CONTRACT_NAME}`,
      {
        event: stringAsciiCV("system-parameter-updated"),
        'block-height': uintCV(chain.blockHeight -1),
        'parameter-id': paramId,
        'parameter-type': stringAsciiCV("string"),
        'new-value-string': paramVal,
        description: paramDesc,
        'updated-by': principalCV(deployer.address)
      }
    );
    const readSpecific = chain.callReadOnlyFn(CONTRACT_NAME, 'get-system-parameter-string', [paramId], deployer.address);
    readSpecific.result.expectOk().expectSome().expectStringAscii(cvToString(paramVal));
  });

  // Get parameter tests
  it('get-system-parameter: should return none for a non-existent parameter-id', () => {
    const readParam = chain.callReadOnlyFn(CONTRACT_NAME, 'get-system-parameter', [stringAsciiCV("non-existent")], deployer.address);
    readParam.result.expectOk().expectNone();
  });

  it('get-system-parameter-<type>: should return none if parameter exists but is of a different type', () => {
    const paramIdUint = stringAsciiCV("uint-param");
    chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'set-system-parameter-uint', [paramIdUint, uintCV(123), stringAsciiCV("desc")], deployer.address)
    ]);
    const readBool = chain.callReadOnlyFn(CONTRACT_NAME, 'get-system-parameter-bool', [paramIdUint], deployer.address);
    readBool.result.expectOk().expectNone();
  });
}); 