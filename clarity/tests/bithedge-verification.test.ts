import { 
  Clarinet, 
  Tx, 
  Chain, 
  Account, 
  types 
} from 'https://deno.land/x/clarinet@v1.0.4/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const CONTRACT_NAME = 'bithedge-verification';
const PARAMETERS_CONTRACT = 'bithedge-parameters';

Clarinet.test({
  name: "BitHedgeVerificationContract: Basic initialization checks",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;
    
    // Check initial contract owner
    let result = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-contract-owner',
      [],
      deployer.address
    );
    assertEquals(result.result, deployer.address);
    
    // Check initial principals are all 'none'
    let principalVars = [
      'get-parameters-contract-principal',
      'get-policy-registry-principal',
      'get-liquidity-pool-principal',
      'get-price-oracle-principal',
      'get-math-library-principal'
    ];
    
    for (const varFn of principalVars) {
      result = chain.callReadOnlyFn(
        CONTRACT_NAME,
        varFn,
        [],
        deployer.address
      );
      assertEquals(result.result, types.none());
    }
  },
});

Clarinet.test({
  name: "BitHedgeVerificationContract: Setting contract principals",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;
    
    // Set parameters contract principal by deployer (authorized)
    let block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'set-parameters-contract-principal',
        [types.principal(wallet1.address)],
        deployer.address
      )
    ]);
    assertEquals(block.receipts[0].result, '(ok true)');
    
    // Check the principal was set correctly
    let result = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-parameters-contract-principal',
      [],
      deployer.address
    );
    assertEquals(result.result, types.some(wallet1.address));
    
    // Try to set parameters contract principal by wallet2 (unauthorized)
    block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'set-parameters-contract-principal',
        [types.principal(wallet2.address)],
        wallet2.address
      )
    ]);
    assertEquals(block.receipts[0].result, '(err u2000)'); // ERR-UNAUTHORIZED
    
    // Try to set contract owner from wallet2 (unauthorized)
    block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'set-contract-owner',
        [types.principal(wallet2.address)],
        wallet2.address
      )
    ]);
    assertEquals(block.receipts[0].result, '(err u2000)'); // ERR-UNAUTHORIZED
    
    // Set contract owner from deployer (authorized)
    block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'set-contract-owner',
        [types.principal(wallet1.address)],
        deployer.address
      )
    ]);
    assertEquals(block.receipts[0].result, '(ok true)');
    
    // Check the owner was updated
    result = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-contract-owner',
      [],
      deployer.address
    );
    assertEquals(result.result, wallet1.address);
    
    // Now wallet1 should be able to set principals and deployer should not
    block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'set-liquidity-pool-principal',
        [types.principal(wallet2.address)],
        wallet1.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        'set-liquidity-pool-principal',
        [types.principal(wallet1.address)],
        deployer.address
      )
    ]);
    assertEquals(block.receipts[0].result, '(ok true)');
    assertEquals(block.receipts[1].result, '(err u2000)'); // ERR-UNAUTHORIZED
  },
});

Clarinet.test({
  name: "BitHedgeVerificationContract: Verification functions basic checks",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    
    // Check that verification functions return the expected values in their initial state
    // Verification result should be none for any ID
    let result = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-verification-result',
      [types.uint(1), types.ascii("POOL_BALANCE")],
      deployer.address
    );
    assertEquals(result.result, types.none());
    
    // Verification parameter should be none for any parameter name
    result = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-verification-parameter',
      [types.ascii("max-verification-age")],
      deployer.address
    );
    assertEquals(result.result, types.none());
    
    // Verification type config should be none for any verification type
    result = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-verification-type-config',
      [types.ascii("POOL_BALANCE")],
      deployer.address
    );
    assertEquals(result.result, types.none());
    
    // Check if verification is enabled should return false for any type
    result = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'is-verification-enabled',
      [types.ascii("POOL_BALANCE")],
      deployer.address
    );
    assertEquals(result.result, types.bool(false));
  },
});

Clarinet.test({
  name: "BitHedgeVerificationContract: VC-202 Verification parameter management",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    
    // First set parameters contract principal
    let block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'set-parameters-contract-principal',
        [types.principal(`${deployer.address}.${PARAMETERS_CONTRACT}`)],
        deployer.address
      )
    ]);
    assertEquals(block.receipts[0].result, '(ok true)');
    
    // Set a uint parameter
    const paramName = "max-verification-frequency";
    const paramValue = 100;
    const paramDesc = "Maximum frequency of automatic verification runs in blocks";
    
    block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'set-verification-parameter-uint',
        [
          types.ascii(paramName),
          types.uint(paramValue),
          types.ascii(paramDesc)
        ],
        deployer.address
      )
    ]);
    assertEquals(block.receipts[0].result, '(ok true)');
    
    // Check the parameter was set correctly
    let result = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-verification-parameter',
      [types.ascii(paramName)],
      deployer.address
    );
    
    const paramData = result.result.expectTuple();
    const uintValue = paramData['uint-value'].expectSome().expectUint();
    assertEquals(uintValue, paramValue);
    assertEquals(paramData['description'], types.ascii(paramDesc));
    
    // Set a boolean parameter
    const boolParamName = "enable-auto-verification";
    const boolParamValue = true;
    const boolParamDesc = "Whether automatic verification is enabled";
    
    block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'set-verification-parameter-bool',
        [
          types.ascii(boolParamName),
          types.bool(boolParamValue),
          types.ascii(boolParamDesc)
        ],
        deployer.address
      )
    ]);
    assertEquals(block.receipts[0].result, '(ok true)');
    
    // Check the boolean parameter was set correctly
    result = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-verification-parameter-bool',
      [types.ascii(boolParamName)],
      deployer.address
    );
    
    const boolValue = result.result.expectSome().expectBool();
    assertEquals(boolValue, boolParamValue);
    
    // Configure a verification type
    const verType = "POOL_BALANCE";
    const isEnabled = true;
    const frequency = 50;
    const failureAction = "LOG";
    
    block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'configure-verification-type',
        [
          types.ascii(verType),
          types.bool(isEnabled),
          types.some(types.uint(frequency)),
          types.ascii(failureAction)
        ],
        deployer.address
      )
    ]);
    assertEquals(block.receipts[0].result, '(ok true)');
    
    // Check the verification type was configured correctly
    result = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'get-verification-type-config',
      [types.ascii(verType)],
      deployer.address
    );
    
    const typeConfig = result.result.expectTuple();
    assertEquals(typeConfig['is-enabled'], types.bool(isEnabled));
    assertEquals(typeConfig['required-frequency'].expectSome().expectUint(), frequency);
    assertEquals(typeConfig['failure-action'], types.ascii(failureAction));
    
    // Check that is-verification-enabled returns true for this type
    result = chain.callReadOnlyFn(
      CONTRACT_NAME,
      'is-verification-enabled',
      [types.ascii(verType)],
      deployer.address
    );
    assertEquals(result.result, types.bool(true));
    
    // Try to use an invalid failure action and expect it to fail
    block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        'configure-verification-type',
        [
          types.ascii(verType),
          types.bool(isEnabled),
          types.some(types.uint(frequency)),
          types.ascii("INVALID_ACTION")
        ],
        deployer.address
      )
    ]);
    assertEquals(block.receipts[0].result, '(err u2005)'); // ERR-INVALID-VERIFICATION-TYPE
  },
}); 