# Limited-token burn and mint exchanges

The production system uses four separate contracts. Every contract is permanently locked to one original token and one matching Limited token.

| Deployable contract | Original token | Limited token |
| --- | --- | --- |
| `CashXLCashXMintExchange` | CashX `0x4C450b3C2b89a2DAbE5A3eE39FF475134A30d665` | LCashX `0x53aF69CED5ef8AF3dFf24e9B6c05b1daF4a81A5e` |
| `DistroXLDistroXMintExchange` | DistroX `0xA1198e47Ac3D89903D7eCFd04a14b8Bfd72d7B03` | LDistroX `0x6C1CcA7B939a751a61cB0f07534FcA3eB604b980` |
| `DivXLDivXMintExchange` | DivX `0x6df9CD07BF067b42A700dc679bD9325Ff61Da8f3` | LDivX `0x25345a424325AeBDE317D28cB299b63d47122C69` |
| `GSXLGSXMintExchange` | GSX `0x395127a44Ac1CDc609C8CC9d048E096e8E8fC30e` | LGSX `0xd7e0b1a31d03Fba256371d56B19bB7fd05e61C91` |

## Deployed PulseChain exchanges

| Pair | Exchange address |
| --- | --- |
| CashX → LCashX | `0x0ed167A5e0E55bD51F504268eBe44cF8681Dd50d` |
| DistroX → LDistroX | `0xCb53dcA3D4ee58B71916C153c83f50b25b70a5BB` |
| DivX → LDivX | `0x74c4705865782134612B5E1bcE15E5C42c53c4c5` |
| GSX → LGSX | `0x31F38Cf2dC34C6d19CCD845486E4639c88b9ffF7` |

The deployments have the expected immutable addresses and percentages. Their matching Limited tokens must still rotate the active minter to these exchange addresses before public use.

All four inherit `SwapBurnMintExchangeCore.sol`. That file is abstract shared logic and is not deployed by itself. The older `BurnExchanges.sol` contracts are reserve-funded prototypes and must not be used for this launch.

## One atomic exchange

For an input of 100 original tokens, one call does all of the following:

1. Permanently burns 80 original tokens.
2. Sends 20 original tokens through PulseX V2 and delivers the resulting native PLS to `0x175750eA3aDed69d2375ffe044BFb6E46ec90702`.
3. Mints exactly 100 matching Limited tokens to the user.
4. Mints an additional 5 Limited tokens to the management wallet `0xDBA19652f7Ed3f3AE6266c91669C6083ba8cE557`.
5. Updates the on-chain statistics and emits one event.

If the burn, swap, PLS transfer, user mint, management mint, or any exact-amount check fails, the whole transaction reverts. The user does not lose the original tokens on a failed exchange.

The exchange never holds a reserve of Limited tokens. It mints on demand, so the matching Limited token must name the deployed exchange as its active minter. Do not transfer Limited-token ownership to the exchange.

## Fixed shared addresses

- PulseX V2 router: `0x165C3410fC91EF562C50559f7d2289fEbed552d9`
- WPLS: `0xA1077a294dDE1B09bB078844df40758a5D0f9a27`
- PLS treasury: `0x175750eA3aDed69d2375ffe044BFb6E46ec90702`
- 5% management wallet: `0xDBA19652f7Ed3f3AE6266c91669C6083ba8cE557`
- permanent burn sink: `0x000000000000000000000000000000000000dEaD`

The production wrappers have no constructor input. Their initial owner is fixed as the Limited-token creator wallet, `0x175750eA3aDed69d2375ffe044BFb6E46ec90702`. This address can pause/unpause an exchange and transfer its exchange ownership. It cannot change the token pair, percentages, router, treasury, management wallet, or burn sink.

## Current on-chain Limited-token state

All four Limited tokens were checked on PulseChain before these wrappers were created:

- 18 decimals, matching their originals.
- Initial total supply of 1 token.
- Minting is not finalized.
- Current minter and owner are `0x175750eA3aDed69d2375ffe044BFb6E46ec90702`.

The starting token is not counted in exchange statistics. It may be sent to a burn address if the project wants the public supply to start at zero, but that is separate from deploying the exchange.

Never press **Finalize Minting**. Finalization removes the minter irreversibly and would permanently stop the exchange from minting.

## Safety checks before opening each pair

1. Confirm the source code and every hardcoded address.
2. Confirm the hardcoded `INITIAL_OWNER` is `0x175750eA3aDed69d2375ffe044BFb6E46ec90702`.
3. Deploy the matching named contract with the PulseChain/Paris settings in `REMIX-DEPLOYMENT.md`.
4. Verify all public getters and source code on the explorer.
5. Add the exchange to the original token's tax exclusions if needed. The 20% swap transfer must arrive at the exchange exactly; a taxed incoming transfer reverts.
6. Rotate only the matching Limited token's minter to the new exchange.
7. Perform a tiny live exchange and confirm exact supply reduction, PulseX swap, treasury PLS, 1:1 user mint, 5% management mint, and statistics.
8. Pause immediately if any result differs.

CashX passed this complete mainnet flow with the TMT prototype. DistroX, DivX, and GSX still require their own tiny live tests because token behavior and tax settings can differ.

Run `pnpm test:contracts` for the local atomicity and accounting tests. Run `pnpm test` for contracts, artifact generation, and the website production build. Independent security review is still recommended before public launch.
