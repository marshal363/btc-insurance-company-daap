# Testing Issue Analysis: update-policy-status Function

## Issue Overview

During testing of the BitHedge smart contracts using `clarinet console` and following the test script in `@docs/backend-new/provisional-2/policy-testing-simmnet.md`, we encountered an error when attempting to update policy statuses.

The specific error encountered was:

```
>> (contract-call? .policy-registry update-policy-status u0 "exercised" u40000)
<stdin>:1:1: error: expecting 2 arguments, got 3
(contract-call? .policy-registry update-policy-status u0 "exercised" u40000)
```

## Root Cause Analysis

The error occurred because the test script was attempting to call the `update-policy-status` function with 3 arguments:

1. `u0` - The policy ID
2. `"exercised"` - The new status
3. `u40000` - The current BTC price

However, examining the actual contract implementation in `clarity/contracts/policy-registry.clar`, we found that the function signature only accepts 2 arguments:

```clarity
(define-public (update-policy-status
  (policy-id uint)
  (new-status (string-ascii 10)))
  ;; Function body
)
```

This discrepancy led to the error message indicating that the function was expecting 2 arguments but received 3.

## Design Evolution Analysis

This issue likely emerged due to an evolution in the contract design. The presence of a third argument in the test script suggests that an earlier version of the contract may have required the price at the time of exercise to be passed into the function.

In the current design, the pricing logic has been separated:

- The Oracle contract is responsible for providing price data
- The Policy Registry checks policy conditions based on the current state
- Settlement calculations are handled separately

This separation of concerns is more modular and follows better contract design principles, but it resulted in the test script becoming outdated.

## Resolution

The test script was updated to remove the third argument from both policy status update calls:

Before:

```clarity
;; Exercise PUT policy
(contract-call? .policy-registry update-policy-status u0 "exercised" u40000)

;; Expire CALL policy
(contract-call? .policy-registry update-policy-status u2 "expired" u55000)
```

After:

```clarity
;; Exercise PUT policy
(contract-call? .policy-registry update-policy-status u0 "exercised")

;; Expire CALL policy
(contract-call? .policy-registry update-policy-status u2 "expired")
```

## Implications for Contract Design

This change highlights an important aspect of the current contract architecture:

1. **Decoupled Price Verification**:

   - The Oracle contract sets and stores the current price (`set-aggregated-price`)
   - The Policy Registry internally checks these prices as needed

2. **Simplified Interface**:

   - The policy status update function has a cleaner interface
   - Policy owners only need to request the status change, not provide price data

3. **Centralized Source of Truth**:
   - Using the Oracle as the single source of price data prevents manipulation
   - All contract operations reference the same price point

## Testing Recommendations

Based on this experience, we recommend:

1. Always verify function signatures in the actual contract before executing test scripts
2. Update test documentation whenever contract interfaces change
3. Add comments explaining the expected behavior and prerequisites for each test step
4. Ensure that Oracle prices are set before testing policy exercise/expiration logic
5. Test both the happy path and error cases for policy status transitions

## Conclusion

The issue encountered was a simple case of an outdated test script attempting to use a function signature that had evolved. The fix was straightforward, and the updated test script now properly aligns with the current contract design.

This incident reinforces the importance of maintaining synchronized documentation and test scripts as smart contract implementations evolve. The "On-Chain Light" approach adopted by BitHedge results in a cleaner separation of concerns, which should ultimately lead to more maintainable and secure contracts.
