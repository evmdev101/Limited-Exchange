# Limited Exchange 1:1 redemption contracts

`TokenRedemptionVault.sol` is deployed once for each token pair:

| Original token | Original address | Limited token | Status |
| --- | --- | --- | --- |
| CashX | `0x4C450b3C2b89a2DAbE5A3eE39FF475134A30d665` | LCashX | Awaiting limited-token address |
| DistroX | `0xA1198e47Ac3D89903D7eCFd04a14b8Bfd72d7B03` | LDistroX | Awaiting limited-token address |
| DivX | `0x6df9CD07BF067b42A700dc679bD9325Ff61Da8f3` | LDivX | Awaiting limited-token address |
| GSX | `0x395127a44Ac1CDc609C8CC9d048E096e8E8fC30e` | LGSX | Awaiting limited-token address |

Each vault transfers the user's original token to the template's recognized dead address. These four TokenTax contracts burn dead-address transfers from total supply before applying ordinary transfer taxes. The vault independently measures `totalSupply()` before and after the transfer and proceeds only if the exact requested amount was burned. It then transfers exactly the same smallest-unit amount of the matching limited token. If any check fails, the complete transaction reverts.

Each vault exposes on-chain statistics for `totalBurned`, `totalLimitedDistributed`, `redemptionCount`, `uniqueRedeemers`, and each wallet's cumulative burned amount.

## Requirements from the token developer

1. Each limited token address must be final and verified before deploying its vault.
2. Each pair must use the same number of decimals. All four supplied originals report 18 decimals, so the matching limited tokens should also use 18.
   Update the matching website configuration if a pair does not use 18 decimals.
3. Every limited token must exempt its matching vault from output transfer taxes. The vault rejects a redemption unless the user's balance increases by the exact 1:1 amount.
4. If pool deposits are taxed, the vault records the amount actually received. For simpler bookkeeping, exempt vault-funding transfers as well.
5. Confirm the project-owner wallet that will own, pause, refill, and—while paused—withdraw unused inventory from each vault.

## Deployment order

1. Receive and verify the four limited-token addresses plus the project-owner wallet.
2. Deploy four `TokenRedemptionVault` instances using the corresponding original token, limited token, and owner wallet as constructor arguments.
3. Exempt each new vault from the relevant limited token's transaction tax.
4. Run a small live test: fund, approve, redeem, confirm the original total supply fell by the exact amount, and confirm the user received exactly 1:1.
5. Verify each vault on the PulseChain explorer.
6. Add the four limited-token and four vault addresses to the website configuration.
7. Fund the pools, test again, have the contracts independently reviewed, then open redemptions to the community.

The contracts should receive an independent security review before production funds are deposited.
