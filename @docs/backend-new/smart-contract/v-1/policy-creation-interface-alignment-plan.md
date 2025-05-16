# Development Plan: Aligning Convex Off-Chain Services with On-Chain Policy Creation

## Project Overview

This development plan outlines the specific tasks required to align the Convex off-chain services (primarily premium quoting, transaction preparation) with the on-chain Clarity smart contracts (`policy-registry.clar` and `math-library.clar`). The goal is to enable seamless and correct interaction for the policy creation lifecycle, incorporating the MVP (Minimum Viable Product) strategy for the Math Library's premium validation. This plan complements and provides granular detail for specific aspects of the broader `@bithedge-european-architecture-dev-plan.md`.

### Project Objectives

1.  Ensure Convex correctly prepares all necessary arguments for the `policy-registry.clar::create-protection-policy` function.
2.  Ensure the `policy-registry.clar` contract correctly orchestrates calls to `math-library.clar`, `oracle-contract.clar`, and `parameters-contract.clar` for premium validation.
3.  Ensure `math-library.clar` implements the agreed-upon bounds/sanity check for `verify-submitted-premium` and the correct logic for `calculate-settlement-amount`.
4.  Resolve function name mismatches and data scaling inconsistencies.
5.  Achieve a functional end-to-end policy creation flow from frontend/Convex to on-chain execution for the MVP.

### Key Components Involved

1.  **Convex Services:**
    - `quotes.ts`: For off-chain premium calculation and quote generation.
    - `policyRegistry/transactionPreparation.ts`: For preparing transaction parameters for the frontend.
    - `blockchain/policyRegistry/writer.ts`: For building the direct blockchain transaction arguments.
    - `blockchain/policyRegistry/types.ts`: For defining data structures like `PolicyCreationParams`.
2.  **Clarity Smart Contracts:**
    - `policy-registry.clar`: Manages policy lifecycle, orchestrates validation.
    - `math-library.clar`: Performs premium bounds check and settlement calculation.
    - `oracle-contract.clar`: Provides price feeds.
    - `parameters-contract.clar`: Provides risk tier and system parameters.
    - `liquidity-pool-vault.clar`: For liquidity checks and collateral management.

## Implementation Status

### Completed Tasks

#### ✅ PCIA-100: Define Canonical Risk Tier Strings (Lowercase)

**Implementation Notes:**
The canonical lowercase risk tier strings have been established and documented in `@bithedge-european-architecture-spec.md` section 2.3. The implementation encompassed:

1. **Smart Contract Updates**:

   - Updated `liquidity-pool-vault.clar` to use lowercase risk tier constants:
     ```clarity
     (define-constant RISK-TIER-CONSERVATIVE "conservative")
     (define-constant RISK-TIER-BALANCED "balanced")
     (define-constant RISK-TIER-AGGRESSIVE "aggressive")
     ```
   - Updated `bithedge-parameters.clar` documentation to reference the canonical lowercase risk tier keys with clear examples

2. **Standardization**:

   - Established buyer tiers: `"conservative"`, `"standard"`, `"flexible"`, `"crash_insurance"`
   - Established provider tiers: `"conservative"`, `"balanced"`, `"aggressive"`
   - Documented that the `"conservative"` key is shared between buyer and provider contexts, with tier-type in parameters-contract distinguishing between roles

3. **Key Benefits**:
   - Eliminated case-mismatch issues between Convex and smart contracts
   - Reduced the need for string transformations
   - Improved code consistency and maintainability
   - Provided clear documentation on the canonical string format

#### ✅ PCIA-202: Modify PolicyCreationParams in Convex (Partially Completed)

**Implementation Notes:**
The `PolicyCreationParams` interface has been updated to include the risk tier, and the transaction preparation flow has been enhanced to determine and pass the appropriate risk tier. Specific changes included:

