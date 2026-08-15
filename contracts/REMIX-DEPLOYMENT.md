# PulseChain Remix deployment checklist

This prepares the four production contracts but does not authorize deployment or minter changes. The Limited-token creator wallet is locked in as the initial exchange owner.

## Compiler settings

Use the same settings for every contract:

- Solidity compiler: `0.8.36+commit.8a079791`
- EVM version: `paris`
- Optimization: enabled
- Runs: `200`
- `viaIR`: off
- OpenZeppelin Contracts: `5.6.1` from this project

Do not use the compiler default, Cancun, or Osaka. PulseChain deployment bytecode must target Paris.

## Wallet and network

- Environment: connected browser wallet
- Network: PulseChain Mainnet
- Chain ID: `369`
- Constructor value: `0` PLS
- Constructor argument: none

The deploying wallet pays gas. The initial owner is fixed as `0x175750eA3aDed69d2375ffe044BFb6E46ec90702`, the Limited-token creator wallet. It controls only pause/unpause and exchange ownership; the PLS treasury and 5% management recipient are also fixed in the source.

## Deploy exactly these contracts

| Source file | Contract selected in Remix | Constructor input |
| --- | --- | --- |
| `CashXLCashXMintExchange.sol` | `CashXLCashXMintExchange` | none |
| `DistroXLDistroXMintExchange.sol` | `DistroXLDistroXMintExchange` | none |
| `DivXLDivXMintExchange.sol` | `DivXLDivXMintExchange` | none |
| `GSXLGSXMintExchange.sol` | `GSXLGSXMintExchange` | none |

Do not deploy `SwapBurnMintExchangeCore`, any `I...` interface, `SafeERC20`, `StorageSlot`, or the legacy `CashXBurnExchange`/`DistroXBurnExchange`/`DivXBurnExchange`/`GSXBurnExchange` contracts.

## Verify immediately after every deployment

Read the following getters before changing a Limited token's minter:

1. `burnToken()` equals the intended original token.
2. `limitedToken()` equals the intended matching Limited token.
3. `pulseXRouter()` equals `0x165C3410fC91EF562C50559f7d2289fEbed552d9`.
4. `wrappedPls()` equals `0xA1077a294dDE1B09bB078844df40758a5D0f9a27`.
5. `treasury()` equals `0x175750eA3aDed69d2375ffe044BFb6E46ec90702`.
6. `managementWallet()` equals `0xDBA19652f7Ed3f3AE6266c91669C6083ba8cE557`.
7. `owner()` equals `0x175750eA3aDed69d2375ffe044BFb6E46ec90702`.
8. `paused()` is false.
9. `BURN_BPS()` is `8000`, `SWAP_BPS()` is `2000`, and `MANAGEMENT_MINT_BPS()` is `500`.

If any value is wrong, abandon that deployment. Constructor values and immutable addresses cannot be edited.

## Connect each Limited token to its exchange

Use the wallet that currently owns the Limited token. On Nexion, open the Limited token's **Manage Token** page and find **Mint Controls**.

1. Copy the verified matching exchange address.
2. Paste it under **Rotate Minter**.
3. Click **Set Minter** and confirm the wallet transaction.
4. Refresh and confirm the displayed minter is the exchange address.

Mapping:

- LCashX minter → `0x0ed167A5e0E55bD51F504268eBe44cF8681Dd50d`
- LDistroX minter → `0xCb53dcA3D4ee58B71916C153c83f50b25b70a5BB`
- LDivX minter → `0x74c4705865782134612B5E1bcE15E5C42c53c4c5`
- LGSX minter → `0x31F38Cf2dC34C6d19CCD845486E4639c88b9ffF7`

Do not transfer token ownership to the exchange. Do not press **Finalize Minting**. Do not renounce ownership.

If a contract is replaced before finalization, the Limited-token owner can rotate the minter from the old exchange to the verified replacement. The old contract immediately becomes unable to mint.

## Tiny live test for every pair

Before public use:

1. If needed, add the exchange to the original token's tax exclusions so the 20% swap amount reaches it exactly.
2. Use a very small amount that still produces a nonzero 5% management mint.
3. Read `quote(amount)` and `quotePlsOut(amount)`.
4. Set the website's minimum PLS output using an explicit slippage tolerance.
5. Approve the original token for only the test amount.
6. Call `burnAndMint(amount, minPlsOut)`.
7. Confirm 80% reduced the original `totalSupply()` and the dead-address transfer is visible.
8. Confirm 20% was swapped through PulseX and native PLS reached the fixed treasury.
9. Confirm the user received exactly 1:1 Limited tokens.
10. Confirm the management wallet received exactly 5% extra Limited tokens.
11. Confirm all exchange statistics increased by the same values.

Any failure must revert the complete transaction. If the original does not reduce supply exactly or taxes the exchange transfer, do not weaken the checks; correct the token configuration instead.

## Explorer verification

Verify with the exact deployment settings:

- Compiler: `0.8.36+commit.8a079791`
- EVM: `paris`
- Optimization: enabled, 200 runs
- Contract: exact named production contract
- Constructor argument: none

After all four tiny tests pass, record the addresses in `contracts/deployment/pulsechain-pools.json`, update the website configuration, run the full build, and request an independent security review before public launch.
