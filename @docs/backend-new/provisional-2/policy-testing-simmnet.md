;; 1. SETUP LIQUIDITY POOL VAULT

;; Set the policy registry principal
(contract-call? .liquidity-pool-vault set-policy-registry-principal 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.policy-registry)

;; Set a backend authorized principal (using wallet_1)
(contract-call? .liquidity-pool-vault set-backend-authorized-principal 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)

;; Initialize token support for STX
(contract-call? .liquidity-pool-vault initialize-token "STX")

;; Initialize token support for SBTC
(contract-call? .liquidity-pool-vault initialize-token "sBTC")

;; 2. SETUP POLICY REGISTRY

;; Set the liquidity pool principal
(contract-call? .policy-registry set-liquidity-pool-vault-principal 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.liquidity-pool-vault)

;; Set the oracle principal
(contract-call? .policy-registry set-oracle-principal 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.oracle)

;; Set the same backend authorized principal
(contract-call? .policy-registry set-backend-authorized-principal 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)

;; 3. DEPOSIT FUNDS TO POOL (as different wallets)

;; Switch to wallet_2 and deposit STX
::set_tx_sender ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG
(contract-call? .liquidity-pool-vault deposit-stx u100000000)

;; Switch to wallet_3 and deposit STX
::set_tx_sender ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC
(contract-call? .liquidity-pool-vault deposit-stx u200000000)

;; Switch to wallet_4 and deposit sBTC
::set_tx_sender ST2NEB84ASENDXKYGJPQW86YXQCEFEX2ZQPG87ND
(contract-call? .liquidity-pool-vault deposit-sip010 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token u10000000)

;; Check balances
(contract-call? .liquidity-pool-vault get-total-token-balance "STX")
(contract-call? .liquidity-pool-vault get-total-token-balance "sBTC")
(contract-call? .liquidity-pool-vault get-available-balance "STX")
(contract-call? .liquidity-pool-vault get-available-balance "sBTC")

;; 4. CREATE POLICIES (as backend)

;; Switch to backend user (wallet_1)
::set_tx_sender ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
::set_tx_sender ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM

;; Set oracle price (current burn block height and BTC price for tests)
::get_burn_block_height
(contract-call? .oracle set-aggregated-price u50000)

;; Create a PUT policy for wallet_5
;;(contract-call? .policy-registry create-policy-entry ;;T2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB "PUT" u45000 u50000000 u25000000 u1500)

(contract-call? .policy-registry create-policy-entry 'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM u45000 u50000000 u2500 u1500 "PUT")

;; Create a CALL policy for wallet_6
(contract-call? .policy-registry create-policy-entry 'ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0 "CALL" u60000 u50000000 u50000 u1500)

;; Check policies
(contract-call? .policy-registry get-policy u1)
(contract-call? .policy-registry get-policy u2)
(contract-call? .policy-registry is-policy-active u1)
(contract-call? .policy-registry is-policy-active u2)

;; 5. LOCK COLLATERAL FOR POLICIES

;; Lock STX for the PUT policy
(contract-call? .liquidity-pool-vault lock-collateral "STX" u2500 u0)

;; Lock sBTC for the CALL policy
(contract-call? .liquidity-pool-vault lock-collateral "SBTC" u50000 u2)

;; Check locked amounts
(contract-call? .liquidity-pool-vault get-locked-collateral "STX")
(contract-call? .liquidity-pool-vault get-locked-collateral "SBTC")
(contract-call? .liquidity-pool-vault get-available-balance "STX")
(contract-call? .liquidity-pool-vault get-available-balance "SBTC")

;; 6. UPDATE POLICY STATUS - EXERCISE PUT

;; Update oracle price to below PUT target (BTC price dropped)
(contract-call? .oracle set-aggregated-price u40000)

;; Exercise PUT policy
(contract-call? .policy-registry update-policy-status u0 "exercised")

;; Check policy status
(contract-call? .policy-registry get-policy u1)

;; Pay settlement to PUT policy buyer
(contract-call? .liquidity-pool-vault pay-settlement "STX" u12500000 'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB u1)

;; Release collateral after settlement
(contract-call? .liquidity-pool-vault release-collateral "STX" u25000000 u1)

;; 7. UPDATE POLICY STATUS - EXPIRE CALL

;; Set oracle price below CALL target (no exercise)
(contract-call? .oracle set-btc-price u55000 u1200)

;; Expire CALL policy
(contract-call? .policy-registry update-policy-status u2 "expired")

;; Check policy status
(contract-call? .policy-registry get-policy u2)

;; Release collateral from expired policy
(contract-call? .liquidity-pool-vault release-collateral "SBTC" u50000 u2)

;; 8. PROVIDER WITHDRAWALS

;; Withdraw STX for a provider
(contract-call? .liquidity-pool-vault withdraw-stx u30000000 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG)

;; Withdraw sBTC for a provider
(contract-call? .liquidity-pool-vault withdraw-sip010 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token u2000000 'ST2NEB84ASENDXKYGJPQW86YXQCEFEX2ZQPG87ND)

;; Final balance check
(contract-call? .liquidity-pool-vault get-total-token-balance "STX")
(contract-call? .liquidity-pool-vault get-total-token-balance "SBTC")
(contract-call? .liquidity-pool-vault get-locked-collateral "STX")
(contract-call? .liquidity-pool-vault get-locked-collateral "SBTC")