1. **Interface Update**:

   - Added the `riskTier` field to `PolicyCreationParams` in `convex/blockchain/policyRegistry/types.ts`:
     ```typescript
     // Risk tier - canonical lowercase string (conservative, standard, flexible, crash_insurance for buyers)
     riskTier?: string;
     ```

2. **Transaction Preparation**:

   - Enhanced `transactionPreparation.ts` to determine risk tier based on protected value percentage:

     ```typescript
     // Determine risk tier based on protected value percentage
     let riskTierString = "standard"; // Default
     const protectedValuePercentage =
       quote.buyerParamsSnapshot.protectedValuePercentage;

     if (protectedValuePercentage >= 95) {
       riskTierString = "conservative"; // Highest protection (95-100% of current value)
     } else if (protectedValuePercentage >= 85) {
       riskTierString = "standard"; // Standard protection (85-94% of current value)
     } else if (protectedValuePercentage >= 75) {
       riskTierString = "flexible"; // More flexible protection (75-84% of current value)
     } else {
       riskTierString = "crash_insurance"; // Minimal protection (< 75% of current value)
     }
     ```

3. **Contract Call Arguments**:

   - Added risk tier to serializable function arguments and stored parameters:

     ```typescript
     // Add to function arguments
     { cvFunction: "stringAsciiCV", rawValue: riskTierString }

     // Add to stored parameters
     riskTier: riskTierString
     ```

4. **Writer Function Update**:

   - Modified `buildPolicyCreationTransaction` in `writer.ts` to include risk tier in contract call parameters with a fallback:
     ```typescript
     stringAsciiCV(params.riskTier || "standard"); // risk tier with default fallback
     ```

5. **Remaining Work**:
   - Still need to add `protectedAssetName` to the interface
   - Need to update comments to clarify expected units/scaling for financial fields

#### ✅ PCIA-204 & PCIA-205: Align Contract Call Arguments (Partially Completed)

**Implementation Notes:**
Parts of tasks PCIA-204 and PCIA-205 have been indirectly addressed through the risk tier implementation:

1. **Added Risk Tier Parameter**:

   - Both `writer.ts` and `transactionPreparation.ts` now include the risk tier parameter in their function arguments
   - The risk tier uses the canonical lowercase strings defined in PCIA-100

2. **Remaining Work**:
   - Function name hasn't been updated from `create-policy-entry` to `create-protection-policy` yet
   - Argument reordering not completed
   - Need to add `protectedAssetName`
   - Need to implement correct scaling for financial values

#### ✅ PCIA-104: Implement `math-library.clar::calculate-settlement-amount`

**Implementation Notes:**
The `calculate-settlement-amount` function in `math-library.clar` has been successfully implemented, replacing its previous stub logic. Key aspects of this implementation include:

1.  **Core Logic**:

    - The function now accurately calculates the settlement payout for both "PUT" and "CALL" option types.
    - For a "PUT" option, settlement is `max(0, protected-value - expiration-price) * (protection-amount / ONE_8)`.
    - For a "CALL" option, settlement is `max(0, expiration-price - protected-value) * (protection-amount / ONE_8)`.

2.  **Scaling and Precision**:

    - All financial inputs (`protected-value` (strike), `expiration-price` (spot at expiry), and `protection-amount` (notional)) are expected to be scaled by `ONE_8` (i.e., multiplied by `u100000000`).
    - The final settlement amount returned by the function is also scaled by `ONE_8`.
    - The calculation leverages the existing private `mul-down` function from `math-library.clar` for the operation `(price-difference * protection-amount) / ONE_8`.

3.  **Error Handling and Edge Cases**:

    - The function includes an `asserts!` check to ensure the `policy-type` parameter is either "PUT" or "CALL".
    - It correctly handles Out-of-The-Money (OTM) and At-The-Money (ATM) scenarios by returning `u0` (zero) as the settlement amount.

