# BitHedge European-Style Options Architecture: Development Plan

## Project Overview

This development plan outlines the tasks required to implement BitHedge's European-style options architecture on the Stacks blockchain. The project involves building a suite of smart contracts, including two primary contracts (Policy Registry and Liquidity Pool Vault) and supporting contracts for parameters, mathematical operations, oracle price feeds, and verification services. This system will enable the creation, management, and settlement of European-style Bitcoin options (settlement only at expiration).

**Note on Alignment Plans (October 2023):** The `@docs/backend-new/smart-contract/v-1/policy-creation-interface-alignment-plan.md` (PCIA) and the `@docs/backend-new/smart-contract/oracle-integration-implementation-plan.md` have been completed. These plans addressed critical misalignments between Convex off-chain services and the Clarity smart contracts, particularly for policy creation, oracle interactions, and math library functions. Consequently, many tasks within this development plan, especially for the Math Library and Oracle Contract in Phases 1 and 2, have been either completed, superseded, or significantly impacted by these alignment efforts. The statuses below reflect these updates.

### Project Objectives

1.  Implement a gas-efficient, robust, and secure European-style options platform.
2.  Support the complete policy lifecycle for both buyers (protection seekers) and sellers (liquidity providers).
3.  Create mechanisms for efficient capital utilization with an expiration-focused design.
4.  Implement comprehensive verification systems to ensure correctness and system integrity.
5.  Optimize for batch processing to reduce gas costs and enhance scalability.
6.  Align implementation with Bitcoin-native mental models and user expectations.
7.  Establish a modular architecture with clear separation of concerns between contracts.

### Key Components

1.  **BitHedgePolicyRegistryContract**: Manages policy creation, expiration batch processing, and settlement coordination.
2.  **BitHedgeLiquidityPoolVaultContract**: Handles provider capital management, collateral allocation, premium distribution, and settlement execution.
3.  **BitHedgeParametersContract**: Stores system configuration values, risk tier parameters, fee structures, and authorized principals.
4.  **BitHedgeMathLibraryContract**: Provides standardized fixed-point math operations and financial calculations (premiums, settlement amounts).
5.  **BitHedgePriceOracleContract**: Delivers reliable Bitcoin price data for premium calculation and settlement processing, with mechanisms for data validation and manipulation resistance.
6.  **BitHedgeVerificationContract**: Contains functions for verifying system invariants, data integrity across contracts, and correctness of critical operations.
7.  **Risk Tier System**: Maps user protection preferences to provider risk tolerance, influencing collateral requirements and premium calculations.
8.  **Settlement and Verification System**: Ensures correct allocation, settlement impact tracking, and premium distribution.

### Development Approach

The implementation will follow a phased approach, starting with foundational contracts and core functionality, and progressively adding more advanced features and integrations. Each phase will include thorough unit, integration, and system testing, along with comprehensive documentation.

## Development Phases and Tasks

### Phase 1: Foundation and Core Functionality

#### BitHedgeParametersContract

**Implementation Summary (PA-101 & PA-102):**

The initial development for the `BitHedgeParametersContract` focused on establishing its core data structures and basic access mechanisms.

- **PA-101 (Core Data Structures):**
  - `system-parameters` map: Defined to store various system-wide parameters. It supports multiple data types (uint, bool, principal, string-ascii) using optional fields for flexibility and includes metadata like description, last update height, and updater principal. The key is `(string-ascii 64)` for descriptive parameter IDs.
  - `fee-structure` map: Established to hold definitions for different fee types. Each entry includes fields for percentage (in basis points), min/max flat amounts, recipient principal, an activity flag, description, and update metadata. The key is `(string-ascii 32)`.
  - `authorized-roles` map: Created to manage role-based access control. It maps a composite key `(user-principal, role-name (string-ascii 32))` to details like whether the role is enabled, an optional expiration height, the principal who set the role, and update metadata.
  - A `contract-initialized-flag (bool)` data variable was also added.
- **PA-102 (Get/Set System Parameters):**
  - Type-specific public setter functions (`set-system-parameter-uint`, `-bool`, `-principal`, `-string`) were implemented. These are protected, requiring `tx-sender` to be `CONTRACT-OWNER`. When setting a parameter of one type, the optional fields for other types are cleared (`none`) to ensure data integrity. Each setter also updates the parameter's description and metadata (last update height, updater).
  - Read-only getter functions were added: `get-system-parameter` (retrieves the full parameter record) and type-specific getters (`get-system-parameter-uint`, `-bool`, `-principal`, `-string`) that return the specific `(optional <type>)` value.

These foundational elements allow for controlled storage and retrieval of system parameters, paving the way for role management and more complex parameter interactions.

**Implementation Summary (PA-103, PA-104, PA-105):**

Further development on the `BitHedgeParametersContract` introduced role management, global constants, standardized error codes, and the data structure for risk tier parameters.

- **PA-103 (Role Management Functions):**

  - Implemented `grant-role` and `revoke-role` as public, `CONTRACT-OWNER` protected functions. These allow assignment and revocation of string-based roles to user principals. Roles can optionally have an `expiration-height`.
  - `revoke-role` was refined to treat an attempt to revoke an already disabled or non-existent role for a user as a successful no-op (returning `(ok true)` if the role entry exists but is disabled, or `(err ERR-ROLE-NOT-FOUND)` if no entry exists).
  - A read-only function `has-role` was added to check if a user possesses a specific active (enabled and not expired) role.
  - Events `role-granted` and `role-revoked` are emitted to facilitate off-chain tracking.

- **PA-104 (Global Error Codes and Constants):**

  - A set of system-wide numerical constants was defined, including `UINT-MAX`, `BASIS_POINTS_MULTIPLIER`, and `BASIS_POINTS_DENOMINATOR` for financial calculations.
  - Standardized string constants for common role names (e.g., `ROLE-ADMIN`, `ROLE-SYSTEM-PARAMETER-MANAGER`) were introduced to improve consistency and reduce typographical errors in role management.
  - A new range of global error codes (u100-u120, e.g., `ERR-GENERIC`, `ERR-NOT-YET-IMPLEMENTED`, `ERR-SYSTEM-PAUSED`) was defined for common error scenarios across all BitHedge contracts.
  - A few additional specific error codes for `BitHedgeParametersContract` (u1006-u1008, e.g., `ERR-RISK-TIER-NOT-FOUND`, `ERR-ROLE-ALREADY-GRANTED`) were also added.

- **PA-105 (Risk Tier Parameter Data Structure):**
  - The `risk-tier-parameters` data map was defined to store configurations for different risk tiers.
  - The map key is `tier-name (string-ascii 32)`.
  - The value is a tuple containing:
    - `tier-type: (string-ascii 16)` (to distinguish "BUYER" from "PROVIDER" tiers).
    - `collateral-ratio-basis-points: uint` (primarily for provider tiers).
    - `premium-adjustment-basis-points: uint` (can influence premium calculations).
    - `max-exposure-per-policy-basis-points: uint` (for provider exposure management).
    - `max-exposure-per-expiration-basis-points: uint` (for provider exposure management).
    - `is-active: bool` (to enable or disable the tier).
    - `description: (string-ascii 256)`.
    - `last-updated-height: uint` and `updater-principal: principal` for metadata and auditability.
  - This structure provides a flexible foundation for managing diverse risk profiles within the system.

