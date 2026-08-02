# PulseChain Remix deployment checklist

Use this checklist for all four production burn exchanges. Nothing in this file is a contract address or permission to deploy; wait for the four final limited-token addresses and the confirmed owner wallet.

## Required compiler settings

Set these values in Remix's **Solidity Compiler** panel before compiling:

- Compiler: `0.8.36+commit.8a079791`
- EVM version: `paris`
- Enable optimization: yes
- Optimization runs: `200`
- Use configuration file / via IR: `viaIR` must remain off

PulseChain does not support the Cancun `MCOPY` opcode used by newer EVM targets. Do not leave EVM version on the compiler default, and do not select Cancun. The local compiler, generated deployment artifacts, and Hardhat tests are all locked to Paris.

This project uses OpenZeppelin Contracts `5.6.1`. Compile from this project with its installed dependency rather than allowing Remix to silently resolve a different OpenZeppelin version.

## Wallet and network

- Remix environment: **Injected Provider - MetaMask** (or the connected wallet provider)
- Network: **PulseChain Mainnet**
- Chain ID: `369`
- Constructor value: `0` PLS
- Deploying wallet: the wallet paying gas; it does not have to remain owner if the confirmed owner wallet is passed to the constructor

Confirm the wallet shows PulseChain and chain ID 369 immediately before every deployment. Never paste or expose a private key in Remix.

## Deployments

Compile `contracts/src/BurnExchanges.sol`, then select one named contract at a time. Each constructor takes the limited-token address first and the owner wallet second.

| Contract selected in Remix | `limitedToken_` | `initialOwner` |
| --- | --- | --- |
| `CashXBurnExchange` | Final LCashX address | Confirmed project owner wallet |
| `DistroXBurnExchange` | Final LDistroX address | Confirmed project owner wallet |
| `DivXBurnExchange` | Final LDivX address | Confirmed project owner wallet |
| `GSXBurnExchange` | Final LGSX address | Confirmed project owner wallet |

Do not deploy `BurnExchangeCore`; it is abstract shared code and is already included inside every named burn exchange.

## Check immediately after each deployment

Before sending limited tokens to a new exchange, read these public values in Remix:

1. `burnToken()` equals the correct fixed original-token address.
2. `limitedToken()` equals the limited-token address passed to the constructor.
3. `owner()` equals the confirmed owner wallet.
4. `reserve()` equals zero before funding.
5. `paused()` is false.

Record the deployment transaction and contract address. If any address is wrong, abandon that deployment and do not fund it; constructor values cannot be edited.

## Small live test before launch

1. If the limited token has transfer taxes, exempt the burn exchange first.
2. From the owner wallet, approve a small limited-token amount to the burn exchange.
3. Call `fund(amount)` and confirm `reserve()` increased by the amount actually received.
4. From a separate test wallet, approve the matching original token.
5. Call `burnAndClaim(amount)` with a very small amount.
6. Confirm the original token's `totalSupply()` fell by exactly that amount.
7. Confirm the test wallet received exactly the same amount of the limited token.
8. Confirm `totalBurned`, `totalLimitedDistributed`, `exchangeCount`, and `uniqueExchangers` updated.

If the limited output is taxed or the original does not reduce total supply through the dead-address burn path, the transaction will revert. Stop and resolve the token configuration rather than weakening the exchange checks.

## Explorer verification

Use the exact deployment settings when verifying on the PulseChain explorer:

- Compiler: `0.8.36+commit.8a079791`
- EVM version: `paris`
- Optimization: enabled
- Optimization runs: `200`
- Contract name: the exact named exchange deployed
- Constructor arguments: the same limited-token and owner addresses used at deployment

After verification and the small live test, add the limited-token and burn-exchange addresses to `contracts/deployment/pulsechain-pools.json` and the website configuration.