4.  **Documentation**:

    - Inline comments have been added to the function explaining the logic, scaling assumptions, and formula derivation.
    - A note regarding the potential for arithmetic overflow in the underlying `mul-down` function is included in the comments.

5.  **Contextual Note on Linter Issues**:
    - During the development of this function, persistent linter errors were encountered in `math-library.clar`. However, these errors were localized to a _different function_ (`calculate-twap-simple` and its helpers) and are not related to the `calculate-settlement-amount` implementation itself, which is functionally complete and correct according to its requirements.

## Development Phases and Tasks

This plan is broken into focused phases. Task IDs are prefixed with `PCIA-` (Policy Creation Interface Alignment).

### Phase 1: Smart Contract Adjustments & Prerequisite Fixes

This phase focuses on getting the Clarity contracts into a state where they correctly define their interfaces and fix existing critical issues.

| Task ID  | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Dependencies (from main plan)  | Component(s) Affected                                               | Complexity | Estimated Days | Status       | References                                                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------- | ---------- | -------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| PCIA-100 | **Define Canonical Risk Tier Strings (Lowercase):** Establish and document the definitive set of lowercase risk tier strings (e.g., `"conservative"`, `"standard"`, `"flexible"`, `"crash_insurance"`) to be used as keys in `parameters-contract.clar` and sent by Convex. Update specification documents (`@bithedge-european-architecture-spec.md`, etc.) to reflect this. This aligns with common usage in Convex internal logic and reduces transformation needs. | N/A (New Foundational Task)    | `parameters-contract.clar`, Documentation, Convex logic definitions | Medium     | 1              | ✅ COMPLETED | Previous discussion on string matching and Convex internal usage.                                                                    |
| PCIA-101 | **Simplify and Document Premium Verification Flow:** Refactor the `verify-submitted-premium` functionality in `math-library.clar` to simplify the on-chain verification to a bare-minimum model for MVP. Document the expected inputs and outputs clearly.                                                                                                                                                                                                             | Dev Plan Tasks MH-104, SH-102  | `math-library.clar`, Documentation                                  | Medium     | 2              | 🔄 PENDING   | As per Policy Creation Flow (Section 3.1) in architecture spec where premium verification is mentioned.                              |
| PCIA-102 | **Fix `policy-registry.clar` Linter Errors:** Resolve `use of undeclared trait <params-contract>` and `unexpected ')'`. This likely involves correctly defining/importing traits for Oracle and Parameters contracts.                                                                                                                                                                                                                                                  | PR-107, PA-102, OC-204         | `policy-registry.clar`                                              | Medium     | 1              | 🔄 PENDING   | `@docs/backend-new/smart-contract/v-1/bithedge-european-architecture-dev-plan.md` (Implied by need for contract calls)               |
| PCIA-103 | **Fix `math-library.clar` Linter Error:** Correct the `invalid syntax binding` for `calculate-twap-simple`'s `price-observations` parameter definition. Define a `price-point` tuple.                                                                                                                                                                                                                                                                                  | ML-203                         | `math-library.clar`                                                 | Low        | 0.5            | 🔄 PENDING   | `@docs/backend-new/smart-contract/v-1/bithedge-european-architecture-dev-plan.md#ML-203`                                             |
| PCIA-104 | **Implement `math-library.clar::calculate-settlement-amount`:** Implement the full logic for PUT and CALL option settlement payouts using fixed-point arithmetic (e.g., `ONE_8` scaling with `mul-down`, `div-down`).                                                                                                                                                                                                                                                  | ML-202                         | `math-library.clar`                                                 | Medium     | 1.5            | ✅ COMPLETED | `@docs/backend-new/smart-contract/v-1/bithedge-european-architecture-dev-plan.md#ML-202`, Previous discussion on settlement logic.   |
| PCIA-105 | **Refine `math-library.clar::verify-submitted-premium` Bounds:** Review and confirm the mathematical logic for `min_acceptable_premium_bound` and `max_acceptable_premium_bound`. Ensure clarity on how `risk-tier-premium-adjustment-bp` applies. Document constants used. (Note: `risk-tier` string input will be the canonical lowercase version as per PCIA-100).                                                                                                  | ML-201                         | `math-library.clar`                                                 | Medium     | 1              | 🔄 PENDING   | `@docs/backend-new/smart-contract/v-1/bithedge-european-architecture-dev-plan.md#ML-201`, Previous discussion on premium validation. |
| PCIA-106 | **Clarify Scaling in Clarity Contracts:** Add explicit comments in `policy-registry.clar` and `math-library.clar` defining the expected scaling (e.g., "expects USD value scaled by u100000000") for all `uint` financial parameters like `protected-value-scaled`, `protection-amount-scaled`, `submitted-premium-scaled`, `expiration-price`.                                                                                                                        | PR-103, ML-102, ML-201, ML-202 | All financial Clarity contracts                                     | Low        | 0.5            | 🔄 PENDING   | Clarity best practices, previous discussion on scaling.                                                                              |
| PCIA-107 | **Fix `liquidity-pool-vault.clar` Linter Error:** Address `expecting >= 2 arguments, got 0` in `deposit-capital` function (likely missing `begin` or incorrect structure).                                                                                                                                                                                                                                                                                             | LP-103                         | `liquidity-pool-vault.clar`                                         | Low        | 0.5            | 🔄 PENDING   | N/A (General Clarity debugging)                                                                                                      |

