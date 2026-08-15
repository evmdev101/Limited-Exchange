# CashX -> TMT mainnet test

This is a real PulseChain mainnet test using real CashX and the disposable
TESTMINTTOKEN (TMT). CashX sent through a successful exchange cannot be
recovered.

## Fixed configuration

- CashX: `0x4C450b3C2b89a2DAbE5A3eE39FF475134A30d665`
- TMT: `0x9a9a022BcA19146507091B64468775c8c9C45Cbd`
- CashX treasury: `0xEda3aa737947337b425227dB8174519f623C041F`
- Input split: 80% permanently burned, 20% sent to the treasury
- TMT output: 100% of the CashX input amount (1 CashX input -> 1 TMT minted)

This is a test contract. The final percentage must be reconfirmed before the
production LCashX contract is deployed because earlier planning discussed a
different treasury percentage.

## Remix compilation

1. Add `MintBurnExchangeCore.sol` and `CashXTMTMintExchange.sol` to Remix.
2. Compile `CashXTMTMintExchange.sol` with Solidity `0.8.36`.
3. Under Advanced Configurations, choose EVM version `paris`.
4. Enable optimization with `200` runs.
5. Confirm the selected contract is `CashXTMTMintExchange`.

## Deployment

1. In Deploy & Run Transactions, select Browser Extension / MetaMask.
2. Confirm chain ID `369` (PulseChain Mainnet).
3. Deploy `CashXTMTMintExchange`. It has no constructor inputs.
4. Copy the deployed exchange address.
5. Verify these read functions before continuing:
   - `CASHX()` = `0x4C450b3C2b89a2DAbE5A3eE39FF475134A30d665`
   - `TMT()` = `0x9a9a022BcA19146507091B64468775c8c9C45Cbd`
   - `CASHX_TREASURY()` = `0xEda3aa737947337b425227dB8174519f623C041F`
   - `BURN_BPS()` = `8000`
   - `TREASURY_BPS()` = `2000`
   - `owner()` = the deploying wallet

Do not approve or send CashX until every value above is correct.

## Assign the TMT minter

1. Open the TMT management page on Nexion.
2. Under Mint Controls -> Rotate Minter, enter the deployed exchange address.
3. Click Set Minter and confirm the transaction.
4. Confirm Nexion now shows the exchange address as TMT's active minter.
5. Never click Finalize Minting for this test.

The exchange checks its minter role before it takes any CashX.

## Small live test

Use only `1 CashX` for the first test:

- Token units: `1000000000000000000`
- Expected permanent burn: `0.8 CashX`
- Expected treasury transfer: `0.2 CashX`
- Expected TMT minted: `1 TMT`

1. Approve the exchange to spend exactly `1000000000000000000` CashX units.
2. Call `quote(1000000000000000000)` and confirm the three returned values are:
   - `800000000000000000`
   - `200000000000000000`
   - `1000000000000000000`
3. Call `burnAndMint(1000000000000000000)`.
4. Confirm the CashX total supply decreased by exactly `0.8 CashX`.
5. Confirm the treasury received at least `0.2 CashX`.
6. Confirm the testing wallet received exactly `1 TMT`.
7. Confirm `exchangeCount()` is `1` and the aggregate counters match the split.

If any exact check or the TMT mint fails, the whole transaction reverts and no
CashX is burned or sent to the treasury. The approval remains until it is used
or revoked; call CashX `approve(exchangeAddress, 0)` to revoke it.

After the test, call `pause()` on the exchange and optionally rotate the TMT
minter back to the owner wallet.
