# Nexion 1:1 redemption contracts

`TokenRedemptionVault.sol` is deployed once for each token pair:

| Burn token | Limited token | Rate |
| --- | --- | --- |
| CashX | LCashX | 1:1 |
| DistroX | LDistroX | 1:1 |
| DivX | LDivX | 1:1 |
| GSX | LGSX | 1:1 |

Each vault permanently burns the user's original token with `burnFrom`, then transfers exactly the same smallest-unit amount of the matching limited token. If either operation fails, the complete transaction reverts.

## Requirements from the token developer

1. Every original token must expose the standard OpenZeppelin-compatible `burnFrom(address,uint256)` function.
2. Each pair must use the same number of decimals. Eighteen decimals is recommended.
   Update the matching website configuration if a pair does not use 18 decimals.
3. Every limited token must exempt its matching vault from output transfer taxes. The vault rejects a redemption unless the user's balance increases by the exact 1:1 amount.
4. If pool deposits are taxed, the vault records the amount actually received. For simpler bookkeeping, exempt vault-funding transfers as well.
5. Provide verified production token addresses and ABIs before any vault is deployed.

## Deployment order

1. Verify all eight production token contracts on PulseChain.
2. Deploy four `TokenRedemptionVault` instances using the corresponding original token, limited token, and the project owner's wallet as constructor arguments.
3. Exempt each new vault from the relevant limited token's transaction tax.
4. Run a small live test: fund, approve, redeem, confirm the original total supply fell, and confirm the user received exactly 1:1.
5. Verify each vault on the PulseChain explorer.
6. Add all twelve addresses (eight tokens and four vaults) to the website configuration.
7. Fund the pools, test again, then open redemptions to the community.

The contracts should receive an independent security review before production funds are deposited.