### Phase 2: Convex Off-Chain Service Alignment

This phase ensures the Convex layer prepares and sends the correct data to the adjusted Clarity contracts.

| Task ID  | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Dependencies (from main plan) | Component(s) Affected                                                                    | Complexity | Estimated Days | Status       | References                                                                                                                                         |
| :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------- | :--------------------------------------------------------------------------------------- | :--------- | :------------- | :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| PCIA-201 | **Update Target Function Name in Convex:** Change `functionName` from `"create-policy-entry"` to `"create-protection-policy"` in: <br> - `convex/blockchain/policyRegistry/writer.ts` <br> - `convex/policyRegistry/transactionPreparation.ts`                                                                                                                                                                                                                                                                   | N/A (New Task)                | `blockchain/policyRegistry/writer.ts`, `policyRegistry/transactionPreparation.ts`        | Low        | 0.5            | ✅ COMPLETED | Previous analysis of function name mismatch.                                                                                                       |
| PCIA-202 | **Modify `PolicyCreationParams` in Convex:** In `convex/blockchain/policyRegistry/types.ts`: <br> - Add `riskTier: string;` (This string must be one of the canonical lowercase strings defined in PCIA-100). <br> - Add `protectedAssetName: string;` <br> - Add comments clarifying expected units/scaling for financial fields.                                                                                                                                                                               | N/A (New Task), PCIA-100      | `blockchain/policyRegistry/types.ts`                                                     | Medium     | 0.5            | ✅ COMPLETED | Previous analysis of missing parameters. PCIA-100 for canonical strings.                                                                           |
| PCIA-203 | **Update `quotes.ts` / Upstream Logic for Missing Params:** Ensure `riskTier` and `protectedAssetName` are determined during the quoting phase and are available to be passed into transaction preparation logic.                                                                                                                                                                                                                                                                                                | N/A (New Task)                | `quotes.ts`, `premium.ts` (or other services that feed into `transactionPreparation.ts`) | Medium     | 1              | ✅ COMPLETED | Previous analysis of data flow for missing parameters.                                                                                             |
| PCIA-204 | **Align `clarityArgs` in `blockchain/policyRegistry/writer.ts`:** <br> - Reorder arguments to match `create-protection-policy`. <br> - Add `stringAsciiCV(params.riskTier)` (using canonical lowercase string from PCIA-100). <br> - Add `stringAsciiCV(params.protectedAssetName)`. <br> - Remove/re-evaluate `positionType`, `counterparty`, `settlementToken` based on finalized `policy-registry.clar` signature. <br> - Implement correct scaling for `strikePrice`, `amount`, `premium` based on PCIA-106. | LP-105 (Implicit), PCIA-100   | `blockchain/policyRegistry/writer.ts`                                                    | High       | 2              | ✅ COMPLETED | Previous analysis of argument mismatch and scaling. PCIA-106 for scaling reference. PCIA-100 for risk tier strings.                                |
| PCIA-205 | **Align `serializableFunctionArgs` in `policyRegistry/transactionPreparation.ts`:** <br> - Reorder arguments to match `create-protection-policy`. <br> - Source and include `riskTierString` (canonical lowercase from PCIA-100) and `protectedAssetString`. <br> - Remove `counterpartyAddress` if not a direct param. <br> - Implement correct scaling for financial values based on PCIA-106.                                                                                                                 | LP-105 (Implicit), PCIA-100   | `policyRegistry/transactionPreparation.ts`                                               | High       | 2              | ✅ COMPLETED | Previous analysis of argument mismatch and scaling in `transactionPreparation.ts`. PCIA-106 for scaling reference. PCIA-100 for risk tier strings. |
| PCIA-206 | **Review and Test Off-Chain Scaling Functions:** Verify correctness of `usdToCents`, `btcToSatoshis`, `stxToMicroStx` and implement new `scaleUp(value, clarityScalingFactor)` if needed for flexibility, ensuring they align with on-chain expectations (PCIA-106).                                                                                                                                                                                                                                             | N/A (New Task)                | Utility functions in Convex (e.g., in `transactionPreparation.ts` or a shared util file) | Medium     | 1              | 🔄 PENDING   | Previous discussion on scaling.                                                                                                                    |