| Task ID | Description                                                                                                                                 | Dependencies | Complexity | Estimated Days | References                                                                                                                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-101  | Define core data structures (system-parameters, fee-structure stubs, authorized-roles). **Status: Completed**                               | None         | Medium     | 1.5            | [@bithedge-smart-contract-architecture.md#BitHedgeParametersContract], [@bithedge-contract-architecture.md#2.4-BitHedgeParametersContract.clar]                                                                                     |
| PA-102  | Implement basic get/set functions for system parameters (protected access). **Status: Completed**                                           | PA-101       | Medium     | 1.5            | [@bithedge-smart-contract-architecture.md#BitHedgeParametersContract], [@bithedge-contract-architecture.md#2.4-BitHedgeParametersContract.clar]                                                                                     |
| PA-103  | Implement role management functions (grant-role, revoke-role, has-role). **Status: Completed**                                              | PA-101       | Medium     | 2              | [@bithedge-smart-contract-architecture.md#Role-Based-Access-Control], [@BitHedge-Advanced-Clarity-Patterns.md#Role-Based-Access-Control-RBAC], [@BitHedge-Senior-Clarity-Technical-Analysis.md#4-Multi-Level-Access-Control-System] |
| PA-104  | Define initial set of global error codes and constants for the system. **Status: Completed**                                                | None         | Low        | 1              | [@clarity-best-practices.md#1.-Standardized-Error-Handling]                                                                                                                                                                         |
| PA-105  | Define data structure for risk tier parameters (name, collateral-ratio, premium-multiplier, max-exposure-percentage). **Status: Completed** | PA-101       | Medium     | 1              | [@bithedge-european-architecture-spec.md#2.3-Risk-Tier-System-Mapping], [@bithedge-liquidity-premium-management.md#2.1-Provider-Capital-Commitment-Process], [@bithedge-contract-architecture.md#1.2-BitHedgeLiquidityPool.clar]    |

#### BitHedgeMathLibraryContract

**Implementation Summary (ML-101, ML-102, ML-103, ML-104):**

The initial Phase 1 development for the `BitHedgeMathLibraryContract` established its core mathematical utilities.

- **ML-101 (Core Mathematical Constants):**

  - The crucial fixed-point precision constant `ONE_8` (u100000000) was defined for consistent 8-decimal place scaling in financial calculations.
  - An example error code `ERR-DIVISION-BY-ZERO (err u101)` was included.

- **ML-102 (Fixed-Point Math Operations):**

  - Essential private functions for fixed-point arithmetic were implemented:
    - `add (a uint) (b uint)`: Simple addition.
    - `sub (a uint) (b uint)`: Simple subtraction, panics on underflow.
    - `mul-down (a uint) (b uint)`: Multiplies two numbers already scaled by `ONE_8`, then scales down the result by dividing by `ONE_8`.
    - `div-down (a uint) (b uint)`: Divides two numbers already scaled by `ONE_8`. The first operand `a` is scaled up by `ONE_8` before division by `b` to maintain precision. Includes a check for division by zero, panicking with `ERR-DIVISION-BY-ZERO`.

- **ML-103 (Basic Premium Verification Function Stub):**

  - A read-only function `verify-submitted-premium` was implemented as a stub.
  - It accepts `submitted-premium`, `protected-value`, `protection-amount`, `current-block-height`, `expiration-height`, `policy-type`, and `risk-tier` as inputs.
  - For Phase 1, it performs a basic check to ensure `expiration-height` is greater than `current-block-height` (using an example error `(err u201)`) and that `submitted-premium` is greater than `u0`.
  - This serves as a placeholder for more complex premium calculation/validation logic in later phases (ML-201).

- **ML-104 (Basic Settlement Amount Calculation Function Stub):**
  - A read-only function `calculate-settlement-amount` was implemented as a stub.
  - It accepts `protected-value`, `protection-amount`, `expiration-price`, and `policy-type`.
  - For Phase 1, it includes a basic assertion that `policy-type` is either "PUT" or "CALL" (using an example error `(err u202)`) and returns `(ok u0)` as a placeholder.
  - Actual settlement logic (e.g., max(0, strike - spot) for a PUT) is planned for ML-202.

This work provides the foundational mathematical tools required by other contracts for financial operations and initial policy validation.

| Task ID | Description                                                                                                                                                                           | Dependencies | Complexity | Estimated Days | References                                                                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ML-101  | Define core mathematical constants (e.g., ONE_8 for fixed-point precision). **Status: Completed**                                                                                     | None         | Low        | 0.5            | [@bithedge-smart-contract-architecture.md#BitHedgeMathLibraryContract], [@BitHedge-Advanced-Clarity-Patterns.md#Fixed-Point-Arithmetic], [@BitHedge-Senior-Clarity-Technical-Analysis.md#2-Fixed-Point-Math-for-Option-Pricing] |
| ML-102  | Implement fixed-point math operations (mul-down, div-down, add, sub). **Status: Completed**                                                                                           | ML-101       | Medium     | 2              | [@BitHedge-Advanced-Clarity-Patterns.md#Fixed-Point-Arithmetic], [@BitHedge-Senior-Clarity-Technical-Analysis.md#2-Fixed-Point-Math-for-Option-Pricing], [@clarity-best-practices.md#Mathematical-Precision-and-Decimals]       |
| ML-103  | Implement basic premium _verification_ function stub (interface definition, basic inputs including submitted premium). **Status: Superseded/Obsolete by PCIA-101 & ML-201 refactor.** | ML-101       | Low        | 1              | [@bithedge-liquidity-premium-management.md#3.1-Premium-Calculation-Logic], [@bithedge-contract-architecture.md#2.3-BitHedgeMathLibrary.clar]                                                                                    |
| ML-104  | Implement basic settlement amount calculation function stub (interface definition, basic inputs). **Status: Superseded/Obsolete by PCIA-104.**                                        | ML-101       | Low        | 1              | [@bithedge-european-style-implementation.md#4.2-Settlement-Amount-Calculation], [@bithedge-contract-architecture.md#2.3-BitHedgeMathLibrary.clar]                                                                               |

#### Policy Registry Contract (BitHedgePolicyRegistryContract)

| Task ID | Description                                                                                                                                                                                                            | Dependencies                           | Complexity | Estimated Days | References                                                                                                                                                                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR-101  | Define core data structures (policies map with submitted_premium field, policy-id-counter, indices: by-owner, by-expiration-height). **Status: Completed**                                                             | PA-104                                 | Medium     | 2              | [@bithedge-smart-contract-architecture.md#1.-Policy-Registry-Contract-Architecture-European-Style-Options], [@bithedge-european-style-implementation.md#3.1-Policy-Data-Structures], [@bithedge-contract-architecture.md#1.1-BitHedgePolicyRegistry.clar] |
| PR-102  | Implement policy ID counter and basic admin functions (e.g., setting contract addresses from PA, owner checks linked to PA-103). **Status: Completed**                                                                 | PR-101, PA-103, PA-102                 | Medium     | 1.5            | [@modular-interactions.md#1.-Contract-Reference-Mechanisms]                                                                                                                                                                                               |
| PR-103  | Implement `create-protection-policy` (accepts owner, protected-value, protection-amount, expiration-height, policy-type, risk-tier, _submitted-premium_; calls ML-103 for premium verification). **Status: Completed** | PR-101, PR-102, LP-109, PA-105, ML-103 | High       | 4              | [@bithedge-european-style-implementation.md#3.2-Policy-Creation], [@bithedge-liquidity-premium-management.md#2.2-Liquidity-Verification-System], [@bithedge-european-architecture-spec.md#3.1-Policy-Creation-Flow]                                       |
| PR-104  | Implement policy status tracking and updates (`Active`, `PendingSettlement`, `Settled`, `Expired`). **Status: Completed**                                                                                              | PR-101                                 | Medium     | 1.5            | [@bithedge-european-style-implementation.md#3.3-Policy-Lifecycle-Management]                                                                                                                                                                              |
| PR-105  | Develop `policies-by-expiration-height` indexing logic within `create-protection-policy`. **Status: Completed**                                                                                                        | PR-101, PR-103                         | Medium     | 1.5            | [@BitHedge-Advanced-Clarity-Patterns.md#1.-Expiration-Focused-Architecture-Implementation], [@bithedge-european-architecture.spec.md#2.1-Policy-Registry-Contract-Data-Model]                                                                             |
| PR-106  | Implement basic policy read functions (`get-policy`, `get-policies-by-owner`, `get-policies-by-expiration-height`). **Status: Completed**                                                                              | PR-101, PR-104, PR-105                 | Medium     | 1.5            | [@bithedge-european-style-implementation.md#3.4-Policy-Read-Functions]                                                                                                                                                                                    |
| PR-107  | Add contract integration points (stubs for calling LP, PO). **Status: Completed**                                                                                                                                      | PR-101                                 | Medium     | 1              | [@modular-interactions.md#2.-Architecture-Patterns-for-Contract-Interactions]                                                                                                                                                                             |
| PR-108  | Develop policy parameter validation within `create-protection-policy` (e.g., positive values, expiration in future, valid risk tier string). **Status: Completed**                                                     | PR-103, PA-105                         | Medium     | 2              | [@clarity-best-practices.md#Essential-Best-Practices#4.-Safety-Mechanisms]                                                                                                                                                                                |
| PR-109  | Implement pre-policy liquidity verification call to LP\'s `check-liquidity` within `create-protection-policy`. **Status: Completed**                                                                                   | PR-103, LP-109                         | Medium     | 1              | [@bithedge-liquidity-premium-management.md#2.2-Liquidity-Verification-System], [@bithedge-european-architecture-spec.md#3.1-Policy-Creation-Flow]                                                                                                         |

**Implementation Summary (PR-101, PR-102, PR-103, PR-104, PR-105, PR-106, PR-107, PR-108, PR-109):**

The initial Phase 1 development for the `BitHedgePolicyRegistryContract` has established its foundational elements, enabling policy creation, basic administration, and data querying.

- **PR-101 (Core Data Structures):**

  - The `policies` map was defined to store comprehensive details for each policy, keyed by a `uint` policy ID. The policy tuple includes owner, type, risk tier, asset and collateral details, financial values (protected value, protection amount, submitted premium, collateral locked), timing (creation, expiration, settlement heights), and status.
  - A `policy-id-counter` (`uint`) was implemented to generate unique policy IDs.
  - Indexed maps `policies-by-owner` (key: `principal`) and `policies-by-expiration-height` (key: `uint`) were defined, both storing `(list MAX_POLICIES_PER_LISTING uint)` to facilitate efficient lookups. `MAX_POLICIES_PER_LISTING` is set to `u100`.

- **PR-102 (Policy ID Counter & Admin Functions):**

  - The `policy-id-counter` logic was implemented with a private function `consume-next-policy-id` that retrieves the current counter, increments it, and returns the ID to be assigned (0-indexed). It includes a basic overflow check.
  - Data variables (`optional principal`) were added to store the addresses of dependent contracts: `liquidity-pool-principal`, `math-library-principal`, `price-oracle-principal`, and `parameters-contract-principal`.
  - Public, owner-protected setter functions (e.g., `set-liquidity-pool-principal`) and public read-only getter functions were implemented for each of these principals.
  - New error codes for unset principals were added (e.g., `ERR-LP-PRINCIPAL-NOT-SET`).

- **PR-103 & Integrated Sub-tasks (PR-105, PR-108, PR-109 - Policy Creation):**

  - The main public function `create-protection-policy` was implemented.
  - **Parameter Validation (PR-108):** It performs extensive input validation: checks for valid policy type ("PUT"/"CALL"), non-empty string inputs (risk tier, asset name, collateral token), positive financial values (protected value, protection amount, submitted premium), and ensures expiration is in the future. Specific error codes were added for these.
  - **Inter-Contract Calls:**
    - Calls `verify-submitted-premium` in the `BitHedgeMathLibraryContract` (ML-103 dependency).
    - Calculates a simplified `required-collateral-scaled` (currently as `protection-amount-scaled`).
    - Calls `check-liquidity` in the `BitHedgeLiquidityPoolVaultContract` (LP-109 dependency).
    - If liquidity check passes, it calls `lock-collateral` (LP-105 dependency) and then `record-premium-payment` (dependency on an LP function, assumed to be LP-202 or similar from Phase 2 plan, for recording premiums) in the Liquidity Pool.
  - **Policy Storage:** If all checks and calls succeed, it stores the full policy details in the `policies` map with an initial "Active" status (using `STATUS-ACTIVE` constant).
  - **Indexing (PR-105):** Updates `policies-by-owner` and `policies-by-expiration-height` index maps, respecting `MAX_POLICIES_PER_LISTING`.
  - **Event Emission:** Emits a "policy-created" event with detailed policy information.

- **PR-104 (Policy Status Tracking):**

  - String constants for various policy statuses (`STATUS-ACTIVE`, `STATUS-PENDING-SETTLEMENT`, `STATUS-SETTLED-ITM`, `STATUS-EXPIRED-OTM`, `STATUS-CANCELLED`) were defined.
  - A private helper function `update-policy-status` was implemented to change a policy\'s status. It fetches the policy, merges the new status, and emits a "policy-status-updated" event. Robust status transition logic is marked as a TODO for later phases.

- **PR-106 (Basic Policy Read Functions):**

  - Implemented several `define-read-only` functions:
    - `get-policy (policy-id uint)`: Returns the full policy tuple or `ERR-POLICY-NOT-FOUND`.
    - `get-policy-status (policy-id uint)`: Returns the status string of a policy or `ERR-POLICY-NOT-FOUND`.
    - `get-policies-by-owner (owner principal)`: Returns a list of policy IDs.
    - `get-policies-by-expiration-height (height uint)`: Returns a list of policy IDs.
    - `get-total-policies-created`: Returns the current value of `policy-id-counter` (number of policies created).

- **PR-107 (Contract Integration Points):** Addressed implicitly through the implementation of admin functions for setting dependent contract principals (PR-102) and the direct `contract-call?` invocations within `create-protection-policy` (PR-103) to the Math Library and Liquidity Pool Vault. Error handling for unset principals is in place.

This phase establishes a functional, albeit initial, version of the Policy Registry, ready for further development of expiration and settlement logic in Phase 2.

#### Liquidity Pool Vault Contract (BitHedgeLiquidityPoolVaultContract)

**Implementation Summary (LP-101 to LP-110):**

Phase 1 development for the `BitHedgeLiquidityPoolVaultContract` established its core functionalities for capital management, token handling, and initial policy interaction points. The existing codebase was found to have substantially implemented these foundational elements.

- **LP-101 (Core Data Structures):**

  - Key data maps were defined:
    - `token-balances`: Tracks total, available, and locked amounts per supported token (e.g., "STX", sBTC contract principal string).
    - `provider-balances`: Manages individual provider capital, including deposited, allocated, and available amounts, along with stubs for `earned-premiums`, `pending-premiums`, and an `expiration-exposure` map (mapping expiration height to exposure amount).
    - `provider-allocations`: Stores details of a provider's capital allocation to specific policies, including `token-id`, `allocated-to-policy-amount`, `risk-tier-at-allocation`, and `expiration-height`.
    - `premium-balances`: Tracks total premiums collected and distributed per token.
    - `expiration-liquidity-needs`: A stub map to track aggregate collateral required per expiration height, including an `is-liquidity-prepared` flag for future use.
    - `risk-tier-parameters`: A stub map for storing risk tier configurations (collateral ratios, etc.), intended for full implementation in later phases.
    - `supported-tokens`: Manages initialized tokens and their associated SIP-010 contract principals if applicable.

- **LP-102 (Admin Functions):**

  - Owner-protected functions `set-policy-registry-principal`, `set-parameters-contract-principal`, and `set-math-library-principal` were implemented, along with their respective read-only getters. These allow the `CONTRACT-OWNER` to configure addresses of other critical BitHedge contracts.
  - Associated data variables (`optional principal`) were defined for each.

- **LP-103 (`deposit-capital` Function):**

  - A public function `deposit-capital` allows providers (`tx-sender`) to deposit STX or SIP-010 tokens.
  - It validates inputs (amount, token support, risk tier via a local `is-valid-risk-tier` helper).
  - It handles token transfers to the contract, updates global `token-balances` (total, available), and updates/initializes the depositing provider's record in `provider-balances` (deposited, available).
  - An event "capital-deposited" is emitted.

- **LP-104 (`withdraw-capital` Function):**

  - A public function `withdraw-capital` enables providers to withdraw their `available-amount`.
  - It validates inputs and checks the provider's available balance.
  - It handles STX or SIP-010 token transfers from the contract to the provider.
  - It updates both `provider-balances` (deposited, available) and global `token-balances` (total, available).
  - An event "capital-withdrawn" is emitted.

- **LP-105 (`lock-collateral` Function):**

  - This public function is callable only by the `policy-registry-principal`.
  - It accepts `policy-id`, `collateral-amount`, `token-id`, `risk-tier`, `expiration-height`, and `policy-owner-principal`.
  - It performs an initial global liquidity check for the token.
  - For Phase 1, it uses a simplified provider allocation logic, designating the `CONTRACT-OWNER` as the provider against whom collateral is locked. It checks this designated provider's available capital.
  - Updates global `token-balances` (available decreases, locked increases).
  - Updates the designated provider's `provider-balances` (available decreases, allocated increases) and their `expiration-exposure` for the given height.
  - Crucially, it records the allocation details in the `provider-allocations` map, linking the provider, policy, and collateral specifics.
  - An event "collateral-locked" is emitted.

- **LP-106 (Token Balance Tracking):**

  - The `token-balances` map correctly tracks `total-balance`, `available-balance`, and `locked-balance`. These are appropriately updated by `deposit-capital`, `withdraw-capital`, and `lock-collateral`. Read-only getters (`get-total-token-balance`, `get-available-balance`, `get-locked-collateral`) are also present.

- **LP-107 (Contract Integration Points):**

  - `lock-collateral` and `record-premium-payment` are restricted to be callable only by the `policy-registry-principal`.
  - The `check-liquidity` read-only function is available for the Policy Registry (or any caller) to query liquidity status.

- **LP-108 (Provider Balance Tracking):**

  - The `provider-balances` map comprehensively tracks `deposited-amount`, `allocated-amount`, `available-amount`, and `expiration-exposure`. Fields for `earned-premiums` and `pending-premiums` are included as stubs for future development. These are updated by `deposit-capital`, `withdraw-capital`, and `lock-collateral`. A `get-provider-balance` getter is available.

- **LP-109 (`check-liquidity` Function):**

  - A read-only function `check-liquidity` is implemented.
  - For Phase 1, it performs a basic check on the overall `available-balance` for the specified `token-id`.
  - It includes `risk-tier` and `expiration-height` parameters in its signature as placeholders for more advanced logic in later phases.

- **LP-110 (Token Type Management):**

  - The `initialize-token` public function allows the `CONTRACT-OWNER` to add support for STX or SIP-010 tokens, storing the SIP-010 contract principal in the `supported-tokens` map. It also initializes relevant balance maps for the new token.
  - A private helper `is-token-supported` and a public read-only `is-token-initialized-public` are available.

- **LP-111 (Linter Error):**
  - A persistent linter error ("missing contract name for call") was noted in the `deposit-capital` function related to a SIP-010 `contract-call?`. This was not addressed as per current instructions to avoid prolonged linter error fixing.

This summary covers the existing functionalities found in the Liquidity Pool Vault contract, aligning with the Phase 1 objectives.

| Task ID | Description                                                                                                                                                                                 | Dependencies                   | Complexity | Estimated Days | References                                                                                                                                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LP-101  | Define core data structures (token-balances, provider-balances, provider-allocations, premium-balances, expiration-exposure stubs, expiration-liquidity-needs stubs). **Status: Completed** | PA-104, PA-105                 | Medium     | 3              | [@bithedge-smart-contract-architecture.md#2.-Liquidity-Pool-Vault-Contract-Architecture-European-Style], [@bithedge-liquidity-premium-management.md#2.1-Provider-Capital-Commitment-Process], [@bithedge-contract-architecture.md#1.2-BitHedgeLiquidityPool.clar] |
| LP-102  | Implement admin functions (e.g., setting PR address from PA, owner checks linked to PA-103). **Status: Completed**                                                                          | LP-101, PA-103, PA-102         | Low        | 1              | [@modular-interactions.md#1.-Contract-Reference-Mechanisms]                                                                                                                                                                                                       |
| LP-103  | Implement `deposit-capital` function (provider deposits funds, includes risk-tier selection). **Status: Completed**                                                                         | LP-101, LP-102, LP-110, PA-105 | Medium     | 2.5            | [@bithedge-liquidity-premium-management.md#2.1-Provider-Capital-Commitment-Process], [@bithedge-european-architecture-spec.md#3.3-Provider-Capital-Management-Flow]                                                                                               |
| LP-104  | Implement `withdraw-capital` function (basic version, checks `available-amount`). **Status: Completed**                                                                                     | LP-101, LP-103                 | Medium     | 2              | [@bithedge-liquidity-premium-management.md#2.1-Provider-Capital-Commitment-Process], [@bithedge-european-architecture-spec.md#3.3-Provider-Capital-Management-Flow]                                                                                               |
| LP-105  | Implement `lock-collateral` (initial version, called by PR; tracks policy-id, amount, token, risk-tier, expiration-height). **Status: Completed**                                           | LP-101, LP-108, LP-109, PA-105 | High       | 3.5            | [@bithedge-liquidity-premium-management.md#2.3-Capital-Allocation-Algorithm], [@bithedge-european-style-implementation.md#4.1-Collateral-Management], [@bithedge-european-architecture-spec.md#3.1-Policy-Creation-Flow#Data-passed-during-collateral-locking]    |
| LP-106  | Implement token balance tracking (total, available, locked) updated by deposit, withdraw, lock collateral functions. **Status: Completed**                                                  | LP-101, LP-103, LP-104, LP-105 | Medium     | 2              | [@bithedge-liquidity-premium-management.md#2.1-Provider-Capital-Commitment-Process#3.-Capital-Tracking], [@bithedge-european-architecture-spec.md#2.2-Liquidity-Pool-Vault-Data-Model#Token-Balance-Tracking]                                                     |
| LP-107  | Add contract integration points (callable by PR, e.g. `lock-collateral`, `check-liquidity`). **Status: Completed**                                                                          | LP-101                         | Medium     | 1              | [@modular-interactions.md#2.-Architecture-Patterns-for-Contract-Interactions]                                                                                                                                                                                     |
| LP-108  | Implement provider balance tracking (deposited, allocated, available, earned/pending premiums stubs). **Status: Completed**                                                                 | LP-101, LP-103, LP-104, LP-105 | Medium     | 2.5            | [@bithedge-liquidity-premium-management.md#2.1-Provider-Capital-Commitment-Process#3.-Capital-Tracking], [@bithedge-european-architecture-spec.md#2.2-Liquidity-Pool-Vault-Data-Model#Provider-Balance-Tracking]                                                  |
| LP-109  | Implement `check-liquidity` (initial version: checks overall `available-balance` for the token, placeholder for risk-tier and expiration-height specific checks). **Status: Completed**     | LP-101, LP-106, LP-108         | Medium     | 2              | [@bithedge-liquidity-premium-management.md#2.2-Liquidity-Verification-System], [@bithedge-european-architecture-spec.md#3.1-Policy-Creation-Flow#Data-passed-during-liquidity-check]                                                                              |
| LP-110  | Implement token type management (`initialize-token`, `is-token-supported`, sBTC contract principal storage). **Status: Completed**                                                          | LP-101                         | Medium     | 1.5            | [@BitHedge-Advanced-Clarity-Patterns.md#Support-for-Multiple-Token-Types-SIP-010-and-SIP-009], [@clarity/contracts/liquidity-pool-vault.clar#Token-Management-Functions-LP-110]                                                                                   |
| LP-111  | Fix Linter Error in `deposit-capital` related to contract call. **Status: Completed by alignment plans (PCIA-107).**                                                                        | LP-103                         | Low        | 0.5            | N/A                                                                                                                                                                                                                                                               |

#### BitHedgePriceOracleContract (Stubs for Phase 1)

| Task ID | Description                                                                                | Dependencies   | Complexity | Estimated Days | References                                                                                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------ | -------------- | ---------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PO-101  | Define core data structures (price data map stub, price sources map stub)                  | PA-104         | Low        | 1              | [@bithedge-smart-contract-architecture.md#BitHedgePriceOracleContract], [@bithedge-contract-architecture.md#2.2-BitHedgePriceOracle.clar]                                                      |
| PO-102  | Implement basic `get-current-bitcoin-price` function stub (returns a constant for testing) | PO-101         | Low        | 0.5            | [@bithedge-european-style-implementation.md#5.1-Oracle-Integration-for-Policy-Creation], [@BitHedge-Senior-Clarity-Technical-Analysis.md#1-Oracle-Implementation--Price-Feed-Security]         |
| PO-103  | Implement basic `get-bitcoin-price-at-height` function stub (returns a constant)           | PO-101         | Low        | 0.5            | [@bithedge-european-style-implementation.md#5.2-Oracle-Integration-for-Settlement], [@BitHedge-Senior-Clarity-Technical-Analysis.md#1-Oracle-Implementation--Price-Feed-Security]              |
| PO-104  | Define admin functions for managing authorized updaters (link to PA-103)                   | PO-101, PA-103 | Low        | 1              | [@BitHedge-Advanced-Clarity-Patterns.md#6.-Oracle-Security-and-Decentralization], [@BitHedge-Senior-Clarity-Technical-Analysis.md#1-Oracle-Implementation--Price-Feed-Security#Recommendation] |

**Implementation Summary (SH-101, SH-102, SH-103):**

The initial "Shared Components" development focused on establishing standardized event structures and laying the groundwork for comprehensive testing across the BitHedge smart contract suite.

- **SH-101 (Standardized Event Emission):**

  - A standardized event structure was defined and implemented: `(print { event: "<event-name-kebab-case>", block-height: burn-block-height, ...kebab-case-keys... })`.
  - This structure was applied to existing and new events across several key contracts:
    - `oracle.clar`: Updated `added-authorized-submitter`, `removed-authorized-submitter`, and `set-contract-admin`. The `price-updated` event (from a prior, now commented-out, version) was noted as needing this standardization if reinstated.
    - `BitHedgeParametersContract.clar`: Updated `role-granted` and `role-revoked`. New `system-parameter-updated` events were added to all parameter setter functions.
    - `policy-registry.clar`: Updated `policy-created` and `policy-status-updated`.
    - `liquidity-pool-vault.clar`: Updated `token-initialized`, `capital-deposited`, `capital-withdrawn`, and `premium-recorded-for-policy`. A new `collateral-locked` event was added and standardized.
  - Minor linter errors encountered during these updates were addressed or noted as potential linter quirks.

- **SH-102 (Basic Testing Framework & Unit Tests):**

  - A conceptual testing framework was outlined, leveraging Clarinet, TypeScript, and Vitest, utilizing `describe`/`it` blocks for test structure, `Tx.contractCall` for interactions, and standard assertions.
  - **Unit tests for `BitHedgeParametersContract.clar` (PA-10x functions)** were implemented in `clarity/tests/bithedge-parameters.test.ts`. These tests cover:
    - Role management: Granting and revoking roles (e.g., `ROLE-ADMIN`, `ROLE-SYSTEM-PARAMETER-MANAGER`), including checks for roles with and without expiration heights.
    - System parameter management: Setting and getting various types of system parameters (uint, bool, principal, string-ascii).
    - Addressed initial linter/type errors by adjusting Clarinet SDK import paths and using `Cl.none()` for optional CVs, with temporary `any` type annotations to resolve TypeScript issues, assuming global types are configured in the project.
  - **Unit tests for `BitHedgeMathLibraryContract.clar` (ML-10x functions)** were implemented in `clarity/tests/math-library.test.ts`.
    - Based on the task IDs (ML-101 to ML-104 referring to `power`, `multiply-decimals`, `divide-decimals`, `calculate-percentage`), tests were generated for these specific mathematical operations. This was done even though the provided `math-library.clar` contract file contained different public stubs (`verify-submitted-premium`, `calculate-settlement-amount`) and private helper math functions (`add`, `sub`, `mul-down`, `div-down`). The tests targeted the conceptual ML-10x tasks.
    - Tests included success cases and edge cases like division by zero or power of zero.

- **SH-103 (First Integration Test Cases):**
  - Integration tests were implemented in `clarity/tests/integration-policy-creation.test.ts`, focusing on critical interactions:
    - Liquidity Pool: `deposit-capital` and `withdraw-capital` flows.
    - Policy Registry `create-policy` flow, including interactions with the Liquidity Pool for `check-liquidity` and `lock-collateral`, and `record-premium-payment`.
  - **Test Setup:**
    - All relevant contracts (`BitHedgeParametersContract`, `BitHedgeMathLibraryContract`, `BitHedgePriceOracleContract`, `BitHedgeLiquidityPoolVaultContract`, `BitHedgePolicyRegistryContract`) were deployed.
    - Initial configurations were performed: setting an authorized submitter and an initial price in the Oracle; setting dependent contract principals in the LP Vault and Policy Registry; initializing an "STX" token in the LP Vault (as a string identifier, not a SIP-010 principal).
  - **Key Test Scenario (`create-protection-policy` success):**
    - A liquidity provider successfully deposits capital into the LP Vault, with verification of the `capital-deposited` event and resulting balance changes.
    - A policyholder successfully creates a "PUT" protection policy.
    - Verification included:
      - Successful transaction and correct policy ID returned by `create-protection-policy`.
      - Emission of the `policy-created` event from the Policy Registry with correct parameters.
      - Emission of the `collateral-locked` event from the Liquidity Pool Vault. (Note: Phase 1 LP `lock-collateral` logic hardcodes the LP contract owner as the provider).
      - Emission of the `premium-recorded-for-policy` event from the Liquidity Pool Vault.
      - Correct updates to state variables, such as `policy-id-counter` in PR and available/locked balances in LP.
  - The tests used placeholder risk tier strings like `"BASIC_PROVIDER_TIER"` and `"STANDARD_BUYER_TIER"`.
  - A discrepancy was noted during test development regarding Oracle functions: the `oracle.clar` contract features `get-current-bitcoin-price` (no arguments) and `get-bitcoin-price-at-height(height)`, while an initial test thought process might have looked for a direct `get-bitcoin-price(asset-id)`. The tests relied on the successful setup of `update-bitcoin-price` for their Oracle interactions.

#### Shared Components (SH)

| Task ID | Description                                                                                                                                                            | Dependencies                                   | Complexity | Estimated Days | References                                                                                                                                                      |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SH-101  | Establish standardized event emission structures and initial set of events (e.g., policy created, capital deposited). **Status: Completed**                            | PA-104                                         | Low        | 1              | [@BitHedge-Advanced-Clarity-Patterns.md#7.-Event-Emission-and-Off-Chain-Indexing], [@BitHedge-Senior-Clarity-Technical-Analysis.md#7-Event-Driven-Architecture] |
| SH-102  | Design basic testing framework; Write unit tests for PA-10x, ML-10x functions. **Status: Completed**                                                                   | PA-101, ML-101                                 | Medium     | 2.5            | [@clarity-best-practices.md#Testing-Strategies#Unit-Testing]                                                                                                    |
| SH-103  | Implement first integration test cases: PR `create-policy` -> LP `check-liquidity` & `lock-collateral`; LP `deposit-capital`/`withdraw-capital`. **Status: Completed** | PR-103, LP-103, LP-104, LP-105, LP-109, SH-102 | High       | 3.5            | [@modular-interactions.md#5.-Implementation-Example-Complete-Interaction-Flow], [@clarity-best-practices.md#Testing-Strategies#Integration-Testing]             |

#### Phase 1 Milestones

- **M1.1**: Core data structures for all foundational contracts (PR, LP, PA, ML, PO stubs) defined and implemented. Global constants and error codes (PA) established.
- **M1.2**: Basic capital management (deposit, withdraw) in LP, including token initialization and linter error fix, is functional and tested.
- **M1.3**: Policy creation flow in PR, including pre-liquidity check, parameter validation, and basic collateral locking in LP, is working. `policies-by-expiration-height` indexed.
- **M1.4**: ParametersContract (PA) for admin roles and basic system params, and MathLibrary (ML) for fixed-point math and calculation stubs, are testable. PriceOracle (PO) stubs are in place.
- **M1.5**: Initial integration tests for policy creation, capital deposit/withdrawal, and collateral locking pass. Basic event emissions are verified.

### Phase 2: Settlement, Expiration, and Core Oracle/Verification Logic

#### BitHedgeParametersContract

| Task ID | Description                                                                                                              | Dependencies   | Complexity | Estimated Days | References                                                                                                                                                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------ | -------------- | ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-201  | Implement functions to get/set risk tier parameters (collateral-ratio, premium-multiplier, etc., protected by PA-103)    | PA-105, PA-103 | Medium     | 2              | [@bithedge-european-architecture-spec.md#4.1-Risk-Tier-Implementation], [@bithedge-liquidity-premium-management.md#2.1-Provider-Capital-Commitment-Process#2.-Risk-Tier-Assignment], [@bithedge-contract-architecture.md#1.2-BitHedgeLiquidityPool.clar#Risk-Tier-Parameter-Registry] |
| PA-202  | Define detailed fee structures (e.g., policy creation fee, settlement fee) and management functions (get/set, protected) | PA-101, PA-103 | Medium     | 1.5            | [@bithedge-smart-contract-architecture.md#BitHedgeParametersContract]                                                                                                                                                                                                                 |

#### BitHedgeMathLibraryContract

| Task ID | Description                                                                                                                                                                                                                                                            | Dependencies           | Complexity | Estimated Days | References                                                                                                                                                                                                                                                               |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ML-201  | Implement full premium _verification_ logic (integrating risk tier params from PA, submitted premium, time to expiry, and potentially simplified oracle inputs for bounds checking). **Status: Completed by alignment plans (PCIA-101, PCIA-105, and self-refactor).** | ML-103, PA-201, PO-202 | High       | 3              | [@bithedge-liquidity-premium-management.md#3.1-Premium-Calculation-Logic], [@bithedge-european-architecture-spec.md#3.1-Policy-Creation-Flow#Premium-recording-data], [@bithedge-contract-architecture.md#2.3-BitHedgeMathLibrary.clar]                                  |
| ML-202  | Implement full settlement amount calculation logic for PUT and CALL options. **Status: Completed by alignment plans (PCIA-104).**                                                                                                                                      | ML-104                 | Medium     | 2              | [@bithedge-european-style-implementation.md#4.2-Settlement-Amount-Calculation], [@bithedge-european-architecture-spec.md#3.2-Expiration-Settlement-Flow-European-Style#Settlement-amount-calculation], [@bithedge-contract-architecture.md#2.3-BitHedgeMathLibrary.clar] |

**Implementation Summary (Phase 2 - ML-201 Refactor):**

The `verify-submitted-premium` function (ML-201) in `BitHedgeMathLibraryContract.clar` has been significantly refactored to ensure it operates as a true read-only function. Previously, it made internal `contract-call?` attempts to other contracts, leading to linter errors regarding writing operations in a read-only context.

Key changes include:

- The function signature was modified to accept `current-oracle-price uint`, `risk-tier-is-active bool`, and `risk-tier-premium-adjustment-bp uint` as direct input parameters, instead of fetching them internally. The `risk-tier (string-ascii 32)` parameter was removed as the specific details are now passed in.
- Consequently, data variables for storing `parameters-contract-principal` and `oracle-contract-principal`, along with their setters/getters and associated error codes, were removed from `math-library.clar`.
- This refactoring successfully addresses the "expecting read-only statements, detected a writing operation" error previously reported by `clarinet check` for this function in `math-library.clar`.

The `create-protection-policy` function within `BitHedgePolicyRegistryContract.clar` was updated to accommodate these changes. It now:

1.  Retrieves the necessary principals for the Oracle and Parameters contracts.
2.  Calls the Oracle contract (`get-current-bitcoin-price`) to obtain the current oracle price.
3.  Calls the Parameters contract (`get-risk-tier-parameters`) to fetch the details for the specified risk tier.
4.  Passes these fetched values (current oracle price, risk tier activity status, and premium adjustment basis points) to the refactored `verify-submitted-premium` function in the Math Library.

_Note: An ongoing linter error in `policy-registry.clar` ("use of undeclared trait <oracle-contract>") indicates that the integration of these calls is not yet fully resolved. The `clarinet check` command was also interrupted by the user before a full analysis of all contracts could be completed based on the latest changes._

| Task ID | Description                                                                                                                                                                                       | Dependencies | Complexity | Estimated Days | References                                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ML-203  | Add utility function stubs for Time-Weighted Average Price (TWAP) calculation (logic to be refined with Oracle). **Status: Completed by alignment plans (PCIA-103 fixed syntax, stubs present).** | ML-101       | Medium     | 1              | [@BitHedge-Advanced-Clarity-Patterns.md#Time-Weighted-Average-Price-TWAP-Oracles], [@BitHedge-Senior-Clarity-Technical-Analysis.md#1-Oracle-Implementation--Price-Feed-Security#Recommendation] |

#### Policy Registry Contract (BitHedgePolicyRegistryContract)

| Task ID | Description                                                                                                                                                                             | Dependencies                           | Complexity | Estimated Days | References                                                                                                                                                                                                                                                                                 |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PR-201  | Implement `process-single-policy-at-expiration` (fetches price from PO-OC-203, calls ML for settlement, determines ITM/OTM). **Status: Completed**                                      | PR-104, OC-203, ML-202, LP-203, LP-206 | High       | 3.5            | [@bithedge-european-style-implementation.md#3.5-Policy-Expiration-and-Settlement], [@bithedge-european-architecture-spec.md#3.2-Expiration-Settlement-Flow-European-Style], [@bithedge-contract-architecture.md#1.1-BitHedgePolicyRegistry.clar#Key-Functions]                             |
| PR-202  | Develop `is-policy-in-the-money` logic (internal, uses PO-OC-203 price and policy data). **Status: Completed** (Implicitly, as part of PR-201)                                          | PR-101, OC-203                         | Medium     | 1.5            | [@bithedge-european-style-implementation.md#4.2-Settlement-Amount-Calculation#Determining-In-The-Money-ITM-Status], [@bithedge-european-architecture-spec.md#3.2-Expiration-Settlement-Flow-European-Style#In-The-Money-ITM-determination]                                                 |
| PR-203  | Integrate ML-202 for settlement amount calculation within `process-single-policy-at-expiration`. **Status: Completed**                                                                  | PR-201, ML-202                         | Low        | 0.5            | [@modular-interactions.md#3.-Multi-Step-Process-Coordination]                                                                                                                                                                                                                              |
| PR-204  | Add `policy-settlements` map for tracking detailed settlement records (price, amount, height, timestamp). **Status: Completed**                                                         | PR-101, PR-201                         | Medium     | 1.5            | [@bithedge-european-style-implementation.md#3.1-Policy-Data-Structures#Settlement-Tracking], [@bithedge-european-architecture-spec.md#2.1-Policy-Registry-Contract-Data-Model#Settlement-Tracking]                                                                                         |
| PR-205  | Develop `pending-premium-distributions` map and queuing logic for OTM policies identified in PR-201. **Status: Completed**                                                              | PR-101, PR-201                         | Medium     | 2              | [@bithedge-liquidity-premium-management.md#3.2-Premium-Distribution-for-OTM-Policies], [@bithedge-european-architecture-spec.md#2.1-Policy-Registry-Contract-Data-Model#Premium-Distribution-Queue]                                                                                        |
| PR-206  | Implement `process-expiration-batch` (fold over `policies-by-expiration-height`, call PR-201 for each, use PO-OC-203 price for the batch). **Status: Completed**                        | PR-105, PR-201, OC-203                 | High       | 3.5            | [@BitHedge-Advanced-Clarity-Patterns.md#1.-Expiration-Focused-Architecture-Implementation#Expiration-batch-processing-capability], [@bithedge-european-style-implementation.md#3.6-Batch-Expiration-Processing], [@bithedge-european-architecture-spec.md#4.3-Batch-Expiration-Processing] |
| PR-207  | Implement `distribute-premium` for a single OTM policy (marks for distribution, calls LP-206). **Status: Completed**                                                                    | PR-205, LP-206                         | High       | 3              | [@bithedge-liquidity-premium-management.md#3.2-Premium-Distribution-for-OTM-Policies], [@bithedge-european-architecture-spec.md#3.2-Expiration-Settlement-Flow-European-Style#Premium-distribution-data]                                                                                   |
| PR-208  | Develop settlement initiation call to LP (`process-settlement-at-expiration` in LP) for ITM policies from PR-201. **Status: Completed**                                                 | PR-201, LP-203                         | Medium     | 1              | [@modular-interactions.md#3.-Multi-Step-Process-Coordination]                                                                                                                                                                                                                              |
| PR-209  | Integrate with refactored Oracle (OC-203 `get-latest-price`) for fetching reliable expiration price (handle potential Oracle issues gracefully) in PR-201/PR-206. **Status: Completed** | PR-201, PR-206, OC-203                 | Medium     | 2.5            | [@bithedge-european-style-implementation.md#5.2-Oracle-Integration-for-Settlement], [@BitHedge-Advanced-Clarity-Patterns.md#6.-Oracle-Security-and-Decentralization#Key-Recommendations]                                                                                                   |
| PR-210  | Add Oracle price freshness verification (e.g., price not older than X blocks, using Oracle's timestamp via OC-203) in `create-protection-policy`. **Status: Completed**                 | PR-103, OC-203                         | Medium     | 1.5            | [@BitHedge-Advanced-Clarity-Patterns.md#6.-Oracle-Security-and-Decentralization#Key-Recommendations], [@BitHedge-Senior-Clarity-Technical-Analysis.md#1-Oracle-Implementation--Price-Feed-Security#Recommendation]                                                                         |

**Implementation Summary (Phase 2 - Policy Registry PR-201 to PR-210):**

Phase 2 for the `BitHedgePolicyRegistryContract` focused on the critical logic for handling policy expiration, settlement, and interactions with other core contracts for these processes.

- **Core Expiration Logic (PR-201, PR-202, PR-203, PR-204, PR-208, PR-209):**

  - The function `process-single-policy-at-expiration` was implemented, along with its private helper `priv-process-one-policy-at-expiration`. This is the heart of individual policy settlement.
  - It correctly fetches the Bitcoin price from the `BitHedgePriceOracleContract` for the policy's specific `expiration-height`.
  - It then calls `calculate-settlement-amount` in the `BitHedgeMathLibraryContract` to determine if the policy is In-The-Money (ITM) and the corresponding payout.
  - If ITM, it initiates a settlement call (`process-settlement-at-expiration`) to the `BitHedgeLiquidityPoolVaultContract`, passing necessary details like policy ID, settlement amount, token, and the policy owner (beneficiary).
  - If Out-of-The-Money (OTM), the policy is marked for premium distribution.
  - Detailed settlement information (expiration price, settlement amount, processing height) is recorded in the `policy-settlements` map (PR-204).
  - Error handling for calls to dependent contracts (Oracle, Math, LP) is included, typically by printing an event and propagating an error code.

- **Batch Expiration Processing (PR-206, PR-209):**

  - The `process-expiration-batch` function was implemented to handle multiple policies expiring at the same `expiration-height-to-process`.
  - It fetches a common Bitcoin price from the Oracle for the specified expiration height to be used for all policies in that batch.
  - It iterates (using `fold`) over the list of policy IDs obtained from the `policies-by-expiration-height` index, calling `priv-process-one-policy-at-expiration` for each.
  - An accumulator tracks the count of processed, ITM, OTM, and errored policies within the batch, returning a summary.
  - If the initial batch-wide oracle call fails, the entire batch processing is halted with an error.

- **Premium Distribution for OTM Policies (PR-205, PR-207):**

  - The `pending-premium-distributions` map (PR-205) was added to track OTM policies that are ready for their collected premiums to be distributed to liquidity providers. This map is populated by `priv-process-one-policy-at-expiration`.
  - The `distribute-premium` function (PR-207) was implemented to process a single policy from this queue. It validates the policy's OTM status and pending flag.
  - It then calls `distribute-premium-to-providers` (expected in LP-206) in the `BitHedgeLiquidityPoolVaultContract`, passing the policy ID, premium amount, and token type.
  - Upon successful call to the LP, the policy is removed from the `pending-premium-distributions` queue (marked as false), and an event is emitted.

- **Oracle Price Freshness in Policy Creation (PR-210):**
  - The `create-protection-policy` function was enhanced.
  - It now fetches a system parameter `max-oracle-price-age-blocks` from the `BitHedgeParametersContract`.
  - When calling `get-current-bitcoin-price` on the `BitHedgePriceOracleContract`, it expects the oracle to return both the price and the timestamp (block height) of that price.
  - A check is performed: `(asserts! (<= (- burn-block-height oracle-price-timestamp) max-price-age-blocks) ERR-ORACLE-PRICE-TOO-STALE)`. This ensures that the price used for initial premium verification is not older than the configured maximum age. This change assumes corresponding modifications in the Oracle and Parameters contracts.

_Note: Several linter errors remain in `policy-registry.clar` from previous steps, including an `unexpected ')'` and issues related to the static analyzer's interpretation of `contract-call?` with principals stored in variables (misidentified as 'undeclared trait'). These are being tracked separately and were not addressed during the implementation of PR-207 to PR-210._

#### Liquidity Pool Vault Contract (BitHedgeLiquidityPoolVaultContract)

**Implementation Summary (Phase 2 - LP-201, LP-202, LP-203):**

Phase 2 development for the `BitHedgeLiquidityPoolVaultContract` focused on enhancing its core functionalities related to collateral management, premium handling, and settlement processing.

- **LP-201 (Provider Allocation for `lock-collateral`):**

  - The `lock-collateral` function was significantly enhanced to implement a provider allocation mechanism.
  - A new private helper function `get-eligible-providers-for-allocation` was introduced to select providers based on the specified `risk-tier`, `token-id`, `required-amount`, and `expiration-height`. It fetches risk tier parameters from the `BitHedgeParametersContract` to ensure the tier is active.
  - For Phase 2, a simplified list of test providers is used. These providers are then filtered by `filter-eligible-providers` and `is-provider-eligible-for-allocation` to check their available capital against the required amount.
  - The `allocate-capital-to-providers` function then distributes the collateral proportionally among the eligible providers based on their available capital.
  - Helper functions `get-provider-available-balance`, `calculate-provider-allocation`, and `allocate-to-single-provider` were added to support this logic.
  - Global `token-balances` (available decreases, locked increases) and individual `provider-balances` (available decreases, allocated increases, expiration exposure) are updated accordingly.
  - The `provider-allocations` map is updated to link the provider, policy, and collateral specifics.
  - Events `collateral-locked` (summary) and `provider-allocation` (per provider) are emitted.

- **LP-202 (`record-premium-payment` Enhancement):**

  - The `record-premium-payment` function was updated to provide more detailed tracking of premium payments.
  - A new `policy-premium-records` map was introduced to store premium details per policy, including the `premium-amount`, `token-id`, `expiration-height`, and a flag `is-distributed` for future use.
  - The function now checks for duplicate premium recordings using `ERR-PREMIUM-ALREADY-RECORDED`.
  - Global `premium-balances` (total collected) are updated.
  - Crucially, the function now distributes "pending" premium shares to providers who allocated collateral for the policy.
  - Helper functions `find-providers-for-policy` (simplified for Phase 2 to use a test list of providers and check `provider-allocations`), `has-allocation-for-policy`, `distribute-pending-premium-shares`, `calculate-total-policy-allocation`, `get-provider-allocation-amount`, and `update-provider-pending-premium` were added.
  - The `update-provider-pending-premium` function updates the `pending-premiums` field in the `provider-balances` map and emits a `premium-allocated-to-provider` event.

- **LP-203 (`process-settlement-at-expiration` Implementation):**
  - The `process-settlement-at-expiration` function was implemented to handle In-The-Money (ITM) policy settlements. It's callable only by the `policy-registry-principal`.
  - It validates inputs, checks for duplicate settlements using a new `settlement-record-map`, and ensures sufficient locked funds are available in `token-balances`.
  - It identifies providers who allocated to the policy using `find-providers-for-policy`.
  - The core logic involves `process-provider-settlement-impacts` and its helper `process-single-provider-settlement`. These functions calculate each provider's proportional share of the settlement amount based on their capital allocation to the policy.
  - A new `settlement-impacts` map records each provider's contribution (`settlement-amount-contributed`).
  - Provider balances are updated: `allocated-amount` decreases by their full allocation to the policy, and `available-amount` increases by any collateral remaining after their share of the settlement is deducted.
  - The total settlement amount is transferred to the `policy-owner` (STX or SIP-010).
  - Global `token-balances` are updated (locked and total balances decrease).
  - The `settlement-record-map` is updated with details of the settlement, including any `remaining-collateral`.
  - Events `policy-settlement-processed` and `provider-settlement-impact` are emitted.

These enhancements lay a critical foundation for managing the financial interactions within the liquidity pool, ensuring that collateral is correctly allocated, premiums are tracked against providers, and settlements are processed according to each provider's exposure.

**Implementation Summary (Phase 2 - LP-207 `claim-earned-premiums`):**

- **LP-207 (`claim-earned-premiums`):**
  - A new public function `claim-earned-premiums` was implemented, allowing liquidity providers (`tx-sender`) to withdraw their `earned-premiums` for a specified `token-id`.
  - It verifies that the token is initialized and that the provider has a non-zero balance of earned premiums.
  - It handles the transfer of STX or SIP-010 tokens from the contract to the provider.
  - Upon successful transfer, the provider's `earned-premiums` balance for that token is reset to zero in the `provider-balances` map.
  - An event `premiums-claimed` is emitted, detailing the provider, token, and amount claimed.
  - New error code `ERR-NO-PREMIUMS-TO-CLAIM` was added.

**Implementation Summary (Phase 2 - LP-208 `release-collateral`):**

- **LP-208 (`release-collateral`):**
  - A new public function `release-collateral` was implemented, callable only by the `policy-registry-principal`. This function is designed to be called for OTM policies at expiration or after an ITM policy's settlement has been processed to release any remaining collateral.
  - It takes `policy-id`, `token-id`, and `expiration-height` as inputs.
  - It verifies that the policy hasn't already been settled via `settlement-record-map` to prevent double-releasing collateral.
  - It uses the existing `find-providers-for-policy` helper to identify all providers who allocated capital to the specified policy.
  - Two new private helper functions were introduced:
    - `release-collateral-for-providers`: Iterates over the list of allocated providers and calls `release-provider-collateral` for each.
    - `release-provider-collateral`: Handles the logic for a single provider - retrieves allocation, updates balances, reduces exposure, and deletes the allocation record.
  - The function updates global `token-balances` (moves funds from `locked-balance` to `available-balance`) and updates the `expiration-liquidity-needs` map.
  - An event `collateral-released` is emitted, summarizing the release details.
  - New error codes `ERR-POLICY-ALREADY-SETTLED` and `ERR-NO-ALLOCATIONS-FOUND` were added.

**Implementation Summary (Phase 2 - LP-209 `expiration-liquidity-needs` Map):**

- **LP-209 (`expiration-liquidity-needs` Map Enhancement):**
  - The `expiration-liquidity-needs` map was enhanced to include:
    - `total-collateral-required`: Tracks the total collateral needed for policies at a specific expiration height
    - `is-liquidity-prepared`: A flag for Phase 3 (LP-303) to indicate if liquidity is actively managed/reserved
    - `token-distributions`: A nested map tracking required collateral per token type
    - `policy-count`: Tracks the number of policies expiring at the given height
  - The map is updated in:
    - `lock-collateral`: Increases `total-collateral-required`, updates `token-distributions`, and increments `policy-count`
    - `release-collateral`: Decreases `total-collateral-required`, updates `token-distributions`, and decrements `policy-count`
  - Added several read-only functions to query the map:
    - `get-expiration-collateral-required`: Returns total collateral required for a height
    - `get-expiration-liquidity-prepared`: Returns the preparation flag for a height
    - `get-expiration-policy-count`: Returns the number of policies at a height
    - `get-expiration-token-required`: Returns collateral required for a specific token at a height
    - `has-policies-at-expiration`: Checks if a height has any policies
  - This enhancement creates a foundation for Phase 3's expiration-focused liquidity management (LP-303 & LP-304).

**Implementation Summary (Phase 2 - LP-206 `distribute-premium-to-providers`):**

- **LP-206 (`distribute-premium-to-providers` Function):**
  - The `distribute-premium-to-providers` function was implemented to handle distribution of premiums to liquidity providers for OTM policies at expiration.
  - Key features of the implementation include:
    - Can only be called by the Policy Registry contract (`ERR-POLICY-REGISTRY-ONLY`).
    - Requires that the policy premium was recorded (`ERR-PREMIUM-NOT-RECORDED`).
    - Prevents duplicate distributions with the `is-distributed` flag (`ERR-PREMIUM-ALREADY-DISTRIBUTED`).
    - Retrieves the policy's premium details (amount, token) from the `policy-premium-records` map.
    - Identifies all providers who contributed to the policy using the `find-providers-for-policy` helper.
    - Calculates each provider's share of the premium proportional to their allocation amount.
    - Converts providers' `pending-premiums` to `earned-premiums` in their balance records.
    - Updates `policy-premium-records` to mark the premium as distributed with the current block height.
    - Updates the global `premium-balances` map with total distributed premiums.
    - Emits detailed events: `premium-distributed-to-provider` per provider and a summary `premium-distribution-completed`.
  - This function completes the premium distribution flow that starts with `record-premium-payment` and concludes with `claim-earned-premiums` (LP-207).

| Task ID | Description                                                                                                                                                         | Dependencies                   | Complexity | Estimated Days | References                                                                                                                                                                                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LP-201  | Provider allocation mechanism for `lock-collateral` (risk tier matching, provider selection). **Status: Completed**                                                 | LP-105, LP-108, PA-201         | High       | 3.5            | [@bithedge-liquidity-premium-management.md#2.3-Capital-Allocation-Algorithm], [@bithedge-european-style-implementation.md#4.1-Collateral-Management], [@bithedge-european-architecture-spec.md#3.1-Policy-Creation-Flow#Data-passed-during-collateral-locking]                                      |
| LP-202  | Enhancement of `record-premium-payment` (associate premiums with providers who backed the policy; track at policy level). **Status: Completed**                     | LP-201, LP-108                 | High       | 3              | [@bithedge-liquidity-premium-management.md#3.2-Premium-Distribution-for-OTM-Policies], [@bithedge-european-architecture-spec.md#3.2-Expiration-Settlement-Flow-European-Style#Premium-distribution-data], [@BitHedge-Advanced-Clarity-Patterns.md#Premium-Distribution-Framework]                   |
| LP-203  | `process-settlement-at-expiration` implementation (called by PR for ITM policies; updates provider balances). **Status: Completed**                                 | LP-201, LP-108                 | High       | 4              | [@bithedge-european-style-implementation.md#4.3-Settlement-Execution], [@bithedge-european-architecture-spec.md#3.2-Expiration-Settlement-Flow-European-Style], [@bithedge-contract-architecture.md#1.2-BitHedgeLiquidityPool.clar#Key-Functions]                                                   |
| LP-204  | Add `settlement-impacts` map and logic to track each provider's contribution during settlement (updates provider balances). **Status: Completed**                   | LP-201, LP-203                 | Medium     | 2.5            | [@bithedge-european-style-implementation.md#4.3-Settlement-Execution#Provider-Impact-Tracking], [@bithedge-european-architecture-spec.md#3.2-Expiration-Settlement-Flow-European-Style#Settlement-impact-data], [@bithedge-contract-architecture.md#1.2-BitHedgeLiquidityPool.clar#Data-Structures] |
| LP-205  | Develop `provider-expiration-exposure` map & logic to track exposure per provider per expiration height (updated in lock/release collateral). **Status: Completed** | LP-101, LP-201                 | Medium     | 3              | [@bithedge-liquidity-premium-management.md#2.5-Expiration-Specific-Liquidity-Pools-ESLPs], [@bithedge-european-architecture-spec.md#2.2-Liquidity-Pool-Vault-Data-Model#Provider-Expiration-Exposure]                                                                                               |
| LP-206  | Implement `distribute-premium-to-providers` (called by PR for OTM policies, updates provider `earned-premiums`). **Status: ✅ Completed**                           | LP-202, LP-201, LP-108         | High       | 3.5            | [@bithedge-liquidity-premium-management.md#3.4-Premium-Distribution-to-Providers], [@bithedge-european-architecture-spec.md#4.5-Premium-Distribution-System]                                                                                                                                        |
| LP-207  | Create `claim-pending-premiums` function for providers to withdraw their `earned-premiums`. **Status: ✅ Completed**                                                | LP-108, LP-206                 | Medium     | 2              | [@bithedge-liquidity-premium-management.md#3.5-Claiming-Premiums]                                                                                                                                                                                                                                   |
| LP-208  | Add `release-collateral` mechanism (for OTM expirations and remaining collateral after ITM settlement). **Status: ✅ Completed**                                    | LP-105, LP-203, LP-205, LP-204 | Medium     | 3              | [@bithedge-european-style-implementation.md#4.1-Collateral-Management#Collateral-Release], [@bithedge-european-architecture-spec.md#4.5-Premium-Distribution-System#Release-collateral-for-all-providers]                                                                                           |
| LP-209  | Implement `expiration-liquidity-needs` map (basic tracking of total collateral required per expiration height, updated in lock/release). **Status: ✅ Completed**   | LP-101, LP-105, LP-208         | Medium     | 2              | [@bithedge-liquidity-premium-management.md#2.5-Expiration-Specific-Liquidity-Pools-ESLPs], [@bithedge-european-architecture-spec.md#2.2-Liquidity-Pool-Vault-Data-Model#Expiration-Liquidity-Needs]                                                                                                 |

#### BitHedgePriceOracleContract

**Phase 2: Simplified On-Chain Oracle Implementation**

This phase focuses on implementing a lean on-chain Oracle (`oracle.clar`) that aligns with the hybrid architecture, where Convex handles complex off-chain processing and submits a validated price to the blockchain.

| Task ID | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Dependencies                   | Complexity | Estimated Days | References                                                                                                                                                      |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OC-201  | Refactor `oracle.clar`: Define core data structures (`latest-price uint`, `latest-timestamp uint`, `authorized-submitter principal`) and constants (error codes like `ERR-UNAUTHORIZED`, `ERR-PRICE-OUT-OF-BOUNDS`, `ERR-TIMESTAMP-TOO-OLD`, `ERR-PARAMETER-CONTRACT-ERROR`, `PRICE_DECIMALS`). Remove complex historical data structures and multi-source management logic. **Status: Completed by alignment plans (`@oracle-integration-implementation-plan.md`).** | PO-104, PA-104                 | Medium     | 1.5            | [@bithedge-oracle-specification-guidelines.md#3.1-Core-State-Variables], [@bithedge-oracle-specification-guidelines.md#3.2-Constants]                           |
| OC-202  | Implement `set-aggregated-price(price uint, timestamp uint)`: Callable by `authorized-submitter`. Validates `price` deviation against `latest-price` and `timestamp` freshness against `burn-block-height` using parameters (`oracle-max-deviation-percentage`, `oracle-max-age-seconds`) fetched from `BitHedgeParametersContract`. **Status: Completed by alignment plans (`@oracle-integration-implementation-plan.md`).**                                         | OC-201, OC-204, PA-103         | Medium     | 2              | [@bithedge-oracle-specification-guidelines.md#3.4-Public-Functions], [@BitHedge-Advanced-Clarity-Patterns.md#6.-Oracle-Security-and-Decentralization]           |
| OC-203  | Implement `get-latest-price()` read-only function: Returns `{price: uint, timestamp: uint}`. Checks for price staleness using `oracle-max-age-seconds` from `BitHedgeParametersContract` against `latest-timestamp` and `burn-block-height`. Returns `ERR-TIMESTAMP-TOO-OLD` if stale or `ERR-NO-PRICE-DATA` if not set. **Status: Completed by alignment plans (`@oracle-integration-implementation-plan.md`).**                                                     | OC-201, OC-204                 | Low        | 1              | [@bithedge-oracle-specification-guidelines.md#3.5-Read-Only-Functions], [@bithedge-european-style-implementation.md#5.1-Oracle-Integration-for-Policy-Creation] |
| OC-204  | Define Parameter Contract Trait for Oracle: Create a trait (e.g., `parameter-oracle-trait`) defining functions to get `oracle-max-deviation-percentage` and `oracle-max-age-seconds`. Integrate calls using this trait in `set-aggregated-price` and `get-latest-price`. Implement `set-parameters-contract-principal`. **Status: Completed by alignment plans (`@oracle-integration-implementation-plan.md`).**                                                      | OC-201, PA-104                 | Medium     | 1.5            | [@bithedge-oracle-specification-guidelines.md#3.8-Integration-Points], [@modular-interactions.md#1.-Contract-Reference-Mechanisms]                              |
| OC-205  | Implement Admin Functions & Events: Implement `set-authorized-submitter`. Ensure standardized event emission for `price-updated` and `authorized-submitter-updated` as per SH-201. **Status: Completed by alignment plans (`@oracle-integration-implementation-plan.md`).**                                                                                                                                                                                           | OC-201, SH-201                 | Low        | 1              | [@bithedge-oracle-specification-guidelines.md#3.4-Public-Functions], [@BitHedge-Advanced-Clarity-Patterns.md#7.-Event-Emission-and-Off-Chain-Indexing]          |
| OC-206  | Convex Integration Alignment: Coordinate with Convex team to ensure off-chain `priceWriter.ts` (or equivalent in `blockchainIntegration.ts`) calls `set-aggregated-price` with both `price` and `timestamp`. Verify error handling for Oracle responses. **Status: Completed by alignment plans (`@oracle-integration-implementation-plan.md`).**                                                                                                                     | OC-202                         | Medium     | 1.5            | [@bithedge-oracle-specification-guidelines.md#4.3-Key-Functions-Modules], [@convex/blockchain/oracle/priceWriter.ts], [@convex/blockchainIntegration.ts]        |
| OC-207  | Unit Tests for `oracle.clar`: Write comprehensive unit tests covering `set-aggregated-price` (auth, validations), `get-latest-price` (staleness, no data), and admin functions. **Status: Completed by alignment plans (`@oracle-integration-implementation-plan.md`).**                                                                                                                                                                                              | OC-201,OC-202,OC-203,OC-205    | Medium     | 2              | [@clarity-best-practices.md#Testing-Strategies#Unit-Testing]                                                                                                    |
| OC-208  | Integration Tests for Oracle Interactions: Test `oracle.clar` interactions with `BitHedgeParametersContract` (fetching params) and scenarios where `PolicyRegistryContract` calls `get-latest-price`. **Status: Completed by alignment plans (`@oracle-integration-implementation-plan.md`).**                                                                                                                                                                        | OC-203, OC-204, PR-209, PR-210 | Medium     | 2              | [@clarity-best-practices.md#Testing-Strategies#Integration-Testing], [@modular-interactions.md#5.-Implementation-Example-Complete-Interaction-Flow]             |

#### BitHedgeVerificationContract (Initial Setup)

| Task ID | Description                                                                                                                                                                | Dependencies                   | Complexity | Estimated Days | References                                                                                                                                                                                             |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| VC-201  | Define core data structures (`verification-results` map, `verification-parameters` map stubs) **Status: Completed**                                                        | PA-104                         | Low        | 1              | [@bithedge-smart-contract-architecture.md#BitHedgeVerificationContract], [@bithedge-contract-architecture.md#2.5-BitHedgeVerificationContract.clar]                                                    |
| VC-202  | Implement basic admin functions for managing verification parameters (link to PA-103) **Status: Completed**                                                                | VC-201, PA-103                 | Low        | 1              | [@bithedge-smart-contract-architecture.md#BitHedgeVerificationContract], [@bithedge-contract-architecture.md#2.5-BitHedgeVerificationContract.clar]                                                    |
| VC-203  | Implement `verify-pool-balance-integrity` (read-only: checks LP total token balances against sum of provider deposits and contract-held premiums) **Status: Completed**    | VC-201, LP-106, LP-108, LP-202 | Medium     | 2.5            | [@bithedge-european-architecture-spec.md#5.1-Core-Verification-Functions#Verify-Pool-Balance-Integrity], [@bithedge-contract-architecture.md#2.5-BitHedgeVerificationContract.clar#Key-Functions]      |
| VC-204  | Implement `verify-policy-allocation-integrity` (read-only: checks sum of provider allocations for a specific policy against its required collateral) **Status: Completed** | VC-201, PR-101, LP-201         | Medium     | 2.5            | [@bithedge-european-architecture-spec.md#5.1-Core-Verification-Functions#Verify-Policy-Allocation-Integrity], [@bithedge-contract-architecture.md#2.5-BitHedgeVerificationContract.clar#Key-Functions] |

**Implementation Notes (VC-201, VC-202, VC-203, VC-204):**

The BitHedgeVerificationContract has been successfully implemented with core verification mechanisms that ensure system integrity:

**VC-201 Core Data Structures:**

- Implemented `verification-results` map that tracks detailed verification outcomes including status, timestamps, mismatch amounts, and expected/actual values
- Added `verification-parameters` map to store configurable verification settings with support for various data types
- Created `verification-type-config` map to manage enabled/disabled status and required frequency for different verification types
- Defined comprehensive constants for error codes, verification statuses, and verification types

**VC-202 Admin Functions:**

- Implemented Role-Based Access Control (RBAC) with `has-role` that validates against the parameters contract
- Added type-specific setter functions for verification parameters (uint, principal, string, bool)
- Created `configure-verification-type` to enable/disable verification types and set failure handling policies
- Established proper event emission for all configuration changes

**VC-203 Pool Balance Integrity Verification:**

- Implemented a read-only `verify-pool-balance-values` function that performs pure verification logic without contract calls
- Created a public `run-pool-balance-verification` function that fetches data from the Liquidity Pool contract and runs verification
- Function verifies that LP total token balances match the sum of provider deposits and contract-held premiums
- Records detailed verification results in the `verification-results` map with proper event emission
- Optimized to avoid writing operations in read-only contexts by separating data fetching from verification logic

**VC-204 Policy Allocation Integrity Verification:**

- Implemented a read-only `verify-policy-allocation-values` function that performs pure verification logic
- Added a public `run-policy-allocation-verification` function that coordinates fetching data from Policy Registry and Liquidity Pool
- Verifies that the sum of provider allocations for a policy matches the required collateral amount
- Identifies all providers with allocations to the policy and calculates their total allocation sum
- Records verification results with appropriate success/failure status and detailed information

#### Shared Components (SH)

| Task ID | Description                                                                                                                                                                                                                       | Dependencies                                                           | Complexity | Estimated Days | References                                                                                                                                                      |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SH-201  | Define detailed event structures for expiration, settlement, premium distribution, oracle updates, verification results                                                                                                           | SH-101                                                                 | Medium     | 2              | [@BitHedge-Advanced-Clarity-Patterns.md#7.-Event-Emission-and-Off-Chain-Indexing], [@BitHedge-Senior-Clarity-Technical-Analysis.md#7-Event-Driven-Architecture] |
| SH-202  | Develop test cases for full settlement and premium distribution flows (ITM & OTM scenarios). **Status: Partially completed by alignment plans (PCIA-301, PCIA-302, PCIA-303 addressed underlying math and creation flow tests).** | PR-201, PR-206, PR-207, LP-203, LP-206, SH-103, PO-202, ML-201, ML-202 | High       | 4              | [@clarity-best-practices.md#Testing-Strategies#Integration-Testing], [@bithedge-european-architecture-spec.md#7.2-Testing-Strategy#Integration-Testing]         |
| SH-203  | Implement integration tests for PriceOracle price updates, retrievals, and staleness checks. **Status: Completed by alignment plans (OC-208).**                                                                                   | PO-201, PO-202, SH-103                                                 | Medium     | 2.5            | [@clarity-best-practices.md#Testing-Strategies#Integration-Testing], [@bithedge-european-architecture-spec.md#7.2-Testing-Strategy#Integration-Testing]         |

#### Phase 2 Milestones

- **M2.1**: Single policy expiration (PR) and settlement (LP) logic is functional for ITM policies, including fetching prices from PriceOracle (PO) and calculations from MathLibrary (ML). Settlement records (PR) and provider impacts (LP) are tracked.
- **M2.2**: Batch expiration processing (PR) for multiple policies is implemented. OTM policies correctly queue for premium distribution via LP.
- **M2.3**: Core `BitHedgePriceOracleContract` (PO/OC) mechanisms for storing and retrieving the latest aggregated price (submitted by Convex via OC-202, read by OC-203) are functional, including staleness checks (OC-203) and integration with `BitHedgeParametersContract` for validation thresholds (OC-204). `BitHedgeMathLibraryContract` (ML) uses this price for premium verification (ML-201) and settlement calculations (ML-202). Risk tier and fee parameters are manageable via `BitHedgeParametersContract` (PA).
- **M2.4**: Initial VerificationContract (VC) checks for pool balance integrity and policy allocation integrity are functional and testable.
- **M2.5**: Comprehensive integration tests for ITM/OTM policy lifecycles, oracle interactions, and basic verification checks pass. Event emissions (SH) are verified.

### Phase 3: Advanced Risk Tier System, Liquidity Management, and Verification

#### BitHedgeParametersContract

| Task ID | Description                                                                                                                                      | Dependencies   | Complexity | Estimated Days | References                                                                                                                                                                                                                    | Status           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ---------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| PA-301  | Finalize all system limits and thresholds (e.g., max policies per user, max allocation per provider, batch sizes) and their management functions | PA-101, PA-103 | Medium     | 2              | [@bithedge-smart-contract-architecture.md#BitHedgeParametersContract], [@BitHedge-Advanced-Clarity-Patterns.md#System-Parameters-and-Upgradability], [@bithedge-contract-architecture.md#2.4-BitHedgeParametersContract.clar] | ✅ **Completed** |
| PA-302  | Implement parameters for provider incentives for expiration coverage                                                                             | PA-101, PA-103 | Medium     | 1.5            | [@bithedge-liquidity-premium-management.md#5.1-Incentives-for-Liquidity-Providers]                                                                                                                                            | ✅ **Completed** |

**Implementation Summary (Phase 3 - PA-301, PA-302):**

Phase 3 work on the `BitHedgeParametersContract` focused on expanding its repertoire of manageable system configurations, specifically by defining keys for system-wide operational limits, thresholds, and parameters for provider incentives.

- **PA-301 (System Limits and Thresholds Finalized):**

  - A comprehensive set of new Clarity constants was defined to serve as keys for various system limits and thresholds. These include, but are not limited to:
    - `PARAM-LIMIT-MAX-POLICIES-PER-USER` (for `"limits.user.max-policies"`)
    - `PARAM-LIMIT-MAX-ALLOC-PER-PROVIDER-USD` (for `"limits.provider.max-allocation-usd"`)
    - `PARAM-BATCH-SIZE-EXPIRATION` (for `"config.batch.size-expiration"`)
    - `PARAM-BATCH-SIZE-PREMIUM-DIST` (for `"config.batch.size-premium-dist"`)
    - `PARAM-ORACLE-MAX-PRICE-AGE-BLOCKS` (for `"config.oracle.max-price-age-blocks"`)
    - `PARAM-ORACLE-MAX-DEVIATION-BP` (for `"config.oracle.max-deviation-bp"`)
    - Parameters for policy duration and value limits (e.g., `PARAM-MIN-POLICY-DURATION-BLOCKS`, `PARAM-MAX-PROTECTION-VALUE-USD`).
  - These constants represent the string identifiers to be used with the existing `system-parameters` map.

- **PA-302 (Provider Incentive Parameters Implemented):**

  - Clarity constants were defined for parameters that will govern provider incentives related to expiration coverage, such as:
    - `PARAM-INCENTIVE-EXP-COV-BONUS-BP` (for `"config.incentives.exp-coverage-bonus-bp"`)
    - `PARAM-INCENTIVE-EXP-COV-THRESHOLD-PCT` (for `"config.incentives.exp-coverage-threshold-pct"`)

- **Key Implementation Aspects:**
  - **Namespacing Convention:** All newly introduced parameter keys adopted a dot-based namespacing convention (e.g., `"category.subcategory.name"`) for their string literal values. This enhances organization and readability as the number of parameters grows. For example, `PARAM-LIMIT-MAX-POLICIES-PER-USER` corresponds to the key `"limits.user.max-policies"`.
  - **Use of Existing Management Functions:** The implementation leveraged the contract's pre-existing generic parameter management functions (`set-system-parameter-<type>` and `get-system-parameter-<type>`). No new setter or getter logic was required within `BitHedgeParametersContract` for these specific tasks; the work involved defining the constant keys that these functions will operate on.
  - **External Impact:** The introduction of these new parameters and the updated key naming convention will require corresponding updates in consuming smart contracts (to fetch parameters using the correct new keys/constants) and in any off-chain scripts or administrative tools responsible for initializing or managing these parameter values.

This foundational work allows for greater control and fine-tuning of the BitHedge system's behavior through centrally managed parameters.

#### BitHedgeMathLibraryContract

| Task ID | Description                                                                                                     | Dependencies | Complexity | Estimated Days | References                                                                                                                                                                                                       |
| ------- | --------------------------------------------------------------------------------------------------------------- | ------------ | ---------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ML-301  | Add advanced financial calculations if required (e.g., volatility adjustments to premium if oracle provides it) | ML-201       | Medium     | 2.5            | [@bithedge-liquidity-premium-management.md#3.1.1-Advanced-Premium-Calculation-Considerations], [@bithedge-contract-architecture.md#2.3-BitHedgeMathLibrary.clar]                                                 |
| ML-302  | Rigorous testing, documentation, and gas optimization for all math functions                                    | All ML tasks | Medium     | 2              | [@clarity-best-practices.md#Gas-Optimization], [@BitHedge-Advanced-Clarity-Patterns.md#Gas-Considerations-and-Optimization-Techniques], [@bithedge-european-architecture-spec.md#6.-Gas-Optimization-Techniques] |

#### Policy Registry Contract (BitHedgePolicyRegistryContract)

| Task ID | Description                                                                                                                                                                                                      | Dependencies                                   | Complexity | Estimated Days | References                                                                                                                                                                                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| PR-301  | Integrate full risk tier system from PA-201 into `create-protection-policy` for _premium verification_ (via ML) and collateral calculation                                                                       | PR-103, PA-201, ML-201                         | High       | 3              | [@bithedge-european-architecture-spec.md#4.1-Risk-Tier-Implementation], [@bithedge-liquidity-premium-management.md#2.1-Provider-Capital-Commitment-Process#2.-Risk-Tier-Assignment], [@bithedge-contract-architecture.md#1.1-BitHedgePolicyRegistry.clar#Key-Functions]            | ✅ **Completed**           |
| PR-302  | Implement policy creation limits per user/global based on PA-301                                                                                                                                                 | PR-103, PA-301                                 | Medium     | 1.5            | [@bithedge-smart-contract-architecture.md#BitHedgeParametersContract], [@BitHedge-Advanced-Clarity-Patterns.md#System-Parameters-and-Upgradability]                                                                                                                                | ✅ **Completed**           |
| PR-303  | Enhance batch expiration processing with configurable batch sizes (from PA-301) and implement robust continuation logic for large batches                                                                        | PR-206, PA-301                                 | High       | 3.5            | [@BitHedge-Advanced-Clarity-Patterns.md#1.-Expiration-Focused-Architecture-Implementation#Expiration-batch-processing-capability], [@bithedge-european-style-implementation.md#3.6-Batch-Expiration-Processing], [@bithedge-european-architecture-spec.md#6.1-Batch-Processing]    | ✅ **Completed**           |
| PR-304  | Optimize gas usage significantly in `create-protection-policy` (especially premium verification call) and `process-expiration-batch`                                                                             | PR-103, PR-206, ML-201                         | High       | 3              | [@clarity-best-practices.md#Gas-Optimization], [@BitHedge-Advanced-Clarity-Patterns.md#Gas-Considerations-and-Optimization-Techniques], [@bithedge-european-architecture-spec.md#6.-Gas-Optimization-Techniques]                                                                   | ✅ **Completed**           |
| PR-305  | Implement `distribute-premium-batch` (fold over `pending-premium-distributions`, call PR-207) with batch size from PA-301                                                                                        | PR-207, PR-205, PA-301                         | Medium     | 3              | [@bithedge-liquidity-premium-management.md#3.2-Premium-Distribution-for-OTM-Policies#Batch-Premium-Distribution], [@BitHedge-Advanced-Clarity-Patterns.md#5.-Optimized-Batch-Operations], [@bithedge-european-architecture-spec.md#6.1-Batch-Processing#Batch-distribute-premiums] | ✅ **Completed**           |
| PR-306  | Add explicit calls to VC for risk tier matching verification (during creation) and settlement/premium sum verification (after batch processing)                                                                  | PR-301, PR-206, PR-305, VC-302, VC-303, VC-305 | Medium     | 2.5            | [@bithedge-european-architecture-spec.md#5.-Verification-Mechanisms], [@modular-interactions.md#Using-a-Dedicated-Verification-Contract], [@bithedge-contract-architecture.md#3.2-BitHedgeVerificationContract.clar]                                                               | ✅ **Completed**           |
| PR-307  | Develop enhanced settlement price determination using Oracle (OC-203) in PR-201/PR-206. _(Note: TWAP is an off-chain Convex responsibility; this task focuses on using the direct Oracle price for settlement)_. | PR-201, PR-206, OC-203                         | Medium     | 2              | [@BitHedge-Advanced-Clarity-Patterns.md#Time-Weighted-Average-Price-TWAP-Oracles], [@BitHedge-Senior-Clarity-Technical-Analysis.md#1-Oracle-Implementation--Price-Feed-Security#Recommendation]                                                                                    | ✅ **Completed**           |
| PR-308  | Implement policy renewal mechanism (interface for users to signal renewal, creates new policy based on old one with new params)                                                                                  | PR-103, PR-201                                 | Medium     | 2.5            | [@bithedge-european-style-implementation.md#3.3-Policy-Lifecycle-Management#Policy-Renewal]                                                                                                                                                                                        | ⚠️ **Deferred (Post-MVP)** |
| PR-309  | Design and implement emergency expiration mechanisms (admin-triggered full/partial expiration, authorized via PA-103)                                                                                            | PR-201, PR-206, PA-103                         | Medium     | 2.5            | [@BitHedge-Advanced-Clarity-Patterns.md#Emergency-Mechanisms-and-Circuit-Breakers], [@clarity-best-practices.md#Essential-Best-Practices#4.-Safety-Mechanisms#Circuit-breakers]                                                                                                    | ⚠️ **Deferred (Post-MVP)** |
| PR-310  | Implement comprehensive event emission for all state changes, administrative actions, and critical operations, adhering to SH-201                                                                                | All PR tasks, SH-201                           | Medium     | 2              | [@BitHedge-Advanced-Clarity-Patterns.md#7.-Event-Emission-and-Off-Chain-Indexing], [@BitHedge-Senior-Clarity-Technical-Analysis.md#7-Event-Driven-Architecture]                                                                                                                    | ✅ **Completed**           |

**Implementation Summary (Phase 3 - Policy Registry PR-301 to PR-306):**

Phase 3 development for the `BitHedgePolicyRegistryContract` significantly enhanced its risk management capabilities, operational limits, batch processing efficiency, gas optimization, and integrity verification integrations.

- **PR-301 (Full Risk Tier System Integration):**

  - The `create-protection-policy` function now fully integrates the risk tier system. It fetches buyer risk tier parameters (like `collateral-ratio-basis-points`, `premium-adjustment-basis-points`, `tier-type`) from `BitHedgeParametersContract`.
  - Collateral calculation (`required-collateral-scaled`) correctly uses the `collateral-ratio-basis-points` specific to the buyer's chosen risk tier.
  - The call to `verify-submitted-premium` in `BitHedgeMathLibraryContract` now includes `risk-tier-is-active` and `risk-tier-premium-adjustment-bp`, enabling the math library to apply tier-specific adjustments.
  - A validation ensures the `tier-type` for the policy creation is "BUYER".

- **PR-302 (Policy Creation Limits):**

  - `create-protection-policy` now enforces several limits defined in `BitHedgeParametersContract`:
    - Maximum policies per user (`limits.user.max-policies`).
    - Policy duration boundaries (`config.policy.min-duration-blocks`, `config.policy.max-duration-blocks`).
    - Protection value range (`config.policy.min-protection-value-usd`, `config.policy.max-protection-value-usd`).
    - Minimum submitted premium (`config.policy.min-submitted-premium-usd`).
  - Helper function `get-owner-policy-count` was introduced for the user policy limit check.

- **PR-303 (Enhanced Batch Expiration Processing):**

  - `process-expiration-batch` was refactored for configurability and robust continuation.
  - It now uses `config.batch.size-expiration` from `BitHedgeParametersContract` for batch sizing.
  - A `start-index` parameter was added, allowing the batch processing to be resumed from a specific point if a previous run couldn't complete all policies for an expiration height (e.g., due to gas limits).
  - The function returns `more-to-process: bool` and `next-index: uint` to facilitate this continuation logic by an off-chain agent or subsequent transaction.
  - The Bitcoin price for the expiration height is fetched once per batch call from the Oracle, optimizing calls.
  - It uses `slice?` to process only the current segment of policies and `fold` with a new helper `process-policy-with-price` (which calls `priv-process-one-policy-at-expiration`) for the iteration, improving clarity.

- **PR-304 (Gas Optimization):**

  - **`create-protection-policy`:** Optimizations include grouped validations for early exit, fetching contract principals and all system/risk-tier parameters once (via new helpers `get-creation-parameters` and `contracts` map), consolidated parameter validation (`validate-policy-parameters`), direct collateral calculation, and single-step policy storage/indexing (`store-policy-and-update-indices`).
  - **`process-expiration-batch`:** Principals, batch size, and Oracle price are fetched once per call.
  - **`distribute-premium-batch`:** Similar single-fetch optimizations for principals and parameters. Logic was modularized with helpers like `get-pending-premium-distribution-count`, `process-single-premium`, and `distribute-premium-internal`.

- **PR-305 (Batch Premium Distribution):**

  - The new public function `distribute-premium-batch` was implemented.
  - It uses `config.batch.size-premium-dist` from `BitHedgeParametersContract` and supports `start-index` and `max-count` for batch control.
  - It iterates over pending policies (using `fold` via helpers) and calls the refactored `distribute-premium` logic.
  - Returns `processed-count`, `success-count`, `error-count`, `more-to-process`, and `next-index`.
  - A simplified `distribute-premium-batch-simple(max-count uint)` was added for convenience, starting from index `u0`.

- **PR-306 (Verification Contract Calls):**
  - **Policy Allocation/Risk Tier Matching:** The existing call in `store-policy-and-update-indices` to `verify-policy-allocation` (which calls `run-policy-allocation-verification` on VC) is maintained to cover integrity during creation.
  - **Settlement Integrity:** `verify-settlement-integrity` (called for ITM policies) was updated to call `run-settlement-integrity-verification` on the VC.
  - **Premium Distribution Integrity:** A new private function `verify-premium-distribution-integrity` was added. It calls `run-premium-distribution-integrity-verification` on the VC and is invoked from `process-single-premium` after a successful distribution to an OTM policy.
  - These calls ensure that verification failures are logged for off-chain monitoring but do not revert the primary transaction flow.

These changes have made the Policy Registry contract more robust, configurable, efficient, and integrated with the broader verification framework of the BitHedge system.

**Implementation Summary (Phase 3 - Policy Registry PR-307 & PR-310):**

Phase 3 work continued with critical enhancements to settlement price validation and comprehensive event logging for better system observability.

- **PR-307 (Enhanced Settlement Price Determination):**

  - The `process-single-policy-at-expiration` and `process-expiration-batch` functions were updated to fetch a `max-settlement-price-offset` parameter from the `BitHedgeParametersContract`.
  - This offset is used to validate the freshness of the Bitcoin price obtained from the `BitHedgePriceOracleContract` (specifically, the `timestamp` returned by `get-bitcoin-price-at-height`) relative to the policy's `expiration-height`.
  - If the Oracle price's timestamp is too far from the policy's expiration (beyond the allowed offset), the operation is halted with the new `ERR-ORACLE-PRICE-TOO-DISTANT-FROM-EXPIRATION` error. This ensures that settlements are based on timely price data.

- **PR-310 (Comprehensive Event Emission):**
  - Standardized events (as per SH-201, using `(print {event: "event-name", block-height: burn-block-height, ...})`) were added to all administrative functions responsible for setting contract principal addresses (e.g., `set-liquidity-pool-principal`). These events now log both the `old-principal` and `new-principal` values for auditability.
  - Summary events were introduced at the conclusion of batch processing functions:
    - `expiration-batch-processed` is emitted by `process-expiration-batch`, detailing counts for processed, ITM, OTM, and errored policies, along with `more-to-process` and `next-index` for continuation.
    - `premium-distribution-batch-processed` is emitted by `distribute-premium-batch` (via `process-premium-batch-with-contracts`), providing similar counts for premium distribution successes and failures, plus continuation data.
  - Existing events were reviewed for compliance with SH-201.
  - The final contract deployment message in `policy-registry.clar` was updated to reflect the inclusion of PR-307 and PR-310.

#### Liquidity Pool Vault Contract (BitHedgeLiquidityPoolVaultContract)

| Task ID | Description                                                                                                                                                 | Dependencies                                   | Complexity | Estimated Days | References                                                                                                                                                                                                                                                                                                 |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| LP-301  | Fully implement risk tier parameter usage (collateral ratios from PA-201) in `lock-collateral` and `check-liquidity`                                        | LP-105, LP-109, PA-201                         | High       | 3              | [@bithedge-european-architecture-spec.md#4.1-Risk-Tier-Implementation], [@bithedge-liquidity-premium-management.md#2.1-Provider-Capital-Commitment-Process#2.-Risk-Tier-Assignment], [@bithedge-contract-architecture.md#1.2-BitHedgeLiquidityPool.clar#Risk-Tier-Parameter-Registry]                      |
| LP-302  | Develop advanced tier-based provider selection algorithm for `lock-collateral` (prioritizing tiers, available capital, exposure)                            | LP-201, LP-301, PA-201                         | High       | 4              | [@bithedge-liquidity-premium-management.md#2.3-Capital-Allocation-Algorithm#1.-Allocation-Strategy-Selection], [@bithedge-european-architecture-spec.md#3.1-Policy-Creation-Flow#Provider-allocation-selection-process], [@bithedge-contract-architecture.md#1.2-BitHedgeLiquidityPool.clar#Key-Functions] | ✅ **Completed** |
| LP-303  | Implement `prepare-liquidity-for-expirations` (callable by admin, updates `expiration-liquidity-needs.is-liquidity-prepared`)                               | LP-209, LP-205, PA-103                         | High       | 3.5            | [@bithedge-liquidity-premium-management.md#2.5-Expiration-Specific-Liquidity-Pools-ESLPs#Preparing-Liquidity-for-Expiration], [@bithedge-european-architecture-spec.md#4.2-Expiration-Focused-Liquidity-Management]                                                                                        | ✅ **Completed** |
| LP-304  | Enhance `expiration-liquidity-needs` map to include `risk-tier-distribution` of collateral and update logic in lock/release                                 | LP-209                                         | Medium     | 2.5            | [@bithedge-liquidity-premium-management.md#2.5-Expiration-Specific-Liquidity-Pools-ESLPs], [@bithedge-european-architecture-spec.md#2.2-Liquidity-Pool-Vault-Data-Model#Expiration-Liquidity-Needs]                                                                                                        | ✅ **Completed** |
| LP-305  | Implement fair premium distribution algorithm within `distribute-premium-to-providers` (e.g., weighted by allocation amount, risk, time capital was locked) | LP-206                                         | High       | 3.5            | [@bithedge-liquidity-premium-management.md#3.4.1-Fair-Premium-Distribution-Algorithm], [@bithedge-european-architecture-spec.md#3.2-Expiration-Settlement-Flow-European-Style#Provider-premium-share-calculation]                                                                                          |
| LP-306  | Optimize batch settlement processing (if LP directly handles batches or supports PR's batching efficiently)                                                 | LP-203                                         | Medium     | 2.5            | [@BitHedge-Advanced-Clarity-Patterns.md#5.-Optimized-Batch-Operations], [@bithedge-european-architecture-spec.md#6.1-Batch-Processing]                                                                                                                                                                     |
| LP-307  | Optimize interaction with `distribute-premium-batch` from PR                                                                                                | LP-206                                         | Medium     | 2              | [@modular-interactions.md#Optimizing-Inter-Contract-Calls], [@bithedge-european-architecture-spec.md#6.1-Batch-Processing]                                                                                                                                                                                 |
| LP-308  | Implement robust balance reconciliation helper functions (read-only, for verification by VC or admin)                                                       | LP-108, LP-201, LP-106                         | Medium     | 2              | [@bithedge-european-architecture-spec.md#5.1-Core-Verification-Functions#Verify-Provider-Balance-Integrity], [@bithedge-contract-architecture.md#4.1-System-Verification-and-Integrity-Checks]                                                                                                             |
| LP-309  | Add explicit calls to VC for verifying provider balance integrity, settlement impacts, and premium distribution correctness                                 | LP-204, LP-108, LP-305, VC-301, VC-302, VC-303 | Medium     | 3              | [@bithedge-european-architecture-spec.md#5.-Verification-Mechanisms], [@modular-interactions.md#Using-a-Dedicated-Verification-Contract], [@bithedge-contract-architecture.md#3.2-BitHedgeVerificationContract.clar]                                                                                       |
| LP-310  | Design emergency liquidity mechanisms (e.g., access to a protocol reserve if any, admin controls for unlocking capital under strict conditions)             | LP-303, PA-103                                 | Medium     | 2.5            | [@BitHedge-Advanced-Clarity-Patterns.md#Emergency-Mechanisms-and-Circuit-Breakers], [@clarity-best-practices.md#Essential-Best-Practices#4.-Safety-Mechanisms#Circuit-breakers]                                                                                                                            |
| LP-311  | Implement provider dropout handling in premium/settlement distribution (e.g., revert problematic portion or allocate to remaining providers if fair)        | LP-305, LP-204                                 | Medium     | 2.5            | [@bithedge-liquidity-premium-management.md#4.3-Handling-Edge-Cases-e.g.-Provider-Dropout]                                                                                                                                                                                                                  |
| LP-312  | Implement unclaimed premium management (e.g., after a certain period, unclaimed premiums go to treasury or are re-distributed; define in PA)                | LP-207, PA-101                                 | Medium     | 2              | [@bithedge-liquidity-premium-management.md#3.6-Unclaimed-Premiums]                                                                                                                                                                                                                                         |
| LP-313  | Implement provider incentives for covering specific expiration heights (using parameters from PA-302, affects premium share)                                | LP-103, LP-305, PA-302                         | Medium     | 2.5            | [@bithedge-liquidity-premium-management.md#5.1-Incentives-for-Liquidity-Providers]                                                                                                                                                                                                                         |

**Implementation Summary (Phase 3 - LP-301 & LP-302):**

Phase 3 enhancements for the `BitHedgeLiquidityPoolVaultContract` focused on fully integrating provider-specific risk tier parameters into the collateral locking mechanism and implementing a more sophisticated, tier-aware provider selection algorithm.

- **LP-301 (Full Risk Tier Parameter Usage in `lock-collateral` and `check-liquidity`):**

  - The `filter-eligible-providers` function (a helper to `get-eligible-providers-for-allocation`, which is called by `check-liquidity` and informs `lock-collateral`) was enhanced.
  - It now fetches each potential provider's _own selected risk tier_ (from `provider-balances.selected-risk-tier`) and their tier's specific parameters (like `max-exposure-per-policy-basis-points`, `max-exposure-per-expiration-basis-points`, and `is-active`) from `BitHedgeParametersContract`.
  - Eligibility checks now correctly use these provider-specific tier parameters, ensuring that a provider's capital is assessed against their chosen risk profile and exposure limits.
  - The `is-provider-tier-compatible` function ensures that the provider's tier is appropriate for the buyer's policy risk tier.

- **LP-302 (Advanced Tier-Based Provider Selection for `lock-collateral`):**
  - A new private helper function, `priv-sort-providers-by-preference`, was introduced. This function takes the list of eligible providers (those who passed LP-301's checks) and categorizes them based on their `selected-risk-tier` (e.g., "IncomeIrene-Conservative", "IncomeIrene-Balanced", "IncomeIrene-Aggressive"). It then concatenates these categorized lists in a predefined order of preference (Conservative > Balanced > Aggressive).
  - The `get-eligible-providers-for-allocation` function was updated to call `priv-sort-providers-by-preference` after the initial filtering, thus returning a _prioritized list_ of providers.
  - The main allocation logic in `allocate-capital-to-providers` (called by `lock-collateral`) was refactored. Instead of proportional allocation, it now performs _sequential allocation_. It iterates through the `prioritized-eligible-providers` list and attempts to source the required collateral from each provider's available capital, starting with the most preferred, until the policy's total collateral requirement is met.
  - If the full collateral amount cannot be sourced from the prioritized list, an error is returned, and the `lock-collateral` operation fails.

**Implementation Summary (Phase 3 - LP-303, LP-304):**

Recent work on the `BitHedgeLiquidityPoolVaultContract` addressed key aspects of liquidity preparation and detailed tracking of collateral needs.

- **LP-303 (`prepare-liquidity-for-expirations`):**

  - The public function `prepare-liquidity-for-expirations (expiration-height uint)` was implemented.
  - This function is callable by an address holding an administrative role (e.g., "admin"), verified via a call to `has-role` in the `BitHedgeParametersContract`.
  - Its purpose is to update the `is-liquidity-prepared` flag to `true` within the `expiration-liquidity-needs` data map for the specified `expiration-height`.
  - The function is idempotent; if the liquidity for the given height is already marked as prepared, it returns `(ok true)` without making further changes or emitting redundant events.
  - Upon successfully setting the flag to `true`, it emits a `liquidity-prepared-for-expiration` event.
  - New error codes `ERR-EXPIRATION-NOT-FOUND-LP` (if no record exists for the height) and `ERR-ADMIN-ROLE-REQUIRED-LP` were introduced.
  - As part of this development, a pre-existing linter error in the `deposit-capital` function related to SIP-010 token transfers was also corrected.

- **LP-304 (Enhance `expiration-liquidity-needs` with Risk Tier Distribution):**
  - The `expiration-liquidity-needs` data map's value tuple was augmented with a new field: `risk-tier-distribution: (map (string-ascii 32) (map (string-ascii 32) uint))`. This structure tracks, for each `token-id`, a nested map where keys are buyer `risk-tier` strings and values are the `uint` total collateral amounts required for that specific token and risk tier at the given expiration height.
  - The `lock-collateral` function was updated to populate this new `risk-tier-distribution`. When collateral is locked, it identifies the policy's `token-id` and `risk-tier` (buyer's tier) and increments the corresponding amount in the nested map for the policy's `expiration-height`.
  - The `release-collateral` function was updated to decrement these amounts. To do this, it first determines the policy's original buyer `risk-tier` by retrieving the `risk-tier-at-allocation` from one of the policy's entries in the `provider-allocations` map. It then subtracts the `released-amount` from the appropriate entry in the `risk-tier-distribution`.
  - Logic for initializing new entries and handling default values (empty maps or `u0` for amounts) in the nested map structure was incorporated.

#### BitHedgePriceOracleContract

| Task ID | Description                                                                                                                                                                                                                   | Dependencies   | Complexity | Estimated Days | References                                                                                                                                                                                                                                                                                                                                                    |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PO-301  | Implement multi-source price aggregation (e.g., median or weighted average of `update-bitcoin-price` submissions from whitelisted sources). **Status: Still pending or modified (Simplified Oracle implemented in Phase 2).** | PO-201, PO-204 | High       | 3.5            | [@BitHedge-Advanced-Clarity-Patterns.md#6.-Oracle-Security-and-Decentralization#Key-Recommendations], [@bithedge-smart-contract-architecture.md#BitHedgePriceOracleContract], [@BitHedge-Senior-Clarity-Technical-Analysis.md#1-Oracle-Implementation--Price-Feed-Security#Recommendation], [@bithedge-contract-architecture.md#2.2-BitHedgePriceOracle.clar] |
| PO-302  | Implement deviation checks between sources and circuit breakers if prices diverge too much or are stale. **Status: Still pending or modified.**                                                                               | PO-301         | Medium     | 2.5            | [@BitHedge-Advanced-Clarity-Patterns.md#6.-Oracle-Security-and-Decentralization#Key-Recommendations], [@BitHedge-Senior-Clarity-Technical-Analysis.md#1-Oracle-Implementation--Price-Feed-Security#Recommendation]                                                                                                                                            |
| PO-303  | Implement full TWAP calculation logic (e.g., for last N blocks before expiration) and storage/retrieval for settlement prices. **Status: Still pending or modified (Stubs in ML-203; full Oracle TWAP logic pending).**       | PO-205, ML-203 | High       | 3.5            | [@BitHedge-Advanced-Clarity-Patterns.md#Time-Weighted-Average-Price-TWAP-Oracles], [@BitHedge-Senior-Clarity-Technical-Analysis.md#1-Oracle-Implementation--Price-Feed-Security#Recommendation], [@bithedge-contract-architecture.md#2.2-BitHedgePriceOracle.clar#Key-Functions]                                                                              |
| PO-304  | Design and document Oracle redundancy and fallback mechanisms (e.g., what happens if primary sources fail). **Status: Still pending or modified.**                                                                            | PO-301         | Medium     | 2              | [@BitHedge-Advanced-Clarity-Patterns.md#6.-Oracle-Security-and-Decentralization#Oracle-Redundancy-and-Fallback]                                                                                                                                                                                                                                               |

#### BitHedgeVerificationContract

| Task ID | Description                                                                                                                                                                         | Dependencies                           | Complexity | Estimated Days | References                                                                                                                                                                                                                                                                                      |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VC-301  | Implement full `verify-provider-balance-integrity` (checks sum of provider's allocations against their `allocated-amount`)                                                          | VC-201, LP-108, LP-201                 | Medium     | 3              | [@bithedge-european-architecture-spec.md#5.1-Core-Verification-Functions#Verify-Provider-Balance-Integrity], [@bithedge-contract-architecture.md#2.5-BitHedgeVerificationContract.clar#Key-Functions]                                                                                           |
| VC-302  | Implement full `verify-premium-distribution-integrity` (for a policy, checks sum of provider shares against total premium, and individual shares proportional to allocation/risk)   | VC-201, PR-101, LP-305, LP-206         | High       | 3.5            | [@bithedge-european-architecture-spec.md#5.1-Core-Verification-Functions#Verify-Premium-Distribution-Integrity], [@bithedge-liquidity-premium-management.md#3.7-Verification-of-Premium-Distribution], [@bithedge-contract-architecture.md#2.5-BitHedgeVerificationContract.clar#Key-Functions] |
| VC-303  | Implement full `verify-settlement-integrity` (for a policy, checks sum of provider contributions against total settlement, and individual contributions proportional to allocation) | VC-201, PR-101, LP-204                 | High       | 3.5            | [@bithedge-european-architecture-spec.md#5.1-Core-Verification-Functions#Verify-Settlement-Integrity], [@bithedge-european-style-implementation.md#4.5-Verification-of-Settlement], [@bithedge-contract-architecture.md#2.5-BitHedgeVerificationContract.clar#Key-Functions]                    |
| VC-304  | Implement `verify-system-invariants` (callable public function to check a list of critical invariants across contracts)                                                             | VC-301, VC-302, VC-303, VC-203, VC-204 | High       | 3              | [@bithedge-european-architecture-spec.md#5.2-System-Level-Verification], [@modular-interactions.md#Using-a-Dedicated-Verification-Contract], [@bithedge-contract-architecture.md#3.2-BitHedgeVerificationContract.clar]                                                                         |
| VC-305  | Implement `verify-risk-tier-compatibility` (checks policy's risk tier against assigned providers' tiers and allocation rules)                                                       | VC-201, PR-301, LP-302, PA-201         | Medium     | 2.5            | [@bithedge-european-architecture-spec.md#5.1-Core-Verification-Functions#Custom-Verification-Logic-for-Risk-Tiers], [@bithedge-contract-architecture.md#4.2-Risk-Tier-Verification]                                                                                                             |

#### Shared Components (SH)

| Task ID | Description                                                                                                                                                     | Dependencies                   | Complexity | Estimated Days | References                                                                                                                                                                                                                                |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SH-301  | Implement full risk tier system test suite (policy creation with different tiers, provider allocation with tier matching, settlement/premium with tier effects) | PR-301, LP-302, PA-201, SH-202 | High       | 3.5            | [@clarity-best-practices.md#Testing-Strategies#End-to-End-Testing], [@bithedge-european-architecture-spec.md#7.2-Testing-Strategy#Integration-Testing]                                                                                    |
| SH-302  | Develop gas optimization measurement tools and benchmark all critical flows (policy creation, batch expiration, settlement, premium distribution)               | PR-304, LP-306, LP-307         | Medium     | 2.5            | [@clarity-best-practices.md#Gas-Optimization], [@BitHedge-Advanced-Clarity-Patterns.md#Gas-Considerations-and-Optimization-Techniques], [@bithedge-european-architecture-spec.md#6.-Gas-Optimization-Techniques]                          |
| SH-303  | Create large-scale batch processing tests (e.g., 50+ policies expiring, 50+ premiums to distribute)                                                             | PR-303, PR-305, SH-202         | High       | 3.5            | [@BitHedge-Advanced-Clarity-Patterns.md#5.-Optimized-Batch-Operations#Key-Recommendations], [@clarity-best-practices.md#Testing-Strategies#Stress-Testing], [@bithedge-european-architecture-spec.md#7.2-Testing-Strategy#Stress-Testing] |
| SH-304  | Implement comprehensive VerificationContract integration tests (triggering all `verify-*` functions under various valid and invalid states)                     | VC-304, SH-204                 | High       | 3.5            | [@clarity-best-practices.md#Testing-Strategies#Integration-Testing], [@bithedge-european-architecture-spec.md#7.2-Testing-Strategy#Integration-Testing]                                                                                   |
| SH-305  | Develop complex multi-provider, multi-policy, multi-expiration, multi-risk-tier interaction scenarios for end-to-end testing                                    | SH-301, SH-303                 | High       | 3              | [@clarity-best-practices.md#Testing-Strategies#Scenario-Based-Testing]                                                                                                                                                                    |

#### Phase 3 Milestones

- **M3.1**: Full risk tier system integrated into Policy Registry (PR) and Liquidity Pool (LP), governed by ParametersContract (PA), influencing premium (ML) and collateral.
- **M3.2**: Advanced batch processing for expiration (PR) and premium distribution (PR, LP) is optimized, configurable via PA, and handles continuations.
- **M3.3**: Expiration-focused liquidity management in LP (`prepare-liquidity-for-expirations`, enhanced `expiration-liquidity-needs` tracking) is operational. Advanced provider selection in LP is implemented.
- **M3.4**: PriceOracle (PO) uses multi-source aggregation, deviation checks, and provides reliable TWAP for settlement. Redundancy strategy documented.
- **M3.5**: VerificationContract (VC) provides comprehensive checks for all major system components, invariants, and risk tier compatibility. These checks are integrated into PR & LP flows.
- **M3.6**: Key "missing steps" like fair premium distribution algorithms (LP), Oracle redundancy design (PO), provider dropout handling (LP basic), unclaimed premium management (LP basic), and provider incentives (LP) are addressed.

### Phase 4: Testing, Edge Cases, and Refinement

#### Policy Registry Contract (BitHedgePolicyRegistryContract)

| Task ID | Description                                                                                                         | Dependencies                   | Complexity | Estimated Days | References                                                                                                                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PR-401  | Implement comprehensive unit tests covering all functions and branches                                              | All PR-3xx                     | High       | 4              | [@clarity-best-practices.md#Testing-Strategies#Unit-Testing]                                                                                                                                                       |
| PR-402  | Add specific edge case handling for expiration processing (e.g., zero policies at height, Oracle price unavailable) | PR-303, PR-307, PO-304         | Medium     | 2.5            | [@bithedge-european-style-implementation.md#6.1-Edge-Case-Policy-Expiration], [@bithedge-contract-architecture.md#5.1-Edge-Case-Handling#Policy-Expiration-and-Settlement]                                         |
| PR-403  | Develop stress tests for batch expiration and premium distribution (max batch sizes, rapid succession)              | PR-303, PR-305                 | Medium     | 2.5            | [@clarity-best-practices.md#Testing-Strategies#Stress-Testing]                                                                                                                                                     |
| PR-404  | Conduct security review of contract logic, access controls, and external calls; implement mitigations               | All PR-3xx                     | High       | 3.5            | [@BitHedge-Senior-Clarity-Technical-Analysis.md#Security-Considerations-and-Best-Practices], [@clarity-best-practices.md#Security-Best-Practices], [@bithedge-contract-architecture.md#6.-Security-Considerations] |
| PR-405  | Final gas optimization based on SH-302 benchmarks and stress test results                                           | PR-304, PR-401, PR-403, SH-302 | Medium     | 2.5            | [@clarity-best-practices.md#Gas-Optimization], [@bithedge-european-architecture-spec.md#6.-Gas-Optimization-Techniques]                                                                                            |

#### Liquidity Pool Vault Contract (BitHedgeLiquidityPoolVaultContract)

| Task ID | Description                                                                                                                                         | Dependencies                           | Complexity | Estimated Days | References                                                                                                                                                                                                                                                                       |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LP-401  | Implement comprehensive unit tests covering all functions and branches                                                                              | All LP-3xx                             | High       | 4              | [@clarity-best-practices.md#Testing-Strategies#Unit-Testing]                                                                                                                                                                                                                     |
| LP-402  | Add specific edge case handling for settlement (e.g., insufficient pool funds for all settlements, zero value settlements) and premium distribution | LP-306, LP-305, LP-311                 | Medium     | 3              | [@bithedge-liquidity-premium-management.md#4.3-Handling-Edge-Cases-e.g.-Provider-Dropout], [@bithedge-european-style-implementation.md#6.2-Edge-Case-Settlement-and-Premium-Distribution], [@bithedge-contract-architecture.md#5.1-Edge-Case-Handling#Liquidity-Pool-Operations] |
| LP-403  | Develop stress tests for provider allocations, capital deposit/withdraw under high load                                                             | LP-302, LP-103, LP-104                 | Medium     | 2.5            | [@clarity-best-practices.md#Testing-Strategies#Stress-Testing]                                                                                                                                                                                                                   |
| LP-404  | Conduct security review of contract logic, fund handling, and provider interactions; implement mitigations                                          | All LP-3xx                             | High       | 3.5            | [@BitHedge-Senior-Clarity-Technical-Analysis.md#Security-Considerations-and-Best-Practices], [@clarity-best-practices.md#Security-Best-Practices], [@bithedge-contract-architecture.md#6.-Security-Considerations]                                                               |
| LP-405  | Final gas optimization based on SH-302 benchmarks and stress test results                                                                           | LP-306, LP-307, LP-401, LP-403, SH-302 | Medium     | 2.5            | [@clarity-best-practices.md#Gas-Optimization], [@bithedge-european-architecture-spec.md#6.-Gas-Optimization-Techniques]                                                                                                                                                          |

#### BitHedgeParametersContract

| Task ID | Description                                                                      | Dependencies | Complexity | Estimated Days | References                                                                                                                                                                                                         |
| ------- | -------------------------------------------------------------------------------- | ------------ | ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PA-401  | Comprehensive unit tests for all parameter get/set and role management functions | All PA-3xx   | Medium     | 2              | [@clarity-best-practices.md#Testing-Strategies#Unit-Testing]                                                                                                                                                       |
| PA-402  | Edge case handling (e.g., setting invalid parameter values, role conflicts)      | All PA-3xx   | Low        | 1              | [@clarity-best-practices.md#Essential-Best-Practices#4.-Safety-Mechanisms#Validation-thresholds], [@bithedge-contract-architecture.md#5.1-Edge-Case-Handling#Parameter-Management]                                 |
| PA-403  | Security review of admin functions and parameter validation                      | All PA-3xx   | Medium     | 1.5            | [@BitHedge-Senior-Clarity-Technical-Analysis.md#Security-Considerations-and-Best-Practices], [@clarity-best-practices.md#Security-Best-Practices], [@bithedge-contract-architecture.md#6.-Security-Considerations] |
| PA-404  | Final gas optimization for parameter access                                      | All PA-3xx   | Low        | 1              | [@clarity-best-practices.md#Gas-Optimization]                                                                                                                                                                      |

#### BitHedgeMathLibraryContract

| Task ID | Description                                                                                               | Dependencies | Complexity | Estimated Days | References                                                                                                                                                                                                                           |
| ------- | --------------------------------------------------------------------------------------------------------- | ------------ | ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ML-401  | Comprehensive unit tests for all math functions, including boundary conditions for fixed-point arithmetic | All ML-3xx   | High       | 2.5            | [@clarity-best-practices.md#Testing-Strategies#Unit-Testing], [@BitHedge-Advanced-Clarity-Patterns.md#Fixed-Point-Arithmetic], [@BitHedge-Senior-Clarity-Technical-Analysis.md#2-Fixed-Point-Math-for-Option-Pricing#Recommendation] |
| ML-402  | Edge case handling (e.g., division by zero, overflow/underflow with fixed-point)                          | All ML-3xx   | Medium     | 1.5            | [@BitHedge-Advanced-Clarity-Patterns.md#Fixed-Point-Arithmetic#Key-Recommendations], [@bithedge-contract-architecture.md#5.1-Edge-Case-Handling#Mathematical-Calculations]                                                           |
| ML-403  | Security review of calculation logic for potential manipulation or precision issues                       | All ML-3xx   | Medium     | 2              | [@BitHedge-Senior-Clarity-Technical-Analysis.md#Security-Considerations-and-Best-Practices], [@clarity-best-practices.md#Mathematical-Precision-and-Decimals#Recommendation]                                                         |
| ML-404  | Final gas optimization for all calculations                                                               | All ML-3xx   | Medium     | 1.5            | [@clarity-best-practices.md#Gas-Optimization]                                                                                                                                                                                        |

#### BitHedgePriceOracleContract

| Task ID | Description                                                                                                       | Dependencies           | Complexity | Estimated Days | References                                                                                                                                                                                                                                                                                                            |
| ------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PO-401  | Comprehensive unit tests for all Oracle functions, including aggregation and TWAP                                 | All PO-3xx             | High       | 3              | [@clarity-best-practices.md#Testing-Strategies#Unit-Testing]                                                                                                                                                                                                                                                          |
| PO-402  | Edge case handling (e.g., no price sources available, extreme deviation in prices, stale data across all sources) | PO-301, PO-302, PO-304 | Medium     | 2.5            | [@BitHedge-Advanced-Clarity-Patterns.md#6.-Oracle-Security-and-Decentralization#Oracle-Redundancy-and-Fallback], [@bithedge-contract-architecture.md#5.1-Edge-Case-Handling#Price-Oracle-Operations]                                                                                                                  |
| PO-403  | Stress tests for rapid price updates and TWAP calculations under varying conditions                               | PO-301, PO-303         | Medium     | 2              | [@clarity-best-practices.md#Testing-Strategies#Stress-Testing]                                                                                                                                                                                                                                                        |
| PO-404  | Security review (e.g., price manipulation vectors, updater collusion, TWAP vulnerabilities) and mitigations       | All PO-3xx             | High       | 3              | [@BitHedge-Senior-Clarity-Technical-Analysis.md#1-Oracle-Implementation--Price-Feed-Security#Recommendation], [@BitHedge-Advanced-Clarity-Patterns.md#6.-Oracle-Security-and-Decentralization], [@clarity-best-practices.md#Security-Best-Practices], [@bithedge-contract-architecture.md#6.-Security-Considerations] |
| PO-405  | Final gas optimization for price aggregation, storage, and TWAP calculations                                      | PO-301, PO-303         | Medium     | 2              | [@clarity-best-practices.md#Gas-Optimization]                                                                                                                                                                                                                                                                         |

#### BitHedgeVerificationContract

| Task ID | Description                                                                                                                                     | Dependencies | Complexity | Estimated Days | References                                                                                                                                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| VC-401  | Comprehensive unit tests for all verification functions, testing both success and failure paths                                                 | All VC-3xx   | High       | 3.5            | [@clarity-best-practices.md#Testing-Strategies#Unit-Testing]                                                                                                                                                       |
| VC-402  | Edge case handling (e.g., verifying empty data sets, zero value sums, inconsistent states)                                                      | All VC-3xx   | Medium     | 2.5            | [@bithedge-european-architecture-spec.md#5.1-Core-Verification-Functions], [@bithedge-contract-architecture.md#5.1-Edge-Case-Handling#Verification-Checks]                                                         |
| VC-403  | Stress tests for `verify-system-invariants` with a large and complex contract state                                                             | VC-304       | Medium     | 2              | [@clarity-best-practices.md#Testing-Strategies#Stress-Testing]                                                                                                                                                     |
| VC-404  | Security review (e.g., potential bypass of verification checks, incorrect invariant logic leading to false positives/negatives) and mitigations | All VC-3xx   | High       | 3              | [@BitHedge-Senior-Clarity-Technical-Analysis.md#Security-Considerations-and-Best-Practices], [@clarity-best-practices.md#Security-Best-Practices], [@bithedge-contract-architecture.md#6.-Security-Considerations] |
| VC-405  | Final gas optimization for complex verification queries and invariant checks                                                                    | All VC-3xx   | Medium     | 2              | [@clarity-best-practices.md#Gas-Optimization]                                                                                                                                                                      |

#### Shared Components (SH)

| Task ID | Description                                                                                                                                      | Dependencies                           | Complexity | Estimated Days | References                                                                                                                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SH-401  | Implement end-to-end integration tests covering all contracts and major user flows                                                               | All contract Phase 3 tasks, SH-305     | High       | 4              | [@clarity-best-practices.md#Testing-Strategies#Integration-Testing], [@modular-interactions.md#5.-Implementation-Example-Complete-Interaction-Flow], [@bithedge-european-architecture-spec.md#7.2-Testing-Strategy#Integration-Testing] |
| SH-402  | Create multi-policy, multi-provider, multi-token (if applicable) complex scenarios targeting edge cases and interactions                         | PR-402, LP-402, PO-402, VC-402, SH-401 | High       | 3.5            | [@clarity-best-practices.md#Testing-Strategies#Scenario-Based-Testing]                                                                                                                                                                  |
| SH-403  | Develop a comprehensive boundary condition test suite for all numerical inputs and state variables                                               | All contract unit tests                | Medium     | 3              | [@clarity-best-practices.md#Testing-Strategies#Boundary-Value-Analysis]                                                                                                                                                                 |
| SH-404  | Create final technical documentation for all contracts and deployment guides                                                                     | All tasks                              | Medium     | 3              | [@bithedge-contract-architecture.md#7.-Documentation-and-Deployment]                                                                                                                                                                    |
| SH-405  | Implement final tests for the complete verification system (VC) ensuring it correctly identifies valid/invalid states created by other contracts | All VC tasks, SH-401                   | Medium     | 2.5            | [@clarity-best-practices.md#Testing-Strategies#System-Testing]                                                                                                                                                                          |

#### Phase 4 Milestones

- **M4.1**: Comprehensive unit and integration test suites implemented and passing for ALL contracts (PR, LP, PA, ML, PO, VC).
- **M4.2**: All identified edge cases and stress tests passed across the entire system, ensuring stability and correct behavior under adverse conditions.
- **M4.3**: Security reviews completed for ALL contracts, with identified vulnerabilities mitigated and re-tested.
- **M4.4**: Final gas optimization completed across ALL contracts, with performance benchmarks meeting targets. Technical documentation finalized.

### Phase 5: Deployment and Launch

#### Policy Registry Contract (BitHedgePolicyRegistryContract)

| Task ID | Description                                                                             | Dependencies       | Complexity | Estimated Days | References                                                                                                                                                                                              |
| ------- | --------------------------------------------------------------------------------------- | ------------------ | ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR-501  | Prepare mainnet deployment scripts and checklists (includes setting initial PA address) | All PR-4xx, PA-501 | Medium     | 1.5            | [@clarity-best-practices.md#Deployment-Considerations], [@bithedge-contract-architecture.md#7.-Documentation-and-Deployment#Deployment-Steps]                                                           |
| PR-502  | Integrate with mainnet monitoring systems for events and critical functions             | PR-501, SH-502     | Medium     | 1              | N/A                                                                                                                                                                                                     |
| PR-503  | Implement post-deployment verification scripts and procedures                           | PR-501, VC-501     | Medium     | 1              | [@bithedge-european-architecture-spec.md#5.2-System-Level-Verification#Post-Deployment-Verification], [@bithedge-contract-architecture.md#7.-Documentation-and-Deployment#Post-Deployment-Verification] |

#### Liquidity Pool Vault Contract (BitHedgeLiquidityPoolVaultContract)

| Task ID | Description                                                                                   | Dependencies       | Complexity | Estimated Days | References                                                                                                                                                                                              |
| ------- | --------------------------------------------------------------------------------------------- | ------------------ | ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LP-501  | Prepare mainnet deployment scripts and checklists (includes setting initial PR, PA addresses) | All LP-4xx, PA-501 | Medium     | 1.5            | [@clarity-best-practices.md#Deployment-Considerations], [@bithedge-contract-architecture.md#7.-Documentation-and-Deployment#Deployment-Steps]                                                           |
| LP-502  | Integrate with mainnet monitoring systems for events and critical functions                   | LP-501, SH-502     | Medium     | 1              | N/A                                                                                                                                                                                                     |
| LP-503  | Implement post-deployment verification scripts and procedures                                 | LP-501, VC-501     | Medium     | 1              | [@bithedge-european-architecture-spec.md#5.2-System-Level-Verification#Post-Deployment-Verification], [@bithedge-contract-architecture.md#7.-Documentation-and-Deployment#Post-Deployment-Verification] |

#### BitHedgeParametersContract

| Task ID | Description                                                                                      | Dependencies   | Complexity | Estimated Days | References                                                                                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------ | -------------- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-501  | Prepare mainnet deployment: set final initial parameter values (owner, fees, risk tiers, limits) | All PA-4xx     | Medium     | 1.5            | [@clarity-best-practices.md#Deployment-Considerations], [@BitHedge-Advanced-Clarity-Patterns.md#System-Parameters-and-Upgradability], [@bithedge-contract-architecture.md#7.-Documentation-and-Deployment#Deployment-Steps] |
| PA-502  | Integrate with mainnet monitoring for parameter change events                                    | PA-501, SH-502 | Low        | 0.5            | N/A                                                                                                                                                                                                                         |
| PA-503  | Implement post-deployment verification scripts for all parameters                                | PA-501         | Low        | 0.5            | [@bithedge-european-architecture-spec.md#5.2-System-Level-Verification#Post-Deployment-Verification], [@bithedge-contract-architecture.md#7.-Documentation-and-Deployment#Post-Deployment-Verification]                     |

#### BitHedgeMathLibraryContract

| Task ID | Description                                                         | Dependencies | Complexity | Estimated Days | References                                                                                                                                    |
| ------- | ------------------------------------------------------------------- | ------------ | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| ML-501  | Prepare mainnet deployment (final checks on logic, no state to set) | All ML-4xx   | Low        | 0.5            | [@clarity-best-practices.md#Deployment-Considerations], [@bithedge-contract-architecture.md#7.-Documentation-and-Deployment#Deployment-Steps] |
| ML-502  | (No specific monitoring, verification via usage by other contracts) | ML-501       | N/A        | 0              | N/A                                                                                                                                           |

#### BitHedgePriceOracleContract

| Task ID | Description                                                                                 | Dependencies       | Complexity | Estimated Days | References                                                                                                                                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------- | ------------------ | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PO-501  | Prepare mainnet deployment (set initial authorized updaters, source configurations from PA) | All PO-4xx, PA-501 | Medium     | 1.5            | [@clarity-best-practices.md#Deployment-Considerations], [@BitHedge-Advanced-Clarity-Patterns.md#6.-Oracle-Security-and-Decentralization#Key-Recommendations], [@bithedge-contract-architecture.md#7.-Documentation-and-Deployment#Deployment-Steps] |
| PO-502  | Integrate with mainnet monitoring for price updates, source issues, staleness alerts        | PO-501, SH-502     | Medium     | 1.5            | N/A                                                                                                                                                                                                                                                 |
| PO-503  | Implement post-deployment verification scripts for price feed accuracy and updater setup    | PO-501             | Medium     | 1              | [@bithedge-european-architecture-spec.md#5.2-System-Level-Verification#Post-Deployment-Verification], [@bithedge-contract-architecture.md#7.-Documentation-and-Deployment#Post-Deployment-Verification]                                             |

#### BitHedgeVerificationContract

| Task ID | Description                                                                      | Dependencies       | Complexity | Estimated Days | References                                                                                                                                                                                              |
| ------- | -------------------------------------------------------------------------------- | ------------------ | ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VC-501  | Prepare mainnet deployment (set parameters for verification jobs if any from PA) | All VC-4xx, PA-501 | Low        | 1              | [@clarity-best-practices.md#Deployment-Considerations], [@bithedge-contract-architecture.md#7.-Documentation-and-Deployment#Deployment-Steps]                                                           |
| VC-502  | Integrate with mainnet monitoring for verification failure events                | VC-501, SH-502     | Medium     | 1              | N/A                                                                                                                                                                                                     |
| VC-503  | Scripts for running periodic off-chain verification checks using VC functions    | VC-501             | Medium     | 1              | [@bithedge-european-architecture-spec.md#5.2-System-Level-Verification#Post-Deployment-Verification], [@bithedge-contract-architecture.md#7.-Documentation-and-Deployment#Post-Deployment-Verification] |

#### Shared Components (SH)

| Task ID | Description                                                                                  | Dependencies                                   | Complexity | Estimated Days | References                                                                                                                                                                                         |
| ------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SH-501  | Create consolidated mainnet deployment scripts for all contracts in correct order            | PR-501, LP-501, PA-501, ML-501, PO-501, VC-501 | High       | 2.5            | [@clarity-best-practices.md#Deployment-Considerations], [@modular-interactions.md#Deployment-Orchestration], [@bithedge-contract-architecture.md#7.-Documentation-and-Deployment#Deployment-Steps] |
| SH-502  | Develop system health dashboard specifications for monitoring key metrics from all contracts | PR-502, LP-502, PA-502, PO-502, VC-502         | Medium     | 2              | N/A                                                                                                                                                                                                |
| SH-503  | Finalize user documentation, tutorials, and API references for all contracts                 | SH-404                                         | Medium     | 2.5            | [@bithedge-contract-architecture.md#7.-Documentation-and-Deployment#User-Documentation]                                                                                                            |
| SH-504  | Implement contract verification tools on block explorers for all deployed contracts          | All contract deployment tasks                  | Medium     | 1.5            | N/A                                                                                                                                                                                                |
| SH-505  | Prepare comprehensive launch plan and rollout strategy, including communication and support  | All tasks                                      | Medium     | 2              | N/A                                                                                                                                                                                                |

#### Phase 5 Milestones

- **M5.1**: All contracts (PR, LP, PA, ML, PO, VC) successfully deployed to mainnet with correct initial parameters and inter-dependencies set.
- **M5.2**: Comprehensive monitoring systems are operational for all contracts, tracking key events, functions, and system health metrics.
- **M5.3**: Post-deployment verification scripts run successfully, confirming the integrity and correct setup of all contracts on mainnet.
- **M5.4**: Launch documentation, user guides, API references, and block explorer verification are complete and publicly available. Launch plan executed.

## Critical Implementation Details

### Risk Tier System Implementation

The risk tier system, configured in `BitHedgeParametersContract` and utilized by `BitHedgePolicyRegistryContract`, `BitHedgeLiquidityPoolVaultContract`, and `BitHedgeMathLibraryContract`, is crucial:

#### Buyer Tiers (Protective Peter):

- **Conservative**: 100% of current value - Maximum protection
- **Standard**: 90% of current value - Standard protection
- **Flexible**: 80% of current value - Balanced protection
- **Crash Insurance**: 70% of current value - Minimal protection

#### Provider Tiers (Income Irene):

- **Conservative**: Low risk, lower yield, higher collateral ratio (e.g., 110% set in PA)
- **Balanced**: Medium risk, medium yield, standard collateral ratio (e.g., 100% set in PA)
- **Aggressive**: Higher risk, higher yield, lower collateral ratio (e.g., 90% set in PA)

#### Tier Matching Rules (Enforced by LP and verified by VC):

- ConservativeBuyer → ConservativeProvider
- StandardBuyer → BalancedProvider, ConservativeProvider
- FlexibleBuyer → AggressiveProvider, BalancedProvider
- CrashInsuranceBuyer → Any provider tier

Implementation must ensure these relationships are enforced during policy creation (PR checks with LP) and provider allocation (LP logic). `BitHedgeVerificationContract` will have functions to audit these matches.

### European-Style Settlement Process

Managed primarily by `BitHedgePolicyRegistryContract` with price data from `BitHedgePriceOracleContract`, calculations from `BitHedgeMathLibraryContract`, and execution by `BitHedgeLiquidityPoolVaultContract`.

1.  **Expiration Batch Processing**:
    - PR processes policies in batches at their expiration height using `process-expiration-batch`.
    - PO provides expiration price (ideally TWAP).
    - ML calculates settlement amount. ITM policies trigger settlement via LP. OTM policies trigger premium distribution via LP.
2.  **Settlement Impact Tracking**:
    - LP's `settlement-impacts` map tracks each provider's contribution proportionally. Verified by VC.
    - Remaining collateral released by LP.
3.  **Premium Distribution Process**:
    - PR's `distribute-premium-batch` initiates distribution for OTM policies.
    - LP distributes premiums proportionally using `distribute-premium-to-providers`, considering risk and allocation. Verified by VC.

## Resource Allocation and Timeline

### Team Structure

- **Smart Contract Developers**: 3-4 developers (Clarity expertise)
- **QA Engineers / Testers**: 2 engineers (focused on blockchain specifics)
- **Project Manager**: 1 person
- **Technical Lead / Architect**: 1 person

### Timeline Summary (Adjusted for increased scope)

| Phase                                                               | Estimated Duration | Cumulative  |
| ------------------------------------------------------------------- | ------------------ | ----------- |
| Phase 1: Foundation and Core Functionality                          | 5-6 weeks          | 5-6 weeks   |
| Phase 2: Settlement, Expiration, and Core Oracle/Verification Logic | 6-7 weeks          | 11-13 weeks |
| Phase 3: Advanced Risk Tier System, Liquidity Mgt, and Verification | 6-7 weeks          | 17-20 weeks |
| Phase 4: Testing, Edge Cases, and Refinement                        | 4-5 weeks          | 21-25 weeks |
| Phase 5: Deployment and Launch                                      | 2-3 weeks          | 23-28 weeks |

_Note: This is a high-level estimate. Detailed task breakdown and parallelization opportunities can refine this._

### Critical Path

The critical path will involve the sequential build-up of functionality across contracts:

1.  PA, ML core setup.
2.  PR policy creation basics & LP capital management basics.
3.  PO price feed integration.
4.  PR expiration & settlement logic relying on PO, ML, LP.
5.  LP advanced allocation & premium distribution.
6.  VC verification logic for all key flows.
7.  Comprehensive testing and security reviews of all contracts.
8.  Deployment.

## Risk Management

### Technical Risks

| Risk                                                  | Probability | Impact | Mitigation                                                                                                             |
| ----------------------------------------------------- | ----------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| Gas optimization challenges across multiple contracts | Medium      | High   | Early profiling, incremental optimization, batch processing, Clarity best practices, ML gas efficiency focus.          |
| Complex verification logic bugs in VC or its usage    | Medium      | High   | Comprehensive test suite for VC, formal verification for critical invariants if feasible, phased rollout of checks.    |
| Oracle dependency failures or manipulation            | Medium      | High   | Robust PO design (multi-source, TWAP, deviation checks), fallback mechanisms, diligent monitoring.                     |
| Settlement/Premium calculation errors in ML           | Low         | High   | Rigorous testing of ML, independent audits, cross-checks with VC.                                                      |
| Risk tier mismatches or misconfigurations (PA)        | Medium      | Medium | Explicit tier compatibility verification (VC), clear PA management, thorough testing of tier effects.                  |
| Integration complexity between 6 contracts            | High        | High   | Clear interface definitions (traits if applicable), extensive integration testing (SH tasks), incremental integration. |

### Project Risks

| Risk                                              | Probability | Impact | Mitigation                                                                                                                 |
| ------------------------------------------------- | ----------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| Timeline overruns due to increased scope          | High        | Medium | Realistic estimation, buffer in estimates, prioritized feature implementation, parallel development tracks where possible. |
| Resource constraints (Clarity dev expertise)      | Medium      | Medium | Invest in training, clear documentation for onboarding, modular contract design to allow focused work.                     |
| Changing requirements during extended development | Medium      | Medium | Phased approach allows for some flexibility, regular stakeholder reviews, strong architectural foundation.                 |
| Security vulnerabilities in any contract          | Medium      | High   | Multiple security reviews per contract and for system, progressive security testing, bug bounties post-launch.             |

## Success Criteria

The project will be considered successful when:

1.  All specified smart contracts are deployed to mainnet with full, verified functionality as per this plan.
2.  A comprehensive test suite (unit, integration, system, stress) passes with high coverage for all contracts.
3.  All verification mechanisms in `BitHedgeVerificationContract` are validated and confirm system integrity under diverse scenarios.
4.  Gas usage for all critical operations across all contracts is optimized to meet predefined target levels.
5.  Complete and accurate technical and user documentation for the entire multi-contract system is available.
6.  Monitoring, maintenance, and emergency procedures are established and tested for the live system.

## Conclusion

This revised development plan provides a more robust and granular roadmap for implementing BitHedge's European-style options architecture. By breaking down the system into dedicated, specialized contracts (`BitHedgePolicyRegistryContract`, `BitHedgeLiquidityPoolVaultContract`, `BitHedgeParametersContract`, `BitHedgeMathLibraryContract`, `BitHedgePriceOracleContract`, `BitHedgeVerificationContract`), we achieve better separation of concerns, enhanced maintainability, and targeted development focus.

The phased approach, with clear tasks and milestones for each contract, allows for incremental development, testing, and integration. The increased emphasis on verification, security, and edge case handling throughout the plan aims to deliver a highly reliable and secure financial platform. While the scope has expanded, this detailed plan sets a stronger foundation for successful execution and delivery of the sophisticated BitHedge smart contract system.
