# Limited Exchange 1:1 burn contracts

Each token pair has its own named burn exchange contract. The four contracts share one internal security core so their behavior stays consistent, but every deployed exchange receives its own contract address.

| Deployable contract | Original token | Fixed original address | Limited token |
| --- | --- | --- | --- |
| `CashXBurnExchange` | CashX | `0x4C450b3C2b89a2DAbE5A3eE39FF475134A30d665` | LCashX address pending |
| `DistroXBurnExchange` | DistroX | `0xA1198e47Ac3D89903D7eCFd04a14b8Bfd72d7B03` | LDistroX address pending |
| `DivXBurnExchange` | DivX | `0x6df9CD07BF067b42A700dc679bD9325Ff61Da8f3` | LDivX address pending |
| `GSXBurnExchange` | GSX | `0x395127a44Ac1CDc609C8CC9d048E096e8E8fC30e` | LGSX address pending |

`BurnExchangeCore.sol` contains shared internal logic and cannot be deployed directly. `BurnExchanges.sol` contains the four named production contracts above.

Each burn exchange sends the user's original token through the TokenTax template's dead-address burn path. The contract measures `totalSupply()` before and after the transfer and continues only when the exact requested amount was destroyed. It then sends exactly the same smallest-unit amount of the matching limited token. If any check fails, the complete transaction reverts.

Each contract exposes on-chain statistics for `totalBurned`, `totalLimitedDistributed`, `exchangeCount`, `uniqueExchangers`, and each wallet's cumulative burned amount.

## Local contract tests

The complete flow can be tested before the real limited tokens exist. `test/BurnExchange.t.sol` deploys temporary fixed-supply mock tokens and a test-only burn exchange on Hardhat's local simulated EVM. These mock contracts are never used on PulseChain.

Run `pnpm test:contracts` to verify exact 1:1 exchange, real supply reduction, reserve accounting, per-wallet and pool statistics, owner-only funding, insufficient reserves, pausing, fixed limited supply, decimal matching, rejection of non-burning inputs, and rejection of taxed outputs. These tests validate our burn-exchange code; a small live test with every final Nexion limited token is still required before launch.

## Constructor inputs

Each named burn exchange takes only two deployment inputs:

1. `limitedToken_`: the final matching limited-token contract address.
2. `initialOwner`: the project wallet that will refill, pause, and manage the exchange.

The constructor checks that the original and limited tokens use the same decimals. A zero limited-token address or zero owner address reverts deployment.

## Requirements from the token developer

1. Each limited token address must be final and verified before deploying its burn exchange.
2. Each pair must use the same number of decimals. All four supplied originals report 18 decimals, so the matching limited tokens should also use 18.
3. Every limited token must exempt its matching burn exchange from output transfer taxes when applicable. The contract rejects an exchange unless the user's balance increases by the exact 1:1 amount.
4. If pool deposits are taxed, the contract records the amount actually received. Exempting pool-funding transfers makes the bookkeeping simpler.
5. Confirm the owner wallet that will pause, refill, and—while paused—withdraw unused inventory from each contract.

## Deployment order

1. Receive and verify the four limited-token addresses plus the owner wallet.
2. Compile `BurnExchanges.sol` with Solidity `0.8.24` or newer and optimizer settings of 200 runs.
3. Select the matching named burn exchange in Remix and deploy it with the limited-token address and owner wallet. Do not deploy the abstract shared core.
4. Confirm the deployed contract's `burnToken`, `limitedToken`, and `owner` getters before funding it.
5. Exempt the contract from the relevant limited token's transaction tax when applicable.
6. Run a small live test: fund, approve, call `burnAndClaim`, confirm the original total supply fell by the exact amount, and confirm the user received exactly 1:1.
7. Verify each burn exchange on the PulseChain explorer.
8. Add the four limited-token and four burn-exchange addresses to the website configuration and `deployment/pulsechain-pools.json`.
9. Fund the pools, test again, have the contracts independently reviewed, then open the exchanges to the community.

The contracts should receive an independent security review before production funds are deposited.