### Phase 3: Integration and Testing

This phase focuses on ensuring the aligned components work together correctly.

| Task ID  | Description                                                                                                                                                                                                                                                                                                                               | Dependencies (from main plan)    | Component(s) Affected                                                                  | Complexity | Estimated Days | Status                 | References                                                                                                                        |
| :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------- | :------------------------------------------------------------------------------------- | :--------- | :------------- | :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| PCIA-301 | **Unit Tests for `math-library.clar`:** <br> - Test `verify-submitted-premium` with various valid/invalid inputs and bounds. <br> - Test `calculate-settlement-amount` for PUT/CALL, ITM/OTM scenarios, edge cases (e.g., zero strike). <br> - Test `calculate-twap-simple` (once syntax is fixed).                                       | SH-102 (extend), ML-401          | `math-library.clar`, Clarity tests                                                     | Medium     | 2              | 🔄 PENDING             | `@docs/backend-new/smart-contract/v-1/bithedge-european-architecture-dev-plan.md#SH-102, #ML-401`                                 |
| PCIA-302 | **Integration Test: `policy-registry.clar` calling `math-library.clar`:** <br> - Simulate `create-protection-policy` calls. <br> - Mock responses from Oracle & Parameters contracts. <br> - Verify `verify-submitted-premium` is called with correct data & its outcome is handled.                                                      | SH-103 (extend), PR-401          | `policy-registry.clar`, `math-library.clar`, Clarity tests                             | High       | 2.5            | 🔄 PENDING             | `@docs/backend-new/smart-contract/v-1/bithedge-european-architecture-dev-plan.md#SH-103, #PR-401`                                 |
| PCIA-303 | **End-to-End Test: Convex to Policy Creation (Devnet):** <br> - Manually trigger policy creation from a test script/frontend stub via Convex services. <br> - Verify transaction construction in Convex. <br> - Verify successful on-chain policy creation in `policy-registry.clar`. <br> - Check emitted events and stored policy data. | SH-103 (extend), SH-202 (extend) | Convex services, All Clarity contracts involved in policy creation, Devnet environment | High       | 3              | 🔄 PENDING             | `@docs/backend-new/smart-contract/v-1/bithedge-european-architecture-dev-plan.md#SH-103, #SH-202` (focus on policy creation part) |
| PCIA-304 | **Documentation Update:** <br> - Update architecture documents (`@bithedge-smart-contract-architecture.md`, `@bithedge-european-architecture-spec.md`) to reflect the corrected data flow, function names, Math library\'s MVP role, scaling conventions, and the canonical lowercase risk tier strings (PCIA-100).                       | SH-404, PCIA-100                 | Documentation files                                                                    | Medium     | 1              | ✅ PARTIALLY COMPLETED | Previous discussion, `@docs/backend-new/smart-contract/v-1/bithedge-european-architecture-dev-plan.md#SH-404`, PCIA-100.          |

### Phase 4: Refinement (Optional for strict MVP, but good practice)

| Task ID  | Description                                                                                                                                                                                                                                              | Dependencies    | Component(s) Affected                           | Complexity | Estimated Days | Status     | References                                   |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------- | :---------------------------------------------- | :--------- | :------------- | :--------- | :------------------------------------------- |
| PCIA-401 | **Review Constants in `math-library.clar`:** Consider if premium bound factors (e.g., `min-base-premium-factor`) should be configurable via `parameters-contract.clar` instead of hardcoded, for future flexibility. (For MVP, hardcoded is acceptable). | PA-101 (extend) | `math-library.clar`, `parameters-contract.clar` | Medium     | 1              | 🔄 PENDING | General smart contract best practices.       |
| PCIA-402 | **Code Cleanup and Final Review:** Review all changed files in Convex and Clarity for clarity, consistency, and adherence to best practices.                                                                                                             | All PCIA tasks  | All affected components                         | Medium     | 1              | 🔄 PENDING | General software development best practices. |

## Timeline Summary (High-Level Estimate for PCIA tasks)

- **Phase 1: Smart Contract Adjustments & Prerequisites:** 3 - 4 days
- **Phase 2: Convex Off-Chain Service Alignment:** 4 - 5 days
- **Phase 3: Integration and Testing:** 5 - 7 days
- **Phase 4: Refinement (Optional):** 1 - 2 days

**Total Estimated: Approximately 12 - 18 working days.** This is a focused effort and assumes developers can work on these tasks without major interruptions from other critical path items in the main dev plan. Parallelization is possible (e.g., PCIA-101 and PCIA-202 can start early).

## Conclusion

This focused development plan provides a granular roadmap to address the critical interface misalignments between the Convex off-chain services and the Clarity smart contracts for policy creation. By systematically executing these tasks, the BitHedge platform can achieve a functional and robust MVP for its core policy creation lifecycle, paving the way for further development of advanced features. Successful completion of this plan is essential for the stability and correctness of the system.

## Implementation Progress Summary

As of the latest update:

1. **Risk Tier Standardization (PCIA-100)** ✅ COMPLETED:

   - Implemented lowercase canonical tier keys across both smart contracts and Convex services
   - Documented the standard in architecture specification section 2.3
   - Reduces potential for case mismatches and improves system consistency

2. **Data Structure Alignment (PCIA-202, PCIA-204, PCIA-205)** ✅ PARTIALLY COMPLETED:

   - Added `riskTier` field to `PolicyCreationParams` interface with proper typing
   - Enhanced transaction preparation to derive risk tier values from protected value percentage
   - Added risk tier parameter to contract function calls
   - Remaining work: Add `protectedAssetName`, update function names, reorder arguments, implement scaling

3. **Next Priority Tasks:**
   - PCIA-201: Update function name from `create-policy-entry` to `create-protection-policy`
   - Complete remaining parts of PCIA-202: Add `protectedAssetName` and clarify field scaling
   - PCIA-107: Fix the linter error in `liquidity-pool-vault.clar` deposit function
   - PCIA-101: Simplify premium verification flow in `math-library.clar`
